from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.api.auth import get_current_user
from app.models.user import User
from app.models.social_account import SocialAccount
from app.models.post import Post, PostStatus, PostType
from app.models.automation_rule import AutomationRule, RuleType, TriggerType
from app.models.scheduled_post import ScheduledPost, FrequencyType
from app.schemas.social_media import (
    SocialAccountResponse, PostCreate, PostResponse, PostUpdate,
    AutomationRuleCreate, AutomationRuleResponse, AutomationRuleUpdate,
    FacebookConnectRequest, FacebookPostRequest, AutoReplyToggleRequest,
    InstagramConnectRequest, InstagramPostRequest, InstagramAccountInfo,
    SuccessResponse, ErrorResponse
)
from datetime import datetime
import logging
from app.services.instagram_service import instagram_service

router = APIRouter(prefix="/social", tags=["social media"])

logger = logging.getLogger(__name__)


# Social Account Management
@router.get("/accounts", response_model=List[SocialAccountResponse])
async def get_social_accounts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all connected social media accounts for the current user."""
    accounts = db.query(SocialAccount).filter(
        SocialAccount.user_id == current_user.id
    ).all()
    return accounts


@router.get("/accounts/{account_id}", response_model=SocialAccountResponse)
async def get_social_account(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific social media account."""
    account = db.query(SocialAccount).filter(
        SocialAccount.id == account_id,
        SocialAccount.user_id == current_user.id
    ).first()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Social account not found"
        )
    
    return account


# Facebook Integration
@router.get("/facebook/status")
async def get_facebook_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Check if user has existing Facebook connections."""
    facebook_accounts = db.query(SocialAccount).filter(
        SocialAccount.user_id == current_user.id,
        SocialAccount.platform == "facebook",
        SocialAccount.is_connected == True
    ).all()
    
    if not facebook_accounts:
        return {
            "connected": False,
            "message": "No Facebook accounts connected"
        }
    
    # Separate personal accounts from pages
    personal_accounts = [acc for acc in facebook_accounts if acc.account_type == "personal"]
    page_accounts = [acc for acc in facebook_accounts if acc.account_type == "page"]
    
    return {
        "connected": True,
        "message": f"Found {len(facebook_accounts)} Facebook connection(s)",
        "accounts": {
            "personal": [{
                "id": acc.id,
                "platform_id": acc.platform_user_id,
                "name": acc.display_name or "Personal Profile",
                "profile_picture": acc.profile_picture_url,
                "connected_at": acc.connected_at.isoformat() if acc.connected_at else None
            } for acc in personal_accounts],
            "pages": [{
                "id": acc.id,
                "platform_id": acc.platform_user_id,
                "name": acc.display_name,
                "category": acc.platform_data.get("category", "Page") if acc.platform_data else "Page",
                "profile_picture": acc.profile_picture_url,
                "follower_count": acc.follower_count or 0,
                "can_post": acc.platform_data.get("can_post", True) if acc.platform_data else True,
                "can_comment": acc.platform_data.get("can_comment", True) if acc.platform_data else True,
                "connected_at": acc.connected_at.isoformat() if acc.connected_at else None
            } for acc in page_accounts]
        },
        "total_accounts": len(facebook_accounts),
        "pages_count": len(page_accounts)
    }


@router.post("/facebook/logout")
async def logout_facebook(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Disconnect all Facebook accounts for the user."""
    try:
        # Find all Facebook accounts for this user
        facebook_accounts = db.query(SocialAccount).filter(
            SocialAccount.user_id == current_user.id,
            SocialAccount.platform == "facebook"
        ).all()
        
        if not facebook_accounts:
            return SuccessResponse(
                message="No Facebook accounts to disconnect"
            )
        
        # Mark all as disconnected and clear sensitive data
        disconnected_count = 0
        for account in facebook_accounts:
            account.is_connected = False
            account.access_token = ""  # Clear the token for security
            account.last_sync_at = datetime.utcnow()
            disconnected_count += 1
        
        db.commit()
        
        logger.info(f"User {current_user.id} disconnected {disconnected_count} Facebook accounts")
        
        return SuccessResponse(
            message=f"Successfully disconnected {disconnected_count} Facebook account(s)",
            data={
                "disconnected_accounts": disconnected_count,
                "timestamp": datetime.utcnow().isoformat()
            }
        )
        
    except Exception as e:
        logger.error(f"Error disconnecting Facebook accounts for user {current_user.id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to disconnect Facebook accounts"
        )


@router.post("/facebook/connect")
async def connect_facebook(
    request: FacebookConnectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Connect Facebook account and pages."""
    try:
        from app.services.facebook_service import facebook_service
        
        logger.info(f"Facebook connect request for user {current_user.id}: {request.user_id}")
        logger.info(f"Pages data received: {len(request.pages or [])} pages")
        
        # Exchange short-lived token for long-lived token
        logger.info("Exchanging short-lived token for long-lived token...")
        token_exchange_result = await facebook_service.exchange_for_long_lived_token(request.access_token)
        
        if not token_exchange_result["success"]:
            logger.error(f"Token exchange failed: {token_exchange_result.get('error')}")
            raise HTTPException(
                status_code=400,
                detail=f"Failed to get long-lived token: {token_exchange_result.get('error')}"
            )
        
        long_lived_token = token_exchange_result["access_token"]
        expires_at = token_exchange_result["expires_at"]
        
        logger.info(f"Successfully got long-lived token, expires at: {expires_at}")
        
        # Validate the new long-lived token
        validation_result = await facebook_service.validate_access_token(long_lived_token)
        if not validation_result["valid"]:
            raise HTTPException(
                status_code=400,
                detail=f"Long-lived token validation failed: {validation_result.get('error')}"
            )
        
        # Check if account already exists
        existing_account = db.query(SocialAccount).filter(
            SocialAccount.user_id == current_user.id,
            SocialAccount.platform == "facebook",
            SocialAccount.platform_user_id == request.user_id
        ).first()
        
        if existing_account:
            # Update existing account with long-lived token
            existing_account.access_token = long_lived_token
            existing_account.token_expires_at = expires_at
            existing_account.is_connected = True
            existing_account.last_sync_at = datetime.utcnow()
            existing_account.display_name = validation_result.get("name")
            existing_account.profile_picture_url = validation_result.get("picture")
            db.commit()
            account = existing_account
        else:
            # Create new account with long-lived token
            account = SocialAccount(
                user_id=current_user.id,
                platform="facebook",
                platform_user_id=request.user_id,
                access_token=long_lived_token,
                token_expires_at=expires_at,
                account_type="personal",
                display_name=validation_result.get("name"),
                profile_picture_url=validation_result.get("picture"),
                is_connected=True,
                last_sync_at=datetime.utcnow()
            )
            db.add(account)
            db.commit()
            db.refresh(account)
        
        # Handle pages if provided - get long-lived page tokens
        connected_pages = []
        if request.pages:
            logger.info(f"Processing {len(request.pages)} Facebook pages with long-lived tokens")
            
            # Get long-lived page tokens
            long_lived_pages = await facebook_service.get_long_lived_page_tokens(long_lived_token)
            
            # Create a mapping of page IDs to long-lived tokens
            page_token_map = {page["id"]: page["access_token"] for page in long_lived_pages}
            
            for page_data in request.pages:
                # Ensure we have a dict so we can use .get safely
                if hasattr(page_data, "dict"):
                    page_data = page_data.dict()

                page_id = page_data.get("id")
                page_access_token = page_token_map.get(page_id, page_data.get("access_token", ""))
                
                if not page_access_token:
                    logger.warning(f"No access token found for page {page_id}")
                    continue
                
                # Check if page account already exists
                existing_page = db.query(SocialAccount).filter(
                    SocialAccount.user_id == current_user.id,
                    SocialAccount.platform == "facebook",
                    SocialAccount.platform_user_id == page_id
                ).first()
                
                if existing_page:
                    # Update existing page account
                    existing_page.access_token = page_access_token
                    existing_page.token_expires_at = None  # Page tokens don't expire
                    existing_page.display_name = page_data.get("name", existing_page.display_name)
                    existing_page.profile_picture_url = page_data.get("picture", {}).get("data", {}).get("url", existing_page.profile_picture_url)
                    existing_page.follower_count = page_data.get("fan_count", existing_page.follower_count)
                    existing_page.is_connected = True
                    existing_page.last_sync_at = datetime.utcnow()
                    existing_page.platform_data = {
                        "category": page_data.get("category"),
                        "tasks": page_data.get("tasks", []),
                        "can_post": "CREATE_CONTENT" in page_data.get("tasks", []),
                        "can_comment": "MODERATE" in page_data.get("tasks", [])
                    }
                    page_account = existing_page
                else:
                    # Create new page account
                    page_account = SocialAccount(
                        user_id=current_user.id,
                        platform="facebook",
                        platform_user_id=page_id,
                        username=page_data.get("name", "").replace(" ", "").lower(),
                        display_name=page_data.get("name"),
                        access_token=page_access_token,
                        token_expires_at=None,  # Page tokens don't expire
                        profile_picture_url=page_data.get("picture", {}).get("data", {}).get("url"),
                        follower_count=page_data.get("fan_count", 0),
                        account_type="page",
                        platform_data={
                            "category": page_data.get("category"),
                            "tasks": page_data.get("tasks", []),
                            "can_post": "CREATE_CONTENT" in page_data.get("tasks", []),
                            "can_comment": "MODERATE" in page_data.get("tasks", [])
                        },
                        is_connected=True,
                        last_sync_at=datetime.utcnow()
                    )
                    db.add(page_account)
                
                connected_pages.append({
                    "id": page_id,
                    "name": page_data.get("name"),
                    "category": page_data.get("category"),
                    "access_token_type": "long_lived_page_token"
                })
        
        db.commit()
        
        logger.info(f"Successfully connected Facebook account {request.user_id} with {len(connected_pages)} pages")
        
        return {
            "success": True,
            "message": f"Facebook account connected successfully with long-lived tokens",
            "data": {
                "account_id": account.id,
                "user_id": request.user_id,
                "pages_connected": len(connected_pages),
                "pages": connected_pages,
                "token_type": "long_lived_user_token",
                "token_expires_at": expires_at.isoformat() if expires_at else None
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error connecting Facebook account: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to connect Facebook account: {str(e)}"
        )


@router.post("/facebook/post")
async def create_facebook_post(
    request: FacebookPostRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create and schedule a Facebook post with AI integration (replaces Make.com webhook)."""
    try:
        # Import Facebook service
        from app.services.facebook_service import facebook_service
        from app.services.groq_service import groq_service
        
        # Find the Facebook account/page
        account = db.query(SocialAccount).filter(
            SocialAccount.user_id == current_user.id,
            SocialAccount.platform == "facebook",
            SocialAccount.platform_user_id == request.page_id
        ).first()
        
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Facebook page not found"
            )

        if not account.access_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Facebook access token not found. Please reconnect your account."
            )
        
        # Validate and potentially refresh the access token
        logger.info(f"Validating Facebook token for account {account.id}")
        validation_result = await facebook_service.validate_and_refresh_token(
            account.access_token, 
            account.token_expires_at
        )
        
        if not validation_result["valid"]:
            if validation_result.get("expired") or validation_result.get("needs_reconnection"):
                # Mark account as disconnected
                account.is_connected = False
                db.commit()
                
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Facebook login session expired. Please reconnect your account."
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Facebook token validation failed: {validation_result.get('error', 'Unknown error')}"
                )
        
        # Update last sync time since token is valid
        account.last_sync_at = datetime.utcnow()
        db.commit()
        
        final_content = request.message
        ai_generated = False
        
        # Handle AI-generated content for auto posts
        if request.post_type == "auto-generated" and groq_service.is_available():
            try:
                ai_result = await groq_service.generate_facebook_post(request.message)
                if ai_result["success"]:
                    final_content = ai_result["content"]
                    ai_generated = True
            except Exception as ai_error:
                logger.error(f"AI generation failed: {ai_error}")
                # Fall back to original message if AI fails
                print(f"AI generation failed, using original message: {ai_error}")
        
        # Create post record in database
        post = Post(
            user_id=current_user.id,
            social_account_id=account.id,
            content=final_content,
            post_type=PostType.IMAGE if request.image else PostType.TEXT,
            media_urls=[request.image] if request.image else None,
            status=PostStatus.SCHEDULED,
            is_auto_post=ai_generated,
            metadata={
                "ai_generated": ai_generated,
                "original_prompt": request.message if ai_generated else None,
                "post_type": request.post_type
            }
        )
        
        db.add(post)
        db.commit()
        db.refresh(post)
        
        # Actually post to Facebook
        try:
            # Determine media type
            media_type = "text"
            if request.image:
                media_type = "photo"
            
            # Use Facebook service to create the post
            facebook_result = await facebook_service.create_post(
                page_id=request.page_id,
                access_token=account.access_token,
                message=final_content,
                media_url=request.image,
                media_type=media_type
            )
            
            # Update post status based on Facebook result
            if facebook_result and facebook_result.get("success"):
                post.status = PostStatus.PUBLISHED
                post.platform_post_id = facebook_result.get("post_id")
                post.platform_response = facebook_result
            else:
                error_msg = facebook_result.get("error", "Unknown Facebook API error")
                post.status = PostStatus.FAILED
                post.error_message = error_msg
                
                # Check if the error is due to token expiration
                if "expired" in error_msg.lower() or "session" in error_msg.lower() or "token" in error_msg.lower():
                    account.is_connected = False
                    db.commit()
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Facebook login session expired. Please reconnect your account."
                    )
            
            db.commit()
            
        except HTTPException:
            raise
        except Exception as fb_error:
            logger.error(f"Facebook posting error: {fb_error}")
            post.status = PostStatus.FAILED
            post.error_message = str(fb_error)
            db.commit()
            
            # Check if the error suggests token expiration
            error_str = str(fb_error).lower()
            if "expired" in error_str or "session" in error_str or "unauthorized" in error_str:
                account.is_connected = False
                db.commit()
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Facebook login session expired. Please reconnect your account."
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Failed to post to Facebook: {str(fb_error)}"
                )
        
        # Prepare response
        if post.status == PostStatus.PUBLISHED:
            message = "Post published successfully to Facebook!"
        elif ai_generated:
            message = "Post created with AI content (Facebook posting failed)"
        else:
            message = "Post created successfully (Facebook posting failed)"
        
        return SuccessResponse(
            message=message,
            data={
                "post_id": post.id,
                "status": post.status,
                "platform": "facebook",
                "page_name": account.display_name,
                "ai_generated": ai_generated,
                "facebook_post_id": post.platform_post_id,
                "content": final_content
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating Facebook post: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create post: {str(e)}"
        )


@router.post("/facebook/auto-reply")
async def toggle_auto_reply(
    request: AutoReplyToggleRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Toggle auto-reply for Facebook page with AI integration (replaces Make.com webhook)."""
    try:
        # Import Facebook service
        from app.services.facebook_service import facebook_service
        
        # Find the Facebook account/page
        account = db.query(SocialAccount).filter(
            SocialAccount.user_id == current_user.id,
            SocialAccount.platform == "facebook",
            SocialAccount.platform_user_id == request.page_id
        ).first()
        
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Facebook page not found"
            )
        
        # Use Facebook service to setup auto-reply
        facebook_result = await facebook_service.setup_auto_reply(
            page_id=request.page_id,
            access_token=account.access_token,
            enabled=request.enabled,
            template=request.response_template
        )
        
        # Find or create auto-reply rule in database
        auto_reply_rule = db.query(AutomationRule).filter(
            AutomationRule.user_id == current_user.id,
            AutomationRule.social_account_id == account.id,
            AutomationRule.rule_type == RuleType.AUTO_REPLY
        ).first()
        
        if auto_reply_rule:
            # Update existing rule
            auto_reply_rule.is_active = request.enabled
            auto_reply_rule.actions = {
                "response_template": request.response_template,
                "ai_enabled": True,
                "facebook_setup": facebook_result
            }
        else:
            # Create new auto-reply rule
            auto_reply_rule = AutomationRule(
                user_id=current_user.id,
                social_account_id=account.id,
                name=f"Auto Reply - {account.display_name}",
                rule_type=RuleType.AUTO_REPLY,
                trigger_type=TriggerType.ENGAGEMENT_BASED,
                trigger_conditions={"event": "comment"},
                actions={
                    "response_template": request.response_template,
                    "ai_enabled": True,
                    "facebook_setup": facebook_result
                },
                is_active=request.enabled
            )
            db.add(auto_reply_rule)
        
        db.commit()
        
        return SuccessResponse(
            message=f"Auto-reply {'enabled' if request.enabled else 'disabled'} successfully with AI integration",
            data={
                "rule_id": auto_reply_rule.id,
                "enabled": request.enabled,
                "ai_enabled": True,
                "page_name": account.display_name,
                "facebook_setup": facebook_result
            }
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to toggle auto-reply: {str(e)}"
        )


@router.post("/facebook/refresh-tokens")
async def refresh_facebook_tokens(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Validate and refresh Facebook tokens for all connected accounts."""
    try:
        from app.services.facebook_service import facebook_service
        
        # Get all Facebook accounts for this user
        facebook_accounts = db.query(SocialAccount).filter(
            SocialAccount.user_id == current_user.id,
            SocialAccount.platform == "facebook",
            SocialAccount.is_connected == True
        ).all()
        
        if not facebook_accounts:
            return {
                "success": True,
                "message": "No Facebook accounts to refresh",
                "accounts": []
            }
        
        refresh_results = []
        
        for account in facebook_accounts:
            try:
                logger.info(f"Validating token for account {account.id} ({account.display_name})")
                
                validation_result = await facebook_service.validate_and_refresh_token(
                    account.access_token,
                    account.token_expires_at
                )
                
                if validation_result["valid"]:
                    # Token is still valid
                    account.last_sync_at = datetime.utcnow()
                    refresh_results.append({
                        "account_id": account.id,
                        "platform_user_id": account.platform_user_id,
                        "name": account.display_name,
                        "status": "valid",
                        "message": "Token is valid"
                    })
                else:
                    # Token is invalid or expired
                    if validation_result.get("expired") or validation_result.get("needs_reconnection"):
                        account.is_connected = False
                        refresh_results.append({
                            "account_id": account.id,
                            "platform_user_id": account.platform_user_id,
                            "name": account.display_name,
                            "status": "expired",
                            "message": "Token expired - reconnection required",
                            "needs_reconnection": True
                        })
                    else:
                        refresh_results.append({
                            "account_id": account.id,
                            "platform_user_id": account.platform_user_id,
                            "name": account.display_name,
                            "status": "error",
                            "message": validation_result.get("error", "Unknown validation error")
                        })
                
            except Exception as e:
                logger.error(f"Error validating account {account.id}: {e}")
                refresh_results.append({
                    "account_id": account.id,
                    "platform_user_id": account.platform_user_id,
                    "name": account.display_name,
                    "status": "error",
                    "message": f"Validation error: {str(e)}"
                })
        
        db.commit()
        
        # Count results
        valid_count = len([r for r in refresh_results if r["status"] == "valid"])
        expired_count = len([r for r in refresh_results if r["status"] == "expired"])
        error_count = len([r for r in refresh_results if r["status"] == "error"])
        
        return {
            "success": True,
            "message": f"Token validation complete: {valid_count} valid, {expired_count} expired, {error_count} errors",
            "summary": {
                "total_accounts": len(refresh_results),
                "valid": valid_count,
                "expired": expired_count,
                "errors": error_count
            },
            "accounts": refresh_results
        }
        
    except Exception as e:
        logger.error(f"Error refreshing Facebook tokens: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to refresh tokens: {str(e)}"
        )


# Instagram Integration
@router.post("/instagram/connect")
async def connect_instagram(
    request: InstagramConnectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Connect Instagram Business account through Facebook."""
    try:
        logger.info(f"Instagram connect request for user {current_user.id}")
        
        # Use the new service to get Instagram accounts with proper error handling
        try:
            instagram_accounts = instagram_service.get_facebook_pages_with_instagram(request.access_token)
        except Exception as service_error:
            # The service provides detailed troubleshooting messages
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(service_error)
            )
        
        # Save Instagram accounts to database
        connected_accounts = []
        for ig_account in instagram_accounts:
            # Check if account already exists
            existing_account = db.query(SocialAccount).filter(
                SocialAccount.user_id == current_user.id,
                SocialAccount.platform == "instagram",
                SocialAccount.platform_user_id == ig_account["platform_id"]
            ).first()
            
            if existing_account:
                # Update existing account
                existing_account.username = ig_account["username"]
                existing_account.display_name = ig_account["display_name"] or ig_account["username"]
                existing_account.is_connected = True
                existing_account.last_sync_at = datetime.utcnow()
                existing_account.follower_count = ig_account.get("followers_count", 0)
                existing_account.profile_picture_url = ig_account.get("profile_picture")
                existing_account.platform_data = {
                    "page_id": ig_account.get("page_id"),
                    "page_name": ig_account.get("page_name"),
                    "media_count": ig_account.get("media_count", 0),
                    "page_access_token": ig_account.get("page_access_token")
                }
                existing_account.access_token = ig_account.get("page_access_token")
                db.commit()
                connected_accounts.append(existing_account)
                logger.info(f"Updated existing Instagram account: {ig_account['username']} (ID: {ig_account['platform_id']})")
            else:
                # Create new account  
                ig_account_obj = SocialAccount(
                    user_id=current_user.id,
                    platform="instagram",
                    platform_user_id=ig_account["platform_id"],
                    username=ig_account["username"],
                    display_name=ig_account["display_name"] or ig_account["username"],
                    account_type="business",
                    follower_count=ig_account.get("followers_count", 0),
                    profile_picture_url=ig_account.get("profile_picture"),
                    platform_data={
                        "page_id": ig_account.get("page_id"),
                        "page_name": ig_account.get("page_name"),
                        "media_count": ig_account.get("media_count", 0),
                        "page_access_token": ig_account.get("page_access_token")
                    },
                    access_token=ig_account.get("page_access_token"),
                    is_connected=True,
                    last_sync_at=datetime.utcnow()
                )
                db.add(ig_account_obj)
                db.commit()
                db.refresh(ig_account_obj)
                connected_accounts.append(ig_account_obj)
                logger.info(f"Created new Instagram account: {ig_account['username']} (ID: {ig_account['platform_id']})")
        
        logger.info(f"Instagram connection successful. Connected accounts: {len(connected_accounts)}")
        
        return SuccessResponse(
            message=f"Instagram account(s) connected successfully ({len(connected_accounts)} accounts)",
            data={
                "accounts": [{
                    "platform_id": acc.platform_user_id,
                    "username": acc.username,
                    "display_name": acc.display_name,
                    "page_name": acc.platform_data.get("page_name"),
                    "followers_count": acc.follower_count or 0,
                    "media_count": acc.platform_data.get("media_count", 0),
                    "profile_picture": acc.profile_picture_url
                } for acc in connected_accounts]
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error connecting Instagram account: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to connect Instagram account: {str(e)}"
        )


@router.post("/instagram/post")
async def create_instagram_post(
    request: InstagramPostRequest = None,
    instagram_user_id: str = None,
    caption: str = None,
    image_url: str = None,
    post_type: str = "manual",
    use_ai: bool = False,
    prompt: str = None,
    image: UploadFile = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create and publish an Instagram post."""
    try:
        # Handle both JSON and FormData requests
        if request:
            # JSON request
            instagram_user_id = request.instagram_user_id
            caption = request.caption
            image_url = request.image_url
            post_type = request.post_type
            use_ai = getattr(request, 'use_ai', False)
            prompt = getattr(request, 'prompt', None)
        else:
            # FormData request - parameters are already available
            pass
        
        # Find the Instagram account
        account = db.query(SocialAccount).filter(
            SocialAccount.user_id == current_user.id,
            SocialAccount.platform == "instagram",
            SocialAccount.platform_user_id == instagram_user_id
        ).first()
        
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Instagram account not found"
            )
        
        # Get the page access token from platform_data
        page_access_token = account.platform_data.get("page_access_token")
        if not page_access_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Page access token not found. Please reconnect your Instagram account."
            )
        
        # Handle file upload if present
        final_image_url = image_url
        if image and image.filename:
            # TODO: Implement file upload to cloud storage (AWS S3, etc.)
            # For now, we'll return an error for file uploads
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File upload not yet implemented. Please use image URL instead."
            )
        
        # Create the post using Instagram service
        if post_type == "post-auto" or use_ai:
            # AI-generated post
            post_result = await instagram_service.create_ai_generated_post(
                instagram_user_id=instagram_user_id,
                access_token=page_access_token,
                prompt=prompt or caption,
                image_url=final_image_url
            )
        else:
            # Manual post
            try:
                post_result = instagram_service.create_post(
                    instagram_user_id=instagram_user_id,
                    page_access_token=page_access_token,
                    caption=caption,
                    image_url=final_image_url
                )
            except Exception as service_error:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=str(service_error)
                )
        
        if not post_result["success"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to create Instagram post: {post_result.get('error', 'Unknown error')}"
            )
        
        # Save post to database
        post = Post(
            user_id=current_user.id,
            social_account_id=account.id,
            content=post_result.get("generated_caption") or caption,
            post_type=PostType.IMAGE,
            status=PostStatus.PUBLISHED,
            platform_post_id=post_result.get("post_id"),
            published_at=datetime.utcnow(),
            media_urls=[final_image_url] if final_image_url else None
        )
        
        db.add(post)
        db.commit()
        db.refresh(post)
        
        return SuccessResponse(
            message="Instagram post created successfully",
            data={
                "post_id": post_result.get("post_id"),
                "database_id": post.id,
                "platform": "instagram",
                "account_username": account.username,
                "ai_generated": post_result.get("ai_generated", False),
                "generated_caption": post_result.get("generated_caption"),
                "original_prompt": post_result.get("original_prompt")
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating Instagram post: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create Instagram post: {str(e)}"
        )


@router.get("/instagram/media/{instagram_user_id}")
async def get_instagram_media(
    instagram_user_id: str,
    limit: int = 25,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get Instagram media for a connected account."""
    try:
        # Find the Instagram account
        account = db.query(SocialAccount).filter(
            SocialAccount.user_id == current_user.id,
            SocialAccount.platform == "instagram",
            SocialAccount.platform_user_id == instagram_user_id
        ).first()
        
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Instagram account not found"
            )
        
        # Get the page access token from platform_data
        page_access_token = account.platform_data.get("page_access_token")
        if not page_access_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Page access token not found. Please reconnect your Instagram account."
            )
        
        # Get media from Instagram API using new service
        media_items = instagram_service.get_user_media(
            instagram_user_id=instagram_user_id,
            page_access_token=page_access_token,
            limit=limit
        )
        
        return SuccessResponse(
            message=f"Retrieved {len(media_items)} media items",
            data={
                "media": media_items,
                "account_username": account.username,
                "total_items": len(media_items)
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting Instagram media: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get Instagram media: {str(e)}"
        )


# Post Management
@router.get("/posts", response_model=List[PostResponse])
async def get_posts(
    platform: Optional[str] = None,
    status: Optional[PostStatus] = None,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's posts with optional filtering."""
    query = db.query(Post).filter(Post.user_id == current_user.id)
    
    if platform:
        query = query.join(SocialAccount).filter(SocialAccount.platform == platform)
    
    if status:
        query = query.filter(Post.status == status)
    
    posts = query.order_by(Post.created_at.desc()).limit(limit).all()
    return posts


@router.post("/posts", response_model=PostResponse)
async def create_post(
    post_data: PostCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new social media post."""
    # Verify user owns the social account
    account = db.query(SocialAccount).filter(
        SocialAccount.id == post_data.social_account_id,
        SocialAccount.user_id == current_user.id
    ).first()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Social account not found"
        )
    
    post = Post(
        user_id=current_user.id,
        social_account_id=post_data.social_account_id,
        content=post_data.content,
        post_type=post_data.post_type,
        link_url=post_data.link_url,
        hashtags=post_data.hashtags,
        media_urls=post_data.media_urls,
        scheduled_at=post_data.scheduled_at,
        status=PostStatus.SCHEDULED if post_data.scheduled_at else PostStatus.DRAFT
    )
    
    db.add(post)
    db.commit()
    db.refresh(post)
    
    return post


@router.put("/posts/{post_id}", response_model=PostResponse)
async def update_post(
    post_id: int,
    post_data: PostUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a post."""
    post = db.query(Post).filter(
        Post.id == post_id,
        Post.user_id == current_user.id
    ).first()
    
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found"
        )
    
    # Update fields
    if post_data.content is not None:
        post.content = post_data.content
    if post_data.scheduled_at is not None:
        post.scheduled_at = post_data.scheduled_at
    if post_data.status is not None:
        post.status = post_data.status
    
    db.commit()
    db.refresh(post)
    
    return post


# Automation Rules Management
@router.get("/automation-rules", response_model=List[AutomationRuleResponse])
async def get_automation_rules(
    platform: Optional[str] = None,
    rule_type: Optional[RuleType] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's automation rules."""
    query = db.query(AutomationRule).filter(AutomationRule.user_id == current_user.id)
    
    if platform:
        query = query.join(SocialAccount).filter(SocialAccount.platform == platform)
    
    if rule_type:
        query = query.filter(AutomationRule.rule_type == rule_type)
    
    rules = query.order_by(AutomationRule.created_at.desc()).all()
    return rules


@router.post("/automation-rules", response_model=AutomationRuleResponse)
async def create_automation_rule(
    rule_data: AutomationRuleCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new automation rule."""
    # Verify user owns the social account
    account = db.query(SocialAccount).filter(
        SocialAccount.id == rule_data.social_account_id,
        SocialAccount.user_id == current_user.id
    ).first()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Social account not found"
        )
    
    rule = AutomationRule(
        user_id=current_user.id,
        social_account_id=rule_data.social_account_id,
        name=rule_data.name,
        description=rule_data.description,
        rule_type=rule_data.rule_type,
        trigger_type=rule_data.trigger_type,
        trigger_conditions=rule_data.trigger_conditions,
        actions=rule_data.actions,
        daily_limit=rule_data.daily_limit,
        active_hours_start=rule_data.active_hours_start,
        active_hours_end=rule_data.active_hours_end,
        active_days=rule_data.active_days
    )
    
    db.add(rule)
    db.commit()
    db.refresh(rule)
    
    return rule


@router.put("/automation-rules/{rule_id}", response_model=AutomationRuleResponse)
async def update_automation_rule(
    rule_id: int,
    rule_data: AutomationRuleUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update an automation rule."""
    rule = db.query(AutomationRule).filter(
        AutomationRule.id == rule_id,
        AutomationRule.user_id == current_user.id
    ).first()
    
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Automation rule not found"
        )
    
    # Update fields
    if rule_data.name is not None:
        rule.name = rule_data.name
    if rule_data.description is not None:
        rule.description = rule_data.description
    if rule_data.trigger_conditions is not None:
        rule.trigger_conditions = rule_data.trigger_conditions
    if rule_data.actions is not None:
        rule.actions = rule_data.actions
    if rule_data.is_active is not None:
        rule.is_active = rule_data.is_active
    if rule_data.daily_limit is not None:
        rule.daily_limit = rule_data.daily_limit
    
    db.commit()
    db.refresh(rule)
    
    return rule


@router.delete("/automation-rules/{rule_id}")
async def delete_automation_rule(
    rule_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete an automation rule."""
    rule = db.query(AutomationRule).filter(
        AutomationRule.id == rule_id,
        AutomationRule.user_id == current_user.id
    ).first()
    
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Automation rule not found"
        )
    
    db.delete(rule)
    db.commit()
    
    return SuccessResponse(message="Automation rule deleted successfully")


# Debug endpoint for troubleshooting Facebook connections
@router.get("/debug/facebook-accounts")
async def debug_facebook_accounts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Debug endpoint to see all Facebook accounts for current user."""
    facebook_accounts = db.query(SocialAccount).filter(
        SocialAccount.user_id == current_user.id,
        SocialAccount.platform == "facebook"
    ).all()
    
    return {
        "user_id": current_user.id,
        "total_facebook_accounts": len(facebook_accounts),
        "accounts": [{
            "id": acc.id,
            "platform_user_id": acc.platform_user_id,
            "username": acc.username,
            "display_name": acc.display_name,
            "account_type": acc.account_type,
            "is_connected": acc.is_connected,
            "follower_count": acc.follower_count,
            "profile_picture_url": acc.profile_picture_url,
            "platform_data": acc.platform_data,
            "last_sync_at": acc.last_sync_at,
            "connected_at": acc.connected_at
        } for acc in facebook_accounts]
    }


# Scheduled Posts Endpoints
@router.get("/scheduled-posts")
async def get_scheduled_posts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all scheduled posts for the current user."""
    scheduled_posts = db.query(ScheduledPost).filter(
        ScheduledPost.user_id == current_user.id
    ).all()
    
    return [{
        "id": post.id,
        "prompt": post.prompt,
        "post_time": post.post_time,
        "frequency": post.frequency.value,
        "is_active": post.is_active,
        "last_executed": post.last_executed.isoformat() if post.last_executed else None,
        "next_execution": post.next_execution.isoformat() if post.next_execution else None,
        "social_account": {
            "id": post.social_account.id,
            "platform": post.social_account.platform,
            "display_name": post.social_account.display_name
        } if post.social_account else None,
        "created_at": post.created_at.isoformat() if post.created_at else None
    } for post in scheduled_posts]


@router.post("/scheduled-posts")
async def create_scheduled_post(
    prompt: str,
    post_time: str,
    frequency: str = "daily",
    social_account_id: int = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new scheduled post."""
    try:
        # Validate frequency
        if frequency not in ["daily", "weekly", "monthly"]:
            raise HTTPException(
                status_code=400,
                detail="Invalid frequency. Must be 'daily', 'weekly', or 'monthly'"
            )
        
        # If no social account specified, find the first Facebook account
        if not social_account_id:
            facebook_account = db.query(SocialAccount).filter(
                SocialAccount.user_id == current_user.id,
                SocialAccount.platform == "facebook",
                SocialAccount.is_connected == True
            ).first()
            
            if not facebook_account:
                raise HTTPException(
                    status_code=400,
                    detail="No connected Facebook account found"
                )
            social_account_id = facebook_account.id
        
        # Calculate next execution time
        from datetime import datetime, timedelta
        
        try:
            time_parts = post_time.split(":")
            hour = int(time_parts[0])
            minute = int(time_parts[1])
        except (ValueError, IndexError):
            raise HTTPException(
                status_code=400,
                detail="Invalid time format. Use HH:MM"
            )
        
        now = datetime.utcnow()
        next_exec = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        
        # If the time has already passed today, schedule for next occurrence
        if next_exec <= now:
            if frequency == "daily":
                # For testing: if time passed today, schedule for next occurrence
                next_exec += timedelta(days=1)
            elif frequency == "weekly":
                next_exec += timedelta(weeks=1)
            elif frequency == "monthly":
                next_exec += timedelta(days=30)
        
        # FOR TESTING: If scheduled time is more than 2 hours away, set it to 1 minute from now
        time_diff = next_exec - now
        if time_diff.total_seconds() > 7200:  # More than 2 hours
            logger.info(f"Scheduled time is {time_diff.total_seconds()/3600:.1f} hours away, setting to 1 minute for testing")
            next_exec = now + timedelta(minutes=1)
        
        # Create scheduled post
        scheduled_post = ScheduledPost(
            user_id=current_user.id,
            social_account_id=social_account_id,
            prompt=prompt,
            post_time=post_time,
            frequency=FrequencyType(frequency),
            is_active=True,
            next_execution=next_exec
        )
        
        db.add(scheduled_post)
        db.commit()
        db.refresh(scheduled_post)
        
        logger.info(f"Created scheduled post {scheduled_post.id} for user {current_user.id}")
        
        return SuccessResponse(
            message="Scheduled post created successfully",
            data={
                "id": scheduled_post.id,
                "prompt": scheduled_post.prompt,
                "post_time": scheduled_post.post_time,
                "frequency": scheduled_post.frequency.value,
                "next_execution": scheduled_post.next_execution.isoformat()
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating scheduled post: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to create scheduled post"
        )


@router.delete("/scheduled-posts/{schedule_id}")
async def delete_scheduled_post(
    schedule_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a scheduled post."""
    try:
        # Find the scheduled post
        scheduled_post = db.query(ScheduledPost).filter(
            ScheduledPost.id == schedule_id,
            ScheduledPost.user_id == current_user.id
        ).first()
        
        if not scheduled_post:
            raise HTTPException(
                status_code=404,
                detail="Scheduled post not found"
            )
        
        # Delete the scheduled post
        db.delete(scheduled_post)
        db.commit()
        
        logger.info(f"Deleted scheduled post {schedule_id} for user {current_user.id}")
        
        return SuccessResponse(
            message="Scheduled post deleted successfully",
            data={"deleted_id": schedule_id}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting scheduled post {schedule_id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to delete scheduled post"
        )


@router.post("/scheduled-posts/trigger")
async def trigger_scheduler(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Manually trigger the scheduler to check for due posts (for testing)."""
    try:
        from app.services.scheduler_service import scheduler_service
        
        # Manually process scheduled posts
        await scheduler_service.process_scheduled_posts()
        
        # Get updated scheduled posts
        scheduled_posts = db.query(ScheduledPost).filter(
            ScheduledPost.user_id == current_user.id
        ).all()
        
        return SuccessResponse(
            message="Scheduler triggered successfully",
            data={
                "processed_at": datetime.utcnow().isoformat(),
                "total_scheduled_posts": len(scheduled_posts),
                "active_schedules": len([p for p in scheduled_posts if p.is_active])
            }
        )
        
    except Exception as e:
        logger.error(f"Error triggering scheduler: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to trigger scheduler"
        )
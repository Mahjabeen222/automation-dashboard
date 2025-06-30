from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.api.auth import get_current_user
from app.models.user import User
from app.models.social_account import SocialAccount
from app.models.post import Post, PostStatus, PostType
from app.models.automation_rule import AutomationRule, RuleType, TriggerType
from app.schemas.social_media import (
    SocialAccountResponse, PostCreate, PostResponse, PostUpdate,
    AutomationRuleCreate, AutomationRuleResponse, AutomationRuleUpdate,
    FacebookConnectRequest, FacebookPostRequest, AutoReplyToggleRequest,
    SuccessResponse, ErrorResponse
)
from datetime import datetime
import logging

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
@router.post("/facebook/connect")
async def connect_facebook(
    request: FacebookConnectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Connect Facebook account and pages."""
    try:
        logger.info(f"Facebook connect request for user {current_user.id}: {request.user_id}")
        logger.info(f"Pages data received: {len(request.pages or [])} pages")
        # Check if account already exists
        existing_account = db.query(SocialAccount).filter(
            SocialAccount.user_id == current_user.id,
            SocialAccount.platform == "facebook",
            SocialAccount.platform_user_id == request.user_id
        ).first()
        
        if existing_account:
            # Update existing account
            existing_account.access_token = request.access_token
            existing_account.is_connected = True
            existing_account.last_sync_at = datetime.utcnow()
            db.commit()
            account = existing_account
        else:
            # Create new account
            account = SocialAccount(
                user_id=current_user.id,
                platform="facebook",
                platform_user_id=request.user_id,
                access_token=request.access_token,
                account_type="personal",
                is_connected=True,
                last_sync_at=datetime.utcnow()
            )
            db.add(account)
            db.commit()
            db.refresh(account)
        
        # Handle pages if provided
        connected_pages = []
        if request.pages:
            logger.info(f"Processing {len(request.pages)} Facebook pages")
            for i, page_info in enumerate(request.pages):
                logger.info(f"Processing page {i+1}/{len(request.pages)}: {page_info.name} (ID: {page_info.id})")
                # Create or update page account
                existing_page = db.query(SocialAccount).filter(
                    SocialAccount.user_id == current_user.id,
                    SocialAccount.platform == "facebook",
                    SocialAccount.platform_user_id == page_info.id
                ).first()
                
                if existing_page:
                    # Update existing page
                    existing_page.access_token = page_info.access_token
                    existing_page.display_name = page_info.name
                    existing_page.username = page_info.name
                    existing_page.is_connected = True
                    existing_page.last_sync_at = datetime.utcnow()
                    existing_page.follower_count = getattr(page_info, 'followerCount', 0) or 0
                    existing_page.profile_picture_url = getattr(page_info, 'profilePicture', None)
                    existing_page.platform_data = {
                        "category": page_info.category,
                        "can_post": getattr(page_info, 'canPost', page_info.can_post),
                        "can_comment": getattr(page_info, 'canComment', True),
                        "follower_count": getattr(page_info, 'followerCount', 0)
                    }
                    db.commit()
                    connected_pages.append(existing_page)
                    logger.info(f"Updated existing Facebook page: {page_info.name} (ID: {page_info.id})")
                else:
                    # Create new page account
                    page_account = SocialAccount(
                        user_id=current_user.id,
                        platform="facebook",
                        platform_user_id=page_info.id,
                        username=page_info.name,
                        display_name=page_info.name,
                        access_token=page_info.access_token,
                        account_type="page",
                        follower_count=getattr(page_info, 'followerCount', 0) or 0,
                        profile_picture_url=getattr(page_info, 'profilePicture', None),
                        platform_data={
                            "category": page_info.category,
                            "can_post": getattr(page_info, 'canPost', page_info.can_post),
                            "can_comment": getattr(page_info, 'canComment', True),
                            "follower_count": getattr(page_info, 'followerCount', 0)
                        },
                        is_connected=True,
                        last_sync_at=datetime.utcnow()
                    )
                    db.add(page_account)
                    db.commit()
                    db.refresh(page_account)
                    connected_pages.append(page_account)
                    logger.info(f"Created new Facebook page: {page_info.name} (ID: {page_info.id})")
        
        # Return detailed response
        logger.info(f"Facebook connection successful. Account ID: {account.id}, Pages: {len(connected_pages)}")
        
        return SuccessResponse(
            message=f"Facebook account connected successfully with {len(connected_pages)} pages",
            data={
                "account_id": account.id,
                "user_account": {
                    "id": account.id,
                    "platform_id": account.platform_user_id,
                    "name": account.display_name or "Personal Profile",
                    "type": "personal"
                },
                "pages": [{
                    "id": p.id,
                    "platform_id": p.platform_user_id,
                    "name": p.display_name,
                    "category": p.platform_data.get("category", "Page"),
                    "can_post": p.platform_data.get("can_post", True),
                    "can_comment": p.platform_data.get("can_comment", True),
                    "follower_count": p.follower_count or 0,
                    "profile_picture": p.profile_picture_url
                } for p in connected_pages],
                "pages_connected": len(connected_pages),
                "total_accounts": len(connected_pages) + 1  # Include user account
            }
        )
        
    except Exception as e:
        logger.error(f"Error connecting Facebook account: {str(e)}", exc_info=True)
        # Don't expose internal errors to frontend
        error_message = "Database connection error" if "database" in str(e).lower() else str(e)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to connect Facebook account: {error_message}"
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
                post.status = PostStatus.FAILED
                post.error_message = facebook_result.get("error", "Unknown Facebook API error")
            
            db.commit()
            
        except Exception as fb_error:
            logger.error(f"Facebook posting error: {fb_error}")
            post.status = PostStatus.FAILED
            post.error_message = str(fb_error)
            db.commit()
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
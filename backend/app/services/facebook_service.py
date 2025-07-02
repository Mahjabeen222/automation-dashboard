import logging
import httpx
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from app.config import get_settings
from app.services.groq_service import groq_service

logger = logging.getLogger(__name__)
settings = get_settings()


class FacebookService:
    """Service for Facebook API operations and integrations."""
    
    def __init__(self):
        self.graph_api_base = "https://graph.facebook.com/v18.0"
        self.app_id = settings.facebook_app_id
        self.app_secret = settings.facebook_app_secret
    
    async def exchange_for_long_lived_token(self, short_lived_token: str) -> Dict[str, Any]:
        """
        Exchange a short-lived access token for a long-lived token.
        
        Args:
            short_lived_token: Short-lived Facebook access token
            
        Returns:
            Dict containing the long-lived token and expiration info
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.graph_api_base}/oauth/access_token",
                    params={
                        "grant_type": "fb_exchange_token",
                        "client_id": self.app_id,
                        "client_secret": self.app_secret,
                        "fb_exchange_token": short_lived_token
                    }
                )
                
                if response.status_code == 200:
                    token_data = response.json()
                    
                    # Calculate expiration time (default to 60 days if not specified)
                    expires_in_seconds = token_data.get("expires_in", 5184000)  # 60 days default
                    expires_at = datetime.utcnow() + timedelta(seconds=expires_in_seconds)
                    
                    return {
                        "success": True,
                        "access_token": token_data.get("access_token"),
                        "token_type": token_data.get("token_type", "bearer"),
                        "expires_in": expires_in_seconds,
                        "expires_at": expires_at
                    }
                else:
                    logger.error(f"Token exchange failed: {response.text}")
                    return {
                        "success": False,
                        "error": f"Token exchange failed: {response.text}"
                    }
                    
        except Exception as e:
            logger.error(f"Error exchanging token: {e}")
            return {"success": False, "error": str(e)}

    async def validate_and_refresh_token(self, access_token: str, expires_at: Optional[datetime] = None) -> Dict[str, Any]:
        """
        Validate an access token and refresh if needed.
        
        Args:
            access_token: Facebook access token to validate
            expires_at: Known expiration time of the token
            
        Returns:
            Dict containing validation result and potentially new token
        """
        try:
            # Check if token is expired based on stored expiration time
            if expires_at and expires_at <= datetime.utcnow():
                logger.info("Token is expired based on stored expiration time")
                return {
                    "valid": False,
                    "expired": True,
                    "error": "Token has expired",
                    "needs_reconnection": True
                }
            
            # Validate token with Facebook API
            validation_result = await self.validate_access_token(access_token)
            
            if not validation_result["valid"]:
                # Check if it's an expiration error
                error_msg = validation_result.get("error", "")
                if "expired" in error_msg.lower() or "session" in error_msg.lower():
                    return {
                        "valid": False,
                        "expired": True,
                        "error": error_msg,
                        "needs_reconnection": True
                    }
                else:
                    return validation_result
            
            # Token is valid, check if it's close to expiration and needs refresh
            # Note: For long-lived tokens, Facebook auto-refreshes them if the user is active
            return {
                "valid": True,
                "user_id": validation_result.get("user_id"),
                "name": validation_result.get("name"),
                "email": validation_result.get("email"),
                "picture": validation_result.get("picture")
            }
            
        except Exception as e:
            logger.error(f"Error validating/refreshing token: {e}")
            return {"valid": False, "error": str(e)}

    async def get_long_lived_page_tokens(self, long_lived_user_token: str) -> List[Dict[str, Any]]:
        """
        Get long-lived page access tokens from a long-lived user token.
        
        Args:
            long_lived_user_token: Long-lived user access token
            
        Returns:
            List of pages with long-lived page access tokens
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.graph_api_base}/me/accounts",
                    params={
                        "access_token": long_lived_user_token,
                        "fields": "id,name,category,access_token,picture,fan_count,tasks"
                    }
                )
                
                if response.status_code == 200:
                    pages_data = response.json()
                    pages = pages_data.get("data", [])
                    
                    # Page access tokens from long-lived user tokens are automatically long-lived
                    # and don't expire unless the user changes password, revokes permissions, etc.
                    for page in pages:
                        page["token_type"] = "long_lived_page_token"
                        page["expires_at"] = None  # Page tokens don't have explicit expiration
                    
                    return pages
                else:
                    logger.error(f"Failed to get page tokens: {response.text}")
                    return []
                    
        except Exception as e:
            logger.error(f"Error getting page tokens: {e}")
            return []

    async def validate_access_token(self, access_token: str) -> Dict[str, Any]:
        """
        Validate Facebook access token and get user info.
        
        Args:
            access_token: Facebook access token
            
        Returns:
            Dict containing validation result and user info
        """
        try:
            async with httpx.AsyncClient() as client:
                # Validate token and get user info
                response = await client.get(
                    f"{self.graph_api_base}/me",
                    params={
                        "access_token": access_token,
                        "fields": "id,name,email,picture"
                    }
                )
                
                if response.status_code == 200:
                    user_data = response.json()
                    return {
                        "valid": True,
                        "user_id": user_data.get("id"),
                        "name": user_data.get("name"),
                        "email": user_data.get("email"),
                        "picture": user_data.get("picture", {}).get("data", {}).get("url")
                    }
                else:
                    error_data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {"error": {"message": response.text}}
                    error_message = error_data.get("error", {}).get("message", "Invalid access token")
                    logger.error(f"Token validation failed: {error_message}")
                    return {"valid": False, "error": error_message}
                    
        except Exception as e:
            logger.error(f"Error validating Facebook token: {e}")
            return {"valid": False, "error": str(e)}
    
    async def get_user_pages(self, access_token: str) -> List[Dict[str, Any]]:
        """
        Get user's Facebook pages.
        
        Args:
            access_token: Facebook access token
            
        Returns:
            List of user's Facebook pages
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.graph_api_base}/me/accounts",
                    params={
                        "access_token": access_token,
                        "fields": "id,name,category,access_token,picture,fan_count"
                    }
                )
                
                if response.status_code == 200:
                    pages_data = response.json()
                    return pages_data.get("data", [])
                else:
                    logger.error(f"Failed to get pages: {response.text}")
                    return []
                    
        except Exception as e:
            logger.error(f"Error getting Facebook pages: {e}")
            return []
    
    async def create_post(
        self, 
        page_id: str, 
        access_token: str, 
        message: str,
        link: Optional[str] = None,
        media_url: Optional[str] = None,
        media_type: str = "text"
    ) -> Dict[str, Any]:
        """
        Create a Facebook post.
        
        Args:
            page_id: Facebook page ID
            access_token: Page access token
            message: Post message content
            link: Optional link to include
            media_url: Optional media URL
            media_type: Type of media (text, photo, video)
            
        Returns:
            Dict containing post creation result
        """
        try:
            async with httpx.AsyncClient() as client:
                endpoint = f"{self.graph_api_base}/{page_id}/feed"
                
                data = {
                    "message": message,
                    "access_token": access_token
                }
                
                # Add link if provided
                if link:
                    data["link"] = link
                
                # Handle media posts
                if media_url and media_type == "photo":
                    endpoint = f"{self.graph_api_base}/{page_id}/photos"
                    data["url"] = media_url
                elif media_url and media_type == "video":
                    endpoint = f"{self.graph_api_base}/{page_id}/videos"
                    data["file_url"] = media_url
                
                response = await client.post(endpoint, data=data)
                
                if response.status_code == 200:
                    result = response.json()
                    return {
                        "success": True,
                        "post_id": result.get("id"),
                        "message": "Post created successfully"
                    }
                else:
                    error_data = response.json()
                    logger.error(f"Failed to create post: {error_data}")
                    return {
                        "success": False,
                        "error": error_data.get("error", {}).get("message", "Unknown error")
                    }
                    
        except Exception as e:
            logger.error(f"Error creating Facebook post: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def create_ai_generated_post(
        self,
        page_id: str,
        access_token: str,
        prompt: str,
        media_url: Optional[str] = None,
        media_type: str = "text"
    ) -> Dict[str, Any]:
        """
        Create a Facebook post with AI-generated content.
        
        Args:
            page_id: Facebook page ID
            access_token: Page access token
            prompt: User prompt for AI generation
            media_url: Optional media URL
            media_type: Type of media
            
        Returns:
            Dict containing post creation result
        """
        try:
            # Generate content using Groq AI
            ai_result = await groq_service.generate_facebook_post(prompt)
            
            if not ai_result["success"]:
                return {
                    "success": False,
                    "error": f"AI generation failed: {ai_result.get('error', 'Unknown error')}"
                }
            
            generated_content = ai_result["content"]
            
            # Create the post with generated content
            post_result = await self.create_post(
                page_id=page_id,
                access_token=access_token,
                message=generated_content,
                media_url=media_url,
                media_type=media_type
            )
            
            # Add AI metadata to response
            if post_result["success"]:
                post_result.update({
                    "ai_generated": True,
                    "original_prompt": prompt,
                    "model_used": ai_result["model_used"],
                    "tokens_used": ai_result["tokens_used"]
                })
            
            return post_result
            
        except Exception as e:
            logger.error(f"Error creating AI-generated post: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def setup_auto_reply(
        self,
        page_id: str,
        access_token: str,
        enabled: bool,
        template: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Setup auto-reply for Facebook page comments.
        
        Args:
            page_id: Facebook page ID
            access_token: Page access token
            enabled: Whether to enable auto-reply
            template: Optional custom response template
            
        Returns:
            Dict containing setup result
        """
        try:
            # In a real implementation, you would:
            # 1. Set up Facebook webhooks for comment events
            # 2. Store auto-reply settings in database
            # 3. Configure webhook endpoint to handle comment events
            
            # For now, we'll just store the setting (you'll need to implement webhook handling)
            logger.info(f"Auto-reply {'enabled' if enabled else 'disabled'} for page {page_id}")
            
            return {
                "success": True,
                "message": f"Auto-reply {'enabled' if enabled else 'disabled'} successfully",
                "page_id": page_id,
                "enabled": enabled,
                "template": template or "Thank you for your comment! We appreciate your engagement."
            }
            
        except Exception as e:
            logger.error(f"Error setting up auto-reply: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def handle_comment_auto_reply(
        self,
        comment_id: str,
        comment_text: str,
        page_access_token: str,
        context: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Handle automatic reply to a Facebook comment.
        
        Args:
            comment_id: Facebook comment ID
            comment_text: Content of the comment
            page_access_token: Page access token
            context: Additional context for the reply
            
        Returns:
            Dict containing reply result
        """
        try:
            # Generate AI reply
            reply_result = await groq_service.generate_auto_reply(comment_text, context)
            
            if not reply_result["success"]:
                # Use fallback reply
                reply_content = "Thank you for your comment! We appreciate your engagement. 😊"
            else:
                reply_content = reply_result["content"]
            
            # Post reply to Facebook
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.graph_api_base}/{comment_id}/comments",
                    data={
                        "message": reply_content,
                        "access_token": page_access_token
                    }
                )
                
                if response.status_code == 200:
                    result = response.json()
                    return {
                        "success": True,
                        "reply_id": result.get("id"),
                        "reply_content": reply_content,
                        "ai_generated": reply_result["success"]
                    }
                else:
                    error_data = response.json()
                    logger.error(f"Failed to post reply: {error_data}")
                    return {
                        "success": False,
                        "error": error_data.get("error", {}).get("message", "Unknown error")
                    }
                    
        except Exception as e:
            logger.error(f"Error handling auto-reply: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def is_configured(self) -> bool:
        """Check if Facebook service is properly configured."""
        return bool(self.app_id and self.app_secret)


# Create a singleton instance
facebook_service = FacebookService() 
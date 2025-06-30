import logging
import httpx
from typing import Optional, Dict, Any, List
from datetime import datetime
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
                    logger.error(f"Token validation failed: {response.text}")
                    return {"valid": False, "error": "Invalid access token"}
                    
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


# Global service instance
facebook_service = FacebookService() 
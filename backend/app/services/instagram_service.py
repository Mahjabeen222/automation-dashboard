import requests
import logging
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime, timedelta
from app.config import get_settings
from app.services.groq_service import groq_service

logger = logging.getLogger(__name__)
settings = get_settings()


class InstagramService:
    """Service for Instagram API operations and integrations."""
    
    def __init__(self):
        self.graph_url = "https://graph.facebook.com/v18.0"
        self.app_id = settings.facebook_app_id  # Instagram uses Facebook App ID
        self.app_secret = settings.facebook_app_secret
    
    def exchange_for_long_lived_token(self, short_lived_token: str, app_id: str, app_secret: str) -> Tuple[str, datetime]:
        """Exchange short-lived token for long-lived token (60 days)"""
        try:
            url = f"{self.graph_url}/oauth/access_token"
            params = {
                'grant_type': 'fb_exchange_token',
                'client_id': app_id,
                'client_secret': app_secret,
                'fb_exchange_token': short_lived_token
            }
            
            response = requests.get(url, params=params)
            response.raise_for_status()
            
            data = response.json()
            long_lived_token = data['access_token']
            expires_in = data.get('expires_in', 5184000)  # Default 60 days
            expires_at = datetime.now() + timedelta(seconds=expires_in)
            
            logger.info("Successfully exchanged for long-lived token")
            return long_lived_token, expires_at
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Token exchange failed: {e}")
            raise Exception(f"Failed to exchange token: {str(e)}")
    
    def verify_token_permissions(self, access_token: str) -> Dict:
        """Verify token has required permissions"""
        try:
            url = f"{self.graph_url}/me/permissions"
            params = {'access_token': access_token}
            
            response = requests.get(url, params=params)
            response.raise_for_status()
            
            permissions_data = response.json()
            granted_permissions = [
                perm['permission'] for perm in permissions_data.get('data', [])
                if perm.get('status') == 'granted'
            ]
            
            required_permissions = [
                'pages_show_list',
                'instagram_basic', 
                'pages_read_engagement',
                'business_management'
            ]
            
            missing_permissions = [
                perm for perm in required_permissions 
                if perm not in granted_permissions
            ]
            
            return {
                'granted': granted_permissions,
                'missing': missing_permissions,
                'has_all_required': len(missing_permissions) == 0
            }
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Permission verification failed: {e}")
            raise Exception(f"Failed to verify permissions: {str(e)}")
    
    def get_facebook_pages_with_instagram(self, access_token: str) -> List[Dict]:
        """Get Facebook Pages with Instagram Business accounts"""
        try:
            # First verify permissions
            perm_check = self.verify_token_permissions(access_token)
            if not perm_check['has_all_required']:
                missing = ', '.join(perm_check['missing'])
                raise Exception(f"Missing required permissions: {missing}. Please re-authorize the app.")
            
            # Get user's Facebook Pages
            url = f"{self.graph_url}/me/accounts"
            params = {
                'access_token': access_token,
                'fields': 'id,name,access_token,instagram_business_account{id,username,name,profile_picture_url,followers_count,media_count}'
            }
            
            response = requests.get(url, params=params)
            response.raise_for_status()
            
            pages_data = response.json()
            pages = pages_data.get('data', [])
            
            if not pages:
                raise Exception("No Facebook Pages found. You need Admin access to at least one Facebook Page.")
            
            instagram_accounts = []
            pages_without_instagram = []
            
            for page in pages:
                page_name = page.get('name', 'Unknown Page')
                instagram_account = page.get('instagram_business_account')
                
                if instagram_account:
                    # Get additional Instagram account details using page access token
                    page_token = page.get('access_token')
                    if page_token:
                        enhanced_account = self._get_enhanced_instagram_details(
                            instagram_account['id'], 
                            page_token
                        )
                        
                        instagram_accounts.append({
                            'platform_id': instagram_account['id'],
                            'username': instagram_account.get('username', ''),
                            'display_name': instagram_account.get('name', ''),
                            'page_name': page_name,
                            'page_id': page['id'],
                            'followers_count': enhanced_account.get('followers_count', 0),
                            'media_count': enhanced_account.get('media_count', 0),
                            'profile_picture': enhanced_account.get('profile_picture_url', ''),
                            'page_access_token': page_token
                        })
                else:
                    pages_without_instagram.append(page_name)
            
            if not instagram_accounts:
                troubleshooting_msg = self._generate_troubleshooting_message(pages_without_instagram)
                raise Exception(troubleshooting_msg)
            
            logger.info(f"Found {len(instagram_accounts)} Instagram Business accounts")
            return instagram_accounts
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to fetch Instagram accounts: {e}")
            if hasattr(e, 'response') and e.response:
                error_data = e.response.json() if e.response.content else {}
                error_msg = error_data.get('error', {}).get('message', str(e))
                raise Exception(f"Graph API Error: {error_msg}")
            raise Exception(f"Network error: {str(e)}")
    
    def _get_enhanced_instagram_details(self, instagram_user_id: str, page_access_token: str) -> Dict:
        """Get additional Instagram account details"""
        try:
            url = f"{self.graph_url}/{instagram_user_id}"
            params = {
                'access_token': page_access_token,
                'fields': 'followers_count,media_count,profile_picture_url,biography'
            }
            
            response = requests.get(url, params=params)
            response.raise_for_status()
            
            return response.json()
            
        except requests.exceptions.RequestException as e:
            logger.warning(f"Failed to get enhanced Instagram details: {e}")
            return {}
    
    def _generate_troubleshooting_message(self, pages_without_instagram: List[str]) -> str:
        """Generate helpful troubleshooting message"""
        base_msg = "No Instagram Business accounts found."
        
        if pages_without_instagram:
            pages_list = ", ".join(pages_without_instagram)
            base_msg += f" Found Facebook Pages ({pages_list}) but no Instagram accounts connected."
        
        troubleshooting_steps = [
            "1. Convert your Instagram to Business/Creator account",
            "2. Go to Facebook Page Settings → Instagram → Connect Account", 
            "3. Ensure you have Admin/Editor role on the Facebook Page",
            "4. Verify Facebook Page is published (not draft)",
            "5. Wait 5-10 minutes after connecting for systems to sync",
            "6. Re-authorize this app if the connection is old"
        ]
        
        return f"{base_msg}\n\nTroubleshooting steps:\n" + "\n".join(troubleshooting_steps)
    
    def create_post(self, instagram_user_id: str, page_access_token: str, 
                   caption: str, image_url: Optional[str] = None) -> Dict:
        """Create Instagram post"""
        try:
            # Step 1: Create media object
            media_url = f"{self.graph_url}/{instagram_user_id}/media"
            media_params = {
                'access_token': page_access_token,
                'caption': caption
            }
            
            if image_url:
                media_params['image_url'] = image_url
            
            media_response = requests.post(media_url, data=media_params)
            media_response.raise_for_status()
            
            media_data = media_response.json()
            creation_id = media_data['id']
            
            # Step 2: Publish the media
            publish_url = f"{self.graph_url}/{instagram_user_id}/media_publish"
            publish_params = {
                'access_token': page_access_token,
                'creation_id': creation_id
            }
            
            publish_response = requests.post(publish_url, data=publish_params)
            publish_response.raise_for_status()
            
            publish_data = publish_response.json()
            
            logger.info(f"Successfully created Instagram post: {publish_data['id']}")
            return {
                'success': True,
                'post_id': publish_data['id'],
                'creation_id': creation_id
            }
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to create Instagram post: {e}")
            if hasattr(e, 'response') and e.response:
                error_data = e.response.json() if e.response.content else {}
                error_msg = error_data.get('error', {}).get('message', str(e))
                raise Exception(f"Post creation failed: {error_msg}")
            raise Exception(f"Network error: {str(e)}")
    
    def get_user_media(self, instagram_user_id: str, page_access_token: str, limit: int = 25) -> List[Dict]:
        """Get user's Instagram media"""
        try:
            url = f"{self.graph_url}/{instagram_user_id}/media"
            params = {
                'access_token': page_access_token,
                'fields': 'id,media_type,media_url,thumbnail_url,caption,timestamp,permalink',
                'limit': limit
            }
            
            response = requests.get(url, params=params)
            response.raise_for_status()
            
            media_data = response.json()
            return media_data.get('data', [])
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to get user media: {e}")
            return []
    
    async def create_ai_generated_post(
        self,
        instagram_user_id: str,
        access_token: str,
        prompt: str,
        image_url: str
    ) -> Dict[str, Any]:
        """
        Create an Instagram post with AI-generated caption.
        
        Args:
            instagram_user_id: Instagram Business account ID
            access_token: Access token
            prompt: User prompt for AI generation
            image_url: URL of the image to post
            
        Returns:
            Dict containing post creation result
        """
        try:
            # Generate caption using Groq AI
            ai_result = await groq_service.generate_instagram_post(prompt)
            
            if not ai_result["success"]:
                return {
                    "success": False,
                    "error": f"AI generation failed: {ai_result.get('error', 'Unknown error')}"
                }
            
            generated_caption = ai_result["content"]
            
            # Create the post with generated caption
            post_result = await self.create_post(
                instagram_user_id=instagram_user_id,
                access_token=access_token,
                image_url=image_url,
                caption=generated_caption
            )
            
            # Add AI metadata to response
            if post_result["success"]:
                post_result["ai_generated"] = True
                post_result["generated_caption"] = generated_caption
                post_result["original_prompt"] = prompt
            
            return post_result
            
        except Exception as e:
            logger.error(f"Error creating AI-generated Instagram post: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def is_configured(self) -> bool:
        """Check if Instagram service is properly configured."""
        return bool(self.app_id and self.app_secret)


# Global service instance
instagram_service = InstagramService() 
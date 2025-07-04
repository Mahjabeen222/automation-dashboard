import requests
import logging
from typing import Dict, Optional
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

class StabilityService:
    """Service for Stability AI image generation."""
    
    def __init__(self):
        self.api_key = "sk-KSowcMmT7N2FfZgeM6BrYoZeaCnwpNzQZHzoVP34OloWQ573"
        self.api_host = "https://api.stability.ai"
        self.engine_id = "stable-diffusion-xl-1024-v1-0"
        
    async def generate_image(self, prompt: str) -> Dict:
        """Generate an image using Stability AI."""
        try:
            url = f"{self.api_host}/v1/generation/{self.engine_id}/text-to-image"
            
            headers = {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Authorization": f"Bearer {self.api_key}"
            }
            
            payload = {
                "text_prompts": [{"text": prompt}],
                "cfg_scale": 7,
                "height": 1024,
                "width": 1024,
                "samples": 1,
                "steps": 30,
            }
            
            response = requests.post(url, headers=headers, json=payload)
            response.raise_for_status()
            
            # Extract base64 image from response
            result = response.json()
            if "artifacts" in result and len(result["artifacts"]) > 0:
                return {
                    "success": True,
                    "image_base64": result["artifacts"][0]["base64"]
                }
            
            return {
                "success": False,
                "error": "No image generated"
            }
            
        except Exception as e:
            logger.error(f"Stability AI image generation failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def is_configured(self) -> bool:
        """Check if Stability service is properly configured."""
        return bool(self.api_key)

# Global service instance
stability_service = StabilityService()

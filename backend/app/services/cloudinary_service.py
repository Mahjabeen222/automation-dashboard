import requests
import logging
from typing import Dict
from app.config import get_settings
import cloudinary
import cloudinary.uploader

logger = logging.getLogger(__name__)
settings = get_settings()

class CloudinaryService:
    """Helper for authenticated uploads to Cloudinary with Instagram transforms."""

    def __init__(self):
        self.cloud_name = settings.CLOUDINARY_CLOUD_NAME
        self.api_key = getattr(settings, 'CLOUDINARY_API_KEY', None)
        self.api_secret = getattr(settings, 'CLOUDINARY_API_SECRET', None)
        if not (self.cloud_name and self.api_key and self.api_secret):
            logger.warning("Cloudinary credentials not fully configured. Uploads will fail.")
        cloudinary.config(
            cloud_name=self.cloud_name,
            api_key=self.api_key,
            api_secret=self.api_secret
        )

    def is_configured(self) -> bool:
        return bool(self.cloud_name and self.api_key and self.api_secret)

    def upload_image_with_instagram_transform(self, file_or_base64) -> Dict:
        """Upload an image (file or base64) to Cloudinary with Instagram-specific transforms."""
        if not self.is_configured():
            return {"success": False, "error": "Cloudinary not configured"}
        try:
            result = cloudinary.uploader.upload(
                file_or_base64,
                transformation=[
                    {"width": 1080, "height": 1080, "crop": "fill"},
                    {"quality": "auto"},
                    {"fetch_format": "auto"}
                ],
                format="jpg"
            )
            return {"success": True, "url": result["secure_url"]}
        except Exception as e:
            logger.error(f"Cloudinary SDK upload failed: {e}")
            return {"success": False, "error": str(e)}

cloudinary_service = CloudinaryService() 
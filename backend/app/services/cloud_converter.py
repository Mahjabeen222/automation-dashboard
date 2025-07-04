import requests
import logging
import asyncio
from typing import Dict, Optional
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

class CloudConvertService:
    """Service for CloudConvert image format conversion."""
    
    def __init__(self):
        self.api_key = settings.CLOUDCONVERT_API_KEY
        self.api_url = "https://api.cloudconvert.com/v2"
        
    async def convert_png_to_jpg(self, image_url: str) -> Dict:
        """Convert PNG image to JPG format using tasks API."""
        try:
            logger.info(f"Starting PNG to JPG conversion for image: {image_url}")
            
            # Validate API key
            if not self.is_configured():
                raise Exception("CloudConvert API key is not configured. Please set CLOUDCONVERT_API_KEY in your environment variables.")
            
            # Create task
            task_data = {
                "tasks": {
                    "import-1": {
                        "operation": "import/url",
                        "url": image_url,
                        "filename": "image.png"
                    },
                    "convert-1": {
                        "operation": "convert",
                        "input": ["import-1"],
                        "output_format": "jpg",
                        "engine": "imagemagick",
                        "fit": "max",
                        "strip": True,
                        "quality": 85,
                        "filename": "image.jpg"
                    },
                    "export-1": {
                        "operation": "export/url",
                        "input": ["convert-1"],
                        "inline": False,
                        "archive_multiple_files": False
                    }
                },
                "tag": "instagram-conversion"
            }
            
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            # Create tasks
            logger.info("Creating CloudConvert tasks...")
            response = requests.post(
                f"{self.api_url}/jobs",
                headers=headers,
                json=task_data
            )
            
            # Log the response for debugging
            logger.debug(f"Task creation response: {response.text}")
            
            if not response.ok:
                error_detail = response.json()
                logger.error(f"Failed to create tasks: {error_detail}")
                error_message = error_detail.get("message", "Unknown error")
                if "errors" in error_detail:
                    error_message = "; ".join([err.get("message", "") for err in error_detail["errors"]])
                raise Exception(f"Failed to create conversion tasks: {error_message}")
            
            job = response.json()
            job_id = job["data"]["id"]
            logger.info(f"CloudConvert job created with ID: {job_id}")
            
            # Wait for job completion with timeout
            max_retries = 30  # 60 seconds total (2 seconds per retry)
            retry_count = 0
            
            while retry_count < max_retries:
                logger.debug(f"Checking job status (attempt {retry_count + 1}/{max_retries})")
                status_response = requests.get(
                    f"{self.api_url}/jobs/{job_id}",
                    headers=headers
                )
                
                if not status_response.ok:
                    error_detail = status_response.json()
                    logger.error(f"Failed to check job status: {error_detail}")
                    raise Exception(f"Failed to check conversion status: {error_detail.get('message', 'Unknown error')}")
                
                status_data = status_response.json()
                current_status = status_data["data"]["status"]
                logger.info(f"Job status: {current_status}")
                
                if current_status == "finished":
                    # Find the export task
                    export_task = next(
                        (task for task in status_data["data"]["tasks"]
                         if task["name"].startswith("export")),
                        None
                    )
                    
                    if not export_task:
                        raise Exception("Export task not found in response")
                    
                    if "result" not in export_task or "files" not in export_task["result"]:
                        raise Exception("Export task result not found")
                    
                    output_url = export_task["result"]["files"][0]["url"]
                    logger.info("Conversion completed successfully")
                    return {
                        "success": True,
                        "url": output_url
                    }
                elif current_status == "error":
                    error_message = "Unknown error"
                    if "tasks" in status_data["data"]:
                        error_tasks = [task for task in status_data["data"]["tasks"] if task.get("status") == "error"]
                        if error_tasks:
                            error_message = error_tasks[0].get("message", "Unknown error")
                    raise Exception(f"Conversion failed: {error_message}")
                elif current_status == "processing":
                    retry_count += 1
                    await asyncio.sleep(2)
                else:
                    raise Exception(f"Unexpected job status: {current_status}")
            
            raise Exception("Conversion timeout: Job took too long to complete")
                
        except requests.exceptions.HTTPError as e:
            logger.error(f"HTTP error during conversion: {str(e)}")
            if e.response is not None:
                try:
                    error_detail = e.response.json()
                    logger.error(f"API error details: {error_detail}")
                    error_message = error_detail.get("message", str(e))
                    if "errors" in error_detail:
                        error_message = "; ".join([err.get("message", "") for err in error_detail["errors"]])
                except ValueError:
                    error_message = str(e)
            else:
                error_message = str(e)
            return {
                "success": False,
                "error": f"HTTP error: {error_message}"
            }
        except Exception as e:
            logger.error(f"CloudConvert conversion failed: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def is_configured(self) -> bool:
        """Check if CloudConvert service is properly configured."""
        return bool(self.api_key and len(self.api_key) > 50)  # Basic validation for JWT token

    async def test_connection(self) -> Dict:
        """Test the CloudConvert API connection."""
        try:
            if not self.is_configured():
                return {
                    "success": False,
                    "error": "CloudConvert API key is not configured. Please set CLOUDCONVERT_API_KEY in your environment variables."
                }
            
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            # Test with user info endpoint (requires user.read permission)
            response = requests.get(
                f"{self.api_url}/users/me",
                headers=headers
            )
            
            if not response.ok:
                error_detail = response.json()
                error_message = error_detail.get("message", "Unknown error")
                if "errors" in error_detail:
                    error_message = "; ".join([err.get("message", "") for err in error_detail["errors"]])
                return {
                    "success": False,
                    "error": f"CloudConvert API connection failed: {error_message}"
                }
            
            # Test task creation permission
            test_task = {
                "tasks": {
                    "test-task": {
                        "operation": "convert",
                        "input_format": "png",
                        "output_format": "jpg"
                    }
                }
            }
            
            task_response = requests.post(
                f"{self.api_url}/jobs",
                headers=headers,
                json=test_task
            )
            
            if not task_response.ok:
                error_detail = task_response.json()
                error_message = error_detail.get("message", "Unknown error")
                if "errors" in error_detail:
                    error_message = "; ".join([err.get("message", "") for err in error_detail["errors"]])
                return {
                    "success": False,
                    "error": f"CloudConvert task creation failed: {error_message}"
                }
            
            return {
                "success": True,
                "message": "CloudConvert API connection and permissions verified successfully"
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"CloudConvert API connection failed: {str(e)}"
            }

# Global service instance
cloud_convert_service = CloudConvertService()

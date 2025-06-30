import logging
from groq import Groq
from typing import Optional, Dict, Any
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class GroqService:
    """Service for AI content generation using Groq API."""
    
    def __init__(self):
        self.client = None
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize the Groq client."""
        try:
            if not settings.groq_api_key:
                logger.warning("Groq API key not configured")
                return
            
            self.client = Groq(api_key=settings.groq_api_key)
            logger.info("Groq client initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize Groq client: {e}")
            self.client = None
    
    async def generate_facebook_post(
        self, 
        prompt: str, 
        content_type: str = "post",
        max_length: int = 2000
    ) -> Dict[str, Any]:
        """
        Generate Facebook post content using Groq AI.
        
        Args:
            prompt: User's input prompt
            content_type: Type of content (post, comment, reply)
            max_length: Maximum character length for the content
            
        Returns:
            Dict containing generated content and metadata
        """
        if not self.client:
            raise Exception("Groq client not initialized. Please check your API key configuration.")
        
        try:
            # Construct system prompt for Facebook content generation
            system_prompt = self._get_facebook_system_prompt(content_type, max_length)
            
            # Generate content using Groq
            completion = self.client.chat.completions.create(
                model="llama-3.1-8b-instant",  # Fast and efficient model
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=500,
                temperature=0.7,
                top_p=0.9,
                stream=False
            )
            
            generated_content = completion.choices[0].message.content.strip()
            
            # Validate content length
            if len(generated_content) > max_length:
                generated_content = generated_content[:max_length-3] + "..."
            
            return {
                "content": generated_content,
                "model_used": "llama-3.1-8b-instant",
                "tokens_used": completion.usage.total_tokens if completion.usage else 0,
                "success": True
            }
            
        except Exception as e:
            logger.error(f"Error generating content with Groq: {e}")
            return {
                "content": f"I'd love to share thoughts about {prompt}! What an interesting topic to explore.",
                "model_used": "fallback",
                "tokens_used": 0,
                "success": False,
                "error": str(e)
            }
    
    def _get_facebook_system_prompt(self, content_type: str, max_length: int) -> str:
        """Get system prompt based on content type."""
        base_prompt = f"""You are a professional social media content creator for Facebook posts. 

Your task is to create engaging, authentic, and platform-appropriate content based on the user's prompt.

Guidelines:
- Keep content under {max_length} characters
- Use a conversational, friendly tone
- Include relevant emojis naturally (not excessive)
- Make it engaging and shareable
- Avoid controversial topics
- Use line breaks for readability
- Include a call-to-action when appropriate
- Make it feel human and authentic, not robotic

"""
        
        if content_type == "post":
            return base_prompt + """
Create a complete Facebook post that:
- Starts with an engaging hook
- Provides value or entertainment
- Encourages engagement (likes, comments, shares)
- Ends with a question or call-to-action
- Uses appropriate hashtags if relevant (max 3-5)
"""
        elif content_type == "comment":
            return base_prompt + """
Create a thoughtful comment response that:
- Is relevant to the conversation
- Adds value to the discussion
- Is respectful and positive
- Encourages further engagement
"""
        else:
            return base_prompt + "Create engaging social media content that fits the Facebook platform."
    
    async def generate_auto_reply(
        self, 
        original_comment: str, 
        context: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate automatic reply to Facebook comments.
        
        Args:
            original_comment: The comment to reply to
            context: Additional context about the post/brand
            
        Returns:
            Dict containing generated reply and metadata
        """
        if not self.client:
            return {
                "content": "Thank you for your comment! We appreciate your engagement.",
                "model_used": "fallback",
                "success": False,
                "error": "Groq client not initialized"
            }
        
        try:
            system_prompt = """You are a friendly customer service representative responding to Facebook comments.

Guidelines:
- Be warm, professional, and helpful
- Keep responses under 200 characters
- Acknowledge the commenter's input
- Provide value when possible
- Be conversational but professional
- Use appropriate emojis sparingly
- Always be positive and helpful

Generate a personalized response to the following comment:"""
            
            completion = self.client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Comment: {original_comment}\nContext: {context or 'General social media page'}"}
                ],
                max_tokens=100,
                temperature=0.6,
                stream=False
            )
            
            reply_content = completion.choices[0].message.content.strip()
            
            return {
                "content": reply_content,
                "model_used": "llama-3.1-8b-instant",
                "tokens_used": completion.usage.total_tokens if completion.usage else 0,
                "success": True
            }
            
        except Exception as e:
            logger.error(f"Error generating auto-reply with Groq: {e}")
            return {
                "content": "Thank you for your comment! We appreciate your engagement. 😊",
                "model_used": "fallback",
                "tokens_used": 0,
                "success": False,
                "error": str(e)
            }
    
    def is_available(self) -> bool:
        """Check if Groq service is available."""
        return self.client is not None


# Global service instance
groq_service = GroqService() 
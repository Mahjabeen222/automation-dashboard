from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
from typing import List
import os


class Settings(BaseSettings):
    # Database - default to local SQLite; override in prod via env var
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./automation_dashboard.db")

    # JWT Authentication
    secret_key: str = os.getenv("SECRET_KEY", "change-me")
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 440

    # Facebook Integration
    facebook_app_id: str | None = os.getenv("FACEBOOK_APP_ID")
    facebook_app_secret: str | None = os.getenv("FACEBOOK_APP_SECRET")

    # Instagram Integration
    instagram_app_id: str | None = os.getenv("INSTAGRAM_APP_ID")
    instagram_app_secret: str | None = os.getenv("INSTAGRAM_APP_SECRET")

    # Groq AI Integration
    groq_api_key: str | None = os.getenv("GROQ_API_KEY")

    # Environment
    environment: str = os.getenv("ENVIRONMENT", "development")
    debug: bool = os.getenv("DEBUG", "True").lower() == "true"

    # CORS
    cors_origins: List[str] = ["*"]

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)


@lru_cache()
def get_settings() -> Settings:
    return Settings()

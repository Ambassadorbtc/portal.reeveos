from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    app_name: str = "ReeveOS"
    app_version: str = "1.0.0"
    
    mongodb_url: str
    mongodb_db_name: str = "rezvo"
    
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60 * 24  # 24 hours — increase once frontend refresh is wired
    jwt_refresh_token_expire_days: int = 7
    
    google_places_api_key: str
    google_maps_api_key: str
    google_geocoding_api_key: str
    
    stripe_secret_key: str
    stripe_publishable_key: str
    stripe_webhook_secret: str
    
    resend_api_key: Optional[str] = None
    sendgrid_api_key: Optional[str] = None
    
    sendly_api_key: Optional[str] = None
    
    aws_access_key_id: Optional[str] = None
    aws_secret_access_key: Optional[str] = None
    aws_s3_bucket: Optional[str] = None
    aws_s3_region: Optional[str] = "eu-west-2"
    
    cloudflare_r2_access_key_id: Optional[str] = None
    cloudflare_r2_secret_access_key: Optional[str] = None
    cloudflare_r2_bucket: Optional[str] = None
    cloudflare_r2_endpoint: Optional[str] = None
    
    anthropic_api_key: Optional[str] = None
    xai_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    floor_plan_llm_provider: str = "gemini"
    
    frontend_url: str = "https://portal.rezvo.app"
    backend_url: str = "https://portal.rezvo.app/api"
    
    encryption_key: Optional[str] = None   # Fernet key for PII at-rest encryption
    
    environment: str = "production"

    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"


settings = Settings()

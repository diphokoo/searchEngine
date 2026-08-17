from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    app_name: str = "SA Nightlife Mining Engine"
    api_port: int = 8000
    api_key: str = "internal-key"

    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "event_intelligence"
    db_user: str = "postgres"
    db_password: str = "postgres"

    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_password: Optional[str] = None

    openai_api_key: Optional[str] = None
    openai_model: str = "gpt-4o-mini"

    geocoding_provider: str = "nominatim"
    geocoding_api_key: Optional[str] = None

    s3_bucket: str = "event-intelligence-assets"
    aws_region: str = "af-south-1"
    s3_endpoint: Optional[str] = None

    node_api_url: str = "http://localhost:3001"
    node_api_key: str = "internal-key"

    class Config:
        env_file = ".env"


settings = Settings()

import os
from typing import List, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # App Identity
    PROJECT_NAME: str = "Artisan Coffee API"
    API_V1_STR: str = "/api"
    ENVIRONMENT: str = "development"

    # JWT Authentication
    SECRET_KEY: str = "default_insecure_jwt_secret_please_set_in_env_file_9823471092"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # PostgreSQL Database URL
    # Leave default empty or generic so it forces reading from .env / environment
    DATABASE_URL: str = "postgresql+asyncpg://localhost:5432/coffeedb"

    # CORS Whitelist
    BACKEND_CORS_ORIGINS: List[Union[str, AnyHttpUrl]] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ]

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, list):
            return v
        raise ValueError(v)

    # Business Rules: Loyalty Program
    LOYALTY_EARN_SPEND_RATIO: int = 10  # 1 point earned per ₹10 spent
    LOYALTY_POINT_RUPEE_VALUE: float = 1.0  # 1 point = ₹1 discount
    LOYALTY_MIN_REDEMPTION_POINTS: int = 50  # Minimum 50 points to redeem

    # Read .env file located at backend root directory
    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
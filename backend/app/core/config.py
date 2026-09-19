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

    # PostgreSQL Database URL (defaults to Supabase connection pooler if not provided via environment)
    DATABASE_URL: str = "postgresql+asyncpg://postgres.xlduyqgdldiebzlqvffv:Pratham*2004@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def assemble_db_connection(cls, v: str) -> str:
        if isinstance(v, str):
            # Render/Heroku provide postgres:// or postgresql:// which need asyncpg for SQLAlchemy async engine
            if v.startswith("postgres://"):
                v = v.replace("postgres://", "postgresql+asyncpg://", 1)
            elif v.startswith("postgresql://") and not v.startswith("postgresql+asyncpg://"):
                v = v.replace("postgresql://", "postgresql+asyncpg://", 1)

            # Supabase direct connection (db.<ref>.supabase.co) is IPv6-only, which fails on Render (IPv4 only).
            # Auto-route to the Supabase connection pooler in ap-southeast-1.
            if "db.xlduyqgdldiebzlqvffv.supabase.co" in v:
                v = v.replace("db.xlduyqgdldiebzlqvffv.supabase.co", "aws-0-ap-southeast-1.pooler.supabase.com")
                if "postgres:" in v and "postgres.xlduyqgdldiebzlqvffv" not in v:
                    v = v.replace("postgres:", "postgres.xlduyqgdldiebzlqvffv:", 1)

            # asyncpg does not support sslmode=, it expects ssl=
            if "sslmode=" in v:
                v = v.replace("sslmode=", "ssl=")
        return v

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
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("[") and v.endswith("]"):
                import json
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [i.strip() for i in v.split(",") if i.strip()]
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
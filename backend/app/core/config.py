"""
Core Configuration - Environment Variable Management
"""
import json
from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import field_validator
import secrets


class Settings(BaseSettings):
    # App
    APP_NAME: str = "BillFlow"
    APP_ENV: str = "development"
    DEBUG: bool = True
    SECRET_KEY: str = secrets.token_urlsafe(32)

    # JWT
    JWT_SECRET_KEY: str = secrets.token_urlsafe(32)
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7   # 7 days
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # Database (Supabase PostgreSQL)
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/billflow"

    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_JWT_SECRET: str = ""

    # Storage
    STORAGE_BUCKET_LOGOS: str = "business-logos"
    STORAGE_BUCKET_INVOICES: str = "invoices"

    # CORS
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://yourdomain.com",
    ]

    # PDF
    PDF_ENGINE: str = "reportlab"

    # File Upload
    MAX_UPLOAD_SIZE_MB: int = 5
    ALLOWED_IMAGE_TYPES: List[str] = ["image/jpeg", "image/png", "image/webp"]

    # Super Admin email — this email gets super_admin role
    SUPER_ADMIN_EMAIL: str = "admin@billflow.io"

    # ── SMTP Email (for OTP) ──────────────────────────────
    # For Gmail: enable "App Passwords" and use that as SMTP_PASSWORD
    # For Supabase email: use their SMTP settings
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = "noreply@billflow.io"
    SMTP_USE_TLS: bool = True

    # Future: AI
    OPENAI_API_KEY: Optional[str] = None

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_origins(cls, v):
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("["):
                try:
                    return json.loads(v)
                except json.JSONDecodeError:
                    pass
            return [i.strip().strip('"').strip("'") for i in v.split(",") if i.strip()]
        return v

    model_config = {
        "env_file": ".env",
        "case_sensitive": True,
        "env_file_encoding": "utf-8",
    }


settings = Settings()

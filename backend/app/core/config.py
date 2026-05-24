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

    # ── Email via Gmail SMTP ───────────────────────────────────────────────────
    # 1. Enable 2FA on Google account
    # 2. https://myaccount.google.com/apppasswords → generate 16-char App Password
    # 3. Fill in below (SMTP_PASSWORD = App Password, NOT your Gmail password)
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""            # your@gmail.com
    SMTP_PASSWORD: str = ""            # 16-char App Password
    SMTP_FROM_EMAIL: str = ""          # same as SMTP_USERNAME
    SMTP_USE_TLS: bool = True          # use STARTTLS on port 587

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

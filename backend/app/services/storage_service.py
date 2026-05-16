"""
Supabase Storage Service — Logo & PDF Upload
"""
import uuid
from typing import Optional
from fastapi import UploadFile, HTTPException
from supabase import create_client, Client

from app.core.config import settings


def get_supabase_client() -> Client:
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


async def upload_business_logo(
    file: UploadFile,
    business_id: str,
    old_url: Optional[str] = None,
) -> str:
    """Upload business logo to Supabase Storage, return public URL."""
    if file.content_type not in settings.ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid image type. Allowed: {settings.ALLOWED_IMAGE_TYPES}"
        )

    # 1. Delete old logo if exists
    if old_url:
        try:
            # Extract path from URL: .../business-logos/business_id/logo_...
            # The path starts after the bucket name
            bucket_search = f"/{settings.STORAGE_BUCKET_LOGOS}/"
            if bucket_search in old_url:
                path_part = old_url.split(bucket_search)[-1]
                # Remove query parameters if any (e.g. ?t=123...)
                old_path = path_part.split("?")[0]
                delete_file(settings.STORAGE_BUCKET_LOGOS, old_path)
        except Exception:
            pass  # Non-critical

    # 2. Upload new logo
    contents = await file.read()
    if len(contents) > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Max {settings.MAX_UPLOAD_SIZE_MB}MB"
        )

    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "jpg"
    filename = f"{business_id}/logo_{uuid.uuid4().hex[:8]}.{ext}"

    supabase = get_supabase_client()
    supabase.storage.from_(settings.STORAGE_BUCKET_LOGOS).upload(
        path=filename,
        file=contents,
        file_options={"content-type": file.content_type, "upsert": "true"},
    )

    public_url = supabase.storage.from_(settings.STORAGE_BUCKET_LOGOS).get_public_url(filename)
    return public_url


async def upload_invoice_pdf(
    pdf_bytes: bytes,
    business_id: str,
    invoice_number: str,
) -> str:
    """Upload generated PDF to Supabase Storage, return URL."""
    filename = f"{business_id}/{invoice_number}.pdf"

    supabase = get_supabase_client()
    supabase.storage.from_(settings.STORAGE_BUCKET_INVOICES).upload(
        path=filename,
        file=pdf_bytes,
        file_options={"content-type": "application/pdf", "upsert": "true"},
    )

    # Generate signed URL (valid for 7 days)
    signed = supabase.storage.from_(settings.STORAGE_BUCKET_INVOICES).create_signed_url(
        path=filename,
        expires_in=60 * 60 * 24 * 7,
    )
    return signed["signedURL"]


def delete_file(bucket: str, path: str) -> None:
    """Delete a file from storage."""
    try:
        supabase = get_supabase_client()
        supabase.storage.from_(bucket).remove([path])
    except Exception:
        pass  # Non-critical

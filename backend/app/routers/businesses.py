"""
Businesses Router
"""
import re
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database.session import get_db
from app.models.models import Business, Profile
from app.schemas.schemas import BusinessCreate, BusinessUpdate, BusinessResponse, MessageResponse
from app.auth.dependencies import get_current_user, get_current_business

router = APIRouter()


def slugify(text: str) -> str:
    text = text.lower()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[-\s]+", "-", text)
    return text.strip("-")


@router.post("", response_model=BusinessResponse, status_code=status.HTTP_201_CREATED)
async def create_business(
    data: BusinessCreate,
    current_user: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Check if user already has a business
    result = await db.execute(
        select(Business).where(Business.owner_id == current_user.id)
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Business already exists for this account")

    # Generate unique slug
    base_slug = slugify(data.name)
    slug = base_slug
    counter = 1
    while True:
        exists = await db.execute(select(Business).where(Business.slug == slug))
        if not exists.scalar_one_or_none():
            break
        slug = f"{base_slug}-{counter}"
        counter += 1

    business = Business(owner_id=current_user.id, slug=slug, **data.model_dump())
    db.add(business)
    await db.flush()
    await db.refresh(business)
    return BusinessResponse.model_validate(business)


@router.get("/me", response_model=BusinessResponse)
async def get_my_business(business: Business = Depends(get_current_business)):
    return BusinessResponse.model_validate(business)


@router.put("/me", response_model=BusinessResponse)
async def update_business(
    data: BusinessUpdate,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(business, key, value)
    await db.flush()
    await db.refresh(business)
    return BusinessResponse.model_validate(business)


@router.post("/me/logo", response_model=BusinessResponse)
async def upload_logo(
    file: UploadFile = File(...),
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    """Upload or replace business logo."""
    from app.services.storage_service import upload_business_logo
    logo_url = await upload_business_logo(file, str(business.id), business.logo_url)
    business.logo_url = logo_url
    await db.flush()
    await db.refresh(business)
    return BusinessResponse.model_validate(business)


@router.delete("/me/logo", response_model=BusinessResponse)
async def remove_logo(
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    """Remove business logo."""
    if business.logo_url:
        from app.services.storage_service import delete_file
        from app.core.config import settings
        import logging
        logger = logging.getLogger(__name__)
        try:
            # Extract path from URL: .../business-logos/business_id/logo_...
            bucket_search = f"/{settings.STORAGE_BUCKET_LOGOS}/"
            if bucket_search in business.logo_url:
                path_part = business.logo_url.split(bucket_search)[-1]
                # Remove query parameters if any (e.g. ?t=123...)
                old_path = path_part.split("?")[0]
                logger.info(f"Removing logo from storage: {old_path}")
                delete_file(settings.STORAGE_BUCKET_LOGOS, old_path)
            else:
                logger.warning(f"Could not find bucket search string in logo URL: {business.logo_url}")
        except Exception as e:
            logger.error(f"Error removing logo from storage: {str(e)}")
            pass
        business.logo_url = None
        await db.flush()
        await db.refresh(business)
    return BusinessResponse.model_validate(business)

"""
Super Admin Router — User & Business Management Only
No subscription plans, no revenue charts.
Admin can: view all users, create users, deactivate users, change roles,
           view all businesses, toggle business active/inactive, delete businesses.
"""
from typing import Optional
from uuid import UUID
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
import math

from app.database.session import get_db
from app.models.models import Profile, Business, Invoice, UserRole
from app.schemas.schemas import ProfileResponse, BusinessResponse, MessageResponse
from app.auth.dependencies import get_current_user, require_role
from app.core.security import hash_password
from pydantic import BaseModel, EmailStr

router = APIRouter()
require_admin = require_role(UserRole.SUPER_ADMIN)


# ── Admin Schemas ─────────────────────────────────────────
class AdminCreateUserRequest(BaseModel):
    email: EmailStr
    full_name: str
    phone: Optional[str] = None
    role: UserRole = UserRole.BUSINESS_OWNER


class AdminUpdateUserRequest(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None


class PlatformStats(BaseModel):
    total_users: int
    total_businesses: int
    total_invoices: int
    new_users_today: int


# ── Platform Stats (simple counts only) ──────────────────
@router.get("/stats", response_model=PlatformStats)
async def get_stats(
    _: Profile = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    total_users = (await db.execute(select(func.count()).select_from(Profile))).scalar_one()
    total_businesses = (await db.execute(select(func.count()).select_from(Business))).scalar_one()
    total_invoices = (await db.execute(select(func.count()).select_from(Invoice))).scalar_one()
    new_today = (await db.execute(
        select(func.count()).where(Profile.created_at >= today_start)
    )).scalar_one()
    return PlatformStats(
        total_users=total_users,
        total_businesses=total_businesses,
        total_invoices=total_invoices,
        new_users_today=new_today,
    )


# ── Users ─────────────────────────────────────────────────
@router.get("/users")
async def list_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    role: Optional[UserRole] = None,
    _: Profile = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    query = select(Profile).order_by(desc(Profile.created_at))
    if search:
        query = query.where(
            Profile.email.ilike(f"%{search}%") | Profile.full_name.ilike(f"%{search}%")
        )
    if role:
        query = query.where(Profile.role == role)

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar_one()
    profiles = (await db.execute(query.offset((page - 1) * per_page).limit(per_page))).scalars().all()

    result = []
    for p in profiles:
        biz_name = (await db.execute(
            select(Business.name).where(Business.owner_id == p.id)
        )).scalar_one_or_none()
        result.append({
            "id": str(p.id),
            "email": p.email,
            "full_name": p.full_name,
            "phone": p.phone,
            "role": p.role,
            "is_active": p.is_active,
            "last_login_at": p.last_login_at.isoformat() if p.last_login_at else None,
            "created_at": p.created_at.isoformat(),
            "business_name": biz_name,
        })

    return {"items": result, "total": total, "page": page, "per_page": per_page, "pages": math.ceil(total / per_page)}


@router.post("/users", status_code=201)
async def create_user(
    data: AdminCreateUserRequest,
    _: Profile = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin creates a user directly (no OTP needed)."""
    existing = (await db.execute(select(Profile).where(Profile.email == data.email))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    profile = Profile(
        email=data.email,
        full_name=data.full_name,
        phone=data.phone,
        role=data.role,
        is_active=True,
    )
    db.add(profile)
    await db.flush()
    await db.refresh(profile)
    return ProfileResponse.model_validate(profile)


@router.patch("/users/{user_id}")
async def update_user(
    user_id: UUID,
    data: AdminUpdateUserRequest,
    _: Profile = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    profile = (await db.execute(select(Profile).where(Profile.id == user_id))).scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(profile, key, value)
    await db.flush()
    await db.refresh(profile)
    return ProfileResponse.model_validate(profile)


@router.delete("/users/{user_id}", response_model=MessageResponse)
async def deactivate_user(
    user_id: UUID,
    _: Profile = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    profile = (await db.execute(select(Profile).where(Profile.id == user_id))).scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")
    if profile.role == UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Cannot deactivate super admin")
    profile.is_active = False
    return MessageResponse(message=f"User {profile.email} deactivated")


# ── Businesses ────────────────────────────────────────────
@router.get("/businesses")
async def list_businesses(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    _: Profile = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    query = select(Business).order_by(desc(Business.created_at))
    if search:
        query = query.where(Business.name.ilike(f"%{search}%"))

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar_one()
    businesses = (await db.execute(query.offset((page - 1) * per_page).limit(per_page))).scalars().all()

    result = []
    for b in businesses:
        owner = (await db.execute(select(Profile).where(Profile.id == b.owner_id))).scalar_one_or_none()
        inv_count = (await db.execute(select(func.count()).where(Invoice.business_id == b.id))).scalar_one()
        result.append({
            "id": str(b.id),
            "name": b.name,
            "slug": b.slug,
            "owner_email": owner.email if owner else "N/A",
            "owner_name": owner.full_name if owner else None,
            "gst_number": b.gst_number,
            "is_active": b.is_active,
            "invoice_count": inv_count,
            "city": b.city,
            "state": b.state,
            "created_at": b.created_at.isoformat(),
        })

    return {"items": result, "total": total, "page": page, "per_page": per_page, "pages": math.ceil(total / per_page)}


@router.patch("/businesses/{business_id}/toggle", response_model=MessageResponse)
async def toggle_business(
    business_id: UUID,
    _: Profile = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    business = (await db.execute(select(Business).where(Business.id == business_id))).scalar_one_or_none()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    business.is_active = not business.is_active
    action = "activated" if business.is_active else "deactivated"
    return MessageResponse(message=f"Business '{business.name}' {action}")


@router.delete("/businesses/{business_id}", response_model=MessageResponse)
async def delete_business(
    business_id: UUID,
    _: Profile = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    business = (await db.execute(select(Business).where(Business.id == business_id))).scalar_one_or_none()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    await db.delete(business)
    return MessageResponse(message=f"Business '{business.name}' deleted")

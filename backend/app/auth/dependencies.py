"""
Auth Dependencies - JWT Validation & Role-Based Access Control
"""
from typing import Optional
from uuid import UUID
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.security import verify_access_token
from app.database.session import get_db
from app.models.models import Profile, Business, UserRole

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> Profile:
    """Extract and validate JWT, return current user profile."""
    payload = verify_access_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    result = await db.execute(
        select(Profile).where(Profile.id == UUID(user_id), Profile.is_active == True)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )
    return user


async def get_current_business(
    current_user: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Business:
    """Get the business associated with the current user."""
    result = await db.execute(
        select(Business).where(
            Business.owner_id == current_user.id,
            Business.is_active == True
        )
    )
    business = result.scalar_one_or_none()
    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found. Please create your business profile first.",
        )
    return business


def require_role(*roles: UserRole):
    """Role-based access control decorator."""
    async def role_checker(
        current_user: Profile = Depends(get_current_user),
    ) -> Profile:
        allowed_values = [r.value for r in roles]
        user_role = current_user.role if isinstance(current_user.role, str) else current_user.role.value
        if user_role not in allowed_values:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {allowed_values}",
            )
        return current_user
    return role_checker


require_super_admin = require_role(UserRole.SUPER_ADMIN)
require_business_owner = require_role(UserRole.BUSINESS_OWNER, UserRole.SUPER_ADMIN)

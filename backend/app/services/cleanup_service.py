"""
Cleanup Service — Purge incomplete signups from the database.

Two rules:
  1. OTP not verified within 30 minutes  → delete Profile row
  2. OTP verified but business never created within 30 minutes → delete Profile row

Runs as a background task every 10 minutes via APScheduler.
"""
import logging
from datetime import datetime, timezone, timedelta

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, and_, not_, exists
from sqlalchemy.orm import selectinload

from app.models.models import Profile, Business

logger = logging.getLogger(__name__)

UNVERIFIED_TTL_MINUTES = 30    # delete if OTP not verified within this time
ONBOARDING_TTL_MINUTES = 30    # delete if verified but no business within this time


async def cleanup_incomplete_signups(db: AsyncSession) -> dict:
    """
    Delete stale unverified and abandoned-onboarding accounts.
    Returns counts of deleted rows for logging.
    """
    now = datetime.now(timezone.utc)
    deleted_unverified = 0
    deleted_abandoned = 0

    # ── Rule 1: Unverified users whose OTP has been expired for > 30 mins ────
    # otp_expires_at < (now - 30min)  →  they've had at least 30 extra minutes
    cutoff_unverified = now - timedelta(minutes=UNVERIFIED_TTL_MINUTES)

    result = await db.execute(
        select(Profile).where(
            and_(
                Profile.is_verified == False,
                Profile.otp_expires_at < cutoff_unverified,
            )
        )
    )
    stale_unverified = result.scalars().all()

    for profile in stale_unverified:
        await db.delete(profile)
        deleted_unverified += 1
        logger.info(f"Cleanup: deleted unverified account {profile.email} (OTP expired at {profile.otp_expires_at})")

    # ── Rule 2: Verified users with no business created for > 30 mins ────────
    # Created account, verified OTP, but never completed onboarding
    cutoff_onboarding = now - timedelta(minutes=ONBOARDING_TTL_MINUTES)

    result = await db.execute(
        select(Profile).where(
            and_(
                Profile.is_verified == True,
                Profile.role != "super_admin",        # never delete admins
                Profile.last_login_at < cutoff_onboarding,
                # No business exists for this user
                not_(
                    exists(
                        select(Business.id).where(Business.owner_id == Profile.id)
                    )
                ),
            )
        )
    )
    abandoned = result.scalars().all()

    for profile in abandoned:
        await db.delete(profile)
        deleted_abandoned += 1
        logger.info(f"Cleanup: deleted abandoned account {profile.email} (verified at {profile.last_login_at}, no business created)")

    if deleted_unverified or deleted_abandoned:
        await db.flush()

    return {
        "deleted_unverified": deleted_unverified,
        "deleted_abandoned_onboarding": deleted_abandoned,
    }

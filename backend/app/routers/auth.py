"""
Auth Router - Password + OTP Verification
Flow:
  1. POST /signup      { email, password, full_name } → creates unverified user, sends 6-digit OTP
  2. POST /verify-otp  { email, otp } → verifies email, sets is_verified=True, returns JWT
  3. POST /login       { email, password } → verifies password, returns JWT
  4. GET  /me          → current user info
  5. POST /logout      → client discards tokens
"""
import secrets
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

from app.database.session import get_db
from app.models.models import Profile, UserRole
from app.schemas.schemas import (
    ProfileResponse, MessageResponse, TokenResponse,
    SignUpRequest, LoginRequest, OTPVerifyRequest, RefreshTokenRequest,
    ForgotPasswordRequest, VerifyResetOtpRequest, ResetPasswordRequest,
)
from app.core.security import (
    create_access_token, create_refresh_token, decode_token,
    hash_password, verify_password
)
from app.core.config import settings
from app.core.email import send_otp_email, _is_email_configured
from app.auth.dependencies import get_current_user

router = APIRouter()

OTP_EXPIRE_MINUTES = 10


# ── Helpers ───────────────────────────────────────────────
def generate_otp() -> str:
    """Generate a cryptographically secure 6-digit numeric OTP."""
    return "".join([str(secrets.randbelow(10)) for _ in range(6)])


# ── Endpoints ─────────────────────────────────────────────
@router.post("/signup", response_model=MessageResponse)
async def signup(
    data: SignUpRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Register a new user with email and password.
    Sends a 6-digit OTP for email verification.
    """
    # Check if user already exists
    result = await db.execute(select(Profile).where(Profile.email == data.email))
    existing_user = result.scalar_one_or_none()

    if existing_user:
        if existing_user.is_verified:
            raise HTTPException(status_code=400, detail="Email already registered")
        # If user exists but not verified, update their info and resend OTP
        existing_user.hashed_password = hash_password(data.password)
        existing_user.full_name = data.full_name
        existing_user.phone = data.phone
        profile = existing_user
    else:
        # Create new unverified profile
        role = UserRole.SUPER_ADMIN.value if data.email == settings.SUPER_ADMIN_EMAIL else UserRole.BUSINESS_OWNER.value
        profile = Profile(
            email=data.email,
            hashed_password=hash_password(data.password),
            full_name=data.full_name,
            phone=data.phone,
            role=role,
            is_active=True,
            is_verified=False,
        )
    # Generate and store OTP
    otp = generate_otp()
    profile.otp_secret = otp
    profile.otp_expires_at = datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRE_MINUTES)
    profile.otp_fail_count = 0
    
    db.add(profile)
    await db.flush()

    # Send OTP email in background
    background_tasks.add_task(
        send_otp_email,
        email=data.email,
        otp=otp,
        name=profile.full_name or data.email.split("@")[0],
    )

    # In dev mode (SMTP not configured), return OTP in response so signup works
    # without needing an email provider. Never do this in production.
    if not _is_email_configured():
        return MessageResponse(
            message=f"[DEV MODE - No SMTP configured] Your OTP is: {otp}  — "
                    f"Configure SMTP_* in .env to send real emails."
        )

    return MessageResponse(
        message=f"Verification code sent to {data.email}. Valid for {OTP_EXPIRE_MINUTES} minutes."
    )


@router.post("/verify-otp", response_model=TokenResponse)
async def verify_otp(
    data: OTPVerifyRequest,
    db: AsyncSession = Depends(get_db),
):
    """Verify OTP and activate account."""
    result = await db.execute(select(Profile).where(Profile.email == data.email))
    profile = result.scalar_one_or_none()

    if not profile or not profile.otp_secret:
        raise HTTPException(status_code=400, detail="No verification pending for this email.")

    # Check brute force
    if profile.otp_fail_count >= 5:
        raise HTTPException(status_code=429, detail="Too many failed attempts. Please request a new OTP.")

    # Check expiry
    now = datetime.now(timezone.utc)
    if profile.otp_expires_at is None or now > profile.otp_expires_at:
        profile.otp_secret = None
        profile.otp_expires_at = None
        raise HTTPException(status_code=400, detail="OTP has expired. Please signup again.")

    # Check OTP value
    if data.otp.strip() != profile.otp_secret:
        profile.otp_fail_count += 1
        await db.flush()
        raise HTTPException(status_code=400, detail="Invalid verification code.")

    # Success
    profile.is_verified = True
    profile.otp_secret = None
    profile.otp_expires_at = None
    profile.otp_fail_count = 0
    profile.last_login_at = now
    await db.flush()

    # Get business_id if exists
    from app.models.models import Business
    biz_result = await db.execute(select(Business.id).where(Business.owner_id == profile.id))
    business_id = biz_result.scalar_one_or_none()

    access_token = create_access_token(
        subject=str(profile.id),
        role=profile.role,
        business_id=str(business_id) if business_id else None,
    )
    refresh_token = create_refresh_token(subject=str(profile.id))

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=ProfileResponse.model_validate(profile),
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    data: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """Login with email and password."""
    result = await db.execute(select(Profile).where(Profile.email == data.email))
    profile = result.scalar_one_or_none()

    if not profile:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not profile.is_verified:
        raise HTTPException(status_code=403, detail="Please verify your email first")

    if not profile.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    if not profile.hashed_password or not verify_password(data.password, profile.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Success
    profile.last_login_at = datetime.now(timezone.utc)
    await db.flush()

    # Get business_id
    from app.models.models import Business
    biz_result = await db.execute(select(Business.id).where(Business.owner_id == profile.id))
    business_id = biz_result.scalar_one_or_none()

    access_token = create_access_token(
        subject=str(profile.id),
        role=profile.role,
        business_id=str(business_id) if business_id else None,
    )
    refresh_token = create_refresh_token(subject=str(profile.id))

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=ProfileResponse.model_validate(profile),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    data: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
):
    """Refresh access token."""
    payload = decode_token(data.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=400, detail="Invalid refresh token")

    result = await db.execute(select(Profile).where(Profile.id == UUID(payload["sub"])))
    profile = result.scalar_one_or_none()
    
    if not profile or not profile.is_active or not profile.is_verified:
        raise HTTPException(status_code=401, detail="User not found or status invalid")

    from app.models.models import Business
    biz_result = await db.execute(select(Business.id).where(Business.owner_id == profile.id))
    business_id = biz_result.scalar_one_or_none()

    access_token = create_access_token(
        subject=str(profile.id),
        role=profile.role,
        business_id=str(business_id) if business_id else None,
    )
    new_refresh = create_refresh_token(subject=str(profile.id))

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=ProfileResponse.model_validate(profile),
    )


@router.get("/me", response_model=ProfileResponse)
async def get_me(current_user: Profile = Depends(get_current_user)):
    return ProfileResponse.model_validate(current_user)


@router.post("/resend-otp", response_model=MessageResponse)
async def resend_otp(
    data: OTPVerifyRequest,  # reuse email field; otp field ignored
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Resend a fresh OTP to an unverified user.
    Dedicated endpoint so the frontend does NOT re-call /signup.
    Has a 60-second cooldown enforced server-side.
    """
    result = await db.execute(select(Profile).where(Profile.email == data.email))
    profile = result.scalar_one_or_none()

    if not profile:
        # Don't leak whether email exists — return success anyway
        return MessageResponse(message=f"If {data.email} is registered, a new code was sent.")

    if profile.is_verified:
        raise HTTPException(status_code=400, detail="Email already verified.")

    # Cooldown: only allow resend if last OTP was sent > 60 seconds ago
    now = datetime.now(timezone.utc)
    if profile.otp_expires_at:
        already_waited = (OTP_EXPIRE_MINUTES * 60) - (profile.otp_expires_at - now).total_seconds()
        if already_waited < 60:
            raise HTTPException(
                status_code=429,
                detail=f"Please wait {int(60 - already_waited)} seconds before requesting another code."
            )

    otp = generate_otp()
    profile.otp_secret = otp
    profile.otp_expires_at = now + timedelta(minutes=OTP_EXPIRE_MINUTES)
    profile.otp_fail_count = 0
    await db.flush()

    background_tasks.add_task(
        send_otp_email,
        email=profile.email,
        otp=otp,
        name=profile.full_name or profile.email.split("@")[0],
    )

    if not _is_email_configured():
        return MessageResponse(
            message=f"[DEV MODE - No SMTP configured] Your new OTP is: {otp}"
        )

    return MessageResponse(message=f"New verification code sent to {data.email}.")


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(
    data: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Step 1: User enters their email.
    Sends a 6-digit OTP to the registered email for password reset.
    Always returns success to prevent email enumeration.
    """
    result = await db.execute(select(Profile).where(Profile.email == data.email))
    profile = result.scalar_one_or_none()

    # Always return 200 — don't reveal if email exists
    if not profile or not profile.is_verified:
        return MessageResponse(message=f"If {data.email} is registered, a reset code has been sent.")

    otp = generate_otp()
    now = datetime.now(timezone.utc)
    profile.otp_secret = otp
    profile.otp_expires_at = now + timedelta(minutes=OTP_EXPIRE_MINUTES)
    profile.otp_fail_count = 0
    await db.flush()

    background_tasks.add_task(
        send_otp_email,
        email=profile.email,
        otp=otp,
        name=profile.full_name or profile.email.split("@")[0],
    )

    if not _is_email_configured():
        return MessageResponse(
            message=f"[DEV MODE] Password reset OTP: {otp}"
        )

    return MessageResponse(message=f"Password reset code sent to {data.email}. Valid for {OTP_EXPIRE_MINUTES} minutes.")


@router.post("/verify-reset-otp", response_model=MessageResponse)
async def verify_reset_otp(
    data: VerifyResetOtpRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Step 2: Verify the reset OTP is correct and not expired.
    Returns success — frontend then moves to the new password step.
    OTP is NOT cleared here; it's cleared on actual password reset.
    """
    result = await db.execute(select(Profile).where(Profile.email == data.email))
    profile = result.scalar_one_or_none()

    if not profile or not profile.otp_secret:
        raise HTTPException(status_code=400, detail="No reset request found for this email.")

    if profile.otp_fail_count >= 5:
        raise HTTPException(status_code=429, detail="Too many failed attempts. Please request a new reset code.")

    now = datetime.now(timezone.utc)
    if not profile.otp_expires_at or now > profile.otp_expires_at:
        profile.otp_secret = None
        profile.otp_expires_at = None
        await db.flush()
        raise HTTPException(status_code=400, detail="Reset code has expired. Please request a new one.")

    if data.otp.strip() != profile.otp_secret:
        profile.otp_fail_count += 1
        await db.flush()
        remaining = 5 - profile.otp_fail_count
        raise HTTPException(status_code=400, detail=f"Invalid code. {remaining} attempt(s) remaining.")

    return MessageResponse(message="Code verified. Please set your new password.")


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(
    data: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Step 3: Set the new password.
    Verifies OTP once more, updates password, clears OTP fields.
    """
    result = await db.execute(select(Profile).where(Profile.email == data.email))
    profile = result.scalar_one_or_none()

    if not profile or not profile.otp_secret:
        raise HTTPException(status_code=400, detail="No reset request found for this email.")

    if profile.otp_fail_count >= 5:
        raise HTTPException(status_code=429, detail="Too many failed attempts. Please request a new reset code.")

    now = datetime.now(timezone.utc)
    if not profile.otp_expires_at or now > profile.otp_expires_at:
        profile.otp_secret = None
        profile.otp_expires_at = None
        await db.flush()
        raise HTTPException(status_code=400, detail="Reset code has expired. Please request a new one.")

    if data.otp.strip() != profile.otp_secret:
        profile.otp_fail_count += 1
        await db.flush()
        raise HTTPException(status_code=400, detail="Invalid code. Please try again.")

    if len(data.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")

    # All good — update password and clear OTP
    profile.hashed_password = hash_password(data.new_password)
    profile.otp_secret = None
    profile.otp_expires_at = None
    profile.otp_fail_count = 0
    await db.flush()

    return MessageResponse(message="Password reset successfully. You can now log in with your new password.")


@router.post("/logout", response_model=MessageResponse)
async def logout(current_user: Profile = Depends(get_current_user)):
    return MessageResponse(message="Logged out successfully")

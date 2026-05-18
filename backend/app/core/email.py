"""
Email Service — Send OTP via Resend HTTPS API
Render blocks all outbound SMTP ports — this uses HTTPS instead.

Setup (free, 2 minutes):
  1. https://resend.com → Sign up → API Keys → Create API Key
  2. Add to Render env: RESEND_API_KEY=re_xxxx
  3. RESEND_FROM_EMAIL must be "onboarding@resend.dev" on free tier
     (or an address on a domain you have verified in Resend)
"""
import logging
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)


def _is_email_configured() -> bool:
    return bool(settings.RESEND_API_KEY and settings.RESEND_API_KEY.startswith("re_"))


def _build_otp_html(name: str, otp: str, expire_minutes: int) -> str:
    return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;margin:0;padding:40px 0;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#1e3a8a,#2563eb);padding:32px 40px;text-align:center;">
      <span style="color:white;font-size:24px;font-weight:800;letter-spacing:-0.5px;">BillFlow</span>
    </div>
    <div style="padding:40px;">
      <h2 style="color:#0f172a;font-size:20px;margin:0 0 8px;">Hello, {name} 👋</h2>
      <p style="color:#64748b;font-size:15px;line-height:1.6;margin:0 0 32px;">
        Your one-time verification code for BillFlow is:
      </p>
      <div style="background:#f1f5f9;border:2px dashed #cbd5e1;border-radius:12px;padding:24px;text-align:center;margin-bottom:32px;">
        <span style="font-size:48px;font-weight:800;letter-spacing:14px;color:#1e40af;font-family:monospace;">{otp}</span>
        <p style="color:#94a3b8;font-size:13px;margin:12px 0 0;">
          Valid for <strong>{expire_minutes} minutes</strong> &nbsp;•&nbsp; Do not share this code
        </p>
      </div>
      <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:0;">
        If you did not request this, you can safely ignore this email.
      </p>
    </div>
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
      <p style="color:#cbd5e1;font-size:12px;margin:0;">BillFlow • Smart Billing for Small Business</p>
    </div>
  </div>
</body>
</html>"""


async def send_otp_email(email: str, otp: str, name: str) -> bool:
    """
    Send OTP via Resend HTTPS API.
    Dev fallback: logs OTP to console if RESEND_API_KEY not configured.
    """
    if not _is_email_configured():
        logger.warning(
            f"\n{'='*55}\n"
            f"  OTP (dev mode — RESEND_API_KEY not set)\n"
            f"  To:  {email}\n"
            f"  OTP: {otp}\n"
            f"{'='*55}"
        )
        return True

    # FIX: Use "onboarding@resend.dev" on free tier (no domain verification needed).
    # Using a custom from-address without a verified domain causes 403.
    from_email = settings.RESEND_FROM_EMAIL or "onboarding@resend.dev"

    payload = {
        "from": f"BillFlow <{from_email}>",
        "to": [email],
        "subject": f"{otp} is your BillFlow verification code",
        "html": _build_otp_html(name, otp, 10),
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            "https://api.resend.com/emails",
            json=payload,
            headers={
                "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
        )

    if resp.status_code in (200, 201):
        logger.info(f"OTP email sent to {email} (Resend id={resp.json().get('id')})")
        return True

    try:
        error_body = resp.json()
    except Exception:
        error_body = resp.text

    logger.error(f"Resend API error {resp.status_code}: {error_body}")

    if resp.status_code == 403:
        raise RuntimeError(
            "Resend 403: Set RESEND_FROM_EMAIL=onboarding@resend.dev "
            "OR verify your domain at resend.com/domains"
        )

    raise RuntimeError(f"Email send failed ({resp.status_code}): {error_body}")

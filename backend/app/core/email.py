"""
Email Service — Send OTP via SendGrid HTTP API (HTTPS)
Pure HTTPS — not blocked by Render or any cloud platform.
Uses SENDGRID_API_KEY from environment variables.
"""
import logging
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)

SENDGRID_API_URL = "https://api.sendgrid.com/v3/mail/send"


def _is_email_configured() -> bool:
    return bool(settings.SENDGRID_API_KEY and settings.SENDGRID_API_KEY.startswith("SG."))


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
    Send OTP email via SendGrid HTTPS API.
    Falls back to console log in dev mode if SENDGRID_API_KEY not set.
    """
    if not _is_email_configured():
        logger.warning(
            f"\n{'='*55}\n"
            f"  OTP (dev mode — SENDGRID_API_KEY not set)\n"
            f"  To:  {email}\n"
            f"  OTP: {otp}\n"
            f"{'='*55}"
        )
        return True

    from_email = settings.SENDGRID_FROM_EMAIL or settings.SENDGRID_FROM_EMAIL
    sender_name = "BillFlow"

    payload = {
        "personalizations": [
            {
                "to": [{"email": email, "name": name}],
                "subject": f"{otp} is your BillFlow verification code",
            }
        ],
        "from": {"email": from_email, "name": sender_name},
        "reply_to": {"email": from_email, "name": sender_name},
        "content": [
            {
                "type": "text/plain",
                "value": f"Your BillFlow verification code is: {otp}\nValid for 10 minutes. Do not share this code.",
            },
            {
                "type": "text/html",
                "value": _build_otp_html(name, otp, 10),
            },
        ],
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            SENDGRID_API_URL,
            json=payload,
            headers={
                "Authorization": f"Bearer {settings.SENDGRID_API_KEY}",
                "Content-Type": "application/json",
            },
        )

    # SendGrid returns 202 Accepted on success (no body)
    if resp.status_code == 202:
        logger.info(f"✅ OTP email sent to {email} via SendGrid")
        return True

    try:
        error_body = resp.json()
    except Exception:
        error_body = resp.text

    logger.error(f"SendGrid API error {resp.status_code}: {error_body}")

    if resp.status_code == 401:
        raise RuntimeError("SendGrid 401: Invalid API key — check SENDGRID_API_KEY in Render env vars")
    if resp.status_code == 403:
        raise RuntimeError(
            "SendGrid 403: Sender not verified — go to SendGrid → Settings → Sender Authentication "
            "and verify your sender email address"
        )

    raise RuntimeError(f"SendGrid email failed ({resp.status_code}): {error_body}")

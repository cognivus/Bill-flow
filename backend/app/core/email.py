"""
Email Service - Send OTP via SMTP (Supabase / Gmail / any SMTP)
Configure SMTP_* variables in .env
Falls back to console logging in development.
"""
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.core.config import settings

logger = logging.getLogger(__name__)


def _build_otp_html(name: str, otp: str, expire_minutes: int) -> str:
    return f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f8fafc; margin:0; padding:40px 0;">
  <div style="max-width:480px; margin:0 auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1e3a8a,#2563eb); padding:32px 40px; text-align:center;">
      <div style="display:inline-flex; align-items:center; gap:10px;">
        <div style="width:36px; height:36px; background:rgba(255,255,255,0.2); border-radius:10px; display:flex; align-items:center; justify-content:center;">
          <span style="color:white; font-size:18px; font-weight:bold;">B</span>
        </div>
        <span style="color:white; font-size:22px; font-weight:700; letter-spacing:-0.5px;">BillFlow</span>
      </div>
    </div>
    <!-- Body -->
    <div style="padding:40px;">
      <h2 style="color:#0f172a; font-size:20px; margin:0 0 8px;">Hello, {name} 👋</h2>
      <p style="color:#64748b; font-size:15px; line-height:1.6; margin:0 0 32px;">
        Your one-time login code for BillFlow is:
      </p>
      <!-- OTP Box -->
      <div style="background:#f1f5f9; border:2px dashed #cbd5e1; border-radius:12px; padding:24px; text-align:center; margin-bottom:32px;">
        <span style="font-size:42px; font-weight:800; letter-spacing:12px; color:#1e40af; font-family:monospace;">{otp}</span>
        <p style="color:#94a3b8; font-size:13px; margin:12px 0 0;">
          Valid for <strong>{expire_minutes} minutes</strong> &nbsp;•&nbsp; Do not share this code
        </p>
      </div>
      <p style="color:#94a3b8; font-size:13px; line-height:1.6; margin:0;">
        If you didn't request this, you can safely ignore this email.<br>
        Someone may have typed your email by mistake.
      </p>
    </div>
    <!-- Footer -->
    <div style="background:#f8fafc; border-top:1px solid #e2e8f0; padding:20px 40px; text-align:center;">
      <p style="color:#cbd5e1; font-size:12px; margin:0;">BillFlow • Smart Billing for Small Business</p>
    </div>
  </div>
</body>
</html>
"""


async def send_otp_email(email: str, otp: str, name: str) -> bool:
    """
    Send OTP email via SMTP.
    If SMTP is not configured, logs the OTP to console (dev mode).
    """
    # ── Dev mode: just log it ─────────────────────────────
    if not settings.SMTP_HOST or settings.SMTP_HOST == "smtp.gmail.com" and not settings.SMTP_PASSWORD:
        logger.warning(
            f"\n{'='*50}\n"
            f"  OTP EMAIL (dev mode — SMTP not configured)\n"
            f"  To:  {email}\n"
            f"  OTP: {otp}\n"
            f"{'='*50}"
        )
        return True

    # ── Production: send via SMTP ─────────────────────────
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"{otp} is your BillFlow login code"
        msg["From"] = f"BillFlow <{settings.SMTP_FROM_EMAIL}>"
        msg["To"] = email

        html = _build_otp_html(name, otp, 10)
        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.ehlo()
            if settings.SMTP_USE_TLS:
                server.starttls()
            if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_FROM_EMAIL, email, msg.as_string())

        logger.info(f"OTP email sent to {email}")
        return True

    except Exception as e:
        logger.error(f"Failed to send OTP email to {email}: {e}")
        # Raise exception so the API endpoint can catch it or return 500
        raise RuntimeError(f"Could not send email: {str(e)}")

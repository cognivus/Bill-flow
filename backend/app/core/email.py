"""
Email Service — Send OTP via Gmail SMTP
Uses aiosmtplib for async (non-blocking) SMTP over port 587 (STARTTLS).

Setup:
  1. Enable 2-Factor Authentication on your Google account
  2. Go to: https://myaccount.google.com/apppasswords
  3. Create an App Password for "Mail"
  4. Add to .env:
       SMTP_HOST=smtp.gmail.com
       SMTP_PORT=587
       SMTP_USERNAME=your@gmail.com
       SMTP_PASSWORD=xxxx xxxx xxxx xxxx   (16-char App Password)
       SMTP_FROM_EMAIL=your@gmail.com
       SMTP_USE_TLS=True
"""
import logging
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.core.config import settings

logger = logging.getLogger(__name__)


def _is_email_configured() -> bool:
    return bool(
        settings.SMTP_HOST
        and settings.SMTP_USERNAME
        and settings.SMTP_PASSWORD
    )


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
    Send OTP email via Gmail SMTP (async, non-blocking).
    Falls back to console log in dev mode if SMTP not configured.
    """
    if not _is_email_configured():
        logger.warning(
            f"\n{'='*55}\n"
            f"  OTP (dev mode — SMTP not configured)\n"
            f"  To:  {email}\n"
            f"  OTP: {otp}\n"
            f"{'='*55}"
        )
        return True

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"{otp} is your BillFlow verification code"
    msg["From"] = f"BillFlow <{settings.SMTP_FROM_EMAIL}>"
    msg["To"] = email

    msg.attach(MIMEText(
        f"Your BillFlow verification code is: {otp}\nValid for 10 minutes. Do not share this code.",
        "plain"
    ))
    msg.attach(MIMEText(_build_otp_html(name, otp, 10), "html"))

    await aiosmtplib.send(
        msg,
        hostname=settings.SMTP_HOST,
        port=settings.SMTP_PORT,
        username=settings.SMTP_USERNAME,
        password=settings.SMTP_PASSWORD,
        start_tls=settings.SMTP_USE_TLS,
    )

    logger.info(f"✅ OTP email sent to {email} via Gmail SMTP")
    return True

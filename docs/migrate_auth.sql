-- =====================================================
-- BillFlow - Migration: Add Password + OTP Auth Fields
-- Run this in Supabase SQL Editor to fix "Registration failed"
-- =====================================================

-- Add password-based auth column
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hashed_password VARCHAR(255);

-- Add email verification status
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- Add OTP columns (may already exist from original schema)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS otp_secret VARCHAR(64);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS otp_fail_count INTEGER DEFAULT 0;

-- Mark any existing users as verified (so they aren't locked out)
UPDATE profiles SET is_verified = TRUE WHERE is_verified = FALSE AND last_login_at IS NOT NULL;

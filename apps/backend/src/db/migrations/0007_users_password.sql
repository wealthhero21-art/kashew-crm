-- 0007 — Email + password auth (factor 1). The WhatsApp OTP step (factor 2)
-- continues to use the existing otp_codes flow keyed by phone.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Case-insensitive unique email when set, so login-by-email is deterministic.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique
  ON users (LOWER(email)) WHERE email IS NOT NULL;

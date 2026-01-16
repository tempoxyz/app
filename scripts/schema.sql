-- Contacts table: stores encrypted email and phone for onramp verification
CREATE TABLE IF NOT EXISTS contacts (
	address TEXT PRIMARY KEY,
	email_encrypted TEXT,
	phone_encrypted TEXT,
	phone_verified_at TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- OTP attempts table: tracks verification codes and rate limiting
CREATE TABLE IF NOT EXISTS otp_attempts (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	address TEXT NOT NULL,
	phone_hash TEXT NOT NULL,
	code_hash TEXT NOT NULL,
	expires_at TEXT NOT NULL,
	attempts INTEGER NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_otp_attempts_address ON otp_attempts(address);
CREATE INDEX IF NOT EXISTS idx_otp_attempts_expires ON otp_attempts(expires_at);

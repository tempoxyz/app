'use server'

import { getAddress } from 'viem'
import * as z from 'zod'
import { decrypt, encrypt, generateOtp, hashValue } from './onramp/crypto'
import { sendSms } from './onramp/twilio'

const MAX_OTP_ATTEMPTS = 5
const OTP_EXPIRY_MINUTES = 10
const PHONE_VERIFICATION_MAX_AGE_DAYS = 60
const TEST_OTP_CODE = '000000'

async function getEnv() {
	const { env } = await import('cloudflare:workers')
	return {
		DB: env.DB as D1Database,
		ENCRYPTION_KEY: env.ENCRYPTION_KEY as string,
		TWILIO_ACCOUNT_SID: env.TWILIO_ACCOUNT_SID as string,
		TWILIO_AUTH_TOKEN: env.TWILIO_AUTH_TOKEN as string,
		TWILIO_PHONE_NUMBER: env.TWILIO_PHONE_NUMBER as string,
	}
}

const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/)

export async function getOnrampStatusFn(address: string) {
	const parsed = addressSchema.parse(address)
	const normalizedAddress = getAddress(parsed)
	const env = await getEnv()

	const contact = await env.DB.prepare(
		'SELECT email_encrypted, phone_encrypted, phone_verified_at FROM onramp_users WHERE address = ?',
	)
		.bind(normalizedAddress)
		.first<{
			email_encrypted: string | null
			phone_encrypted: string | null
			phone_verified_at: string | null
		}>()

	if (!contact) {
		return {
			eligible: false,
			hasEmail: false,
			hasPhone: false,
			phoneVerified: false,
			phoneVerifiedAt: null,
		}
	}

	const phoneVerifiedAt = contact.phone_verified_at
		? new Date(contact.phone_verified_at)
		: null

	const isVerificationExpired = phoneVerifiedAt
		? Date.now() - phoneVerifiedAt.getTime() >
			PHONE_VERIFICATION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000
		: true

	return {
		eligible: !isVerificationExpired,
		hasEmail: Boolean(contact.email_encrypted),
		hasPhone: Boolean(contact.phone_encrypted),
		phoneVerified: Boolean(phoneVerifiedAt) && !isVerificationExpired,
		phoneVerifiedAt: contact.phone_verified_at,
	}
}

export async function setEmailFn(address: string, email: string) {
	const parsed = z
		.object({ address: addressSchema, email: z.string().email() })
		.parse({ address, email })
	const normalizedAddress = getAddress(parsed.address)
	const env = await getEnv()

	const emailEncrypted = await encrypt(parsed.email, env.ENCRYPTION_KEY)

	await env.DB.prepare(
		`INSERT INTO onramp_users (address, email_encrypted, updated_at)
		 VALUES (?, ?, datetime('now'))
		 ON CONFLICT(address) DO UPDATE SET
		 email_encrypted = excluded.email_encrypted,
		 updated_at = datetime('now')`,
	)
		.bind(normalizedAddress, emailEncrypted)
		.run()

	return { success: true }
}

export async function setPhoneFn(address: string, phone: string) {
	const parsed = z
		.object({ address: addressSchema, phone: z.string().min(10) })
		.parse({ address, phone })
	const normalizedAddress = getAddress(parsed.address)
	const env = await getEnv()

	const phoneEncrypted = await encrypt(parsed.phone, env.ENCRYPTION_KEY)

	await env.DB.prepare(
		`INSERT INTO onramp_users (address, phone_encrypted, updated_at)
		 VALUES (?, ?, datetime('now'))
		 ON CONFLICT(address) DO UPDATE SET
		 phone_encrypted = excluded.phone_encrypted,
		 phone_verified_at = NULL,
		 updated_at = datetime('now')`,
	)
		.bind(normalizedAddress, phoneEncrypted)
		.run()

	return { success: true }
}

export async function sendOtpFn(address: string) {
	const parsed = addressSchema.parse(address)
	const normalizedAddress = getAddress(parsed)
	const env = await getEnv()

	const contact = await env.DB.prepare(
		'SELECT phone_encrypted FROM onramp_users WHERE address = ?',
	)
		.bind(normalizedAddress)
		.first<{ phone_encrypted: string | null }>()

	if (!contact?.phone_encrypted) {
		throw new Error('Phone number not set')
	}

	const phone = await decrypt(contact.phone_encrypted, env.ENCRYPTION_KEY)
	const phoneHash = await hashValue(phone)

	await env.DB.prepare(
		"DELETE FROM otp_attempts WHERE address = ? OR expires_at < datetime('now')",
	)
		.bind(normalizedAddress)
		.run()

	const isTestMode = import.meta.env.DEV

	const otp = isTestMode ? TEST_OTP_CODE : generateOtp()
	const codeHash = await hashValue(otp)
	const expiresAt = new Date(
		Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000,
	).toISOString()

	await env.DB.prepare(
		`INSERT INTO otp_attempts (address, phone_hash, code_hash, expires_at)
		 VALUES (?, ?, ?, ?)`,
	)
		.bind(normalizedAddress, phoneHash, codeHash, expiresAt)
		.run()

	if (isTestMode) {
		return { success: true, expiresAt, testMode: true }
	}

	const result = await sendSms(
		{
			accountSid: env.TWILIO_ACCOUNT_SID,
			authToken: env.TWILIO_AUTH_TOKEN,
			fromNumber: env.TWILIO_PHONE_NUMBER,
		},
		phone,
		`Your Tempo verification code is: ${otp}`,
	)

	if (!result.success) {
		throw new Error(result.error ?? 'Failed to send verification code')
	}

	return { success: true, expiresAt }
}

export async function verifyOtpFn(address: string, code: string) {
	const parsed = z
		.object({ address: addressSchema, code: z.string().regex(/^\d{6}$/) })
		.parse({ address, code })
	const normalizedAddress = getAddress(parsed.address)
	const env = await getEnv()

	const attempt = await env.DB.prepare(
		`SELECT id, code_hash, attempts FROM otp_attempts
		 WHERE address = ? AND expires_at > datetime('now')
		 ORDER BY created_at DESC LIMIT 1`,
	)
		.bind(normalizedAddress)
		.first<{ id: number; code_hash: string; attempts: number }>()

	if (!attempt) {
		throw new Error(
			'No valid verification code found. Please request a new one.',
		)
	}

	if (attempt.attempts >= MAX_OTP_ATTEMPTS) {
		await env.DB.prepare('DELETE FROM otp_attempts WHERE id = ?')
			.bind(attempt.id)
			.run()
		throw new Error(
			'Too many attempts. Please request a new verification code.',
		)
	}

	const codeHashValue = await hashValue(parsed.code)

	if (codeHashValue !== attempt.code_hash) {
		const newAttempts = attempt.attempts + 1
		await env.DB.prepare('UPDATE otp_attempts SET attempts = ? WHERE id = ?')
			.bind(newAttempts, attempt.id)
			.run()

		const remaining = MAX_OTP_ATTEMPTS - newAttempts
		throw new Error(
			remaining > 0
				? `Invalid code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
				: 'Too many attempts. Please request a new verification code.',
		)
	}

	const now = new Date().toISOString()
	await env.DB.prepare(
		`UPDATE onramp_users SET phone_verified_at = ?, updated_at = ? WHERE address = ?`,
	)
		.bind(now, now, normalizedAddress)
		.run()

	await env.DB.prepare('DELETE FROM otp_attempts WHERE address = ?')
		.bind(normalizedAddress)
		.run()

	return { success: true, phoneVerifiedAt: now }
}

export async function getContactInfoFn(address: string) {
	const parsed = addressSchema.parse(address)
	const normalizedAddress = getAddress(parsed)
	const env = await getEnv()

	const contact = await env.DB.prepare(
		'SELECT email_encrypted, phone_encrypted, phone_verified_at FROM onramp_users WHERE address = ?',
	)
		.bind(normalizedAddress)
		.first<{
			email_encrypted: string | null
			phone_encrypted: string | null
			phone_verified_at: string | null
		}>()

	if (!contact) {
		return { email: null, phone: null, phoneVerifiedAt: null }
	}

	const email = contact.email_encrypted
		? await decrypt(contact.email_encrypted, env.ENCRYPTION_KEY)
		: null

	const phone = contact.phone_encrypted
		? await decrypt(contact.phone_encrypted, env.ENCRYPTION_KEY)
		: null

	return {
		email,
		phone,
		phoneVerifiedAt: contact.phone_verified_at,
	}
}

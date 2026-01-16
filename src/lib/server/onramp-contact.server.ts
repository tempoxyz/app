import { createServerFn } from '@tanstack/react-start'
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

export const getOnrampStatusFn = createServerFn({ method: 'GET' })
	.inputValidator((input: { address: string }) =>
		z.object({ address: addressSchema }).parse(input),
	)
	.handler(async ({ data }) => {
		const address = getAddress(data.address)
		const env = await getEnv()

		const contact = await env.DB.prepare(
			'SELECT email_encrypted, phone_encrypted, phone_verified_at FROM contacts WHERE address = ?',
		)
			.bind(address)
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
			hasEmail: !!contact.email_encrypted,
			hasPhone: !!contact.phone_encrypted,
			phoneVerified: !!phoneVerifiedAt && !isVerificationExpired,
			phoneVerifiedAt: contact.phone_verified_at,
		}
	})

export const setEmailFn = createServerFn({ method: 'POST' })
	.inputValidator((input: { address: string; email: string }) =>
		z
			.object({ address: addressSchema, email: z.string().email() })
			.parse(input),
	)
	.handler(async ({ data }) => {
		const address = getAddress(data.address)
		const env = await getEnv()

		const emailEncrypted = await encrypt(data.email, env.ENCRYPTION_KEY)

		await env.DB.prepare(
			`INSERT INTO contacts (address, email_encrypted, updated_at)
			 VALUES (?, ?, datetime('now'))
			 ON CONFLICT(address) DO UPDATE SET
			 email_encrypted = excluded.email_encrypted,
			 updated_at = datetime('now')`,
		)
			.bind(address, emailEncrypted)
			.run()

		return { success: true }
	})

export const setPhoneFn = createServerFn({ method: 'POST' })
	.inputValidator((input: { address: string; phone: string }) =>
		z
			.object({ address: addressSchema, phone: z.string().min(10) })
			.parse(input),
	)
	.handler(async ({ data }) => {
		const address = getAddress(data.address)
		const env = await getEnv()

		const phoneEncrypted = await encrypt(data.phone, env.ENCRYPTION_KEY)

		await env.DB.prepare(
			`INSERT INTO contacts (address, phone_encrypted, updated_at)
			 VALUES (?, ?, datetime('now'))
			 ON CONFLICT(address) DO UPDATE SET
			 phone_encrypted = excluded.phone_encrypted,
			 phone_verified_at = NULL,
			 updated_at = datetime('now')`,
		)
			.bind(address, phoneEncrypted)
			.run()

		return { success: true }
	})

export const sendOtpFn = createServerFn({ method: 'POST' })
	.inputValidator((input: { address: string }) =>
		z.object({ address: addressSchema }).parse(input),
	)
	.handler(async ({ data }) => {
		const address = getAddress(data.address)
		const env = await getEnv()

		const contact = await env.DB.prepare(
			'SELECT phone_encrypted FROM contacts WHERE address = ?',
		)
			.bind(address)
			.first<{ phone_encrypted: string | null }>()

		if (!contact?.phone_encrypted) {
			throw new Error('Phone number not set')
		}

		const phone = await decrypt(contact.phone_encrypted, env.ENCRYPTION_KEY)
		const phoneHash = await hashValue(phone)

		await env.DB.prepare(
			"DELETE FROM otp_attempts WHERE address = ? OR expires_at < datetime('now')",
		)
			.bind(address)
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
			.bind(address, phoneHash, codeHash, expiresAt)
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
	})

export const verifyOtpFn = createServerFn({ method: 'POST' })
	.inputValidator((input: { address: string; code: string }) =>
		z
			.object({ address: addressSchema, code: z.string().regex(/^\d{6}$/) })
			.parse(input),
	)
	.handler(async ({ data }) => {
		const address = getAddress(data.address)
		const env = await getEnv()

		const attempt = await env.DB.prepare(
			`SELECT id, code_hash, attempts FROM otp_attempts
			 WHERE address = ? AND expires_at > datetime('now')
			 ORDER BY created_at DESC LIMIT 1`,
		)
			.bind(address)
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

		const codeHash = await hashValue(data.code)

		if (codeHash !== attempt.code_hash) {
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
			`UPDATE contacts SET phone_verified_at = ?, updated_at = ? WHERE address = ?`,
		)
			.bind(now, now, address)
			.run()

		await env.DB.prepare('DELETE FROM otp_attempts WHERE address = ?')
			.bind(address)
			.run()

		return { success: true, phoneVerifiedAt: now }
	})

export const getContactInfoFn = createServerFn({ method: 'GET' })
	.inputValidator((input: { address: string }) =>
		z.object({ address: addressSchema }).parse(input),
	)
	.handler(async ({ data }) => {
		const address = getAddress(data.address)
		const env = await getEnv()

		const contact = await env.DB.prepare(
			'SELECT email_encrypted, phone_encrypted, phone_verified_at FROM contacts WHERE address = ?',
		)
			.bind(address)
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
	})

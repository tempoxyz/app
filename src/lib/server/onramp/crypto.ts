const ALGORITHM = 'AES-GCM'
const IV_LENGTH = 12
const TAG_LENGTH = 128

async function getKey(secret: string): Promise<CryptoKey> {
	if (!secret) {
		throw new Error('ENCRYPTION_KEY environment variable is not set')
	}
	const encoder = new TextEncoder()
	const keyData = encoder.encode(secret.padEnd(32, '0').slice(0, 32))
	return crypto.subtle.importKey('raw', keyData, { name: ALGORITHM }, false, [
		'encrypt',
		'decrypt',
	])
}

export async function encrypt(
	plaintext: string,
	secret: string,
): Promise<string> {
	const key = await getKey(secret)
	const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
	const encoder = new TextEncoder()
	const data = encoder.encode(plaintext)

	const ciphertext = await crypto.subtle.encrypt(
		{ name: ALGORITHM, iv, tagLength: TAG_LENGTH },
		key,
		data,
	)

	const combined = new Uint8Array(iv.length + ciphertext.byteLength)
	combined.set(iv, 0)
	combined.set(new Uint8Array(ciphertext), iv.length)

	return btoa(String.fromCharCode(...combined))
}

export async function decrypt(
	encrypted: string,
	secret: string,
): Promise<string> {
	const key = await getKey(secret)
	const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0))

	const iv = combined.slice(0, IV_LENGTH)
	const ciphertext = combined.slice(IV_LENGTH)

	const decrypted = await crypto.subtle.decrypt(
		{ name: ALGORITHM, iv, tagLength: TAG_LENGTH },
		key,
		ciphertext,
	)

	return new TextDecoder().decode(decrypted)
}

export async function hashValue(value: string): Promise<string> {
	const encoder = new TextEncoder()
	const data = encoder.encode(value)
	const hashBuffer = await crypto.subtle.digest('SHA-256', data)
	return btoa(String.fromCharCode(...new Uint8Array(hashBuffer)))
}

export function generateOtp(): string {
	const array = new Uint32Array(1)
	crypto.getRandomValues(array)
	return String(array[0] % 1000000).padStart(6, '0')
}

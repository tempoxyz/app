'use server'

import * as IDX from 'idxs'

const TEMPO_ENV = import.meta.env.VITE_TEMPO_ENV

const ACCOUNT_KEYCHAIN_ADDRESS =
	'0xaAAAaaAA00000000000000000000000000000000' as const

const KEY_AUTHORIZED_SIG =
	'event KeyAuthorized(address indexed account, address indexed publicKey, uint8 signatureType, uint64 expiry)'
const KEY_REVOKED_SIG =
	'event KeyRevoked(address indexed account, address indexed publicKey)'
const SPENDING_LIMIT_SIG =
	'event SpendingLimitUpdated(address indexed account, address indexed publicKey, address indexed token, uint256 newLimit)'

async function getIndexSupply() {
	let apiKey: string | undefined
	try {
		const { env } = await import('cloudflare:workers')
		apiKey = env.INDEXER_API_KEY as string | undefined
	} catch {
		apiKey = process.env.INDEXER_API_KEY ?? import.meta.env.INDEXER_API_KEY
	}
	const IS = IDX.IndexSupply.create({ apiKey })
	return { IS, QB: IDX.QueryBuilder.from(IS) }
}

function getChainId(): number {
	return TEMPO_ENV === 'moderato'
		? 42431
		: TEMPO_ENV === 'devnet'
			? 42430
			: 4217
}

async function getChainIdFromEnv(): Promise<number> {
	try {
		const { env } = await import('cloudflare:workers')
		const tempoEnv = env.VITE_TEMPO_ENV as string | undefined
		return tempoEnv === 'moderato'
			? 42431
			: tempoEnv === 'devnet'
				? 42430
				: 4217
	} catch {
		return getChainId()
	}
}

export type AccessKeyEventData = {
	keyId: string
	signatureType: number
	expiry: number
	blockNumber: string
	originalLimits: Array<[string, string]>
}

export async function fetchAccessKeyEvents(
	account: string,
): Promise<AccessKeyEventData[] | null> {
	try {
		const accountLower = account.toLowerCase()
		const chainId = await getChainIdFromEnv()
		const { QB } = await getIndexSupply()

		const [authorizedResult, revokedResult, spendingLimitResult] =
			await Promise.all([
				QB.withSignatures([KEY_AUTHORIZED_SIG])
					.selectFrom('keyauthorized')
					.select(['publicKey', 'signatureType', 'expiry', 'block_num'])
					.where('chain', '=', chainId)
					.where('address', '=', ACCOUNT_KEYCHAIN_ADDRESS)
					.where('account', '=', accountLower as `0x${string}`)
					.orderBy('block_num', 'desc')
					.execute(),

				QB.withSignatures([KEY_REVOKED_SIG])
					.selectFrom('keyrevoked')
					.select(['publicKey'])
					.where('chain', '=', chainId)
					.where('address', '=', ACCOUNT_KEYCHAIN_ADDRESS)
					.where('account', '=', accountLower as `0x${string}`)
					.execute(),

				QB.withSignatures([SPENDING_LIMIT_SIG])
					.selectFrom('spendinglimitupdated')
					.select(['publicKey', 'token', 'newLimit', 'block_num'])
					.where('chain', '=', chainId)
					.where('address', '=', ACCOUNT_KEYCHAIN_ADDRESS)
					.where('account', '=', accountLower as `0x${string}`)
					.orderBy('block_num', 'asc')
					.execute(),
			])

		const revokedKeyIds = new Set<string>(
			revokedResult.map((r) => String(r.publicKey).toLowerCase()),
		)

		const originalLimitsMap = new Map<string, Map<string, bigint>>()
		for (const row of spendingLimitResult) {
			const keyIdLower = String(row.publicKey).toLowerCase()
			const tokenLower = String(row.token).toLowerCase()
			let keyLimits = originalLimitsMap.get(keyIdLower)
			if (!keyLimits) {
				keyLimits = new Map()
				originalLimitsMap.set(keyIdLower, keyLimits)
			}
			if (!keyLimits.has(tokenLower)) {
				keyLimits.set(tokenLower, BigInt(row.newLimit))
			}
		}

		const nowSeconds = Math.floor(Date.now() / 1000)
		const activeKeys = authorizedResult
			.filter((row) => {
				const keyId = String(row.publicKey).toLowerCase()
				const expiry = Number(row.expiry)
				const isRevoked = revokedKeyIds.has(keyId)
				const isExpired = expiry !== 0 && expiry <= nowSeconds
				return !isRevoked && !isExpired
			})
			.map((row) => {
				const keyId = String(row.publicKey).toLowerCase()
				const limits = originalLimitsMap.get(keyId)

				return {
					keyId: String(row.publicKey),
					signatureType: Number(row.signatureType),
					expiry: Number(row.expiry),
					blockNumber: String(row.block_num),
					originalLimits: limits
						? Array.from(limits.entries()).map(([token, limit]) => [
								token,
								limit.toString(),
							])
						: [],
				} as AccessKeyEventData
			})

		return activeKeys
	} catch (error) {
		console.error('[fetchAccessKeyEvents] Error:', error)
		return null
	}
}

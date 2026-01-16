'use server'

import * as IDX from 'idxs'
import type { Address } from 'ox'

const TIP20_DECIMALS = 6
const TEMPO_ENV = import.meta.env.VITE_TEMPO_ENV

const HARDCODED_USD_TOKENS = new Set([
	'0x20c000000000000000000000033abb6ac7d235e5',
])

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

const TRANSFER_SIGNATURE =
	'event Transfer(address indexed from, address indexed to, uint256 amount)'

export type AssetData = {
	address: Address.Address
	metadata:
		| { name?: string; symbol?: string; decimals?: number; priceUsd?: number }
		| undefined
	balance: string | undefined
	valueUsd: number | undefined
}

export async function fetchAssets(
	address: string,
): Promise<AssetData[] | null> {
	try {
		let chainId: number
		try {
			const { env } = await import('cloudflare:workers')
			const tempoEnv = env.VITE_TEMPO_ENV as string | undefined
			chainId =
				tempoEnv === 'moderato' ? 42431 : tempoEnv === 'devnet' ? 42430 : 4217
		} catch {
			chainId =
				TEMPO_ENV === 'moderato' ? 42431 : TEMPO_ENV === 'devnet' ? 42430 : 4217
		}

		const { QB } = await getIndexSupply()
		const qb = QB.withSignatures([TRANSFER_SIGNATURE])

		const transfersQuery = qb
			.selectFrom('transfer')
			.select(['address', 'from', 'to', 'amount'])
			.where('chain', '=', chainId)
			// biome-ignore lint/complexity/noBannedTypes: IDX library typing
			.where((eb: { or: Function }) =>
				eb.or([
					(eb as (...args: unknown[]) => unknown)('to', '=', address),
					(eb as (...args: unknown[]) => unknown)('from', '=', address),
				]),
			)

		const transfersResult = await transfersQuery.execute()

		const balances = new Map<string, bigint>()
		const addrLower = address.toLowerCase()

		for (const row of transfersResult) {
			const token = String(row.address).toLowerCase()
			const amount = BigInt(row.amount)
			const to = String(row.to).toLowerCase()
			const from = String(row.from).toLowerCase()

			if (to === addrLower) {
				balances.set(token, (balances.get(token) ?? 0n) + amount)
			}
			if (from === addrLower) {
				balances.set(token, (balances.get(token) ?? 0n) - amount)
			}
		}

		const tokensArray: Array<{
			token: Address.Address
			balance: bigint
			metadata: undefined
		}> = []
		for (const [token, balance] of balances.entries()) {
			if (balance !== 0n) {
				tokensArray.push({
					token: token as Address.Address,
					balance,
					metadata: undefined,
				})
			}
		}

		if (tokensArray.length === 0) return []

		const MAX_TOKENS = 50

		const assets: AssetData[] = tokensArray
			.slice(0, MAX_TOKENS)
			.map((row) => {
				const isUsd = HARDCODED_USD_TOKENS.has(row.token.toLowerCase())
				const valueUsd = isUsd
					? Number(row.balance) / 10 ** TIP20_DECIMALS
					: undefined

				return {
					address: row.token,
					metadata: undefined,
					balance: row.balance.toString(),
					valueUsd,
				}
			})
			.sort((a, b) => {
				const aHasBalance = a.balance && a.balance !== '0'
				const bHasBalance = b.balance && b.balance !== '0'
				if (aHasBalance && !bHasBalance) return -1
				if (!aHasBalance && bHasBalance) return 1

				const aIsUsd = a.valueUsd !== undefined
				const bIsUsd = b.valueUsd !== undefined

				if (aIsUsd && bIsUsd) {
					return (b.valueUsd ?? 0) - (a.valueUsd ?? 0)
				}

				if (aIsUsd) return -1
				if (bIsUsd) return 1

				return Number(BigInt(b.balance ?? '0') - BigInt(a.balance ?? '0'))
			})

		return assets
	} catch (error) {
		console.error('fetchAssets error:', error)
		return null
	}
}

import { createServerFn } from '@tanstack/react-start'
import type { Address } from 'ox'

type TokenMetadata = {
	address: string
	name: string
	symbol: string
	decimals: number
	currency: string
	priceUsd: number
}

type BalanceEntry = {
	token: string
	balance: string
	valueUsd: number
}

export type AssetData = {
	address: Address.Address
	metadata:
		| { name?: string; symbol?: string; decimals?: number; priceUsd?: number }
		| undefined
	balance: string | undefined
	valueUsd: number | undefined
}

export const fetchAssets = createServerFn({ method: 'GET' })
	.inputValidator((input: { address: string }) => input)
	.handler(async ({ data }): Promise<AssetData[] | null> => {
		const balancesApiUrl = process.env.BALANCES_API_URL
		if (!balancesApiUrl) return null

		const [tokensRes, balancesRes] = await Promise.all([
			fetch(`${balancesApiUrl}tokens`).catch(() => null),
			fetch(`${balancesApiUrl}balances/${data.address}`).catch(() => null),
		])

		if (!tokensRes?.ok || !balancesRes?.ok) return []

		const tokens = (await tokensRes.json()) as TokenMetadata[]
		const balances = (await balancesRes.json()) as BalanceEntry[]

		const balanceMap = new Map(
			balances.map((b) => [
				b.token.toLowerCase(),
				{ balance: b.balance, valueUsd: b.valueUsd },
			]),
		)

		return tokens
			.filter((token) => balanceMap.has(token.address.toLowerCase()))
			.map((token) => {
				const balanceData = balanceMap.get(token.address.toLowerCase())
				return {
					address: token.address as Address.Address,
					metadata: {
						name: token.name,
						symbol: token.symbol,
						decimals: token.decimals,
						priceUsd: token.priceUsd,
					},
					balance: balanceData?.balance,
					valueUsd: balanceData?.valueUsd,
				}
			})
	})

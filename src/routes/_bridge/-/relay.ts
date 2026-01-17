import type { Config } from 'wagmi'
import { type Address, erc20Abi, parseUnits } from 'viem'
import { sepolia, baseSepolia, tempoModerato } from 'wagmi/chains'
import {
	readContract,
	sendTransaction,
	waitForTransactionReceipt,
} from 'wagmi/actions'

export const RELAY_TESTNETS_API = 'https://api.testnets.relay.link'

export const TEMPO_MODERATO_CHAIN_ID = tempoModerato.id
export const PATH_USD_ADDRESS =
	'0x20c0000000000000000000000000000000000000' as const

export const SUPPORTED_ORIGIN_CHAINS = [
	{
		chainId: sepolia.id,
		name: sepolia.name,
		usdc: '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238' as const,
	},
	{
		chainId: baseSepolia.id,
		name: baseSepolia.name,
		usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const,
	},
] as const

export type OriginChain = (typeof SUPPORTED_ORIGIN_CHAINS)[number]

export type RelayQuote = {
	steps: Array<{
		id: string
		action: string
		description: string
		kind: 'transaction' | 'signature'
		requestId?: string
		items: Array<{
			status: 'incomplete' | 'complete'
			data: {
				from: Address
				to: Address
				data: `0x${string}`
				value: string
				chainId: number
				maxFeePerGas?: string
				maxPriorityFeePerGas?: string
				gas?: number
			}
			check?: {
				endpoint: string
				method: string
			}
		}>
	}>
	fees: {
		gas: { amount: string; amountUsd: string }
		relayer: { amount: string; amountUsd: string }
	}
	details: {
		currencyIn: {
			currency: { symbol: string; decimals: number }
			amount: string
			amountFormatted: string
			amountUsd: string
		}
		currencyOut: {
			currency: { symbol: string; decimals: number }
			amount: string
			amountFormatted: string
			amountUsd: string
		}
		rate: string
		timeEstimate: number
	}
}

export type RelayQuoteParams = {
	user: Address
	originChainId: number
	originCurrency: Address
	destinationChainId: number
	destinationCurrency: Address
	amount: string
	recipient?: Address
	tradeType?: 'EXACT_INPUT' | 'EXACT_OUTPUT'
	referrer?: string
}

export async function getRelayQuote(
	params: RelayQuoteParams,
): Promise<RelayQuote> {
	const response = await fetch(`${RELAY_TESTNETS_API}/quote`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			user: params.user,
			originChainId: params.originChainId,
			originCurrency: params.originCurrency,
			destinationChainId: params.destinationChainId,
			destinationCurrency: params.destinationCurrency,
			amount: params.amount,
			recipient: params.recipient ?? params.user,
			tradeType: params.tradeType ?? 'EXACT_INPUT',
			referrer: params.referrer ?? 'tempo.xyz',
			useExternalLiquidity: false,
		}),
	})

	if (!response.ok) {
		const error = (await response.json().catch(() => ({}))) as {
			message?: string
		}
		throw new Error(error.message ?? `Quote failed: ${response.status}`)
	}

	return response.json()
}

export type RelayIntentStatus = {
	status: 'pending' | 'success' | 'failure' | 'refund'
	inTxHashes?: string[]
	outTxHashes?: string[]
	details?: {
		currencyIn?: { amountFormatted: string }
		currencyOut?: { amountFormatted: string }
	}
}

export async function getRelayIntentStatus(
	requestId: string,
): Promise<RelayIntentStatus> {
	const response = await fetch(
		`${RELAY_TESTNETS_API}/intents/status/v3?requestId=${requestId}`,
	)

	if (!response.ok) {
		throw new Error(`Status check failed: ${response.status}`)
	}

	return response.json()
}

export async function checkAndApproveUSDC(
	config: Config,
	params: {
		chainId: number
		tokenAddress: Address
		owner: Address
		spender: Address
		amount: bigint
	},
): Promise<`0x${string}` | null> {
	const allowance = await readContract(config, {
		address: params.tokenAddress,
		abi: erc20Abi,
		functionName: 'allowance',
		args: [params.owner, params.spender],
		chainId: params.chainId,
	})

	if (allowance >= params.amount) {
		return null
	}

	const hash = await sendTransaction(config, {
		to: params.tokenAddress,
		data: encodeApproveData(params.spender, params.amount),
		chainId: params.chainId,
	})

	await waitForTransactionReceipt(config, { hash, chainId: params.chainId })

	return hash
}

function encodeApproveData(spender: Address, amount: bigint): `0x${string}` {
	const selector = '0x095ea7b3'
	const paddedSpender = spender.slice(2).padStart(64, '0')
	const paddedAmount = amount.toString(16).padStart(64, '0')
	return `${selector}${paddedSpender}${paddedAmount}` as `0x${string}`
}

export function parseUSDCAmount(amount: string): bigint {
	return parseUnits(amount, 6)
}

import { createWalletClient, http, parseUnits } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { tempoDevnet, tempoModerato } from 'viem/chains'
import { tempoActions } from 'viem/tempo'
import { tempoPresto } from '#lib/chains'
import { env } from 'cloudflare:workers'

const DONOTUSE_TOKEN = '0x20c00000000000000000000016c6514b53947fdc' as const

type EnvVars = {
	VITE_TEMPO_ENV: 'presto' | 'devnet' | 'moderato'
	ONRAMP_TREASURY_PRIVATE_KEY?: string
	PRESTO_RPC_AUTH?: string
	TEMPO_RPC_KEY?: string
}

function getEnv() {
	return env as unknown as EnvVars
}

function getChain() {
	const tempoEnv = getEnv().VITE_TEMPO_ENV
	if (tempoEnv === 'moderato') return tempoModerato
	if (tempoEnv === 'devnet') return tempoDevnet
	return tempoPresto
}

function getRpcUrl() {
	const e = getEnv()
	const baseUrl =
		e.VITE_TEMPO_ENV === 'moderato'
			? 'https://rpc.tempo.xyz'
			: 'https://rpc.presto.tempo.xyz'
	return e.TEMPO_RPC_KEY ? `${baseUrl}/${e.TEMPO_RPC_KEY}` : baseUrl
}

function getRpcFetchOptions() {
	const e = getEnv()
	if (e.VITE_TEMPO_ENV === 'moderato') return undefined

	if (e.PRESTO_RPC_AUTH) {
		return {
			headers: {
				Authorization: `Basic ${btoa(e.PRESTO_RPC_AUTH)}`,
			},
		}
	}

	return undefined
}

function getTreasuryClient() {
	const e = getEnv()
	if (!e.ONRAMP_TREASURY_PRIVATE_KEY) {
		throw new Error('ONRAMP_TREASURY_PRIVATE_KEY not configured')
	}

	const chain = getChain()
	const account = privateKeyToAccount(
		e.ONRAMP_TREASURY_PRIVATE_KEY as `0x${string}`,
	)

	return createWalletClient({
		account,
		chain,
		transport: http(getRpcUrl(), { fetchOptions: getRpcFetchOptions() }),
	}).extend(tempoActions())
}

export async function fulfillOnramp(
	recipientAddress: `0x${string}`,
	purchaseAmount: string,
) {
	const client = getTreasuryClient()
	const amount = parseUnits(purchaseAmount, 6)

	console.log('[Onramp Fulfill] Sending DONOTUSE:', {
		recipient: recipientAddress,
		amount: amount.toString(),
		token: DONOTUSE_TOKEN,
	})

	const { receipt } = await client.token.transferSync({
		amount,
		to: recipientAddress,
		token: DONOTUSE_TOKEN,
	})

	console.log('[Onramp Fulfill] Transfer complete:', {
		txHash: receipt.transactionHash,
		recipient: recipientAddress,
	})

	return receipt
}

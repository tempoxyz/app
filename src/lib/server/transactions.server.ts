'use server'

import { decodeAbiParameters } from 'viem'

type ApiTransaction = {
	hash: string
	from: string
	to: string | null
	value: string
	blockNumber: string
	timestamp?: string
}

const TEMPO_ENV = typeof process !== 'undefined' ? process.env.VITE_TEMPO_ENV : undefined

async function getTempoEnv(): Promise<string | undefined> {
	try {
		const { env } = await import('cloudflare:workers')
		return env.VITE_TEMPO_ENV as string | undefined
	} catch {
		return TEMPO_ENV
	}
}

function getRpcUrl(tempoEnv: string | undefined): string {
	return tempoEnv === 'moderato'
		? 'https://rpc.tempo.xyz'
		: 'https://rpc.presto.tempo.xyz'
}

function shouldUseAuth(tempoEnv: string | undefined): boolean {
	return tempoEnv !== 'moderato'
}

export type RpcLog = {
	address: `0x${string}`
	topics: `0x${string}`[]
	data: `0x${string}`
	blockNumber: string
	transactionHash: string
	transactionIndex: string
	blockHash: string
	logIndex: string
	removed: boolean
}

export type RpcTransactionReceipt = {
	transactionHash: string
	from: `0x${string}`
	to: `0x${string}` | null
	logs: RpcLog[]
	status: string
	blockNumber: string
	blockHash: string
	gasUsed: string
	effectiveGasPrice: string
	cumulativeGasUsed: string
	type: string
	contractAddress: `0x${string}` | null
}

export async function faucetFundAddress(address: string) {
	const { env } = await import('cloudflare:workers')
	const auth = env.PRESTO_RPC_AUTH as string | undefined
	if (!auth) {
		return { success: false as const, error: 'Auth not configured' }
	}

	try {
		const res = await fetch('https://rpc.presto.tempo.xyz', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Basic ${btoa(auth)}`,
			},
			body: JSON.stringify({
				jsonrpc: '2.0',
				id: 1,
				method: 'tempo_fundAddress',
				params: [address],
			}),
		})

		if (!res.ok) {
			return { success: false as const, error: `HTTP ${res.status}` }
		}

		const result = (await res.json()) as {
			result?: unknown
			error?: { message: string }
		}
		if (result.error) {
			return { success: false as const, error: result.error.message }
		}
		return { success: true as const }
	} catch (e) {
		return { success: false as const, error: String(e) }
	}
}

export async function fetchTransactionReceipts(hashes: string[]) {
	const tempoEnv = await getTempoEnv()
	const rpcUrl = getRpcUrl(tempoEnv)

	const { env } = await import('cloudflare:workers')
	const auth = env.PRESTO_RPC_AUTH as string | undefined
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
	}
	if (auth && shouldUseAuth(tempoEnv)) {
		headers.Authorization = `Basic ${btoa(auth)}`
	}

	const batchRequest = hashes.map((hash, i) => ({
		jsonrpc: '2.0',
		id: i + 1,
		method: 'eth_getTransactionReceipt',
		params: [hash],
	}))

	try {
		const response = await fetch(rpcUrl, {
			method: 'POST',
			headers,
			body: JSON.stringify(batchRequest),
		})
		if (!response.ok) {
			return { receipts: hashes.map((hash) => ({ hash, receipt: null })) }
		}
		const results = (await response.json()) as Array<{
			id: number
			result?: RpcTransactionReceipt
		}>

		const receipts = hashes.map((hash, i) => {
			const result = results.find((r) => r.id === i + 1)
			return { hash, receipt: result?.result ?? null }
		})
		return { receipts }
	} catch {
		return { receipts: hashes.map((hash) => ({ hash, receipt: null })) }
	}
}

export async function fetchBlockTimestamps(blockNumbers: string[]) {
	if (blockNumbers.length === 0) return { timestamps: {} }

	const tempoEnv = await getTempoEnv()
	const rpcUrl = getRpcUrl(tempoEnv)

	const { env } = await import('cloudflare:workers')
	const auth = env.PRESTO_RPC_AUTH as string | undefined
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
	}
	if (auth && shouldUseAuth(tempoEnv)) {
		headers.Authorization = `Basic ${btoa(auth)}`
	}

	try {
		const batchRequest = blockNumbers.map((blockNum, i) => ({
			jsonrpc: '2.0',
			id: i + 1,
			method: 'eth_getBlockByNumber',
			params: [blockNum, false],
		}))

		const response = await fetch(rpcUrl, {
			method: 'POST',
			headers,
			body: JSON.stringify(batchRequest),
		})

		if (!response.ok) return { timestamps: {} }

		const results = (await response.json()) as Array<{
			id: number
			result?: { timestamp?: string }
		}>

		const timestamps: Record<string, number> = {}
		for (let i = 0; i < blockNumbers.length; i++) {
			const result = results.find((r) => r.id === i + 1)
			if (result?.result?.timestamp) {
				timestamps[blockNumbers[i]] =
					Number.parseInt(result.result.timestamp, 16) * 1000
			}
		}
		return { timestamps }
	} catch {
		return { timestamps: {} }
	}
}

export async function fetchCurrentBlockNumber() {
	const tempoEnv = await getTempoEnv()
	const rpcUrl = getRpcUrl(tempoEnv)

	const { env } = await import('cloudflare:workers')
	const auth = env.PRESTO_RPC_AUTH as string | undefined
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
	}
	if (auth && shouldUseAuth(tempoEnv)) {
		headers.Authorization = `Basic ${btoa(auth)}`
	}

	try {
		const response = await fetch(rpcUrl, {
			method: 'POST',
			headers,
			body: JSON.stringify({
				jsonrpc: '2.0',
				id: 1,
				method: 'eth_blockNumber',
				params: [],
			}),
		})
		if (response.ok) {
			const json = (await response.json()) as { result?: string }
			if (json.result) {
				return { blockNumber: json.result }
			}
		}
		return { blockNumber: null }
	} catch {
		return { blockNumber: null }
	}
}

export async function fetchTransactionsFromExplorer(address: string) {
	const tempoEnv = await getTempoEnv()
	const explorerUrl =
		tempoEnv === 'presto'
			? 'https://explore.presto.tempo.xyz'
			: 'https://explore.mainnet.tempo.xyz'

	const { env } = await import('cloudflare:workers')
	const auth = env.PRESTO_RPC_AUTH as string | undefined
	const headers: Record<string, string> = {}
	if (auth) {
		headers.Authorization = `Basic ${btoa(auth)}`
	}

	try {
		const response = await fetch(
			`${explorerUrl}/api/address/${address}?include=all&limit=50`,
			{ headers },
		)
		if (!response.ok) {
			return {
				transactions: [] as ApiTransaction[],
				error: `HTTP ${response.status}`,
			}
		}
		const json = (await response.json()) as {
			transactions?: ApiTransaction[]
			error?: string | null
		}
		return {
			transactions: json.transactions ?? [],
			error: json.error ?? null,
		}
	} catch (e) {
		return { transactions: [] as ApiTransaction[], error: String(e) }
	}
}

export async function fetchTokenMetadata(addresses: string[]) {
	if (addresses.length === 0) return { tokens: {} }

	const tempoEnv = await getTempoEnv()
	const rpcUrl = getRpcUrl(tempoEnv)

	let auth: string | undefined
	try {
		const { env } = await import('cloudflare:workers')
		auth = env.PRESTO_RPC_AUTH as string | undefined
	} catch {
		// Not in Cloudflare Workers environment
	}

	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
	}
	if (auth && shouldUseAuth(tempoEnv)) {
		headers.Authorization = `Basic ${btoa(auth)}`
	}

	try {
		const batchRequest = addresses.flatMap((addr, i) => [
			{
				jsonrpc: '2.0',
				id: i * 2 + 1,
				method: 'eth_call',
				params: [{ to: addr, data: '0x06fdde03' }, 'latest'],
			},
			{
				jsonrpc: '2.0',
				id: i * 2 + 2,
				method: 'eth_call',
				params: [{ to: addr, data: '0x95d89b41' }, 'latest'],
			},
		])

		const res = await fetch(rpcUrl, {
			method: 'POST',
			headers,
			body: JSON.stringify(batchRequest),
		})
		if (!res.ok) return { tokens: {} }

		const results = (await res.json()) as Array<{
			id: number
			result?: `0x${string}`
		}>

		const decodeString = (hex: `0x${string}` | undefined): string => {
			if (!hex || hex === '0x') return ''
			try {
				const [value] = decodeAbiParameters([{ type: 'string' }], hex)
				return value
			} catch {
				return ''
			}
		}

		const tokens: Record<
			string,
			{ name: string; symbol: string; decimals: number }
		> = {}
		for (let i = 0; i < addresses.length; i++) {
			const nameResult = results.find((r) => r.id === i * 2 + 1)?.result
			const symbolResult = results.find((r) => r.id === i * 2 + 2)?.result
			const name = decodeString(nameResult)
			const symbol = decodeString(symbolResult)
			if (symbol) {
				tokens[addresses[i].toLowerCase()] = { name, symbol, decimals: 6 }
			}
		}

		return { tokens }
	} catch {
		return { tokens: {} }
	}
}

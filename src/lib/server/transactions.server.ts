import { createServerFn } from '@tanstack/react-start'
import { decodeAbiParameters } from 'viem'
import type { Address } from 'ox'
import {
	parseKnownEvents,
	type KnownEvent,
	type GetTokenMetadataFn,
} from '#comps/activity'

export type ApiTransaction = {
	hash: string
	from: string
	to: string | null
	value: string
	blockNumber: string
	timestamp?: string
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

export type ActivityItem = {
	hash: string
	events: KnownEvent[]
	timestamp?: number
	blockNumber?: bigint
}

const TEMPO_ENV = import.meta.env.VITE_TEMPO_ENV

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

export const faucetFundAddress = createServerFn({ method: 'POST' })
	.inputValidator((data: { address: string }) => data)
	.handler(async ({ data }) => {
		const { address } = data
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
	})

export const fetchTransactionReceipts = createServerFn({ method: 'POST' })
	.inputValidator((data: { hashes: string[] }) => data)
	.handler(async ({ data }) => {
		const setupStart = performance.now()
		const { hashes } = data
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
		console.log(
			`[perf]     fetchTransactionReceipts setup: ${(performance.now() - setupStart).toFixed(0)}ms`,
		)

		const batchRequest = hashes.map((hash, i) => ({
			jsonrpc: '2.0',
			id: i + 1,
			method: 'eth_getTransactionReceipt',
			params: [hash],
		}))

		try {
			const fetchStart = performance.now()
			const response = await fetch(rpcUrl, {
				method: 'POST',
				headers,
				body: JSON.stringify(batchRequest),
			})
			console.log(
				`[perf]     fetchTransactionReceipts fetch: ${(performance.now() - fetchStart).toFixed(0)}ms`,
			)
			if (!response.ok) {
				return { receipts: hashes.map((hash) => ({ hash, receipt: null })) }
			}
			const textStart = performance.now()
			const text = await response.text()
			console.log(
				`[perf]     fetchTransactionReceipts text(): ${(performance.now() - textStart).toFixed(0)}ms (${(text.length / 1024).toFixed(0)}KB)`,
			)
			const parseStart = performance.now()
			const results = JSON.parse(text) as Array<{
				id: number
				result?: RpcTransactionReceipt
			}>
			console.log(
				`[perf]     fetchTransactionReceipts JSON.parse: ${(performance.now() - parseStart).toFixed(0)}ms`,
			)

			const receipts = hashes.map((hash, i) => {
				const result = results.find((r) => r.id === i + 1)
				return { hash, receipt: result?.result ?? null }
			})
			return { receipts }
		} catch {
			return { receipts: hashes.map((hash) => ({ hash, receipt: null })) }
		}
	})

export const fetchBlockTimestamps = createServerFn({ method: 'POST' })
	.inputValidator((data: { blockNumbers: string[] }) => data)
	.handler(async ({ data }) => {
		const setupStart = performance.now()
		const { blockNumbers } = data
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
		console.log(
			`[perf]     fetchBlockTimestamps setup: ${(performance.now() - setupStart).toFixed(0)}ms`,
		)

		try {
			const batchRequest = blockNumbers.map((blockNum, i) => ({
				jsonrpc: '2.0',
				id: i + 1,
				method: 'eth_getBlockByNumber',
				params: [blockNum, false],
			}))

			const fetchStart = performance.now()
			const response = await fetch(rpcUrl, {
				method: 'POST',
				headers,
				body: JSON.stringify(batchRequest),
			})
			console.log(
				`[perf]     fetchBlockTimestamps fetch: ${(performance.now() - fetchStart).toFixed(0)}ms`,
			)

			if (!response.ok) return { timestamps: {} }

			const textStart = performance.now()
			const text = await response.text()
			console.log(
				`[perf]     fetchBlockTimestamps text(): ${(performance.now() - textStart).toFixed(0)}ms (${(text.length / 1024).toFixed(0)}KB)`,
			)
			const parseStart = performance.now()
			const results = JSON.parse(text) as Array<{
				id: number
				result?: { timestamp?: string }
			}>
			console.log(
				`[perf]     fetchBlockTimestamps JSON.parse: ${(performance.now() - parseStart).toFixed(0)}ms`,
			)

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
	})

export const fetchBlockData = createServerFn({ method: 'GET' })
	.inputValidator((data: { fromBlock: string; count: number }) => data)
	.handler(async ({ data }) => {
		const { fromBlock, count } = data
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

		const startBlock = BigInt(fromBlock)
		const requests = []
		for (let i = 0; i < count; i++) {
			const blockNum = startBlock - BigInt(i)
			if (blockNum > 0n) {
				requests.push({
					jsonrpc: '2.0',
					id: i + 1,
					method: 'eth_getBlockByNumber',
					params: [`0x${blockNum.toString(16)}`, false],
				})
			}
		}

		try {
			const response = await fetch(rpcUrl, {
				method: 'POST',
				headers,
				body: JSON.stringify(requests),
			})
			if (response.ok) {
				const results = (await response.json()) as Array<{
					id: number
					result?: { number: string; transactions: string[] }
				}>
				const blocks: Array<{ blockNumber: string; txCount: number }> = []
				for (const r of results) {
					if (r.result) {
						blocks.push({
							blockNumber: r.result.number,
							txCount: r.result.transactions?.length ?? 0,
						})
					}
				}
				return { blocks }
			}
			return { blocks: [] }
		} catch {
			return { blocks: [] }
		}
	})

export const fetchCurrentBlockNumber = createServerFn({
	method: 'GET',
}).handler(async () => {
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
})

export const fetchTransactionsFromExplorer = createServerFn({ method: 'GET' })
	.inputValidator((data: { address: string }) => data)
	.handler(async ({ data }) => {
		const setupStart = performance.now()
		const { address } = data
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
		console.log(
			`[perf]     fetchTransactionsFromExplorer setup: ${(performance.now() - setupStart).toFixed(0)}ms`,
		)

		try {
			const fetchStart = performance.now()
			const response = await fetch(
				`${explorerUrl}/api/address/${address}?include=all&limit=50`,
				{ headers },
			)
			console.log(
				`[perf]     fetchTransactionsFromExplorer fetch: ${(performance.now() - fetchStart).toFixed(0)}ms`,
			)
			if (!response.ok) {
				return {
					transactions: [] as ApiTransaction[],
					error: `HTTP ${response.status}`,
				}
			}
			const parseStart = performance.now()
			const json = (await response.json()) as {
				transactions?: ApiTransaction[]
				error?: string | null
			}
			console.log(
				`[perf]     fetchTransactionsFromExplorer json parse: ${(performance.now() - parseStart).toFixed(0)}ms`,
			)
			return {
				transactions: json.transactions ?? [],
				error: json.error ?? null,
			}
		} catch (e) {
			return { transactions: [] as ApiTransaction[], error: String(e) }
		}
	})

export const fetchBlockWithReceipts = createServerFn({ method: 'GET' })
	.inputValidator((data: { blockNumber: string }) => data)
	.handler(async ({ data }) => {
		const { blockNumber } = data
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
			const blockHex = `0x${BigInt(blockNumber).toString(16)}`

			const blockRes = await fetch(rpcUrl, {
				method: 'POST',
				headers,
				body: JSON.stringify({
					jsonrpc: '2.0',
					id: 1,
					method: 'eth_getBlockByNumber',
					params: [blockHex, true],
				}),
			})
			if (!blockRes.ok) {
				return {
					receipts: [] as RpcTransactionReceipt[],
					timestamp: undefined,
					error: `HTTP ${blockRes.status}`,
				}
			}
			const blockJson = (await blockRes.json()) as {
				result?: {
					transactions?: Array<{ hash: string }>
					timestamp?: string
				}
			}
			const txHashes =
				blockJson.result?.transactions?.map((tx) => tx.hash) ?? []
			const timestamp = blockJson.result?.timestamp
				? Number.parseInt(blockJson.result.timestamp, 16) * 1000
				: undefined

			if (txHashes.length === 0) {
				return { receipts: [], timestamp, error: null }
			}

			const batchRequest = txHashes.map((hash, i) => ({
				jsonrpc: '2.0',
				id: i + 1,
				method: 'eth_getTransactionReceipt',
				params: [hash],
			}))

			const receiptsRes = await fetch(rpcUrl, {
				method: 'POST',
				headers,
				body: JSON.stringify(batchRequest),
			})
			if (!receiptsRes.ok) {
				return { receipts: [], timestamp, error: `HTTP ${receiptsRes.status}` }
			}
			const receiptsJson = (await receiptsRes.json()) as Array<{
				id: number
				result?: RpcTransactionReceipt
			}>

			const receipts = txHashes
				.map((_, i) => receiptsJson.find((r) => r.id === i + 1)?.result)
				.filter((r): r is RpcTransactionReceipt => r !== undefined)

			return { receipts, timestamp, error: null }
		} catch (e) {
			return {
				receipts: [] as RpcTransactionReceipt[],
				timestamp: undefined,
				error: String(e),
			}
		}
	})

export const fetchTokenMetadata = createServerFn({ method: 'POST' })
	.inputValidator((data: { addresses: string[] }) => data)
	.handler(async ({ data }) => {
		const { addresses } = data
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
					params: [{ to: addr, data: '0x06fdde03' }, 'latest'], // name()
				},
				{
					jsonrpc: '2.0',
					id: i * 2 + 2,
					method: 'eth_call',
					params: [{ to: addr, data: '0x95d89b41' }, 'latest'], // symbol()
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
	})

export function convertRpcReceiptToViemReceipt(
	rpcReceipt: RpcTransactionReceipt,
): import('viem').TransactionReceipt {
	return {
		transactionHash: rpcReceipt.transactionHash as `0x${string}`,
		from: rpcReceipt.from,
		to: rpcReceipt.to,
		logs: rpcReceipt.logs.map((log) => ({
			address: log.address,
			topics:
				log.topics.length > 0
					? (log.topics as [`0x${string}`, ...`0x${string}`[]])
					: ([] as unknown as [`0x${string}`, ...`0x${string}`[]]),
			data: log.data,
			blockNumber: BigInt(log.blockNumber),
			transactionHash: log.transactionHash as `0x${string}`,
			transactionIndex: Number.parseInt(log.transactionIndex, 16),
			blockHash: log.blockHash as `0x${string}`,
			logIndex: Number.parseInt(log.logIndex, 16),
			removed: log.removed,
		})),
		status: rpcReceipt.status === '0x1' ? 'success' : 'reverted',
		blockNumber: BigInt(rpcReceipt.blockNumber),
		blockHash: rpcReceipt.blockHash as `0x${string}`,
		gasUsed: BigInt(rpcReceipt.gasUsed),
		effectiveGasPrice: BigInt(rpcReceipt.effectiveGasPrice),
		cumulativeGasUsed: BigInt(rpcReceipt.cumulativeGasUsed),
		type: rpcReceipt.type as '0x0' | '0x1' | '0x2',
		contractAddress: rpcReceipt.contractAddress,
		transactionIndex: 0,
		logsBloom: '0x' as `0x${string}`,
		root: undefined,
	}
}

export async function fetchTransactions(
	address: Address.Address,
	tokenMetadataMapPromise: Promise<
		Map<Address.Address, { decimals: number; symbol: string }>
	>,
): Promise<ActivityItem[]> {
	try {
		const result = await fetchTransactionsFromExplorer({ data: { address } })

		if (result.error || result.transactions.length === 0) {
			return []
		}

		const txData = result.transactions.slice(0, 50) as Array<{
			hash: string
			timestamp?: string
			blockNumber?: string
		}>
		const hashes = txData.map((tx) => tx.hash)

		const txsWithTimestamp = txData.filter((tx) => tx.timestamp).length
		console.log(`[perf]   explorer timestamps: ${txsWithTimestamp}/${txData.length} txs have timestamps`)

		// Get unique block numbers from explorer response for parallel fetch
		const blockNumbersFromExplorer = new Set<string>()
		for (const tx of txData) {
			if (tx.blockNumber) blockNumbersFromExplorer.add(tx.blockNumber)
		}

		// Fetch receipts and timestamps in parallel
		const parallelStart = performance.now()
		const [receiptsResult, timestampsResult] = await Promise.all([
			fetchTransactionReceipts({ data: { hashes } }),
			txsWithTimestamp < txData.length && blockNumbersFromExplorer.size > 0
				? fetchBlockTimestamps({
						data: { blockNumbers: Array.from(blockNumbersFromExplorer) },
					})
				: Promise.resolve({ timestamps: {} }),
		])
		console.log(`[perf]   parallel receipts+timestamps: ${(performance.now() - parallelStart).toFixed(0)}ms`)

		const blockTimestamps = new Map<string, number>()
		for (const [blockNum, ts] of Object.entries(timestampsResult.timestamps)) {
			blockTimestamps.set(blockNum, ts)
		}

		const tokenMetadataMap = await tokenMetadataMapPromise
		const getTokenMetadata: GetTokenMetadataFn = (tokenAddress) => {
			return tokenMetadataMap.get(tokenAddress)
		}

		const items: ActivityItem[] = []
		for (const { hash, receipt: rpcReceipt } of receiptsResult.receipts) {
			if (!rpcReceipt) continue
			try {
				const receipt = convertRpcReceiptToViemReceipt(rpcReceipt)
				const events = parseKnownEvents(receipt, {
					getTokenMetadata,
					viewer: address,
				})
				const txInfo = txData.find((tx) => tx.hash === hash)
				const timestamp = txInfo?.timestamp
					? Number(txInfo.timestamp) * 1000
					: blockTimestamps.get(rpcReceipt.blockNumber)
				const blockNumber = BigInt(rpcReceipt.blockNumber)
				items.push({ hash, events, timestamp, blockNumber })
			} catch {
				// Skip malformed receipts
			}
		}

		return items
	} catch {
		return []
	}
}

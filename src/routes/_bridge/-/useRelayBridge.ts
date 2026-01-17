import * as React from 'react'
import type { Address } from 'viem'
import { useConfig, useSwitchChain, useChainId } from 'wagmi'
import { useMutation, useQuery } from '@tanstack/react-query'
import { sendTransaction, waitForTransactionReceipt } from '@wagmi/core'
import {
	type OriginChain,
	type RelayQuote,
	SUPPORTED_ORIGIN_CHAINS,
	TEMPO_MODERATO_CHAIN_ID,
	PATH_USD_ADDRESS,
	getRelayQuote,
	getRelayIntentStatus,
	checkAndApproveUSDC,
	parseUSDCAmount,
} from './relay.ts'

export type BridgeStatus =
	| 'idle'
	| 'approving'
	| 'confirming'
	| 'bridging'
	| 'success'
	| 'error'

export function useRelayBridge(
	userAddress: Address | undefined,
	recipient?: Address,
) {
	const config = useConfig()
	const currentChainId = useChainId()
	const { mutateAsync: switchChainAsync } = useSwitchChain()

	const [selectedChain, setSelectedChain] = React.useState<OriginChain>(
		SUPPORTED_ORIGIN_CHAINS[0],
	)
	const [amount, setAmount] = React.useState('')
	const [requestId, setRequestId] = React.useState<string | null>(null)
	const [txHash, setTxHash] = React.useState<`0x${string}` | null>(null)
	const [status, setStatus] = React.useState<BridgeStatus>('idle')

	const quoteQuery = useMutation({
		mutationFn: async () => {
			if (!userAddress) throw new Error('Wallet not connected')
			const parsedAmount = Number(amount)
			if (!amount || parsedAmount <= 0) throw new Error('Enter a valid amount')

			return getRelayQuote({
				user: userAddress,
				recipient: recipient ?? userAddress,
				originChainId: selectedChain.chainId,
				originCurrency: selectedChain.usdc,
				destinationChainId: TEMPO_MODERATO_CHAIN_ID,
				destinationCurrency: PATH_USD_ADDRESS,
				amount: parseUSDCAmount(amount).toString(),
			})
		},
	})

	const intentStatusQuery = useQuery({
		queryKey: ['relay', 'intent-status', requestId],
		queryFn: () => {
			if (!requestId) throw new Error('No request ID')
			return getRelayIntentStatus(requestId)
		},
		enabled: !!requestId && status === 'bridging',
		refetchInterval: (query) => {
			const data = query.state.data
			if (
				data?.status === 'success' ||
				data?.status === 'failure' ||
				data?.status === 'refund'
			) {
				return false
			}
			return 2000
		},
		staleTime: 0,
	})

	React.useEffect(() => {
		if (!intentStatusQuery.data || status !== 'bridging') return

		const intentStatus = intentStatusQuery.data.status
		if (intentStatus === 'success') {
			setStatus('success')
			setRequestId(null)
		} else if (intentStatus === 'failure' || intentStatus === 'refund') {
			setStatus('error')
			setRequestId(null)
		}
	}, [intentStatusQuery.data, status])

	const bridgeMutation = useMutation({
		mutationFn: async (quote: RelayQuote) => {
			if (!userAddress) throw new Error('Wallet not connected')

			const depositStep = quote.steps.find((s) => s.id === 'deposit')
			if (!depositStep?.items[0]?.data)
				throw new Error('Invalid quote: no deposit step')

			const txData = depositStep.items[0].data

			if (currentChainId !== (selectedChain.chainId as number)) {
				setStatus('confirming')
				await switchChainAsync({ chainId: selectedChain.chainId as never })
			}

			setStatus('approving')
			await checkAndApproveUSDC(config, {
				chainId: selectedChain.chainId,
				tokenAddress: selectedChain.usdc,
				owner: userAddress,
				spender: txData.to,
				amount: parseUSDCAmount(amount),
			})

			setStatus('confirming')
			const hash = await sendTransaction(config, {
				to: txData.to,
				data: txData.data,
				value: BigInt(txData.value),
				// @ts-expect-error Bridge uses different wagmi config with different chains
				chainId: txData.chainId,
			})

			setTxHash(hash)
			setStatus('bridging')

			await waitForTransactionReceipt(config, {
				hash,
				// @ts-expect-error Bridge uses different wagmi config with different chains
				chainId: txData.chainId,
			})

			if (depositStep.requestId) setRequestId(depositStep.requestId)
			else setStatus('success')

			return { hash, requestId: depositStep.requestId }
		},
		onError: () => {
			setStatus('error')
		},
	})

	const quoteResetRef = React.useRef(quoteQuery.reset)
	const bridgeResetRef = React.useRef(bridgeMutation.reset)
	quoteResetRef.current = quoteQuery.reset
	bridgeResetRef.current = bridgeMutation.reset

	const reset = React.useCallback(() => {
		quoteResetRef.current()
		bridgeResetRef.current()
		setStatus('idle')
		setTxHash(null)
		setRequestId(null)
	}, [])

	const prevChainRef = React.useRef(selectedChain)
	React.useEffect(() => {
		if (prevChainRef.current !== selectedChain) {
			prevChainRef.current = selectedChain
			reset()
		}
	}, [selectedChain, reset])

	const outTxHash = intentStatusQuery.data?.outTxHashes?.[0] ?? null

	const error =
		quoteQuery.error?.message ??
		bridgeMutation.error?.message ??
		(intentStatusQuery.data?.status === 'failure' ? 'Bridge failed' : null) ??
		(intentStatusQuery.data?.status === 'refund' ? 'Bridge refunded' : null)

	return {
		originChains: SUPPORTED_ORIGIN_CHAINS,
		selectedChain,
		setSelectedChain,
		amount,
		setAmount,
		quote: quoteQuery.data ?? null,
		isQuoting: quoteQuery.isPending,
		status,
		error,
		intentStatus: intentStatusQuery.data ?? null,
		txHash,
		outTxHash,
		fetchQuote: () => quoteQuery.mutateAsync(),
		executeBridge: () => {
			if (quoteQuery.data) {
				return bridgeMutation.mutateAsync(quoteQuery.data)
			}
			return Promise.reject(new Error('No quote available'))
		},
		reset,
	}
}

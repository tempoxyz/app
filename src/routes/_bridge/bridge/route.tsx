import * as React from 'react'
import {
	type Connector,
	useConnect,
	useEnsName,
	useEnsAvatar,
	useConnection,
	useConnectors,
	useDisconnect,
	useReadContract,
} from 'wagmi'
import { erc20Abi, formatUnits } from 'viem'
import { createFileRoute } from '@tanstack/react-router'
import { cx } from '#lib/css'
import { useRelayBridge, type BridgeStatus } from '../-/useRelayBridge'
import type { OriginChain } from '../-/relay'
import LoaderIcon from '~icons/lucide/loader-2'
import CheckIcon from '~icons/lucide/check'
import ArrowRightIcon from '~icons/lucide/arrow-right'
import ExternalLinkIcon from '~icons/lucide/external-link'

export const Route = createFileRoute('/_bridge/bridge')({
	component: BridgeRoute,
})

function BridgeRoute() {
	return (
		<main className="flex flex-col items-center gap-6 py-8">
			<div className="flex flex-col gap-2 text-center">
				<h1 className="text-2xl font-semibold">Bridge to Tempo</h1>
				<p className="text-sm text-secondary">
					Swap USDC from Sepolia or Base Sepolia to PathUSD on Tempo Testnet
				</p>
			</div>
			<ConnectWallet />
		</main>
	)
}

function ConnectWallet() {
	const { isConnected } = useConnection()
	if (isConnected) return <BridgeForm />
	return <WalletOptions />
}

function WalletOptions() {
	const connectors = useConnectors()
	const { mutate: connect } = useConnect()

	return (
		<div className="flex flex-col gap-3 w-full max-w-md">
			<p className="text-sm text-tertiary text-center">
				Connect your wallet to start bridging
			</p>
			<div className="flex flex-col gap-2">
				{connectors.map((connector) => (
					<WalletOption
						key={connector.uid}
						connector={connector}
						onClick={() => connect({ connector })}
					/>
				))}
			</div>
		</div>
	)
}

function WalletOption({
	connector,
	onClick,
}: {
	connector: Connector
	onClick: () => void
}) {
	const [ready, setReady] = React.useState(false)

	React.useEffect(() => {
		;(async () => {
			const provider = await connector.getProvider()
			setReady(!!provider)
		})()
	}, [connector])

	return (
		<button
			type="button"
			disabled={!ready}
			onClick={onClick}
			className={cx(
				'flex items-center justify-center gap-2 h-12 px-4 text-sm font-medium rounded-xl',
				'bg-white/5 border border-card-border hover:border-accent/50 hover:bg-white/10',
				'cursor-pointer press-down transition-colors',
				!ready && 'opacity-50 cursor-not-allowed',
			)}
		>
			{connector.name}
		</button>
	)
}

function BridgeForm() {
	const { address } = useConnection()
	const { mutate: disconnect } = useDisconnect()
	const { data: ensName } = useEnsName({ address })
	const { data: ensAvatar } = useEnsAvatar({
		name: `${ensName}`,
		query: { enabled: ensName?.endsWith('.eth') },
	})

	const bridge = useRelayBridge(address)

	const { data: usdcBalanceRaw } = useReadContract({
		address: bridge.selectedChain.usdc,
		abi: erc20Abi,
		functionName: 'balanceOf',
		args: address ? [address] : undefined,
		chainId: bridge.selectedChain.chainId as never,
		query: { enabled: !!address },
	})

	const formattedBalance = usdcBalanceRaw
		? formatUnits(usdcBalanceRaw, 6)
		: null

	const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		let value = e.target.value.replace(/[^0-9.]/g, '')
		const parts = value.split('.')
		if (parts.length > 2) {
			value = `${parts[0]}.${parts.slice(1).join('')}`
		}
		if (parts.length === 2 && parts[1].length > 6) {
			value = `${parts[0]}.${parts[1].slice(0, 6)}`
		}
		bridge.setAmount(value)
	}

	const handleGetQuote = async () => {
		await bridge.fetchQuote()
	}

	const handleBridge = async () => {
		await bridge.executeBridge()
	}

	const isQuoting = bridge.isQuoting
	const isBridging = ['approving', 'confirming', 'bridging'].includes(
		bridge.status,
	)
	const isSuccess = bridge.status === 'success'
	const canGetQuote =
		bridge.amount && Number(bridge.amount) > 0 && !isQuoting && !isBridging
	const canBridge = bridge.quote && !isBridging && !isSuccess

	return (
		<div className="flex flex-col gap-4 w-full max-w-md">
			{/* Connected wallet */}
			<div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-card-border">
				<div className="flex items-center gap-2">
					{ensAvatar && (
						<img
							alt="ENS Avatar"
							src={ensAvatar}
							className="size-8 rounded-full"
						/>
					)}
					<span className="text-sm font-mono">
						{ensName ??
							(address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '')}
					</span>
				</div>
				<button
					type="button"
					onClick={() => disconnect()}
					className="text-xs text-tertiary hover:text-primary transition-colors cursor-pointer"
				>
					Disconnect
				</button>
			</div>

			{/* Chain selector */}
			<div className="flex flex-col gap-2">
				<span className="text-xs text-tertiary">From Chain</span>
				<div className="flex gap-2">
					{bridge.originChains.map((chain) => (
						<ChainButton
							key={chain.chainId}
							chain={chain}
							isSelected={chain.chainId === bridge.selectedChain.chainId}
							onClick={() => bridge.setSelectedChain(chain)}
							disabled={isBridging}
						/>
					))}
				</div>
			</div>

			{/* Amount input */}
			<div className="flex flex-col gap-2">
				<div className="flex items-center justify-between">
					<span className="text-xs text-tertiary">Amount (USDC)</span>
					{formattedBalance && (
						<button
							type="button"
							onClick={() => bridge.setAmount(formattedBalance)}
							className="text-xs text-accent hover:text-accent/80 cursor-pointer"
						>
							Max: {Number(formattedBalance).toFixed(2)} USDC
						</button>
					)}
				</div>
				<input
					type="text"
					inputMode="decimal"
					placeholder="0.00"
					value={bridge.amount}
					onChange={handleAmountChange}
					disabled={isBridging}
					className={cx(
						'h-14 px-4 rounded-xl bg-white/5 border border-card-border',
						'text-lg font-mono placeholder:text-tertiary',
						'focus:outline-none focus:border-accent transition-colors',
						isBridging && 'opacity-50 cursor-not-allowed',
					)}
				/>
			</div>

			{/* Destination info */}
			<div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-card-border">
				<div className="flex flex-col gap-0.5">
					<span className="text-xs text-tertiary">To</span>
					<span className="text-sm font-medium">Tempo Testnet</span>
				</div>
				<div className="flex flex-col gap-0.5 items-end">
					<span className="text-xs text-tertiary">Receive</span>
					<span className="text-sm font-medium">PathUSD</span>
				</div>
			</div>

			{/* Quote display */}
			{bridge.quote && <QuoteDetails quote={bridge.quote} />}

			{/* Error display */}
			{bridge.error && (
				<div className="p-3 rounded-xl bg-negative/10 border border-negative/30">
					<p className="text-sm text-negative">{bridge.error}</p>
				</div>
			)}

			{/* Success display */}
			{isSuccess && (
				<SuccessDisplay
					txHash={bridge.txHash}
					outTxHash={bridge.outTxHash}
					originChainId={bridge.selectedChain.chainId}
				/>
			)}

			{/* Action buttons */}
			<div className="flex flex-col gap-2">
				{!bridge.quote && !isSuccess && (
					<button
						type="button"
						onClick={handleGetQuote}
						disabled={!canGetQuote}
						className={cx(
							'flex items-center justify-center gap-2 h-14 rounded-xl text-sm font-medium transition-all',
							canGetQuote
								? 'bg-accent text-white hover:bg-accent/90 cursor-pointer press-down'
								: 'bg-accent/40 cursor-not-allowed',
						)}
					>
						{isQuoting ? (
							<>
								<LoaderIcon className="size-4 animate-spin" />
								Getting Quote...
							</>
						) : (
							'Get Quote'
						)}
					</button>
				)}

				{bridge.quote && !isSuccess && (
					<button
						type="button"
						onClick={handleBridge}
						disabled={!canBridge}
						className={cx(
							'flex items-center justify-center gap-2 h-14 rounded-xl text-sm font-medium transition-all',
							canBridge
								? 'bg-accent text-white hover:bg-accent/90 cursor-pointer press-down'
								: 'bg-accent/40 cursor-not-allowed',
						)}
					>
						{isBridging ? (
							<>
								<LoaderIcon className="size-4 animate-spin" />
								<StatusText status={bridge.status} />
							</>
						) : (
							<>
								Bridge to Tempo
								<ArrowRightIcon className="size-4" />
							</>
						)}
					</button>
				)}

				{isSuccess && (
					<button
						type="button"
						onClick={bridge.reset}
						className="flex items-center justify-center gap-2 h-14 rounded-xl bg-white/10 text-sm font-medium hover:bg-white/15 cursor-pointer press-down transition-colors"
					>
						Bridge More
					</button>
				)}
			</div>
		</div>
	)
}

function ChainButton({
	chain,
	isSelected,
	onClick,
	disabled,
}: {
	chain: OriginChain
	isSelected: boolean
	onClick: () => void
	disabled: boolean
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			className={cx(
				'flex-1 h-10 px-3 text-sm font-medium rounded-lg border transition-colors cursor-pointer press-down',
				isSelected
					? 'bg-accent border-accent'
					: 'bg-white/5 text-secondary hover:text-primary border-card-border hover:border-accent/50',
				disabled && 'opacity-50 cursor-not-allowed',
			)}
		>
			{chain.name}
		</button>
	)
}

function QuoteDetails({
	quote,
}: {
	quote: NonNullable<ReturnType<typeof useRelayBridge>['quote']>
}) {
	const { details, fees } = quote

	return (
		<div className="flex flex-col gap-2 p-3 rounded-xl bg-white/5 border border-card-border">
			<div className="flex items-center justify-between">
				<span className="text-xs text-tertiary">You send</span>
				<span className="text-sm font-medium">
					{details.currencyIn.amountFormatted}{' '}
					{details.currencyIn.currency.symbol}
				</span>
			</div>
			<div className="flex items-center justify-between">
				<span className="text-xs text-tertiary">You receive</span>
				<span className="text-sm font-medium text-positive">
					~{details.currencyOut.amountFormatted}{' '}
					{details.currencyOut.currency.symbol}
				</span>
			</div>
			<div className="flex items-center justify-between">
				<span className="text-xs text-tertiary">Rate</span>
				<span className="text-xs font-mono text-secondary">{details.rate}</span>
			</div>
			<div className="flex items-center justify-between">
				<span className="text-xs text-tertiary">Fees</span>
				<span className="text-xs font-mono text-secondary">
					~${fees.relayer.amountUsd}
				</span>
			</div>
			<div className="flex items-center justify-between">
				<span className="text-xs text-tertiary">Time estimate</span>
				<span className="text-xs text-secondary">~{details.timeEstimate}s</span>
			</div>
		</div>
	)
}

function StatusText({ status }: { status: BridgeStatus }) {
	switch (status) {
		case 'approving':
			return 'Approving USDC...'
		case 'confirming':
			return 'Confirm in wallet...'
		case 'bridging':
			return 'Bridging...'
		default:
			return 'Processing...'
	}
}

function SuccessDisplay({
	txHash,
	outTxHash,
	originChainId,
}: {
	txHash: `0x${string}` | null
	outTxHash: string | null
	originChainId: number
}) {
	const explorerUrl =
		originChainId === 11155111
			? 'https://sepolia.etherscan.io/tx'
			: 'https://sepolia.basescan.org/tx'

	return (
		<div className="flex flex-col gap-3 p-4 rounded-xl bg-positive/10 border border-positive/30">
			<div className="flex items-center gap-2 text-positive">
				<CheckIcon className="size-5" />
				<span className="font-medium">Bridge Successful!</span>
			</div>
			<div className="flex flex-col gap-2 text-sm">
				{txHash && (
					<a
						href={`${explorerUrl}/${txHash}`}
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center gap-1 text-accent hover:underline"
					>
						View origin transaction
						<ExternalLinkIcon className="size-3" />
					</a>
				)}
				{outTxHash && (
					<a
						href={`https://explore.tempo.xyz/tx/${outTxHash}`}
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center gap-1 text-accent hover:underline"
					>
						View Tempo transaction
						<ExternalLinkIcon className="size-3" />
					</a>
				)}
			</div>
		</div>
	)
}

import * as React from 'react'
import {
	type Connector,
	useConnect,
	useConnection,
	useConnectors,
	useDisconnect,
	useReadContract,
} from 'wagmi'
import { erc20Abi, formatUnits } from 'viem'
import { createFileRoute } from '@tanstack/react-router'
import { cx } from '#lib/css'
import { Section } from '#comps/Section'
import { useRelayBridge, type BridgeStatus } from '../-/useRelayBridge'
import type { OriginChain, RelayQuote } from '../-/relay'
import LoaderIcon from '~icons/lucide/loader-2'
import CheckIcon from '~icons/lucide/check'
import ArrowRightIcon from '~icons/lucide/arrow-right'
import ExternalLinkIcon from '~icons/lucide/external-link'
import WalletIcon from '~icons/lucide/wallet'
import LogOutIcon from '~icons/lucide/log-out'

export const Route = createFileRoute('/_bridge/bridge')({
	component: BridgeRoute,
})

function BridgeRoute() {
	const { isConnected } = useConnection()

	return (
		<div className="flex flex-col gap-2.5 w-full max-w-lg mx-auto px-4 py-6">
			<Section title="Bridge to Tempo" defaultOpen>
				{isConnected ? <BridgeForm /> : <WalletOptions />}
			</Section>
		</div>
	)
}

function WalletOptions() {
	const connectors = useConnectors()
	const { mutate: connect } = useConnect()

	return (
		<div className="flex flex-col gap-3 py-3">
			<p className="text-[13px] text-tertiary">
				Connect your wallet to bridge USDC to PathUSD on Tempo Testnet
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
				'flex items-center gap-3 h-[44px] px-3 text-[13px] font-medium rounded-lg',
				'bg-base-alt active:bg-base-alt/70 transition-colors',
				'cursor-pointer press-down focus-ring',
				!ready && 'opacity-50 cursor-not-allowed',
			)}
		>
			<WalletIcon className="size-[16px] text-tertiary" />
			{connector.name}
		</button>
	)
}

function BridgeForm() {
	const { address } = useConnection()
	const { mutate: disconnect } = useDisconnect()
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

	const isQuoting = bridge.isQuoting
	const isBridging = ['approving', 'confirming', 'bridging'].includes(
		bridge.status,
	)
	const isSuccess = bridge.status === 'success'
	const canGetQuote =
		bridge.amount && Number(bridge.amount) > 0 && !isQuoting && !isBridging
	const canBridge = bridge.quote && !isBridging && !isSuccess

	return (
		<div className="flex flex-col gap-4 py-3">
			{/* Connected wallet row */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<div className="flex items-center justify-center size-[28px] rounded-md bg-base-alt">
						<WalletIcon className="size-[14px] text-tertiary" />
					</div>
					<span className="text-[13px] font-mono text-secondary">
						{address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ''}
					</span>
				</div>
				<button
					type="button"
					onClick={() => disconnect()}
					className="flex items-center gap-1.5 text-[12px] text-tertiary hover:text-primary transition-colors cursor-pointer"
				>
					<LogOutIcon className="size-[12px]" />
					Disconnect
				</button>
			</div>

			{/* Chain selector */}
			<div className="flex flex-col gap-1.5">
				<span className="text-[12px] text-tertiary font-medium">
					From Chain
				</span>
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
			<div className="flex flex-col gap-1.5">
				<div className="flex items-center justify-between">
					<span className="text-[12px] text-tertiary font-medium">
						Amount (USDC)
					</span>
					{formattedBalance && (
						<button
							type="button"
							onClick={() => bridge.setAmount(formattedBalance)}
							className="text-[12px] text-accent hover:text-accent/80 cursor-pointer transition-colors"
						>
							Max: {Number(formattedBalance).toFixed(2)}
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
						'h-[44px] px-3 rounded-lg bg-base-alt text-[15px] font-mono',
						'placeholder:text-tertiary focus:outline-none focus-ring transition-colors',
						isBridging && 'opacity-50 cursor-not-allowed',
					)}
				/>
			</div>

			{/* Destination info */}
			<div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-base-alt">
				<div className="flex flex-col gap-0.5">
					<span className="text-[11px] text-tertiary">To</span>
					<span className="text-[13px] font-medium">Tempo Testnet</span>
				</div>
				<div className="flex flex-col gap-0.5 items-end">
					<span className="text-[11px] text-tertiary">Receive</span>
					<span className="text-[13px] font-medium">PathUSD</span>
				</div>
			</div>

			{/* Quote display */}
			{bridge.quote && <QuoteDetails quote={bridge.quote} />}

			{/* Error display */}
			{bridge.error && (
				<div className="px-3 py-2.5 rounded-lg bg-negative/10 border border-negative/20">
					<p className="text-[13px] text-negative">{bridge.error}</p>
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
			<div className="flex flex-col gap-2 pt-1">
				{!bridge.quote && !isSuccess && (
					<button
						type="button"
						onClick={() => bridge.fetchQuote()}
						disabled={!canGetQuote}
						className={cx(
							'flex items-center justify-center gap-2 h-[44px] rounded-lg text-[14px] font-medium transition-all',
							canGetQuote
								? 'bg-accent text-white active:bg-accent/90 cursor-pointer press-down'
								: 'bg-accent/40 text-white/60 cursor-not-allowed',
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
						onClick={() => bridge.executeBridge()}
						disabled={!canBridge}
						className={cx(
							'flex items-center justify-center gap-2 h-[44px] rounded-lg text-[14px] font-medium transition-all',
							canBridge
								? 'bg-accent text-white active:bg-accent/90 cursor-pointer press-down'
								: 'bg-accent/40 text-white/60 cursor-not-allowed',
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
						className="flex items-center justify-center gap-2 h-[44px] rounded-lg bg-base-alt text-[14px] font-medium active:bg-base-alt/70 cursor-pointer press-down transition-colors"
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
				'flex-1 h-[36px] px-3 text-[13px] font-medium rounded-lg transition-colors cursor-pointer press-down',
				isSelected
					? 'bg-accent text-white'
					: 'bg-base-alt text-secondary active:bg-base-alt/70',
				disabled && 'opacity-50 cursor-not-allowed',
			)}
		>
			{chain.name}
		</button>
	)
}

function QuoteDetails({ quote }: { quote: RelayQuote }) {
	const { details, fees } = quote

	return (
		<div className="flex flex-col gap-2 px-3 py-2.5 rounded-lg bg-base-alt">
			<QuoteRow
				label="You send"
				value={`${details.currencyIn.amountFormatted} ${details.currencyIn.currency.symbol}`}
			/>
			<QuoteRow
				label="You receive"
				value={`~${details.currencyOut.amountFormatted} ${details.currencyOut.currency.symbol}`}
				valueClassName="text-positive"
			/>
			<div className="h-px bg-card-border my-0.5" />
			<QuoteRow label="Rate" value={details.rate} mono />
			<QuoteRow label="Fees" value={`~$${fees.relayer.amountUsd}`} mono />
			<QuoteRow
				label="Time estimate"
				value={`~${details.timeEstimate}s`}
				mono
			/>
		</div>
	)
}

function QuoteRow({
	label,
	value,
	valueClassName,
	mono,
}: {
	label: string
	value: string
	valueClassName?: string
	mono?: boolean
}) {
	return (
		<div className="flex items-center justify-between">
			<span className="text-[12px] text-tertiary">{label}</span>
			<span
				className={cx(
					'text-[13px]',
					mono ? 'font-mono text-secondary' : 'font-medium',
					valueClassName,
				)}
			>
				{value}
			</span>
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
		<div className="flex flex-col gap-3 px-3 py-2.5 rounded-lg bg-positive/10 border border-positive/20">
			<div className="flex items-center gap-2 text-positive">
				<CheckIcon className="size-[16px]" />
				<span className="text-[14px] font-medium">Bridge Successful!</span>
			</div>
			<div className="flex flex-col gap-1.5">
				{txHash && (
					<a
						href={`${explorerUrl}/${txHash}`}
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center gap-1 text-[13px] text-accent hover:underline"
					>
						View origin transaction
						<ExternalLinkIcon className="size-[12px]" />
					</a>
				)}
				{outTxHash && (
					<a
						href={`https://explore.tempo.xyz/tx/${outTxHash}`}
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center gap-1 text-[13px] text-accent hover:underline"
					>
						View Tempo transaction
						<ExternalLinkIcon className="size-[12px]" />
					</a>
				)}
			</div>
		</div>
	)
}

import * as React from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from '@tanstack/react-router'
import {
	createClient,
	createPublicClient,
	erc20Abi,
	encodeFunctionData,
	formatUnits,
	http,
	parseUnits,
} from 'viem'
import { sendTransaction } from 'viem/actions'
import { Account as TempoAccount } from 'viem/tempo'
import { PublicKey } from 'ox'
import {
	useConnectorClient,
	useWriteContract,
	useWaitForTransactionReceipt,
} from 'wagmi'
import { getTempoChain } from '#wagmi.config'
import { TokenIcon } from '#comps/TokenIcon'
import { getAccessKeyEmoji } from '#comps/AccessKeysSection'
import { LiveRegion } from '#lib/a11y'
import type { AccessKeyData } from '#lib/access-keys-context'
import { cx } from '#lib/css'
import type { AssetData } from '#lib/server/assets.server'
import { faucetFundAddress } from '#lib/server/transactions.server'
import { useTranslation } from 'react-i18next'
import CheckIcon from '~icons/lucide/check'
import SendIcon from '~icons/lucide/send'
import XIcon from '~icons/lucide/x'
import ChevronDownIcon from '~icons/lucide/chevron-down'
import DropletIcon from '~icons/lucide/droplet'

function shortenAddress(address: string, chars = 4): string {
	return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`
}

function parseTransactionError(error: Error): string {
	const message = error.message || ''

	if (message.includes('SpendingLimitExceeded')) {
		return 'Spending limit exceeded for this access key'
	}
	if (message.includes('InsufficientBalance')) {
		return 'Insufficient balance'
	}
	if (message.includes('InvalidAccessKey')) {
		return 'Invalid or expired access key'
	}
	if (message.includes('AccessKeyExpired')) {
		return 'Access key has expired'
	}
	if (message.includes('UnauthorizedToken')) {
		return 'This token is not authorized for this access key'
	}
	if (message.includes('User rejected') || message.includes('user rejected')) {
		return 'Transaction cancelled'
	}
	if (message.includes('insufficient funds')) {
		return 'Insufficient funds for gas'
	}

	if ('shortMessage' in error && typeof error.shortMessage === 'string') {
		return error.shortMessage
	}

	const match = message.match(/reason:\s*([^\n]+)/i)
	if (match) {
		return match[1].trim()
	}

	return 'Transaction failed'
}

function formatAmount(value: string, decimals: number): string {
	const formatted = formatUnits(BigInt(value), decimals)
	const num = Number(formatted)
	if (num < 0.01 && num > 0) return '<0.01'
	return num.toLocaleString('en-US', {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	})
}

function formatUsdCompact(value: number): string {
	if (value === 0) return '$0'
	const absValue = Math.abs(value)
	const sign = value < 0 ? '-' : ''
	if (absValue >= 1_000_000_000) {
		return `${sign}$${(absValue / 1_000_000_000).toFixed(1)}b`
	}
	if (absValue >= 1_000_000) {
		return `${sign}$${(absValue / 1_000_000).toFixed(1)}m`
	}
	if (absValue >= 1_000) {
		return `${sign}$${(absValue / 1_000).toFixed(1)}k`
	}
	return `${sign}$${absValue.toFixed(2)}`
}

function BouncingDots() {
	return (
		<span className="inline-flex gap-[3px] animate-[fadeIn_0.2s_ease-out]">
			<span className="size-[5px] bg-current rounded-full animate-[pulse_1s_ease-in-out_infinite] opacity-60" />
			<span className="size-[5px] bg-current rounded-full animate-[pulse_1s_ease-in-out_0.15s_infinite] opacity-60" />
			<span className="size-[5px] bg-current rounded-full animate-[pulse_1s_ease-in-out_0.3s_infinite] opacity-60" />
		</span>
	)
}

function FillingDroplet() {
	const id = React.useId()
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className="text-accent"
			aria-hidden="true"
		>
			<title>Loading</title>
			<defs>
				<clipPath id={`droplet-clip-${id}`}>
					<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
				</clipPath>
			</defs>
			<path
				d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
				fill="none"
			/>
			<g clipPath={`url(#droplet-clip-${id})`}>
				<rect
					x="0"
					y="24"
					width="24"
					height="24"
					fill="currentColor"
					opacity="0.5"
					className="animate-fill-up-rect"
				/>
			</g>
		</svg>
	)
}

function SignWithSelector({
	accessKeys,
	selectedKey,
	onSelect,
	asset,
}: {
	accessKeys: AccessKeyData[]
	selectedKey: string | null
	onSelect: (keyId: string | null) => void
	asset: AssetData
}) {
	const { t } = useTranslation()
	const [isOpen, setIsOpen] = React.useState(false)
	const buttonRef = React.useRef<HTMLButtonElement>(null)
	const dropdownRef = React.useRef<HTMLDivElement>(null)

	React.useEffect(() => {
		function handleClickOutside(e: MouseEvent) {
			const target = e.target as Node
			if (
				buttonRef.current &&
				!buttonRef.current.contains(target) &&
				dropdownRef.current &&
				!dropdownRef.current.contains(target)
			) {
				setIsOpen(false)
			}
		}
		if (isOpen) {
			document.addEventListener('mousedown', handleClickOutside)
			return () => document.removeEventListener('mousedown', handleClickOutside)
		}
	}, [isOpen])

	const getKeyName = (keyId: string): string => {
		try {
			const stored = localStorage.getItem(`accessKey:${keyId.toLowerCase()}`)
			if (stored) {
				const data = JSON.parse(stored) as { name?: string }
				if (data.name) return data.name
			}
		} catch {
			/* ignore */
		}
		return `${keyId.slice(0, 6)}...${keyId.slice(-4)}`
	}

	const getKeyLimit = (key: AccessKeyData): string | null => {
		const tokenAddr = asset.address.toLowerCase()
		const remainingLimit = key.spendingLimits.get(tokenAddr)
		if (remainingLimit === undefined) return null
		if (remainingLimit <= 0n) return t('common.exhausted')
		const decimals = asset.metadata?.decimals ?? 6
		const formatted = formatUnits(remainingLimit, decimals)
		return `$${Number(formatted).toFixed(0)}`
	}

	const updatePosition = React.useCallback(() => {
		if (buttonRef.current) {
			const rect = buttonRef.current.getBoundingClientRect()
			const dropdownWidth = Math.max(rect.width, 160)
			return {
				top: rect.bottom + 4,
				left: rect.left,
				width: dropdownWidth,
			}
		}
		return null
	}, [])

	const [dropdownPos, setDropdownPos] = React.useState<{
		top: number
		left: number
		width: number
	} | null>(null)

	React.useEffect(() => {
		if (!isOpen) return
		const handleScroll = () => {
			const pos = updatePosition()
			if (pos) setDropdownPos(pos)
		}
		window.addEventListener('scroll', handleScroll, true)
		window.addEventListener('resize', handleScroll)
		return () => {
			window.removeEventListener('scroll', handleScroll, true)
			window.removeEventListener('resize', handleScroll)
		}
	}, [isOpen, updatePosition])

	const openDropdown = () => {
		const pos = updatePosition()
		if (pos) {
			setDropdownPos(pos)
			setIsOpen(true)
		}
	}

	return (
		<>
			<button
				ref={buttonRef}
				type="button"
				onClick={() => (isOpen ? setIsOpen(false) : openDropdown())}
				className={cx(
					'h-[34px] px-2 rounded-lg border bg-white/5 text-[12px] flex items-center gap-1.5 transition-colors cursor-pointer',
					isOpen
						? 'border-accent'
						: 'border-card-border hover:border-accent/50',
					selectedKey ? 'text-accent' : 'text-primary',
				)}
			>
				<span className="text-[13px] shrink-0">
					{selectedKey ? getAccessKeyEmoji(selectedKey) || '🔑' : '✨'}
				</span>
				<span className="truncate">
					{selectedKey ? getKeyName(selectedKey) : t('common.primary')}
				</span>
				<ChevronDownIcon
					className={cx(
						'size-2 text-tertiary transition-transform shrink-0',
						isOpen && 'rotate-180',
					)}
				/>
			</button>
			{isOpen &&
				dropdownPos &&
				createPortal(
					<div
						ref={dropdownRef}
						className="fixed bg-surface border border-card-border rounded-lg shadow-xl overflow-hidden py-1"
						style={{
							top: dropdownPos.top,
							left: dropdownPos.left,
							minWidth: dropdownPos.width,
							zIndex: 99999,
						}}
					>
						<button
							type="button"
							onClick={() => {
								onSelect(null)
								setIsOpen(false)
							}}
							className={cx(
								'w-full px-2 py-1.5 text-[12px] text-left hover:bg-base-alt transition-colors cursor-pointer flex items-center gap-1.5',
								!selectedKey ? 'text-accent' : 'text-primary',
							)}
						>
							<span className="text-[12px]">✨</span>
							<span>{t('common.primary')}</span>
						</button>
						{accessKeys.map((key) => {
							const limit = getKeyLimit(key)
							const isExhausted = limit === t('common.exhausted')
							const keyEmoji = getAccessKeyEmoji(key.keyId) || '🔑'
							const now = Date.now()
							const isExpired = key.expiry > 0 && key.expiry * 1000 < now
							const isAvailable = !isExhausted && !isExpired
							return (
								<button
									key={key.keyId}
									type="button"
									onClick={() => {
										if (isAvailable) {
											onSelect(key.keyId)
											setIsOpen(false)
										}
									}}
									disabled={!isAvailable}
									className={cx(
										'w-full px-2 py-1.5 text-[12px] text-left transition-colors flex items-center gap-1.5',
										!isAvailable
											? 'text-tertiary cursor-not-allowed opacity-50'
											: 'hover:bg-base-alt cursor-pointer',
										selectedKey === key.keyId ? 'text-accent' : 'text-primary',
									)}
								>
									<span
										className={cx(
											'size-[5px] rounded-full shrink-0',
											isAvailable ? 'bg-green-500' : 'bg-gray-500',
										)}
									/>
									<span className="text-[12px]">{keyEmoji}</span>
									<span className="truncate flex-1 min-w-0">
										{getKeyName(key.keyId)}
									</span>
									{limit && (
										<span
											className={cx(
												'text-[10px] tabular-nums shrink-0',
												isExhausted ? 'text-negative' : 'text-secondary',
											)}
										>
											{limit}
										</span>
									)}
								</button>
							)
						})}
					</div>,
					document.body,
				)}
		</>
	)
}

export function AssetRow({
	asset,
	address,
	isFaucetToken,
	isExpanded,
	onToggleSend,
	onSendComplete,
	onSendError,
	onOptimisticSend,
	onFaucetSuccess,
	isOwnProfile,
	initialRecipient,
	announce,
	accessKeys,
}: {
	asset: AssetData
	address: string
	isFaucetToken: boolean
	isExpanded: boolean
	onToggleSend: () => void
	onSendComplete: (symbol: string) => void
	onSendError?: () => void
	onOptimisticSend?: (tokenAddress: string, amount: bigint) => void
	onFaucetSuccess?: () => void
	isOwnProfile: boolean
	initialRecipient?: string
	announce: (message: string) => void
	accessKeys: AccessKeyData[]
}) {
	const { t } = useTranslation()
	const [recipient, setRecipient] = React.useState(initialRecipient ?? '')
	const [amount, setAmount] = React.useState('')
	const [sendState, setSendState] = React.useState<
		'idle' | 'sending' | 'sent' | 'error'
	>('idle')
	const [sendError, setSendError] = React.useState<string | null>(null)
	const [faucetState, setFaucetState] = React.useState<
		'idle' | 'loading' | 'done'
	>('idle')
	const [faucetInitialBalance, setFaucetInitialBalance] = React.useState<
		string | null
	>(null)
	const [pendingSendAmount, setPendingSendAmount] = React.useState<
		bigint | null
	>(null)
	const [selectedAccessKey, setSelectedAccessKey] = React.useState<
		string | null
	>(null)
	const recipientInputRef = React.useRef<HTMLInputElement>(null)
	const amountInputRef = React.useRef<HTMLInputElement>(null)
	const { data: connectorClient } = useConnectorClient()

	const {
		writeContract,
		data: txHash,
		isPending,
		error: writeError,
		reset: resetWrite,
	} = useWriteContract()
	const { isLoading: isConfirming, isSuccess: isConfirmed } =
		useWaitForTransactionReceipt({
			hash: txHash,
		})

	React.useEffect(() => {
		if (txHash && pendingSendAmount) {
			onOptimisticSend?.(asset.address, pendingSendAmount)
		}
	}, [txHash, pendingSendAmount, asset.address, onOptimisticSend])

	React.useEffect(() => {
		if (isConfirmed) {
			setSendState('sent')
			setPendingSendAmount(null)
			announce(t('a11y.transactionSent'))
			onSendComplete(asset.metadata?.symbol || shortenAddress(asset.address, 3))
			setTimeout(() => {
				setSendState('idle')
				setRecipient('')
				setAmount('')
				resetWrite()
			}, 1500)
		}
	}, [
		isConfirmed,
		asset.metadata?.symbol,
		asset.address,
		onSendComplete,
		resetWrite,
		announce,
		t,
	])

	React.useEffect(() => {
		if (writeError) {
			setSendState('error')
			setPendingSendAmount(null)
			setSendError(parseTransactionError(writeError))
			onSendError?.()
			setTimeout(() => {
				setSendState('idle')
				setSendError(null)
				resetWrite()
			}, 3000)
		}
	}, [writeError, resetWrite, onSendError])

	React.useEffect(() => {
		if (isPending || isConfirming) {
			setSendState('sending')
		}
	}, [isPending, isConfirming])

	React.useEffect(() => {
		if (faucetState !== 'loading' || faucetInitialBalance === null) return
		if (asset.balance !== faucetInitialBalance) {
			setFaucetState('done')
			setFaucetInitialBalance(null)
			announce(t('a11y.faucetSuccess'))
			setTimeout(() => setFaucetState('idle'), 1500)
		}
	}, [asset.balance, faucetState, faucetInitialBalance, announce, t])

	React.useEffect(() => {
		if (faucetState !== 'loading') return
		if (sendState === 'sending') return
		const interval = setInterval(() => {
			onFaucetSuccess?.()
		}, 1500)
		return () => clearInterval(interval)
	}, [faucetState, sendState, onFaucetSuccess])

	const handleFaucet = async () => {
		if (faucetState !== 'idle') return
		setFaucetInitialBalance(asset.balance ?? null)
		setFaucetState('loading')
		try {
			const result = await faucetFundAddress({ data: { address } })
			if (!result.success) {
				console.error('Faucet error:', result.error)
				setFaucetState('idle')
				setFaucetInitialBalance(null)
				return
			}
			onFaucetSuccess?.()
		} catch (err) {
			console.error('Faucet error:', err)
			setFaucetState('idle')
			setFaucetInitialBalance(null)
		}
	}

	React.useEffect(() => {
		if (isExpanded) {
			if (initialRecipient && amountInputRef.current) {
				amountInputRef.current.focus()
			} else if (recipientInputRef.current) {
				recipientInputRef.current.focus()
			}
		}
	}, [isExpanded, initialRecipient])

	React.useEffect(() => {
		if (!isExpanded) return
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				onToggleSend()
			}
		}
		document.addEventListener('keydown', handleKeyDown)
		return () => document.removeEventListener('keydown', handleKeyDown)
	}, [isExpanded, onToggleSend])

	const isValidRecipient = /^0x[a-fA-F0-9]{40}$/.test(recipient)
	const parsedAmount = React.useMemo(() => {
		if (!amount || !asset.metadata?.decimals) return 0n
		try {
			return parseUnits(amount, asset.metadata.decimals)
		} catch {
			return 0n
		}
	}, [amount, asset.metadata?.decimals])
	const isValidAmount =
		amount.length > 0 &&
		!Number.isNaN(Number(amount)) &&
		Number(amount) > 0 &&
		parsedAmount > 0n &&
		asset.balance !== undefined &&
		parsedAmount <= BigInt(asset.balance)
	const isValidSend = isValidRecipient && isValidAmount

	const handleSend = async () => {
		if (!isValidSend || parsedAmount === 0n) return

		if (selectedAccessKey && connectorClient?.chain) {
			setSendState('sending')
			try {
				const storedKey = localStorage.getItem(
					`accessKey:${selectedAccessKey.toLowerCase()}`,
				)
				if (!storedKey) {
					setSendError(t('a11y.accessKeyNotFound'))
					setSendState('error')
					setTimeout(() => {
						setSendState('idle')
						setSendError(null)
					}, 3000)
					return
				}

				const keyData = JSON.parse(storedKey) as { privateKey: string }
				const privateKeyBytes = Uint8Array.from(atob(keyData.privateKey), (c) =>
					c.charCodeAt(0),
				)

				const privateKey = await crypto.subtle.importKey(
					'pkcs8',
					privateKeyBytes,
					{ name: 'ECDSA', namedCurve: 'P-256' },
					true,
					['sign'],
				)

				const jwk = await crypto.subtle.exportKey('jwk', privateKey)
				const publicJwk = { ...jwk, d: undefined, key_ops: undefined }
				const cryptoPublicKey = await crypto.subtle.importKey(
					'jwk',
					publicJwk,
					{ name: 'ECDSA', namedCurve: 'P-256' },
					true,
					['verify'],
				)

				const publicKeyRaw = await crypto.subtle.exportKey(
					'raw',
					cryptoPublicKey,
				)
				const publicKey = PublicKey.from(new Uint8Array(publicKeyRaw))

				const accessKeyAccount = TempoAccount.fromWebCryptoP256(
					{ privateKey, publicKey },
					{ access: connectorClient.account },
				)

				const accessKeyClient = createClient({
					account: accessKeyAccount,
					chain: connectorClient.chain,
					transport: http(),
				})

				const hash = await sendTransaction(accessKeyClient, {
					to: asset.address as `0x${string}`,
					data: encodeFunctionData({
						abi: erc20Abi,
						functionName: 'transfer',
						args: [recipient as `0x${string}`, parsedAmount],
					}),
					feeToken: '0x20c000000000000000000000033abb6ac7d235e5',
				})

				const chain = getTempoChain()
				const publicClient = createPublicClient({ chain, transport: http() })
				await publicClient.waitForTransactionReceipt({ hash })

				setSendState('sent')
				setTimeout(() => {
					setSendState('idle')
					setRecipient('')
					setAmount('')
					setSelectedAccessKey(null)
					onSendComplete(
						asset.metadata?.symbol || shortenAddress(asset.address, 3),
					)
				}, 1500)
			} catch (e) {
				console.error('[AssetRow] Access key send error:', e)
				setSendError(
					e instanceof Error ? e.message : t('common.transactionFailed'),
				)
				setSendState('error')
				setTimeout(() => {
					setSendState('idle')
					setSendError(null)
				}, 3000)
			}
			return
		}

		setPendingSendAmount(parsedAmount)
		writeContract({
			address: asset.address as `0x${string}`,
			abi: erc20Abi,
			functionName: 'transfer',
			args: [recipient as `0x${string}`, parsedAmount],
		})
	}

	const handleToggle = () => {
		onToggleSend()
	}

	const handleMax = () => {
		if (asset.balance && asset.metadata?.decimals !== undefined) {
			setAmount(formatAmount(asset.balance, asset.metadata.decimals))
		}
	}

	const ROW_HEIGHT = 48

	if (isExpanded) {
		return (
			<form
				onSubmit={(e) => {
					e.preventDefault()
					handleSend()
				}}
				className="flex flex-col gap-2 px-1 py-2 rounded-xl hover:glass-thin transition-all"
			>
				<div className="flex items-center gap-1.5 px-1">
					<div className="flex items-center flex-1 h-[34px] rounded-lg border border-card-border bg-white/5 focus-within:border-accent">
						<input
							ref={recipientInputRef}
							type="text"
							value={recipient}
							onChange={(e) => setRecipient(e.target.value)}
							placeholder="0x..."
							className="flex-1 min-w-0 h-full px-2 bg-transparent text-[13px] text-primary font-mono placeholder:text-tertiary focus:outline-none"
						/>
					</div>
				</div>
				<div className="flex items-center gap-1.5 px-1">
					<div className="flex items-center flex-1 h-[34px] rounded-lg border border-card-border bg-white/5 focus-within:border-accent">
						<TokenIcon
							address={asset.address}
							className="size-[16px] shrink-0 ml-1.5 brightness-125"
						/>
						<input
							ref={amountInputRef}
							type="text"
							inputMode="decimal"
							value={amount}
							onChange={(e) => setAmount(e.target.value)}
							placeholder="0.00"
							className="flex-1 min-w-[40px] h-full px-1.5 bg-transparent text-[15px] text-primary font-mono placeholder:text-tertiary focus:outline-none"
						/>
						<span className="text-[11px] text-tertiary font-medium shrink-0 pr-1">
							{asset.metadata?.symbol || '???'}
						</span>
						<button
							type="button"
							onClick={handleMax}
							className="h-full px-2 border-l border-card-border text-[10px] font-medium text-accent hover:bg-base-alt cursor-pointer transition-colors shrink-0"
						>
							MAX
						</button>
					</div>
					<SignWithSelector
						accessKeys={accessKeys}
						selectedKey={selectedAccessKey}
						onSelect={setSelectedAccessKey}
						asset={asset}
					/>
					<button
						type="submit"
						aria-label={t('common.send')}
						aria-busy={sendState === 'sending'}
						className={cx(
							'size-[34px] rounded-lg press-down transition-colors flex items-center justify-center shrink-0 focus-ring',
							sendState === 'sent'
								? 'bg-positive text-white cursor-default'
								: sendState === 'error'
									? 'bg-negative text-white cursor-default'
									: isValidSend && sendState === 'idle'
										? 'bg-accent text-white hover:bg-accent/90 cursor-pointer'
										: 'bg-base-alt text-tertiary cursor-not-allowed',
						)}
						disabled={!isValidSend || sendState !== 'idle'}
					>
						{sendState === 'sending' ? (
							<BouncingDots />
						) : sendState === 'sent' ? (
							<CheckIcon className="size-[14px]" />
						) : sendState === 'error' ? (
							<XIcon className="size-[14px]" />
						) : (
							<SendIcon className="size-[14px]" />
						)}
					</button>
				</div>
				{sendError && (
					<div className="pl-[30px] text-[10px] text-negative truncate">
						{sendError}
					</div>
				)}
			</form>
		)
	}

	return (
		<div
			className="group grid grid-cols-[1fr_auto_auto] sm:grid-cols-[1fr_auto_60px_auto] md:grid-cols-[1fr_auto_60px_90px_auto] gap-1 rounded-xl hover:glass-thin transition-all"
			style={{ height: ROW_HEIGHT }}
		>
			<span className="pl-1 pr-2 text-primary flex items-center gap-1.5">
				<TokenIcon
					address={asset.address}
					className="size-[36px] transition-transform group-hover:scale-105 mx-0.5"
				/>
				<span className="flex flex-col min-w-0">
					<span className="truncate font-medium">
						{asset.metadata?.name || shortenAddress(asset.address)}
					</span>
					<span className="text-[11px] text-tertiary font-mono truncate">
						{asset.metadata?.symbol || shortenAddress(asset.address, 3)}
					</span>
				</span>
			</span>
			<span
				className="px-2 flex items-center justify-end overflow-hidden min-w-0 relative"
				title={
					asset.balance !== undefined && asset.metadata?.decimals !== undefined
						? formatAmount(asset.balance, asset.metadata.decimals)
						: undefined
				}
			>
				<span
					className={cx(
						'flex flex-col items-end min-w-0 transition-opacity duration-300',
						faucetState === 'loading' && 'opacity-15',
					)}
				>
					<span className="text-primary font-sans text-[14px] tabular-nums text-right truncate max-w-full">
						{asset.balance !== undefined &&
						asset.metadata?.decimals !== undefined ? (
							formatAmount(asset.balance, asset.metadata.decimals)
						) : (
							<span className="text-tertiary">…</span>
						)}
					</span>
					<span className="text-secondary text-[11px] md:hidden whitespace-nowrap">
						{asset.valueUsd !== undefined ? (
							formatUsdCompact(asset.valueUsd)
						) : (
							<span className="text-tertiary">−</span>
						)}
					</span>
				</span>
				{faucetState === 'loading' && (
					<span className="absolute inset-0 flex items-center justify-end pr-2">
						<BouncingDots />
					</span>
				)}
			</span>
			<span className="pl-1 hidden sm:flex items-center justify-start">
				<span className="text-[9px] font-medium text-tertiary bg-base-alt px-1 py-0.5 rounded font-mono whitespace-nowrap">
					{asset.metadata?.symbol || shortenAddress(asset.address, 3)}
				</span>
			</span>
			<span className="px-2 text-secondary hidden md:flex items-center justify-end">
				<span className="font-sans tabular-nums whitespace-nowrap">
					{asset.valueUsd !== undefined ? (
						formatUsdCompact(asset.valueUsd)
					) : (
						<span className="text-tertiary">−</span>
					)}
				</span>
			</span>
			<span className="pr-2 flex items-center justify-end gap-0.5 relative z-10">
				{isOwnProfile && (
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation()
							if (isFaucetToken) handleFaucet()
						}}
						disabled={faucetState !== 'idle' || !isFaucetToken}
						className={cx(
							'flex items-center justify-center size-[24px] rounded-md transition-colors focus-ring',
							isFaucetToken
								? 'hover:bg-accent/10 cursor-pointer'
								: 'opacity-0 pointer-events-none',
						)}
						aria-label={isFaucetToken ? t('common.requestTokens') : undefined}
						aria-hidden={!isFaucetToken}
					>
						{faucetState === 'done' ? (
							<CheckIcon className="size-[14px] text-positive" />
						) : faucetState === 'loading' ? (
							<FillingDroplet />
						) : (
							<DropletIcon className="size-[14px] text-tertiary hover:text-accent transition-colors" />
						)}
					</button>
				)}
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation()
						handleToggle()
					}}
					className="flex items-center justify-center size-[28px] rounded-md hover:bg-accent/10 cursor-pointer transition-all opacity-60 group-hover:opacity-100 focus-ring"
					aria-label={t('common.send')}
				>
					<SendIcon className="size-[14px] text-tertiary hover:text-accent transition-colors" />
				</button>
			</span>
		</div>
	)
}

export function HoldingsTable({
	assets,
	address,
	onFaucetSuccess,
	onSendSuccess,
	onOptimisticSend,
	onOptimisticClear,
	isOwnProfile,
	connectedAddress,
	initialSendTo,
	sendingToken,
	onSendingTokenChange,
	announce,
	faucetTokenAddresses,
	accessKeys,
}: {
	assets: AssetData[]
	address: string
	onFaucetSuccess?: () => void
	onSendSuccess?: () => void
	onOptimisticSend?: (tokenAddress: string, amount: bigint) => void
	onOptimisticClear?: (tokenAddress: string) => void
	isOwnProfile: boolean
	connectedAddress?: string
	initialSendTo?: string
	sendingToken: string | null
	onSendingTokenChange: (token: string | null) => void
	announce: (message: string) => void
	faucetTokenAddresses: Set<string>
	accessKeys: AccessKeyData[]
}) {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const [toastMessage, setToastMessage] = React.useState<string | null>(null)

	React.useEffect(() => {
		if (toastMessage) {
			const timeout = setTimeout(() => setToastMessage(null), 3000)
			return () => clearTimeout(timeout)
		}
	}, [toastMessage])

	if (assets.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-6 gap-2">
				<div className="size-10 rounded-full bg-base-alt flex items-center justify-center">
					<svg
						className="size-5 text-tertiary"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						aria-hidden="true"
					>
						<title>No assets icon</title>
						<circle cx="12" cy="12" r="10" />
						<path d="M12 6v12M6 12h12" strokeLinecap="round" />
					</svg>
				</div>
				<p className="text-[13px] text-secondary">
					{t('portfolio.noAssetsFound')}
				</p>
			</div>
		)
	}

	const sortedAssets = assets.toSorted((a, b) => {
		const aIsFaucet = faucetTokenAddresses.has(a.address.toLowerCase())
		const bIsFaucet = faucetTokenAddresses.has(b.address.toLowerCase())
		if (aIsFaucet && !bIsFaucet) return -1
		if (!aIsFaucet && bIsFaucet) return 1
		return (b.valueUsd ?? 0) - (a.valueUsd ?? 0)
	})

	return (
		<>
			<div className="text-[13px] -mx-2 flex flex-col">
				{sortedAssets.map((asset) => (
					<AssetRow
						key={asset.address}
						asset={asset}
						address={address}
						isFaucetToken={faucetTokenAddresses.has(
							asset.address.toLowerCase(),
						)}
						isExpanded={sendingToken === asset.address}
						onToggleSend={() => {
							if (!isOwnProfile) {
								if (connectedAddress) {
									navigate({
										to: '/$address',
										params: { address: connectedAddress },
										search: {
											sendTo: address,
											token: asset.address,
										},
									})
								} else {
									navigate({ to: '/' })
								}
								return
							}
							onSendingTokenChange(
								sendingToken === asset.address ? null : asset.address,
							)
						}}
						onSendComplete={(symbol) => {
							setToastMessage(`Sent ${symbol} successfully`)
							onOptimisticClear?.(asset.address)
							onSendSuccess?.()
							setTimeout(() => onSendingTokenChange(null), 1500)
						}}
						onSendError={() => {
							onOptimisticClear?.(asset.address)
						}}
						onOptimisticSend={onOptimisticSend}
						onFaucetSuccess={onFaucetSuccess}
						isOwnProfile={isOwnProfile}
						initialRecipient={
							asset.address === sendingToken ? initialSendTo : undefined
						}
						announce={announce}
						accessKeys={accessKeys}
					/>
				))}
			</div>
			{toastMessage &&
				createPortal(
					<LiveRegion>
						<div className="fixed bottom-4 right-4 z-50 bg-surface rounded-lg shadow-[0_4px_24px_rgba(0,0,0,0.12)] overflow-hidden flex">
							<div className="w-1 bg-positive shrink-0" />
							<div className="flex items-center gap-1.5 px-3 py-2">
								<CheckIcon className="size-[14px] text-positive" />
								<span className="text-[13px] text-primary font-medium">
									{toastMessage}
								</span>
							</div>
						</div>
					</LiveRegion>,
					document.body,
				)}
		</>
	)
}

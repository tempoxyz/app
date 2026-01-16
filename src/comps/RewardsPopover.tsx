import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { formatUnits } from 'viem'
import { useAccount } from 'wagmi'
import { Hooks } from 'wagmi/tempo'
import { cx } from '#lib/css'
import type { AssetData } from '#lib/server/assets.server'
import GiftIcon from '~icons/lucide/gift'
import CheckIcon from '~icons/lucide/check'
import LoaderIcon from '~icons/lucide/loader-2'
import UserIcon from '~icons/lucide/user'
import UsersIcon from '~icons/lucide/users'
import XIcon from '~icons/lucide/x'

type RewardsView = 'main' | 'delegate'

function formatTokenAmount(value: bigint, decimals: number): string {
	const formatted = formatUnits(value, decimals)
	const num = Number(formatted)
	if (num === 0) return '0'
	if (num < 0.001 && num > 0) return '<0.001'
	if (num < 1) return num.toFixed(4)
	if (num < 1000) return num.toFixed(2)
	return num.toLocaleString('en-US', {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	})
}

export function RewardsPopoverButton(props: {
	assets: AssetData[]
	accountAddress: string
}) {
	const { assets, accountAddress } = props
	const { t } = useTranslation()
	const account = useAccount()
	const [isOpen, setIsOpen] = React.useState(false)
	const buttonRef = React.useRef<HTMLButtonElement>(null)
	const popoverRef = React.useRef<HTMLDivElement>(null)

	const isOwnProfile =
		account.address?.toLowerCase() === accountAddress.toLowerCase()

	const assetsWithBalance = assets.filter(
		(a) => a.balance && a.balance !== '0',
	)

	const activeToken = assetsWithBalance[0]?.address ?? null

	// Get reward info to show indicator
	const rewardInfo = Hooks.reward.useUserRewardInfo({
		token: (activeToken ?? '0x0') as `0x${string}`,
		account: accountAddress as `0x${string}`,
	})

	const pendingAmount = rewardInfo.data?.rewardBalance ?? 0n
	const hasPendingRewards = pendingAmount > 0n

	// Close popover when clicking outside
	React.useEffect(() => {
		if (!isOpen) return

		function handleClickOutside(event: MouseEvent) {
			if (
				popoverRef.current &&
				!popoverRef.current.contains(event.target as Node) &&
				buttonRef.current &&
				!buttonRef.current.contains(event.target as Node)
			) {
				setIsOpen(false)
			}
		}

		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [isOpen])

	// Close on escape
	React.useEffect(() => {
		if (!isOpen) return

		function handleEscape(event: KeyboardEvent) {
			if (event.key === 'Escape') {
				setIsOpen(false)
			}
		}

		document.addEventListener('keydown', handleEscape)
		return () => document.removeEventListener('keydown', handleEscape)
	}, [isOpen])

	if (!activeToken) return null

	return (
		<div className="relative">
			<button
				ref={buttonRef}
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className={cx(
					'flex items-center justify-center size-[32px] sm:size-[28px] rounded-full sm:rounded-md bg-base-alt hover:bg-base-alt/70 cursor-pointer press-down transition-colors shrink-0 focus-ring',
					isOpen && 'bg-accent/20',
				)}
				aria-label={t('rewards.title')}
				aria-expanded={isOpen}
			>
				<GiftIcon
					className={cx(
						'size-[14px]',
						hasPendingRewards ? 'text-accent' : 'text-tertiary',
					)}
				/>
			</button>

			{isOpen && (
				<div
					ref={popoverRef}
					className="absolute top-full right-0 mt-2 w-[320px] rounded-xl border border-card-border bg-card shadow-lg z-50"
				>
					<RewardsPopoverContent
						assets={assetsWithBalance}
						accountAddress={accountAddress}
						activeToken={activeToken}
						isOwnProfile={isOwnProfile}
						onClose={() => setIsOpen(false)}
					/>
				</div>
			)}
		</div>
	)
}

function RewardsPopoverContent(props: {
	assets: AssetData[]
	accountAddress: string
	activeToken: string
	isOwnProfile: boolean
	onClose: () => void
}) {
	const { assets, accountAddress, activeToken, isOwnProfile, onClose } = props
	const { t } = useTranslation()
	const [currentView, setCurrentView] = React.useState<RewardsView>('main')

	const rewardInfo = Hooks.reward.useUserRewardInfo({
		token: activeToken as `0x${string}`,
		account: accountAddress as `0x${string}`,
	})

	const isOptedIn =
		rewardInfo.data?.rewardRecipient &&
		rewardInfo.data.rewardRecipient !==
			'0x0000000000000000000000000000000000000000'

	const isSelfDelegated =
		isOptedIn &&
		rewardInfo.data?.rewardRecipient?.toLowerCase() ===
			accountAddress.toLowerCase()

	return (
		<div className="overflow-hidden">
			{/* Header */}
			<div className="flex items-center justify-between px-3 py-2 border-b border-card-border">
				{currentView === 'main' ? (
					<span className="text-[13px] font-medium text-primary">
						{t('rewards.title')}
					</span>
				) : (
					<button
						type="button"
						onClick={() => setCurrentView('main')}
						className="text-[13px] font-medium text-accent hover:text-accent/80 transition-colors cursor-pointer"
					>
						← {t('rewards.title')}
					</button>
				)}
				<div className="flex items-center gap-1.5">
					{currentView === 'main' && isOwnProfile && (
						<button
							type="button"
							onClick={() => setCurrentView('delegate')}
							className={cx(
								'flex items-center justify-center size-5 rounded-md transition-colors cursor-pointer',
								isOptedIn
									? 'text-secondary hover:text-primary hover:bg-base-alt'
									: 'text-warning hover:bg-warning/10',
							)}
							aria-label={t('rewards.rewardRecipient')}
						>
							{isSelfDelegated ? (
								<UserIcon className="size-3.5" />
							) : (
								<UsersIcon className="size-3.5" />
							)}
						</button>
					)}
					<button
						type="button"
						onClick={onClose}
						className="flex items-center justify-center size-5 rounded-md hover:bg-base-alt transition-colors cursor-pointer"
						aria-label={t('a11y.close')}
					>
						<XIcon className="size-3 text-tertiary" />
					</button>
				</div>
			</div>

			{/* Content */}
			<div className="relative overflow-hidden">
				<div
					className={cx(
						'transition-transform duration-200 ease-out',
						currentView === 'main'
							? 'translate-x-0'
							: '-translate-x-full absolute inset-0 pointer-events-none',
					)}
				>
					<MainView
						assets={assets}
						accountAddress={accountAddress}
						activeToken={activeToken}
						isOwnProfile={isOwnProfile}
					/>
				</div>

				<div
					className={cx(
						'transition-transform duration-200 ease-out',
						currentView === 'delegate'
							? 'translate-x-0'
							: 'translate-x-full absolute inset-0 pointer-events-none',
					)}
				>
					<DelegateView
						accountAddress={accountAddress}
						activeToken={activeToken}
						isOwnProfile={isOwnProfile}
						onBack={() => setCurrentView('main')}
					/>
				</div>
			</div>
		</div>
	)
}

function MainView(props: {
	assets: AssetData[]
	accountAddress: string
	activeToken: string
	isOwnProfile: boolean
}) {
	const { assets, accountAddress, activeToken, isOwnProfile } = props
	const { t } = useTranslation()

	const activeAsset = assets.find(
		(a) => a.address.toLowerCase() === activeToken.toLowerCase(),
	)
	const decimals = activeAsset?.metadata?.decimals ?? 6

	const rewardInfo = Hooks.reward.useUserRewardInfo({
		token: activeToken as `0x${string}`,
		account: accountAddress as `0x${string}`,
	})

	const claimRewards = Hooks.reward.useClaimSync()

	const pendingAmount = rewardInfo.data?.rewardBalance ?? 0n
	const hasPendingRewards = pendingAmount > 0n

	const handleClaim = async () => {
		if (!hasPendingRewards || !isOwnProfile) return
		try {
			await claimRewards.mutateAsync({
				token: activeToken as `0x${string}`,
			})
			rewardInfo.refetch()
		} catch (error) {
			console.error('Claim failed:', error)
		}
	}

	const isLoading = rewardInfo.isLoading

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-6">
				<LoaderIcon className="size-4 animate-spin text-tertiary" />
			</div>
		)
	}

	return (
		<div className="p-3 flex flex-col gap-3">
			{/* Pending Rewards */}
			<div className="flex items-center justify-between">
				<div>
					<p className="text-[11px] text-tertiary">
						{t('rewards.pendingRewards')}
					</p>
					<p className="text-[15px] font-medium text-primary tabular-nums">
						{formatTokenAmount(pendingAmount, decimals)}{' '}
						<span className="text-secondary text-[12px]">
							{activeAsset?.metadata?.symbol ?? ''}
						</span>
					</p>
				</div>
				{isOwnProfile && (
					<button
						type="button"
						onClick={handleClaim}
						disabled={!hasPendingRewards || claimRewards.isPending}
						className={cx(
							'px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors cursor-pointer press-down',
							hasPendingRewards && !claimRewards.isPending
								? 'bg-black-white text-white-black hover:opacity-90'
								: 'bg-base-alt text-tertiary cursor-not-allowed',
						)}
					>
						{claimRewards.isPending ? (
							<span className="flex items-center gap-1.5">
								<LoaderIcon className="size-3 animate-spin" />
								{t('rewards.claiming')}
							</span>
						) : (
							t('rewards.claim')
						)}
					</button>
				)}
			</div>
		</div>
	)
}

function DelegateView(props: {
	accountAddress: string
	activeToken: string
	isOwnProfile: boolean
	onBack: () => void
}) {
	const { accountAddress, activeToken, isOwnProfile, onBack } = props
	const { t } = useTranslation()
	const [customAddress, setCustomAddress] = React.useState('')
	const [delegateOption, setDelegateOption] = React.useState<
		'self' | 'custom' | 'optOut'
	>('self')

	const rewardInfo = Hooks.reward.useUserRewardInfo({
		token: activeToken as `0x${string}`,
		account: accountAddress as `0x${string}`,
	})

	const setRecipient = Hooks.reward.useSetRecipientSync()

	const isOptedIn =
		rewardInfo.data?.rewardRecipient &&
		rewardInfo.data.rewardRecipient !==
			'0x0000000000000000000000000000000000000000'

	const handleSubmit = async () => {
		if (!isOwnProfile) return

		let recipient: `0x${string}`
		if (delegateOption === 'self') {
			recipient = accountAddress as `0x${string}`
		} else if (delegateOption === 'optOut') {
			recipient = '0x0000000000000000000000000000000000000000'
		} else {
			if (!customAddress.startsWith('0x') || customAddress.length !== 42) {
				return
			}
			recipient = customAddress as `0x${string}`
		}

		try {
			await setRecipient.mutateAsync({
				token: activeToken as `0x${string}`,
				recipient,
			})
			rewardInfo.refetch()
			onBack()
		} catch (error) {
			console.error('Set recipient failed:', error)
		}
	}

	const isValidCustomAddress =
		customAddress.startsWith('0x') && customAddress.length === 42

	const canSubmit =
		isOwnProfile &&
		!setRecipient.isPending &&
		(delegateOption !== 'custom' || isValidCustomAddress)

	return (
		<div className="p-3 flex flex-col gap-2">
			{/* Self delegation */}
			<button
				type="button"
				onClick={() => setDelegateOption('self')}
				className={cx(
					'flex items-center gap-2 p-2 rounded-lg border transition-colors cursor-pointer text-left',
					delegateOption === 'self'
						? 'border-accent bg-accent/5'
						: 'border-card-border hover:border-accent/50',
				)}
			>
				<div
					className={cx(
						'size-5 rounded-full flex items-center justify-center',
						delegateOption === 'self' ? 'bg-accent/20' : 'bg-base-alt',
					)}
				>
					<UserIcon
						className={cx(
							'size-2.5',
							delegateOption === 'self' ? 'text-accent' : 'text-tertiary',
						)}
					/>
				</div>
				<span className="text-[12px] text-primary flex-1">
					{t('rewards.delegateToSelf')}
				</span>
				{delegateOption === 'self' && (
					<CheckIcon className="size-3 text-accent" />
				)}
			</button>

			{/* Custom address */}
			<button
				type="button"
				onClick={() => setDelegateOption('custom')}
				className={cx(
					'flex items-center gap-2 p-2 rounded-lg border transition-colors cursor-pointer text-left',
					delegateOption === 'custom'
						? 'border-accent bg-accent/5'
						: 'border-card-border hover:border-accent/50',
				)}
			>
				<div
					className={cx(
						'size-5 rounded-full flex items-center justify-center',
						delegateOption === 'custom' ? 'bg-accent/20' : 'bg-base-alt',
					)}
				>
					<UsersIcon
						className={cx(
							'size-2.5',
							delegateOption === 'custom' ? 'text-accent' : 'text-tertiary',
						)}
					/>
				</div>
				<span className="text-[12px] text-primary flex-1">
					{t('rewards.delegateToOther')}
				</span>
				{delegateOption === 'custom' && (
					<CheckIcon className="size-3 text-accent" />
				)}
			</button>

			{delegateOption === 'custom' && (
				<input
					type="text"
					value={customAddress}
					onChange={(e) => setCustomAddress(e.target.value)}
					placeholder="0x..."
					className="w-full px-2 py-1.5 text-[11px] rounded-lg border border-card-border bg-alt placeholder:text-tertiary focus:border-accent focus:outline-none font-mono"
				/>
			)}

			{/* Opt out */}
			{isOptedIn && (
				<button
					type="button"
					onClick={() => setDelegateOption('optOut')}
					className={cx(
						'flex items-center gap-2 p-2 rounded-lg border transition-colors cursor-pointer text-left',
						delegateOption === 'optOut'
							? 'border-warning bg-warning/5'
							: 'border-card-border hover:border-warning/50',
					)}
				>
					<div
						className={cx(
							'size-5 rounded-full flex items-center justify-center',
							delegateOption === 'optOut' ? 'bg-warning/20' : 'bg-base-alt',
						)}
					>
						<GiftIcon
							className={cx(
								'size-2.5',
								delegateOption === 'optOut' ? 'text-warning' : 'text-tertiary',
							)}
						/>
					</div>
					<span className="text-[12px] text-primary flex-1">
						{t('rewards.optOut')}
					</span>
					{delegateOption === 'optOut' && (
						<CheckIcon className="size-3 text-warning" />
					)}
				</button>
			)}

			{/* Submit */}
			<button
				type="button"
				onClick={handleSubmit}
				disabled={!canSubmit}
				className={cx(
					'w-full py-2 rounded-lg text-[12px] font-medium transition-colors cursor-pointer press-down mt-1',
					canSubmit
						? 'bg-black-white text-white-black hover:opacity-90'
						: 'bg-base-alt text-tertiary cursor-not-allowed',
				)}
			>
				{setRecipient.isPending ? (
					<span className="flex items-center justify-center gap-1.5">
						<LoaderIcon className="size-3 animate-spin" />
						{t('rewards.updating')}
					</span>
				) : (
					t('rewards.confirm')
				)}
			</button>
		</div>
	)
}

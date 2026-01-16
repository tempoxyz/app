import {
	Link,
	createFileRoute,
	notFound,
	useNavigate,
} from '@tanstack/react-router'
import { Address } from 'ox'
import * as React from 'react'
import { useConnection, useDisconnect } from 'wagmi'
import { RewardsPopoverButton } from '#comps/RewardsPopover'
import { SetupApplePay } from '#comps/SetupApplePay'
import { Layout } from '#comps/Layout'
import { Section } from '#comps/Section'
import { AccessKeysSection } from '#comps/AccessKeysSection'
import { QRCode } from '#comps/QRCode'
import { ActivitySection } from '#comps/ActivitySection'
import { HoldingsTable } from '#comps/AssetRow'
import {
	AccessKeysProvider,
	useSignableAccessKeys,
} from '#lib/access-keys-context'
import { cx } from '#lib/css'
import { useCopy } from '#lib/hooks'
import { config } from '#lib/config'
import { fetchAssets, type AssetData } from '#lib/server/assets.server'
import {
	fetchTransactions,
	fetchCurrentBlockNumber,
	fetchTokenMetadata,
} from '#lib/server/transactions.server'
import { useActivitySummary, type ActivityType } from '#lib/activity-context'
import { LottoNumber } from '#comps/LottoNumber'
import {
	SettingsMainMenu,
	SettingsFeeTokenContent,
	SettingsLanguageContent,
} from '#comps/Settings'
import CopyIcon from '~icons/lucide/copy'
import ExternalLinkIcon from '~icons/lucide/external-link'
import CheckIcon from '~icons/lucide/check'
import SearchIcon from '~icons/lucide/search'
import LogOutIcon from '~icons/lucide/log-out'
import LogInIcon from '~icons/lucide/log-in'
import ChevronDownIcon from '~icons/lucide/chevron-down'
import { useTranslation } from 'react-i18next'
import i18n, { isRtl } from '#lib/i18n'
import { useAnnounce } from '#lib/a11y'
import * as z from 'zod/mini'

// Tokens that can be funded via the faucet
const FAUCET_TOKEN_ADDRESSES = new Set([
	'0x20c000000000000000000000033abb6ac7d235e5', // DONOTUSE
])

// Default faucet token data to inject when user has no assets
// TODO: Remove priceUsd: 1 assumption once proper price oracle is implemented
const FAUCET_TOKEN_DEFAULTS: AssetData[] = [
	{
		address: '0x20c000000000000000000000033abb6ac7d235e5' as `0x${string}`,
		metadata: {
			name: 'DONOTUSE',
			symbol: 'DONOTUSE',
			decimals: 6,
			priceUsd: 1,
		},
		balance: '0',
		valueUsd: 0,
	},
]

export const Route = createFileRoute('/_layout/$address')({
	component: RouteComponent,
	validateSearch: z.object({
		test: z.optional(z.boolean()),
		sendTo: z.optional(z.string()),
		token: z.optional(z.string()),
	}),
	beforeLoad: ({ params }) => {
		if (!Address.validate(params.address)) throw notFound()
	},
	loader: async ({ params }) => {
		// Only fetch assets SSR - activity loads client-side for faster initial render
		const assets = await fetchAssets({ data: { address: params.address } })
		return { assets: assets ?? [] }
	},
})

function RouteComponent() {
	const { address } = Route.useParams()
	const { assets: initialAssets } = Route.useLoaderData()
	const { copy, notifying } = useCopy()
	const { setSummary } = useActivitySummary()
	const { disconnect } = useDisconnect()
	const navigate = useNavigate()
	const [searchValue, setSearchValue] = React.useState('')
	const [searchFocused, setSearchFocused] = React.useState(false)
	const connection = useConnection()
	const { sendTo, token: initialToken } = Route.useSearch()
	const { t } = useTranslation()
	const { announce } = useAnnounce()
	const [sendingToken, setSendingToken] = React.useState<string | null>(
		initialToken ?? null,
	)

	// Assets state - starts from loader, can be refetched without page refresh
	const [assetsData, setAssetsData] = React.useState(initialAssets)
	// Activity state - fetched client-side for faster initial render
	const [activity, setActivity] = React.useState<
		Awaited<ReturnType<typeof fetchTransactions>>
	>([])
	const [activityLoading, setActivityLoading] = React.useState(true)

	// Fetch token metadata client-side (async, non-blocking)
	React.useEffect(() => {
		const assetsMissingMetadata = initialAssets.filter((a) => !a.metadata)
		if (assetsMissingMetadata.length === 0) return

		const addresses = assetsMissingMetadata.map((a) => a.address)
		fetchTokenMetadata({ data: { addresses } }).then((result) => {
			if (!result.tokens || Object.keys(result.tokens).length === 0) return

			setAssetsData((prev) =>
				prev.map((asset) => {
					if (asset.metadata) return asset
					const meta = result.tokens[asset.address.toLowerCase()]
					if (!meta) return asset
					return {
						...asset,
						metadata: { name: meta.name, symbol: meta.symbol, decimals: 6 },
					}
				}),
			)
		})
	}, [initialAssets])

	// Block timeline state
	const [currentBlock, setCurrentBlock] = React.useState<bigint | null>(null)

	// Poll for current block number (500ms for smooth single-block transitions)
	React.useEffect(() => {
		let mounted = true

		const pollBlock = async () => {
			try {
				const result = await fetchCurrentBlockNumber()
				if (mounted && result.blockNumber) {
					setCurrentBlock(BigInt(result.blockNumber))
				}
			} catch {
				// Ignore errors
			}
		}

		pollBlock()
		const interval = setInterval(pollBlock, 2000)

		return () => {
			mounted = false
			clearInterval(interval)
		}
	}, [])

	// Sync assets with loader data when address changes
	React.useEffect(() => {
		setAssetsData(initialAssets)
	}, [initialAssets])

	// Fetch activity client-side (not SSR for faster initial render)
	React.useEffect(() => {
		let cancelled = false
		setActivityLoading(true)
		setActivity([])

		const tokenMetadataMapForActivity = new Map<
			Address.Address,
			{ decimals: number; symbol: string }
		>()
		for (const asset of initialAssets) {
			if (asset.metadata?.decimals !== undefined && asset.metadata?.symbol) {
				tokenMetadataMapForActivity.set(asset.address, {
					decimals: asset.metadata.decimals,
					symbol: asset.metadata.symbol,
				})
			}
		}

		fetchTransactions(
			address as Address.Address,
			Promise.resolve(tokenMetadataMapForActivity),
		)
			.then((result) => {
				if (!cancelled) {
					setActivity(result)
					setActivityLoading(false)
				}
			})
			.catch(() => {
				if (!cancelled) setActivityLoading(false)
			})

		return () => {
			cancelled = true
		}
	}, [address, initialAssets])

	// Refetch balances without full page refresh
	const refetchAssetsBalances = React.useCallback(async () => {
		const newAssets = await fetchAssets({ data: { address } })
		if (!newAssets) return
		setAssetsData((prev) => {
			// Merge: update existing, add new
			const prevMap = new Map(prev.map((a) => [a.address.toLowerCase(), a]))
			for (const asset of newAssets) {
				prevMap.set(asset.address.toLowerCase(), asset)
			}
			return Array.from(prevMap.values())
		})
	}, [address])

	// Build token metadata map for activity parsing
	const tokenMetadataMap = React.useMemo(() => {
		const map = new Map<Address.Address, { decimals: number; symbol: string }>()
		for (const asset of assetsData) {
			if (asset.metadata?.decimals !== undefined && asset.metadata?.symbol) {
				map.set(asset.address, {
					decimals: asset.metadata.decimals,
					symbol: asset.metadata.symbol,
				})
			}
		}
		return map
	}, [assetsData])

	// Refetch activity without full page refresh
	const refetchActivity = React.useCallback(async () => {
		const newActivity = await fetchTransactions(
			address as Address.Address,
			Promise.resolve(tokenMetadataMap),
		)
		setActivity(newActivity)
	}, [address, tokenMetadataMap])

	// Optimistic balance adjustments: Map<tokenAddress, amountToSubtract>
	const [optimisticAdjustments, setOptimisticAdjustments] = React.useState<
		Map<string, bigint>
	>(new Map())

	const isOwnProfile =
		connection.address?.toLowerCase() === address.toLowerCase()

	const applyOptimisticUpdate = React.useCallback(
		(tokenAddress: string, amount: bigint) => {
			setOptimisticAdjustments((prev) => {
				const next = new Map(prev)
				const current = next.get(tokenAddress.toLowerCase()) ?? 0n
				next.set(tokenAddress.toLowerCase(), current + amount)
				return next
			})
		},
		[],
	)

	const clearOptimisticUpdate = React.useCallback((tokenAddress: string) => {
		setOptimisticAdjustments((prev) => {
			const next = new Map(prev)
			next.delete(tokenAddress.toLowerCase())
			return next
		})
	}, [])

	const handleFaucetSuccess = React.useCallback(() => {
		// Refetch balances and activity without page refresh
		refetchAssetsBalances()
		// Delay activity refetch slightly to allow transaction to be indexed
		setTimeout(() => {
			refetchActivity()
		}, 1500)
	}, [refetchAssetsBalances, refetchActivity])

	const handleSendSuccess = React.useCallback(() => {
		// For sends, we rely on optimistic updates and delayed refresh
		setTimeout(() => {
			refetchAssetsBalances()
			refetchActivity()
		}, 2000)
	}, [refetchAssetsBalances, refetchActivity])

	React.useEffect(() => {
		if (activity.length > 0) {
			const typeCounts: Record<string, number> = {}
			for (const item of activity) {
				for (const e of item.events) {
					const type = eventTypeToActivityType(e.type)
					typeCounts[type] = (typeCounts[type] ?? 0) + 1
				}
			}
			const types = Object.keys(typeCounts) as Array<
				ReturnType<typeof eventTypeToActivityType>
			>
			setSummary({
				types,
				typeCounts: typeCounts as Record<
					ReturnType<typeof eventTypeToActivityType>,
					number
				>,
				count: activity.length,
				recentTimestamp: Date.now(),
			})
		} else {
			setSummary(null)
		}
		return () => setSummary(null)
	}, [activity, setSummary])

	// Ensure faucet tokens are always in the list
	const assetsWithFaucet = React.useMemo(() => {
		const existing = new Set(assetsData.map((a) => a.address.toLowerCase()))
		const missing = FAUCET_TOKEN_DEFAULTS.filter(
			(f) => !existing.has(f.address.toLowerCase()),
		)
		return [...assetsData, ...missing]
	}, [assetsData])

	const dedupedAssets = assetsWithFaucet.filter(
		(a, i, arr) => arr.findIndex((b) => b.address === a.address) === i,
	)

	// Apply optimistic adjustments to assets
	const adjustedAssets = React.useMemo(() => {
		return dedupedAssets.map((asset) => {
			const adjustment = optimisticAdjustments.get(asset.address.toLowerCase())
			if (!adjustment || !asset.balance) return asset

			const currentBalance = BigInt(asset.balance)
			const newBalance = currentBalance - adjustment
			const newBalanceStr = newBalance > 0n ? newBalance.toString() : '0'

			// Recalculate USD value
			const decimals = asset.metadata?.decimals ?? 18
			const priceUsd = asset.metadata?.priceUsd ?? 0
			const newValueUsd = (Number(newBalance) / 10 ** decimals) * priceUsd

			return {
				...asset,
				balance: newBalanceStr,
				valueUsd: newValueUsd > 0 ? newValueUsd : 0,
			}
		})
	}, [dedupedAssets, optimisticAdjustments])

	const totalValue = adjustedAssets.reduce(
		(sum, asset) => sum + (asset.valueUsd ?? 0),
		0,
	)
	const assetsWithBalance = adjustedAssets.filter(
		(a) =>
			(a.balance && a.balance !== '0') ||
			FAUCET_TOKEN_ADDRESSES.has(a.address.toLowerCase()),
	)
	const displayedAssets = assetsWithBalance

	// Find selected asset for send form header
	const selectedSendAsset = sendingToken
		? (displayedAssets.find(
				(a) => a.address.toLowerCase() === sendingToken.toLowerCase(),
			) ?? null)
		: null

	// Get token addresses for access key spending limit queries
	const tokenAddresses = React.useMemo(
		() => dedupedAssets.map((a) => a.address),
		[dedupedAssets],
	)

	return (
		<AccessKeysProvider
			accountAddress={address}
			tokenAddresses={tokenAddresses}
		>
			<Layout.Header left={null} right={null} />

			<div className="pb-3">
				<div className="flex items-center justify-between mb-5">
					<Link to="/" className="flex items-center gap-2 press-down">
						<div
							className="size-[28px] rounded-[3px] flex items-center justify-center"
							style={{ backgroundColor: 'light-dark(#202020, #fcfcfc)' }}
						>
							<svg
								width="22"
								height="22"
								viewBox="0 0 269 269"
								fill="none"
								aria-hidden="true"
							>
								<title>Tempo</title>
								<path
									d="M123.273 190.794H93.445L121.09 105.318H85.7334L93.445 80.2642H191.95L184.238 105.318H150.773L123.273 190.794Z"
									style={{ fill: 'light-dark(#f5f5f5, #0a0a0a)' }}
								/>
							</svg>
						</div>
					</Link>
					<div className="relative">
						<form
							onSubmit={(e) => {
								e.preventDefault()
								const trimmed = searchValue.trim()
								if (trimmed.match(/^0x[a-fA-F0-9]{40}$/)) {
									navigate({ to: '/$address', params: { address: trimmed } })
									setSearchValue('')
									setSearchFocused(false)
								}
							}}
							className={cx(
								'flex items-center gap-1.5 pl-2.5 pr-3 h-[36px] rounded-full bg-base-alt transition-colors',
								searchFocused ? 'ring-1 ring-accent/50' : '',
							)}
						>
							<SearchIcon className="size-[14px] text-secondary" />
							<input
								type="text"
								value={searchValue}
								onChange={(e) => setSearchValue(e.target.value)}
								onFocus={() => setSearchFocused(true)}
								onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
								placeholder={t('common.search')}
								className="bg-transparent outline-none text-[13px] text-primary placeholder:text-secondary w-[80px] sm:w-[100px] focus:w-[140px] sm:focus:w-[180px] transition-all"
							/>
						</form>
						{searchFocused &&
							searchValue.trim().match(/^0x[a-fA-F0-9]{40}$/) && (
								<div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-card-border rounded-full shadow-xl overflow-hidden z-50">
									<button
										type="button"
										onMouseDown={(e) => {
											e.preventDefault()
											navigate({
												to: '/$address',
												params: { address: searchValue.trim() },
											})
											setSearchValue('')
											setSearchFocused(false)
										}}
										className="w-full h-[32px] px-3 text-left hover:bg-base-alt transition-colors cursor-pointer flex items-center justify-between"
									>
										<div className="flex flex-col min-w-0">
											<span className="text-[11px] text-primary font-mono truncate">
												{searchValue.trim().slice(0, 6)}...
												{searchValue.trim().slice(-4)}
											</span>
										</div>
										<ChevronDownIcon className="size-3 text-tertiary -rotate-90 shrink-0" />
									</button>
								</div>
							)}
					</div>
					{isOwnProfile ? (
						<button
							type="button"
							onClick={() => {
								disconnect()
								navigate({ to: '/' })
							}}
							className="flex items-center justify-center size-[36px] rounded-full bg-base-alt hover:bg-base-alt/80 active:bg-base-alt/60 transition-colors cursor-pointer focus-ring"
							aria-label={t('common.logOut')}
						>
							<LogOutIcon className="size-[14px] text-secondary" />
						</button>
					) : (
						<button
							type="button"
							onClick={() => navigate({ to: '/' })}
							className="flex items-center justify-center size-[36px] rounded-full bg-accent hover:bg-accent/90 active:bg-accent/80 transition-colors cursor-pointer focus-ring"
							aria-label={t('common.signIn')}
						>
							<LogInIcon className="size-[14px] text-white" />
						</button>
					)}
				</div>
				<div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-4 mb-5">
					<div className="flex-1 min-w-0 flex flex-col gap-2 order-2 sm:order-1">
						<div className="flex items-baseline gap-2">
							<LottoNumber
								value={formatUsd(totalValue)}
								duration={1200}
								className="text-[36px] sm:text-[40px] md:text-[56px] font-sans font-semibold text-primary -tracking-[0.02em] tabular-nums"
							/>
						</div>
						<div className="flex items-center gap-1.5 max-w-full">
							<button
								type="button"
								onClick={() => {
									copy(address)
									announce(t('a11y.addressCopied'))
								}}
								className="group flex items-center gap-2 cursor-pointer rounded-md focus-ring"
								aria-label={t('common.copyAddress')}
							>
								<code className="text-[11px] sm:text-[13px] font-mono text-secondary leading-tight min-w-0 text-left group-active:translate-y-px">
									{address.slice(0, 21)}
									<br />
									{address.slice(21)}
								</code>
								<span className="flex items-center justify-center size-[32px] sm:size-[28px] rounded-full sm:rounded-md bg-base-alt hover:bg-base-alt/70 transition-colors shrink-0 group-active:translate-y-px">
									{notifying ? (
										<CheckIcon className="size-[14px] text-positive" />
									) : (
										<CopyIcon className="size-[14px] text-tertiary" />
									)}
								</span>
							</button>
							<a
								href={`https://explore.mainnet.tempo.xyz/address/${address}`}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center justify-center size-[32px] sm:size-[28px] rounded-full sm:rounded-md bg-base-alt hover:bg-base-alt/70 press-down transition-colors shrink-0 focus-ring"
								aria-label={t('common.viewOnExplorer')}
							>
								<ExternalLinkIcon className="size-[14px] text-tertiary" />
							</a>
							<RewardsPopoverButton
								assets={assetsData}
								accountAddress={address}
							/>
						</div>
					</div>
					<div className="order-1 sm:order-2 self-center sm:self-start w-full sm:w-auto px-8 sm:px-0">
						<QRCode
							value={address}
							size="full"
							className="sm:hidden shrink-0 max-w-[200px] mx-auto"
						/>
						<QRCode
							value={address}
							size={72}
							className="hidden sm:block md:hidden shrink-0"
						/>
						<QRCode
							value={address}
							size={100}
							className="hidden md:block shrink-0"
						/>
					</div>
				</div>

				<div className="flex flex-col gap-2.5">
					<AssetsSection
						assets={displayedAssets}
						assetsWithBalance={assetsWithBalance}
						address={address}
						selectedSendAsset={selectedSendAsset}
						sendingToken={sendingToken}
						setSendingToken={setSendingToken}
						handleFaucetSuccess={handleFaucetSuccess}
						handleSendSuccess={handleSendSuccess}
						applyOptimisticUpdate={applyOptimisticUpdate}
						clearOptimisticUpdate={clearOptimisticUpdate}
						isOwnProfile={isOwnProfile}
						connectedAddress={connection.address}
						sendTo={sendTo}
						announce={announce}
					/>

					{config.onramp.enabled && isOwnProfile && (
						<Section title="Add Funds">
							<SetupApplePay address={address} />
						</Section>
					)}

					<ActivitySection
						activity={activity}
						address={address}
						currentBlock={currentBlock}
						tokenMetadataMap={tokenMetadataMap}
						loading={activityLoading}
					/>

					<AccessKeysSection assets={assetsData} accountAddress={address} />

					<SettingsSection assets={assetsData} />
				</div>
			</div>
		</AccessKeysProvider>
	)
}

function AssetsSection({
	assets,
	assetsWithBalance,
	address,
	selectedSendAsset,
	sendingToken,
	setSendingToken,
	handleFaucetSuccess,
	handleSendSuccess,
	applyOptimisticUpdate,
	clearOptimisticUpdate,
	isOwnProfile,
	connectedAddress,
	sendTo,
	announce,
}: {
	assets: AssetData[]
	assetsWithBalance: AssetData[]
	address: string
	selectedSendAsset: AssetData | null
	sendingToken: string | null
	setSendingToken: (token: string | null) => void
	handleFaucetSuccess: () => void
	handleSendSuccess: () => void
	applyOptimisticUpdate: (tokenAddress: string, amount: bigint) => void
	clearOptimisticUpdate: (tokenAddress: string) => void
	isOwnProfile: boolean
	connectedAddress?: string
	sendTo?: string
	announce: (message: string) => void
}) {
	const { t } = useTranslation()
	const { keys: signableAccessKeys } = useSignableAccessKeys()

	const subscreens = React.useMemo(() => {
		if (!selectedSendAsset) return undefined
		return [
			{
				name:
					selectedSendAsset.metadata?.symbol ||
					shortenAddress(selectedSendAsset.address, 3),
				content: (
					<HoldingsTable
						assets={assets}
						address={address}
						onFaucetSuccess={handleFaucetSuccess}
						onSendSuccess={handleSendSuccess}
						onOptimisticSend={applyOptimisticUpdate}
						onOptimisticClear={clearOptimisticUpdate}
						isOwnProfile={isOwnProfile}
						connectedAddress={connectedAddress}
						initialSendTo={sendTo}
						sendingToken={sendingToken}
						onSendingTokenChange={setSendingToken}
						announce={announce}
						faucetTokenAddresses={FAUCET_TOKEN_ADDRESSES}
						accessKeys={signableAccessKeys}
					/>
				),
			},
		]
	}, [
		selectedSendAsset,
		assets,
		address,
		handleFaucetSuccess,
		handleSendSuccess,
		applyOptimisticUpdate,
		clearOptimisticUpdate,
		isOwnProfile,
		connectedAddress,
		sendTo,
		sendingToken,
		setSendingToken,
		announce,
		signableAccessKeys,
	])

	return (
		<Section
			title={t('portfolio.assets')}
			subtitle={`${assetsWithBalance.length} ${t('portfolio.assetCount', { count: assetsWithBalance.length })}`}
			defaultOpen
			subscreens={subscreens}
			subscreen={sendingToken ? 0 : null}
			onSubscreenChange={(index) => {
				if (index === null) setSendingToken(null)
			}}
		>
			<HoldingsTable
				assets={assets}
				address={address}
				onFaucetSuccess={handleFaucetSuccess}
				onSendSuccess={handleSendSuccess}
				onOptimisticSend={applyOptimisticUpdate}
				onOptimisticClear={clearOptimisticUpdate}
				isOwnProfile={isOwnProfile}
				connectedAddress={connectedAddress}
				initialSendTo={sendTo}
				sendingToken={sendingToken}
				onSendingTokenChange={setSendingToken}
				announce={announce}
				faucetTokenAddresses={FAUCET_TOKEN_ADDRESSES}
				accessKeys={signableAccessKeys}
			/>
		</Section>
	)
}

function eventTypeToActivityType(eventType: string): ActivityType {
	const type = eventType.toLowerCase()
	if (type.includes('send') || type.includes('transfer')) return 'send'
	if (type.includes('receive')) return 'received'
	if (type.includes('swap') || type.includes('exchange')) return 'swap'
	if (type.includes('mint')) return 'mint'
	if (type.includes('burn')) return 'burn'
	if (type.includes('approve') || type.includes('approval')) return 'approve'
	return 'unknown'
}

function SettingsSection({ assets }: { assets: AssetData[] }) {
	const { t } = useTranslation()
	const assetsWithBalance = assets.filter((a) => a.balance && a.balance !== '0')
	const [currentFeeToken, setCurrentFeeToken] = React.useState<string>(
		assetsWithBalance[0]?.address ?? '',
	)
	const [currentLanguage, setCurrentLanguage] = React.useState(() => {
		if (typeof window !== 'undefined') {
			const saved = localStorage.getItem('tempo-language')
			if (saved) {
				i18n.changeLanguage(saved)
				document.documentElement.dir = isRtl(saved) ? 'rtl' : 'ltr'
				return saved
			}
		}
		return 'en'
	})
	const [subscreen, setSubscreen] = React.useState<number | null>(null)

	const handleLanguageChange = React.useCallback((lang: string) => {
		setCurrentLanguage(lang)
		i18n.changeLanguage(lang)
		if (typeof window !== 'undefined') {
			localStorage.setItem('tempo-language', lang)
			document.documentElement.dir = isRtl(lang) ? 'rtl' : 'ltr'
		}
	}, [])

	const subscreens = React.useMemo(
		() => [
			{
				name: t('settings.feeToken'),
				content: (
					<SettingsFeeTokenContent
						assets={assets}
						currentFeeToken={currentFeeToken}
						onFeeTokenChange={setCurrentFeeToken}
					/>
				),
			},
			{
				name: t('settings.language'),
				content: (
					<SettingsLanguageContent
						currentLanguage={currentLanguage}
						onLanguageChange={handleLanguageChange}
					/>
				),
			},
		],
		[t, assets, currentFeeToken, currentLanguage, handleLanguageChange],
	)

	return (
		<Section
			title={t('settings.title')}
			subscreens={subscreens}
			subscreen={subscreen}
			onSubscreenChange={setSubscreen}
		>
			<SettingsMainMenu
				assets={assets}
				currentFeeToken={currentFeeToken}
				currentLanguage={currentLanguage}
				onNavigate={setSubscreen}
			/>
		</Section>
	)
}

function formatUsd(value: number): string {
	if (value === 0) return '$0.00'
	return `$${value.toLocaleString('en-US', {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	})}`
}

function shortenAddress(address: string, chars = 4): string {
	return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`
}

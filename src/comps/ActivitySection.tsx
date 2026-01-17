import * as React from 'react'
import { createPortal } from 'react-dom'
import type { Address } from 'ox'
import { useTranslation } from 'react-i18next'
import {
	TxDescription,
	parseKnownEvents,
	preferredEventsFilter,
	getPerspectiveEvent,
	type KnownEvent,
	type GetTokenMetadataFn,
} from '#comps/activity'
import { Section } from '#comps/Section'
import { BlockTimeline } from '#comps/BlockTimeline'
import { TransactionModal } from '#comps/TransactionModal'
import { cx } from '#lib/css'
import {
	fetchBlockWithReceipts,
	fetchTokenMetadata,
	type ActivityItem,
} from '#lib/server/transactions.server'
import { convertRpcReceiptToViemReceipt } from '#lib/receipts'
import ExternalLinkIcon from '~icons/lucide/external-link'
import ReceiptIcon from '~icons/lucide/receipt'
import BoxIcon from '~icons/lucide/box'
import RefreshCwIcon from '~icons/lucide/refresh-cw'
import LoaderIcon from '~icons/lucide/loader-2'

const ACTIVITY_PAGE_SIZE = 10

export function ActivityHeatmap({
	activity,
	currentBlock,
}: {
	activity: ActivityItem[]
	currentBlock: bigint | null
}) {
	const [isMobile, setIsMobile] = React.useState(false)

	React.useEffect(() => {
		const checkMobile = () => setIsMobile(window.innerWidth < 640)
		checkMobile()
		window.addEventListener('resize', checkMobile)
		return () => window.removeEventListener('resize', checkMobile)
	}, [])

	const rows = isMobile ? 5 : 7
	const cols = isMobile ? 24 : 48
	const totalSlots = rows * cols

	const blocksPerDay = 172800n
	const blocksPerSlot = blocksPerDay / BigInt(totalSlots)

	const activityBySlot = React.useMemo(() => {
		const counts = new Map<number, number>()
		if (!currentBlock) return counts

		const oldestBlock = currentBlock - blocksPerDay

		for (let i = 0; i < activity.length; i++) {
			const item = activity[i]
			if (!item.blockNumber) continue
			if (item.blockNumber < oldestBlock) continue

			const blocksFromOldest = item.blockNumber - oldestBlock
			const bucket = Number(blocksFromOldest / blocksPerSlot)
			if (bucket >= 0 && bucket < totalSlots) {
				counts.set(bucket, (counts.get(bucket) ?? 0) + 1)
			}
		}
		return counts
	}, [activity, currentBlock, totalSlots, blocksPerSlot])

	const grid = React.useMemo(() => {
		const data: { level: number; count: number; slotIndex: number }[][] = []

		const maxCount = Math.max(1, ...activityBySlot.values())

		for (let c = 0; c < cols; c++) {
			const column: { level: number; count: number; slotIndex: number }[] = []
			for (let r = 0; r < rows; r++) {
				const bucket = c * rows + r
				if (bucket >= totalSlots) {
					column.push({ level: 0, count: 0, slotIndex: bucket })
					continue
				}
				const count = activityBySlot.get(bucket) ?? 0
				const level =
					count === 0 ? 0 : Math.min(4, Math.ceil((count / maxCount) * 4))
				column.push({ level, count, slotIndex: bucket })
			}
			data.push(column)
		}
		return data
	}, [activityBySlot, cols, rows, totalSlots])

	const getColor = (level: number) => {
		const colors = [
			'bg-base-alt/40',
			'bg-green-300/70 dark:bg-green-900',
			'bg-green-400 dark:bg-green-700',
			'bg-green-500 dark:bg-green-500',
			'bg-green-600 dark:bg-green-400',
		]
		return colors[level] ?? colors[0]
	}

	const formatSlotTime = (slotIndex: number) => {
		const hoursAgo = ((totalSlots - 1 - slotIndex) / totalSlots) * 24
		if (hoursAgo < 1) return 'now'
		if (hoursAgo < 2) return '~1h ago'
		return `~${Math.round(hoursAgo)}h ago`
	}

	const [hoveredCell, setHoveredCell] = React.useState<{
		count: number
		slotIndex: number
		x: number
		y: number
	} | null>(null)

	return (
		<div className="relative">
			<div
				className={cx('flex w-full py-2', isMobile ? 'gap-[4px]' : 'gap-[3px]')}
			>
				{grid.map((column, hi) => (
					<div
						key={`h-${hi.toString()}`}
						className={cx(
							'flex flex-col flex-1',
							isMobile ? 'gap-[4px]' : 'gap-[3px]',
						)}
					>
						{column.map((cell, di) => (
							<div
								key={`${hi}-${di.toString()}`}
								className={cx(
									'w-full aspect-square cursor-default',
									isMobile ? 'rounded-[3px]' : 'rounded-[2px]',
									getColor(cell.level),
								)}
								onMouseEnter={(e) => {
									const rect = e.currentTarget.getBoundingClientRect()
									setHoveredCell({
										count: cell.count,
										slotIndex: cell.slotIndex,
										x: rect.left + rect.width / 2,
										y: rect.top,
									})
								}}
								onMouseLeave={() => setHoveredCell(null)}
							/>
						))}
					</div>
				))}
			</div>
			{hoveredCell &&
				createPortal(
					<div
						className="fixed z-[100] px-2 py-1 text-[11px] text-white bg-gray-900 rounded-md shadow-lg whitespace-nowrap pointer-events-none border border-gray-700"
						style={{
							left: hoveredCell.x,
							top: hoveredCell.y - 6,
							transform: 'translate(-50%, -100%)',
						}}
					>
						<span className="font-medium">{hoveredCell.count}</span> tx
						{hoveredCell.count !== 1 ? 's' : ''} ·{' '}
						<span className="text-gray-300">
							{formatSlotTime(hoveredCell.slotIndex)}
						</span>
					</div>,
					document.body,
				)}
		</div>
	)
}

function formatActivityTime(timestamp: number): string {
	const now = Date.now()
	const diff = now - timestamp

	const seconds = Math.floor(diff / 1000)
	const minutes = Math.floor(diff / 60000)
	const hours = Math.floor(diff / 3600000)
	const days = Math.floor(diff / 86400000)

	if (seconds < 60) return `${seconds}s`
	if (minutes < 60) return `${minutes}m`
	if (hours < 24) return `${hours}h`
	if (days < 7) return `${days}d`

	return new Date(timestamp).toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
	})
}

function ActivityRow({
	item,
	viewer,
	transformEvent,
	isHighlighted,
}: {
	item: ActivityItem
	viewer: Address.Address
	transformEvent: (event: KnownEvent) => KnownEvent
	isHighlighted?: boolean
}) {
	const { t } = useTranslation()
	const [showModal, setShowModal] = React.useState(false)

	return (
		<>
			<div
				className={cx(
					'group flex items-center gap-2 px-3 h-[48px] transition-all',
					isHighlighted
						? 'bg-accent/10 -mx-3 px-6'
						: 'rounded-xl hover:glass-thin',
				)}
			>
				{isHighlighted && (
					<span className="size-1.5 rounded-full bg-accent shrink-0" />
				)}
				<TxDescription.ExpandGroup
					events={item.events}
					seenAs={viewer}
					transformEvent={transformEvent}
					limitFilter={preferredEventsFilter}
					emptyContent={
						<span className="flex items-center gap-1.5">
							<span className="text-secondary">{t('common.transaction')}</span>
							<span className="text-tertiary font-mono text-[11px]">
								{item.hash.slice(0, 10)}...
							</span>
						</span>
					}
				/>
				<div className="flex items-center gap-2 shrink-0">
					{item.timestamp && (
						<span className="text-[11px] text-tertiary font-mono tabular-nums">
							{formatActivityTime(item.timestamp)}
						</span>
					)}
					<a
						href={`https://explore.mainnet.tempo.xyz/tx/${item.hash}`}
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center justify-center size-[24px] rounded-md hover:bg-base-alt shrink-0 transition-all opacity-60 group-hover:opacity-100 focus-ring"
						aria-label={t('common.viewOnExplorer')}
					>
						<ExternalLinkIcon className="size-[14px] text-tertiary hover:text-accent transition-colors" />
					</a>
					<button
						type="button"
						onClick={() => setShowModal(true)}
						className="flex items-center justify-center size-[24px] rounded-md hover:bg-base-alt shrink-0 cursor-pointer transition-all opacity-60 group-hover:opacity-100 focus-ring"
						aria-label={t('common.viewReceipt')}
					>
						<ReceiptIcon className="size-[14px] text-tertiary hover:text-accent transition-colors" />
					</button>
				</div>
			</div>
			{showModal &&
				createPortal(
					<TransactionModal
						hash={item.hash}
						events={item.events}
						viewer={viewer}
						transformEvent={transformEvent}
						onClose={() => setShowModal(false)}
					/>,
					document.body,
				)}
		</>
	)
}

function ActivityList({
	activity,
	address,
	filterBlockNumber,
}: {
	activity: ActivityItem[]
	address: string
	filterBlockNumber?: bigint
}) {
	const viewer = address as Address.Address
	const { t } = useTranslation()
	const [page, setPage] = React.useState(0)

	const displayActivity = React.useMemo(() => {
		if (filterBlockNumber === undefined) return activity
		return activity.filter((item) => item.blockNumber === filterBlockNumber)
	}, [activity, filterBlockNumber])

	React.useEffect(() => {
		setPage(0)
	}, [])

	if (displayActivity.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-6 gap-2">
				<div className="size-10 rounded-full bg-base-alt flex items-center justify-center">
					<ReceiptIcon className="size-5 text-tertiary" />
				</div>
				<p className="text-[13px] text-secondary">
					{filterBlockNumber !== undefined
						? t('portfolio.noActivityInBlock')
						: t('portfolio.noActivityYet')}
				</p>
				{filterBlockNumber !== undefined && (
					<a
						href={`https://explore.mainnet.tempo.xyz/block/${filterBlockNumber}`}
						target="_blank"
						rel="noopener noreferrer"
						className="text-[12px] text-accent hover:underline"
					>
						{t('portfolio.viewBlockInExplorer')}
					</a>
				)}
			</div>
		)
	}

	const totalPages = Math.ceil(displayActivity.length / ACTIVITY_PAGE_SIZE)
	const paginatedActivity = displayActivity.slice(
		page * ACTIVITY_PAGE_SIZE,
		(page + 1) * ACTIVITY_PAGE_SIZE,
	)

	const transformEvent = (event: KnownEvent) =>
		getPerspectiveEvent(event, viewer)

	return (
		<div className="text-[13px] -mx-2">
			{paginatedActivity.map((item) => (
				<ActivityRow
					key={item.hash}
					item={item}
					viewer={viewer}
					transformEvent={transformEvent}
					isHighlighted={filterBlockNumber !== undefined}
				/>
			))}
			{totalPages > 1 && (
				<div className="flex items-center justify-center gap-1 pt-3 pb-1">
					{Array.from({ length: totalPages }, (_, i) => (
						<button
							key={`activity-page-${i.toString()}`}
							type="button"
							onClick={() => setPage(i)}
							className={cx(
								'size-[28px] rounded-full text-[12px] cursor-pointer transition-all',
								page === i
									? 'bg-accent/15 text-accent'
									: 'hover:bg-base-alt text-tertiary',
							)}
						>
							{i + 1}
						</button>
					))}
				</div>
			)}
		</div>
	)
}

function BlockActivityList({
	activity,
	address,
	userTxHashes,
	blockNumber,
}: {
	activity: ActivityItem[]
	address: string
	userTxHashes: Set<string>
	blockNumber: bigint
}) {
	const viewer = address as Address.Address
	const [page, setPage] = React.useState(0)

	const totalPages = Math.ceil(activity.length / ACTIVITY_PAGE_SIZE)
	const paginatedActivity = activity.slice(
		page * ACTIVITY_PAGE_SIZE,
		(page + 1) * ACTIVITY_PAGE_SIZE,
	)

	const transformEvent = (event: KnownEvent) =>
		getPerspectiveEvent(event, viewer)

	return (
		<div className="text-[13px] -mx-2">
			<div className="px-3 py-2 text-[11px] text-tertiary">
				Block {blockNumber.toString()} • {activity.length} transaction
				{activity.length !== 1 ? 's' : ''}
			</div>
			{paginatedActivity.map((item) => (
				<ActivityRow
					key={item.hash}
					item={item}
					viewer={viewer}
					transformEvent={transformEvent}
					isHighlighted={userTxHashes.has(item.hash.toLowerCase())}
				/>
			))}
			{totalPages > 1 && (
				<div className="flex items-center justify-center gap-1 pt-3 pb-1">
					{Array.from({ length: totalPages }, (_, i) => (
						<button
							key={`block-activity-page-${i.toString()}`}
							type="button"
							onClick={() => setPage(i)}
							className={cx(
								'size-[28px] rounded-full text-[12px] cursor-pointer transition-all',
								page === i
									? 'bg-accent/15 text-accent'
									: 'hover:bg-base-alt text-tertiary',
							)}
						>
							{i + 1}
						</button>
					))}
				</div>
			)}
		</div>
	)
}

type ActivityTab = 'mine' | 'everyone'

export function ActivitySection({
	activity,
	address,
	currentBlock,
	tokenMetadataMap,
	loading = false,
}: {
	activity: ActivityItem[]
	address: string
	currentBlock: bigint | null
	tokenMetadataMap: Map<Address.Address, { decimals: number; symbol: string }>
	loading?: boolean
}) {
	const { t } = useTranslation()
	const [activeTab, setActiveTab] = React.useState<ActivityTab>('mine')
	const [sectionOpen, setSectionOpen] = React.useState(false)
	const [selectedBlock, setSelectedBlock] = React.useState<bigint | undefined>()
	const [blockActivity, setBlockActivity] = React.useState<ActivityItem[]>([])

	const userTxHashes = React.useMemo(
		() => new Set(activity.map((a) => a.hash.toLowerCase())),
		[activity],
	)

	const tokenMetadataMapRef = React.useRef(tokenMetadataMap)
	tokenMetadataMapRef.current = tokenMetadataMap

	const [loadedBlock, setLoadedBlock] = React.useState<bigint | undefined>()

	const fetchedTokenMetadataRef = React.useRef<
		Map<string, { name: string; symbol: string; decimals: number }>
	>(new Map())

	React.useEffect(() => {
		if (activeTab !== 'everyone' || selectedBlock === undefined) {
			return
		}

		if (loadedBlock !== selectedBlock) {
			setBlockActivity([])
		}

		let cancelled = false
		const loadBlockTxs = async () => {
			try {
				const result = await fetchBlockWithReceipts(selectedBlock.toString())

				if (cancelled) return

				if (result.receipts.length > 0) {
					const unknownTokens = new Set<string>()
					for (const receipt of result.receipts) {
						for (const log of receipt.logs) {
							const addr = log.address.toLowerCase()
							if (
								!tokenMetadataMapRef.current.has(addr as Address.Address) &&
								!fetchedTokenMetadataRef.current.has(addr)
							) {
								unknownTokens.add(addr)
							}
						}
					}

					if (unknownTokens.size > 0 && !cancelled) {
						try {
							const metadataResult = await fetchTokenMetadata(
								Array.from(unknownTokens),
							)
							for (const [addr, meta] of Object.entries(
								metadataResult.tokens,
							)) {
								fetchedTokenMetadataRef.current.set(addr, meta)
							}
						} catch {
							// Ignore metadata fetch errors
						}
					}

					if (cancelled) return

					const getTokenMetadata: GetTokenMetadataFn = (tokenAddress) => {
						const addr = tokenAddress.toLowerCase()
						return (
							tokenMetadataMapRef.current.get(tokenAddress) ||
							fetchedTokenMetadataRef.current.get(addr)
						)
					}

					const items: ActivityItem[] = []
					for (const receipt of result.receipts) {
						let events: KnownEvent[] = []
						try {
							const viemReceipt = convertRpcReceiptToViemReceipt(receipt)
							events = parseKnownEvents(viemReceipt, {
								getTokenMetadata,
								viewer: receipt.from,
							})
						} catch {
							// parsing failed, show tx with empty events
						}

						if (events.length === 0 && receipt.to) {
							const to = receipt.to.toLowerCase()
							if (to === '0x0000000000000000000000000000000000000000') {
								events = [
									{
										type: 'system',
										parts: [{ type: 'action', value: 'Subblock Metadata' }],
									},
								]
							}
						}

						items.push({
							hash: receipt.transactionHash,
							events,
							timestamp: result.timestamp,
							blockNumber: selectedBlock,
						})
					}
					setBlockActivity(items)
				} else {
					setBlockActivity([])
				}
				setLoadedBlock(selectedBlock)
			} catch {
				if (!cancelled) {
					setBlockActivity([])
					setLoadedBlock(selectedBlock)
				}
			}
		}

		loadBlockTxs()
		return () => {
			cancelled = true
		}
	}, [activeTab, selectedBlock, loadedBlock])

	React.useEffect(() => {
		if (activeTab === 'mine') {
			setSelectedBlock(undefined)
			setBlockActivity([])
		}
	}, [activeTab])

	const tabButtons = (
		<div className="flex items-center gap-3">
			<button
				type="button"
				tabIndex={0}
				onMouseDown={(e) => {
					e.stopPropagation()
					setActiveTab('mine')
					setSectionOpen(true)
				}}
				onKeyDown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.stopPropagation()
						setActiveTab('mine')
						setSectionOpen(true)
					}
				}}
				className={cx(
					'text-[12px] font-medium pb-0.5 border-b-2 cursor-pointer',
					activeTab === 'mine'
						? 'text-primary border-accent'
						: 'text-tertiary hover:text-primary border-transparent',
				)}
			>
				{t('portfolio.mine')}
			</button>
			<button
				type="button"
				tabIndex={0}
				onMouseDown={(e) => {
					e.stopPropagation()
					setActiveTab('everyone')
					setSectionOpen(true)
				}}
				onKeyDown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.stopPropagation()
						setActiveTab('everyone')
						setSectionOpen(true)
					}
				}}
				className={cx(
					'text-[12px] font-medium pb-0.5 border-b-2 cursor-pointer',
					activeTab === 'everyone'
						? 'text-primary border-accent'
						: 'text-tertiary hover:text-primary border-transparent',
				)}
			>
				{t('portfolio.everyone')}
			</button>
		</div>
	)

	return (
		<Section
			title={t('portfolio.activity')}
			externalLink={`https://explore.mainnet.tempo.xyz/address/${address}`}
			open={sectionOpen}
			onOpenChange={setSectionOpen}
			titleRight={tabButtons}
		>
			{loading ? (
				<div className="flex items-center justify-center py-4">
					<LoaderIcon className="size-4 animate-spin text-tertiary" />
				</div>
			) : activeTab === 'mine' ? (
				<>
					<ActivityHeatmap activity={activity} currentBlock={currentBlock} />
					<ActivityList
						activity={activity}
						address={address}
						filterBlockNumber={undefined}
					/>
				</>
			) : (
				<div className="w-full overflow-hidden">
					<BlockTimeline
						activity={activity}
						currentBlock={currentBlock}
						selectedBlock={selectedBlock}
						onSelectBlock={setSelectedBlock}
					/>
					<div className="border-b border-border-tertiary -mx-2 mt-2 mb-3" />

					{selectedBlock === undefined ? (
						<div className="flex flex-col items-center justify-center min-h-[80px] py-6 gap-2">
							<div className="size-10 rounded-full bg-base-alt flex items-center justify-center">
								<BoxIcon className="size-5 text-tertiary" />
							</div>
							<p className="text-[13px] text-secondary">
								{t('portfolio.selectBlockToView') ||
									t('portfolio.selectBlockToViewTxs')}
							</p>
						</div>
					) : (
						<div>
							{blockActivity.length === 0 && loadedBlock === selectedBlock ? (
								<div className="flex flex-col items-center justify-center py-6 gap-2">
									<div className="size-10 rounded-full bg-base-alt flex items-center justify-center">
										<ReceiptIcon className="size-5 text-tertiary" />
									</div>
									<p className="text-[13px] text-secondary">
										{t('portfolio.noActivityInBlock')}
									</p>
									<a
										href={`https://explore.mainnet.tempo.xyz/block/${selectedBlock}`}
										target="_blank"
										rel="noopener noreferrer"
										className="text-[12px] text-accent hover:underline"
									>
										{t('portfolio.viewBlockInExplorer')}
									</a>
								</div>
							) : blockActivity.length > 0 ? (
								<BlockActivityList
									activity={blockActivity}
									address={address}
									userTxHashes={userTxHashes}
									blockNumber={loadedBlock ?? selectedBlock}
								/>
							) : (
								<div className="flex items-center justify-center min-h-[80px]">
									<RefreshCwIcon className="size-5 text-tertiary animate-spin" />
								</div>
							)}
						</div>
					)}
				</div>
			)}
		</Section>
	)
}

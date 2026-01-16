import * as React from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { cx } from '#lib/css'
import PlayIcon from '~icons/lucide/play'
import { fetchBlockData } from '#lib/server/transactions.server'
import type { ActivityItem } from '#lib/server/transactions.server'

export function BlockTimeline({
	activity,
	currentBlock,
	selectedBlock,
	onSelectBlock,
}: {
	activity: ActivityItem[]
	currentBlock: bigint | null
	selectedBlock: bigint | undefined
	onSelectBlock: (block: bigint | undefined) => void
}) {
	const { t } = useTranslation()
	const scrollRef = React.useRef<HTMLDivElement>(null)
	const containerRef = React.useRef<HTMLDivElement>(null)
	const [blockTxCounts, setBlockTxCounts] = React.useState<Map<string, number>>(
		new Map(),
	)
	const [displayBlock, setDisplayBlock] = React.useState<bigint | null>(null)
	const [isPaused, setIsPaused] = React.useState(false)
	const [focusedBlockIndex, setFocusedBlockIndex] = React.useState<
		number | null
	>(null)
	const [hoveredBlock, setHoveredBlock] = React.useState<{
		blockNumber: bigint
		txCount: number
		x: number
		y: number
	} | null>(null)
	const [dragState, setDragState] = React.useState<{
		startBlock: bigint
		endBlock: bigint
	} | null>(null)
	const lastFetchedBlockRef = React.useRef<bigint | null>(null)
	const pauseTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
		null,
	)
	const prefetchedBlocksRef = React.useRef<Set<string>>(new Set())

	const userBlockNumbers = React.useMemo(() => {
		const blocks = new Set<bigint>()
		for (const item of activity) {
			if (item.blockNumber !== undefined) {
				blocks.add(item.blockNumber)
			}
		}
		return blocks
	}, [activity])

	const blocksBeforeCurrent = 20
	const blocksAfterCurrent = 20

	React.useEffect(() => {
		if (currentBlock && displayBlock === null) {
			setDisplayBlock(currentBlock)
		}
	}, [currentBlock, displayBlock])

	React.useEffect(() => {
		if (
			!currentBlock ||
			!displayBlock ||
			isPaused ||
			selectedBlock !== undefined
		)
			return
		if (displayBlock >= currentBlock) return

		const blocksBehind = Number(currentBlock - displayBlock)
		const delay = blocksBehind > 5 ? 50 : blocksBehind > 2 ? 100 : 300

		const timer = setTimeout(() => {
			setDisplayBlock((prev) => (prev ? prev + 1n : currentBlock))
		}, delay)

		return () => clearTimeout(timer)
	}, [currentBlock, displayBlock, isPaused, selectedBlock])

	React.useEffect(() => {
		if (!currentBlock) return

		const fetchBlocks = async () => {
			const lastFetched = lastFetchedBlockRef.current
			if (lastFetched && currentBlock <= lastFetched) return

			const blocksToFetch = lastFetched
				? Math.min(Number(currentBlock - lastFetched), 10)
				: blocksBeforeCurrent + 1

			try {
				const result = await fetchBlockData({
					data: {
						fromBlock: `0x${currentBlock.toString(16)}`,
						count: blocksToFetch,
					},
				})
				if (result.blocks.length > 0) {
					setBlockTxCounts((prev) => {
						const next = new Map(prev)
						for (const b of result.blocks) {
							next.set(BigInt(b.blockNumber).toString(), b.txCount)
						}
						return next
					})
					lastFetchedBlockRef.current = currentBlock
				}
			} catch {
				// Ignore
			}
		}

		fetchBlocks()
	}, [currentBlock])

	const prefetchAdjacentBlocks = React.useCallback(
		async (blockNumber: bigint) => {
			const blocksToCheck = [
				blockNumber - 2n,
				blockNumber - 1n,
				blockNumber + 1n,
				blockNumber + 2n,
			]
			const missingBlocks = blocksToCheck.filter(
				(b) =>
					b > 0n &&
					!blockTxCounts.has(b.toString()) &&
					!prefetchedBlocksRef.current.has(b.toString()),
			)

			if (missingBlocks.length === 0) return

			for (const b of missingBlocks) {
				prefetchedBlocksRef.current.add(b.toString())
			}

			try {
				const maxBlock = missingBlocks.reduce((a, b) => (a > b ? a : b))
				const result = await fetchBlockData({
					data: {
						fromBlock: `0x${maxBlock.toString(16)}`,
						count: 5,
					},
				})
				if (result.blocks.length > 0) {
					setBlockTxCounts((prev) => {
						const next = new Map(prev)
						for (const b of result.blocks) {
							next.set(BigInt(b.blockNumber).toString(), b.txCount)
						}
						return next
					})
				}
			} catch {
				// Ignore prefetch errors
			}
		},
		[blockTxCounts],
	)

	const handleScroll = React.useCallback(() => {
		setIsPaused(true)
		if (pauseTimeoutRef.current) {
			clearTimeout(pauseTimeoutRef.current)
		}
		pauseTimeoutRef.current = setTimeout(() => {
			setIsPaused(false)
		}, 3000)
	}, [])

	React.useEffect(() => {
		return () => {
			if (pauseTimeoutRef.current) {
				clearTimeout(pauseTimeoutRef.current)
			}
		}
	}, [])

	const blocks = React.useMemo(() => {
		const blockToShow = displayBlock ?? currentBlock
		if (!blockToShow) return []
		const result: {
			blockNumber: bigint
			hasUserActivity: boolean
			txCount: number
			isPlaceholder: boolean
		}[] = []

		for (let i = blocksBeforeCurrent; i >= 1; i--) {
			const blockNum = blockToShow - BigInt(i)
			if (blockNum > 0n) {
				result.push({
					blockNumber: blockNum,
					hasUserActivity: userBlockNumbers.has(blockNum),
					txCount: blockTxCounts.get(blockNum.toString()) ?? 0,
					isPlaceholder: false,
				})
			}
		}

		result.push({
			blockNumber: blockToShow,
			hasUserActivity: userBlockNumbers.has(blockToShow),
			txCount: blockTxCounts.get(blockToShow.toString()) ?? 0,
			isPlaceholder: false,
		})

		for (let i = 1; i <= blocksAfterCurrent; i++) {
			result.push({
				blockNumber: blockToShow + BigInt(i),
				hasUserActivity: false,
				txCount: 0,
				isPlaceholder: true,
			})
		}

		return result
	}, [displayBlock, currentBlock, userBlockNumbers, blockTxCounts])

	const handleBlockClick = (blockNumber: bigint, isPlaceholder: boolean) => {
		if (isPlaceholder) return
		if (selectedBlock === blockNumber) {
			onSelectBlock(undefined)
		} else {
			onSelectBlock(blockNumber)
		}
	}

	const handleKeyDown = React.useCallback(
		(e: React.KeyboardEvent) => {
			if (blocks.length === 0) return

			const currentIndex =
				focusedBlockIndex ??
				blocks.findIndex((b) => b.blockNumber === selectedBlock) ??
				blocks.findIndex(
					(b) =>
						!b.isPlaceholder &&
						b.blockNumber === (displayBlock ?? currentBlock),
				)

			let newIndex =
				currentIndex === -1 ? Math.floor(blocks.length / 2) : currentIndex

			switch (e.key) {
				case 'ArrowLeft':
					e.preventDefault()
					newIndex = Math.max(0, newIndex - 1)
					while (newIndex > 0 && blocks[newIndex]?.isPlaceholder) {
						newIndex--
					}
					break
				case 'ArrowRight':
					e.preventDefault()
					newIndex = Math.min(blocks.length - 1, newIndex + 1)
					while (
						newIndex < blocks.length - 1 &&
						blocks[newIndex]?.isPlaceholder
					) {
						newIndex++
					}
					if (blocks[newIndex]?.isPlaceholder) {
						newIndex = currentIndex
					}
					break
				case 'Enter':
				case ' ':
					e.preventDefault()
					if (focusedBlockIndex !== null && blocks[focusedBlockIndex]) {
						const block = blocks[focusedBlockIndex]
						if (!block.isPlaceholder) {
							handleBlockClick(block.blockNumber, block.isPlaceholder)
						}
					}
					return
				case 'Escape':
					e.preventDefault()
					onSelectBlock(undefined)
					setFocusedBlockIndex(null)
					return
				case 'Home':
					e.preventDefault()
					newIndex = 0
					break
				case 'End':
					e.preventDefault()
					newIndex = blocks.findLastIndex((b) => !b.isPlaceholder)
					break
				default:
					return
			}

			if (
				newIndex !== currentIndex &&
				blocks[newIndex] &&
				!blocks[newIndex].isPlaceholder
			) {
				setFocusedBlockIndex(newIndex)
				prefetchAdjacentBlocks(blocks[newIndex].blockNumber)
			}
		},
		[
			blocks,
			focusedBlockIndex,
			selectedBlock,
			displayBlock,
			currentBlock,
			onSelectBlock,
			prefetchAdjacentBlocks,
			// biome-ignore lint/correctness/useExhaustiveDependencies: TODO: fix this
			handleBlockClick,
		],
	)

	const handleMouseDown = (blockNumber: bigint, isPlaceholder: boolean) => {
		if (isPlaceholder) return
		setDragState({ startBlock: blockNumber, endBlock: blockNumber })
	}

	const handleMouseEnter = (
		blockNumber: bigint,
		isPlaceholder: boolean,
		e: React.MouseEvent,
	) => {
		if (!isPlaceholder) {
			const rect = e.currentTarget.getBoundingClientRect()
			setHoveredBlock({
				blockNumber,
				txCount: blockTxCounts.get(blockNumber.toString()) ?? 0,
				x: rect.left + rect.width / 2,
				y: rect.top,
			})
			prefetchAdjacentBlocks(blockNumber)
		}

		if (dragState && !isPlaceholder) {
			setDragState((prev) => (prev ? { ...prev, endBlock: blockNumber } : null))
		}
	}

	const handleMouseUp = () => {
		if (dragState) {
			const start =
				dragState.startBlock < dragState.endBlock
					? dragState.startBlock
					: dragState.endBlock
			const end =
				dragState.startBlock < dragState.endBlock
					? dragState.endBlock
					: dragState.startBlock

			if (start === end) {
				handleBlockClick(start, false)
			} else {
				onSelectBlock(start)
			}
			setDragState(null)
		}
	}

	const isInDragRange = (blockNumber: bigint) => {
		if (!dragState) return false
		const start =
			dragState.startBlock < dragState.endBlock
				? dragState.startBlock
				: dragState.endBlock
		const end =
			dragState.startBlock < dragState.endBlock
				? dragState.endBlock
				: dragState.startBlock
		return blockNumber >= start && blockNumber <= end
	}

	const getBlockStyle = (
		txCount: number,
		_isSelected: boolean,
		_isCurrent: boolean,
		hasUserActivity: boolean,
		isPlaceholder: boolean,
	): string => {
		if (isPlaceholder) return 'bg-base-alt/20'
		if (hasUserActivity) return 'bg-green-500'

		if (txCount === 0) return 'bg-base-alt/40'
		if (txCount === 1) return 'bg-base-alt/70'
		if (txCount === 2) return 'bg-emerald-800/70'
		return 'bg-emerald-500'
	}

	if (!currentBlock) {
		return (
			<div className="flex flex-col gap-1.5 mt-2 mb-3">
				<div className="flex items-center justify-center gap-[2px] w-full p-1">
					{Array.from({ length: 30 }).map((_, i) => (
						<div
							key={i.toString()}
							className="shrink-0 size-[8px] rounded-[1px] bg-base-alt/20 animate-pulse"
						/>
					))}
				</div>
				<div className="flex items-center justify-center">
					<div className="flex items-center gap-1 h-5 px-2 rounded-full bg-white/5 border border-white/10">
						<span className="text-[11px] text-tertiary">
							{t('common.block')}
						</span>
						<span className="text-[11px] text-tertiary font-mono">...</span>
					</div>
				</div>
			</div>
		)
	}

	const shownBlock = displayBlock ?? currentBlock

	return (
		<section
			role="region"
			ref={containerRef}
			className="flex flex-col gap-1.5 mt-2 mb-3 w-full overflow-hidden"
			onMouseUp={handleMouseUp}
			onMouseLeave={() => {
				setHoveredBlock(null)
				if (dragState) {
					handleMouseUp()
				}
			}}
		>
			<div
				ref={scrollRef}
				onScroll={handleScroll}
				onKeyDown={handleKeyDown}
				tabIndex={0}
				role="listbox"
				aria-label={t('portfolio.blockTimeline') || 'Block timeline'}
				aria-activedescendant={
					focusedBlockIndex !== null
						? `block-${blocks[focusedBlockIndex]?.blockNumber.toString()}`
						: undefined
				}
				className="flex items-center gap-[2px] w-full overflow-x-auto no-scrollbar py-1.5 focus-ring rounded-sm"
			>
				{blocks.map((block, index) => {
					const isSelected = selectedBlock === block.blockNumber
					const isCurrent =
						block.blockNumber === shownBlock && !block.isPlaceholder
					const isFocused = focusedBlockIndex === index
					const inDragRange = isInDragRange(block.blockNumber)
					return (
						<button
							key={block.blockNumber.toString()}
							id={`block-${block.blockNumber.toString()}`}
							type="button"
							role="option"
							aria-selected={isSelected}
							onMouseDown={() =>
								handleMouseDown(block.blockNumber, block.isPlaceholder)
							}
							onMouseEnter={(e) =>
								handleMouseEnter(block.blockNumber, block.isPlaceholder, e)
							}
							onMouseLeave={() => setHoveredBlock(null)}
							disabled={block.isPlaceholder}
							className={cx(
								'shrink-0 size-3 rounded-sm transition-all duration-300 ease-out',
								inDragRange && !block.isPlaceholder
									? 'block-range-selected'
									: getBlockStyle(
											block.txCount,
											isSelected,
											isCurrent,
											block.hasUserActivity,
											block.isPlaceholder,
										),
								isCurrent &&
									!isSelected &&
									'ring-2 ring-white/90 ring-offset-1 ring-offset-black scale-110',
								isSelected &&
									'ring-2 ring-accent ring-offset-1 ring-offset-black scale-110',
								isFocused &&
									!isSelected &&
									!isCurrent &&
									'ring-2 ring-accent/50',
								block.hasUserActivity &&
									!isSelected &&
									!isCurrent &&
									!isFocused &&
									'ring-1 ring-green-500/60',
								block.isPlaceholder
									? 'cursor-default opacity-20'
									: 'hover:opacity-90 cursor-pointer',
							)}
						/>
					)
				})}
			</div>

			{hoveredBlock &&
				createPortal(
					<div
						className="fixed z-[100] px-2 py-1 text-[11px] text-white bg-gray-900 rounded-md shadow-lg whitespace-nowrap pointer-events-none border border-gray-700"
						style={{
							left: hoveredBlock.x,
							top: hoveredBlock.y - 6,
							transform: 'translate(-50%, -100%)',
						}}
					>
						<span className="font-medium font-mono">
							#{hoveredBlock.blockNumber.toString()}
						</span>
						{' | '}
						<span className="text-emerald-400">
							{hoveredBlock.txCount} event
							{hoveredBlock.txCount !== 1 ? 's' : ''}
						</span>
						{currentBlock && (
							<>
								{' | '}
								<span className="text-gray-400">
									{(() => {
										const blockDiff = Number(
											currentBlock - hoveredBlock.blockNumber,
										)
										const msAgo = blockDiff * 100
										if (blockDiff <= 0) return 'now'
										if (msAgo < 1000) return `${msAgo}ms ago`
										if (msAgo < 60000)
											return `${(msAgo / 1000).toFixed(1)}s ago`
										if (msAgo < 3600000)
											return `${Math.floor(msAgo / 60000)}m ago`
										return `${Math.floor(msAgo / 3600000)}h ago`
									})()}
								</span>
							</>
						)}
					</div>,
					document.body,
				)}

			<div className="flex items-center justify-center">
				<div
					className={cx(
						'flex items-center gap-1.5 h-5 pl-0.5 pr-2 rounded-full border transition-colors',
						selectedBlock !== undefined
							? 'bg-accent/20 border-accent/30'
							: 'bg-surface border-card-border',
					)}
				>
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation()
							if (pauseTimeoutRef.current) {
								clearTimeout(pauseTimeoutRef.current)
								pauseTimeoutRef.current = null
							}
							if (isPaused || selectedBlock !== undefined) {
								setIsPaused(false)
								onSelectBlock(undefined)
								if (currentBlock) {
									setDisplayBlock(currentBlock)
								}
							} else {
								setIsPaused(true)
							}
						}}
						className={cx(
							'flex items-center justify-center size-4 rounded-full transition-colors cursor-pointer',
							isPaused || selectedBlock !== undefined
								? 'bg-accent/30 hover:bg-accent/40'
								: 'bg-tertiary/20 hover:bg-tertiary/30',
						)}
						aria-label={
							isPaused || selectedBlock !== undefined
								? t('portfolio.resumeLiveUpdates')
								: t('portfolio.pauseLiveUpdates')
						}
					>
						{isPaused || selectedBlock !== undefined ? (
							<PlayIcon className="size-2 text-accent fill-accent" />
						) : (
							<svg className="size-2" viewBox="0 0 24 24" fill="currentColor">
								<title>Play icon</title>
								<rect x="6" y="4" width="4" height="16" rx="1" />
								<rect x="14" y="4" width="4" height="16" rx="1" />
							</svg>
						)}
					</button>
					<span className="text-[11px] text-tertiary">{t('common.block')}</span>
					<span className="text-[11px] text-primary font-mono tabular-nums">
						{selectedBlock !== undefined
							? selectedBlock.toString()
							: (shownBlock?.toString() ?? '...')}
					</span>
				</div>
			</div>
		</section>
	)
}

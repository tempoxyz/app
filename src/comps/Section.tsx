import * as React from 'react'
import { waapi, spring } from 'animejs'
import ArrowLeftIcon from '~icons/lucide/arrow-left'
import PlusIcon from '~icons/lucide/plus'
import MinusIcon from '~icons/lucide/minus'
import GlobeIcon from '~icons/lucide/globe'

const springLeave = spring({
	mass: 1,
	stiffness: 2600,
	damping: 100,
})

const springEnter = spring({
	mass: 1,
	stiffness: 1200,
	damping: 80,
})

export function Section(props: {
	title: string
	subtitle?: string
	titleRight?: React.ReactNode
	externalLink?: string
	defaultOpen?: boolean
	open?: boolean
	onOpenChange?: (open: boolean) => void
	headerRight?: React.ReactNode
	children: React.ReactNode
	subscreens?: Array<{ name: string; content: React.ReactNode }>
	subscreen?: number | null
	onSubscreenChange?: (index: number | null) => void
}) {
	const {
		title,
		subtitle,
		titleRight,
		externalLink,
		defaultOpen = false,
		open: controlledOpen,
		onOpenChange,
		headerRight,
		children,
		subscreens,
		subscreen,
		onSubscreenChange,
	} = props
	const [open, setOpenState] = React.useState(defaultOpen)
	const contentRef = React.useRef<HTMLDivElement>(null)
	const wrapperRef = React.useRef<HTMLDivElement>(null)
	const innerRef = React.useRef<HTMLDivElement>(null)
	const animationRef = React.useRef<ReturnType<typeof waapi.animate> | null>(
		null,
	)
	const mainContentRef = React.useRef<HTMLDivElement>(null)
	const subscreenContentRef = React.useRef<HTMLDivElement>(null)
	const headerTitleRef = React.useRef<HTMLSpanElement>(null)
	const headerBackRef = React.useRef<HTMLButtonElement>(null)
	const prevSubscreenRef = React.useRef<number | null | undefined>(undefined)

	React.useLayoutEffect(() => {
		if (prevSubscreenRef.current !== undefined) return
		if (subscreenContentRef.current) {
			subscreenContentRef.current.style.opacity = '0'
			subscreenContentRef.current.style.transform = 'translateX(80px)'
		}
		if (headerBackRef.current) {
			headerBackRef.current.style.opacity = '0'
			headerBackRef.current.style.transform = 'translateX(40px)'
		}
		prevSubscreenRef.current = subscreen
	}, [subscreen])

	React.useEffect(() => {
		const prevSubscreen = prevSubscreenRef.current
		if (prevSubscreen === subscreen) return

		const isForward = subscreen !== null && prevSubscreen === null

		const leavingContentRef = isForward ? mainContentRef : subscreenContentRef
		const enteringContentRef = isForward ? subscreenContentRef : mainContentRef

		if (leavingContentRef.current) {
			waapi.animate(leavingContentRef.current, {
				translateX: [0, isForward ? -40 : 40],
				opacity: [1, 0],
				ease: springLeave,
				fill: 'forwards',
			})
		}

		if (enteringContentRef.current) {
			waapi.animate(enteringContentRef.current, {
				translateX: [isForward ? 80 : -80, 0],
				opacity: [0, 1],
				ease: springEnter,
				fill: 'forwards',
			})
		}

		if (headerTitleRef.current) {
			waapi.animate(headerTitleRef.current, {
				translateX: isForward ? [0, -40] : [-40, 0],
				opacity: isForward ? [1, 0] : [0, 1],
				ease: isForward ? springLeave : springEnter,
				fill: 'forwards',
			})
		}

		if (headerBackRef.current) {
			waapi.animate(headerBackRef.current, {
				translateX: isForward ? [40, 0] : [0, 40],
				opacity: isForward ? [0, 1] : [1, 0],
				ease: isForward ? springEnter : springLeave,
				fill: 'forwards',
			})
		}

		prevSubscreenRef.current = subscreen
	}, [subscreen])

	const setOpenWithAnimation = React.useCallback((nextOpen: boolean) => {
		const content = contentRef.current
		const wrapper = wrapperRef.current
		const inner = innerRef.current
		if (!content || !wrapper || !inner) return

		if (animationRef.current) {
			animationRef.current.cancel()
			animationRef.current = null
		}

		setOpenState(nextOpen)

		if (nextOpen) {
			const targetHeight = wrapper.getBoundingClientRect().height
			content.style.height = '0px'
			animationRef.current = waapi.animate(content, {
				height: [0, targetHeight],
				ease: springLeave,
			})
			waapi.animate(inner, {
				translateY: ['-40%', '0%'],
				opacity: [0, 1],
				ease: springEnter,
			})
			animationRef.current.then(() => {
				requestAnimationFrame(() => {
					content.style.height = 'auto'
				})
				animationRef.current = null
			})
		} else {
			const currentHeight = content.offsetHeight
			content.style.height = `${currentHeight}px`
			animationRef.current = waapi.animate(content, {
				height: [currentHeight, 0],
				ease: springLeave,
			})
			waapi.animate(inner, {
				scale: [1, 1],
				opacity: [1, 0],
				ease: springLeave,
			})
			animationRef.current.then(() => {
				animationRef.current = null
			})
		}
	}, [])

	const prevControlledOpen = React.useRef(controlledOpen)
	React.useEffect(() => {
		if (
			controlledOpen !== undefined &&
			controlledOpen !== prevControlledOpen.current
		) {
			setOpenWithAnimation(controlledOpen)
			if (!controlledOpen) {
				onSubscreenChange?.(null)
			}
		}
		prevControlledOpen.current = controlledOpen
	}, [controlledOpen, setOpenWithAnimation, onSubscreenChange])

	const handleClick = () => {
		const nextOpen = !open
		onOpenChange?.(nextOpen)
		setOpenWithAnimation(nextOpen)
		if (!nextOpen) {
			onSubscreenChange?.(null)
		}
	}

	return (
		<div className="rounded-xl border border-card-border bg-card-header overflow-hidden">
			<div className="relative h-[44px]">
				<button
					type="button"
					onClick={handleClick}
					aria-expanded={open}
					className={`absolute inset-0 cursor-pointer select-none active:bg-black/[0.01] dark:active:bg-white/[0.02] focus-visible:!outline-2 focus-visible:!outline-accent focus-visible:!outline-offset-[-2px] ${open ? 'rounded-[10px_10px_0_0] focus-visible:!rounded-[10px_10px_0_0]' : 'rounded-[10px] focus-visible:!rounded-[10px]'}`}
				/>
				<div className="absolute inset-0 flex items-center pl-2 pr-2.5 pointer-events-none">
					<span className="flex flex-1 min-w-0 items-center gap-2 text-[16px] font-medium text-primary">
						{subscreens && (
							<button
								ref={headerBackRef}
								type="button"
								onClick={() => onSubscreenChange?.(null)}
								disabled={subscreen == null}
								className="absolute inset-y-0 left-0 flex items-center pl-2 pr-4 text-accent cursor-pointer shrink-0 pointer-events-auto !rounded-tl-[10px] focus-visible:outline-solid focus-visible:!outline-2 focus-visible:outline-accent focus-visible:!-outline-offset-2"
								style={
									subscreen == null
										? {
												opacity: 0,
												transform: 'translateX(40px)',
												pointerEvents: 'none',
											}
										: undefined
								}
							>
								<span className="flex items-center gap-1.5 active:translate-y-px">
									<ArrowLeftIcon className="size-[14px] shrink-0" />
									<span className="truncate max-w-[100px] sm:max-w-[150px] text-[16px] font-medium">
										{subscreen !== null && subscreen !== undefined
											? subscreens[subscreen]?.name
											: subscreens[0]?.name}
									</span>
								</span>
							</button>
						)}
						<span
							ref={headerTitleRef}
							className="flex items-center gap-2 min-w-0"
						>
							<span className="shrink-0">{title}</span>
							{subtitle && (
								<>
									<span className="w-px h-4 bg-card-border shrink-0" />
									<span className="text-[13px] text-tertiary font-normal truncate">
										{subtitle}
									</span>
								</>
							)}
							{titleRight && (
								<>
									<span className="w-px h-4 bg-card-border shrink-0" />
									<span className="pointer-events-auto">{titleRight}</span>
								</>
							)}
						</span>
					</span>
					<span className="flex items-center gap-1.5 pointer-events-auto">
						{headerRight}
						{externalLink && (
							<a
								href={externalLink}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center justify-center size-[24px] rounded-md bg-base-alt active:bg-base-alt/70 focus-visible:outline-solid focus-visible:!outline-2 focus-visible:outline-accent focus-visible:!-outline-offset-2 focus-visible:!rounded-md"
								aria-label="View on external site"
							>
								<GlobeIcon className="size-[14px] text-tertiary" />
							</a>
						)}
						<button
							type="button"
							onClick={handleClick}
							aria-expanded={open}
							aria-label={open ? 'Collapse section' : 'Expand section'}
							className="flex items-center justify-center size-[24px] rounded-md bg-base-alt active:bg-base-alt/70 cursor-pointer focus-visible:outline-solid focus-visible:!outline-2 focus-visible:outline-accent focus-visible:!-outline-offset-2 focus-visible:!rounded-md"
						>
							{open ? (
								<MinusIcon className="size-[14px] text-tertiary" />
							) : (
								<PlusIcon className="size-[14px] text-tertiary" />
							)}
						</button>
					</span>
				</div>
			</div>
			<div
				ref={contentRef}
				className="overflow-hidden"
				style={{ height: open ? 'auto' : 0 }}
				inert={!open}
			>
				<div
					ref={wrapperRef}
					className="bg-card border-t border-card-border px-2 overflow-x-hidden"
				>
					<div ref={innerRef} className="origin-top">
						{subscreens ? (
							<div className="relative overflow-hidden -mx-2">
								<div
									ref={mainContentRef}
									className={
										subscreen != null
											? 'absolute inset-0 pointer-events-none'
											: undefined
									}
									{...(subscreen != null ? { inert: true } : {})}
								>
									{children}
								</div>
								<div
									ref={subscreenContentRef}
									className={
										subscreen == null
											? 'absolute inset-0 pointer-events-none'
											: undefined
									}
									style={
										subscreen == null
											? { opacity: 0, transform: 'translateX(80px)' }
											: undefined
									}
									{...(subscreen == null ? { inert: true } : {})}
								>
									{subscreens[subscreen ?? 0]?.content}
								</div>
							</div>
						) : (
							children
						)}
					</div>
				</div>
			</div>
		</div>
	)
}

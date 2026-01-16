import * as React from 'react'
import type { Address } from 'ox'
import { useTranslation } from 'react-i18next'
import {
	TxDescription,
	preferredEventsFilter,
	type KnownEvent,
} from '#comps/activity'
import { cx } from '#lib/css'
import { useFocusTrap, useEscapeKey } from '#lib/a11y'

function ReceiptMark() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={69}
			height={27}
			viewBox="0 0 92 36"
			fill="none"
		>
			<title>Tempo Receipt</title>
			<path
				className="fill-primary"
				d="M83.722 19.168c2.086 0 4.01-1.495 4.01-4.451s-1.924-4.45-4.01-4.45-4.01 1.494-4.01 4.45 1.925 4.45 4.01 4.45m0-12.747C88.438 6.42 92 9.885 92 14.716s-3.56 8.296-8.278 8.296c-4.717 0-8.277-3.497-8.277-8.296 0-4.8 3.56-8.296 8.277-8.296M62.376 29.098h-4.267v-22.2h4.139v1.908c.706-1.207 2.47-2.258 4.844-2.258 4.62 0 7.282 3.497 7.282 8.138 0 4.64-2.983 8.233-7.442 8.233-2.182 0-3.786-.86-4.556-1.908zm7.796-14.381c0-2.765-1.732-4.386-3.914-4.386s-3.945 1.621-3.945 4.386 1.765 4.418 3.945 4.418 3.914-1.622 3.914-4.418M36.74 22.539h-4.268V6.898h4.074v1.907c.867-1.526 2.887-2.352 4.62-2.352 2.15 0 3.883.922 4.685 2.606 1.252-1.907 2.919-2.606 5.004-2.606 2.919 0 5.71 1.749 5.71 5.944v10.14h-4.138v-9.281c0-1.685-.834-2.956-2.792-2.956-1.829 0-2.919 1.398-2.919 3.083v9.154H42.48v-9.281c0-1.685-.866-2.956-2.79-2.956s-2.95 1.367-2.95 3.083zm-16.964-9.601h7.058c-.064-1.557-1.09-3.083-3.53-3.083-2.213 0-3.432 1.653-3.528 3.083m7.476 4.068 3.56 1.049c-.802 2.702-3.304 4.958-7.186 4.958-4.33 0-8.15-3.084-8.15-8.36 0-4.991 3.723-8.233 7.765-8.233 4.876 0 7.796 3.083 7.796 8.106 0 .604-.065 1.24-.065 1.303H19.68c.097 2.066 1.86 3.56 3.979 3.56 1.989 0 3.08-.986 3.594-2.383"
			/>
			<path
				className="fill-primary"
				d="M18.833 4.164h-7.186v18.373h-4.46V4.164H0V0h18.833zm72.781 30.141v1.158h-33.81v-1.158zm0-3.182v1.157h-33.81v-1.157zm0-3.183v1.158H64.446V27.94zm-81.497 4.668H8.395v3.22H7.188v-8.253h2.894c1.721 0 2.784.96 2.784 2.522 0 1.075-.601 1.968-1.547 2.288l1.704 3.443h-1.365zm-1.722-4.021v3.06h1.518c1.103 0 1.727-.555 1.727-1.527s-.619-1.533-1.686-1.533zM19.58 34.77v1.058h-5.065v-8.253h5.065v1.058h-3.846v2.5h3.63v.995h-3.63v2.642zm4.555.138c1.05 0 1.715-.641 1.739-1.682h1.225c0 1.67-1.184 2.774-2.958 2.774-2.008 0-3.18-1.298-3.18-3.535v-1.527c0-2.237 1.172-3.535 3.18-3.535 1.82 0 2.935 1.081 2.958 2.894h-1.225c-.035-1.08-.735-1.802-1.745-1.802-1.26 0-1.92.841-1.92 2.443v1.527c0 1.602.66 2.442 1.926 2.442m9.503-.137v1.058h-5.065v-8.253h5.065v1.058h-3.845v2.5h3.63v.995h-3.63v2.642zm6.692 1.058h-4.646v-1.035H37.4V28.61h-1.716v-1.035h4.645v1.035h-1.715v6.183h1.715zm2.08-8.253h2.883c1.675 0 2.766 1.058 2.766 2.694 0 1.63-1.109 2.688-2.801 2.688H43.63v2.871h-1.22zm1.22 1.018v3.352h1.365c1.185 0 1.827-.59 1.827-1.676 0-1.093-.642-1.676-1.827-1.676zm9.042 7.235H51.46v-7.195h-2.504v-1.058h6.22v1.058h-2.503z"
			/>
		</svg>
	)
}

function shortenAddress(address: string, chars = 4): string {
	return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`
}

export function TransactionModal({
	hash,
	events,
	viewer,
	transformEvent,
	onClose,
}: {
	hash: string
	events: KnownEvent[]
	viewer: Address.Address
	transformEvent: (event: KnownEvent) => KnownEvent
	onClose: () => void
}) {
	const { t } = useTranslation()
	const [isVisible, setIsVisible] = React.useState(false)
	const overlayRef = React.useRef<HTMLDivElement>(null)
	const focusTrapRef = useFocusTrap(isVisible)

	const handleClose = React.useCallback(() => {
		setIsVisible(false)
		setTimeout(onClose, 200)
	}, [onClose])

	useEscapeKey(handleClose)

	React.useEffect(() => {
		requestAnimationFrame(() => setIsVisible(true))
	}, [])

	const blockNumber = React.useMemo(
		() => Math.floor(Math.random() * 1000000 + 5000000),
		[],
	)

	const timestamp = React.useMemo(() => new Date(), [])
	const formattedDate = timestamp.toLocaleDateString('en-US', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	})
	const formattedTime = timestamp.toLocaleTimeString('en-US', {
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false,
	})

	const filteredEvents = React.useMemo(
		() => events.filter(preferredEventsFilter).map(transformEvent),
		[events, transformEvent],
	)

	return (
		<div
			ref={overlayRef}
			role="presentation"
			className={cx(
				'fixed inset-0 lg:left-[calc(45vw+16px)] z-50 flex items-center justify-center bg-base-background/95 backdrop-blur-md transition-opacity duration-200 p-4',
				isVisible ? 'opacity-100' : 'opacity-0',
			)}
			onClick={handleClose}
		>
			<div
				ref={focusTrapRef}
				role="dialog"
				aria-modal="true"
				aria-label={t('common.transactionReceipt')}
				className={cx(
					'flex flex-col items-center transition-all duration-200',
					isVisible
						? 'opacity-100 scale-100 translate-y-0'
						: 'opacity-0 scale-95 translate-y-4',
				)}
				onClick={(e) => e.stopPropagation()}
			>
				<div
					data-receipt
					className="flex flex-col w-full max-w-[360px] bg-white/5 border-b-0 rounded-[16px] rounded-br-none rounded-bl-none text-base-content"
				>
					<div className="flex flex-col sm:flex-row gap-4 sm:gap-[40px] px-4 sm:px-[20px] pt-5 sm:pt-[24px] pb-4 sm:pb-[16px]">
						<div className="shrink-0 self-center sm:self-start">
							<ReceiptMark />
						</div>
						<div className="flex flex-col gap-[8px] font-mono text-[12px] sm:text-[13px] leading-[16px] flex-1">
							<div className="flex justify-between items-end">
								<span className="text-tertiary">{t('receipt.block')}</span>
								<a
									href={`https://explore.mainnet.tempo.xyz/block/${blockNumber}`}
									target="_blank"
									rel="noopener noreferrer"
									className="text-accent text-right before:content-['#'] press-down"
								>
									{blockNumber}
								</a>
							</div>
							<div className="flex justify-between items-end gap-4">
								<span className="text-tertiary shrink-0">
									{t('receipt.sender')}
								</span>
								<a
									href={`https://explore.mainnet.tempo.xyz/address/${viewer}`}
									target="_blank"
									rel="noopener noreferrer"
									className="text-accent text-right press-down min-w-0 flex-1 flex justify-end"
								>
									{shortenAddress(viewer)}
								</a>
							</div>
							<div className="flex justify-between items-end">
								<span className="text-tertiary shrink-0">
									{t('receipt.hash')}
								</span>
								<span className="text-right">{shortenAddress(hash, 6)}</span>
							</div>
							<div className="flex justify-between items-end">
								<span className="text-tertiary">{t('receipt.date')}</span>
								<span className="text-right">{formattedDate}</span>
							</div>
							<div className="flex justify-between items-end">
								<span className="text-tertiary">{t('receipt.time')}</span>
								<span className="text-right">{formattedTime}</span>
							</div>
						</div>
					</div>

					{filteredEvents.length > 0 && (
						<>
							<div className="border-t border-dashed border-base-border" />
							<div className="flex flex-col gap-3 px-4 sm:px-[20px] py-4 sm:py-[16px] font-mono text-[12px] sm:text-[13px] leading-4 [counter-reset:event]">
								{filteredEvents.map((event, index) => (
									<div
										key={`${event.type}-${index}`}
										className="[counter-increment:event]"
									>
										<div className="flex flex-col gap-[8px]">
											<div className="flex flex-row items-start gap-[4px] grow min-w-0 text-tertiary">
												<div className="flex items-center text-tertiary before:content-[counter(event)_'.'] shrink-0 leading-[24px] min-w-[20px]" />
												<TxDescription
													event={event}
													seenAs={viewer}
													className="flex flex-row items-center gap-[6px] leading-[24px]"
												/>
											</div>
										</div>
									</div>
								))}
							</div>
						</>
					)}
				</div>

				<div className="w-full max-w-[360px]">
					<a
						href={`https://explore.mainnet.tempo.xyz/tx/${hash}`}
						target="_blank"
						rel="noopener noreferrer"
						className="press-down text-[13px] font-sans px-[12px] py-[12px] flex items-center justify-center gap-[8px] bg-white/5 hover:bg-white/10 rounded-bl-[16px] rounded-br-[16px] text-tertiary hover:text-primary transition-colors"
					>
						<span>{t('common.viewTransaction')}</span>
						<span aria-hidden="true">→</span>
					</a>
				</div>
			</div>
		</div>
	)
}

import * as React from 'react'
import { cx } from '#lib/css'
import { useOnrampOrder, useShowApplePay } from '#lib/onramp'
import { ApplePayIframe } from '#comps/ApplePayIframe'
import LoaderIcon from '~icons/lucide/loader-2'

const PRESET_AMOUNTS = [25, 50, 100, 250]
const MIN_AMOUNT = 5
const MAX_AMOUNT = 10000

export function AddFunds(props: AddFunds.Props) {
	const { address, email, phone, phoneVerifiedAt } = props
	const showApplePay = useShowApplePay()
	const [amount, setAmount] = React.useState<number>(50)
	const [customAmount, setCustomAmount] = React.useState<string>('')
	const [isCustom, setIsCustom] = React.useState(false)

	const { createOrder, iframeUrl, isLoading, reset } = useOnrampOrder({
		address,
		email,
		phoneNumber: phone,
		phoneNumberVerifiedAt: phoneVerifiedAt,
		onSuccess: () => {
			console.log('Onramp success!')
		},
		onError: (error) => {
			console.error('Onramp error:', error)
		},
	})

	const effectiveAmount = isCustom ? Number(customAmount) || 0 : amount
	const isValidAmount =
		effectiveAmount >= MIN_AMOUNT && effectiveAmount <= MAX_AMOUNT

	const [isInputFocused, setIsInputFocused] = React.useState(false)

	const handlePresetClick = (value: number) => {
		setAmount(value)
		setCustomAmount(String(value))
		setIsCustom(!isInputFocused)
	}

	const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value.replace(/[^0-9.]/g, '')
		setCustomAmount(value)
		setIsCustom(true)
	}

	const handleInputFocus = () => {
		setIsInputFocused(true)
		setIsCustom(true)
	}

	const handleInputBlur = () => {
		setIsInputFocused(false)
	}

	const handleSubmit = () => {
		if (!isValidAmount) return
		createOrder.mutate({ amount: effectiveAmount })
	}

	const [isIframeLoaded, setIsIframeLoaded] = React.useState(false)
	const isModalOpen = !!iframeUrl

	React.useEffect(() => {
		if (!iframeUrl) {
			setIsIframeLoaded(false)
		}
	}, [iframeUrl])

	if (!showApplePay) {
		return (
			<div className="text-sm text-secondary">
				<p>Apple Pay is only available on Safari mobile.</p>
			</div>
		)
	}

	return (
		<div className="flex flex-col gap-3 py-2.5">
			<div className="flex flex-col gap-1">
				<p className="text-[13px] text-tertiary">
					Add funds to your account using Apple Pay.
				</p>
			</div>

			<div className="flex flex-col gap-2">
				<div className="flex gap-1.5">
					{PRESET_AMOUNTS.map((value) => (
						<button
							key={value}
							type="button"
							onClick={() => handlePresetClick(value)}
							disabled={isModalOpen}
							className={cx(
								'h-[34px] px-3 text-[13px] font-medium rounded-lg cursor-pointer press-down transition-colors border shrink-0',
								!isCustom && amount === value
									? 'bg-accent text-white border-accent'
									: 'bg-white/5 text-secondary hover:text-primary border-card-border hover:border-accent/50',
								isModalOpen && 'opacity-50 cursor-not-allowed',
							)}
						>
							${value}
						</button>
					))}
					<div
						className={cx(
							'flex items-center flex-1 min-w-[80px] h-[34px] rounded-lg border bg-white/5 transition-colors',
							isCustom
								? 'border-accent'
								: 'border-card-border focus-within:border-accent',
						)}
					>
						<span className="text-[13px] text-tertiary pl-2">$</span>
						<input
							type="text"
							inputMode="decimal"
							placeholder="Other"
							value={customAmount}
							onChange={handleCustomChange}
							onFocus={handleInputFocus}
							onBlur={handleInputBlur}
							disabled={isModalOpen}
							className={cx(
								'flex-1 h-full px-1 bg-transparent text-[13px] text-primary font-mono placeholder:text-tertiary focus:outline-none',
								isModalOpen && 'opacity-50 cursor-not-allowed',
							)}
						/>
					</div>
				</div>

				<button
					type="button"
					onClick={handleSubmit}
					disabled={!isValidAmount || isLoading || isModalOpen}
					className={cx(
						'flex items-center justify-center gap-2 w-full h-[40px] text-[14px] font-medium rounded-lg cursor-pointer press-down transition-colors',
						isValidAmount && !isLoading && !isModalOpen
							? 'bg-accent text-white hover:bg-accent/90'
							: 'bg-base-alt text-tertiary cursor-not-allowed',
					)}
				>
					{isLoading || (isModalOpen && !isIframeLoaded) ? (
						<>
							<LoaderIcon className="size-3 animate-spin" />
							<span>Processing...</span>
						</>
					) : (
						<span>Add ${effectiveAmount || 0}</span>
					)}
				</button>

				{createOrder.error && (
					<p className="text-[12px] text-negative">
						Amount must be between ${MIN_AMOUNT} and $
						{MAX_AMOUNT.toLocaleString()}
					</p>
				)}
			</div>

			{/* Always reserve space for the button - same height as Apple Pay button */}
				<div className="relative h-[44px]">
					{isModalOpen && (
						<div className={cx('absolute inset-0', !isIframeLoaded && 'opacity-0')}>
							<ApplePayIframe
								url={iframeUrl}
								onLoad={() => setIsIframeLoaded(true)}
								onCancel={reset}
								inline
							/>
						</div>
					)}
					{/* Loading/placeholder button styled like Apple Pay */}
					{(!isModalOpen || !isIframeLoaded) && (
						<button
							type="button"
							onClick={handleSubmit}
							disabled={!isValidAmount || isLoading || isModalOpen}
							className={cx(
								'absolute inset-0 flex items-center justify-center gap-1.5 w-full h-full text-[16px] font-medium rounded-[22px] cursor-pointer press-down transition-colors',
								isValidAmount && !isLoading && !isModalOpen
									? 'bg-white text-black hover:bg-white/95'
									: 'bg-white/80 text-black/40 cursor-not-allowed',
							)}
						>
							{isLoading || isModalOpen ? (
								<LoaderIcon className="size-4 animate-spin text-black/50" />
							) : (
								<>
									<span>Buy with</span>
									<ApplePayLogo className="h-[20px]" />
								</>
							)}
						</button>
					)}
				</div>

			{createOrder.error && (
				<p className="text-[12px] text-negative">{createOrder.error.message}</p>
			)}
		</div>
	)
}

export declare namespace AddFunds {
	type Props = {
		address: string
		email?: string
		phone?: string
		phoneVerifiedAt?: string
	}
}

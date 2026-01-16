import * as React from 'react'
import { cx } from '#lib/css'
import { useOnrampOrder, useShowApplePay } from '#lib/onramp'
import { ApplePayIframe } from '#comps/ApplePayIframe'
import LoaderIcon from '~icons/lucide/loader-2'

const PRESET_AMOUNTS = [25, 50, 100, 250]
const MIN_AMOUNT = 5
const MAX_AMOUNT = 9999

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
		let value = e.target.value.replace(/[^0-9.]/g, '')

		// Prevent multiple decimal points
		const parts = value.split('.')
		if (parts.length > 2) {
			value = `${parts[0]}.${parts.slice(1).join('')}`
		}

		// Limit to 2 decimal places
		if (parts.length === 2 && parts[1].length > 2) {
			value = `${parts[0]}.${parts[1].slice(0, 2)}`
		}

		// Limit to 4 figures (max 9999)
		const numValue = Number.parseFloat(value)
		if (numValue > MAX_AMOUNT) {
			value = String(MAX_AMOUNT)
		}

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
			</div>

			{/* Apple Pay button area */}
			<div className="relative h-[50px]">
				{/* Apple Pay iframe - shown when ready */}
				{isModalOpen && (
					<div
						className={cx(
							'absolute inset-0 flex gap-2 transition-opacity duration-200',
							isIframeLoaded ? 'opacity-100' : 'opacity-0 pointer-events-none',
						)}
					>
						<div className="flex-1">
							<ApplePayIframe
								url={iframeUrl}
								onLoad={() => setIsIframeLoaded(true)}
								onCancel={reset}
								inline
							/>
						</div>
						<button
							type="button"
							onClick={reset}
							className="h-[50px] px-4 text-[13px] font-medium rounded-xl bg-white/10 text-secondary hover:text-primary hover:bg-white/15 cursor-pointer press-down transition-colors"
						>
							Cancel
						</button>
					</div>
				)}
				{/* Primary button - shown by default and during loading */}
				<button
					type="button"
					onClick={handleSubmit}
					disabled={!isValidAmount || isLoading || isModalOpen}
					className={cx(
						'absolute inset-0 flex items-center justify-center gap-2 w-full h-[50px] text-[15px] font-medium rounded-xl transition-all duration-200',
						isValidAmount && !isLoading && !isModalOpen
							? 'bg-accent text-white hover:bg-accent/90 cursor-pointer press-down'
							: 'bg-accent/60 text-white/70 cursor-not-allowed',
						isModalOpen && isIframeLoaded && 'opacity-0 pointer-events-none',
					)}
				>
					{isLoading || (isModalOpen && !isIframeLoaded) ? (
						<LoaderIcon className="size-4 animate-spin" />
					) : (
						<span>Add ${effectiveAmount || 0} with Apple Pay</span>
					)}
				</button>
			</div>

			{createOrder.error && (
				<p className="text-[12px] text-negative">
					Amount must be between ${MIN_AMOUNT} and $
					{MAX_AMOUNT.toLocaleString()}
				</p>
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

import * as React from 'react'
import { cx } from '#lib/css'
import { useOnrampOrder, useShowApplePay } from '#lib/onramp'
import { ApplePayIframe } from '#comps/ApplePayIframe'

const PRESET_AMOUNTS = [25, 50, 100, 250]
const MAX_AMOUNT = 9999

export function AddFunds(props: AddFunds.Props) {
	const { address, email, phone, phoneVerifiedAt } = props
	const showApplePay = useShowApplePay()
	const [amount, setAmount] = React.useState<number>(50)
	const [customAmount, setCustomAmount] = React.useState<string>('')
	const [isCustom, setIsCustom] = React.useState(false)

	const { createOrder, iframeUrl, reset } = useOnrampOrder({
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

	const [_isIframeLoaded, setIsIframeLoaded] = React.useState(false)
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

			{isModalOpen && (
				<ApplePayIframe
					url={iframeUrl}
					onLoad={() => setIsIframeLoaded(true)}
					onCancel={reset}
				/>
			)}

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

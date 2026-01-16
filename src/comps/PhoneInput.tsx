import * as React from 'react'
import { createPortal } from 'react-dom'
import { cx } from '#lib/css'
import { countries, formatE164, parsePhone, type Country } from '#lib/phone'
import ChevronDownIcon from '~icons/lucide/chevron-down'

export function PhoneInput(props: PhoneInput.Props) {
	const { value, onChange, disabled, onEnter } = props

	const [selectedCountry, setSelectedCountry] = React.useState<Country>(
		countries[0],
	)
	const [nationalNumber, setNationalNumber] = React.useState('')
	const [dropdownOpen, setDropdownOpen] = React.useState(false)
	const [dropdownPosition, setDropdownPosition] = React.useState({
		top: 0,
		left: 0,
		width: 0,
	})
	const containerRef = React.useRef<HTMLDivElement>(null)
	const buttonRef = React.useRef<HTMLButtonElement>(null)

	React.useEffect(() => {
		if (value) {
			const parsed = parsePhone(value)
			setSelectedCountry(parsed.country)
			setNationalNumber(parsed.national)
		}
	}, [value])

	React.useEffect(() => {
		if (!dropdownOpen) return

		const handleClickOutside = (e: MouseEvent) => {
			if (
				containerRef.current &&
				!containerRef.current.contains(e.target as Node)
			) {
				setDropdownOpen(false)
			}
		}

		const updatePosition = () => {
			if (buttonRef.current) {
				const rect = buttonRef.current.getBoundingClientRect()
				setDropdownPosition({
					top: rect.bottom + 4,
					left: rect.left,
					width: 192,
				})
			}
		}

		updatePosition()
		document.addEventListener('mousedown', handleClickOutside)
		window.addEventListener('scroll', updatePosition, true)
		window.addEventListener('resize', updatePosition)

		return () => {
			document.removeEventListener('mousedown', handleClickOutside)
			window.removeEventListener('scroll', updatePosition, true)
			window.removeEventListener('resize', updatePosition)
		}
	}, [dropdownOpen])

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const digits = e.target.value
			.replace(/\D/g, '')
			.slice(0, selectedCountry.maxDigits)
		setNationalNumber(digits)
		onChange(formatE164(selectedCountry, digits))
	}

	const handleCountrySelect = (country: Country) => {
		setSelectedCountry(country)
		setDropdownOpen(false)
		const limitedNational = nationalNumber.slice(0, country.maxDigits)
		setNationalNumber(limitedNational)
		onChange(formatE164(country, limitedNational))
	}

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' && onEnter) {
			onEnter()
		}
	}

	return (
		<div ref={containerRef} className="relative">
			<div
				className={cx(
					'flex items-center w-full rounded-md border transition-colors',
					'bg-base border-card-border hover:border-accent/50 focus-within:border-accent',
					disabled && 'opacity-50 cursor-not-allowed',
				)}
			>
				<button
					ref={buttonRef}
					type="button"
					onClick={() => !disabled && setDropdownOpen(!dropdownOpen)}
					disabled={disabled}
					className={cx(
						'flex items-center gap-1 px-3 py-2 text-[13px] text-primary cursor-pointer',
						'border-r border-card-border hover:bg-base-alt transition-colors rounded-l-md',
						disabled && 'cursor-not-allowed',
					)}
				>
					<span className="font-medium">{selectedCountry.code}</span>
					<ChevronDownIcon className="size-3 text-tertiary" />
				</button>

				<span className="px-2 text-[13px] text-tertiary">
					{selectedCountry.dialCode}
				</span>

				<input
					type="tel"
					inputMode="numeric"
					value={selectedCountry.format(nationalNumber)}
					onChange={handleInputChange}
					onKeyDown={handleKeyDown}
					disabled={disabled}
					placeholder="(555) 123-4567"
					className={cx(
						'flex-1 py-2 pr-3 text-[13px] bg-transparent outline-none',
						'text-primary placeholder:text-tertiary',
						disabled && 'cursor-not-allowed',
					)}
				/>
			</div>

			{dropdownOpen &&
				createPortal(
					<div
						className={cx(
							'fixed z-[9999] max-h-48 overflow-y-auto',
							'bg-card border border-card-border rounded-md shadow-lg',
						)}
						style={{
							top: dropdownPosition.top,
							left: dropdownPosition.left,
							width: dropdownPosition.width,
						}}
					>
						{countries.map((country) => (
							<button
								key={country.code}
								type="button"
								onClick={() => handleCountrySelect(country)}
								className={cx(
									'w-full flex items-center justify-between px-3 py-2 text-[13px] text-left cursor-pointer',
									'hover:bg-base-alt transition-colors',
									country.code === selectedCountry.code &&
										'bg-accent/10 text-accent',
								)}
							>
								<span className="font-medium">{country.code}</span>
								<span className="text-tertiary">{country.dialCode}</span>
							</button>
						))}
					</div>,
					document.body,
				)}
		</div>
	)
}

export declare namespace PhoneInput {
	type Props = {
		value: string
		onChange: (value: string) => void
		disabled?: boolean
		onEnter?: () => void
	}
}

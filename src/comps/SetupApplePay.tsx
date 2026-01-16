import * as React from 'react'
import { cx } from '#lib/css'
import {
	useContactInfo,
	useOnrampStatus,
	useSendOtp,
	useSetEmail,
	useSetPhone,
	useVerifyOtp,
} from '#lib/onramp-contact'
import { AddFunds } from './AddFunds'
import LoaderIcon from '~icons/lucide/loader-2'
import CheckIcon from '~icons/lucide/check'
import ArrowRightIcon from '~icons/lucide/arrow-right'

type Step = 'email' | 'phone' | 'otp' | 'complete'

export function SetupApplePay(props: SetupApplePay.Props) {
	const { address } = props

	const status = useOnrampStatus(address)
	const contactInfo = useContactInfo(address)

	const [step, setStep] = React.useState<Step>('email')
	const [email, setEmail] = React.useState('')
	const [phone, setPhone] = React.useState('')
	const [otp, setOtp] = React.useState('')
	const [otpExpiresAt, setOtpExpiresAt] = React.useState<Date | null>(null)

	const setEmailMutation = useSetEmail(address)
	const setPhoneMutation = useSetPhone(address)
	const sendOtpMutation = useSendOtp(address)
	const verifyOtpMutation = useVerifyOtp(address)

	React.useEffect(() => {
		if (status.data) {
			if (status.data.phoneVerified) {
				setStep('complete')
			} else if (status.data.hasPhone) {
				setStep('otp')
			} else if (status.data.hasEmail) {
				setStep('phone')
			}
		}
	}, [status.data])

	React.useEffect(() => {
		if (contactInfo.data?.email) {
			setEmail(contactInfo.data.email)
		}
		if (contactInfo.data?.phone) {
			setPhone(contactInfo.data.phone)
		}
	}, [contactInfo.data])

	const handleEmailSubmit = async () => {
		if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return
		await setEmailMutation.mutateAsync(email)
		setStep('phone')
	}

	const handlePhoneSubmit = async () => {
		if (!phone || phone.length < 10) return
		await setPhoneMutation.mutateAsync(phone)
		const result = await sendOtpMutation.mutateAsync()
		setOtpExpiresAt(new Date(result.expiresAt))
		setStep('otp')
	}

	const handleResendOtp = async () => {
		const result = await sendOtpMutation.mutateAsync()
		setOtpExpiresAt(new Date(result.expiresAt))
		setOtp('')
	}

	const handleVerifyOtp = async () => {
		if (!/^\d{6}$/.test(otp)) return
		await verifyOtpMutation.mutateAsync(otp)
		setStep('complete')
	}

	if (status.isLoading) {
		return (
			<div className="flex items-center justify-center py-4">
				<LoaderIcon className="size-4 animate-spin text-tertiary" />
			</div>
		)
	}

	if (step === 'complete') {
		return (
			<AddFunds
				address={address}
				email={email}
				phone={phone}
				phoneVerifiedAt={contactInfo.data?.phoneVerifiedAt ?? undefined}
			/>
		)
	}

	return (
		<div className="flex flex-col gap-2 py-2.5">
			{step === 'email' && (
				<EmailStep
					email={email}
					onChange={setEmail}
					onSubmit={handleEmailSubmit}
					isLoading={setEmailMutation.isPending}
					error={setEmailMutation.error?.message}
				/>
			)}

			{step === 'phone' && (
				<PhoneStep
					phone={phone}
					onChange={setPhone}
					onSubmit={handlePhoneSubmit}
					onBack={() => setStep('email')}
					isLoading={setPhoneMutation.isPending || sendOtpMutation.isPending}
					error={
						setPhoneMutation.error?.message ?? sendOtpMutation.error?.message
					}
				/>
			)}

			{step === 'otp' && (
				<OtpStep
					otp={otp}
					onChange={setOtp}
					onSubmit={handleVerifyOtp}
					onResend={handleResendOtp}
					onBack={() => setStep('phone')}
					expiresAt={otpExpiresAt}
					isLoading={verifyOtpMutation.isPending}
					isResending={sendOtpMutation.isPending}
					error={verifyOtpMutation.error?.message}
				/>
			)}
		</div>
	)
}

function StepIndicator(props: { currentStep: Step }) {
	const steps: Step[] = ['email', 'phone', 'otp']
	const currentIndex = steps.indexOf(props.currentStep)

	return (
		<div className="flex items-center justify-center gap-1">
			{steps.map((s, i) => (
				<div
					key={s}
					className={cx(
						'size-1 rounded-full transition-all',
						i <= currentIndex ? 'bg-accent' : 'bg-card-border',
					)}
				/>
			))}
		</div>
	)
}

function EmailStep(props: {
	email: string
	onChange: (value: string) => void
	onSubmit: () => void
	isLoading: boolean
	error?: string
}) {
	const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(props.email)

	return (
		<div className="flex flex-col gap-2">
			<p className="text-[12px] text-tertiary">
				Enter your email address to get started with Apple Pay.
			</p>

			<div className="relative">
				<input
					type="email"
					placeholder="email@example.com"
					value={props.email}
					onChange={(e) => props.onChange(e.target.value)}
					onKeyDown={(e) => e.key === 'Enter' && isValid && props.onSubmit()}
					disabled={props.isLoading}
					className={cx(
						'glass-input w-full pl-3 pr-8 py-1.5 text-[13px] rounded-full outline-none',
						'placeholder:text-tertiary text-primary',
						props.isLoading && 'opacity-50 cursor-not-allowed',
					)}
				/>
				<button
					type="button"
					onClick={props.onSubmit}
					disabled={!isValid || props.isLoading}
					className={cx(
						'absolute right-1.5 top-1/2 -translate-y-1/2 size-4 flex items-center justify-center rounded-full cursor-pointer press-down transition-all',
						isValid && !props.isLoading
							? 'bg-accent text-white'
							: 'bg-card-border/50 text-tertiary cursor-not-allowed',
					)}
				>
					{props.isLoading ? (
						<LoaderIcon className="size-2 animate-spin" />
					) : (
						<ArrowRightIcon className="size-2" />
					)}
				</button>
			</div>

			<StepIndicator currentStep="email" />

			{props.error && (
				<p className="text-[11px] text-negative">{props.error}</p>
			)}
		</div>
	)
}

function PhoneStep(props: {
	phone: string
	onChange: (value: string) => void
	onSubmit: () => void
	onBack: () => void
	isLoading: boolean
	error?: string
}) {
	const formatPhone = (value: string) => {
		const digits = value.replace(/\D/g, '')
		if (!digits.startsWith('1') && digits.length > 0) {
			return `+1${digits}`
		}
		return digits ? `+${digits}` : ''
	}

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		props.onChange(formatPhone(e.target.value))
	}

	const isValid = props.phone.replace(/\D/g, '').length >= 11

	return (
		<div className="flex flex-col gap-2">
			<p className="text-[12px] text-tertiary">
				Enter your phone number. We'll send a verification code.
			</p>

			<div className="relative">
				<input
					type="tel"
					placeholder="+1 (555) 123-4567"
					value={props.phone}
					onChange={handleChange}
					onKeyDown={(e) => e.key === 'Enter' && isValid && props.onSubmit()}
					disabled={props.isLoading}
					className={cx(
						'glass-input w-full pl-3 pr-8 py-1.5 text-[13px] rounded-full outline-none',
						'placeholder:text-tertiary text-primary',
						props.isLoading && 'opacity-50 cursor-not-allowed',
					)}
				/>
				<button
					type="button"
					onClick={props.onSubmit}
					disabled={!isValid || props.isLoading}
					className={cx(
						'absolute right-1.5 top-1/2 -translate-y-1/2 size-4 flex items-center justify-center rounded-full cursor-pointer press-down transition-all',
						isValid && !props.isLoading
							? 'bg-accent text-white'
							: 'bg-card-border/50 text-tertiary cursor-not-allowed',
					)}
				>
					{props.isLoading ? (
						<LoaderIcon className="size-2 animate-spin" />
					) : (
						<ArrowRightIcon className="size-2" />
					)}
				</button>
			</div>

			<StepIndicator currentStep="phone" />

			{props.error && (
				<p className="text-[11px] text-negative">{props.error}</p>
			)}
		</div>
	)
}

function OtpStep(props: {
	otp: string
	onChange: (value: string) => void
	onSubmit: () => void
	onResend: () => void
	onBack: () => void
	expiresAt: Date | null
	isLoading: boolean
	isResending: boolean
	error?: string
}) {
	const [timeLeft, setTimeLeft] = React.useState<number | null>(null)

	React.useEffect(() => {
		if (!props.expiresAt) return

		const expiresAt = props.expiresAt
		const update = () => {
			const diff = expiresAt.getTime() - Date.now()
			setTimeLeft(Math.max(0, Math.floor(diff / 1000)))
		}

		update()
		const interval = setInterval(update, 1000)
		return () => clearInterval(interval)
	}, [props.expiresAt])

	const isExpired = timeLeft === 0

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value.replace(/\D/g, '').slice(0, 6)
		props.onChange(value)
		if (value.length === 6 && !props.isLoading && !isExpired) {
			props.onSubmit()
		}
	}

	const isValid = /^\d{6}$/.test(props.otp)

	return (
		<div className="flex flex-col gap-2">
			<p className="text-[12px] text-tertiary">
				Enter the 6-digit code sent to your phone.
			</p>

			<div className="relative">
				<input
					type="text"
					inputMode="numeric"
					placeholder="000000"
					value={props.otp}
					onChange={handleChange}
					onKeyDown={(e) => e.key === 'Enter' && isValid && props.onSubmit()}
					disabled={props.isLoading || isExpired}
					className={cx(
						'glass-input w-full pl-3 pr-8 py-1.5 text-[13px] rounded-full outline-none text-center tracking-[0.3em] font-mono',
						'placeholder:text-tertiary placeholder:tracking-[0.3em] text-primary',
						(props.isLoading || isExpired) && 'opacity-50 cursor-not-allowed',
					)}
				/>
				<button
					type="button"
					onClick={props.onSubmit}
					disabled={!isValid || props.isLoading || isExpired}
					className={cx(
						'absolute right-1.5 top-1/2 -translate-y-1/2 size-4 flex items-center justify-center rounded-full cursor-pointer press-down transition-all',
						isValid && !props.isLoading && !isExpired
							? 'bg-accent text-white'
							: 'bg-card-border/50 text-tertiary cursor-not-allowed',
					)}
				>
					{props.isLoading ? (
						<LoaderIcon className="size-2 animate-spin" />
					) : (
						<CheckIcon className="size-2" />
					)}
				</button>
			</div>

			<StepIndicator currentStep="otp" />

			<div className="flex items-center justify-between text-[10px]">
				{timeLeft !== null && (
					<span className={cx(isExpired ? 'text-negative' : 'text-tertiary')}>
						{isExpired
							? 'Code expired'
							: `Expires in ${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}`}
					</span>
				)}
				<button
					type="button"
					onClick={props.onResend}
					disabled={props.isResending || props.isLoading}
					className={cx(
						'text-accent font-medium hover:underline cursor-pointer',
						(props.isResending || props.isLoading) &&
							'opacity-50 cursor-not-allowed',
					)}
				>
					{props.isResending ? 'Sending...' : 'Resend code'}
				</button>
			</div>

			{props.error && (
				<p className="text-[11px] text-negative">{props.error}</p>
			)}
		</div>
	)
}

export declare namespace SetupApplePay {
	type Props = {
		address: string
	}
}

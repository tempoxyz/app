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
import { PhoneInput } from './PhoneInput'
import LoaderIcon from '~icons/lucide/loader-2'
import CheckIcon from '~icons/lucide/check'
import ArrowRightIcon from '~icons/lucide/arrow-right'

type Step = 'contact' | 'otp' | 'complete'

export function SetupApplePay(props: SetupApplePay.Props) {
	const { address } = props

	const status = useOnrampStatus(address)
	const contactInfo = useContactInfo(address)

	const [step, setStep] = React.useState<Step>('contact')
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

	const handleContactSubmit = async () => {
		if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return
		if (!phone || phone.replace(/\D/g, '').length < 10) return
		await setEmailMutation.mutateAsync(email)
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
		<div className="flex flex-col gap-3 py-2.5">
			{step === 'contact' && (
				<ContactStep
					email={email}
					phone={phone}
					onEmailChange={setEmail}
					onPhoneChange={setPhone}
					onSubmit={handleContactSubmit}
					isLoading={
						setEmailMutation.isPending ||
						setPhoneMutation.isPending ||
						sendOtpMutation.isPending
					}
					error={
						setEmailMutation.error?.message ??
						setPhoneMutation.error?.message ??
						sendOtpMutation.error?.message
					}
				/>
			)}

			{step === 'otp' && (
				<OtpStep
					otp={otp}
					onChange={setOtp}
					onSubmit={handleVerifyOtp}
					onResend={handleResendOtp}
					onBack={() => setStep('contact')}
					expiresAt={otpExpiresAt}
					isLoading={verifyOtpMutation.isPending}
					isResending={sendOtpMutation.isPending}
					error={verifyOtpMutation.error?.message}
				/>
			)}
		</div>
	)
}

function ContactStep(props: {
	email: string
	phone: string
	onEmailChange: (value: string) => void
	onPhoneChange: (value: string) => void
	onSubmit: () => void
	isLoading: boolean
	error?: string
}) {
	const [showPhone, setShowPhone] = React.useState(false)
	const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(props.email)
	const isPhoneValid = props.phone.replace(/\D/g, '').length >= 10

	const handleEmailContinue = () => {
		if (isEmailValid) {
			setShowPhone(true)
		}
	}

	return (
		<div className="flex flex-col gap-3">
			<label className="flex flex-col gap-1.5">
				<span className="text-[12px] text-secondary">Email address</span>
				<input
					type="email"
					placeholder="email@example.com"
					value={props.email}
					onChange={(e) => props.onEmailChange(e.target.value)}
					onKeyDown={(e) => e.key === 'Enter' && handleEmailContinue()}
					disabled={props.isLoading || showPhone}
					className={cx(
						'w-full px-3 py-2 text-[13px] rounded-md border transition-colors',
						'bg-base placeholder:text-tertiary',
						'border-card-border text-primary hover:border-accent/50 focus:border-accent',
						(props.isLoading || showPhone) && 'opacity-50 cursor-not-allowed',
					)}
				/>
			</label>

			{showPhone && (
				<div className="flex flex-col gap-1.5">
					<span className="text-[12px] text-secondary">Phone</span>
					<PhoneInput
						value={props.phone}
						onChange={props.onPhoneChange}
						disabled={props.isLoading}
						onEnter={() => isPhoneValid && props.onSubmit()}
					/>
				</div>
			)}

			{props.error && (
				<p className="text-[11px] text-negative">{props.error}</p>
			)}

			<button
				type="button"
				onClick={showPhone ? props.onSubmit : handleEmailContinue}
				disabled={showPhone ? !isPhoneValid || props.isLoading : !isEmailValid}
				className={cx(
					'flex items-center justify-center gap-2 w-full py-2.5 text-[13px] font-medium rounded-md cursor-pointer press-down transition-colors',
					(showPhone ? isPhoneValid && !props.isLoading : isEmailValid)
						? 'bg-accent text-white hover:bg-accent/90'
						: 'bg-base-alt text-tertiary cursor-not-allowed',
				)}
			>
				{props.isLoading ? (
					<LoaderIcon className="size-3 animate-spin" />
				) : (
					<>
						<span>Continue</span>
						<ArrowRightIcon className="size-3" />
					</>
				)}
			</button>
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

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value.replace(/\D/g, '').slice(0, 6)
		props.onChange(value)
		if (value.length === 6 && !props.isLoading && !isExpired) {
			props.onSubmit()
		}
	}

	const isValid = /^\d{6}$/.test(props.otp)
	const isExpired = timeLeft === 0

	return (
		<div className="flex flex-col gap-2">
			<p className="text-[12px] text-tertiary">
				Enter the 6-digit code sent to your phone.
			</p>

			<input
				type="text"
				inputMode="numeric"
				placeholder="000000"
				value={props.otp}
				onChange={handleChange}
				onKeyDown={(e) => e.key === 'Enter' && isValid && props.onSubmit()}
				disabled={props.isLoading || isExpired}
				className={cx(
					'w-full px-3 py-2 text-[13px] rounded-md border transition-colors text-center tracking-[0.5em] font-mono',
					'bg-base placeholder:text-tertiary placeholder:tracking-[0.5em]',
					'border-card-border text-primary hover:border-accent/50 focus:border-accent',
					(props.isLoading || isExpired) && 'opacity-50 cursor-not-allowed',
				)}
			/>

			<div className="flex items-center justify-between text-[11px]">
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
						'text-accent hover:underline cursor-pointer',
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

			<div className="flex gap-2">
				<button
					type="button"
					onClick={props.onBack}
					disabled={props.isLoading}
					className="flex-1 py-2.5 text-[13px] font-medium rounded-md bg-base-alt text-secondary hover:text-primary cursor-pointer press-down transition-colors"
				>
					Back
				</button>
				<button
					type="button"
					onClick={props.onSubmit}
					disabled={!isValid || props.isLoading || isExpired}
					className={cx(
						'flex-[2] flex items-center justify-center gap-2 py-2.5 text-[13px] font-medium rounded-md cursor-pointer press-down transition-colors',
						isValid && !props.isLoading && !isExpired
							? 'bg-accent text-white hover:bg-accent/90'
							: 'bg-base-alt text-tertiary cursor-not-allowed',
					)}
				>
					{props.isLoading ? (
						<LoaderIcon className="size-3 animate-spin" />
					) : (
						<>
							<CheckIcon className="size-3" />
							<span>Verify</span>
						</>
					)}
				</button>
			</div>
		</div>
	)
}

export declare namespace SetupApplePay {
	type Props = {
		address: string
	}
}

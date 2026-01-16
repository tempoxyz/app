import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import {
	useConnection,
	useConnectionEffect,
	useConnect,
	useConnectors,
} from 'wagmi'
import { Layout } from '#comps/Layout'
import { cx } from '#lib/css'
import ArrowRight from '~icons/lucide/arrow-right'
import { isAddress } from 'viem'
import UserIcon from '~icons/lucide/user'
import KeyIcon from '~icons/lucide/key-round'
import FingerprintIcon from '~icons/lucide/fingerprint'
import ClockIcon from '~icons/lucide/clock'

const TEMPO_ENV = import.meta.env.VITE_TEMPO_ENV

const EXAMPLE_ACCOUNTS: Record<string, readonly string[]> = {
	presto: [
		'0x195d45da04bd0a8c35800ab322ff9b50ac43e31d',
		'0xe2172991faf09bb280cd138717652d8f71ae2fd6',
		'0xf9711617a58f50cae39b24e919955b70971b3ff2',
	],
	default: [
		'0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
		'0x849151d7D0bF1F34b70d5caD5149D28CC2308bf1',
		'0x50EC05ADe8280758E2077fcBC08D878D4aef79C3',
	],
}

function getExampleAccounts() {
	return EXAMPLE_ACCOUNTS[TEMPO_ENV] ?? EXAMPLE_ACCOUNTS.default
}

function truncateAddress(address: string) {
	return `${address.slice(0, 5)}…${address.slice(-3)}`
}

export const Route = createFileRoute('/_layout/')({
	component: RouteComponent,
})

function RouteComponent() {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const [address, setAddress] = React.useState('')
	const inputRef = React.useRef<HTMLInputElement>(null)

	const connect = useConnect()
	const connection = useConnection()
	const [connector] = useConnectors()
	const [pendingAction, setPendingAction] = React.useState<
		'signup' | 'signin' | 'reconnect' | null
	>(null)

	useConnectionEffect({
		onConnect: (data) => {
			if (data.address)
				navigate({ to: '/$address', params: { address: data.address } })
		},
	})

	React.useEffect(() => {
		if (!connect.isPending) setPendingAction(null)
	}, [connect.isPending])

	const isValidAddress = React.useMemo(
		() => address && isAddress(address),
		[address],
	)

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault()
		if (isValidAddress) navigate({ to: '/$address', params: { address } })
	}

	React.useEffect(() => {
		if (!connection.address) inputRef.current?.focus()
	}, [connection.address])

	return (
		<>
			<Layout.Header left={null} right={null} />
			<div className="flex flex-1 flex-col items-center justify-center">
				<div className="grid place-items-center relative grid-flow-row gap-3 sm:gap-3 select-none w-full max-w-md px-3 sm:px-4 py-6 z-1">
					<h1 className="font-sans font-semibold text-[28px] sm:text-[32px] md:text-[36px] text-primary text-center -tracking-[0.03em]">
						{t('landing.getStarted')}
					</h1>
					<p className="text-secondary text-[13px] sm:text-[14px] md:text-[15px] text-center -mt-3 mb-1 max-w-[280px]">
						{t('landing.exploreDescription')}
					</p>
					<form onSubmit={handleSubmit} className="w-full relative">
						<input
							ref={inputRef}
							type="text"
							name="value"
							value={address}
							onChange={(e) => setAddress(e.target.value)}
							placeholder={t('landing.enterAddress')}
							className="glass-input pl-4 pr-14 w-full placeholder:text-tertiary text-base-content rounded-2xl outline-0 h-[48px] sm:h-[56px] text-[16px]"
							spellCheck={false}
							autoComplete="off"
							autoCapitalize="none"
							autoCorrect="off"
							data-1p-ignore
						/>
						<div className="absolute top-[50%] -translate-y-[50%] right-[12px] sm:right-[14px]">
							<button
								type="submit"
								disabled={!isValidAddress}
								aria-label="Search"
								className={cx(
									'rounded-full flex items-center justify-center active:translate-y-[0.5px] disabled:cursor-not-allowed size-[36px] sm:size-[32px] transition-all',
									isValidAddress
										? 'glass-button-accent cursor-pointer'
										: 'bg-base-alt/50 text-tertiary cursor-default backdrop-blur-sm',
								)}
							>
								<ArrowRight className="size-[18px]" />
							</button>
						</div>
					</form>
					<div className="flex items-center gap-1.5 sm:gap-1 text-[11px] justify-center mt-1 flex-wrap">
						{getExampleAccounts().map((addr) => (
							<Link
								key={addr}
								to="/$address"
								params={{ address: addr }}
								className={cx(
									'flex items-center gap-0.5 text-tertiary hover:text-secondary',
									'px-2 py-1 sm:px-1.5 sm:py-0.5 rounded press-down focus-visible:outline-none',
									'transition-all font-mono text-[11px] sm:text-[10px]',
								)}
							>
								<UserIcon className="size-[10px] text-accent/70" />
								<span>{truncateAddress(addr)}</span>
							</Link>
						))}
					</div>

					<div className="w-full flex items-center gap-2 sm:gap-3 mt-4">
						<div className="flex-1 h-px bg-base-border" />
						<span className="text-tertiary text-[11px] sm:text-[12px] whitespace-nowrap">
							{connection.address
								? t('landing.orUsePasskey')
								: t('landing.orSignInWithPasskey')}
						</span>
						<div className="flex-1 h-px bg-base-border" />
					</div>

					<div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-2 sm:gap-2 mt-3 w-full">
						<button
							type="button"
							onClick={() => {
								if (connector) {
									setPendingAction('signup')
									connect.mutate({
										connector,
										capabilities: { type: 'sign-up' },
									} as Parameters<typeof connect.mutate>[0])
								}
							}}
							disabled={connect.isPending}
							className={cx(
								'flex items-center gap-1.5 sm:gap-1 px-4 sm:px-3 py-2.5 sm:py-1.5 rounded-full justify-center',
								'glass-button-accent font-medium text-[13px] sm:text-[12px]',
								'cursor-pointer press-down border border-transparent hover:border-white/30',
								'disabled:opacity-70 disabled:cursor-not-allowed transition-all',
								'w-full sm:w-auto min-h-[44px] sm:min-h-0',
							)}
						>
							{pendingAction === 'signup' ? (
								<span className="size-[14px] sm:size-[12px] border-2 border-white/30 border-t-white rounded-full animate-spin" />
							) : (
								<KeyIcon className="size-[14px] sm:size-[12px]" />
							)}
							<span>{t('common.signUp')}</span>
						</button>
						<button
							type="button"
							onClick={() => {
								if (connector) {
									setPendingAction('signin')
									connect.mutate({
										connector,
										capabilities: { type: 'sign-in', selectAccount: true },
									} as Parameters<typeof connect.mutate>[0])
								}
							}}
							disabled={connect.isPending}
							className={cx(
								'flex items-center gap-1.5 sm:gap-1 px-4 sm:px-3 py-2.5 sm:py-1.5 rounded-full justify-center',
								'glass-button text-primary font-medium text-[13px] sm:text-[12px]',
								'cursor-pointer press-down border border-transparent hover:border-white/20',
								'disabled:opacity-70 disabled:cursor-not-allowed transition-all',
								'w-full sm:w-auto min-h-[44px] sm:min-h-0',
							)}
						>
							{pendingAction === 'signin' ? (
								<span className="size-[14px] sm:size-[12px] border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
							) : (
								<FingerprintIcon className="size-[14px] sm:size-[12px]" />
							)}
							<span>{t('common.signIn')}</span>
						</button>
						{connection.address && (
							<button
								type="button"
								onClick={() => {
									if (connector) {
										setPendingAction('reconnect')
										connect.mutate({ connector })
									}
								}}
								disabled={connect.isPending}
								className={cx(
									'flex items-center gap-1.5 px-4 sm:px-3 py-2.5 sm:py-1.5 rounded-full justify-center',
									'glass-button text-primary font-medium text-[13px] sm:text-[12px]',
									'cursor-pointer press-down border border-transparent hover:border-accent/30',
									'disabled:opacity-70 disabled:cursor-not-allowed transition-all',
									'w-full sm:w-auto min-h-[44px] sm:min-h-0',
								)}
							>
								{pendingAction === 'reconnect' ? (
									<span className="size-[14px] sm:size-[12px] border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
								) : (
									<ClockIcon className="size-[14px] sm:size-[12px] text-accent" />
								)}
								<span>
									{t('common.continue')}{' '}
									<span className="font-mono text-secondary">
										{truncateAddress(connection.address)}
									</span>
								</span>
							</button>
						)}
					</div>

					{connect.error && (
						<p className="text-negative/70 text-[12px] text-center mt-2">
							{connect.error.message}
						</p>
					)}
				</div>
			</div>
		</>
	)
}

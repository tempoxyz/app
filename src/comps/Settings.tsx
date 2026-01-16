import type { Address } from 'ox'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { waapi } from 'animejs'
import { TokenIcon } from '#comps/TokenIcon'
import { supportedLanguages } from '#lib/i18n'
import { useRovingTabIndex } from '#lib/a11y'
import ChevronRightIcon from '~icons/lucide/chevron-right'

type AssetData = {
	address: Address.Address
	metadata:
		| { name?: string; symbol?: string; decimals?: number; priceUsd?: number }
		| undefined
	balance: string | undefined
	valueUsd: number | undefined
}

const LANGUAGES = supportedLanguages

function shortenAddress(address: string, chars = 4): string {
	return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`
}

export function SettingsMainMenu({
	assets,
	currentFeeToken,
	currentLanguage,
	onNavigate,
}: {
	assets: AssetData[]
	currentFeeToken: string
	currentLanguage: string
	onNavigate: (index: number) => void
}) {
	const { t } = useTranslation()
	const assetsWithBalance = assets.filter((a) => a.balance && a.balance !== '0')
	const currentFeeAsset = assetsWithBalance.find(
		(a) => a.address === currentFeeToken,
	)
	const currentLangObj = LANGUAGES.find((l) => l.code === currentLanguage)

	const mainMenuRoving = useRovingTabIndex<HTMLButtonElement>(2)

	const feeTokenInnerRef = React.useRef<HTMLSpanElement>(null)
	const languageInnerRef = React.useRef<HTMLSpanElement>(null)

	const handlePressDown = React.useCallback((el: HTMLElement | null) => {
		if (!el) return
		el.style.transform = 'translateY(1px)'
	}, [])

	const handlePressUp = React.useCallback((el: HTMLElement | null) => {
		if (!el) return
		waapi.animate(el, {
			translateY: [1, 0],
			duration: 100,
			ease: 'outQuad',
		})
	}, [])

	return (
		<div className="flex flex-col" role="menu" aria-label={t('settings.title')}>
			<button
				type="button"
				role="menuitem"
				ref={mainMenuRoving.setItemRef(0)}
				tabIndex={0}
				onClick={() => onNavigate(0)}
				onKeyDown={(e) => mainMenuRoving.handleKeyDown(e, 0)}
				onMouseDown={() => handlePressDown(feeTokenInnerRef.current)}
				onMouseUp={() => handlePressUp(feeTokenInnerRef.current)}
				aria-label={t('settings.feeToken')}
				className="w-full flex items-center px-2 h-[48px] hover:bg-black/[0.02] dark:hover:bg-white/[0.03] cursor-pointer focus-visible:outline-solid focus-visible:!outline-2 focus-visible:outline-accent focus-visible:!-outline-offset-2"
			>
				<span
					ref={feeTokenInnerRef}
					className="flex items-center gap-2.5 flex-1 min-w-0"
				>
					<span className="flex flex-col flex-1 min-w-0 items-start">
						<span className="text-[16px] text-primary font-medium">
							{t('settings.feeToken')}
						</span>
						<span className="text-[12px] text-tertiary">
							{currentFeeAsset?.metadata?.symbol ||
								(currentFeeToken
									? shortenAddress(currentFeeToken, 3)
									: t('settings.notSet'))}
						</span>
					</span>
					<ChevronRightIcon className="size-[16px] text-tertiary" />
				</span>
			</button>
			<button
				type="button"
				role="menuitem"
				ref={mainMenuRoving.setItemRef(1)}
				tabIndex={0}
				onClick={() => onNavigate(1)}
				onKeyDown={(e) => mainMenuRoving.handleKeyDown(e, 1)}
				onMouseDown={() => handlePressDown(languageInnerRef.current)}
				onMouseUp={() => handlePressUp(languageInnerRef.current)}
				aria-label={t('settings.language')}
				className="w-full flex items-center px-2 h-[48px] hover:bg-black/[0.02] dark:hover:bg-white/[0.03] cursor-pointer !rounded-b-[10px] focus-visible:outline-solid focus-visible:!outline-2 focus-visible:outline-accent focus-visible:!-outline-offset-2"
			>
				<span
					ref={languageInnerRef}
					className="flex items-center gap-2.5 flex-1 min-w-0"
				>
					<span className="flex flex-col flex-1 min-w-0 items-start">
						<span className="text-[16px] text-primary font-medium">
							{t('settings.language')}
						</span>
						<span className="text-[12px] text-tertiary">
							{currentLangObj?.name ||
								LANGUAGES.find((l) => l.code === 'en')?.name ||
								'English'}
						</span>
					</span>
					<ChevronRightIcon className="size-[16px] text-tertiary" />
				</span>
			</button>
		</div>
	)
}

export function SettingsFeeTokenContent({
	assets,
	currentFeeToken,
	onFeeTokenChange,
}: {
	assets: AssetData[]
	currentFeeToken: string
	onFeeTokenChange: (address: string) => void
}) {
	const { t } = useTranslation()
	const assetsWithBalance = assets.filter((a) => a.balance && a.balance !== '0')

	return (
		<div
			className="flex flex-col"
			role="menu"
			aria-label={t('settings.feeToken')}
		>
			<p className="text-[13px] text-tertiary px-2 py-2 text-left">
				{t('settings.feeTokenDescription')}
			</p>
			{assetsWithBalance.length === 0 ? (
				<div className="text-[14px] text-secondary py-4 text-center">
					<p>{t('common.noTokensForFees')}</p>
				</div>
			) : (
				assetsWithBalance.map((asset) => {
					const isCurrent = currentFeeToken === asset.address
					return (
						<div
							key={asset.address}
							role="menuitem"
							className="flex items-center gap-2.5 px-2 h-[48px]"
						>
							<TokenIcon address={asset.address} className="size-[28px]" />
							<span className="flex flex-col flex-1 min-w-0">
								<span className="text-[14px] text-primary font-medium truncate">
									{asset.metadata?.name || shortenAddress(asset.address)}
								</span>
								<span className="text-[12px] text-tertiary font-mono">
									{asset.metadata?.symbol || shortenAddress(asset.address, 3)}
								</span>
							</span>
							{isCurrent ? (
								<span className="text-[12px] font-medium bg-positive/10 text-positive rounded px-1.5 py-0.5 text-center">
									{t('common.active')}
								</span>
							) : (
								<button
									type="button"
									tabIndex={0}
									onClick={() => onFeeTokenChange(asset.address)}
									aria-label={t('common.setToken', {
										token:
											asset.metadata?.name || shortenAddress(asset.address),
									})}
									className="text-[12px] font-medium bg-accent/10 text-accent rounded px-1.5 py-0.5 text-center cursor-pointer press-down hover:bg-accent/20 transition-colors focus-ring"
								>
									{t('common.set')}
								</button>
							)}
						</div>
					)
				})
			)}
		</div>
	)
}

export function SettingsLanguageContent({
	currentLanguage,
	onLanguageChange,
}: {
	currentLanguage: string
	onLanguageChange: (lang: string) => void
}) {
	const { t } = useTranslation()

	return (
		<div
			className="flex flex-col"
			role="menu"
			aria-label={t('settings.language')}
		>
			<p className="text-[13px] text-tertiary px-2 py-2 text-left">
				{t('settings.languageDescription')}
			</p>
			{LANGUAGES.map((lang) => {
				const isCurrent = currentLanguage === lang.code
				return (
					<div
						key={lang.code}
						role="menuitem"
						className="flex items-center gap-2.5 px-2 h-[48px]"
					>
						<span className="flex flex-col flex-1 min-w-0">
							<span className="text-[14px] text-primary font-medium">
								{lang.name}
							</span>
						</span>
						{isCurrent ? (
							<span className="text-[12px] font-medium bg-positive/10 text-positive rounded px-1.5 py-0.5 text-center">
								{lang.active}
							</span>
						) : (
							<button
								type="button"
								tabIndex={0}
								onClick={() => onLanguageChange(lang.code)}
								aria-label={t('settings.setLanguage', {
									language: lang.name,
								})}
								className="text-[12px] font-medium bg-accent/10 text-accent rounded px-1.5 py-0.5 text-center cursor-pointer press-down hover:bg-accent/20 transition-colors focus-ring"
							>
								{lang.set}
							</button>
						)}
					</div>
				)
			})}
		</div>
	)
}

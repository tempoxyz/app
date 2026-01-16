import type { QueryClient } from '@tanstack/react-query'
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
} from '@tanstack/react-router'
import { I18nextProvider, useTranslation } from 'react-i18next'
import { AnnouncerProvider } from '#lib/a11y'
import i18n, { isRtl } from '#lib/i18n'
import css from './styles.css?url'

export const Route = createRootRouteWithContext<{
	queryClient: QueryClient
}>()({
	head: () => ({
		meta: [
			{ charSet: 'utf-8' },
			{ name: 'viewport', content: 'width=device-width, initial-scale=1' },
			{ title: 'Tempo' },
			{ property: 'og:title', content: 'Tempo' },
			{
				name: 'description',
				content:
					'View your balances, send tokens, and track activity on Tempo.',
			},
			{
				property: 'og:description',
				content:
					'View your balances, send tokens, and track activity on Tempo.',
			},
			{
				property: 'og:image',
				content: 'https://app.tempo.xyz/og-image.png',
			},
			{ property: 'og:image:width', content: '1200' },
			{ property: 'og:image:height', content: '630' },
			{ name: 'twitter:card', content: 'summary_large_image' },
			{
				name: 'twitter:image',
				content: 'https://app.tempo.xyz/og-image.png',
			},
		],
		links: [
			// Preload critical fonts to prevent FOUC
			{
				rel: 'preload',
				href: '/fonts/PilatTest-Regular.otf',
				as: 'font',
				type: 'font/otf',
				crossOrigin: 'anonymous',
			},
			{
				rel: 'preload',
				href: '/fonts/PilatTest-Demi.otf',
				as: 'font',
				type: 'font/otf',
				crossOrigin: 'anonymous',
			},
			{
				rel: 'preload',
				href: '/fonts/SourceSerif4-Light.woff2',
				as: 'font',
				type: 'font/woff2',
				crossOrigin: 'anonymous',
			},
			{ rel: 'stylesheet', href: css },
			{
				rel: 'icon',
				type: 'image/svg+xml',
				href: '/favicon-light.svg',
				media: '(prefers-color-scheme: light)',
			},
			{
				rel: 'icon',
				type: 'image/svg+xml',
				href: '/favicon-dark.svg',
				media: '(prefers-color-scheme: dark)',
			},
		],
	}),
	component: RootComponent,
})

function RootComponent() {
	return (
		<I18nextProvider i18n={i18n}>
			<RootDocument />
		</I18nextProvider>
	)
}

function RootDocument() {
	const { i18n: i18nInstance } = useTranslation()
	const lang = i18nInstance.language
	const dir = isRtl(lang) ? 'rtl' : 'ltr'

	return (
		<html
			lang={lang}
			dir={dir}
			className="scheme-light-dark scrollbar-gutter-stable"
		>
			<head>
				<HeadContent />
			</head>
			<body className="antialiased">
				<AnnouncerProvider data-element="announcer-provider">
					<Outlet />
				</AnnouncerProvider>
				<Scripts />
			</body>
		</html>
	)
}

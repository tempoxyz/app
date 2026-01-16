'use client'

import { I18nextProvider, useTranslation } from 'react-i18next'
import { AnnouncerProvider } from '#lib/a11y'
import i18n, { isRtl } from '#lib/i18n'

export function RootProviders({ children }: { children: React.ReactNode }) {
	return (
		<I18nextProvider i18n={i18n}>
			<RootDocument>{children}</RootDocument>
		</I18nextProvider>
	)
}

function RootDocument({ children }: { children: React.ReactNode }) {
	const { i18n: i18nInstance } = useTranslation()
	const lang = i18nInstance.language
	const dir = isRtl(lang) ? 'rtl' : 'ltr'

	return (
		<html lang={lang} dir={dir} className="scheme-light-dark scrollbar-gutter-stable">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<title>Tempo</title>
				<meta property="og:title" content="Tempo" />
				<meta
					name="description"
					content="View your balances, send tokens, and track activity on Tempo."
				/>
				<meta
					property="og:description"
					content="View your balances, send tokens, and track activity on Tempo."
				/>
				<meta property="og:image" content="https://app.tempo.xyz/og-image.png" />
				<meta property="og:image:width" content="1200" />
				<meta property="og:image:height" content="630" />
				<meta name="twitter:card" content="summary_large_image" />
				<meta name="twitter:image" content="https://app.tempo.xyz/og-image.png" />
				<link
					rel="preload"
					href="/fonts/PilatTest-Regular.otf"
					as="font"
					type="font/otf"
					crossOrigin="anonymous"
				/>
				<link
					rel="preload"
					href="/fonts/PilatTest-Demi.otf"
					as="font"
					type="font/otf"
					crossOrigin="anonymous"
				/>
				<link
					rel="preload"
					href="/fonts/SourceSerif4-Light.woff2"
					as="font"
					type="font/woff2"
					crossOrigin="anonymous"
				/>
				<link
					rel="icon"
					type="image/svg+xml"
					href="/favicon-light.svg"
					media="(prefers-color-scheme: light)"
				/>
				<link
					rel="icon"
					type="image/svg+xml"
					href="/favicon-dark.svg"
					media="(prefers-color-scheme: dark)"
				/>
			</head>
			<body className="antialiased">
				<AnnouncerProvider data-element="announcer-provider">
					{children}
				</AnnouncerProvider>
			</body>
		</html>
	)
}

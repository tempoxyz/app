'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as React from 'react'
import { cookieToInitialState, WagmiProvider } from 'wagmi'
import { getWagmiConfig } from '#wagmi.config'
import { ActivityProvider } from '#lib/activity-context'

const queryClient = new QueryClient()

export default function WagmiProviders({
	children,
	cookie,
}: {
	children: React.ReactNode
	cookie: string
}) {
	const [wagmiConfig] = React.useState(() => getWagmiConfig())
	const initialState = React.useMemo(
		() => cookieToInitialState(wagmiConfig, cookie),
		[wagmiConfig, cookie],
	)

	return (
		<WagmiProvider config={wagmiConfig} initialState={initialState}>
			<QueryClientProvider client={queryClient}>
				<ActivityProvider>{children}</ActivityProvider>
			</QueryClientProvider>
		</WagmiProvider>
	)
}

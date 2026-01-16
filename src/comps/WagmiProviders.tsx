'use client'

import * as React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
	cookieToInitialState,
	type State,
	WagmiProvider,
} from 'wagmi'
import { getWagmiConfig } from '#wagmi.config'
import { CommandMenuProvider } from '#comps/CommandMenu'
import { ActivityProvider } from '#lib/activity-context'

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 60 * 1000,
			gcTime: 5 * 60 * 1000,
		},
	},
})

export default function WagmiProviders({
	children,
	cookie,
}: {
	children: React.ReactNode
	cookie: string
}) {
	const [wagmiConfig] = React.useState(() => getWagmiConfig())
	const wagmiState = React.useMemo(() => {
		if (!cookie) return undefined
		try {
			const initialState = cookieToInitialState(wagmiConfig, cookie)
			return initialState as State | undefined
		} catch {
			return undefined
		}
	}, [wagmiConfig, cookie])

	return (
		<WagmiProvider config={wagmiConfig} initialState={wagmiState}>
			<QueryClientProvider client={queryClient}>
				<CommandMenuProvider>
					<ActivityProvider>{children}</ActivityProvider>
				</CommandMenuProvider>
			</QueryClientProvider>
		</WagmiProvider>
	)
}

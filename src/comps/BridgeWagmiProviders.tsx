'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as React from 'react'
import { cookieToInitialState, WagmiProvider } from 'wagmi'
import { getBridgeWagmiConfig } from '#lib/bridge-wagmi.config'

const queryClient = new QueryClient()

export default function BridgeWagmiProviders({
	children,
	cookie,
}: {
	children: React.ReactNode
	cookie: string
}) {
	const [wagmiConfig] = React.useState(() => getBridgeWagmiConfig())
	const initialState = React.useMemo(
		() => cookieToInitialState(wagmiConfig, cookie),
		[wagmiConfig, cookie],
	)

	return (
		// @ts-expect-error Bridge uses a separate wagmi config with different chains/connectors
		<WagmiProvider config={wagmiConfig} initialState={initialState}>
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		</WagmiProvider>
	)
}

import * as React from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { deserialize, type State, WagmiProvider } from 'wagmi'
import { createFileRoute, Outlet } from '@tanstack/react-router'
import {
	getBridgeWagmiConfig,
	getBridgeWagmiStateSSR,
} from './_bridge/-/wagmi.config'
import { Intro } from '#comps/Intro.tsx'
import { Layout } from '#comps/Layout.tsx'

export const Route = createFileRoute('/_bridge')({
	loader: () => getBridgeWagmiStateSSR(),
	component: BridgeLayout,
})

function BridgeLayout() {
	const { queryClient } = Route.useRouteContext()
	const [wagmiConfig] = React.useState(() => getBridgeWagmiConfig())
	const wagmiState = Route.useLoaderData({ select: deserialize<State> })

	return (
		// @ts-expect-error Bridge uses a separate wagmi config with different chains/connectors
		<WagmiProvider config={wagmiConfig} initialState={wagmiState}>
			<QueryClientProvider client={queryClient}>
				<Layout>
					<Layout.Hero>
						<Intro />
					</Layout.Hero>
					<Layout.Content>
						<Outlet />
					</Layout.Content>
				</Layout>
			</QueryClientProvider>
		</WagmiProvider>
	)
}

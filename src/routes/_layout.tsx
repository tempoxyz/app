import { TanStackDevtools } from '@tanstack/react-devtools'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { createFileRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import * as React from 'react'
import { deserialize, type State, WagmiProvider } from 'wagmi'
import { getWagmiConfig, getWagmiStateSSR } from '#wagmi.config'
import { Intro } from '#comps/Intro'
import { Layout } from '#comps/Layout'
import { ActivityProvider } from '#lib/activity-context'
import { config } from '#lib/config'

export const Route = createFileRoute('/_layout')({
	loader: () => getWagmiStateSSR(),
	component: LayoutRoute,
})

function LayoutRoute() {
	const { queryClient } = Route.useRouteContext()
	const [wagmiConfig] = React.useState(() => getWagmiConfig())
	const wagmiState = Route.useLoaderData({ select: deserialize<State> })

	return (
		<WagmiProvider config={wagmiConfig} initialState={wagmiState}>
			<QueryClientProvider client={queryClient}>
				<ActivityProvider>
					<Layout>
						<Layout.Hero>
							<Intro />
						</Layout.Hero>
						<Layout.Content>
							<Outlet />
						</Layout.Content>
					</Layout>
				</ActivityProvider>
				{config.devtools.enabled && (
					<TanStackDevtools
						config={{ position: 'bottom-right' }}
						plugins={[
							{
								name: 'Tanstack Query',
								render: <ReactQueryDevtools />,
							},
							{
								name: 'Tanstack Router',
								render: <TanStackRouterDevtoolsPanel />,
							},
						]}
					/>
				)}
			</QueryClientProvider>
		</WagmiProvider>
	)
}

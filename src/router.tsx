import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { createRouter, Link } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { routeTree } from '#routeTree.gen.ts'

function NotFound() {
	return (
		<div className="flex flex-col items-center justify-center min-h-screen gap-4">
			<p className="text-secondary">Page not found</p>
			<Link to="/" className="text-accent hover:underline">
				Go home
			</Link>
		</div>
	)
}

export const getRouter = () => {
	const queryClient: QueryClient = new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: 60 * 1_000,
				gcTime: 1_000 * 60 * 60 * 24,
				refetchOnWindowFocus: false,
				refetchOnReconnect: () => !queryClient.isMutating(),
			},
		},
		mutationCache: new MutationCache({
			onError: (error) => {
				if (import.meta.env.MODE !== 'development') return
				console.error(error)
			},
		}),
		queryCache: new QueryCache({
			onError: (error, query) => {
				if (import.meta.env.MODE !== 'development') return
				if (query.state.data !== undefined) console.error('[tsq]', error)
			},
		}),
	})

	const router = createRouter({
		routeTree,
		scrollRestoration: true,
		context: { queryClient },
		defaultPreload: 'intent',
		defaultPreloadDelay: 150,
		defaultNotFoundComponent: NotFound,
	})

	setupRouterSsrQueryIntegration({
		router,
		queryClient,
		wrapQueryClient: false,
	})

	return router
}

declare module '@tanstack/react-router' {
	interface Register {
		router: ReturnType<typeof getRouter>
	}
}

import handler, { createServerEntry } from '@tanstack/react-start/server-entry'

export const RPC_AUTH_COOKIE = 'rpc_auth'

function getAuthFromCookie(request: Request): string | null {
	const cookies = request.headers.get('Cookie')
	if (!cookies) return null

	const match = cookies.match(/(?:^|;\s*)http_auth=([^;]+)/)
	if (!match) return null

	return `Basic ${match[1]}`
}

function getRpcAuthFromCookie(request: Request): string | null {
	const cookies = request.headers.get('Cookie')
	if (!cookies) return null
	const prefix = `${RPC_AUTH_COOKIE}=`
	const cookie = cookies.split('; ').find((c) => c.startsWith(prefix))
	if (!cookie) return null
	return `Basic ${cookie.slice(prefix.length)}`
}

function handleAuthParam(request: Request): Response | null {
	const url = new URL(request.url)
	const auth = url.searchParams.get('auth')
	if (!auth) return null

	// Encode if it contains a colon (username:password), otherwise use as-is
	const encoded = auth.includes(':') ? btoa(auth) : auth

	// Remove auth param from URL for redirect
	url.searchParams.delete('auth')

	return new Response(null, {
		status: 302,
		headers: {
			Location: url.pathname + url.search,
			'Set-Cookie': `${RPC_AUTH_COOKIE}=${encoded}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`,
		},
	})
}

function checkHttpAuth(request: Request): Response | null {
	const expectedAuth = process.env.HTTP_AUTH
	if (!expectedAuth) return null

	const unauthorized = new Response('Unauthorized', {
		status: 401,
		headers: { 'WWW-Authenticate': 'Basic realm="App"' },
	})

	// Check Authorization header first, then fall back to cookies (http_auth or rpc_auth)
	let authHeader = request.headers.get('Authorization')
	if (!authHeader) {
		authHeader = getAuthFromCookie(request) ?? getRpcAuthFromCookie(request)
	}

	if (!authHeader?.startsWith('Basic ')) return unauthorized

	const encoded = authHeader.slice(6)
	const decoded = atob(encoded)
	if (decoded !== expectedAuth) return unauthorized

	return null
}

async function checkRpcAuth(request: Request): Promise<Response | null> {
	if (process.env.FORWARD_RPC_AUTH !== '1') return null

	const rpcUrl = process.env.VITE_TEMPO_RPC_HTTP
	if (!rpcUrl) return null

	const unauthorized = new Response('Unauthorized', {
		status: 401,
		headers: { 'WWW-Authenticate': 'Basic realm="App"' },
	})

	const authHeader =
		request.headers.get('Authorization') ?? getRpcAuthFromCookie(request)
	if (!authHeader) return unauthorized

	try {
		const response = await fetch(rpcUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: authHeader,
			},
			body: JSON.stringify({
				jsonrpc: '2.0',
				method: 'eth_chainId',
				params: [],
				id: 1,
			}),
		})
		if (!response.ok) return unauthorized
	} catch {
		return unauthorized
	}

	return null
}

export default createServerEntry({
	fetch: async (request, opts) => {
		// Handle ?auth= param first - sets cookie and redirects
		const authRedirect = handleAuthParam(request)
		if (authRedirect) return authRedirect

		const authResponse = checkHttpAuth(request)
		if (authResponse) return authResponse

		const rpcAuthResponse = await checkRpcAuth(request)
		if (rpcAuthResponse) return rpcAuthResponse

		return handler.fetch(request, opts)
	},
})

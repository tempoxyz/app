import handler, { createServerEntry } from '@tanstack/react-start/server-entry'

function getAuthFromCookie(request: Request): string | null {
	const cookies = request.headers.get('Cookie')
	if (!cookies) return null

	const match = cookies.match(/(?:^|;\s*)http_auth=([^;]+)/)
	if (!match) return null

	return `Basic ${match[1]}`
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
			'Set-Cookie': `http_auth=${encoded}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`,
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

	// Check Authorization header first, then fall back to cookie
	let authHeader = request.headers.get('Authorization')
	if (!authHeader) {
		authHeader = getAuthFromCookie(request)
	}

	if (!authHeader?.startsWith('Basic ')) return unauthorized

	const encoded = authHeader.slice(6)
	const decoded = atob(encoded)
	if (decoded !== expectedAuth) return unauthorized

	return null
}

export default createServerEntry({
	fetch: (request, opts) => {
		// Handle ?auth= param first - sets cookie and redirects
		const authRedirect = handleAuthParam(request)
		if (authRedirect) return authRedirect

		const authResponse = checkHttpAuth(request)
		if (authResponse) return authResponse

		return handler.fetch(request, opts)
	},
})

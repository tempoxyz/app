import handler, { createServerEntry } from '@tanstack/react-start/server-entry'

function checkHttpAuth(request: Request): Response | null {
	const expectedAuth = process.env.HTTP_AUTH
	if (!expectedAuth) return null

	const unauthorized = new Response('Unauthorized', {
		status: 401,
		headers: { 'WWW-Authenticate': 'Basic realm="App"' },
	})

	const authHeader = request.headers.get('Authorization')
	if (!authHeader?.startsWith('Basic ')) return unauthorized

	const encoded = authHeader.slice(6)
	const decoded = atob(encoded)
	if (decoded !== expectedAuth) return unauthorized

	return null
}

export default createServerEntry({
	fetch: (request, opts) => {
		const authResponse = checkHttpAuth(request)
		if (authResponse) return authResponse

		return handler.fetch(request, opts)
	},
})

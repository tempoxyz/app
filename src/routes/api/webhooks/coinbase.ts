import { createFileRoute } from '@tanstack/react-router'
import { handleCoinbaseWebhook } from '#lib/server/onramp/coinbase-webhooks'

export const Route = createFileRoute('/api/webhooks/coinbase')({
	server: {
		handlers: {
			GET: () => {
				return new Response('OK', { status: 200 })
			},
			POST: async ({ request }) => {
				return handleCoinbaseWebhook(request)
			},
		},
	},
})

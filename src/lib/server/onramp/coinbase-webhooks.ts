import { env } from 'cloudflare:workers'
import { fulfillOnramp } from './fulfill'

export type OnrampTransactionEventType =
	| 'onramp.transaction.created'
	| 'onramp.transaction.updated'
	| 'onramp.transaction.success'
	| 'onramp.transaction.failed'

export type OnrampOrderStatus =
	| 'ONRAMP_ORDER_STATUS_PENDING'
	| 'ONRAMP_ORDER_STATUS_IN_PROGRESS'
	| 'ONRAMP_ORDER_STATUS_COMPLETED'
	| 'ONRAMP_ORDER_STATUS_FAILED'

export type OnrampFee = {
	feeAmount: string
	feeCurrency: string
	feeType: 'FEE_TYPE_NETWORK' | 'FEE_TYPE_EXCHANGE'
}

export type OnrampTransactionEvent = {
	eventType: OnrampTransactionEventType
	orderId: string
	partnerUserRef: string
	status: OnrampOrderStatus
	purchaseAmount: string
	purchaseCurrency: string
	destinationAddress: string
	destinationNetwork: string
	paymentMethod: string
	paymentCurrency: string
	paymentSubtotal: string
	paymentTotal: string
	exchangeRate: string
	fees: OnrampFee[]
	txHash?: string
	createdAt: string
	updatedAt: string
}

export async function handleCoinbaseWebhook(
	request: Request,
): Promise<Response> {
	const webhookSecret = env.CB_WEBHOOK_SECRET as string | undefined

	if (!webhookSecret) {
		console.error('[Coinbase Webhook] CB_WEBHOOK_SECRET not configured')
		return new Response('Webhook secret not configured', { status: 500 })
	}

	const signature = request.headers.get('X-Hook0-Signature')
	if (!signature) {
		console.error('[Coinbase Webhook] Missing X-Hook0-Signature header')
		return new Response('Missing signature', { status: 401 })
	}

	const body = await request.text()

	const isValid = await verifyWebhookSignature(
		body,
		signature,
		webhookSecret,
		request.headers,
	)
	if (!isValid) {
		console.error('[Coinbase Webhook] Invalid signature')
		return new Response('Invalid signature', { status: 401 })
	}

	let parsed: unknown
	try {
		parsed = JSON.parse(body)
	} catch {
		console.error('[Coinbase Webhook] Failed to parse webhook body')
		return new Response('Invalid JSON', { status: 400 })
	}

	const event = parsed as OnrampTransactionEvent
	if (!event.orderId) {
		console.error('[Coinbase Webhook] Missing orderId in payload:', parsed)
		return new Response('Invalid payload structure', { status: 400 })
	}

	console.log('[Coinbase Webhook] Received event:', {
		eventType: event.eventType,
		orderId: event.orderId,
		status: event.status,
		destinationAddress: event.destinationAddress,
	})

	await processWebhookEvent(event)

	return new Response('OK', { status: 200 })
}

async function verifyWebhookSignature(
	body: string,
	signature: string,
	secret: string,
	headers: Headers,
): Promise<boolean> {
	try {
		const parts = signature.split(',').reduce(
			(acc, part) => {
				const [key, ...rest] = part.split('=')
				const value = rest.join('=')
				if (key && value) {
					acc[key] = value
				}
				return acc
			},
			{} as Record<string, string>,
		)

		const timestamp = parts.t
		const headerNames = parts.h
		const sig = parts.v1

		if (!timestamp || !sig) {
			console.error(
				'[Coinbase Webhook] Missing timestamp or signature in header',
			)
			return false
		}

		const timestampNum = Number.parseInt(timestamp, 10)
		const now = Math.floor(Date.now() / 1000)
		const tolerance = 300

		if (Math.abs(now - timestampNum) > tolerance) {
			console.error('[Coinbase Webhook] Timestamp outside tolerance window')
			return false
		}

		// Build signed payload according to Coinbase docs:
		// ${timestamp}.${headerNames}.${headerValues}.${body}
		let payload: string
		if (headerNames) {
			const headerNameList = headerNames.split(' ')
			const headerValues = headerNameList
				.map((name) => headers.get(name) || '')
				.join('.')
			payload = `${timestamp}.${headerNames}.${headerValues}.${body}`
		} else {
			// Fallback for older format without headers
			payload = `${timestamp}.${body}`
		}

		const encoder = new TextEncoder()
		const key = await crypto.subtle.importKey(
			'raw',
			encoder.encode(secret),
			{ name: 'HMAC', hash: 'SHA-256' },
			false,
			['sign'],
		)

		const signatureBytes = await crypto.subtle.sign(
			'HMAC',
			key,
			encoder.encode(payload),
		)

		const expectedSig = Array.from(new Uint8Array(signatureBytes))
			.map((b) => b.toString(16).padStart(2, '0'))
			.join('')

		return timingSafeEqual(sig, expectedSig)
	} catch (error) {
		console.error('[Coinbase Webhook] Signature verification error:', error)
		return false
	}
}

function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) {
		return false
	}

	let result = 0
	for (let i = 0; i < a.length; i++) {
		result |= a.charCodeAt(i) ^ b.charCodeAt(i)
	}

	return result === 0
}

async function processWebhookEvent(
	event: OnrampTransactionEvent,
): Promise<void> {
	const { eventType } = event

	switch (eventType) {
		case 'onramp.transaction.created':
			console.log('[Coinbase Webhook] Transaction created:', event.orderId)
			break

		case 'onramp.transaction.updated':
			console.log('[Coinbase Webhook] Transaction updated:', {
				orderId: event.orderId,
				status: event.status,
			})
			break

		case 'onramp.transaction.success':
			console.log('[Coinbase Webhook] Transaction succeeded:', {
				orderId: event.orderId,
				destinationAddress: event.destinationAddress,
				purchaseAmount: event.purchaseAmount,
				purchaseCurrency: event.purchaseCurrency,
				txHash: event.txHash,
			})

			try {
				const receipt = await fulfillOnramp(
					event.destinationAddress as `0x${string}`,
					event.purchaseAmount,
				)
				console.log('[Coinbase Webhook] DONOTUSE sent:', {
					orderId: event.orderId,
					txHash: receipt.transactionHash,
				})
			} catch (error) {
				console.error(
					'[Coinbase Webhook] Failed to send DONOTUSE fulfillment:',
					{
						orderId: event.orderId,
						error,
					},
				)
			}
			break

		case 'onramp.transaction.failed':
			console.error('[Coinbase Webhook] Transaction failed:', {
				orderId: event.orderId,
				destinationAddress: event.destinationAddress,
			})
			break

		default:
			console.warn('[Coinbase Webhook] Unknown event type:', eventType)
	}
}

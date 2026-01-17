import { env } from 'cloudflare:workers'
import { getRequestHeader } from '@tanstack/react-start/server'
import { createServerFn } from '@tanstack/react-start'
import { getAddress } from 'viem'
import * as z from 'zod'
import { createOnrampOrder } from './onramp'
import { config } from '#lib/config'

const createOrderSchema = z.object({
	address: z
		.string()
		.regex(/^0x[a-fA-F0-9]{40}$/)
		.transform((v) => getAddress(v)),
	amount: z.number().min(5).max(10000),
	email: z.string().email().optional(),
	phoneNumber: z.string().min(10).optional(),
	phoneNumberVerifiedAt: z.string().datetime().optional(),
})

type CreateOrderInput = z.input<typeof createOrderSchema>

export const createOnrampOrderFn = createServerFn({ method: 'POST' })
	.inputValidator((input: CreateOrderInput) => createOrderSchema.parse(input))
	.handler(async ({ data }) => {
		const { address, amount, email, phoneNumber, phoneNumberVerifiedAt } = data

		const cbApiKeyId = env.CB_API_KEY_ID as string | undefined
		const cbApiKeySecret = env.CB_API_KEY_SECRET as string | undefined

		if (!cbApiKeyId || !cbApiKeySecret) {
			throw new Error('Coinbase API credentials not configured')
		}

		const origin = getRequestHeader('origin') ?? getRequestHeader('host') ?? ''
		const appDomain = new URL(
			origin.startsWith('http') ? origin : `https://${origin}`,
		).host

		const result = await createOnrampOrder({
			keyId: cbApiKeyId,
			keySecret: cbApiKeySecret,
			destinationAddress: address,
			destinationNetwork: 'base',
			domain: appDomain,
			email: email ?? `${address.slice(0, 10)}@tempo.xyz`,
			phoneNumber: phoneNumber ?? '+17147147144',
			phoneNumberVerifiedAt: phoneNumberVerifiedAt ?? new Date().toISOString(),
			purchaseAmount: amount.toFixed(2),
			sandbox: config.onramp.sandbox,
		})

		console.log('Created onramp order:', result.orderId)

		return result
	})

import { createServerFn } from '@tanstack/react-start'
import { getAddress } from 'viem'
import * as z from 'zod'
import { createOnrampOrder } from './onramp'

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

		let cbApiKeyId: string | undefined
		let cbApiKeySecret: string | undefined
		let appDomain: string
		let environment: string

		try {
			const { env } = await import('cloudflare:workers')
			cbApiKeyId = env.CB_API_KEY_ID as string | undefined
			cbApiKeySecret = env.CB_API_KEY_SECRET as string | undefined
			appDomain =
				env.VITE_TEMPO_ENV === 'presto'
					? 'app.tempo.xyz'
					: env.VITE_TEMPO_ENV === 'moderato'
						? 'app.moderato.tempo.xyz'
						: 'app.devnet.tempo.xyz'
			environment = env.VITE_TEMPO_ENV ?? 'presto'
		} catch {
			cbApiKeyId = process.env.CB_API_KEY_ID
			cbApiKeySecret = process.env.CB_API_KEY_SECRET
			appDomain = 'localhost'
			environment = process.env.VITE_TEMPO_ENV ?? 'development'
		}

		if (!cbApiKeyId || !cbApiKeySecret) {
			throw new Error('Coinbase API credentials not configured')
		}

		const sandbox = environment === 'development' || environment === 'devnet'

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
			sandbox,
		})

		console.log('Created onramp order:', result.orderId)

		return result
	})

export const getOnrampStatusFn = createServerFn({ method: 'GET' })
	.inputValidator((address: string) => {
		if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
			throw new Error('Invalid address')
		}
		return getAddress(address)
	})
	.handler(async () => {
		return { eligible: true }
	})

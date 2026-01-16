export type TempoEnv = 'presto' | 'moderato' | 'devnet'

const tempoEnv = import.meta.env.VITE_TEMPO_ENV as TempoEnv
const isDev = import.meta.env.MODE === 'development'
const isMainnet = tempoEnv === 'presto'

export const config = {
	tempoEnv,
	isDev,
	isMainnet,

	onramp: {
		enabled: !isMainnet,
		apiUrl: import.meta.env.VITE_ONRAMP_API_URL ?? 'http://localhost:8788',
		coinbasePayOrigin: 'https://pay.coinbase.com',
	},

	devtools: {
		enabled: isDev && import.meta.env.VITE_ENABLE_DEVTOOLS === 'true',
	},
} as const

import {
	http,
	injected,
	serialize,
	createConfig,
	cookieStorage,
	createStorage,
	cookieToInitialState,
} from 'wagmi'
import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader } from '@tanstack/react-start/server'
import { coinbaseWallet } from 'wagmi/connectors'
import { sepolia, tempoModerato, baseSepolia } from 'wagmi/chains'

const TEMPO_TESTNET_PATH_USD = '0x20c0000000000000000000000000000000000000'

export function getBridgeWagmiConfig() {
	return createConfig({
		ssr: true,
		chains: [
			sepolia,
			baseSepolia,
			tempoModerato.extend({
				feeToken: TEMPO_TESTNET_PATH_USD,
			}),
		],
		connectors: [injected(), coinbaseWallet({ appName: 'Tempo Bridge' })],
		multiInjectedProviderDiscovery: true,
		storage: createStorage({ storage: cookieStorage, key: 'wagmi-bridge' }),
		transports: {
			[sepolia.id]: http(),
			[baseSepolia.id]: http(),
			[tempoModerato.id]: http(),
		},
	})
}

export const getBridgeWagmiStateSSR = createServerFn().handler(() => {
	const cookie = getRequestHeader('cookie')
	const initialState = cookieToInitialState(getBridgeWagmiConfig(), cookie)
	return serialize(initialState || {})
})

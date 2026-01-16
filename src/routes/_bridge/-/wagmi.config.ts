import {
	http,
	injected,
	serialize,
	createConfig,
	cookieStorage,
	createStorage,
	cookieToInitialState,
} from 'wagmi'
import { tempoPresto } from '#lib/chains.ts'
import { base, mainnet } from 'wagmi/chains'
import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader } from '@tanstack/react-start/server'
import { coinbaseWallet, walletConnect } from 'wagmi/connectors'

export function getBridgeWagmiConfig() {
	return createConfig({
		ssr: true,
		chains: [mainnet, base, tempoPresto],
		connectors: [
			injected(),
			coinbaseWallet({ appName: 'Tempo Bridge' }),
			walletConnect({
				projectId: 'fa6fa7bb341b84d563e665cbd8f91e65',
			}),
		],
		multiInjectedProviderDiscovery: true,
		storage: createStorage({ storage: cookieStorage, key: 'wagmi-bridge' }),
		transports: {
			[base.id]: http(),
			[mainnet.id]: http(),
			[tempoPresto.id]: http(),
		},
	})
}

export const getBridgeWagmiStateSSR = createServerFn().handler(() => {
	const cookie = getRequestHeader('cookie')
	const initialState = cookieToInitialState(getBridgeWagmiConfig(), cookie)
	return serialize(initialState || {})
})

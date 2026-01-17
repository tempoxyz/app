import {
	http,
	injected,
	createConfig,
	cookieStorage,
	createStorage,
} from 'wagmi'
import { tempoPresto } from '#lib/chains'
import { base, mainnet } from 'wagmi/chains'
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

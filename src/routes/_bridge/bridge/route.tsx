import {
	type Connector,
	useConnect,
	useEnsName,
	useEnsAvatar,
	useConnection,
	useConnectors,
	useDisconnect,
} from 'wagmi'
import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_bridge/bridge')({
	component: BridgeRoute,
})

function BridgeRoute() {
	return (
		<main className="">
			<ConnectWallet />
		</main>
	)
}

function ConnectWallet() {
	const { isConnected } = useConnection()
	if (isConnected) return <Connection />
	return <WalletOptions />
}

function WalletOptions() {
	const connectors = useConnectors()
	const { mutate: connect } = useConnect()

	return (
		<ul>
			{connectors.map((connector) => (
				<li key={connector.uid}>
					<WalletOption
						connector={connector}
						onClick={() => connect({ connector })}
					/>
				</li>
			))}
		</ul>
	)
}

function WalletOption({
	connector,
	onClick,
}: {
	connector: Connector
	onClick: () => void
}) {
	const [ready, setReady] = React.useState(false)

	React.useEffect(() => {
		;(async () => {
			const provider = await connector.getProvider()
			setReady(!!provider)
		})()
	}, [connector])

	return (
		<button type="button" disabled={!ready} onClick={onClick}>
			{connector.name}
		</button>
	)
}

function Connection() {
	const { address } = useConnection()
	const { mutate: disconnect } = useDisconnect()
	const { data: ensName } = useEnsName({ address })
	const { data: ensAvatar } = useEnsAvatar({
		name: `${ensName}`,
		query: { enabled: ensName?.endsWith('.eth') },
	})

	return (
		<div>
			{ensAvatar && <img alt="ENS Avatar" src={ensAvatar} />}
			{address && <div>{ensName ? `${ensName} (${address})` : address}</div>}
			<button type="button" onClick={() => disconnect()}>
				Disconnect
			</button>
		</div>
	)
}

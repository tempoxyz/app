import { BridgePage } from '#comps/BridgePage'

export default function BridgeRoute() {
	return <BridgePage />
}

export function getConfig() {
	return {
		render: 'dynamic',
	} as const
}

import { Address } from 'ox'
import { AddressPage } from '#comps/AddressPage'
import { fetchAssets } from '#lib/server/assets.server'

type Props = {
	address: string
}

export default async function AddressRoute({ address }: Props) {
	if (!Address.validate(address)) {
		return (
			<div className="flex flex-1 items-center justify-center">
				<div className="text-center">
					<h1 className="text-xl font-semibold mb-2">Invalid Address</h1>
					<p className="text-secondary mb-4">
						The provided address is not valid.
					</p>
					<a href="/" className="text-accent hover:underline">
						Go back home
					</a>
				</div>
			</div>
		)
	}

	const assets = await fetchAssets(address)

	return (
		<AddressPage
			address={address as Address.Address}
			initialAssets={assets ?? []}
		/>
	)
}

export function getConfig() {
	return {
		render: 'dynamic',
	} as const
}

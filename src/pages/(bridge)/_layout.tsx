import { unstable_getHeaders as getHeaders } from 'waku/server'
import { Intro } from '#comps/Intro'
import { Layout } from '#comps/Layout'
import { BridgeLayoutClient } from '#comps/BridgeLayoutClient'

export default async function BridgeLayout({
	children,
}: {
	children: React.ReactNode
}) {
	const headers = getHeaders()
	const cookie = headers?.cookie ?? ''

	return (
		<Layout>
			<Layout.Hero>
				<Intro />
			</Layout.Hero>
			<Layout.Content>
				<BridgeLayoutClient cookie={cookie}>{children}</BridgeLayoutClient>
			</Layout.Content>
		</Layout>
	)
}

export function getConfig() {
	return {
		render: 'dynamic',
	} as const
}

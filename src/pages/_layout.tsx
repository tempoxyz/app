import { unstable_getHeaders as getHeaders } from 'waku/server'
import { Intro } from '#comps/Intro'
import { Layout } from '#comps/Layout'
import { LayoutClient } from '#comps/LayoutClient'

export default async function LayoutPage({
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
				<LayoutClient cookie={cookie}>{children}</LayoutClient>
			</Layout.Content>
		</Layout>
	)
}

export function getConfig() {
	return {
		render: 'dynamic',
	} as const
}

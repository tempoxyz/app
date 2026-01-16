import { createPortal } from 'react-dom'
import { createFileRoute } from '@tanstack/react-router'
import { Layout } from '#comps/Layout.tsx'

export const Route = createFileRoute('/_layout/bridge')({
	component: RouteComponent,
})

function RouteComponent() {
	const announcerProvider = document.querySelector(
		'[data-element="announcer-provider"]',
	)
	if (!announcerProvider) return null
	return createPortal(
		<main>
			<Layout.Header left={null} right={null} />
			<Layout.Content>
				<div>
					<h1>Bridge</h1>
				</div>
			</Layout.Content>
		</main>,
		announcerProvider,
	)
}

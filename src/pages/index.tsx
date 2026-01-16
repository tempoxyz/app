import { HomePage } from '#comps/HomePage'

export default function IndexPage() {
	return <HomePage />
}

export function getConfig() {
	return {
		render: 'dynamic',
	} as const
}

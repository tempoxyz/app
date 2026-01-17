import { RootProviders } from '#comps/RootProviders'
import '#styles.css'

export default function Root({ children }: { children: React.ReactNode }) {
	return <RootProviders>{children}</RootProviders>
}

export function getConfig() {
	return {
		render: 'static',
	} as const
}

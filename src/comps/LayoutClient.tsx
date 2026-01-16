'use client'

import * as React from 'react'
import WagmiProviders from '#comps/WagmiProviders'

export function LayoutClient({
	children,
	cookie,
}: {
	children: React.ReactNode
	cookie: string
}) {
	return <WagmiProviders cookie={cookie}>{children}</WagmiProviders>
}

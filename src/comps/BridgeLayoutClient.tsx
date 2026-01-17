'use client'

import type * as React from 'react'
import BridgeWagmiProviders from '#comps/BridgeWagmiProviders'

export function BridgeLayoutClient({
	children,
	cookie,
}: {
	children: React.ReactNode
	cookie: string
}) {
	return <BridgeWagmiProviders cookie={cookie}>{children}</BridgeWagmiProviders>
}

import * as React from 'react'
import type { PropsWithChildren } from 'react'
import { waapi, spring } from 'animejs'

const LAYOUT_PADDING = 20 // px, desktop spacing all around
const contentSpring = spring({ mass: 1, stiffness: 800, damping: 60 })

export function Layout(props: PropsWithChildren) {
	return (
		// biome-ignore lint/correctness/useUniqueElementIds: _
		<main
			id="main-content"
			className="mx-auto flex min-h-dvh max-md:flex-col"
			{...props}
		/>
	)
}

export namespace Layout {
	export function Hero(props: PropsWithChildren) {
		return (
			<div
				className="fixed w-[40vw] max-md:hidden"
				style={{
					top: LAYOUT_PADDING,
					left: LAYOUT_PADDING,
					bottom: LAYOUT_PADDING,
				}}
				{...props}
			/>
		)
	}

	export function Content(props: PropsWithChildren) {
		const ref = React.useRef<HTMLDivElement>(null)

		React.useEffect(() => {
			const el = ref.current
			if (!el) return
			waapi.animate(el, {
				opacity: [0, 1],
				scale: [0.98, 1],
				ease: contentSpring,
			})
		}, [])

		return (
			<div
				ref={ref}
				style={{ opacity: 0 }}
				className="flex w-full flex-1 flex-col md:ml-[calc(40vw+100px)] md:pt-[60px] md:pb-[60px] md:pr-[60px] max-md:pt-3 max-md:pb-0"
			>
				<div className="flex w-full flex-1 flex-col max-md:px-3">
					{props.children}
				</div>
			</div>
		)
	}

	export function Header(props: {
		left?: React.ReactNode
		right?: React.ReactNode
	}) {
		const { left, right } = props
		if (!left && !right) return null
		return (
			<div className="flex items-center justify-between min-h-[44px] max-md:hidden">
				<div>{left}</div>
				{right}
			</div>
		)
	}
}

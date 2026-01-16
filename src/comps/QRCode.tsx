import * as React from 'react'
import { encode } from 'uqr'
import { cx } from '#lib/css'
import { useCopy } from '#lib/hooks'

export function QRCode({
	value,
	size = 100,
	className,
}: {
	value: string
	size?: number | 'full'
	className?: string
}) {
	const { data } = encode(value)
	const gridSize = data.length
	const cellSize = 100 / gridSize

	const cells: Array<{ x: number; y: number }> = []
	for (let y = 0; y < data.length; y++) {
		for (let x = 0; x < data[y].length; x++) {
			if (data[y][x]) cells.push({ x, y })
		}
	}

	const { copy, notifying } = useCopy({ timeout: 1500 })
	const [mousePos, setMousePos] = React.useState<{
		x: number
		y: number
	} | null>(null)
	const svgRef = React.useRef<SVGSVGElement>(null)

	const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
		const svg = svgRef.current
		if (!svg) return
		const rect = svg.getBoundingClientRect()
		const x = ((e.clientX - rect.left) / rect.width) * 100
		const y = ((e.clientY - rect.top) / rect.height) * 100
		setMousePos({ x, y })
	}

	const isFull = size === 'full'

	return (
		<svg
			ref={svgRef}
			role="img"
			aria-label="QR Code - Click to copy address"
			className={cx(
				'rounded-lg bg-surface p-1.5 cursor-pointer outline-none border border-base-border hover:border-accent/50 transition-colors',
				isFull && 'w-full aspect-square',
				className,
			)}
			width={isFull ? undefined : size}
			height={isFull ? undefined : size}
			viewBox="0 0 100 100"
			onClick={() => copy(value)}
			onKeyDown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') copy(value)
			}}
			onMouseMove={handleMouseMove}
			onMouseLeave={() => setMousePos(null)}
		>
			<title>QR Code</title>
			{cells.map(({ x, y }) => {
				let opacity = 0.6
				if (mousePos && !notifying) {
					const cellCenterX = x * cellSize + cellSize / 2
					const cellCenterY = y * cellSize + cellSize / 2
					const distance = Math.sqrt(
						(cellCenterX - mousePos.x) ** 2 + (cellCenterY - mousePos.y) ** 2,
					)
					const maxBrightRadius = 40
					const brightness = 1 - Math.min(1, distance / maxBrightRadius)
					opacity = 0.5 + brightness * 0.5
				}
				return (
					<rect
						key={`${x}-${y}`}
						x={x * cellSize}
						y={y * cellSize}
						width={cellSize}
						height={cellSize}
						fill={notifying ? '#22c55e' : 'currentColor'}
						className="text-primary"
						style={{
							opacity,
							transition: 'fill 0.2s ease-out, opacity 0.15s ease-out',
							filter:
								mousePos && !notifying
									? `blur(${Math.max(0, (1 - opacity) * 0.3)}px)`
									: undefined,
						}}
					/>
				)
			})}
		</svg>
	)
}

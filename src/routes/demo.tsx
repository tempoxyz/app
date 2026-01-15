import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ShaderGradient } from '#comps/ShaderGradient'

export const Route = createFileRoute('/demo')({
	component: Demo,
})

const COLORS: Array<[number, number, number]> = [
	[0.231, 0.510, 0.965], // blue - send
	[0.133, 0.773, 0.369], // green - received
	[0.545, 0.361, 0.965], // purple - swap
]

function CSSGradient() {
	const [time, setTime] = React.useState(0)
	const intensity = 0.7

	React.useEffect(() => {
		let frame: number
		const animate = () => {
			setTime((t) => t + 1)
			frame = requestAnimationFrame(animate)
		}
		frame = requestAnimationFrame(animate)
		return () => cancelAnimationFrame(frame)
	}, [])

	const rotation = (time * 0.3 * (0.5 + intensity * 0.5)) % 360
	const posX = 30 + Math.sin(time * 0.008) * 20 * intensity
	const posY = 70 + Math.cos(time * 0.006) * 15 * intensity
	const pulse = 0.12 + Math.sin(time * 0.02) * 0.08 * intensity
	const scale = 1 + Math.sin(time * 0.01) * 0.15 * intensity

	const colors = ['#3b82f6', '#22c55e', '#8b5cf6']
	const step = 360 / colors.length
	const gradientStops = colors.map((color, i) => `${color} ${i * step}deg`).join(', ')

	return (
		<div
			className="absolute inset-6 pointer-events-none rounded-2xl"
			style={{
				opacity: pulse + intensity * 0.1,
				background: `conic-gradient(from ${rotation}deg at ${posX}% ${posY}%, ${gradientStops}, ${colors[0]} 360deg)`,
				filter: 'blur(80px)',
				transform: `scale(${scale})`,
			}}
		/>
	)
}

function Demo() {
	return (
		<div className="fixed inset-0 bg-base flex">
			{/* CSS Version */}
			<div className="relative w-1/2 h-full border-r border-white/10">
				<div className="absolute top-4 left-4 text-white/50 text-sm font-mono z-10">
					CSS (current)
				</div>
				<CSSGradient />
			</div>

			{/* Shader Version */}
			<div className="relative w-1/2 h-full">
				<div className="absolute top-4 left-4 text-white/50 text-sm font-mono z-10">
					WebGL Shader
				</div>
				<ShaderGradient colors={COLORS} intensity={0.7} />
			</div>
		</div>
	)
}

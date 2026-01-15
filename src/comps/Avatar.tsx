import * as React from 'react'
import { cx } from '#lib/css'

/**
 * Tempo Avatar - A deterministic avatar system for wallet addresses
 *
 * The Tempo mascot is "Tempo", a friendly musical note character with
 * personality. Each wallet address maps to unique avatar attributes:
 * - Background color (from a curated palette)
 * - Face expression (happy, cool, chill, excited, zen)
 * - Accessory (none, hat, headphones, sunglasses, crown, bowtie)
 * - Body color accent
 */

// Curated color palette for backgrounds - vibrant but harmonious
const BG_COLORS = [
	'#FF6B6B', // coral red
	'#4ECDC4', // teal
	'#45B7D1', // sky blue
	'#96CEB4', // sage green
	'#FFEAA7', // soft yellow
	'#DDA0DD', // plum
	'#98D8C8', // mint
	'#F7DC6F', // golden
	'#BB8FCE', // lavender
	'#85C1E9', // light blue
	'#F8B500', // amber
	'#00CED1', // dark cyan
	'#FF7F50', // coral
	'#9370DB', // medium purple
	'#20B2AA', // light sea green
	'#FFB6C1', // light pink
]

// Body/accent colors
const BODY_COLORS = [
	'#2D3436', // charcoal
	'#636E72', // gray
	'#00B894', // green
	'#0984E3', // blue
	'#6C5CE7', // purple
	'#E17055', // terracotta
	'#FDCB6E', // mustard
	'#E84393', // pink
]

// Face expressions
type Expression = 'happy' | 'cool' | 'chill' | 'excited' | 'zen'
const EXPRESSIONS: Expression[] = ['happy', 'cool', 'chill', 'excited', 'zen']

// Accessories
type Accessory =
	| 'none'
	| 'hat'
	| 'headphones'
	| 'sunglasses'
	| 'crown'
	| 'bowtie'
const ACCESSORIES: Accessory[] = [
	'none',
	'hat',
	'headphones',
	'sunglasses',
	'crown',
	'bowtie',
]

/**
 * Deterministically derive avatar traits from an address
 */
function getAvatarTraits(address: string) {
	// Use different parts of the address for different traits
	const cleanAddr = address.toLowerCase().replace('0x', '')

	// Use hex chunks to derive indices
	const bgIndex = Number.parseInt(cleanAddr.slice(0, 2), 16) % BG_COLORS.length
	const bodyIndex =
		Number.parseInt(cleanAddr.slice(2, 4), 16) % BODY_COLORS.length
	const expressionIndex =
		Number.parseInt(cleanAddr.slice(4, 6), 16) % EXPRESSIONS.length
	const accessoryIndex =
		Number.parseInt(cleanAddr.slice(6, 8), 16) % ACCESSORIES.length

	// Extra variation: rotation angle for the musical note
	const rotation = (Number.parseInt(cleanAddr.slice(8, 10), 16) % 30) - 15

	return {
		bgColor: BG_COLORS[bgIndex],
		bodyColor: BODY_COLORS[bodyIndex],
		expression: EXPRESSIONS[expressionIndex],
		accessory: ACCESSORIES[accessoryIndex],
		rotation,
	}
}

/**
 * Render the face expression
 */
function renderExpression(expression: Expression, bodyColor: string) {
	switch (expression) {
		case 'happy':
			return (
				<>
					{/* Eyes - happy curved */}
					<ellipse cx="35" cy="42" rx="4" ry="3" fill={bodyColor} />
					<ellipse cx="55" cy="42" rx="4" ry="3" fill={bodyColor} />
					{/* Smile */}
					<path
						d="M 35 52 Q 45 60 55 52"
						stroke={bodyColor}
						strokeWidth="2.5"
						fill="none"
						strokeLinecap="round"
					/>
				</>
			)
		case 'cool':
			return (
				<>
					{/* Eyes - relaxed lines */}
					<line
						x1="31"
						y1="42"
						x2="39"
						y2="42"
						stroke={bodyColor}
						strokeWidth="2.5"
						strokeLinecap="round"
					/>
					<line
						x1="51"
						y1="42"
						x2="59"
						y2="42"
						stroke={bodyColor}
						strokeWidth="2.5"
						strokeLinecap="round"
					/>
					{/* Smirk */}
					<path
						d="M 38 52 Q 48 56 58 52"
						stroke={bodyColor}
						strokeWidth="2.5"
						fill="none"
						strokeLinecap="round"
					/>
				</>
			)
		case 'chill':
			return (
				<>
					{/* Eyes - half closed */}
					<path
						d="M 31 42 Q 35 40 39 42"
						stroke={bodyColor}
						strokeWidth="2.5"
						fill="none"
						strokeLinecap="round"
					/>
					<path
						d="M 51 42 Q 55 40 59 42"
						stroke={bodyColor}
						strokeWidth="2.5"
						fill="none"
						strokeLinecap="round"
					/>
					{/* Relaxed smile */}
					<path
						d="M 37 53 L 53 53"
						stroke={bodyColor}
						strokeWidth="2.5"
						fill="none"
						strokeLinecap="round"
					/>
				</>
			)
		case 'excited':
			return (
				<>
					{/* Eyes - wide open */}
					<circle cx="35" cy="42" r="5" fill={bodyColor} />
					<circle cx="55" cy="42" r="5" fill={bodyColor} />
					{/* Highlight */}
					<circle cx="33" cy="40" r="1.5" fill="white" />
					<circle cx="53" cy="40" r="1.5" fill="white" />
					{/* Big smile */}
					<path
						d="M 32 52 Q 45 65 58 52"
						stroke={bodyColor}
						strokeWidth="2.5"
						fill="none"
						strokeLinecap="round"
					/>
				</>
			)
		case 'zen':
			return (
				<>
					{/* Eyes - closed curves */}
					<path
						d="M 31 42 Q 35 38 39 42"
						stroke={bodyColor}
						strokeWidth="2.5"
						fill="none"
						strokeLinecap="round"
					/>
					<path
						d="M 51 42 Q 55 38 59 42"
						stroke={bodyColor}
						strokeWidth="2.5"
						fill="none"
						strokeLinecap="round"
					/>
					{/* Peaceful smile */}
					<path
						d="M 38 54 Q 45 58 52 54"
						stroke={bodyColor}
						strokeWidth="2"
						fill="none"
						strokeLinecap="round"
					/>
				</>
			)
	}
}

/**
 * Render the accessory
 */
function renderAccessory(accessory: Accessory, bodyColor: string) {
	switch (accessory) {
		case 'hat':
			return (
				<g>
					{/* Beanie */}
					<ellipse cx="45" cy="22" rx="22" ry="10" fill={bodyColor} />
					<rect x="23" y="18" width="44" height="8" fill={bodyColor} />
					{/* Pom pom */}
					<circle cx="45" cy="14" r="5" fill="white" opacity="0.8" />
				</g>
			)
		case 'headphones':
			return (
				<g>
					{/* Headband */}
					<path
						d="M 20 40 Q 20 15 45 12 Q 70 15 70 40"
						stroke={bodyColor}
						strokeWidth="4"
						fill="none"
					/>
					{/* Ear cups */}
					<ellipse cx="20" cy="42" rx="7" ry="9" fill={bodyColor} />
					<ellipse cx="70" cy="42" rx="7" ry="9" fill={bodyColor} />
					{/* Inner detail */}
					<ellipse cx="20" cy="42" rx="4" ry="6" fill="white" opacity="0.3" />
					<ellipse cx="70" cy="42" rx="4" ry="6" fill="white" opacity="0.3" />
				</g>
			)
		case 'sunglasses':
			return (
				<g>
					{/* Bridge */}
					<path
						d="M 40 40 L 50 40"
						stroke={bodyColor}
						strokeWidth="2"
						strokeLinecap="round"
					/>
					{/* Lenses */}
					<rect
						x="25"
						y="36"
						width="15"
						height="10"
						rx="2"
						fill={bodyColor}
						opacity="0.9"
					/>
					<rect
						x="50"
						y="36"
						width="15"
						height="10"
						rx="2"
						fill={bodyColor}
						opacity="0.9"
					/>
					{/* Shine */}
					<rect x="27" y="38" width="4" height="2" rx="1" fill="white" opacity="0.4" />
					<rect x="52" y="38" width="4" height="2" rx="1" fill="white" opacity="0.4" />
				</g>
			)
		case 'crown':
			return (
				<g>
					{/* Crown base */}
					<path
						d="M 25 28 L 28 18 L 37 24 L 45 12 L 53 24 L 62 18 L 65 28 Z"
						fill="#FFD700"
						stroke="#DAA520"
						strokeWidth="1"
					/>
					{/* Jewels */}
					<circle cx="45" cy="20" r="2.5" fill="#FF6B6B" />
					<circle cx="33" cy="22" r="2" fill="#4ECDC4" />
					<circle cx="57" cy="22" r="2" fill="#4ECDC4" />
				</g>
			)
		case 'bowtie':
			return (
				<g>
					{/* Bowtie */}
					<path
						d="M 45 68 L 32 62 L 32 74 L 45 68 L 58 62 L 58 74 Z"
						fill={bodyColor}
					/>
					{/* Center knot */}
					<circle cx="45" cy="68" r="3" fill="white" opacity="0.5" />
				</g>
			)
		case 'none':
		default:
			return null
	}
}

export interface AvatarProps {
	address: string
	size?: number
	className?: string
}

export function Avatar({ address, size = 40, className }: AvatarProps) {
	const traits = React.useMemo(() => getAvatarTraits(address), [address])
	const { bgColor, bodyColor, expression, accessory, rotation } = traits

	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 90 90"
			className={cx('rounded-full', className)}
			style={{ backgroundColor: bgColor }}
			aria-label={`Avatar for ${address.slice(0, 6)}...${address.slice(-4)}`}
		>
			{/* Main body - musical note inspired shape */}
			<g transform={`rotate(${rotation} 45 45)`}>
				{/* Note head - the face container */}
				<ellipse cx="45" cy="45" rx="25" ry="22" fill="white" />

				{/* Subtle shadow */}
				<ellipse cx="45" cy="48" rx="23" ry="18" fill={bodyColor} opacity="0.1" />

				{/* The face */}
				{expression !== 'cool' &&
					accessory !== 'sunglasses' &&
					renderExpression(expression, bodyColor)}
				{(expression === 'cool' || accessory === 'sunglasses') && (
					<>
						{/* For cool expression or sunglasses, show minimal face */}
						<path
							d="M 38 54 Q 45 58 52 54"
							stroke={bodyColor}
							strokeWidth="2"
							fill="none"
							strokeLinecap="round"
						/>
					</>
				)}

				{/* Cheek blush for some expressions */}
				{(expression === 'happy' || expression === 'excited') && (
					<>
						<ellipse cx="28" cy="50" rx="4" ry="2.5" fill="#FFB6C1" opacity="0.5" />
						<ellipse cx="62" cy="50" rx="4" ry="2.5" fill="#FFB6C1" opacity="0.5" />
					</>
				)}
			</g>

			{/* Accessory - rendered on top */}
			{renderAccessory(accessory, bodyColor)}

			{/* Small "T" badge for Tempo branding */}
			<g transform="translate(65, 65)">
				<circle cx="8" cy="8" r="10" fill={bodyColor} />
				<text
					x="8"
					y="12"
					textAnchor="middle"
					fontSize="11"
					fontWeight="bold"
					fill="white"
					fontFamily="system-ui, sans-serif"
				>
					T
				</text>
			</g>
		</svg>
	)
}

export namespace Avatar {
	export type Props = AvatarProps
}

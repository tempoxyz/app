import * as React from 'react'
import { cx } from '#lib/css'

/**
 * Tempo Avatar - A deterministic avatar system for wallet addresses
 *
 * The Tempo mascot is "Tempo", a friendly musical note character with
 * personality. Each wallet address maps to unique avatar attributes.
 *
 * Total combinations: 32 × 24 × 8 × 8 × 10 × 45 × 6 × 4 × 3 = ~159 million unique avatars
 */

// Expanded color palette for backgrounds (32 colors)
const BG_COLORS = [
	'#FF6B6B', '#E74C3C', '#FF8E8E', '#D63031', // reds
	'#4ECDC4', '#00B894', '#1ABC9C', '#00CED1', // teals
	'#45B7D1', '#3498DB', '#85C1E9', '#74B9FF', // blues
	'#96CEB4', '#A8E6CF', '#55E6C1', '#58B19F', // greens
	'#FFEAA7', '#F7DC6F', '#FDCB6E', '#F8B500', // yellows
	'#DDA0DD', '#BB8FCE', '#9B59B6', '#A29BFE', // purples
	'#FFB6C1', '#FD79A8', '#E84393', '#FF6B81', // pinks
	'#FF7F50', '#E17055', '#D35400', '#F39C12', // oranges
]

// Expanded body/accent colors (24 colors)
const BODY_COLORS = [
	'#2D3436', '#636E72', '#2C3E50', '#34495E', // grays
	'#00B894', '#00A085', '#1ABC9C', '#16A085', // greens
	'#0984E3', '#2980B9', '#3742FA', '#5352ED', // blues
	'#6C5CE7', '#8E44AD', '#9B59B6', '#A55EEA', // purples
	'#E17055', '#D35400', '#E74C3C', '#C0392B', // warm
	'#FDCB6E', '#F39C12', '#E84393', '#FD79A8', // accent
]

// Face expressions (8 types)
type Expression = 'happy' | 'cool' | 'chill' | 'excited' | 'zen' | 'wink' | 'surprised' | 'smug'
const EXPRESSIONS: Expression[] = ['happy', 'cool', 'chill', 'excited', 'zen', 'wink', 'surprised', 'smug']

// Accessories (10 types)
type Accessory = 'none' | 'hat' | 'headphones' | 'sunglasses' | 'crown' | 'bowtie' | 'cap' | 'horns' | 'halo' | 'antenna'
const ACCESSORIES: Accessory[] = ['none', 'hat', 'headphones', 'sunglasses', 'crown', 'bowtie', 'cap', 'horns', 'halo', 'antenna']

// Eye styles (6 types)
type EyeStyle = 'round' | 'oval' | 'dot' | 'anime' | 'sleepy' | 'sparkle'
const EYE_STYLES: EyeStyle[] = ['round', 'oval', 'dot', 'anime', 'sleepy', 'sparkle']

// Cheek styles (4 types)
type CheekStyle = 'none' | 'blush' | 'freckles' | 'rosy'
const CHEEK_STYLES: CheekStyle[] = ['none', 'blush', 'freckles', 'rosy']

// Face shapes (3 types)
type FaceShape = 'round' | 'oval' | 'soft-square'
const FACE_SHAPES: FaceShape[] = ['round', 'oval', 'soft-square']

/**
 * Deterministically derive avatar traits from an address
 * Uses different byte ranges to maximize variation
 */
function getAvatarTraits(address: string) {
	const cleanAddr = address.toLowerCase().replace('0x', '')

	// Use different byte ranges for each trait
	const bgIndex = Number.parseInt(cleanAddr.slice(0, 2), 16) % BG_COLORS.length
	const bodyIndex = Number.parseInt(cleanAddr.slice(2, 4), 16) % BODY_COLORS.length
	const expressionIndex = Number.parseInt(cleanAddr.slice(4, 6), 16) % EXPRESSIONS.length
	const accessoryIndex = Number.parseInt(cleanAddr.slice(6, 8), 16) % ACCESSORIES.length
	const eyeStyleIndex = Number.parseInt(cleanAddr.slice(8, 10), 16) % EYE_STYLES.length
	const cheekStyleIndex = Number.parseInt(cleanAddr.slice(10, 12), 16) % CHEEK_STYLES.length
	const faceShapeIndex = Number.parseInt(cleanAddr.slice(12, 14), 16) % FACE_SHAPES.length

	// Rotation: -22 to +22 degrees (45 values)
	const rotation = (Number.parseInt(cleanAddr.slice(14, 16), 16) % 45) - 22

	// Scale variation: 0.95 to 1.05 (subtle size differences)
	const scaleVariation = 0.95 + (Number.parseInt(cleanAddr.slice(16, 18), 16) % 11) * 0.01

	return {
		bgColor: BG_COLORS[bgIndex],
		bodyColor: BODY_COLORS[bodyIndex],
		expression: EXPRESSIONS[expressionIndex],
		accessory: ACCESSORIES[accessoryIndex],
		eyeStyle: EYE_STYLES[eyeStyleIndex],
		cheekStyle: CHEEK_STYLES[cheekStyleIndex],
		faceShape: FACE_SHAPES[faceShapeIndex],
		rotation,
		scaleVariation,
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
		case 'wink':
			return (
				<>
					{/* Left eye - open */}
					<circle cx="35" cy="42" r="4" fill={bodyColor} />
					<circle cx="33" cy="40" r="1.5" fill="white" />
					{/* Right eye - winking */}
					<path
						d="M 51 42 Q 55 38 59 42"
						stroke={bodyColor}
						strokeWidth="2.5"
						fill="none"
						strokeLinecap="round"
					/>
					{/* Playful smile */}
					<path
						d="M 35 52 Q 45 60 55 52"
						stroke={bodyColor}
						strokeWidth="2.5"
						fill="none"
						strokeLinecap="round"
					/>
				</>
			)
		case 'surprised':
			return (
				<>
					{/* Eyes - wide open circles */}
					<circle cx="35" cy="42" r="6" fill={bodyColor} />
					<circle cx="55" cy="42" r="6" fill={bodyColor} />
					<circle cx="33" cy="40" r="2" fill="white" />
					<circle cx="53" cy="40" r="2" fill="white" />
					{/* O mouth */}
					<ellipse cx="45" cy="56" rx="5" ry="6" fill={bodyColor} />
					<ellipse cx="45" cy="56" rx="3" ry="4" fill="white" opacity="0.3" />
				</>
			)
		case 'smug':
			return (
				<>
					{/* Eyes - half-lidded confident */}
					<path
						d="M 30 40 L 40 42"
						stroke={bodyColor}
						strokeWidth="3"
						strokeLinecap="round"
					/>
					<path
						d="M 50 42 L 60 40"
						stroke={bodyColor}
						strokeWidth="3"
						strokeLinecap="round"
					/>
					{/* Smug smile */}
					<path
						d="M 35 52 Q 40 56 50 54 Q 55 53 58 50"
						stroke={bodyColor}
						strokeWidth="2.5"
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
		case 'cap':
			return (
				<g>
					{/* Baseball cap */}
					<ellipse cx="45" cy="26" rx="24" ry="8" fill={bodyColor} />
					<path d="M 21 26 Q 21 20 45 18 Q 69 20 69 26" fill={bodyColor} />
					{/* Brim */}
					<ellipse cx="32" cy="30" rx="18" ry="5" fill={bodyColor} />
					{/* Button on top */}
					<circle cx="45" cy="18" r="3" fill="white" opacity="0.6" />
				</g>
			)
		case 'horns':
			return (
				<g>
					{/* Devil horns */}
					<path d="M 22 35 Q 18 20 25 15 Q 28 22 30 30" fill={bodyColor} />
					<path d="M 68 35 Q 72 20 65 15 Q 62 22 60 30" fill={bodyColor} />
				</g>
			)
		case 'halo':
			return (
				<g>
					{/* Angel halo */}
					<ellipse cx="45" cy="15" rx="18" ry="5" fill="none" stroke="#FFD700" strokeWidth="3" />
					<ellipse cx="45" cy="15" rx="18" ry="5" fill="none" stroke="#FFF9C4" strokeWidth="1.5" />
				</g>
			)
		case 'antenna':
			return (
				<g>
					{/* Alien antenna */}
					<line x1="35" y1="25" x2="30" y2="10" stroke={bodyColor} strokeWidth="2" strokeLinecap="round" />
					<line x1="55" y1="25" x2="60" y2="10" stroke={bodyColor} strokeWidth="2" strokeLinecap="round" />
					<circle cx="30" cy="8" r="4" fill={bodyColor} />
					<circle cx="60" cy="8" r="4" fill={bodyColor} />
					<circle cx="30" cy="7" r="1.5" fill="white" opacity="0.6" />
					<circle cx="60" cy="7" r="1.5" fill="white" opacity="0.6" />
				</g>
			)
		case 'none':
		default:
			return null
	}
}

/**
 * Render cheek decorations
 */
function renderCheeks(cheekStyle: CheekStyle, bodyColor: string) {
	switch (cheekStyle) {
		case 'blush':
			return (
				<>
					<ellipse cx="28" cy="50" rx="4" ry="2.5" fill="#FFB6C1" opacity="0.5" />
					<ellipse cx="62" cy="50" rx="4" ry="2.5" fill="#FFB6C1" opacity="0.5" />
				</>
			)
		case 'freckles':
			return (
				<>
					<circle cx="26" cy="48" r="1" fill={bodyColor} opacity="0.4" />
					<circle cx="29" cy="50" r="1" fill={bodyColor} opacity="0.4" />
					<circle cx="27" cy="52" r="1" fill={bodyColor} opacity="0.4" />
					<circle cx="61" cy="48" r="1" fill={bodyColor} opacity="0.4" />
					<circle cx="64" cy="50" r="1" fill={bodyColor} opacity="0.4" />
					<circle cx="62" cy="52" r="1" fill={bodyColor} opacity="0.4" />
				</>
			)
		case 'rosy':
			return (
				<>
					<ellipse cx="28" cy="50" rx="5" ry="3" fill="#FF6B6B" opacity="0.3" />
					<ellipse cx="62" cy="50" rx="5" ry="3" fill="#FF6B6B" opacity="0.3" />
				</>
			)
		case 'none':
		default:
			return null
	}
}

/**
 * Get face shape path
 */
function getFaceShape(faceShape: FaceShape): { rx: number; ry: number } {
	switch (faceShape) {
		case 'oval':
			return { rx: 23, ry: 25 }
		case 'soft-square':
			return { rx: 24, ry: 22 }
		case 'round':
		default:
			return { rx: 25, ry: 24 }
	}
}

export interface AvatarProps {
	address: string
	size?: number
	className?: string
}

export function Avatar({ address, size = 40, className }: AvatarProps) {
	const traits = React.useMemo(() => getAvatarTraits(address), [address])
	const { bgColor, bodyColor, expression, accessory, cheekStyle, faceShape, rotation, scaleVariation } = traits
	const { rx, ry } = getFaceShape(faceShape)

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
			<g transform={`rotate(${rotation} 45 45) scale(${scaleVariation})`} style={{ transformOrigin: '45px 45px' }}>
				{/* Note head - the face container */}
				<ellipse cx="45" cy="45" rx={rx} ry={ry} fill="white" />

				{/* Subtle shadow */}
				<ellipse cx="45" cy="48" rx={rx - 2} ry={ry - 4} fill={bodyColor} opacity="0.08" />

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

				{/* Cheek decorations */}
				{renderCheeks(cheekStyle, bodyColor)}
			</g>

			{/* Accessory - rendered on top */}
			{renderAccessory(accessory, bodyColor)}
		</svg>
	)
}

export namespace Avatar {
	export type Props = AvatarProps
}

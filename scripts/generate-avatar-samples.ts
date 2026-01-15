/**
 * Script to generate sample avatar SVGs for documentation
 *
 * Run with: node --experimental-strip-types scripts/generate-avatar-samples.ts
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

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

function getAvatarTraits(address: string) {
	const cleanAddr = address.toLowerCase().replace('0x', '')

	const bgIndex = Number.parseInt(cleanAddr.slice(0, 2), 16) % BG_COLORS.length
	const bodyIndex =
		Number.parseInt(cleanAddr.slice(2, 4), 16) % BODY_COLORS.length
	const expressionIndex =
		Number.parseInt(cleanAddr.slice(4, 6), 16) % EXPRESSIONS.length
	const accessoryIndex =
		Number.parseInt(cleanAddr.slice(6, 8), 16) % ACCESSORIES.length
	const rotation = (Number.parseInt(cleanAddr.slice(8, 10), 16) % 30) - 15

	return {
		bgColor: BG_COLORS[bgIndex],
		bodyColor: BODY_COLORS[bodyIndex],
		expression: EXPRESSIONS[expressionIndex],
		accessory: ACCESSORIES[accessoryIndex],
		rotation,
	}
}

function renderExpression(expression: Expression, bodyColor: string): string {
	switch (expression) {
		case 'happy':
			return `
				<ellipse cx="35" cy="42" rx="4" ry="3" fill="${bodyColor}" />
				<ellipse cx="55" cy="42" rx="4" ry="3" fill="${bodyColor}" />
				<path d="M 35 52 Q 45 60 55 52" stroke="${bodyColor}" stroke-width="2.5" fill="none" stroke-linecap="round" />
			`
		case 'cool':
			return `
				<line x1="31" y1="42" x2="39" y2="42" stroke="${bodyColor}" stroke-width="2.5" stroke-linecap="round" />
				<line x1="51" y1="42" x2="59" y2="42" stroke="${bodyColor}" stroke-width="2.5" stroke-linecap="round" />
				<path d="M 38 52 Q 48 56 58 52" stroke="${bodyColor}" stroke-width="2.5" fill="none" stroke-linecap="round" />
			`
		case 'chill':
			return `
				<path d="M 31 42 Q 35 40 39 42" stroke="${bodyColor}" stroke-width="2.5" fill="none" stroke-linecap="round" />
				<path d="M 51 42 Q 55 40 59 42" stroke="${bodyColor}" stroke-width="2.5" fill="none" stroke-linecap="round" />
				<path d="M 37 53 L 53 53" stroke="${bodyColor}" stroke-width="2.5" fill="none" stroke-linecap="round" />
			`
		case 'excited':
			return `
				<circle cx="35" cy="42" r="5" fill="${bodyColor}" />
				<circle cx="55" cy="42" r="5" fill="${bodyColor}" />
				<circle cx="33" cy="40" r="1.5" fill="white" />
				<circle cx="53" cy="40" r="1.5" fill="white" />
				<path d="M 32 52 Q 45 65 58 52" stroke="${bodyColor}" stroke-width="2.5" fill="none" stroke-linecap="round" />
			`
		case 'zen':
			return `
				<path d="M 31 42 Q 35 38 39 42" stroke="${bodyColor}" stroke-width="2.5" fill="none" stroke-linecap="round" />
				<path d="M 51 42 Q 55 38 59 42" stroke="${bodyColor}" stroke-width="2.5" fill="none" stroke-linecap="round" />
				<path d="M 38 54 Q 45 58 52 54" stroke="${bodyColor}" stroke-width="2" fill="none" stroke-linecap="round" />
			`
	}
}

function renderAccessory(accessory: Accessory, bodyColor: string): string {
	switch (accessory) {
		case 'hat':
			return `
				<g>
					<ellipse cx="45" cy="22" rx="22" ry="10" fill="${bodyColor}" />
					<rect x="23" y="18" width="44" height="8" fill="${bodyColor}" />
					<circle cx="45" cy="14" r="5" fill="white" opacity="0.8" />
				</g>
			`
		case 'headphones':
			return `
				<g>
					<path d="M 20 40 Q 20 15 45 12 Q 70 15 70 40" stroke="${bodyColor}" stroke-width="4" fill="none" />
					<ellipse cx="20" cy="42" rx="7" ry="9" fill="${bodyColor}" />
					<ellipse cx="70" cy="42" rx="7" ry="9" fill="${bodyColor}" />
					<ellipse cx="20" cy="42" rx="4" ry="6" fill="white" opacity="0.3" />
					<ellipse cx="70" cy="42" rx="4" ry="6" fill="white" opacity="0.3" />
				</g>
			`
		case 'sunglasses':
			return `
				<g>
					<path d="M 40 40 L 50 40" stroke="${bodyColor}" stroke-width="2" stroke-linecap="round" />
					<rect x="25" y="36" width="15" height="10" rx="2" fill="${bodyColor}" opacity="0.9" />
					<rect x="50" y="36" width="15" height="10" rx="2" fill="${bodyColor}" opacity="0.9" />
					<rect x="27" y="38" width="4" height="2" rx="1" fill="white" opacity="0.4" />
					<rect x="52" y="38" width="4" height="2" rx="1" fill="white" opacity="0.4" />
				</g>
			`
		case 'crown':
			return `
				<g>
					<path d="M 25 28 L 28 18 L 37 24 L 45 12 L 53 24 L 62 18 L 65 28 Z" fill="#FFD700" stroke="#DAA520" stroke-width="1" />
					<circle cx="45" cy="20" r="2.5" fill="#FF6B6B" />
					<circle cx="33" cy="22" r="2" fill="#4ECDC4" />
					<circle cx="57" cy="22" r="2" fill="#4ECDC4" />
				</g>
			`
		case 'bowtie':
			return `
				<g>
					<path d="M 45 68 L 32 62 L 32 74 L 45 68 L 58 62 L 58 74 Z" fill="${bodyColor}" />
					<circle cx="45" cy="68" r="3" fill="white" opacity="0.5" />
				</g>
			`
		case 'none':
		default:
			return ''
	}
}

function generateAvatarSVG(address: string): string {
	const traits = getAvatarTraits(address)
	const { bgColor, bodyColor, expression, accessory, rotation } = traits

	const showFace =
		expression !== 'cool' && accessory !== 'sunglasses'
	const faceContent = showFace
		? renderExpression(expression, bodyColor)
		: `<path d="M 38 54 Q 45 58 52 54" stroke="${bodyColor}" stroke-width="2" fill="none" stroke-linecap="round" />`

	const blush =
		expression === 'happy' || expression === 'excited'
			? `
				<ellipse cx="28" cy="50" rx="4" ry="2.5" fill="#FFB6C1" opacity="0.5" />
				<ellipse cx="62" cy="50" rx="4" ry="2.5" fill="#FFB6C1" opacity="0.5" />
			`
			: ''

	return `<svg width="200" height="200" viewBox="0 0 90 90" xmlns="http://www.w3.org/2000/svg">
	<rect width="90" height="90" rx="45" fill="${bgColor}" />
	<g transform="rotate(${rotation} 45 45)">
		<ellipse cx="45" cy="45" rx="25" ry="22" fill="white" />
		<ellipse cx="45" cy="48" rx="23" ry="18" fill="${bodyColor}" opacity="0.1" />
		${faceContent}
		${blush}
	</g>
	${renderAccessory(accessory, bodyColor)}
	<g transform="translate(65, 65)">
		<circle cx="8" cy="8" r="10" fill="${bodyColor}" />
		<text x="8" y="12" text-anchor="middle" font-size="11" font-weight="bold" fill="white" font-family="system-ui, sans-serif">T</text>
	</g>
</svg>`
}

// Sample addresses to generate avatars for
const sampleAddresses = [
	'0x195d45da04bd0a8c35800ab322ff9b50ac43e31d',
	'0xe2172991faf09bb280cd138717652d8f71ae2fd6',
	'0xf9711617a58f50cae39b24e919955b70971b3ff2',
	'0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', // vitalik.eth
	'0x849151d7D0bF1F34b70d5caD5149D28CC2308bf1',
	'0x50EC05ADe8280758E2077fcBC08D878D4aef79C3',
	'0x1234567890abcdef1234567890abcdef12345678',
	'0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
	'0xcafebabecafebabecafebabecafebabecafebabe',
]

// Create output directory
const outputDir = path.join(process.cwd(), 'docs', 'avatars')
fs.mkdirSync(outputDir, { recursive: true })

// Generate SVGs
for (const address of sampleAddresses) {
	const svg = generateAvatarSVG(address)
	const shortAddr = `${address.slice(0, 8)}...${address.slice(-6)}`
	const filename = `avatar-${address.slice(2, 10)}.svg`
	fs.writeFileSync(path.join(outputDir, filename), svg)
	console.log(`Generated: ${filename} for ${shortAddr}`)
}

// Generate a grid preview
const gridSvg = `<svg width="600" height="400" viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg">
	<rect width="600" height="400" fill="#1a1a2e" />
	<text x="300" y="35" text-anchor="middle" font-size="24" fill="white" font-family="system-ui, sans-serif">Tempo Avatars</text>
	${sampleAddresses
		.map((addr, i) => {
			const x = (i % 3) * 200 + 100
			const y = Math.floor(i / 3) * 120 + 100
			const traits = getAvatarTraits(addr)
			return `
			<g transform="translate(${x - 45}, ${y - 45})">
				${generateAvatarSVG(addr).replace(/<svg[^>]*>/, '').replace('</svg>', '')}
			</g>
			<text x="${x}" y="${y + 65}" text-anchor="middle" font-size="10" fill="#888" font-family="monospace">${addr.slice(0, 6)}...${addr.slice(-4)}</text>
		`
		})
		.join('\n')}
</svg>`

fs.writeFileSync(path.join(outputDir, 'avatar-grid.svg'), gridSvg)
console.log('\nGenerated: avatar-grid.svg (preview grid)')
console.log(`\nAll avatars saved to: ${outputDir}`)

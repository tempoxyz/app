#!/usr/bin/env node
/**
 * Bundle size analysis and diff tool
 *
 * Usage:
 *   pnpm bundle:diff                    - Build and show bundle sizes (diff against baseline if exists)
 *   pnpm bundle:save                    - Build and save current sizes as baseline
 *
 * CI flags:
 *   --ci                                - Output markdown for GitHub PR comments
 *   --baseline <file>                   - Read baseline from specific file path
 *   --output <file>                     - Write current stats to file (for caching)
 *   --skip-build                        - Skip build step (use existing stats.json)
 */

import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { resolve } from 'node:path'

const BASELINE_FILE = '.bundle-baseline.json'
const STATS_FILE = 'stats.json'

interface CIOptions {
	ci: boolean
	baselinePath: string | null
	outputPath: string | null
	skipBuild: boolean
	save: boolean
}

function parseArgs(args: string[]): CIOptions {
	const options: CIOptions = {
		ci: false,
		baselinePath: null,
		outputPath: null,
		skipBuild: false,
		save: false,
	}

	for (let i = 0; i < args.length; i++) {
		const arg = args[i]
		if (arg === '--ci') {
			options.ci = true
		} else if (arg === '--baseline' && args[i + 1]) {
			options.baselinePath = args[++i]
		} else if (arg === '--output' && args[i + 1]) {
			options.outputPath = args[++i]
		} else if (arg === '--skip-build') {
			options.skipBuild = true
		} else if (arg === '--save') {
			options.save = true
		}
	}

	return options
}

interface ChunkInfo {
	label: string
	size: number
	gzipSize: number
	brotliSize: number
}

interface BundleStats {
	timestamp: string
	total: { size: number; gzip: number; brotli: number }
	chunks: ChunkInfo[]
}

interface VisualizerData {
	version: number
	tree: TreeNode
	nodeParts: Record<string, NodePart>
}

interface TreeNode {
	name: string
	uid?: string
	children?: TreeNode[]
}

interface NodePart {
	renderedLength: number
	gzipLength: number
	brotliLength: number
}

function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 B'
	const k = 1024
	const sizes = ['B', 'KB', 'MB', 'GB']
	const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k))
	const value = bytes / k ** i
	return `${value.toFixed(1)} ${sizes[i]}`
}

function formatDelta(current: number, baseline: number): string {
	const delta = current - baseline
	const percent = baseline > 0 ? ((delta / baseline) * 100).toFixed(1) : 'N/A'
	const sign = delta >= 0 ? '+' : ''
	return `${sign}${formatBytes(delta)} (${sign}${percent}%)`
}

function collectUids(node: TreeNode): string[] {
	const uids: string[] = []
	if (node.uid) uids.push(node.uid)
	if (node.children) {
		for (const child of node.children) {
			uids.push(...collectUids(child))
		}
	}
	return uids
}

function parseStats(statsPath: string): BundleStats {
	const raw = JSON.parse(readFileSync(statsPath, 'utf-8')) as VisualizerData

	const chunks: ChunkInfo[] = []
	const nodeParts = raw.nodeParts || {}
	const chunkNodes = raw.tree?.children || []

	for (const chunkNode of chunkNodes) {
		const chunkName = chunkNode.name
		let chunkSize = 0
		let chunkGzip = 0
		let chunkBrotli = 0

		const uids = collectUids(chunkNode)
		for (const uid of uids) {
			const part = nodeParts[uid]
			if (part) {
				chunkSize += part.renderedLength || 0
				chunkGzip += part.gzipLength || 0
				chunkBrotli += part.brotliLength || 0
			}
		}

		if (chunkSize > 0) {
			chunks.push({
				label: chunkName,
				size: chunkSize,
				gzipSize: chunkGzip,
				brotliSize: chunkBrotli,
			})
		}
	}

	chunks.sort((a, b) => b.size - a.size)

	const total = chunks.reduce(
		(acc, chunk) => ({
			size: acc.size + chunk.size,
			gzip: acc.gzip + chunk.gzipSize,
			brotli: acc.brotli + chunk.brotliSize,
		}),
		{ size: 0, gzip: 0, brotli: 0 },
	)

	return {
		timestamp: new Date().toISOString(),
		total,
		chunks,
	}
}

function printReport(
	current: BundleStats,
	baseline: BundleStats | null,
	options: CIOptions,
): void {
	if (options.ci) {
		printMarkdownReport(current, baseline)
	} else {
		printTerminalReport(current, baseline)
	}
}

function printTerminalReport(
	current: BundleStats,
	baseline: BundleStats | null,
): void {
	console.log(`\n${'='.repeat(60)}`)
	console.log('Bundle Size Analysis')
	console.log('='.repeat(60))

	console.log('\nCurrent Build:')
	console.log(
		`  Total:  ${formatBytes(current.total.size)} (gzip: ${formatBytes(current.total.gzip)}, brotli: ${formatBytes(current.total.brotli)})`,
	)

	if (baseline) {
		console.log('\nBaseline:')
		console.log(
			`  Total:  ${formatBytes(baseline.total.size)} (gzip: ${formatBytes(baseline.total.gzip)}, brotli: ${formatBytes(baseline.total.brotli)})`,
		)

		console.log('\nDelta:')
		console.log(
			`  Total:  ${formatDelta(current.total.size, baseline.total.size)}`,
		)
		console.log(
			`  Gzip:   ${formatDelta(current.total.gzip, baseline.total.gzip)}`,
		)
		console.log(
			`  Brotli: ${formatDelta(current.total.brotli, baseline.total.brotli)}`,
		)
	}

	console.log('\n  Top chunks:')
	const topChunks = current.chunks.slice(0, 10)
	for (const chunk of topChunks) {
		const name = chunk.label.padEnd(45)
		console.log(
			`    ${name} ${formatBytes(chunk.size).padStart(10)}  (gzip: ${formatBytes(chunk.gzipSize)})`,
		)
	}

	if (current.chunks.length > 10) {
		console.log(`    ... and ${current.chunks.length - 10} more chunks`)
	}

	if (!baseline) {
		console.log(
			"\n  No baseline found. Run 'pnpm bundle:save' to save current as baseline.",
		)
	}

	console.log(`\n${'='.repeat(60)}\n`)
}

function printMarkdownReport(
	current: BundleStats,
	baseline: BundleStats | null,
): void {
	let output = '## 📦 Bundle Size Report\n\n'

	if (baseline) {
		const sizeDelta = current.total.size - baseline.total.size
		const emoji = sizeDelta > 0 ? '📈' : sizeDelta < 0 ? '📉' : '➡️'

		output += `${emoji} **Total:** ${formatBytes(current.total.size)} (${formatDelta(current.total.size, baseline.total.size)})\n\n`
		output += `| Metric | Current | Baseline | Delta |\n`
		output += `|--------|---------|----------|-------|\n`
		output += `| Raw | ${formatBytes(current.total.size)} | ${formatBytes(baseline.total.size)} | ${formatDelta(current.total.size, baseline.total.size)} |\n`
		output += `| Gzip | ${formatBytes(current.total.gzip)} | ${formatBytes(baseline.total.gzip)} | ${formatDelta(current.total.gzip, baseline.total.gzip)} |\n`
		output += `| Brotli | ${formatBytes(current.total.brotli)} | ${formatBytes(baseline.total.brotli)} | ${formatDelta(current.total.brotli, baseline.total.brotli)} |\n`
	} else {
		output += `**Total:** ${formatBytes(current.total.size)} (gzip: ${formatBytes(current.total.gzip)}, brotli: ${formatBytes(current.total.brotli)})\n\n`
		output += `*No baseline available for comparison*\n`
	}

	output += '\n<details>\n<summary>Top 10 chunks</summary>\n\n'
	output += '| Chunk | Size | Gzip |\n'
	output += '|-------|------|------|\n'

	const topChunks = current.chunks.slice(0, 10)
	for (const chunk of topChunks) {
		const name =
			chunk.label.length > 40 ? `${chunk.label.slice(0, 37)}...` : chunk.label
		output += `| \`${name}\` | ${formatBytes(chunk.size)} | ${formatBytes(chunk.gzipSize)} |\n`
	}

	output += '\n</details>\n'

	console.log(output)
}

async function main() {
	const args = process.argv.slice(2)
	const options = parseArgs(args)

	if (!options.skipBuild) {
		console.log('Building with bundle analysis...')
		execSync('pnpm build', {
			stdio: 'inherit',
			env: { ...process.env, ANALYZE_JSON: 'true' },
		})
	}

	const statsPath = resolve(process.cwd(), STATS_FILE)

	if (!existsSync(statsPath)) {
		console.error(`Stats file not found: ${statsPath}`)
		console.error('Make sure to run with ANALYZE_JSON=true')
		process.exit(1)
	}

	const current = parseStats(statsPath)

	if (options.outputPath) {
		writeFileSync(options.outputPath, JSON.stringify(current, null, 2))
		console.log(`Stats written to ${options.outputPath}`)
		return
	}

	if (options.save) {
		writeFileSync(BASELINE_FILE, JSON.stringify(current, null, 2))
		console.log(`Baseline saved to ${BASELINE_FILE}`)
		printReport(current, null, options)
		return
	}

	let baseline: BundleStats | null = null

	if (options.baselinePath && existsSync(options.baselinePath)) {
		baseline = JSON.parse(readFileSync(options.baselinePath, 'utf-8'))
	} else if (existsSync(BASELINE_FILE)) {
		baseline = JSON.parse(readFileSync(BASELINE_FILE, 'utf-8'))
	}

	printReport(current, baseline, options)

	try {
		unlinkSync(statsPath)
	} catch {}
}

main().catch((error) => {
	console.error(error)
	process.exit(1)
})

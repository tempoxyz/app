import { cloudflare } from '@cloudflare/vite-plugin'
import tailwind from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart as tanstack } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import Icons from 'unplugin-icons/vite'
import * as z from 'zod/mini'
import { defineConfig, loadEnv, type Plugin } from 'vite'

import wranglerJSON from '#wrangler.json' with { type: 'json' }

const [, , , ...args] = process.argv

export default defineConfig((config) => {
	const env = loadEnv(config.mode, process.cwd(), '')

	const { data: cloudflareEnv, success } = z.safeParse(
		z.prefault(
			z.union([
				z.literal('devnet'),
				z.literal('moderato'),
				z.literal('presto'),
			]),
			'presto',
		),
		process.env.CLOUDFLARE_ENV || env.CLOUDFLARE_ENV,
	)
	if (!success) throw new Error('Invalid CLOUDFLARE_ENV')

	const wranglerVars = wranglerJSON.env[cloudflareEnv].vars

	const showDevtools = env.VITE_ENABLE_DEVTOOLS !== 'false'

	const lastPort = (() => {
		const index = args.lastIndexOf('--port')
		return index === -1 ? null : (args.at(index + 1) ?? null)
	})()
	const port = Number(lastPort ?? env.PORT ?? 3_001)

	const allowedHosts = env.ALLOWED_HOSTS?.split(',') ?? []

	return {
		plugins: [
			vitePluginAlias(),
			showDevtools && devtools(),
			cloudflare({ viteEnvironment: { name: 'ssr' } }),
			tailwind(),
			Icons({ compiler: 'jsx', jsx: 'react' }),
			tanstack({
				srcDirectory: './src',
				start: { entry: './src/index.start.ts' },
				server: { entry: './src/index.server.ts' },
				client: { entry: './src/index.client.tsx' },
			}),
			react(),
			process.env.ANALYZE_JSON === 'true' && clientOnlyVisualizer(),
		].filter(Boolean),

		server: {
			port,
			cors: config.mode === 'development' ? false : undefined,
			allowedHosts: config.mode === 'development' ? allowedHosts : [],
		},
		preview: {
			allowedHosts: config.mode === 'preview' ? allowedHosts : [],
		},
		build: {
			minify: 'oxc',
			rollupOptions: {
				external: ['cloudflare:workers'],
				output: {
					minify: {
						compress:
							config.mode === 'production'
								? { dropConsole: true, dropDebugger: true }
								: undefined,
					},
				},
			},
		},
		define: {
			__BASE_URL__: JSON.stringify(
				env.VITE_BASE_URL
					? env.VITE_BASE_URL
					: config.mode === 'development'
						? `http://localhost:${port}`
						: (env.VITE_BASE_URL ?? ''),
			),
			__BUILD_VERSION__: JSON.stringify(
				env.CF_PAGES_COMMIT_SHA?.slice(0, 8) ?? Date.now().toString(),
			),
			'import.meta.env.VITE_TEMPO_ENV': JSON.stringify(
				wranglerVars.VITE_TEMPO_ENV || cloudflareEnv || env.VITE_TEMPO_ENV,
			),
		},
	}
})

function vitePluginAlias(): Plugin {
	return {
		name: 'app-aliases',
		resolveId(id) {
			if (id.startsWith('#tanstack')) return
			if (!id.startsWith('#')) return
			return this.resolve(`${__dirname}/src/${id.slice(1)}`)
		},
	}
}

function clientOnlyVisualizer(): Plugin {
	const viz = visualizer({
		filename: 'stats.json',
		template: 'raw-data',
		gzipSize: true,
		brotliSize: true,
	})
	return {
		name: 'client-only-visualizer',
		generateBundle(options, bundle) {
			if (options.dir?.includes('/client')) {
				// biome-ignore lint/style/noNonNullAssertion: viz.generateBundle exists
				return viz.generateBundle!.call(this, options, bundle)
			}
		},
	}
}

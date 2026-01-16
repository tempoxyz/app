import type { Plugin } from 'vite'
import { defineConfig } from 'waku/config'
import tailwindcss from '@tailwindcss/vite'
import Icons from 'unplugin-icons/vite'

function forAllEnvironments(plugin: Plugin): Plugin {
	return Object.assign({}, plugin, {
		applyToEnvironment() {
			return true
		},
	})
}

const iconsPlugin = Icons({ compiler: 'jsx', jsx: 'react' })

export default defineConfig({
	vite: {
		plugins: [tailwindcss(), forAllEnvironments(iconsPlugin)],
		resolve: {
			alias: {
				'#': new URL('./src/', import.meta.url).pathname,
			},
		},
		define: {
			__BASE_URL__: JSON.stringify(
				process.env.VITE_BASE_URL || 'http://localhost:3001',
			),
			__BUILD_VERSION__: JSON.stringify(
				process.env.CF_PAGES_COMMIT_SHA?.slice(0, 8) ?? Date.now().toString(),
			),
		},
		build: {
			minify: 'oxc',
		},
		ssr: {
			noExternal: ['wagmi', '@wagmi/core', '@wagmi/connectors'],
			external: ['emoji-mart', '@emoji-mart/react', '@emoji-mart/data'],
		},
	},
})

// import { sentryVitePlugin } from '@sentry/vite-plugin';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import path from 'path';
import fs from 'fs';

import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';

function resolveWranglerConfigPath(): string {
	const baseConfigPath = 'wrangler.jsonc';
	if (!process.env.DEV_MODE) {
		return baseConfigPath;
	}

	const raw = fs.readFileSync(path.resolve(__dirname, baseConfigPath), 'utf8');
	const stripped = JSON.parse(stripJsonc(raw)) as Record<string, unknown>;
	delete stripped.dispatch_namespaces;

	// Write alongside wrangler.jsonc so relative paths (e.g. the container
	// Dockerfile and migrations_dir) still resolve against this directory.
	const devConfigPath = path.resolve(__dirname, '.wrangler.dev.jsonc');
	fs.writeFileSync(devConfigPath, JSON.stringify(stripped, null, 2));
	return devConfigPath;
}

// Minimal JSONC -> JSON: strip // and /* */ comments and trailing commas.
function stripJsonc(input: string): string {
	const withoutComments = input
		.replace(/\\"|"(?:\\.|[^"\\])*"|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (match) =>
			match.startsWith('//') || match.startsWith('/*') ? '' : match,
		);
	return withoutComments.replace(/,(\s*[}\]])/g, '$1');
}

// https://vite.dev/config/
export default defineConfig({
	optimizeDeps: {
		exclude: ['format', 'editor.all'],
		include: ['monaco-editor/esm/vs/editor/editor.api'],
		force: true,
	},

	// build: {
	//     rollupOptions: {
	//       output: {
	//             advancedChunks: {
	//                 groups: [{name: 'vendor', test: /node_modules/}]
	//             }
	//         }
	//     }
	// },
	plugins: [
		react(),
		svgr(),
		cloudflare({
			configPath: resolveWranglerConfigPath(),
		}),
		tailwindcss(),
		// sentryVitePlugin({
		// 	org: 'cloudflare-0u',
		// 	project: 'javascript-react',
		// }),
	],

	resolve: {
		alias: {
			debug: 'debug/src/browser',
			'@': path.resolve(__dirname, './src'),
			'shared': path.resolve(__dirname, './shared'),
			'worker': path.resolve(__dirname, './worker'),
		},
	},

	// Configure for Prisma + Cloudflare Workers compatibility
	define: {
		// Ensure proper module definitions for Cloudflare Workers context
		'process.env.NODE_ENV': JSON.stringify(
			process.env.NODE_ENV || 'development',
		),
		global: 'globalThis',
		// '__filename': '""',
		// '__dirname': '""',
	},

	worker: {
		// Handle Prisma in worker context for development
		format: 'es',
	},

	server: {
		allowedHosts: true,
	},

	// Clear cache more aggressively
	cacheDir: 'node_modules/.vite',
});

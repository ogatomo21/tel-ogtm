import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss()],
	build: {
		assetsInlineLimit: 0,
		cssCodeSplit: false,
		emptyOutDir: true,
		lib: {
			entry: 'src/styles.ts',
			fileName: 'app',
			formats: ['es'],
		},
		outDir: 'dist',
		rollupOptions: {
			output: {
				assetFileNames: (asset) => {
					if (asset.name?.endsWith('.css')) {
						return 'app.css';
					}

					return 'assets/[name]-[hash][extname]';
				},
			},
		},
	},
});

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// V's standalone UI. Dev runs on :5173 (the webview host points its iframe here for HMR).
// Prod builds to dist/ with RELATIVE asset paths so the VS Code webview can load them via
// asWebviewUri() (vscode-resource://...). Base './' is critical -- absolute '/' paths 404
// inside a webview.
export default defineConfig({
	plugins: [react()],
	base: './',
	server: {
		port: 5173,
		strictPort: true,
	},
	build: {
		outDir: 'dist',
		emptyOutDir: true,
		// single-file-ish output keeps webview wiring simple
		assetsInlineLimit: 100000,
	},
})

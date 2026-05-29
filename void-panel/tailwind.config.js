/** @type {import('tailwindcss').Config} */
export default {
	content: ['./index.html', './src/**/*.{ts,tsx}'],
	theme: {
		extend: {
			colors: {
				// V's palette — green invader on dark-purple sky (matches the chat alien)
				vgreen: '#4ea03b',
				vred: '#d6392c',
				vsky: '#160a2b',
				vsky2: '#2a1257',
				vsurface: '#2a1f47',
				vamethyst: '#8b5cf6',
			},
			fontFamily: {
				mono: ['DM Mono', 'JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
			},
		},
	},
	plugins: [],
}

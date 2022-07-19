import svelte from 'rollup-plugin-svelte'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import copy from 'rollup-plugin-copy-assets'
import css from 'rollup-plugin-css-only'

export default {
	input: 'src/renderer/index.js',
	output: {
		file: 'public/renderer-bundle.js',
		name: 'app',
		format: 'iife',
	},
	plugins: [
		svelte({
			compilerOptions: {},
			onwarn: (warning, handler) => {
				if (warning.code === 'a11y-positive-tabindex') {
					return
				}
				handler(warning)
			},
		}),
		css({ output: 'renderer-bundle.css' }),
		resolve({ browser: true }),
		commonjs(),
		copy({
			assets: [
				'../public',
			],
		})
	],
	watch: {
		clearScreen: false,
	},
}

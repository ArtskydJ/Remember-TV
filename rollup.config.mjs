import svelte from 'rollup-plugin-svelte'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import css from 'rollup-plugin-css-only'

export default {
	input: 'src/index.js',
	output: {
		file: 'public/bundle.js',
		name: 'app',
		format: 'iife',
	},
	plugins: [
		svelte({
			// emitCss: false,
			compilerOptions: {
				// generate: 'ssr',
				// hydratable: false,
				// customElement: false,
			},
			onwarn: (warning, handler) => {
				if (warning.code === 'a11y-positive-tabindex') {
					return
				}
				handler(warning)
			},
		}),
		css({ output: 'bundle.css' }),
		resolve({ browser: true }),
		commonjs(),
	],
	watch: {
		clearScreen: false,
	},
}

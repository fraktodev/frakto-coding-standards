import { defineConfig } from 'eslint/config';
import fraktoLint from './package/index.js';
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/* eslint-disable @typescript-eslint/naming-convention */
export default defineConfig([
	{
		files: ['**/*.{js,mjs,cjs}'],
		plugins: { js, tseslint, 'frakto-lint': fraktoLint },
		extends: ['js/recommended', 'tseslint/recommended', 'frakto-lint/recommended-js'],
		languageOptions: {
			globals: globals.browser,
			ecmaVersion: 'latest',
			sourceType: 'module',
			parser: tseslint.parser
		}
	},
	{
		files: ['**/*.{ts,mts,cts}'],
		plugins: { js, tseslint, 'frakto-lint': fraktoLint },
		extends: ['js/recommended', 'tseslint/recommended', 'frakto-lint/recommended-ts'],
		languageOptions: {
			globals: globals.browser,
			ecmaVersion: 'latest',
			sourceType: 'module',
			parser: tseslint.parser
		}
	}
]);

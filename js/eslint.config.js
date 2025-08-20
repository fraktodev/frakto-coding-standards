import { defineConfig } from 'eslint/config';
import fraktoDocs from './package/index.js';
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
	{
		files: ['**/*.{js,mjs,cjs}'],
		plugins: { js, tseslint, 'frakto-docs': fraktoDocs },
		extends: ['js/recommended', 'tseslint/recommended', 'frakto-docs/recommended-js'],
		languageOptions: {
			globals: globals.browser,
			ecmaVersion: 'latest',
			sourceType: 'module',
			parser: tseslint.parser
		}
	},
	{
		files: ['**/*.{ts,mts,cts}'],
		plugins: { js, tseslint, 'frakto-docs': fraktoDocs },
		extends: ['js/recommended', 'tseslint/recommended', 'frakto-docs/recommended-ts'],
		languageOptions: {
			globals: globals.browser,
			ecmaVersion: 'latest',
			sourceType: 'module',
			parser: tseslint.parser
		}
	}
]);

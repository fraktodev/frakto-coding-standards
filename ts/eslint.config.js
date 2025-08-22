import { defineConfig } from 'eslint/config';
import frakto from '@frakto/frakto-eslint-plugin';
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
	{
		files: ['**/*.{ts,mts,cts}'],
		plugins: { js, tseslint, frakto },
		extends: ['js/recommended', 'tseslint/recommended', 'frakto/recommended-ts'],
		languageOptions: {
			globals: globals.browser,
			ecmaVersion: 'latest',
			sourceType: 'module',
			parser: tseslint.parser
		}
	}
]);

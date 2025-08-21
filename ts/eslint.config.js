import { defineConfig } from 'eslint/config';
import fraktoLint from '@frakto/eslint-plugin-frakto';
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/* eslint-disable @typescript-eslint/naming-convention */
export default defineConfig([
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

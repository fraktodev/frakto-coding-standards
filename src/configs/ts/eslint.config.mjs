// Dependencies
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import frakto from '../../linters/eslint-plugin/index.mjs';

import { defineConfig } from 'eslint/config';

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

// Dependencies
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import frakto from '../../tools/eslint-plugin/index.mjs';

import { defineConfig } from 'eslint/config';

export default defineConfig([
	{
		files: ['**/*.{js,mjs,cjs}'],
		plugins: { js, tseslint, frakto },
		extends: ['js/recommended', 'tseslint/recommended', 'frakto/recommended-js'],
		languageOptions: {
			globals: globals.browser,
			ecmaVersion: 'latest',
			sourceType: 'module',
			parser: tseslint.parser
		}
	}
]);

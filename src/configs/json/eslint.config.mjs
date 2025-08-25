// Dependencies
import jsoncParser from 'jsonc-eslint-parser';
import packageJson from 'eslint-plugin-package-json';
import frakto from '../../tools/eslint-plugin/index.mjs';

import { defineConfig } from 'eslint/config';

export default defineConfig([
	{
		files: ['**/package.json'],
		plugins: { 'package-json': packageJson, frakto },
		extends: ['package-json/recommended', 'frakto/recommended-pkg'],
		languageOptions: {
			parser: jsoncParser
		}
	}
]);

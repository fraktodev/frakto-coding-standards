import { defineConfig } from 'eslint/config';
import fraktoLint from '@frakto/eslint-plugin-frakto';
import packageJson from 'eslint-plugin-package-json';
import jsoncParser from 'jsonc-eslint-parser';

/* eslint-disable @typescript-eslint/naming-convention */
export default defineConfig([
	{
		files: ['**/package.json'],
		plugins: { 'package-json': packageJson, 'frakto-lint': fraktoLint },
		extends: ['package-json/recommended', 'frakto-lint/recommended-pkg'],
		languageOptions: {
			parser: jsoncParser
		}
	}
]);

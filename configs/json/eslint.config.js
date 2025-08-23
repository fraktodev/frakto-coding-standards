import { defineConfig } from 'eslint/config';
import frakto from '@frakto/frakto-eslint-plugin';
import packageJson from 'eslint-plugin-package-json';
import jsoncParser from 'jsonc-eslint-parser';

/* eslint-disable @typescript-eslint/naming-convention */
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

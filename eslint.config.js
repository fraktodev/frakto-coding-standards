import js from '@eslint/js';
import globals from 'globals';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import jsdoc from 'eslint-plugin-jsdoc';

export default defineConfig([
	{
		files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
		plugins: { js, tseslint, jsdoc },
		extends: ['js/recommended', 'tseslint/recommended'],
		languageOptions: { globals: globals.browser, ecmaVersion: 'latest', sourceType: 'module', parser: tseslint.parser },
		rules: {
			'no-console': 'warn',
			'no-debugger': 'warn',
			'no-var': 'error',
			'@typescript-eslint/no-unused-vars': ['warn'],
			'@typescript-eslint/naming-convention': [
				'error',
				{
					selector: 'default',
					format: ['camelCase'],
					leadingUnderscore: 'allow'
				},
				{
					selector: 'variable',
					modifiers: ['const'],
					format: ['camelCase']
				},
				{
					selector: 'function',
					format: ['camelCase']
				},
				{
					selector: 'class',
					format: ['PascalCase']
				},
				{
					selector: 'interface',
					format: ['PascalCase']
				},
				{
					selector: 'typeAlias',
					format: ['PascalCase']
				}
			],
			'prefer-arrow-callback': ['error', { allowNamedFunctions: false }],
			'func-style': ['error', 'expression'],
			eqeqeq: ['error', 'always'],
			yoda: ['error', 'always'],
			'jsdoc/valid-types': 'error',
			'jsdoc/check-types': 'error',
			'jsdoc/require-description': 'error',
			'jsdoc/require-param': 'error',
			'jsdoc/require-returns': [
				'error',
				{
					forceReturnsWithAsync: true,
					forceRequireReturn: true
				}
			],
			'jsdoc/require-jsdoc': [
				'error',
				{
					require: {
						FunctionDeclaration: true,
						MethodDefinition: true,
						ClassDeclaration: true,
						ArrowFunctionExpression: true,
						FunctionExpression: false
					}
				}
			]
		}
	}
]);

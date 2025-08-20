import { readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { pathToFileURL } from 'node:url';

const rulesDir = join(import.meta.dirname || new URL('.', import.meta.url).pathname, 'rules');
const ruleFiles = readdirSync(rulesDir).filter((f) => f.endsWith('.js'));
const rules = {};

for (const file of ruleFiles) {
	const name = basename(file, '.js');
	const module = await import(pathToFileURL(join(rulesDir, file)));
	rules[name] = module.default;
}

const commonRules = {
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
	yoda: ['error', 'always']
};

export default {
	meta: {
		name: 'eslint-plugin-frakto-docs',
		version: '1.0.0'
	},
	rules: {
		'require-docblock': rules['require-docblock'],
		'validate-description': rules['validate-description'],
		'validate-params-js': rules['validate-params-js'],
		'validate-params-ts': rules['validate-params-ts'],
		'validate-throws': rules['validate-throws'],
		'validate-returns': rules['validate-returns'],
		'validate-tag-order': rules['validate-tag-order'],
		'validate-spacing': rules['validate-spacing'],
		'no-returns': rules['no-returns'],
		'no-examples': rules['no-examples']
	},
	configs: {
		'recommended-js': {
			rules: {
				...commonRules,
				'frakto-docs/require-docblock': 'error',
				'frakto-docs/no-examples': 'error',
				'frakto-docs/validate-description': 'error',
				'frakto-docs/validate-params-js': 'error',
				'frakto-docs/validate-throws': 'error',
				'frakto-docs/validate-returns': 'error',
				'frakto-docs/validate-tag-order': 'error',
				'frakto-docs/validate-spacing': 'error'
			}
		},
		'recommended-ts': {
			rules: {
				...commonRules,
				'frakto-docs/require-docblock': 'error',
				'frakto-docs/no-examples': 'error',
				'frakto-docs/no-returns': 'error',
				'frakto-docs/validate-description': 'error',
				'frakto-docs/validate-params-ts': 'error',
				'frakto-docs/validate-throws': 'error',
				'frakto-docs/validate-tag-order': 'error',
				'frakto-docs/validate-spacing': 'error'
			}
		}
	}
};

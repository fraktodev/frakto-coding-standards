import { readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { pathToFileURL } from 'node:url';

const rulesDir  = join(import.meta.dirname || new URL('.', import.meta.url).pathname, 'rules');
const ruleFiles = readdirSync(rulesDir).filter((f) => f.endsWith('.js'));
const rules     = {};

for (const file of ruleFiles) {
	const name   = basename(file, '.js');
	const module = await import(pathToFileURL(join(rulesDir, file)));
	rules[name] = module.default;
}

/* eslint-disable @typescript-eslint/naming-convention */
const commonRules = {
	'no-console': 'warn',
	'no-debugger': 'warn',
	'no-var': 'error',
	'@typescript-eslint/no-explicit-any': 'off',
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
		name: 'eslint-plugin-frakto-lint',
		version: '1.0.0'
	},
	rules: {
		'align-declarations': rules['align-declarations'],
		'separate-control-keywords': rules['separate-control-keywords'],
		'no-block-comments': rules['no-block-comments'],
		'no-orphaned-docblocks': rules['no-orphaned-docblocks'],
		'require-docblock': rules['require-docblock'],
		'docblock-validate-description': rules['docblock-validate-description'],
		'docblock-validate-params-js': rules['docblock-validate-params-js'],
		'docblock-validate-params-ts': rules['docblock-validate-params-ts'],
		'docblock-validate-throws': rules['docblock-validate-throws'],
		'docblock-validate-returns': rules['docblock-validate-returns'],
		'docblock-validate-tag-order': rules['docblock-validate-tag-order'],
		'docblock-validate-spacing': rules['docblock-validate-spacing'],
		'docblock-no-returns': rules['docblock-no-returns'],
		'docblock-no-examples': rules['docblock-no-examples']
	},
	configs: {
		'recommended-js': {
			rules: {
				...commonRules,
				'frakto-lint/align-declarations': 'error',
				'frakto-lint/separate-control-keywords': 'error',
				'frakto-lint/no-block-comments': 'error',
				'frakto-lint/no-orphaned-docblocks': 'error',
				'frakto-lint/require-docblock': 'error',
				'frakto-lint/docblock-no-examples': 'error',
				'frakto-lint/docblock-validate-description': 'error',
				'frakto-lint/docblock-validate-params-js': 'error',
				'frakto-lint/docblock-validate-throws': 'error',
				'frakto-lint/docblock-validate-returns': 'error',
				'frakto-lint/docblock-validate-tag-order': 'error',
				'frakto-lint/docblock-validate-spacing': 'error'
			}
		},
		'recommended-ts': {
			rules: {
				...commonRules,
				'frakto-lint/align-declarations': 'error',
				'frakto-lint/separate-control-keywords': 'error',
				'frakto-lint/no-block-comments': 'error',
				'frakto-lint/no-orphaned-docblocks': 'error',
				'frakto-lint/require-docblock': 'error',
				'frakto-lint/docblock-no-examples': 'error',
				'frakto-lint/docblock-no-returns': 'error',
				'frakto-lint/docblock-validate-description': 'error',
				'frakto-lint/docblock-validate-params-ts': 'error',
				'frakto-lint/docblock-validate-throws': 'error',
				'frakto-lint/docblock-validate-tag-order': 'error',
				'frakto-lint/docblock-validate-spacing': 'error'
			}
		},
		'recommended-pkg': {
			rules: {
				'package-json/require-name': ['error', { ignorePrivate: false }],
				'package-json/require-version': ['error', { ignorePrivate: false }],
				'package-json/require-author': ['error', { ignorePrivate: true }],
				'package-json/require-bugs': ['error', { ignorePrivate: true }],
				'package-json/require-keywords': ['error', { ignorePrivate: true }],
				'package-json/order-properties': [
					'error',
					{
						order: [
							'name',
							'displayName',
							'productName',
							'version',
							'description',
							'homepage',
							'author',
							'license',
							'types',
							'typings',
							'keywords',
							'bugs',
							'contributors',
							'repository',
							'funding',
							'main',
							'module',
							'exports',
							'bin',
							'man',
							'directories',
							'files',
							'workspaces',
							'type',
							'private',
							'publishConfig',
							'scripts',
							'config',
							'dependencies',
							'devDependencies',
							'peerDependencies',
							'optionalDependencies',
							'bundledDependencies',
							'overrides',
							'resolutions',
							'engines',
							'os',
							'cpu',
							'browserslist',
							'eslintConfig',
							'prettier',
							'husky',
							'lint-staged'
						]
					}
				]
			}
		}
	}
};

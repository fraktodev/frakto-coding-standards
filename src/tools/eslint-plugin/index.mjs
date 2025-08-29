// Dependencies
import { readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join, basename } from 'node:path';

// Load all rule modules
const rulesDir  = join(import.meta.dirname || new URL('.', import.meta.url).pathname, 'rules');
const ruleFiles = readdirSync(rulesDir).filter((file) => file.endsWith('.mjs'));
const rules     = {};
for (const file of ruleFiles) {
	const name   = basename(file, '.mjs');
	const module = await import(pathToFileURL(join(rulesDir, file)));
	rules[name] = module.default;
}

// Common rules
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
			selector: 'import',
			format: null
		},
		{
			selector: 'objectLiteralProperty',
			format: null
		},
		{
			selector: 'variable',
			modifiers: ['const'],
			filter: {
				regex: '^(__dirname|__filename|require|module|exports)$',
				match: false
			},
			format: ['camelCase'],
			leadingUnderscore: 'allow'
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
	'one-var': ['error', 'never'],
	'func-style': ['error', 'expression'],
	'prefer-arrow-callback': ['error', { allowNamedFunctions: false }],
	eqeqeq: ['error', 'always'],
	yoda: ['error', 'always']
};

// Export Plugin
export default {
	meta: {
		name: 'frakto-eslint-plugin',
		version: '0.1.0'
	},
	rules: {
		'align-variables': rules['align-variables'],
		'separate-control-keywords': rules['separate-control-keywords'],
		'no-commented-code': rules['no-commented-code'],
		'no-block-comments': rules['no-block-comments'],
		'docblock-require': rules['docblock-require'],
		'docblock-validate-allowed-tags': rules['docblock-validate-allowed-tags'],
		'docblock-validate-description': rules['docblock-validate-description'],
		'docblock-validate-params-js': rules['docblock-validate-params-js'],
		'docblock-validate-params-ts': rules['docblock-validate-params-ts'],
		'docblock-validate-throws': rules['docblock-validate-throws'],
		'docblock-validate-returns': rules['docblock-validate-returns'],
		'docblock-validate-tag-order': rules['docblock-validate-tag-order'],
		'docblock-validate-spacing': rules['docblock-validate-spacing'],
		'docblock-validate-class-tags': rules['docblock-validate-class-tags']
	},
	configs: {
		'recommended-js': {
			rules: {
				...commonRules,
				'frakto/align-variables': 'error',
				'frakto/separate-control-keywords': 'error',
				'frakto/no-commented-code': 'warn',
				'frakto/no-block-comments': 'warn',
				'frakto/docblock-require': 'error',
				'frakto/docblock-validate-allowed-tags': ['error', { language: 'js' }],
				'frakto/docblock-validate-description': 'error',
				'frakto/docblock-validate-params-js': 'error',
				'frakto/docblock-validate-throws': 'error',
				'frakto/docblock-validate-returns': 'error',
				'frakto/docblock-validate-tag-order': 'error',
				'frakto/docblock-validate-spacing': 'error',
				'frakto/docblock-validate-class-tags': ['error', { language: 'js' }]
			}
		},
		'recommended-ts': {
			rules: {
				...commonRules,
				'frakto/align-variables': 'error',
				'frakto/separate-control-keywords': 'error',
				'frakto/no-commented-code': 'warn',
				'frakto/no-block-comments': 'warn',
				'frakto/docblock-require': 'error',
				'frakto/docblock-validate-allowed-tags': ['error', { language: 'ts' }],
				'frakto/docblock-validate-description': 'error',
				'frakto/docblock-validate-params-ts': 'error',
				'frakto/docblock-validate-throws': 'error',
				'frakto/docblock-validate-tag-order': 'error',
				'frakto/docblock-validate-spacing': 'error',
				'frakto/docblock-validate-class-tags': ['error', { language: 'ts' }]
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
							'private',
							'description',
							'homepage',
							'author',
							'license',
							'type',
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

// Dependencies.
import path from 'node:path';
import prettier from 'prettier';
import process from 'node:process';
import fraktoEmojiLinter from '@frakto/frakto-emoji-linter';

import { ESLint } from 'eslint';
import { spawn } from 'child_process';

/**
 * Frakto Code Auditor - Unified formatter and linter for all supported languages.
 */
class FraktoAuditor {
	/**
	 * Constructor - Initialize the auditor with tool handlers, language configurations, and ignore patterns.
	 *
	 * @param {object} config - Optional. An object containing configuration options.
	 *
	 * @returns {void}
	 */
	constructor(config = { ignoreOnFormat: [], ignoreOnLint: [] }) {
		this.initializeToolHandlers();
		this.initializeLanguageConfigs();
		this.ignoreOnFormat = config.ignoreOnFormat;
		this.ignoreOnLint = config.ignoreOnLint;
	}

	/**
	 * Initialize tool handlers for different formatting and linting tools.
	 *
	 * @returns {void}
	 */
	initializeToolHandlers() {
		this.toolHandlers = {
			/**
			 * Formats code using Prettier with language-specific configurations.
			 *
			 * @param {string} content  - The content to format.
			 * @param {object} request  - The request object.
			 * @param {string} langPath - The path to the configuration files.
			 *
			 * @returns {Promise<string>}
			 */
			prettier: async (content, request, langPath) => {
				const configPath = path.join(process.cwd(), langPath, 'prettier.config.js');
				const configFile = await prettier.resolveConfig(configPath);
				const result     = await prettier.format(content, { filepath: request.filePath, ...configFile });

				return result || content;
			},

			/**
			 * Formats code using ESLint's auto-fix capabilities.
			 *
			 * @param {string} content  - The content to format.
			 * @param {object} request  - The request object.
			 * @param {string} langPath - The path to the configuration files.
			 *
			 * @returns {Promise<string>}
			 */
			eslintFix: async (content, request, langPath) => {
				if ('json' === request.language && 'package.json' !== request.fileName) {
					return;
				}

				const configFile = path.join(process.cwd(), langPath, 'eslint.config.js');
				const eslint     = new ESLint({ cwd: request.workspacePath, overrideConfigFile: configFile, fix: true });
				const result     = await eslint.lintText(content, { filePath: request.filePath });

				return result?.[0]?.output || content;
			},

			/**
			 * Removes trailing slashes from self-closing HTML tags.
			 *
			 * @param {string} content - The content to format.
			 *
			 * @returns {Promise<string>}
			 */
			removeSelfClosingSlash: async (content) => {
				const { removeSelfClosingSlash } = await import('../utils/utils.mjs');
				const result                     = removeSelfClosingSlash(content);

				return result || content;
			},

			/**
			 * Lints code using ESLint to detect potential errors and style violations.
			 *
			 * @param {string} content  - The content to lint.
			 * @param {object} request  - The request object.
			 * @param {string} langPath - The path to the configuration files.
			 *
			 * @returns {Promise<object>}
			 */
			eslint: async (content, request, langPath) => {
				if ('json' === request.language && 'package.json' !== request.fileName) {
					return;
				}

				const standard   = request.linterStandard;
				const configFile = path.join(process.cwd(), langPath, 'eslint.config.js');
				const eslint     = new ESLint({ cwd: request.workspacePath, overrideConfigFile: configFile });
				const result     = (await eslint.lintText(content, { filePath: request.filePath })) || [];

				return this.parseDiagnostics('eslint', result, standard);
			},

			/**
			 * Detects and reports emoji usage violations in code using Frakto's custom emoji linter.
			 *
			 * @param {string} content - The content to lint.
			 * @param {object} request - The request object.
			 *
			 * @returns {Promise<Array>}
			 */
			emoji: async (content, request) => {
				const standard = request.linterStandard;
				const emoji    = new fraktoEmojiLinter({ whitelist: ['©'] });
				const result   = emoji.detectEmojis(content) || [];

				return this.parseDiagnostics('emoji', result, standard);
			},

			/**
			 * TODO: Split in separate functions.
			 * PHP CodeSniffer formatter and linter.
			 *
			 * @param {string} content - The content to process.
			 * @param {object} config  - Tool configuration.
			 * @param {string} mode    - Processing mode.
			 *
			 * @returns {Promise<object>}
			 */
			phpcs: async (content, config, mode) => {
				const diagnostics = [];
				const standard    = config.standard || 'PSR2';

				// Format with PHPCBF.
				if (['format', 'both'].includes(mode)) {
					const phpcbfPath = path.join(config.vendorPath, 'bin/phpcbf');
					content = await new Promise((resolve, reject) => {
						let stdout = '';
						let stderr = '';
						const child = spawn('php', [phpcbfPath, `--standard=${standard}`, '-']);

						child.stdout.on('data', (data) => {
							stdout += data.toString();
						});
						child.stderr.on('data', (data) => {
							stderr += data.toString();
						});
						child.on('error', (error) => {
							reject(error);
						});
						child.on('close', (code) => {
							if (0 !== code && !stdout) {
								return reject(new Error(stderr || `phpcbf failed with exit code ${code}`));
							}
							resolve(stdout || content);
						});

						child.stdin.write(content);
						child.stdin.end();
					});
				}

				// Lint with PHPCS.
				if (['lint', 'both'].includes(mode)) {
					const phpcsPath        = path.join(config.vendorPath, 'bin/phpcs');
					const diagnostic       = await new Promise((resolve, reject) => {
						let stdout = '';
						let stderr = '';
						const child = spawn('php', [phpcsPath, `--standard=${standard}`, '--report=json', '-']);

						child.stdout.on('data', (data) => {
							stdout += data.toString();
						});
						child.stderr.on('data', (data) => {
							stderr += data.toString();
						});
						child.on('error', (error) => {
							reject(error);
						});
						child.on('close', (code) => {
							if (0 !== code && !stdout) {
								return reject(new Error(stderr || `phpcs failed with exit code ${code}`));
							}
							resolve(stdout);
						});

						child.stdin.write(content);
						child.stdin.end();
					});

					const parsedDiagnostic = JSON.parse(diagnostic);
					diagnostics.push(...this.parsePHPDiagnostics(parsedDiagnostic, standard));
				}

				return { content, diagnostics };
			}
		};
	}

	/**
	 * Initialize language configurations.
	 *
	 * @returns {void}
	 */
	initializeLanguageConfigs() {
		this.languageConfigs = {
			javascript: {
				formatters: ['prettier', 'eslintFix'],
				linters: ['eslint', 'emoji'],
				path: 'configs/js'
			},
			typescript: {
				formatters: ['prettier', 'eslintFix'],
				linters: ['eslint', 'emoji'],
				path: 'configs/ts'
			},
			json: {
				formatters: ['prettier', 'eslintFix'],
				linters: ['eslint', 'emoji'],
				path: 'configs/json'
			},
			jsonc: {
				formatters: ['prettier'],
				linters: ['emoji'],
				path: 'configs/common'
			},
			markdown: {
				formatters: ['prettier'],
				linters: [],
				path: 'configs/md'
			},
			html: {
				formatters: ['prettier', 'removeSelfClosingSlash', 'emoji'],
				linters: [],
				path: 'configs/html'
			},
			css: {
				// TODO: Implement CSS formatting and linting
				formatters: [],
				linters: [],
				path: 'css'
			},
			scss: {
				// TODO: Implement SCSS formatting and linting
				formatters: [],
				linters: [],
				path: 'scss'
			},
			php: {
				formatters: ['phpcbf'],
				linters: ['phpcs'],
				path: 'vendor'
			},
			yaml: {
				formatters: ['prettier'],
				linters: [],
				path: 'configs/common'
			}
		};
	}

	/**
	 * Prepares diagnostics for the response payload.
	 *
	 * @param {string} linter - The linter used.
	 * @param {object} data   - The object containing diagnostics data.
	 * @param {string} source - The source of the diagnostics.
	 *
	 * @returns {string[]|null}
	 */
	parseDiagnostics(linter, data, source) {
		if (!Array.isArray(data)) {
			return null;
		}

		if ('eslint' === linter) {
			return data.flatMap((result) =>
				result.messages.map((diagnostic) => ({
					line: diagnostic.line || 0,
					column: diagnostic.column || 0,
					endLine: diagnostic.endLine || 1,
					endColumn: diagnostic.endColumn || 1,
					type: 2 === diagnostic.severity ? 'ERROR' : 1 === diagnostic.severity ? 'WARNING' : 'INFO',
					message: diagnostic.message || 'ESLint error',
					source: source,
					code: diagnostic.ruleId || 'unknown'
				}))
			);
		}
		else if ('emoji' === linter) {
			return data.map((diagnostic) => ({
				line: diagnostic.line || 0,
				column: diagnostic.column || 0,
				endLine: diagnostic.endLine || 1,
				endColumn: diagnostic.endColumn || 1,
				type: diagnostic.severity.toUpperCase(),
				message: diagnostic.message || 'Frakto Emoji Linter error',
				source: source,
				code: 'no-emoji'
			}));
		}
		else if ('phpcs' === linter) {
			return data.files.STDIN.messages.map((diagnostic) => ({
				line: diagnostic.line || 0,
				column: diagnostic.column || 0,
				type: diagnostic.type?.toUpperCase() || 'ERROR',
				message: diagnostic.message || 'PHP CodeSniffer error',
				source: source,
				code: diagnostic.source || 'unknown'
			}));
		}
	}

	/**
	 * Checks if a file path matches any ignore pattern.
	 *
	 * @param {string} mode     - The processing mode.
	 * @param {string} filePath - The file path to check.
	 *
	 * @returns {boolean}
	 */
	shouldIgnore(mode, filePath) {
		if ('format' === mode) {
			return this.ignoreOnFormat.some((pattern) => new RegExp(pattern).test(filePath));
		}
		else if ('lint' === mode) {
			return this.ignoreOnLint.some((pattern) => new RegExp(pattern).test(filePath));
		}
	}

	/**
	 * Main audit method - processes content for a specific language.
	 *
	 * @param {string} language - The language to process.
	 * @param {object} request  - The request object containing content and options.
	 *
	 * @returns {Promise<object>}
	 */
	async audit(language, request) {
		const response = { formatted: null, diagnostics: null };
		const config   = this.languageConfigs[language];

		if (!config) {
			throw new Error(`Unsupported language: ${language}`);
		}

		let content     = request.content;
		let diagnostics = [];

		// Formatters pipeline
		if (['format', 'both'].includes(request.mode)) {
			for (const formatterName of config.formatters || []) {
				const langPath = this.languageConfigs[language]['path'];
				const result   = await this.toolHandlers[formatterName](content, request, langPath);

				if (result && 'string' === typeof result) content = result;
			}
		}

		// Linters pipeline
		if (['lint', 'both'].includes(request.mode)) {
			for (const linterName of config.linters || []) {
				const langPath = this.languageConfigs[language]['path'];
				const result   = await this.toolHandlers[linterName](content, request, langPath);

				if (Array.isArray(result)) diagnostics.push(...result);
			}
		}

		response.formatted = content;
		response.diagnostics = diagnostics;

		return response;
	}
}

// Export the class itself.
export default FraktoAuditor;

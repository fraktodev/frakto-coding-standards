#!/usr/bin/env node

import { execFile } from 'child_process';
import { ESLint } from 'eslint';
import prettier from 'prettier';
import path from 'path';

/**
 * Throws an error with the specified message.
 * @param {*} message - The error message to throw.
 *
 * @returns {void}
 */
const throwError = (message) => {
	const errorMessage = typeof message === 'string' ? message : message.toString();
	process.stderr.write(errorMessage);
	process.exit(1);
};

/**
 * Retrieves and validates the payload from the environment variable.
 *
 * @returns {Object} The parsed payload object.
 */
const getPayload = () => {
	const rawPayload = process.env.FRAKTO_PAYLOAD;
	if (!rawPayload) {
		throwError('Missing FRAKTO_PAYLOAD environment variable.');
	}

	let payload;
	try {
		payload = JSON.parse(rawPayload);
	} catch (error) {
		throwError(`Invalid FRAKTO_PAYLOAD JSON: ${error.message}`);
	}

	return payload;
};

/**
 * Retrieves the appropriate formatter for the given programming language.
 *
 * @param {string} language - The programming language to get the formatter for.
 *
 * @returns {string}
 */
const getFormatter = (language) => {
	const formatters = {
		javascript: 'prettier',
		typescript: 'prettier',
		css: 'prettier',
		scss: 'prettier',
		html: 'prettier',
		php: 'phpcs'
	};

	return formatters[language] || 'unknown';
};

/**
 * Retrieves the appropriate linter for the given programming language.
 *
 * @param {string} language - The programming language to get the linter for.
 *
 * @returns {string}
 */
const getLinter = (language) => {
	const linters = {
		javascript: 'eslint',
		typescript: 'eslint',
		php: 'phpcs'
	};

	return linters[language] || 'unknown';
};

/**
 * Retrieves the appropriate parser for the given programming language.
 *
 * @param {string} language - The programming language to get the parser for.
 *
 * @returns {string}
 */
const getParser = (language) => {
	const parsers = {
		javascript: 'babel',
		typescript: 'typescript',
		css: 'css',
		scss: 'scss',
		html: 'html'
	};

	return parsers[language] || 'unknown';
};

/**
 * Prepares PHP diagnostics for the response payload.
 *
 * @param {Object} data   - The diagnostics data.
 * @param {string} source - The source of the diagnostics.
 *
 * @returns {String[]}
 */
const parsePHPDiagnostics = (data, source) => {
	return data.files.STDIN.messages.map((diagnostic) => ({
		line: diagnostic.line || 0,
		column: diagnostic.column || 0,
		type: diagnostic.type === 'ERROR' || diagnostic.type === 'WARNING' ? diagnostic.type : 'INFO',
		message: diagnostic.message || '',
		source: source,
		code: diagnostic.source || 'PHP Coding Standards'
	}));
};

/**
 * Prepares OxLint diagnostics for the response payload.
 *
 * @param {Object} data   - The diagnostics data.
 * @param {string} source - The source of the diagnostics.
 *
 * @returns {String[]}
 */
const parseESLintDiagnostics = (data, source) => {
	return data.flatMap((result) =>
		result.messages.map((diagnostic) => ({
			line: diagnostic.line || 0,
			column: diagnostic.column || 0,
			endLine: diagnostic.endLine || 0,
			endColumn: diagnostic.endColumn || 0,
			type: diagnostic.severity === 2 ? 'ERROR' : 'WARNING',
			message: diagnostic.message || '',
			source: source,
			code: diagnostic.ruleId || 'ESLint Coding Standards'
		}))
	);
};

export const runESLint = async (code) => {
	const eslint = new ESLint({
		overrideConfigFile: path.join(process.cwd(), 'eslint.config.js')
	});

	const results = await eslint.lintText(code);
	return results;
};

/**
 * Runs the main logic of the script.
 *
 * @returns {Promise<void>}
 */
const run = async () => {
	try {
		const request = getPayload();
		const response = {
			formatted: null,
			diagnostics: null,
			debug: null
		};

		const formatter = getFormatter(request.language);
		const linter = getLinter(request.language);

		if (['format', 'both'].includes(request.mode)) {
			if (formatter === 'prettier') {
				const parser = getParser(request.language);
				const configFile = await prettier.resolveConfigFile();
				const prettierFraktoConfig = await prettier.resolveConfig(configFile);
				const prettierUserConfig = request.prettierConfig || {};
				const prettierConfig = { parser: parser, ...prettierFraktoConfig, ...prettierUserConfig };
				const formatted = await prettier.format(request.content, prettierConfig);

				response.formatted = formatted || request.content;
			}

			if (formatter === 'phpcs') {
				const linterStandard = request.linterStandard || 'PSR2';
				const phpcbfPath = path.join(process.cwd(), 'vendor', 'bin', 'phpcbf');
				const formatted = await new Promise((resolve, reject) => {
					const child = execFile(
						'php',
						[phpcbfPath, `--standard=${linterStandard}`, '-'],
						{ maxBuffer: request.maxExecTime },
						(error, stdout, stderr) => {
							if (error && !stdout) {
								return reject(new Error(error.message || stderr));
							}

							resolve(stdout || request.content);
						}
					);

					child.on('error', (error) => {
						reject(error);
					});

					child.stdin.write(request.content);
					child.stdin.end();
				});

				response.formatted = formatted || request.content;
			}
		}

		if (['lint', 'both'].includes(request.mode)) {
			if (linter === 'eslint') {
				const linterStandard = request.linterStandard || 'ESLint';
				const diagnostic = await runESLint(response.formatted || request.content);

				//response.debug = diagnostic;
				response.diagnostics = parseESLintDiagnostics(diagnostic, linterStandard);
			}

			if (formatter === 'phpcs') {
				const linterStandard = request.linterStandard || 'PSR2';
				const phpcsPath = path.join(process.cwd(), 'vendor', 'bin', 'phpcs');
				const diagnostic = await new Promise((resolve, reject) => {
					const child = execFile(
						'php',
						[phpcsPath, `--standard=${linterStandard}`, '--report=json', '-'],
						{ maxBuffer: request.maxExecTime },
						(error, stdout, stderr) => {
							if (error && !stdout) {
								return reject(new Error(error.message || stderr));
							}

							resolve(stdout || request.content);
						}
					);

					child.on('error', (error) => {
						reject(error);
					});

					child.stdin.write(response.formatted || request.content);
					child.stdin.end();
				});

				response.diagnostics = parsePHPDiagnostics(JSON.parse(diagnostic), linterStandard);
			}
		}

		process.stdout.write(JSON.stringify(response));
	} catch (error) {
		throwError(error);
	}
};

run();

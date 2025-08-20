#!/usr/bin/env node

// Dependencies.
import { spawn } from 'child_process';
import { ESLint } from 'eslint';
import prettier from 'prettier';
import path from 'path';
import process from 'process';

/**
 * Throws an error with the specified message.
 * @param {*} message - The error message to throw.
 *
 * @returns {void} - No return value.
 */
const throwError = (message) => {
	const errorMessage = 'string' === typeof message ? message : message.toString();
	process.stderr.write(errorMessage);
	process.exit(1);
};

/**
 * Retrieves and validates the payload from the environment variable.
 *
 * @returns {object} - The parsed payload object.
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
 * @returns {string} - The name of the formatter.
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
 * @returns {string} - The name of the linter.
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
 * @returns {string} - The name of the parser.
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
 * @param {object} data   - The diagnostics data.
 * @param {string} source - The source of the diagnostics.
 *
 * @returns {string[]} - The parsed diagnostics.
 */
const parsePHPDiagnostics = (data, source) => {
	return data.files.STDIN.messages.map((diagnostic) => ({
		line: diagnostic.line || 0,
		column: diagnostic.column || 0,
		type: 'ERROR' === diagnostic.type || 'WARNING' === diagnostic.type ? diagnostic.type : 'INFO',
		message: diagnostic.message || '',
		source: source,
		code: diagnostic.source || 'PHP Coding Standards'
	}));
};

/**
 * Prepares OxLint diagnostics for the response payload.
 *
 * @param {object} data   - The diagnostics data.
 * @param {string} source - The source of the diagnostics.
 *
 * @returns {string[]} - The parsed diagnostics.
 */
const parseESLintDiagnostics = (data, source) => {
	return data.flatMap((result) =>
		result.messages.map((diagnostic) => ({
			line: diagnostic.line || 0,
			column: diagnostic.column || 0,
			endLine: diagnostic.endLine || 0,
			endColumn: diagnostic.endColumn || 0,
			type: 2 === diagnostic.severity ? 'ERROR' : 'WARNING',
			message: diagnostic.message || '',
			source: source,
			code: diagnostic.ruleId || 'ESLint Coding Standards'
		}))
	);
};

/**
 * Runs ESLint on the provided code.
 *
 * @param {string} code - The code to lint.
 *
 * @returns {object} - The ESLint results.
 */
const runESLint = async (code) => {
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
			if ('prettier' === formatter) {
				const parser = getParser(request.language);
				const configFile = await prettier.resolveConfigFile();
				const prettierFraktoConfig = await prettier.resolveConfig(configFile);
				const prettierConfig = { parser: parser, ...prettierFraktoConfig };
				const formatted = await prettier.format(request.content, prettierConfig);

				response.formatted = formatted || request.content;
			}

			if ('phpcs' === formatter) {
				const linterStandard = request.linterStandard || 'PSR2';
				const phpcbfPath = path.join(process.cwd(), 'vendor', 'bin', 'phpcbf');
				const formatted = await new Promise((resolve, reject) => {
					let stdout = '';
					let stderr = '';
					const child = spawn('php', [phpcbfPath, `--standard=${linterStandard}`, '-']);

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

						resolve(stdout || request.content);
					});

					child.stdin.write(request.content);
					child.stdin.end();
				});

				response.formatted = formatted || request.content;
			}
		}

		if (['lint', 'both'].includes(request.mode)) {
			if ('eslint' === linter) {
				const linterStandard = request.linterStandard || 'ESLint';
				const diagnostic = await runESLint(response.formatted || request.content);

				//response.debug = diagnostic;
				response.diagnostics = parseESLintDiagnostics(diagnostic, linterStandard);
			}

			if ('phpcs' === formatter) {
				const linterStandard = request.linterStandard || 'PSR2';
				const phpcsPath = path.join(process.cwd(), 'vendor', 'bin', 'phpcs');
				const diagnostic = await new Promise((resolve, reject) => {
					let stdout = '';
					let stderr = '';
					const child = spawn('php', [phpcsPath, `--standard=${linterStandard}`, '--report=json', '-']);
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

						resolve(stdout || request.content);
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

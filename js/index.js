#!/usr/bin/env node

// Dependencies.
import { getPayload, throwError } from '../common/utils.js';
import { ESLint } from 'eslint';
import prettier from 'prettier';
import path from 'path';
import process from 'process';

/**
 * Prepares diagnostics for the response payload.
 *
 * @param {object} data   - The diagnostics data.
 * @param {string} source - The source of the diagnostics.
 * @returns {string[]}
 */
const parseDiagnostics = (data, source) => {
	return data.flatMap((result) =>
		result.messages.map((diagnostic) => ({
			line: diagnostic.line || 0,
			column: diagnostic.column || 0,
			endLine: diagnostic.endLine || 0,
			endColumn: diagnostic.endColumn || 0,
			type: 2 === diagnostic.severity ? 'ERROR' : 'WARNING',
			message: diagnostic.message || '',
			source: source,
			code: diagnostic.ruleId || 'ESLint Coding Standards',
		})),
	);
};

/**
 * Runs the main logic of the script.
 *
 * @throws {error} If an error occurs during processing.
 * @returns {promise<void>}
 */
(async () => {
	const request = getPayload();
	const response = {
		formatted: null,
		diagnostics: null,
		debug: null,
	};

	let content = request.content;

	// Run formatter
	if (['format', 'both'].includes(request.mode)) {
		const prettierConfigFile = await prettier.resolveConfigFile();
		const prettierFraktoConfig = await prettier.resolveConfig(prettierConfigFile);
		const prettierConfig = { filepath: request.filePath, ...prettierFraktoConfig };

		content = (await prettier.format(content, prettierConfig)) || content;
		response.formatted = content;
	}

	// Run linter
	if (['lint', 'both'].includes(request.mode)) {
		const linterStandard = request.linterStandard || 'ESLint';
		const esLintConfigFile = path.join(process.cwd(), 'eslint.config.js');
		const esLintConfig = { cwd: request.workspacePath, overrideConfigFile: esLintConfigFile };
		const eslint = new ESLint(['both'].includes(request.mode) ? { ...esLintConfig, ...{ fix: true } } : esLintConfig);
		const diagnostic = await eslint.lintText(content, { filePath: request.filePath });

		if (['both'].includes(request.mode)) {
			content = diagnostic?.[0]?.output || content;
			response.formatted = content;
		}
		response.diagnostics = parseDiagnostics(diagnostic, linterStandard);
	}

	// Write response
	process.stdout.write(JSON.stringify(response));
})().catch((error) => {
	throwError(error);
});

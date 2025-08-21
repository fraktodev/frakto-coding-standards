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
 *
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
			code: diagnostic.ruleId || 'ESLint JS'
		}))
	);
};

(async () => {
	const request  = getPayload();
	const response = {
		formatted: null,
		diagnostics: null,
		debug: null
	};

	let content = request.content;
	const mode                 = request.mode;
	const linterStandard       = request.linterStandard || 'ESLint';

	const prettierConfigFile   = await prettier.resolveConfigFile();
	const prettierFraktoConfig = await prettier.resolveConfig(prettierConfigFile);
	const prettierConfig       = { filepath: request.filePath, ...prettierFraktoConfig };

	const eslintConfigFile     = path.join(process.cwd(), 'eslint.config.js');
	const eslintConfig         = { cwd: request.workspacePath, overrideConfigFile: eslintConfigFile };
	const eslint               = new ESLint(['format', 'both'].includes(mode) ? { ...eslintConfig, fix: true } : eslintConfig);

	// Run formatter
	if ('format' === mode) {
		content = (await prettier.format(content, prettierConfig)) || content;
		content = (await eslint.lintText(content, { filePath: request.filePath }))?.[0]?.output || content;
		response.formatted = content;
	}

	// Run linter
	if ('lint' === mode) {
		const diagnostics = await eslint.lintText(content, { filePath: request.filePath });
		response.diagnostics = parseDiagnostics(diagnostics, linterStandard);
	}

	// Run formatter and linter
	if ('both' === mode) {
		content = (await prettier.format(content, prettierConfig)) || content;
		const linter = await eslint.lintText(content, { filePath: request.filePath });
		content = linter?.[0]?.output || content;
		response.formatted = content;
		response.diagnostics = parseDiagnostics(linter, linterStandard);
	}

	// Write response
	process.stdout.write(JSON.stringify(response));
})().catch((error) => {
	throwError(error);
});

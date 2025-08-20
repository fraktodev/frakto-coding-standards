#!/usr/bin/env node

// Dependencies.
import { getPayload, throwError } from '../common/utils.js';
import prettier from 'prettier';
import process from 'process';

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
		debug: null
	};

	// Run formatter
	if (['format', 'both'].includes(request.mode)) {
		const configFile = await prettier.resolveConfigFile();
		const prettierFraktoConfig = await prettier.resolveConfig(configFile);
		const prettierConfig = { filepath: request.filePath, ...prettierFraktoConfig };
		const formatted = await prettier.format(request.content, prettierConfig);

		response.formatted = formatted || request.content;
	}

	// Write response
	process.stdout.write(JSON.stringify(response));
})().catch((error) => {
	throwError(error);
});

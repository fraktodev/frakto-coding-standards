#!/usr/bin/env node

// Dependencies.
import { getPayload, throwError } from '../common/utils.js';
import prettier from 'prettier';
import process from 'process';

(async () => {
	const request  = getPayload();
	const response = {
		formatted: null,
		diagnostics: null,
		debug: null
	};

	// Run formatter
	let content = request.content;
	const prettierConfigFile   = await prettier.resolveConfigFile();
	const prettierFraktoConfig = await prettier.resolveConfig(prettierConfigFile);
	const prettierConfig       = { filepath: request.filePath, ...prettierFraktoConfig };
	response.formatted = (await prettier.format(request.content, prettierConfig)) || content;

	// Write response
	process.stdout.write(JSON.stringify(response));
})().catch((error) => {
	throwError(error);
});

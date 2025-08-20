#!/usr/bin/env node

// Dependencies.
import { getPayload, throwError } from '../common/utils.js';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
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
 * Runs the main logic of the script.
 *
 * @throws {error} If an error occurs during processing.
 * @returns {promise<void>}
 */
(async () => {
	const dirName = path.dirname(fileURLToPath(import.meta.url));
	const request = getPayload();
	const response = {
		formatted: null,
		diagnostics: null,
		debug: null
	};

	// Run formatter
	if (['format', 'both'].includes(request.mode)) {
		const linterStandard = request.linterStandard || 'PSR2';
		const phpcbfPath = path.join(dirName, '../vendor/bin/phpcbf');
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

	// Run linter
	if (['lint', 'both'].includes(request.mode)) {
		const linterStandard = request.linterStandard || 'PSR2';
		const phpcsPath = path.join(dirName, '../vendor/bin/phpcs');
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

		response.diagnostics = parseDiagnostics(JSON.parse(diagnostic), linterStandard);
	}

	// Write response
	process.stdout.write(JSON.stringify(response));
})().catch((error) => {
	throwError(error);
});

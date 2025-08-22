#!/usr/bin/env node
/* eslint-disable no-console */

// Dependencies
import { readFileSync, writeFileSync } from 'node:fs';
import { fraktoCommonAudit } from './common/index.mjs';
import { fraktoHTMLAudit } from './html/index.mjs';
import { fraktoJSAudit } from './js/index.mjs';
import { fraktoJSONAudit } from './json/index.mjs';
import { fraktoMDAudit } from './md/index.mjs';
import { fraktoTSAudit } from './ts/index.mjs';
import process from 'node:process';
import path from 'node:path';
import pc from 'picocolors';

// CLI
(async () => {
	const args = process.argv.slice(2);

	if (2 > args.length) {
		console.error(pc.red('Usage: fraktoJSAudit <mode> <filePath>'));
		console.error(pc.yellow('mode: format | lint | both'));
		process.exit(1);
	}

	const [mode, filePath] = args;

	if (!['format', 'lint', 'both'].includes(mode)) {
		console.error(pc.red('Invalid mode. Use: format | lint | both'));
		process.exit(1);
	}

	try {
		const content = readFileSync(filePath, 'utf8');

		// Detect language from file extension
		const ext = path.extname(filePath).toLowerCase();

		/* eslint-disable @typescript-eslint/naming-convention */
		const languageMap = {
			'.js': 'javascript',
			'.mjs': 'javascript',
			'.jsx': 'javascript',
			'.ts': 'typescript',
			'.tsx': 'typescript',
			'.html': 'html',
			'.htm': 'html',
			'.json': 'json',
			'.md': 'markdown',
			'.markdown': 'markdown'
		};
		/* eslint-enable @typescript-eslint/naming-convention */

		const language = languageMap[ext] || 'common';

		const request  = {
			mode,
			content,
			filePath: path.resolve(filePath),
			language,
			linterStandard: 'Frakto',
			workspacePath: path.dirname(path.resolve(filePath))
		};

		let response;
		switch (request.language) {
			case 'html':
				response = await fraktoHTMLAudit(request, path.join(process.cwd(), 'html'));
				break;
			case 'javascript':
				response = await fraktoJSAudit(request, path.join(process.cwd(), 'js'));
				break;
			case 'json':
				response = await fraktoJSONAudit(request, path.join(process.cwd(), 'json'));
				break;
			case 'markdown':
				response = await fraktoMDAudit(request, path.join(process.cwd(), 'md'));
				break;
			case 'typescript':
				response = await fraktoTSAudit(request, path.join(process.cwd(), 'ts'));
				break;
			default:
				response = await fraktoCommonAudit(request, path.join(process.cwd(), 'common'));
		}

		if (['format', 'both'].includes(mode) && null !== response.formatted) {
			if (response.formatted === content) {
				console.log(pc.blue('No formatting changes'));
			}
			else {
				writeFileSync(filePath, response.formatted, 'utf8');
				console.log(pc.green('File formatted'));
			}
		}

		if (['lint', 'both'].includes(mode) && response.diagnostics) {
			response.diagnostics.forEach((diagnostic) => {
				const coloredType = 'ERROR' === diagnostic.type ? pc.red(diagnostic.type) : pc.yellow(diagnostic.type);
				console.log(
					`${coloredType}: ${diagnostic.message} ${pc.dim(`(line ${diagnostic.line}, column ${diagnostic.column})`)}`
				);
			});
		}
	}
	catch (error) {
		console.error(pc.red('Error:'), error.message);
		process.exit(1);
	}
})();

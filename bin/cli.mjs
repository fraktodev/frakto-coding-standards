#!/usr/bin/env node
/* eslint-disable no-console */

// Dependencies
import pc from 'picocolors';
import path from 'node:path';
import process from 'node:process';
import fraktoAuditor from '../src/index.mjs';
import { readFileSync, writeFileSync } from 'node:fs';

// CLI
(async () => {
	const args = process.argv.slice(2);

	if (2 > args.length) {
		console.error(pc.red('Usage: fraktoAudit <mode> <filePath>'));
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
		const ext     = path.extname(filePath).toLowerCase();

		/* eslint-disable @typescript-eslint/naming-convention */
		const languageMap = {
			'.js': 'javascript',
			'.mjs': 'javascript',
			'.cjs': 'javascript',
			'.ts': 'typescript',
			'.mts': 'typescript',
			'.cts': 'typescript',
			'.html': 'html',
			'.htm': 'html',
			'.json': 'json',
			'.jsonc': 'jsonc',
			'.md': 'markdown',
			'.markdown': 'markdown',
			'.php': 'php',
			'.phtml': 'php',
			'.css': 'css',
			'.scss': 'scss',
			'.sass': 'scss',
			'.yaml': 'yaml',
			'.yml': 'yaml'
		};
		/* eslint-enable @typescript-eslint/naming-convention */

		const language = languageMap[ext];
		const request  = {
			mode,
			content,
			filePath: path.resolve(filePath),
			language,
			fileName: path.basename(filePath),
			linterStandard: 'Frakto',
			workspacePath: path.dirname(path.resolve(filePath))
		};

		const auditor  = new fraktoAuditor();
		const response = await auditor.audit(language, request);

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

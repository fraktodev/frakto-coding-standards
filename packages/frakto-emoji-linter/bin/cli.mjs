#!/usr/bin/env node
/* eslint-disable no-console */

// Dependencies
import pc from 'picocolors';
import process from 'node:process';
import fraktoEmojiLinter from '../index.mjs';

const args    = process.argv.slice(2);
const fixMode = args.includes('--fix');
const files   = args.filter((a) => !a.startsWith('--'));

if (!files.length) {
	console.error(pc.red('Usage: fraktoEmojiLinter [--fix] <file1> <file2> ...'));
	process.exit(1);
}

for (const file of files) {
	const emoji   = new fraktoEmojiLinter({ severity: 'warning' });
	const results = emoji.lintFile(file);

	if (results.length) {
		console.log(`\n${pc.cyan(file)}: Found ${pc.red(results.length)} emoji(s):`);
		results.forEach((result) => {
			const type = 'error' === result.severity ? pc.red('Error') : pc.yellow('Warning');
			console.log(
				`  - ${type}: ${pc.cyan(result.emoji)} ${pc.dim(`(found on line ${result.line}, column ${result.column})`)}`
			);
		});

		if (fixMode) {
			emoji.fixFile(file);
			console.log(pc.green(`Fixed: removed emojis from ${file}`));
		}
	}
	else {
		console.log(`${pc.green(file)}: ${pc.dim('no emojis found')}`);
	}
}

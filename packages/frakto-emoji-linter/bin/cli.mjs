#!/usr/bin/env node
/* eslint-disable no-console */

// Dependencies
import fraktoEmojiLinter from '../index.mjs';
import process from 'node:process';
import pc from 'picocolors';

const args    = process.argv.slice(2);
const fixMode = args.includes('--fix');
const files   = args.filter((a) => !a.startsWith('--'));

if (!files.length) {
	console.error(pc.red('Usage: fraktoEmojiLinter [--fix] <file1> <file2> ...'));
	process.exit(1);
}

for (const file of files) {
	const results = fraktoEmojiLinter.lintFile(file);

	if (results.length) {
		console.log(`\n${pc.yellow(file)}: Found ${pc.red(results.length)} emoji(s):`);
		results.forEach((r) => {
			console.log(`  - "${pc.cyan(r.emoji)}" ${pc.dim(`(line ${r.line}, column ${r.column})`)}`);
		});

		if (fixMode) {
			fraktoEmojiLinter.fixFile(file);
			console.log(pc.green(`Fixed: removed emojis from ${file}`));
		}
	}
	else {
		console.log(`${pc.green(file)}: ${pc.dim('no emojis found')}`);
	}
}

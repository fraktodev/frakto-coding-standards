// Dependencies
import fs from 'fs';

/**
 * Detects emojis in a string.
 *
 * @param {string} content - The string to lint.
 *
 * @returns {any[]}
 */
const lintString = (content) => {
	let match;
	const emojiRegex = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu;
	const matches    = [];

	while (null !== (match = emojiRegex.exec(content))) {
		const index     = match.index;
		const endIndex  = match.index + match[0].length - 1;
		const line      = content.substring(0, index).split('\n').length;
		const endLine   = content.substring(0, endIndex).split('\n').length;
		const column    = index - content.lastIndexOf('\n', index - 1);
		const endColumn = endIndex - content.lastIndexOf('\n', endIndex - 1);

		matches.push({
			index,
			emoji: match[0],
			line,
			column,
			endLine,
			endColumn
		});
	}

	return matches;
};

/**
 * Lints a file for emojis.
 *
 * @param {string} filePath - The path to the file to lint.
 *
 * @returns {lintString}
 */
const lintFile = (filePath) => {
	const content = fs.readFileSync(filePath, 'utf8');
	return lintString(content);
};

/**
 * Fixes a string by removing emojis.
 *
 * @param {string} content - The string to fix.
 *
 * @returns {string}
 */
const fixString = (content) => {
	return content.replace(/\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu, '');
};

/**
 * Fixes a file by removing emojis.
 *
 * @param {string} filePath - The path to the file to fix.
 *
 * @returns {void}
 */
const fixFile = (filePath) => {
	const content = fs.readFileSync(filePath, 'utf8');
	const fixed   = fixString(content);
	fs.writeFileSync(filePath, fixed, 'utf8');
};

// Export
const fraktoEmojiLinter = lintString;
fraktoEmojiLinter.lintString = lintString;
fraktoEmojiLinter.lintFile = lintFile;
fraktoEmojiLinter.fixString = fixString;
fraktoEmojiLinter.fixFile = fixFile;

export default fraktoEmojiLinter;

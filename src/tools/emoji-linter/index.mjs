// Dependencies
import fs from 'node:fs';

/**
 * Frakto Emoji Linter a class for linting and fixing emoji usage in text.
 *
 * @class EmojiLinter
 */
class EmojiLinter {
	static severities = {
		error: 'error',
		warning: 'warning',
		info: 'info'
	};

	/**
	 * Constructor for FraktoEmojiLinter.
	 *
	 * @param {object} config - The object with configuration options for the linter.
	 *
	 * @returns {void}
	 */
	constructor(config) {
		const validValues = Object.values(EmojiLinter.severities);

		this.whitelist = config.whitelist || [];
		this.message = config.message || 'Emoji usage detected - emojis are not allowed in code';
		this.severity = validValues.includes(config.severity) ? config.severity : 'error';
	}

	/**
	 * Lint a string for emoji usage.
	 *
	 * @param {string} content - The content to lint.
	 *
	 * @returns {object[]}
	 */
	detectEmojis(content) {
		let match;
		const emojiRegex = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu;
		const matches    = [];

		while (null !== (match = emojiRegex.exec(content))) {
			const emoji = match[0];

			if (this.whitelist.includes(emoji)) {
				continue;
			}

			const index     = match.index;
			const endIndex  = match.index + match[0].length - 1;
			const line      = content.substring(0, index).split('\n').length;
			const endLine   = content.substring(0, endIndex).split('\n').length;
			const column    = index - content.lastIndexOf('\n', index - 1);
			const endColumn = endIndex - content.lastIndexOf('\n', endIndex - 1);

			matches.push({
				index,
				emoji,
				line,
				column,
				endLine,
				endColumn,
				message: this.message,
				severity: this.severity
			});
		}

		return matches;
	}

	/**
	 * Fix emoji usage in a string.
	 *
	 * @param {string} content - The content to fix.
	 *
	 * @returns {string}
	 */
	removeEmojis(content) {
		const emojiRegex = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu;
		return content.replace(emojiRegex, (match) => {
			return this.whitelist.includes(match) ? match : '';
		});
	}

	/**
	 * Lint a file for emoji usage.
	 *
	 * @param {string} filePath - The path to the file to lint.
	 *
	 * @returns {object[]}
	 */
	lintFile(filePath) {
		const content = fs.readFileSync(filePath, 'utf8');
		return this.detectEmojis(content);
	}

	/**
	 * Fix emoji usage in a file.
	 *
	 * @param {string} filePath - The path to the file to fix.
	 *
	 * @returns {void}
	 */
	fixFile(filePath) {
		const content = fs.readFileSync(filePath, 'utf8');
		const fixed   = this.removeEmojis(content);
		fs.writeFileSync(filePath, fixed, 'utf8');
	}
}

export default EmojiLinter;

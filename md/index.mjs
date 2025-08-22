// Dependencies
import { parseDiagnostics } from '../utils/utils.mjs';
import prettier from 'prettier';
import fraktoEmojiLinter from '@frakto/frakto-emoji-linter';
import path from 'node:path';

/**
 * Markdown formatter and linter.
 * The request object must contain the following properties:
 * - mode: 'format' | 'lint' | 'both'.
 * - content: string.
 * - linterStandard: string | null.
 * - filePath: string.
 *
 * @param {object} request - The request object.
 * @param {string} cwd     - The working directory where config files are located.
 *
 * @returns {Promise<object>}
 */
export const fraktoMDAudit = async (request, cwd) => {
	const response = {
		formatted: null,
		diagnostics: null,
		debug: null
	};

	let content     = request.content;
	let diagnostics = [];

	const mode               = request.mode;
	const linterStandard     = request.linterStandard || 'Frakto';

	const prettierConfigFile = await prettier.resolveConfig(path.join(cwd, 'prettier.config.js'));
	const prettierConfig     = { filepath: request.filePath, ...prettierConfigFile };

	// Run formatter
	if ('format' === mode) {
		// Prettier
		content = (await prettier.format(content, prettierConfig)) || content;

		response.formatted = content;
	}

	// Run linter
	if ('lint' === mode) {
		// Frakto Emoji Linter
		const emojiDiagnostics = fraktoEmojiLinter.lintString(content);
		diagnostics.push(...parseDiagnostics('emoji', emojiDiagnostics, linterStandard));

		response.diagnostics = diagnostics;
	}

	// Run formatter and linter
	if ('both' === mode) {
		// Prettier
		content = (await prettier.format(content, prettierConfig)) || content;
		// Frakto Emoji Linter
		const emojiDiagnostics = fraktoEmojiLinter.lintString(content);
		diagnostics.push(...parseDiagnostics('emoji', emojiDiagnostics, linterStandard));

		response.formatted = content;
	}

	return response;
};

// Dependencies.
import { parseDiagnostics } from '../utils/utils.mjs';
import { ESLint } from 'eslint';
import prettier from 'prettier';
import fraktoEmojiLinter from '@frakto/frakto-emoji-linter';
import path from 'node:path';

/**
 * Typescript formatter and linter.
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
export const fraktoTSAudit = async (request, cwd) => {
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

	const eslintConfigFile   = path.join(cwd, 'eslint.config.js');
	const eslintConfig       = { cwd: request.workspacePath, overrideConfigFile: eslintConfigFile };
	const eslint             = new ESLint(['format', 'both'].includes(mode) ? { ...eslintConfig, fix: true } : eslintConfig);

	// Run formatter
	if ('format' === mode) {
		// Prettier
		content = (await prettier.format(content, prettierConfig)) || content;
		// Eslint
		content = (await eslint.lintText(content, { filePath: request.filePath }))?.[0]?.output || content;
		// Frakto Emoji Linter
		content = fraktoEmojiLinter.fixString(content) || content;

		response.formatted = content;
	}

	// Run linter
	if ('lint' === mode) {
		// Eslint
		const eslintDiagnostics = await eslint.lintText(content, { filePath: request.filePath });
		diagnostics.push(...parseDiagnostics('eslint', eslintDiagnostics, linterStandard));
		// Frakto Emoji Linter
		const emojiDiagnostics = fraktoEmojiLinter.lintString(content);
		diagnostics.push(...parseDiagnostics('emoji', emojiDiagnostics, linterStandard));

		response.diagnostics = diagnostics;
	}

	// Run formatter and linter
	if ('both' === mode) {
		// Prettier
		content = (await prettier.format(content, prettierConfig)) || content;
		// Eslint
		const esLinter = await eslint.lintText(content, { filePath: request.filePath });
		content = esLinter?.[0]?.output || content;
		diagnostics.push(...parseDiagnostics('eslint', esLinter, linterStandard));
		// Frakto Emoji Linter
		content = fraktoEmojiLinter.fixString(content) || content;

		response.formatted = content;
		response.diagnostics = diagnostics;
	}

	return response;
};

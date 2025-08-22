// Dependencies
import process from 'node:process';

/**
 * Prepares diagnostics for the response payload.
 *
 * @param {string} linter - The linter used.
 * @param {object} data   - The diagnostics data.
 * @param {string} source - The source of the diagnostics.
 *
 * @returns {string[]}
 */
export const parseDiagnostics = (linter, data, source) => {
	if ('eslint' === linter) {
		return data.flatMap((result) =>
			result.messages.map((diagnostic) => ({
				line: diagnostic.line || 0,
				column: diagnostic.column || 0,
				endLine: diagnostic.endLine || 0,
				endColumn: diagnostic.endColumn || 0,
				type: 2 === diagnostic.severity ? 'ERROR' : 'WARNING',
				message: diagnostic.message || '',
				source: source,
				code: diagnostic.ruleId || 'ESLint JS'
			}))
		);
	}
	else if ('emoji' === linter) {
		return data.map((diagnostic) => ({
			line: diagnostic.line || 0,
			column: diagnostic.column || 0,
			endLine: diagnostic.endLine || 0,
			endColumn: diagnostic.endColumn || 0,
			type: 'ERROR',
			message: `Emoji detected: ${diagnostic.emoji}`,
			source: source,
			code: 'no-emoji'
		}));
	}
};

/**
 * Throws an error with the specified message.
 *
 * @param {string} message - The error message to throw.
 *
 * @returns {void}
 */
export const throwError = (message) => {
	const errorMessage = 'string' === typeof message ? message : message.toString();
	process.stderr.write(errorMessage);
	process.exit(1);
};

/**
 * Retrieves and validates the payload from the environment variable.
 *
 * @returns {object}
 */
export const getPayload = () => {
	const rawPayload = process.env.FRAKTO_PAYLOAD;
	if (!rawPayload) {
		throwError('Missing FRAKTO_PAYLOAD environment variable.');
	}

	let payload;
	try {
		payload = JSON.parse(rawPayload);
	}
	catch (error) {
		throwError(`Invalid FRAKTO_PAYLOAD JSON: ${error.message}`);
	}

	return payload;
};

/**
 * Removes trailing slashes from self-closing HTML tags.
 *
 * @param {string} html - The HTML content to process.
 *
 * @returns {string}
 */
export const removeSelfClosingSlash = (html) => {
	// List of self-closing HTML tags
	const selfClosingTags = [
		'circle',
		'ellipse',
		'line',
		'path',
		'polygon',
		'polyline',
		'rect',
		'stop',
		'use',
		'area',
		'base',
		'br',
		'col',
		'command',
		'embed',
		'hr',
		'img',
		'input',
		'keygen',
		'link',
		'meta',
		'param',
		'source',
		'track',
		'wbr'
	];

	// Regex for matching self-closing tags
	const regex = new RegExp(`<(${selfClosingTags.join('|')})([^>]*)\\s*/>`, 'gi');

	return html.replace(regex, (match, tagName, attributes) => {
		const trimmedAttributes = attributes.replace(/\s+$/, '');
		return `<${tagName}${trimmedAttributes}>`;
	});
};

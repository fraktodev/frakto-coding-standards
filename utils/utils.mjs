// Dependencies
import process from 'node:process';

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

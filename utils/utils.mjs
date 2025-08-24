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

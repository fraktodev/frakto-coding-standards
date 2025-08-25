/**
 * HTML Formatter - Removes trailing slashes from self-closing HTML tags.
 * This class provides HTML formatting functionality to conform to HTML5 standards
 * by removing trailing slashes from void elements.
 *
 * @class HTMLFormatter
 */
class HTMLFormatter {
	/**
	 * Constructor - Initialize the formatter with void elements configuration.
	 *
	 * @param {object} config - Optional. Object containing configuration for the formatter. Default: {}.
	 * @returns {void}
	 */
	constructor(config = {}) {
		this.initializeVoidElements(config.voidElements);
	}

	/**
	 * Initialize the list of void elements that should not have closing tags.
	 *
	 * @param {string[]} customElements - Optional. Custom list of void elements.
	 * @returns {void}
	 */
	initializeVoidElements(customElements) {
		this.voidElements = customElements || [
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
	}

	/**
	 * Format HTML content by removing trailing slashes from self-closing tags.
	 *
	 * @param {string} content - The HTML content to format.
	 * @returns {string}
	 */
	format(content) {
		if (!this.isValidContent(content)) {
			return content;
		}

		const pattern = new RegExp(`<(${this.voidElements.join('|')})([^>]*?)\\s*\\/?>`, 'gi');

		return content.replace(pattern, '<$1$2>');
	}

	/**
	 * Validate if the content is suitable for formatting.
	 *
	 * @param {string} content - The content to validate.
	 * @returns {boolean}
	 */
	isValidContent(content) {
		return content && 'string' === typeof content;
	}
}

export default HTMLFormatter;

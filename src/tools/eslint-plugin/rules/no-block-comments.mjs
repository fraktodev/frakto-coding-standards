// Dependencies
import { isDocblock, isCodeLookALike } from '../utils.mjs';

// Export Rule
export default {
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Disallow block comments /* */ in favor of line comments //',
			category: 'Best Practices',
			recommended: true
		},
		fixable: 'code',
		schema: []
	},
	create(context) {
		const sourceCode = context.sourceCode || context.getSourceCode();

		/**
		 * Converts block comment to line comments.
		 *
		 * @param {string} commentValue - The comment content.
		 * @returns {string}
		 */
		const convertToLineComments = (commentValue) => {
			const lines = commentValue.split('\n');
			const convertedLines = lines
				.map((line, index) => {
					const trimmedLine = line.trim();
					if (0 === index && index === lines.length - 1) {
						return `// ${trimmedLine}`;
					}
					else if (0 === index) {
						return `// ${trimmedLine}`;
					}
					else if (index === lines.length - 1) {
						return trimmedLine ? `// ${trimmedLine}` : '';
					}
					else {
						return `// ${trimmedLine}`;
					}
				})
				.filter((line) => '' !== line);

			return convertedLines.join('\n');
		};

		/**
		 * Check for block comments and report them.
		 *
		 * @returns {void}
		 */
		const checkBlockComments = () => {
			const comments = sourceCode.getAllComments();

			comments.forEach((comment) => {
				// Ignore certain block comments
				if ('Block' !== comment.type || isDocblock(comment) || isCodeLookALike(comment)) {
					return;
				}

				const value = comment.value.trim();

				// Ignore eslint block comments
				if (value.startsWith('eslint-')) {
					return;
				}

				const lines        = comment.value.split('\n');
				const isSingleLine = 1 === lines.length;

				// Report single-line block comment.
				if (isSingleLine) {
					context.report({
						node: comment,
						loc: comment.loc,
						message: 'Use line comment (//) instead of block comment (/* */).',
						fix: (fixer) => {
							const fixed = comment.value.trim();
							return fixer.replaceText(comment, `// ${fixed}`);
						}
					});
				}

				// Report multi-line block comment.
				if (!isSingleLine) {
					context.report({
						node: comment,
						loc: comment.loc,
						message: 'Use line comments (//) instead of block comment (/* */).',
						fix: (fixer) => {
							const fixed = convertToLineComments(comment.value);
							return fixer.replaceText(comment, fixed);
						}
					});
				}
			});
		};

		return {
			Program: checkBlockComments
		};
	}
};

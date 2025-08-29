// Dependencies
import { getDocblockData } from '../utils.mjs';

// Export Rule
export default {
	meta: {
		type: 'problem',
		docs: {
			description: 'Ensure docblock spacing is correct.',
			category: 'Best Practices',
			recommended: true
		},
		fixable: 'code',
		schema: []
	},
	create(context) {
		/**
		 * Retrieves tag lines with their indices.
		 *
		 * @param {string[]} lines - The docblock lines.
		 * @returns {object[]}
		 */
		const getTagLines = (lines) => {
			return lines.map((line, index) => ({ line, index })).filter(({ line }) => line.trim().startsWith('* @'));
		};

		/**
		 * Removes blank lines between tags.
		 *
		 * @param {string[]} lines    - The docblock lines.
		 * @param {object[]} tagLines - The tag lines with their indices.
		 * @returns {string}
		 */
		const removeBlankLinesBetweenTags = (lines, tagLines) => {
			const newLines = [];

			for (let j = 0; j < lines.length; j++) {
				const line        = lines[j];
				const isBlankLine = '*' === line.trim();

				if (isBlankLine) {
					const prevTagIndex = tagLines.findIndex(({ index }) => index < j);
					const nextTagIndex = tagLines.findIndex(({ index }) => index > j);

					if (-1 !== prevTagIndex && -1 !== nextTagIndex) {
						continue;
					}
				}

				newLines.push(line);
			}

			return newLines.join('\n');
		};

		/**
		 * Validates the docblock for a given node.
		 *
		 * @param {ASTNode} node - The node to validate.
		 * @returns {void}
		 */
		const validate = (node) => {
			const docData = getDocblockData(context, node);
			if (!docData) return;
			const { docblock, data, loc } = docData;

			// Extract description and tags
			const description = data.description?.trim() ?? '';
			const tags        = data.tags ?? [];

			// Extract lines
			const lines         = docblock.value.split('\n');
			const firstTagIndex = lines.findIndex((line) => line.trim().startsWith('* @'));

			// Report missing blank line after description
			if (description && 0 < tags.length) {
				const hasLineAfterDescription = 0 < firstTagIndex && '*' === lines[firstTagIndex - 1]?.trim();

				if (!hasLineAfterDescription) {
					context.report({
						loc: loc(description),
						message: 'There must be a blank line after the description.'
					});
					return;
				}
			}

			// Tags spacing
			const tagLines = getTagLines(lines);

			// All tags must be together (no blank lines between any tags)
			for (let i = 0; i < tagLines.length - 1; i++) {
				const currentIndex    = tagLines[i].index;
				const nextIndex       = tagLines[i + 1].index;
				const hasBlankBetween = lines.slice(currentIndex + 1, nextIndex).some((l) => '*' === l.trim());

				if (hasBlankBetween) {
					const currentTagMatch = tagLines[i].line.match(/@(\w+)/);
					const currentTagName  = currentTagMatch ? currentTagMatch[1] : 'param';

					// Report blank line between tags
					context.report({
						loc: loc(`@${currentTagName}`),
						message: 'Do not add blank lines between docblock tags. All tags must be together.',
						fix: (fixer) => {
							const fixed = removeBlankLinesBetweenTags(lines, tagLines);
							return fixer.replaceText(docblock, `/*${fixed}*/`);
						}
					});
					return;
				}
			}

			// Report blank line after last tag
			if (0 < tagLines.length) {
				const lastTagIndex      = tagLines[tagLines.length - 1].index;
				const remainingLines    = lines.slice(lastTagIndex + 1);
				const hasBlankAfterLast = remainingLines.some((line, index) => {
					const trimmed = line.trim();
					return '*' === trimmed && index < remainingLines.length - 1;
				});

				if (hasBlankAfterLast) {
					context.report({
						loc: {
							start: {
								line: docblock.loc.start.line + lastTagIndex + 1,
								column: 0
							},
							end: {
								line: docblock.loc.start.line + lines.length - 1,
								column: 0
							}
						},
						message: 'Unexpected blank line after last docblock tag.'
					});
					return;
				}
			}

			// Report double blank lines
			let blankLineCount = 0;
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i].trim();

				if ('*' !== line) blankLineCount = 0;
				if ('*' === line) {
					blankLineCount++;
					if (1 < blankLineCount) {
						context.report({
							loc: {
								start: {
									line: docblock.loc.start.line + i,
									column: 0
								},
								end: {
									line: docblock.loc.start.line + i,
									column: lines[i].length
								}
							},
							message: 'Multiple consecutive blank lines are not allowed in docblocks.'
						});
						return;
					}
				}
			}
		};

		return {
			ClassDeclaration: validate,
			ClassExpression: validate,
			FunctionExpression: validate,
			ArrowFunctionExpression: validate
		};
	}
};

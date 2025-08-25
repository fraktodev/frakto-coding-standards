import { parse } from 'comment-parser';
import { getDocblock, getDocLoc, createExportValidator } from '../utils.mjs';

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
		const sourceCode = context.sourceCode || context.getSourceCode();

		/**
		 * Get tag lines with their indices.
		 *
		 * @param {string[]} lines - The docblock lines.
		 * @returns {object[]}
		 */
		const getTagLines = (lines) => {
			return lines.map((line, index) => ({ line, index })).filter(({ line }) => line.trim().startsWith('* @'));
		};

		/**
		 * Validates the docblock for a given node.
		 *
		 * @param {ASTNode} node - The node to validate.
		 * @returns {void}
		 */
		const validate = (node) => {
			const docblock = getDocblock(sourceCode, node);

			if (!docblock) return;

			const parsed = parse(`/*${docblock.value}*/`);

			if (!parsed) return;

			const description   = parsed[0]?.description?.trim() ?? '';
			const tags          = parsed[0]?.tags ?? [];

			const lines         = docblock.value.split('\n');
			const firstTagIndex = lines.findIndex((line) => line.trim().startsWith('* @'));

			// Description spacing.
			if (description && 0 < tags.length) {
				const hasLineAfterDescription = 0 < firstTagIndex && '*' === lines[firstTagIndex - 1]?.trim();

				if (!hasLineAfterDescription) {
					context.report({
						loc: getDocLoc(sourceCode, docblock, description),
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
					// Get the tag name from the current line to use in location
					const currentTagMatch = tagLines[i].line.match(/@(\w+)/);
					const currentTagName  = currentTagMatch ? currentTagMatch[1] : 'param';

					context.report({
						loc: getDocLoc(sourceCode, docblock, `@${currentTagName}`),
						message: 'Do not add blank lines between docblock tags. All tags must be together.',
						fix: (fixer) => {
							// Create new lines array without blank lines between tags
							const newLines = [];

							for (let j = 0; j < lines.length; j++) {
								const line        = lines[j];
								const isBlankLine = '*' === line.trim();

								// If it's a blank line, check if it's between tags
								if (isBlankLine) {
									const prevTagIndex = tagLines.findIndex(({ index }) => index < j);
									const nextTagIndex = tagLines.findIndex(({ index }) => index > j);

									// If there's a tag before and after this blank line, skip it
									if (-1 !== prevTagIndex && -1 !== nextTagIndex) {
										continue;
									}
								}

								newLines.push(line);
							}

							const fixed = newLines.join('\n');
							return fixer.replaceText(docblock, `/*${fixed}*/`);
						}
					});
					break;
				}
			}

			// No blank line after last tag
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
				}
			}

			// No double blank lines
			let blankLineCount = 0;
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i].trim();

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
						break;
					}
				}
				else {
					blankLineCount = 0;
				}
			}
		};

		// Create a validator for export declarations.
		const validateExport = createExportValidator(validate);

		return {
			ClassDeclaration: validate,
			MethodDefinition: validate,
			ArrowFunctionExpression: validate,
			ExportNamedDeclaration: validateExport,
			ExportDefaultDeclaration: validateExport
		};
	}
};

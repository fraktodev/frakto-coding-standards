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
		schema: []
	},
	create(context) {
		const sourceCode = context.sourceCode || context.getSourceCode();

		/**
		 * Get the name of a tag from a line.
		 *
		 * @param {string} line - The line to get the tag name from.
		 *
		 * @returns {string|null}
		 */
		const getTagName = (line) => {
			const match = line.match(/@(\w+)/);
			return match ? match[1] : null;
		};

		/**
		 * Validates the docblock for a given node.
		 *
		 * @param {ASTNode} node - The node to validate.
		 *
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

			// Params tags spacing.
			const paramTags = tags.filter((tag) => 'param' === tag.tag);
			if (0 < paramTags.length) {
				const paramLines = lines
					.map((line, index) => ({ line, index }))
					.filter(({ line }) => line.trim().startsWith('* @param'));

				for (let i = 0; i < paramLines.length - 1; i++) {
					const currentIndex    = paramLines[i].index;
					const nextIndex       = paramLines[i + 1].index;
					const hasBlankBetween = lines.slice(currentIndex + 1, nextIndex).some((l) => '*' === l.trim());

					if (hasBlankBetween) {
						context.report({
							loc: getDocLoc(sourceCode, docblock, '@param'),
							message: 'Do not add blank lines between @param tags.'
						});
						break;
					}
				}

				const lastParamIndex          = paramLines[paramLines.length - 1].index;
				const nonParamTagsAfterParams = 0 < tags.filter((tag) => 'param' !== tag.tag).length;

				if (nonParamTagsAfterParams) {
					const nextLine = lines[lastParamIndex + 1]?.trim();

					if ('*' !== nextLine) {
						context.report({
							loc: getDocLoc(sourceCode, docblock, '@param'),
							message: 'There must be a blank line after the last @param.'
						});
					}
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

			const tagLines = lines
				.map((line, index) => ({ line, index }))
				.filter(({ line }) => line.trim().startsWith('* @'));
			for (let i = 0; i < tagLines.length - 1; i++) {
				const currentTag = getTagName(tagLines[i].line);
				const nextTag    = getTagName(tagLines[i + 1].line);

				if ('param' === currentTag && 'param' === nextTag) continue;
				if ('param' === currentTag) continue;

				const hasBlank = lines.slice(tagLines[i].index + 1, tagLines[i + 1].index).some((l) => '*' === l.trim());
				if (hasBlank) {
					context.report({
						loc: {
							start: {
								line: docblock.loc.start.line + tagLines[i].index + 1,
								column: 0
							},
							end: {
								line: docblock.loc.start.line + tagLines[i + 1].index,
								column: 0
							}
						},
						message: 'Unexpected blank line between docblock tags.'
					});
					break;
				}
			}

			// No blank line after last tag
			if (0 < tagLines.length) {
				const lastTagIndex = tagLines[tagLines.length - 1].index;
				const lastTag      = getTagName(tagLines[tagLines.length - 1].line);

				if ('param' !== lastTag) {
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
			}
		};

		// Create a validator for export declarations.
		const validateExport = createExportValidator(validate);

		/* eslint-disable @typescript-eslint/naming-convention */
		return {
			ClassDeclaration: validate,
			MethodDefinition: validate,
			ArrowFunctionExpression: validate,
			ExportNamedDeclaration: validateExport,
			ExportDefaultDeclaration: validateExport
		};
	}
};

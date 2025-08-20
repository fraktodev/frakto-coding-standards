import { parse } from 'comment-parser';
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
		const getDocblock = (node) => {
			const before = sourceCode.getCommentsBefore(node);

			let docblock = before.reverse().find((c) => c.type === 'Block' && c.value.trim().startsWith('*'));
			if (docblock) return docblock;

			if (node.parent?.type === 'VariableDeclarator') {
				const decl = node.parent.parent;
				const beforeDecl = sourceCode.getCommentsBefore(decl);
				docblock = beforeDecl.reverse().find((c) => c.type === 'Block' && c.value.trim().startsWith('*'));
				if (docblock) return docblock;
			}

			if (node.parent?.type === 'Property') {
				const beforeProp = sourceCode.getCommentsBefore(node.parent);
				docblock = beforeProp.reverse().find((c) => c.type === 'Block' && c.value.trim().startsWith('*'));
				if (docblock) return docblock;
			}

			return null;
		};
		const getDocLoc = (docblock, identifier) => {
			const startOffset = docblock.value.indexOf(identifier);

			if (-1 === startOffset) {
				return docblock.loc;
			}

			const endOffset = startOffset + identifier.length;
			const startIndex = docblock.range[0] + 2 + startOffset;
			const endIndex = docblock.range[0] + 2 + endOffset;
			return {
				start: sourceCode.getLocFromIndex(startIndex),
				end: sourceCode.getLocFromIndex(endIndex)
			};
		};
		const validate = (node) => {
			const docblock = getDocblock(node);

			if (!docblock) return;

			const parsed = parse(`/*${docblock.value}*/`);

			if (!parsed) return;

			const description = parsed[0]?.description?.trim() ?? '';
			const tags = parsed[0]?.tags ?? [];

			const lines = docblock.value.split('\n');
			const firstTagIndex = lines.findIndex((line) => line.trim().startsWith('* @'));

			// Description spacing.
			if (description && tags.length > 0) {
				const hasLineAfterDescription = firstTagIndex > 0 && lines[firstTagIndex - 1]?.trim() === '*';

				if (!hasLineAfterDescription) {
					context.report({
						loc: getDocLoc(docblock, description),
						message: 'There must be a blank line after the description.'
					});
					return;
				}
			}

			// Params tags spacing.
			const paramTags = tags.filter((tag) => tag.tag === 'param');
			if (paramTags.length > 0) {
				const paramLines = lines
					.map((line, index) => ({ line, index }))
					.filter(({ line }) => line.trim().startsWith('* @param'));

				for (let i = 0; i < paramLines.length - 1; i++) {
					const currentIndex = paramLines[i].index;
					const nextIndex = paramLines[i + 1].index;
					const hasBlankBetween = lines.slice(currentIndex + 1, nextIndex).some((l) => l.trim() === '*');

					if (hasBlankBetween) {
						context.report({
							loc: getDocLoc(docblock, '@param'),
							message: 'Do not add blank lines between @param tags.'
						});
						break;
					}
				}

				const lastParamIndex = paramLines[paramLines.length - 1].index;
				const nonParamTagsAfterParams = tags.filter((tag) => tag.tag !== 'param').length > 0;

				if (nonParamTagsAfterParams) {
					const nextLine = lines[lastParamIndex + 1]?.trim();

					if (nextLine !== '*') {
						context.report({
							loc: getDocLoc(docblock, '@param'),
							message: 'There must be a blank line after the last @param.'
						});
					}
				}
			}

			// No double blank lines
			let blankLineCount = 0;
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i].trim();

				if (line === '*') {
					blankLineCount++;
					if (blankLineCount > 1) {
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
				} else {
					blankLineCount = 0;
				}
			}

			// No blank lines between other tags.
			const getTagName = (line) => {
				const match = line.match(/@(\w+)/);
				return match ? match[1] : null;
			};
			const tagLines = lines
				.map((line, index) => ({ line, index }))
				.filter(({ line }) => line.trim().startsWith('* @'));
			for (let i = 0; i < tagLines.length - 1; i++) {
				const currentTag = getTagName(tagLines[i].line);
				const nextTag = getTagName(tagLines[i + 1].line);

				if (currentTag === 'param' && nextTag === 'param') continue;
				if (currentTag === 'param') continue;

				const hasBlank = lines.slice(tagLines[i].index + 1, tagLines[i + 1].index).some((l) => l.trim() === '*');
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
			if (tagLines.length > 0) {
				const lastTagIndex = tagLines[tagLines.length - 1].index;
				const lastTag = getTagName(tagLines[tagLines.length - 1].line);

				if (lastTag !== 'param') {
					const remainingLines = lines.slice(lastTagIndex + 1);
					const hasBlankAfterLast = remainingLines.some((line, index) => {
						const trimmed = line.trim();
						return trimmed === '*' && index < remainingLines.length - 1;
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
		return {
			ClassDeclaration: validate,
			MethodDefinition: validate,
			ArrowFunctionExpression: validate
		};
	}
};

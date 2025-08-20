import { parse } from 'comment-parser';
export default {
	meta: {
		type: 'problem',
		docs: {
			description: 'Ensure docblock descriptions are valid.',
			category: 'Best Practices',
			recommended: true
		},
		fixable: 'code',
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

			if (!description) {
				context.report({
					loc: {
						start: {
							line: docblock.loc.start.line + 1,
							column: docblock.loc.start.column + 1
						},
						end: {
							line: docblock.loc.start.line + 1,
							column: docblock.loc.start.column + 2
						}
					},
					message: 'Docblock must have a description.'
				});

				return;
			}

			const loc = getDocLoc(docblock, description);

			if (!description.endsWith('.')) {
				context.report({
					loc,
					message: 'Docblock description must end with a period.',
					fix: (fixer) => {
						const fixed = docblock.value.replace(description, `${description}.`);
						return fixer.replaceText(docblock, `/*${fixed}*/`);
					}
				});
				return;
			}

			if (20 > description.length) {
				context.report({
					loc: loc,
					message: 'Docblock description must be at least 20 characters long.'
				});
				return;
			}

			if (200 < description.length) {
				context.report({
					loc: loc,
					message: 'Docblock description must not exceed 200 characters.'
				});
			}
		};
		return {
			ClassDeclaration: validate,
			MethodDefinition: validate,
			ArrowFunctionExpression: validate
		};
	}
};

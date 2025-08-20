import { parse } from 'comment-parser';
export default {
	meta: {
		type: 'problem',
		docs: {
			description: 'Ensure docblock returns are valid.',
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

			const tags = parsed[0]?.tags ?? [];
			const returnsTag = tags.find((tag) => tag.tag === 'return' || tag.tag === 'returns');

			if (!returnsTag) {
				context.report({
					loc: docblock.loc,
					message: 'Declaration must have a return type even if it is void.'
				});
				return;
			}

			let { tag: label, type, description } = returnsTag;

			if (label === 'return') {
				context.report({
					loc: getDocLoc(docblock, '@return'),
					message: `Use "@returns" instead of "@return".`,
					fix: (fixer) => {
						const fixed = docblock.value.replace('@return', '@returns');
						return fixer.replaceText(docblock, `/*${fixed}*/`);
					}
				});
				return;
			}

			if (!type) {
				context.report({
					loc: getDocLoc(docblock, '@returns'),
					message: `@returns must include a type.`
				});
				return;
			}

			const expectedType = type.toLowerCase();
			if (expectedType !== type) {
				context.report({
					loc: getDocLoc(docblock, `@returns {${type}}`),
					message: `@returns type "${type}" must be lowercase "${expectedType}".`,
					fix: (fixer) => {
						const fixed = docblock.value.replace(`@returns {${type}}`, `@returns {${expectedType}}`);
						return fixer.replaceText(docblock, `/*${fixed}*/`);
					}
				});
				type = expectedType;
				return;
			}

			if (description) {
				context.report({
					loc: getDocLoc(docblock, `@returns {${type}}`),
					message: `@returns must not include a description.`,
					fix: (fixer) => {
						const fixed = docblock.value.replace(`@returns {${type}} - ${description}`, `@returns {${type}}`);
						return fixer.replaceText(docblock, `/*${fixed}*/`);
					}
				});
				return;
			}
		};
		return {
			MethodDefinition: validate,
			ArrowFunctionExpression: validate
		};
	}
};

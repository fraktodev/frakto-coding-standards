import { parse } from 'comment-parser';
export default {
	meta: {
		type: 'problem',
		docs: {
			description: 'Enforce the absence of @example tags in docblocks.',
			category: 'Best Practices',
			recommended: true
		},
		fixable: null,
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

			const examples = parsed[0]?.examples ?? [];
			const tags = parsed[0]?.tags ?? [];

			if (examples.length > 0) {
				context.report({
					loc: getDocLoc(docblock, '@example'),
					message: '@example tags are not allowed in docblocks.'
				});
				return;
			}

			const exampleTags = tags.filter((tag) => tag.tag === 'example');
			if (exampleTags.length > 0) {
				context.report({
					loc: getDocLoc(docblock, '@example'),
					message: '@example tags are not allowed in docblocks.'
				});
			}
		};
		return {
			MethodDefinition: validate,
			ArrowFunctionExpression: validate
		};
	}
};

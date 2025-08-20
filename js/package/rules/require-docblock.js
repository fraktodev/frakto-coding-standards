export default {
	meta: {
		type: 'problem',
		docs: {
			description: 'Ensure declarations have a docblock.',
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
		const checkDocblock = (node) => {
			const docblock = getDocblock(node);

			if (!docblock) {
				context.report({
					node,
					loc: {
						start: {
							line: node.loc.start.line,
							column: 0
						},
						end: {
							line: node.loc.start.line,
							column: node.loc.start.column + 1
						}
					},
					message: 'Missing docblock for this declaration.'
				});
			}
		};
		return {
			ClassDeclaration: checkDocblock,
			MethodDefinition: checkDocblock,
			ArrowFunctionExpression: checkDocblock
		};
	}
};

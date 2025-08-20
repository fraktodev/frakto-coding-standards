import { parse } from 'comment-parser';
export default {
	meta: {
		type: 'problem',
		docs: {
			description: 'Ensure docblock tags are in the correct order.',
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
		const validate = (node) => {
			const docblock = getDocblock(node);

			if (!docblock) return;

			const parsed = parse(`/*${docblock.value}*/`);

			if (!parsed) return;

			const tags = parsed[0]?.tags ?? [];

			if (tags.length === 0) return;

			const expectedOrder = ['param', 'throws'];
			const actualOrder = [];
			const presentTags = new Set();

			for (const tag of tags) {
				const tagName = tag.tag === 'return' ? 'returns' : tag.tag;

				if (!presentTags.has(tagName)) {
					actualOrder.push(tagName);
					presentTags.add(tagName);
				}
			}

			const correctOrder = [];

			expectedOrder.forEach((tagType) => {
				if (presentTags.has(tagType)) {
					correctOrder.push(tagType);
				}
			});

			actualOrder.forEach((tagType) => {
				if (!expectedOrder.includes(tagType) && tagType !== 'returns') {
					correctOrder.push(tagType);
				}
			});

			if (presentTags.has('returns')) {
				correctOrder.push('returns');
			}

			const isCorrectOrder =
				actualOrder.length === correctOrder.length && actualOrder.every((tag, index) => tag === correctOrder[index]);

			if (!isCorrectOrder) {
				const orderMessage = correctOrder.map((tag) => `@${tag}`).join(' → ');
				context.report({
					loc: docblock.loc,
					message: `Tags must be in the correct order: ${orderMessage}.`
				});
			}
		};
		return {
			MethodDefinition: validate,
			ArrowFunctionExpression: validate
		};
	}
};

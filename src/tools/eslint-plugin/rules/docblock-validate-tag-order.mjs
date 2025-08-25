import { parse } from 'comment-parser';
import { getDocblock, createExportValidator } from '../utils.mjs';

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

			const tags = parsed[0]?.tags ?? [];

			if (0 === tags.length) return;

			const expectedOrder = ['param', 'throws'];
			const actualOrder   = [];
			const presentTags   = new Set();

			for (const tag of tags) {
				const tagName = 'return' === tag.tag ? 'returns' : tag.tag;

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
				if (!expectedOrder.includes(tagType) && 'returns' !== tagType) {
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

		// Create a validator for export declarations.
		const validateExport = createExportValidator(validate);

		return {
			MethodDefinition: validate,
			ArrowFunctionExpression: validate,
			ExportNamedDeclaration: validateExport,
			ExportDefaultDeclaration: validateExport
		};
	}
};

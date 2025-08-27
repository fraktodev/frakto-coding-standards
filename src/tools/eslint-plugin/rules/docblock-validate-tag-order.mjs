// Dependencies
import { getDocblockData } from '../utils.mjs';

// Export Rule
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
		/**
		 * Validates the docblock for a given node.
		 *
		 * @param {ASTNode} node - The node to validate.
		 * @returns {void}
		 */
		const validate = (node) => {
			const docData = getDocblockData(context, node);
			if (!docData) return;
			const { docblock, data } = docData;

			// Extract tags
			const tags = data[0]?.tags ?? [];

			// Early return if no tags are present
			if (!tags.length) return;

			// Prepare tags order
			const expectedOrder = ['see', 'deprecated', 'abstract', 'extends', 'param', 'throws', 'returns'];
			const actualOrder   = [];
			const correctOrder  = [];
			const presentTags   = new Set();

			// Collect actual tags in order of appearance
			for (const tag of tags) {
				const tagName = tag.tag;

				if (!expectedOrder.includes(tagName)) {
					continue;
				}

				if (!presentTags.has(tagName)) {
					actualOrder.push(tagName);
					presentTags.add(tagName);
				}
			}

			// Collect correct tags in order
			expectedOrder.forEach((tagType) => {
				if (presentTags.has(tagType)) {
					correctOrder.push(tagType);
				}
			});

			// Collect incorrect tags
			actualOrder.forEach((tagType) => {
				if (!expectedOrder.includes(tagType)) {
					correctOrder.push(tagType);
				}
			});

			// Check if the order is correct
			const isCorrectOrder =
				actualOrder.length === correctOrder.length && actualOrder.every((tag, index) => tag === correctOrder[index]);

			// Report incorrect order
			if (!isCorrectOrder) {
				const orderMessage = correctOrder.map((tag) => `@${tag}`).join(' → ');
				context.report({
					loc: docblock.loc,
					message: `Tags must be in the correct order: ${orderMessage}.`
				});
			}
		};

		return {
			ClassDeclaration: validate,
			MethodDefinition: validate,
			FunctionExpression: validate,
			ArrowFunctionExpression: validate,
			ExportNamedDeclaration: validate,
			ExportDefaultDeclaration: validate,
			AssignmentExpression: validate
		};
	}
};

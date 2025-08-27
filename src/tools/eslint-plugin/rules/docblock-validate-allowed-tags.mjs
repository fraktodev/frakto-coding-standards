// Dependencies
import { getDocblockData } from '../utils.mjs';

// Export Rule
export default {
	meta: {
		type: 'problem',
		docs: {
			description: 'Enforce only allowed tags in function docblocks.',
			category: 'Best Practices',
			recommended: true
		},
		fixable: null,
		schema: [
			{
				type: 'object',
				properties: {
					language: {
						type: 'string',
						enum: ['js', 'ts'],
						default: 'js'
					}
				},
				additionalProperties: false
			}
		]
	},
	create(context) {
		const language = context.options[0]?.language || 'js';

		/**
		 * Validates the docblock for a given node.
		 *
		 * @param {ASTNode} node - The node to validate.
		 * @returns {void}
		 */
		const validate = (node) => {
			const docData = getDocblockData(context, node);
			if (!docData) return;
			const { realNode, data, loc } = docData;

			// Extract examples and tags
			const examples = data[0]?.examples ?? [];
			const tags     = data[0]?.tags ?? [];

			// Report disallowed examples
			if (0 < examples.length) {
				context.report({
					loc: loc('@example'),
					message: '@example tags are not allowed in docblocks.'
				});
				return;
			}

			// Prepare allowed tags
			let allowedTags = [];
			if ('class' === realNode.kind) {
				allowedTags = ['abstract', 'extends', 'see', 'deprecated'];
			}
			else if ('js' === language) {
				allowedTags = ['param', 'throws', 'throw', 'see', 'deprecated', 'returns', 'return'];
			}
			else if ('ts' === language) {
				allowedTags = ['param', 'throws', 'throw', 'see', 'deprecated'];
			}

			// Iterate over tags
			tags.some((tag) => {
				// Report @todo tag
				if ('todo' === tag.tag) {
					context.report({
						loc: loc(`@${tag.tag}`),
						message: '@todo must be inserted in to docblock description (e.g. TODO: Fix the bug)'
					});
					return true;
				}

				// Report disallowed tags
				if (!allowedTags.includes(tag.tag)) {
					context.report({
						loc: loc(`@${tag.tag}`),
						message: `@${tag.tag} tag is not allowed in ${realNode.kind} docblocks. Allowed tags: ${allowedTags.join(', ')}.`
					});
					return true;
				}
			});
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

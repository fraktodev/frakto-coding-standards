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
			const { data, loc } = docData;

			// Extract examples and tags
			const examples = data.examples ?? [];
			const tags     = data.tags ?? [];

			// Report disallowed examples
			if (0 < examples.length) {
				context.report({
					loc: loc('@example'),
					message: '@example tags are not allowed in docblocks.'
				});
				return;
			}

			// Prepare allowed tags
			let nodeType    = 'function';
			let allowedTags = ['param', 'throws', 'throw', 'see', 'deprecated', 'returns', 'return'];
			if ('ClassDeclaration' === node.type || 'ClassExpression' === node.type) {
				nodeType = 'class';
				allowedTags = ['abstract', 'extends', 'see', 'deprecated'];
			}
			else if ('ts' === language) {
				allowedTags = ['param', 'throws', 'throw', 'see', 'deprecated'];
			}

			// Iterate over tags
			tags.forEach((tag) => {
				// Report @todo tag
				if ('todo' === tag.tag) {
					context.report({
						loc: loc(`@${tag.tag}`),
						message: '@todo must be inserted in to docblock description (e.g. TODO: Fix the bug)'
					});
					return;
				}

				// Report disallowed tags
				if (!allowedTags.includes(tag.tag)) {
					context.report({
						loc: loc(`@${tag.tag}`),
						message: `@${tag.tag} tag is not allowed in ${nodeType} docblocks. Allowed tags: ${allowedTags.join(', ')}.`
					});
				}
			});
		};

		return {
			ClassDeclaration: validate,
			ClassExpression: validate,
			FunctionExpression: validate,
			ArrowFunctionExpression: validate
		};
	}
};

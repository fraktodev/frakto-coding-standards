// Dependencies
import { getDocblockData } from '../utils.mjs';

// Export Rule
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
		/**
		 * Validates the docblock for a given node.
		 *
		 * @param {ASTNode} node - The node to validate.
		 * @returns {void}
		 */
		const validate = (node) => {
			const docData = getDocblockData(context, node);
			if (!docData) return;
			const { docblock, realNode, data, loc } = docData;

			// Extract description
			const description = data[0]?.description?.trim() ?? '';

			// Report missing description
			if (!description) {
				context.report({
					loc: docblock.loc,
					message: 'Docblock must have a description.'
				});

				return;
			}

			// Report missing period
			if (!description.endsWith('.')) {
				context.report({
					loc: loc(description),
					message: 'Docblock description must end with a period.',
					fix: (fixer) => {
						const fixed = docblock.value.replace(description, `${description}.`);
						return fixer.replaceText(docblock, `/*${fixed}*/`);
					}
				});
				return;
			}

			// Prepare min length
			const min = 'class' === realNode.kind ? 50 : 10;

			// Report short description
			if (min > description.length) {
				context.report({
					loc: loc(description),
					message: `Docblock description for ${realNode.kind} must be at least ${min} characters long.`
				});
				return;
			}

			// Report too long description
			if (400 < description.length) {
				context.report({
					loc: loc(description),
					message: `Docblock description for ${realNode.kind} must not exceed 400 characters.`
				});
				return;
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

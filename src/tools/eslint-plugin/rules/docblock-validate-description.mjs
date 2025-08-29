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
			const { docblock, data, loc } = docData;

			// Extract description
			const description = data.description?.trim() ?? '';

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

			const isClass  = 'ClassDeclaration' === node.type || 'ClassExpression' === node.type;
			const nodeType = isClass ? 'class' : 'function';
			const min      = isClass ? 50 : 10;

			// Report short description
			if (min > description.length) {
				context.report({
					loc: loc(description),
					message: `Docblock description for ${nodeType} must be at least ${min} characters long.`
				});
				return;
			}

			// Report too long description
			if (400 < description.length) {
				context.report({
					loc: loc(description),
					message: `Docblock description for ${nodeType} must not exceed 400 characters.`
				});
				return;
			}
		};

		return {
			ClassDeclaration: validate,
			ClassExpression: validate,
			FunctionExpression: validate,
			ArrowFunctionExpression: validate
		};
	}
};

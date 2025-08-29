// Export Rule
export default {
	meta: {
		type: 'problem',
		docs: {
			description: 'Prefer named function declarations over inline functions.',
			category: 'Best Practices',
			recommended: true
		},
		schema: []
	},
	create(context) {
		/**
		 * Check if a function node should be reported.
		 *
		 * @param {ASTNode} node - The function node to check.
		 * @returns {void}
		 */
		const checkFunction = (node) => {
			const parentType       = node.parent?.type;
			const forbiddenParents = [
				'ArrayExpression',
				'ArrowFunctionExpression',
				'ConditionalExpression',
				'FunctionExpression',
				'ReturnStatement',
				'TemplateLiteral'
			];

			if (forbiddenParents.includes(parentType)) {
				context.report({
					node,
					message: 'Prefer named function declarations over inline functions.'
				});
			}
		};

		return {
			FunctionExpression: checkFunction,
			ArrowFunctionExpression: checkFunction
		};
	}
};

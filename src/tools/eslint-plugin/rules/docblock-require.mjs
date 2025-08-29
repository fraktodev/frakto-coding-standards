// Dependencies
import { getDocblock } from '../utils.mjs';

// Export Rule
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

		/**
		 * Ignore certain nodes from docblock requirement.
		 *
		 * @param {ASTNode} node - The node to check.
		 * @returns {boolean}
		 */
		const ignoreNode = (node) => {
			if ('ClassDeclaration' === node.type) return false;

			// Ignore nodes without parent
			const parent = node.parent?.type;
			if (!parent) return false;

			// Ignore nodes with certain parent types
			const parentTypes = [
				'ArrayExpression',
				'AssignmentPattern',
				'CallExpression',
				'ConditionalExpression',
				'Property',
				'TemplateLiteral'
			];
			if (parentTypes.includes(parent)) return true;

			return false;
		};

		/**
		 * Check if a docblock exists for a given node.
		 *
		 * @param {ASTNode} node - The node to check.
		 * @returns {void}
		 */
		const checkDocblock = (node) => {
			if (ignoreNode(node)) return;

			const docblock = getDocblock(sourceCode, node);
			if (docblock) return;

			// Report missing docblock
			context.report({
				node,
				loc: {
					start: {
						line: node.loc.start.line,
						column: 0
					},
					end: {
						line: node.loc.start.line,
						column: sourceCode.lines[node.loc.start.line - 1].length
					}
				},
				message: `Missing docblock for this declaration. ${node.type} ${node.parent.type}`
			});
		};

		return {
			ClassDeclaration: checkDocblock,
			ClassExpression: checkDocblock,
			FunctionExpression: checkDocblock,
			ArrowFunctionExpression: checkDocblock
		};
	}
};

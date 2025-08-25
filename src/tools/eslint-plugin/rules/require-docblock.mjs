import { getDocblock } from '../utils.mjs';

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
		 * Check if a docblock exists for a given node.
		 *
		 * @param {ASTNode} node - The node to check.
		 * @returns {void}
		 */
		const checkDocblock = (node) => {
			if ('ArrowFunctionExpression' === node.type) {
				// Skip if it's a callback in method calls like .map(), .filter(), .some(), etc.
				if ('CallExpression' === node.parent?.type && node.parent.arguments.includes(node)) {
					return;
				}
				// Skip if it's a simple one-liner (body is not a BlockStatement)
				if ('BlockStatement' !== node.body.type) {
					return;
				}
				// Skip if it's not directly assigned to a variable declaration (const, let, var)
				if ('VariableDeclarator' !== node.parent?.type) {
					return;
				}
				// Skip if the variable declaration is not at top level
				if ('VariableDeclaration' !== node.parent?.parent?.type) {
					return;
				}
				// Skip if the variable declaration is part of an export (will be handled by export checker)
				if ('ExportNamedDeclaration' === node.parent?.parent?.parent?.type) {
					return;
				}
			}

			const docblock = getDocblock(sourceCode, node);

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

		/**
		 * Check if the export declaration has a docblock.
		 *
		 * @param {ASTNode} node - The node to check.
		 * @returns {void}
		 */
		const checkExportDeclaration = (node) => {
			if ('ExportNamedDeclaration' === node.type && node.declaration) {
				if ('VariableDeclaration' === node.declaration.type && node.declaration.declarations) {
					const hasArrowFunction = node.declaration.declarations.some(
						(declarator) => 'ArrowFunctionExpression' === declarator.init?.type
					);
					if (hasArrowFunction) {
						checkDocblock(node);
					}
				}
			}
			else if ('ExportDefaultDeclaration' === node.type) {
				if ('ArrowFunctionExpression' === node.declaration?.type || 'FunctionDeclaration' === node.declaration?.type) {
					checkDocblock(node);
				}
			}
		};

		return {
			ClassDeclaration: checkDocblock,
			MethodDefinition: checkDocblock,
			ArrowFunctionExpression: checkDocblock,
			ExportNamedDeclaration: checkExportDeclaration,
			ExportDefaultDeclaration: checkExportDeclaration
		};
	}
};

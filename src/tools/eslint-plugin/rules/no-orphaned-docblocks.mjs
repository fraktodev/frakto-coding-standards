export default {
	meta: {
		type: 'problem',
		docs: {
			description: 'Ensure docblocks are attached to a class, method, or arrow function.',
			category: 'Best Practices',
			recommended: true
		},
		schema: []
	},
	create(context) {
		const sourceCode = context.sourceCode || context.getSourceCode();

		/**
		 * Collects all nodes in the AST.
		 *
		 * @param {ASTNode}   node     - The current node.
		 * @param {ASTNode[]} allNodes - The array to collect nodes.
		 * @returns {void}
		 */
		const collectNodes = (node, allNodes) => {
			if (!node || 'object' !== typeof node) return;

			allNodes.push(node);

			for (const key in node) {
				if ('parent' === key) continue; // Avoid circular references

				const child = node[key];
				if (Array.isArray(child)) {
					child.forEach((item) => {
						if (item && 'object' === typeof item && item.type) {
							collectNodes(item, allNodes);
						}
					});
				}
				else if (child && 'object' === typeof child && child.type) {
					collectNodes(child, allNodes);
				}
			}
		};

		/**
		 * Checks if a node is a valid target for a docblock.
		 *
		 * @param {ASTNode} node - The node to check.
		 * @returns {boolean}
		 */
		const isValidDocblockTarget = (node) => {
			if (
				'ClassDeclaration' === node.type ||
				'MethodDefinition' === node.type ||
				'FunctionDeclaration' === node.type ||
				'FunctionExpression' === node.type
			) {
				return true;
			}

			if ('VariableDeclarator' === node.type) {
				return true;
			}

			if ('VariableDeclaration' === node.type) {
				return true;
			}

			if ('ExportNamedDeclaration' === node.type && node.declaration) {
				return isValidDocblockTarget(node.declaration);
			}

			if ('ExportDefaultDeclaration' === node.type && node.declaration) {
				return isValidDocblockTarget(node.declaration);
			}

			if (
				'Property' === node.type &&
				node.value &&
				('ArrowFunctionExpression' === node.value.type || 'FunctionExpression' === node.value.type)
			) {
				return true;
			}

			return false;
		};

		return {
			// eslint-disable-next-line
			Program() {
				const comments = sourceCode.getAllComments();

				comments.forEach((comment) => {
					if ('Block' === comment.type && (comment.value.trim().startsWith('*') || comment.value.startsWith('*'))) {
						const afterComment = sourceCode.getTokenAfter(comment);

						if (!afterComment) {
							context.report({
								node: comment,
								loc: comment.loc,
								message: 'Docblock comment must be attached to a class, method, or arrow function.'
							});
							return;
						}

						let nextNode = null;
						const allNodes = [];

						sourceCode.ast.body.forEach((node) => {
							collectNodes(node, allNodes);
						});

						for (const node of allNodes) {
							if (node.range && node.range[0] >= comment.range[1]) {
								if (!nextNode || node.range[0] < nextNode.range[0]) {
									nextNode = node;
								}
							}
						}

						if (!nextNode) {
							context.report({
								node: comment,
								loc: comment.loc,
								message: 'Docblock comment must be attached to a class, method, or arrow function.'
							});
							return;
						}

						const isValidTarget = isValidDocblockTarget(nextNode);

						if (!isValidTarget) {
							context.report({
								node: comment,
								loc: comment.loc,
								message: 'Docblock comment must be attached to a class, method, or arrow function.'
							});
						}
					}
				});
			}
		};
	}
};

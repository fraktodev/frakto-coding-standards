// Export Rule
export default {
	meta: {
		type: 'problem',
		docs: {
			description: 'Prevent overly complex function parameters.',
			category: 'Best Practices',
			recommended: true
		},
		schema: []
	},
	create(context) {
		const paramsLimit = 5;

		/**
		 * Check if a node contains nested objects.
		 *
		 * @param {ASTNode} node - The node to check.
		 * @returns {boolean}
		 */
		const hasNestedObjects = (node) => {
			if (!node) return false;

			// Recursively check properties if it's an object-like structure
			if (node.properties && Array.isArray(node.properties)) {
				return node.properties.some((property) => {
					// Check if property value is an object (nested)
					if ('ObjectExpression' === property.value?.type || 'ObjectPattern' === property.value?.type) {
						return true;
					}
					// Recursively check deeper
					return hasNestedObjects(property.value);
				});
			}

			// Check array elements
			if (node.elements && Array.isArray(node.elements)) {
				return node.elements.some((element) => hasNestedObjects(element));
			}

			return false;
		};

		/**
		 * Check if a node contains arrays exceeding 5 elements.
		 *
		 * @param {ASTNode} node - The node to check.
		 * @returns {boolean}
		 */
		const hasArraysExceedingLimit = (node) => {
			if (!node) return false;

			// Check if node itself is ArrayExpression exceeding limit
			if ('ArrayExpression' === node.type) {
				return paramsLimit < node.elements.length;
			}

			// Recursively check properties if it's an object-like structure
			if (node.properties && Array.isArray(node.properties)) {
				return node.properties.some((property) => hasArraysExceedingLimit(property.value));
			}

			// Check array elements recursively
			if (node.elements && Array.isArray(node.elements)) {
				return node.elements.some((element) => hasArraysExceedingLimit(element));
			}

			return false;
		};

		/**
		 * Validate assignment pattern structure.
		 *
		 * @param {ASTNode} assignmentNode - The assignment node to check.
		 * @returns {void}
		 */
		const validateAssignmentPattern = (assignmentNode) => {
			// Left must be Identifier
			if ('Identifier' !== assignmentNode.left?.type) {
				context.report({
					node: assignmentNode,
					loc: assignmentNode.loc,
					message: 'Assignment pattern left side must be an identifier.'
				});
			}

			// Report if right has nested objects
			if (hasNestedObjects(assignmentNode.right)) {
				context.report({
					node: assignmentNode.right,
					loc: assignmentNode.right.loc,
					message: 'Assignment pattern right side must not contain nested objects.'
				});
			}
			// Report if right has arrays exceeding limit
			if (hasArraysExceedingLimit(assignmentNode.right)) {
				context.report({
					node: assignmentNode.right,
					loc: assignmentNode.right.loc,
					message: `Assignment pattern right side must not contain arrays with more than ${paramsLimit} elements. Consider declaring the array separately.`
				});
			}
		};

		/**
		 * Validate function parameters complexity.
		 *
		 * @param {ASTNode} node - The function node to check.
		 * @returns {void}
		 */
		const validateParams = (node) => {
			// Report too many parameters
			if (paramsLimit < node.params.length) {
				const conflictParam = node.params[5];
				const lastParam     = node.params[node.params.length - 1];

				context.report({
					node,
					loc: {
						start: conflictParam.loc.start,
						end: lastParam.loc.end
					},
					message: `Functions should not have more than ${paramsLimit} parameters. Consider using an object parameter.`
				});
				return;
			}

			// Params validation
			node.params.forEach((param) => {
				const allowedTypes = ['Identifier', 'AssignmentPattern', 'ObjectPattern', 'RestElement'];

				// Report disallowed parameter types
				if (!allowedTypes.includes(param.type)) {
					context.report({
						node: param,
						loc: param.loc,
						message:
							'Only the following parameter types are allowed: identifiers, assignment patterns, object patterns, and rest elements.'
					});
				}

				// AssignmentPattern validation
				if ('AssignmentPattern' === param.type) {
					validateAssignmentPattern(param);
				}

				// ObjectPattern validation
				if ('ObjectPattern' === param.type) {
					// Report too many properties
					if (paramsLimit < param.properties.length) {
						context.report({
							node: param,
							loc: param.loc,
							message: `Object pattern should not have more than ${paramsLimit} properties. Consider declaring the object separately.`
						});
					}

					// Properties validation
					param.properties.forEach((property) => {
						if ('RestElement' === property.type) return;
						const allowedPropertyTypes = ['Identifier', 'AssignmentPattern'];

						// Report disallowed property types
						if (!allowedPropertyTypes.includes(property.key?.type)) {
							context.report({
								node: property,
								loc: property.loc,
								message:
									'Only the following object pattern property types are allowed: identifiers, assignment patterns, and rest elements.'
							});
						}

						// AssignmentPattern validation
						if ('AssignmentPattern' === property.value?.type) {
							validateAssignmentPattern(property.value);
						}
					});
				}
			});
		};

		return {
			FunctionExpression: validateParams,
			ArrowFunctionExpression: validateParams
		};
	}
};

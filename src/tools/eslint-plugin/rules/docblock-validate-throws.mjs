// Dependencies
import { getDocblockData, normalizeTypes, getTagRange } from '../utils.mjs';

// Export Rule
export default {
	meta: {
		type: 'problem',
		docs: {
			description: 'Ensure docblock throws are valid.',
			category: 'Best Practices',
			recommended: true
		},
		fixable: 'code',
		schema: []
	},
	create(context) {
		/**
		 * Traverses the given statements to find try-catch blocks.
		 *
		 * @param {ASTNode[]} statements - The statements to traverse.
		 * @returns {boolean}
		 */
		const traverseTryCatch = (statements) => {
			if (!statements) return false;

			for (const stmt of statements) {
				if ('TryStatement' === stmt.type) {
					return true;
				}
				else if ('IfStatement' === stmt.type) {
					if (traverseTryCatch([stmt.consequent])) return true;
					if (stmt.alternate && traverseTryCatch([stmt.alternate])) return true;
				}
				else if ('BlockStatement' === stmt.type) {
					if (traverseTryCatch(stmt.body)) return true;
				}
				else if ('SwitchStatement' === stmt.type) {
					for (const caseNode of stmt.cases) {
						if (traverseTryCatch(caseNode.consequent)) return true;
					}
				}
				else if ('WhileStatement' === stmt.type || 'DoWhileStatement' === stmt.type) {
					if (traverseTryCatch([stmt.body])) return true;
				}
				else if ('ForStatement' === stmt.type || 'ForInStatement' === stmt.type || 'ForOfStatement' === stmt.type) {
					if (traverseTryCatch([stmt.body])) return true;
				}
			}

			return false;
		};

		/**
		 * Traverses the given statements to find throw statements.
		 *
		 * @param {ASTNode[]} statements - The statements to traverse.
		 * @returns {boolean}
		 */
		const traverseThrows = (statements) => {
			if (!statements) return false;

			for (const stmt of statements) {
				if ('ThrowStatement' === stmt.type) {
					return true;
				}
				else if ('IfStatement' === stmt.type) {
					if (traverseThrows([stmt.consequent])) return true;
					if (stmt.alternate && traverseThrows([stmt.alternate])) return true;
				}
				else if ('BlockStatement' === stmt.type) {
					if (traverseThrows(stmt.body)) return true;
				}
				else if ('SwitchStatement' === stmt.type) {
					for (const caseNode of stmt.cases) {
						if (traverseThrows(caseNode.consequent)) return true;
					}
				}
				else if ('WhileStatement' === stmt.type || 'DoWhileStatement' === stmt.type) {
					if (traverseThrows([stmt.body])) return true;
				}
				else if ('ForStatement' === stmt.type || 'ForInStatement' === stmt.type || 'ForOfStatement' === stmt.type) {
					if (traverseThrows([stmt.body])) return true;
				}
				else if ('TryStatement' === stmt.type) {
					// Check throws in try block
					if (traverseThrows(stmt.block.body)) return true;
					// Check throws in catch block
					if (stmt.handler && traverseThrows(stmt.handler.body.body)) return true;
					// Check throws in finally block
					if (stmt.finalizer && traverseThrows(stmt.finalizer.body)) return true;
				}
			}

			return false;
		};

		/**
		 * Checks if a node has a try-catch block.
		 *
		 * @param {ASTNode} node - The node to check.
		 * @returns {boolean}
		 */
		const hasTryCatch = (node) => {
			if (!node.body) return false;

			if ('BlockStatement' === node.body.type) {
				return traverseTryCatch(node.body.body);
			}

			return false;
		};

		/**
		 * Checks if a node has throw statements.
		 *
		 * @param {ASTNode} node - The node to check.
		 * @returns {boolean}
		 */
		const hasThrow = (node) => {
			if (!node.body) return false;

			if ('BlockStatement' === node.body.type) {
				return traverseThrows(node.body.body);
			}

			return false;
		};

		/**
		 * Creates a signature for a throws tag to detect duplicates.
		 *
		 * @param {object} tag - The throws tag object.
		 * @returns {string}
		 */
		const getThrowsSignature = (tag) => {
			return `${tag.type || 'undefined'}-${tag.name || ''}-${tag.description || ''}`;
		};

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
			if ('class' === realNode.kind) return;

			// Extract tags
			const tags       = data[0]?.tags ?? [];
			const throwsTags = tags.filter((tag) => 'throw' === tag.tag || 'throws' === tag.tag);

			// Check if the node has try-catch or throw statements
			const canThrowErrors = hasTryCatch(realNode) || hasThrow(realNode);

			// Report missing @throws tag
			if (canThrowErrors && !throwsTags.length) {
				context.report({
					loc: docblock.loc,
					message: 'Declaration can throw exceptions but no @throws documentation found.'
				});
				return;
			}

			// Report unnecessary @throws tag
			if (!canThrowErrors && throwsTags.length) {
				context.report({
					loc: loc('@throw'),
					message: 'Declaration has @throws documentation but no try-catch blocks or throw statements found.'
				});
				return;
			}

			// Early return if no @throws tag is present
			if (!throwsTags.length) return;

			// Check for duplicate @throws tags
			const throwsSignatures = throwsTags.map(getThrowsSignature);
			const duplicates       = throwsSignatures.filter((sig, index, arr) => arr.indexOf(sig) !== index);

			// Report duplicate @throws tags
			if (duplicates.length) {
				context.report({
					loc: loc('@throw'),
					message: 'Duplicate @throws tags found. Each exception type should be documented only once.'
				});
				return;
			}

			// Iterate over @throws tags
			throwsTags.some((throwsTag, index) => {
				const {
					tag: label,
					type,
					name,
					description,
					source: [source]
				} = throwsTag;
				const occurrence                                                                             = index + 1;

				// Report deprecated @throw tag
				if ('throw' === label) {
					context.report({
						loc: loc('@throw', occurrence),
						message: `Use "@throws" instead of "@throw".`,
						fix: (fixer) => {
							const range = getTagRange(docblock, source);
							const fixed = source.source.replace('@throw', '@throws');
							return fixer.replaceTextRange(range, fixed);
						}
					});
					return true;
				}

				// Report missing @throws type
				if (!type) {
					context.report({
						loc: loc('@throws', occurrence),
						message: `@throws must include a type.`
					});
					return true;
				}

				const expectedType = normalizeTypes(type);

				// Report mismatch @throws type
				if (expectedType !== type) {
					context.report({
						loc: loc(`@throws`, occurrence),
						message: `@throws type is "${type}" but should be "${expectedType}".`,
						fix: (fixer) => {
							const range = getTagRange(docblock, source);
							const fixed = source.source.replace(`{${type}}`, `{${expectedType}}`);
							return fixer.replaceTextRange(range, fixed);
						}
					});
					return true;
				}

				let fullDescription = '';
				if (name) fullDescription += name;
				if (description) fullDescription += (name ? ' ' : '') + description;

				// Report missing @throws description
				if (!fullDescription) {
					context.report({
						loc: loc(`@throws`, occurrence),
						message: `@throws must include a description.`
					});
					return true;
				}

				// Report @throws description not ending with a period
				if (!fullDescription.endsWith('.')) {
					context.report({
						loc: loc(`@throws`, occurrence),
						message: '@throws description must end with a period.',
						fix: (fixer) => {
							const range = getTagRange(docblock, source);
							const fixed = source.source.replace(description, `${description}.`);
							return fixer.replaceTextRange(range, fixed);
						}
					});
					return true;
				}

				// Report excessive @throws description length
				if (80 < fullDescription.length) {
					context.report({
						loc: loc(`@throws`, occurrence),
						message: '@throws description must not exceed 80 characters.'
					});
					return true;
				}
			});
		};

		return {
			MethodDefinition: validate,
			FunctionExpression: validate,
			ArrowFunctionExpression: validate,
			ExportNamedDeclaration: validate,
			ExportDefaultDeclaration: validate,
			AssignmentExpression: validate
		};
	}
};

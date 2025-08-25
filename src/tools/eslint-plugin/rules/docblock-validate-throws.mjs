import { parse } from 'comment-parser';
import { getDocblock, getDocLoc, normalizeTypes, createExportValidator } from '../utils.mjs';

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
		const sourceCode = context.sourceCode || context.getSourceCode();

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
		const hasThrowStatements = (node) => {
			if (!node.body) return false;

			if ('BlockStatement' === node.body.type) {
				return traverseThrows(node.body.body);
			}

			return false;
		};

		/**
		 * Validates the docblock for a given node.
		 *
		 * @param {ASTNode} node - The node to validate.
		 * @returns {void}
		 */
		const validate = (node) => {
			const docblock = getDocblock(sourceCode, node);

			if (!docblock) return;

			const parsed = parse(`/*${docblock.value}*/`);

			if (!parsed) return;

			const tags            = parsed[0]?.tags ?? [];
			const throwsTag       = tags.find((tag) => 'throw' === tag.tag || 'throws' === tag.tag);
			const hasTryStatement = hasTryCatch(node);
			const hasThrows       = hasThrowStatements(node);
			const canThrowErrors  = hasTryStatement || hasThrows;

			if (canThrowErrors && !throwsTag) {
				context.report({
					loc: docblock.loc,
					message: 'Declaration can throw errors but no @throws documentation found.'
				});
				return;
			}

			if (!canThrowErrors && throwsTag) {
				context.report({
					loc: getDocLoc(sourceCode, docblock, '@throws'),
					message: 'Declaration has @throws documentation but no try-catch blocks or throw statements found.'
				});
				return;
			}

			if (!throwsTag) return;

			let { tag: label, type, name, description } = throwsTag;

			if ('throw' === label) {
				context.report({
					loc: getDocLoc(sourceCode, docblock, '@throw'),
					message: `Use "@throws" instead of "@throw".`,
					fix: (fixer) => {
						const fixed = docblock.value.replace('@throw', '@throws');
						return fixer.replaceText(docblock, `/*${fixed}*/`);
					}
				});
				return;
			}

			if (!type) {
				context.report({
					loc: getDocLoc(sourceCode, docblock, '@throws'),
					message: `@throws must include a type.`
				});
				return;
			}

			const expectedType = normalizeTypes(type);

			if (expectedType !== type) {
				context.report({
					loc: getDocLoc(sourceCode, docblock, `@throws {${type}}`),
					message: `@throws type is "${type}" but should be "${expectedType}".`,
					fix: (fixer) => {
						const fixed = docblock.value.replace(`@throws {${type}}`, `@throws {${expectedType}}`);
						return fixer.replaceText(docblock, `/*${fixed}*/`);
					}
				});
				type = expectedType;
				return;
			}

			let fullDescription = '';
			if (name) fullDescription += name;
			if (description) fullDescription += (name ? ' ' : '') + description;

			if (!fullDescription) {
				context.report({
					loc: getDocLoc(sourceCode, docblock, `@throws {${type}}`),
					message: `@throws must include a description.`
				});
				return;
			}

			if (!fullDescription.endsWith('.')) {
				context.report({
					loc: getDocLoc(sourceCode, docblock, `@throws {${type}}`),
					message: '@throws description must end with a period.',
					fix: (fixer) => {
						let contentToFix = `@throws {${type}}`;
						if (name) contentToFix += ` ${name}`;
						if (description) contentToFix += ` ${description}`;

						const fixed = docblock.value.replace(contentToFix, `@throws {${type}} ${fullDescription}.`);
						return fixer.replaceText(docblock, `/*${fixed}*/`);
					}
				});
				return;
			}

			if (80 < fullDescription.length) {
				context.report({
					loc: getDocLoc(sourceCode, docblock, `@throws {${type}}`),
					message: '@throws description must not exceed 80 characters.'
				});
				return;
			}
		};

		// Create a validator for export declarations.
		const validateExport = createExportValidator(validate);

		return {
			MethodDefinition: validate,
			ArrowFunctionExpression: validate,
			ExportNamedDeclaration: validateExport,
			ExportDefaultDeclaration: validateExport
		};
	}
};

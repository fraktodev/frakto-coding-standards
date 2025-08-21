import { parse } from 'comment-parser';
import { getDocblock, getDocLoc, createExportValidator } from '../utils.js';

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
		 * @param {Array<ASTNode>} statements - The statements to traverse.
		 *
		 * @returns {boolean}
		 */
		const traverse = (statements) => {
			if (!statements) return false;

			for (const stmt of statements) {
				if ('TryStatement' === stmt.type) {
					return true;
				}
				else if ('IfStatement' === stmt.type) {
					if (traverse([stmt.consequent])) return true;
					if (stmt.alternate && traverse([stmt.alternate])) return true;
				}
				else if ('BlockStatement' === stmt.type) {
					if (traverse(stmt.body)) return true;
				}
				else if ('SwitchStatement' === stmt.type) {
					for (const caseNode of stmt.cases) {
						if (traverse(caseNode.consequent)) return true;
					}
				}
				else if ('WhileStatement' === stmt.type || 'DoWhileStatement' === stmt.type) {
					if (traverse([stmt.body])) return true;
				}
				else if ('ForStatement' === stmt.type || 'ForInStatement' === stmt.type || 'ForOfStatement' === stmt.type) {
					if (traverse([stmt.body])) return true;
				}
			}

			return false;
		};

		/**
		 * Checks if a node has a try-catch block.
		 *
		 * @param {ASTNode} node - The node to check.
		 *
		 * @returns {boolean}
		 */
		const hasTryCatch = (node) => {
			if (!node.body) return false;

			if ('BlockStatement' === node.body.type) {
				return traverse(node.body.body);
			}

			return false;
		};

		/**
		 * Validates the docblock for a given node.
		 *
		 * @param {ASTNode} node - The node to validate.
		 *
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

			if (hasTryStatement && !throwsTag) {
				context.report({
					loc: docblock.loc,
					message: 'Declaration contains try-catch block but no @throws documentation.'
				});
				return;
			}

			if (!hasTryStatement && throwsTag) {
				context.report({
					loc: getDocLoc(sourceCode, docblock, '@throws'),
					message: 'Declaration has @throws documentation but no try-catch block found.'
				});
				return;
			}

			if (!throwsTag) return;

			let { tag: label, type, description } = throwsTag;

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

			if (!description) {
				context.report({
					loc: getDocLoc(sourceCode, docblock, `@throws {${type}}`),
					message: `@throws must include a description.`
				});
				return;
			}

			if (!description.endsWith('.')) {
				context.report({
					loc: getDocLoc(sourceCode, docblock, `@throws {${type}}`),
					message: '@throws description must end with a period.',
					fix: (fixer) => {
						const fixed = docblock.value.replace(description, `${description}.`);
						return fixer.replaceText(docblock, `/*${fixed}*/`);
					}
				});
				return;
			}

			if (10 > description.length) {
				context.report({
					loc: getDocLoc(sourceCode, docblock, `@throws {${type}}`),
					message: '@throws description must be at least 10 characters long.'
				});
				return;
			}

			if (80 < description.length) {
				context.report({
					loc: getDocLoc(sourceCode, docblock, `@throws {${type}}`),
					message: '@throws description must not exceed 80 characters.'
				});
				return;
			}
		};

		// Create a validator for export declarations.
		const validateExport = createExportValidator(validate);

		/* eslint-disable @typescript-eslint/naming-convention */
		return {
			MethodDefinition: validate,
			ArrowFunctionExpression: validate,
			ExportNamedDeclaration: validateExport,
			ExportDefaultDeclaration: validateExport
		};
	}
};

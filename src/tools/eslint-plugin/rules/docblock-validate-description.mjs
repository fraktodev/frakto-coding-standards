import { parse } from 'comment-parser';
import { getDocblock, getDocLoc, createExportValidator } from '../utils.mjs';

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
		const sourceCode = context.sourceCode || context.getSourceCode();

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

			const description = parsed[0]?.description?.trim() ?? '';

			if (!description) {
				context.report({
					loc: {
						start: {
							line: docblock.loc.start.line + 1,
							column: docblock.loc.start.column + 1
						},
						end: {
							line: docblock.loc.start.line + 1,
							column: docblock.loc.start.column + 2
						}
					},
					message: 'Docblock must have a description.'
				});

				return;
			}

			const loc = getDocLoc(sourceCode, docblock, description);

			if (!description.endsWith('.')) {
				context.report({
					loc,
					message: 'Docblock description must end with a period.',
					fix: (fixer) => {
						const fixed = docblock.value.replace(description, `${description}.`);
						return fixer.replaceText(docblock, `/*${fixed}*/`);
					}
				});
				return;
			}

			if (20 > description.length) {
				context.report({
					loc: loc,
					message: 'Docblock description must be at least 20 characters long.'
				});
				return;
			}

			if (200 < description.length) {
				context.report({
					loc: loc,
					message: 'Docblock description must not exceed 200 characters.'
				});
			}
		};

		// Create a validator for export declarations.
		const validateExport = createExportValidator(validate);

		return {
			ClassDeclaration: validate,
			MethodDefinition: validate,
			ArrowFunctionExpression: validate,
			ExportNamedDeclaration: validateExport,
			ExportDefaultDeclaration: validateExport
		};
	}
};

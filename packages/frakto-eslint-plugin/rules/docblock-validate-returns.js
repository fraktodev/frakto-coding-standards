import { parse } from 'comment-parser';
import { getDocblock, getDocLoc, normalizeTypes, createExportValidator } from '../utils.js';

export default {
	meta: {
		type: 'problem',
		docs: {
			description: 'Ensure docblock returns are valid.',
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

			const tags       = parsed[0]?.tags ?? [];
			const returnsTag = tags.find((tag) => 'return' === tag.tag || 'returns' === tag.tag);

			if (!returnsTag) {
				context.report({
					loc: docblock.loc,
					message: 'Declaration must have a return type even if it is void.'
				});
				return;
			}

			let { tag: label, type, description } = returnsTag;

			if ('return' === label) {
				context.report({
					loc: getDocLoc(sourceCode, docblock, '@return'),
					message: `Use "@returns" instead of "@return".`,
					fix: (fixer) => {
						const fixed = docblock.value.replace('@return', '@returns');
						return fixer.replaceText(docblock, `/*${fixed}*/`);
					}
				});
				return;
			}

			if (!type) {
				context.report({
					loc: getDocLoc(sourceCode, docblock, '@returns'),
					message: `@returns must include a type.`
				});
				return;
			}

			const expectedType = normalizeTypes(type);

			if (expectedType !== type) {
				context.report({
					loc: getDocLoc(sourceCode, docblock, `@returns {${type}}`),
					message: `@returns type is "${type}" but should be "${expectedType}".`,
					fix: (fixer) => {
						const fixed = docblock.value.replace(`@returns {${type}}`, `@returns {${expectedType}}`);
						return fixer.replaceText(docblock, `/*${fixed}*/`);
					}
				});
				type = expectedType;
				return;
			}

			if (description) {
				context.report({
					loc: getDocLoc(sourceCode, docblock, `@returns {${type}}`),
					message: `@returns must not include a description.`,
					fix: (fixer) => {
						const fixed = docblock.value.replace(`@returns {${type}} - ${description}`, `@returns {${type}}`);
						return fixer.replaceText(docblock, `/*${fixed}*/`);
					}
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

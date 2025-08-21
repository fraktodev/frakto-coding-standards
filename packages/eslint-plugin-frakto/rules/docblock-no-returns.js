import { parse } from 'comment-parser';
import { getDocblock, getDocLoc, createExportValidator } from '../utils.js';

export default {
	meta: {
		type: 'problem',
		docs: {
			description: 'Ensure docblock has no returns.',
			category: 'Best Practices',
			recommended: true
		},
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

			if (returnsTag) {
				context.report({
					loc: getDocLoc(sourceCode, docblock, '@return'),
					message: 'Declaration must not have a returns tag.'
				});
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

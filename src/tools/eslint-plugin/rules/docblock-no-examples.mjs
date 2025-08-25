import { parse } from 'comment-parser';
import { getDocblock, getDocLoc, createExportValidator } from '../utils.mjs';

export default {
	meta: {
		type: 'problem',
		docs: {
			description: 'Enforce the absence of @example tags in docblocks.',
			category: 'Best Practices',
			recommended: true
		},
		fixable: null,
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

			const examples = parsed[0]?.examples ?? [];
			const tags     = parsed[0]?.tags ?? [];

			if (0 < examples.length) {
				context.report({
					loc: getDocLoc(sourceCode, docblock, '@example'),
					message: '@example tags are not allowed in docblocks.'
				});
				return;
			}

			const exampleTags = tags.filter((tag) => 'example' === tag.tag);
			if (0 < exampleTags.length) {
				context.report({
					loc: getDocLoc(sourceCode, docblock, '@example'),
					message: '@example tags are not allowed in docblocks.'
				});
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

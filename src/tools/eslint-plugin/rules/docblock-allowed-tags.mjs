import { parse } from 'comment-parser';
import { getDocblock, getDocLoc, createExportValidator } from '../utils.mjs';

export default {
	meta: {
		type: 'problem',
		docs: {
			description: 'Enforce only allowed tags in function docblocks.',
			category: 'Best Practices',
			recommended: true
		},
		fixable: null,
		schema: []
	},
	create(context) {
		const sourceCode          = context.sourceCode || context.getSourceCode();
		const allowedFunctionTags = ['param', 'returns', 'return', 'throws', 'throw', 'see', 'deprecated'];
		const allowedClassTags    = ['class', 'abstract', 'extends', 'see', 'deprecated'];

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

			const examples = parsed[0]?.examples ?? [];
			const tags     = parsed[0]?.tags ?? [];

			if (0 < examples.length) {
				context.report({
					loc: getDocLoc(sourceCode, docblock, '@example'),
					message: '@example tags are not allowed in docblocks.'
				});
				return;
			}

			const allowedTags = 'ClassDeclaration' === node.type ? allowedClassTags : allowedFunctionTags;
			const nodeType    = 'ClassDeclaration' === node.type ? 'class' : 'function';

			for (const tag of tags) {
				if ('todo' === tag.tag) {
					context.report({
						loc: getDocLoc(sourceCode, docblock, `@${tag.tag}`),
						message: '@todo must be inserted in to docblock description (e.g. TODO: Fix the bug)'
					});
					return;
				}

				if (!allowedTags.includes(tag.tag)) {
					context.report({
						loc: getDocLoc(sourceCode, docblock, `@${tag.tag}`),
						message: `@${tag.tag} tag is not allowed in ${nodeType} docblocks. Allowed tags: ${allowedTags.join(', ')}.`
					});
				}
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

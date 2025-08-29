// Dependencies
import { getDocblockData, normalizeTypes } from '../utils.mjs';

// Export Rule
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
		/**
		 * Validates the docblock for a given node.
		 *
		 * @param {ASTNode} node - The node to validate.
		 * @returns {void}
		 */
		const validate = (node) => {
			const docData = getDocblockData(context, node);
			if (!docData) return;
			const { docblock, data, loc } = docData;

			// Extract tags
			const tags        = data.tags ?? [];
			const returnsTags = tags.filter((tag) => 'return' === tag.tag || 'returns' === tag.tag);

			// Report missing @returns tag
			if (!returnsTags.length) {
				context.report({
					loc: docblock.loc,
					message: 'Declaration must have a return type even if it is void.'
				});
				return;
			}

			// Report multiple @returns tags
			if (1 < returnsTags.length) {
				context.report({
					loc: loc('@returns', 2),
					message: `Declaration must have only one @returns tag.`
				});
				return;
			}

			// Extract @returns tag data
			const returnsTag = returnsTags[0];
			let { tag: label, type, name, description } = returnsTag;

			// Report deprecated @return tag
			if ('return' === label) {
				context.report({
					loc: loc('@return'),
					message: `Use "@returns" instead of "@return".`,
					fix: (fixer) => {
						const fixed = docblock.value.replace('@return', '@returns');
						return fixer.replaceText(docblock, `/*${fixed}*/`);
					}
				});
				return;
			}

			// Report missing @returns type
			if (!type) {
				context.report({
					loc: loc('@returns'),
					message: `@returns must include a type.`
				});
				return;
			}

			const expectedType = normalizeTypes(type);

			// Report incorrect @returns type
			if (expectedType !== type) {
				context.report({
					loc: loc(`@returns {${type}}`),
					message: `@returns type is "${type}" but should be "${expectedType}".`,
					fix: (fixer) => {
						const fixed = docblock.value.replace(`@returns {${type}}`, `@returns {${expectedType}}`);
						return fixer.replaceText(docblock, `/*${fixed}*/`);
					}
				});
				type = expectedType;
				return;
			}

			const hasGenericObject = expectedType.split('|').some((t) => 'object' === t.trim());

			// Report generic object @returns type
			if (hasGenericObject) {
				context.report({
					loc: loc(`@returns {${type}}`),
					message: `@returns should not use generic "object" type. Please describe the object shape, e.g., {{success: boolean, transactionId: string, error?: string}}.`
				});
				return;
			}

			// Report description in @returns tag
			if (name || description) {
				context.report({
					loc: loc(`@returns {${type}}`),
					message: `@returns must not include a description.`,
					fix: (fixer) => {
						let contentToRemove = `@returns {${type}}`;
						if (name) contentToRemove += ` ${name}`;
						if (description) contentToRemove += ` ${description}`;

						const fixed = docblock.value.replace(contentToRemove, `@returns {${type}}`);
						return fixer.replaceText(docblock, `/*${fixed}*/`);
					}
				});
				return;
			}
		};

		return {
			FunctionExpression: validate,
			ArrowFunctionExpression: validate
		};
	}
};

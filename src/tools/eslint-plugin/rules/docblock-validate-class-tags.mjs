// Dependencies
import { getDocblockData } from '../utils.mjs';

// Export Rule
export default {
	meta: {
		type: 'problem',
		docs: {
			description: 'Enforce required tags in class docblocks.',
			category: 'Best Practices',
			recommended: true
		},
		fixable: 'code',
		schema: [
			{
				type: 'object',
				properties: {
					language: {
						type: 'string',
						enum: ['js', 'ts'],
						default: 'js'
					}
				},
				additionalProperties: false
			}
		]
	},
	create(context) {
		const language = context.options[0]?.language || 'js';

		/**
		 * Checks if a class is abstract by looking for abstract-related error throws.
		 *
		 * @param {ASTNode} classNode - The class node to check.
		 * @returns {boolean}
		 */
		const isClassAbstract = (classNode) => {
			if ('ts' === language) {
				return Boolean(classNode.abstract);
			}

			const members = classNode.body?.body ?? [];

			for (const member of members) {
				if ('MethodDefinition' === member.type) {
					const statements = member.value?.body?.body ?? [];

					for (const stmt of statements) {
						if (
							'ThrowStatement' === stmt.type &&
							'NewExpression' === stmt.argument?.type &&
							'Error' === stmt.argument?.callee?.name
						) {
							const errorMessage = stmt.argument?.arguments?.[0]?.value ?? '';

							if (errorMessage.includes('abstract')) {
								return true;
							}
						}
					}
				}
			}

			return false;
		};

		/**
		 * Validates the docblock for a class node.
		 *
		 * @param {ASTNode} node - The class node to validate.
		 * @returns {void}
		 */
		const validate = (node) => {
			const docData = getDocblockData(context, node);
			if (!docData) return;
			const { docblock, realNode, data, loc } = docData;
			if ('class' !== realNode.kind) return;

			// Extract tags and class name
			const tags      = data[0]?.tags ?? [];
			const className = realNode.id?.name || '<<anonymous>>';

			// Check if class is abstract
			if (isClassAbstract(realNode)) {
				const abstractTags = tags.filter((tag) => 'abstract' === tag.tag);

				// Report missing @abstract tag
				if (!abstractTags.length) {
					context.report({
						loc: docblock.loc,
						message: `Abstract class ${className} must have @abstract tag.`
					});
					return;
				}

				// Report multiple @abstract tags
				if (1 < abstractTags.length) {
					context.report({
						loc: loc('@abstract', 2),
						message: `Abstract class ${className} must have only one @abstract tag.`
					});
					return;
				}
			}

			// Check if class extends another class
			if (realNode.superClass) {
				// Prepare @extends tag
				const extendsTags    = tags.filter((tag) => 'extends' === tag.tag);
				const superClassName = realNode.superClass.name;

				// Report missing @extends tag
				if (!extendsTags.length) {
					context.report({
						loc: docblock.loc,
						message: `Class ${className} extends ${superClassName} and must have @extends tag.`
					});
					return;
				}

				// Report multiple @extends tags
				if (1 < extendsTags.length) {
					context.report({
						loc: loc('@extends', 2),
						message: `Class ${className} extends ${superClassName} and must have exactly one @extends tag.`
					});
					return;
				}

				// Prepare @extends tag
				const extendsTag        = extendsTags[0];
				const tagSuperClassName = extendsTag.name || extendsTag.description?.split(' ')[0] || '';

				// Report incorrect @extends tag
				if (superClassName !== tagSuperClassName) {
					context.report({
						loc: loc('@extends'),
						message: `@extends tag must specify the correct parent class name: ${superClassName}.`,
						fix(fixer) {
							const fixed = docblock.value.replace(/@extends\s+\S+/, `@extends ${superClassName}`);
							return fixer.replaceText(docblock, `/*${fixed}*/`);
						}
					});
				}
			}
		};

		return {
			ClassDeclaration: validate,
			ExportNamedDeclaration: validate,
			ExportDefaultDeclaration: validate
		};
	}
};

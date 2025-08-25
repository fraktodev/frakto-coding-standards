import { parse } from 'comment-parser';
import { getDocblock, getDocLoc, createExportValidator } from '../utils.mjs';

export default {
	meta: {
		type: 'problem',
		docs: {
			description: 'Enforce required tags in class docblocks.',
			category: 'Best Practices',
			recommended: true
		},
		fixable: 'code',
		schema: []
	},
	create(context) {
		const sourceCode = context.sourceCode || context.getSourceCode();

		/**
		 * Checks if a class is abstract by looking for abstract-related error throws.
		 *
		 * @param {ASTNode} classNode - The class node to check.
		 * @returns {boolean}
		 */
		const isClassAbstract = (classNode) => {
			const methods = classNode.body?.body?.filter((member) => 'MethodDefinition' === member.type) ?? [];

			for (const method of methods) {
				const statements = method.value?.body?.body ?? [];

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

			return false;
		};

		/**
		 * Validates the docblock for a class node.
		 *
		 * @param {ASTNode} node - The class node to validate.
		 * @returns {void}
		 */
		const validate = (node) => {
			if ('ClassDeclaration' !== node.type) return;

			const docblock = getDocblock(sourceCode, node);

			if (!docblock) return;

			const parsed = parse(`/*${docblock.value}*/`);

			if (!parsed) return;

			const tags      = parsed[0]?.tags ?? [];
			const className = node.id?.name;

			const classTags = tags.filter((tag) => 'class' === tag.tag);

			if (0 === classTags.length) {
				context.report({
					loc: getDocLoc(sourceCode, docblock),
					message: `Class ${className} must have @class tag with class name.`
				});
			}
			else {
				const classTag     = classTags[0];
				const tagClassName = classTag.name || classTag.description?.split(' ')[0] || '';

				if (className !== tagClassName) {
					context.report({
						loc: getDocLoc(sourceCode, docblock, '@class'),
						message: `@class tag must specify the correct class name: ${className}.`,
						fix(fixer) {
							const fixed = docblock.value.replace(/@class\s+\S+/, `@class ${className}`);
							return fixer.replaceText(docblock, `/*${fixed}*/`);
						}
					});
				}
			}

			// Check if class is abstract
			if (isClassAbstract(node)) {
				const abstractTags = tags.filter((tag) => 'abstract' === tag.tag);
				if (0 === abstractTags.length) {
					context.report({
						loc: getDocLoc(sourceCode, docblock),
						message: `Abstract class ${className} must have @abstract tag.`
					});
				}
			}

			// Check if class extends another class
			if (node.superClass) {
				const extendsTags    = tags.filter((tag) => 'extends' === tag.tag);
				const superClassName = node.superClass.name;

				if (0 === extendsTags.length) {
					context.report({
						loc: getDocLoc(sourceCode, docblock),
						message: `Class ${className} extends ${superClassName} and must have @extends tag.`
					});
				}
				else {
					const extendsTag        = extendsTags[0];
					const tagSuperClassName = extendsTag.name || extendsTag.description?.split(' ')[0] || '';

					if (superClassName !== tagSuperClassName) {
						context.report({
							loc: getDocLoc(sourceCode, docblock, '@extends'),
							message: `@extends tag must specify the correct parent class name: ${superClassName}.`,
							fix(fixer) {
								const fixed = docblock.value.replace(/@extends\s+\S+/, `@extends ${superClassName}`);
								return fixer.replaceText(docblock, `/*${fixed}*/`);
							}
						});
					}
				}
			}
		};

		// Create a validator for export declarations.
		const validateExport = createExportValidator(validate);

		return {
			ClassDeclaration: validate,
			ExportNamedDeclaration: validateExport,
			ExportDefaultDeclaration: validateExport
		};
	}
};

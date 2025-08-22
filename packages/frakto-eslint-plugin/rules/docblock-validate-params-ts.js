import { parse } from 'comment-parser';
import { getDocblock, getDocLoc, createExportValidator } from '../utils.js';

export default {
	meta: {
		type: 'problem',
		docs: {
			description: 'Ensure docblock ts params are valid.',
			category: 'Best Practices',
			recommended: true
		},
		fixable: 'code',
		schema: []
	},
	create(context) {
		const sourceCode = context.sourceCode || context.getSourceCode();

		/**
		 * Get the parameters for a given node.
		 *
		 * @param {ASTNode} node - The node to get the parameters from.
		 *
		 * @returns {any[]}
		 */
		const getNodeParams = (node) => {
			if ('MethodDefinition' === node.type) {
				return node.value?.params || [];
			}

			// Handle ExportNamedDeclaration and ExportDefaultDeclaration
			if ('ExportNamedDeclaration' === node.type || 'ExportDefaultDeclaration' === node.type) {
				const declaration = node.declaration;
				if ('VariableDeclaration' === declaration?.type) {
					// Find the arrow function in the variable declaration
					const arrowFunction = declaration.declarations?.find(
						(declarator) => 'ArrowFunctionExpression' === declarator.init?.type
					)?.init;
					return arrowFunction?.params || [];
				}
				if ('ArrowFunctionExpression' === declaration?.type) {
					return declaration.params || [];
				}
			}

			return node.params || [];
		};

		/**
		 * Get the name of a specific parameter.
		 *
		 * @param {ASTNode} param - The parameter to get the name from.
		 *
		 * @returns {string}
		 */
		const getParamName = (param) => {
			if ('TSParameterProperty' === param.type) {
				return param.parameter?.name || param.parameter?.left?.name || '';
			}
			return param.left?.name || param.name || '';
		};

		/**
		 * Get the aligned parameters from the tags.
		 *
		 * @param {object[]} tags - The tags to get the aligned parameters from.
		 *
		 * @returns {object[]}
		 */
		const getAlignedParams = (tags) => {
			const mapped  = tags.map((tag) => {
				return {
					name: tag.name,
					desc: tag.description.trim().replace(/^-/, '').trim()
				};
			});

			const maxName = Math.max(...mapped.map((tag) => tag.name.length));

			return mapped.map((tag) => {
				const name = tag.name.padEnd(maxName, ' ');
				return `@param ${name} - ${tag.desc}`;
			});
		};

		/**
		 * Get the unaligned parameters from the docblock.
		 *
		 * @param {docblock} docblock - The docblock to get the unaligned parameters from.
		 *
		 * @returns {object[]}
		 */
		const getUnalignedParams = (docblock) => {
			return docblock.value
				.split('\n')
				.filter((line) => line.includes('@param'))
				.map((line) => line.trim().replace(/^\* ?/, ''));
		};

		/**
		 * Replaces the parameter lines in the docblock with aligned parameters.
		 *
		 * @param {string}   docText       - The original docblock text.
		 * @param {string[]} alignedParams - The aligned parameter lines.
		 *
		 * @returns {string}
		 */
		const replaceParamLines = (docText, alignedParams) => {
			const lines    = docText.split('\n');
			const newLines = [];
			let inParams = false;

			const firstParamLine = lines.find((line) => line.includes('@param'));
			const indentMatch    = firstParamLine?.match(/^([ \t]*)\*/);
			const indent         = indentMatch ? indentMatch[1] : '';

			for (const line of lines) {
				if (line.includes('@param')) {
					if (!inParams) {
						newLines.push(...alignedParams.map((param) => `${indent}* ${param}`));
						inParams = true;
					}
					continue;
				}

				if (inParams && !line.trim().startsWith('* @')) {
					inParams = false;
				}

				newLines.push(line);
			}

			return newLines.join('\n');
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

			const tags      = parsed[0]?.tags ?? [];
			const paramTags = tags.filter((tag) => 'param' === tag.tag);
			const params    = getNodeParams(node);

			if (0 === params.length && 0 < paramTags.length) {
				context.report({
					loc: docblock.loc,
					message: 'Declaration has no parameters but @param tags are present in docblock.'
				});
				return;
			}

			if (0 < params.length && 0 === paramTags.length) {
				context.report({
					loc: docblock.loc,
					message: 'Declaration has parameters but no @param tags in the docblock.'
				});
				return;
			}

			if (params.length !== paramTags.length) {
				context.report({
					loc: docblock.loc,
					message: 'Number of parameters in declaration does not match number of @param tags in docblock.'
				});
				return;
			}

			paramTags.forEach((tag, index) => {
				let { type, name, description } = tag;

				if (type) {
					context.report({
						loc: getDocLoc(sourceCode, docblock, `@param`),
						message: `@param must not include a type.`
					});
					return;
				}

				if (!name) {
					context.report({
						loc: getDocLoc(sourceCode, docblock, `@param`),
						message: `@param must include a name.`
					});
					return;
				}

				const realParam    = params[index];
				const expectedName = getParamName(realParam);

				if (expectedName !== name) {
					context.report({
						loc: getDocLoc(sourceCode, docblock, `@param ${name}`),
						message: `@param name "${name}" does not match declaration parameter "${expectedName}".`,
						fix: (fixer) => {
							const fixed = docblock.value.replace(`@param ${name}`, `@param ${expectedName}`);
							return fixer.replaceText(docblock, `/*${fixed}*/`);
						}
					});
					name = expectedName;
					return;
				}

				if (!description) {
					context.report({
						loc: getDocLoc(sourceCode, docblock, `@param`),
						message: `@param "${name}" must include a description.`
					});
					return;
				}

				if (!description.startsWith('-')) {
					context.report({
						loc: getDocLoc(sourceCode, docblock, `@param ${name}`),
						message: `@param "${name}" description must start with a dash.`,
						fix: (fixer) => {
							const fixed = docblock.value.replace(description, `- ${description}`);
							return fixer.replaceText(docblock, `/*${fixed}*/`);
						}
					});
					return;
				}

				if (!description.endsWith('.')) {
					context.report({
						loc: getDocLoc(sourceCode, docblock, `@param ${name}`),
						message: `@param "${name}" description must end with a period.`,
						fix: (fixer) => {
							const fixed = docblock.value.replace(description, `${description}.`);
							return fixer.replaceText(docblock, `/*${fixed}*/`);
						}
					});
					return;
				}

				if (10 > description.length) {
					context.report({
						loc: getDocLoc(sourceCode, docblock, `@param ${name}`),
						message: `@param "${name}" description must be at least 10 characters long.`
					});
					return;
				}

				if (80 < description.length) {
					context.report({
						loc: getDocLoc(sourceCode, docblock, `@param ${name}`),
						message: `@param "${name}" description must not exceed 80 characters.`
					});
					return;
				}
			});

			const aligned   = getAlignedParams(paramTags);
			const unaligned = getUnalignedParams(docblock);
			const areEqual  = aligned.every((line, i) => line === unaligned[i]) && aligned.length === unaligned.length;

			if (!areEqual) {
				context.report({
					loc: getDocLoc(sourceCode, docblock, '@param'),
					message: `@param tags must be aligned consistently.`,
					fix: (fixer) => {
						const fixed = replaceParamLines(docblock.value, aligned);
						return fixer.replaceText(docblock, `/*${fixed}*/`);
					}
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

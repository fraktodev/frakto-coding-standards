import { parse } from 'comment-parser';
import { getDocblock, getDocLoc, normalizeTypes, createExportValidator } from '../utils.js';

export default {
	meta: {
		type: 'problem',
		docs: {
			description: 'Ensure docblock js params are valid.',
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
			if (!node) return [];

			if (
				'FunctionDeclaration' === node.type ||
				'FunctionExpression' === node.type ||
				'ArrowFunctionExpression' === node.type
			) {
				return node.params || [];
			}

			if ('MethodDefinition' === node.type) {
				return node.value?.params || [];
			}

			if ('VariableDeclarator' === node.type && node.init) {
				return getNodeParams(node.init);
			}

			if ('ExportNamedDeclaration' === node.type || 'ExportDefaultDeclaration' === node.type) {
				if (node.declaration) {
					return getNodeParams(node.declaration);
				}
			}

			if ('VariableDeclaration' === node.type && node.declarations) {
				for (const declarator of node.declarations) {
					const params = getNodeParams(declarator);
					if (params.length) return params;
				}
			}

			if (node.params) return node.params;

			return [];
		};

		/**
		 * Returns the type of a default value node.
		 *
		 * @param {ASTNode} node - The right side of a parameter default value.
		 *
		 * @returns {string}
		 */
		const getDefaultValueType = (node) => {
			if (!node) return 'undefined';

			if ('ArrayExpression' === node.type) return 'array';
			if ('ObjectExpression' === node.type) return 'object';
			if ('Literal' === node.type) {
				if (null === node.value) return 'null';
				return typeof node.value;
			}
			if ('Identifier' === node.type) return 'identifier';
			if ('FunctionExpression' === node.type || 'ArrowFunctionExpression' === node.type) return 'function';
			if ('UnaryExpression' === node.type) return getDefaultValueType(node.argument);
			if ('BinaryExpression' === node.type) {
				const leftType  = getDefaultValueType(node.left);
				const rightType = getDefaultValueType(node.right);
				if (leftType === rightType) return leftType;
				return 'any';
			}
			if ('CallExpression' === node.type) return 'functionCall';

			return 'any';
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
				const nameFormatted = tag.optional ? `[${tag.name}${tag.default ? `=${tag.default}` : ''}]` : tag.name;

				return {
					type: `{${tag.type}}`,
					name: nameFormatted,
					desc: tag.description.trim().replace(/^-/, '').trim()
				};
			});

			const maxType = Math.max(...mapped.map((tag) => tag.type.length));
			const maxName = Math.max(...mapped.map((tag) => tag.name.length));

			return mapped.map((tag) => {
				const type = tag.type.padEnd(maxType, ' ');
				const name = tag.name.padEnd(maxName, ' ');
				return `@param ${type} ${name} - ${tag.desc}`;
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
			let inParams = false;

			const lines          = docText.split('\n');
			const newLines       = [];
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

			const tags       = parsed[0]?.tags ?? [];
			const docParams  = tags.filter((tag) => 'param' === tag.tag);
			const realParams = getNodeParams(node);

			if (0 === realParams.length && 0 < docParams.length) {
				context.report({
					loc: docblock.loc,
					message: 'Declaration has no parameters but @param tags are present in docblock.'
				});
				return;
			}

			if (0 < realParams.length && 0 === docParams.length) {
				context.report({
					loc: docblock.loc,
					message: 'Declaration has parameters but no @param tags in the docblock.'
				});
				return;
			}

			if (realParams.length !== docParams.length) {
				context.report({
					loc: docblock.loc,
					message: 'Number of parameters in declaration does not match number of @param tags in docblock.'
				});
				return;
			}

			docParams.forEach((tag, index) => {
				let { type, name, description, optional: docIsOptional } = tag;
				const realParam      = realParams[index];
				const realIsOptional = Boolean(realParam?.right);

				if (!type) {
					context.report({
						loc: getDocLoc(sourceCode, docblock, `@param`),
						message: `@param must include a type.`
					});
					return;
				}

				const expectedType = realIsOptional ? getDefaultValueType(realParam.right) : normalizeTypes(type);

				if (expectedType !== type) {
					context.report({
						loc: getDocLoc(sourceCode, docblock, `@param {${type}}`),
						message: `@param type is "${type}" but should be "${expectedType}".`,
						fix: (fixer) => {
							const fixed = docblock.value.replace(`@param {${type}}`, `@param {${expectedType}}`);
							return fixer.replaceText(docblock, `/*${fixed}*/`);
						}
					});
					type = expectedType;
					return;
				}

				if (!name) {
					context.report({
						loc: getDocLoc(sourceCode, docblock, `@param`),
						message: `@param must include a name.`
					});
					return;
				}

				const expectedName = realIsOptional ? realParam?.left?.name : realParam?.name;

				if (expectedName !== name) {
					context.report({
						loc: getDocLoc(sourceCode, docblock, `@param {${type}} ${name}`),
						message: `@param "${name}" does not match declaration parameter "${expectedName}".`,
						fix: (fixer) => {
							const fixed = docblock.value.replace(`@param {${type}} ${name}`, `@param {${type}} ${expectedName}`);
							return fixer.replaceText(docblock, `/*${fixed}*/`);
						}
					});
					name = expectedName;
					return;
				}

				if (docIsOptional) {
					context.report({
						loc: getDocLoc(sourceCode, docblock, `@param {${type}}`),
						message: `@param should not be documented as optional with a default value. Only use the parameter name "${name}", without brackets or default assignment.`
					});
					name = expectedName;
					return;
				}

				if (!description) {
					context.report({
						loc: getDocLoc(sourceCode, docblock, `@param {${type}} ${name}`),
						message: `@param must include a description.`
					});
					return;
				}

				if (!description.startsWith('-')) {
					context.report({
						loc: getDocLoc(sourceCode, docblock, `@param {${type}} ${name} ${description}`),
						message: `@param description must start with a dash.`,
						fix: (fixer) => {
							const fixed = docblock.value.replace(description, `- ${description}`);
							return fixer.replaceText(docblock, `/*${fixed}*/`);
						}
					});
					return;
				}

				if (realIsOptional && !description.startsWith('- Optional.')) {
					context.report({
						loc: getDocLoc(sourceCode, docblock, `@param {${type}} ${name} ${description}`),
						message: `@param description must start with a dash and include "Optional."`,
						fix: (fixer) => {
							const descNoDash = description.replace(/^[-\s]+/, '');
							const fixed      = docblock.value.replace(description, `- Optional. ${descNoDash}`);
							return fixer.replaceText(docblock, `/*${fixed}*/`);
						}
					});
					return;
				}

				if (!description.endsWith('.')) {
					context.report({
						loc: getDocLoc(sourceCode, docblock, `@param {${type}} ${name} ${description}`),
						message: `@param description must end with a period.`,
						fix: (fixer) => {
							const fixed = docblock.value.replace(description, `${description}.`);
							return fixer.replaceText(docblock, `/*${fixed}*/`);
						}
					});
					return;
				}

				if ('array' === type || 'object' === type) {
					const arrayKeywords  = ['empty array', 'array of', 'list of', 'collection of'];
					const objectKeywords = ['empty object', 'object with', 'object containing', 'hash of', 'map of'];
					const typeKeywords   = 'array' === type ? arrayKeywords : objectKeywords;
					const hasKeywords    = typeKeywords.some((keyword) => description.toLowerCase().includes(keyword.toLowerCase()));

					if (!hasKeywords) {
						const keywordsList = typeKeywords.map((keyword) => `"${keyword}"`).join(', ');
						context.report({
							loc: getDocLoc(sourceCode, docblock, `@param {${type}} ${name} ${description}`),
							message: `@param with type "${type}" must describe its content using one of these keywords: ${keywordsList}.`
						});
						return;
					}
				}

				if (10 > description.length) {
					context.report({
						loc: getDocLoc(sourceCode, docblock, `@param {${type}} ${name}`),
						message: `@param "${name}" description must be at least 10 characters long.`
					});
					return;
				}

				if (80 < description.length) {
					context.report({
						loc: getDocLoc(sourceCode, docblock, `@param {${type}} ${name}`),
						message: `@param "${name}" description must not exceed 80 characters.`
					});
					return;
				}
			});

			const aligned   = getAlignedParams(docParams);
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

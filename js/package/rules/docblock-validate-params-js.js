import { parse } from 'comment-parser';
import { getDocblock, getDocLoc, createExportValidator } from '../utils.js';

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
		 * @returns {Array}
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
		 * Get the value of a specific parameter from a node.
		 *
		 * @param {ASTNode} node - The node to get the parameter value from.
		 *
		 * @returns {any}
		 */
		const getParamValue = (node) => {
			if (!node) return undefined;

			if ('ArrayExpression' === node.type) {
				return node.elements.map((el) => {
					if (!el) return null;
					if ('Literal' === el.type) return el.value;
					if ('Identifier' === el.type) return el.name;
					return null;
				});
			}

			if ('Literal' === node.type) return node.value;
			if ('Identifier' === node.type) return node.name;

			return undefined;
		};

		/**
		 * Get the value of a specific parameter from a node.
		 *
		 * @param {ASTNode} value - The node to get the parameter value from.
		 *
		 * @returns {any}
		 */
		const getValueType = (value) => {
			if ('string' === typeof value) return 'string';
			if ('number' === typeof value) return 'number';
			if ('boolean' === typeof value) return 'boolean';
			if ('function' === typeof value) return 'function';
			if (Array.isArray(value)) return 'Array';
			if ('object' === typeof value) return 'Object';
			if ('undefined' === typeof value) return 'void';
			if (null === value) return 'void';
			return 'any';
		};

		/**
		 * Get the aligned parameters from the tags.
		 *
		 * @param {Array} tags - The tags to get the aligned parameters from.
		 *
		 * @returns {Array}
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
		 * @returns {Array}
		 */
		const getUnalignedParams = (docblock) => {
			return docblock.value
				.split('\n')
				.filter((line) => line.includes('@param'))
				.map((line) => line.trim().replace(/^\* ?/, ''));
		};

		/**
		 * Checks if two arrays match.
		 *
		 * @param {any} stringValue - The string value to compare.
		 * @param {any} actualValue - The actual value to compare against.
		 *
		 * @throws {Error} If the comparison fails.
		 * @returns {boolean}
		 */
		const arraysMatch = (stringValue, actualValue) => {
			try {
				const parsed = JSON.parse(stringValue);

				if (!Array.isArray(parsed) || !Array.isArray(actualValue)) return false;

				if (parsed.length !== actualValue.length) return false;

				return parsed.every((val, i) => val === actualValue[i]);
			}
			catch (e) {
				return false;
			}
		};

		/**
		 * Replaces the parameter lines in the docblock with aligned parameters.
		 *
		 * @param {string} docText       - The original docblock text.
		 * @param {Array}  alignedParams - The aligned parameter lines.
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
				let { type, name, optional, default: def, description } = tag;

				if (!type) {
					context.report({
						loc: getDocLoc(sourceCode, docblock, `@param`),
						message: `@param must include a type.`
					});
					return;
				}

				if ('*' === type) {
					context.report({
						loc: getDocLoc(sourceCode, docblock, '@param {*}'),
						message: `Avoid using {*} as type, use {any} instead.`,
						fix: (fixer) => {
							const fixed = docblock.value.replace('{*}', '{any}');
							return fixer.replaceText(docblock, `/*${fixed}*/`);
						}
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
				const expectedName = realParam?.left?.name || realParam?.name || '';

				if (expectedName !== name) {
					context.report({
						loc: getDocLoc(sourceCode, docblock, `@param {${type}} ${name}`),
						message: `@param name "${name}" does not match declaration parameter "${expectedName}".`,
						fix: (fixer) => {
							const fixed = docblock.value.replace(`@param {${type}} ${name}`, `@param {${type}} ${expectedName}`);
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
						loc: getDocLoc(sourceCode, docblock, `@param {${type}} ${name}`),
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
						loc: getDocLoc(sourceCode, docblock, `@param {${type}} ${name}`),
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

				const isOptional = Boolean(realParam?.right);

				if (isOptional) {
					const expectedDefault = getParamValue(realParam.right);
					const expectedType    = getValueType(expectedDefault);

					if (expectedType !== type) {
						context.report({
							loc: getDocLoc(sourceCode, docblock, `@param {${type}} ${name}`),
							message: `@param "${name}" type is "${type}" but default value implies "${expectedType}".`,
							fix: (fixer) => {
								const fixed = docblock.value.replace(`@param {${type}} ${name}`, `@param {${expectedType}} ${name}`);
								return fixer.replaceText(docblock, `/*${fixed}*/`);
							}
						});
						type = expectedType;
						return;
					}

					if (!optional || (!Array.isArray(expectedDefault) && expectedDefault !== def)) {
						context.report({
							loc: getDocLoc(sourceCode, docblock, `@param {${type}} ${name}`),
							message: `@param "${name}" is optional but does not match default value "${expectedDefault}".`,
							fix: (fixer) => {
								const fixed = docblock.value.replace(
									`@param {${type}} ${name}`,
									`@param {${type}} [${name}=${expectedDefault}]`
								);
								return fixer.replaceText(docblock, `/*${fixed}*/`);
							}
						});
						return;
					}

					if (!optional || (Array.isArray(expectedDefault) && !arraysMatch(def, expectedDefault))) {
						context.report({
							loc: getDocLoc(sourceCode, docblock, `@param {${type}} ${name}`),
							message: `@param "${name}" is optional and must match default value "[${expectedDefault}]".`,
							fix: (fixer) => {
								const fixed = docblock.value.replace(
									`@param {${type}} ${name}`,
									`@param {${type}} [${name}=[${expectedDefault}]]`
								);
								return fixer.replaceText(docblock, `/*${fixed}*/`);
							}
						});
						return;
					}
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

		// eslint-disable-next-line
		/* eslint-disable @typescript-eslint/naming-convention */
		return {
			MethodDefinition: validate,
			ArrowFunctionExpression: validate,
			ExportNamedDeclaration: validateExport,
			ExportDefaultDeclaration: validateExport
		};
	}
};

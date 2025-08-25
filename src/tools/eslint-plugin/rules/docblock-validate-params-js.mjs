import { parse } from 'comment-parser';
import { getDocblock, getDocLoc, normalizeTypes, createExportValidator } from '../utils.mjs';

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
		 * Get the parameters for a given node, expanding object destructuring.
		 *
		 * @param {ASTNode} node - The node to get the parameters from.
		 * @returns {any[]}
		 */
		const getNodeParams = (node) => {
			if (!node) return [];

			if (
				'FunctionDeclaration' === node.type ||
				'FunctionExpression' === node.type ||
				'ArrowFunctionExpression' === node.type
			) {
				return expandParams(node.params || []);
			}

			if ('MethodDefinition' === node.type) {
				return expandParams(node.value?.params || []);
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

			if (node.params) return expandParams(node.params);

			return [];
		};

		/**
		 * Expands object patterns and assignment patterns into individual parameters.
		 *
		 * @param {ASTNode[]} params - The raw parameters from the AST.
		 * @returns {object[]}
		 */
		const expandParams = (params) => {
			const expanded = [];

			for (const param of params) {
				// Case 1: Regular parameter (name, age, etc.)
				if ('Identifier' === param.type) {
					expanded.push({
						name: param.name,
						type: 'Identifier',
						hasDefault: false,
						originalParam: param
					});
				}
				// Case 2: Object destructuring ({ apiKey, timeout })
				else if ('ObjectPattern' === param.type) {
					for (const property of param.properties) {
						if ('Property' === property.type && 'Identifier' === property.key.type) {
							const hasDefault = 'AssignmentPattern' === property.value.type;
							expanded.push({
								name: property.key.name,
								type: 'ObjectPattern',
								hasDefault,
								originalParam: param,
								property
							});
						}
					}
				}
				// Case 3: Assignment with default (user = { name: 'test' })
				else if ('AssignmentPattern' === param.type) {
					const leftSide  = param.left;
					const rightSide = param.right;

					// If left side is identifier and right is object
					if ('Identifier' === leftSide.type && 'ObjectExpression' === rightSide.type) {
						// First add the parent object parameter
						expanded.push({
							name: leftSide.name,
							type: 'AssignmentPattern',
							hasDefault: true,
							originalParam: param,
							isParentObject: true
						});

						// Then add each property as individual parameters
						for (const property of rightSide.properties) {
							if ('Property' === property.type && 'Identifier' === property.key.type) {
								expanded.push({
									name: `${leftSide.name}.${property.key.name}`,
									type: 'AssignmentPattern',
									hasDefault: true,
									originalParam: param,
									property,
									parentName: leftSide.name
								});
							}
						}
					}
					// If left side is object destructuring with defaults
					else if ('ObjectPattern' === leftSide.type) {
						for (const property of leftSide.properties) {
							if ('Property' === property.type && 'Identifier' === property.key.type) {
								expanded.push({
									name: property.key.name,
									type: 'ObjectPattern',
									hasDefault: true,
									originalParam: param,
									property
								});
							}
						}
					}
					// Regular parameter with default (name = 'default')
					else if ('Identifier' === leftSide.type) {
						expanded.push({
							name: leftSide.name,
							type: 'AssignmentPattern',
							hasDefault: true,
							originalParam: param
						});
					}
				}
			}

			return expanded;
		};

		/**
		 * Analyzes array elements to determine the unified type.
		 *
		 * @param {ASTNode[]} elements - Array of elements from ArrayExpression.
		 * @returns {string}
		 */
		const analyzeArrayElements = (elements) => {
			if (0 === elements.length) return 'any[]';

			const types       = elements.map((element) => {
				if ('Literal' === element.type) {
					if (null === element.value) return 'null';
					return typeof element.value;
				}
				if ('ArrayExpression' === element.type) return 'Array';
				if ('ObjectExpression' === element.type) return 'object';
				if ('Identifier' === element.type) return element.name;
				if ('FunctionExpression' === element.type || 'ArrowFunctionExpression' === element.type) return 'function';
				return 'any';
			});

			const uniqueTypes = [...new Set(types)];

			if (1 === uniqueTypes.length) {
				return `${uniqueTypes[0]}[]`;
			}

			return 'any[]';
		};

		/**
		 * Get a formatted default value string from an AST node.
		 *
		 * @param {ASTNode} node - The default value node.
		 * @returns {string}
		 */
		const getFormattedDefaultValue = (node) => {
			if (!node) return 'undefined';

			if ('Literal' === node.type) {
				if ('string' === typeof node.value) return `'${node.value}'`;
				if (null === node.value) return 'null';
				return String(node.value);
			}
			if ('Identifier' === node.type) return node.name;
			if ('ArrayExpression' === node.type) {
				if (0 === node.elements.length) return '[]';
				return '[...]';
			}
			if ('ObjectExpression' === node.type) {
				if (0 === node.properties.length) return '{}';
				return '{...}';
			}
			if ('UnaryExpression' === node.type && '-' === node.operator) {
				const argValue = getFormattedDefaultValue(node.argument);
				return `-${argValue}`;
			}
			if ('FunctionExpression' === node.type || 'ArrowFunctionExpression' === node.type) {
				return 'function';
			}

			return 'undefined';
		};

		/**
		 * Returns the type of a default value node.
		 *
		 * @param {ASTNode} node - The right side of a parameter default value.
		 * @returns {string}
		 */
		const getDefaultValueType = (node) => {
			if (!node) return 'undefined';

			if ('ArrayExpression' === node.type) {
				return analyzeArrayElements(node.elements);
			}
			if ('ObjectExpression' === node.type) return 'object';
			if ('Literal' === node.type) {
				if (null === node.value) return 'null';
				return typeof node.value;
			}
			if ('Identifier' === node.type) return node.name;
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
				const realIsOptional = Boolean(realParam?.hasDefault);

				if (!type) {
					context.report({
						loc: getDocLoc(sourceCode, docblock, `@param`),
						message: `@param must include a type.`
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

				const expectedName = realParam?.name;

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

				let expectedType;
				let validationMessage;

				if (realIsOptional) {
					if ('AssignmentPattern' === realParam.type && realParam.property) {
						expectedType = getDefaultValueType(realParam.property.value);
					}
					else if (realParam.isParentObject) {
						expectedType = 'object';
					}
					else if (realParam.originalParam?.right) {
						expectedType = getDefaultValueType(realParam.originalParam.right);
					}
					else {
						expectedType = 'any';
					}
				}
				else {
					expectedType = normalizeTypes(type);

					if ('array' === type.toLowerCase()) {
						validationMessage = `Use "TYPE[]" instead of "array". Consider "any[]" if the content type is unknown.`;
					}
					else if (type.includes('Array<') && !type.includes('|') && !type.includes('<', type.indexOf('<') + 1)) {
						validationMessage = `Use "TYPE[]" instead of "Array<TYPE>" for simple types.`;
					}
				}

				if (expectedType !== type) {
					context.report({
						loc: getDocLoc(sourceCode, docblock, `@param {${type}} ${name}`),
						message: validationMessage || `@param type is "${type}" but should be "${expectedType}".`,
						fix: (fixer) => {
							const fixed = docblock.value.replace(`@param {${type}}`, `@param {${expectedType}}`);
							return fixer.replaceText(docblock, `/*${fixed}*/`);
						}
					});
					type = expectedType;
					return;
				}

				if (docIsOptional) {
					context.report({
						loc: getDocLoc(sourceCode, docblock, `@param {${type}} ${name}`),
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

				if (realIsOptional) {
					// Get the default value for validation
					let defaultValue;
					if ('AssignmentPattern' === realParam.type && realParam.property) {
						defaultValue = getFormattedDefaultValue(realParam.property.value);
					}
					else if (realParam.originalParam?.right) {
						defaultValue = getFormattedDefaultValue(realParam.originalParam.right);
					}
					else {
						defaultValue = 'undefined';
					}

					// Expected pattern: "- Optional. [description]. Default: [value]."
					const expectedPattern = new RegExp(
						`^- Optional\\. .+\\. Default: ${defaultValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.$`
					);

					if (!expectedPattern.test(description)) {
						context.report({
							loc: getDocLoc(sourceCode, docblock, `@param {${type}} ${name} ${description}`),
							message: `@param description must follow format: "- Optional. [description]. Default: ${defaultValue}."`,
							fix: (fixer) => {
								// Clean the description step by step
								let cleanDesc = description.replace(/^[-\s]+/, ''); // Remove dash
								cleanDesc = cleanDesc.replace(/^Optional\.\s*/, ''); // Remove Optional
								cleanDesc = cleanDesc.replace(/(\.\s*Default:[^.]*\.?)+/g, ''); // Remove all Default: parts
								cleanDesc = cleanDesc.replace(/\.+$/, ''); // Remove trailing dots
								cleanDesc = cleanDesc.trim();

								const fixed = docblock.value.replace(
									description,
									`- Optional. ${cleanDesc}. Default: ${defaultValue}.`
								);
								return fixer.replaceText(docblock, `/*${fixed}*/`);
							}
						});
						return;
					}
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

				if (100 < description.length) {
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

		return {
			MethodDefinition: validate,
			ArrowFunctionExpression: validate,
			ExportNamedDeclaration: validateExport,
			ExportDefaultDeclaration: validateExport
		};
	}
};

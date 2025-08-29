// Dependencies
import { getDocblockData, normalizeTypes, getTagRange } from '../utils.mjs';

// Export Rule
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
		/**
		 * Retrieves the parameters for a given node, expanding object destructuring.
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
				return expandNodeParams(node.params || []);
			}

			if ('MethodDefinition' === node.type) {
				return expandNodeParams(node.value?.params || []);
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

			if (node.params) return expandNodeParams(node.params);

			return [];
		};

		/**
		 * Expands object patterns and assignment patterns into individual parameters.
		 *
		 * @param {ASTNode[]} params - The raw parameters from the AST.
		 * @returns {object[]}
		 */
		const expandNodeParams = (params) => {
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

			const types = elements.map((element) => {
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
		 * Retrieves the default value from a real parameter.
		 *
		 * @param {ASTNode} realParam - The real parameter from AST.
		 * @returns {string}
		 */
		const getDefaultValue = (realParam) => {
			if ('AssignmentPattern' === realParam.type && realParam.property) {
				return getFormattedDefaultValue(realParam.property.value);
			}
			else if (realParam.originalParam?.right) {
				return getFormattedDefaultValue(realParam.originalParam.right);
			}

			return 'undefined';
		};

		/**
		 * Retrieves the expected type for a parameter.
		 *
		 * @param {string}  type           - The current documented type.
		 * @param {ASTNode} realParam      - The real parameter from AST.
		 * @param {boolean} realIsOptional - Whether the real parameter is optional.
		 * @returns {{ expectedType:string, validationMessage:string }}
		 */
		const getExpectedType = (type, realParam, realIsOptional) => {
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

			return { expectedType, validationMessage };
		};

		/**
		 * Get the aligned parameters from the tags.
		 *
		 * @param {object[]} tags - The tags to get the aligned parameters from.
		 * @returns {object[]}
		 */
		const getAlignedParams = (tags) => {
			const mapped = tags.map((tag) => {
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
		 * @param {ASTNode} docblock - The docblock to get the unaligned parameters from.
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
		 * @param {object[]} alignedParams - The aligned parameter lines.
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
			const docData = getDocblockData(context, node);
			if (!docData) return;
			const { docblock, data, loc } = docData;

			// Extract tags and real params
			const tags       = data.tags ?? [];
			const paramTags  = tags.filter((tag) => 'param' === tag.tag);
			const realParams = getNodeParams(node);

			// Report missing @param tags
			if (0 === realParams.length && 0 < paramTags.length) {
				context.report({
					loc: docblock.loc,
					message: 'Declaration has no parameters but @param tags are present in docblock.'
				});
				return;
			}

			// Report unnecessary @param tags
			if (0 < realParams.length && 0 === paramTags.length) {
				context.report({
					loc: docblock.loc,
					message: 'Declaration has parameters but no @param tags in the docblock.'
				});
				return;
			}

			// Report mismatch in number of params vs tags
			if (realParams.length !== paramTags.length) {
				context.report({
					loc: docblock.loc,
					message: 'Number of parameters in declaration does not match number of @param tags in docblock.'
				});
				return;
			}

			// Iterate over @param tags
			const hasErrors = paramTags.some((paramTag, index) => {
				const {
					type,
					name,
					description,
					optional: docIsOptional,
					source: [source]
				} = paramTag;
				const occurrence     = index + 1;
				const realParam      = realParams[index];
				const realIsOptional = Boolean(realParam?.hasDefault);

				// Report missing @param type
				if (!type) {
					context.report({
						loc: loc('@param', occurrence),
						message: `@param must include a type.`
					});
					return true;
				}

				// Report missing @param name
				if (!name) {
					context.report({
						loc: loc('@param', occurrence),
						message: `@param must include a name.`
					});
					return true;
				}

				const expectedName = realParam?.name;

				// Report mismatch @param name
				if (expectedName !== name) {
					context.report({
						loc: loc('@param', occurrence),
						message: `@param "${name}" does not match declaration parameter "${expectedName}".`,
						fix: (fixer) => {
							const range = getTagRange(docblock, source);
							const fixed = source.source.replace(`{${type}} ${name}`, `{${type}} ${expectedName}`);
							return fixer.replaceTextRange(range, fixed);
						}
					});
					return true;
				}

				const { expectedType, validationMessage } = getExpectedType(type, realParam, realIsOptional);

				// Report mismatch @param type
				if (expectedType !== type) {
					context.report({
						loc: loc('@param', occurrence),
						message: validationMessage || `@param type is "${type}" but should be "${expectedType}".`,
						fix: (fixer) => {
							const range = getTagRange(docblock, source);
							const fixed = source.source.replace(`{${type}}`, `{${expectedType}}`);
							return fixer.replaceTextRange(range, fixed);
						}
					});
					return true;
				}

				// Report unnecessary @param tag default
				if (docIsOptional) {
					context.report({
						loc: loc('@param', occurrence),
						message: `@param should not be documented as optional with a default value. Only use the parameter name "${name}", without brackets or default assignment.`
					});
					return true;
				}

				// Report missing @param description
				if (!description) {
					context.report({
						loc: loc('@param', occurrence),
						message: `@param must include a description.`
					});
					return true;
				}

				// Report @param description not starting with a dash
				if (!description.startsWith('-')) {
					context.report({
						loc: loc('@param', occurrence),
						message: `@param description must start with a dash.`,
						fix: (fixer) => {
							const range = getTagRange(docblock, source);
							const fixed = source.source.replace(description, `- ${description}`);
							return fixer.replaceTextRange(range, fixed);
						}
					});
					return true;
				}

				// Report @param description optional issues
				if (realIsOptional) {
					const defaultValue = getDefaultValue(realParam);
					const expectedPattern = new RegExp(
						`^- Optional\\. .+\\. Default: ${defaultValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.$`
					);

					if (!expectedPattern.test(description)) {
						context.report({
							loc: loc('@param', occurrence),
							message: `@param description must follow format: "- Optional. [description]. Default: ${defaultValue}."`,
							fix: (fixer) => {
								let cleanDesc = description.replace(/^[-\s]+/, ''); // Remove dash
								cleanDesc = cleanDesc.replace(/^Optional\.\s*/, ''); // Remove Optional
								cleanDesc = cleanDesc.replace(/(\.\s*Default:[^.]*\.?)+/g, ''); // Remove all Default: parts
								cleanDesc = cleanDesc.replace(/\.+$/, ''); // Remove trailing dots
								cleanDesc = cleanDesc.trim();

								const range = getTagRange(docblock, source);
								const fixed = source.source.replace(description, `- Optional. ${cleanDesc}. Default: ${defaultValue}.`);
								return fixer.replaceTextRange(range, fixed);
							}
						});
						return true;
					}
				}

				// Report @param description not ending with a period
				if (!description.endsWith('.')) {
					context.report({
						loc: loc('@param', occurrence),
						message: `@param description must end with a period.`,
						fix: (fixer) => {
							const range = getTagRange(docblock, source);
							const fixed = source.source.replace(description, `${description}.`);
							return fixer.replaceTextRange(range, fixed);
						}
					});
					return true;
				}

				// Report excessive @param description length
				if (100 < description.length) {
					context.report({
						loc: loc('@param', occurrence),
						message: '@param description must not exceed 100 characters.'
					});
					return true;
				}

				return false;
			});

			// Early return if there are errors
			if (hasErrors) return;

			const aligned    = getAlignedParams(paramTags);
			const unaligned  = getUnalignedParams(docblock);
			const areAligned = aligned.every((line, i) => line === unaligned[i]) && aligned.length === unaligned.length;

			// Report misaligned @param tags
			if (!areAligned) {
				context.report({
					loc: docblock.loc,
					message: '@param tags must be aligned consistently.',
					fix: (fixer) => {
						const fixed = replaceParamLines(docblock.value, aligned);
						return fixer.replaceText(docblock, `/*${fixed}*/`);
					}
				});
			}
		};

		return {
			FunctionExpression: validate,
			ArrowFunctionExpression: validate
		};
	}
};

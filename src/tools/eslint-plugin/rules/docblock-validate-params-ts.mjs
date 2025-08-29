// Dependencies
import { getDocblockData, getTagRange } from '../utils.mjs';

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
		 * Get the name of a specific parameter.
		 *
		 * @param {ASTNode} param - The parameter to get the name from.
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
				const occurrence = index + 1;
				const realParam  = realParams[index];

				// Report @param type presence
				if (type) {
					context.report({
						loc: loc('@param', occurrence),
						message: `@param must not include a type.`
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

				const expectedName = getParamName(realParam);

				// Report mismatch @param name
				if (expectedName !== name) {
					context.report({
						loc: loc('@param', occurrence),
						message: `@param name "${name}" does not match declaration parameter "${expectedName}".`,
						fix: (fixer) => {
							const range = getTagRange(docblock, source);
							const fixed = source.source.replace(`@param ${name}`, `@param ${expectedName}`);
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

			if (!areAligned) {
				context.report({
					loc: docblock.loc,
					message: `@param tags must be aligned consistently.`,
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

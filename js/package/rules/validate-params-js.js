import { parse } from 'comment-parser';
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
		const getDocblock = (node) => {
			const before = sourceCode.getCommentsBefore(node);

			let docblock = before.reverse().find((c) => c.type === 'Block' && c.value.trim().startsWith('*'));
			if (docblock) return docblock;

			if (node.parent?.type === 'VariableDeclarator') {
				const decl = node.parent.parent;
				const beforeDecl = sourceCode.getCommentsBefore(decl);
				docblock = beforeDecl.reverse().find((c) => c.type === 'Block' && c.value.trim().startsWith('*'));
				if (docblock) return docblock;
			}

			if (node.parent?.type === 'Property') {
				const beforeProp = sourceCode.getCommentsBefore(node.parent);
				docblock = beforeProp.reverse().find((c) => c.type === 'Block' && c.value.trim().startsWith('*'));
				if (docblock) return docblock;
			}

			return null;
		};
		const getDocLoc = (docblock, identifier) => {
			const startOffset = docblock.value.indexOf(identifier);

			if (-1 === startOffset) {
				return docblock.loc;
			}

			const endOffset = startOffset + identifier.length;
			const startIndex = docblock.range[0] + 2 + startOffset;
			const endIndex = docblock.range[0] + 2 + endOffset;
			return {
				start: sourceCode.getLocFromIndex(startIndex),
				end: sourceCode.getLocFromIndex(endIndex)
			};
		};
		const getNodeParams = (node) => {
			if (node.type === 'MethodDefinition') {
				return node.value?.params || [];
			}

			return node.params || [];
		};
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
		const getValueType = (value) => {
			if ('string' === typeof value) return 'string';
			if ('number' === typeof value) return 'number';
			if ('boolean' === typeof value) return 'boolean';
			if ('function' === typeof value) return 'function';
			if (Array.isArray(value)) {
				if (0 === value.length) return 'any[]';
				const first = value[0];
				const elementType = typeof first;
				return `${elementType}[]`;
			}
			if ('object' === typeof value) return 'object';
			if ('undefined' === typeof value) return 'void';
			if (null === value) return 'void';
			return 'any';
		};
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
		const getUnalignedParams = (docblock) => {
			return docblock.value
				.split('\n')
				.filter((line) => line.includes('@param'))
				.map((line) => line.trim().replace(/^\* ?/, ''));
		};
		const arraysMatch = (stringValue, actualValue) => {
			try {
				const parsed = JSON.parse(stringValue);

				if (!Array.isArray(parsed) || !Array.isArray(actualValue)) return false;

				if (parsed.length !== actualValue.length) return false;

				return parsed.every((val, i) => val === actualValue[i]);
			} catch (e) {
				return false;
			}
		};
		const replaceParamLines = (docText, alignedParams) => {
			const lines = docText.split('\n');
			const newLines = [];
			let inParams = false;

			const firstParamLine = lines.find((line) => line.includes('@param'));
			const indentMatch = firstParamLine?.match(/^([ \t]*)\*/);
			const indent = indentMatch ? indentMatch[1] : '';

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
		const validate = (node) => {
			const docblock = getDocblock(node);

			if (!docblock) return;

			const parsed = parse(`/*${docblock.value}*/`);

			if (!parsed) return;

			const tags = parsed[0]?.tags ?? [];
			const paramTags = tags.filter((tag) => tag.tag === 'param');
			const params = getNodeParams(node);

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
						loc: getDocLoc(docblock, `@param`),
						message: `@param must include a type.`
					});
					return;
				}

				if ('*' === type) {
					context.report({
						loc: getDocLoc(docblock, '@param {*}'),
						message: `Avoid using {*} as type, use {any} instead.`,
						fix: (fixer) => {
							const fixed = docblock.value.replace('{*}', '{any}');
							return fixer.replaceText(docblock, `/*${fixed}*/`);
						}
					});
					return;
				}

				const expectedType = type.toLowerCase();

				if (expectedType !== type) {
					context.report({
						loc: getDocLoc(docblock, `@param {${type}} ${name}`),
						message: `@param "${name}" type must be lowercase "${expectedType}".`,
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
						loc: getDocLoc(docblock, `@param`),
						message: `@param must include a name.`
					});
					return;
				}

				const realParam = params[index];
				const expectedName = realParam?.left?.name || realParam?.name || '';

				if (expectedName !== name) {
					context.report({
						loc: getDocLoc(docblock, `@param {${type}} ${name}`),
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
						loc: getDocLoc(docblock, `@param`),
						message: `@param "${name}" must include a description.`
					});
					return;
				}

				if (!description.startsWith('-')) {
					context.report({
						loc: getDocLoc(docblock, `@param {${type}} ${name}`),
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
						loc: getDocLoc(docblock, `@param {${type}} ${name}`),
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
						loc: getDocLoc(docblock, `@param {${type}} ${name}`),
						message: `@param "${name}" description must be at least 10 characters long.`
					});
					return;
				}

				if (80 < description.length) {
					context.report({
						loc: getDocLoc(docblock, `@param {${type}} ${name}`),
						message: `@param "${name}" description must not exceed 80 characters.`
					});
					return;
				}

				const isOptional = Boolean(realParam?.right);

				if (isOptional) {
					const expectedDefault = getParamValue(realParam.right);
					const expectedType = getValueType(expectedDefault);

					if (expectedType !== type) {
						context.report({
							loc: getDocLoc(docblock, `@param {${type}} ${name}`),
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
							loc: getDocLoc(docblock, `@param {${type}} ${name}`),
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
							loc: getDocLoc(docblock, `@param {${type}} ${name}`),
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

			const aligned = getAlignedParams(paramTags);
			const unaligned = getUnalignedParams(docblock);
			const areEqual = aligned.every((line, i) => line === unaligned[i]) && aligned.length === unaligned.length;

			if (!areEqual) {
				context.report({
					loc: getDocLoc(docblock, '@param'),
					message: `@param tags must be aligned consistently.`,
					fix: (fixer) => {
						const fixed = replaceParamLines(docblock.value, aligned);
						return fixer.replaceText(docblock, `/*${fixed}*/`);
					}
				});
			}
		};
		return {
			MethodDefinition: validate,
			ArrowFunctionExpression: validate
		};
	}
};

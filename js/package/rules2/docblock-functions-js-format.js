import { parse } from 'comment-parser';

export default {
	meta: {
		type: 'problem',
		docs: {
			description: 'Ensure docblock has frakto standards',
			category: 'Best Practices',
			recommended: true,
		},
		fixable: 'code',
		schema: [],
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

		const getParams = (node) => {
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

		const hasTryCatch = (node) => {
			if (!node.body) return false;

			const traverse = (statements) => {
				if (!statements) return false;

				for (const stmt of statements) {
					if (stmt.type === 'TryStatement') {
						return true;
					} else if (stmt.type === 'IfStatement') {
						if (traverse([stmt.consequent])) return true;
						if (stmt.alternate && traverse([stmt.alternate])) return true;
					} else if (stmt.type === 'BlockStatement') {
						if (traverse(stmt.body)) return true;
					} else if (stmt.type === 'SwitchStatement') {
						for (const caseNode of stmt.cases) {
							if (traverse(caseNode.consequent)) return true;
						}
					} else if (stmt.type === 'WhileStatement' || stmt.type === 'DoWhileStatement') {
						if (traverse([stmt.body])) return true;
					} else if (stmt.type === 'ForStatement' || stmt.type === 'ForInStatement' || stmt.type === 'ForOfStatement') {
						if (traverse([stmt.body])) return true;
					}
				}

				return false;
			};

			if (node.body.type === 'BlockStatement') {
				return traverse(node.body.body);
			}

			return false;
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
				end: sourceCode.getLocFromIndex(endIndex),
			};
		};

		const getFormattedParams = (tags) => {
			const mapped = tags.map((tag) => {
				const nameFormatted = tag.optional ? `[${tag.name}${tag.default ? `=${tag.default}` : ''}]` : tag.name;

				return {
					type: `{${tag.type}}`,
					name: nameFormatted,
					desc: tag.description.trim().replace(/^-/, '').trim(),
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

		const getUnformattedParams = (docblock) => {
			return docblock.value
				.split('\n')
				.filter((line) => line.includes('@param'))
				.map((line) => line.trim().replace(/^\* ?/, ''));
		};

		const areLinesEqual = (formatted, unformatted) => {
			return formatted.every((line, i) => line === unformatted[i]) && formatted.length === unformatted.length;
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

			for (const line of lines) {
				if (line.includes('@param')) {
					if (!inParams) {
						newLines.push(...alignedParams.map((param) => ` * ${param}`));
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

		const validateDescription = (description, docblock) => {
			if (!description || 0 === description.length) {
				context.report({
					loc: {
						start: {
							line: docblock.loc.start.line + 1,
							column: docblock.loc.start.column + 1,
						},
						end: {
							line: docblock.loc.start.line + 1,
							column: docblock.loc.start.column + 2,
						},
					},
					message: 'Docblock must have a description.',
				});

				return;
			}

			const loc = getDocLoc(docblock, description);

			if (!description.endsWith('.')) {
				context.report({
					loc,
					message: 'Docblock description must end with a period.',
					fix: (fixer) => {
						return fixer.insertTextAfterRange([startIndex, endIndex], '.');
					},
				});
				return;
			}

			if (20 > description.length) {
				context.report({
					loc: loc,
					message: 'Docblock description must be at least 20 characters long.',
				});
				return;
			}

			if (200 < description.length) {
				context.report({
					loc: loc,
					message: 'Docblock description must not exceed 200 characters.',
				});
			}
		};

		const validateParams = (node, tags, docblock) => {
			const params = getParams(node);

			if (0 === params.length && 0 < tags.length) {
				context.report({
					loc: docblock.loc,
					message: 'Declaration has no parameters but @param tags are present in docblock.',
				});
				return;
			}

			if (0 < params.length && 0 === tags.length) {
				context.report({
					loc: docblock.loc,
					message: 'Declaration has parameters but no @param tags in the docblock.',
				});
				return;
			}

			if (params.length !== tags.length) {
				context.report({
					loc: docblock.loc,
					message: 'Number of parameters in declaration does not match number of @param tags in docblock.',
				});
				return;
			}

			tags.forEach((tag, index) => {
				let { type, name, optional, default: def, description } = tag;

				if (!type) {
					context.report({
						loc: getDocLoc(docblock, `@param`),
						message: `@param must include a type.`,
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
						},
					});
					return;
				}

				if (!name) {
					context.report({
						loc: getDocLoc(docblock, `@param`),
						message: `@param must include a name.`,
					});
					return;
				}

				if (!description) {
					context.report({
						loc: getDocLoc(docblock, `@param`),
						message: `@param "${name}" must include a description.`,
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
						},
					});
					type = expectedType;
					return;
				}

				if (!description.startsWith('-')) {
					context.report({
						loc: getDocLoc(docblock, `@param {${type}} ${name}`),
						message: `@param "${name}" description must start with a dash.`,
						fix: (fixer) => {
							const fixed = docblock.value.replace(description, `- ${description}`);
							return fixer.replaceText(docblock, `/*${fixed}*/`);
						},
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
						},
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
						},
					});
					name = expectedName;
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
							},
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
									`@param {${type}} [${name}=${expectedDefault}]`,
								);
								return fixer.replaceText(docblock, `/*${fixed}*/`);
							},
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
									`@param {${type}} [${name}=[${expectedDefault}]]`,
								);
								return fixer.replaceText(docblock, `/*${fixed}*/`);
							},
						});
					}
				}
			});
		};

		const validateParamsAlign = (tags, docblock) => {
			const formatted = getFormattedParams(tags);
			const unformatted = getUnformattedParams(docblock);

			if (!areLinesEqual(formatted, unformatted)) {
				context.report({
					loc: getDocLoc(docblock, '@param'),
					message: `@param tags must be aligned consistently.`,
					fix: (fixer) => {
						const fixed = replaceParamLines(docblock.value, formatted);
						fixer.replaceText(docblock, `/*${fixed}*/`);
					},
				});
			}
		};

		const validateReturns = (tag, docblock) => {
			if (!tag) {
				context.report({
					loc: docblock.loc,
					message: 'Declaration must have a return type even if it is void.',
				});
				return;
			}

			let { tag: label, type, description } = tag;

			if (label === 'return') {
				context.report({
					loc: getDocLoc(docblock, '@return'),
					message: `Use "@returns" instead of "@return".`,
					fix: (fixer) => {
						const fixed = docblock.value.replace('@return', '@returns');
						return fixer.replaceText(docblock, `/*${fixed}*/`);
					},
				});
				return;
			}

			if (!type) {
				context.report({
					loc: getDocLoc(docblock, '@returns'),
					message: `@returns must include a type.`,
				});
				return;
			}

			if (description) {
				context.report({
					loc: getDocLoc(docblock, `@returns {${type}}`),
					message: `@returns must not include a description.`,
					fix: (fixer) => {
						const fixed = docblock.value.replace(`@returns {${type}} - ${description}`, `@returns {${type}}`);
						return fixer.replaceText(docblock, `/*${fixed}*/`);
					},
				});
				return;
			}

			const expectedType = type.toLowerCase();
			if (expectedType !== type) {
				context.report({
					loc: getDocLoc(docblock, `@returns {${type}}`),
					message: `@returns type "${type}" must be lowercase "${expectedType}".`,
					fix: (fixer) => {
						const fixed = docblock.value.replace(`@returns {${type}}`, `@returns {${expectedType}}`);
						return fixer.replaceText(docblock, `/*${fixed}*/`);
					},
				});
				type = expectedType;
				return;
			}
		};

		const validateThrows = (node, tag, docblock) => {
			const hasTryStatement = hasTryCatch(node);
			if (hasTryStatement && !tag) {
				context.report({
					loc: docblock.loc,
					message: 'Declaration contains try-catch block but no @throws documentation.',
				});
				return;
			}

			if (!hasTryStatement && tag) {
				context.report({
					loc: getDocLoc(docblock, '@throws'),
					message: 'Declaration has @throws documentation but no try-catch block found.',
				});
				return;
			}

			if (!tag) return;

			let { tag: label, type, description } = tag;

			if (label === 'throw') {
				context.report({
					loc: getDocLoc(docblock, '@throw'),
					message: `Use "@throws" instead of "@throw".`,
					fix: (fixer) => {
						const fixed = docblock.value.replace('@throw', '@throws');
						return fixer.replaceText(docblock, `/*${fixed}*/`);
					},
				});
				return;
			}

			if (!type) {
				context.report({
					loc: getDocLoc(docblock, '@throws'),
					message: `@throws must include a type.`,
				});
				return;
			}

			if (!description) {
				context.report({
					loc: getDocLoc(docblock, `@throws`),
					message: `@throws must include a description.`,
				});
				return;
			}

			const expectedType = type.toLowerCase();
			if (expectedType !== type) {
				context.report({
					loc: getDocLoc(docblock, `@throws {${type}}`),
					message: `@throws type "${type}" must be lowercase "${expectedType}".`,
					fix: (fixer) => {
						const fixed = docblock.value.replace(`@throws {${type}}`, `@throws {${expectedType}}`);
						return fixer.replaceText(docblock, `/*${fixed}*/`);
					},
				});
				type = expectedType;
				return;
			}
		};

		const validateTagOrder = (description, tags, docblock) => {
			const expectedOrder = ['param', 'throws', 'returns'];
			const otherTags = tags.filter((tag) => !expectedOrder.includes(tag.tag));

			const orderedSections = [];

			if (description) {
				orderedSections.push('description');
			}

			const paramTags = tags.filter((tag) => tag.tag === 'param');
			if (paramTags.length > 0) {
				orderedSections.push('param');
			}

			const throwsTags = tags.filter((tag) => tag.tag === 'throws' || tag.tag === 'throw');
			if (throwsTags.length > 0) {
				orderedSections.push('throws');
			}

			for (const otherTag of otherTags) {
				if (!orderedSections.includes(otherTag.tag)) {
					orderedSections.push(otherTag.tag);
				}
			}

			const returnTags = tags.filter((tag) => tag.tag === 'returns' || tag.tag === 'return');
			if (returnTags.length > 0) {
				orderedSections.push('returns');
			}

			const docLines = docblock.value.split('\n');
			let currentSection = 'description';

			for (let i = 0; i < docLines.length; i++) {
				const line = docLines[i].trim();

				if (line.includes('@param')) {
					if (currentSection !== 'description' && currentSection !== 'param') {
						context.report({
							loc: {
								start: { line: docblock.loc.start.line + i + 1, column: 0 },
								end: { line: docblock.loc.start.line + i + 1, column: line.length },
							},
							message: '@param tags must come after description and before other tags.',
						});
						return;
					}
					currentSection = 'param';
				} else if (line.includes('@throws') || line.includes('@throw')) {
					if (currentSection === 'returns') {
						context.report({
							loc: {
								start: { line: docblock.loc.start.line + i + 1, column: 0 },
								end: { line: docblock.loc.start.line + i + 1, column: line.length },
							},
							message: '@throws tags must come before @returns.',
						});
						return;
					}
					if (currentSection === 'description') {
						currentSection = 'throws';
					}
				} else if (line.includes('@returns') || line.includes('@return')) {
					currentSection = 'returns';
				} else if (line.includes('@') && !line.includes('*/')) {
					if (currentSection === 'returns') {
						const tagMatch = line.match(/@(\w+)/);
						const tagName = tagMatch ? tagMatch[1] : 'unknown';
						context.report({
							loc: {
								start: { line: docblock.loc.start.line + i + 1, column: 0 },
								end: { line: docblock.loc.start.line + i + 1, column: line.length },
							},
							message: `@${tagName} tags must come before @returns.`,
						});
						return;
					}
				}
			}
		};

		const validateSpacing = (description, tags, docblock) => {
			const lines = docblock.value.split('\n');
			const paramTags = tags.filter((t) => t.tag === 'param');
			const firstTagIndex = lines.findIndex((line) => line.trim().startsWith('* @'));
			const hasLineAfterDescription = firstTagIndex > 0 && lines[firstTagIndex - 1]?.trim() === '*';

			if (!hasLineAfterDescription) {
				context.report({
					loc: getDocLoc(docblock, description),
					message: 'There must be a blank line after the description.',
				});
			}

			if (paramTags.length) {
				const paramLines = lines
					.map((line, index) => ({ line, index }))
					.filter(({ line }) => line.trim().startsWith('* @param'));

				for (let i = 0; i < paramLines.length - 1; i++) {
					const currentIndex = paramLines[i].index;
					const nextIndex = paramLines[i + 1].index;
					const hasBlankBetween = lines.slice(currentIndex + 1, nextIndex).some((l) => l.trim() === '*');

					if (hasBlankBetween) {
						context.report({
							loc: getDocLoc(docblock, '@param'),
							message: 'Do not add blank lines between @param tags.',
						});
						break;
					}
				}

				const lastParamIndex = paramLines[paramLines.length - 1].index;
				const nextLine = lines[lastParamIndex + 1]?.trim();

				if (nextLine !== '*') {
					context.report({
						loc: getDocLoc(docblock, '@param'),
						message: 'There must be a blank line after the last @param.',
					});
				}
			}

			let blankLineCount = 0;
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i].trim();

				if (line === '*') {
					blankLineCount++;
					if (blankLineCount > 1) {
						context.report({
							loc: {
								start: {
									line: docblock.loc.start.line + i,
									column: 0,
								},
								end: {
									line: docblock.loc.start.line + i,
									column: lines[i].length,
								},
							},
							message: 'Multiple consecutive blank lines are not allowed in docblocks.',
						});
						break;
					}
				} else {
					blankLineCount = 0;
				}
			}

			const getTagName = (line) => {
				const match = line.match(/@(\w+)/);
				return match ? match[1] : null;
			};
			const tagLines = lines
				.map((line, index) => ({ line, index }))
				.filter(({ line }) => line.trim().startsWith('* @'));

			for (let i = 0; i < tagLines.length - 1; i++) {
				const currentTag = getTagName(tagLines[i].line);
				const nextTag = getTagName(tagLines[i + 1].line);

				if (currentTag === 'param' && nextTag === 'param') continue;
				if (currentTag === 'param') continue;

				const hasBlank = lines.slice(tagLines[i].index + 1, tagLines[i + 1].index).some((l) => l.trim() === '*');
				if (hasBlank) {
					context.report({
						loc: {
							start: {
								line: docblock.loc.start.line + tagLines[i].index + 1,
								column: 0,
							},
							end: {
								line: docblock.loc.start.line + tagLines[i + 1].index,
								column: 0,
							},
						},
						message: 'Unexpected blank line between docblock tags.',
					});
					break;
				}
			}
		};

		const validateDocblock = (node) => {
			const docblock = getDocblock(node);

			if (!docblock) return;

			const parsed = parse(`/*${docblock.value}*/`);

			if (!parsed) return;

			const description = parsed[0]?.description?.trim() ?? '';
			const tags = parsed[0]?.tags ?? [];

			validateDescription(description, docblock);
			validateParams(
				node,
				tags.filter((tag) => tag.tag === 'param'),
				docblock,
			);
			validateParamsAlign(
				tags.filter((tag) => tag.tag === 'param'),
				docblock,
			);
			validateReturns(
				tags.find((tag) => tag.tag === 'return' || tag.tag === 'returns'),
				docblock,
			);
			validateThrows(
				node,
				tags.find((tag) => tag.tag === 'throw' || tag.tag === 'throws'),
				docblock,
			);
			validateTagOrder(description, tags, docblock);
			validateSpacing(description, tags, docblock);
		};

		return {
			MethodDefinition: validateDocblock,
			ArrowFunctionExpression: validateDocblock,
		};
	},
};

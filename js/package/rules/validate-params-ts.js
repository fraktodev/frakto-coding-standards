import { parse } from 'comment-parser';
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
		const getParamName = (param) => {
			if (param.type === 'TSParameterProperty') {
				return param.parameter?.name || param.parameter?.left?.name || '';
			}
			return param.left?.name || param.name || '';
		};
		const getAlignedParams = (tags) => {
			const mapped = tags.map((tag) => {
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
		const getUnalignedParams = (docblock) => {
			return docblock.value
				.split('\n')
				.filter((line) => line.includes('@param'))
				.map((line) => line.trim().replace(/^\* ?/, ''));
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
				let { type, name, description } = tag;

				if (type) {
					context.report({
						loc: getDocLoc(docblock, `@param`),
						message: `@param must not include a type.`
					});
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
				const expectedName = getParamName(realParam);

				if (expectedName !== name) {
					context.report({
						loc: getDocLoc(docblock, `@param ${name}`),
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
						loc: getDocLoc(docblock, `@param`),
						message: `@param "${name}" must include a description.`
					});
					return;
				}

				if (!description.startsWith('-')) {
					context.report({
						loc: getDocLoc(docblock, `@param ${name}`),
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
						loc: getDocLoc(docblock, `@param ${name}`),
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
						loc: getDocLoc(docblock, `@param ${name}`),
						message: `@param "${name}" description must be at least 10 characters long.`
					});
					return;
				}

				if (80 < description.length) {
					context.report({
						loc: getDocLoc(docblock, `@param ${name}`),
						message: `@param "${name}" description must not exceed 80 characters.`
					});
					return;
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

import { parse } from 'comment-parser';
export default {
	meta: {
		type: 'problem',
		docs: {
			description: 'Ensure docblock throws are valid.',
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
		const validate = (node) => {
			const docblock = getDocblock(node);

			if (!docblock) return;

			const parsed = parse(`/*${docblock.value}*/`);

			if (!parsed) return;

			const tags = parsed[0]?.tags ?? [];
			const throwsTag = tags.find((tag) => tag.tag === 'throw' || tag.tag === 'throws');
			const hasTryStatement = hasTryCatch(node);

			if (hasTryStatement && !throwsTag) {
				context.report({
					loc: docblock.loc,
					message: 'Declaration contains try-catch block but no @throws documentation.'
				});
				return;
			}

			if (!hasTryStatement && throwsTag) {
				context.report({
					loc: getDocLoc(docblock, '@throws'),
					message: 'Declaration has @throws documentation but no try-catch block found.'
				});
				return;
			}

			if (!throwsTag) return;

			let { tag: label, type, description } = throwsTag;

			if (label === 'throw') {
				context.report({
					loc: getDocLoc(docblock, '@throw'),
					message: `Use "@throws" instead of "@throw".`,
					fix: (fixer) => {
						const fixed = docblock.value.replace('@throw', '@throws');
						return fixer.replaceText(docblock, `/*${fixed}*/`);
					}
				});
				return;
			}

			if (!type) {
				context.report({
					loc: getDocLoc(docblock, '@throws'),
					message: `@throws must include a type.`
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
					}
				});
				type = expectedType;
				return;
			}

			if (!description) {
				context.report({
					loc: getDocLoc(docblock, `@throws {${type}}`),
					message: `@throws must include a description.`
				});
				return;
			}

			if (!description.endsWith('.')) {
				context.report({
					loc: getDocLoc(docblock, `@throws {${type}}`),
					message: '@throws description must end with a period.',
					fix: (fixer) => {
						const fixed = docblock.value.replace(description, `${description}.`);
						return fixer.replaceText(docblock, `/*${fixed}*/`);
					}
				});
				return;
			}

			if (10 > description.length) {
				context.report({
					loc: getDocLoc(docblock, `@throws {${type}}`),
					message: '@throws description must be at least 10 characters long.'
				});
				return;
			}

			if (80 < description.length) {
				context.report({
					loc: getDocLoc(docblock, `@throws {${type}}`),
					message: '@throws description must not exceed 80 characters.'
				});
				return;
			}
		};
		return {
			MethodDefinition: validate,
			ArrowFunctionExpression: validate
		};
	}
};

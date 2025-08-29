// Export Rule
export default {
	meta: {
		type: 'layout',
		docs: {
			description: 'Require control flow keywords (else, catch, finally) to be on separate lines',
			category: 'Stylistic Issues',
			recommended: true
		},
		fixable: 'whitespace',
		schema: []
	},
	create(context) {
		const sourceCode = context.sourceCode || context.getSourceCode();

		/**
		 * Checks if the "else" keyword is positioned correctly.
		 *
		 * @param {ASTNode} node - The if statement node.
		 * @returns {void}
		 */
		const checkElsePosition = (node) => {
			if (!node.alternate) return;

			const ifBlock     = node.consequent;
			const elseKeyword = sourceCode.getTokenBefore(node.alternate, (token) => 'else' === token.value);

			if (!elseKeyword) return;

			let closingBrace = null;
			if ('BlockStatement' === ifBlock.type) {
				closingBrace = sourceCode.getLastToken(ifBlock);
			}

			if (!closingBrace || '}' !== closingBrace.value) return;

			if (closingBrace.loc.end.line === elseKeyword.loc.start.line) {
				const ifToken       = sourceCode.getFirstToken(node);
				const ifLine        = sourceCode.getText().split('\n')[ifToken.loc.start.line - 1];
				const ifIndentation = ifLine.match(/^(\s*)/)[1];

				context.report({
					node: elseKeyword,
					loc: elseKeyword.loc,
					message: 'Expected "else" to be on a new line.',
					fix(fixer) {
						const replacement = `\n${ifIndentation}`;
						return fixer.replaceTextRange([closingBrace.range[1], elseKeyword.range[0]], replacement);
					}
				});
			}
		};

		/**
		 * Checks if the "catch" keyword is positioned correctly.
		 *
		 * @param {ASTNode} node - The try statement node.
		 * @returns {void}
		 */
		const checkTryCatchPosition = (node) => {
			if (node.handler) {
				const tryBlock     = node.block;

				const catchKeyword = sourceCode.getFirstToken(node.handler);

				if (catchKeyword && 'catch' === catchKeyword.value && 'BlockStatement' === tryBlock.type) {
					const closingBrace = sourceCode.getLastToken(tryBlock);

					if (closingBrace && '}' === closingBrace.value && closingBrace.loc.end.line === catchKeyword.loc.start.line) {
						const tryToken       = sourceCode.getFirstToken(node);
						const tryLine        = sourceCode.getText().split('\n')[tryToken.loc.start.line - 1];
						const tryIndentation = tryLine.match(/^(\s*)/)[1];

						context.report({
							node: catchKeyword,
							loc: catchKeyword.loc,
							message: 'Expected "catch" to be on a new line.',
							fix(fixer) {
								const replacement = `\n${tryIndentation}`;
								return fixer.replaceTextRange([closingBrace.range[1], catchKeyword.range[0]], replacement);
							}
						});
					}
				}
			}

			if (node.finalizer) {
				let previousBlock = node.handler ? node.handler.body : node.block;

				const finallyKeyword = sourceCode.getFirstToken(node.finalizer);

				if (finallyKeyword && 'finally' === finallyKeyword.value && 'BlockStatement' === previousBlock.type) {
					const closingBrace = sourceCode.getLastToken(previousBlock);

					if (
						closingBrace &&
						'}' === closingBrace.value &&
						closingBrace.loc.end.line === finallyKeyword.loc.start.line
					) {
						const tryToken       = sourceCode.getFirstToken(node);
						const tryLine        = sourceCode.getText().split('\n')[tryToken.loc.start.line - 1];
						const tryIndentation = tryLine.match(/^(\s*)/)[1];

						context.report({
							node: finallyKeyword,
							loc: finallyKeyword.loc,
							message: 'Expected "finally" to be on a new line.',
							fix(fixer) {
								const replacement = `\n${tryIndentation}`;
								return fixer.replaceTextRange([closingBrace.range[1], finallyKeyword.range[0]], replacement);
							}
						});
					}
				}
			}
		};

		return {
			IfStatement: checkElsePosition,
			TryStatement: checkTryCatchPosition
		};
	}
};

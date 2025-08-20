export default {
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Disallow block comments /* */ in favor of line comments //',
			category: 'Best Practices',
			recommended: true
		},
		fixable: 'code',
		schema: []
	},
	create(context) {
		const sourceCode = context.sourceCode || context.getSourceCode();

		return {
			// eslint-disable-next-line
			Program() {
				const comments = sourceCode.getAllComments();

				comments.forEach((comment) => {
					if ('Block' === comment.type) {
						const value = comment.value.trim();
						if (value.startsWith('*') || comment.value.startsWith('*')) {
							return;
						}

						const lines        = comment.value.split('\n');
						const isSingleLine = 1 === lines.length;

						if (isSingleLine) {
							context.report({
								node: comment,
								loc: comment.loc,
								message: 'Use line comment (//) instead of block comment (/* */).',
								fix(fixer) {
									const commentValue = comment.value.trim();
									return fixer.replaceText(comment, `// ${commentValue}`);
								}
							});
						}
						else {
							context.report({
								node: comment,
								loc: comment.loc,
								message: 'Use line comments (//) instead of block comment (/* */).',
								fix(fixer) {
									const lines          = comment.value.split('\n');
									const convertedLines = lines
										.map((line, index) => {
											const trimmedLine = line.trim();
											if (0 === index && index === lines.length - 1) {
												return `// ${trimmedLine}`;
											}
											else if (0 === index) {
												return `// ${trimmedLine}`;
											}
											else if (index === lines.length - 1) {
												return trimmedLine ? `// ${trimmedLine}` : '';
											}
											else {
												return `// ${trimmedLine}`;
											}
										})
										.filter((line) => '' !== line);

									return fixer.replaceText(comment, convertedLines.join('\n'));
								}
							});
						}
					}
				});
			}
		};
	}
};

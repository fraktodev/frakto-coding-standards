export default {
	meta: {
		type: 'layout',
		docs: {
			description: 'Align consecutive variable declarations (let, const)',
			category: 'Stylistic Issues',
			recommended: false
		},
		fixable: 'whitespace',
		schema: []
	},
	create(context) {
		const sourceCode      = context.sourceCode || context.getSourceCode();
		const processedGroups = new Set();

		return {
			// eslint-disable-next-line
			VariableDeclaration(node) {
				const declsWithInit = node.declarations.filter((decl) => decl.init);
				if (0 === declsWithInit.length) return;

				const parent = node.parent;
				if ('Program' !== parent.type && 'BlockStatement' !== parent.type) return;

				const siblings     = parent.body;
				const currentIndex = siblings.indexOf(node);
				const group        = [node];

				for (let i = currentIndex + 1; i < siblings.length; i++) {
					const nextNode = siblings[i];

					if ('VariableDeclaration' !== nextNode.type) break;

					// Only group declarations of the same kind (let, const, var)
					if (nextNode.kind !== node.kind) break;

					const lineGap = nextNode.loc.start.line - group[group.length - 1].loc.end.line;
					if (2 < lineGap) break;

					if (nextNode.declarations.some((decl) => decl.init)) {
						group.push(nextNode);
					}
				}

				if (2 > group.length) return;

				// Create a unique key for this group to avoid processing duplicates
				const groupKey = group.map((n) => n.range.join(',')).join('|');
				if (processedGroups.has(groupKey)) return;

				// Check if this group is a subset of any already processed group
				for (const processedKey of processedGroups) {
					const processedRanges = processedKey.split('|');
					const currentRanges   = groupKey.split('|');

					// If all current ranges are included in a processed group, skip
					if (currentRanges.every((range) => processedRanges.includes(range))) {
						return;
					}
				}

				processedGroups.add(groupKey);

				const allDeclarators = [];
				group.forEach((decl) => {
					decl.declarations.forEach((declarator) => {
						if (declarator.init) {
							allDeclarators.push(declarator);
						}
					});
				});

				let maxIdLength = 0;
				allDeclarators.forEach((declarator) => {
					const idText = sourceCode.getText(declarator.id);
					maxIdLength = Math.max(maxIdLength, idText.length);
				});

				allDeclarators.forEach((declarator) => {
					const idText      = sourceCode.getText(declarator.id);
					const equalsToken = sourceCode.getTokenAfter(declarator.id);

					if (equalsToken && '=' === equalsToken.value) {
						const idEnd         = declarator.id.range[1];
						const equalsStart   = equalsToken.range[0];
						const currentSpaces = equalsStart - idEnd;
						const neededSpaces  = maxIdLength - idText.length + 1;

						// Only report if the spaces are actually different and we need more than 0 spaces
						if (currentSpaces !== neededSpaces && 0 < neededSpaces) {
							context.report({
								node: declarator,
								loc: declarator.id.loc,
								message: 'Variable declarations should be aligned at the equals sign.',
								fix(fixer) {
									const spaces = ' '.repeat(Math.max(1, neededSpaces));
									return fixer.replaceTextRange([idEnd, equalsStart], spaces);
								}
							});
						}
					}
				});
			}
		};
	}
};

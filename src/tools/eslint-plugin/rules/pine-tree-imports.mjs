// Export Rule
export default {
	meta: {
		type: 'layout',
		docs: {
			description: 'Organize import statements in three pine-tree visual patterns.',
			category: 'Stylistic Issues',
			recommended: false
		},
		fixable: 'code',
		schema: []
	},
	create(context) {
		const sourceCode = context.sourceCode || context.getSourceCode();

		/**
		 * Get import statement text length for sorting.
		 *
		 * @param {ASTNode} node - Import declaration node.
		 * @returns {number}
		 */
		const getImportLength = (node) => {
			return sourceCode.getText(node).length;
		};

		/**
		 * Check if import has multiline specifiers.
		 *
		 * @param {ASTNode} node - Import declaration node.
		 * @returns {boolean}
		 */
		const isMultilineImport = (node) => {
			return node.loc.start.line !== node.loc.end.line;
		};

		/**
		 * Categorize imports into three groups.
		 *
		 * @param {ASTNode[]} imports - Array of import nodes.
		 * @returns {{
		 * 	defaultImports: Array<ASTNode>,
		 * 	namedImports: Array<ASTNode>,
		 * 	multilineImports: Array<ASTNode>
		 * }}
		 */
		const categorizeImports = (imports) => {
			const defaultImports   = [];
			const namedImports     = [];
			const multilineImports = [];

			imports.forEach((importNode) => {
				if (isMultilineImport(importNode)) {
					multilineImports.push(importNode);
				}
				else if (1 === importNode.specifiers.length && 'ImportDefaultSpecifier' === importNode.specifiers[0].type) {
					defaultImports.push(importNode);
				}
				else {
					namedImports.push(importNode);
				}
			});

			// Sort each group by length (pine tree pattern)
			defaultImports.sort((a, b) => getImportLength(a) - getImportLength(b));
			namedImports.sort((a, b) => getImportLength(a) - getImportLength(b));
			multilineImports.sort((a, b) => getImportLength(a) - getImportLength(b));

			return { defaultImports, namedImports, multilineImports };
		};

		/**
		 * Sort multiline import specifiers in pine tree pattern.
		 *
		 * @param {ASTNode} importNode - Import declaration node.
		 * @returns {string}
		 */
		const sortMultilineSpecifiers = (importNode) => {
			const source = importNode.source.raw;
			const specifiers = importNode.specifiers
				.filter((spec) => 'ImportSpecifier' === spec.type)
				.sort((a, b) => a.imported.name.length - b.imported.name.length);

			if (0 === specifiers.length) {
				return sourceCode.getText(importNode);
			}

			const specifierTexts = specifiers.map((spec) => {
				return spec.local.name !== spec.imported.name
					? `${spec.imported.name} as ${spec.local.name}`
					: spec.imported.name;
			});

			return `import {\n\t${specifierTexts.join(',\n\t')}\n} from ${source};`;
		};

		/**
		 * Check if imports need reordering.
		 *
		 * @param {ASTNode[]} imports - Array of import nodes.
		 * @returns {boolean}
		 */
		const needsReordering = (imports) => {
			const { defaultImports, namedImports, multilineImports } = categorizeImports(imports);
			const expectedOrder = [...defaultImports, ...namedImports, ...multilineImports];

			// Check if order is wrong
			if (!imports.every((importNode, index) => importNode === expectedOrder[index])) {
				return true;
			}

			// Check if spacing between groups is wrong
			const groups = [defaultImports, namedImports, multilineImports].filter((group) => 0 < group.length);

			for (let i = 1; i < groups.length; i++) {
				const prevGroupLast     = groups[i - 1][groups[i - 1].length - 1];
				const currentGroupFirst = groups[i][0];
				const lineGap           = currentGroupFirst.loc.start.line - prevGroupLast.loc.end.line;

				// Should have exactly 2 lines gap (1 blank line)
				if (2 !== lineGap) {
					return true;
				}
			}

			return false;
		};

		/**
		 * Generate fixed import text.
		 *
		 * @param {ASTNode[]} imports - Array of import nodes.
		 * @returns {string}
		 */
		const generateFixedImports = (imports) => {
			const { defaultImports, namedImports, multilineImports } = categorizeImports(imports);
			const blocks = [];

			// Pine 1: Default imports
			if (0 < defaultImports.length) {
				blocks.push(defaultImports.map((node) => sourceCode.getText(node)).join('\n'));
			}

			// Pine 2: Named imports (single line)
			if (0 < namedImports.length) {
				blocks.push(namedImports.map((node) => sourceCode.getText(node)).join('\n'));
			}

			// Pine 3: Multiline imports (with sorted specifiers)
			if (0 < multilineImports.length) {
				blocks.push(multilineImports.map((node) => sortMultilineSpecifiers(node)).join('\n\n'));
			}

			return blocks.join('\n\n');
		};

		/**
		 * Validate import statements.
		 *
		 * @param {ASTNode[]} node - The root AST node.
		 * @returns {void}
		 */
		const sortImports = (node) => {
			const imports = node.body.filter((stmt) => 'ImportDeclaration' === stmt.type);

			if (2 > imports.length) return;

			if (needsReordering(imports)) {
				context.report({
					node: imports[0],
					loc: {
						start: imports[0].loc.start,
						end: imports[imports.length - 1].loc.end
					},
					message:
						'Import statements should be organized in pine-tree pattern: default imports, named imports, then multiline imports.',
					fix: (fixer) => {
						const firstImport = imports[0];
						const lastImport  = imports[imports.length - 1];
						const range       = [firstImport.range[0], lastImport.range[1]];

						return fixer.replaceTextRange(range, generateFixedImports(imports));
					}
				});
			}
		};

		return {
			Program: sortImports
		};
	}
};

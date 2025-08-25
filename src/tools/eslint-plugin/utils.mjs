/**
 * Get the docblock for a given node.
 *
 * @param {SourceCode} sourceCode - The source code object.
 * @param {ASTNode}    node       - The node to get the docblock for.
 *
 * @returns {docblock|null}
 */
export const getDocblock = (sourceCode, node) => {
	const before = sourceCode.getCommentsBefore(node);

	let docblock = before.reverse().find((c) => 'Block' === c.type && c.value.trim().startsWith('*'));
	if (docblock) return docblock;

	if ('VariableDeclarator' === node.parent?.type) {
		const decl       = node.parent.parent;
		const beforeDecl = sourceCode.getCommentsBefore(decl);
		docblock = beforeDecl.reverse().find((c) => 'Block' === c.type && c.value.trim().startsWith('*'));
		if (docblock) return docblock;
	}

	if ('Property' === node.parent?.type) {
		const beforeProp = sourceCode.getCommentsBefore(node.parent);
		docblock = beforeProp.reverse().find((c) => 'Block' === c.type && c.value.trim().startsWith('*'));
		if (docblock) return docblock;
	}

	// Handle ExportNamedDeclaration and ExportDefaultDeclaration
	if ('ExportNamedDeclaration' === node.type || 'ExportDefaultDeclaration' === node.type) {
		// For export declarations, the docblock is before the export statement itself
		// This is already handled by the first getCommentsBefore(node) call above
		return null;
	}

	return null;
};

/**
 * Get the location of a specific identifier within a docblock.
 *
 * @param {SourceCode} sourceCode - The source code object.
 * @param {docblock}   docblock   - The docblock to search within.
 * @param {string}     identifier - The identifier to find.
 *
 * @returns {SourceLocation}
 */
export const getDocLoc = (sourceCode, docblock, identifier) => {
	const startOffset = docblock.value.indexOf(identifier);

	if (-1 === startOffset) {
		return docblock.loc;
	}

	const endOffset  = startOffset + identifier.length;
	const startIndex = docblock.range[0] + 2 + startOffset;
	const endIndex   = docblock.range[0] + 2 + endOffset;
	return {
		start: sourceCode.getLocFromIndex(startIndex),
		end: sourceCode.getLocFromIndex(endIndex)
	};
};

/**
 * Create an export validator function for docblock rules.
 *
 * @param {function} validateFn - The validation function to call for matching exports.
 *
 * @returns {function}
 */
export const createExportValidator = (validateFn) => {
	return (node) => {
		// Only validate exports that contain arrow functions
		if ('ExportNamedDeclaration' === node.type && node.declaration) {
			if ('VariableDeclaration' === node.declaration.type && node.declaration.declarations) {
				const hasArrowFunction = node.declaration.declarations.some(
					(declarator) => 'ArrowFunctionExpression' === declarator.init?.type
				);
				if (hasArrowFunction) {
					validateFn(node);
				}
			}
		}
		else if ('ExportDefaultDeclaration' === node.type) {
			if ('ArrowFunctionExpression' === node.declaration?.type) {
				validateFn(node);
			}
		}
	};
};

/**
 * Normalize types to their preferred alternatives.
 * Handles both common types (String -> string) and forbidden types (* -> any).
 *
 * @param {string} type - The type to normalize.
 *
 * @returns {string}
 */
export const normalizeTypes = (type) => {
	const lowerType = type.toLowerCase();

	// Handle forbidden types first
	if (['*', 'mixed'].includes(lowerType)) {
		return 'any';
	}

	if (['undefined', 'null'].includes(lowerType)) {
		return 'void';
	}

	// Handle common types with incorrect casing
	const commonTypes = {
		Error: 'error',
		String: 'string',
		Number: 'number',
		Boolean: 'boolean',
		Function: 'function',
		Array: 'array',
		Object: 'object',
		Void: 'void',
		Any: 'any'
	};

	return commonTypes[type] || type;
};

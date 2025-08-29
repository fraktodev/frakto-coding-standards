// Dependencies
import { parse } from 'comment-parser';

/**
 * Finds the docblock for a given node.
 *
 * @param {string}  sourceCode - The source code object.
 * @param {ASTNode} target     - The node to get the docblock for.
 * @returns {ASTNode|null}
 */
const findDocblock = (sourceCode, target) => {
	const before = sourceCode.getCommentsBefore(target);
	return before.reverse().find((comment) => 'Block' === comment.type && comment.value.trim().startsWith('*'));
};

/**
 * Retrieves the location of a specific identifier within a docblock.
 *
 * @param {string}  sourceCode - The source code object.
 * @param {ASTNode} docblock   - The docblock to search within.
 * @param {string}  identifier - The identifier to find.
 * @param {number}  occurrence - Optional. The occurrence to find. Default: 1.
 * @returns {SourceLocation}
 */
const getDocLoc = (sourceCode, docblock, identifier, occurrence = 1) => {
	let index = -1;

	// Find occurrence
	for (let i = 0; i < occurrence; i++) {
		index = docblock.value.indexOf(identifier, index + 1);
		if (-1 === index) return docblock.loc;
	}

	const endOffset  = index + identifier.length;
	const startIndex = docblock.range[0] + 2 + index;
	const endIndex   = docblock.range[0] + 2 + endOffset;
	return {
		start: sourceCode.getLocFromIndex(startIndex),
		end: sourceCode.getLocFromIndex(endIndex)
	};
};

/**
 * Retrieves the docblock for a given node.
 *
 * @param {string}  sourceCode - The source code object.
 * @param {ASTNode} node       - The node to get the docblock for.
 * @returns {ASTNode|null}
 */
export const getDocblock = (sourceCode, node) => {
	let currentNode = node;

	// Search for docblock by moving up the hierarchy
	while (currentNode) {
		const docblock = findDocblock(sourceCode, currentNode);
		if (docblock) return docblock;

		const parent = currentNode.parent;
		if (!parent || 'Program' === parent.type) break;

		const wrapperTypes = [
			'AssignmentExpression',
			'ExportDefaultDeclaration',
			'ExportNamedDeclaration',
			'MethodDefinition',
			'NewExpression',
			'Property',
			'PropertyDefinition',
			'ReturnStatement',
			'VariableDeclaration',
			'VariableDeclarator'
		];
		if (wrapperTypes.includes(parent.type)) currentNode = parent;
		else break;
	}

	return null;
};

/**
 * Retrieves docblock data object optimized for rules validation.
 *
 * @param {RuleContext} context - The rule context.
 * @param {ASTNode}     node    - The original node.
 * @returns {{docblock:ASTNode, data:object, loc:function}|null}
 */
export const getDocblockData = (context, node) => {
	const sourceCode = context.sourceCode || context.getSourceCode();
	const docblock   = getDocblock(sourceCode, node);

	if (!docblock) return null;

	const data = parse(`/*${docblock.value}*/`);
	if (!data) return null;

	/**
	 * Retrieves the location of a specific identifier within the docblock.
	 *
	 * @param {null}   identifier - Optional. The identifier to find. Default: null.
	 * @param {number} occurrence - Optional. The occurrence to find. Default: 1.
	 * @returns {SourceLocation}
	 */
	const loc = (identifier = null, occurrence = 1) => getDocLoc(sourceCode, docblock, identifier, occurrence);

	return { docblock, data: data[0], loc };
};

/**
 * Gets the range of a tag within a docblock for ESLint fixer.
 *
 * @param {ASTNode} docblock - The docblock AST node.
 * @param {object}  source   - The source object from comment-parser tag.
 * @returns {number[]}
 */
export const getTagRange = (docblock, source) => {
	const docblockText = docblock.value;
	const targetLine   = source.source;

	const startIndex   = docblockText.indexOf(targetLine);
	if (-1 === startIndex) return [docblock.range[0], docblock.range[1]];

	const start = docblock.range[0] + 2 + startIndex; // +2 for *
	const end   = start + targetLine.length;

	return [start, end];
};

/**
 * Checks if a comment is a docblock.
 *
 * @param {ASTNode} comment - The comment node.
 * @returns {boolean}
 */
export const isDocblock = (comment) => {
	return comment.value.trim().startsWith('*');
};

/**
 * Checks if comment looks like disabled code.
 *
 * @param {ASTNode} comment - The comment node.
 * @returns {boolean}
 */
export const isCodeLookALike = (comment) => {
	const codePatterns = [
		// Full declarations (not just isolated words)
		/\b(function\s+\w+\s*\(|const\s+\w+\s*=|let\s+\w+\s*=|var\s+\w+\s*=|class\s+\w+)/,
		// Complete control structures
		/\b(if\s*\(|for\s*\(|while\s*\()/,
		// Complete statements
		/\breturn\s+[^;]+;/,
		/\b(import|export)\s+/,
		/\btry\s*\{|\bcatch\s*\(/,
		// Comparison operators (keep)
		/[=]{2,3}|[!]{1,2}=/,
		// Arrow functions (keep)
		/=>/,
		// Function calls WITH assignment or statement
		/\w+\s*\([^)]*\)\s*[;{]/,
		// Statement terminators
		/[;}]\s*$/m
	];

	return codePatterns.some((pattern) => pattern.test(comment.value.trim()));
};

/**
 * Normalize types to their preferred alternatives.
 *
 * @param {string} type - The type to normalize.
 * @returns {string}
 */
export const normalizeTypes = (type) => {
	if (type.includes('|')) {
		const unionTypes = type.split('|').map((t) => t.trim());

		if (2 < unionTypes.length) {
			return 'any';
		}

		const normalizedUnion = unionTypes.map((t) => normalizeTypes(t));
		return normalizedUnion.join('|');
	}

	const lowerType = type.toLowerCase();

	if (['*', 'mixed'].includes(lowerType)) {
		return 'any';
	}

	if ('undefined' === lowerType) {
		return 'void';
	}

	// Handle array types - prefer TYPE[] format
	if ('array' === lowerType) {
		return 'any[]';
	}

	// Keep existing TYPE[] syntax as is
	if (type.includes('[]')) {
		const baseType       = type.replace('[]', '').trim();
		const normalizedBase = normalizeTypes(baseType);
		return `${normalizedBase}[]`;
	}

	// Convert Array<TYPE> to TYPE[] for all types
	const arrayMatch = type.match(/^Array<(.+)>$/);
	if (arrayMatch) {
		const innerType       = arrayMatch[1].trim();
		const normalizedInner = normalizeTypes(innerType);
		return `${normalizedInner}[]`;
	}

	const commonTypes = {
		// PascalCase
		date: 'Date',
		error: 'Error',
		promise: 'Promise',
		// lowercase
		any: 'any',
		void: 'void',
		number: 'number',
		string: 'string',
		object: 'object',
		boolean: 'boolean',
		function: 'function',
		functionCall: 'functionCall'
	};

	return commonTypes[lowerType] || type;
};

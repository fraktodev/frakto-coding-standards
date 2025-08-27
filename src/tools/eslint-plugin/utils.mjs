// Dependencies
import { parse } from 'comment-parser';

// Caches for docblock data
const docblockCaches = new WeakMap();

/**
 * Extract real declarations from wrapper nodes.
 *
 * @param {ASTNode} node - The node to normalize.
 * @returns {ASTNode|null}
 */
const normalizeNode = (node) => {
	// Handle ExportNamedDeclaration
	if ('ExportNamedDeclaration' === node.type) {
		if (node.declaration) {
			// Direct export: export class MyClass {}
			if (
				'ClassDeclaration' === node.declaration.type ||
				'FunctionExpression' === node.declaration.type ||
				'ArrowFunctionExpression' === node.declaration.type
			) {
				return node.declaration;
			}

			// Variable declaration: export const func = () => {} (single only due to one-var rule)
			if ('VariableDeclaration' === node.declaration.type) {
				const declarator = node.declaration.declarations[0];
				if (declarator?.init) {
					if ('FunctionExpression' === declarator.init.type || 'ArrowFunctionExpression' === declarator.init.type) {
						return declarator.init;
					}
				}
			}
		}
		return null;
	}

	// Handle ExportDefaultDeclaration
	if ('ExportDefaultDeclaration' === node.type) {
		if (
			'ClassDeclaration' === node.declaration?.type ||
			'FunctionExpression' === node.declaration?.type ||
			'ArrowFunctionExpression' === node.declaration?.type
		) {
			return node.declaration;
		}
		return null;
	}

	// Handle AssignmentExpression
	if ('AssignmentExpression' === node.type) {
		if ('FunctionExpression' === node.right?.type || 'ArrowFunctionExpression' === node.right?.type) {
			return node.right;
		}
		return null;
	}

	// Return original node for direct cases
	return node;
};

/**
 * Retrieves the docblock for a given node.
 * TODO: Remove export.
 *
 * @param {string}  sourceCode - The source code object.
 * @param {ASTNode} node       - The node to get the docblock for.
 * @returns {ASTNode|void}
 */
export const getDocblock = (sourceCode, node) => {
	const findDocblock = (target) => {
		const before = sourceCode.getCommentsBefore(target);
		return before.reverse().find((c) => 'Block' === c.type && c.value.trim().startsWith('*'));
	};

	// Try direct node first
	let docblock = findDocblock(node);
	if (docblock) return docblock;

	// Handle ExportNamedDeclaration and ExportDefaultDeclaration
	if ('ExportNamedDeclaration' === node.type || 'ExportDefaultDeclaration' === node.type) {
		docblock = findDocblock(node);
		if (docblock) return docblock;

		// If export has a declaration, don't look further - docblock should be on export
		return null;
	}

	// Handle AssignmentExpression (like prototype methods)
	if ('AssignmentExpression' === node.type) {
		docblock = findDocblock(node);
		if (docblock) return docblock;
		return null;
	}

	// Handle functions inside VariableDeclarator
	if ('VariableDeclarator' === node.parent?.type) {
		const decl = node.parent.parent; // VariableDeclaration
		docblock = findDocblock(decl);
		if (docblock) return docblock;

		// Check if VariableDeclaration is inside an export
		if ('ExportNamedDeclaration' === decl.parent?.type) {
			docblock = findDocblock(decl.parent);
			if (docblock) return docblock;
		}
	}

	// Handle functions inside Property (object methods)
	if ('Property' === node.parent?.type) {
		docblock = findDocblock(node.parent);
		if (docblock) return docblock;

		// Check if Property is in an object that's assigned or exported
		const property = node.parent;
		const object   = property.parent; // ObjectExpression

		if ('VariableDeclarator' === object.parent?.type) {
			const decl = object.parent.parent; // VariableDeclaration
			docblock = findDocblock(decl);
			if (docblock) return docblock;

			if ('ExportNamedDeclaration' === decl.parent?.type) {
				docblock = findDocblock(decl.parent);
				if (docblock) return docblock;
			}
		}

		if ('AssignmentExpression' === object.parent?.type) {
			docblock = findDocblock(object.parent);
			if (docblock) return docblock;
		}
	}

	return null;
};

/**
 * Retrieves the location of a specific identifier within a docblock.
 * TODO: Remove export.
 *
 * @param {string}  sourceCode - The source code object.
 * @param {ASTNode} docblock   - The docblock to search within.
 * @param {string}  identifier - The identifier to find.
 * @param {number}  occurrence - Optional. The occurrence to find. Default: 1.
 * @returns {SourceLocation}
 */
export const getDocLoc = (sourceCode, docblock, identifier, occurrence = 1) => {
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
 * Retrieves the node kind (class, method, or function).
 *
 * @param {ASTNode} node - The normalized node.
 * @returns {string}
 */
const getNodeKind = (node) => {
	if ('ClassDeclaration' === node.type) {
		return 'class';
	}

	if ('MethodDefinition' === node.type) {
		return 'method';
	}

	if ('FunctionExpression' === node.type || 'ArrowFunctionExpression' === node.type) {
		return 'function';
	}

	return 'unknown';
};

/**
 * Retrieves docblock data object optimized for rules validation.
 *
 * @param {RuleContext} context - The rule context.
 * @param {ASTNode}     node    - The original node.
 * @returns {{docblock:ASTNode, realNode:ASTNode, data:array, loc:function}|null}
 */
export const getDocblockData = (context, node) => {
	const sourceCode = context.sourceCode || context.getSourceCode();

	if (!docblockCaches.has(context)) {
		docblockCaches.set(context, new Set());
	}

	const cache    = docblockCaches.get(context);
	const docblock = getDocblock(sourceCode, node);

	if (!docblock) return null;

	const docblockKey = `${docblock.range[0]}-${docblock.range[1]}`;

	if (cache.has(docblockKey)) {
		return null;
	}

	cache.add(docblockKey);

	const data = parse(`/*${docblock.value}*/`);
	if (!data) return null;

	const realNode = normalizeNode(node);
	if (!realNode) return null;
	realNode.kind = getNodeKind(realNode);

	const loc = (identifier = null, occurrence = 1) => getDocLoc(sourceCode, docblock, identifier, occurrence);

	return { docblock, realNode, data, loc };
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

	const start = docblock.range[0] + 2 + startIndex; // +2 for /*
	const end   = start + targetLine.length;

	return [start, end];
};

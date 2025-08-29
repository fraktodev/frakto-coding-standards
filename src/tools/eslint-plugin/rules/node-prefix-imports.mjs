// Export Rule
export default {
	meta: {
		type: 'problem',
		docs: {
			description: 'Enforce node: prefix for Node.js built-in module imports.',
			category: 'Best Practices',
			recommended: true
		},
		fixable: 'code',
		schema: []
	},
	create(context) {
		/**
		 * Node.js built-in modules (including subpaths).
		 */
		const builtinModules = new Set([
			'assert',
			'assert/strict',
			'async_hooks',
			'buffer',
			'child_process',
			'cluster',
			'console',
			'constants',
			'crypto',
			'dgram',
			'diagnostics_channel',
			'dns',
			'dns/promises',
			'domain',
			'events',
			'fs',
			'fs/promises',
			'http',
			'http2',
			'https',
			'inspector',
			'inspector/promises',
			'module',
			'net',
			'os',
			'path',
			'path/posix',
			'path/win32',
			'perf_hooks',
			'process',
			'punycode',
			'querystring',
			'readline',
			'readline/promises',
			'repl',
			'stream',
			'stream/promises',
			'stream/web',
			'string_decoder',
			'sys',
			'timers',
			'timers/promises',
			'tls',
			'trace_events',
			'tty',
			'url',
			'util',
			'util/types',
			'v8',
			'vm',
			'wasi',
			'worker_threads',
			'zlib'
		]);

		/**
		 * Check if a module specifier is a Node.js built-in.
		 *
		 * @param {string} specifier - The import specifier.
		 * @returns {boolean}
		 */
		const isBuiltinModule = (specifier) => {
			// Remove node: prefix if present
			const cleanSpecifier = specifier.replace(/^node:/, '');
			return builtinModules.has(cleanSpecifier);
		};

		/**
		 * Check if import needs node: prefix.
		 *
		 * @param {string} specifier - The import specifier.
		 * @returns {boolean}
		 */
		const needsNodePrefix = (specifier) => {
			return isBuiltinModule(specifier) && !specifier.startsWith('node:');
		};

		/**
		 * Add node: prefix to specifier.
		 *
		 * @param {string} specifier - The import specifier.
		 * @returns {string}
		 */
		const addNodePrefix = (specifier) => {
			return `node:${specifier}`;
		};

		/**
		 * Validate import declaration.
		 *
		 * @param {ASTNode} node - The import declaration node.
		 * @returns {void}
		 */
		const validateImport = (node) => {
			const specifier = node.source.value;

			if (needsNodePrefix(specifier)) {
				context.report({
					node: node.source,
					loc: node.source.loc,
					message: `Node.js built-in module "${specifier}" should use "node:" prefix.`,
					fix: (fixer) => {
						const quote        = node.source.raw.charAt(0);
						const newSpecifier = `${quote}${addNodePrefix(specifier)}${quote}`;
						return fixer.replaceText(node.source, newSpecifier);
					}
				});
			}
		};

		return {
			ImportDeclaration: validateImport
		};
	}
};

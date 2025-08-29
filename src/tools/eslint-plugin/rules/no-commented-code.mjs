// Dependencies
import { isDocblock, isCodeLookALike } from '../utils.mjs';

// Export Rule
export default {
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Disallow commented-out code',
			category: 'Best Practices',
			recommended: true
		},
		fixable: 'code',
		schema: []
	},
	create(context) {
		const sourceCode = context.sourceCode || context.getSourceCode();

		/**
		 * Check for commented-out code comments and report them.
		 *
		 * @returns {void}
		 */
		const checkCommentedOutCode = () => {
			const comments = sourceCode.getAllComments();

			comments.forEach((comment) => {
				if ('Block' !== comment.type || isDocblock(comment)) {
					return;
				}

				// Report commented-out code comment
				if (isCodeLookALike(comment)) {
					context.report({
						node: comment,
						loc: comment.loc,
						message: 'Remove commented-out code instead of leaving it in the codebase.'
					});
					return;
				}
			});
		};

		return {
			Program: checkCommentedOutCode
		};
	}
};

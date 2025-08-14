<?php
/**
 * Frakto Coding Standard.
 *
 * @package FraktoCodingStandards
 * @license https://opensource.org/licenses/MIT MIT
 * @author  Frakto Team
 */

namespace Frakto\Sniffs\PHP;

use PHP_CodeSniffer\Sniffs\Sniff;
use PHP_CodeSniffer\Files\File;

/**
 * No emojis allowed in all code.
 */
class NoEmojisSniff implements Sniff {
	/**
	 * Registers the tokens this sniff listens for.
	 *
	 * @return array
	 */
	public function register() {
		return array(
			T_CONSTANT_ENCAPSED_STRING,
			T_DOUBLE_QUOTED_STRING,
			T_INLINE_HTML,
			T_COMMENT,
			T_DOC_COMMENT_STRING,
		);
	}

	/**
	 * Processes tokens and handle validations.
	 *
	 * @param File $phpcsFile The file being checked.
	 * @param int  $stackPtr  Token position.
	 *
	 * @return void
	 */
	public function process( $phpcsFile, $stackPtr ) {
		$tokens  = $phpcsFile->getTokens();
		$content = $tokens[ $stackPtr ][ 'content' ];

		// Detect emojis and non-ASCII characters.
		if ( preg_match( '/[\x{1F300}-\x{1F6FF}\x{1F900}-\x{1F9FF}\x{2600}-\x{26FF}]/u', $content ) ) {
			$fix = $phpcsFile->addFixableError(
				'Emojis are not allowed.',
				$stackPtr,
				'FoundEmoji'
			);

			if ( $fix ) {
				$phpcsFile->fixer->beginChangeset();
				// Removes all emojis from the content.
				$cleaned = preg_replace(
					'/[\x{1F300}-\x{1F6FF}\x{1F900}-\x{1F9FF}\x{2600}-\x{26FF}]/u',
					'',
					$content
				);
				$phpcsFile->fixer->replaceToken( $stackPtr, $cleaned );
				$phpcsFile->fixer->endChangeset();
			}
		}
	}
}

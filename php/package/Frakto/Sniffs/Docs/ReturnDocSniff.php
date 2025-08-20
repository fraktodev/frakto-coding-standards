<?php
/**
 * Frakto Coding Standard.
 *
 * @package FraktoCodingStandards
 * @license https://opensource.org/licenses/MIT MIT
 * @author  Frakto Team
 */

namespace Frakto\Sniffs\Docs;

use PHP_CodeSniffer\Sniffs\Sniff;
use PHP_CodeSniffer\Files\File;

/**
 * Enforces strict rules for @return docblock lines.
 * - Never should have a return type whit a description.
 */
class ReturnDocSniff implements Sniff {
	/**
	 * Registers the tokens this sniff listens for.
	 *
	 * @return array
	 */
	public function register() {
		return array( T_DOC_COMMENT_TAG );
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
		$tokens = $phpcsFile->getTokens();
		$token  = $tokens[ $stackPtr ];

		// Only process @return tags.
		if ( '@return' !== strtolower( $token[ 'content' ] ) ) {
			return;
		}

		// Find the associated string token for this @return.
		$next_string_ptr = $phpcsFile->findNext( T_DOC_COMMENT_STRING, ( $stackPtr + 1 ) );
		if ( false === $next_string_ptr ) {
			return;
		}

		$return_line = trim( $tokens[ $next_string_ptr ][ 'content' ] );

		// Split by spaces: first part is type, rest is description.
		$parts = preg_split( '/\s+/', $return_line, 2 );

		if ( 1 < count( $parts ) && '' !== $parts[ 1 ] ) {
			$phpcsFile->addError(
				'@return tag must not contain a description.',
				$next_string_ptr,
				'ReturnDescriptionNotAllowed'
			);
		}
	}
}

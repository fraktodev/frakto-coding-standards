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
 * Enforces that the closing PHP tag (?>) is not used in files containing only PHP.
 */
class ClosingTagSniff implements Sniff {
	/**
	 * Registers the tokens this sniff listens for.
	 *
	 * @return array
	 */
	public function register() {
		return array( T_CLOSE_TAG );
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
		$tokens          = $phpcsFile->getTokens();
		$has_inline_html = false;

		foreach ( $tokens as $token ) {
			if ( T_INLINE_HTML === $token[ 'code' ] && '' !== trim( $token[ 'content' ] ) ) {
				$has_inline_html = true;
				break;
			}
		}

		if ( ! $has_inline_html ) {
			$phpcsFile->addError(
				'The closing tag ?> must not be used in pure PHP files.',
				$stackPtr,
				'ClosingTagFound'
			);
		}
	}
}

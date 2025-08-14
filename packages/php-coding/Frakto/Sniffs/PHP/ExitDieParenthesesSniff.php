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
 * Enforces usage of exit() and die() with parentheses.
 */
class ExitDieParenthesesSniff implements Sniff {
	/**
	 * Registers the tokens this sniff listens for.
	 *
	 * @return array
	 */
	public function register() {
		return array( T_EXIT, T_STRING );
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
		$tokens     = $phpcsFile->getTokens();
		$next_index = $phpcsFile->findNext( array( T_WHITESPACE ), $stackPtr + 1, null, true );

		if ( false === $next_index || T_OPEN_PARENTHESIS !== $tokens[ $next_index ][ 'code' ] ) {
			$function = strtolower( $tokens[ $stackPtr ][ 'content' ] );

			if ( 'exit' === $function ) {
				$phpcsFile->addError(
					'Use exit() with parentheses, never exit without parentheses.',
					$stackPtr,
					'ExitWithoutParentheses'
				);
			} elseif ( 'die' === $function ) {
				$phpcsFile->addError(
					'Use die() with parentheses, never die without parentheses.',
					$stackPtr,
					'DieWithoutParentheses'
				);
			}
		}
	}
}

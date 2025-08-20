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
 * Enforces appropriate spacing around array keys.
 */
class ArrayKeySpacingSniff implements Sniff {
	/**
	 * Registers the tokens this sniff listens for.
	 *
	 * @return array
	 */
	public function register() {
		return array( T_OPEN_SQUARE_BRACKET );
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

		// Allow empty index: $foo[].
		$next_non_ws = $phpcsFile->findNext( array( T_WHITESPACE ), $stackPtr + 1, null, true );
		if ( false !== $next_non_ws && T_CLOSE_SQUARE_BRACKET === $tokens[ $next_non_ws ][ 'code' ] ) {
			return;
		}

		// Check space after opening bracket.
		$next_ptr = $stackPtr + 1;
		if ( T_WHITESPACE !== $tokens[ $next_ptr ][ 'code' ] || ' ' !== $tokens[ $next_ptr ][ 'content' ] ) {

			$fix = $phpcsFile->addFixableError(
				'There must be exactly 1 space after "[".',
				$stackPtr,
				'SpaceAfterOpenBracket'
			);

			if ( $fix ) {
				$phpcsFile->fixer->beginChangeset();
				// Remove existing space/tabs.
				if ( T_WHITESPACE === $tokens[ $next_ptr ][ 'code' ] ) {
					$phpcsFile->fixer->replaceToken( $next_ptr, ' ' );
				} else {
					$phpcsFile->fixer->addContent( $stackPtr, ' ' );
				}
				$phpcsFile->fixer->endChangeset();
			}
		}

		// Find closing bracket.
		$close_ptr = $tokens[ $stackPtr ][ 'bracket_closer' ];
		if ( null === $close_ptr ) {
			return;
		}

		// Check space before closing bracket.
		$prev_ptr = $close_ptr - 1;
		if ( T_WHITESPACE !== $tokens[ $prev_ptr ][ 'code' ] || ' ' !== $tokens[ $prev_ptr ][ 'content' ] ) {

			$fix = $phpcsFile->addFixableError(
				'There must be exactly 1 space before "]".',
				$close_ptr,
				'SpaceBeforeCloseBracket'
			);

			if ( $fix ) {
				$phpcsFile->fixer->beginChangeset();
				// Remove existing space/tabs.
				if ( T_WHITESPACE === $tokens[ $prev_ptr ][ 'code' ] ) {
					$phpcsFile->fixer->replaceToken( $prev_ptr, ' ' );
				} else {
					$phpcsFile->fixer->addContentBefore( $close_ptr, ' ' );
				}
				$phpcsFile->fixer->endChangeset();
			}
		}
	}
}

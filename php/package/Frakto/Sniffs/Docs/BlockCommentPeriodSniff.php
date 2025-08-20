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
 * Enforces that each descriptive line in docblocks ends with a period.
 */
class BlockCommentPeriodSniff implements Sniff {
	/**
	 * Flag to skip the next string token if it follows a tag.
	 *
	 * @var boolean
	 */
	private $skip_next_string = false;

	/**
	 * Registers the tokens this sniff listens for.
	 *
	 * @return array
	 */
	public function register() {
		return array( T_DOC_COMMENT_TAG, T_DOC_COMMENT_STRING );
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
		$code   = $tokens[ $stackPtr ][ 'code' ];

		// If it's a @tag, skip the next string (tag description).
		if ( T_DOC_COMMENT_TAG === $code ) {
			$this->skip_next_string = true;
			return;
		}

		// If coming from a tag, skip this string.
		if ( T_DOC_COMMENT_STRING !== $code ) {
			return;
		}

		// If coming from a tag, skip this string.
		if ( $this->skip_next_string ) {
			$this->skip_next_string = false;
			return;
		}

		// Look ahead for the next significant token within the docblock.
		$i          = $stackPtr + 1;
		$num_tokens = count( $tokens );
		while (
			$i < $num_tokens
			&& (
				T_DOC_COMMENT_WHITESPACE === $tokens[ $i ][ 'code' ]
				|| T_DOC_COMMENT_STAR === $tokens[ $i ][ 'code' ]
			)
		) {
			$i++;
		}

		// If the next significant token is another string -> it's a continuation, skip validation.
		if ( $i < $num_tokens && T_DOC_COMMENT_STRING === $tokens[ $i ][ 'code' ] ) {
			return;
		}

		// End of paragraph (next is tag/closer or no more tokens): enforce final period.
		$line = trim( $tokens[ $stackPtr ][ 'content' ] );
		if ( '' !== $line && '.' !== substr( $line, -1 ) ) {
			$phpcsFile->addError(
				'Docblock description lines must end with a period.',
				$stackPtr,
				'DocBlockNoPeriod'
			);
		}
	}
}

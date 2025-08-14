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
 * Enforces strict rules for @param docblock lines.
 * - Each parameter must be listed using @param, followed by its type and variable name.
 * - All lines must end with a period.
 * - If the parameter is optional:
 *   - The description must begin with Optional.
 *   - The line must end with Default: <value>.
 */
class ParamDescriptionSniff implements Sniff {
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

		// Only process @param tags.
		if ( '@param' !== strtolower( $token[ 'content' ] ) ) {
			return;
		}

		// Find the associated string token for this @param.
		$desc_ptr = $phpcsFile->findNext( T_DOC_COMMENT_STRING, ( $stackPtr + 1 ) );
		if ( false === $desc_ptr ) {
			return;
		}

		$param_line = trim( $tokens[ $desc_ptr ][ 'content' ] );
		$scan_ptr   = $desc_ptr;

		// Join adjacent strings that are part of the same @param (before the next TAG or closing tag).
		while ( true ) {
			$types    = array( T_DOC_COMMENT_WHITESPACE, T_DOC_COMMENT_STAR, T_DOC_COMMENT_STRING, T_DOC_COMMENT_TAG, T_DOC_COMMENT_CLOSE_TAG );
			$next_ptr = $phpcsFile->findNext( $types, $scan_ptr + 1, null, false, null, true );
			if ( false === $next_ptr ) {
				break;
			}
			$code = $tokens[ $next_ptr ][ 'code' ];

			if ( T_DOC_COMMENT_STRING === $code ) {
				$param_line .= ' ' . trim( $tokens[ $next_ptr ][ 'content' ] );
				$scan_ptr    = $next_ptr;
				continue;
			}
			// If a TAG or docblock close is reached, stop this @param.
			if ( T_DOC_COMMENT_TAG === $code || T_DOC_COMMENT_CLOSE_TAG === $code ) {
				break;
			}

			$scan_ptr = $next_ptr;
		}

		// Normalize spaces.
		$param_line = preg_replace( '/\s+/', ' ', $param_line );

		// Extract type, variable and description.
		if ( ! preg_match( '/^(?P<type>[\w\|\[\]\\\?\<\>]+)\s+(?P<var>\$\w+)\s*(?P<desc>.*)$/', $param_line, $m ) ) {
			// Malformed line; let other sniffs handle this.
			return;
		}

		$param_var = $m[ 'var' ];
		$desc_text = trim( $m[ 'desc' ] );
		// Find the related function (first T_FUNCTION after the docblock).
		$func_ptr = $phpcsFile->findNext( T_FUNCTION, $stackPtr );
		if ( false === $func_ptr ) {
			return;
		}
		$open_paren = $phpcsFile->findNext( T_OPEN_PARENTHESIS, $func_ptr );
		if ( false === $open_paren ) {
			return;
		}
		$close_paren = $tokens[ $open_paren ][ 'parenthesis_closer' ] ?? null;
		if ( null === $close_paren ) {
			return;
		}

		// Check if the parameter in the signature has a default value.
		$has_default = false;
		$default_val = '';

		$ptr = $open_paren + 1;
		while ( $ptr < $close_paren ) {
			if ( T_VARIABLE === $tokens[ $ptr ][ 'code' ] && $param_var === $tokens[ $ptr ][ 'content' ] ) {
				// Look for '=' before the next comma or ')'.
				$end_of_param = $phpcsFile->findNext( array( T_COMMA, T_CLOSE_PARENTHESIS ), $ptr + 1, $close_paren );
				if ( false === $end_of_param ) {
					$end_of_param = $close_paren;
				}
				$eq_ptr = $phpcsFile->findNext( T_EQUAL, $ptr + 1, $end_of_param );
				if ( false !== $eq_ptr ) {
					$has_default = true;
					// Capture tokens of the default value (skipping whitespace) until comma or ')'.
					$val_start = $phpcsFile->findNext( array( T_WHITESPACE ), $eq_ptr + 1, $end_of_param, true );
					if ( false === $val_start ) {
						$val_start = $eq_ptr + 1;
					}
					$val_end     = $end_of_param - 1;
					$default_val = trim( $phpcsFile->getTokensAsString( $val_start, $val_end - $val_start + 1 ) );
					// Normalize (remove trailing commas or spaces).
					$default_val = rtrim( $default_val, " \t\n\r\0\x0B," );
				}
				break;
			}
			$ptr++;
		}

		// Validations.
		// All @param descriptions must end with a period.
		if ( '' !== $desc_text && '.' !== substr( $desc_text, -1 ) ) {
			$phpcsFile->addError(
				"@param {$param_var} description must end with a period.",
				$desc_ptr,
				'ParamDescMissingPeriod'
			);
		}

		// Special rules for optional parameters (with default value in signature).
		if ( $has_default ) {
			// Must start with "Optional.".
			if ( ! preg_match( '/^Optional\.\s*/', $desc_text ) ) {
				$phpcsFile->addError(
					"@param {$param_var} has a default value; description must start with 'Optional.'.",
					$desc_ptr,
					'ParamOptionalPrefixMissing'
				);
			}

			// Must end with "Default: <value>.".
			$normalized = strtolower( $default_val );
			if ( in_array( $normalized, array( 'true', 'false', 'null' ), true ) ) {
				$default_val = $normalized;
			}

			$default_regex = '/Default:\s*' . preg_quote( $default_val, '/' ) . '\.\s*$/';
			if ( ! preg_match( $default_regex, $desc_text ) ) {
				$phpcsFile->addError(
					"@param {$param_var} description must end with 'Default: {$default_val}.'.",
					$desc_ptr,
					'ParamDefaultSuffixMissing'
				);
			}
		}
	}
}

<?php
/**
 * Frakto Coding Standard.
 *
 * @package FraktoCodingStandards
 * @license https://opensource.org/licenses/MIT MIT
 * @author  Frakto Team
 */

namespace Frakto\Sniffs\DB;

use PHP_CodeSniffer\Sniffs\Sniff;
use PHP_CodeSniffer\Files\File;
use PHP_CodeSniffer\Util\Tokens;

/**
 * Makes sure PDO prepared statements are used.
 */
class PreparedSQLSniff implements Sniff {
	/**
	 * Registers the tokens this sniff listens for.
	 *
	 * @return array
	 */
	public function register() {
		return array( T_STRING );
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
		$methodName = strtolower( $tokens[ $stackPtr ][ 'content' ] );

		// Ensure it's a call: next non-empty must be "(".
		$openParen = $phpcsFile->findNext( Tokens::$emptyTokens, $stackPtr + 1, null, true );
		if ( false === $openParen || T_OPEN_PARENTHESIS !== $tokens[ $openParen ][ 'code' ] ) {
			return;
		}

		// Ensure it's an object method call: prev non-empty must be T_OBJECT_OPERATOR.
		$prevNonEmpty = $phpcsFile->findPrevious( Tokens::$emptyTokens, $stackPtr - 1, null, true );
		if ( false === $prevNonEmpty || T_OBJECT_OPERATOR !== $tokens[ $prevNonEmpty ][ 'code' ] ) {
			return;
		}

		// Forbid ->query() and ->exec() on any object (treat as unsafe SQL entry points).
		if ( 'query' === $methodName || 'exec' === $methodName ) {
			$phpcsFile->addError(
				sprintf( 'Do not use %s(). Use prepare()->execute() with placeholders.', $methodName ),
				$stackPtr,
				'ForbiddenQueryExec'
			);
			return;
		}

		// Inspect ->prepare(...) SQL.
		if ( 'prepare' === $methodName ) {
			$open  = $openParen;
			$close = isset( $tokens[ $open ][ 'parenthesis_closer' ] ) ? $tokens[ $open ][ 'parenthesis_closer' ] : null;
			if ( null === $close ) {
				return;
			}

			// Get raw argument text (SQL).
			$sqlArg = $this->getSQLArgument( $phpcsFile, $open, $close );

			// Allow string literal or variable; if variable, resolve assignment source.
			$source = trim( $sqlArg );
			if ( '' !== $source && '$' === $source[ 0 ] ) {
				$varName  = ltrim( $source, '$' );
				$resolved = $this->getVariable( $phpcsFile, $open, $varName );

				// If the variable cannot be resolved here, accept it as-is (no placeholder enforcement).
				if ( '' === $resolved ) {
					return;
				}

				$source = $resolved;
			}

			// Check if SQL requires placeholders.
			if ( ! $this->validateComparators( $phpcsFile, $stackPtr, $source ) ) {
				return;
			}
		}
	}

	/**
	 * Resolve the assigned expression for a variable by scanning backwards from $fromPtr.
	 * Returns raw expression text (e.g., "'SELECT ... :id'") or empty string.
	 *
	 * @param File   $phpcsFile The file being checked.
	 * @param int    $fromPtr   Pointer to the starting position.
	 * @param string $varName   Name of the variable to resolve.
	 *
	 * @return string
	 */
	private function getVariable( $phpcsFile, $fromPtr, $varName ) {
		$tokens = $phpcsFile->getTokens();

		for ( $i = $fromPtr; $i >= 0; $i-- ) {
			if ( T_VARIABLE !== $tokens[ $i ][ 'code' ] || '$' . $varName !== $tokens[ $i ][ 'content' ] ) {
				continue;
			}
			$eq_ptr = $phpcsFile->findNext( T_EQUAL, $i + 1, null, false, '=', true );
			if ( false === $eq_ptr ) {
				continue;
			}
			$expr_start = $phpcsFile->findNext( T_WHITESPACE, $eq_ptr + 1, null, true );
			if ( false === $expr_start ) {
				continue;
			}
			$expr_end = $phpcsFile->findEndOfStatement( $expr_start );
			if ( false === $expr_end ) {
				continue;
			}
			$expr = trim( $phpcsFile->getTokensAsString( $expr_start, $expr_end - $expr_start + 1 ) );
			$expr = rtrim( $expr, ";\t\n\r " );
			return $expr;
		}

		return '';
	}

	/**
	 * Extract the first argument text between "(" and ")".
	 *
	 * @param File $phpcsFile The file being checked.
	 * @param int  $open      Pointer to the opening parenthesis.
	 * @param int  $close     Pointer to the closing parenthesis.
	 *
	 * @return string
	 */
	private function getSQLArgument( $phpcsFile, $open, $close ) {
		$tokens = $phpcsFile->getTokens();

		$start = $open + 1;
		$end   = $close;

		for ( $i = $start; $i < $close; $i++ ) {
			$code = $tokens[ $i ][ 'code' ];

			// Fast-skip nested (...) blocks.
			if ( T_OPEN_PARENTHESIS === $code && ! empty( $tokens[ $i ][ 'parenthesis_closer' ] ) ) {
				$i = $tokens[ $i ][ 'parenthesis_closer' ];
				continue;
			}
			// Fast-skip nested [...] blocks.
			if ( T_OPEN_SQUARE_BRACKET === $code && ! empty( $tokens[ $i ][ 'bracket_closer' ] ) ) {
				$i = $tokens[ $i ][ 'bracket_closer' ];
				continue;
			}
			// Fast-skip curly scopes.
			if ( ( T_CURLY_OPEN === $code || T_DOLLAR_OPEN_CURLY_BRACES === $code ) && ! empty( $tokens[ $i ][ 'brace_closer' ] ) ) {
				$i = $tokens[ $i ][ 'brace_closer' ];
				continue;
			}
			if ( T_OPEN_CURLY_BRACKET === $code && ! empty( $tokens[ $i ][ 'scope_closer' ] ) ) {
				$i = $tokens[ $i ][ 'scope_closer' ];
				continue;
			}

			// Split only at a comma that belongs to this call's top level.
			if ( T_COMMA === $code && ! empty( $tokens[ $i ][ 'nested_parenthesis' ] ) ) {
				$parents   = array_keys( $tokens[ $i ][ 'nested_parenthesis' ] );
				$innermost = end( $parents );
				if ( $innermost === $open ) {
					$end = $i;
					break;
				}
			}
		}

		return trim( $phpcsFile->getTokensAsString( $start, $end - $start ) );
	}

	/**
	 * Orchestrates comparator validation using split regex passes.
	 *
	 * @param File   $phpcsFile The file being checked.
	 * @param int    $stackPtr  Token position.
	 * @param string $sql       The sql string to check.
	 *
	 * @return bool
	 */
	private function validateComparators( $phpcsFile, $stackPtr, $sql ) {
		$sqlTrim = trim( $sql );
		if ( '' === $sqlTrim || ( '\'' !== $sqlTrim[ 0 ] && '"' !== $sqlTrim[ 0 ] ) ) {
			return true;
		}
		$inner = trim( $sqlTrim, "\"'\r\n\t " );

		$ok  = true;
		$ok &= $this->validateBinary( $phpcsFile, $stackPtr, $inner );
		$ok &= $this->validateLike( $phpcsFile, $stackPtr, $inner );
		$ok &= $this->validateRegex( $phpcsFile, $stackPtr, $inner );
		$ok &= $this->validateIn( $phpcsFile, $stackPtr, $inner );
		$ok &= $this->validateBetween( $phpcsFile, $stackPtr, $inner );
		$ok &= $this->validateIs( $phpcsFile, $stackPtr, $inner );
		return (bool) $ok;
	}

	/**
	 * Enforce placeholders after binary operators.
	 *
	 * @param File   $phpcsFile The file being checked.
	 * @param int    $stackPtr  Token position.
	 * @param string $sql       The sql string to check.
	 *
	 * @return bool
	 */
	private function validateBinary( $phpcsFile, $stackPtr, $sql ) {
		$pattern = '~(?P<op>=|<=>|<>|!=|<=|>=|<|>)\s*(?P<rhs>[^\s,)\]]+)~is';
		if ( ! preg_match_all( $pattern, $sql, $hits, PREG_SET_ORDER ) ) {
			return true;
		}
		$ok = true;
		foreach ( $hits as $h ) {
			if ( ! $this->validateValue( $h[ 'rhs' ] ) ) {
				$this->ReportPlaceholderError( $phpcsFile, $stackPtr, $h[ 'op' ], $h[ 'rhs' ] );
				$ok = false;
			}
		}
		return $ok;
	}

	/**
	 * Enforce placeholders after (NOT) LIKE.
	 *
	 * @param File   $phpcsFile The file being checked.
	 * @param int    $stackPtr  Token position.
	 * @param string $sql       The sql string to check.
	 *
	 * @return bool
	 */
	private function validateLike( $phpcsFile, $stackPtr, $sql ) {
		$pattern = '~\b(?:not\s+)?like\b\s+(?P<rhs>[^\s]+)~is';
		if ( ! preg_match_all( $pattern, $sql, $hits, PREG_SET_ORDER ) ) {
			return true;
		}
		$ok = true;
		foreach ( $hits as $h ) {
			if ( ! $this->validateValue( $h[ 'rhs' ] ) ) {
				$this->ReportPlaceholderError( $phpcsFile, $stackPtr, 'LIKE', $h[ 'rhs' ] );
				$ok = false;
			}
		}
		return $ok;
	}

	/**
	 * Enforce placeholders after (NOT) REGEXP/RLIKE.
	 *
	 * @param File   $phpcsFile The file being checked.
	 * @param int    $stackPtr  Token position.
	 * @param string $sql       The sql string to check.
	 *
	 * @return bool
	 */
	private function validateRegex( $phpcsFile, $stackPtr, $sql ) {
		$pattern = '~\b(?:not\s+)?(?:regexp|rlike)\b\s+(?P<rhs>[^\s]+)~is';
		if ( ! preg_match_all( $pattern, $sql, $hits, PREG_SET_ORDER ) ) {
			return true;
		}
		$ok = true;
		foreach ( $hits as $h ) {
			if ( ! $this->validateValue( $h[ 'rhs' ] ) ) {
				$this->ReportPlaceholderError( $phpcsFile, $stackPtr, 'REGEXP', $h[ 'rhs' ] );
				$ok = false;
			}
		}
		return $ok;
	}

	/**
	 * Enforce a single placeholder inside (NOT) IN(...).
	 *
	 * @param File   $phpcsFile The file being checked.
	 * @param int    $stackPtr  Token position.
	 * @param string $sql       The sql string to check.
	 *
	 * @return bool
	 */
	private function validateIn( $phpcsFile, $stackPtr, $sql ) {
		$pattern = '~\b(?:not\s+)?in\s*\(\s*(?P<rhs>[^()]*)\s*\)~is';
		if ( ! preg_match_all( $pattern, $sql, $hits, PREG_SET_ORDER ) ) {
			return true;
		}
		$ok = true;
		foreach ( $hits as $h ) {
			$rhs = isset( $h[ 'rhs' ] ) ? trim( $h[ 'rhs' ] ) : '';
			if ( '' === $rhs || ! $this->validateValue( $rhs ) ) {
				$this->ReportPlaceholderError( $phpcsFile, $stackPtr, 'IN', $rhs );
				$ok = false;
			}
		}
		return $ok;
	}

	/**
	 * Enforce placeholders for BOTH operands in BETWEEN x AND y (NOT BETWEEN included).
	 *
	 * @param File   $phpcsFile The file being checked.
	 * @param int    $stackPtr  Token position.
	 * @param string $sql       The sql string to check.
	 *
	 * @return bool
	 */
	private function validateBetween( $phpcsFile, $stackPtr, $sql ) {
		$pattern = '~\b(?:not\s+)?between\b\s+(?P<x>[^\s]+)\s+\band\b\s+(?P<y>[^\s]+)~is';
		if ( ! preg_match_all( $pattern, $sql, $hits, PREG_SET_ORDER ) ) {
			return true;
		}
		$ok = true;
		foreach ( $hits as $h ) {
			if ( ! $this->validateValue( $h[ 'x' ] ) ) {
				$this->ReportPlaceholderError( $phpcsFile, $stackPtr, 'BETWEEN', $h[ 'x' ] );
				$ok = false;
			}
			if ( ! $this->validateValue( $h[ 'y' ] ) ) {
				$this->ReportPlaceholderError( $phpcsFile, $stackPtr, 'BETWEEN', $h[ 'y' ] );
				$ok = false;
			}
		}
		return $ok;
	}

	/**
	 * Enforce placeholders after (NOT) IS.
	 *
	 * @param File   $phpcsFile The file being checked.
	 * @param int    $stackPtr  Token position.
	 * @param string $sql       The sql string to check.
	 *
	 * @return bool
	 */
	private function validateIs( $phpcsFile, $stackPtr, $sql ) {
		$pattern = '~\bis(?:\s+not)?\b\s+(?P<rhs>[^\s]+)~is';
		if ( ! preg_match_all( $pattern, $sql, $hits, PREG_SET_ORDER ) ) {
			return true;
		}
		$ok = true;
		foreach ( $hits as $h ) {
			if ( ! $this->validateValue( $h[ 'rhs' ] ) ) {
				$this->ReportPlaceholderError( $phpcsFile, $stackPtr, 'IS', $h[ 'rhs' ] );
				$ok = false;
			}
		}
		return $ok;
	}

	/**
	 * Validates the string to compare.
	 *
	 * @param string $str The string to check.
	 *
	 * @return bool
	 */
	private function validateValue( $str ) {
		$strTrim = trim( $str );
		if ( '' === $strTrim ) {
			return false;
		}

		$upper = strtoupper( $strTrim );

		if ( in_array( $upper, array( 'NULL', 'TRUE', 'FALSE' ), true ) ) {
			return true;
		}

		if ( preg_match( '/^:[a-zA-Z_][a-zA-Z0-9_]*$/', $strTrim ) ) {
			return true;
		}

		if ( '?' === $strTrim ) {
			return true;
		}

		return false;
	}

	/**
	 * Reports a placeholder error.
	 *
	 * @param File   $phpcsFile The file being checked.
	 * @param int    $stackPtr  Token position.
	 * @param string $operator  The operator that caused the error.
	 * @param string $rightHand The right-hand side value that caused the error.
	 *
	 * @return void
	 */
	private function ReportPlaceholderError( $phpcsFile, $stackPtr, $operator, $rightHand ) {
		$phpcsFile->addError(
			sprintf( 'Comparator "%s" must use a placeholder (:name or ?). Found "%s".', $operator, trim( $rightHand ) ),
			$stackPtr,
			'PlaceholderRequired'
		);
	}
}

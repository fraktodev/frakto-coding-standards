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

/**
 * Enforces appropriate PDO initialization.
 */
class PDOInitializationSniff implements Sniff {
	/**
	 * Registers the tokens this sniff listens for.
	 *
	 * @return array
	 */
	public function register() {
		return array( T_NEW );
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

		// Detects new PDO.
		$classPtr = $phpcsFile->findNext( T_STRING, $stackPtr + 1 );
		if ( strtolower( $tokens[ $classPtr ][ 'content' ] ) !== 'pdo' ) {
			return;
		}

		// Find arguments.
		$openParen = $phpcsFile->findNext( T_OPEN_PARENTHESIS, $classPtr );
		$args      = $this->getCallArguments( $phpcsFile, $openParen );

		// Validate DSN.
		$dsnArg = $args[ 0 ] ?? '';
		if ( ! $this->isValidDsnSource( $phpcsFile, $stackPtr, $dsnArg ) ) {
			$phpcsFile->addError(
				'DSN must be created via sprintf with exact format "mysql:host=%s;port=%d;charset=utf8mb4".',
				$stackPtr,
				'InvalidDSN'
			);
		}

		// Validate User and password.
		foreach ( array( 1, 2 ) as $index ) {
			if ( ! $this->isConstantArgument( $args[ $index ] ) ) {
				$phpcsFile->addError(
					sprintf( 'Argument %d of PDO must be a defined constant.', $index + 1 ),
					$stackPtr,
					'InvalidConstantArg' . ( $index + 1 )
				);
			}
		}

		// Validate options.
		$optsArg     = $args[ 3 ] ?? '';
		$optsMissing = array();
		if ( ! $this->isValidOptsSource( $phpcsFile, $stackPtr, $optsArg, $optsMissing ) ) {
			$phpcsFile->addError(
				sprintf( 'Invalid PDO options. %s', implode( ' ', $optsMissing ) ),
				$stackPtr,
				'InvalidOptions'
			);
		}
	}

	/**
	 * Get arguments from a function or constructor call safely.
	 *
	 * @param File $phpcsFile    The file being checked.
	 * @param int  $openParenPtr Pointer to the opening parenthesis.
	 *
	 * @return array
	 */
	private function getCallArguments( $phpcsFile, $openParenPtr ): array {
		$tokens     = $phpcsFile->getTokens();
		$closeParen = $tokens[ $openParenPtr ][ 'parenthesis_closer' ];

		$args  = array();
		$start = $openParenPtr + 1;
		$i     = $start;

		while ( $i < $closeParen ) {
			$code = $tokens[ $i ][ 'code' ];

			// Fast-skip nested (...) blocks.
			if ( T_OPEN_PARENTHESIS === $code && ! empty( $tokens[ $i ][ 'parenthesis_closer' ] ) ) {
				$i = $tokens[ $i ][ 'parenthesis_closer' ] + 1;
				continue;
			}

			// Fast-skip nested [...] blocks.
			if ( T_OPEN_SQUARE_BRACKET === $code && ! empty( $tokens[ $i ][ 'bracket_closer' ] ) ) {
				$i = $tokens[ $i ][ 'bracket_closer' ] + 1;
				continue;
			}

			// Fast-skip short arrays: [...]. (Handled by T_OPEN_SQUARE_BRACKET above)
			// Fast-skip curly scopes if present.
			if ( ( T_CURLY_OPEN === $code || T_DOLLAR_OPEN_CURLY_BRACES === $code )
			&& ! empty( $tokens[ $i ][ 'brace_closer' ] )
			) {
				$i = $tokens[ $i ][ 'brace_closer' ] + 1;
				continue;
			}
			if ( T_OPEN_CURLY_BRACKET === $code && ! empty( $tokens[ $i ][ 'scope_closer' ] ) ) {
				$i = $tokens[ $i ][ 'scope_closer' ] + 1;
				continue;
			}

			// Split on commas that belong to the innermost parenthesis = this call.
			if ( T_COMMA === $code && ! empty( $tokens[ $i ][ 'nested_parenthesis' ] ) ) {
				$parents   = array_keys( $tokens[ $i ][ 'nested_parenthesis' ] );
				$innermost = end( $parents );
				if ( $innermost === $openParenPtr ) {
					$args[] = trim( $phpcsFile->getTokensAsString( $start, $i - $start ) );
					$start  = $i + 1;
				}
			}

			$i++;
		}

		// Last argument.
		$last = trim( $phpcsFile->getTokensAsString( $start, $closeParen - $start ) );
		if ( '' !== $last ) {
			$args[] = $last;
		}

		return $args;
	}

	/**
	 * Resolve the assigned expression for a variable by scanning backwards.
	 * Returns raw expression text (e.g., "sprintf(...)", "array(...)", "[ ... ]"), or empty string.
	 *
	 * @param File   $phpcsFile The file being checked.
	 * @param int    $fromPtr   Token position to start scanning backwards (e.g., "(" of new PDO().
	 * @param string $varName   Variable name without "$".
	 *
	 * @return string
	 */
	private function getVariable( $phpcsFile, $fromPtr, $varName ) {
		$tokens = $phpcsFile->getTokens();

		for ( $i = $fromPtr; $i >= 0; $i-- ) {
			if ( T_VARIABLE !== $tokens[ $i ][ 'code' ] || '$' . $varName !== $tokens[ $i ][ 'content' ] ) {
				continue;
			}
			// Find "=" after the variable on the same statement.
			$eqPtr = $phpcsFile->findNext( T_EQUAL, $i + 1, null, false, '=', true );
			if ( false === $eqPtr ) {
				continue;
			}
			// Start of assigned expression.
			$exprStart = $phpcsFile->findNext( T_WHITESPACE, $eqPtr + 1, null, true );
			if ( false === $exprStart ) {
				continue;
			}
			// End of statement.
			$exprEnd = $phpcsFile->findEndOfStatement( $exprStart );
			if ( false === $exprEnd ) {
				continue;
			}
			$expr = trim( $phpcsFile->getTokensAsString( $exprStart, $exprEnd - $exprStart + 1 ) );
			return rtrim( $expr, ";\t\n\r " );
		}

		return '';
	}

	/**
	 * Check if an argument is a defined constant.
	 *
	 * @param string $arg The argument token array from $args.
	 *
	 * @return bool
	 */
	private function isConstantArgument( $arg ) {
		$trimArg = trim( $arg );

		// Quick rejects: variables, quoted strings, function calls/expressions.
		if ( '' === $trimArg || '$' === $trimArg[ 0 ] || '"' === $trimArg[ 0 ] || '\'' === $trimArg[ 0 ] || false !== strpos( $trimArg, '(' ) ) {
			return false;
		}

		// Global constant: UPPER_CASE_WITH_UNDERSCORES (common convention).
		if ( preg_match( '/^[A-Z_][A-Z0-9_]*$/', $trimArg ) ) {
			return true;
		}

		// Class constant: (optional leading backslash + FQN)::UPPER_CONST
		// e.g. Config::DB_USER or \App\Config::DB_PASSWORD.
		if ( preg_match( '/^\\\\?[A-Za-z_][A-Za-z0-9_\\\\]*::[A-Z_][A-Z0-9_]*$/', $trimArg ) ) {
			return true;
		}

		return false;
	}

	/**
	 * Validates the DSN argument for PDO.
	 *
	 * @param File   $phpcsFile The file being checked.
	 * @param int    $stackPtr  Token position.
	 * @param string $dsnArg    The DSN argument.
	 *
	 * @return bool
	 */
	private function isValidDsnSource( $phpcsFile, $stackPtr, $dsnArg ) {
		$trimArg = trim( $dsnArg );

		// Variable: resolve and revalidate using the resolved source .
		if ( '' !== $trimArg && '$' === $trimArg[ 0 ] ) {
			$varName = ltrim( $trimArg, '$' );
			$source  = $this->getVariable( $phpcsFile, $stackPtr, $varName );
			if ( '' === $source ) {
				return false;
			}
			return $this->isValidDsnSource( $phpcsFile, $stackPtr, $source );
		}

		// Direct sprintf() usage.
		if ( preg_match( '/sprintf\s*\(\s*[\'"]mysql:host=%s;port=%d;charset=utf8mb4[\'"]/', $trimArg ) ) {
			return true;
		}

		return false;
	}

	/**
	 * Validates the options argument for PDO.
	 *
	 * @param File   $phpcsFile The file being checked.
	 * @param int    $stackPtr  Token position.
	 * @param string $optsArg   The options argument.
	 * @param array  $missing   Optional. OUT: list of missing pairs (human readable). Default: null.
	 *
	 * @return bool
	 */
	private function isValidOptsSource( $phpcsFile, $stackPtr, $optsArg, &$missing = null ) {
		$trimArg = trim( $optsArg );

		// Variable: resolve and revalidate using the resolved source .
		if ( '' !== $trimArg && '$' === $trimArg[ 0 ] ) {
			$varName = ltrim( $trimArg, '$' );
			$source  = $this->getVariable( $phpcsFile, $stackPtr, $varName );
			if ( '' === $source ) {
				return false;
			}
			return $this->isValidOptsSource( $phpcsFile, $stackPtr, $source );
		}

		$missing = array();

		// Must look like an array literal.
		if ( ! preg_match( '/^(array\s*\(|\[)/i', $trimArg ) ) {
			$missing[] = 'Options must be an array literal.';
			return false;
		}

		$checks = array(
			'PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION' => '/PDO::\s*ATTR_ERRMODE\s*=>\s*PDO::\s*ERRMODE_EXCEPTION\b/i',
			'PDO::ATTR_EMULATE_PREPARES => false'         => '/PDO::\s*ATTR_EMULATE_PREPARES\s*=>\s*false\b/i',
			'PDO::MYSQL_ATTR_MULTI_STATEMENTS => false'   => '/PDO::\s*MYSQL_ATTR_MULTI_STATEMENTS\s*=>\s*false\b/i',
			'PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_NUM' => '/PDO::\s*ATTR_DEFAULT_FETCH_MODE\s*=>\s*PDO::\s*FETCH_NUM\b/i',
			'PDO::ATTR_TIMEOUT => 5'                      => '/PDO::\s*ATTR_TIMEOUT\s*=>\s*5\b/',
		);

		$ok = true;
		foreach ( $checks as $label => $regex ) {
			if ( ! preg_match( $regex, $trimArg ) ) {
				$missing[] = 'Missing option: ' . $label;
				$ok        = false;
			}
		}

		return $ok;
	}
}

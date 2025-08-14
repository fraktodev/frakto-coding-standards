<?php
/**
 * Frakto Coding Standard.
 *
 * @package FraktoCodingStandards
 * @license https://opensource.org/licenses/MIT MIT
 * @author  Frakto Team
 */

namespace Frakto\Sniffs\DB;

use WordPressCS\WordPress\AbstractFunctionRestrictionsSniff;

/**
 * Verifies that no database related PHP functions are used.
 */
final class RestrictedFunctionsSniff extends AbstractFunctionRestrictionsSniff {

	/**
	 * Groups of functions to restrict.
	 *
	 * @return array
	 */
	public function getGroups() {
		return array(

			'mysql' => array(
				'type'      => 'error',
				'message'   => 'Accessing the database directly should be avoided. Please use the PDO class instead. Found: %s.',
				'functions' => array(
					'mysql_*',
					'mysqli_*',
					'mysqlnd_ms_*',
					'mysqlnd_qc_*',
					'mysqlnd_uh_*',
					'mysqlnd_memcache_*',
					'maxdb_*',
				),
				'allow'     => array(
					'mysql_to_rfc3339' => true,
				),
			),
		);
	}
}

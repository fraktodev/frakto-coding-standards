<?php
/**
 * Frakto Coding Standard.
 *
 * @package FraktoCodingStandards
 * @license https://opensource.org/licenses/MIT MIT
 * @author  Frakto Team
 */

namespace Frakto\Sniffs\DB;

use WordPressCS\WordPress\AbstractClassRestrictionsSniff;

/**
 * Verifies that no database related PHP classes are used.
 */
final class RestrictedClassesSniff extends AbstractClassRestrictionsSniff {

	/**
	 * Groups of classes to restrict.
	 *
	 * @return array
	 */
	public function getGroups() {
		return array(

			'mysql' => array(
				'type'    => 'error',
				'message' => 'Accessing the database directly should be avoided. Please use the PDO class instead. Found: %s.',
				'classes' => array(
					'mysqli',
					'PDOStatement',
				),
			),

		);
	}
}

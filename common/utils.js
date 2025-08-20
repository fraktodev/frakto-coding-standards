// Dependencies.
import process from 'process';

/**
 * Throws an error with the specified message.
 *
 * @param {*} message - The error message to throw.
 * @returns {void}
 */
export const throwError = (message) => {
	const errorMessage = 'string' === typeof message ? message : message.toString();
	process.stderr.write(errorMessage);
	process.exit(1);
};

/**
 * Retrieves and validates the payload from the environment variable.
 *
 * @returns {object}
 */
export const getPayload = () => {
	const rawPayload = process.env.FRAKTO_PAYLOAD;
	if (!rawPayload) {
		throwError('Missing FRAKTO_PAYLOAD environment variable.');
	}

	let payload;
	try {
		payload = JSON.parse(rawPayload);
	} catch (error) {
		throwError(`Invalid FRAKTO_PAYLOAD JSON: ${error.message}`);
	}

	return payload;
};

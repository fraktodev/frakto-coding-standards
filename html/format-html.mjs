#!/usr/bin/env node

// Dependencies
import fs from 'fs';

/**
 * Removes trailing slashes from self-closing HTML tags.
 *
 * @param {string} html The HTML content to process.
 *
 * @returns {string}
 */
const removeTrailingSlash = (html) => {
	// List of self-closing tags
	const selfClosingTags = [
		'area',
		'base',
		'br',
		'col',
		'embed',
		'hr',
		'img',
		'input',
		'link',
		'meta',
		'param',
		'source',
		'track',
		'wbr'
	];
	// Regular expression to match self-closing tags with trailing slashes
	const regex = new RegExp(`<(${selfClosingTags.join('|')})([^>]*)\\s*/>`, 'gi');

	// Replace self-closing tags with corrected format
	return html.replace(regex, (match, tagName, attributes) => {
		// Trim trailing spaces from attributes
		const trimmedAttributes = attributes.replace(/\s+$/, '');
		return `<${tagName}${trimmedAttributes}>`;
	});
};

/**
 * Processes an HTML file to remove trailing slashes from self-closing tags.
 *
 * @param {string} filePath The path to the HTML file to process.
 *
 * @throws  {Error} If the file cannot be read or written.
 * @returns {void}
 */
const format = (filePath) => {
	if (!filePath) {
		// Display an error message if no file path is provided
		//console.error('Por favor, proporciona la ruta del archivo HTML como argumento.');
		process.exit(1);
	}

	// Read the HTML file
	fs.readFile(filePath, 'utf8', (error, data) => {
		if (error) {
			// Display an error message if there is an issue reading the file
			//console.error(`Error al leer el archivo: ${error.message}`);
			process.exit(1);
		}

		// Process the file content
		const formattedHtml = removeTrailingSlash(data);

		// Save the changes to the original file
		fs.writeFile(filePath, formattedHtml, 'utf8', (error) => {
			if (error) {
				// Display an error message if there is an issue writing to the file
				//console.error(`Error al escribir en el archivo: ${error.message}`);
				process.exit(1);
			}
			// Confirm that the file was processed and saved successfully
			//console.log(`Archivo procesado y guardado: ${filePath}`);
		});
	});
};

// Path to the HTML file to process
const filePath = process.argv[2];

// Format the HTML file
format(filePath);

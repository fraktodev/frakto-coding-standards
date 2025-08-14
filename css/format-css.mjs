#!/usr/bin/env node

// Dependencies
import fs from 'fs';
import postcss from 'postcss';
import scss from 'postcss-scss';
import cssOrder from './css-order.mjs';

const mixinToPropMap = {
	'border.radius': 'border-radius',
	'font.size': 'font-size',
	'scrollbar.apply': 'scrollbar-width',
	'transition.apply': 'transition'
};

/**
 * Sorts a CSS/SCSS rule's declarations according to the Frakto CSS order.
 *
 * @param {Object} rule The CSS rule to process.
 *
 * @returns {void}
 */
const sortDeclarations = (rule) => {
	const declarations = [];
	const others = [];

	// Categorize rules
	rule.each((node) => {
		if (node.type === 'decl') {
			declarations.push({ node, key: node.prop });
		} else if (node.type === 'atrule' && node.name === 'include') {
			const mixinName = node.params.split('(')[0].trim();
			const prop = mixinToPropMap[mixinName] || `zzz-${mixinName}`;
			declarations.push({ node, key: prop });
		} else {
			others.push(node);
		}
	});

	// Sort declarations by index in CSS Order
	declarations.sort((a, b) => {
		const ai = cssOrder.indexOf(a.key);
		const bi = cssOrder.indexOf(b.key);

		if (ai === -1 && bi === -1) return 0;
		if (ai === -1) return 1;
		if (bi === -1) return -1;
		return ai - bi;
	});

	// Clear rule and re-append nodes in correct order
	rule.removeAll();
	declarations.forEach(({ node }) => rule.append(node));
	others.forEach((o) => rule.append(o));
};

/**
 * Processes a CSS or SCSS file to reorder declarations using the Frakto CSS order.
 *
 * @param {string} filePath The path to the CSS/SCSS file to process.
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

	const input = fs.readFileSync(filePath, 'utf8');

	postcss([
		(root) => {
			root.walkRules(sortDeclarations);
		}
	])
		.process(input, { from: filePath, syntax: scss })
		.then((result) => {
			// Confirm that the file was processed and saved successfully
			//console.log(`Archivo procesado y guardado: ${filePath}`);
			fs.writeFileSync(filePath, result.css, 'utf8');
		})
		.catch((error) => {
			// Display an error message if there is an issue writing to the file
			//console.error(`Error al escribir en el archivo: ${error.message}`);
			process.exit(1);
		});
};

// File path from command line argument
const filePath = process.argv[2];

// Format the CSS/SCSS file
format(filePath);

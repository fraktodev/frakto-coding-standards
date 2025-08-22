#!/usr/bin/env node

// Dependencies.
import { getPayload, throwError } from './utils/utils.mjs';
import { fraktoCommonAudit } from './common/index.mjs';
import { fraktoHTMLAudit } from './html/index.mjs';
import { fraktoJSAudit } from './js/index.mjs';
import { fraktoJSONAudit } from './json/index.mjs';
import { fraktoMDAudit } from './md/index.mjs';
import { fraktoTSAudit } from './ts/index.mjs';
import path from 'node:path';
import process from 'node:process';

// Engine
(async () => {
	const request = getPayload();
	let response;
	switch (request.language) {
		case 'html':
			response = await fraktoHTMLAudit(request, path.join(process.cwd(), 'html'));
			break;
		case 'javascript':
			response = await fraktoJSAudit(request, path.join(process.cwd(), 'js'));
			break;
		case 'json':
			response = await fraktoJSONAudit(request, path.join(process.cwd(), 'json'));
			break;
		case 'markdown':
			response = await fraktoMDAudit(request, path.join(process.cwd(), 'md'));
			break;
		case 'typescript':
			response = await fraktoTSAudit(request, path.join(process.cwd(), 'ts'));
			break;
		default:
			response = await fraktoCommonAudit(request, path.join(process.cwd(), 'common'));
	}

	process.stdout.write(JSON.stringify(response));
})().catch((error) => {
	throwError(error);
});

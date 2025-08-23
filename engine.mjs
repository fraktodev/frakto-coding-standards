#!/usr/bin/env node

// Dependencies.
import process from 'node:process';
import fraktoAuditor from './src/index.mjs';
import { getPayload, throwError } from './utils/utils.mjs';

// Engine
(async () => {
	const request = getPayload();
	const auditor = new fraktoAuditor();
	const result  = await auditor.audit(request.language, request);
	process.stdout.write(JSON.stringify(result));
})().catch((error) => {
	throwError(error);
});

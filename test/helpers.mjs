// Shared by the test files. Every test loads the BUILT package from dist/ —
// the bytes that are published — never the TypeScript source.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const require = createRequire(import.meta.url);
export const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export function dist(rel) {
	return require(join(root, 'dist', rel));
}

/** The Niyoos wire contract this package is built against. */
export const contract = JSON.parse(readFileSync(join(root, 'contract', 'niyoos-contract.json'), 'utf8'));

/** A Niyoos refusal as the OpenAI client throws it: status + the envelope's `error`. */
export function apiError(code, extra = {}) {
	const spec = contract.errorCodes[code];
	const err = new Error(`${spec.status} server message for ${code}`);
	err.status = spec.status;
	err.error = { message: `server message for ${code}`, type: 'x', code };
	return Object.assign(err, extra);
}

export const fakeNode = {
	id: 'node-1',
	name: 'Niyoos Chat Model',
	type: 'n8n-nodes-niyoos.niyoosChatModel',
	typeVersion: 1,
	position: [0, 0],
	parameters: {},
};

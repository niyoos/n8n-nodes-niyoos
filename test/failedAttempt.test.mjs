// The chat-model seam, run through n8n's REAL failed-attempt handler and REAL
// NodeApiError (the versions n8n 2.16 ships, from devDependencies) — so what is
// asserted is the message n8n itself ends up holding, not just what this
// package intended.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { apiError, contract, dist, fakeNode, require, root } from './helpers.mjs';

const { makeNiyoosFailedAttemptHandler, willBeRetried } = dist('nodes/shared/failedAttempt.js');
const { NIYOOS_EXPLANATIONS } = dist('nodes/shared/errors.js');
const { NodeApiError } = require('n8n-workflow');
// Deep path on purpose: this is exactly the function supplyModel installs.
const { makeN8nLlmFailedAttemptHandler } = require(
	join(root, 'node_modules/@n8n/ai-utilities/dist/cjs/utils/failed-attempt-handler/n8nLlmFailedAttemptHandler.js'),
);

const ctx = { getNode: () => fakeNode };
const n8nHandler = makeN8nLlmFailedAttemptHandler(ctx, makeNiyoosFailedAttemptHandler(() => fakeNode));

function thrownBy(error) {
	try {
		n8nHandler(error);
	} catch (e) {
		return e;
	}
	return undefined;
}

for (const code of Object.keys(contract.errorCodes).sort()) {
	test(`${code}: a final failure reaches n8n with the explanation as its message`, () => {
		const e = thrownBy(apiError(code));
		assert.ok(e instanceof NodeApiError, `${code}: nothing, or not a NodeApiError, was thrown`);
		// The two detail-bearing codes append the server's detail (errors.test.mjs).
		const detail = code === 'CALLER_REQUEST_REJECTED' || code === 'CONFIG_ENDPOINT_BLOCKED' ? ` (Niyoos reported: server message for ${code})` : '';
		assert.equal(e.message, NIYOOS_EXPLANATIONS[code] + detail);
		assert.equal(String(e.httpCode), String(contract.errorCodes[code].status));
		assert.equal(e.description, `server message for ${code}`);
	});
}

test('a retryable refusal with retries left is NOT rewritten — the retry goes ahead', () => {
	for (const code of ['GATEWAY_RATE_LIMIT', 'PROVIDER_RATE_LIMITED', 'POLICY_COST_LIMIT_REACHED', 'PROVIDER_UNAVAILABLE']) {
		const err = apiError(code, { retriesLeft: 2 });
		assert.equal(willBeRetried(err), true, code);
		assert.equal(thrownBy(err), undefined, `${code} was ended early`);
	}
});

test('the same refusal on its last attempt IS rewritten', () => {
	const e = thrownBy(apiError('GATEWAY_RATE_LIMIT', { retriesLeft: 0 }));
	assert.equal(e?.message, NIYOOS_EXPLANATIONS.GATEWAY_RATE_LIMIT);
});

test('when the retry loop does not report retriesLeft, n8n stops on that attempt — so it is rewritten', () => {
	// Measured: @langchain/core 1.2.x passes onFailedAttempt the bare error, and
	// n8n's handler throws unless error.retriesLeft > 0.
	const err = apiError('PROVIDER_RATE_LIMITED');
	assert.equal(willBeRetried(err), false);
	assert.equal(thrownBy(err)?.message, NIYOOS_EXPLANATIONS.PROVIDER_RATE_LIMITED);
});

test('a never-retried status is rewritten at once, whatever retriesLeft says', () => {
	const e = thrownBy(apiError('POLICY_AGENT_DISABLED', { retriesLeft: 5 }));
	assert.equal(e?.message, NIYOOS_EXPLANATIONS.POLICY_AGENT_DISABLED);
});

test('an error that is not a Niyoos refusal gets n8n\'s own handling, untouched', () => {
	const err = Object.assign(new Error('500 provider exploded'), { status: 500, error: { message: 'provider exploded' } });
	const e = thrownBy(err);
	assert.ok(e instanceof NodeApiError);
	assert.ok(!Object.values(NIYOOS_EXPLANATIONS).includes(e.message), 'a Niyoos explanation was invented for a non-Niyoos error');
});

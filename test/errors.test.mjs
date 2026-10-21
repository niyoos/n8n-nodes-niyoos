// The refusal vocabulary: one explanation per Niyoos error code, no more, no
// fewer, and every one reachable from the shapes a thrown error really has.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apiError, contract, dist } from './helpers.mjs';

const { NIYOOS_EXPLANATIONS, explainNiyoosThrownError, explainNiyoosEnvelope } = dist('nodes/shared/errors.js');
const contractCodes = Object.keys(contract.errorCodes).sort();

test('the package explains exactly the codes in the contract — both directions, never vacuously', () => {
	assert.ok(contractCodes.length >= 17, `contract lists only ${contractCodes.length} codes`);
	assert.deepEqual(Object.keys(NIYOOS_EXPLANATIONS).sort(), contractCodes);
});

test('every explanation is distinct, so one code can never hide behind another', () => {
	const texts = Object.values(NIYOOS_EXPLANATIONS);
	assert.equal(new Set(texts).size, texts.length);
});

for (const code of contractCodes) {
	test(`${code}: the OpenAI client's thrown error is explained`, () => {
		const got = explainNiyoosThrownError(apiError(code));
		assert.ok(got, `${code} was not recognised`);
		assert.equal(got.code, code);
		assert.ok(got.explanation.startsWith(NIYOOS_EXPLANATIONS[code]), `${code} got another code's text`);
		assert.equal(got.serverMessage, `server message for ${code}`);
	});
}

test('the two detail-bearing codes append the server detail; the others do not', () => {
	assert.match(explainNiyoosEnvelope({ code: 'CALLER_REQUEST_REJECTED', message: 'model not found' }), /\(Niyoos reported: model not found\)$/);
	assert.match(explainNiyoosEnvelope({ code: 'CONFIG_ENDPOINT_BLOCKED', message: 'https://x' }), /\(Niyoos reported: https:\/\/x\)$/);
	assert.equal(explainNiyoosEnvelope({ code: 'POLICY_AGENT_DISABLED', message: 'Agent is disabled.' }), NIYOOS_EXPLANATIONS.POLICY_AGENT_DISABLED);
});

test('n8n HTTP-helper error shapes are recognised too (model list, Get Agent)', () => {
	const body = { error: { message: 'm', type: 't', code: 'POLICY_AGENT_DISABLED' } };
	for (const shape of [
		{ response: { data: body } },
		{ response: { body: JSON.stringify(body) } },
		{ cause: body },
		{ description: 'x', body },
	]) {
		assert.equal(explainNiyoosThrownError(shape)?.code, 'POLICY_AGENT_DISABLED', JSON.stringify(Object.keys(shape)));
	}
});

test('anything that is not a Niyoos refusal is left alone', () => {
	for (const e of [
		null,
		'boom',
		new Error('ECONNREFUSED'),
		{ status: 500, error: { message: 'provider said no', type: 'server_error', code: null } },
		{ status: 400, error: { message: 'x', code: 'NOT_A_NIYOOS_CODE' } },
	]) {
		assert.equal(explainNiyoosThrownError(e), null);
	}
});

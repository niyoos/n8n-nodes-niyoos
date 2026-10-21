// The wire values and the run id. A run id that fails Niyoos's rule makes the
// call FAIL, so the property that matters most is: nothing this package
// composes can ever fail the rule.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { contract, dist, root } from './helpers.mjs';

const wire = dist('nodes/shared/wire.js');
const rule = new RegExp(contract.runContext.runIdPattern);

test('the header names, the client value and the run-id rule are the contract\'s', () => {
	assert.equal(wire.CLIENT_HEADER, contract.clientHeader.name);
	assert.equal(wire.CLIENT_VALUE, contract.clientHeader.value);
	assert.equal(wire.RUN_ID_HEADER, contract.runContext.runIdHeader);
	assert.equal(wire.RUN_ID_PATTERN.source, contract.runContext.runIdPattern);
});

test('the credential stamps the same client value on n8n\'s own requests', () => {
	const cred = new (dist('credentials/NiyoosApi.credentials.js').NiyoosApi)();
	assert.equal(cred.name, 'niyoosApi');
	assert.equal(cred.authenticate.properties.headers[contract.clientHeader.name], contract.clientHeader.value);
});

test('the readable form: n8n-<workflowId>-<executionId>', () => {
	assert.equal(wire.composeRunId('QYGcTv9Q12nsflWq', '1'), 'n8n-QYGcTv9Q12nsflWq-1');
	assert.equal(wire.composeRunId('QYGcTv9Q12nsflWq', 42), 'n8n-QYGcTv9Q12nsflWq-42');
});

test('a bare execution id would be refused — which is why it is never sent alone', () => {
	assert.equal(rule.test('42'), false);
	assert.ok(rule.test(wire.composeRunId('7', '42')), 'a short numeric workflow id still fits');
});

test('ids that cannot fit fall back to a deterministic hash form that does', () => {
	const cases = [
		['wf with spaces', '1'],
		['wf/slash', '1'],
		['W'.repeat(80), '123456'],
		['', '5'],
		['ünïcödé', '9'],
	];
	for (const [wf, ex] of cases) {
		const id = wire.composeRunId(wf, ex);
		assert.ok(id && rule.test(id), `${JSON.stringify(wf)} -> ${id}`);
		assert.match(id, /^n8n-h-[0-9a-f]{16}$/);
		assert.equal(wire.composeRunId(wf, ex), id, 'not deterministic');
	}
	assert.notEqual(wire.composeRunId('wf a', '1'), wire.composeRunId('wf a', '2'));
});

test('no execution id: no run id at all, never an invalid one', () => {
	for (const ex of [undefined, null, '', {}]) assert.equal(wire.composeRunId('wf', ex), null);
});

test('nothing composeRunId returns can fail the rule (sweep)', () => {
	const pieces = ['', 'a', '7', 'x'.repeat(64), 'a-b_c', 'a b', '%', '😀', '1'.repeat(70)];
	for (const wf of pieces) {
		for (const ex of ['1', '9999999999', 'abc', 'a b', '0'.repeat(70)]) {
			const id = wire.composeRunId(wf, ex);
			assert.ok(id === null || rule.test(id), `${JSON.stringify([wf, ex])} -> ${id}`);
		}
	}
});

test('the package declares no runtime dependencies (n8n verification rule)', () => {
	const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
	assert.equal(pkg.dependencies, undefined);
	assert.equal(pkg.n8n.aiNodeSdkVersion, 1);
});

// supplyData, run against the REAL supplyModel from @n8n/ai-node-sdk 0.7.0 —
// the version n8n 2.16 bundles, this package's minimum. Asserts the model n8n
// would receive: the right base URL and key, the client stamp, the run id,
// chat completions rather than the Responses API, and our failure handler.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dist, fakeNode } from './helpers.mjs';

const { NiyoosChatModel } = dist('nodes/NiyoosChatModel/NiyoosChatModel.node.js');

function ctx({ workflowId = 'QYGcTv9Q12nsflWq', executionId = '7', options = {} } = {}) {
	return {
		getNode: () => fakeNode,
		getCredentials: async () => ({ agentApiKey: 'sk-aiwos-test-not-real', baseUrl: 'https://api.niyoos.example/proxy/v1/' }),
		getNodeParameter: (name, _i, fallback) => (name === 'model' ? 'claude-haiku-4-5' : name === 'options' ? options : fallback),
		getWorkflow: () => ({ id: workflowId, name: 'wf', active: true }),
		getExecutionId: () => executionId,
		helpers: { getSecureEgressFilter: () => undefined },
		logger: { debug() {}, info() {}, warn() {}, error() {} },
	};
}

async function model(c) {
	const out = await new NiyoosChatModel().supplyData.call(c, 0);
	return out.response;
}

test('the model points at Niyoos with the agent key and stamps the client', async () => {
	const m = await model(ctx());
	assert.equal(m.model, 'claude-haiku-4-5');
	assert.equal(m.clientConfig.baseURL, 'https://api.niyoos.example/proxy/v1');
	assert.equal(m.clientConfig.defaultHeaders['x-niyoos-client'], 'n8n');
	assert.equal(m.apiKey, 'sk-aiwos-test-not-real');
});

test('every call of the execution carries the composed run id', async () => {
	const m = await model(ctx());
	assert.equal(m.clientConfig.defaultHeaders['x-niyoos-run-id'], 'n8n-QYGcTv9Q12nsflWq-7');
	assert.equal(m.clientConfig.defaultHeaders['x-niyoos-step'], undefined);
	assert.equal(m.clientConfig.defaultHeaders['x-niyoos-parent-run-id'], undefined);
});

test('no execution id: no run header at all', async () => {
	const m = await model(ctx({ executionId: '' }));
	assert.equal('x-niyoos-run-id' in m.clientConfig.defaultHeaders, false);
});

test('chat completions, never the Responses API', async () => {
	const m = await model(ctx());
	assert.equal(m.useResponsesApi, false);
});

test('options pass through, and -1 tokens means unset', async () => {
	const m = await model(ctx({ options: { maxTokens: -1, temperature: 0.2, maxRetries: 4 } }));
	assert.equal(m.maxTokens, undefined);
	assert.equal(m.temperature, 0.2);
	assert.equal(m.caller.maxRetries, 4);
});

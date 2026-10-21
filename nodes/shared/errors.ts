/**
 * Niyoos governance refusals, said out loud.
 *
 * Niyoos answers every refusal with the OpenAI error envelope
 * {"error": {"message", "type", "code"}}. Without a mapping, a refusal reaches
 * n8n as a bare HTTP status — "Forbidden - perhaps check your credentials?" for
 * a kill-switched agent — and the user is never told which Niyoos setting to
 * change. This module turns every code Niyoos can answer with into a sentence
 * that says what happened and what to do about it.
 *
 * It is pure and imports nothing, so the tests can load it without n8n.
 *
 * WHERE THE CODES COME FROM. The set of codes is the backend's ERROR_SPECS,
 * carried into this repository as `contract/niyoos-contract.json`. The test
 * suite asserts this module's vocabulary and the contract are the SAME set in
 * both directions, so a code added to Niyoos fails this package's tests rather
 * than falling through to n8n's generic message. The contract's own agreement
 * with the backend is checked in the Niyoos repository.
 *
 * The explanations below are the same wording as the unreleased 0.2.0 of this
 * package; their tone matches the Zapier app's so two connectors never tell a
 * customer two different stories about one refusal.
 */

/** Every member of the backend's ProxyErrorCode, mirrored. Kept in sync by the set-equality
 *  assertion against the contract in test/errors.test.mjs, not by anyone remembering. */
export type NiyoosErrorCode =
	| 'CALLER_KEY_INVALID'
	| 'CALLER_REQUEST_REJECTED'
	| 'CALLER_ENDPOINT_MALFORMED'
	| 'CONFIG_PROVIDER_KEY_REJECTED'
	| 'CONFIG_PROVIDER_KEY_MISSING'
	| 'CONFIG_CREDENTIAL_DISABLED'
	| 'CONFIG_CREDENTIAL_REVOKED'
	| 'CONFIG_ENDPOINT_BLOCKED'
	| 'CONFIG_PROVIDER_MISCONFIGURED'
	| 'CONFIG_PROVIDER_QUOTA_EXHAUSTED'
	| 'POLICY_AGENT_DISABLED'
	| 'POLICY_COST_LIMIT_REACHED'
	| 'GATEWAY_RATE_LIMIT'
	| 'GATEWAY_CREDENTIAL_THROTTLED'
	| 'GATEWAY_TIMEOUT'
	| 'GATEWAY_RESPONSE_TOO_LARGE'
	| 'GATEWAY_INTERNAL_ERROR'
	| 'PROVIDER_RATE_LIMITED'
	| 'PROVIDER_UNAVAILABLE'
	| 'UPSTREAM_UNREACHABLE';

/**
 * What happened, and what to do about it — in the words of someone who has
 * never heard of a wire code.
 */
export const NIYOOS_EXPLANATIONS: Record<NiyoosErrorCode, string> = {
	CALLER_KEY_INVALID:
		'Niyoos rejected this agent key: it is invalid, has been revoked, or its agent was deleted. Open the Niyoos credential in n8n and paste a current agent key from the Niyoos dashboard.',

	CALLER_REQUEST_REJECTED:
		'The provider rejected this request as invalid — most often an unknown model name, or an option outside the range it accepts. Niyoos passed the request through unchanged and did not judge it. Check the Model field and the values under Options, then run the workflow again.',

	CALLER_ENDPOINT_MALFORMED:
		'Niyoos refused the shape of this request\'s URL before it reached the provider: the proxy path must be spelled canonically — no doubled slashes, no percent-encoded separators, no "." or ".." segments. In n8n this almost always means the Base URL in the Niyoos credential carries a trailing slash or an extra path segment. Correct it to exactly https://api.niyoos.com/proxy/v1 (or your deployment\'s equivalent) and run the workflow again.',

	CONFIG_PROVIDER_KEY_REJECTED:
		'The upstream provider rejected the provider key configured for this Niyoos agent. Replace that key in the Niyoos dashboard — retrying will not help, and your Niyoos agent key itself is valid.',

	CONFIG_PROVIDER_KEY_MISSING:
		'This Niyoos agent has no provider credential assigned, so there is nothing for Niyoos to call on your behalf. Assign one to the agent in the Niyoos dashboard, then run the workflow again.',

	CONFIG_CREDENTIAL_DISABLED:
		'The provider credential assigned to this Niyoos agent is disabled. Re-enable or replace it in the Niyoos dashboard, then run the workflow again.',

	CONFIG_CREDENTIAL_REVOKED:
		'The provider credential assigned to this Niyoos agent has been revoked and cannot be used again. Assign a new credential to the agent in the Niyoos dashboard.',

	CONFIG_ENDPOINT_BLOCKED:
		'Niyoos refused to call the custom provider endpoint configured for this agent, because that address is not one Niyoos is permitted to reach. Correct the endpoint URL on the provider credential in the Niyoos dashboard.',

	CONFIG_PROVIDER_MISCONFIGURED:
		"This Niyoos agent's provider settings are incomplete or inconsistent, so the request never reached a provider at all. Review the agent's provider credential in the Niyoos dashboard — retrying unchanged will not help.",

	CONFIG_PROVIDER_QUOTA_EXHAUSTED:
		"The provider account behind this Niyoos agent's provider key has run out of credit or quota. Open that provider's own billing console and add credit or raise the quota — running the workflow again will not help until you do. Your Niyoos agent key and your n8n credential are both fine.",

	POLICY_AGENT_DISABLED:
		'This Niyoos agent is disabled (kill switch). Re-enable it in the Niyoos dashboard before running this workflow again.',

	POLICY_COST_LIMIT_REACHED:
		'This Niyoos agent has reached the spending limit set for it, so Niyoos stopped the request before any provider was called. Raise or reset that limit in the Niyoos dashboard — waiting will not clear it on its own.',

	GATEWAY_RATE_LIMIT:
		'Niyoos is rate-limiting this agent key: too many requests arrived in a short window. Wait about a minute and run the workflow again, or slow it down. This limit belongs to Niyoos and is not one you can change in the dashboard.',

	GATEWAY_CREDENTIAL_THROTTLED:
		'Niyoos is throttling the provider credential this agent uses, because too many requests are sharing it at once. Wait about a minute and try again, or spread the load across more credentials.',

	GATEWAY_TIMEOUT:
		'Niyoos stopped waiting for the provider before a response arrived. This is the Niyoos deadline rather than a provider failure — and because the request had already been sent, the provider may have completed it and billed you for it. Raise Timeout under Options, or shorten the prompt, before retrying.',

	GATEWAY_RESPONSE_TOO_LARGE:
		'The provider sent back a response larger than Niyoos will relay, so Niyoos refused it rather than truncating it. Nothing was recorded as billable. This is almost always a model asked for a very long output, or a streaming response that never ended. Check the requested output length — a lower max_tokens — or narrow the prompt, then retry.',

	GATEWAY_INTERNAL_ERROR:
		'Niyoos itself failed while handling this request. Nothing in your workflow or your Niyoos settings caused it. Retry, and if it keeps happening contact Niyoos support with the time of the run.',

	PROVIDER_RATE_LIMITED:
		'The upstream provider rate-limited this request. The limit belongs to the provider account behind this agent credential, not to Niyoos. Wait a short while and run the workflow again, or raise the quota with the provider.',

	PROVIDER_UNAVAILABLE:
		'The upstream provider is down or returned an error of its own. Niyoos reached it and it failed. Wait and retry — there is nothing to change in n8n or in the Niyoos dashboard.',

	UPSTREAM_UNREACHABLE:
		'Niyoos could not reach the upstream provider at all: the connection never completed, so it is not known whether the network or the provider is at fault. Wait and retry, and if it persists check the status page of the provider.',
};

/**
 * The two codes whose backend message carries detail the explanation cannot
 * know — the provider's own words for a rejected request, and the customer's
 * own blocked URL. For those, and only those, the server's sanitized
 * message is appended rather than discarded.
 */
const DETAIL_BEARING: ReadonlyArray<NiyoosErrorCode> = [
	'CALLER_REQUEST_REJECTED',
	'CONFIG_ENDPOINT_BLOCKED',
];

export function isNiyoosErrorCode(value: unknown): value is NiyoosErrorCode {
	return (
		typeof value === 'string' &&
		Object.prototype.hasOwnProperty.call(NIYOOS_EXPLANATIONS, value)
	);
}

/** The OpenAI error envelope Niyoos answers with, as far as we read it. */
export interface NiyoosEnvelope {
	code?: string;
	message?: string;
}

/**
 * Pull {code, message} out of a Niyoos envelope, from a parsed object or from
 * raw text. Returns an empty object for anything that is not one — a provider
 * body that reached us unmapped, an HTML error page, a truncated stream.
 */
export function parseNiyoosEnvelope(body: unknown): NiyoosEnvelope {
	let data: unknown = body;
	if (typeof data === 'string') {
		try {
			data = JSON.parse(data);
		} catch {
			return {};
		}
	}
	if (!data || typeof data !== 'object') return {};
	const err = (data as { error?: unknown }).error;
	if (!err || typeof err !== 'object') return {};
	const e = err as { code?: unknown; message?: unknown };
	return {
		code: typeof e.code === 'string' ? e.code : undefined,
		message: typeof e.message === 'string' ? e.message : undefined,
	};
}

/**
 * The whole mapping, as one pure function: envelope in, readable sentence out,
 * `null` when this is not a Niyoos governance refusal we recognise. `null` is
 * the signal to leave the original error exactly as it was — we never invent an
 * explanation for a code we do not know.
 */
export function explainNiyoosEnvelope(envelope: NiyoosEnvelope): string | null {
	const { code, message } = envelope;
	if (!isNiyoosErrorCode(code)) return null;

	const explanation = NIYOOS_EXPLANATIONS[code];
	const detail = typeof message === 'string' ? message.trim() : '';
	if (detail.length > 0 && DETAIL_BEARING.indexOf(code) !== -1) {
		return explanation + ' (Niyoos reported: ' + detail + ')';
	}
	return explanation;
}

/** What `explainNiyoosThrownError` recovered from a thrown error. */
export interface NiyoosThrownExplanation {
	code: NiyoosErrorCode;
	explanation: string;
	/** The server's own sanitized message, kept for the error description. */
	serverMessage?: string;
}

/**
 * Recover a Niyoos refusal from a thrown error. Used on every path: n8n's
 * httpRequestWithAuthentication (the model list, Get Agent) and the OpenAI
 * client's APIError (the chat model, via onFailedAttempt) put the response body
 * in different places, so every place one has been observed is searched rather
 * than one being assumed.
 * Returns `null` for anything that is not a Niyoos refusal — the caller must
 * then re-throw the original error untouched.
 */
export function explainNiyoosThrownError(
	error: unknown,
): NiyoosThrownExplanation | null {
	for (const candidate of candidateBodies(error)) {
		const envelope = parseNiyoosEnvelope(candidate);
		const explanation = explainNiyoosEnvelope(envelope);
		if (explanation !== null && isNiyoosErrorCode(envelope.code)) {
			return {
				code: envelope.code,
				explanation,
				serverMessage: envelope.message,
			};
		}
	}
	return null;
}

/** Every place a thrown HTTP error has been seen to carry its response body. */
function candidateBodies(error: unknown): unknown[] {
	if (!error || typeof error !== 'object') return [];
	const e = error as Record<string, unknown>;
	const response = e.response as Record<string, unknown> | undefined;
	const cause = e.cause as Record<string, unknown> | undefined;
	return [
		e,
		e.error,
		e.errorResponse,
		e.body,
		e.responseBody,
		response?.data,
		response?.body,
		response,
		cause,
		cause?.error,
	];
}

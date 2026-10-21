import { NodeApiError, type INode, type JsonObject } from 'n8n-workflow';

import { explainNiyoosThrownError } from './errors';

/**
 * Where a Niyoos refusal is turned into a readable message on the chat-model
 * path.
 *
 * The chat model makes no request itself: the root node (AI Agent, Basic LLM
 * Chain) calls it later, through the client n8n builds in `supplyModel`. That
 * client's transport is n8n's, not ours, so the one seam left is the
 * `onFailedAttempt` hook, which n8n calls on every failed attempt.
 *
 * TWO n8n BEHAVIOURS DECIDE HOW THIS IS WRITTEN:
 *
 * 1. n8n wraps whatever this hook throws in a NodeApiError — and a NodeApiError
 *    built without an explicit message REPLACES the text with a generic phrase
 *    for its HTTP status ("Forbidden - perhaps check your credentials?"). An
 *    existing NodeApiError is passed through untouched. So this hook throws a
 *    NodeApiError of its own, with the explanation as its message.
 *
 * 2. The message is rewritten ONLY when the error will not be retried: a
 *    status that is never retried, or no retries left. Rewriting earlier would
 *    end a retry that would otherwise have happened. When the retry loop does
 *    not say how many retries are left (`retriesLeft` absent, as on current
 *    LangChain), n8n's own handler stops on that attempt anyway, so the error is
 *    final and is rewritten.
 *
 * Errors that are not Niyoos refusals are left alone: the hook returns and
 * n8n's own handling proceeds exactly as it would without this package.
 */

/** Statuses neither LangChain's retry loop nor n8n's own handler ever retry. */
const STATUS_NO_RETRY = [400, 401, 402, 403, 404, 405, 406, 407, 409];

export function statusOf(error: unknown): number | undefined {
	if (!error || typeof error !== 'object') return undefined;
	const e = error as { status?: unknown; response?: { status?: unknown }; httpCode?: unknown };
	for (const candidate of [e.status, e.response?.status, e.httpCode]) {
		const n = typeof candidate === 'string' ? Number(candidate) : candidate;
		if (typeof n === 'number' && Number.isInteger(n) && n >= 100 && n <= 599) return n;
	}
	return undefined;
}

/** True only when the retry loop will try this request again. */
export function willBeRetried(error: unknown): boolean {
	const status = statusOf(error);
	if (status !== undefined && STATUS_NO_RETRY.indexOf(status) !== -1) return false;
	const left = (error as { retriesLeft?: unknown } | null)?.retriesLeft;
	return typeof left === 'number' && left > 0;
}

export function makeNiyoosFailedAttemptHandler(getNode: () => INode): (error: unknown) => void {
	return (error: unknown): void => {
		const explained = explainNiyoosThrownError(error);
		if (explained === null) return;
		if (willBeRetried(error)) return;
		const status = statusOf(error);
		throw new NodeApiError(getNode(), error as JsonObject, {
			message: explained.explanation,
			description: explained.serverMessage,
			httpCode: status === undefined ? undefined : String(status),
			functionality: 'configuration-node',
		});
	};
}

/**
 * The Niyoos wire values this package sends. Pure, imports nothing.
 *
 * Every value here is also in `contract/niyoos-contract.json`, and the test
 * suite fails if the two disagree. The contract itself is checked against the
 * Niyoos backend in the Niyoos repository.
 */

/** Identifies this connector to Niyoos, so its traffic is counted as n8n. */
export const CLIENT_HEADER = 'x-niyoos-client';
export const CLIENT_VALUE = 'n8n';

/** The run label. Niyoos records it beside every request of the run. */
export const RUN_ID_HEADER = 'x-niyoos-run-id';

/**
 * What Niyoos accepts as a run id. A request carrying anything else is REFUSED
 * (the call fails), so nothing that fails this pattern is ever sent.
 */
export const RUN_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

/** The form used when the readable one cannot fit: `n8n-h-` + 16 hex digits. */
const HASH_PREFIX = 'n8n-h-';

/**
 * Two independent 32-bit FNV-1a passes, concatenated: 64 bits of a stable,
 * dependency-free hash. Not cryptographic and not meant to be — a run id is a
 * label, and its only job here is to be deterministic for one execution and
 * unlikely to collide with another.
 */
function hash64(text: string): string {
	let a = 0x811c9dc5;
	let b = 0x01000193 ^ 0x5bd1e995;
	for (let i = 0; i < text.length; i++) {
		const c = text.charCodeAt(i);
		a = Math.imul(a ^ c, 0x01000193) >>> 0;
		b = Math.imul(b ^ c, 0x01000193 ^ 0x2f) >>> 0;
	}
	return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}

/**
 * The run id for one n8n execution: `n8n-<workflowId>-<executionId>`.
 *
 * n8n execution ids are per-instance integers that start at 1, so a bare one
 * is usually shorter than Niyoos's 8-character minimum and would be refused.
 * The workflow id makes it long enough and keeps two n8n instances in one
 * organisation from colliding.
 *
 * If that form does not fit the pattern — an unusual character, or longer than
 * 64 — the deterministic hash form is used instead, so the same execution
 * always gets the same id. Returns `null`, meaning "send no run header", only
 * when there is no execution id to label with at all.
 */
export function composeRunId(workflowId: unknown, executionId: unknown): string | null {
	const exec = typeof executionId === 'string' || typeof executionId === 'number' ? String(executionId) : '';
	if (exec.length === 0) return null;
	const wf = typeof workflowId === 'string' || typeof workflowId === 'number' ? String(workflowId) : '';

	const readable = `n8n-${wf}-${exec}`;
	if (wf.length > 0 && RUN_ID_PATTERN.test(readable)) return readable;

	const hashed = HASH_PREFIX + hash64(`${wf}\u0000${exec}`);
	// Unreachable by construction (fixed prefix + 16 hex), checked anyway: an id
	// that fails the pattern must never leave this function.
	return RUN_ID_PATTERN.test(hashed) ? hashed : null;
}

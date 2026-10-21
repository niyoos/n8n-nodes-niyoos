import {
	NodeApiError,
	NodeConnectionTypes,
	NodeOperationError,
	type ILoadOptionsFunctions,
	type INodePropertyOptions,
	type INodeType,
	type INodeTypeDescription,
	type ISupplyDataFunctions,
	type JsonObject,
	type SupplyData,
} from 'n8n-workflow';

import { explainNiyoosThrownError } from '../shared/errors';
import { makeNiyoosFailedAttemptHandler } from '../shared/failedAttempt';
import { CLIENT_HEADER, CLIENT_VALUE, RUN_ID_HEADER, composeRunId } from '../shared/wire';

type ModelOptions = {
	maxTokens?: number;
	maxRetries?: number;
	temperature?: number;
	timeout?: number;
	topP?: number;
};

export const SDK_MISSING_MESSAGE =
	'The Niyoos Chat Model needs n8n 2.16 or newer. Update n8n, or install n8n-nodes-niyoos 0.1.x, which is the version for older n8n releases.';

/**
 * A chat model served through Niyoos. Niyoos speaks the OpenAI chat-completions
 * format, so n8n's own OpenAI-compatible model (built by `supplyModel` from
 * @n8n/ai-node-sdk) drives it directly — pointed at the Niyoos base URL, with
 * the agent key as its API key. This package ships no model client of its own.
 *
 * Node name and parameters are unchanged from 0.1.x, so existing workflows keep
 * loading after an upgrade.
 */
export class NiyoosChatModel implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Niyoos Chat Model',
		name: 'niyoosChatModel',
		icon: { light: 'file:../../icons/niyoos.svg', dark: 'file:../../icons/niyoos.dark.svg' },
		group: ['transform'],
		version: [1],
		description: 'Language model served through Niyoos, which governs and records every call',
		subtitle: '={{ $parameter["model"] }}',
		defaults: {
			name: 'Niyoos Chat Model',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Language Models', 'Root Nodes'],
				'Language Models': ['Chat Models (Recommended)'],
			},
			resources: {
				primaryDocumentation: [{ url: 'https://github.com/niyoos/n8n-nodes-niyoos#readme' }],
			},
		},
		inputs: [],
		outputs: [NodeConnectionTypes.AiLanguageModel],
		outputNames: ['Model'],
		credentials: [
			{
				name: 'niyoosApi',
				required: true,
			},
		],
		properties: [
			{
				displayName:
					'Every call is sent through Niyoos, which applies this agent\'s kill switch and spending limit and records the call in its audit log.',
				name: 'notice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Model Name or ID',
				name: 'model',
				type: 'options',
				description:
					'The model to use, loaded from your Niyoos agent. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				typeOptions: {
					loadOptionsMethod: 'getModels',
				},
				default: '',
				required: true,
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Maximum Number of Tokens',
						name: 'maxTokens',
						type: 'number',
						default: -1,
						description:
							'The maximum number of tokens to generate in the completion. -1 lets the model decide.',
						typeOptions: { minValue: -1 },
					},
					{
						displayName: 'Maximum Retries',
						name: 'maxRetries',
						type: 'number',
						default: 2,
						description: 'Maximum number of times to retry a failing request',
						typeOptions: { minValue: 0 },
					},
					{
						displayName: 'Sampling Temperature',
						name: 'temperature',
						type: 'number',
						default: 0.7,
						description:
							'Controls randomness: lowering results in less random completions. As the temperature approaches zero, the model becomes deterministic and repetitive.',
						typeOptions: { minValue: 0, maxValue: 2, numberPrecision: 2 },
					},
					{
						displayName: 'Timeout (Ms)',
						name: 'timeout',
						type: 'number',
						default: 60000,
						description: 'Maximum amount of time a request is allowed to take, in milliseconds',
						typeOptions: { minValue: 1 },
					},
					{
						displayName: 'Top P',
						name: 'topP',
						type: 'number',
						default: 1,
						description:
							'Controls diversity via nucleus sampling: 0.5 means half of all likelihood-weighted options are considered. We generally recommend altering this or temperature but not both.',
						typeOptions: { minValue: 0, maxValue: 1, numberPrecision: 2 },
					},
				],
			},
		],
	};

	methods = {
		loadOptions: {
			// The models this agent's provider offers, from Niyoos's model list.
			async getModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const credentials = await this.getCredentials('niyoosApi');
				const baseUrl = String(credentials.baseUrl ?? '').replace(/\/+$/, '');

				let response: { data?: Array<{ id?: string }> };
				try {
					response = (await this.helpers.httpRequestWithAuthentication.call(this, 'niyoosApi', {
						method: 'GET',
						url: `${baseUrl}/models`,
						headers: { [CLIENT_HEADER]: CLIENT_VALUE },
						json: true,
					})) as { data?: Array<{ id?: string }> };
				} catch (error) {
					const explained = explainNiyoosThrownError(error);
					// Not a Niyoos refusal: n8n's own handling. (An error that is already a
					// NodeApiError is returned unchanged by this constructor.)
					if (explained === null) throw new NodeApiError(this.getNode(), error as JsonObject);
					throw new NodeApiError(this.getNode(), error as JsonObject, {
						message: explained.explanation,
						description: explained.serverMessage,
					});
				}

				const models = Array.isArray(response?.data) ? response.data : [];
				return models
					.map((m) => m?.id)
					.filter((id): id is string => typeof id === 'string' && id.length > 0)
					.map((id) => ({ name: id, value: id }))
					.sort((a, b) => a.name.localeCompare(b.name));
			},
		},
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		// Loaded on demand so an n8n too old to ship the SDK gets a sentence that
		// says so, instead of the package failing to load at all.
		let sdk: typeof import('@n8n/ai-node-sdk');
		try {
			sdk = await import('@n8n/ai-node-sdk');
		} catch {
			throw new NodeOperationError(this.getNode(), SDK_MISSING_MESSAGE, { itemIndex });
		}

		const credentials = await this.getCredentials('niyoosApi');
		const model = this.getNodeParameter('model', itemIndex) as string;
		const options = this.getNodeParameter('options', itemIndex, {}) as ModelOptions;

		// One run per n8n execution, so every model call of this execution is
		// grouped in Niyoos. composeRunId never returns an id Niyoos would refuse.
		const headers: Record<string, string> = { [CLIENT_HEADER]: CLIENT_VALUE };
		const runId = composeRunId(this.getWorkflow().id, this.getExecutionId());
		if (runId !== null) headers[RUN_ID_HEADER] = runId;

		return sdk.supplyModel(this, {
			type: 'openai',
			baseUrl: String(credentials.baseUrl ?? '').replace(/\/+$/, ''),
			apiKey: credentials.agentApiKey as string,
			model,
			defaultHeaders: headers,
			// Niyoos serves chat completions only.
			useResponsesApi: false,
			temperature: options.temperature,
			topP: options.topP,
			// -1 means "unset": the model's own default applies.
			maxTokens: options.maxTokens === undefined || options.maxTokens === -1 ? undefined : options.maxTokens,
			timeout: options.timeout,
			maxRetries: options.maxRetries ?? 2,
			onFailedAttempt: makeNiyoosFailedAttemptHandler(() => this.getNode()),
		});
	}
}

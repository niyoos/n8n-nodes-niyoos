import {
	NodeApiError,
	NodeConnectionTypes,
	NodeOperationError,
	type IDataObject,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
	type JsonObject,
} from 'n8n-workflow';

import { explainNiyoosThrownError } from '../shared/errors';
import { CLIENT_HEADER, CLIENT_VALUE } from '../shared/wire';

/**
 * Niyoos itself, as an action node. One operation in this version: Get Agent,
 * which reports the agent the credential's key belongs to — its name, its
 * organisation and its status — so a workflow can check that the agent is
 * active before it starts spending.
 */
export class Niyoos implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Niyoos',
		name: 'niyoos',
		icon: { light: 'file:../../icons/niyoos.svg', dark: 'file:../../icons/niyoos.dark.svg' },
		group: ['transform'],
		version: [1],
		subtitle: '={{ $parameter["operation"] }}',
		description: 'Read the status of your Niyoos-governed AI agent',
		defaults: {
			name: 'Niyoos',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'niyoosApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Get Agent',
						value: 'getAgent',
						description: 'Get the name, organisation and status of the agent this key belongs to',
						action: 'Get the agent',
					},
				],
				default: 'getAgent',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const out: INodeExecutionData[] = [];
		const credentials = await this.getCredentials('niyoosApi');
		// The identity endpoint is at the deployment root, not under /proxy/v1.
		const origin = String(credentials.baseUrl ?? '').split('/proxy')[0].replace(/\/+$/, '');

		for (let i = 0; i < items.length; i++) {
			try {
				const operation = this.getNodeParameter('operation', i) as string;
				if (operation !== 'getAgent') {
					throw new NodeOperationError(this.getNode(), `Unsupported operation: ${operation}`, { itemIndex: i });
				}
				let agent: IDataObject;
				try {
					agent = (await this.helpers.httpRequestWithAuthentication.call(this, 'niyoosApi', {
						method: 'GET',
						url: `${origin}/integrations/v1/me`,
						headers: { [CLIENT_HEADER]: CLIENT_VALUE },
						json: true,
					})) as IDataObject;
				} catch (error) {
					const explained = explainNiyoosThrownError(error);
					// Not a Niyoos refusal: n8n's own handling. (An error that is already a
					// NodeApiError is returned unchanged by this constructor.)
					if (explained === null) throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
					throw new NodeApiError(this.getNode(), error as JsonObject, {
						message: explained.explanation,
						description: explained.serverMessage,
						itemIndex: i,
					});
				}
				out.push({ json: agent, pairedItem: { item: i } });
			} catch (error) {
				if (this.continueOnFail()) {
					out.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				// Already a NodeApiError (the explained refusal): returned unchanged.
				throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
			}
		}
		return [out];
	}
}

import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	Icon,
	INodeProperties,
} from 'n8n-workflow';

/**
 * The Niyoos agent key. Name and fields are unchanged from 0.1.x, so a
 * credential saved by an earlier version keeps working after an upgrade.
 */
export class NiyoosApi implements ICredentialType {
	name = 'niyoosApi';

	displayName = 'Niyoos API';

	documentationUrl = 'https://github.com/niyoos/n8n-nodes-niyoos#credentials';

	icon: Icon = { light: 'file:../icons/niyoos.svg', dark: 'file:../icons/niyoos.dark.svg' };

	properties: INodeProperties[] = [
		{
			displayName: 'Agent Key',
			name: 'agentApiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Your Niyoos agent key (starts with "sk-aiwos-"). Create one in the Niyoos dashboard under Agents.',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.niyoos.com/proxy/v1',
			description:
				'Base URL of the Niyoos proxy. Change this only to target a self-hosted or staging Niyoos deployment.',
		},
	];

	// The agent key rides as an OpenAI-style Bearer token, and every request n8n
	// makes with this credential identifies itself as the n8n connector.
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.agentApiKey}}',
				'x-niyoos-client': 'n8n',
			},
		},
	};

	// The identity endpoint lives at the deployment root, not under /proxy/v1,
	// so the origin is everything before "/proxy". A 200 proves the key belongs
	// to an existing agent.
	test: ICredentialTestRequest = {
		request: {
			method: 'GET',
			baseURL: '={{$credentials.baseUrl.split("/proxy")[0]}}',
			url: '/integrations/v1/me',
		},
	};
}

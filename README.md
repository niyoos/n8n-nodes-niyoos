# n8n-nodes-niyoos

<!-- DRAFT COPY (intro and node descriptions) — awaiting approval before publishing. -->

**Put your n8n AI agents under governance.** [Niyoos](https://niyoos.com) sits between your
workflows and your AI providers. Every model call your AI Agent makes goes through Niyoos,
which can stop an agent instantly with a kill switch, hold it to a spending limit, and seal a
record of each call — cost, model and timing, never the prompt text — in a tamper-evident audit
log. Your provider keys stay encrypted inside Niyoos; n8n only ever holds a per-agent Niyoos key.

This package gives n8n two nodes:

- **Niyoos Chat Model** — the model for your AI Agent, Basic LLM Chain or any node with a Chat
  Model input. Each workflow execution is recorded in Niyoos as one run, with no setup.
- **Niyoos** (action) — **Get Agent**: the name, organisation and status of your agent, so a
  workflow can check the agent is active before it starts.

[Installation](#installation) · [Credentials](#credentials) · [Usage](#usage) ·
[Runs](#runs) · [When Niyoos stops a call](#when-niyoos-stops-a-call) ·
[Compatibility](#compatibility) · [Development](#development) · [License](#license)

## Installation

Follow n8n's [community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation/)
and install **`n8n-nodes-niyoos`**.

## Credentials

Create a **Niyoos API** credential:

| Field | What to enter |
|---|---|
| Agent Key | Your Niyoos agent key, starting `sk-aiwos-`. In the Niyoos dashboard, open **Agents**, pick or create an agent, and copy its key. |
| Base URL | Leave as `https://api.niyoos.com/proxy/v1` unless you run your own Niyoos deployment. |

The connection test checks the key against Niyoos and passes when it belongs to an existing
agent. Each Niyoos agent is bound to one provider credential, so the model list shows that
provider's models. To use another provider, create another agent and another credential.

## Usage

1. Add an **AI Agent** (or any node with a Chat Model input).
2. Connect a **Niyoos Chat Model** to its Chat Model input.
3. Choose your **Niyoos API** credential and a model, then run the workflow.

## Runs

Every model call carries a run id, `n8n-<workflowId>-<executionId>`, so all the calls one
workflow execution makes are grouped as one run in Niyoos. Nothing needs configuring.

## When Niyoos stops a call

When Niyoos refuses a call, the node tells you why and what to change — for example:

| What happened | What the node says |
|---|---|
| The agent's kill switch is on | *This Niyoos agent is disabled (kill switch). Re-enable it in the Niyoos dashboard before running this workflow again.* |
| The agent reached its spending limit | *This Niyoos agent has reached the spending limit set for it, so Niyoos stopped the request before any provider was called. …* |
| The provider rejected the stored key | *The upstream provider rejected the provider key configured for this Niyoos agent. …* |

Every refusal Niyoos can return has its own explanation. If n8n is going to retry a call, the
retry is left to happen and the explanation is shown only once the call has failed for good.

## Compatibility

- **n8n 2.16 or newer** for version 1.x of this package. On an older n8n the chat model says so
  when the workflow runs.
- On n8n 1.x, or n8n 2.x before 2.16, install **`n8n-nodes-niyoos@0.1.x`**.
- No runtime dependencies: n8n supplies the model client.

## Development

```bash
npm ci
npm run lint
npm test        # builds, then runs the test suite against the built package
```

`contract/niyoos-contract.json` holds the Niyoos wire values this package depends on — every
refusal code, the client header and the run-id rule. The tests fail if the package and the
contract disagree.

## License

[MIT](LICENSE)

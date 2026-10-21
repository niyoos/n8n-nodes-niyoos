# Changelog

## 1.0.0

Rebuilt on n8n's AI node SDK (`@n8n/ai-node-sdk`). **Requires n8n 2.16 or newer.**
On older n8n, keep using 0.1.x.

- **Every call is labelled with its n8n execution.** The chat model sends a run id
  of the form `n8n-<workflowId>-<executionId>`, so all the model calls of one
  workflow execution are grouped together in Niyoos. No setup is needed.
- **Niyoos refusals are explained.** When Niyoos stops a call — the agent's kill
  switch, its spending limit, a revoked provider key and every other refusal —
  the node says what happened and what to change, instead of a bare HTTP status.
- **New action node, Niyoos → Get Agent:** the name, organisation and status of the
  agent your key belongs to.
- **Connector identification:** every request identifies itself as the n8n connector.
- **No runtime dependencies.** The package no longer bundles LangChain; n8n supplies
  the model client.
- Unchanged, so existing workflows keep working: the node (`Niyoos Chat Model`), its
  parameters, and the credential (`Niyoos API`) and its fields.
- **Maximum Retries** now says what is true today: current n8n does not retry AI model
  calls (measured on n8n 2.16.0 and 2.44.4), so the option has no effect. It is kept so
  existing workflows load and so it works if n8n restores retries.
- The README states the n8n 2.16 requirement at the top, with how to stay on 0.1.x.

## 0.1.0

Initial release: Niyoos-governed LLMs as a chat model in n8n, with the model list
loaded from your Niyoos deployment. For n8n 1.x and n8n 2.x before 2.16.

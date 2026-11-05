# Architecture

`apps/cli` and `apps/desktop` are clients. They share `packages/core`, which owns the bounded agent loop, tool dispatch, mode policy, skill context and persistent memory retrieval.

- `providers`: OpenAI-compatible, Anthropic and Google model adapters. NVIDIA NIM and Ollama use the OpenAI-compatible adapter.
- `tools`: project file inspection/search, guarded file writes/edits and shell-free command execution.
- `mcp`: MCP stdio and Streamable HTTP clients. Each tool invocation passes through the approval callback.
- `skills`: loads project and user `SKILL.md` instructions.
- `memory`: local JSON-backed tree, episodic memory, retrieval scoring and approved long-term memory writes.
- `shared`: cross-package message, provider, tool and approval types.

The agent loop is bounded by `maxSteps` (default 12). Tool requests are executed sequentially; tool outputs are appended as tool messages before the next model request. Tool execution failures are returned to the model as tool results rather than silently swallowed.

## Memory lifecycle

1. Retrieve relevant nodes using token overlap and confidence/access weighting.
2. Include selected memories in the system context.
3. Record a redacted episode after the turn.
4. Allow the model to propose stable facts or solutions through `memory_save`; user approval is mandatory.

Memory is a local retrieval store, not model fine-tuning. It should never contain API keys, passwords or sensitive personal information.

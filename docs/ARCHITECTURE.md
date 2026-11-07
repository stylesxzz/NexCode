# Nexo architecture

Nexo is a local-first AI workspace. The browser is only the control surface; the local agent owns workspace access, provider requests, memory and tool execution.

## Runtime and trust boundary

- The agent serves its UI and API on 127.0.0.1 only. It is not a LAN service and does not expose a remote shell.
- Pairing uses a one-time terminal code. The browser stores a random bearer token; local config and provider credentials are written with restrictive file permissions under ~/.nexo.
- The browser cannot execute commands. It sends a request to the authenticated local agent, which validates workspace boundaries and starts child processes itself.
- The selected workspace is the directory from which the agent was started, or the optional path argument.
- Commands run as direct child processes without an implicit shell, with bounded output and timeout. File operations are constrained to the workspace.
- Guided mode asks for approval on every mutation and command. Workspace autonomy is an explicit user-selected mode for routine actions inside the selected workspace. MCP startup/tool calls, SSH/SCP, privilege escalation and destructive system operations always require a separate approval.
- Loopback binding, same-origin checks, bearer authentication and a small request-body limit protect the local API. Keep the browser and agent on the same device.

## Providers

Native adapters are used for OpenAI, Anthropic and Google Gemini. NVIDIA NIM, Ollama and OpenAI-compatible endpoints share the OpenAI-compatible adapter. The catalog also includes OpenRouter, Groq, DeepSeek, Mistral, Together AI, Fireworks, Cerebras, xAI, Perplexity and Cohere-compatible endpoints. Each provider requires its own API key, model identifier and (where applicable) endpoint. Provider presence in the catalog is not a guarantee that every model supports tool calling.

## Skills, MCP and memory

- Skills are Markdown instructions. GitHub installation accepts only HTTPS links to a SKILL.md file; it does not run repository scripts.
- MCP servers use the existing stdio transport. Their startup and every MCP tool action remain approval-gated. Remove a server in Integrations to disconnect it.
- Memory is a local graph stored in ~/.nexo/memory.json. Recent and keyword-relevant nodes are retrieved as context. The graph is inspectable and resettable by deleting that file. This is retrieval over saved notes, not model training or automatic weight updates.
- SCP uses SSH transport and is not an email verification protocol. An email-based verification step needs a separately configured mail/OTP integration; do not put SMTP secrets into a skill file.

## Supported platforms

Node.js 22.12+ runs the local agent on Kali/Linux, macOS, Windows and Termux. Termux requires a recent Node.js build. The browser may be a desktop or mobile browser on the same device.

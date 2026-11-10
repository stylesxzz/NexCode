# NEXCODE Workflow Automation (initial foundation)

NEXCODE is adding a self-hosted workflow automation subsystem, inspired by node-based automation platforms. It is TypeScript/Node.js-first and designed to coexist with the coding-agent CLI.

## Current foundation

- A typed workflow graph contract: trigger, HTTP, condition, transform, code, AI and delay nodes.
- Graph validation (unique node IDs, valid edges and cycle detection).
- Deterministic topological execution with per-node running/success/error events.
- An initial catalog of 32 integration definitions spanning communication, productivity, AI, developer tools, databases, commerce, payments and storage.
- A lightweight visual node editor prototype served by the automation app (drag nodes, connect ports, edit JSON configuration, save and run). It is not yet a full React Flow editor.
- A small HTTP control plane for health, workflow definitions, integration catalog and execution controls.
- Docker Compose deployment with health checks and `restart: unless-stopped`.

The catalog is a starting registry, not a claim that 32 production-ready adapters or OAuth implementations are complete. Each connector still needs its provider API adapter, credential lifecycle, pagination, retries, rate limits and tests.

## Run with Docker

```bash
cp .env.automations.example .env
# Set NEXCODE_AUTOMATIONS_TOKEN to a long random secret in .env
docker compose up -d --build
docker compose ps
docker compose logs -f nexcode-automations
```

Compose starts the service automatically when the stack is brought up and configures Docker restart policy `unless-stopped` after daemon/host restarts. Stop manually with `docker compose stop`; start with `docker compose start`; disable/re-enable workflow execution through the authenticated control API.

```bash
curl -H "Authorization: Bearer $NEXCODE_AUTOMATIONS_TOKEN" http://127.0.0.1:4280/health
curl -X POST -H "Authorization: Bearer $NEXCODE_AUTOMATIONS_TOKEN" -H 'content-type: application/json' -d '{"action":"disable"}' http://127.0.0.1:4280/api/control
curl -X POST -H "Authorization: Bearer $NEXCODE_AUTOMATIONS_TOKEN" -H 'content-type: application/json' -d '{"action":"enable"}' http://127.0.0.1:4280/api/control
```

The service is bound to loopback by default. Do not expose it publicly without TLS, strong secrets, authorization, rate limiting and a hardened reverse proxy.

## Manual and AI control

The Docker lifecycle remains under the operator's control. A future NEXCODE agent tool can call the authenticated control API to enable/disable workflow execution, create definitions and request runs. AI should never silently start/stop the Docker daemon, change host startup policy or deploy arbitrary workflows. Require an explicit approval for privileged deployment actions and a per-workflow execution policy.

## Custom JavaScript and Python

The graph schema reserves a `code` node with a language setting. Arbitrary user code is **not executed by the initial workflow runner**. Before enabling it, implement an isolated runner (dedicated ephemeral containers or a hardened sandbox), no host mounts, non-root UID, read-only root filesystem, no network by default, CPU/memory/PID/time limits, input/output size caps and explicit secret allowlists. Do not use Node's `vm` as a security boundary.

## Roadmap

1. Visual node editor with React Flow, persisted graph versions and execution inspector.
2. Durable queue, retries, backoff, concurrency limits, idempotency and cron/webhook triggers.
3. Connector SDK and integration marketplace; add and test adapters incrementally toward hundreds.
4. OAuth2 credential vault, encryption at rest and per-connection scopes.
5. Isolated JavaScript/Python runners.
6. Native AI/agent nodes with tool allowlists, budgets, tracing and human approval.
7. Import/export, audit log, RBAC and observability.

## API endpoints (initial)

- `GET /health`
- `GET /api/integrations`
- `GET /api/workflows`
- `POST /api/workflows`
- `POST /api/workflows/:id/run`
- `POST /api/control` with `{"action":"enable"}`, `disable` or `status`

Workflow definitions currently live in process memory and are lost when the service restarts. Trigger, HTTP, condition, transform and delay have basic executors; branch routing, persistent storage, durable scheduling, production connector adapters, AI-node execution and sandboxed code execution are not complete. This is an early foundation, not a finished Zapier replacement.


## Integração na interface Web

A aba **Automações** está dentro do workspace Web principal (porta 4173), separada do Chat. Ela permite adicionar manualmente nós Trigger, HTTP, Condition, Transform e Delay, gerar um rascunho de grafo por IA, revisar configurações, salvar e executar. A API do workspace persiste fluxos em `~/.nexcode/workflows.json`.

A geração por IA usa o endpoint de chat com uma instrução de saída JSON; ela produz um rascunho, não executa automaticamente operações externas. O usuário deve revisar URL, parâmetros e credenciais antes de salvar/executar.

O runtime integrado executa DAGs acíclicos em ordem topológica. A execução inicial cobre Trigger, HTTP (somente HTTPS), Condition, Transform e Delay. Ainda faltam ramificações condicionais reais, repetição, execução isolada de JavaScript/Python, nós de agente de IA com ferramentas, conectores OAuth completos, fila durável e agendamento persistente. O serviço separado `apps/automations` permanece experimental e não é iniciado pelo Compose padrão; a interface principal usa a API integrada do agente Web.

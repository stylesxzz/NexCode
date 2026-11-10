# NEXCODE Workflow Automation

A aba Automações é integrada ao workspace Web do NEXCODE e fica separada do Chat. A experiência principal combina criação manual de nós e geração assistida por IA. O motor e as APIs são Node.js-first e coexistem com a CLI/TUI TypeScript.

## Current foundation

- A typed workflow graph contract: trigger, HTTP, condition, transform, code, AI and delay nodes.
- Graph validation (unique node IDs, valid edges and cycle detection).
- Deterministic topological execution with per-node running/success/error events.
- An initial catalog of 32 integration definitions spanning communication, productivity, AI, developer tools, databases, commerce, payments and storage.
- A editor visual inicial integrado à aba Automações do workspace Web, com adição manual de nós, configuração JSON, conexões sequenciais, geração de rascunho por IA, salvamento persistente e execução dos tipos suportados. Ainda não é um editor React Flow completo.
- A small HTTP control plane for health, workflow definitions, integration catalog and execution controls.
- Docker Compose deployment with health checks and `restart: unless-stopped`.

The catalog is a starting registry, not a claim that 32 production-ready adapters or OAuth implementations are complete. Each connector still needs its provider API adapter, credential lifecycle, pagination, retries, rate limits and tests.

## Run with Docker

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f nexcode-web
```

Compose inicia a aplicação Web principal (Chat + Automações) e configura `restart: unless-stopped`. Após a primeira inicialização, Docker reinicia o container junto com o daemon/host, a menos que o operador o tenha parado manualmente. Use `docker compose stop` e `docker compose start` para controle manual. O serviço independente em `apps/automations` é experimental e não faz parte do Compose padrão.

```bash
curl -H "Authorization: Bearer $NEXCODE_AUTOMATIONS_TOKEN" http://127.0.0.1:4280/health
curl -X POST -H "Authorization: Bearer $NEXCODE_AUTOMATIONS_TOKEN" -H 'content-type: application/json' -d '{"action":"disable"}' http://127.0.0.1:4280/api/control
curl -X POST -H "Authorization: Bearer $NEXCODE_AUTOMATIONS_TOKEN" -H 'content-type: application/json' -d '{"action":"enable"}' http://127.0.0.1:4280/api/control
```

O workspace Web é publicado em loopback por padrão. Não o exponha publicamente sem TLS, autenticação reforçada, rate limiting e proxy reverso endurecido.

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

Os fluxos da aba Web são persistidos em `~/.nexcode/workflows.json`. Trigger, HTTP HTTPS, condition, transform, delay e AI Agent (usando o modelo selecionado, sem ferramentas externas) têm executores iniciais; branch routing, persistent storage, durable scheduling, production connector adapters, AI-node execution and sandboxed code execution are not complete. This is an early foundation, not a finished Zapier replacement.


## Integração na interface Web

A aba **Automações** está dentro do workspace Web principal (porta 4173), separada do Chat. Ela permite adicionar manualmente nós Trigger, HTTP, Condition, Transform e Delay, gerar um rascunho de grafo por IA, revisar configurações, salvar e executar. A API do workspace persiste fluxos em `~/.nexcode/workflows.json`.

A geração por IA usa o endpoint de chat com uma instrução de saída JSON; ela produz um rascunho, não executa automaticamente operações externas. O usuário deve revisar URL, parâmetros e credenciais antes de salvar/executar.

O runtime integrado executa DAGs acíclicos em ordem topológica. A execução inicial cobre Trigger, HTTP (somente HTTPS), Condition, Transform, Delay e AI Agent (modelo configurado, sem tool calling). Ainda faltam ramificações condicionais reais, repetição, execução isolada de JavaScript/Python, nós de agente de IA com ferramentas, conectores OAuth completos, fila durável e agendamento persistente. O serviço separado `apps/automations` permanece experimental e não é iniciado pelo Compose padrão; a interface principal usa a API integrada do agente Web.

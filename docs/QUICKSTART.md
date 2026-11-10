# NEXCODE 0.3 — Quick Start

This guide applies to the TypeScript monorepo and OpenTUI CLI on the `main` branch.

## Requirements

- Git
- Node.js **26.4.0 or newer**
- pnpm **10.20.0**
- Bun **1.3.14 or newer**
- A provider API key (NVIDIA is the default)

The OpenTUI CLI uses Bun to start its terminal UI. Node.js 26.4+ is required by the current OpenTUI runtime.

## Linux / Kali / macOS

```bash
git clone https://github.com/stylesxzz/NexCode.git
cd NexCode
pnpm install --frozen-lockfile
cp .env.example .env
```

Edit `.env` and set a provider, model and API key. For NVIDIA:

```dotenv
NEXCODE_PROVIDER=nvidia
NEXCODE_MODEL=meta/llama-3.3-70b-instruct
NVIDIA_API_KEY=your_key_here
NEXCODE_BASE_URL=https://integrate.api.nvidia.com/v1
```

Build and start:

```bash
pnpm build
pnpm start:cli
```

For development (build affected packages and launch the CLI from source):

```bash
pnpm dev:cli
```

## Windows PowerShell

```powershell
git clone https://github.com/stylesxzz/NexCode.git
Set-Location NexCode
pnpm install --frozen-lockfile
Copy-Item .env.example .env
```

Edit `.env`, then:

```powershell
pnpm build
pnpm start:cli
```

## Termux (Android)

Install Git, Node.js 26.4+, Bun 1.3.14+ and pnpm 10.20.0 using the package sources available for your device. Then run the Linux commands above.

**Termux limitation:** CI currently validates the project on Ubuntu Linux. OpenTUI uses native terminal/FFI components, and Android/Termux support depends on compatible native binaries and terminal capabilities. If the TUI fails while loading its renderer/FFI library, that is a platform runtime limitation, not a problem with the project-import feature.

## Using GitHub import

Start the CLI and select **Development** with F1. Then send a normal message:

```text
Baixe https://github.com/usuario/projeto, analise a arquitetura,
identifique as funcionalidades úteis e proponha como integrar ao NexCode.
```

The agent asks for approval before cloning. The repository is stored under `.nexcode/imports/`. It inventories manifests and source languages without installing dependencies or running repository scripts. Read its README/source and review its license before asking for integration.

## Asking NEXCODE to modify itself

In **Development** mode, say what you want changed in NEXCODE. The agent will:

1. Ask permission to create a separate Git worktree and branch.
2. Refuse if the active checkout has uncommitted changes.
3. Make edits only inside the isolated worktree.
4. Ask permission for each file write and validation command.
5. Show the staged/unstaged diff for review.

The original checkout is not edited by these tools. The agent never merges automatically. After reviewing the diff and test results, merge the generated `nexcode/evolution-*` branch yourself when satisfied. You can also ask the agent to discard the isolated worktree; deletion requires another approval.

## Terminal controls

- F1: Development (workspace tools, GitHub import and self-evolution)
- F2: Planning (read-only planning)
- F3: Ask (no workspace tools)
- F4: local PDF knowledge library
- Y / N: approve or deny a pending action

## Security notes

- Public GitHub HTTPS repositories only; private repository authentication is not implemented by this importer.
- Import is a clone and inventory, not a trusted installation.
- Repository instructions, READMEs, scripts and model output are untrusted data.
- Dependency installation and command execution require approval.
- Approved commands run on the host under the current user's privileges; use a disposable VM/container for untrusted code.
- A dedicated sandbox, license scanner, secret scanner and dependency/SCA scanner are not yet included.


## Self-hosted workflow automation

See [Workflow Automation](WORKFLOW_AUTOMATION.md). Configure `.env` from `.env.automations.example`, set a strong `NEXCODE_AUTOMATIONS_TOKEN`, and run `docker compose up -d --build`. Open `http://127.0.0.1:4280` for the visual editor prototype. Docker uses `restart: unless-stopped`; manual start/stop remains available through `docker compose start` and `docker compose stop`.

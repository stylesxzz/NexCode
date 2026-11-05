# NEXCODE

Assistente de programação com IA, de código aberto e independente de provedor. O monorepo agora contém uma CLI OpenTUI, um núcleo compartilhado, integração com APIs compatíveis com OpenAI e um cliente MCP por stdio.

## O que já está implementado

- Interface de terminal com OpenTUI Core e identidade escura com detalhes verdes.
- Modos `development`, `planning` e `ask`, alternáveis pelas teclas `1`, `2` e `3`.
- Adaptadores nativos Vercel AI SDK para NVIDIA NIM/OpenAI-compatible, OpenAI, Anthropic e Google Gemini.
- Endpoint local Ollama via API OpenAI-compatible.
- Base de cliente MCP usando o SDK oficial e transporte stdio.
- Workspace PNPM com Turbo, TypeScript e testes Vitest.
- A CLI ainda não executa comandos nem altera arquivos; os modos mantêm instruções de segurança no prompt.

## Requisitos

- Git
- Node.js **22.12+** para ferramentas de workspace, TypeScript e PNPM
- pnpm **10.20.0**
- Bun **1.3.14+** para executar a interface OpenTUI. O OpenTUI atual usa FFI nativo no runtime Bun; Node.js requer versão 26.4+ e `--experimental-ffi`.

Confira as versões:

```bash
node --version
pnpm --version
bun --version
git --version
```

## Instalação

### Linux (Ubuntu, Debian, Fedora e derivados)

Instale Git e Node.js 22.12+. Habilite PNPM pelo Corepack:

```bash
corepack enable
corepack prepare pnpm@10.20.0 --activate
```

Instale Bun:

```bash
curl -fsSL https://bun.sh/install | bash
```

Abra um novo terminal e confira as versões.

### Windows (PowerShell)

Instale Node.js 22.12+ e Git. Em seguida:

```powershell
corepack enable
corepack prepare pnpm@10.20.0 --activate
powershell -c "irm bun.sh/install.ps1 | iex"
```

### Termux (Android)

O OpenTUI depende de binários nativos e a compatibilidade do Bun/OpenTUI no Termux/Android não está garantida. Use Linux x86_64/ARM64, macOS ou Windows suportados para executar a TUI. O workspace TypeScript pode ser inspecionado no Termux, mas a interface nativa não está validada nesse ambiente.

## Baixar e instalar o projeto

```bash
git clone https://github.com/stylesxzz/NexCode.git
cd NexCode
pnpm install
```

## Configurar o provedor de IA

Copie o exemplo e preencha sua chave:

```bash
cp .env.example .env
```

Configuração padrão NVIDIA NIM:

```env
NEXCODE_PROVIDER=nvidia
NEXCODE_BASE_URL=https://integrate.api.nvidia.com/v1
NEXCODE_API_KEY=sua_chave
NEXCODE_MODEL=meta/llama-3.3-70b-instruct
```

Para OpenAI, Anthropic ou Gemini, defina `NEXCODE_PROVIDER=openai`, `anthropic` ou `google`, preencha a chave correspondente (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY` ou `GOOGLE_API_KEY`) e ajuste `NEXCODE_MODEL`. Para Ollama, use `NEXCODE_PROVIDER=ollama` e `NEXCODE_BASE_URL=http://localhost:11434/v1`. Para outro endpoint compatível, use `NEXCODE_PROVIDER=openai-compatible`. Não envie o arquivo `.env` ao GitHub.

## Executar

```bash
pnpm dev:cli
pnpm build
pnpm start:cli
```

Na interface:

- `F1`: development
- `F2`: planning
- `F3`: ask
- `Enter`: enviar mensagem
- `Backspace`: apagar caractere
- `Ctrl+C`: sair

## Validar o workspace

```bash
pnpm typecheck
pnpm test
pnpm build
```

O GitHub Actions executa essas verificações em pushes para `main` e pull requests.

## Estrutura

```text
apps/
  cli/             # Interface OpenTUI
packages/
  core/            # Tipos, modos e prompts centrais
  providers/       # Integração AI SDK / OpenAI-compatible
  mcp/             # Cliente MCP stdio
```

## Próximas etapas

- Fluxo de aprovação explícita para comandos, escrita de arquivos e ferramentas MCP.
- Descoberta e gerenciamento de ferramentas MCP (stdio e Streamable HTTP).
- Histórico de conversa, contexto de repositório e memória local.
- Skills locais e ferramentas de leitura/diff de arquivos.
- Aplicativo desktop Electron.

## Licença

MIT. Consulte [LICENSE](LICENSE).

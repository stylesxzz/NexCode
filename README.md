# NEXCODE

Agente de programação open source, local e independente de provedor. O NEXCODE combina uma TUI OpenTUI, ferramentas de workspace, aprovações explícitas, adaptadores de IA e integração MCP por stdio.

## Recursos implementados

- TUI de terminal escura com detalhes verdes.
- Modos **Development**, **Planning** e **Ask**.
- Provedores: NVIDIA NIM, OpenAI, Anthropic, Google Gemini, Ollama e endpoints OpenAI-compatible.
- Ferramentas do workspace: listar arquivos, ler arquivos e pesquisar texto.
- No modo Development: criar/substituir arquivos e executar programas com aprovação explícita.
- Comandos executados diretamente, sem shell, com diretório de trabalho limitado ao repositório, ambiente reduzido, limite de tempo e saída limitada.
- MCP stdio: inicialização do servidor e cada chamada de ferramenta exigem aprovação.
- Bloqueio de leitura de arquivos `.env`, `.git` e `node_modules`; bloqueio de caminhos fora do workspace e escritas por symlink.
- Registro local das decisões de aprovação em `.nexcode/audit.jsonl`.
- PNPM workspace, Turbo, TypeScript, Vitest e CI com lockfile congelado.

## Modos

| Tecla | Modo | Permissões |
|---|---|---|
| F1 | `development` | Leitura, pesquisa, escrita e comandos; escrita/comando sempre pedem aprovação |
| F2 | `planning` | Apenas leitura e pesquisa; sem comandos, MCP ou escrita |
| F3 | `ask` | Conversa sem ferramentas do workspace |

Quando uma ação exigir aprovação, a TUI mostra o resumo, os argumentos e o contexto. Pressione **Y** para aprovar ou **N** para negar. Negar não executa a ação.

## Requisitos

- Git
- Node.js **22.12+**
- pnpm **10.20.0**
- Bun **1.3.14+** (runtime da OpenTUI)

O OpenTUI usa FFI nativo. O runtime Bun é o caminho suportado pelo projeto; Node.js precisa de versão 26.4+ e `--experimental-ffi`.

Confira:

```bash
node --version
pnpm --version
bun --version
git --version
```

## Instalação

### Linux

Instale Git, Node.js 22.12+ e habilite PNPM:

```bash
corepack enable
corepack prepare pnpm@10.20.0 --activate
curl -fsSL https://bun.sh/install | bash
```

Abra um novo terminal, depois:

```bash
git clone https://github.com/stylesxzz/NexCode.git
cd NexCode
pnpm install --frozen-lockfile
```

### Windows (PowerShell)

Instale Git e Node.js 22.12+. Depois:

```powershell
corepack enable
corepack prepare pnpm@10.20.0 --activate
powershell -c "irm bun.sh/install.ps1 | iex"
git clone https://github.com/stylesxzz/NexCode.git
cd NexCode
pnpm install --frozen-lockfile
```

### macOS

Instale Git, Node.js e Bun. Ative PNPM com Corepack e siga os mesmos comandos de clone e instalação da seção Linux.

### Termux / Android

A compatibilidade do runtime nativo Bun + OpenTUI no Termux/Android não está garantida. Use uma distribuição Linux suportada ou computador para executar a TUI.

## Configuração da IA

Copie o modelo de configuração:

```bash
cp .env.example .env
```

Exemplo NVIDIA NIM:

```env
NEXCODE_PROVIDER=nvidia
NEXCODE_BASE_URL=https://integrate.api.nvidia.com/v1
NEXCODE_API_KEY=sua_chave_nvidia
NEXCODE_MODEL=meta/llama-3.3-70b-instruct
```

Outros provedores:

- OpenAI: `NEXCODE_PROVIDER=openai`, `OPENAI_API_KEY` e nome do modelo em `NEXCODE_MODEL`.
- Anthropic: `NEXCODE_PROVIDER=anthropic`, `ANTHROPIC_API_KEY` e modelo em `NEXCODE_MODEL`.
- Gemini: `NEXCODE_PROVIDER=google`, `GOOGLE_API_KEY` e modelo em `NEXCODE_MODEL`.
- Ollama: `NEXCODE_PROVIDER=ollama`, `NEXCODE_BASE_URL=http://localhost:11434/v1` e modelo local em `NEXCODE_MODEL`.
- Outro endpoint compatível: `NEXCODE_PROVIDER=openai-compatible`, `NEXCODE_API_KEY`, `NEXCODE_BASE_URL` e `NEXCODE_MODEL`.

Não compartilhe nem envie seu `.env` ao GitHub. O NEXCODE não precisa de uma chave de API para instalar, mas precisa de uma chave válida ou servidor Ollama para responder com IA.

## Servidores MCP (opcional)

O NEXCODE aceita servidores MCP locais por stdio. Crie sua configuração privada:

```bash
mkdir -p .nexcode
cp .nexcode/mcp.example.json .nexcode/mcp.json
```

Edite `.nexcode/mcp.json` e substitua o servidor de exemplo pelo pacote MCP que deseja usar. Exemplo de formato:

```json
{
  "servers": [
    {
      "name": "filesystem",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."],
      "env": {}
    }
  ]
}
```

Na primeira utilização, o NEXCODE pede aprovação antes de iniciar cada servidor. Cada chamada de ferramenta MCP também pede aprovação individual. O servidor roda com variáveis de ambiente básicas e somente as variáveis extras declaradas explicitamente na configuração.

## Executar

Na raiz do repositório:

```bash
pnpm dev:cli
```

Para build de produção:

```bash
pnpm build
pnpm start:cli
```

Atalhos:

- `F1`: Development
- `F2`: Planning
- `F3`: Ask
- `Enter`: enviar mensagem
- `Backspace`: apagar caractere
- `Y` / `N`: aprovar / negar uma ação pendente
- `Ctrl+C`: sair

## Validação

```bash
pnpm typecheck
pnpm test
pnpm build
```

O GitHub Actions repete instalação congelada, descoberta do workspace, typecheck, testes e build em cada push para `main` e pull request.

## Segurança e limites

- O modelo não recebe acesso direto ao shell: ele solicita uma ferramenta e a aplicação mostra a aprovação antes da execução.
- Os comandos são iniciados sem shell e com argumentos separados. Revise o comando antes de aprovar; um programa aprovado ainda pode realizar ações relevantes no sistema.
- Escritas ficam limitadas ao workspace e são bloqueadas em arquivos de ambiente secretos, `.git`, `node_modules` e caminhos simbólicos.
- MCP é poderoso: instale apenas servidores confiáveis e revise os argumentos de cada chamada.
- O log de aprovação fica em `.nexcode/audit.jsonl`, localmente, e não é enviado ao Git.
- A aprovação não substitui backup. Faça commit ou backup antes de tarefas que alterem muitos arquivos.
- A qualidade das chamadas de ferramentas depende de o modelo escolhido suportar tool calling.

## Estrutura

```text
apps/
  cli/             # TUI OpenTUI
packages/
  core/            # Modos e prompts
  providers/       # Modelos, ferramentas e aprovações
  mcp/             # Cliente MCP stdio
tests/             # Testes de segurança do workspace
```

## Licença

MIT. Consulte [LICENSE](LICENSE).

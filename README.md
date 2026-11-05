# NEXCODE

Agente de programação open source, local e independente de provedor. O NEXCODE combina uma TUI OpenTUI, ferramentas de workspace, aprovações explícitas, adaptadores de IA e integração MCP por stdio.

## Recursos

- TUI de terminal escura com detalhes verdes.
- Modos **Development**, **Planning** e **Ask**.
- NVIDIA NIM, OpenAI, Anthropic, Google Gemini, Ollama e endpoints OpenAI-compatible.
- Ferramentas de workspace com permissões e aprovações explícitas.
- MCP por stdio, com aprovação antes de iniciar servidores e executar ferramentas.
- Histórico limitado e limites configuráveis de chamadas para reduzir consumo em dispositivos modestos.
- PNPM workspace, Turbo, TypeScript, Vitest e CI multiplataforma.

## Compatibilidade

| Ambiente | Caminho recomendado | Observações |
|---|---|---|
| Android / Termux | Debian via `proot-distro` + Bun + pnpm | Evita incompatibilidades de bibliotecas nativas do Android com dependências Linux desktop |
| Linux x64 / ARM64 | Bun + Node.js + pnpm | Debian, Ubuntu, Arch e Kali |
| Windows 10/11 | PowerShell + Bun + Node.js + pnpm | Também funciona no Windows Terminal |
| macOS | Bun + Node.js + pnpm | Apple Silicon e Intel |

**Requisitos:** Git, Node.js 22.12+, pnpm 10.20.0+ e Bun 1.3.14+. O Bun executa a TUI OpenTUI; Node.js é usado para ferramentas de build e testes.

## Instalação

### Android / Termux (recomendado: Debian no proot)

No Termux:

```bash
pkg update -y
pkg install -y git proot-distro
proot-distro install debian
proot-distro login debian
```

Dentro do Debian:

```bash
apt update
apt install -y git curl ca-certificates unzip
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
corepack enable
corepack prepare pnpm@10.20.0 --activate
curl -fsSL https://bun.sh/install | bash
```

Feche e abra novamente a sessão Debian, então:

```bash
git clone https://github.com/stylesxzz/NexCode.git
cd NexCode
pnpm install --frozen-lockfile
pnpm dev:cli
```

Dica para celulares com pouca memória: feche aplicativos em segundo plano e mantenha os limites conservadores padrão. Evite iniciar vários servidores MCP simultaneamente.

### Linux

Instale Git, Node.js 22.12+ e Bun. Ative o pnpm:

```bash
corepack enable
corepack prepare pnpm@10.20.0 --activate
curl -fsSL https://bun.sh/install | bash
git clone https://github.com/stylesxzz/NexCode.git
cd NexCode
pnpm install --frozen-lockfile
pnpm dev:cli
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
pnpm dev:cli
```

### macOS

Instale Git, Node.js 22.12+ e Bun. Ative pnpm com Corepack e siga os comandos da seção Linux.

## Configuração da IA

Copie o arquivo de exemplo:

Linux / macOS / Termux:
```bash
cp .env.example .env
```

Windows PowerShell:
```powershell
Copy-Item .env.example .env
```

Exemplo NVIDIA NIM:

```env
NEXCODE_PROVIDER=nvidia
NEXCODE_BASE_URL=https://integrate.api.nvidia.com/v1
NEXCODE_API_KEY=sua_chave_nvidia
NEXCODE_MODEL=meta/llama-3.3-70b-instruct
```

Outros provedores: `openai`, `anthropic`, `google`, `ollama` e `openai-compatible`. Consulte `.env.example` para as variáveis de cada provedor.

Não compartilhe nem envie seu `.env` ao GitHub. O NEXCODE não precisa de uma chave para instalar, mas precisa de uma chave válida ou servidor Ollama para responder com IA.

## Ajustes de desempenho

Os padrões são conservadores para funcionar melhor em celulares e computadores modestos. Personalize no arquivo `.env`:

| Variável | Padrão | Limite | Função |
|---|---:|---:|---|
| `NEXCODE_HISTORY_MESSAGES` | 12 | 2–40 | Mensagens anteriores enviadas ao modelo |
| `NEXCODE_MAX_STEPS` | 4 | 1–12 | Etapas máximas de uso de ferramentas por resposta |
| `NEXCODE_MAX_OUTPUT_TOKENS` | 2048 | 256–8192 | Limite de tokens gerados por resposta |

Para dispositivos com pouca memória, mantenha os padrões. Em desktops, aumente os limites conforme a capacidade do modelo e da máquina.

## Modos

| Tecla | Modo | Permissões |
|---|---|---|
| F1 | `development` | Leitura, pesquisa, escrita e comandos; escrita/comando sempre pedem aprovação |
| F2 | `planning` | Apenas leitura e pesquisa; sem comandos, MCP ou escrita |
| F3 | `ask` | Conversa sem ferramentas do workspace |

Pressione **Y** para aprovar ou **N** para negar uma ação pendente.

## Servidores MCP (opcional)

```bash
mkdir -p .nexcode
cp .nexcode/mcp.example.json .nexcode/mcp.json
```

No PowerShell:

```powershell
New-Item -ItemType Directory -Force .nexcode
Copy-Item .nexcode/mcp.example.json .nexcode/mcp.json
```

Edite `.nexcode/mcp.json` e configure servidores confiáveis. Cada inicialização e chamada de ferramenta exige aprovação.

## Executar e validar

```bash
pnpm dev:cli
pnpm typecheck
pnpm test
pnpm build
```

Build de produção:

```bash
pnpm build
pnpm start:cli
```

## Segurança

- O modelo não recebe acesso direto ao shell: solicita ferramentas e a aplicação pede aprovação.
- Comandos são iniciados sem shell, com argumentos separados, diretório limitado ao workspace, tempo limite e saída limitada.
- Escritas são bloqueadas em arquivos secretos, `.git`, `node_modules` e caminhos simbólicos.
- MCP é poderoso: use apenas servidores confiáveis e revise cada aprovação.
- O registro local fica em `.nexcode/audit.jsonl`; não é enviado ao Git.

## Estrutura

```text
apps/cli/          # TUI OpenTUI
packages/core/     # Modos e prompts
packages/providers/# Modelos, ferramentas e aprovações
packages/mcp/      # Cliente MCP stdio
tests/             # Testes de segurança
```

## Licença

MIT. Consulte [LICENSE](LICENSE).

# NEXCODE

Assistente de programação com IA, de código aberto e independente de provedor, planejado para oferecer uma interface de terminal OpenTUI e um aplicativo desktop com Electron.

## Recursos planejados

- Modos de trabalho: `development`, `planning` e `ask`.
- Aprovação explícita antes de executar comandos, alterar arquivos, gravar memória ou chamar ferramentas MCP.
- Integração com NVIDIA NIM, OpenAI, Anthropic, Google Gemini, Ollama e APIs compatíveis com OpenAI.
- Integração com servidores MCP (stdio e Streamable HTTP).
- Skills locais e memória persistente.
- Interface escura com detalhes verdes.

## Requisitos

- Git
- Node.js **22.12 ou superior**
- pnpm **10.20.0** (versão definida em `package.json`)

Confira as versões:

```bash
node --version
npm --version
git --version
```

## Instalação do ambiente

### Linux (Ubuntu, Debian, Fedora e derivados)

Instale Git e Node.js 22.12+ usando o gerenciador de pacotes ou o instalador oficial do Node.js. Depois, habilite o Corepack e ative a versão do pnpm usada pelo projeto:

```bash
corepack enable
corepack prepare pnpm@10.20.0 --activate
pnpm --version
```

Se sua instalação do Node.js não incluir Corepack, use:

```bash
npm install --global pnpm@10.20.0
```

### Windows (PowerShell)

Instale Node.js 22.12+ e Git. Abra um novo PowerShell e execute:

```powershell
corepack enable
corepack prepare pnpm@10.20.0 --activate
pnpm --version
```

Se o Corepack não estiver disponível:

```powershell
npm install --global pnpm@10.20.0
```

### Termux (Android)

```bash
pkg update && pkg upgrade -y
pkg install -y git nodejs-lts
node --version
npm install --global pnpm@10.20.0
pnpm --version
```

> O Termux precisa fornecer Node.js 22.12 ou superior. Se a versão instalada for mais antiga, atualize o Node.js antes de continuar.

## Baixar o repositório

```bash
git clone https://github.com/stylesxzz/NexCode.git
cd NexCode
```

## Instalar as dependências

```bash
pnpm install
```

## Estado atual do projeto

**Atenção:** este repositório ainda contém somente o scaffold, os metadados do workspace e a documentação. Os diretórios com o código executável dos pacotes e aplicativos (`apps/*` e `packages/*`) ainda não foram publicados. Portanto, os comandos acima preparam o ambiente e instalam as dependências declaradas na raiz, mas **não instalam nem iniciam o NEXCODE** neste momento.

Os comandos de desenvolvimento previstos, depois que o código dos aplicativos for publicado, são:

```bash
# Verificação de tipos
pnpm typecheck

# Testes
pnpm test

# Build
pnpm build

# Interface de terminal
pnpm dev:cli

# Aplicativo desktop
pnpm dev:desktop
```

Esses comandos ainda não devem ser considerados funcionais até a publicação dos pacotes e a validação do CI.

## Configuração de provedores

Quando o módulo de configuração estiver disponível, as chaves dos provedores serão configuradas localmente por variáveis de ambiente. Nunca envie arquivos `.env`, tokens ou chaves de API para o GitHub.

## Licença

Distribuído sob a licença MIT. Consulte [LICENSE](LICENSE).

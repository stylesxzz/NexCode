# NEXCODE — Guia de início rápido

Este guia apresenta a instalação do workspace Web (Chat + Automações), a CLI/TUI opcional e a execução com Docker.

> Para a visão completa do produto, recursos, arquitetura, segurança e limitações, consulte o [README principal](../README.md).

## Requisitos

- Git.
- Node.js **26.4.0 ou superior**.
- pnpm **10.20.0**.
- Bun **1.3.14 ou superior**, apenas para a CLI/TUI.
- Uma chave de API para usar um provedor remoto de IA.
- Docker Engine e Docker Compose plugin, se optar pelo container.

A CI do projeto valida o monorepo em Ubuntu Linux. Windows, macOS e Android/Termux possuem instruções, mas não fazem parte da matriz nativa atual de CI. A CLI/TUI depende de componentes OpenTUI/FFI; em Termux, o suporte é experimental.

## 1. Instalar pnpm

Depois de instalar Node.js 26.4.0+ e Git, instale a versão usada pelo projeto:

```bash
npm install --global pnpm@10.20.0
```

Confirme as versões:

```bash
git --version
node --version
pnpm --version
```

## 2. Clonar e instalar

Linux, Kali, macOS e Termux:

```bash
git clone https://github.com/stylesxzz/NexCode.git
cd NexCode
pnpm install --frozen-lockfile
```

Windows PowerShell:

```powershell
git clone https://github.com/stylesxzz/NexCode.git
Set-Location NexCode
pnpm install --frozen-lockfile
```

## 3. Iniciar o workspace Web

```bash
pnpm start:web
```

Abra [http://127.0.0.1:4173](http://127.0.0.1:4173) e informe o código de pareamento exibido no terminal. Mantenha o terminal aberto enquanto estiver usando o NEXCODE. Para encerrar, pressione `Ctrl+C`.

Modo de desenvolvimento:

```bash
pnpm dev:web
```

O workspace Web não exige Bun.

## 4. Configurar um provedor de IA

É possível configurar provedor, modelo, URL base e chave pela tela **Configurações**. O arquivo `.env.example` contém exemplos de variáveis.

Exemplo NVIDIA NIM:

```dotenv
NEXCODE_PROVIDER=nvidia
NEXCODE_MODEL=meta/llama-3.3-70b-instruct
NEXCODE_API_KEY=
NEXCODE_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_API_KEY=
```

Endpoints de referência:

| Provedor | URL base |
|---|---|
| NVIDIA NIM | `https://integrate.api.nvidia.com/v1` |
| OpenAI | `https://api.openai.com/v1` |
| OpenRouter | `https://openrouter.ai/api/v1` |
| Ollama local | `http://localhost:11434/v1` |

A compatibilidade depende do adaptador, modelo e suporte a Chat Completions/tool calling. Não publique chaves em commits ou logs.

## 5. CLI/TUI opcional

Instale Bun 1.3.14+ pelo [site oficial](https://bun.sh/) e confira:

```bash
bun --version
```

Build e inicialização:

```bash
pnpm build
pnpm start:cli
```

Desenvolvimento:

```bash
pnpm dev:cli
```

Atalhos documentados:

- **F1:** Development — ferramentas de workspace, importação GitHub e autoevolução.
- **F2:** Planning — planejamento.
- **F3:** Ask — perguntas sem ferramentas de workspace.
- **F4:** biblioteca local de PDFs.
- **Y / N:** aprovar ou negar uma ação pendente.

A CLI/TUI usa componentes nativos OpenTUI/FFI. Se o renderer não carregar, verifique a compatibilidade do runtime e do terminal do sistema. Android/Termux não é validado pela CI.

## 6. Docker

Com Docker Engine e Docker Compose instalados:

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f nexcode-web
```

Acesse [http://127.0.0.1:4173](http://127.0.0.1:4173).

Controle do serviço:

```bash
docker compose stop
docker compose start
docker compose restart
docker compose down
```

O Compose padrão inicia o workspace Web integrado (Chat + Automações). O volume `nexcode_web_data` mantém os dados locais e `./workspace` é o diretório de trabalho montado no container. A porta é publicada em loopback por padrão.

## 7. Biblioteca de PDFs

Instale Poppler para habilitar a extração de texto:

| Sistema | Instalação |
|---|---|
| Kali, Debian e Ubuntu | `sudo apt install poppler-utils` |
| Termux | `pkg install poppler` |
| macOS | `brew install poppler` |
| Windows | Instale Poppler e adicione a pasta `bin` ao `PATH` |

Comandos no chat:

```text
/book add /caminho/para/documento.pdf
/book list
/book remove <book-id-ou-titulo>
```

PDFs digitalizados que exigem OCR ainda não são suportados. A recuperação é lexical, sem embeddings, e seleciona até cinco trechos relevantes por solicitação.

## 8. Importar um projeto GitHub

No modo **Development** da CLI/TUI, solicite a análise de um repositório público:

```text
Baixe https://github.com/usuario/projeto, analise a arquitetura,
identifique funcionalidades úteis e proponha como integrar ao NEXCODE.
```

O agente pede aprovação antes de clonar. A importação inventaria arquivos e manifests sem instalar dependências nem executar scripts automaticamente. Revise a licença e o código antes de integrar qualquer conteúdo.

## 9. Autoevolução do NEXCODE

No modo Development, descreva a melhoria desejada. O fluxo documentado:

1. Solicita aprovação para criar um Git worktree e uma branch separados.
2. Recusa iniciar se o checkout ativo estiver com alterações não commitadas.
3. Faz edições somente no worktree isolado.
4. Solicita aprovação para gravações e comandos de validação.
5. Apresenta o diff para revisão.

O agente não mescla branches automaticamente. Revise as alterações e os testes antes de integrar a branch gerada. Um worktree separado reduz o risco para o checkout ativo, mas não substitui um sandbox dedicado.

## Segurança

- Comandos aprovados executam com os privilégios do usuário atual.
- Não execute código desconhecido em sua máquina principal; prefira VM ou container descartável.
- Não exponha a porta local diretamente à internet.
- Não compartilhe tokens, chaves ou arquivos `.env`.
- O runtime de MCP completo, sandbox dedicado e execução isolada de código arbitrário ainda estão em desenvolvimento.

## Documentação complementar

- [README principal](../README.md)
- [Automações e workflows](WORKFLOW_AUTOMATION.md)
- [Autoevolução e integração de projetos](SELF_EVOLUTION.md)

# Nexo

**Nexo** é um workspace de IA local-first. A interface abre no navegador, mas o agente roda no próprio dispositivo e executa tarefas no terminal e no workspace que você selecionou.

A imagem de referência compartilhada no projeto orienta a composição: painel lateral escuro, conversa central, orb de IA, cartões de ação e acentos verde-lima no lugar do amarelo.

## O que existe nesta versão

- Interface web responsiva para desktop e celular, servida pelo agente local.
- Processo local Node.js que faz a ponte autenticada entre navegador e terminal.
- Pareamento inicial por código exibido no terminal; API vinculada somente a 127.0.0.1.
- Modos Development, Planning e Ask.
- Permissões guiadas ou autonomia para ações rotineiras dentro do workspace escolhido.
- Revisão humana obrigatória para operações de alto risco, inicialização de servidores MCP e chamadas MCP.
- Catálogo de provedores: NVIDIA NIM, OpenAI, Anthropic, Google Gemini, OpenRouter, Groq, DeepSeek, Mistral, Together AI, Fireworks, Cerebras, xAI, Perplexity, Cohere, Ollama e endpoints OpenAI-compatible.
- Skills em Markdown instaladas por HTTPS de arquivos SKILL.md do GitHub.
- Integração MCP local via STDIO, com conexão e remoção pela interface.
- Memória persistente em grafo local, com recuperação de notas relevantes para conversas seguintes.
- Ferramentas de workspace reutilizadas do núcleo existente: listar, ler, pesquisar, escrever e executar programas.

A presença de um provedor no catálogo não garante que todo modelo daquele serviço suporte chamadas de ferramentas. Informe o identificador exato do modelo habilitado na sua conta.

## Requisitos

- Node.js 22.12 ou superior.
- pnpm 10.20.0.
- Git.
- Chave de API de um provedor compatível (ou Ollama local).

## Instalação

~~~bash
git clone https://github.com/stylesxzz/NexCode.git
cd NexCode
corepack enable
corepack prepare pnpm@10.20.0 --activate
pnpm install --frozen-lockfile
~~~

## Iniciar o Nexo

Inicie o agente a partir do repositório Nexo. Por padrão, o workspace é o diretório atual:

~~~bash
pnpm dev
~~~

Para apontar o agente para outra pasta, configure NEXO_WORKSPACE antes de iniciar.

Linux, macOS e Termux:

~~~bash
NEXO_WORKSPACE=/caminho/para/projeto pnpm dev
~~~

Windows PowerShell:

~~~powershell
$env:NEXO_WORKSPACE = "C:\caminho\para\projeto"
pnpm dev
~~~

Abra no mesmo dispositivo:

~~~text
http://127.0.0.1:4173
~~~

No primeiro início, o terminal exibe um código de pareamento. Digite-o na janela do navegador. O token do navegador e as configurações ficam na pasta privada ~/.nexo (no Windows, dentro do perfil do usuário).

Para usar outro workspace:

~~~bash
node apps/agent/dist/server.js /caminho/para/projeto
~~~

No Windows, passe o caminho absoluto do diretório como argumento. No Termux/Kali, o agente executa comandos com as ferramentas disponíveis no ambiente em que o Node.js foi iniciado.

## Provedores e modelos

Abra **Configurações → Provedor de IA**. Escolha o serviço, informe o model ID, endpoint (se necessário) e a chave de API. As credenciais são salvas localmente em ~/.nexo/config.json com permissões restritivas; não coloque chaves em commits, Skills ou arquivos de projeto.

OpenAI, Anthropic e Gemini usam adaptadores nativos. NVIDIA NIM, Ollama e o catálogo compatível usam o adaptador de chat OpenAI-compatible. Para serviços com endpoints compatíveis, confirme a URL e o model ID na documentação do próprio provedor.

## Modos e permissões

- **Development:** leitura, pesquisa, criação/edição de arquivos e execução de comandos dentro do workspace.
- **Planning:** leitura e análise; não escreve nem executa comandos.
- **Ask:** conversa sem ferramentas de workspace.

No **Modo guiado**, o agente pede aprovação antes de alterações e comandos. Em **Autonomia no workspace**, você concede uma permissão inicial para ações rotineiras dentro da pasta escolhida. Operações destrutivas, privilégios elevados, SSH/SCP, inicialização MCP e chamadas MCP ainda exigem revisão humana.

Os comandos são iniciados como processos filhos, sem invocar um shell implicitamente, com limite de tempo e saída. O modo autônomo não deve ser interpretado como acesso irrestrito ao sistema operacional. Faça backup/commit antes de tarefas que possam alterar muitos arquivos.

## Skills

Abra a aba **Skills** e instale um link HTTPS que aponte diretamente para um arquivo SKILL.md no GitHub. O conteúdo Markdown é carregado como instrução quando relevante para o pedido. O instalador não executa scripts do repositório.

## MCP

Abra **Integrações MCP** e cadastre o nome, executável e argumentos de um servidor local STDIO. Remova a conexão pela mesma tela. O Nexo pede aprovação antes de iniciar o servidor e antes de usar cada ferramenta.

A versão atual implementa transporte local STDIO. MCP remoto por HTTP/SSE não está implementado nesta versão.

## Memória persistente

A aba **Memória** mostra os nós e relações salvos. A memória guarda trechos resumidos de pedidos e respostas e recupera notas relevantes por palavras-chave. Os dados ficam em ~/.nexo/memory.json.

Isso é recuperação de contexto sobre notas armazenadas, não treinamento do modelo nem atualização automática de pesos. Você pode desativar a captura de novos aprendizados nas configurações ou apagar o arquivo local para limpar a memória.

## Plataformas

- Kali Linux e outras distribuições Linux.
- macOS.
- Windows com PowerShell ou Windows Terminal.
- Android com Termux, desde que exista uma versão compatível do Node.js 22.12+ e os programas que você pedir estejam instalados.

O navegador deve ser aberto no mesmo dispositivo onde o agente está rodando. O serviço é deliberadamente vinculado a 127.0.0.1 e não é uma aplicação hospedada acessível pela internet.

## Segurança e limites conhecidos

- A página web não recebe acesso ao shell. Somente o processo local autenticado executa ferramentas.
- O serviço não escuta na rede local; não exponha a porta por proxy ou túnel sem uma camada adicional de autenticação e transporte seguro.
- MCP e Skills são extensões poderosas. Instale conteúdo de fontes confiáveis.
- SCP é um protocolo de cópia sobre SSH; não fornece verificação por e-mail. Uma etapa de e-mail/OTP requer um provedor de e-mail ou MCP separado e configurado. Esse conector de e-mail não está incluído nesta versão.
- A qualidade e o uso de ferramentas dependem do suporte a tool calling do modelo escolhido.

## Desenvolvimento

~~~bash
pnpm typecheck
pnpm test
pnpm build
~~~

O workflow do GitHub Actions valida instalação congelada, typecheck, testes e build.

## Estrutura

~~~text
apps/
  agent/           # servidor web local e API do agente
  cli/             # interface de terminal legada opcional
packages/
  core/            # modos e prompts
  providers/       # adaptadores, ferramentas e aprovações
  mcp/             # cliente MCP STDIO
docs/
  ARCHITECTURE.md  # limites e arquitetura local-first
tests/             # testes do workspace
~~~

## Licença

MIT. Consulte LICENSE.

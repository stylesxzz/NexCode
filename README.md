# Nexo

Nexo é um ambiente de IA local-first: a interface abre no navegador, enquanto o agente Node.js roda no mesmo computador e usa o workspace/terminal local.

A interface segue a imagem de referência enviada: painel escuro, orb central, histórico lateral e cartões de ação — com verde-lima no lugar do amarelo.

## Requisitos
- Node.js 20.11+
- npm 10+
- API compatível com Chat Completions e tool calling (OpenAI, NVIDIA NIM, OpenRouter, Ollama ou outro endpoint compatível).

## Instalação limpa
~~~bash
git clone https://github.com/stylesxzz/NexCode.git
cd NexCode
npm install
npm link
~~~
O npm link registra o comando global nexcode uma única vez.

## Iniciar ou reiniciar
Na pasta do projeto que o agente deve controlar:
~~~bash
nexcode
~~~
Ou aponte outro workspace:
~~~bash
NEXCODE_WORKSPACE=/caminho/do/projeto nexcode
~~~
Windows PowerShell:
~~~powershell
$env:NEXCODE_WORKSPACE = "C:\Users\SeuUsuario\Projeto"
nexcode
~~~
O terminal mostra um código de pareamento. Abra http://127.0.0.1:4173 no mesmo dispositivo e informe o código. Mantenha o terminal aberto. Para parar use Ctrl+C; para reiniciar execute nexcode novamente.

## Provedores
Em Configurações informe endpoint, model ID e API key.
- OpenAI: https://api.openai.com/v1
- NVIDIA NIM: https://integrate.api.nvidia.com/v1
- OpenRouter: https://openrouter.ai/api/v1
- Ollama: http://localhost:11434/v1

A compatibilidade depende do endpoint e do modelo oferecerem Chat Completions e tool calling.

## Implementado nesta base
- Interface responsiva com Chat, Memória, Skills, Integrações MCP e Configurações.
- Pareamento por código e token de sessão.
- Agente com ferramentas de terminal, leitura, escrita e listagem de arquivos.
- Execução no workspace selecionado, com timeout e limite de saída.
- Memória local persistente e visualização em grafo.
- Instalação e remoção de arquivos SKILL.md via HTTPS.
- Cadastro e remoção de configurações de servidores MCP STDIO.
- Configuração local em ~/.nexcode/config.json.

## Limites conhecidos
Esta é uma reconstrução limpa e fundacional, não uma promessa de que todos os módulos avançados já estejam prontos.
- A execução de terminal usa shell do sistema. A autonomia deve ser habilitada conscientemente e somente em workspace confiável. Bloqueios básicos não equivalem a sandbox inviolável.
- Skills são baixadas e listadas, mas ainda precisam ser injetadas automaticamente no contexto do modelo.
- MCP salva e remove configurações; inicialização de processos MCP e chamadas de ferramentas ainda precisam ser implementadas.
- Memória persiste notas e as exibe em grafo; embeddings, busca semântica e edição/exclusão individual ainda faltam.
- Anthropic Messages API, OAuth, SCP com verificação por e-mail/OTP, streaming e PTY interativo ainda não estão implementados.
- O serviço escuta somente em 127.0.0.1. Não exponha a porta publicamente.

## Desenvolvimento
~~~bash
npm test
npm run check
~~~

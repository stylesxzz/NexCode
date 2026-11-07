# Nexo — Local AI Workspace

<p align="center">
  <strong>Um ambiente de IA local conectado ao workspace e ao terminal da sua máquina.</strong><br>
  Interface web local • Agente Node.js • Ferramentas de projeto • Memória persistente
</p>

A interface usa como referência visual o conceito enviado: fundo escuro, brilho verde-lima, orb central e navegação lateral. O navegador é apenas a interface; quem acessa arquivos e executa comandos é o agente local iniciado no terminal.

## Referências visuais

### Chat e workspace
![Referência da interface principal do Nexo](docs/images/nexo-chat.svg)

### Memória em grafo
![Referência da árvore de memória do Nexo](docs/images/nexo-memory.svg)

As imagens são mockups SVG de documentação baseados nos componentes e estilos atuais do projeto; não são capturas de uma sessão real.

## Requisitos

- Node.js 20.11 ou superior (Node 22 LTS recomendado).
- npm.
- Um provedor de IA com API compatível com o formato Chat Completions usado pelo agente.

## Instalação — Kali Linux, Linux, macOS e Termux

Clone e instale uma única vez:

~~~bash
git clone https://github.com/stylesxzz/NexCode.git
cd NexCode
npm install
npm link
~~~

O `npm link` registra o comando global `nexcode`. Se o npm global não estiver no PATH, confira `npm prefix -g` e adicione o diretório `bin` correspondente ao PATH do seu shell.

### Windows (PowerShell)

~~~powershell
git clone https://github.com/stylesxzz/NexCode.git
cd NexCode
npm install
npm link
~~~

## Iniciar e reiniciar

Inicie o Nexo a partir da pasta que deseja disponibilizar ao agente:

~~~bash
nexcode
~~~

Ou informe explicitamente o workspace:

~~~bash
nexcode /caminho/para/meu-projeto
~~~

Também é possível definir o workspace por variável de ambiente:

~~~bash
NEXCODE_WORKSPACE=/caminho/para/meu-projeto nexcode
~~~

Windows PowerShell:

~~~powershell
$env:NEXCODE_WORKSPACE = "C:\Users\SeuUsuario\Projeto"
nexcode
~~~

Ao iniciar, o terminal exibe o endereço local e um código de pareamento. Abra **http://127.0.0.1:4173**, digite o código e conecte. Mantenha o terminal aberto enquanto estiver usando o Nexo. Para encerrar, pressione `Ctrl+C`; para reiniciar, execute `nexcode` novamente.

### Porta alternativa

Se a porta padrão estiver ocupada:

~~~bash
NEXCODE_PORT=4180 nexcode
~~~

Depois abra `http://127.0.0.1:4180`.

## Configurar um provedor de IA

Na interface, abra **Configurações** e informe provedor, URL base, identificador do modelo e chave. A chave é armazenada localmente em `~/.nexcode/config.json` (permissão restrita pelo agente).

### NVIDIA NIM — DeepSeek V4 Flash

Endpoint base:

~~~text
https://integrate.api.nvidia.com/v1
~~~

Identificador do modelo original:

~~~text
deepseek-ai/deepseek-v4-flash
~~~

**Atenção à disponibilidade:** a página da NVIDIA marca o endpoint gratuito de `deepseek-ai/deepseek-v4-flash` como depreciado e mostra disponibilidade por parceiros. A NVIDIA também lista `deepseek-ai/deepseek-v4.1-flash` como modelo mais recente com endpoint gratuito disponível. Confirme na página do modelo qual endpoint está habilitado para a sua conta antes de configurar.

- [DeepSeek V4 Flash — NVIDIA](https://build.nvidia.com/deepseek-ai/deepseek-v4-flash)
- [DeepSeek V4.1 Flash — NVIDIA](https://build.nvidia.com/deepseek-ai/deepseek-v4.1-flash)
- [Catálogo NVIDIA NIM](https://build.nvidia.com/)

Para testar a chave fora do Nexo, no Kali/Linux/macOS:

~~~bash
read -s -p "NVIDIA API Key: " NVIDIA_API_KEY
echo
curl https://integrate.api.nvidia.com/v1/chat/completions \
  -H "Authorization: Bearer $NVIDIA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-ai/deepseek-v4-flash",
    "messages": [{"role":"user","content":"Responda: Nexo conectado."}],
    "max_tokens": 100,
    "stream": false
  }'
unset NVIDIA_API_KEY
~~~

Se o endpoint gratuito não estiver disponível para V4 Flash, selecione o modelo que aparece habilitado no catálogo e use o identificador exatamente como fornecido pela NVIDIA. Não coloque a chave diretamente no histórico do shell ou em arquivos versionados.

### Outros endpoints OpenAI-compatible

| Provedor | URL base |
|---|---|
| OpenAI | `https://api.openai.com/v1` |
| NVIDIA NIM | `https://integrate.api.nvidia.com/v1` |
| OpenRouter | `https://openrouter.ai/api/v1` |
| Ollama local | `http://localhost:11434/v1` |

A compatibilidade varia por modelo: respostas em formato Chat Completions e chamadas de ferramentas (tool calling) precisam ser suportadas para os fluxos de agente.

## Recursos disponíveis nesta versão

- Interface web local responsiva: Chat, Memória, Skills, Integrações MCP e Configurações.
- Pareamento por código entre navegador e agente local.
- Agente com ferramentas de terminal, leitura, escrita e listagem de arquivos.
- Execução de comandos no workspace configurado, com timeout e limite de saída.
- Memória persistente local e visualização em grafo.
- Biblioteca local de conhecimento: importar PDFs, indexar trechos e recuperar passagens relevantes automaticamente no contexto do agente.\n- Instalação e remoção de arquivos `SKILL.md` por URL HTTPS.
- Cadastro e remoção de configurações de servidores MCP STDIO.
- Configurações locais em `~/.nexcode/config.json`.

## Biblioteca de conhecimento — PDFs

O NEXCODE pode consultar livros e documentos PDF como fontes de referência, sem retreinar o modelo. Os arquivos e o índice ficam na máquina do usuário; trechos relevantes são recuperados por busca lexical e anexados ao contexto da conversa com referência ao título e à página.

### Preparar o extrator PDF

A importação usa o executável Poppler `pdftotext`, sem enviar o PDF para serviços externos:

- Kali/Debian/Ubuntu: `sudo apt install poppler-utils`
- Termux: `pkg install poppler`
- macOS: `brew install poppler`
- Windows: instale Poppler e adicione a pasta `bin` ao PATH.

### Comandos no chat do NEXCODE

~~~text
/book add /caminho/para/livro.pdf
/book list
/book remove <book-id-ou-titulo>
~~~

No Windows PowerShell, informe o caminho completo, por exemplo `/book add C:\\Users\\voce\\Documents\\livro.pdf`. Caminhos com espaços podem ser colocados entre aspas.

Após a importação, os trechos mais relevantes são incluídos automaticamente em perguntas e tarefas futuras. A biblioteca fica em `~/.nexcode/knowledge/library.json`. Faça backup dessa pasta junto com a configuração e a memória.

**Limitações atuais:** PDFs com texto selecionável são suportados; PDFs digitalizados que exigem OCR ainda não são processados. A recuperação atual é lexical (sem embeddings), limitada aos cinco trechos mais relevantes por solicitação. O conteúdo dos livros é tratado como referência não confiável: instruções encontradas dentro de um PDF nunca substituem as regras de segurança, as aprovações ou as instruções do agente.

## Comandos de desenvolvimento

~~~bash
npm start       # inicia o agente sem o launcher global
npm run dev     # reinicia o agente ao detectar alterações
npm test        # executa os testes automatizados
npm run check   # verifica a sintaxe dos arquivos JS
~~~

## Dados locais

| Conteúdo | Caminho |
|---|---|
| Configuração e chave de API | `~/.nexcode/config.json` |
| Memória | `~/.nexcode/memory.json` |
| Skills instaladas | `~/.nexcode/skills/` |\n| Biblioteca PDF / índice de conhecimento | `~/.nexcode/knowledge/library.json` |

Faça backup dessa pasta se quiser preservar configurações e memória ao trocar de máquina. Nunca envie chaves de API para o Git.

## Segurança

O agente executa comandos com os privilégios do usuário que iniciou o processo. A opção de autonomia deve ser habilitada apenas para workspaces confiáveis. Os bloqueios existentes são proteções básicas, não um sandbox de segurança. Revise o workspace, mantenha backups e não exponha a porta local publicamente. O servidor foi projetado para escutar em loopback (`127.0.0.1`).

## Estado de implementação e limitações

Esta é uma reconstrução limpa e funcional em evolução. Para transparência:

- A execução de terminal, leitura, escrita e listagem de arquivos estão disponíveis no agente local.
- Skills podem ser instaladas e removidas, mas ainda precisam ser carregadas automaticamente no contexto do modelo para orientar todas as tarefas.
- A tela MCP permite cadastrar e remover configurações; inicialização dos processos MCP e execução das ferramentas MCP ainda precisam ser concluídas.
- A memória persiste notas e as apresenta em grafo; embeddings, recuperação semântica e gerenciamento individual de nós ainda precisam ser concluídos.
- Integração nativa Anthropic Messages, OAuth, SCP com verificação por e-mail/OTP, streaming e PTY interativo ainda não estão implementados.

## Contribuição

Issues e pull requests são bem-vindos. Antes de enviar alterações, execute:

~~~bash
npm test
npm run check
~~~

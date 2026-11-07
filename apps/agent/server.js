import http from "node:http";
import { readFile, writeFile, mkdir, readdir, unlink } from "node:fs/promises";
import { spawn } from "node:child_process";
import { deflateRawSync } from "node:zlib";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { resolve, join, relative, isAbsolute, extname, basename } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const ROOT=resolve(fileURLToPath(new URL("../../",import.meta.url))), WEB=join(ROOT,"apps/web"), HOME=join(homedir(),".nexcode"), PORT=+(process.env.NEXCODE_PORT||4173), WORK=resolve(process.env.NEXCODE_WORKSPACE||process.argv[2]||process.cwd());
await mkdir(HOME,{recursive:true,mode:0o700});
const cf=join(HOME,"config.json"),mf=join(HOME,"memory.json"),sd=join(HOME,"skills");
await mkdir(sd,{recursive:true,mode:0o700});
const read=async(p,d)=>{try{return JSON.parse(await readFile(p,"utf8"))}catch{return d}};
const cfg=await read(cf,{baseUrl:"https://api.openai.com/v1",model:"",apiKey:"",autonomy:false,mcp:[],models:[]});
cfg.mcp??=[];cfg.models??=[];
let mem=await read(mf,{nodes:[],edges:[]}),token=randomBytes(32).toString("hex"),code=String(Math.floor(100000+Math.random()*900000)),paired=false;
const mcpLive=new Map(),oauthPending=new Map(),mcpToolMap=new Map();
const save=()=>writeFile(cf,JSON.stringify(cfg,null,2),{mode:0o600}),saveMem=()=>writeFile(mf,JSON.stringify(mem,null,2),{mode:0o600});
const inside=(base,p)=>{const r=relative(base,p);return r===""||(!r.startsWith("..")&&!isAbsolute(r))};
const eq=(a,b)=>{const x=Buffer.from(a||""),y=Buffer.from(b||"");return x.length===y.length&&timingSafeEqual(x,y)};
const send=(res,s,o)=>{res.writeHead(s,{"content-type":"application/json","cache-control":"no-store"});res.end(JSON.stringify(o))};
const body=async req=>{let s="";for await(const c of req){s+=c;if(s.length>70*1024*1024)throw Error("Requisição muito grande (limite de 70 MB).")}return s?JSON.parse(s):{}};
const sse=(res,type,data)=>res.write("event: "+type+"\ndata: "+JSON.stringify(data)+"\n\n");
function activeModel(){const m=cfg.models.find(x=>x.id===cfg.activeModelId);return m||{baseUrl:cfg.baseUrl,model:cfg.model,apiKey:cfg.apiKey,provider:cfg.provider||"openai-compatible"}}
async function jsonFetch(url,options={}){const r=await fetch(url,options);const raw=await r.text();let data={};try{data=raw?JSON.parse(raw):{}}catch{data={raw}}if(!r.ok)throw Error(data.error_description||data.error?.message||data.message||raw||("HTTP "+r.status));return data}
async function oauthStart(server){
 const endpoint=new URL(server.url),resourceMeta=[endpoint.origin+"/.well-known/oauth-protected-resource"+endpoint.pathname,endpoint.origin+"/.well-known/oauth-protected-resource"].filter((v,i,a)=>a.indexOf(v)===i);
 let resource={};for(const u of resourceMeta){try{resource=await jsonFetch(u);break}catch{}}
 const issuer=resource.authorization_servers?.[0]||endpoint.origin;
 let metadata;for(const u of [issuer.replace(/\/$/,"")+"/.well-known/oauth-authorization-server",issuer.replace(/\/$/,"")+"/.well-known/openid-configuration"]){try{metadata=await jsonFetch(u);break}catch{}}
 if(!metadata?.authorization_endpoint||!metadata?.token_endpoint)throw Error("Servidor MCP não publicou metadados OAuth 2.1 válidos.");
 let client=server.oauthClient;
 if(!client?.client_id){const reg=metadata.registration_endpoint;if(!reg)throw Error("O servidor OAuth não oferece registro dinâmico de cliente; configure um client_id no servidor.");client=await jsonFetch(reg,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({client_name:"Nexo Local Agent",redirect_uris:["http://127.0.0.1:"+PORT+"/oauth/callback"],grant_types:["authorization_code","refresh_token"],response_types:["code"],token_endpoint_auth_method:"none"})});}
 const verifier=randomBytes(32).toString("base64url"),challenge=createHash("sha256").update(verifier).digest("base64url"),state=randomBytes(24).toString("hex");
 oauthPending.set(state,{name:server.name,verifier,metadata,client,created:Date.now()});
 const auth=new URL(metadata.authorization_endpoint);auth.searchParams.set("response_type","code");auth.searchParams.set("client_id",client.client_id);auth.searchParams.set("redirect_uri","http://127.0.0.1:"+PORT+"/oauth/callback");auth.searchParams.set("code_challenge",challenge);auth.searchParams.set("code_challenge_method","S256");auth.searchParams.set("state",state);if(resource.resource)auth.searchParams.set("resource",resource.resource);
 return {status:"authorization_required",authorizationUrl:auth.toString(),message:"Abra a aba de autorização e conclua o login para conectar o MCP."};
}
function parseMcpSse(raw){
 const messages=[];
 for(const block of raw.split(/\r?\n\r?\n/)){
  const data=block.split(/\r?\n/).filter(line=>line.startsWith("data:")).map(line=>line.slice(5).replace(/^ /,"")).join("\n");
  if(data)try{messages.push(JSON.parse(data))}catch{}
 }
 return messages;
}
async function rpc(server,method,params={}){
 const notification=method.startsWith("notifications/");
 const id=notification?undefined:randomBytes(8).toString("hex");
 const payload={jsonrpc:"2.0",...(id?{id}:{}),method,...(params&&Object.keys(params).length?{params}:{})};
 const headers={"content-type":"application/json","accept":"application/json, text/event-stream"};
 if(server.accessToken)headers.authorization="Bearer "+server.accessToken;
 if(server.sessionId)headers["mcp-session-id"]=server.sessionId;
 if(server.protocolVersion)headers["MCP-Protocol-Version"]=server.protocolVersion;
 const response=await fetch(server.url,{method:"POST",headers,body:JSON.stringify(payload),signal:AbortSignal.timeout(30000)});
 if(response.status===401)throw Object.assign(Error("Autorização MCP necessária."),{oauth:true});
 if(response.status===404&&server.sessionId)throw Error("Sessão MCP não encontrada (HTTP 404). Desconecte e conecte o servidor novamente.");
 if(!response.ok)throw Error("MCP HTTP "+response.status+": "+(await response.text()).slice(0,1500));
 const sid=response.headers.get("mcp-session-id");if(sid)server.sessionId=sid;
 if(notification&&(response.status===202||response.status===204))return{};
 const raw=await response.text();
 if(notification&&!raw.trim())return{};
 let messages=[];
 if(response.headers.get("content-type")?.includes("text/event-stream"))messages=parseMcpSse(raw);
 else if(raw.trim()){try{messages=[JSON.parse(raw)]}catch{throw Error("Resposta MCP não é JSON nem Server-Sent Events válido: "+raw.slice(0,500))}}
 if(notification)return{};
 const result=messages.find(message=>message?.id===id);
 if(!result)throw Error("O servidor MCP não devolveu uma resposta JSON-RPC para "+method+". Verifique se a URL aponta para o endpoint Streamable HTTP.");
 if(result.error)throw Error("MCP JSON-RPC "+(result.error.code??"error")+": "+(result.error.message||"Falha na chamada")+(result.error.data?" — "+JSON.stringify(result.error.data):""));
 return result.result??{};
}
async function connectMcp(server){
 server.sessionId="";
 server.protocolVersion="";
 const initialized=await rpc(server,"initialize",{protocolVersion:"2025-03-26",capabilities:{},clientInfo:{name:"nexcode",version:"1.2.0"}});
 server.protocolVersion=initialized.protocolVersion||"2025-03-26";
 await rpc(server,"notifications/initialized");
 const listed=await rpc(server,"tools/list");
 server.tools=listed.tools||[];
 mcpLive.set(server.name,server);
 return server.tools;
}
const builtin=[
 {type:"function",function:{name:"terminal",description:"Execute um comando no workspace. Use para criar, instalar, testar e analisar projetos. A execução é exibida ao usuário em tempo real.",parameters:{type:"object",properties:{command:{type:"string"},reason:{type:"string"}},required:["command","reason"]}}},
 {type:"function",function:{name:"read_file",description:"Read workspace file",parameters:{type:"object",properties:{path:{type:"string"}},required:["path"]}}},
 {type:"function",function:{name:"write_file",description:"Write a text file in the workspace",parameters:{type:"object",properties:{path:{type:"string"},content:{type:"string"}},required:["path","content"]}}},
 {type:"function",function:{name:"list_files",description:"List workspace files",parameters:{type:"object",properties:{path:{type:"string"}},required:["path"]}}},
 {type:"function",function:{name:"create_pdf",description:"Generate a real PDF document in the workspace from a title and text content. Use for reports, proposals, guides and documentation.",parameters:{type:"object",properties:{path:{type:"string"},title:{type:"string"},content:{type:"string"}},required:["title","content"]}}},
 {type:"function",function:{name:"create_docx",description:"Generate an editable Microsoft Word DOCX document in the workspace from a title and text content.",parameters:{type:"object",properties:{path:{type:"string"},title:{type:"string"},content:{type:"string"}},required:["title","content"]}}},
 {type:"function",function:{name:"create_zip",description:"Create a ZIP archive from files or folders inside the workspace.",parameters:{type:"object",properties:{path:{type:"string"},files:{type:"array",items:{type:"string"}}},required:["files"]}}}
];
function toolCatalog(){const all=[...builtin];mcpToolMap.clear();for(const [name,server] of mcpLive)for(const t of server.tools||[]){const fn="mcp__"+name.replace(/[^a-z0-9_]/gi,"_")+"__"+t.name.replace(/[^a-z0-9_]/gi,"_");mcpToolMap.set(fn,{server:name,tool:t.name});all.push({type:"function",function:{name:fn,description:"MCP "+name+": "+(t.description||t.name),parameters:t.inputSchema||{type:"object",properties:{}}}})}return all}

function safeWorkspacePath(value,fallback){const p=resolve(WORK,value||fallback);if(!inside(WORK,p))throw Error("Caminho fora do workspace");return p}
function xmlEscape(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;")}
function crc32(buf){let c=0xffffffff;for(const b of buf){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0)}return(c^0xffffffff)>>>0}
function makeZip(entries){
 const local=[],central=[];let offset=0;
 for(const entry of entries){const name=Buffer.from(entry.name.replace(/\\/g,"/"),"utf8"),raw=Buffer.isBuffer(entry.data)?entry.data:Buffer.from(entry.data),compressed=deflateRawSync(raw),crc=crc32(raw),lh=Buffer.alloc(30);
 lh.writeUInt32LE(0x04034b50,0);lh.writeUInt16LE(20,4);lh.writeUInt16LE(0x0800,6);lh.writeUInt16LE(8,8);lh.writeUInt32LE(crc,14);lh.writeUInt32LE(compressed.length,18);lh.writeUInt32LE(raw.length,22);lh.writeUInt16LE(name.length,26);
 local.push(lh,name,compressed);
 const ch=Buffer.alloc(46);ch.writeUInt32LE(0x02014b50,0);ch.writeUInt16LE(20,4);ch.writeUInt16LE(20,6);ch.writeUInt16LE(0x0800,8);ch.writeUInt16LE(8,10);ch.writeUInt32LE(crc,16);ch.writeUInt32LE(compressed.length,20);ch.writeUInt32LE(raw.length,24);ch.writeUInt16LE(name.length,28);ch.writeUInt32LE(offset,42);central.push(ch,name);offset+=lh.length+name.length+compressed.length;
 }
 const centralBuf=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(centralBuf.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...local,centralBuf,end])
}
function winAnsi(value){const map={"€":128,"‚":130,"ƒ":131,"„":132,"…":133,"†":134,"‡":135,"ˆ":136,"‰":137,"Š":138,"‹":139,"Œ":140,"Ž":142,"‘":145,"’":146,"“":147,"”":148,"•":149,"–":150,"—":151,"˜":152,"™":153,"š":154,"›":155,"œ":156,"ž":158,"Ÿ":159};return [...String(value)].map(c=>{const n=c.codePointAt(0);return n<=255?n:(map[c]||63)})}
function pdfString(value){const bs=String.fromCharCode(92);return winAnsi(value).map(n=>n===40?bs+"(":n===41?bs+")":n===92?bs+bs:n<32||n>126?bs+n.toString(8).padStart(3,"0"):String.fromCharCode(n)).join("")}
function makePdf(title,content){
 const lines=[];for(const paragraph of String(content||"").split(/\r?\n/)){if(!paragraph){lines.push("");continue}let rest=paragraph;while(rest.length>92){let cut=rest.lastIndexOf(" ",92);if(cut<35)cut=92;lines.push(rest.slice(0,cut));rest=rest.slice(cut).trimStart()}lines.push(rest)}
 const pages=[];let current=[title,""];for(const line of lines){if(current.length>=48){pages.push(current);current=[title+" (continuação)",""]}current.push(line)}pages.push(current);
 const objects=[];const add=v=>(objects.push(v),objects.length);const font=add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");const pagesId=add("");const pageIds=[];
 for(const linesPage of pages){let ops="BT /F1 16 Tf 50 790 Td ("+pdfString(linesPage[0])+") Tj /F1 10 Tf 0 -28 Td ";for(const line of linesPage.slice(1))ops+="("+pdfString(line)+") Tj 0 -14 Td ";ops+="ET";const stream=Buffer.from(ops,"latin1");const contentId=add(Buffer.concat([Buffer.from("<< /Length "+stream.length+" >>\nstream\n","latin1"),stream,Buffer.from("\nendstream","latin1")]));const pageId=add("<< /Type /Page /Parent "+pagesId+" 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 "+font+" 0 R >> >> /Contents "+contentId+" 0 R >>");pageIds.push(pageId)}
 objects[pagesId-1]="<< /Type /Pages /Kids ["+pageIds.map(x=>x+" 0 R").join(" ")+"] /Count "+pageIds.length+" >>";const catalog=add("<< /Type /Catalog /Pages "+pagesId+" 0 R >>");
 const chunks=[Buffer.from("%PDF-1.4\n%âãÏÓ\n","latin1")],offsets=[0];let offset=chunks[0].length;for(let i=0;i<objects.length;i++){offsets.push(offset);const b=Buffer.isBuffer(objects[i])?objects[i]:Buffer.from(objects[i],"latin1");const head=Buffer.from((i+1)+" 0 obj\n","latin1"),tail=Buffer.from("\nendobj\n","latin1");chunks.push(head,b,tail);offset+=head.length+b.length+tail.length}const xref=offset;let table="xref\n0 "+(objects.length+1)+"\n0000000000 65535 f \n";for(let i=1;i<offsets.length;i++)table+=String(offsets[i]).padStart(10,"0")+" 00000 n \n";chunks.push(Buffer.from(table+"trailer\n<< /Size "+(objects.length+1)+" /Root "+catalog+" 0 R >>\nstartxref\n"+xref+"\n%%EOF","latin1"));return Buffer.concat(chunks)
}
async function collectZipFiles(relPath,entries){const abs=safeWorkspacePath(relPath,".");const st=await (await import("node:fs/promises")).stat(abs);if(st.isFile()){entries.push({name:relative(WORK,abs),data:await readFile(abs)});return}for(const d of await readdir(abs,{withFileTypes:true})){if(d.isSymbolicLink()||d.name===".git"||d.name==="node_modules")continue;const child=join(abs,d.name);if(d.isDirectory())await collectZipFiles(relative(WORK,child),entries);else if(d.isFile())entries.push({name:relative(WORK,child),data:await readFile(child)})}}

function run(cmd,emit){return new Promise((ok,no)=>{if(!cfg.autonomy)return no(Error("Ative a execução em Configurações para permitir comandos."));if(/(^|[;&|]\s*)(sudo|su|shutdown|reboot|mkfs|fdisk)\b|rm\s+-rf\s+\/|git\s+reset\s+--hard|git\s+clean\s+-[a-z]*f/i.test(cmd))return no(Error("Comando destrutivo/privilegiado bloqueado."));emit("terminal",{kind:"command",command:cmd,cwd:WORK});const p=spawn(cmd,{cwd:WORK,shell:true,env:{...process.env,CI:"1"}});let out="",err="",settled=false;const timer=setTimeout(()=>p.kill("SIGTERM"),120000);p.stdout.on("data",d=>{const v=d.toString();out+=v;emit("terminal",{kind:"stdout",text:v})});p.stderr.on("data",d=>{const v=d.toString();err+=v;emit("terminal",{kind:"stderr",text:v})});p.on("error",e=>{if(!settled){settled=true;clearTimeout(timer);no(e)}});p.on("close",c=>{if(settled)return;settled=true;clearTimeout(timer);emit("terminal",{kind:"exit",code:c});ok({exitCode:c,stdout:out.slice(0,150000),stderr:err.slice(0,50000)})})})}
async function tool(name,args,emit){
 if(name==="terminal")return run(args.command,emit);
 if(name==="read_file"||name==="write_file"||name==="list_files"){const p=safeWorkspacePath(args.path,".");if(name==="read_file")return{content:await readFile(p,"utf8")};if(name==="write_file"){await mkdir(resolve(p,".."),{recursive:true});await writeFile(p,args.content);return{written:relative(WORK,p)}}return{files:await readdir(p,{withFileTypes:true}).then(x=>x.map(y=>({name:y.name,directory:y.isDirectory()})))}}
 if(name==="create_pdf"){const p=safeWorkspacePath(args.path||"documento.pdf","documento.pdf");await mkdir(resolve(p,".."),{recursive:true});await writeFile(p,makePdf(args.title||"Documento",args.content||""));return{created:relative(WORK,p),format:"PDF"}}
 if(name==="create_docx"){const p=safeWorkspacePath(args.path||"documento.docx","documento.docx");await mkdir(resolve(p,".."),{recursive:true});const paragraphs=String(args.content||"").split(/\r?\n/).map(line=>"<w:p><w:r><w:t xml:space=\"preserve\">"+xmlEscape(line)+"</w:t></w:r></w:p>").join("");const doc='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>'+xmlEscape(args.title||"Documento")+'</w:t></w:r></w:p>'+paragraphs+'<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>';const entries=[{name:"[Content_Types].xml",data:'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'},{name:"_rels/.rels",data:'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'},{name:"word/document.xml",data:doc}];await writeFile(p,makeZip(entries));return{created:relative(WORK,p),format:"DOCX"}}
 if(name==="create_zip"){if(!Array.isArray(args.files)||!args.files.length)throw Error("Informe ao menos um arquivo ou pasta.");const entries=[];for(const rel of args.files)await collectZipFiles(rel,entries);if(!entries.length)throw Error("Nenhum arquivo encontrado para compactar.");const p=safeWorkspacePath(args.path||"projeto.zip","projeto.zip");await mkdir(resolve(p,".."),{recursive:true});await writeFile(p,makeZip(entries));return{created:relative(WORK,p),format:"ZIP",files:entries.length}}
 if(mcpToolMap.has(name)){const ref=mcpToolMap.get(name),server=mcpLive.get(ref.server);if(!server)throw Error("Servidor MCP desconectado: "+ref.server);return rpc(server,"tools/call",{name:ref.tool,arguments:args})}
 throw Error("Ferramenta desconhecida: "+name)
}
async function agent(msgs,emit){
 const model=activeModel();if(!model.model||(!model.apiKey&&!/localhost|127\.0\.0\.1/.test(model.baseUrl||"")))throw Error("Configure um modelo e sua conexão nas Configurações.");
 const latest=msgs[msgs.length-1],plain=typeof latest?.content==="string"?latest.content:(Array.isArray(latest?.content)?latest.content.map(x=>x.text||"").join(" "):"");
 const simple=/^(oi|olá|ola|hello|hi|bom dia|boa tarde|boa noite|e aí|eai|tudo bem|obrigado|obrigada|valeu)[!.?\s]*$/i.test(plain.trim());
 const wantsTools=/\b(crie|criar|faça|fazer|gere|gerar|construa|construir|implemente|implementar|corrija|corrigir|teste|testar|execute|executar|analise|analisar|investigue|investigar|arquivo|pdf|docx|zip|site|app|aplicativo|projeto|código|codigo|terminal|instale|instalar|compacte|pentest|repositório|repositorio|repo|workspace|pasta|imagem|referência|referencia)\b/i.test(plain)||Array.isArray(latest?.content);
 let availableTools=simple||!wantsTools?[]:toolCatalog();
 for(let i=0;i<8;i++){
  emit("status",{message:simple?"Preparando uma resposta rápida…":"Conectando ao modelo "+model.model+"…"});
  let response;try{response=await fetch(model.baseUrl.replace(/\/$/,"")+"/chat/completions",{method:"POST",signal:AbortSignal.timeout(90000),headers:{"content-type":"application/json",...(model.apiKey?{authorization:"Bearer "+model.apiKey}:{})},body:JSON.stringify({model:model.model,messages:msgs,...(availableTools.length?{tools:availableTools,tool_choice:"auto"}:{}),temperature:.2,max_tokens:1024,stream:true})})}catch(e){if(e.name==="TimeoutError")throw Error("O modelo demorou mais de 90 segundos para responder. Verifique o endpoint, o modelo e a conexão.");throw e}
  if(!response.ok){const raw=await response.text();let data;try{data=JSON.parse(raw)}catch{data={}}const detail=data.error?.message||data.message||raw||("HTTP "+response.status);throw Error("Provedor HTTP "+response.status+": "+detail)}
  let message;
  if(response.headers.get("content-type")?.includes("text/event-stream")){
   const reader=response.body.getReader(),decoder=new TextDecoder();let buffer="",content="",calls=new Map(),finished=false;
   while(!finished){const chunk=await reader.read();if(chunk.done)break;buffer+=decoder.decode(chunk.value,{stream:true});const parts=buffer.split(/\r?\n\r?\n/);buffer=parts.pop();for(const part of parts){const line=part.split(/\r?\n/).find(x=>x.startsWith("data:"));if(!line)continue;const raw=line.slice(5).trim();if(raw==="[DONE]"){finished=true;break}let packet;try{packet=JSON.parse(raw)}catch{continue}const delta=packet.choices?.[0]?.delta;if(!delta)continue;if(typeof delta.content==="string"){content+=delta.content;emit("delta",{text:delta.content})}for(const tc of delta.tool_calls||[]){const prior=calls.get(tc.index)||{id:"",type:"function",function:{name:"",arguments:""}};if(tc.id)prior.id=tc.id;if(tc.function?.name)prior.function.name+=tc.function.name;if(tc.function?.arguments)prior.function.arguments+=tc.function.arguments;calls.set(tc.index,prior)}}}
   message={role:"assistant",content:content||null,...(calls.size?{tool_calls:[...calls.entries()].sort((a,b)=>a[0]-b[0]).map(x=>x[1])}:{})};
  }else{const data=await response.json();message=data.choices?.[0]?.message;if(typeof message?.content==="string")emit("delta",{text:message.content})}
  if(!message)throw Error("Resposta vazia ou incompatível do provedor.");msgs.push(message);if(!message.tool_calls?.length)return message.content||"Concluído.";
  for(const call of message.tool_calls){let result;let args={};try{args=JSON.parse(call.function.arguments||"{}");emit("status",{message:"Executando "+call.function.name+"…"});result=await tool(call.function.name,args,emit)}catch(e){result={error:e.message};emit("status",{message:"Falha na ferramenta: "+e.message})}msgs.push({role:"tool",tool_call_id:call.id,content:JSON.stringify(result)});emit("tool_result",{name:call.function.name,result})}
  availableTools=toolCatalog();
 }
 return"Limite de ações atingido."
}
const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,"http://localhost");
 if(u.pathname==="/oauth/callback"){const state=u.searchParams.get("state"),pending=oauthPending.get(state);if(!pending)return send(res,400,{error:"Estado OAuth inválido ou expirado."});oauthPending.delete(state);if(u.searchParams.get("error"))return send(res,400,{error:u.searchParams.get("error_description")||u.searchParams.get("error")});const serverCfg=cfg.mcp.find(x=>x.name===pending.name);const tokenData=await jsonFetch(pending.metadata.token_endpoint,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"authorization_code",code:u.searchParams.get("code"),redirect_uri:"http://127.0.0.1:"+PORT+"/oauth/callback",client_id:pending.client.client_id,code_verifier:pending.verifier})});serverCfg.oauthClient=pending.client;serverCfg.accessToken=tokenData.access_token;serverCfg.refreshToken=tokenData.refresh_token||"";await save();const mcp={...serverCfg};const tools=await connectMcp(mcp);serverCfg.status="connected";await save();res.writeHead(200,{"content-type":"text/html; charset=utf-8"});return res.end("<h2>Conta autorizada. MCP conectado ao Nexo.</h2><p>Você pode fechar esta aba e voltar ao agente.</p><script>setTimeout(()=>window.close(),1200)</script>")}
 if(u.pathname==="/api/pair"&&req.method==="POST"){if(!eq((await body(req)).code,code))return send(res,401,{error:"Código incorreto"});paired=true;return send(res,200,{token})}
 if(u.pathname.startsWith("/api/")&&(!paired||!eq(req.headers.authorization?.replace(/^Bearer /,""),token)))return send(res,401,{error:"Não pareado"});
 if(u.pathname==="/api/status")return send(res,200,{workspace:WORK,model:activeModel().model,autonomy:cfg.autonomy});
 if(u.pathname==="/api/config"&&req.method==="GET"){const c={...cfg,apiKey:cfg.apiKey?"••••••••":""};return send(res,200,c)}
 if(u.pathname==="/api/config"&&req.method==="POST"){const b=await body(req);for(const k of["baseUrl","model","autonomy","provider"])if(k in b)cfg[k]=b[k];if(b.apiKey&&b.apiKey!=="••••••••")cfg.apiKey=b.apiKey;await save();return send(res,200,{ok:true})}
 if(u.pathname==="/api/models"&&req.method==="GET")return send(res,200,{models:cfg.models.map(x=>({...x,apiKey:x.apiKey?"••••••••":""})),activeModelId:cfg.activeModelId});
 if(u.pathname==="/api/models"&&req.method==="POST"){const b=await body(req);if(!b.name||!b.baseUrl||!b.model)throw Error("Informe nome, endpoint e identificador do modelo.");const item={id:b.id||randomBytes(8).toString("hex"),name:b.name,baseUrl:b.baseUrl,model:b.model,apiKey:b.apiKey||"",kind:b.kind||"remote"};cfg.models=[...cfg.models.filter(x=>x.id!==item.id),item];if(b.activate!==false)cfg.activeModelId=item.id;await save();return send(res,200,{ok:true,models:cfg.models.map(x=>({...x,apiKey:x.apiKey?"••••••••":""})),activeModelId:cfg.activeModelId})}
 if(u.pathname.startsWith("/api/models/")&&req.method==="DELETE"){const id=decodeURIComponent(u.pathname.split("/").pop());cfg.models=cfg.models.filter(x=>x.id!==id);if(cfg.activeModelId===id)cfg.activeModelId=cfg.models[0]?.id||"";await save();return send(res,200,{ok:true})}
 if(u.pathname==="/api/models/activate"&&req.method==="POST"){cfg.activeModelId=(await body(req)).id;await save();return send(res,200,{ok:true})}
 if(u.pathname==="/api/download"&&req.method==="GET"){const p=safeWorkspacePath(u.searchParams.get("path")||"","");const file=await readFile(p);const name=basename(p).replace(/[^a-z0-9._-]/gi,"_");const type=({".pdf":"application/pdf",".docx":"application/vnd.openxmlformats-officedocument.wordprocessingml.document",".zip":"application/zip",".txt":"text/plain; charset=utf-8",".md":"text/markdown; charset=utf-8"})[extname(p).toLowerCase()]||"application/octet-stream";res.writeHead(200,{"content-type":type,"content-disposition":"attachment; filename=\""+name+"\"","content-length":file.length,"cache-control":"no-store"});res.end(file);return}
 if(u.pathname==="/api/chat"&&req.method==="POST"){const b=await body(req);res.writeHead(200,{"content-type":"text/event-stream","cache-control":"no-cache, no-transform","connection":"keep-alive","x-accel-buffering":"no"});res.flushHeaders?.();const emit=(type,data)=>sse(res,type,data);try{let userContent=b.message||"";const refs=[];for(const item of (b.attachments||[]).slice(0,6)){if(!String(item.mime||"").startsWith("image/"))continue;const bytes=Buffer.from(item.data||"","base64");if(!bytes.length||bytes.length>8*1024*1024)throw Error("Cada imagem deve ter no máximo 8 MB.");const safe=(item.name||"referencia").replace(/[^a-z0-9._-]/gi,"_").slice(-80)||"referencia.png";const dir=join(WORK,".nexo","references");await mkdir(dir,{recursive:true});const file=join(dir,Date.now()+"-"+randomBytes(3).toString("hex")+"-"+safe);await writeFile(file,bytes);refs.push({name:safe,path:relative(WORK,file),url:"data:"+item.mime+";base64,"+bytes.toString("base64")})}if(refs.length)userContent+="\n\nImagens de referência anexadas e salvas no workspace: "+refs.map(x=>x.path).join(", ")+". Use-as como referência visual para analisar cores, tipografia, espaçamento, componentes e direção estética.";const content=refs.length?[{type:"text",text:userContent},...refs.map(x=>({type:"image_url",image_url:{url:x.url}}))]:userContent;const msgs=[{role:"system",content:"You are Nexo, a transparent local coding, document and design assistant. Reply promptly to simple greetings without calling tools. For coding, design and file tasks, use tools when needed. You can create PDF, DOCX and ZIP files directly in the workspace. When image references are attached, inspect their visual style and translate palettes, typography, layout and components into the requested project. Workspace: "+WORK+". Only operate inside this workspace or explicitly authorized targets. For web security testing, ask for explicit scope/authorization and use non-destructive checks. Never claim success without tool output. All terminal commands and output are shown live."},...(b.history||[]),{role:"user",content}];const answer=await agent(msgs,emit);mem.nodes.unshift({id:randomBytes(6).toString("hex"),label:(b.message||"Mensagem").slice(0,90),detail:String(answer).slice(0,400),at:Date.now()});mem.nodes=mem.nodes.slice(0,250);if(mem.nodes[1])mem.edges.push({from:mem.nodes[0].id,to:mem.nodes[1].id});await saveMem();emit("assistant",{answer});emit("done",{})}catch(e){emit("error",{message:e.message})}return res.end()}
 if(u.pathname==="/api/memory")return send(res,200,mem);
 if(u.pathname==="/api/skills"&&req.method==="GET")return send(res,200,await Promise.all((await readdir(sd)).map(async n=>({name:n,content:await readFile(join(sd,n),"utf8")}))));
 if(u.pathname==="/api/skills"&&req.method==="POST"){const b=await body(req),url=new URL(b.url);if(url.protocol!=="https:")throw Error("Use HTTPS");const r=await fetch(url);if(!r.ok)throw Error("Download falhou");const name=(url.pathname.split("/").pop()||"skill").replace(/[^a-z0-9._-]/gi,"-");await writeFile(join(sd,name),await r.text(),{mode:0o600});return send(res,200,{ok:true})}
 if(u.pathname.startsWith("/api/skills/")&&req.method==="DELETE"){const n=decodeURIComponent(u.pathname.split("/").pop());if(n.includes("..")||n.includes("/"))throw Error("Nome inválido");await unlink(join(sd,n));return send(res,200,{ok:true})}
 if(u.pathname==="/api/mcp"&&req.method==="GET")return send(res,200,cfg.mcp.map(x=>({name:x.name,url:x.url,status:mcpLive.has(x.name)?"connected":"disconnected",tools:mcpLive.get(x.name)?.tools?.length||0})));
 if(u.pathname==="/api/mcp"&&req.method==="POST"){const b=await body(req);if(!b.name||!b.url)throw Error("Informe nome e URL do servidor MCP.");const parsedUrl=new URL(b.url);if(parsedUrl.protocol!=="https:"&&!(parsedUrl.protocol==="http:"&&["localhost","127.0.0.1","::1","[::1]"].includes(parsedUrl.hostname)))throw Error("Use HTTPS para servidores remotos; HTTP só é permitido em localhost.");const item={name:b.name,url:b.url};cfg.mcp=[...cfg.mcp.filter(x=>x.name!==item.name),item];await save();try{const live={...item};const tools=await connectMcp(live);item.status="connected";await save();return send(res,200,{status:"connected",tools:tools.length,message:"Servidor MCP conectado diretamente."})}catch(e){if(e.oauth){try{return send(res,200,await oauthStart(item))}catch(authError){return send(res,400,{error:authError.message})}}return send(res,400,{error:e.message})}}
 if(u.pathname.startsWith("/api/mcp/")&&u.pathname.endsWith("/connect")&&req.method==="POST"){const name=decodeURIComponent(u.pathname.split("/")[3]),item=cfg.mcp.find(x=>x.name===name);if(!item)throw Error("Servidor MCP não encontrado.");if(item.accessToken){const live={...item};try{const tools=await connectMcp(live);return send(res,200,{status:"connected",tools:tools.length})}catch{item.accessToken="";item.refreshToken="";await save()}}const result=await oauthStart(item);return send(res,200,result)}
 if(u.pathname.startsWith("/api/mcp/")&&req.method==="DELETE"){const name=decodeURIComponent(u.pathname.split("/").pop());mcpLive.delete(name);cfg.mcp=cfg.mcp.filter(x=>x.name!==name);await save();return send(res,200,{ok:true})}
 let p=resolve(WEB,u.pathname==="/"?"index.html":decodeURIComponent(u.pathname.slice(1)));if(!inside(WEB,p))return send(res,404,{error:"Not found"});let file;try{file=await readFile(p)}catch(e){if(e.code==="ENOENT")return send(res,404,{error:"Not found"});throw e}res.writeHead(200,{"content-type":({".html":"text/html; charset=utf-8",".css":"text/css",".js":"text/javascript"})[extname(p)]||"application/octet-stream","x-content-type-options":"nosniff"});res.end(file)
 }catch(e){if(res.headersSent){res.destroy(e);return}send(res,500,{error:e.message})}});
server.listen(PORT,"127.0.0.1",()=>console.log("\nNEXO LOCAL AGENT\nWorkspace: "+WORK+"\nOpen: http://127.0.0.1:"+PORT+"\nPairing code: "+code+"\nKeep this terminal open. Ctrl+C to stop.\n"));

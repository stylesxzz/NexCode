import http from "node:http";
import { readFile, writeFile, mkdir, readdir, unlink } from "node:fs/promises";
import { spawn } from "node:child_process";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { resolve, join, relative, isAbsolute, extname } from "node:path";
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
const mcpLive=new Map(),oauthPending=new Map();
const save=()=>writeFile(cf,JSON.stringify(cfg,null,2),{mode:0o600}),saveMem=()=>writeFile(mf,JSON.stringify(mem,null,2),{mode:0o600});
const inside=(base,p)=>{const r=relative(base,p);return r===""||(!r.startsWith("..")&&!isAbsolute(r))};
const eq=(a,b)=>{const x=Buffer.from(a||""),y=Buffer.from(b||"");return x.length===y.length&&timingSafeEqual(x,y)};
const send=(res,s,o)=>{res.writeHead(s,{"content-type":"application/json","cache-control":"no-store"});res.end(JSON.stringify(o))};
const body=async req=>{let s="";for await(const c of req)s+=c;if(s.length>2e6)throw Error("Request muito grande");return s?JSON.parse(s):{}};
const sse=(res,type,data)=>res.write("event: "+type+"\ndata: "+JSON.stringify(data)+"\n\n");
function activeModel(){const m=cfg.models.find(x=>x.id===cfg.activeModelId);return m||{baseUrl:cfg.baseUrl,model:cfg.model,apiKey:cfg.apiKey,provider:cfg.provider||"openai-compatible"}}
function openBrowser(url){const command=process.platform==="win32"?"cmd":process.platform==="darwin"?"open":"xdg-open";const args=process.platform==="win32"?["/c","start","",url]:[url];const p=spawn(command,args,{detached:true,stdio:"ignore"});p.unref()}
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
 openBrowser(auth.toString());
 return {status:"authorization_required",authorizationUrl:auth.toString(),message:"A autorização foi aberta no navegador. Conclua o login para conectar o MCP."};
}
async function rpc(server,method,params={}){
 const headers={"content-type":"application/json","accept":"application/json, text/event-stream"};
 if(server.accessToken)headers.authorization="Bearer "+server.accessToken;
 if(server.sessionId)headers["mcp-session-id"]=server.sessionId;
 const response=await fetch(server.url,{method:"POST",headers,body:JSON.stringify({jsonrpc:"2.0",id:randomBytes(8).toString("hex"),method,params})});
 if(response.status===401)throw Object.assign(Error("Autorização MCP necessária."),{oauth:true});
 if(!response.ok)throw Error("MCP HTTP "+response.status+": "+(await response.text()).slice(0,1000));
 const sid=response.headers.get("mcp-session-id");if(sid)server.sessionId=sid;
 const raw=await response.text();let result;
 if(response.headers.get("content-type")?.includes("text/event-stream")){const line=raw.split("\n").find(x=>x.startsWith("data:"));result=line?JSON.parse(line.slice(5).trim()):{}}
 else result=raw?JSON.parse(raw):{};
 if(result.error)throw Error(result.error.message||"MCP JSON-RPC error");
 return result.result||result;
}
async function connectMcp(server){await rpc(server,"initialize",{protocolVersion:"2025-03-26",capabilities:{},clientInfo:{name:"nexo",version:"1.1.0"}});await rpc(server,"notifications/initialized");const listed=await rpc(server,"tools/list");server.tools=listed.tools||[];mcpLive.set(server.name,server);return server.tools}
const builtin=[
 {type:"function",function:{name:"terminal",description:"Execute um comando no workspace. Use para criar, instalar, testar e analisar projetos. A execução é exibida ao usuário em tempo real.",parameters:{type:"object",properties:{command:{type:"string"},reason:{type:"string"}},required:["command","reason"]}}},
 {type:"function",function:{name:"read_file",description:"Read workspace file",parameters:{type:"object",properties:{path:{type:"string"}},required:["path"]}}},
 {type:"function",function:{name:"write_file",description:"Write workspace file",parameters:{type:"object",properties:{path:{type:"string"},content:{type:"string"}},required:["path","content"]}}},
 {type:"function",function:{name:"list_files",description:"List workspace files",parameters:{type:"object",properties:{path:{type:"string"}},required:["path"]}}}
];
function toolCatalog(){const all=[...builtin];for(const [name,server] of mcpLive)for(const t of server.tools||[])all.push({type:"function",function:{name:"mcp__"+name.replace(/[^a-z0-9_]/gi,"_")+"__"+t.name,description:"MCP "+name+": "+(t.description||t.name),parameters:t.inputSchema||{type:"object",properties:{}}}});return all}
function run(cmd,emit){return new Promise((ok,no)=>{if(!cfg.autonomy)return no(Error("Ative a execução em Configurações para permitir comandos."));if(/(^|[;&|]\s*)(sudo|su|shutdown|reboot|mkfs|fdisk)\b|rm\s+-rf\s+\/|git\s+reset\s+--hard|git\s+clean\s+-[a-z]*f/i.test(cmd))return no(Error("Comando destrutivo/privilegiado bloqueado."));emit("terminal",{kind:"command",command:cmd,cwd:WORK});const p=spawn(cmd,{cwd:WORK,shell:true,env:{...process.env,CI:"1"}});let out="",err="",settled=false;const timer=setTimeout(()=>p.kill("SIGTERM"),120000);p.stdout.on("data",d=>{const v=d.toString();out+=v;emit("terminal",{kind:"stdout",text:v})});p.stderr.on("data",d=>{const v=d.toString();err+=v;emit("terminal",{kind:"stderr",text:v})});p.on("error",e=>{if(!settled){settled=true;clearTimeout(timer);no(e)}});p.on("close",c=>{if(settled)return;settled=true;clearTimeout(timer);emit("terminal",{kind:"exit",code:c});ok({exitCode:c,stdout:out.slice(0,150000),stderr:err.slice(0,50000)})})})}
async function tool(name,args,emit){
 if(name==="terminal")return run(args.command,emit);
 if(name==="read_file"||name==="write_file"||name==="list_files"){const p=resolve(WORK,args.path||".");if(!inside(WORK,p))throw Error("Fora do workspace");if(name==="read_file")return{content:await readFile(p,"utf8")};if(name==="write_file"){await mkdir(resolve(p,".."),{recursive:true});await writeFile(p,args.content);return{written:args.path}}return{files:await readdir(p,{withFileTypes:true}).then(x=>x.map(y=>({name:y.name,directory:y.isDirectory()})))}}
 if(name.startsWith("mcp__")){const parts=name.split("__"),serverName=parts[1],toolName=parts.slice(2).join("__"),server=mcpLive.get(serverName);if(!server)throw Error("Servidor MCP desconectado: "+serverName);return rpc(server,"tools/call",{name:toolName,arguments:args})}
 throw Error("Ferramenta desconhecida: "+name)
}
async function agent(msgs,emit){const model=activeModel();if(!model.model||(!model.apiKey&&!/localhost|127\.0\.0\.1/.test(model.baseUrl||"")))throw Error("Configure um modelo e sua conexão nas Configurações.");
 for(let i=0;i<12;i++){emit("status",{message:"Consultando "+model.model+"…"});let response=await fetch(model.baseUrl.replace(/\/$/,"")+"/chat/completions",{method:"POST",headers:{"content-type":"application/json",...(model.apiKey?{authorization:"Bearer "+model.apiKey}:{})},body:JSON.stringify({model:model.model,messages:msgs,tools:toolCatalog(),tool_choice:"auto",temperature:.2})});
 const raw=await response.text();let data;try{data=JSON.parse(raw)}catch{data={}}if(!response.ok){const detail=data.error?.message||data.message||raw||("HTTP "+response.status);throw Error("Provedor HTTP "+response.status+": "+detail)}const m=data.choices?.[0]?.message;if(!m)throw Error("Resposta inválida do provedor: "+raw.slice(0,500));msgs.push(m);if(!m.tool_calls?.length)return m.content||"Concluído.";
 for(const call of m.tool_calls){let result;let args={};try{args=JSON.parse(call.function.arguments||"{}");emit("status",{message:"Ferramenta: "+call.function.name});result=await tool(call.function.name,args,emit)}catch(e){result={error:e.message};emit("status",{message:"Falha na ferramenta: "+e.message})}msgs.push({role:"tool",tool_call_id:call.id,content:JSON.stringify(result)});emit("tool_result",{name:call.function.name,result})}}
 return"Limite de ações atingido."}
const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,"http://localhost");
 if(u.pathname==="/oauth/callback"){const state=u.searchParams.get("state"),pending=oauthPending.get(state);if(!pending)return send(res,400,{error:"Estado OAuth inválido ou expirado."});oauthPending.delete(state);if(u.searchParams.get("error"))return send(res,400,{error:u.searchParams.get("error_description")||u.searchParams.get("error")});const serverCfg=cfg.mcp.find(x=>x.name===pending.name);const tokenData=await jsonFetch(pending.metadata.token_endpoint,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"authorization_code",code:u.searchParams.get("code"),redirect_uri:"http://127.0.0.1:"+PORT+"/oauth/callback",client_id:pending.client.client_id,code_verifier:pending.verifier})});serverCfg.oauthClient=pending.client;serverCfg.accessToken=tokenData.access_token;serverCfg.refreshToken=tokenData.refresh_token||"";await save();const mcp={...serverCfg};const tools=await connectMcp(mcp);serverCfg.status="connected";await save();res.writeHead(200,{"content-type":"text/html; charset=utf-8"});return res.end("<h2>Conta autorizada. MCP conectado ao Nexo.</h2><p>Você pode fechar esta aba e voltar ao agente.</p><script>setTimeout(()=>window.close(),1200)</script>")}
 if(u.pathname==="/api/pair"&&req.method==="POST"){if(!eq((await body(req)).code,code))return send(res,401,{error:"Código incorreto"});paired=true;return send(res,200,{token})}
 if(u.pathname.startsWith("/api/")&&(!paired||!eq(req.headers.authorization?.replace(/^Bearer /,""),token)))return send(res,401,{error:"Não pareado"});
 if(u.pathname==="/api/status")return send(res,200,{workspace:WORK,model:activeModel().model,autonomy:cfg.autonomy});
 if(u.pathname==="/api/config"&&req.method==="GET"){const c={...cfg,apiKey:cfg.apiKey?"••••••••":""};return send(res,200,c)}
 if(u.pathname==="/api/config"&&req.method==="POST"){const b=await body(req);for(const k of["baseUrl","model","autonomy","provider"])if(k in b)cfg[k]=b[k];if(b.apiKey&&b.apiKey!=="••••••••")cfg.apiKey=b.apiKey;await save();return send(res,200,{ok:true})}
 if(u.pathname==="/api/models"&&req.method==="GET")return send(res,200,{models:cfg.models,activeModelId:cfg.activeModelId});
 if(u.pathname==="/api/models"&&req.method==="POST"){const b=await body(req);if(!b.name||!b.baseUrl||!b.model)throw Error("Informe nome, endpoint e identificador do modelo.");const item={id:b.id||randomBytes(8).toString("hex"),name:b.name,baseUrl:b.baseUrl,model:b.model,apiKey:b.apiKey||"",kind:b.kind||"remote"};cfg.models=[...cfg.models.filter(x=>x.id!==item.id),item];if(b.activate!==false)cfg.activeModelId=item.id;await save();return send(res,200,{ok:true,models:cfg.models.map(x=>({...x,apiKey:x.apiKey?"••••••••":""})),activeModelId:cfg.activeModelId})}
 if(u.pathname.startsWith("/api/models/")&&req.method==="DELETE"){const id=decodeURIComponent(u.pathname.split("/").pop());cfg.models=cfg.models.filter(x=>x.id!==id);if(cfg.activeModelId===id)cfg.activeModelId=cfg.models[0]?.id||"";await save();return send(res,200,{ok:true})}
 if(u.pathname==="/api/models/activate"&&req.method==="POST"){cfg.activeModelId=(await body(req)).id;await save();return send(res,200,{ok:true})}
 if(u.pathname==="/api/chat"&&req.method==="POST"){const b=await body(req);res.writeHead(200,{"content-type":"text/event-stream","cache-control":"no-cache, no-transform","connection":"keep-alive","x-accel-buffering":"no"});res.flushHeaders?.();const emit=(type,data)=>sse(res,type,data);try{const msgs=[{role:"system",content:"You are Nexo, a transparent local coding and security assistant. Explain your plan, then use tools for real work. Workspace: "+WORK+". Only operate inside this workspace or explicitly authorized targets. For web security testing, ask for explicit scope/authorization and use non-destructive checks. Never claim success without tool output. All terminal commands and output are shown live."},...(b.history||[]),{role:"user",content:b.message}];const answer=await agent(msgs,emit);mem.nodes.unshift({id:randomBytes(6).toString("hex"),label:b.message.slice(0,90),detail:answer.slice(0,400),at:Date.now()});mem.nodes=mem.nodes.slice(0,250);if(mem.nodes[1])mem.edges.push({from:mem.nodes[0].id,to:mem.nodes[1].id});await saveMem();emit("assistant",{answer});emit("done",{})}catch(e){emit("error",{message:e.message})}return res.end()}
 if(u.pathname==="/api/memory")return send(res,200,mem);
 if(u.pathname==="/api/skills"&&req.method==="GET")return send(res,200,await Promise.all((await readdir(sd)).map(async n=>({name:n,content:await readFile(join(sd,n),"utf8")}))));
 if(u.pathname==="/api/skills"&&req.method==="POST"){const b=await body(req),url=new URL(b.url);if(url.protocol!=="https:")throw Error("Use HTTPS");const r=await fetch(url);if(!r.ok)throw Error("Download falhou");const name=(url.pathname.split("/").pop()||"skill").replace(/[^a-z0-9._-]/gi,"-");await writeFile(join(sd,name),await r.text(),{mode:0o600});return send(res,200,{ok:true})}
 if(u.pathname.startsWith("/api/skills/")&&req.method==="DELETE"){const n=decodeURIComponent(u.pathname.split("/").pop());if(n.includes("..")||n.includes("/"))throw Error("Nome inválido");await unlink(join(sd,n));return send(res,200,{ok:true})}
 if(u.pathname==="/api/mcp"&&req.method==="GET")return send(res,200,cfg.mcp.map(x=>({name:x.name,url:x.url,status:mcpLive.has(x.name)?"connected":x.status||"disconnected",tools:mcpLive.get(x.name)?.tools?.length||0})));
 if(u.pathname==="/api/mcp"&&req.method==="POST"){const b=await body(req);if(!b.name||!b.url||!/^https?:/.test(b.url))throw Error("Informe nome e URL HTTP(S) do servidor MCP.");const item={name:b.name,url:b.url};cfg.mcp=[...cfg.mcp.filter(x=>x.name!==item.name),item];await save();try{const result=await oauthStart(item);return send(res,200,result)}catch(e){return send(res,400,{error:e.message})}}
 if(u.pathname.startsWith("/api/mcp/")&&u.pathname.endsWith("/connect")&&req.method==="POST"){const name=decodeURIComponent(u.pathname.split("/")[3]),item=cfg.mcp.find(x=>x.name===name);if(!item)throw Error("Servidor MCP não encontrado.");if(item.accessToken){const live={...item};try{const tools=await connectMcp(live);return send(res,200,{status:"connected",tools:tools.length})}catch{item.accessToken="";item.refreshToken="";await save()}}const result=await oauthStart(item);return send(res,200,result)}
 if(u.pathname.startsWith("/api/mcp/")&&req.method==="DELETE"){const name=decodeURIComponent(u.pathname.split("/").pop());mcpLive.delete(name);cfg.mcp=cfg.mcp.filter(x=>x.name!==name);await save();return send(res,200,{ok:true})}
 let p=resolve(WEB,u.pathname==="/"?"index.html":decodeURIComponent(u.pathname.slice(1)));if(!inside(WEB,p))return send(res,404,{error:"Not found"});let file;try{file=await readFile(p)}catch(e){if(e.code==="ENOENT")return send(res,404,{error:"Not found"});throw e}res.writeHead(200,{"content-type":({".html":"text/html; charset=utf-8",".css":"text/css",".js":"text/javascript"})[extname(p)]||"application/octet-stream","x-content-type-options":"nosniff"});res.end(file)
 }catch(e){if(res.headersSent){res.destroy(e);return}send(res,500,{error:e.message})}});
server.listen(PORT,"127.0.0.1",()=>console.log("\nNEXO LOCAL AGENT\nWorkspace: "+WORK+"\nOpen: http://127.0.0.1:"+PORT+"\nPairing code: "+code+"\nKeep this terminal open. Ctrl+C to stop.\n"));

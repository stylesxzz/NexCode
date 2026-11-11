import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, relative, basename, extname } from "node:path";
import { randomBytes } from "node:crypto";

const PRIVATE4 = ip => {
 const p=ip.split(".").map(Number);
 return p[0]===0||p[0]===10||p[0]===127||p[0]>=224||
  (p[0]===169&&p[1]===254)||(p[0]===172&&p[1]>=16&&p[1]<=31)||
  (p[0]===192&&p[1]===168)||(p[0]===100&&p[1]>=64&&p[1]<=127)||
  (p[0]===192&&p[1]===0)||(p[0]===198&&(p[1]===18||p[1]===19));
};
function privateIp(ip){
 if(isIP(ip)===4)return PRIVATE4(ip);
 if(isIP(ip)===6){const s=ip.toLowerCase();return s==="::"||s==="::1"||s.startsWith("fc")||s.startsWith("fd")||s.startsWith("fe8")||s.startsWith("fe9")||s.startsWith("fea")||s.startsWith("feb")||s.startsWith("::ffff:");}
 return true;
}
async function publicUrl(value){
 const u=new URL(String(value||""));
 if(!["http:","https:"].includes(u.protocol)||u.username||u.password)throw Error("Use uma URL HTTP(S) pública, sem usuário ou senha.");
 if(u.port&& !["80","443"].includes(u.port))throw Error("Portas personalizadas não são aceitas na navegação.");
 if(["localhost","localhost.localdomain"].includes(u.hostname)||u.hostname.endsWith(".localhost")||u.hostname.endsWith(".local"))throw Error("Acesso a hosts locais bloqueado.");
 const addresses=isIP(u.hostname)?[{address:u.hostname}]:await lookup(u.hostname,{all:true,verbatim:true});
 if(!addresses.length||addresses.some(x=>privateIp(x.address)))throw Error("O endereço resolve para uma rede privada ou reservada; acesso bloqueado.");
 return u;
}
async function safeFetch(value,options={}){
 let current=await publicUrl(value);
 for(let i=0;i<4;i++){
  const response=await fetch(current,{...options,redirect:"manual",signal:options.signal||AbortSignal.timeout(18000)});
  if([301,302,303,307,308].includes(response.status)){
   const loc=response.headers.get("location");if(!loc)throw Error("Redirecionamento sem destino.");
   current=await publicUrl(new URL(loc,current).toString());continue;
  }
  return response;
 }
 throw Error("Muitos redirecionamentos.");
}
function stripHtml(html){
 return html.replace(/<(script|style|noscript|svg|nav|footer|header)[^>]*>[\s\S]*?<\/\1>/gi," ")
 .replace(/<br\s*\/?\s*>|<\/(p|div|article|section|h[1-6]|li|tr)>/gi,"\n")
 .replace(/<[^>]+>/g," ").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&#x([\da-f]+);/gi,(_,x)=>String.fromCodePoint(parseInt(x,16))).replace(/&#(\d+);/g,(_,x)=>String.fromCodePoint(+x)).replace(/[ \t]+/g," ").replace(/\n\s*/g,"\n").trim();
}
async function searchWeb(query,cfg){
 const q=String(query||"").trim().slice(0,500);if(!q)throw Error("Informe o que deseja pesquisar.");
 if(cfg.webSearchProvider==="brave"&&cfg.braveSearchKey){
  const u=new URL("https://api.search.brave.com/res/v1/web/search");u.searchParams.set("q",q);u.searchParams.set("count","8");
  const r=await fetch(u,{headers:{"X-Subscription-Token":cfg.braveSearchKey,accept:"application/json"},signal:AbortSignal.timeout(15000)});const d=await r.json();if(!r.ok)throw Error(d.message||"Brave Search HTTP "+r.status);
  return (d.web?.results||[]).slice(0,8).map(x=>({title:x.title,url:x.url,description:x.description||"",source:"Brave"}));
 }
 if(cfg.tavilyKey){
  const r=await fetch("https://api.tavily.com/search",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({api_key:cfg.tavilyKey,query:q,search_depth:"basic",max_results:8,include_answer:false}),signal:AbortSignal.timeout(15000)});
  const d=await r.json();if(!r.ok)throw Error(d.message||"Tavily HTTP "+r.status);
  return (d.results||[]).map(x=>({title:x.title,url:x.url,description:x.content||"",source:"Tavily"}));
 }
 const u=new URL("https://html.duckduckgo.com/html/");u.searchParams.set("q",q);
 const r=await fetch(u,{headers:{"user-agent":"Mozilla/5.0 (compatible; NEXCODE/1.0)","accept":"text/html"},signal:AbortSignal.timeout(15000)});const html=await r.text();if(!r.ok)throw Error("DuckDuckGo HTTP "+r.status);
 const results=[];for(const m of html.matchAll(/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>)?/gi)){
  let url=m[1];try{if(url.startsWith("//"))url="https:"+url;const parsed=new URL(url);if(parsed.hostname==="duckduckgo.com"){const target=parsed.searchParams.get("uddg");if(target)url=decodeURIComponent(target)}const clean=await publicUrl(url);results.push({title:stripHtml(m[2]),url:clean.toString(),description:stripHtml(m[3]||""),source:"DuckDuckGo"})}catch{}
  if(results.length===8)break;
 }
 return results;
}
async function openWeb(value){
 const u=await publicUrl(value),r=await safeFetch(u.toString(),{headers:{"user-agent":"Mozilla/5.0 (compatible; NEXCODE/1.0)","accept":"text/html,text/plain,application/xhtml+xml"}});
 if(!r.ok)throw Error("A página respondeu HTTP "+r.status);
 const type=r.headers.get("content-type")||"";if(!/text\/html|text\/plain|application\/xhtml\+xml/i.test(type))throw Error("Tipo de conteúdo não suportado: "+type);
 const raw=await r.text();if(raw.length>3_000_000)throw Error("Página maior que o limite de 3 MB.");
 return {url:r.url||u.toString(),title:stripHtml(raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||u.hostname),content:stripHtml(raw).slice(0,30000)};
}
function safeFile(work,path,ext){
 const base=String(path||"").replace(/[^a-z0-9._-]/gi,"_").slice(0,100);
 const name=(base&&base!=="."?base:"nexcode-"+Date.now()+ext);
 if(extname(name).toLowerCase()!==ext)throw Error("Extensão inválida.");
 const root=resolve(work),target=resolve(root,"generated-media",name);
 if(!target.startsWith(root+ (process.platform==="win32"?"\\":"\/")))throw Error("Caminho inválido.");
 return target;
}
async function imageGenerate(body,cfg,work){
 if(!cfg.imageApiKey)throw Error("Configure a chave da API de imagens em Configurações.");
 const prompt=String(body.prompt||"").trim().slice(0,4000);if(!prompt)throw Error("Descreva a imagem.");
 const model=String(body.model||cfg.imageModel||"gpt-image-1");
 const r=await fetch(String(cfg.imageBaseUrl||"https://api.openai.com/v1").replace(/\/$/,"")+"/images/generations",{method:"POST",headers:{authorization:"Bearer "+cfg.imageApiKey,"content-type":"application/json"},body:JSON.stringify({model,prompt,size:["1024x1024","1536x1024","1024x1536"].includes(body.size)?body.size:"1024x1024",quality:["low","medium","high"].includes(body.quality)?body.quality:"medium",n:1}),signal:AbortSignal.timeout(180000)});
 const d=await r.json();if(!r.ok)throw Error(d.error?.message||"API de imagem HTTP "+r.status);
 const item=d.data?.[0];if(!item?.b64_json)throw Error("O provedor não retornou a imagem em base64; este fluxo requer b64_json.");
 const target=safeFile(work,body.fileName||"nexcode-"+Date.now()+".png",".png");await mkdir(resolve(target,".."),{recursive:true});await writeFile(target,Buffer.from(item.b64_json,"base64"),{mode:0o600});
 return {created:relative(resolve(work),target),format:"PNG",revisedPrompt:item.revised_prompt||"",model};
}
async function videoCreate(body,cfg){
 if(!cfg.replicateApiKey)throw Error("Configure o token da Replicate em Configurações para gerar vídeos.");
 const model=String(body.model||cfg.videoModel||"");if(!/^[a-z0-9-]+\/[a-z0-9._-]+$/i.test(model))throw Error("Informe o modelo Replicate no formato proprietário/modelo.");
 const input={prompt:String(body.prompt||"").trim().slice(0,4000)};if(!input.prompt)throw Error("Descreva o vídeo.");
 if(body.imageUrl){const u=await publicUrl(body.imageUrl);input.image=u.toString()}
 if(body.duration!==undefined)input.duration=Math.max(1,Math.min(15,Number(body.duration)||5));
 if(body.aspectRatio)input.aspect_ratio=["16:9","9:16","1:1"].includes(body.aspectRatio)?body.aspectRatio:"16:9";
 const r=await fetch("https://api.replicate.com/v1/models/"+model+"/predictions",{method:"POST",headers:{authorization:"Bearer "+cfg.replicateApiKey,"content-type":"application/json","prefer":"wait=1"},body:JSON.stringify({input}),signal:AbortSignal.timeout(30000)});
 const d=await r.json();if(!r.ok)throw Error(d.detail||d.error||"Replicate HTTP "+r.status);
 if(!d.id)throw Error("A Replicate não retornou o identificador da geração.");
 return {id:d.id,status:d.status,urls:d.urls||{},output:d.output||null,error:d.error||null};
}
async function videoStatus(id,cfg){
 if(!cfg.replicateApiKey)throw Error("Configure o token da Replicate.");
 if(!/^[a-z0-9-]+$/i.test(String(id)))throw Error("ID de geração inválido.");
 const r=await fetch("https://api.replicate.com/v1/predictions/"+id,{headers:{authorization:"Bearer "+cfg.replicateApiKey},signal:AbortSignal.timeout(20000)}),d=await r.json();
 if(!r.ok)throw Error(d.detail||"Replicate HTTP "+r.status);
 return {id:d.id,status:d.status,output:d.output||null,error:d.error||null};
}
async function saveVideo(id,output,cfg,work){
 if(!cfg.replicateApiKey)throw Error("Configure o token da Replicate.");
 const raw=Array.isArray(output)?output[0]:output;if(typeof raw!=="string")throw Error("A geração não retornou uma URL de vídeo.");
 const u=await publicUrl(raw);const r=await safeFetch(u.toString());
 if(!r.ok)throw Error("Falha ao baixar o vídeo: HTTP "+r.status);
 const type=r.headers.get("content-type")||"";if(!type.startsWith("video/")&&!/octet-stream/i.test(type))throw Error("A saída não é um arquivo de vídeo: "+type);
 const declared=Number(r.headers.get("content-length"))||0;if(declared>300*1024*1024)throw Error("Vídeo acima do limite de 300 MB.");const chunks=[];let total=0;for await(const chunk of r.body){total+=chunk.length;if(total>300*1024*1024)throw Error("Vídeo acima do limite de 300 MB.");chunks.push(chunk)}const bytes=Buffer.concat(chunks);if(!bytes.length)throw Error("Vídeo vazio.");
 const target=safeFile(work,"nexcode-video-"+id+".mp4",".mp4");await mkdir(resolve(target,".."),{recursive:true});await writeFile(target,bytes,{mode:0o600});return {created:relative(resolve(work),target),format:"MP4",size:bytes.length};
}
export async function handleCreativeRequest({pathname,method,body,url,cfg,work,send}){
 if(pathname==="/api/web/search"&&method==="POST"){return send(200,{results:await searchWeb(body.query,cfg)})}
 if(pathname==="/api/web/open"&&method==="POST"){return send(200,await openWeb(body.url))}
 if(pathname==="/api/creative/image"&&method==="POST"){return send(201,{created:await imageGenerate(body,cfg,work)})}
 if(pathname==="/api/creative/video"&&method==="POST"){return send(202,await videoCreate(body,cfg))}
 const saveMatch=pathname.match(/^\/api\/creative\/video\/([a-z0-9-]+)\/save$/i);
 if(saveMatch&&method==="POST")return send(201,{created:await saveVideo(saveMatch[1],body.output,cfg,work)});
 const match=pathname.match(/^\/api\/creative\/video\/([a-z0-9-]+)$/i);
 if(match&&method==="GET")return send(200,await videoStatus(match[1],cfg));
 return false;
}

import {createServer} from "node:http";
import {readFile} from "node:fs/promises";
import {randomUUID} from "node:crypto";
import {executeWorkflow,INTEGRATIONS,type WorkflowDefinition} from "@nexcode/workflows";
const port=Number(process.env.NEXCODE_AUTOMATIONS_PORT||4280),token=process.env.NEXCODE_AUTOMATIONS_TOKEN||"";
const workflows=new Map<string,WorkflowDefinition>();let enabled=true;let controller:AbortController|null=null;
const json=(res:any,status:number,data:unknown)=>{res.writeHead(status,{"content-type":"application/json","access-control-allow-origin":"*","access-control-allow-methods":"GET,POST,PUT,DELETE,OPTIONS","access-control-allow-headers":"content-type,authorization"});res.end(JSON.stringify(data));};
const readBody=async(req:any):Promise<any>=>{let data="";for await(const chunk of req){data+=chunk;if(data.length>1_000_000)throw new Error("Request body exceeds 1 MB.");}return data?JSON.parse(data):{};};
const executors={
 trigger:async(_n:any,c:any)=>c.input,
 transform:async(n:any,c:any)=>{const template=n.config.template;if(typeof template==="string")return template.replace(/\$\{input\}/g,String(c.input??""));return c.input;},
 condition:async(n:any,c:any)=>{const value=c.input as any,field=String(n.config.field||"");const actual=field.split(".").reduce((v,k)=>v?.[k],value);const expected=n.config.value;switch(n.config.operator){case"equals":return actual===expected;case"not-equals":return actual!==expected;case"contains":return Array.isArray(actual)?actual.includes(expected):String(actual??"").includes(String(expected??""));case"greater-than":return Number(actual)>Number(expected);case"exists":return actual!==undefined&&actual!==null;default:throw new Error("Unsupported condition operator.");}},
 http:async(n:any,c:any)=>{const parsed=new URL(String(n.config.url||""));if(!["http:","https:"].includes(parsed.protocol))throw new Error("Only HTTP(S) URLs are allowed.");const method=String(n.config.method||"GET").toUpperCase();if(!["GET","POST","PUT","PATCH","DELETE"].includes(method))throw new Error("Unsupported HTTP method.");const response=await fetch(parsed,{method,headers:{"content-type":"application/json",...(n.config.headers as Record<string,string>||{})},...(method==="GET"||method==="DELETE"?{}:{body:JSON.stringify(c.input)}),signal:c.signal});const text=await response.text();if(!response.ok)throw new Error("HTTP "+response.status+": "+text.slice(0,1000));try{return JSON.parse(text)}catch{return text;}},
 delay:async(n:any,c:any)=>{const ms=Math.max(0,Math.min(60000,Number(n.config.milliseconds||0)));await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,ms);c.signal.addEventListener("abort",()=>{clearTimeout(timer);reject(new Error("Cancelled"));},{once:true});});return c.input;}
};
const server=createServer(async(req,res)=>{try{
if(req.method==="OPTIONS"){res.writeHead(204,{"access-control-allow-origin":"*","access-control-allow-methods":"GET,POST,PUT,DELETE,OPTIONS","access-control-allow-headers":"content-type,authorization"});return res.end();}
if(token&&req.headers.authorization!=="Bearer "+token)return json(res,401,{error:"Unauthorized"});
const url=new URL(req.url||"/","http://localhost");
if(req.method==="GET"&&url.pathname==="/"){const html=await readFile(new URL("../public/index.html",import.meta.url));res.writeHead(200,{"content-type":"text/html; charset=utf-8"});return res.end(html);}
if(req.method==="GET"&&url.pathname==="/health")return json(res,200,{ok:true,enabled,service:"nexcode-automations"});
if(req.method==="GET"&&url.pathname==="/api/integrations")return json(res,200,{items:INTEGRATIONS,count:INTEGRATIONS.length,note:"Initial connector catalog; provider adapters and OAuth flows are incremental."});
if(req.method==="GET"&&url.pathname==="/api/workflows")return json(res,200,{items:[...workflows.values()]});
if(req.method==="POST"&&url.pathname==="/api/control"){const body=await readBody(req);if(body.action==="enable")enabled=true;else if(body.action==="disable"){enabled=false;controller?.abort();}else if(body.action!=="status")return json(res,400,{error:"action must be enable, disable, or status"});return json(res,200,{enabled});}
if(req.method==="POST"&&url.pathname==="/api/workflows"){const body=await readBody(req) as WorkflowDefinition;if(!body.id)body.id=randomUUID();workflows.set(body.id,body);return json(res,201,{workflow:body});}
if(req.method==="POST"&&url.pathname.startsWith("/api/workflows/")&&url.pathname.endsWith("/run")){if(!enabled)return json(res,409,{error:"Automation engine is disabled."});const id=url.pathname.split("/")[3],flow=workflows.get(id);if(!flow)return json(res,404,{error:"Workflow not found."});controller=new AbortController();try{const body=await readBody(req);const outputs=await executeWorkflow(flow,executors,body.input,{signal:controller.signal});return json(res,200,{ok:true,outputs});}catch(e){return json(res,500,{error:e instanceof Error?e.message:String(e)});}finally{controller=null;}}
return json(res,404,{error:"Not found"});
}catch(error){return json(res,400,{error:error instanceof Error?error.message:String(error)});}});
server.listen(port,"0.0.0.0",()=>console.log("NEXCODE Automations listening on "+port));

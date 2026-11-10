import {createServer} from "node:http";
import {randomUUID} from "node:crypto";
import {executeWorkflow,INTEGRATIONS,type WorkflowDefinition,type NodeKind} from "@nexcode/workflows";
const port=Number(process.env.NEXCODE_AUTOMATIONS_PORT||4280),token=process.env.NEXCODE_AUTOMATIONS_TOKEN||"";
const workflows=new Map<string,WorkflowDefinition>();let enabled=true;let controller:AbortController|null=null;
const json=(res:any,status:number,data:unknown)=>{res.writeHead(status,{"content-type":"application/json","access-control-allow-origin":"*"});res.end(JSON.stringify(data));};
const server=createServer(async(req,res)=>{if(req.method==="OPTIONS"){res.writeHead(204,{"access-control-allow-origin":"*","access-control-allow-methods":"GET,POST,PUT,DELETE,OPTIONS","access-control-allow-headers":"content-type,authorization"});return res.end();}
if(token&&req.headers.authorization!=="Bearer "+token)return json(res,401,{error:"Unauthorized"});
const url=new URL(req.url||"/","http://localhost");
if(req.method==="GET"&&url.pathname==="/health")return json(res,200,{ok:true,enabled,service:"nexcode-automations"});
if(req.method==="GET"&&url.pathname==="/api/integrations")return json(res,200,{items:INTEGRATIONS,count:INTEGRATIONS.length,note:"Initial connector catalog; each provider adapter and OAuth flow is added incrementally."});
if(req.method==="GET"&&url.pathname==="/api/workflows")return json(res,200,{items:[...workflows.values()]});
if(req.method==="POST"&&url.pathname==="/api/control"){const body=await readBody(req);if(body.action==="enable")enabled=true;else if(body.action==="disable"){enabled=false;controller?.abort();}else if(body.action==="status"){}else return json(res,400,{error:"action must be enable, disable, or status"});return json(res,200,{enabled});}
if(req.method==="POST"&&url.pathname==="/api/workflows"){const body=await readBody(req) as WorkflowDefinition;if(!body.id)body.id=randomUUID();workflows.set(body.id,body);return json(res,201,{workflow:body});}
if(req.method==="POST"&&url.pathname.startsWith("/api/workflows/")&&url.pathname.endsWith("/run")){if(!enabled)return json(res,409,{error:"Automation engine is disabled."});const id=url.pathname.split("/")[3],flow=workflows.get(id);if(!flow)return json(res,404,{error:"Workflow not found."});controller=new AbortController();try{const outputs=await executeWorkflow(flow,{},(await readBody(req)).input,{signal:controller.signal});return json(res,200,{ok:true,outputs});}catch(e){return json(res,500,{error:e instanceof Error?e.message:String(e)});}finally{controller=null;}}
return json(res,404,{error:"Not found"});});
async function readBody(req:any):Promise<any>{let data="";for await(const chunk of req)data+=chunk;return data?JSON.parse(data):{};}
server.listen(port,"0.0.0.0",()=>console.log("NEXCODE Automations listening on "+port));

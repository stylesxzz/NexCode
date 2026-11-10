export type NodeKind = "trigger" | "http" | "condition" | "transform" | "code" | "ai" | "delay";
export type CodeLanguage = "javascript" | "python";
export interface WorkflowNode { id:string; kind:NodeKind; name:string; config:Record<string,unknown>; }
export interface WorkflowEdge { id:string; source:string; target:string; sourceHandle?:string; targetHandle?:string; }
export interface WorkflowDefinition { id:string; name:string; version:1; enabled:boolean; nodes:WorkflowNode[]; edges:WorkflowEdge[]; }
export interface IntegrationDefinition { id:string; name:string; category:string; auth:"none"|"api-key"|"oauth2"|"basic"; operations:string[]; }
export interface NodeContext { input:unknown; outputs:Record<string,unknown>; secrets:Record<string,string>; signal:AbortSignal; }
export type NodeExecutor=(node:WorkflowNode,context:NodeContext)=>Promise<unknown>;
export const INTEGRATIONS:IntegrationDefinition[] = [
["http","HTTP Request","Developer","none",["GET","POST","PUT","PATCH","DELETE"]],
["webhook","Webhook","Developer","none",["receive","respond"]],
["schedule","Schedule","Triggers","none",["cron","interval"]],
["openai","OpenAI","AI","api-key",["chat","embeddings"]],
["anthropic","Anthropic","AI","api-key",["messages"]],
["google-ai","Google AI","AI","api-key",["generate"]],
["slack","Slack","Communication","oauth2",["send-message","search"]],
["discord","Discord","Communication","oauth2",["send-message"]],
["telegram","Telegram","Communication","api-key",["send-message"]],
["gmail","Gmail","Communication","oauth2",["send","search"]],
["outlook","Microsoft Outlook","Communication","oauth2",["send","events"]],
["google-sheets","Google Sheets","Productivity","oauth2",["read","append","update"]],
["google-drive","Google Drive","Storage","oauth2",["upload","download","search"]],
["notion","Notion","Productivity","oauth2",["create-page","search","update"]],
["github","GitHub","Developer","oauth2",["issues","pull-requests","dispatch"]],
["gitlab","GitLab","Developer","oauth2",["issues","pipelines"]],
["linear","Linear","Productivity","oauth2",["issues","projects"]],
["jira","Jira","Productivity","oauth2",["issues","transitions"]],
["trello","Trello","Productivity","oauth2",["cards","boards"]],
["airtable","Airtable","Data","api-key",["list","create","update"]],
["postgres","PostgreSQL","Database","basic",["query","insert","update"]],
["mysql","MySQL","Database","basic",["query","insert","update"]],
["redis","Redis","Database","basic",["get","set","publish"]],
["mongodb","MongoDB","Database","basic",["find","insert","update"]],
["stripe","Stripe","Payments","api-key",["customers","invoices","payments"]],
["shopify","Shopify","Commerce","oauth2",["orders","products","customers"]],
["hubspot","HubSpot","CRM","oauth2",["contacts","deals"]],
["salesforce","Salesforce","CRM","oauth2",["leads","accounts","opportunities"]],
["twilio","Twilio","Communication","api-key",["sms","calls"]],
["sendgrid","SendGrid","Communication","api-key",["send-email"]],
["s3","Amazon S3","Storage","basic",["upload","download","list"]],
["s3-compatible","S3 Compatible","Storage","basic",["upload","download","list"]]
].map(([id,name,category,auth,operations])=>({id,name,category,auth,operations})) as IntegrationDefinition[];

export function validateWorkflow(flow:WorkflowDefinition):string[] {
 const errors:string[]=[]; const ids=new Set(flow.nodes.map(n=>n.id));
 if(!flow.id||!flow.name)errors.push("Workflow id and name are required.");
 if(flow.nodes.length===0)errors.push("Workflow needs at least one node.");
 if(new Set(ids).size!==flow.nodes.length)errors.push("Node IDs must be unique.");
 for(const e of flow.edges){if(!ids.has(e.source)||!ids.has(e.target))errors.push(`Edge ${e.id} references a missing node.`);if(e.source===e.target)errors.push("Self loops are not allowed.");}
 try{topologicalOrder(flow);}catch(e){errors.push(e instanceof Error?e.message:String(e));}
 return errors;
}
export function topologicalOrder(flow:WorkflowDefinition):WorkflowNode[] {
 const byId=new Map(flow.nodes.map(n=>[n.id,n]));const indegree=new Map(flow.nodes.map(n=>[n.id,0]));const next=new Map(flow.nodes.map(n=>[n.id,[] as string[]]));
 for(const edge of flow.edges){if(!byId.has(edge.source)||!byId.has(edge.target))throw new Error("Workflow edge references an unknown node.");next.get(edge.source)!.push(edge.target);indegree.set(edge.target,(indegree.get(edge.target)||0)+1);}
 const queue=flow.nodes.filter(n=>indegree.get(n.id)===0).map(n=>n.id);const order:WorkflowNode[]=[];
 while(queue.length){const id=queue.shift()!;order.push(byId.get(id)!);for(const target of next.get(id)!){const degree=indegree.get(target)!-1;indegree.set(target,degree);if(degree===0)queue.push(target);}}
 if(order.length!==flow.nodes.length)throw new Error("Workflow contains a cycle. Add an explicit loop node in a future version; cycles are not implicitly executed.");
 return order;
}
export async function executeWorkflow(flow:WorkflowDefinition,executors:Partial<Record<NodeKind,NodeExecutor>>,input:unknown,options:{secrets?:Record<string,string>;signal?:AbortSignal;onNode?:(id:string,state:"running"|"success"|"error",detail?:unknown)=>void}={}):Promise<Record<string,unknown>> {
 const errors=validateWorkflow(flow);if(errors.length)throw new Error(errors.join("\n"));
 const outputs:Record<string,unknown>={};const incoming=new Map(flow.nodes.map(n=>[n.id,flow.edges.filter(e=>e.target===n.id)]));
 for(const node of topologicalOrder(flow)){
  if(options.signal?.aborted)throw new Error("Workflow execution cancelled.");
  const parents=incoming.get(node.id)!;const nodeInput=parents.length===0?input:parents.length===1?outputs[parents[0]!.source]:Object.fromEntries(parents.map(e=>[e.source,outputs[e.source]]));
  const executor=executors[node.kind];if(!executor)throw new Error(`No executor registered for node kind: ${node.kind}`);
  options.onNode?.(node.id,"running");
  try{outputs[node.id]=await executor(node,{input:nodeInput,outputs,secrets:options.secrets||{},signal:options.signal||new AbortController().signal});options.onNode?.(node.id,"success",outputs[node.id]);}
  catch(error){options.onNode?.(node.id,"error",error instanceof Error?error.message:String(error));throw new Error(`Node "${node.name}" failed: ${error instanceof Error?error.message:String(error)}`);}
 }
 return outputs;
}

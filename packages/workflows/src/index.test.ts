import {describe,it,expect} from "vitest";
import {topologicalOrder,validateWorkflow,executeWorkflow,type WorkflowDefinition} from "./index.js";
const graph:WorkflowDefinition={id:"demo",name:"Demo",version:1,enabled:true,nodes:[{id:"a",kind:"trigger",name:"Trigger",config:{}},{id:"b",kind:"transform",name:"Transform",config:{}}],edges:[{id:"ab",source:"a",target:"b"}]};
describe("workflow graph",()=>{
 it("orders nodes by dependency",()=>expect(topologicalOrder(graph).map(n=>n.id)).toEqual(["a","b"]));
 it("rejects cycles",()=>expect(validateWorkflow({...graph,edges:[...graph.edges,{id:"ba",source:"b",target:"a"}]})).toContain("Workflow contains a cycle. Add an explicit loop node in a future version; cycles are not implicitly executed."));
 it("executes registered nodes and returns outputs",async()=>{const outputs=await executeWorkflow(graph,{trigger:async(_n,c)=>c.input,transform:async(_n,c)=>({value:c.input})},{hello:"world"});expect(outputs.b).toEqual({value:{hello:"world"}})});
});

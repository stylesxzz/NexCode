import { describe, expect, it } from "vitest";
import { handleCreativeRequest } from "./creative-web.js";

const invoke=(pathname,method="POST",body={})=>handleCreativeRequest({
 pathname,method,body,cfg:{},work:"/tmp/nexcode-test",
 send:(status,data)=>({status,...data})
});

describe("NEXCODE Web & Creative API",()=>{
 it("ignores routes it does not own",async()=>expect(await invoke("/api/unknown")).toBe(false));
 it("blocks localhost page access",async()=>await expect(invoke("/api/web/open","POST",{url:"http://127.0.0.1:4173"})).rejects.toThrow(/local|privada|bloqueado/i));
 it("requires an image provider key",async()=>await expect(invoke("/api/creative/image","POST",{prompt:"A test image"})).rejects.toThrow(/chave da API de imagens/i));
 it("requires a Replicate key for video jobs",async()=>await expect(invoke("/api/creative/video","POST",{prompt:"A test video",model:"owner/model"})).rejects.toThrow(/token da Replicate/i));
 it("rejects unsupported URL protocols",async()=>await expect(invoke("/api/web/open","POST",{url:"file:///etc/passwd"})).rejects.toThrow(/HTTP\(S\)/i));
});

import { readFile, writeFile, rename } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
const FILE = join(homedir(), ".nexcode", "bookmarks.json");
async function readAll() { try { const x = JSON.parse(await readFile(FILE, "utf8")); return Array.isArray(x) ? x : []; } catch(e) { if(e.code==="ENOENT") return []; throw e; } }
async function save(items) { const tmp=FILE+"."+randomUUID()+".tmp"; await writeFile(tmp,JSON.stringify(items,null,2),{mode:0o600}); await rename(tmp,FILE); }
export async function listBookmarks() { return readAll(); }
export async function addBookmark(name, rawUrl) {
  const title=String(name||"").trim().slice(0,80); if(!title) throw new Error("Informe o nome do favorito.");
  const url=new URL(String(rawUrl||"")); if(!["https:","http:"].includes(url.protocol)||url.username||url.password) throw new Error("Informe um endereço HTTP ou HTTPS válido.");
  const items=await readAll(); if(items.some(x=>x.url===url.href)) throw new Error("Este site já está salvo.");
  const item={id:randomUUID(),name:title,url:url.href,createdAt:new Date().toISOString()};
  items.unshift(item); await save(items); return item;
}
export async function removeBookmark(id) { const items=await readAll(), next=items.filter(x=>x.id!==id); if(next.length===items.length)return false; await save(next); return true; }

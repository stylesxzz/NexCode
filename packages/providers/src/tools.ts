import { spawn } from "node:child_process";
import { appendFile, lstat, mkdir, readdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { tool } from "ai";
import { connectStdioServer } from "@nexcode/mcp";
import { z } from "zod";

export interface ApprovalRequest {
  action: "write_file" | "run_command" | "mcp_connect" | "mcp_tool";
  summary: string;
  details: string;
}

export type ApprovalHandler = (request: ApprovalRequest) => Promise<boolean>;

export interface WorkspaceToolsOptions {
  rootDir: string;
  requestApproval?: ApprovalHandler;
  allowMutations?: boolean;
}

const IGNORED = new Set([".git", "node_modules", "dist", ".next", "coverage", ".turbo"]);
const MAX_FILE_BYTES = 256 * 1024;
const MAX_OUTPUT_CHARS = 24_000;

async function workspaceRoot(rootDir: string): Promise<string> {
  return realpath(resolve(rootDir));
}

export function resolveWorkspacePath(root: string, relativePath: string): string {
  if (!relativePath || isAbsolute(relativePath) || relativePath.includes("\0")) {
    throw new Error("Use a non-empty relative path inside the workspace.");
  }
  const target = resolve(root, relativePath);
  const rel = relative(root, target);
  if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error("Path escapes the workspace root.");
  }
  return target;
}

async function assertNoSecretPath(root: string, target: string): Promise<void> {
  const rel = relative(root, target).split(sep);
  if (rel.some((part) => part === ".git" || part === "node_modules")) {
    throw new Error("Access to .git and node_modules is blocked.");
  }
  const hasSecretEnvSegment = rel.some((part) => /^\.env(?:\.|$)/i.test(part));
  const isEnvExample = rel.at(-1) === ".env.example";
  if (hasSecretEnvSegment && !isEnvExample) {
    throw new Error("Secret environment files are blocked. Read .env.example instead.");
  }
}

async function verifyExistingPath(root: string, target: string): Promise<void> {
  const resolved = await realpath(target);
  const rel = relative(root, resolved);
  if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error("Symlink points outside the workspace.");
  }
}

async function listTree(root: string, base: string, depth: number, output: string[]): Promise<void> {
  if (output.length >= 500 || depth > 5) return;
  const entries = await readdir(base, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (IGNORED.has(entry.name)) continue;
    const full = resolve(base, entry.name);
    const label = relative(root, full);
    output.push(entry.isDirectory() ? `${label}/` : label);
    if (entry.isDirectory() && output.length < 500) {
      await listTree(root, full, depth + 1, output);
    }
    if (output.length >= 500) break;
  }
}

export function createAuditedApprovalHandler(
  rootDir: string,
  handler: ApprovalHandler,
): ApprovalHandler {
  const rootPromise = workspaceRoot(rootDir);
  return async (request) => {
    const approved = await handler(request);
    const root = await rootPromise;
    const auditDir = resolve(root, ".nexcode");
    await mkdir(auditDir, { recursive: true });
    await appendFile(
      resolve(auditDir, "audit.jsonl"),
      JSON.stringify({ timestamp: new Date().toISOString(), ...request, approved }) + "\n",
      "utf8",
    );
    return approved;
  };
}

export function createWorkspaceTools(options: WorkspaceToolsOptions) {
  const rootPromise = workspaceRoot(options.rootDir);
  const requestApproval: ApprovalHandler = options.requestApproval ?? (async () => false);

  const readTools = {
    list_files: tool({
      description: "List project files and folders. Always inspect the workspace before proposing edits.",
      inputSchema: z.object({ path: z.string().optional().describe("Relative directory, default is workspace root") }),
      execute: async ({ path }) => {
        const root = await rootPromise;
        const target = path ? resolveWorkspacePath(root, path) : root;
        await verifyExistingPath(root, target);
        const info = await stat(target);
        if (!info.isDirectory()) throw new Error("The requested path is not a directory.");
        const files: string[] = [];
        await listTree(root, target, 0, files);
        return { root, files };
      },
    }),
    read_file: tool({
      description: "Read a text file in the project. Secret .env files, .git and node_modules are blocked.",
      inputSchema: z.object({ path: z.string().min(1) }),
      execute: async ({ path }) => {
        const root = await rootPromise;
        const target = resolveWorkspacePath(root, path);
        await assertNoSecretPath(root, target);
        await verifyExistingPath(root, target);
        const info = await stat(target);
        if (!info.isFile()) throw new Error("The requested path is not a file.");
        if (info.size > MAX_FILE_BYTES) throw new Error(`File exceeds the ${MAX_FILE_BYTES} byte read limit.`);
        const content = await readFile(target, "utf8");
        if (content.includes("\0")) throw new Error("Binary files are not supported.");
        return { path, content };
      },
    }),
    search_text: tool({
      description: "Search for a literal text string in project files, excluding generated and dependency folders.",
      inputSchema: z.object({
        query: z.string().min(1),
        path: z.string().optional(),
      }),
      execute: async ({ query, path }) => {
        const root = await rootPromise;
        const base = path ? resolveWorkspacePath(root, path) : root;
        await verifyExistingPath(root, base);
        const matches: Array<{ path: string; line: number; text: string }> = [];
        const visit = async (dir: string): Promise<void> => {
          if (matches.length >= 100) return;
          const entries = await readdir(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (IGNORED.has(entry.name) || /^\.env(?:\.|$)/i.test(entry.name)) continue;
            const full = resolve(dir, entry.name);
            if (entry.isDirectory()) await visit(full);
            else if (entry.isFile()) {
              const info = await stat(full);
              if (info.size > MAX_FILE_BYTES) continue;
              const content = await readFile(full, "utf8").catch(() => "");
              if (content.includes("\0")) continue;
              content.split("\n").forEach((line, index) => {
                if (line.toLowerCase().includes(query.toLowerCase()) && matches.length < 100) {
                  matches.push({ path: relative(root, full), line: index + 1, text: line.slice(0, 300) });
                }
              });
            }
            if (matches.length >= 100) break;
          }
        };
        await visit(base);
        return { query, matches };
      },
    }),
  };

  if (!options.allowMutations) return readTools;

  return {
    ...readTools,
    write_file: tool({
      description: "Create or replace a text file inside the workspace. Always requires the user's explicit approval.",
      inputSchema: z.object({
        path: z.string().min(1),
        content: z.string(),
      }),
      execute: async ({ path, content }) => {
        const root = await rootPromise;
        const target = resolveWorkspacePath(root, path);
        await assertNoSecretPath(root, target);
        const parentPath = resolve(target, "..");
        let existingAncestor = parentPath;
        while (true) {
          try {
            const resolvedAncestor = await realpath(existingAncestor);
            const relAncestor = relative(root, resolvedAncestor);
            if (relAncestor === ".." || relAncestor.startsWith(`..${sep}`) || isAbsolute(relAncestor)) {
              throw new Error("Parent directory escapes the workspace.");
            }
            break;
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
            const next = resolve(existingAncestor, "..");
            if (next === existingAncestor) throw error;
            existingAncestor = next;
          }
        }
        try {
          const targetInfo = await lstat(target);
          if (targetInfo.isSymbolicLink()) throw new Error("Writing through symbolic links is blocked.");
          await verifyExistingPath(root, target);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
        const existing = await readFile(target, "utf8").catch(() => "");
        const approved = await requestApproval({
          action: "write_file",
          summary: `Write file: ${path}`,
          details: `Bytes: ${Buffer.byteLength(content, "utf8")}\nExisting file: ${existing ? "yes (will be replaced)" : "no (will be created)"}\nPreview:\n${content.split("\n").slice(0, 24).join("\n").slice(0, 2400)}`,
        });
        if (!approved) return { approved: false, message: "User denied the file write." };
        await mkdir(parentPath, { recursive: true });
        await verifyExistingPath(root, parentPath);
        await writeFile(target, content, "utf8");
        return { approved: true, path, bytesWritten: Buffer.byteLength(content, "utf8") };
      },
    }),
    run_command: tool({
      description: "Run a program in the workspace without a shell. Every command requires explicit user approval. Pass executable and arguments separately.",
      inputSchema: z.object({
        command: z.string().min(1),
        args: z.array(z.string()).default([]),
        timeoutMs: z.number().int().min(1000).max(120000).default(30000),
      }),
      execute: async ({ command, args, timeoutMs }) => {
        const root = await rootPromise;
        const printable = [command, ...args].join(" ");
        if (/(^|\s)(shutdown|reboot|mkfs|fdisk|format)(\s|$)/i.test(printable) ||
            /rm\s+(-[a-z]*r[a-z]*f|--no-preserve-root)\s+\//i.test(printable) ||
            /:\s*\(\)\s*\{/i.test(printable) ||
            /\|\s*(sh|bash|zsh)\b/i.test(printable)) {
          throw new Error("This command matches a blocked destructive pattern.");
        }
        const approved = await requestApproval({
          action: "run_command",
          summary: `Run command: ${printable}`,
          details: `Working directory: ${root}\nExecution: direct process (no shell)\nTimeout: ${timeoutMs} ms\nArguments are passed separately; no shell expansion is performed.`,
        });
        if (!approved) return { approved: false, message: "User denied command execution." };

        const safeEnv: NodeJS.ProcessEnv = {};
        for (const key of ["PATH", "HOME", "USERPROFILE", "TMP", "TEMP", "SYSTEMROOT", "WINDIR", "COMSPEC", "PATHEXT", "LANG", "LC_ALL"]) {
          if (process.env[key]) safeEnv[key] = process.env[key];
        }
        return await new Promise((resolveResult, reject) => {
          const child = spawn(command, args, {
            cwd: root,
            env: safeEnv,
            shell: false,
            windowsHide: true,
            stdio: ["ignore", "pipe", "pipe"],
          });
          let stdout = "";
          let stderr = "";
          let settled = false;
          const timer = setTimeout(() => {
            child.kill("SIGTERM");
            if (!settled) {
              settled = true;
              resolveResult({ timedOut: true, stdout: stdout.slice(-MAX_OUTPUT_CHARS), stderr: stderr.slice(-MAX_OUTPUT_CHARS) });
            }
          }, timeoutMs);
          child.stdout.on("data", (chunk: Buffer) => { stdout = (stdout + chunk.toString()).slice(-MAX_OUTPUT_CHARS); });
          child.stderr.on("data", (chunk: Buffer) => { stderr = (stderr + chunk.toString()).slice(-MAX_OUTPUT_CHARS); });
          child.once("error", (error) => {
            clearTimeout(timer);
            if (!settled) { settled = true; reject(error); }
          });
          child.once("close", (code, signal) => {
            clearTimeout(timer);
            if (!settled) {
              settled = true;
              resolveResult({ exitCode: code, signal, stdout, stderr });
            }
          });
        });
      },
    }),
  };
}

export interface McpToolsResult {
  tools: Record<string, any>;
  close: () => Promise<void>;
}

export async function createConfiguredMcpTools(
  rootDir: string,
  requestApproval: ApprovalHandler,
): Promise<McpToolsResult> {
  const configPath = resolve(rootDir, ".nexcode", "mcp.json");
  let raw: string;
  try {
    raw = await readFile(configPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { tools: {}, close: async () => undefined };
    }
    throw error;
  }

  const parsed = JSON.parse(raw) as {
    servers?: Array<{ name: string; command: string; args?: string[]; env?: Record<string, string> }>;
  };
  if (!Array.isArray(parsed.servers)) {
    throw new Error("Invalid .nexcode/mcp.json: expected a servers array.");
  }
  if (parsed.servers.length > 8) {
    throw new Error("At most 8 MCP servers can be configured.");
  }

  const tools: Record<string, any> = {};
  const connections: Array<{ client: Awaited<ReturnType<typeof connectStdioServer>>["client"]; close: () => Promise<void> }> = [];

  try {
    for (const server of parsed.servers) {
      if (!server.name?.trim() || !server.command?.trim()) {
        throw new Error("Every MCP server needs a non-empty name and command.");
      }
      const connectApproved = await requestApproval({
        action: "mcp_connect",
        summary: `Start MCP server: ${server.name}`,
        details: `Executable: ${server.command}\nArguments: ${(server.args ?? []).join(" ")}\nEnvironment: only safe system variables plus explicitly configured values are passed.\nConfig: .nexcode/mcp.json`,
      });
      if (!connectApproved) continue;

      const connection = await connectStdioServer({
        command: server.command,
        args: server.args ?? [],
        ...(server.env ? { env: server.env } : {}),
      });
      connections.push(connection);
      const listed = await connection.client.listTools();

      for (const mcpTool of listed.tools) {
        const toolName = `${server.name}_${mcpTool.name}`.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
        if (tools[toolName]) throw new Error(`Duplicate MCP tool name: ${toolName}`);
        tools[toolName] = tool({
          description: `MCP server ${server.name}: ${mcpTool.description ?? mcpTool.name}. Input JSON Schema: ${JSON.stringify(mcpTool.inputSchema)}. This action requires the user's approval before it runs.`,
          inputSchema: z.record(z.string(), z.unknown()),
          execute: async (input: Record<string, unknown>) => {
            const approved = await requestApproval({
              action: "mcp_tool",
              summary: `Run MCP tool: ${server.name}/${mcpTool.name}`,
              details: `Arguments:\n${JSON.stringify(input, null, 2).slice(0, 3000)}`,
            });
            if (!approved) return { approved: false, message: "User denied the MCP tool call." };
            return connection.client.callTool({
              name: mcpTool.name,
              arguments: input as Record<string, unknown>,
            });
          },
        });
      }
    }
    return {
      tools,
      close: async () => {
        await Promise.allSettled(connections.map((connection) => connection.close()));
      },
    };
  } catch (error) {
    await Promise.allSettled(connections.map((connection) => connection.close()));
    throw error;
  }
}

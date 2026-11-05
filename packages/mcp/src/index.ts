import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export interface StdioServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export async function connectStdioServer(config: StdioServerConfig) {
  if (!config.command.trim()) throw new Error("MCP server command is required.");

  const client = new Client({
    name: "nexcode",
    version: "0.3.0",
  });

  const safeEnv: Record<string, string> = {};
  for (const key of ["PATH", "HOME", "USERPROFILE", "TMP", "TEMP", "SYSTEMROOT", "WINDIR", "COMSPEC", "PATHEXT", "LANG", "LC_ALL"]) {
    const value = process.env[key];
    if (value) safeEnv[key] = value;
  }

  const transport = new StdioClientTransport({
    command: config.command,
    args: config.args ?? [],
    env: { ...safeEnv, ...config.env },
  });

  await client.connect(transport);

  return {
    client,
    close: () => client.close(),
  };
}

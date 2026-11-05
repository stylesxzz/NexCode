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

  const transport = new StdioClientTransport({
    command: config.command,
    args: config.args ?? [],
    ...(config.env ? { env: config.env } : {}),
  });

  await client.connect(transport);

  return {
    client,
    close: () => client.close(),
  };
}

import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, stepCountIs } from "ai";
import { createAuditedApprovalHandler, createConfiguredMcpTools, createWorkspaceTools, type ApprovalHandler } from "./tools.js";
import { systemPromptFor, type WorkMode } from "@nexcode/core";

export type ProviderName =
  | "nvidia"
  | "openai"
  | "anthropic"
  | "google"
  | "ollama"
  | "openai-compatible";

export interface ProviderConfig {
  apiKey: string;
  baseURL?: string;
  model: string;
  providerName: ProviderName;
}

export function providerConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): ProviderConfig {
  const rawProvider = env.NEXCODE_PROVIDER?.trim().toLowerCase() || "nvidia";
  const supported: ProviderName[] = [
    "nvidia",
    "openai",
    "anthropic",
    "google",
    "ollama",
    "openai-compatible",
  ];
  if (!supported.includes(rawProvider as ProviderName)) {
    throw new Error(`Unsupported provider "${rawProvider}". Supported: ${supported.join(", ")}.`);
  }

  const providerName = rawProvider as ProviderName;
  const providerKeys: Partial<Record<ProviderName, string | undefined>> = {
    nvidia: env.NVIDIA_API_KEY,
    openai: env.OPENAI_API_KEY,
    anthropic: env.ANTHROPIC_API_KEY,
    google: env.GOOGLE_API_KEY,
    ollama: "ollama",
    "openai-compatible": env.NEXCODE_API_KEY,
  };
  const apiKey =
    env.NEXCODE_API_KEY?.trim() || providerKeys[providerName]?.trim();

  if (!apiKey) {
    throw new Error(
      `API key is missing for provider "${providerName}". Set NEXCODE_API_KEY or its provider-specific key in .env.`,
    );
  }

  const defaultBaseURLs: Partial<Record<ProviderName, string>> = {
    nvidia: "https://integrate.api.nvidia.com/v1",
    ollama: "http://localhost:11434/v1",
  };

  const baseURL = env.NEXCODE_BASE_URL?.trim() || defaultBaseURLs[providerName];

  return {
    apiKey,
    ...(baseURL ? { baseURL } : {}),
    model: env.NEXCODE_MODEL?.trim() || "meta/llama-3.3-70b-instruct",
    providerName,
  };
}

export interface GenerateOptions {
  workspaceRoot?: string;
  requestApproval?: ApprovalHandler;
}

export async function generateResponse(
  prompt: string,
  mode: WorkMode,
  options: GenerateOptions = {},
  config = providerConfigFromEnv(),
): Promise<string> {
  if (!prompt.trim()) throw new Error("Prompt cannot be empty.");

  let model;
  switch (config.providerName) {
    case "openai":
      model = createOpenAI({ apiKey: config.apiKey })(config.model);
      break;
    case "anthropic":
      model = createAnthropic({ apiKey: config.apiKey })(config.model);
      break;
    case "google":
      model = createGoogleGenerativeAI({ apiKey: config.apiKey })(config.model);
      break;
    case "nvidia":
    case "ollama":
    case "openai-compatible":
      model = createOpenAICompatible({
        name: config.providerName,
        baseURL: config.baseURL ?? "https://integrate.api.nvidia.com/v1",
        apiKey: config.apiKey,
      }).chatModel(config.model);
      break;
  }

  const auditedApproval = options.workspaceRoot && options.requestApproval
    ? createAuditedApprovalHandler(options.workspaceRoot, options.requestApproval)
    : undefined;
  const workspaceTools = options.workspaceRoot && mode !== "ask"
    ? createWorkspaceTools({
        rootDir: options.workspaceRoot,
        ...(auditedApproval ? { requestApproval: auditedApproval } : {}),
        allowMutations: mode === "development",
      })
    : undefined;
  const mcpTools = options.workspaceRoot && mode === "development" && auditedApproval
    ? await createConfiguredMcpTools(options.workspaceRoot, auditedApproval)
    : undefined;
  const allTools = workspaceTools
    ? { ...workspaceTools, ...(mcpTools?.tools ?? {}) }
    : undefined;

  try {
    const result = await generateText({
      model,
      system: systemPromptFor(mode),
      prompt,
      temperature: 0.2,
      ...(allTools ? { tools: allTools, stopWhen: stepCountIs(8) } : {}),
    });
    return result.text;
  } finally {
    await mcpTools?.close();
  }
}

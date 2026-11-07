import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, stepCountIs } from "ai";
import { createAuditedApprovalHandler, createConfiguredMcpTools, createWorkspaceTools, type ApprovalHandler } from "./tools.js";
import { systemPromptFor, type ChatMessage, type WorkMode } from "@nexcode/core";

export type ProviderName =
  | "nvidia" | "openai" | "anthropic" | "google" | "ollama"
  | "openai-compatible" | "openrouter" | "groq" | "deepseek" | "mistral"
  | "together" | "fireworks" | "cerebras" | "xai" | "perplexity" | "cohere";

export interface ProviderConfig {
  apiKey: string;
  baseURL?: string;
  model: string;
  providerName: ProviderName;
}

const DEFAULT_BASE_URLS: Partial<Record<ProviderName, string>> = {
  nvidia: "https://integrate.api.nvidia.com/v1",
  ollama: "http://127.0.0.1:11434/v1",
  openrouter: "https://openrouter.ai/api/v1",
  groq: "https://api.groq.com/openai/v1",
  deepseek: "https://api.deepseek.com/v1",
  mistral: "https://api.mistral.ai/v1",
  together: "https://api.together.xyz/v1",
  fireworks: "https://api.fireworks.ai/inference/v1",
  cerebras: "https://api.cerebras.ai/v1",
  xai: "https://api.x.ai/v1",
  perplexity: "https://api.perplexity.ai",
  cohere: "https://api.cohere.ai/compatibility/v1",
};

export function providerConfigFromEnv(env: NodeJS.ProcessEnv = process.env): ProviderConfig {
  const rawProvider = env.NEXCODE_PROVIDER?.trim().toLowerCase() || "nvidia";
  const supported: ProviderName[] = [
    "nvidia", "openai", "anthropic", "google", "ollama", "openai-compatible",
    "openrouter", "groq", "deepseek", "mistral", "together", "fireworks",
    "cerebras", "xai", "perplexity", "cohere",
  ];
  if (!supported.includes(rawProvider as ProviderName)) {
    throw new Error('Unsupported provider "' + rawProvider + '". Supported: ' + supported.join(", ") + ".");
  }
  const providerName = rawProvider as ProviderName;
  const providerKeys: Partial<Record<ProviderName, string | undefined>> = {
    nvidia: env.NVIDIA_API_KEY, openai: env.OPENAI_API_KEY, anthropic: env.ANTHROPIC_API_KEY,
    google: env.GOOGLE_API_KEY, ollama: "ollama", openrouter: env.OPENROUTER_API_KEY,
    groq: env.GROQ_API_KEY, deepseek: env.DEEPSEEK_API_KEY, mistral: env.MISTRAL_API_KEY,
    together: env.TOGETHER_API_KEY, fireworks: env.FIREWORKS_API_KEY, cerebras: env.CEREBRAS_API_KEY,
    xai: env.XAI_API_KEY, perplexity: env.PERPLEXITY_API_KEY, cohere: env.COHERE_API_KEY,
    "openai-compatible": env.NEXCODE_API_KEY,
  };
  const apiKey = env.NEXCODE_API_KEY?.trim() || providerKeys[providerName]?.trim();
  if (!apiKey) throw new Error('API key is missing for provider "' + providerName + '". Add it in Nexo Settings.');
  const baseURL = env.NEXCODE_BASE_URL?.trim() || DEFAULT_BASE_URLS[providerName];
  const model = env.NEXCODE_MODEL?.trim() || "meta/llama-3.3-70b-instruct";
  return { apiKey, ...(baseURL ? { baseURL } : {}), model, providerName };
}

export interface GenerateOptions {
  workspaceRoot?: string;
  requestApproval?: ApprovalHandler;
  messages?: ChatMessage[];
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
    case "openai": model = createOpenAI({ apiKey: config.apiKey })(config.model); break;
    case "anthropic": model = createAnthropic({ apiKey: config.apiKey })(config.model); break;
    case "google": model = createGoogleGenerativeAI({ apiKey: config.apiKey })(config.model); break;
    default:
      model = createOpenAICompatible({
        name: config.providerName,
        baseURL: config.baseURL ?? DEFAULT_BASE_URLS[config.providerName] ?? "https://integrate.api.nvidia.com/v1",
        apiKey: config.apiKey,
      }).chatModel(config.model);
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
  const allTools = workspaceTools ? { ...workspaceTools, ...(mcpTools?.tools ?? {}) } : undefined;
  try {
    const history = options.messages?.slice(-20) ?? [];
    const result = await generateText({
      model, system: systemPromptFor(mode),
      ...(history.length ? { messages: [...history, { role: "user" as const, content: prompt }] } : { prompt }),
      temperature: 0.2,
      ...(allTools ? { tools: allTools, stopWhen: stepCountIs(8) } : {}),
    });
    return result.text;
  } finally { await mcpTools?.close(); }
}

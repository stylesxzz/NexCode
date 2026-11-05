import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import { systemPromptFor, type WorkMode } from "@nexcode/core";

export interface ProviderConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  providerName?: string;
}

export function providerConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): ProviderConfig {
  const apiKey = env.NEXCODE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("NEXCODE_API_KEY is missing. Copy .env.example to .env and configure your provider.");
  }

  return {
    apiKey,
    baseURL: env.NEXCODE_BASE_URL?.trim() || "https://integrate.api.nvidia.com/v1",
    model: env.NEXCODE_MODEL?.trim() || "meta/llama-3.3-70b-instruct",
    providerName: env.NEXCODE_PROVIDER?.trim() || "custom-openai-compatible",
  };
}

export async function generateResponse(
  prompt: string,
  mode: WorkMode,
  config = providerConfigFromEnv(),
): Promise<string> {
  if (!prompt.trim()) throw new Error("Prompt cannot be empty.");

  const provider = createOpenAICompatible({
    name: config.providerName ?? "nexcode-provider",
    baseURL: config.baseURL,
    apiKey: config.apiKey,
  });

  const result = await generateText({
    model: provider.chatModel(config.model),
    system: systemPromptFor(mode),
    prompt,
    temperature: 0.2,
  });

  return result.text;
}

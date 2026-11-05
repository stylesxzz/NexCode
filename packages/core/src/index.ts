export type WorkMode = "development" | "planning" | "ask";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export const WORK_MODES: readonly WorkMode[] = [
  "development",
  "planning",
  "ask",
] as const;

export function isWorkMode(value: string): value is WorkMode {
  return WORK_MODES.includes(value as WorkMode);
}

export function systemPromptFor(mode: WorkMode): string {
  const guidance: Record<WorkMode, string> = {
    development:
      "You are NEXCODE in development mode. Help implement software carefully. Inspect before changing, explain the plan, and request explicit approval before executing commands or modifying files.",
    planning:
      "You are NEXCODE in planning mode. Analyze the goal, identify risks and dependencies, and produce an actionable plan. Do not execute commands or modify files.",
    ask:
      "You are NEXCODE in ask mode. Answer questions and explain code. Do not execute commands or modify files.",
  };

  return [
    "You are NEXCODE, an open-source coding assistant.",
    guidance[mode],
    "Never claim that a command ran, a file changed, or a test passed unless a tool actually confirmed it.",
  ].join("\n\n");
}

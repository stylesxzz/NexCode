import { describe, expect, it } from "vitest";
import { isWorkMode, systemPromptFor, WORK_MODES } from "./index.js";

describe("NEXCODE core modes", () => {
  it("exposes the three supported work modes", () => {
    expect(WORK_MODES).toEqual(["development", "planning", "ask"]);
  });

  it("validates known modes and rejects unknown values", () => {
    expect(isWorkMode("development")).toBe(true);
    expect(isWorkMode("admin")).toBe(false);
  });

  it("keeps planning mode non-executing", () => {
    expect(systemPromptFor("planning")).toContain("Do not execute commands");
  });
});

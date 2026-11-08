import { describe, expect, it } from "vitest";
import { parseGitHubRepository, EVOLUTION_SAFETY_POLICY } from "./index.js";

describe("parseGitHubRepository", () => {
  it("accepts a repository URL and normalizes the .git suffix", () => {
    expect(parseGitHubRepository("https://github.com/owner/project.git")).toEqual({
      owner: "owner",
      name: "project",
      cloneUrl: "https://github.com/owner/project.git",
      canonicalUrl: "https://github.com/owner/project",
    });
  });

  it.each([
    "http://github.com/owner/project",
    "https://evil.example/owner/project",
    "https://user:pass@github.com/owner/project",
    "https://github.com/owner/project/tree/main",
    "https://github.com/owner/project?token=secret",
    "git@github.com:owner/project.git",
  ])("rejects unsafe or non-repository URL: %s", (url) => {
    expect(() => parseGitHubRepository(url)).toThrow();
  });

  it("exposes mandatory protections against implicit execution and in-place edits", () => {
    expect(EVOLUTION_SAFETY_POLICY.join(" ")).toContain("Never run install");
    expect(EVOLUTION_SAFETY_POLICY.join(" ")).toContain("dedicated Git worktree");
    expect(EVOLUTION_SAFETY_POLICY.join(" ")).toContain("explicit user approval");
  });
});

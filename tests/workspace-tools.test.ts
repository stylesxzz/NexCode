import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { resolveWorkspacePath } from "../packages/providers/src/tools.js";

describe("workspace path boundary", () => {
  const root = resolve("/tmp/nexcode-workspace");

  it("accepts relative paths inside the workspace", () => {
    expect(resolveWorkspacePath(root, "src/index.ts")).toBe(resolve(root, "src/index.ts"));
  });

  it("rejects parent traversal", () => {
    expect(() => resolveWorkspacePath(root, "../outside.txt")).toThrow("escapes the workspace");
  });

  it("rejects absolute paths", () => {
    expect(() => resolveWorkspacePath(root, "/etc/passwd")).toThrow("relative path");
  });

  it("rejects empty paths", () => {
    expect(() => resolveWorkspacePath(root, "")).toThrow("relative path");
  });
});

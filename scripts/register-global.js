#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// npm link may invoke lifecycle scripts again. This flag makes the hook idempotent.
if (
  process.env.NEXCODE_SKIP_GLOBAL_LINK === "1" ||
  process.env.NEXCODE_AUTO_LINKING === "1"
) {
  process.exit(0);
}

const isWindows = process.platform === "win32";
const result = spawnSync(
  isWindows ? "npm.cmd" : "npm",
  ["link", "--force"],
  {
    cwd: projectRoot,
    env: { ...process.env, NEXCODE_AUTO_LINKING: "1" },
    stdio: "inherit",
    shell: isWindows,
  },
);

if (result.error || result.status !== 0) {
  console.warn("\nNexo was installed, but automatic global command registration failed.");
  console.warn("Run this once from the NexCode project directory: npm link --force");
  if (result.error) console.warn(result.error.message);
  // Do not turn a PATH/permissions issue into a failed dependency installation.
}

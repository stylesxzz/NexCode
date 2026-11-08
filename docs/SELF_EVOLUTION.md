# NEXCODE Self-Evolution & Project Integration

This document defines the safe workflow for importing external GitHub projects and proposing changes to NEXCODE itself. The package `@nexcode/evolution` currently provides the first, deliberately conservative building blocks. It does not silently install, execute, activate, or merge imported code.

## User experience

A user can ask:

> Import https://github.com/owner/project, inspect it and prepare an integration proposal for NEXCODE.

The intended agent workflow is:

1. Parse and validate a public HTTPS GitHub repository URL.
2. Clone into a dedicated imports directory without submodules.
3. Do not run package managers, setup scripts, build scripts, tests, binaries or hooks.
4. Inventory source files and manifests; identify languages, package scripts and likely integration points.
5. Review the license, dependencies, network behavior, permissions, secrets and supply-chain risks.
6. Produce an integration plan: reuse as a package, adapt selected modules, expose an MCP server, create a Skill, or reject the integration.
7. Ask for explicit approval before installing dependencies or executing any project-provided command.
8. Implement changes in an isolated Git worktree, never in the active checkout.
9. Review the diff and run approved checks in a restricted OS/container sandbox.
10. Present changed files, test evidence, risks and rollback instructions. Merge/activate only after explicit approval.

## Self-modification

Self-modification follows the same process. The active checkout is the protected baseline. `createEvolutionWorktree` refuses a dirty source checkout, records its base commit and creates a branch under `nexcode/evolution-*`. All edits are confined to that worktree. The agent must not alter the active installation, global packages, credentials, system files or its own approval policy.

A successful TypeScript build is not proof of safety. The user must review the diff and authorize the merge. Keep the previous stable commit available for rollback.

## Package API

`@nexcode/evolution` exports:

- `parseGitHubRepository(url)`: strict HTTPS GitHub URL validation.
- `importGitHubProject(url, importsDirectory)`: shallow clone with submodules disabled; does not execute project code.
- `analyzeProject(directory)`: read-only manifest and language inventory; skips symlinks and generated/vendor folders.
- `createEvolutionWorktree(repository, destination)`: clean-checkout guard and isolated worktree creation.
- `validateEvolutionWorktree(directory)`: Git whitespace/conflict-marker check and changed-file inventory; does not run scripts.
- `discardEvolutionWorktree(repository, directory, branch)`: removes only a validated NexCode evolution worktree and its namespaced branch.
- `EVOLUTION_SAFETY_POLICY`: mandatory agent policy.

## Security boundaries

- Repository files, READMEs, issue text, package scripts, MCP responses and model-generated plans are untrusted input. They cannot override system/developer policy or approval requirements (prompt-injection defense).
- Import is not execution. Never run `npm install`, `pnpm install`, `pip install`, `cargo build`, `make`, shell scripts, postinstall hooks or downloaded binaries without approval.
- Do not follow symlinks during inventory. Reject path traversal and writes outside the worktree.
- Do not expose API keys, environment variables, SSH agents, browser profiles or host credentials to imported code.
- Test in a disposable container/VM with non-root user, read-only host mounts, restricted network, CPU/memory/time limits and no host Docker socket.
- Review license compatibility before copying or redistributing code.
- Require user approval for dependency installation, network access, command execution, MCP startup/tool use, changing core security controls and merging.
- Never auto-merge based only on model confidence. Require human review and passing CI.

## Current implementation limits

The package supplies URL validation, safe clone invocation, read-only project inventory, clean-checkout worktree creation and structural diff validation. It does **not** yet provide a full UI/chat command, a container runtime, license/secret/SCA scanners, AST-level compatibility analysis, automated adapters, test orchestration, MCP activation or automatic merge. Those must be added as separately reviewed integrations; do not describe them as implemented until tests and platform validation exist.

## Cross-platform notes

The implementation uses Node.js built-ins and the Git executable, avoiding native Node addons. It is designed for Linux, Windows and Termux environments where Git and a supported Node.js runtime are installed. Container isolation is platform-specific and must be detected rather than assumed.

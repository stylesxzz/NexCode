# NEXCODE Self-Evolution & Project Integration

This document defines the safe workflow for importing external GitHub projects and proposing changes to NEXCODE itself. The `@nexcode/evolution` package provides the Git/import primitives, and the provider agent exposes them as approved tools in Development mode.

## User experience

A user can ask:

> Import https://github.com/owner/project, inspect it and prepare an integration proposal for NEXCODE.

In the CLI, switch to **Development** mode and send a normal chat message such as `Import https://github.com/owner/project, inspect it and explain how to integrate its capabilities into NEXCODE.` The model can call `import_github_project`; after import, it can inspect files through the existing read-only workspace tools.

For self-modification, ask the agent to improve NEXCODE itself. It must call `prepare_self_modification`, then use `write_evolution_file`, `run_evolution_command` and `inspect_evolution_diff`. Each write and command asks for approval in the terminal. The worktree is stored under the operating system temporary directory, outside the active checkout.

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

## Agent tools

- `import_github_project`: approval-gated shallow clone into `.nexcode/imports`, followed by a read-only inventory.
- `analyze_imported_project`: read-only inventory of an imported directory.
- `prepare_self_modification`: approval-gated Git worktree creation; refuses dirty source checkouts and keeps edits outside the active checkout.
- `write_evolution_file`: approval-gated edits restricted to the active evolution worktree; blocks `.git`, `node_modules`, environment files and path escapes.
- `run_evolution_command`: approval-gated direct process execution (no shell) inside the worktree.
- `inspect_evolution_diff`: reports staged/unstaged changes and runs Git diff whitespace checks; never executes project scripts.
- `discard_evolution_worktree`: approval-gated deletion of the isolated worktree and its dedicated branch.

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

The CLI agent integration and approval-gated tools are implemented. A dedicated container/VM sandbox, license/secret/SCA scanners, AST-level compatibility analysis, automatic adapters, automated MCP activation and automatic merge are not included. Commands execute on the host only after approval; for untrusted projects, use a disposable OS/container sandbox. The agent never merges automatically.

## Cross-platform notes

The implementation uses Node.js built-ins and the Git executable, avoiding native Node addons. It is designed for Linux, Windows and Termux environments where Git and a supported Node.js runtime are installed. The existing OpenTUI CLI dependency currently requires Node.js 26.4+; use the same supported runtime for the full CLI. Container isolation is platform-specific and must be detected rather than assumed.

# Nexo architecture

- apps/web: browser UI without direct operating-system privileges.
- apps/agent/server.js: local HTTP server, pairing, provider request loop, local tools and persistence.
- bin/nexcode.js: global CLI launcher registered with npm link.
- ~/.nexcode: user configuration, memory and installed Skill files.

The browser calls a loopback-only API. The agent invokes child processes from the configured workspace. This is a trusted-local-user architecture, not a hostile-code sandbox. Before enabling autonomy, use a disposable or version-controlled workspace. The current MCP screen persists server definitions only; it does not spawn MCP servers yet.
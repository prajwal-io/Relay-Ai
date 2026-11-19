# Relay AI MCP server

Relay AI exposes its local project memory and handoff workflow to MCP-compatible coding assistants over stdio. The official TypeScript MCP SDK handles the protocol. The server is a client of the Relay local API; SQLite and Git inspection remain in the API process.

## Tools

- `relay_list_projects`
- `relay_get_project_context`
- `relay_save_memory`
- `relay_create_handoff`
- `relay_load_handoff`
- `relay_get_handoff_history`
- `relay_verify_repository`

Approval is an explicit state transition. Approve drafts in the dashboard or desktop companion. MCP does not expose approval. Returned provenance/evidence is from the local API and is not upgraded by the MCP layer.

## Local setup

The API must be running at `http://127.0.0.1:4317/api/v1` (the default) and a project must be registered with it. From the repository root after dependencies are installed:

```sh
npm run mcp --workspace @relay-ai/mcp
```

Set `RELAY_API_URL` to change the local API URL. Remote API URLs are rejected unless `RELAY_ALLOW_REMOTE_API=1` is also set; remote connections require HTTPS and `RELAY_MCP_ACCESS_TOKEN`. That opt-in can send project context over the configured network. In source development, the MCP process reads the local API's generated development token; the packaged desktop passes a handoff-scoped credential. The MCP process writes diagnostics only to stderr because stdout carries MCP JSON-RPC.

## Host configuration

The installed app connects to Codex app-server and registers an OpenCode tool for the approved package. For source development, open OpenCode at the repository root to load its project configuration.

The Codex CLI can also register Relay globally:

```sh
codex mcp add relay-ai -- npm --prefix /absolute/path/to/relay-ai run mcp --workspace @relay-ai/mcp
```

In OpenCode, use `/mcps` or `opencode mcp list` to check the connection. In Codex CLI, use `codex mcp list`.

These configurations expose the MCP tools to the host. They do not install hooks, automatically capture every conversation, or silently inject handoff context. The assistant must call the tools, and an approved handoff must be loaded explicitly.

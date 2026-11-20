# Switching coding assistants

Choose the project and source in Handoff Studio. Use project memory or review text you import yourself. The companion also reads selected Codex conversations through the local Codex app-server. Review the individual items, choose the destination, and approve. Create a fresh package to send different content or change the destination.

For OpenCode, choose Terminal or Desktop. For other destinations, open the approved package in the installed dashboard and save its MCP setup instructions. Merge the generated entry into the **personal** configuration for the intended client, then reload the client and open the same project. Ask it to call `relay_load_approved_handoff`. The client may ask permission and may send the returned context to its model provider. Keep Relay running until the receipt appears.

| Client | Personal MCP configuration | History in Relay |
|---|---|---|
| Codex | [Codex MCP](https://developers.openai.com/codex/mcp/) — merge the generated TOML server entry | Local Codex app-server |
| OpenCode | [OpenCode MCP](https://opencode.ai/docs/mcp-servers/) — use Relay’s built-in launcher | Reviewed import or project memory |
| Cursor | [Cursor MCP](https://cursor.com/docs/mcp) — merge the server into personal MCP settings | Reviewed import or project memory |
| Kiro IDE | [Kiro MCP](https://kiro.dev/docs/mcp/) — use user-level settings | Reviewed import or project memory |
| Kiro CLI | [Kiro CLI](https://kiro.dev/docs/cli/reference/slash-commands/) — check server status with /mcp | Reviewed import or project memory |
| Antigravity | [Antigravity IDE](https://antigravity.google/docs/ide-mcp) — use Manage MCP Servers and View raw config | Reviewed import or project memory |
| Freebuff | [Freebuff client config loader](https://github.com/CodebuffAI/freebuff/blob/main/sdk/src/agents/load-mcp-config.ts) — user-level .agents/mcp.json for compatible clients | Reviewed CLI export or project memory |

Manual client setups are experimental. Installation, configuration, tool discovery and retrieval are separate steps. A receipt records the package returned by Relay. To remove an exported setup, remove the server entry from the client and delete its matching file under the Relay profile’s receiver-credentials directory.

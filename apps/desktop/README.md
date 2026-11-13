# Relay AI desktop companion

The Electron companion runs as a separate Windows or macOS desktop process with a tray icon and a compact always-on-top widget. It polls Relay's loopback API for project and handoff state. When explicitly requested, it lists local Codex chats through Codex app-server and reads the selected chat for review. Linux terminal launch remains experimental.

## Run

From the repository root:

```sh
npm install
npm run desktop
```

If `127.0.0.1:4317` is not already serving Relay, the companion starts the local API from `apps/api` and reads `apps/api/.env` there. Both the desktop app and dashboard use `apps/api/data/relay.sqlite` in development. The dashboard is still useful for reviewing and approving a package; the desktop app shows local activity and an arrival animation only after the API reports an approved-to-loaded state transition.

## Controls and privacy

- Click the Relay capsule to expand or collapse the companion. Drag the dotted grip on the capsule or drag the expanded panel's top bar to reposition it; its location is saved locally. With the capsule focused, `Alt` + arrow keys moves it, and `Shift` makes each step larger.
- Use the tray menu to reopen the companion, open the dashboard, or quit Relay.
- The animation is driven by persisted handoff status; it is not a simulated transfer.
- The activity monitor receives handoff title, route, item count, and verification label. The chat review reads the selected conversation only after you choose it.
- The API remains bound to loopback and the API key remains in the API process.
- Login startup registration and signed Windows/macOS installers are not included yet.

## Switch a Codex chat to OpenCode

Open **Switch a Codex chat**, choose a chat, and edit its text before preparing the draft. Relay uses Codex's local app-server to collect user and assistant text messages. It excludes reasoning, tool output, and non-text attachments; it refuses chats above 240,000 characters instead of silently truncating them. Common credentials are masked, but masking is incomplete: inspect the text before proceeding. Preparing a draft saves the reviewed text as local project memory. Git status, HEAD, and the tracked diff are fingerprinted; untracked file contents and the truth of chat claims are not verified. A changed snapshot requires a new draft.

After approval, Relay starts a password-protected OpenCode service on loopback and connects a runtime MCP server restricted to the approved handoff. It opens an OpenCode terminal with a prompt to retrieve that package. OpenCode needs a working provider and may ask for tool permission; depending on the provider, the context may be sent to it. Opening the terminal does not confirm retrieval. Relay marks a handoff loaded when the destination calls the retrieval tool, which does not prove that the model understood its contents. The reviewed text remains in Relay's SQLite memory. Relay must remain running while the OpenCode session uses its temporary service; quitting Relay stops that service. This integration uses OpenCode's experimental runtime MCP API and fails with an error if the installed version cannot connect.

The OpenCode artwork is from [OpenCode's brand assets](https://opencode.ai/brand), and the Codex icon is an unmodified copy of the official app asset documented by [Orchestrator's provider assets](https://github.com/backnotprop/orchestrator/tree/main/assets/providers). These marks identify the respective products and do not imply endorsement.

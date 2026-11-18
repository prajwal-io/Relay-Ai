# Relay AI desktop companion

The Electron companion runs as a separate Windows or macOS desktop process with a tray icon and a compact always-on-top widget. It polls Relay's loopback API for project and handoff state. When explicitly requested, it lists local Codex chats through Codex app-server and reads the selected chat for review. Linux terminal launch remains experimental.

In source development, when **Open dashboard** is selected, the companion checks the standard local Vite ports for a page titled Relay AI so a different app occupying port 5173 is not opened by mistake. Set `RELAY_DASHBOARD_URL` to an HTTPS deployment or an explicit loopback URL to override discovery.

## Run

From the repository root:

```sh
npm install
npm run desktop
```

If `127.0.0.1:4317` is not already serving Relay, the companion starts the local API from `apps/api` and reads `apps/api/.env` there. It verifies the Relay service identity before connecting, reports a clear startup message if Node.js is missing, and detects another service occupying the port. Both the desktop app and dashboard use `apps/api/data/relay.sqlite` in development. The dashboard is still useful for reviewing and approving a package; the desktop app shows local activity and an arrival animation only after the API reports an approved-to-loaded state transition.

## Package an installer

From the repository root, run `npm run package:windows` on Windows for an NSIS installer or `npm run package:macos` on macOS for a universal DMG. The packaged desktop bundles its API, scoped MCP process, and dashboard; it uses Electron's Node runtime and does not require a separate Node install. Local state and `api.env` live in the OS Relay user-data directory. Git, Codex CLI, and OpenCode CLI are separate installs. The packaged companion opens a managed dashboard and authenticates to the loopback API.

## Controls and privacy

- Click the Relay capsule to expand or collapse the companion. Drag the dotted grip on the capsule or drag the expanded panel's top bar to reposition it; its location is saved locally. With the capsule focused, `Alt` + arrow keys moves it, and `Shift` makes each step larger.
- Use the tray menu to reopen the companion, open the dashboard, or quit Relay.
- The animation is driven by persisted handoff status; it is not a simulated transfer.
- The activity monitor receives handoff title, route, item count, and verification label. The chat review reads the selected conversation only after you choose it.
- The API remains bound to loopback and the API key remains in the API process.
- The Windows package is built with NSIS. The unsigned build is a release candidate.

## First launch and recovery

- Use **Check integration setup** in the tray to recheck Git, Codex, and OpenCode. Sign into Codex and select a model with tool support in OpenCode. Relay registers the handoff tool during the switch.
- If OpenCode asks for tool permission, review and allow retrieval only if you want to continue. A denial or provider error leaves the package approved. Check the OpenCode terminal and try retrieval again.
- Use **Back up Relay data** in the installed tray app to export a consistent SQLite copy. **Restore a backup** validates the backup and restarts Relay. The previous database is saved in the local data directory. Backups contain private project memory and receipts.

## Signed macOS builds

Run the **Cross-platform desktop checks** workflow with the signed macOS option. Configure its release-signing environment with MAC_CSC_LINK, MAC_CSC_KEY_PASSWORD, APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, and APPLE_TEAM_ID. The job verifies the signature and stapled ticket before uploading the DMG artifact.

## Switch a Codex chat to OpenCode

Open **Switch a Codex chat**, choose a chat, and edit its text before preparing the draft. Relay uses Codex's local app-server to collect user and assistant text messages. It excludes reasoning, tool output, and non-text attachments; it refuses chats above 240,000 characters instead of silently truncating them. Common credentials are masked, but masking is incomplete: inspect the text before proceeding. Preparing a draft saves the reviewed text as local project memory. Relay fingerprints HEAD, the index, tracked changes, and non-ignored untracked content. Ignored files and chat claims are outside verification. A changed snapshot requires a new draft.

After approval, Relay starts a password-protected OpenCode service on loopback and connects a runtime MCP server restricted to the approved handoff. It opens an OpenCode terminal with a prompt to retrieve that package. OpenCode needs a working provider and may ask for tool permission; depending on the provider, the context may be sent to it. Opening the terminal does not confirm retrieval. Relay marks a handoff loaded when the destination calls the retrieval tool, which does not prove that the model understood its contents. The reviewed text remains in Relay's SQLite memory. Relay must remain running while the OpenCode session uses its temporary service; quitting Relay stops that service. This integration uses OpenCode's experimental runtime MCP API and fails with an error if the installed version cannot connect.

The OpenCode artwork is from [OpenCode's brand assets](https://opencode.ai/brand), and the Codex icon is an unmodified copy of the official app asset documented by [Orchestrator's provider assets](https://github.com/backnotprop/orchestrator/tree/main/assets/providers). These marks identify the respective products and do not imply endorsement.

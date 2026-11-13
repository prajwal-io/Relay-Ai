# Relay AI desktop companion

The Electron companion runs as a separate Windows desktop process with a tray icon and a compact always-on-top widget. It polls Relay's loopback API for project and handoff state. When explicitly requested, it lists local Codex chats through Codex app-server and reads the selected chat for review.

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
- Windows startup registration and a packaged installer are not included yet.

## Switch a Codex chat to OpenCode

Open **Switch a Codex chat**, choose a chat, and edit its text before preparing the draft. Relay uses Codex's local app-server to collect user and assistant text messages. It excludes reasoning, tool output, and non-text attachments; it refuses chats above 240,000 characters instead of silently truncating them. Common credentials are masked, but masking is incomplete: inspect the text before proceeding. Preparing a draft saves the reviewed text as local project memory. Git status, HEAD, and the tracked diff are fingerprinted; untracked file contents and the truth of chat claims are not verified. A changed snapshot requires a new draft.

After approval, Relay opens an OpenCode terminal with a prompt to read a local handoff text file. OpenCode must have a working provider and may request permission before reading. Depending on the user's OpenCode provider, the context may be sent to that provider. Launching the terminal is not proof that OpenCode read the file, so this path does not mark the handoff as loaded. The handoff file remains under the desktop app's user-data directory in `handoffs` until you delete it; the completion screen can reveal it in Explorer. The reviewed text also remains in Relay's SQLite memory.

The OpenCode artwork is from [OpenCode's brand assets](https://opencode.ai/brand), and the Codex icon is an unmodified copy of the official app asset documented by [Orchestrator's provider assets](https://github.com/backnotprop/orchestrator/tree/main/assets/providers). These marks identify the respective products and do not imply endorsement.

# Relay AI

**Switch agents. Keep progress. Verify continuity.**

Relay AI is a local-first context continuity engine for AI-assisted software development. It helps developers carry project decisions, completed work, open tasks, and repository evidence from one coding assistant to another—with a human review and approval step.

## The problem

Coding assistants keep useful context inside separate chats and tools. When a developer changes agents, starts a new session, or asks a teammate to continue, they often have to reconstruct what was done, which files changed, why decisions were made, and what remains unfinished. A copied summary can be incomplete or stale, and it rarely shows which statements came from the repository versus a chat.

Relay gives project context a durable, inspectable record. It preserves provenance, checks selected facts against the local repository, asks the developer to approve a handoff, and records when the destination retrieves the approved package.

## What Relay does differently

Relay is designed around **verified continuity**, not a shared black-box memory:

1. **Capture with provenance.** Tasks, decisions, issues, notes, and file references retain their source and status.
2. **Check repository evidence.** Relay inspects the registered checkout and reports observations separately from assistant claims. Git success alone is never treated as proof that a task is complete.
3. **Review and approve.** The developer chooses which context leaves the source session and which assistant may retrieve it.
4. **Record retrieval.** The Proof-of-Continuity receipt snapshots the approved context, destination, retrieval time, and repository state.

### USP: Proof-of-Continuity

After an approved handoff is retrieved, Relay can show **what was approved, which destination retrieved it, when retrieval occurred, and what repository evidence accompanied it**. This makes the transfer auditable and helps surface stale or conflicting context.

A receipt proves that Relay returned a particular package. It does **not** prove that the destination model understood the package, followed it, or completed the task. Repository observations also cannot prove every statement made in a chat.

## Who can use it

- Individual developers who switch between Codex and OpenCode.
- Open-source maintainers who want a compact project memory across coding sessions.
- Small engineering teams that need to inspect and manually share a handoff record.
- Developers evaluating MCP-compatible assistants who want context transfer to remain explicit and reviewable.

Relay is currently a single-user, laptop/desktop product. It has no team account system, shared cloud memory, billing, or native mobile app. Teams can share an exported Markdown receipt manually.

## Real-world workflows

### Continue a Codex chat in OpenCode

Run the desktop companion, choose a Codex chat, review and edit its text, and prepare a draft. Relay saves the reviewed text as local project memory and collects available repository evidence. Inspect the package, approve it, and Relay opens OpenCode for that project. OpenCode connects to Relay's handoff-scoped MCP tool and retrieves the approved context. The dashboard and companion show the persisted handoff state.

The companion omits tool output, model reasoning, and non-text attachments, and rejects oversized transcripts. It masks common credential patterns, but redaction is not exhaustive; inspect the selected text before approval. Context retrieved by an assistant may be sent to that assistant's configured model provider.

### Keep project decisions available across sessions

Save a technical decision or unfinished task in Context Explorer, or use the MCP memory tools from a connected assistant. Later sessions can retrieve relevant project context with its source and verification state attached.

### Catch stale context before a switch

Build a handoff draft, inspect its selected memory and repository evidence, and review any conflicts. If the tracked repository snapshot changes, Relay invalidates the draft so the developer can review a fresh package.

### Share a transfer record

After retrieval, inspect Proof-of-Continuity in Handoff Studio and download its Markdown receipt. Share it with a teammate using your normal workflow; Relay does not sync receipts between users.

## Product and support status

- **Web dashboard:** React and Vite interface for projects, context, handoff review, verification, receipts, and settings.
- **Local API:** Node.js/TypeScript service bound to loopback at `127.0.0.1:4317` by default.
- **Persistent store:** SQLite on the developer's machine. In source development the default file is `apps/api/data/relay.sqlite`; `RELAY_DB_PATH` can override it.
- **Desktop companion:** Electron source-run app with a Windows/macOS-oriented Codex chat review and Codex-to-OpenCode workflow. Linux terminal launching is experimental.
- **Assistant connections:** Codex and OpenCode have repository MCP configurations. Other MCP-compatible clients may be able to use the tools, but compatibility and handoff behavior must be validated per client.
- **AI extraction:** Optional Groq context extraction runs from the local API. Local extraction remains available when the provider is not configured or fails. Coding assistants use their own model/provider for their sessions.
- **Landing-page demo:** The animated marketing walkthrough is illustrative and labeled as simulated. It does not inspect a live repository or create a real handoff.

The installed OpenCode integration test uses a local mock provider and synthetic context to verify tool discovery, invocation, and retrieval. It does not verify a live model/provider handoff or model comprehension. OpenCode's runtime MCP API is experimental.

## Architecture

```text
 Web browser / static Vercel frontend
                 │ HTTP (same computer)
                 ▼
       Local Relay API (Node.js + TypeScript) ───── Git inspection
                 │
                 ├── SQLite project memory, handoffs, receipts
                 │
                 ├── optional redacted extraction request ── Groq
                 │
                 └── MCP stdio server ◀──── Codex / OpenCode

 Electron desktop companion ── local API + Codex app-server
             │
             └── approved, scoped handoff ── OpenCode MCP service on loopback
```

The API owns project and handoff state, SQLite access, repository checks, and optional extraction. The MCP server is a local stdio client of the API; it does not access SQLite directly. The Electron companion is a separate process and can show local activity, review a selected Codex chat, and launch the destination workflow.

### Handoff lifecycle

```text
Source session → reviewed draft → repository check → human approval
              → destination retrieval → local retrieval receipt
```

Creating or approving a package does not mean it has been transferred. The destination must retrieve the approved package for its intended assistant. Relay records retrieval as the continuity boundary; it does not infer model understanding.

## Storage, privacy, and security

- Project memory, handoffs, and receipts are local SQLite data by default. They are not uploaded to Relay cloud because this MVP has no Relay cloud backend.
- The API binds to loopback and applies host, origin, cross-site, method, content-type, and request-rate checks. These checks are not authentication between processes running as the same operating-system user.
- The optional `GROQ_API_KEY` belongs in the local API environment. Never put it in a `VITE_` variable, frontend bundle, source control, or a handoff. Relay redacts common secret patterns before provider requests, but no redaction system is perfect.
- When Groq extraction is used, requested text is sent to Groq after redaction. Without Groq, local extraction and basic handoffs continue to work.
- An assistant may send retrieved context to its configured model provider. Review context and provider settings before use.
- Repository evidence is limited to checks Relay actually performs. Tracked repository state is used to detect stale drafts; untracked file contents are not part of that snapshot.

## Run from source

When someone forks Relay AI, they can run the web dashboard and local backend together on their own computer. The repository is a single npm workspace: the root `npm run dev` command starts both services and connects the browser to the API through Vite's local proxy. No hosted account, database, or API key is required for the basic local workflow.

### Requirements

- Node.js 22.9 or newer.
- Git on `PATH` for repository verification.
- OpenCode installed separately to use the Codex-to-OpenCode desktop handoff.

### Start the dashboard and API

After creating a fork on GitHub, clone your fork and start Relay (replace `YOUR-USERNAME` with your GitHub username):

```sh
git clone https://github.com/YOUR-USERNAME/Relay-Ai.git
cd Relay-Ai
npm install
npm run dev
```

`npm install` is the one-time dependency setup; `npm run dev` starts the frontend and backend together, so a second terminal or separate backend startup is not needed. Open the Vite URL printed in the terminal (typically `http://127.0.0.1:5173`). The local API listens on `http://127.0.0.1:4317`; the frontend proxies `/api/v1` requests to it. You can confirm the backend is responding at `http://127.0.0.1:4317/api/v1/health`. Then choose **Add project** in the dashboard and register a local repository by its absolute path.

To stop the local app, press `Ctrl+C` in the terminal running `npm run dev`. Your project memory remains in the local SQLite file after stopping and restarting the app.

### Start the desktop companion

In a second terminal at the repository root:

```sh
npm run desktop
```

The companion uses the local API and the development SQLite database. See [apps/desktop/README.md](apps/desktop/README.md) for controls and platform notes. The repository currently documents source-run development; signed, production installers are not available from the main branch.

### Optional Groq extraction

Copy `apps/api/.env.example` to `apps/api/.env`, then set `GROQ_API_KEY` in that local file. Keep the key private and out of Git. `GROQ_MODEL` and `GROQ_TIMEOUT_MS` can be set there as well. The local fallback is used if no key is configured or the provider fails.

### Connect Codex and OpenCode through MCP

Relay's MCP server communicates with the local API over stdio. Sample project configuration is included in `.codex/config.toml` and `opencode.json`; replace their sample absolute repository paths with the path on your computer, then reopen/reload the project in each client. For details and the global Codex CLI option, see [apps/mcp/README.md](apps/mcp/README.md).

To run the MCP server manually after starting the API:

```sh
npm run mcp --workspace @relay-ai/mcp
```

Relay exposes tools for listing projects, reading context, saving memory, creating and approving handoffs, loading approved context, retrieving handoff history, and checking repository state. MCP support does not automatically capture every conversation or silently inject context; the assistant must call Relay tools, and approval remains explicit.

## Configuration

Configuration is read by the local API from `apps/api/.env`:

| Variable | Purpose | Default / note |
|---|---|---|
| `HOST` | API bind address | Loopback only (`127.0.0.1`) |
| `PORT` | Local API port | `4317` |
| `RELAY_DB_PATH` | SQLite file path | `./data/relay.sqlite` relative to the API working directory |
| `WEB_ORIGIN` | Allowed browser origin | `http://localhost:5173` in the example |
| `WEB_ORIGINS` | Additional exact browser origins | Comma-separated; avoid wildcards |
| `GROQ_API_KEY` | Optional extraction credential | Keep only in the local API environment |
| `GROQ_MODEL` | Extraction model | Example file provides a default |
| `GROQ_TIMEOUT_MS` | Extraction timeout | Example file provides a default; local extraction is the fallback |

Do not bind the local API to a public network interface. Only add a Vercel origin you control to `WEB_ORIGINS`; CORS is a browser boundary, not process authentication.

## Build and test

```sh
npm run build
npm test
```

The workspace scripts build the API, web frontend, and MCP server. Tests cover API persistence and handoff rules, extraction and fallback, MCP protocol and scoped retrieval, desktop startup/chat handling, and receipt export.

For a practical contributor guide covering fork setup, running the frontend and backend together, local app usage, and the full test/build workflow, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Deploying the web frontend

The frontend can be deployed as a static Vite site on Vercel. The local API, SQLite store, Git inspection, and MCP server stay on the developer's machine. See [VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md) before deployment.

A hosted frontend only reaches a local Relay API when it is opened in a browser on the same computer as the running API and that exact frontend origin is allowed. Deploying the frontend does not create a shared or multi-user Relay service. Do not expose the loopback API publicly or place `GROQ_API_KEY` in Vercel frontend variables.

## Repository map

```text
apps/web/       Landing page and dashboard
apps/api/       Local HTTP API, SQLite, Git checks, extraction
apps/mcp/       MCP stdio server and assistant setup guide
apps/desktop/   Electron desktop companion
packages/shared/Shared TypeScript contracts
```

## Current limitations

- Single-user local service; no sign-in, team workspace, cloud sync, shared database, or billing.
- No native mobile client. Relay is aimed at Windows and macOS laptops/desktops; Linux terminal launching is experimental.
- No signed or notarized production installer is currently provided from the main branch.
- Desktop source includes the Codex-to-OpenCode workflow. A local mock-provider OpenCode test validates tool retrieval, but a live model/provider handoff remains unverified.
- OpenCode's runtime MCP API is experimental.
- Retrieval receipts prove package retrieval, not model comprehension or task completion.
- The landing walkthrough is a clearly labeled simulation; actual workspace status comes from the local API.

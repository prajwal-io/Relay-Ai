# Relay AI

**Switch agents. Keep progress. Verify continuity.**

Relay AI is a local-first context continuity tool for coding assistants. It keeps project memory on your computer, checks repository state, and prepares reviewable context packages when you move work between agents.

## What you can do

- Keep tasks, decisions, file references, and unresolved issues in a project memory backed by local SQLite.
- Extract candidate memory from notes with the configured AI provider, with a local fallback when the provider is unavailable. Review and save extracted items yourself.
- Inspect Git status and selected repository evidence before approving a handoff. Relay distinguishes repository observations from claims made in chat.
- Create a handoff draft, choose which memory to include, and explicitly approve it before the destination can retrieve the package.
- Use the desktop companion on Windows or macOS to choose a Codex chat, review and edit its text, and prepare a Codex-to-OpenCode handoff.

## Architecture

```text
Web dashboard ──HTTP──┐
Windows companion ────┼──> Local TypeScript API ──> SQLite project memory
Coding agents ──MCP───┘            │
                                   └──> Git evidence from registered repositories
                                        Optional server-side extraction provider
```

The dashboard is a Vite/React application. The local Node.js/TypeScript API owns project and handoff state in SQLite and inspects registered repositories. The MCP service exposes project context and handoff tools to supported assistants. The Electron companion runs separately from the dashboard, reads selected Codex chats through the local Codex app-server, and asks for human review before saving the selected text into Relay memory. It can open OpenCode in a native terminal on Windows and macOS; Linux terminal launch remains an early path.

The desktop handoff starts a password-protected OpenCode service on loopback and registers an MCP tool scoped to the approved handoff. Relay reports a package as loaded when the destination calls the retrieval endpoint; that confirms retrieval, not that a model understood the context. OpenCode's runtime MCP API is experimental, so the desktop flow checks the connection and reports failures.

After a successful retrieval, Relay keeps a local Proof-of-Continuity receipt with the exact approved context snapshot, retrieval time, repository evidence, and a current/stale status. Download a Markdown copy from Handoff Studio to share it manually with teammates. This is a local share artifact; Relay does not yet synchronize receipts between users.

## Real-time use cases

### Continue a Codex chat in OpenCode

Open **Switch a Codex chat** in the desktop companion, select a chat, review and edit its user and assistant text, then prepare a draft. Relay stores the reviewed text as project memory and captures repository evidence. Inspect the included context and verification label, then approve. Relay opens OpenCode in that project's directory and prompts it to retrieve the approved package through its scoped MCP tool. The local dashboard and companion reflect handoff state as it changes.

The companion excludes reasoning, tool output, and non-text attachments. It rejects oversized transcripts and masks common credential patterns, but redaction is incomplete; review the text before approval. Depending on OpenCode's configured provider, retrieved context may be sent to that provider.

### Keep project decisions available across sessions

Register a repository in the dashboard, save decisions and open tasks in Context Explorer, and retrieve relevant project memory from a connected assistant through MCP. Each item retains its source and verification status so an assistant can distinguish a user decision from a repository observation.

### Review an unfinished task before switching agents

Create a handoff from Handoff Studio, select the memory items the destination needs, check Git evidence and conflicts, and approve the draft. The destination can only retrieve an approved package for its intended assistant. If the tracked repository snapshot changes, Relay rejects approval or retrieval and asks you to review a fresh draft.

## Run locally

Requirements: Node.js 22.9+ and Git on `PATH` for repository checks.

```sh
npm install
npm run dev
```

Open the Vite URL shown in the terminal (usually `http://127.0.0.1:5173`). The API listens on `127.0.0.1:4317`; SQLite is stored at `apps/api/data/relay.sqlite`. The web dev server proxies `/api/v1` to the local API.

To run the Windows desktop companion, use another terminal:

```sh
npm run desktop
```

If the API is not already running, the companion starts it using `apps/api/.env` and the same local database. The window stays above other apps, can be dragged, and can be reopened from the tray. Windows startup registration and a packaged installer are not included.

To register a project, open **Launch dashboard → Add project** and enter its absolute path. The landing page's walkthrough is simulated and is not live repository evidence.

## AI extraction

Copy `apps/api/.env.example` to `apps/api/.env` and set `GROQ_API_KEY` to enable Groq extraction. Keep this key on the API process; do not put it in frontend configuration or commit it. Submitted text is redacted for common credential patterns before provider requests. Extraction proposes memory only; inspect and save the result in Relay. Without a key or when the provider fails, local fallback extraction remains available.

## Connect coding assistants

Start the local API and follow [the MCP setup guide](apps/mcp/README.md) to connect an assistant over stdio. Assistants retrieve project memory by calling Relay tools. Relay does not automatically capture every conversation or inject context into every session.

## Build and tests

```sh
npm run build
npm test
```

Tests cover API persistence and handoff state, MCP protocol and scoped handoff retrieval, extraction behavior, and desktop chat redaction. They use temporary databases and synthetic context; they do not prove that a live model understood a handoff.

## Deployment and launch status

The frontend can be deployed to Vercel; see [VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md). The API, SQLite memory, repository checks, and MCP service remain on the developer's machine. A hosted page can use the local API only from the same computer while Relay is running. Keep the API bound to loopback and configure `WEB_ORIGINS` for the expected browser origin.

This repository is an individual local-first desktop MVP. Windows and macOS launch paths are implemented in source; Linux terminal launch is experimental. Signed installers and native packaging are not included yet. Browser origin, host, cross-site, method, content-type, and rate checks reduce web-based attacks, but the local API does not authenticate other processes running as the same user. A synthetic OpenCode v2.3.0 end-to-end check confirms the Relay tool is offered to a mock provider and retrieves the approved package once. It does not validate a real model/provider session or a macOS runtime. OpenCode's runtime MCP endpoint is experimental.

## Trust and privacy

- Git checks report repository observations; they do not prove that a task or chat claim is correct.
- Handoff drafts require explicit approval. The approved destination is checked when it retrieves the package.
- Tracked repository snapshot changes invalidate a handoff. Untracked file contents are not part of that fingerprint.
- Codex chat text is copied into Relay's local SQLite memory when you prepare a draft. Inspect selected text before approval.
- Local storage stays on this computer unless you choose an AI provider or assistant provider that transmits the context you send it.

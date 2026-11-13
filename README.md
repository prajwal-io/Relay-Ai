# Relay AI

**Switch agents. Keep progress. Verify continuity.**

Relay AI is a local-first context continuity engine for coding assistants. It stores project memory in SQLite, checks selected facts against the registered repository, and creates handoff packages that remain drafts until someone explicitly approves them.

## Start locally

Requirements: Node.js 22.9+ and Git on `PATH` for repository checks.

```sh
npm install
npm run dev
```

Open the Vite URL shown in the terminal (normally `http://127.0.0.1:5173`). The API binds to `127.0.0.1:4317`; SQLite is stored at `apps/api/data/relay.sqlite`. The development server proxies `/api/v1` to the local service. Set `VITE_RELAY_API` when the browser and API need a different address.

### Windows desktop companion

To run Relay as a desktop tray companion outside the dashboard browser, start the API and web dashboard as above, then run `npm run desktop` in another terminal. The compact Relay companion stays above other windows, expands into a handoff view, and watches the local API for an approved package to be loaded. If the API is not already running, the desktop app starts it locally using `apps/api/.env` and the same SQLite database. Use the tray icon to reopen the companion or quit it. It does not yet install itself to Windows startup.

The desktop companion can list local Codex chats, let you review text from a chosen chat, create a repository-checked draft, and open OpenCode after approval. Text-only transfer, redaction limits, local file retention, and launch limitations are described in [the desktop guide](apps/desktop/README.md).

To register a project, open **Launch dashboard → Add project** and provide its absolute path. In **Context Explorer**, add or inspect tasks, decisions, files, and open issues. **Verification** reports current Git observations and repository file checks. **Handoff Studio** builds a draft, lets you select included memory, and requires approval before loading the package. The landing-page walkthrough is simulated and labeled; it is not evidence from a live repository.

## Optional Groq context extraction

Copy `apps/api/.env.example` to `apps/api/.env` and set `GROQ_API_KEY`. The key is loaded by the local API process and never sent to the browser or MCP server. When extraction is explicitly requested, submitted context is redacted for common key, token, password, and email patterns before being sent to Groq. Extraction only proposes memory; review and save it in Relay. Without a key or when Groq fails, local fallback extraction and ordinary handoffs continue to work. The dashboard Settings page reports the active provider.

## Coding assistant connection

Start the API and configure the MCP server using the instructions in [apps/mcp/README.md](apps/mcp/README.md). OpenCode and Codex can connect through their supported stdio MCP configuration. The MVP does not install automatic capture hooks or inject context into every conversation: assistants call Relay tools, and handoff context is returned only after explicit approval and load.

## Verify the build

```sh
npm run build
npm test
```

The API and MCP tests use temporary SQLite databases and local loopback connections. The API tests cover project/memory persistence, deduplication, draft/approve/load state, project history, missing repository paths, and the no-Groq fallback. Provider tests mock Groq responses, including structured extraction, redaction, retries, rate limits, and timeout fallback. The MCP test checks stdio protocol initialization.

## Deployment

The frontend can be deployed to Vercel using the repository's `vercel.json`; see [VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md) for the setup. The API, SQLite memory, repository checks, and MCP server stay on the developer's computer, so the hosted page only has dashboard access when opened on that same computer while the local service is running. The Vercel origin must be explicitly added to `WEB_ORIGINS`. Do not expose the local API on a public interface. This setup is for an individual local-first install; a multi-user hosted launch needs authenticated API access and durable cloud storage.

## Current trust model

- Git status verifies only the observed working-tree state.
- File checks verify the specific repository path observation, not task correctness.
- User, assistant, and model claims keep their provenance and remain unverified unless separate repository evidence applies.
- Draft handoffs cannot be loaded. Approval and load are separate persisted state transitions.
- SQLite, local API, and MCP server bind or connect to loopback by default.

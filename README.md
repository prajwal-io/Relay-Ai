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

## Deployment boundary

The web client can be built and hosted separately with `npm run build --workspace apps/web`. The SQLite service and MCP process are intended to stay on the developer's machine. A hosted frontend talking to a local API must be configured with the API address and the API's `WEB_ORIGIN`; browser security may block loopback access from some hosted origins. Never expose the local API on a public interface without adding authentication and an explicit network security design.

## Current trust model

- Git status verifies only the observed working-tree state.
- File checks verify the specific repository path observation, not task correctness.
- User, assistant, and model claims keep their provenance and remain unverified unless separate repository evidence applies.
- Draft handoffs cannot be loaded. Approval and load are separate persisted state transitions.
- SQLite, local API, and MCP server bind or connect to loopback by default.

# Contributing to Relay AI

This guide is for anyone who wants to run Relay AI locally, try the app, or work on the code. The web dashboard and its local backend are part of the same npm workspace and start together.

## Requirements

- Node.js 22.9 or newer, with npm.
- Git.
- Windows, macOS, or Linux for the web app and API. The desktop companion currently targets Windows and macOS; Linux support is experimental.

No account, hosted database, or AI provider key is required to run the basic local app. Git is used for repository checks in Relay projects.

## Fork, clone, and install

Fork the repository on GitHub, then replace `YOUR-USERNAME` below with your GitHub username:

```sh
git clone https://github.com/YOUR-USERNAME/Relay-Ai.git
cd Relay-Ai
npm install
```

Install dependencies once after cloning. When you pull changes that update `package.json` or `package-lock.json`, run `npm install` again.

## Start the web app and backend together

From the repository root, run:

```sh
npm run dev
```

This starts both development servers in one terminal:

- **Web dashboard:** Vite, usually at `http://127.0.0.1:5173` (use the exact URL printed in the terminal).
- **Backend API:** Node.js service at `http://127.0.0.1:4317`.
- **API health check:** `http://127.0.0.1:4317/api/v1/health`.

The dashboard forwards its `/api/v1` requests to the local API. You do not need to open a second terminal or start the API separately. Keep the terminal running while using the app; press `Ctrl+C` there to stop both servers.

On first launch, open the dashboard, choose **Add project**, and register a local Git repository by its absolute path. Project memory is stored locally in SQLite under `apps/api/data/relay.sqlite` by default and persists across restarts.

If a server reports that its port is already in use, stop the other Relay process using that port, then run `npm run dev` again. Vite may choose and print another available web port; use the printed URL.

## Optional AI extraction

Local context extraction and handoffs work without a provider key. To enable optional Groq extraction, copy the example environment file and add your key to the API environment only:

```sh
# macOS / Linux
cp apps/api/.env.example apps/api/.env

# Windows PowerShell
Copy-Item apps/api/.env.example apps/api/.env
```

Set `GROQ_API_KEY` in `apps/api/.env`, then restart the development servers. Never put provider keys in `VITE_*` variables, frontend code, commits, or handoff context. If the provider is unavailable, the local extraction fallback remains available.

## Run the desktop companion (optional)

Leave `npm run dev` running. In a second terminal at the repository root, run:

```sh
npm run desktop
```

The desktop companion uses the local API. See [apps/desktop/README.md](apps/desktop/README.md) for platform details and the Codex-to-OpenCode workflow.

## Build and test your changes

Run these from the repository root:

```sh
npm test
npm run build
```

`npm test` runs the API, MCP, desktop, and web test suites. `npm run build` type-checks and builds the API, web app, and MCP server. If you changed only one workspace, its test/build commands are also available in that workspace's `package.json`.

## Where to make changes

```text
apps/web/       Landing page and dashboard (React + Vite)
apps/api/       Local API, SQLite persistence, Git checks, extraction
apps/mcp/       MCP server for supported coding assistants
apps/desktop/   Electron desktop companion
packages/shared/Shared TypeScript contracts
```

Keep backend secrets server-side, preserve explicit human approval for handoffs, and represent repository observations separately from assistant-provided claims. For product behavior and architecture, start with [README.md](README.md).

## A typical contribution loop

1. Create a feature branch for your change.
2. Run Relay with `npm run dev` and make sure the relevant flow works locally.
3. Run `npm test` and `npm run build` before sharing the change.
4. Commit your focused changes and open a pull request for review.

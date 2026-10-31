# Deploy the Relay AI frontend to Vercel

Relay AI's Vercel deployment is a static frontend. The local API, SQLite database, repository checks, MCP server, and optional Groq key stay on the developer's computer. This keeps repository verification pointed at the actual checkout and preserves the local-first data boundary.

## Deploy

1. Import `prajwal-io/Relay-Ai` into Vercel and keep the project root at the repository root.
2. Let `vercel.json` configure the Vite build and `apps/web/dist` output.
3. In Vercel Project Settings → Environment Variables, add `VITE_RELAY_API` with the public API address the browser should call. For the local-first setup, use `http://127.0.0.1:4317/api/v1`. This value is a URL, not a secret.
4. Redeploy after changing the environment variable; Vite includes it in the built client.
5. On the developer's machine, keep Node.js 22.9+ and Git installed. Copy `apps/api/.env.example` to `apps/api/.env`, add the private `GROQ_API_KEY` there if desired, and set `WEB_ORIGINS` to the exact Vercel production origin, for example `https://relay-ai.vercel.app`. Keep `WEB_ORIGIN` for local development. Do not use `*`.
6. Start the local services with `npm run dev`. Open the Vercel website in a browser on that same machine and allow local-network access if the browser asks.
7. Configure OpenCode and Codex to use the local MCP server as described in `apps/mcp/README.md`.

## Data and security boundary

- `.env` and the SQLite database are excluded from Git. Vercel receives source code and static frontend assets only.
- The Groq key is read by the local API. Never put it in a `VITE_` variable or Vercel frontend settings.
- Project paths and Git evidence refer to the machine running the local API. A remote Vercel function cannot inspect that machine's filesystem.
- CORS allows only the built-in local development origins and the exact origins listed in `WEB_ORIGIN` / `WEB_ORIGINS`. Each added origin grants that website's JavaScript access to the local Relay API, so allow only a deployment you control.
- The dashboard works only while the local API is running in the same browser's environment. Opening the hosted site on another device does not give it access to this machine's memory or repository.
- This deployment is a single-user local companion architecture, not a multi-tenant hosted backend. Do not bind the local API to a public interface. A hosted multi-user product needs authenticated API access, per-user data isolation, and durable cloud storage.

## Validate before launch

From the repository root, run:

```sh
npm ci
npm run build
npm test
```

Then deploy a Vercel Preview, confirm the browser can reach the local API, check `/api/v1/health` through the configured API URL, create a test project, and complete an approved MCP handoff. Git evidence is available only for a project path on the computer running the local service.

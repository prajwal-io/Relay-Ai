# Deploy the Relay AI frontend to Vercel

Relay AI's Vercel deployment is a static frontend. The local API, SQLite database, repository checks, MCP server, and optional Groq key stay on the developer's computer. This keeps repository verification pointed at the actual checkout and preserves the local-first data boundary.

## Deploy

1. Import `prajwal-io/Relay-Ai` into Vercel and keep the project root at the repository root.
2. Let `vercel.json` configure the Vite build and `apps/web/dist` output.
3. Use the hosted site for product information, the sample walkthrough, and the download link.
4. After installation, launch Relay and use **Open dashboard** in its tray menu. Relay authenticates the dashboard to the API on that computer. Contributors can open their local Vite dashboard after running `npm run dev`.

## Data and security boundary

- `.env` and the SQLite database are excluded from Git. Vercel receives source code and static frontend assets only.
- The Groq key is read by the local API. Never put it in a `VITE_` variable or Vercel frontend settings.
- Project paths and Git evidence refer to the machine running the local API. A remote Vercel function cannot inspect that machine's filesystem.
- The installed API requires an installation credential. Cross-site browser requests are rejected, and the public site has no access to local projects or handoff receipts.
- This deployment is a single-user local companion architecture, not a multi-tenant hosted backend. Do not bind the local API to a public interface. A hosted multi-user product needs authenticated API access, per-user data isolation, and durable cloud storage.

## Validate before launch

From the repository root, run:

```sh
npm ci
npm run build
npm test
```

On the Vercel preview, check navigation, the simulated walkthrough, and the download destination. Verify the connected dashboard and approved MCP handoff with the installed app on the same machine as the test checkout.

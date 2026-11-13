# Relay AI local API

The local Node service provides a SQLite-backed project memory API and explicit handoff state transitions. It binds to loopback by default and stores the database at `apps/api/data/relay.sqlite`.

## Run

Use Node 22.9 or newer (the service uses built-in `node:sqlite` and optional `.env` loading):

```sh
npm install
npm run dev --workspace apps/api
```

Copy `apps/api/.env.example` to `apps/api/.env` as needed. `GROQ_API_KEY` is optional and is read only on the server. `POST /api/v1/projects/:projectId/extract` returns suggested items for review; it does not save them automatically. Submitted context is redacted before an explicit Groq request. If Groq is unavailable, local extraction keeps working. `GET /api/v1/health` reports the selected provider without exposing credentials.

For a Vercel-hosted frontend, keep this API on the user's computer and add the exact frontend URL to `WEB_ORIGINS` in `apps/api/.env` (comma-separated; no wildcards). The API only binds to loopback and rejects non-loopback `Host` headers, unapproved browser origins, cross-site browser fetches, unsupported methods, non-JSON writes, oversized bodies, and request bursts above its limit. See the root `VERCEL_DEPLOYMENT.md` for the full local-first deployment boundary.

These checks reduce browser-based cross-site requests and accidental network exposure. They do not authenticate a process running as the same user: a local process can call the loopback API directly. Treat this as a single-user desktop service on a trusted machine, not an isolation boundary for untrusted local software or a multi-user server. CORS is an origin filter, not user authentication; only allow a frontend deployment you control.

## Handoff lifecycle

Create a draft with `POST /api/v1/projects/:projectId/handoffs`, approve it with `POST /api/v1/handoffs/:id/approve`, then retrieve/consume it with `GET /api/v1/handoffs/:id/context` or `POST /api/v1/handoffs/:id/load`. The load route only accepts approved drafts and records the load timestamp. Project handoff history is available at `GET /api/v1/projects/:projectId/handoffs`.

Verification responses report repository observations separately. A successful Git status check verifies only the observed working-tree state. It does not establish that a task or decision is correct or complete.

`GET /api/v1/handoffs/:id/receipt` returns each successful retrieval time, the exact approved context snapshot Relay returned, the Git evidence captured with the handoff, and a current/stale/unverified repository status. The dashboard can export that receipt as Markdown for a team to review or share manually. Older receipts created before context snapshots are marked without recovered text. A receipt proves Relay returned context to the destination integration; it does not prove the model read or understood it.

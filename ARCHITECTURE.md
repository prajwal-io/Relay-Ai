# Relay AI architecture

## Initial build boundary

- `apps/web`: React/Vite single-page application; landing page first, then the dashboard.
- `apps/api`: Node.js/TypeScript local service, SQLite persistence, repository inspection, optional Groq extraction adapter.
- `apps/mcp`: stdio MCP server using the official TypeScript SDK. MCP tools call the local service contracts.
- `packages/shared`: shared API and domain types. This directory is the integration boundary.

The local API owns persistence and repository verification. Browser UI and MCP server are clients. Groq is an optional server-side extraction adapter; persistence and basic handoff generation must work with it disabled or unavailable. Only explicitly submitted context is sent to the provider after basic secret and email redaction; the API key remains local. A Git command is evidence only for the exact repository observation it returns; it does not verify arbitrary claims in memory.

## Shared data contract

`packages/shared/src/contracts.ts` defines projects, sessions, typed memory, provenance/evidence, handoffs, and API routes. Repository facts, model-generated text, user statements, and assistant statements retain distinct provenance. Handoffs carry item IDs and verification state; approval is an explicit state transition.

## API conventions

- Prefix: `/api/v1`
- JSON requests and responses; structured `{ error: { code, message, details? } }` errors.
- Local bind by default (`127.0.0.1`); no credentials or project content in request logs.
- SQLite is the source of truth. Repository reads are scoped to a registered project root and reject path traversal.


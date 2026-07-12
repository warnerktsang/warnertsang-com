# Architecture audit — `/apps/agent`

## Current shape

`/apps/agent` is a fully working authenticated Next.js app with:

- Google sign-in gated by a server-side allowlist
- Prisma persistence for users, OAuth accounts, chat threads, chat messages, tool calls, connectors, and audit events
- a connector registry + tool executor abstraction
- a model-provider abstraction
- a chat UI that streams answers through the AI SDK
- Google Calendar and Gmail read-only connector code

This is already more than a UI wrapper; it is a reusable service layer with a lot of the right boundaries for an MCP-backed backend.

## Reusable components

| Component | Why it is reusable |
| --- | --- |
| `src/lib/auth.ts` / `src/lib/auth-guard.ts` | Server-side auth boundary, allowlist enforcement, and session normalization are directly reusable for MCP request authentication. |
| `src/lib/audit.ts` | Append-only audit trail with metadata redaction is a good match for MCP auth, authorization, and tool-call logging. |
| `src/lib/db.ts` + Prisma schema | Prisma singleton, audit tables, and thread/tool-call persistence can be reused for MCP runtime state and audit logging. |
| `src/connectors/types.ts` | Connector/tool abstraction already models normalized capabilities instead of vendor-specific endpoints. |
| `src/connectors/registry.ts` | Central registry is a good basis for MCP tool registration. |
| `src/connectors/executor.ts` | Centralized validation + fail-closed execution is exactly the right shape for MCP tool invocation. |
| `src/connectors/token-store.ts` | Abstracts credential storage behind a narrow interface; useful if future MCP integrations need per-user tokens. |
| `src/lib/connectors-db.ts` | Registry-to-database sync pattern can become a capability catalog. |
| `src/lib/threads.ts` | Thread persistence is reusable only if the product keeps conversational history; otherwise it can be retired. |
| Validation with Zod | Good fit for MCP tool input schemas and request validation. |

## Components to retire

| Component | Why retire it |
| --- | --- |
| `src/components/ChatShell.tsx`, `MessageView.tsx`, `Sidebar.tsx` | The product no longer needs a custom chat UI if Claude is the interface. |
| `src/app/chat/*`, `src/app/login/page.tsx`, `src/app/admin/page.tsx` | These are UI surfaces for the old product direction, not the MCP-first architecture. |
| `src/agent/model.ts` / `src/agent/runtime.ts` | The OpenAI-centric agent runtime is the wrong abstraction once Claude is the primary interface. |
| Google Calendar and Gmail connector implementations | Native Claude connectors make these redundant as custom integrations. |
| Chat persistence as the primary UX primitive | The new product is capability-centric, not chat-centric. Thread persistence can survive only as an audit/replay feature. |
| The current `POST /api/chat` orchestration path | This is the old control plane; MCP should become the primary request surface. |

## Components to adapt

| Component | How to adapt it |
| --- | --- |
| Connector registry | Reframe it as a normalized capability registry (`finance.*`, `memory.*`, `policy.*`) instead of vendor-specific tools. |
| Tool executor | Make it the MCP tool execution boundary, with authz + audit around each call. |
| Audit model | Add MCP request/authz/tool-event semantics and keep it append-only. |
| Authorization layer | Move from “can the signed-in user access the chat app?” to “is this caller allowed to use this tool?” |
| Persistence layer | Shift from chat-thread first storage to normalized domain data and derived views. |
| Validation layer | Keep Zod, but validate request payloads for MCP tools and sync jobs instead of chat messages. |
| Token store abstraction | Preserve the abstraction; swap the implementation to encrypted storage if personal connectors are added later. |

## Recommendations

1. Keep the connector/tool abstraction; it already points in the right direction.
2. Stop investing in the chat UI and chat-specific orchestration.
3. Convert the execution path into a remote MCP server with a small normalized tool surface.
4. Preserve persistence, audit, and validation, but retarget them to MCP and normalized data sync instead of live chat.
5. Treat Google Calendar/Gmail code as phase-1 scaffolding that should be removed once Claude-native connectors are the default.

## Bottom line

This repo is a good candidate for a pivot, not a rewrite. The right move is to preserve the service-layer boundaries and retire the chat product surface.

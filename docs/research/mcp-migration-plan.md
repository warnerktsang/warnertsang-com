# MCP migration plan

## Recommendation

Use a remote **Streamable HTTP** MCP server, exposed from Vercel as a dedicated route, built with the official TypeScript SDK:

- `@modelcontextprotocol/server`
- `createMcpHandler(...)`
- `McpServer`

Why:

- Claude’s custom connectors and remote MCP docs explicitly support remote HTTPS servers.
- Streamable HTTP is the current transport recommendation for remote servers.
- The SDK is the least risky way to stay aligned with the protocol as it evolves.
- Next.js on Vercel can host a fetch-based MCP route without a separate runtime.

## Proposed architecture

```text
Claude
↓
Remote MCP server (HTTPS / Streamable HTTP)
↓
Authentication boundary
↓
Authorization boundary
↓
Application services
↓
Integrations / normalized data sources
```

## Transport

**Use Streamable HTTP.**

Do not start with SSE unless you need legacy compatibility. SSE is the fallback, not the target.

Implementation detail:

- Mount one MCP endpoint, e.g. `/api/mcp`
- Support `GET` and `POST`
- Keep the server stateless at the HTTP layer

## Recommended SDK

**`@modelcontextprotocol/server`** is the right default.

Rationale:

- It is the official TypeScript SDK path.
- It supports `createMcpHandler` and `McpServer`.
- It is already documented for Streamable HTTP on web-standard runtimes.
- It avoids hand-rolling protocol framing.

## Authentication model

### MVP

Use a shared bearer token in an HTTP request header:

- header: `Authorization: Bearer <token>`
- secret name: `MCP_BEARER_TOKEN`

This is enough to prove Claude can connect and keeps the bootstrap simple.

### Future

Move to OAuth 2.1 when the server needs:

- per-user authorization
- multiple users
- third-party consent
- finer-grained access revocation

Claude’s remote connector docs already support OAuth-based MCP connections.

## Authorization model

Use **scope-based authorization**, even if the first implementation is a single shared token.

Suggested normalized scopes:

- `agent_os.read`
- `finance.read`
- `finance.read.transactions`
- `finance.read.holdings`
- `memory.read`
- `policy.read`

The important part is that authorization lives above integrations:

- tools should be normalized
- vendor APIs should never appear in Claude-facing tool names
- per-tool checks should happen before execution

## Audit model

Keep the existing append-only audit table and extend it for MCP-specific events.

Log at least:

- authentication success / failure
- authorization success / failure
- tool invocation start / finish
- request path / method / caller identity
- normalized tool metadata

Rules:

- never log access tokens
- never log refresh tokens
- redact token-like fields recursively
- keep audit writes fail-closed for the app, not the request path

## Vercel deployment strategy

Recommended deployment shape:

1. Keep the repo as a monorepo.
2. Deploy `/apps/agent` as a separate Vercel project.
3. Point the project root at `apps/agent`.
4. Use the Node runtime for the MCP route.
5. Set the shared bearer token and database URL as production secrets.
6. Keep the MCP endpoint public over HTTPS so Claude can reach it.

For the long term, the MCP server and the data-sync workers can stay in the same app until scale forces a split.

## Compatibility with Claude custom connectors

Claude custom connectors work with remote MCP over HTTPS. The current docs support:

- remote MCP server URLs
- request-header auth
- OAuth-based auth

That means the recommended path is:

1. ship the remote MCP endpoint
2. connect it as a custom connector in Claude Desktop / Web / Mobile
3. later swap the auth model from shared header token to OAuth if needed

## Practical recommendation

Start with:

- remote Streamable HTTP
- shared bearer token auth
- one normalized tool: `agent_os.get_status`
- audit logging + input validation

Then add data domains behind the same MCP boundary only after the normalization model is settled.

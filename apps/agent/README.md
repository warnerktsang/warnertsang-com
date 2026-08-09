# agent — Personal Agent OS (Phase 1)

A private, authenticated, **read-only** MCP backend over your personal data
(Google Calendar, Gmail, finance). This is Phase 1 of a longer-term "Personal
Agent OS": one agent interface over your personal systems. The chat interface
is Claude (via Claude connectors / MCP); this app provides auth, OAuth, a
connector framework, a tool execution layer, audit logging, and persistence.

> Phase 1 is strictly read-only. There are no write scopes and no write
> functionality anywhere in the app.

## What it does

- Google sign-in, restricted to a single allowlisted account (server-side).
- Connects to Google Calendar using only `calendar.readonly`.
- Exposes connector tools (e.g. `google_calendar.read_events`) to Claude over
  MCP; Claude is the chat interface.
- Logs every tool execution and access event to an audit trail.
- A minimal admin page for observability (tool calls, audit events, connector
  status).
- A protected Plaid connection page and manual posted-transaction sync for the
  first finance ingestion slice.

## Architecture

```
Claude (chat interface, via MCP connector)
      │  /api/mcp  (bearer auth, fail closed)
      ▼
MCP server ── tools from the ConnectorRegistry
      │
      ▼
ToolExecutor  ── writes tool_calls + audit_events (fail closed)
      │
      ▼
Connector (google_calendar) ── TokenStore → Google Calendar API (read-only)
```

Key modules:

| Path | Responsibility |
| --- | --- |
| `src/connectors/types.ts` | `Connector` / `ConnectorTool` / `ToolContext` interfaces + `defineTool`. |
| `src/connectors/registry.ts` | `ConnectorRegistry` — single source of truth for available connectors/tools. |
| `src/connectors/executor.ts` | `ToolExecutor` — validates input, runs the tool, records `tool_calls` + audit, fail-closed. |
| `src/connectors/token-store.ts` | `TokenStore` abstraction over OAuth token persistence (see Security). |
| `src/connectors/google/*` | Google Calendar connector, token refresh, read-only REST client. |
| `src/lib/mcp/*` | MCP server: bearer auth, tool handlers, status. |
| `src/lib/auth.ts` | Auth.js (NextAuth v5) config: Google provider, allowlist, token capture. |
| `src/lib/audit.ts` | Audit trail writer + metadata sanitizer (never logs secrets). |
| `src/app/*` | Login, admin, and finance pages and API route handlers. |

Adding a future connector = implement the `Connector` interface and
`registry.register(...)` it. The MCP server, executor, and audit layer need no
changes.

## Environment variables

See `.env.example`. All are validated at startup by `src/lib/env.ts`.

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string. |
| `AUTH_SECRET` | yes | Auth.js session/JWT secret. Generate with `npx auth secret`. |
| `AUTH_URL` | local/custom | App base URL. Auto-set on Vercel; set for a custom domain. |
| `GOOGLE_CLIENT_ID` | yes | Google OAuth client ID. |
| `GOOGLE_CLIENT_SECRET` | yes | Google OAuth client secret. |
| `ALLOWED_GOOGLE_EMAIL` | yes | The only Google account allowed to sign in. |
| `PLAID_ENV` | finance | `production` or `sandbox`; use `production` for the real Chase path. |
| `PLAID_CLIENT_ID` | finance | Plaid Production client ID. |
| `PLAID_SECRET` | finance | Plaid Production secret. |
| `FINANCE_ENCRYPTION_KEY` | finance | 64-character hex value from `openssl rand -hex 32`; encrypts Plaid access tokens at rest. |

Finance setup is server-only. After deploying with the finance variables,
sign in and open `/finance/connect`. Plaid Link handles Chase authentication;
the browser receives only a short-lived Link token, while the exchanged
long-lived access token is encrypted before storage in Neon. The page includes a
manual date-range sync for posted transactions. MCP query tools and scheduled
refreshes are intentionally deferred until this real-data path is validated.

## Local development

Prereqs: Node 22+, Docker (for local Postgres), and a Google OAuth client.

1. **Install**
   ```sh
   cd apps/agent
   npm install
   ```

2. **Start Postgres** (or point `DATABASE_URL` at any Postgres)
   ```sh
   docker run -d --name agent-pg \
     -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -e POSTGRES_DB=agent \
     -p 5433:5432 postgres:16
   ```

3. **Configure env**
   ```sh
   cp .env.example .env
   # fill in GOOGLE_CLIENT_ID/SECRET, ALLOWED_GOOGLE_EMAIL
   # generate AUTH_SECRET:
   npx auth secret
   ```

4. **Migrate the database**
   ```sh
   npm run db:migrate
   ```

5. **Create a Google OAuth client** (Google Cloud Console)
   - Enable the **Google Calendar API**.
   - OAuth consent screen: **External**, add your email as a **Test user**.
   - Create an **OAuth client ID** (Web application).
   - Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
   - Requested scopes include `openid email profile` and
     `https://www.googleapis.com/auth/calendar.readonly`.

6. **Run**
   ```sh
   npm run dev
   # http://localhost:3000
   ```

Other scripts: `npm run test` (vitest), `npm run typecheck`, `npm run lint`,
`npm run db:studio`.

## Deploying to Vercel

Deploy as a **separate Vercel project** from the same repo:

1. **New Project** → import this repo.
2. **Root Directory** = `apps/agent`.
3. Framework preset: **Next.js** (auto-detected).
4. Add environment variables (Production + Preview): `DATABASE_URL`,
   `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
   `ALLOWED_GOOGLE_EMAIL`. For the finance slice, also add `PLAID_ENV`,
   `PLAID_CLIENT_ID`, `PLAID_SECRET`, and `FINANCE_ENCRYPTION_KEY`.
   (`AUTH_URL` only for a custom domain.)
   - Use a hosted Postgres (e.g. Neon or Vercel Postgres) for `DATABASE_URL`.
5. **Deploy.** Then add the production callback URL to the Google OAuth client:
   `https://<your-domain>/api/auth/callback/google`.
6. **Run migrations against the production database** (once, and on schema
   changes):
   ```sh
   DATABASE_URL="<prod-url>" npm run db:migrate:deploy
   ```

The `build` script runs `prisma generate` before `next build`. Migrations are
intentionally **not** run during the Vercel build so deploys don't mutate the
database implicitly; run `db:migrate:deploy` explicitly.

## Security considerations

- **Auth allowlist, server-side.** Only `ALLOWED_GOOGLE_EMAIL` may sign in;
  enforced in the Auth.js `signIn` callback and re-checked in `getCurrentUser()`
  (defense in depth). Non-matching accounts are rejected (`AccessDenied`).
- **No client-side tokens.** OAuth token exchange happens server-side; tokens
  are never sent to the browser.
- **No write scopes / no write functionality.** Only `calendar.readonly` is
  requested and only read endpoints are called.
- **Fail closed.** Auth, connector, and permission errors return errors rather
  than degrading to an unauthenticated/permissive state. Tool errors are
  surfaced to the model as structured `{ error }` results so the assistant does
  not fabricate data.
- **Audit logging.** Login, connector access, and every tool execution are
  recorded in `audit_events` / `tool_calls`. Metadata is scrubbed of
  token/secret-like keys before persistence; tokens/secrets are never logged.
- **Token storage (known limitation).** For the MVP, OAuth access/refresh tokens
  are stored in plaintext columns on `oauth_accounts`. All access is funneled
  through the `TokenStore` abstraction so this can be replaced with an encrypted
  store (KMS envelope encryption / secrets manager) without touching callers.
  See "Next steps".
- **Finance token storage.** Plaid access tokens are encrypted with
  `FINANCE_ENCRYPTION_KEY` before they are written to `finance_connections`.
  Plaid credentials and access tokens never go to the client, Claude, audit
  metadata, or logs.

## Known limitations

- Single connector (Google Calendar) and a single tool (`read_events`).
- Refresh tokens are stored unencrypted (behind `TokenStore`).
- Google OAuth app runs in "testing" mode (test users only) unless verified.
- Single-user by design (allowlist of one).

## Recommended next steps (Phase 2)

- Encrypt token storage (implement an encrypted `TokenStore`).
- Add connectors (Gmail, Drive, etc.) — the framework already supports it.
- Per-connector connect/disconnect UX and granular scopes.
- Rate limiting and per-tool authorization policies.

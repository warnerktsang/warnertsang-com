# reservations
Approval-based reservation automation sandbox.

The current build is intentionally low-risk and low-frequency:
- single-user local backend
- mock provider only (no live provider integration yet)
- explicit approval gate before booking
- intent expiry to avoid stale executions
- full in-memory execution trail for debugging

## Modular build tasks
### 1) Backend skeleton
- Fastify service and health route
- Typed domain models
- In-memory store

### 2) Intent lifecycle
- Create intent from search criteria
- Pending approval state
- Expiration guardrails

### 3) Booking execution
- Approve intent
- Execute a single booking call
- Persist success/failure state and confirmation

### 4) Provider adapters
- Current: `MockResyProvider`
- Next: real provider adapter interface implementation

### 5) Safety and controls
- Add auth gate
- Add request rate limits
- Add idempotency keys
- Add persistent database storage

## Run locally
```sh
npm install
npm run dev
```

Server starts on `http://localhost:8787`.

## API
### `GET /health`
Readiness endpoint.

### `POST /api/intents/search-and-create`
Creates a `pending_approval` intent when a candidate slot is found.

### `POST /api/intents/:id/approve`
Approves and executes a single booking call.

### `GET /api/intents`
Lists all intents.

### `GET /api/intents/:id`
Returns one intent.

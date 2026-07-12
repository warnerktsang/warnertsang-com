# Finance architecture recommendation

## Recommendation

```text
Claude
↓
Agent OS MCP
↓
Finance service
↓
Provider adapters
↓
Institutions
```

This should be the default architecture for the first real finance phase.

## Why this is the right first move

1. **It matches the locked product direction.** Claude is the interface; Agent OS is the authority layer.
2. **It keeps the surface normalized.** Claude should see `finance.search_transactions`, not `chase.get_transactions`.
3. **It supports read-only by construction.** The finance layer can expose only search / analyze / summarize tools.
4. **It is compatible with nightly sync.** Live querying is unnecessary.
5. **It scales to more institutions without changing the Claude surface.**

## Decision matrix

| Option | Complexity | Cost | Coverage | Maintenance burden | Reliability | Security | Recommended? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Unified aggregator (Plaid / similar) | Medium | Medium | High | Medium | High enough for nightly sync | Good if read-only and normalized | **Yes** |
| Wealthfront-centric | Low at first, high later | Low to medium | Low | Low only if you stay inside Wealthfront | High for Wealthfront only | Good, but too narrow | No |
| Direct integrations | Very high | Low to high depending on vendor | Fragmented | Very high | Uneven | Worse, because each vendor differs | No |

## Detailed recommendation

### Primary choice: normalized finance service with provider adapters

Use a normalized core as the source of truth for:

- balances
- transactions
- holdings
- liabilities
- derived net worth
- historical rollups

Then add provider adapters underneath it:

- Chase for credit-card spending data first
- Wealthfront for brokerage / managed-investing data
- Schwab, Robinhood, AmEx, Capital One, Coinbase later

The adapter boundary is where vendor-specific auth, session renewal, and coverage quirks belong.

### Secondary / supplemental integrations

Use aggregators where they materially improve coverage or fidelity:

- Plaid for broad read coverage
- Monarch only as a fallback consumer surface, not the canonical data layer
- direct vendor APIs if a provider offers a better official path

## Why not provider-specific tool names

The direct-vendor route loses on almost every axis once you need more than one institution:

- each institution has different auth
- access is often partner-gated
- maintenance burden compounds quickly
- tool naming becomes vendor-specific
- Claude-facing semantics become messy

## Final recommendation

Ship the first finance phase as:

- Claude custom connector → Agent OS MCP
- normalized finance service
- provider adapters
- nightly sync
- read-only Claude tools only

Start with Chase credit-card spending because that is your first concrete use case, but keep the adapter contract generic so Wealthfront, Schwab, Robinhood, AmEx, Capital One, and Coinbase can plug in later without changing the Claude surface.

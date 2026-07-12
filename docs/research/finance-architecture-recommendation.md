# Finance architecture recommendation

## Recommendation

```text
Claude
↓
Agent OS MCP
↓
Finance service
↓
Plaid
↓
Institutions
```

This should be the default architecture for the first real finance phase.

## Why this is the right first move

1. **It matches the locked product direction.** Claude is the interface; Agent OS is the authority layer.
2. **It keeps the surface normalized.** Claude should see `finance.get_net_worth`, not `chase.get_transactions`.
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

### Primary choice: unified aggregator

Use one aggregator as the source of truth for:

- balances
- transactions
- holdings
- liabilities
- derived net worth
- historical rollups

Then store normalized rows in your own database and compute summaries yourself.

### Secondary / supplemental integrations

Add direct vendor APIs only where they materially improve coverage or fidelity:

- Coinbase for crypto-specific data
- possibly Wealthfront if you need first-party Wealthfront account details

But do not make them the core architecture.

## Why not Wealthfront-centric

Wealthfront is a single institution, not a universal data fabric.

That makes it unsuitable as the backbone for a personal finance layer that needs:

- Chase
- AmEx
- Capital One
- Schwab
- Robinhood
- Coinbase

## Why not direct integrations

The direct-integration route loses on almost every axis:

- each institution has different auth
- access is often partner-gated
- maintenance burden compounds quickly
- tool naming becomes vendor-specific
- Claude-facing semantics become messy

## Final recommendation

Ship the first finance phase as:

- Claude custom connector → Agent OS MCP
- normalized finance service
- Plaid-backed ingestion
- nightly sync
- read-only Claude tools only

That is the simplest architecture that still supports the long-term normalized personal data layer.

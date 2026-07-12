# Open-source landscape

This review focuses on repos that look reusable for a read-only personal finance / MCP stack, plus a few larger finance projects that are useful as architectural references.

## High-value MCP / aggregator candidates

| Repo | License | Stars | Latest visible activity | Maintainer activity | Auth model | Official API? | Security concerns | Reusability |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `plaid/ai-coding-toolkit` | Not surfaced in search output; Plaid-owned | Not surfaced | 2025-05 (published) | Plaid-owned / active | Depends on local sandbox tooling | Yes for Plaid docs + sandbox tooling | Lower risk than random community code, but still read carefully | Good for docs search, sandbox mocks, and AI-friendly Plaid workflows |
| `t-rhex/plaid-mcp` | MIT | 0 | 2026-04-22 | One-person community repo | Local OAuth/token flow for Plaid/Teller | Unofficial wrapper around official Plaid/Teller APIs | Token storage, local DB handling, and maintenance risk | Good reference for tool shape; not production-ready as-is |
| `adelaidasofia/finance-mcp` | MIT | 0 | 2026-07-08 | Small personal project | Plaid + local keychain | Unofficial wrapper around official Plaid APIs | Local token storage, limited review surface | Interesting design reference, especially the read-only normalized vault idea |
| `visusnet/coinbase-mcp-server` | Not surfaced | Not surfaced | 2026-01 | Unknown | Coinbase API keys / likely direct auth | Official Coinbase API surface, but server is third-party | Avoid any code that enables trading or autonomous action | Only useful as a crypto-specific reference; not a fit for this project |
| `Harshaan-Chugh/FinAgent-MCP` | Not surfaced | Not surfaced | Not surfaced | Unknown | Plaid + Robinhood integrations | Mixed official/unofficial | Trading automation is a red flag for this project | Too much scope / wrong direction because of write and trading paths |

## Reference finance products

| Repo | License | Stars | Latest visible activity | Maintainer activity | Auth model | Official API? | Security concerns | Reusability |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `actualbudget/actual` | MIT | 27k+ | 2026-07-01 | Large, active community | Self-hosted app auth | N/A; it is a budgeting product | Broad codebase; too much product surface | Reuse ideas around account modeling, reconciliation, and import pipelines |
| `actualbudget/actual-server` | MIT | 3k+ | 2025-02 | Archived | Server auth for Actual | N/A | Archived, so limited long-term value | Good historical reference for server/client split and sync model |
| `firefly-iii/firefly-iii` | AGPL-3.0 | 23k+ | current on main | Very active | Self-hosted user auth + API tokens | N/A | AGPL is a strong copyleft constraint | Excellent reference for ledger/account normalization; code reuse is license-sensitive |
| `ghostfolio/ghostfolio` | AGPL-3.0 | 8–9k | current on main | Active | Self-hosted auth + integrations | N/A | AGPL and broader product scope | Useful reference for portfolio modeling and performance views |

## What can be reused

### From Plaid-facing MCP repos

- read-only tool naming
- normalized account and transaction tool surfaces
- local caching / sync loops
- audit-first logging patterns

### From Actual / Firefly / Ghostfolio

- account and transaction normalization
- categorization patterns
- portfolio / holdings modeling
- reconciliation and import ideas

## What not to reuse

- autonomous trading logic
- write-enabled finance actions
- any integration that exposes raw institution-specific tools directly to Claude
- any code path that stores tokens unencrypted without a clear migration path

## Security and product-fit conclusion

The best open-source patterns are architectural, not copy-paste:

- **Use their normalization ideas.**
- **Do not adopt their full products.**
- **Do not introduce write actions.**
- **Do not expose institution-specific tool names to Claude.**

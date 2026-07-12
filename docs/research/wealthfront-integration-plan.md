# Wealthfront integration plan

## Facts

- Wealthfront does not expose a clearly documented public consumer API.
- Wealthfront support documents confirm:
  - linked external accounts are updated every business day
  - Wealthfront offers Quicken export via QFX
  - account statements and account snapshots are downloadable from the dashboard
- Wealthfront’s own engineering blog describes an internal linking platform that aggregates external accounts behind a Wealthfront API, but that is not the same as a public API for third-party use.
- Plaid supports Wealthfront as a covered institution, so Wealthfront data can also be reached indirectly through a read-only aggregator.

## Assumptions

- The goal remains read-only access.
- Claude stays the interface.
- The backend should normalize data instead of exposing Wealthfront-specific tool semantics everywhere.

## Recommendation

Wealthfront should be treated as the product anchor and the first ingestion target, but not the sole technical dependency.

Practical order:

1. Parse Wealthfront QFX exports into normalized finance objects.
2. Keep the MCP tool surface normalized enough that Claude can ask finance questions without knowing Wealthfront-specific storage details.
3. Use Plaid or another aggregator only as a fallback or coverage supplement if Wealthfront exports are incomplete.

## Why this is the right shape

- It avoids waiting on a public Wealthfront API that does not appear to exist.
- It keeps the system read-only.
- It gives you a path to own your data without copying Wealthfront’s product.
- It lets us compare direct Wealthfront exports against aggregator coverage before committing to a larger data model.

## What the next step should prove

- Can a Wealthfront QFX export recover the balances, transactions, and holdings you actually care about?
- If not, which gaps remain?
- Are those gaps better filled by Plaid, another aggregator, or manual export/import?

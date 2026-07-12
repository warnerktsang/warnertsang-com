# Aggregator evaluation

Question: can one integration provide transactions, holdings, balances, net worth, and historical data?

Short answer: **mostly yes**, but **net worth is usually derived** in your own normalized database, not handed to you as a single authoritative endpoint.

## Comparison

| Provider | Transactions | Holdings | Balances | Net worth | Historical data | Freshness | Cost posture | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Plaid | Yes | Yes | Yes | Derived in your app | Yes, product-dependent | Webhooks + refresh products; nightly sync is realistic | Pricing is opaque / paid | Best general-purpose fit for a US personal finance layer |
| MX | Yes | Yes | Yes | Derived / product-specific | Yes; some products emphasize ~90 days and background aggregation | Background aggregation roughly every 24h | Enterprise / sales-led | Strong normalization and categorization story, but cost/enterprise overhead is the downside |
| Finicity | Yes | Yes | Yes | Derived | Yes | Refresh and aggregation flows available | Enterprise / partner-led | Solid for bank/asset verification use cases; less friendly as a consumer hobby stack |
| Akoya | Yes | Yes for supported investment/banking endpoints | Yes | Derived | Yes, depending on institution and FDX support | Depends on partner / institution | Consortium / enterprise | Good standards story, but not the simplest path |
| Yodlee | Yes | Yes | Yes | Derived | Yes | Aggregation / refresh products available | Enterprise / partner-led | Broad coverage, but heavier commercial/process burden |
| Wealthfront | No, not as an aggregator | No | No | No | Only for Wealthfront’s own accounts | N/A | Consumer product, not aggregator pricing | Not a real candidate for cross-institution aggregation |

## Can one integration cover the target fields?

### Transactions

Yes. All of the serious aggregators can do this.

### Holdings

Yes, for institutions and products that expose investment data. Coverage varies by institution.

### Balances

Yes. This is one of the core aggregator jobs.

### Net worth

Usually **computed**, not fetched.

The aggregator gives you asset, liability, cash, and holdings data. Your normalized store computes net worth.

### Historical data

Usually yes, but the usable history depth varies:

- aggregator product
- institution support
- consent / refresh rules
- whether the account is bank, credit, loan, or brokerage

## Recommendation

**Plaid first.**

Reason:

- broad US coverage
- the right read-only data domains
- strong enough for a normalized layer
- supported mental model for personal finance apps
- nightly sync is acceptable, so we do not need live-query complexity

## When to choose something else

- **MX** if normalization/categorization is more important than developer simplicity and cost is acceptable.
- **Yodlee** if breadth matters more than elegance and the commercial process is acceptable.
- **Finicity / Akoya** if your specific institution coverage or standards requirements make them the better fit.
- **Wealthfront** only if the product is intentionally Wealthfront-centric, which this project is not.

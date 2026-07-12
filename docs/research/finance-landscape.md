# Finance landscape

Scope: US consumer finances only.

The main question is not “can one API read financial data?” but “can one API do it read-only, across enough institutions, with acceptable maintenance and cost?”

## Bottom line

- **No single institution API is a good general-purpose personal-finance backbone.**
- **Plaid is the strongest unified aggregator candidate** for a read-only, normalized personal finance layer.
- **Direct institution APIs are mostly supplemental**, not foundational.
- **Wealthfront is not an aggregator.** It is a single institution / wealth platform, not a broad data layer.

## Institution-by-institution notes

| Institution | Official API status | OAuth | Consumer access | Balances | Transactions | Holdings | Historical data | Pricing / terms | Suitability |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Wealthfront | No public consumer aggregation API found; only support / internal web-app evidence | Not as a public consumer API | Your own Wealthfront account only | Yes in-product, not a public API | Yes in-product, not a public API | Yes in-product, not a public API | Statements / activity exist, but not as a general API | Product fees exist; no public API pricing | Poor as a backbone; maybe a supplemental source for a Wealthfront-only account |
| Chase | Public developer page exists for “aggregation consent” | Likely yes in the product flow | Access appears product/partner gated | Possibly | Possibly | Unclear / limited | Unclear | Public pricing not obvious | Interesting, but not a dependable general solution |
| American Express | Official developer portal; Account and Transaction API for proprietary cards under PSD2 | Yes | Customer-authorized card data | Yes for AmEx cards | Yes for AmEx cards | No general holdings layer | Limited to card-account history | Partner / program terms apply | Useful only for AmEx card data |
| Capital One | Official dev portal and Customer Transactions API | Yes | Customer-authorized Capital One data | Likely yes in product scope | Yes | No general holdings layer | Likely limited to product scope | Full access restricted to integration partners | Good for Capital One-only access, not a universal layer |
| Schwab | Official developer portal exists for trader API | Likely yes for brokerage/trading flows | Schwab customer / partner context | Brokerage balances may exist | Trading / account history may exist | Yes for Schwab brokerage context | Limited to brokerage history | Access appears portal / product gated | Good only if Schwab brokerage data is important |
| Robinhood | Official crypto API exists; no broad public brokerage API found | Yes for crypto API | Robinhood Crypto customers in the US | Crypto account balances only | Crypto orders / history | Crypto holdings only | Crypto history only | Product-specific terms | Supplemental crypto source, not a general finance backbone |
| Coinbase | Official consumer app APIs with OAuth2 and API keys | Yes | User-authorized Coinbase accounts | Yes | Yes | Yes | Yes, plus websocket feeds | Public docs exist; pricing not the blocker | Good supplemental crypto source |

## Decision notes

### Wealthfront

Wealthfront’s public material points to internal API usage for its own product, not a public aggregation platform. It should not be treated as a universal finance source.

### Chase / AmEx / Capital One / Schwab

These are real official programs, but the access model is institution-specific and often partner-gated. They are good only if you need one institution’s first-party data and can live with limited coverage.

### Robinhood / Coinbase

Crypto is special. Coinbase is the better supplemental integration because it has an explicit consumer API surface. Robinhood’s public API surface is much narrower and more product-specific.

## Recommendation

For a read-only normalized finance layer:

1. Use a unified aggregator for banking, cards, loans, and brokerage.
2. Add Coinbase separately if crypto matters.
3. Avoid institution-specific integrations unless they fill a documented gap.

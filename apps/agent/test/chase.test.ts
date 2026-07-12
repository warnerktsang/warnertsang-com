import { describe, expect, it } from "vitest";
import {
  buildChaseImportSummary,
  mapChaseTransaction,
  parseChaseCookieExport,
} from "@/lib/finance/chase";

const sampleResponse = {
  postedTransactionCount: 2,
  totalPostedTransactionCount: 2,
  moreTransactionsIndicator: false,
  activities: [
    {
      transactionStatusCode: "Posted",
      last4CardNumber: "1234",
      transactionAmount: 12.34,
      transactionDate: "2026-07-12",
      authorizationDate: "2026-07-12",
      digitalAccountIdentifier: 979910521,
      creditDebitCode: "D" as const,
      merchantDetails: {
        rawMerchantDetails: {
          merchantDbaName: "COFFEE SHOP",
          merchantCategoryName: "Food & Drink",
        },
        enrichedMerchants: [{ merchantName: "Coffee Shop" }],
      },
      sorTransactionIdentifier: "txn-1",
    },
    {
      transactionStatusCode: "Pending",
      last4CardNumber: "1234",
      transactionAmount: 45.67,
      transactionDate: "2026-07-12",
      authorizationDate: "2026-07-12",
      digitalAccountIdentifier: 979910521,
      creditDebitCode: "D" as const,
      merchantDetails: {
        rawMerchantDetails: {
          merchantDbaName: "GROCERY MART",
          merchantCategoryName: "Groceries",
        },
      },
      sorTransactionIdentifier: "txn-2",
    },
  ],
};

describe("chase cookie exports", () => {
  it("normalizes cookie export sameSite values for Playwright", () => {
    const cookies = parseChaseCookieExport(
      JSON.stringify([
        {
          domain: ".chase.com",
          hostOnly: false,
          httpOnly: true,
          name: "session",
          path: "/",
          sameSite: "no_restriction",
          secure: true,
          session: true,
          storeId: "0",
          value: "abc",
        },
      ]),
    );

    expect(cookies[0]?.sameSite).toBe("None");
  });
});

describe("Chase transaction normalization", () => {
  it("maps raw card activity into normalized finance transactions", () => {
    const transaction = mapChaseTransaction(sampleResponse.activities[0], "979910521");

    expect(transaction.fitId).toBe("txn-1");
    expect(transaction.amount).toBe(-12.34);
    expect(transaction.name).toBe("Coffee Shop");
    expect(transaction.memo).toBe("COFFEE SHOP — Food & Drink");
    expect(transaction.currency).toBe("USD");
  });

  it("builds a normalized finance summary from Chase activity", () => {
    const summary = buildChaseImportSummary(sampleResponse, "979910521", "1234", 1);

    expect(summary.source).toBe("chase");
    expect(summary.totals.accounts).toBe(1);
    expect(summary.totals.transactions).toBe(2);
    expect(summary.accounts[0]?.transactions).toHaveLength(1);
    expect(summary.accounts[0]?.accountName).toBe("Chase credit card ••••1234");
  });
});

export type FinanceSource =
  | "chase"
  | "wealthfront"
  | "schwab"
  | "coinbase"
  | "robinhood"
  | "amex"
  | "capital_one"
  | "unknown";

export interface FinanceTransaction {
  fitId: string;
  type: string;
  postedAt: string | null;
  tradeAt: string | null;
  settleAt: string | null;
  amount: number;
  name: string | null;
  memo: string | null;
  symbol: string | null;
  currency: string | null;
}

export interface FinanceHolding {
  symbol: string | null;
  name: string | null;
  units: number | null;
  unitPrice: number | null;
  marketValue: number | null;
  securityId: string | null;
}

export interface FinanceAccount {
  source: FinanceSource;
  accountId: string;
  accountName: string | null;
  institutionId: string | null;
  currency: string | null;
  balance: number | null;
  availableCash: number | null;
  holdings: FinanceHolding[];
  transactions: FinanceTransaction[];
}

export interface FinanceImportSummary {
  source: FinanceSource;
  accounts: FinanceAccount[];
  totals: {
    accounts: number;
    transactions: number;
    holdings: number;
    balance: number | null;
  };
}

export type FinanceCapability =
  | "balances"
  | "holdings"
  | "transactions"
  | "statements"
  | "crypto"
  | "credit_card"
  | "brokerage";

export interface FinanceProvider {
  source: FinanceSource;
  displayName: string;
  capabilities: FinanceCapability[];
}

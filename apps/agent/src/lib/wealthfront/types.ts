export interface WealthfrontTransaction {
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

export interface WealthfrontHolding {
  symbol: string | null;
  name: string | null;
  units: number | null;
  unitPrice: number | null;
  marketValue: number | null;
  securityId: string | null;
}

export interface WealthfrontAccount {
  source: "bank" | "credit_card" | "investment";
  accountId: string;
  accountName: string | null;
  institutionId: string | null;
  currency: string | null;
  balance: number | null;
  availableCash: number | null;
  holdings: WealthfrontHolding[];
  transactions: WealthfrontTransaction[];
}

export interface WealthfrontImportSummary {
  source: "wealthfront";
  accounts: WealthfrontAccount[];
  totals: {
    accounts: number;
    transactions: number;
    holdings: number;
    balance: number | null;
  };
}

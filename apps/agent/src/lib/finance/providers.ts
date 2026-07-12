import { type FinanceProvider, type FinanceSource } from "@/lib/finance/types";

const PROVIDERS: FinanceProvider[] = [
  {
    source: "chase",
    displayName: "Chase",
    capabilities: ["balances", "transactions", "credit_card"],
  },
  {
    source: "wealthfront",
    displayName: "Wealthfront",
    capabilities: ["balances", "holdings", "transactions", "brokerage"],
  },
  {
    source: "schwab",
    displayName: "Schwab",
    capabilities: ["balances", "holdings", "transactions", "brokerage"],
  },
  {
    source: "coinbase",
    displayName: "Coinbase",
    capabilities: ["balances", "holdings", "transactions", "crypto"],
  },
  {
    source: "robinhood",
    displayName: "Robinhood",
    capabilities: ["balances", "holdings", "transactions", "brokerage"],
  },
  {
    source: "amex",
    displayName: "American Express",
    capabilities: ["balances", "transactions", "credit_card"],
  },
  {
    source: "capital_one",
    displayName: "Capital One",
    capabilities: ["balances", "transactions", "credit_card"],
  },
];

export function listFinanceProviders(): FinanceProvider[] {
  return PROVIDERS.slice();
}

export function getFinanceProvider(source: FinanceSource): FinanceProvider | undefined {
  return PROVIDERS.find((provider) => provider.source === source);
}

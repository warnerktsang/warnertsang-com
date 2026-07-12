import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { parseOfxStatement } from "@/lib/finance/ofx";
import { type FinanceSource } from "@/lib/finance/types";
import { MCP_READ_SCOPE } from "@/lib/mcp/constants";

export const financeImportSchema = z.object({
  source: z.enum(["chase", "wealthfront", "schwab", "coinbase", "robinhood", "amex", "capital_one", "unknown"]),
  content: z.string().min(1),
  maxTransactionsPerAccount: z.number().int().positive().max(200).optional(),
});

export type FinanceImportInput = z.infer<typeof financeImportSchema>;

export async function importFinanceStatement(input: FinanceImportInput) {
  const summary = parseOfxStatement(input.content, input.source as FinanceSource);
  const maxTransactions = input.maxTransactionsPerAccount ?? 25;
  const accounts = summary.accounts.map((account) => ({
    ...account,
    transactions: account.transactions.slice(0, maxTransactions),
  }));

  await recordAudit({
    type: "tool_execution",
    action: "Parsed finance statement",
    success: true,
    metadata: {
      scope: MCP_READ_SCOPE,
      source: summary.source,
      accounts: summary.totals.accounts,
      transactions: summary.totals.transactions,
      holdings: summary.totals.holdings,
    },
  });

  return {
    ...summary,
    accounts,
  };
}

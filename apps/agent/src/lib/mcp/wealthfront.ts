import { z } from "zod";
import { parseWealthfrontQfx } from "@/lib/wealthfront/qfx";
import { MCP_READ_SCOPE } from "@/lib/mcp/constants";
import { recordAudit } from "@/lib/audit";

export const wealthfrontImportSchema = z.object({
  content: z.string().min(1),
  maxTransactionsPerAccount: z.number().int().positive().max(200).optional(),
});

export type WealthfrontImportInput = z.infer<typeof wealthfrontImportSchema>;

export async function importWealthfrontQfx(input: WealthfrontImportInput) {
  const summary = parseWealthfrontQfx(input.content);
  const maxTransactions = input.maxTransactionsPerAccount ?? 25;
  const accounts = summary.accounts.map((account) => ({
    ...account,
    transactions: account.transactions.slice(0, maxTransactions),
  }));

  await recordAudit({
    type: "tool_execution",
    action: "Parsed Wealthfront QFX export",
    success: true,
    metadata: {
      scope: MCP_READ_SCOPE,
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

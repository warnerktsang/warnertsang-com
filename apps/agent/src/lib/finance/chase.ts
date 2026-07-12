import { z } from "zod";
import { type FinanceAccount, type FinanceImportSummary, type FinanceTransaction } from "@/lib/finance/types";

const chaseCookieSchema = z.object({
  domain: z.string(),
  hostOnly: z.boolean().optional(),
  httpOnly: z.boolean().optional(),
  name: z.string(),
  path: z.string().optional(),
  sameSite: z.string().optional().nullable(),
  secure: z.boolean().optional(),
  session: z.boolean().optional(),
  storeId: z.string().optional().nullable(),
  value: z.string(),
});

const chaseCookieExportSchema = z.array(chaseCookieSchema);

const chaseTransactionSchema = z.object({
  transactionStatusCode: z.string().optional(),
  transactionsMemoPostedIndicator: z.boolean().optional(),
  last4CardNumber: z.string().optional(),
  embossedName: z.string().optional(),
  transactionAmount: z.number(),
  transactionDate: z.string().optional(),
  authorizationDate: z.string().optional(),
  digitalAccountIdentifier: z.number().optional(),
  creditDebitCode: z.enum(["C", "D"]).optional(),
  merchantDetails: z
    .object({
      rawMerchantDetails: z
        .object({
          merchantDbaName: z.string().optional(),
          merchantStateCode: z.string().optional(),
          merchantCategoryName: z.string().optional(),
        })
        .optional(),
      enrichedMerchants: z
        .array(
          z.object({
            merchantName: z.string().optional(),
            merchantCityName: z.string().optional(),
            merchantStateCode: z.string().optional(),
          }),
        )
        .optional(),
    })
    .optional(),
  etuStandardExpenseCategoryCode: z.string().optional(),
  etuStandardTransactionTypeName: z.string().optional(),
  etuStandardTransactionTypeGroupName: z.string().optional(),
  transactionDescription: z.string().optional(),
  transactionSummary: z.string().optional(),
  accountReferenceNumber: z.number().optional(),
  sorTransactionIdentifier: z.union([z.string(), z.number()]).optional(),
  authorizationHighReferenceNumber: z.string().optional(),
  postingCardNumber: z.string().optional(),
});

const chaseTransactionsResponseSchema = z.object({
  postedTransactionCount: z.number().optional(),
  totalPostedTransactionCount: z.number().optional(),
  moreTransactionsIndicator: z.boolean().optional(),
  activities: z.array(chaseTransactionSchema).default([]),
});

export interface ChaseCookieExport {
  cookies: Array<z.infer<typeof chaseCookieSchema>>;
}

export interface ChaseImportOptions {
  cookiesJson: string;
  browserCdpUrl?: string;
  maxTransactionsPerAccount?: number;
}

export function parseChaseCookieExport(cookiesJson: string) {
  const parsed = chaseCookieExportSchema.parse(JSON.parse(cookiesJson));
  return parsed.map((cookie) => ({
    ...cookie,
    sameSite:
      cookie.sameSite?.toLowerCase() === "no_restriction"
        ? ("None" as const)
        : cookie.sameSite?.toLowerCase() === "lax"
          ? ("Lax" as const)
          : cookie.sameSite?.toLowerCase() === "strict"
            ? ("Strict" as const)
            : undefined,
  }));
}

function transactionName(transaction: z.infer<typeof chaseTransactionSchema>) {
  return (
    transaction.merchantDetails?.enrichedMerchants?.[0]?.merchantName ??
    transaction.merchantDetails?.rawMerchantDetails?.merchantDbaName ??
    transaction.transactionDescription ??
    transaction.transactionSummary ??
    transaction.etuStandardTransactionTypeName ??
    null
  );
}

function transactionMemo(transaction: z.infer<typeof chaseTransactionSchema>) {
  const rawName = transaction.merchantDetails?.rawMerchantDetails?.merchantDbaName ?? null;
  const category = transaction.merchantDetails?.rawMerchantDetails?.merchantCategoryName ?? null;
  if (rawName && category) return `${rawName} — ${category}`;
  return rawName ?? category;
}

export function mapChaseTransaction(
  transaction: z.infer<typeof chaseTransactionSchema>,
  accountId: string,
): FinanceTransaction {
  const absoluteAmount = Math.abs(transaction.transactionAmount);
  const amount =
    transaction.creditDebitCode === "C"
      ? absoluteAmount
      : transaction.creditDebitCode === "D"
        ? -absoluteAmount
        : transaction.transactionAmount;
  const date = transaction.authorizationDate ?? transaction.transactionDate ?? null;
  const fitId =
    String(transaction.sorTransactionIdentifier ?? "") ||
    String(transaction.authorizationHighReferenceNumber ?? "") ||
    `${accountId}-${date ?? "unknown"}-${transaction.transactionAmount}`;

  return {
    fitId,
    type: transaction.transactionStatusCode ?? transaction.etuStandardTransactionTypeName ?? "UNKNOWN",
    postedAt: transaction.transactionDate ?? null,
    tradeAt: null,
    settleAt: null,
    amount,
    name: transactionName(transaction),
    memo: transactionMemo(transaction),
    symbol: null,
    currency: "USD",
  };
}

export function buildChaseImportSummary(
  response: unknown,
  accountId: string,
  accountLast4: string | null,
  maxTransactionsPerAccount: number,
): FinanceImportSummary {
  const parsed = chaseTransactionsResponseSchema.parse(response);
  const transactions = parsed.activities
    .map((transaction) => mapChaseTransaction(transaction, accountId))
    .slice(0, maxTransactionsPerAccount);

  const account: FinanceAccount = {
    source: "chase",
    accountId,
    accountName: accountLast4 ? `Chase credit card ••••${accountLast4}` : "Chase credit card",
    institutionId: "chase",
    currency: "USD",
    balance: null,
    availableCash: null,
    holdings: [],
    transactions,
  };

  return {
    source: "chase",
    accounts: [account],
    totals: {
      accounts: 1,
      transactions: parsed.activities.length,
      holdings: 0,
      balance: null,
    },
  };
}

export async function importChaseTransactionsFromCookieExport(input: ChaseImportOptions) {
  const browserCdpUrl = input.browserCdpUrl ?? process.env.CHASE_BROWSER_CDP_URL ?? "http://127.0.0.1:29229";
  const cookies = parseChaseCookieExport(input.cookiesJson);
  const { chromium } = await import("playwright-core");

  const browser = await chromium.connectOverCDP(browserCdpUrl);
  const context = await browser.newContext({ ignoreHTTPSErrors: true });

  try {
    await context.addCookies(cookies);

    const page = context.pages()[0] ?? (await context.newPage());
    const responseUrl =
      "/svc/rr/accounts/secure/gateway/credit-card/transactions/inquiry-maintenance/etu-transactions/v4/accounts/transactions";
    const responsePromise = new Promise<import("playwright-core").Response>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("Timed out waiting for Chase transactions"));
      }, 60000);

      page.on("response", (response) => {
        if (response.status() === 200 && response.url().includes(responseUrl)) {
          clearTimeout(timer);
          resolve(response);
        }
      });
    });

    await page.goto("https://secure.chase.com/web/auth/dashboard#/dashboard/overview", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    const response = await responsePromise;
    const raw = (await response.json()) as unknown;

    const transactionResponse = chaseTransactionsResponseSchema.parse(raw);
    const firstTransaction = transactionResponse.activities[0];
    const accountId = String(firstTransaction?.digitalAccountIdentifier ?? "chase");
    const accountLast4 = firstTransaction?.last4CardNumber ?? null;

    return buildChaseImportSummary(
      transactionResponse,
      accountId,
      accountLast4,
      input.maxTransactionsPerAccount ?? 25,
    );
  } finally {
    await context.close();
  }
}

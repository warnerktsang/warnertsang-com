import "server-only";
import type { AccountBase, Transaction } from "plaid";
import { prisma } from "@/lib/db";
import { encryptFinanceSecret, decryptFinanceSecret } from "@/lib/finance/crypto";
import { createPlaidClient } from "@/lib/finance/plaid";

const PROVIDER = "plaid";

export interface FinanceDateRange {
  start: Date;
  end: Date;
}

export interface FinanceSyncResult {
  syncRunId: string;
  status: "completed";
  transactionsSeen: number;
  transactionsSaved: number;
  requestedStart: string;
  requestedEnd: string;
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseDateOnly(value: string, field: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new Error(`${field} must be an ISO date (YYYY-MM-DD)`);
  }
  return date;
}

export function parseFinanceDateRange(start: string, end: string): FinanceDateRange {
  const parsedStart = parseDateOnly(start, "startDate");
  const parsedEnd = parseDateOnly(end, "endDate");
  if (parsedStart > parsedEnd) throw new Error("startDate must be before endDate");
  const duration = parsedEnd.getTime() - parsedStart.getTime();
  if (duration > 366 * 24 * 60 * 60 * 1000) {
    throw new Error("Date range cannot exceed one year");
  }
  return { start: parsedStart, end: parsedEnd };
}

export async function savePlaidConnection(input: {
  userId: string;
  publicToken: string;
}): Promise<{ id: string; institutionName: string | null }> {
  const plaid = createPlaidClient();
  const exchanged = await plaid.itemPublicTokenExchange({
    public_token: input.publicToken,
  });
  const accessToken = exchanged.data.access_token;
  const itemId = exchanged.data.item_id;
  const accounts = await plaid.accountsGet({ access_token: accessToken });

  const institutionName = accounts.data.item?.institution_name ?? null;
  const connection = await prisma.financeConnection.upsert({
    where: {
      userId_provider: { userId: input.userId, provider: PROVIDER },
    },
    create: {
      userId: input.userId,
      provider: PROVIDER,
      itemId,
      encryptedAccessToken: encryptFinanceSecret(accessToken),
      institutionId: accounts.data.item?.institution_id ?? null,
      institutionName,
      status: "connected",
    },
    update: {
      itemId,
      encryptedAccessToken: encryptFinanceSecret(accessToken),
      institutionId: accounts.data.item?.institution_id ?? null,
      institutionName,
      status: "connected",
      lastError: null,
    },
    select: { id: true, institutionName: true },
  });

  for (const account of accounts.data.accounts) {
    const mapped = mapAccount(account);
    await prisma.financeAccount.upsert({
      where: {
        connectionId_providerAccountId: {
          connectionId: connection.id,
          providerAccountId: account.account_id,
        },
      },
      create: { connectionId: connection.id, ...mapped },
      update: mapped,
    });
  }

  return connection;
}

function mapAccount(account: AccountBase) {
  return {
    providerAccountId: account.account_id,
    name: account.name,
    officialName: account.official_name ?? null,
    mask: account.mask ?? null,
    type: account.type,
    subtype: account.subtype ?? null,
    isoCurrencyCode: account.balances.iso_currency_code ?? null,
    currentBalance: account.balances.current,
    availableBalance: account.balances.available ?? null,
  };
}

function mapTransaction(
  transaction: Transaction,
  accountId: string,
) {
  const postedAt = new Date(`${transaction.date}T00:00:00.000Z`);
  const authorizedAt = transaction.authorized_date
    ? new Date(`${transaction.authorized_date}T00:00:00.000Z`)
    : null;
  return {
    accountId,
    providerTransactionId: transaction.transaction_id,
    pendingTransactionId: transaction.pending_transaction_id ?? null,
    name: transaction.name,
    merchantName: transaction.merchant_name ?? null,
    originalDescription: transaction.original_description ?? null,
    amount: transaction.amount,
    isoCurrencyCode: transaction.iso_currency_code ?? null,
    postedAt,
    authorizedAt,
    pending: transaction.pending,
    paymentChannel: transaction.payment_channel,
    category: transaction.personal_finance_category
      ? [
          transaction.personal_finance_category.primary,
          transaction.personal_finance_category.detailed,
        ]
      : [],
  };
}

export async function syncPlaidTransactions(input: {
  userId: string;
  startDate: string;
  endDate: string;
}): Promise<FinanceSyncResult> {
  const range = parseFinanceDateRange(input.startDate, input.endDate);
  const connection = await prisma.financeConnection.findUnique({
    where: { userId_provider: { userId: input.userId, provider: PROVIDER } },
    include: { accounts: true },
  });
  if (!connection) throw new Error("No Plaid connection found");
  if (connection.status !== "connected") {
    throw new Error("Plaid connection requires attention");
  }

  const syncRun = await prisma.financeSyncRun.create({
    data: {
      userId: input.userId,
      connectionId: connection.id,
      provider: PROVIDER,
      requestedStart: range.start,
      requestedEnd: range.end,
    },
  });

  try {
    const plaid = createPlaidClient();
    const accessToken = decryptFinanceSecret(connection.encryptedAccessToken);
    const transactions: Transaction[] = [];
    let offset = 0;
    let totalTransactions = 0;
    do {
      const response = await plaid.transactionsGet({
        access_token: accessToken,
        start_date: toDateOnly(range.start),
        end_date: toDateOnly(range.end),
        options: {
          count: 500,
          offset,
          include_original_description: true,
        },
      });
      transactions.push(...response.data.transactions);
      totalTransactions = response.data.total_transactions;
      offset += response.data.transactions.length;
      if (response.data.transactions.length === 0) break;
    } while (offset < totalTransactions);
    const accountIds = new Set(connection.accounts.map((account) => account.providerAccountId));
    const postedTransactions = transactions.filter(
      (transaction) =>
        !transaction.pending && accountIds.has(transaction.account_id),
    );

    await prisma.$transaction(async (tx) => {
      for (const transaction of postedTransactions) {
        const account = connection.accounts.find(
          (candidate) => candidate.providerAccountId === transaction.account_id,
        );
        if (!account) continue;
        const mapped = mapTransaction(transaction, account.id);
        await tx.financeTransaction.upsert({
          where: {
            accountId_providerTransactionId: {
              accountId: account.id,
              providerTransactionId: transaction.transaction_id,
            },
          },
          create: mapped,
          update: {
            pendingTransactionId: mapped.pendingTransactionId,
            name: mapped.name,
            merchantName: mapped.merchantName,
            originalDescription: mapped.originalDescription,
            amount: mapped.amount,
            isoCurrencyCode: mapped.isoCurrencyCode,
            postedAt: mapped.postedAt,
            authorizedAt: mapped.authorizedAt,
            pending: mapped.pending,
            paymentChannel: mapped.paymentChannel,
            category: mapped.category,
          },
        });
      }
      await tx.financeSyncRun.update({
        where: { id: syncRun.id },
        data: {
          status: "completed",
          transactionsSeen: transactions.length,
          transactionsSaved: postedTransactions.length,
          completedAt: new Date(),
        },
      });
      await tx.financeConnection.update({
        where: { id: connection.id },
        data: { lastSyncedAt: new Date(), lastError: null },
      });
    });

    return {
      syncRunId: syncRun.id,
      status: "completed",
      transactionsSeen: transactions.length,
      transactionsSaved: postedTransactions.length,
      requestedStart: input.startDate,
      requestedEnd: input.endDate,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Plaid sync failed";
    await prisma.$transaction([
      prisma.financeSyncRun.update({
        where: { id: syncRun.id },
        data: { status: "error", error: message, completedAt: new Date() },
      }),
      prisma.financeConnection.update({
        where: { id: connection.id },
        data: { status: "connected", lastError: message },
      }),
    ]);
    throw new Error(message);
  }
}

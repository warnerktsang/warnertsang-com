import { parseStrict as parseOfx } from "ofx-js";
import {
  type WealthfrontAccount,
  type WealthfrontHolding,
  type WealthfrontImportSummary,
  type WealthfrontTransaction,
} from "@/lib/wealthfront/types";

type MaybeArray<T> = T | T[] | undefined;

interface OfxTransaction {
  FITID?: string;
  TRNTYPE?: string;
  DTPOSTED?: string;
  DTTRADE?: string;
  DTSETTLE?: string;
  TRNAMT?: string | number;
  NAME?: string;
  MEMO?: string;
  CURRENCY?: string;
  CURSYM?: string;
  UNITS?: string | number;
  UNITPRICE?: string | number;
  TOTAL?: string | number;
  SECID?: {
    UNIQID?: string;
    UNIQUEID?: string;
    UNIQIDTYPE?: string;
    UNIQUEIDTYPE?: string;
  };
}

interface BankStatement {
  BANKACCTFROM?: {
    ACCTID?: string;
    BANKID?: string;
    ACCTTYPE?: string;
  };
  CURDEF?: string;
  LEDGERBAL?: {
    BALAMT?: string | number;
  };
  AVAILBAL?: {
    BALAMT?: string | number;
  };
  BANKTRANLIST?: {
    STMTTRN?: MaybeArray<OfxTransaction>;
  };
}

interface CreditCardStatement {
  CCACCTFROM?: {
    ACCTID?: string;
    ACCTTYPE?: string;
  };
  CURDEF?: string;
  LEDGERBAL?: {
    BALAMT?: string | number;
  };
  AVAILBAL?: {
    BALAMT?: string | number;
  };
  BANKTRANLIST?: {
    STMTTRN?: MaybeArray<OfxTransaction>;
  };
}

interface InvestmentPosition {
  SECID?: {
    UNIQID?: string;
    UNIQUEID?: string;
    UNIQIDTYPE?: string;
    UNIQUEIDTYPE?: string;
  };
  SECNAME?: string;
  UNITS?: string | number;
  UNITPRICE?: string | number;
  MKTVAL?: string | number;
}

interface InvestmentStatement {
  INVACCTFROM?: {
    ACCTID?: string;
    BROKERID?: string;
  };
  CURDEF?: string;
  INVBAL?: {
    AVAILCASH?: string | number;
    MARGINBALANCE?: string | number;
    SHORTBALANCE?: string | number;
    BUYPOWER?: string | number;
  };
  INVTRANLIST?: {
    STMTTRN?: MaybeArray<OfxTransaction>;
  };
  INVPOSLIST?: {
    INVPOS?: MaybeArray<InvestmentPosition>;
  };
}

interface ParsedOfx {
  OFX?: {
    BANKMSGSRSV1?: {
      STMTTRNRS?: MaybeArray<{
        STMTRS?: BankStatement;
      }>;
    };
    CREDITCARDMSGSRSV1?: {
      CCSTMTTRNRS?: MaybeArray<{
        CCSTMTRS?: CreditCardStatement;
      }>;
    };
    INVSTMTMSGSRSV1?: {
      INVSTMTTRNRS?: MaybeArray<{
        INVSTMTRS?: InvestmentStatement;
      }>;
    };
  };
}

function toArray<T>(value: MaybeArray<T>): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function toNumber(value: string | number | undefined): number | null {
  if (value === undefined) return null;
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeDate(value: string | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/[^0-9]/g, "");
  if (digits.length < 8) return null;
  const year = digits.slice(0, 4);
  const month = digits.slice(4, 6);
  const day = digits.slice(6, 8);
  return `${year}-${month}-${day}`;
}

function pickSymbol(transaction: OfxTransaction, fallback: string | null): string | null {
  const uniq =
    transaction.SECID?.UNIQID ??
    transaction.SECID?.UNIQUEID ??
    transaction.SECID?.UNIQIDTYPE ??
    transaction.SECID?.UNIQUEIDTYPE ??
    null;
  return uniq ?? fallback;
}

function normalizeTransaction(transaction: OfxTransaction): WealthfrontTransaction {
  return {
    fitId: transaction.FITID ?? "",
    type: transaction.TRNTYPE ?? "UNKNOWN",
    postedAt: normalizeDate(transaction.DTPOSTED),
    tradeAt: normalizeDate(transaction.DTTRADE),
    settleAt: normalizeDate(transaction.DTSETTLE),
    amount: toNumber(transaction.TRNAMT) ?? 0,
    name: transaction.NAME ?? null,
    memo: transaction.MEMO ?? null,
    symbol: pickSymbol(transaction, transaction.NAME ?? null),
    currency: transaction.CURRENCY ?? transaction.CURSYM ?? null,
  };
}

function normalizeHolding(position: InvestmentPosition): WealthfrontHolding {
  return {
    symbol:
      position.SECID?.UNIQID ??
      position.SECID?.UNIQUEID ??
      position.SECID?.UNIQIDTYPE ??
      position.SECID?.UNIQUEIDTYPE ??
      null,
    name: position.SECNAME ?? null,
    units: toNumber(position.UNITS),
    unitPrice: toNumber(position.UNITPRICE),
    marketValue: toNumber(position.MKTVAL),
    securityId: position.SECID?.UNIQID ?? position.SECID?.UNIQUEID ?? null,
  };
}

function buildBankAccount(statement: BankStatement): WealthfrontAccount | null {
  const accountId = statement.BANKACCTFROM?.ACCTID;
  if (!accountId) return null;
  const transactions = toArray(statement.BANKTRANLIST?.STMTTRN).map(normalizeTransaction);
  return {
    source: "bank",
    accountId,
    accountName: statement.BANKACCTFROM?.ACCTTYPE ?? null,
    institutionId: statement.BANKACCTFROM?.BANKID ?? null,
    currency: statement.CURDEF ?? null,
    balance: toNumber(statement.LEDGERBAL?.BALAMT),
    availableCash: toNumber(statement.AVAILBAL?.BALAMT),
    holdings: [],
    transactions,
  };
}

function buildCreditCardAccount(statement: CreditCardStatement): WealthfrontAccount | null {
  const accountId = statement.CCACCTFROM?.ACCTID;
  if (!accountId) return null;
  const transactions = toArray(statement.BANKTRANLIST?.STMTTRN).map(normalizeTransaction);
  return {
    source: "credit_card",
    accountId,
    accountName: statement.CCACCTFROM?.ACCTTYPE ?? null,
    institutionId: null,
    currency: statement.CURDEF ?? null,
    balance: toNumber(statement.LEDGERBAL?.BALAMT),
    availableCash: toNumber(statement.AVAILBAL?.BALAMT),
    holdings: [],
    transactions,
  };
}

function buildInvestmentAccount(statement: InvestmentStatement): WealthfrontAccount | null {
  const accountId = statement.INVACCTFROM?.ACCTID;
  if (!accountId) return null;
  const transactions = toArray(statement.INVTRANLIST?.STMTTRN).map(normalizeTransaction);
  const holdings = toArray(statement.INVPOSLIST?.INVPOS).map(normalizeHolding);
  const availableCash =
    toNumber(statement.INVBAL?.AVAILCASH) ??
    toNumber(statement.INVBAL?.BUYPOWER) ??
    null;
  const balance =
    toNumber(statement.INVBAL?.MARGINBALANCE) ??
    toNumber(statement.INVBAL?.SHORTBALANCE) ??
    availableCash;
  return {
    source: "investment",
    accountId,
    accountName: statement.INVACCTFROM?.BROKERID ?? null,
    institutionId: statement.INVACCTFROM?.BROKERID ?? null,
    currency: statement.CURDEF ?? null,
    balance,
    availableCash,
    holdings,
    transactions,
  };
}

export function parseWealthfrontQfx(content: string): WealthfrontImportSummary {
  const parsed = parseOfx(content) as unknown as ParsedOfx;
  const accounts: WealthfrontAccount[] = [];

  for (const response of toArray(parsed.OFX?.BANKMSGSRSV1?.STMTTRNRS)) {
    const account = response.STMTRS ? buildBankAccount(response.STMTRS) : null;
    if (account) accounts.push(account);
  }

  for (const response of toArray(parsed.OFX?.CREDITCARDMSGSRSV1?.CCSTMTTRNRS)) {
    const account = response.CCSTMTRS ? buildCreditCardAccount(response.CCSTMTRS) : null;
    if (account) accounts.push(account);
  }

  for (const response of toArray(parsed.OFX?.INVSTMTMSGSRSV1?.INVSTMTTRNRS)) {
    const account = response.INVSTMTRS ? buildInvestmentAccount(response.INVSTMTRS) : null;
    if (account) accounts.push(account);
  }

  const totals = accounts.reduce(
    (acc, account) => {
      acc.transactions += account.transactions.length;
      acc.holdings += account.holdings.length;
      acc.balance = (acc.balance ?? 0) + (account.balance ?? 0);
      return acc;
    },
    { accounts: accounts.length, transactions: 0, holdings: 0, balance: 0 as number | null },
  );

  return {
    source: "wealthfront",
    accounts,
    totals,
  };
}

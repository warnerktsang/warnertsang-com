import { describe, expect, it } from "vitest";
import {
  decryptFinanceSecret,
  encryptFinanceSecret,
} from "@/lib/finance/crypto";
import { parseFinanceDateRange } from "@/lib/finance/service";

describe("finance encryption", () => {
  it("round-trips encrypted secrets without exposing plaintext", () => {
    const plaintext = "plaid-access-token";
    const encrypted = encryptFinanceSecret(plaintext);

    expect(encrypted).not.toContain(plaintext);
    expect(decryptFinanceSecret(encrypted)).toBe(plaintext);
  });
});

describe("finance date ranges", () => {
  it("parses inclusive ISO calendar dates as UTC date boundaries", () => {
    const range = parseFinanceDateRange("2026-08-01", "2026-08-09");
    expect(range.start.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-08-09T00:00:00.000Z");
  });

  it("rejects reversed or malformed dates", () => {
    expect(() => parseFinanceDateRange("2026-08-10", "2026-08-09")).toThrow(
      /before/,
    );
    expect(() => parseFinanceDateRange("2026/08/01", "2026-08-09")).toThrow(
      /ISO date/,
    );
    expect(() => parseFinanceDateRange("2026-02-30", "2026-03-01")).toThrow(
      /ISO date/,
    );
  });
});

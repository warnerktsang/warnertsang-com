import { describe, expect, it } from "vitest";
import { parseWealthfrontQfx } from "@/lib/wealthfront/qfx";
import { importWealthfrontQfx } from "@/lib/mcp/wealthfront";

const sampleQfx = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<DTSERVER>20240701000000
<LANGUAGE>ENG
</SONRS>
</SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
<TRNUID>1
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<STMTRS>
<CURDEF>USD
<BANKACCTFROM>
<BANKID>123456789
<ACCTID>WF-001
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20240701000000
<TRNAMT>-12.34
<FITID>txn-1
<NAME>COFFEE SHOP
<MEMO>Latte
</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>987.66
</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
<INVSTMTMSGSRSV1>
<INVSTMTTRNRS>
<TRNUID>2
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<INVSTMTRS>
<CURDEF>USD
<INVACCTFROM>
<BROKERID>WEALTHFRONT
<ACCTID>WF-INV-1
</INVACCTFROM>
<INVBAL>
<AVAILCASH>100.00
<BUYPOWER>100.00
</INVBAL>
<INVPOSLIST>
<INVPOS>
<SECID>
<UNIQID>VTI
<UNIQIDTYPE>TICKER
</SECID>
<SECNAME>Vanguard Total Stock Market ETF
<UNITS>10
<UNITPRICE>250.5
<MKTVAL>2505.0
</INVPOS>
</INVPOSLIST>
<INVTRANLIST>
<STMTTRN>
<TRNTYPE>BUY
<DTTRADE>20240701000000
<DTSETTLE>20240703000000
<TRNAMT>-2505
<FITID>txn-2
<NAME>VTI
<MEMO>Buy shares
<SECID>
<UNIQID>VTI
</SECID>
<UNITS>10
<UNITPRICE>250.5
<TOTAL>-2505
</STMTTRN>
</INVTRANLIST>
</INVSTMTRS>
</INVSTMTTRNRS>
</INVSTMTMSGSRSV1>
</OFX>`;

describe("Wealthfront QFX parsing", () => {
  it("normalizes bank and investment accounts", () => {
    const parsed = parseWealthfrontQfx(sampleQfx);

    expect(parsed.source).toBe("wealthfront");
    expect(parsed.totals.accounts).toBe(2);
    expect(parsed.totals.transactions).toBe(2);
    expect(parsed.totals.holdings).toBe(1);

    const [bank, investment] = parsed.accounts;
    expect(bank.source).toBe("bank");
    expect(bank.accountId).toBe("WF-001");
    expect(bank.transactions[0]?.amount).toBe(-12.34);
    expect(investment.source).toBe("investment");
    expect(investment.holdings[0]?.symbol).toBe("VTI");
  });

  it("caps the tool response without changing the parsed totals", async () => {
    const parsed = await importWealthfrontQfx({
      content: sampleQfx,
      maxTransactionsPerAccount: 1,
    });

    expect(parsed.totals.transactions).toBe(2);
    expect(parsed.accounts[0]?.transactions).toHaveLength(1);
    expect(parsed.accounts[1]?.transactions).toHaveLength(1);
  });
});

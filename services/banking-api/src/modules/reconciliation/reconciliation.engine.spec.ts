import { scoreReceivableMatch } from "./reconciliation.engine";

describe("reconciliation.engine", () => {
  it("match exato por txid PIX", () => {
    const tx = {
      id: "t1",
      amount: 100,
      pixTxid: "ABC123",
      payerDocument: null,
      description: null,
    };
    const rec = {
      id: "r1",
      totalAmount: 100,
      balanceAmount: 100,
      linkedPixTxid: "ABC123",
      payerDocument: null,
      description: null,
    };
    const m = scoreReceivableMatch(tx, rec);
    expect(m.matchType).toBe("EXACT");
    expect(m.score).toBe(1);
    expect(m.rulesMatched).toContain("txid_pix_exato");
  });

  it("match parcial por documento e valor", () => {
    const tx = {
      id: "t1",
      amount: 50,
      pixTxid: null,
      payerDocument: "12345678901",
      description: "referencia X",
    };
    const rec = {
      id: "r1",
      totalAmount: 50,
      balanceAmount: 50,
      linkedPixTxid: null,
      payerDocument: "123.456.789-01",
      description: "X",
    };
    const m = scoreReceivableMatch(tx, rec);
    expect(m.score).toBeGreaterThanOrEqual(0.45);
    expect(m.rulesMatched).toContain("documento_pagador");
    expect(m.rulesMatched).toContain("valor_igual_saldo");
  });
});

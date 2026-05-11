import type { ReconciliationMatchType } from "@prisma/client";

export type ReceivableSnapshot = {
  id: string;
  totalAmount: number;
  balanceAmount: number;
  linkedPixTxid: string | null;
  payerDocument: string | null;
  description: string | null;
};

export type BankTxSnapshot = {
  id: string;
  amount: number;
  pixTxid: string | null;
  payerDocument: string | null;
  description: string | null;
};

export type ScoredCandidate = {
  receivableId: string;
  score: number;
  matchType: ReconciliationMatchType;
  rulesMatched: string[];
};

function normDoc(s: string | null | undefined): string | null {
  if (!s) return null;
  return s.replace(/\D/g, "") || null;
}

/**
 * Motor de conciliação: prioriza txid PIX, valor/documento e descrição.
 * score 1 = match forte; valores menores = possíveis matches.
 */
export function scoreReceivableMatch(
  tx: BankTxSnapshot,
  rec: ReceivableSnapshot
): ScoredCandidate {
  const rules: string[] = [];
  let score = 0;
  let matchType: ReconciliationMatchType = "POSSIBLE";

  if (tx.pixTxid && rec.linkedPixTxid && tx.pixTxid === rec.linkedPixTxid) {
    rules.push("txid_pix_exato");
    score = 1;
    matchType = "EXACT";
    return { receivableId: rec.id, score, matchType, rulesMatched: rules };
  }

  const txDoc = normDoc(tx.payerDocument);
  const recDoc = normDoc(rec.payerDocument);
  if (txDoc && recDoc && txDoc === recDoc) {
    rules.push("documento_pagador");
    score += 0.35;
  }

  const amt = Number(tx.amount.toFixed(2));
  const bal = Number(rec.balanceAmount.toFixed(2));
  if (amt > 0 && amt === bal) {
    rules.push("valor_igual_saldo");
    score += 0.45;
    matchType = score >= 0.8 ? "EXACT" : "PARTIAL";
  } else if (amt > 0 && amt < bal && amt >= bal * 0.5) {
    rules.push("valor_parcial_significativo");
    score += 0.2;
    matchType = "PARTIAL";
  }

  if (tx.description && rec.description) {
    const a = tx.description.toLowerCase();
    const b = rec.description.toLowerCase();
    if (a.length > 4 && b.length > 4 && (a.includes(b) || b.includes(a))) {
      rules.push("descricao_similar");
      score += 0.15;
    }
  }

  if (score > 0.99) matchType = "EXACT";
  else if (score >= 0.45) matchType = "PARTIAL";
  else matchType = "POSSIBLE";

  return { receivableId: rec.id, score: Math.min(score, 1), matchType, rulesMatched: rules };
}

export function rankMatches(tx: BankTxSnapshot, receivables: ReceivableSnapshot[]): ScoredCandidate[] {
  return receivables
    .map((r) => scoreReceivableMatch(tx, r))
    .sort((a, b) => b.score - a.score);
}

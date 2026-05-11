import { createHash } from "crypto";
import type { BankTransactionDirection, BankTransactionStatus } from "@prisma/client";
import type { NormalizedBankTransaction } from "../../core/banking/normalized-transaction";

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function pickDate(raw: Record<string, unknown>): Date {
  const candidates = [
    raw.dataTransacao,
    raw.dataLancamento,
    raw.data,
    raw.dataMovimento,
    raw.dataHoraTransacao,
  ];
  for (const c of candidates) {
    const s = str(c);
    if (s) {
      const d = new Date(s);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return new Date();
}

function pickDirection(raw: Record<string, unknown>, amount: number): BankTransactionDirection {
  const tipo = `${raw.tipoTransacao || raw.tipoOperacao || raw.tipoLancamento || raw.tipo || ""}`.toUpperCase();
  if (tipo.includes("DEB") || tipo.includes("SAI") || tipo.includes("PAG")) return "DEBIT";
  if (tipo.includes("CRED") || tipo.includes("ENT") || tipo.includes("REC")) return "CREDIT";
  return amount < 0 ? "DEBIT" : "CREDIT";
}

function pickStatus(raw: Record<string, unknown>): BankTransactionStatus {
  const s = `${raw.status || raw.situacao || ""}`.toUpperCase();
  if (s.includes("ESTORN") || s.includes("REV")) return "REVERSED";
  if (s.includes("PEND")) return "PENDING";
  if (s) return "POSTED";
  return "POSTED";
}

function pickExternalId(raw: Record<string, unknown>): string {
  const direct =
    str(raw.codigoTransacao) ||
    str(raw.codigoIdentificador) ||
    str(raw.id) ||
    str(raw.numeroDocumento) ||
    str(raw.endToEndId);
  if (direct) return direct;
  const h = createHash("sha256");
  h.update(JSON.stringify(raw));
  return `synthetic:${h.digest("hex").slice(0, 32)}`;
}

function flattenTransactions(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  if (payload && typeof payload === "object") {
    const o = payload as Record<string, unknown>;
    const keys = ["transacoes", "items", "content", "lancamentos", "operacoes", "listaTransacoes"];
    for (const k of keys) {
      const arr = o[k];
      if (Array.isArray(arr)) return arr as Record<string, unknown>[];
    }
  }
  return [];
}

export function mapInterExtratoPayloadToNormalized(
  payload: unknown
): NormalizedBankTransaction[] {
  const rows = flattenTransactions(payload);
  const out: NormalizedBankTransaction[] = [];
  for (const raw of rows) {
    const signed =
      num(raw.valor) ||
      num(raw.valorTransacao) ||
      num(raw.amount) ||
      num(raw.valorLancamento);
    const direction = pickDirection(raw, signed);
    const amount = Math.abs(signed);
    const description =
      str(raw.descricao) ||
      str(raw.historico) ||
      str(raw.memo) ||
      str(raw.textoDescricao);
    const payerDocument =
      str(raw.cpfCnpjPagador) ||
      str(raw.cpfCnpj) ||
      str(raw.documentoPagador) ||
      str(raw.cpf) ||
      str(raw.cnpj);
    const payerName =
      str(raw.nomePagador) ||
      str(raw.nome) ||
      str(raw.pagador) ||
      str(raw.nomeCliente);
    const pixTxid = str(raw.txid) || str(raw.txId) || str(raw.codigoPix);
    const endToEndId = str(raw.endToEndId) || str(raw.end_to_end_id);
    const externalId = pickExternalId(raw);
    const bookedAt = pickDate(raw);
    const status = pickStatus(raw);
    out.push({
      externalId,
      amount,
      currency: str(raw.moeda) || "BRL",
      description,
      bookedAt,
      direction,
      status,
      payerDocument,
      payerName,
      pixTxid,
      endToEndId,
      raw: raw as Record<string, unknown>,
    });
  }
  return out;
}

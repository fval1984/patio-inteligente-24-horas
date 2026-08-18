/**
 * Auditoria e plano de restauração de baixas financeiras.
 * Não altera dados. Não marca tudo como pago — só o que tem evidência de baixa.
 *
 * Corte: 18/08/2026 17:00 America/Sao_Paulo.
 */
"use strict";

const RESTORE_SETTLED_CUTOFF_ISO = "2026-08-18T20:00:00.000Z";
const RESTORE_SETTLED_CUTOFF_YMD = "2026-08-18";
const RESTORE_SETTLED_CONFIRM = "RESTORE_SETTLED_20260818_1700";
const RESTORE_SETTLED_MIGRATION_TYPE = "restore_settled_20260818_1700";
const FINANCE_META_PREFIX = "[[finmeta:";

function isCalendarYmd(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "").trim());
}

function toPeriodYmd(value) {
  if (!value) return "";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(
      2,
      "0"
    )}`;
  }
  const s = String(value).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(s.includes("T") ? s : `${s.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return toPeriodYmd(d);
}

function unpackFinanceMeta(raw) {
  const s = String(raw || "");
  if (!s.startsWith(FINANCE_META_PREFIX)) return { meta: {}, text: s };
  const end = s.indexOf("]]");
  if (end <= 0) return { meta: {}, text: s };
  try {
    return {
      meta: JSON.parse(s.slice(FINANCE_META_PREFIX.length, end)),
      text: s.slice(end + 2).trim(),
    };
  } catch {
    return { meta: {}, text: s };
  }
}

function statusOf(row) {
  return String(row?.status || "").trim().toUpperCase();
}

function isEntradaTipo(tipo) {
  const t = String(tipo || "").toUpperCase();
  return t === "RECEBER" || t === "ENTRADA";
}

function isSaidaTipo(tipo) {
  const t = String(tipo || "")
    .toUpperCase()
    .replace(/\s/g, "");
  return t === "PAGAR" || t === "SAIDA" || t === "SAÍDA";
}

function ymdOnOrBeforeCutoff(ymd) {
  const d = toPeriodYmd(ymd);
  return !!(d && d <= RESTORE_SETTLED_CUTOFF_YMD);
}

function isoOnOrBeforeCutoff(iso) {
  if (!iso) return false;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return ymdOnOrBeforeCutoff(iso);
  return t <= Date.parse(RESTORE_SETTLED_CUTOFF_ISO);
}

function cashEvidenceBeforeCutoff(mov) {
  if (!mov) return false;
  if (ymdOnOrBeforeCutoff(mov.data_movimento)) return true;
  if (isoOnOrBeforeCutoff(mov.created_at)) return true;
  return false;
}

function metaPaymentYmd(row) {
  const raw = row?.observacoes || row?.responsavel_pagamento || row?.descricao || "";
  const { meta } = unpackFinanceMeta(raw);
  return toPeriodYmd(meta.data_pagamento || meta.data_recebimento || meta.data_baixa || row?.data_pagamento || "");
}

function receivableCycleKey(r) {
  if (!r?.vehicle_id) return "";
  const end = toPeriodYmd(r.period_end);
  return end ? `${String(r.vehicle_id)}|${end}` : "";
}

function money(n) {
  return Math.max(0, Number(n || 0));
}

function pickBestCash(movs) {
  return [...(movs || [])].sort((a, b) => {
    const da = String(a.data_movimento || a.created_at || "");
    const db = String(b.data_movimento || b.created_at || "");
    return da.localeCompare(db);
  })[0] || null;
}

/**
 * @param {{ receivables?: any[], payables?: any[], cash?: any[], vehicles?: any[], partners?: any[] }} snapshot
 */
function planFinanceRestoreSettled(snapshot) {
  const receivables = Array.isArray(snapshot?.receivables) ? snapshot.receivables : [];
  const payables = Array.isArray(snapshot?.payables) ? snapshot.payables : [];
  const cash = Array.isArray(snapshot?.cash) ? snapshot.cash : [];
  const vehicles = Array.isArray(snapshot?.vehicles) ? snapshot.vehicles : [];
  const partners = Array.isArray(snapshot?.partners) ? snapshot.partners : [];

  const vmap = new Map(vehicles.map((v) => [String(v.id), v]));
  const pmap = new Map(partners.map((p) => [String(p.id), p]));

  const cashByConta = new Map();
  for (const m of cash) {
    if (!m?.conta_id) continue;
    const id = String(m.conta_id);
    if (!cashByConta.has(id)) cashByConta.set(id, []);
    cashByConta.get(id).push(m);
  }

  const paidCycleKeys = new Set();
  for (const r of receivables) {
    if (statusOf(r) !== "PAGO") continue;
    const k = receivableCycleKey(r);
    if (k) paidCycleKeys.add(k);
  }

  const restoreReceivables = [];
  const hideDuplicates = [];
  const unchangedReceivables = [];
  const restorePayables = [];
  const unchangedPayables = [];

  for (const r of receivables) {
    const st = statusOf(r);
    const v = r.vehicle_id ? vmap.get(String(r.vehicle_id)) : null;
    const financeira = v ? pmap.get(String(v.localizador_id || ""))?.nome || "" : "";
    const placa = v?.placa || "";
    const movs = (cashByConta.get(String(r.id)) || []).filter((m) => isEntradaTipo(m.tipo_conta) && money(m.valor) > 0);
    const cashMov = pickBestCash(movs.filter(cashEvidenceBeforeCutoff)) || pickBestCash(movs);
    const metaYmd = metaPaymentYmd(r);
    const cycleKey = receivableCycleKey(r);
    const base = {
      id: r.id,
      kind: "receber",
      placa,
      financeira,
      vehicleId: r.vehicle_id || "",
      valor: money(r.valor),
      statusAtual: st || "—",
      periodEnd: toPeriodYmd(r.period_end),
    };

    if (st === "PAGO") {
      unchangedReceivables.push({ ...base, statusCorreto: "PAGO", acao: "none", motivo: "Já está recebido." });
      continue;
    }
    if (st === "CANCELADO") {
      unchangedReceivables.push({ ...base, statusCorreto: "CANCELADO", acao: "none", motivo: "Cancelado — não mexer." });
      continue;
    }

    const cashBefore = movs.some(cashEvidenceBeforeCutoff);
    const metaBefore = ymdOnOrBeforeCutoff(metaYmd);
    if (cashBefore || (cashMov && metaBefore) || (cashMov && ymdOnOrBeforeCutoff(cashMov.data_movimento))) {
      const paidAt = toPeriodYmd(cashMov?.data_movimento || metaYmd || cashMov?.created_at);
      restoreReceivables.push({
        ...base,
        statusCorreto: "PAGO",
        acao: "restore_pago",
        dataBaixa: paidAt,
        formaPagamento: cashMov?.forma_pagamento || unpackFinanceMeta(r.observacoes || r.responsavel_pagamento).meta.forma_pagamento || "",
        cashId: cashMov?.id || "",
        motivo: "Há baixa no caixa (entrada) vinculada a este título.",
        evidencia: cashBefore ? "cash_movements.data_movimento/created_at até 18/08/2026 17:00" : "cash_movements vinculado + data de pagamento",
      });
      continue;
    }

    if (!cashMov && metaBefore) {
      restoreReceivables.push({
        ...base,
        statusCorreto: "PAGO",
        acao: "restore_pago",
        dataBaixa: metaYmd,
        formaPagamento: unpackFinanceMeta(r.observacoes || r.responsavel_pagamento).meta.forma_pagamento || "",
        cashId: "",
        motivo: "Histórico do título (finmeta data_pagamento/recebimento) anterior ao corte.",
        evidencia: `finmeta ${metaYmd}`,
      });
      continue;
    }

    if (cycleKey && paidCycleKeys.has(cycleKey) && !cashMov) {
      hideDuplicates.push({
        ...base,
        statusCorreto: "duplicata (ciclo já recebido)",
        acao: "hide_duplicate",
        dataBaixa: "",
        motivo: "Mesmo veículo e mesma saída de um título já PAGO. Não criar nova baixa.",
        evidencia: `ciclo ${cycleKey}`,
      });
      continue;
    }

    unchangedReceivables.push({
      ...base,
      statusCorreto: st || "EM_ABERTO",
      acao: "none",
      motivo: "Sem evidência de baixa anterior ao corte — permanece em aberto.",
    });
  }

  for (const p of payables) {
    const st = statusOf(p);
    const fieldsNome = unpackFinanceMeta(p.observacoes || p.descricao || "").text || p.descricao || p.fornecedor || "";
    const movs = (cashByConta.get(String(p.id)) || []).filter((m) => isSaidaTipo(m.tipo_conta) && money(m.valor) > 0);
    const cashMov = pickBestCash(movs.filter(cashEvidenceBeforeCutoff)) || pickBestCash(movs);
    const metaYmd = metaPaymentYmd(p);
    const base = {
      id: p.id,
      kind: "pagar",
      placa: "",
      financeira: p.fornecedor || fieldsNome || "",
      vehicleId: "",
      valor: money(p.valor),
      statusAtual: st || "—",
    };

    if (st === "PAGO") {
      unchangedPayables.push({ ...base, statusCorreto: "PAGO", acao: "none", motivo: "Já está pago." });
      continue;
    }
    if (st === "CANCELADO") {
      unchangedPayables.push({ ...base, statusCorreto: "CANCELADO", acao: "none", motivo: "Cancelado — não mexer." });
      continue;
    }

    const cashBefore = movs.some(cashEvidenceBeforeCutoff);
    const metaBefore = ymdOnOrBeforeCutoff(metaYmd);
    if (cashBefore || (cashMov && metaBefore) || (cashMov && ymdOnOrBeforeCutoff(cashMov.data_movimento))) {
      restorePayables.push({
        ...base,
        statusCorreto: "PAGO",
        acao: "restore_pago",
        dataBaixa: toPeriodYmd(cashMov?.data_movimento || metaYmd || p.data_pagamento || cashMov?.created_at),
        formaPagamento: cashMov?.forma_pagamento || unpackFinanceMeta(p.observacoes).meta.forma_pagamento || "",
        cashId: cashMov?.id || "",
        motivo: "Há baixa no caixa (saída) vinculada a esta despesa.",
        evidencia: cashBefore ? "cash_movements até 18/08/2026 17:00" : "cash_movements vinculado",
      });
      continue;
    }

    if (!cashMov && (metaBefore || ymdOnOrBeforeCutoff(p.data_pagamento))) {
      restorePayables.push({
        ...base,
        statusCorreto: "PAGO",
        acao: "restore_pago",
        dataBaixa: metaYmd || toPeriodYmd(p.data_pagamento),
        formaPagamento: unpackFinanceMeta(p.observacoes).meta.forma_pagamento || "",
        cashId: "",
        motivo: "Histórico da despesa com data de pagamento anterior ao corte.",
        evidencia: `data_pagamento/finmeta ${metaYmd || p.data_pagamento}`,
      });
      continue;
    }

    unchangedPayables.push({
      ...base,
      statusCorreto: st || "EM_ABERTO",
      acao: "none",
      motivo: "Sem evidência de pagamento anterior ao corte — permanece em aberto.",
    });
  }

  const auditRows = [...restoreReceivables, ...hideDuplicates, ...restorePayables];
  return {
    cutoffIso: RESTORE_SETTLED_CUTOFF_ISO,
    cutoffLabel: "18/08/2026 17:00 (America/Sao_Paulo)",
    confirm: RESTORE_SETTLED_CONFIRM,
    migrationType: RESTORE_SETTLED_MIGRATION_TYPE,
    needsRestore: auditRows.length > 0,
    counts: {
      recebimentosRestaurar: restoreReceivables.length,
      pagamentosRestaurar: restorePayables.length,
      duplicatasOcultar: hideDuplicates.length,
      baixasPreservadas: restoreReceivables.length + restorePayables.length,
      recebiveisInalterados: unchangedReceivables.length,
      pagaveisInalterados: unchangedPayables.length,
      inalterados: unchangedReceivables.length + unchangedPayables.length,
    },
    restoreReceivables,
    hideDuplicates,
    restorePayables,
    unchangedReceivables,
    unchangedPayables,
    auditRows,
  };
}

const api = {
  RESTORE_SETTLED_CUTOFF_ISO,
  RESTORE_SETTLED_CUTOFF_YMD,
  RESTORE_SETTLED_CONFIRM,
  RESTORE_SETTLED_MIGRATION_TYPE,
  toPeriodYmd,
  planFinanceRestoreSettled,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = api;
  module.exports.default = api;
}
if (typeof globalThis !== "undefined") {
  globalThis.financeRestoreSettledPlan = api;
}
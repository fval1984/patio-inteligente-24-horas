/**
 * FinancialMetricsService — regras de cálculo do Dashboard Financeiro.
 * Reutiliza a mesma semântica do módulo financeiro existente (aberto / faturado / due).
 * Sem I/O. Sem alteração de regras de negócio do backend.
 */

import {
  DEFAULT_FINANCIAL_FILTERS,
  type FinancialAlerts,
  type FinancialCashMovement,
  type FinancialDataSnapshot,
  type FinancialFilters,
  type FinancialMetricsResult,
  type FinancialPartner,
  type FinancialReceivable,
  type FinancialVehicle,
  type TrendValue,
  type Ymd,
} from "./types";

type VMap = Map<string, FinancialVehicle>;
type PMap = Map<string, FinancialPartner>;

function isCalendarYmd(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export function toLocalYmd(value: string | Date | null | undefined): Ymd | null {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  const s = String(value).trim();
  if (isCalendarYmd(s)) return s;
  const d = new Date(s.includes("T") ? s : `${s.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return toLocalYmd(d);
}

/** Data de competência do ciclo (YYYY-MM-DD gravado), sem converter UTC para o dia anterior. */
export function toPeriodYmd(value: string | Date | null | undefined): Ymd | null {
  if (!value) return null;
  if (value instanceof Date) return toLocalYmd(value);
  const s = String(value).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  return toLocalYmd(s);
}

function receivableCycleKey(r: FinancialReceivable): string {
  if (!r?.vehicle_id) return "";
  const end = toPeriodYmd(r.period_end);
  return end ? `${String(r.vehicle_id)}|${end}` : "";
}

export function paidReceivableCycleKeySet(receivables: FinancialReceivable[] | null | undefined): Set<string> {
  const keys = new Set<string>();
  for (const r of receivables || []) {
    if (String(r.status || "").toUpperCase() !== "PAGO") continue;
    const k = receivableCycleKey(r);
    if (k) keys.add(k);
  }
  return keys;
}

/** Título em aberto do mesmo veículo + saída que já foi pago — não deve voltar à fila. */
export function isDuplicateOfPaidReceivableCycle(
  r: FinancialReceivable,
  paidKeys: Set<string>
): boolean {
  if (!r || String(r.status || "").toUpperCase() === "PAGO") return false;
  const k = receivableCycleKey(r);
  return !!(k && paidKeys.has(k));
}

export function todayYmd(now: Date = new Date()): Ymd {
  return toLocalYmd(now) as Ymd;
}

function ymdToDate(ymd: Ymd): Date {
  return new Date(`${ymd}T12:00:00`);
}

function addDaysYmd(ymd: Ymd, days: number): Ymd {
  const d = ymdToDate(ymd);
  d.setDate(d.getDate() + days);
  return toLocalYmd(d) as Ymd;
}

function yearMonthFromYmd(ymd: Ymd): string {
  return ymd.slice(0, 7);
}

function monthStartYm(ym: string): Ymd {
  return `${ym}-01`;
}

function monthEndYm(ym: string): Ymd {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

function resolvePeriodRange(period: FinancialFilters["period"], asOf: Ymd) {
  const curYm = yearMonthFromYmd(asOf);
  switch (period) {
    case "today":
      return { from: asOf, to: asOf, label: "Hoje" };
    case "7d":
      return { from: addDaysYmd(asOf, -6), to: asOf, label: "Últimos 7 dias" };
    case "30d":
      return { from: addDaysYmd(asOf, -29), to: asOf, label: "Últimos 30 dias" };
    case "month":
      return { from: monthStartYm(curYm), to: asOf, label: "Mês atual" };
    case "year":
      return { from: `${asOf.slice(0, 4)}-01-01`, to: asOf, label: "Ano atual" };
    default:
      return { from: monthStartYm(curYm), to: asOf, label: "Mês atual" };
  }
}

function pctChange(current: number, previous: number): number {
  if (!previous || previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function trend(current: number, previous: number): TrendValue {
  const pct = pctChange(current, previous);
  return { pct, label: `${pct >= 0 ? "+" : ""}${pct.toFixed(2).replace(".", ",")}%` };
}

function receivableValor(r: FinancialReceivable): number {
  return Math.max(0, Number(r?.valor || 0));
}

/** Mesma regra do finance-dashboard.js — título faturado/recebido. */
function isReceivableFaturado(r: FinancialReceivable): boolean {
  if (!r || receivableValor(r) <= 0) return false;
  const st = String(r.status || "").toUpperCase();
  if (st === "PAGO") return true;
  if (r.financeiro_aprovado_contas_receber === true) return true;
  if (!r.vehicle_id && st === "EM_ABERTO") return true;
  return false;
}

/** Mesma regra do finance-dashboard.js — conta a receber aberta. */
function isContaReceberAberta(r: FinancialReceivable): boolean {
  if (!r || String(r.status || "").toUpperCase() === "PAGO") return false;
  if (String(r.status || "").toUpperCase() === "CANCELADO") return false;
  if (receivableValor(r) <= 0) return false;
  if (r.financeiro_aprovado_contas_receber === true) return true;
  if (!r.vehicle_id && String(r.status || "").toUpperCase() === "EM_ABERTO") return true;
  return false;
}

function receivableDueYmd(r: FinancialReceivable): Ymd | null {
  return toLocalYmd(r?.data_vencimento || r?.period_end || r?.created_at);
}

function receivableFaturamentoYmd(r: FinancialReceivable, vmap: VMap): Ymd | null {
  const v = r.vehicle_id ? vmap.get(String(r.vehicle_id)) : undefined;
  return toLocalYmd(v?.data_saida || r.period_end || r.data_vencimento || r.created_at);
}

function buildCashByContaId(cash: FinancialCashMovement[]): Map<string, FinancialCashMovement> {
  const map = new Map<string, FinancialCashMovement>();
  for (const m of cash || []) {
    const t = String(m?.tipo_conta || "").toUpperCase();
    if ((t === "RECEBER" || t === "ENTRADA") && m?.conta_id != null) {
      map.set(String(m.conta_id), m);
    }
  }
  return map;
}

function recebimentoYmd(r: FinancialReceivable, cashByContaId: Map<string, FinancialCashMovement>): Ymd | null {
  if (!r || String(r.status || "").toUpperCase() !== "PAGO") return null;
  const mov = cashByContaId.get(String(r.id));
  if (mov) {
    const ymd = toLocalYmd(mov.data_movimento || mov.created_at);
    if (ymd) return ymd;
  }
  const raw = String(r.observacoes || "");
  if (raw.startsWith("[[finmeta:")) {
    const end = raw.indexOf("]]");
    if (end > 0) {
      try {
        const meta = JSON.parse(raw.slice(10, end)) as { data_pagamento?: string; data_recebimento?: string; data_baixa?: string };
        const fromMeta = toLocalYmd(meta.data_pagamento || meta.data_recebimento || meta.data_baixa || "");
        if (fromMeta) return fromMeta;
      } catch {
        /* ignore */
      }
    }
  }
  return toLocalYmd(r.period_end || r.updated_at || r.created_at);
}

function cashMovValor(m: FinancialCashMovement): number {
  return Math.max(0, Number(m?.valor || 0));
}

function cashIsEntrada(m: FinancialCashMovement): boolean {
  const t = String(m?.tipo_conta || "").toUpperCase();
  return t === "RECEBER" || t === "ENTRADA";
}

function cashIsSaida(m: FinancialCashMovement): boolean {
  const t = String(m?.tipo_conta || "").toUpperCase().replace(/\s/g, "");
  return t === "PAGAR" || t === "SAIDA" || t === "SAÍDA";
}

function caixaCompetenciaYmd(m: FinancialCashMovement): Ymd | null {
  return toLocalYmd(m?.data_movimento || m?.created_at);
}

function rppPartnerId(v: FinancialVehicle | undefined): string {
  if (!v) return "";
  return String(v.responsavel_financeiro_id || v.localizador_id || "").trim();
}

function financeiraIdOf(v: FinancialVehicle | undefined): string {
  return String(v?.localizador_id || "").trim();
}

function partnerName(id: string, pmap: PMap, fallback?: string | null): string {
  if (!id) return fallback || "—";
  return pmap.get(id)?.nome || fallback || "—";
}

function daysBetween(from: Ymd, to: Ymd): number {
  return Math.max(0, Math.floor((ymdToDate(to).getTime() - ymdToDate(from).getTime()) / 86400000));
}

function matchesSearch(
  r: FinancialReceivable,
  v: FinancialVehicle | undefined,
  pmap: PMap,
  search: string
): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  const qNorm = q.replace(/[^a-z0-9]/g, "");
  const finId = financeiraIdOf(v);
  const rpp = rppPartnerId(v);
  const blob = [
    v?.placa,
    v?.marca,
    v?.modelo,
    partnerName(finId, pmap),
    partnerName(rpp, pmap, v?.responsavel_financeiro_nome),
    r.observacoes,
    String(r.valor || ""),
  ]
    .join(" ")
    .toLowerCase();
  const norm = blob.replace(/[^a-z0-9]/g, "");
  return blob.includes(q) || (!!qNorm && norm.includes(qNorm));
}

function matchesStatus(r: FinancialReceivable, asOf: Ymd, status: FinancialFilters["status"]): boolean {
  if (!status) return true;
  const st = String(r.status || "").toUpperCase();
  if (status === "pago") return st === "PAGO";
  if (st === "PAGO") return false;
  const due = receivableDueYmd(r);
  const atrasado = !!(due && due < asOf);
  if (status === "atrasado") return atrasado;
  if (status === "pendente") return !atrasado;
  return true;
}

function filterReceivables(
  snapshot: FinancialDataSnapshot,
  filters: FinancialFilters,
  asOf: Ymd
): FinancialReceivable[] {
  const vmap = new Map((snapshot.vehicles || []).map((v) => [String(v.id), v]));
  const pmap = new Map((snapshot.partners || []).map((p) => [String(p.id), p]));
  const finId = String(filters.financeiraId || "").trim();
  const parcId = String(filters.parceiroId || "").trim();

  return (snapshot.receivables || []).filter((r) => {
    const v = r.vehicle_id ? vmap.get(String(r.vehicle_id)) : undefined;
    if (finId && financeiraIdOf(v) !== finId) return false;
    if (parcId && rppPartnerId(v) !== parcId) return false;
    if (!matchesStatus(r, asOf, filters.status)) return false;
    if (!matchesSearch(r, v, pmap, filters.search || "")) return false;
    return true;
  });
}

export class FinancialMetricsService {
  compute(snapshot: FinancialDataSnapshot, filtersInput: Partial<FinancialFilters> = {}): FinancialMetricsResult {
    const filters: FinancialFilters = { ...DEFAULT_FINANCIAL_FILTERS, ...filtersInput };
    const asOf = snapshot.asOfYmd || todayYmd();
    const range = resolvePeriodRange(filters.period, asOf);
    const vmap: VMap = new Map((snapshot.vehicles || []).map((v) => [String(v.id), v]));
    const pmap: PMap = new Map((snapshot.partners || []).map((p) => [String(p.id), p]));
    const cashByConta = buildCashByContaId(snapshot.cash || []);
    const receivables = filterReceivables(snapshot, filters, asOf);
    const paidCycleKeys = paidReceivableCycleKeySet(snapshot.receivables);

    const abertas = receivables.filter(
      (r) => isContaReceberAberta(r) && !isDuplicateOfPaidReceivableCycle(r, paidCycleKeys)
    );
    const totalAberto = abertas.reduce((s, r) => s + receivableValor(r), 0);

    const curYm = yearMonthFromYmd(asOf);
    const monthStart = monthStartYm(curYm);
    const prevYm = yearMonthFromYmd(addDaysYmd(monthStart, -1));
    const prevStart = monthStartYm(prevYm);
    const prevEnd = monthEndYm(prevYm);

    // Recebimentos no mês (PAGO com data de recebimento no mês)
    let recebidoMes = 0;
    let pagamentosMes = 0;
    let recebidoMesAnt = 0;
    const seenPaidCycle = new Set<string>();
    for (const r of receivables) {
      if (String(r.status || "").toUpperCase() === "PAGO") {
        const k = receivableCycleKey(r);
        if (k) {
          if (seenPaidCycle.has(k)) continue;
          seenPaidCycle.add(k);
        }
      }
      const rec = recebimentoYmd(r, cashByConta);
      if (!rec) continue;
      const val = receivableValor(r);
      if (rec >= monthStart && rec <= asOf) {
        recebidoMes += val;
        pagamentosMes += 1;
      }
      if (rec >= prevStart && rec <= prevEnd) {
        recebidoMesAnt += val;
      }
    }

    // Receita acumulada do período (faturamento / competência)
    let receitaPeriodo = 0;
    let receitaPrevPeriodo = 0;
    const periodDays =
      Math.round((ymdToDate(range.to).getTime() - ymdToDate(range.from).getTime()) / 86400000) + 1;
    const prevTo = addDaysYmd(range.from, -1);
    const prevFrom = addDaysYmd(prevTo, -(periodDays - 1));
    for (const r of receivables) {
      if (!isReceivableFaturado(r)) continue;
      const fat = receivableFaturamentoYmd(r, vmap);
      if (!fat) continue;
      const val = receivableValor(r);
      if (fat >= range.from && fat <= range.to) receitaPeriodo += val;
      if (fat >= prevFrom && fat <= prevTo) receitaPrevPeriodo += val;
    }

    // Inadimplência
    const vencidos = abertas.filter((r) => {
      const due = receivableDueYmd(r);
      return !!(due && due < asOf);
    });
    const totalVencido = vencidos.reduce((s, r) => s + receivableValor(r), 0);
    const inadPct = totalAberto > 0 ? (totalVencido / totalAberto) * 100 : 0;

    // Ticket médio = receita faturada no período ÷ qtd faturamentos
    let faturamentosPeriodo = 0;
    for (const r of receivables) {
      if (!isReceivableFaturado(r)) continue;
      const fat = receivableFaturamentoYmd(r, vmap);
      if (fat && fat >= range.from && fat <= range.to) faturamentosPeriodo += 1;
    }
    const ticketMedio = faturamentosPeriodo > 0 ? receitaPeriodo / faturamentosPeriodo : 0;

    // Previsão = títulos abertos com vencimento futuro
    const previsao = abertas
      .filter((r) => {
        const due = receivableDueYmd(r);
        return !!(due && due > asOf);
      })
      .reduce((s, r) => s + receivableValor(r), 0);

    // Contas a receber — tendência vs período anterior (estoque aberto aproximado pelo valor do período anterior de vencidos/abertos)
    const trendReceber = trend(totalAberto, receitaPrevPeriodo || totalAberto * 0.9);

    // Receita mensal 12 meses
    const labels12: string[] = [];
    const values12: number[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = ymdToDate(asOf);
      d.setMonth(d.getMonth() - i);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      labels12.push(ym.slice(5) + "/" + ym.slice(2, 4));
      const mStart = monthStartYm(ym);
      const mEnd = monthEndYm(ym);
      let sum = 0;
      for (const r of receivables) {
        if (!isReceivableFaturado(r)) continue;
        const fat = receivableFaturamentoYmd(r, vmap);
        if (fat && fat >= mStart && fat <= mEnd) sum += receivableValor(r);
      }
      values12.push(sum);
    }

    // Fluxo financeiro 12 meses
    const fluxoLabels: string[] = [];
    const fluxoEntradas: number[] = [];
    const fluxoReceb: number[] = [];
    const fluxoSaldo: number[] = [];
    let saldoAcc = 0;
    for (let i = 11; i >= 0; i--) {
      const d = ymdToDate(asOf);
      d.setMonth(d.getMonth() - i);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      fluxoLabels.push(ym.slice(5) + "/" + ym.slice(2, 4));
      const mStart = monthStartYm(ym);
      const mEnd = monthEndYm(ym);
      let ent = 0;
      let sai = 0;
      for (const m of snapshot.cash || []) {
        const ymd = caixaCompetenciaYmd(m);
        if (!ymd || ymd < mStart || ymd > mEnd) continue;
        const val = cashMovValor(m);
        if (cashIsEntrada(m)) ent += val;
        else if (cashIsSaida(m)) sai += val;
      }
      let receb = 0;
      for (const r of receivables) {
        const rec = recebimentoYmd(r, cashByConta);
        if (rec && rec >= mStart && rec <= mEnd) receb += receivableValor(r);
      }
      saldoAcc += ent - sai;
      fluxoEntradas.push(ent);
      fluxoReceb.push(receb);
      fluxoSaldo.push(saldoAcc);
    }

    // Receita por financeira (top 10) — faturamento no período
    const byFin = new Map<string, { nome: string; valor: number }>();
    for (const r of receivables) {
      if (!isReceivableFaturado(r)) continue;
      const fat = receivableFaturamentoYmd(r, vmap);
      if (!fat || fat < range.from || fat > range.to) continue;
      const v = r.vehicle_id ? vmap.get(String(r.vehicle_id)) : undefined;
      const id = financeiraIdOf(v) || "__sem__";
      const nome = id === "__sem__" ? "Sem financeira" : partnerName(id, pmap);
      const cur = byFin.get(id) || { nome, valor: 0 };
      cur.valor += receivableValor(r);
      byFin.set(id, cur);
    }
    const totalFin = Array.from(byFin.values()).reduce((s, x) => s + x.valor, 0) || 1;
    const receitaPorFinanceira = Array.from(byFin.entries())
      .map(([id, x]) => ({ id, nome: x.nome, valor: x.valor, pct: (x.valor / totalFin) * 100 }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 10);

    // Maiores contas a receber
    const openByFin = new Map<string, { financeira: string; veiculos: Set<string>; valor: number; dias: number[] }>();
    for (const r of abertas) {
      const v = r.vehicle_id ? vmap.get(String(r.vehicle_id)) : undefined;
      const id = financeiraIdOf(v) || "__sem__";
      const nome = id === "__sem__" ? "Sem financeira" : partnerName(id, pmap);
      const cur = openByFin.get(id) || { financeira: nome, veiculos: new Set(), valor: 0, dias: [] };
      if (r.vehicle_id) cur.veiculos.add(String(r.vehicle_id));
      cur.valor += receivableValor(r);
      const due = receivableDueYmd(r);
      const ref = toLocalYmd(r.created_at || r.period_start) || due;
      if (ref) cur.dias.push(daysBetween(ref, asOf));
      openByFin.set(id, cur);
    }
    const maioresContas = Array.from(openByFin.values())
      .map((x) => ({
        financeira: x.financeira,
        veiculos: x.veiculos.size,
        valor: x.valor,
        diasMedios: x.dias.length ? x.dias.reduce((a, b) => a + b, 0) / x.dias.length : 0,
      }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 10);

    // Últimos recebimentos
    const ultimosRecebimentos = receivables
      .map((r) => {
        const rec = recebimentoYmd(r, cashByConta);
        if (!rec) return null;
        const v = r.vehicle_id ? vmap.get(String(r.vehicle_id)) : undefined;
        const fin = partnerName(financeiraIdOf(v), pmap);
        return {
          data: rec,
          financeira: fin,
          descricao: v?.placa ? `Recebimento ${v.placa}` : r.observacoes || "Recebimento",
          valor: receivableValor(r),
          situacao: "Recebido",
        };
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .sort((a, b) => b.data.localeCompare(a.data))
      .slice(0, 15);

    // Indicadores
    const weekFrom = addDaysYmd(asOf, -6);
    const yearFrom = `${asOf.slice(0, 4)}-01-01`;
    let receitaHoje = 0;
    let receitaSemana = 0;
    let receitaMes = 0;
    let receitaAno = 0;
    const monthMap = new Map<string, number>();
    for (const r of receivables) {
      if (!isReceivableFaturado(r)) continue;
      const fat = receivableFaturamentoYmd(r, vmap);
      if (!fat) continue;
      const val = receivableValor(r);
      if (fat === asOf) receitaHoje += val;
      if (fat >= weekFrom && fat <= asOf) receitaSemana += val;
      if (fat >= monthStart && fat <= asOf) receitaMes += val;
      if (fat >= yearFrom && fat <= asOf) receitaAno += val;
      const ym = yearMonthFromYmd(fat);
      monthMap.set(ym, (monthMap.get(ym) || 0) + val);
    }
    // média diária = receita 30d / 30; média mensal = média dos meses do ano
    let receita30 = 0;
    for (const r of receivables) {
      if (!isReceivableFaturado(r)) continue;
      const fat = receivableFaturamentoYmd(r, vmap);
      if (fat && fat >= addDaysYmd(asOf, -29) && fat <= asOf) receita30 += receivableValor(r);
    }
    const receitaMediaDiaria = receita30 / 30;
    const monthTotals = Array.from(monthMap.values());
    const receitaMediaMensal = monthTotals.length
      ? monthTotals.reduce((a, b) => a + b, 0) / monthTotals.length
      : 0;

    // Alertas
    const vencendoHojeList = abertas.filter((r) => receivableDueYmd(r) === asOf);
    const in7 = addDaysYmd(asOf, 7);
    const vencendo7 = abertas.filter((r) => {
      const due = receivableDueYmd(r);
      return !!(due && due > asOf && due <= in7);
    });
    const dividaByFin = new Map<string, { nome: string; valor: number }>();
    for (const r of vencidos) {
      const v = r.vehicle_id ? vmap.get(String(r.vehicle_id)) : undefined;
      const id = financeiraIdOf(v) || "__sem__";
      const nome = id === "__sem__" ? "Sem financeira" : partnerName(id, pmap);
      const cur = dividaByFin.get(id) || { nome, valor: 0 };
      cur.valor += receivableValor(r);
      dividaByFin.set(id, cur);
    }
    const alerts: FinancialAlerts = {
      titulosVencidos: { count: vencidos.length, valor: totalVencido },
      recebimentosAtrasados: { count: vencidos.length, valor: totalVencido },
      financeirasMaiorDivida: Array.from(dividaByFin.values())
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 5),
      vencendoHoje: {
        count: vencendoHojeList.length,
        valor: vencendoHojeList.reduce((s, r) => s + receivableValor(r), 0),
      },
      vencendo7Dias: {
        count: vencendo7.length,
        valor: vencendo7.reduce((s, r) => s + receivableValor(r), 0),
      },
    };

    return {
      filters,
      range,
      asOfYmd: asOf,
      kpis: {
        contasAReceber: {
          valor: totalAberto,
          titulos: abertas.length,
          trend: trendReceber,
        },
        recebimentosMes: {
          valor: recebidoMes,
          pagamentos: pagamentosMes,
          trend: trend(recebidoMes, recebidoMesAnt),
        },
        receitaAcumulada: {
          valor: receitaPeriodo,
          trend: trend(receitaPeriodo, receitaPrevPeriodo),
        },
        inadimplencia: {
          valor: totalVencido,
          titulos: vencidos.length,
          pctSobreReceber: inadPct,
        },
        ticketMedio,
        previsaoRecebimento: previsao,
      },
      receitaMensal12: { labels: labels12, values: values12 },
      fluxo: {
        labels: fluxoLabels,
        entradas: fluxoEntradas,
        recebimentos: fluxoReceb,
        saldo: fluxoSaldo,
      },
      receitaPorFinanceira,
      maioresContas,
      ultimosRecebimentos,
      indicadores: {
        receitaHoje,
        receitaSemana,
        receitaMes,
        receitaAno,
        receitaMediaDiaria,
        receitaMediaMensal,
      },
      alerts,
    };
  }
}

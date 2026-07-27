/**
 * DashboardMetrics — regras puras de cálculo dos indicadores.
 * Uma regra por indicador. Sem I/O. Sem SQL.
 */

import {
  DEFAULT_PATIO_CAPACITY,
  type DashboardDataSnapshot,
  type DashboardFilters,
  type DashboardMetricsResult,
  type DashboardReceivable,
  type DashboardVehicle,
  type DateRange,
  type OperationalGroup,
  type OperationalStatusCounts,
  type Ymd,
} from "./types";
import { auditOperationalConsistency } from "./audit";

function isCalendarYmd(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export function toLocalYmd(value: string | Date | null | undefined): Ymd | null {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(value).trim();
  if (isCalendarYmd(s)) return s;
  const d = new Date(s.includes("T") ? s : `${s.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return toLocalYmd(d);
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

export function resolvePeriodRange(period: DashboardFilters["period"], asOf: Ymd): DateRange {
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
      return { from: addDaysYmd(asOf, -29), to: asOf, label: "Últimos 30 dias" };
  }
}

function statusUpper(v: DashboardVehicle): string {
  return String(v.status || "").toUpperCase();
}

/** CARD 1 — no pátio = status atual diferente de REMOVIDO (presença física atual). */
export function isVehicleOnPatio(v: DashboardVehicle): boolean {
  return statusUpper(v) !== "REMOVIDO";
}

function isVlpStatus(status: string | null | undefined): boolean {
  const s = String(status || "");
  const u = s.toUpperCase();
  return (
    s === "LIBERACAO_SOLICITADA" ||
    s === "LIBERACAO_CONFIRMADA" ||
    s === "REMocao_CONFIRMADA" ||
    u === "REMOCAO_CONFIRMADA"
  );
}

function isLiberadoAguardandoRetirada(v: DashboardVehicle): boolean {
  const s = String(v.status || "");
  const u = s.toUpperCase();
  return s === "LIBERACAO_CONFIRMADA" || s === "REMocao_CONFIRMADA" || u === "REMOCAO_CONFIRMADA";
}

function isRemocaoSolicitada(v: DashboardVehicle): boolean {
  const flag = v.remocao_solicitada;
  return (
    flag === true ||
    flag === 1 ||
    flag === "1" ||
    flag === "t" ||
    flag === "true" ||
    flag === "TRUE"
  );
}

function hasVistoria(v: DashboardVehicle): boolean {
  const c = v.vistoria_checklist || {};
  return !!(
    v.vistoria_data ||
    v.vistoria_responsavel ||
    v.vistoria_km ||
    v.vistoria_combustivel ||
    v.vistoria_observacoes ||
    c.documento ||
    c.chave ||
    c.estepe ||
    c.triangulo_macaco
  );
}

function hasPendenciaDocumental(v: DashboardVehicle): boolean {
  if (String(v.nfse_status || "").toUpperCase() === "PENDENTE") return true;
  if (isRemocaoSolicitada(v)) return true;
  return false;
}

/**
 * Situação Operacional — cada veículo no pátio entra em exatamente um grupo.
 * Prioridade (primeiro match vence):
 * 1. Liberados aguardando retirada
 * 2. Aguardando autorização
 * 3. Pendências documentais
 * 4. Aguardando vistoria
 * 5. Aguardando conferência (restante)
 */
export function classifyOperationalGroup(v: DashboardVehicle): OperationalGroup | null {
  if (!isVehicleOnPatio(v)) return null;
  if (isLiberadoAguardandoRetirada(v)) return "liberados_aguardando_retirada";
  if (String(v.status || "") === "LIBERACAO_SOLICITADA") return "aguardando_autorizacao";
  if (hasPendenciaDocumental(v)) return "pendencias_documentais";
  if (!hasVistoria(v)) return "aguardando_vistoria";
  return "aguardando_conferencia";
}

function financeiraFilterId(filters: DashboardFilters): string {
  return String(filters.financeiraId || filters.parceiroId || "").trim();
}

/**
 * Universo filtrado compartilhado por TODOS os indicadores.
 * Status/busca/financeira aplicam-se aqui uma única vez.
 */
export function filterVehicles(
  vehicles: DashboardVehicle[],
  partners: { id: string; nome?: string | null }[],
  filters: DashboardFilters
): DashboardVehicle[] {
  const finId = financeiraFilterId(filters);
  const pmap = new Map(partners.map((p) => [String(p.id), p]));
  const q = String(filters.search || "")
    .trim()
    .toLowerCase();
  const qNorm = q.replace(/[^a-z0-9]/g, "");

  return vehicles.filter((v) => {
    if (finId && String(v.localizador_id || "") !== finId) return false;

    if (filters.status === "no_patio" && !isVehicleOnPatio(v)) return false;
    if (filters.status === "vlp" && !isVlpStatus(v.status)) return false;
    if (filters.status === "removido" && statusUpper(v) !== "REMOVIDO") return false;

    if (q) {
      const plate = String(v.placa || "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      const partner = pmap.get(String(v.localizador_id || ""));
      const pName = String(partner?.nome || "").toLowerCase();
      const hay = `${plate} ${pName}`;
      const normHay = hay.replace(/[^a-z0-9]/g, "");
      if (!hay.includes(q) && !(qNorm && normHay.includes(qNorm))) return false;
    }
    return true;
  });
}

/** CARD 5 — mesma regra do Financeiro «Contas a receber» (não basta EM_ABERTO). */
export function isOpenReceivable(r: DashboardReceivable): boolean {
  if (!r) return false;
  const st = String(r.status || "").toUpperCase();
  if (st === "PAGO" || st === "CANCELADO" || st === "CANCELADA") return false;
  if (!(Number(r.valor || 0) > 0)) return false;

  // Aprovado na triagem (coluna ou meta em observações) — entra em Contas a receber.
  if (r.financeiro_aprovado_contas_receber === true) return true;
  if (receivableMetaAprovado(r)) return true;

  // Lançamento manual (sem veículo): EM_ABERTO conta como Contas a receber.
  if (!r.vehicle_id && st === "EM_ABERTO") return true;

  return false;
}

/** Lê flag de aprovação embutida em observações ([[finmeta:...]]). */
function receivableMetaAprovado(r: DashboardReceivable): boolean {
  const raw = String(r.observacoes || r.responsavel_pagamento || "");
  if (!raw.includes("financeiro_aprovado_contas_receber")) return false;
  try {
    const prefix = "[[finmeta:";
    const i = raw.indexOf(prefix);
    if (i < 0) return false;
    const end = raw.indexOf("]]", i);
    if (end < 0) return false;
    const json = raw.slice(i + prefix.length, end);
    const meta = JSON.parse(json);
    return meta?.financeiro_aprovado_contas_receber === true;
  } catch {
    return /"financeiro_aprovado_contas_receber"\s*:\s*true/.test(raw);
  }
}

function resolveCapacity(settings: DashboardDataSnapshot["settings"]): number {
  const n = Number(settings?.capacidade_patio);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_PATIO_CAPACITY;
}

function vehicleStayDays(v: DashboardVehicle, endYmd: Ymd): number {
  const ent = toLocalYmd(v.data_entrada);
  if (!ent) return 0;
  const end = v.data_saida ? toLocalYmd(v.data_saida) : endYmd;
  if (!end || end < ent) return 0;
  return Math.max(1, Math.ceil((ymdToDate(end).getTime() - ymdToDate(ent).getTime()) / 86400000));
}

function partnerName(
  v: DashboardVehicle,
  pmap: Map<string, { id: string; nome?: string | null }>
): string {
  const id = String(v.localizador_id || "").trim();
  if (!id) return "—";
  return pmap.get(id)?.nome || v.responsavel_financeiro_nome || "—";
}

export class DashboardMetrics {
  compute(snapshot: DashboardDataSnapshot, filters: DashboardFilters): DashboardMetricsResult {
    const asOfYmd = snapshot.asOfYmd || todayYmd();
    const range = resolvePeriodRange(filters.period, asOfYmd);
    const partners = snapshot.partners || [];
    const pmap = new Map(partners.map((p) => [String(p.id), p]));
    const vehicles = filterVehicles(snapshot.vehicles || [], partners, filters);
    const vmap = new Map((snapshot.vehicles || []).map((v) => [String(v.id), v]));

    // CARD 1
    const onPatio = vehicles.filter(isVehicleOnPatio);
    const veiculosNoPatio = onPatio.length;

    // CARD 2 — exclusivamente data_entrada === hoje
    const entradasHoje = vehicles.filter((v) => toLocalYmd(v.data_entrada) === asOfYmd).length;

    // CARD 3 — exclusivamente data_saida === hoje
    const saidasHoje = vehicles.filter((v) => toLocalYmd(v.data_saida) === asOfYmd).length;

    // CARD 4
    const capacity = resolveCapacity(snapshot.settings);
    const percent = capacity > 0 ? (veiculosNoPatio / capacity) * 100 : 0;
    const ocupacao = {
      vehiclesOnPatio: veiculosNoPatio,
      capacity,
      percent,
      label: `${veiculosNoPatio} de ${capacity} vagas`,
    };

    // CARD 5 — títulos em Contas a receber (aprovados / manuais), não todo EM_ABERTO
    const finId = financeiraFilterId(filters);
    const openReceivables = (snapshot.receivables || []).filter((r) => {
      if (!isOpenReceivable(r)) return false;
      if (!finId && !filters.search && !filters.status) return true;
      const veh = r.vehicle_id ? vmap.get(String(r.vehicle_id)) : undefined;
      if (finId) {
        if (veh) {
          if (String(veh.localizador_id || "") !== finId) return false;
        } else if (String(r.localizador_id || r.partner_id || "") !== finId) {
          return false;
        }
      }
      if (filters.status || filters.search) {
        if (!veh) return false;
        if (!vehicles.some((x) => String(x.id) === String(veh.id))) return false;
      }
      return true;
    });
    const contasAReceber = openReceivables.reduce((s, r) => s + Number(r.valor || 0), 0);
    const contasAReceberPendentes = openReceivables.length;

    // CARD 6 — financeiras com ≥1 veículo atualmente no pátio
    const financeirasIds = new Set<string>();
    for (const v of onPatio) {
      const id = String(v.localizador_id || "").trim();
      if (id) financeirasIds.add(id);
    }
    const financeirasAtivas = financeirasIds.size;

    // Situação operacional (mutuamente exclusiva)
    const operacional: OperationalStatusCounts = {
      aguardandoConferencia: 0,
      aguardandoVistoria: 0,
      aguardandoAutorizacao: 0,
      liberadosAguardandoRetirada: 0,
      pendenciasDocumentais: 0,
    };
    const operacionalByVehicleId: Record<string, OperationalGroup> = {};
    for (const v of onPatio) {
      const group = classifyOperationalGroup(v);
      if (!group) continue;
      operacionalByVehicleId[String(v.id)] = group;
      switch (group) {
        case "aguardando_conferencia":
          operacional.aguardandoConferencia++;
          break;
        case "aguardando_vistoria":
          operacional.aguardandoVistoria++;
          break;
        case "aguardando_autorizacao":
          operacional.aguardandoAutorizacao++;
          break;
        case "liberados_aguardando_retirada":
          operacional.liberadosAguardandoRetirada++;
          break;
        case "pendencias_documentais":
          operacional.pendenciasDocumentais++;
          break;
      }
    }

    const auditOk = auditOperationalConsistency(veiculosNoPatio, operacional);

    // Tabelas / gráficos (mesma fonte filtrada)
    const longStay = onPatio
      .map((v) => ({
        vehicleId: String(v.id),
        placa: v.placa || "—",
        financeira: partnerName(v, pmap),
        days: vehicleStayDays(v, asOfYmd),
      }))
      .filter((x) => x.days > 0)
      .sort((a, b) => b.days - a.days)
      .slice(0, 10);

    const recvByFin = new Map<string, { financeira: string; veiculos: Set<string>; valor: number }>();
    for (const r of openReceivables) {
      const veh = r.vehicle_id ? vmap.get(String(r.vehicle_id)) : undefined;
      const pid = String(veh?.localizador_id || r.localizador_id || r.partner_id || "").trim() || "__sem__";
      const nome =
        pid === "__sem__" ? "Sem financeira" : pmap.get(pid)?.nome || veh?.responsavel_financeiro_nome || "—";
      const cur = recvByFin.get(pid) || { financeira: nome, veiculos: new Set(), valor: 0 };
      if (r.vehicle_id) cur.veiculos.add(String(r.vehicle_id));
      cur.valor += Number(r.valor || 0);
      recvByFin.set(pid, cur);
    }
    const topReceivablesByFinanceira = Array.from(recvByFin.entries())
      .map(([financeiraId, x]) => ({
        financeiraId,
        financeira: x.financeira,
        veiculos: x.veiculos.size,
        valor: x.valor,
      }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8);

    const vehByFin = new Map<string, { nome: string; count: number }>();
    for (const v of onPatio) {
      const id = String(v.localizador_id || "").trim() || "__sem__";
      const nome = id === "__sem__" ? "Sem financeira" : pmap.get(id)?.nome || "—";
      const cur = vehByFin.get(id) || { nome, count: 0 };
      cur.count += 1;
      vehByFin.set(id, cur);
    }
    const vehiclesByFinanceira = Array.from(vehByFin.entries())
      .map(([financeiraId, x]) => ({ financeiraId, nome: x.nome, count: x.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const dailyLabels: string[] = [];
    const dailyEntradas: number[] = [];
    const dailySaidas: number[] = [];
    for (let i = 29; i >= 0; i--) {
      const ymd = addDaysYmd(asOfYmd, -i);
      dailyLabels.push(`${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`);
      let e = 0;
      let s = 0;
      for (const v of vehicles) {
        if (toLocalYmd(v.data_entrada) === ymd) e++;
        if (toLocalYmd(v.data_saida) === ymd) s++;
      }
      dailyEntradas.push(e);
      dailySaidas.push(s);
    }

    const months: string[] = [];
    const receitaValues: number[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = ymdToDate(asOfYmd);
      d.setMonth(d.getMonth() - i);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push(ym);
      const mStart = monthStartYm(ym);
      const mEnd = monthEndYm(ym);
      let sum = 0;
      for (const r of snapshot.receivables || []) {
        const st = String(r.status || "").toUpperCase();
        if (st !== "PAGO") continue;
        const veh = r.vehicle_id ? vmap.get(String(r.vehicle_id)) : undefined;
        if (finId && veh && String(veh.localizador_id || "") !== finId) continue;
        // Usa updated/valor pago aproximado via vehicle data_saida no mês quando disponível
        const ref = toLocalYmd(veh?.data_saida) || null;
        if (ref && ref >= mStart && ref <= mEnd) sum += Number(r.valor || 0);
      }
      receitaValues.push(sum);
    }

    return {
      filters: { ...filters },
      range,
      asOfYmd,
      kpis: {
        veiculosNoPatio,
        entradasHoje,
        saidasHoje,
        ocupacao,
        contasAReceber,
        contasAReceberPendentes,
        financeirasAtivas,
      },
      operacional,
      operacionalByVehicleId,
      longStay,
      topReceivablesByFinanceira,
      vehiclesByFinanceira,
      dailyFlow30d: { labels: dailyLabels, entradas: dailyEntradas, saidas: dailySaidas },
      receitaMensal: { months, values: receitaValues },
      auditOk,
    };
  }
}

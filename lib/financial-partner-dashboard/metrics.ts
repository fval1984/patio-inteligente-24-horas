/**
 * FinancialPartnerMetrics — indicadores por financeira (localizador_id).
 */

import {
  DEFAULT_FP_FILTERS,
  PORTFOLIO_LABELS,
  type AlertPriority,
  type FinancialPartnerDataSnapshot,
  type FinancialPartnerFilters,
  type FinancialPartnerMetricsResult,
  type FpReceivable,
  type FpVehicle,
  type PartnerPortfolioStage,
  type Ymd,
} from "./types";

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

function resolvePeriod(period: FinancialPartnerFilters["period"], asOf: Ymd) {
  const curYm = yearMonthFromYmd(asOf);
  switch (period) {
    case "today":
      return { from: asOf, to: asOf };
    case "7d":
      return { from: addDaysYmd(asOf, -6), to: asOf };
    case "30d":
      return { from: addDaysYmd(asOf, -29), to: asOf };
    case "month":
      return { from: monthStartYm(curYm), to: asOf };
    case "year":
      return { from: `${asOf.slice(0, 4)}-01-01`, to: asOf };
    default:
      return { from: addDaysYmd(asOf, -29), to: asOf };
  }
}

function statusUpper(v: FpVehicle): string {
  return String(v.status || "").toUpperCase();
}

function isOnPatio(v: FpVehicle): boolean {
  return statusUpper(v) !== "REMOVIDO";
}

function isLiberado(v: FpVehicle): boolean {
  const s = String(v.status || "");
  const u = s.toUpperCase();
  return s === "LIBERACAO_CONFIRMADA" || s === "REMocao_CONFIRMADA" || u === "REMOCAO_CONFIRMADA";
}

function isRemocaoFlag(v: FpVehicle): boolean {
  const f = v.remocao_solicitada;
  return f === true || f === 1 || f === "1" || f === "t" || f === "true" || f === "TRUE";
}

function missingDocs(v: FpVehicle): boolean {
  return String(v.nfse_status || "").toUpperCase() === "PENDENTE" || isRemocaoFlag(v);
}

function stayDays(v: FpVehicle, asOf: Ymd): number {
  const ent = toLocalYmd(v.data_entrada);
  if (!ent) return 0;
  const end = v.data_saida ? toLocalYmd(v.data_saida) : asOf;
  if (!end || end < ent) return 0;
  return Math.max(1, Math.ceil((ymdToDate(end).getTime() - ymdToDate(ent).getTime()) / 86400000));
}

/** Mesma lógica de calcTotal do app.html */
export function valorAcumulado(v: FpVehicle, asOf: Ymd = todayYmd()): number {
  if (!v?.data_entrada || !v?.valor_diaria) return 0;
  const days = stayDays(v, asOf);
  return days * Number(v.valor_diaria || 0);
}

function classifyPortfolio(v: FpVehicle): PartnerPortfolioStage {
  if (statusUpper(v) === "REMOVIDO") return "entregues";
  if (isLiberado(v)) return "liberados";
  if (String(v.status || "") === "LIBERACAO_SOLICITADA") return "aguardando_autorizacao";
  if (missingDocs(v)) return "aguardando_documentacao";
  return "em_guarda";
}

function statusLabel(v: FpVehicle): string {
  return PORTFOLIO_LABELS[classifyPortfolio(v)];
}

function isFaturado(r: FpReceivable): boolean {
  if (!r || Number(r.valor || 0) <= 0) return false;
  const st = String(r.status || "").toUpperCase();
  if (st === "PAGO") return true;
  if (r.financeiro_aprovado_contas_receber === true) return true;
  return false;
}

function isAberto(r: FpReceivable): boolean {
  if (!r || String(r.status || "").toUpperCase() === "PAGO") return false;
  if (String(r.status || "").toUpperCase() === "CANCELADO") return false;
  if (Number(r.valor || 0) <= 0) return false;
  if (r.financeiro_aprovado_contas_receber === true) return true;
  if (String(r.status || "").toUpperCase() === "EM_ABERTO") return true;
  return false;
}

function faturamentoYmd(r: FpReceivable, v: FpVehicle | undefined): Ymd | null {
  return toLocalYmd(v?.data_saida || r.period_end || r.data_vencimento || r.created_at);
}

function eventLabel(tipo: string | null | undefined): string {
  const t = String(tipo || "").toUpperCase();
  const map: Record<string, string> = {
    LIBERACAO_SOLICITADA: "Autorização solicitada",
    LIBERACAO_CONFIRMADA: "Liberação",
    REMOCAO_SOLICITADA: "Remoção solicitada",
    REMOVIDO: "Entrega",
    STATUS_REVERTIDO_VNP: "Reversão",
    REMOCAO_DESFEITA: "Remoção desfeita",
    RESPONSAVEL_TROCADO: "Troca de responsável",
  };
  return map[t] || (tipo ? String(tipo).replace(/_/g, " ") : "Movimentação");
}

function formatYmdBr(ymd: Ymd | null): string {
  if (!ymd || ymd.length < 10) return "—";
  return `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}/${ymd.slice(0, 4)}`;
}

function emptyResult(
  filters: FinancialPartnerFilters,
  asOf: Ymd,
  nome: string
): FinancialPartnerMetricsResult {
  const emptySeries = { labels: [] as string[], values: [] as number[] };
  const emptyPair = { labels: [] as string[], entradas: [] as number[], saidas: [] as number[] };
  return {
    filters,
    asOfYmd: asOf,
    financeiraNome: nome,
    hasFinanceira: !!filters.financeiraId,
    kpis: {
      veiculosAtivos: 0,
      entradasPeriodo: 0,
      saidasPeriodo: 0,
      tempoMedioPermanencia: 0,
      receitaGerada: 0,
      valorEmAberto: 0,
    },
    entradasSaidas12m: emptyPair,
    tempoMedio12m: emptySeries,
    receitaMensal12m: emptySeries,
    carteira: [],
    veiculos: [],
    ultimasMovimentacoes: [],
    alerts: [
      {
        id: "select",
        priority: "green",
        title: "Selecione uma financeira",
        detail: "Escolha a financeira no filtro para carregar os indicadores",
        count: 0,
      },
    ],
    mapaPermanencia: [],
    rankingPermanencia: [],
    indicadoresFinanceiros: {
      receitaMes: 0,
      receitaAno: 0,
      ticketMedioPorVeiculo: 0,
      receitaMediaPorDiaGuarda: 0,
      valorMedioPorVeiculoArmazenado: 0,
    },
  };
}

export class FinancialPartnerMetrics {
  compute(
    snapshot: FinancialPartnerDataSnapshot,
    filtersInput: Partial<FinancialPartnerFilters> = {}
  ): FinancialPartnerMetricsResult {
    const filters: FinancialPartnerFilters = { ...DEFAULT_FP_FILTERS, ...filtersInput };
    const asOf = snapshot.asOfYmd || todayYmd();
    const range = resolvePeriod(filters.period, asOf);
    const pmap = new Map((snapshot.partners || []).map((p) => [String(p.id), p]));
    const financeiraNome = filters.financeiraId
      ? pmap.get(String(filters.financeiraId))?.nome || "Financeira"
      : "";

    if (!filters.financeiraId) {
      return emptyResult(filters, asOf, "");
    }

    const finId = String(filters.financeiraId);
    const q = String(filters.search || "")
      .trim()
      .toLowerCase();
    const qNorm = q.replace(/[^a-z0-9]/g, "");

    let vehicles = (snapshot.vehicles || []).filter((v) => String(v.localizador_id || "") === finId);
    if (filters.status === "no_patio") vehicles = vehicles.filter(isOnPatio);
    if (filters.status === "vlp") {
      vehicles = vehicles.filter((v) => String(v.status || "") === "LIBERACAO_SOLICITADA" || isLiberado(v));
    }
    if (filters.status === "removido") {
      vehicles = vehicles.filter((v) => statusUpper(v) === "REMOVIDO");
    }
    if (q) {
      vehicles = vehicles.filter((v) => {
        const plate = String(v.placa || "")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "");
        const modelo = `${v.marca || ""} ${v.modelo || ""}`.toLowerCase();
        const hay = `${plate} ${modelo}`;
        const norm = hay.replace(/[^a-z0-9]/g, "");
        return hay.includes(q) || (!!qNorm && norm.includes(qNorm));
      });
    }

    const vmap = new Map(vehicles.map((v) => [String(v.id), v]));
    // vehicle ids of this financeira (full snapshot) for receivables linkage
    const finVehicleIds = new Set(
      (snapshot.vehicles || [])
        .filter((v) => String(v.localizador_id || "") === finId)
        .map((v) => String(v.id))
    );

    const onPatio = vehicles.filter(isOnPatio);
    const entradasPeriodo = vehicles.filter((v) => {
      const y = toLocalYmd(v.data_entrada);
      return !!(y && y >= range.from && y <= range.to);
    }).length;
    const saidasPeriodo = vehicles.filter((v) => {
      const y = toLocalYmd(v.data_saida);
      return !!(y && y >= range.from && y <= range.to);
    }).length;

    const stayList = onPatio.map((v) => stayDays(v, asOf)).filter((d) => d > 0);
    const tempoMedio = stayList.length ? stayList.reduce((a, b) => a + b, 0) / stayList.length : 0;

    const receivables = (snapshot.receivables || []).filter((r) => {
      if (!r.vehicle_id) return false;
      return finVehicleIds.has(String(r.vehicle_id));
    });

    let receitaGerada = 0;
    let valorEmAberto = 0;
    for (const r of receivables) {
      const val = Number(r.valor || 0);
      if (isFaturado(r)) {
        const fat = faturamentoYmd(r, vmap.get(String(r.vehicle_id)) || undefined);
        if (fat && fat >= range.from && fat <= range.to) receitaGerada += val;
        else if (!fat) receitaGerada += val;
      }
      if (isAberto(r)) valorEmAberto += val;
    }

    // 12m charts
    const labels12: string[] = [];
    const ent12: number[] = [];
    const sai12: number[] = [];
    const stay12: number[] = [];
    const rec12: number[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = ymdToDate(asOf);
      d.setMonth(d.getMonth() - i);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      labels12.push(ym.slice(5) + "/" + ym.slice(2, 4));
      const mStart = monthStartYm(ym);
      const mEnd = monthEndYm(ym);
      let e = 0;
      let s = 0;
      const daysOut: number[] = [];
      for (const v of vehicles) {
        const ent = toLocalYmd(v.data_entrada);
        const sai = toLocalYmd(v.data_saida);
        if (ent && ent >= mStart && ent <= mEnd) e++;
        if (sai && sai >= mStart && sai <= mEnd) {
          s++;
          daysOut.push(stayDays(v, sai));
        }
      }
      ent12.push(e);
      sai12.push(s);
      stay12.push(daysOut.length ? daysOut.reduce((a, b) => a + b, 0) / daysOut.length : 0);
      let rev = 0;
      for (const r of receivables) {
        if (!isFaturado(r)) continue;
        const veh = (snapshot.vehicles || []).find((x) => String(x.id) === String(r.vehicle_id));
        const fat = faturamentoYmd(r, veh);
        if (fat && fat >= mStart && fat <= mEnd) rev += Number(r.valor || 0);
      }
      rec12.push(rev);
    }

    // carteira
    const counts: Record<PartnerPortfolioStage, number> = {
      em_guarda: 0,
      aguardando_documentacao: 0,
      aguardando_autorizacao: 0,
      liberados: 0,
      entregues: 0,
    };
    for (const v of vehicles) {
      const st = classifyPortfolio(v);
      if (st === "entregues") {
        if (toLocalYmd(v.data_saida) && toLocalYmd(v.data_saida)! >= range.from) counts.entregues++;
      } else if (isOnPatio(v)) {
        counts[st]++;
      }
    }
    // entregues in period
    counts.entregues = saidasPeriodo;
    const carteiraTotal =
      counts.em_guarda +
        counts.aguardando_documentacao +
        counts.aguardando_autorizacao +
        counts.liberados +
        counts.entregues || 1;
    const carteira = (Object.keys(PORTFOLIO_LABELS) as PartnerPortfolioStage[]).map((key) => ({
      key,
      label: PORTFOLIO_LABELS[key],
      count: counts[key],
      pct: (counts[key] / carteiraTotal) * 100,
    }));

    const veiculosRows = onPatio
      .map((v) => ({
        vehicleId: String(v.id),
        placa: v.placa || "—",
        modelo: [v.marca, v.modelo].filter(Boolean).join(" ") || "—",
        dataEntrada: formatYmdBr(toLocalYmd(v.data_entrada)),
        diasNoPatio: stayDays(v, asOf),
        status: statusLabel(v),
        valorAcumulado: valorAcumulado(v, asOf),
      }))
      .sort((a, b) => b.diasNoPatio - a.diasNoPatio);

    const rankingPermanencia = veiculosRows.slice(0, 20);

    // movements
    const events = (snapshot.events || []).filter((ev) => finVehicleIds.has(String(ev.vehicle_id || "")));
    let ultimasMovimentacoes = events
      .map((ev) => {
        const veh =
          vmap.get(String(ev.vehicle_id)) ||
          (snapshot.vehicles || []).find((x) => String(x.id) === String(ev.vehicle_id));
        const at = ev.data_evento || ev.created_at || "";
        return {
          data: formatYmdBr(toLocalYmd(at)),
          placa: veh?.placa || "—",
          evento: eventLabel(ev.tipo),
          usuario: ev.responsavel || "—",
          at: String(at),
        };
      })
      .filter((x) => x.at)
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 20);

    if (!ultimasMovimentacoes.length) {
      const derived: FinancialPartnerMetricsResult["ultimasMovimentacoes"] = [];
      for (const v of vehicles) {
        const ent = toLocalYmd(v.data_entrada);
        if (ent && ent >= range.from && ent <= range.to) {
          derived.push({
            data: formatYmdBr(ent),
            placa: v.placa || "—",
            evento: "Recebimento",
            usuario: v.responsavel_financeiro_nome || "—",
            at: String(v.data_entrada || ""),
          });
        }
        const sai = toLocalYmd(v.data_saida);
        if (sai && sai >= range.from && sai <= range.to) {
          derived.push({
            data: formatYmdBr(sai),
            placa: v.placa || "—",
            evento: "Entrega",
            usuario: v.responsavel_financeiro_nome || "—",
            at: String(v.data_saida || ""),
          });
        }
      }
      ultimasMovimentacoes = derived.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 20);
    }

    // permanence map
    const bucketsDef = [
      { key: "0_15", label: "Até 15 dias", min: 0, max: 15 },
      { key: "16_30", label: "16 a 30 dias", min: 16, max: 30 },
      { key: "31_60", label: "31 a 60 dias", min: 31, max: 60 },
      { key: "61_90", label: "61 a 90 dias", min: 61, max: 90 },
      { key: "90p", label: "Mais de 90 dias", min: 91, max: 99999 },
    ];
    const bucketCounts = bucketsDef.map((b) => ({ ...b, count: 0 }));
    for (const v of onPatio) {
      const d = stayDays(v, asOf);
      const b = bucketCounts.find((x) => d >= x.min && d <= x.max);
      if (b) b.count++;
    }
    const bucketTotal = onPatio.length || 1;
    const mapaPermanencia = bucketCounts.map((b) => ({
      key: b.key,
      label: b.label,
      count: b.count,
      pct: (b.count / bucketTotal) * 100,
    }));

    // alerts
    let d30 = 0;
    let d60 = 0;
    let d90 = 0;
    let libWait = 0;
    let noDocs = 0;
    let pendOps = 0;
    for (const v of onPatio) {
      const d = stayDays(v, asOf);
      if (d > 90) d90++;
      else if (d > 60) d60++;
      else if (d > 30) d30++;
      if (isLiberado(v)) libWait++;
      if (missingDocs(v)) noDocs++;
      if (String(v.status || "") === "LIBERACAO_SOLICITADA" || missingDocs(v) || !v.valor_diaria) pendOps++;
    }
    const alerts: FinancialPartnerMetricsResult["alerts"] = [];
    const push = (id: string, priority: AlertPriority, title: string, detail: string, count: number) => {
      if (count > 0) alerts.push({ id, priority, title, detail, count });
    };
    push("d30", "yellow", "Acima de 30 dias", "Veículos com permanência superior a 30 dias", d30);
    push("d60", "yellow", "Acima de 60 dias", "Veículos com permanência superior a 60 dias", d60);
    push("d90", "red", "Acima de 90 dias", "Veículos com permanência superior a 90 dias", d90);
    push("lib", "yellow", "Liberados aguardando retirada", "Veículos liberados ainda no pátio", libWait);
    push("docs", "red", "Sem documentação", "NF-e pendente ou remoção solicitada", noDocs);
    push("pend", "yellow", "Pendências operacionais", "Autorização, documentação ou conferência", pendOps);
    if (!alerts.length) {
      alerts.push({
        id: "ok",
        priority: "green",
        title: "Carteira estável",
        detail: "Nenhum alerta para esta financeira",
        count: 0,
      });
    }

    // financial indicators
    const curYm = yearMonthFromYmd(asOf);
    const yearFrom = `${asOf.slice(0, 4)}-01-01`;
    let receitaMes = 0;
    let receitaAno = 0;
    for (const r of receivables) {
      if (!isFaturado(r)) continue;
      const veh = (snapshot.vehicles || []).find((x) => String(x.id) === String(r.vehicle_id));
      const fat = faturamentoYmd(r, veh);
      const val = Number(r.valor || 0);
      if (fat && yearMonthFromYmd(fat) === curYm) receitaMes += val;
      if (fat && fat >= yearFrom && fat <= asOf) receitaAno += val;
    }
    const veiculosFaturados = new Set(
      receivables.filter(isFaturado).map((r) => String(r.vehicle_id || r.id))
    );
    const ticketMedio = veiculosFaturados.size > 0 ? receitaGerada / veiculosFaturados.size : 0;
    const totalDiasGuarda = onPatio.reduce((s, v) => s + stayDays(v, asOf), 0);
    const acumuladoAtivos = onPatio.reduce((s, v) => s + valorAcumulado(v, asOf), 0);
    const receitaMediaPorDia = totalDiasGuarda > 0 ? acumuladoAtivos / totalDiasGuarda : 0;
    const valorMedioArmazenado = onPatio.length > 0 ? acumuladoAtivos / onPatio.length : 0;

    return {
      filters,
      asOfYmd: asOf,
      financeiraNome,
      hasFinanceira: true,
      kpis: {
        veiculosAtivos: onPatio.length,
        entradasPeriodo,
        saidasPeriodo,
        tempoMedioPermanencia: tempoMedio,
        receitaGerada,
        valorEmAberto,
      },
      entradasSaidas12m: { labels: labels12, entradas: ent12, saidas: sai12 },
      tempoMedio12m: { labels: labels12, values: stay12 },
      receitaMensal12m: { labels: labels12, values: rec12 },
      carteira,
      veiculos: veiculosRows,
      ultimasMovimentacoes,
      alerts,
      mapaPermanencia,
      rankingPermanencia,
      indicadoresFinanceiros: {
        receitaMes,
        receitaAno,
        ticketMedioPorVeiculo: ticketMedio,
        receitaMediaPorDiaGuarda: receitaMediaPorDia,
        valorMedioPorVeiculoArmazenado: valorMedioArmazenado,
      },
    };
  }
}

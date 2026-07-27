/**
 * OperationalMetrics — regras do Dashboard Operacional (pátio de guarda).
 * Fluxo: Recebimento → Conferência → Vistoria → Guarda → Autorização → Liberação → Entrega
 */

import {
  DEFAULT_OPS_FILTERS,
  STAGE_LABELS,
  type AlertPriority,
  type OperationalDataSnapshot,
  type OperationalFilters,
  type OperationalMetricsResult,
  type OpsAlert,
  type OpsStage,
  type OpsVehicle,
  type OpsVehicleEvent,
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

function statusUpper(v: OpsVehicle): string {
  return String(v.status || "").toUpperCase();
}

export function isOnPatio(v: OpsVehicle): boolean {
  return statusUpper(v) !== "REMOVIDO";
}

function isLiberado(v: OpsVehicle): boolean {
  const s = String(v.status || "");
  const u = s.toUpperCase();
  return s === "LIBERACAO_CONFIRMADA" || s === "REMocao_CONFIRMADA" || u === "REMOCAO_CONFIRMADA";
}

function isAutorizacao(v: OpsVehicle): boolean {
  return String(v.status || "") === "LIBERACAO_SOLICITADA";
}

function hasVistoria(v: OpsVehicle): boolean {
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

/** Conferência inicial incompleta: sem valor de diária definido. */
function needsConferencia(v: OpsVehicle): boolean {
  return !v.valor_diaria || Number(v.valor_diaria) <= 0;
}

function isRemocaoFlag(v: OpsVehicle): boolean {
  const f = v.remocao_solicitada;
  return f === true || f === 1 || f === "1" || f === "t" || f === "true" || f === "TRUE";
}

function missingDocs(v: OpsVehicle): boolean {
  if (String(v.nfse_status || "").toUpperCase() === "PENDENTE") return true;
  if (isRemocaoFlag(v)) return true;
  return false;
}

/**
 * Classificação exclusiva no pátio (estoque).
 * Prioridade: liberados → autorização → conferência → vistoria → em guarda
 */
export function classifyStage(v: OpsVehicle): OpsStage | null {
  if (statusUpper(v) === "REMOVIDO") return "entregues";
  if (!isOnPatio(v)) return null;
  if (isLiberado(v)) return "liberados";
  if (isAutorizacao(v)) return "aguardando_autorizacao";
  if (needsConferencia(v)) return "aguardando_conferencia";
  if (!hasVistoria(v)) return "aguardando_vistoria";
  return "em_guarda";
}

function stayDays(v: OpsVehicle, asOf: Ymd): number {
  const ent = toLocalYmd(v.data_entrada);
  if (!ent) return 0;
  const end = v.data_saida ? toLocalYmd(v.data_saida) : asOf;
  if (!end || end < ent) return 0;
  return Math.max(1, Math.ceil((ymdToDate(end).getTime() - ymdToDate(ent).getTime()) / 86400000));
}

function hoursSince(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return (now.getTime() - t) / 3600000;
}

function filterVehicles(
  vehicles: OpsVehicle[],
  partners: { id: string; nome?: string | null }[],
  filters: OperationalFilters
): OpsVehicle[] {
  const finId = String(filters.financeiraId || "").trim();
  const parcId = String(filters.parceiroId || "").trim();
  const pmap = new Map(partners.map((p) => [String(p.id), p]));
  const q = String(filters.search || "")
    .trim()
    .toLowerCase();
  const qNorm = q.replace(/[^a-z0-9]/g, "");

  return vehicles.filter((v) => {
    if (finId && String(v.localizador_id || "") !== finId) return false;
    if (parcId) {
      const rpp = String(v.responsavel_financeiro_id || v.localizador_id || "");
      if (rpp !== parcId) return false;
    }
    if (filters.status === "no_patio" && !isOnPatio(v)) return false;
    if (filters.status === "vlp") {
      const s = String(v.status || "");
      if (!(s === "LIBERACAO_SOLICITADA" || isLiberado(v))) return false;
    }
    if (filters.status === "removido" && statusUpper(v) !== "REMOVIDO") return false;
    if (q) {
      const plate = String(v.placa || "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      const partner = pmap.get(String(v.localizador_id || ""));
      const hay = `${plate} ${String(partner?.nome || "").toLowerCase()}`;
      const normHay = hay.replace(/[^a-z0-9]/g, "");
      if (!hay.includes(q) && !(qNorm && normHay.includes(qNorm))) return false;
    }
    return true;
  });
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

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export class OperationalMetrics {
  compute(
    snapshot: OperationalDataSnapshot,
    filtersInput: Partial<OperationalFilters> = {}
  ): OperationalMetricsResult {
    const filters: OperationalFilters = { ...DEFAULT_OPS_FILTERS, ...filtersInput };
    const asOf = snapshot.asOfYmd || todayYmd();
    const now = new Date(`${asOf}T23:59:59`);
    const partners = snapshot.partners || [];
    const pmap = new Map(partners.map((p) => [String(p.id), p]));
    const vehicles = filterVehicles(snapshot.vehicles || [], partners, filters);
    const onPatio = vehicles.filter(isOnPatio);

    const stageCounts: Record<OpsStage, number> = {
      aguardando_conferencia: 0,
      aguardando_vistoria: 0,
      aguardando_autorizacao: 0,
      em_guarda: 0,
      liberados: 0,
      entregues: 0,
    };
    const byStage = new Map<string, OpsStage>();
    for (const v of onPatio) {
      const st = classifyStage(v);
      if (!st || st === "entregues") continue;
      byStage.set(String(v.id), st);
      stageCounts[st]++;
    }

    const entradasHoje = vehicles.filter((v) => toLocalYmd(v.data_entrada) === asOf).length;
    const saidasHoje = vehicles.filter((v) => toLocalYmd(v.data_saida) === asOf).length;
    stageCounts.entregues = saidasHoje;

    const kpis = {
      veiculosNoPatio: onPatio.length,
      entradasHoje,
      saidasHoje,
      aguardandoConferencia: stageCounts.aguardando_conferencia,
      aguardandoVistoria: stageCounts.aguardando_vistoria,
      prontosParaLiberacao: stageCounts.liberados,
    };

    const fila = {
      recebidosHoje: entradasHoje,
      aguardandoConferencia: stageCounts.aguardando_conferencia,
      aguardandoVistoria: stageCounts.aguardando_vistoria,
      aguardandoAutorizacao: stageCounts.aguardando_autorizacao,
      liberados: stageCounts.liberados,
      entregues: saidasHoje,
    };

    const mapa = {
      recebidosHoje: entradasHoje,
      emConferencia: stageCounts.aguardando_conferencia,
      emGuarda: stageCounts.em_guarda + stageCounts.aguardando_vistoria,
      liberados: stageCounts.liberados + stageCounts.aguardando_autorizacao,
      entregues: saidasHoje,
    };

    // 30d flow
    const labels30: string[] = [];
    const ent30: number[] = [];
    const sai30: number[] = [];
    for (let i = 29; i >= 0; i--) {
      const ymd = addDaysYmd(asOf, -i);
      labels30.push(`${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`);
      let e = 0;
      let s = 0;
      for (const v of vehicles) {
        if (toLocalYmd(v.data_entrada) === ymd) e++;
        if (toLocalYmd(v.data_saida) === ymd) s++;
      }
      ent30.push(e);
      sai30.push(s);
    }

    // avg stay 12 months (for vehicles that left in that month)
    const stayLabels: string[] = [];
    const stayAvgs: number[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = ymdToDate(asOf);
      d.setMonth(d.getMonth() - i);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      stayLabels.push(ym.slice(5) + "/" + ym.slice(2, 4));
      const mStart = monthStartYm(ym);
      const mEnd = monthEndYm(ym);
      const days: number[] = [];
      for (const v of vehicles) {
        const sai = toLocalYmd(v.data_saida);
        if (sai && sai >= mStart && sai <= mEnd) days.push(stayDays(v, sai));
      }
      stayAvgs.push(days.length ? days.reduce((a, b) => a + b, 0) / days.length : 0);
    }

    const stockStages: OpsStage[] = [
      "aguardando_conferencia",
      "aguardando_vistoria",
      "aguardando_autorizacao",
      "em_guarda",
      "liberados",
    ];
    const totalStock = stockStages.reduce((s, k) => s + stageCounts[k], 0) || 1;
    const veiculosPorStatus = stockStages.map((key) => ({
      key,
      label: STAGE_LABELS[key],
      count: stageCounts[key],
      pct: (stageCounts[key] / totalStock) * 100,
    }));

    const aguardandoAcao = onPatio
      .filter((v) => {
        const st = byStage.get(String(v.id));
        return (
          st === "aguardando_conferencia" ||
          st === "aguardando_vistoria" ||
          st === "aguardando_autorizacao" ||
          st === "liberados" ||
          missingDocs(v)
        );
      })
      .map((v) => {
        const st = byStage.get(String(v.id)) || "em_guarda";
        const finId = String(v.localizador_id || "");
        return {
          vehicleId: String(v.id),
          placa: v.placa || "—",
          financeira: pmap.get(finId)?.nome || "—",
          statusAtual: STAGE_LABELS[st],
          diasNoPatio: stayDays(v, asOf),
          responsavel: v.responsavel_financeiro_nome || pmap.get(String(v.responsavel_financeiro_id || ""))?.nome || "—",
          stage: st,
        };
      })
      .sort((a, b) => b.diasNoPatio - a.diasNoPatio)
      .slice(0, 20);

    // movements from events or fallback from vehicles
    const events = snapshot.events || [];
    let ultimasMovimentacoes = events
      .map((ev: OpsVehicleEvent) => {
        const veh = vehicles.find((x) => String(x.id) === String(ev.vehicle_id)) ||
          (snapshot.vehicles || []).find((x) => String(x.id) === String(ev.vehicle_id));
        const at = ev.data_evento || ev.created_at || "";
        return {
          horario: formatTime(at),
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
      const derived: OperationalMetricsResult["ultimasMovimentacoes"] = [];
      for (const v of vehicles) {
        if (toLocalYmd(v.data_entrada) === asOf) {
          derived.push({
            horario: formatTime(v.data_entrada || v.created_at),
            placa: v.placa || "—",
            evento: "Recebimento",
            usuario: v.responsavel_financeiro_nome || "—",
            at: String(v.data_entrada || v.created_at || ""),
          });
        }
        if (toLocalYmd(v.data_saida) === asOf) {
          derived.push({
            horario: formatTime(v.data_saida || v.updated_at),
            placa: v.placa || "—",
            evento: "Entrega",
            usuario: v.responsavel_financeiro_nome || "—",
            at: String(v.data_saida || v.updated_at || ""),
          });
        }
        if (v.vistoria_data && toLocalYmd(v.vistoria_data) === asOf) {
          derived.push({
            horario: formatTime(v.vistoria_data),
            placa: v.placa || "—",
            evento: "Vistoria",
            usuario: v.vistoria_responsavel || "—",
            at: String(v.vistoria_data),
          });
        }
      }
      ultimasMovimentacoes = derived.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 20);
    }

    const alerts: OpsAlert[] = [];
    const pushAlert = (id: string, priority: AlertPriority, title: string, detail: string, count: number) => {
      if (count > 0) alerts.push({ id, priority, title, detail, count });
    };

    let conf24 = 0;
    let vist24 = 0;
    let lib48 = 0;
    let above60 = 0;
    let above90 = 0;
    let noDocs = 0;
    for (const v of onPatio) {
      const st = byStage.get(String(v.id));
      const hrs = hoursSince(v.data_entrada || v.created_at, now);
      const days = stayDays(v, asOf);
      if (st === "aguardando_conferencia" && hrs != null && hrs >= 24) conf24++;
      if (st === "aguardando_vistoria" && hrs != null && hrs >= 24) vist24++;
      if (st === "liberados") {
        const libHrs = hoursSince(v.updated_at || v.data_entrada, now);
        if (libHrs != null && libHrs >= 48) lib48++;
      }
      if (days > 90) above90++;
      else if (days > 60) above60++;
      if (missingDocs(v)) noDocs++;
    }
    pushAlert("conf24", "yellow", "Conferência atrasada (+24h)", "Veículos aguardando conferência há mais de 24 horas", conf24);
    pushAlert("vist24", "yellow", "Vistoria atrasada (+24h)", "Veículos aguardando vistoria há mais de 24 horas", vist24);
    pushAlert("lib48", "red", "Liberados sem retirada (+48h)", "Veículos liberados aguardando retirada há mais de 48 horas", lib48);
    pushAlert("d60", "yellow", "Permanência acima de 60 dias", "Veículos no pátio há mais de 60 dias", above60);
    pushAlert("d90", "red", "Permanência acima de 90 dias", "Veículos no pátio há mais de 90 dias", above90);
    pushAlert("docs", "red", "Sem documentação obrigatória", "NF-e pendente ou remoção solicitada", noDocs);
    if (!alerts.length) {
      alerts.push({
        id: "ok",
        priority: "green",
        title: "Operação estável",
        detail: "Nenhum alerta crítico no momento",
        count: 0,
      });
    }

    return {
      filters,
      asOfYmd: asOf,
      kpis,
      fila,
      mapa,
      entradasSaidas30d: { labels: labels30, entradas: ent30, saidas: sai30 },
      tempoMedioPermanencia12m: { labels: stayLabels, avgDays: stayAvgs },
      veiculosPorStatus,
      aguardandoAcao,
      ultimasMovimentacoes,
      alerts,
    };
  }
}

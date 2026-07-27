/**
 * BIMetrics — cálculo único de todas as páginas do BI Executivo.
 * Sem I/O. Uma passagem filtrada → todas as séries.
 */

import {
  addDaysYmd,
  emptyDual,
  emptyNumber,
  labelYm,
  lastNMonths,
  monthEndYm,
  monthStartYm,
  sumMap,
  toLocalYmd,
  todayYmd,
  topSeriesPoints,
  yearMonthFromYmd,
  ymdToDate,
} from "./charts";
import {
  DEFAULT_BI_FILTERS,
  type AlertPriority,
  type BiAlert,
  type BiDataSnapshot,
  type BiFilters,
  type BiMetricsResult,
  type BiPartner,
  type BiReceivable,
  type BiVehicle,
  type BiVehicleEvent,
  type DrillLevel,
  type HeatCell,
  type KpiNumber,
  type NamedOption,
  type PermanenceRow,
  type RankingRow,
  type SlicePct,
  type StageTiming,
  type Ymd,
} from "./types";

const GEO_NA = "Não informado";
const TIPO_NA = "Não classificado";

const PERM_BUCKETS = [
  { key: "0_15", label: "0–15 dias", min: 0, max: 15 },
  { key: "16_30", label: "16–30 dias", min: 16, max: 30 },
  { key: "31_60", label: "31–60 dias", min: 31, max: 60 },
  { key: "61_90", label: "61–90 dias", min: 61, max: 90 },
  { key: "90p", label: "Acima de 90", min: 91, max: 1e9 },
] as const;

function resolvePeriod(period: BiFilters["period"], asOf: Ymd) {
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
    case "24m":
      return { from: addDaysYmd(asOf, -729), to: asOf };
    default:
      return { from: addDaysYmd(asOf, -29), to: asOf };
  }
}

function statusUpper(v: BiVehicle): string {
  return String(v.status || "").toUpperCase();
}

function isOnPatio(v: BiVehicle): boolean {
  return statusUpper(v) !== "REMOVIDO";
}

function stayDays(v: BiVehicle, asOf: Ymd): number {
  const ent = toLocalYmd(v.data_entrada);
  if (!ent) return 0;
  const end = v.data_saida ? toLocalYmd(v.data_saida) : asOf;
  if (!end || end < ent) return 0;
  return Math.max(1, Math.ceil((ymdToDate(end).getTime() - ymdToDate(ent).getTime()) / 86400000));
}

export function valorAcumulado(v: BiVehicle, asOf: Ymd = todayYmd()): number {
  if (!v?.data_entrada || !v?.valor_diaria) return 0;
  return stayDays(v, asOf) * Number(v.valor_diaria || 0);
}

function partnerName(map: Map<string, BiPartner>, id: string | null | undefined): string {
  if (!id) return "—";
  return map.get(String(id))?.nome || "—";
}

/** Extrai cidade/UF de campos opcionais ou texto livre (sem alterar schema). */
export function resolveCidade(v: BiVehicle, p?: BiPartner | null): string {
  const raw =
    v.cidade ||
    p?.cidade ||
    "";
  const s = String(raw || "").trim();
  if (s) return s;
  const obs = String(v.observacoes || "");
  const m = obs.match(/\bcidade\s*[:=]\s*([A-Za-zÀ-ÿ\s\-']{2,40})/i);
  if (m) return m[1].trim();
  return GEO_NA;
}

export function resolveEstado(v: BiVehicle, p?: BiPartner | null): string {
  const raw = v.estado || v.uf || p?.estado || p?.uf || "";
  const s = String(raw || "").trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(s)) return s;
  if (s) return s;
  const obs = String(v.observacoes || "");
  const m = obs.match(/\b(?:UF|estado)\s*[:=]\s*([A-Z]{2})\b/i);
  if (m) return m[1].toUpperCase();
  return GEO_NA;
}

export function resolveTipoVeiculo(v: BiVehicle): string {
  if (v.tipo_veiculo && String(v.tipo_veiculo).trim()) return String(v.tipo_veiculo).trim();
  const hay = `${v.marca || ""} ${v.modelo || ""}`.toLowerCase();
  if (/moto|motocic|scooter|cg\s|biz\s|pop\s|yamaha|honda\s*cg|harley/.test(hay)) return "Moto";
  if (/caminh[aã]o|truck|hr\s|iveco|volvo\s*fh|scania|mercedes\s*actros/.test(hay)) return "Caminhão";
  if (/utilit|van\s|sprinter|master|ducato|kombi|fiorino|saveiro|strada|montana/.test(hay)) return "Utilitário";
  if (hay.trim()) return "Automóvel";
  return TIPO_NA;
}

function isFaturado(r: BiReceivable): boolean {
  if (!r || Number(r.valor || 0) <= 0) return false;
  const st = String(r.status || "").toUpperCase();
  if (st === "PAGO") return true;
  if (r.financeiro_aprovado_contas_receber === true) return true;
  if (!r.vehicle_id && st === "EM_ABERTO") return true;
  return false;
}

function isAberto(r: BiReceivable): boolean {
  if (!r || String(r.status || "").toUpperCase() === "PAGO") return false;
  if (String(r.status || "").toUpperCase() === "CANCELADO") return false;
  if (Number(r.valor || 0) <= 0) return false;
  if (r.financeiro_aprovado_contas_receber === true) return true;
  if (String(r.status || "").toUpperCase() === "EM_ABERTO") return true;
  return false;
}

function faturamentoYmd(r: BiReceivable, v?: BiVehicle): Ymd | null {
  return toLocalYmd(v?.data_saida || r.period_end || r.data_vencimento || r.created_at);
}

function permBucketKey(days: number): string {
  for (const b of PERM_BUCKETS) {
    if (days >= b.min && days <= b.max) return b.key;
  }
  return "90p";
}

function uniqOptions(items: { id: string; label: string }[]): NamedOption[] {
  const seen = new Set<string>();
  const out: NamedOption[] = [];
  for (const it of items) {
    if (!it.id || seen.has(it.id)) continue;
    seen.add(it.id);
    out.push({ id: it.id, label: it.label || it.id });
  }
  out.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  return out;
}

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function eventYmd(e: BiVehicleEvent): Ymd | null {
  return toLocalYmd(e.data_evento || e.created_at);
}

function classifyEventStage(tipo: string | null | undefined): string | null {
  const t = String(tipo || "").toUpperCase();
  if (/ENTRADA|RECEB|CHECK.?IN|CADASTRO/.test(t)) return "recebimento";
  if (/CONFER/.test(t)) return "conferencia";
  if (/VISTOR/.test(t)) return "vistoria";
  if (/LIBERACAO_SOLICITADA|LIBERA/.test(t) && !/CONFIRM/.test(t)) return "liberacao";
  if (/LIBERACAO_CONFIRMADA|REMOCAO_CONFIRMADA|ENTREGA|SAIDA|REMOVIDO/.test(t)) return "entrega";
  return null;
}

export class BIMetrics {
  compute(snapshot: BiDataSnapshot, filtersIn: Partial<BiFilters> = {}): BiMetricsResult {
    const filters: BiFilters = { ...DEFAULT_BI_FILTERS, ...filtersIn };
    const asOf = (snapshot.asOfYmd && toLocalYmd(snapshot.asOfYmd)) || todayYmd();
    const range = resolvePeriod(filters.period, asOf);
    const partners = snapshot.partners || [];
    const pmap = new Map(partners.map((p) => [String(p.id), p]));
    const allVehicles = snapshot.vehicles || [];
    const allReceivables = snapshot.receivables || [];
    const events = snapshot.events || [];
    const capacity = Math.max(1, Number(snapshot.settings?.capacidade_patio) || 100);

    // Enrichment maps for filter options (full universe)
    const cidadeOf = (v: BiVehicle) => resolveCidade(v, pmap.get(String(v.localizador_id || "")));
    const estadoOf = (v: BiVehicle) => resolveEstado(v, pmap.get(String(v.localizador_id || "")));
    const tipoOf = (v: BiVehicle) => resolveTipoVeiculo(v);

    const filterOptions = {
      financeiras: uniqOptions(
        partners.map((p) => ({ id: String(p.id), label: String(p.nome || p.id) }))
      ),
      parceiros: uniqOptions(
        partners.map((p) => ({ id: String(p.id), label: String(p.nome || p.id) }))
      ),
      cidades: uniqOptions(allVehicles.map((v) => ({ id: cidadeOf(v), label: cidadeOf(v) }))),
      estados: uniqOptions(allVehicles.map((v) => ({ id: estadoOf(v), label: estadoOf(v) }))),
      statusList: uniqOptions(
        allVehicles.map((v) => {
          const s = String(v.status || "SEM_STATUS");
          return { id: s, label: s };
        })
      ),
      tiposVeiculo: uniqOptions(allVehicles.map((v) => ({ id: tipoOf(v), label: tipoOf(v) }))),
    };

    let vehicles = allVehicles.slice();
    if (filters.financeiraId) {
      vehicles = vehicles.filter((v) => String(v.localizador_id || "") === filters.financeiraId);
    }
    if (filters.parceiroId) {
      const pid = filters.parceiroId;
      vehicles = vehicles.filter(
        (v) =>
          String(v.localizador_id || "") === pid ||
          String(v.leiloeiro_id || "") === pid ||
          String(v.responsavel_financeiro_id || "") === pid
      );
    }
    if (filters.cidade) vehicles = vehicles.filter((v) => cidadeOf(v) === filters.cidade);
    if (filters.estado) vehicles = vehicles.filter((v) => estadoOf(v) === filters.estado);
    if (filters.status) vehicles = vehicles.filter((v) => String(v.status || "") === filters.status);
    if (filters.tipoVeiculo) vehicles = vehicles.filter((v) => tipoOf(v) === filters.tipoVeiculo);

    const vIds = new Set(vehicles.map((v) => String(v.id)));
    const vmap = new Map(vehicles.map((v) => [String(v.id), v]));
    const receivables = allReceivables.filter((r) => r.vehicle_id && vIds.has(String(r.vehicle_id)));
    const onPatio = vehicles.filter(isOnPatio);

    const entradasPeriodo = vehicles.filter((v) => {
      const y = toLocalYmd(v.data_entrada);
      return !!(y && y >= range.from && y <= range.to);
    });
    const saidasPeriodo = vehicles.filter((v) => {
      const y = toLocalYmd(v.data_saida);
      return !!(y && y >= range.from && y <= range.to);
    });

    let receitaPeriodo = 0;
    let contasReceber = 0;
    const receitaByFin = new Map<string, number>();
    const receitaByCidade = new Map<string, number>();
    const receitaByEstado = new Map<string, number>();
    const receitaByVehicle = new Map<string, number>();
    const receitaByDay = new Map<string, number>();
    const receitaByYm = new Map<string, number>();

    for (const r of receivables) {
      const val = Number(r.valor || 0);
      const v = r.vehicle_id ? vmap.get(String(r.vehicle_id)) : undefined;
      if (isAberto(r)) contasReceber += val;
      if (!isFaturado(r)) continue;
      const fat = faturamentoYmd(r, v);
      if (!fat || fat < range.from || fat > range.to) continue;
      receitaPeriodo += val;
      const fin = String(v?.localizador_id || "_sem_");
      receitaByFin.set(fin, (receitaByFin.get(fin) || 0) + val);
      if (v) {
        receitaByCidade.set(cidadeOf(v), (receitaByCidade.get(cidadeOf(v)) || 0) + val);
        receitaByEstado.set(estadoOf(v), (receitaByEstado.get(estadoOf(v)) || 0) + val);
        receitaByVehicle.set(String(v.id), (receitaByVehicle.get(String(v.id)) || 0) + val);
      }
      receitaByDay.set(fat, (receitaByDay.get(fat) || 0) + val);
      const ym = yearMonthFromYmd(fat);
      receitaByYm.set(ym, (receitaByYm.get(ym) || 0) + val);
    }

    const stayList = onPatio.map((v) => stayDays(v, asOf)).filter((d) => d > 0);
    const tempoMedio = avg(stayList);
    const ocupacaoPct = Math.min(100, (onPatio.length / capacity) * 100);
    const finAtivas = new Set(onPatio.map((v) => String(v.localizador_id || "")).filter(Boolean)).size;
    const veiculosComReceita = [...receitaByVehicle.keys()].length;
    const receitaMediaVeiculo = veiculosComReceita ? receitaPeriodo / veiculosComReceita : 0;
    const diasPeriodo = Math.max(
      1,
      Math.ceil((ymdToDate(range.to).getTime() - ymdToDate(range.from).getTime()) / 86400000) + 1
    );
    const receitaMediaDia = receitaPeriodo / diasPeriodo;

    const kpi = (key: string, label: string, value: number, format: KpiNumber["format"], meta?: string): KpiNumber => ({
      key,
      label,
      value,
      format,
      meta,
    });

    // —— 24m series ——
    const months24 = lastNMonths(asOf, 24);
    const labels24 = months24.map(labelYm);
    const ent24 = emptyDual(labels24, "Entradas", "Saídas");
    const rec24 = emptyNumber(labels24);
    const occ24 = emptyNumber(labels24);
    const stay24 = emptyNumber(labels24);

    months24.forEach((ym, i) => {
      const mStart = monthStartYm(ym);
      const mEnd = monthEndYm(ym);
      let e = 0;
      let s = 0;
      const stays: number[] = [];
      let onPatioApprox = 0;
      for (const v of vehicles) {
        const ent = toLocalYmd(v.data_entrada);
        const sai = toLocalYmd(v.data_saida);
        if (ent && ent >= mStart && ent <= mEnd) e++;
        if (sai && sai >= mStart && sai <= mEnd) {
          s++;
          if (ent) stays.push(stayDays({ ...v, data_saida: sai }, sai));
        }
        // snapshot occupancy end-of-month approximation
        if (ent && ent <= mEnd && (!sai || sai > mEnd)) onPatioApprox++;
      }
      ent24.a[i] = e;
      ent24.b[i] = s;
      rec24.values[i] = receitaByYm.get(ym) || 0;
      // rebuild month revenue from all filtered faturados
      let monthRec = 0;
      for (const r of receivables) {
        if (!isFaturado(r)) continue;
        const vv = r.vehicle_id ? vmap.get(String(r.vehicle_id)) : undefined;
        const fat = faturamentoYmd(r, vv);
        if (fat && fat >= mStart && fat <= mEnd) monthRec += Number(r.valor || 0);
      }
      rec24.values[i] = monthRec;
      occ24.values[i] = Math.min(100, (onPatioApprox / capacity) * 100);
      stay24.values[i] = avg(stays.length ? stays : stayList.slice(0, 0));
      // for months without exits, use active vehicles that were present
      if (!stays.length) {
        const presentDays: number[] = [];
        for (const v of vehicles) {
          const ent = toLocalYmd(v.data_entrada);
          const sai = toLocalYmd(v.data_saida);
          if (ent && ent <= mEnd && (!sai || sai > mStart)) {
            presentDays.push(stayDays(v, mEnd < asOf ? mEnd : asOf));
          }
        }
        stay24.values[i] = avg(presentDays);
      }
    });

    // —— Ranking financeiras ——
    const finStats = new Map<
      string,
      { veiculos: number; receita: number; stays: number[]; movs: number }
    >();
    for (const v of vehicles) {
      const id = String(v.localizador_id || "_sem_");
      const st = finStats.get(id) || { veiculos: 0, receita: 0, stays: [], movs: 0 };
      if (isOnPatio(v)) {
        st.veiculos++;
        st.stays.push(stayDays(v, asOf));
      }
      const ent = toLocalYmd(v.data_entrada);
      const sai = toLocalYmd(v.data_saida);
      if (ent && ent >= range.from && ent <= range.to) st.movs++;
      if (sai && sai >= range.from && sai <= range.to) st.movs++;
      finStats.set(id, st);
    }
    for (const [fin, val] of receitaByFin) {
      const st = finStats.get(fin) || { veiculos: 0, receita: 0, stays: [], movs: 0 };
      st.receita = val;
      finStats.set(fin, st);
    }
    const totalRecFin = sumMap(receitaByFin) || 1;
    const ranking: RankingRow[] = [...finStats.entries()]
      .map(([id, st]) => ({
        id,
        nome: id === "_sem_" ? "Sem financeira" : partnerName(pmap, id),
        veiculos: st.veiculos,
        receita: st.receita,
        tempoMedio: avg(st.stays),
        ticketMedio: st.veiculos ? st.receita / Math.max(1, st.veiculos) : st.receita,
        movimentacoes: st.movs,
        participacaoPct: (st.receita / totalRecFin) * 100,
      }))
      .sort((a, b) => b.receita - a.receita || b.veiculos - a.veiculos);

    const receitaTop20 = ranking.slice(0, 20).map((r) => ({
      id: r.id,
      label: r.nome,
      value: r.receita,
    }));
    const pizzaTotal = ranking.reduce((s, r) => s + r.receita, 0) || 1;
    const participacaoPizza: SlicePct[] = ranking.slice(0, 8).map((r) => ({
      key: r.id,
      label: r.nome,
      count: r.veiculos,
      value: r.receita,
      pct: (r.receita / pizzaTotal) * 100,
    }));

    // Evolução mensal top 5 financeiras
    const top5 = ranking.slice(0, 5);
    const months12 = lastNMonths(asOf, 12);
    const evolucaoMensal = {
      labels: months12.map(labelYm),
      series: top5.map((fin) => ({
        id: fin.id,
        name: fin.nome,
        values: months12.map((ym) => {
          const mStart = monthStartYm(ym);
          const mEnd = monthEndYm(ym);
          let s = 0;
          for (const r of receivables) {
            if (!isFaturado(r)) continue;
            const vv = r.vehicle_id ? vmap.get(String(r.vehicle_id)) : undefined;
            if (String(vv?.localizador_id || "_sem_") !== fin.id) continue;
            const fat = faturamentoYmd(r, vv);
            if (fat && fat >= mStart && fat <= mEnd) s += Number(r.valor || 0);
          }
          return s;
        }),
      })),
    };

    // —— Permanência ——
    const distCounts = new Map<string, number>();
    for (const b of PERM_BUCKETS) distCounts.set(b.key, 0);
    const histMap = new Map<number, number>();
    const heatMap = new Map<string, number>();
    const heatFins = new Set<string>();

    for (const v of onPatio) {
      const d = stayDays(v, asOf);
      const bk = permBucketKey(d);
      distCounts.set(bk, (distCounts.get(bk) || 0) + 1);
      const bin = Math.min(180, Math.floor(d / 5) * 5);
      histMap.set(bin, (histMap.get(bin) || 0) + 1);
      const fin = String(v.localizador_id || "_sem_");
      heatFins.add(fin);
      const hk = `${fin}|${bk}`;
      heatMap.set(hk, (heatMap.get(hk) || 0) + 1);
    }
    const distTotal = onPatio.length || 1;
    const distribuicao: SlicePct[] = PERM_BUCKETS.map((b) => ({
      key: b.key,
      label: b.label,
      count: distCounts.get(b.key) || 0,
      value: distCounts.get(b.key) || 0,
      pct: ((distCounts.get(b.key) || 0) / distTotal) * 100,
    }));
    const histograma = [...histMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([bin, count]) => ({ label: `${bin}–${bin + 4}`, value: count, id: String(bin) }));

    const heatFinList = [...heatFins]
      .map((id) => ({ id, label: id === "_sem_" ? "Sem financeira" : partnerName(pmap, id) }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"))
      .slice(0, 15);
    const heatmap: HeatCell[] = [];
    for (const f of heatFinList) {
      for (const b of PERM_BUCKETS) {
        heatmap.push({
          rowId: f.id,
          rowLabel: f.label,
          colKey: b.key,
          colLabel: b.label,
          value: heatMap.get(`${f.id}|${b.key}`) || 0,
        });
      }
    }

    const top50: PermanenceRow[] = onPatio
      .map((v) => ({
        vehicleId: String(v.id),
        placa: String(v.placa || "—"),
        modelo: [v.marca, v.modelo].filter(Boolean).join(" ") || "—",
        financeira: partnerName(pmap, v.localizador_id),
        dias: stayDays(v, asOf),
        status: String(v.status || "—"),
        valorAcumulado: valorAcumulado(v, asOf),
      }))
      .sort((a, b) => b.dias - a.dias)
      .slice(0, 50);

    // —— Receita page ——
    const weekFrom = addDaysYmd(asOf, -6);
    const monthFrom = monthStartYm(yearMonthFromYmd(asOf));
    const yearFrom = `${asOf.slice(0, 4)}-01-01`;
    let recDia = 0;
    let recSem = 0;
    let recMes = 0;
    let recAno = 0;
    let recAcum = 0;
    for (const r of receivables) {
      if (!isFaturado(r)) continue;
      const vv = r.vehicle_id ? vmap.get(String(r.vehicle_id)) : undefined;
      const fat = faturamentoYmd(r, vv);
      if (!fat) continue;
      const val = Number(r.valor || 0);
      recAcum += val;
      if (fat === asOf) recDia += val;
      if (fat >= weekFrom && fat <= asOf) recSem += val;
      if (fat >= monthFrom && fat <= asOf) recMes += val;
      if (fat >= yearFrom && fat <= asOf) recAno += val;
    }

    const days30 = [];
    for (let i = 29; i >= 0; i--) days30.push(addDaysYmd(asOf, -i));
    const diariaSeries = {
      labels: days30.map((d) => d.slice(8)),
      values: days30.map((d) => {
        let s = 0;
        for (const r of receivables) {
          if (!isFaturado(r)) continue;
          const vv = r.vehicle_id ? vmap.get(String(r.vehicle_id)) : undefined;
          if (faturamentoYmd(r, vv) === d) s += Number(r.valor || 0);
        }
        return s;
      }),
    };
    let run = 0;
    const acumuladaSeries = {
      labels: days30.map((d) => d.slice(8)),
      values: diariaSeries.values.map((v) => {
        run += v;
        return run;
      }),
    };
    const thisYear = asOf.slice(0, 4);
    const prevYear = String(Number(thisYear) - 1);
    const monthsY = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
    const comparativoAnual = {
      labels: monthsY.map((m) => m),
      a: monthsY.map((m) => {
        const ym = `${thisYear}-${m}`;
        let s = 0;
        for (const r of receivables) {
          if (!isFaturado(r)) continue;
          const vv = r.vehicle_id ? vmap.get(String(r.vehicle_id)) : undefined;
          const fat = faturamentoYmd(r, vv);
          if (fat && yearMonthFromYmd(fat) === ym) s += Number(r.valor || 0);
        }
        return s;
      }),
      b: monthsY.map((m) => {
        const ym = `${prevYear}-${m}`;
        let s = 0;
        for (const r of receivables) {
          if (!isFaturado(r)) continue;
          const vv = r.vehicle_id ? vmap.get(String(r.vehicle_id)) : undefined;
          const fat = faturamentoYmd(r, vv);
          if (fat && yearMonthFromYmd(fat) === ym) s += Number(r.valor || 0);
        }
        return s;
      }),
      aLabel: thisYear,
      bLabel: prevYear,
    };

    const metaValor = Number(snapshot.settings?.metaReceitaMensal || 0);
    const metaVsRealizado =
      metaValor > 0
        ? {
            meta: metaValor,
            realizado: recMes,
            pct: (recMes / metaValor) * 100,
            nome: snapshot.settings?.metaReceitaNome || "Meta mensal",
          }
        : null;

    // —— Movimentação ——
    const entradasPorDia = {
      labels: days30.map((d) => d.slice(8)),
      values: days30.map(
        (d) => vehicles.filter((v) => toLocalYmd(v.data_entrada) === d).length
      ),
    };
    const saidasPorDia = {
      labels: days30.map((d) => d.slice(8)),
      values: days30.map(
        (d) => vehicles.filter((v) => toLocalYmd(v.data_saida) === d).length
      ),
    };
    const entradasPorMes = {
      labels: months12.map(labelYm),
      values: months12.map((ym) => {
        const a = monthStartYm(ym);
        const b = monthEndYm(ym);
        return vehicles.filter((v) => {
          const y = toLocalYmd(v.data_entrada);
          return y && y >= a && y <= b;
        }).length;
      }),
    };
    const saidasPorMes = {
      labels: months12.map(labelYm),
      values: months12.map((ym) => {
        const a = monthStartYm(ym);
        const b = monthEndYm(ym);
        return vehicles.filter((v) => {
          const y = toLocalYmd(v.data_saida);
          return y && y >= a && y <= b;
        }).length;
      }),
    };
    const movByCidade = new Map<string, number>();
    const movByFin = new Map<string, number>();
    for (const v of [...entradasPeriodo, ...saidasPeriodo]) {
      movByCidade.set(cidadeOf(v), (movByCidade.get(cidadeOf(v)) || 0) + 1);
      const fin = String(v.localizador_id || "_sem_");
      movByFin.set(fin, (movByFin.get(fin) || 0) + 1);
    }

    // —— Eficiência (eventos) ——
    const stageOrder = [
      { key: "recebimento", label: "Recebimento → Conferência" },
      { key: "conferencia", label: "Conferência → Vistoria" },
      { key: "vistoria", label: "Vistoria → Liberação" },
      { key: "liberacao", label: "Liberação → Entrega" },
    ] as const;
    const byVehicleEvents = new Map<string, { stage: string; ymd: Ymd }[]>();
    for (const e of events) {
      if (!e.vehicle_id || !vIds.has(String(e.vehicle_id))) continue;
      const stage = classifyEventStage(e.tipo);
      const y = eventYmd(e);
      if (!stage || !y) continue;
      const list = byVehicleEvents.get(String(e.vehicle_id)) || [];
      list.push({ stage, ymd: y });
      byVehicleEvents.set(String(e.vehicle_id), list);
    }
    // fallback: entrada / vistoria_data / saida
    for (const v of vehicles) {
      const list = byVehicleEvents.get(String(v.id)) || [];
      const ent = toLocalYmd(v.data_entrada);
      if (ent && !list.some((x) => x.stage === "recebimento")) list.push({ stage: "recebimento", ymd: ent });
      const vis = toLocalYmd(v.vistoria_data);
      if (vis && !list.some((x) => x.stage === "vistoria")) list.push({ stage: "vistoria", ymd: vis });
      const sai = toLocalYmd(v.data_saida);
      if (sai && !list.some((x) => x.stage === "entrega")) list.push({ stage: "entrega", ymd: sai });
      if (list.length) byVehicleEvents.set(String(v.id), list);
    }

    const gaps: Record<string, number[]> = {
      recebimento: [],
      conferencia: [],
      vistoria: [],
      liberacao: [],
    };
    const chain = ["recebimento", "conferencia", "vistoria", "liberacao", "entrega"];
    for (const list of byVehicleEvents.values()) {
      const first: Record<string, Ymd> = {};
      for (const item of list) {
        if (!first[item.stage] || item.ymd < first[item.stage]) first[item.stage] = item.ymd;
      }
      for (let i = 0; i < chain.length - 1; i++) {
        const a = first[chain[i]];
        const b = first[chain[i + 1]];
        if (a && b && b >= a) {
          const days = Math.max(
            0,
            Math.ceil((ymdToDate(b).getTime() - ymdToDate(a).getTime()) / 86400000)
          );
          gaps[chain[i]].push(days);
        }
      }
    }
    const estagios: StageTiming[] = stageOrder.map((s) => ({
      key: s.key,
      label: s.label,
      avgDays: avg(gaps[s.key] || []),
      sample: (gaps[s.key] || []).length,
    }));
    const gargalos = [...estagios].sort((a, b) => b.avgDays - a.avgDays);

    // —— Alertas ——
    const alertas: BiAlert[] = [];
    const pushAlert = (
      id: string,
      priority: AlertPriority,
      title: string,
      detail: string,
      count?: number
    ) => {
      alertas.push({ id, priority, title, detail, count });
    };
    const above90 = onPatio.filter((v) => stayDays(v, asOf) > 90);
    if (above90.length) {
      pushAlert(
        "perm90",
        "red",
        "Veículos acima de 90 dias",
        `${above90.length} veículo(s) com permanência crítica.`,
        above90.length
      );
    }
    const finsComMov = new Set<string>();
    for (const v of vehicles) {
      const ent = toLocalYmd(v.data_entrada);
      const sai = toLocalYmd(v.data_saida);
      if ((ent && ent >= range.from && ent <= range.to) || (sai && sai >= range.from && sai <= range.to)) {
        if (v.localizador_id) finsComMov.add(String(v.localizador_id));
      }
    }
    const finsSemMov = filterOptions.financeiras.filter((f) => !finsComMov.has(f.id));
    if (finsSemMov.length) {
      pushAlert(
        "fin_idle",
        "yellow",
        "Financeiras sem movimentação",
        `${finsSemMov.length} financeira(s) sem entradas/saídas no período.`,
        finsSemMov.length
      );
    }
    // receita trend: last 30d vs previous 30d
    const prevFrom = addDaysYmd(range.from, -diasPeriodo);
    const prevTo = addDaysYmd(range.from, -1);
    let prevRec = 0;
    for (const r of receivables) {
      if (!isFaturado(r)) continue;
      const vv = r.vehicle_id ? vmap.get(String(r.vehicle_id)) : undefined;
      const fat = faturamentoYmd(r, vv);
      if (fat && fat >= prevFrom && fat <= prevTo) prevRec += Number(r.valor || 0);
    }
    if (prevRec > 0 && receitaPeriodo < prevRec * 0.85) {
      pushAlert(
        "rec_drop",
        "red",
        "Queda de receita",
        `Receita do período ${(receitaPeriodo / prevRec * 100).toFixed(0)}% do período anterior.`,
        1
      );
    } else if (prevRec > 0 && receitaPeriodo >= prevRec) {
      pushAlert("rec_ok", "green", "Receita estável/crescente", "Receita no período igual ou acima do anterior.");
    }
    const prevStay = avg(
      vehicles
        .filter((v) => {
          const sai = toLocalYmd(v.data_saida);
          return !!(sai && sai >= prevFrom && sai <= prevTo);
        })
        .map((v) => stayDays(v, toLocalYmd(v.data_saida) || asOf))
    );
    if (prevStay > 0 && tempoMedio > prevStay * 1.15) {
      pushAlert(
        "stay_up",
        "yellow",
        "Aumento do tempo médio de permanência",
        `Tempo médio atual ${tempoMedio.toFixed(1)}d vs ${prevStay.toFixed(1)}d no período anterior.`
      );
    }
    if (ocupacaoPct < 40) {
      pushAlert("occ_low", "yellow", "Queda de ocupação", `Ocupação atual em ${ocupacaoPct.toFixed(0)}%.`);
    } else if (ocupacaoPct >= 85) {
      pushAlert("occ_high", "red", "Ocupação elevada", `Ocupação atual em ${ocupacaoPct.toFixed(0)}%.`);
    }
    const maxEnt = Math.max(...entradasPorDia.values, 0);
    const avgEnt = avg(entradasPorDia.values);
    if (maxEnt >= Math.max(3, avgEnt * 2.5) && maxEnt > 0) {
      pushAlert("peak_in", "yellow", "Picos de entrada", `Dia com até ${maxEnt} entradas (média ${avgEnt.toFixed(1)}).`);
    }
    const maxSai = Math.max(...saidasPorDia.values, 0);
    const avgSai = avg(saidasPorDia.values);
    if (maxSai >= Math.max(3, avgSai * 2.5) && maxSai > 0) {
      pushAlert("peak_out", "yellow", "Picos de saída", `Dia com até ${maxSai} saídas (média ${avgSai.toFixed(1)}).`);
    }
    const pendCrit = onPatio.filter(
      (v) =>
        String(v.nfse_status || "").toUpperCase() === "PENDENTE" ||
        String(v.status || "") === "LIBERACAO_SOLICITADA"
    );
    if (pendCrit.length) {
      pushAlert(
        "pend",
        "red",
        "Pendências críticas",
        `${pendCrit.length} veículo(s) com NF pendente ou liberação solicitada.`,
        pendCrit.length
      );
    }
    const prioRank = { red: 0, yellow: 1, green: 2 };
    alertas.sort((a, b) => prioRank[a.priority] - prioRank[b.priority]);

    // —— Drill ——
    const drillReceitaPorFinanceira: DrillLevel = {
      key: "financeiras",
      label: "Receita por Financeira",
      rows: ranking.map((r) => ({
        id: r.id,
        label: r.nome,
        value: r.receita,
        format: "money" as const,
        meta: `${r.veiculos} veículos`,
      })),
    };
    const drillVeiculosPorFinanceira: Record<string, DrillLevel> = {};
    for (const fin of ranking.slice(0, 30)) {
      const rows = vehicles
        .filter((v) => String(v.localizador_id || "_sem_") === fin.id)
        .map((v) => ({
          id: String(v.id),
          label: `${v.placa || "—"} · ${[v.marca, v.modelo].filter(Boolean).join(" ") || "—"}`,
          value: receitaByVehicle.get(String(v.id)) || valorAcumulado(v, asOf),
          format: "money" as const,
          meta: `${stayDays(v, asOf)} dias · ${v.status || "—"}`,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 100);
      drillVeiculosPorFinanceira[fin.id] = {
        key: `veiculos:${fin.id}`,
        label: `Veículos · ${fin.nome}`,
        rows,
      };
    }

    return {
      asOfYmd: asOf,
      range,
      filterOptions,
      overview: {
        kpis: [
          kpi("ativos", "Veículos armazenados", onPatio.length, "int", "no pátio agora"),
          kpi("entradas", "Entradas no período", entradasPeriodo.length, "int"),
          kpi("saidas", "Saídas no período", saidasPeriodo.length, "int"),
          kpi("tempo", "Tempo médio de permanência", tempoMedio, "days"),
          kpi("receita", "Receita do período", receitaPeriodo, "money"),
          kpi("receber", "Contas a receber", contasReceber, "money"),
          kpi("ocupacao", "Taxa de ocupação", ocupacaoPct, "pct", `cap. ${capacity}`),
          kpi("fins", "Financeiras ativas", finAtivas, "int"),
          kpi("ticket", "Receita média por veículo", receitaMediaVeiculo, "money"),
          kpi("recdia", "Receita média por dia", receitaMediaDia, "money"),
        ],
        entradasSaidas24m: ent24,
        receitaMensal24m: rec24,
        ocupacaoTimeline: occ24,
        tempoMedioTimeline: stay24,
        receitaPorCidade: topSeriesPoints(receitaByCidade, (id) => id, 15),
        receitaPorEstado: topSeriesPoints(receitaByEstado, (id) => id, 15),
      },
      financeiras: {
        ranking,
        receitaTop20,
        participacaoPizza,
        evolucaoMensal,
      },
      permanencia: {
        distribuicao,
        histograma,
        heatmap,
        heatmapCols: PERM_BUCKETS.map((b) => ({ key: b.key, label: b.label })),
        top50,
      },
      receita: {
        kpis: [
          kpi("dia", "Receita diária", recDia, "money", "hoje"),
          kpi("sem", "Receita semanal", recSem, "money", "7 dias"),
          kpi("mes", "Receita mensal", recMes, "money", "mês atual"),
          kpi("ano", "Receita anual", recAno, "money", "ano atual"),
          kpi("acum", "Receita acumulada", recAcum, "money", "histórico filtrado"),
          kpi("ticket", "Ticket médio", receitaMediaVeiculo, "money"),
          kpi("por_veic", "Receita por veículo", receitaMediaVeiculo, "money"),
          kpi(
            "por_fin",
            "Receita por financeira",
            ranking.length ? receitaPeriodo / ranking.length : 0,
            "money",
            "média"
          ),
        ],
        acumulada: acumuladaSeries,
        diaria: diariaSeries,
        comparativoAnual,
        metaVsRealizado,
      },
      movimentacao: {
        entradasPorDia,
        saidasPorDia,
        entradasPorMes,
        saidasPorMes,
        porCidade: topSeriesPoints(movByCidade, (id) => id, 15),
        porFinanceira: topSeriesPoints(
          movByFin,
          (id) => (id === "_sem_" ? "Sem financeira" : partnerName(pmap, id)),
          15
        ),
      },
      eficiencia: { estagios, gargalos },
      alertas,
      drillReceitaPorFinanceira,
      drillVeiculosPorFinanceira,
    };
  }
}

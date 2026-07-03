/**
 * Dashboard financeiro inteligente — métricas históricas reais (abril/2026+).
 */
(function financeDashboardModule(global) {
  "use strict";

  let _cache = null;
  const FINANCE_METRICS_FROM_YMD = "2026-04-01";

  function isCalendarYmd(v) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(v || "").trim());
  }

  function toLocalYmd(value) {
    if (!value) return null;
    const s = String(value).trim();
    if (isCalendarYmd(s)) return s;
    const d = new Date(s.includes("T") ? s : `${s.slice(0, 10)}T12:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function todayYmd() {
    return toLocalYmd(new Date());
  }

  function ymdToDate(ymd) {
    return new Date(`${ymd}T12:00:00`);
  }

  function addDaysYmd(ymd, days) {
    const d = ymdToDate(ymd);
    d.setDate(d.getDate() + days);
    return toLocalYmd(d);
  }

  function yearMonthFromYmd(ymd) {
    if (!ymd || ymd.length < 7) return null;
    return ymd.slice(0, 7);
  }

  function monthStartYm(ym) {
    return `${ym}-01`;
  }

  function monthEndYm(ym) {
    const [y, m] = ym.split("-").map(Number);
    const last = new Date(y, m, 0).getDate();
    return `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  }

  function enumerateYmdRange(fromYmd, toYmd) {
    if (!fromYmd || !toYmd || fromYmd > toYmd) return [];
    const out = [];
    let cur = fromYmd;
    while (cur <= toYmd) {
      out.push(cur);
      cur = addDaysYmd(cur, 1);
    }
    return out;
  }

  function isoWeekMondayYmd(ymd) {
    const d = ymdToDate(ymd);
    const dow = d.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    d.setDate(d.getDate() + diff);
    return toLocalYmd(d);
  }

  function isoWeekSundayYmd(mondayYmd) {
    return addDaysYmd(mondayYmd, 6);
  }

  function avgOf(values) {
    if (!values.length) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  function pctChange(current, previous) {
    if (!previous || previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  function lastClosedYmd() {
    return addDaysYmd(todayYmd(), -1);
  }

  function metricsStartYmd(receivables) {
    let first = null;
    for (const r of receivables || []) {
      const ymd = receivableFaturamentoYmd(r, null);
      if (ymd && (!first || ymd < first)) first = ymd;
    }
    if (!first || first < FINANCE_METRICS_FROM_YMD) return FINANCE_METRICS_FROM_YMD;
    return first;
  }

  function vehicleById(vehicles) {
    return new Map((vehicles || []).map((v) => [String(v.id), v]));
  }

  function dedupeReceivables(list) {
    if (typeof global.financeDedupePatioReceivables === "function") {
      return global.financeDedupePatioReceivables(list);
    }
    return list || [];
  }

  function dedupeCash(list) {
    if (typeof global.financeDedupeCaixaMovs === "function") {
      return global.financeDedupeCaixaMovs(list);
    }
    return list || [];
  }

  function receivableValor(r) {
    return Math.max(0, Number(r?.valor || 0));
  }

  function isReceivableFaturado(r) {
    if (!r || receivableValor(r) <= 0) return false;
    const st = String(r.status || "").toUpperCase();
    if (st === "PAGO") return true;
    if (r.financeiro_aprovado_contas_receber === true) return true;
    if (!r.vehicle_id && st === "EM_ABERTO") return true;
    return false;
  }

  function isContaReceberAberta(r) {
    if (!r || String(r.status || "").toUpperCase() === "PAGO") return false;
    if (receivableValor(r) <= 0) return false;
    if (typeof global.receivableAprovadoParaContasReceber === "function" && global.receivableAprovadoParaContasReceber(r)) {
      return true;
    }
    if (r.financeiro_aprovado_contas_receber === true) return true;
    if (!r.vehicle_id && String(r.status || "").toUpperCase() === "EM_ABERTO") return true;
    return false;
  }

  function receivableFaturamentoYmd(r, vmap) {
    if (!r) return null;
    const v = r.vehicle_id ? vmap?.get(String(r.vehicle_id)) : null;
    if (typeof global.financeReceivableSaidaYmd === "function") {
      const ymd = global.financeReceivableSaidaYmd(r, v);
      if (ymd) return ymd;
    }
    return toLocalYmd(r.period_end || r.data_vencimento || r.created_at);
  }

  function receivableDueYmd(r) {
    return toLocalYmd(r?.data_vencimento || r?.period_end || r?.created_at);
  }

  function buildCashByContaId(cash) {
    return new Map(
      dedupeCash(cash || [])
        .filter((m) => {
          const t = String(m?.tipo_conta || "").toUpperCase();
          return (t === "RECEBER" || t === "ENTRADA") && m?.conta_id != null;
        })
        .map((m) => [String(m.conta_id), m])
    );
  }

  function recebimentoYmd(r, cashByContaId) {
    if (!r || String(r.status || "").toUpperCase() !== "PAGO") return null;
    const mov = cashByContaId.get(String(r.id));
    if (mov) {
      const ymd = toLocalYmd(mov.data_movimento || mov.created_at);
      if (ymd) return ymd;
    }
    return toLocalYmd(r.updated_at || r.created_at);
  }

  function cashMovValor(mov) {
    if (typeof global.financeCashMovValor === "function") return global.financeCashMovValor(mov);
    return Math.max(0, Number(mov?.valor || 0));
  }

  function cashIsEntrada(mov) {
    const t = String(mov?.tipo_conta || "").toUpperCase();
    return t === "RECEBER" || t === "ENTRADA";
  }

  function cashIsSaida(mov) {
    const t = String(mov?.tipo_conta || "").toUpperCase().replace(/\s/g, "");
    return t === "PAGAR" || t === "SAIDA" || t === "SAÍDA";
  }

  function cashAprovado(mov) {
    if (typeof global.financeOperationalModeActive === "function" && global.financeOperationalModeActive()) {
      if (typeof global.financeCashAprovadoCaixa === "function") {
        return global.financeCashAprovadoCaixa(mov);
      }
      return mov?.aprovado_caixa === true;
    }
    return true;
  }

  function caixaMovsOperacionais(cash) {
    const list = dedupeCash(cash || []).filter((m) => cashAprovado(m));
    return list;
  }

  function caixaCompetenciaYmd(mov) {
    if (typeof global.financeCaixaMovCompetenciaYmd === "function") {
      return global.financeCaixaMovCompetenciaYmd(mov);
    }
    return toLocalYmd(mov?.data_movimento || mov?.created_at);
  }

  function buildDailyMap(receivables, vmap, fromYmd, toYmd, valueFn) {
    const map = new Map();
    for (const day of enumerateYmdRange(fromYmd, toYmd)) map.set(day, 0);
    for (const r of dedupeReceivables(receivables)) {
      const ymd = valueFn(r, vmap);
      if (!ymd || ymd < fromYmd || ymd > toYmd) continue;
      if (!map.has(ymd)) continue;
      map.set(ymd, map.get(ymd) + receivableValor(r));
    }
    return map;
  }

  function dataSignature(data) {
    const parts = ["receivables", "payables", "cash", "vehicles"].map((k) => {
      const arr = data[k] || [];
      let maxTs = 0;
      for (const row of arr) {
        const ts = new Date(row.updated_at || row.created_at || 0).getTime();
        if (Number.isFinite(ts)) maxTs = Math.max(maxTs, ts);
      }
      return `${arr.length}:${maxTs}`;
    });
    return parts.join("|");
  }

  function computeMetrics(data) {
    const receivables = data.receivables || [];
    const cash = data.cash || [];
    const vehicles = data.vehicles || [];
    const vmap = vehicleById(vehicles);
    const lastClosed = lastClosedYmd();
    const fromYmd = metricsStartYmd(receivables);
    const cashByConta = buildCashByContaId(cash);
    const empty = { hasData: false, lastClosed, fromYmd: FINANCE_METRICS_FROM_YMD };

    if (!fromYmd || fromYmd > lastClosed) return empty;

    const faturados = dedupeReceivables(receivables).filter((r) => isReceivableFaturado(r));
    const closedDays = enumerateYmdRange(fromYmd, lastClosed);

    const faturamentoMap = buildDailyMap(receivables, vmap, fromYmd, lastClosed, (r) =>
      isReceivableFaturado(r) ? receivableFaturamentoYmd(r, vmap) : null
    );
    const recebimentoMap = buildDailyMap(receivables, vmap, fromYmd, lastClosed, (r) =>
      recebimentoYmd(r, cashByConta)
    );

    const faturamentoDaily = closedDays.map((d) => faturamentoMap.get(d) || 0);
    const dailyBillingAvg = avgOf(faturamentoDaily);
    const billingDailyTrend = pctChange(
      avgOf(faturamentoDaily.slice(-30)),
      avgOf(faturamentoDaily.slice(-60, -30))
    );
    const billingDailySpark = faturamentoDaily.slice(-14);

    const weekMap = new Map();
    for (const day of closedDays) {
      const mon = isoWeekMondayYmd(day);
      if (!weekMap.has(mon)) weekMap.set(mon, 0);
      weekMap.set(mon, weekMap.get(mon) + (faturamentoMap.get(day) || 0));
    }
    const completeWeeks = [...weekMap.entries()]
      .filter(([mon]) => isoWeekSundayYmd(mon) <= lastClosed)
      .sort((a, b) => a[0].localeCompare(b[0]));
    const weeklyTotals = completeWeeks.map(([, v]) => v);
    const weeklyBillingAvg = avgOf(weeklyTotals);
    const billingWeeklyTrend = pctChange(
      avgOf(weeklyTotals.slice(-4)),
      avgOf(weeklyTotals.slice(-8, -4))
    );
    const billingWeeklySpark = weeklyTotals.slice(-8);

    const months = [...new Set(closedDays.map(yearMonthFromYmd))].sort();
    const monthlyBillingTotals = months.map((ym) => {
      const start = monthStartYm(ym) < fromYmd ? fromYmd : monthStartYm(ym);
      const end = monthEndYm(ym) > lastClosed ? lastClosed : monthEndYm(ym);
      let s = 0;
      for (const d of enumerateYmdRange(start, end)) s += faturamentoMap.get(d) || 0;
      return s;
    });
    const monthlyBillingAvg = avgOf(monthlyBillingTotals);
    const billingMonthlyTrend = pctChange(
      avgOf(monthlyBillingTotals.slice(-3)),
      avgOf(monthlyBillingTotals.slice(-6, -3))
    );
    const billingMonthlySpark = monthlyBillingTotals.slice(-6);

    const collectionDays = [];
    for (const r of faturados) {
      if (String(r.status || "").toUpperCase() !== "PAGO") continue;
      const fat = receivableFaturamentoYmd(r, vmap);
      const rec = recebimentoYmd(r, cashByConta);
      if (!fat || !rec || fat < FINANCE_METRICS_FROM_YMD) continue;
      const diff = Math.max(0, Math.floor((ymdToDate(rec) - ymdToDate(fat)) / 86400000));
      collectionDays.push(diff);
    }
    const avgCollectionDays = avgOf(collectionDays);
    const recentCollection = collectionDays.slice(-20);
    const priorCollection = collectionDays.slice(-40, -20);
    const collectionTrend = pctChange(avgOf(recentCollection), avgOf(priorCollection));

    const billedVehicles = new Set();
    let totalFaturadoHistorico = 0;
    for (const r of faturados) {
      const fat = receivableFaturamentoYmd(r, vmap);
      if (!fat || fat < FINANCE_METRICS_FROM_YMD) continue;
      totalFaturadoHistorico += receivableValor(r);
      if (r.vehicle_id) billedVehicles.add(String(r.vehicle_id));
    }
    const billedUnits = billedVehicles.size + faturados.filter((r) => !r.vehicle_id).length;
    const ticketMedio = billedUnits > 0 ? totalFaturadoHistorico / billedUnits : 0;

    const recentTicket = [];
    const olderTicket = [];
    for (const r of faturados) {
      const fat = receivableFaturamentoYmd(r, vmap);
      if (!fat || fat < FINANCE_METRICS_FROM_YMD) continue;
      const sixMonthsAgo = addDaysYmd(todayYmd(), -183);
      if (fat >= sixMonthsAgo) recentTicket.push(receivableValor(r));
      else olderTicket.push(receivableValor(r));
    }
    const ticketTrend = pctChange(avgOf(recentTicket), avgOf(olderTicket));

    const contasAbertas = dedupeReceivables(receivables).filter(isContaReceberAberta);
    const totalAberto = contasAbertas.reduce((s, r) => s + receivableValor(r), 0);
    const pendentes = contasAbertas.length;
    const currentYm = yearMonthFromYmd(todayYmd());
    const vencidosDia = contasAbertas.filter((r) => receivableDueYmd(r) === todayYmd()).length;
    const vencidosMes = contasAbertas.filter((r) => yearMonthFromYmd(receivableDueYmd(r)) === currentYm).length;
    const totalVencido = contasAbertas
      .filter((r) => {
        const due = receivableDueYmd(r);
        return due && due < todayYmd();
      })
      .reduce((s, r) => s + receivableValor(r), 0);
    const prevMonthYm = yearMonthFromYmd(addDaysYmd(monthStartYm(currentYm), -1));
    const vencidoPrevMonth = dedupeReceivables(receivables)
      .filter(isContaReceberAberta)
      .filter((r) => {
        const due = receivableDueYmd(r);
        return due && due < monthStartYm(currentYm);
      })
      .reduce((s, r) => s + receivableValor(r), 0);
    const receivableTrend = pctChange(totalVencido, vencidoPrevMonth);

    const monthStart = monthStartYm(currentYm);
    const monthClosedEnd = monthEndYm(currentYm) > lastClosed ? lastClosed : monthEndYm(currentYm);
    let recebidoMes = 0;
    if (monthStart <= monthClosedEnd) {
      for (const d of enumerateYmdRange(monthStart, monthClosedEnd)) {
        recebidoMes += recebimentoMap.get(d) || 0;
      }
    }
    const prevYm = yearMonthFromYmd(addDaysYmd(monthStart, -1));
    const prevStart = monthStartYm(prevYm);
    const prevEnd = monthEndYm(prevYm);
    let recebidoMesAnterior = 0;
    for (const d of enumerateYmdRange(prevStart, prevEnd)) {
      recebidoMesAnterior += recebimentoMap.get(d) || 0;
    }
    const recebidoMesTrend = pctChange(recebidoMes, recebidoMesAnterior);

    let faturadoMes = 0;
    if (monthStart <= monthClosedEnd) {
      for (const d of enumerateYmdRange(monthStart, monthClosedEnd)) {
        faturadoMes += faturamentoMap.get(d) || 0;
      }
    }
    let faturadoMesAnterior = 0;
    for (const d of enumerateYmdRange(prevStart, prevEnd)) {
      faturadoMesAnterior += faturamentoMap.get(d) || 0;
    }
    const faturadoMesTrend = pctChange(faturadoMes, faturadoMesAnterior);
    const faturadoMesSpark = monthlyBillingTotals.slice(-6);

    const recebidoPeriodo = [...recebimentoMap.values()].reduce((a, b) => a + b, 0);
    const inadimplenciaPct = totalAberto > 0 ? (totalVencido / totalAberto) * 100 : 0;
    const inadimplenciaTrend = pctChange(inadimplenciaPct, vencidoPrevMonth > 0 ? (vencidoPrevMonth / totalAberto) * 100 : 0);

    const caixaMovs = caixaMovsOperacionais(cash).filter((m) => {
      const ymd = caixaCompetenciaYmd(m);
      return ymd && ymd >= FINANCE_METRICS_FROM_YMD && ymd <= lastClosed;
    });
    let fluxoEntradas = 0;
    let fluxoSaidas = 0;
    const fluxoMonthly = new Map();
    for (const m of caixaMovs) {
      const ymd = caixaCompetenciaYmd(m);
      const ym = yearMonthFromYmd(ymd);
      const val = cashMovValor(m);
      if (!fluxoMonthly.has(ym)) fluxoMonthly.set(ym, { ent: 0, sai: 0 });
      const bucket = fluxoMonthly.get(ym);
      if (cashIsEntrada(m)) {
        fluxoEntradas += val;
        bucket.ent += val;
      } else if (cashIsSaida(m)) {
        fluxoSaidas += val;
        bucket.sai += val;
      }
    }
    const fluxoSaldo = fluxoEntradas - fluxoSaidas;
    const fluxoSpark = [...fluxoMonthly.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([, b]) => b.ent - b.sai);
    const fluxoTrend = pctChange(
      fluxoSpark.slice(-1)[0] || 0,
      fluxoSpark.slice(-2, -1)[0] || 0
    );

    return {
      hasData: true,
      lastClosed,
      fromYmd: FINANCE_METRICS_FROM_YMD,
      closedDays: closedDays.length,
      dailyBillingAvg,
      billingDailyTrend,
      billingDailySpark,
      weeklyBillingAvg,
      billingWeeklyTrend,
      billingWeeklySpark,
      monthlyBillingAvg,
      billingMonthlyTrend,
      billingMonthlySpark,
      avgCollectionDays,
      collectionTrend,
      ticketMedio,
      ticketTrend,
      billedUnits,
      totalAberto,
      pendentes,
      vencidosDia,
      vencidosMes,
      totalVencido,
      receivableTrend,
      recebidoMes,
      recebidoMesTrend,
      faturadoMes,
      faturadoMesTrend,
      faturadoMesSpark,
      inadimplenciaPct,
      inadimplenciaTrend,
      fluxoEntradas,
      fluxoSaidas,
      fluxoSaldo,
      fluxoTrend,
      fluxoSpark,
      recebidoPeriodo,
    };
  }

  function getMetrics(data) {
    const key = `${dataSignature(data)}:${lastClosedYmd()}`;
    if (_cache?.key === key) return _cache.data;
    const result = computeMetrics(data);
    _cache = { key, data: result };
    return result;
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatTrend(pct, invert) {
    if (!Number.isFinite(pct) || Math.abs(pct) < 0.05) {
      return { text: "estável", cls: "fin-ops-trend--flat", arrow: "→" };
    }
    const up = pct > 0;
    const positive = invert ? !up : up;
    return {
      text: `${up ? "+" : ""}${pct.toFixed(1).replace(".", ",")}%`,
      cls: positive ? "fin-ops-trend--up" : "fin-ops-trend--down",
      arrow: up ? "↑" : "↓",
    };
  }

  function sparklineSvg(values, color) {
    if (!values?.length) return "";
    const w = 88;
    const h = 32;
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const span = max - min || 1;
    const pts = values
      .map((v, i) => {
        const x = values.length === 1 ? w / 2 : (i / (values.length - 1)) * w;
        const y = h - ((v - min) / span) * (h - 4) - 2;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
    return `<svg class="fin-ops-spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">
      <polygon points="0,${h} ${pts} ${w},${h}" fill="${color}" opacity="0.12"></polygon>
      <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline>
    </svg>`;
  }

  function iconSvg(name) {
    const icons = {
      billing: '<path d="M4 20V10M12 20V4M20 20v-8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
      calendar:
        '<rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><path d="M3 10h18" stroke="currentColor" stroke-width="2"/>',
      clock:
        '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 7v5l3 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
      ticket:
        '<path d="M4 8h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4V8z" stroke="currentColor" stroke-width="2" fill="none"/>',
      recv: '<path d="M12 3v18M7 8l5-5 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
      paid: '<path d="M20 12v8H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zm0 0h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" stroke="currentColor" stroke-width="2" fill="none"/>',
      alert:
        '<path d="M12 9v4M12 17h.01M10.3 4.3l-7.2 12.4A2 2 0 0 0 4.7 20h14.6a2 2 0 0 0 1.6-3.3L13.7 4.3a2 2 0 0 0-3.4 0z" stroke="currentColor" stroke-width="2" fill="none"/>',
      flow: '<path d="M4 14h6v6M14 4h6v6M20 16l-8-8-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    };
    return `<svg class="fin-ops-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">${icons[name] || icons.billing}</svg>`;
  }

  function renderCard(opts) {
    const trend = formatTrend(opts.trend, opts.invertTrend);
    const fmt = opts.formatCurrency || ((n) => String(n));
    const value =
      opts.valueType === "currency"
        ? escapeHtml(fmt(opts.value))
        : opts.valueType === "pct"
          ? escapeHtml(`${Number(opts.value).toFixed(1).replace(".", ",")}%`)
          : escapeHtml(String(opts.value));
    return `<article class="fin-ops-card fin-ops-card--${escapeHtml(opts.theme)}">
      <div class="fin-ops-card-top">
        <div class="fin-ops-card-icon">${iconSvg(opts.icon)}</div>
        <div class="fin-ops-card-trend ${trend.cls}" title="${escapeHtml(opts.trendLabel || "")}">
          <span>${trend.arrow}</span><span>${escapeHtml(trend.text)}</span>
        </div>
      </div>
      <span class="fin-ops-card-label">${escapeHtml(opts.label)}</span>
      <strong class="fin-ops-card-value">${value}</strong>
      <small class="fin-ops-card-meta">${escapeHtml(opts.meta || "")}</small>
      <div class="fin-ops-card-spark">${sparklineSvg(opts.spark, opts.sparkColor || "#60a5fa")}</div>
      <small class="fin-ops-card-compare">${escapeHtml(opts.compare || "")}</small>
    </article>`;
  }

  function receivableSaidaYmd(r, vmap) {
    const v = r?.vehicle_id ? vmap.get(String(r.vehicle_id)) : null;
    if (typeof global.financeReceivableSaidaYmd === "function") {
      return global.financeReceivableSaidaYmd(r, v) || null;
    }
    return toLocalYmd(v?.data_saida || r?.period_end) || null;
  }

  function receivableMatchesPartner(r, vmap, partnerId) {
    if (!partnerId) return true;
    const v = r?.vehicle_id ? vmap.get(String(r.vehicle_id)) : null;
    if (typeof global.financeReceivableMatchesRppFilter === "function") {
      return global.financeReceivableMatchesRppFilter(r, v, partnerId);
    }
    return true;
  }

  function recebimentoValor(r, cashByContaId) {
    if (!r) return 0;
    const mov = cashByContaId.get(String(r.id));
    if (mov) return cashMovValor(mov);
    if (String(r.status || "").toUpperCase() === "PAGO") return receivableValor(r);
    return 0;
  }

  function formatMonthLabel(ym) {
    if (!ym || ym.length < 7) return ym || "—";
    const [y, m] = ym.split("-").map(Number);
    const names = [
      "janeiro",
      "fevereiro",
      "março",
      "abril",
      "maio",
      "junho",
      "julho",
      "agosto",
      "setembro",
      "outubro",
      "novembro",
      "dezembro",
    ];
    const name = names[m - 1] || ym;
    return `${name}/${y}`;
  }

  function prevYearMonth(ym) {
    if (!ym || ym.length < 7) return null;
    const [y, m] = ym.split("-").map(Number);
    if (m === 1) return `${y - 1}-12`;
    return `${y}-${String(m - 1).padStart(2, "0")}`;
  }

  /** Receita operacional (saída no mês) vs recebimentos efetivos (data do pagamento). */
  function computePeriodComparison(data, filters = {}) {
    const ym = filters.ym || yearMonthFromYmd(todayYmd());
    const partnerId = filters.partnerId || "";
    const receivables = dedupeReceivables(data.receivables || []);
    const vmap = vehicleById(data.vehicles || []);
    const cashByConta = buildCashByContaId(data.cash || []);
    const monthStart = monthStartYm(ym);
    const monthEnd = monthEndYm(ym);

    let receitaGerada = 0;
    let receitaGeradaUnidades = 0;
    let pagamentosRecebidos = 0;
    let pagamentosUnidades = 0;

    for (const r of receivables) {
      if (!receivableMatchesPartner(r, vmap, partnerId)) continue;
      const val = receivableValor(r);
      const saidaYmd = receivableSaidaYmd(r, vmap);
      if (r.vehicle_id && saidaYmd && saidaYmd >= monthStart && saidaYmd <= monthEnd && val > 0) {
        receitaGerada += val;
        receitaGeradaUnidades += 1;
      }
      const recYmd = recebimentoYmd(r, cashByConta);
      if (recYmd && recYmd >= monthStart && recYmd <= monthEnd) {
        const pago = recebimentoValor(r, cashByConta);
        if (pago > 0) {
          pagamentosRecebidos += pago;
          pagamentosUnidades += 1;
        }
      }
    }

    const prevYm = prevYearMonth(ym);
    let prevReceitaGerada = 0;
    let prevPagamentos = 0;
    if (prevYm) {
      const prevStart = monthStartYm(prevYm);
      const prevEnd = monthEndYm(prevYm);
      for (const r of receivables) {
        if (!receivableMatchesPartner(r, vmap, partnerId)) continue;
        const val = receivableValor(r);
        const saidaYmd = receivableSaidaYmd(r, vmap);
        if (r.vehicle_id && saidaYmd && saidaYmd >= prevStart && saidaYmd <= prevEnd && val > 0) {
          prevReceitaGerada += val;
        }
        const recYmd = recebimentoYmd(r, cashByConta);
        if (recYmd && recYmd >= prevStart && recYmd <= prevEnd) {
          prevPagamentos += recebimentoValor(r, cashByConta);
        }
      }
    }

    const partnerLabel =
      partnerId && typeof global.financePartnerNomeById === "function"
        ? global.financePartnerNomeById(partnerId)
        : partnerId
          ? String(
              (data.partners || []).find((p) => String(p.id) === String(partnerId))?.nome || ""
            ).trim()
          : "";

    return {
      ym,
      monthLabel: formatMonthLabel(ym),
      partnerId,
      partnerLabel,
      receitaGerada,
      receitaGeradaUnidades,
      receitaGeradaTrend: pctChange(receitaGerada, prevReceitaGerada),
      pagamentosRecebidos,
      pagamentosUnidades,
      pagamentosTrend: pctChange(pagamentosRecebidos, prevPagamentos),
      diferenca: receitaGerada - pagamentosRecebidos,
    };
  }

  function renderCompareCard(opts) {
    const trend = formatTrend(opts.trend, opts.invertTrend);
    const fmt = opts.formatCurrency || ((n) => String(n));
    return `<article class="fin-ops-card fin-ops-card--${escapeHtml(opts.theme)}">
      <div class="fin-ops-card-top">
        <div class="fin-ops-card-icon">${iconSvg(opts.icon)}</div>
        <div class="fin-ops-card-trend ${trend.cls}" title="vs. mês anterior">
          <span>${trend.arrow}</span><span>${escapeHtml(trend.text)}</span>
        </div>
      </div>
      <span class="fin-ops-card-label">${escapeHtml(opts.label)}</span>
      <strong class="fin-ops-card-value">${escapeHtml(fmt(opts.value))}</strong>
      <small class="fin-ops-card-meta">${escapeHtml(opts.meta || "")}</small>
      <small class="fin-ops-card-compare">${escapeHtml(opts.compare || "")}</small>
    </article>`;
  }

  function financeDashboardRenderPeriodCards(data, ctx) {
    const el = document.getElementById("finDashCompareCards");
    if (!el) return;
    const formatCurrency = ctx?.formatCurrency || ((n) => `R$ ${Number(n || 0).toFixed(2)}`);
    const filters = ctx?.filters || {};
    const p = computePeriodComparison(data, filters);
    const partnerNote = p.partnerLabel ? ` · ${p.partnerLabel}` : "";
    el.innerHTML = [
      renderCompareCard({
        theme: "receita-gerada",
        icon: "billing",
        label: "Receita gerada no mês",
        value: p.receitaGerada,
        formatCurrency,
        meta: `${p.receitaGeradaUnidades} saída(s) em ${p.monthLabel}${partnerNote}`,
        compare: "Competência operacional — data de saída do veículo (pago ou não)",
        trend: p.receitaGeradaTrend,
      }),
      renderCompareCard({
        theme: "pagamentos-recebidos",
        icon: "paid",
        label: "Pagamentos recebidos no mês",
        value: p.pagamentosRecebidos,
        formatCurrency,
        meta: `${p.pagamentosUnidades} recebimento(s) em ${p.monthLabel}${partnerNote}`,
        compare: "Caixa — data efetiva do recebimento",
        trend: p.pagamentosTrend,
      }),
    ].join("");
  }

  function financeDashboardRender(data, ctx) {
    financeDashboardRenderPeriodCards(data, ctx);
    const el = document.getElementById("finDashCards");
    if (!el) return;
    const formatCurrency = ctx?.formatCurrency || ((n) => `R$ ${Number(n || 0).toFixed(2)}`);
    const m = getMetrics(data);
    const footnote = m.hasData
      ? `Base financeira: ${m.closedDays} dia(s) fechado(s) desde abr/2026 até ${m.lastClosed?.split("-").reverse().join("/") || "—"}`
      : "Sem histórico financeiro desde abr/2026";

    if (!m.hasData) {
      el.innerHTML = `<p class="fin-ops-footnote">${escapeHtml(footnote)}</p>`;
      return;
    }

    const fmtDays = (n) => `${Number(n).toFixed(1).replace(".", ",")} dias`;

    el.innerHTML = [
      renderCard({
        theme: "billing-daily",
        icon: "billing",
        label: "Média faturamento diário",
        value: m.dailyBillingAvg,
        valueType: "currency",
        formatCurrency,
        meta: "faturamentos reais / dia fechado",
        trend: m.billingDailyTrend,
        trendLabel: "vs. 30 dias anteriores",
        compare: "Histórico consolidado desde abr/2026",
        spark: m.billingDailySpark,
        sparkColor: "#34d399",
      }),
      renderCard({
        theme: "billing-weekly",
        icon: "calendar",
        label: "Média semanal de faturamento",
        value: m.weeklyBillingAvg,
        valueType: "currency",
        formatCurrency,
        meta: "semanas completas fechadas",
        trend: m.billingWeeklyTrend,
        trendLabel: "vs. 4 semanas anteriores",
        compare: "Soma real por semana (não projetada)",
        spark: m.billingWeeklySpark,
        sparkColor: "#60a5fa",
      }),
      renderCard({
        theme: "billing-monthly",
        icon: "calendar",
        label: "Média mensal de faturamento",
        value: m.monthlyBillingAvg,
        valueType: "currency",
        formatCurrency,
        meta: "meses com dias encerrados",
        trend: m.billingMonthlyTrend,
        trendLabel: "vs. 3 meses anteriores",
        compare: "Média histórica real por mês",
        spark: m.billingMonthlySpark,
        sparkColor: "#a78bfa",
      }),
      renderCard({
        theme: "collection",
        icon: "clock",
        label: "Tempo médio de recebimento",
        value: fmtDays(m.avgCollectionDays),
        meta: "faturamento → recebimento efetivo",
        trend: m.collectionTrend,
        invertTrend: true,
        trendLabel: "vs. recebimentos anteriores",
        compare: "Apenas títulos pagos no histórico",
        spark: [],
        sparkColor: "#fbbf24",
      }),
      renderCard({
        theme: "ticket",
        icon: "ticket",
        label: "Ticket médio por veículo",
        value: m.ticketMedio,
        valueType: "currency",
        formatCurrency,
        meta: `${m.billedUnits} faturamento(s) no período`,
        trend: m.ticketTrend,
        trendLabel: "faturamentos recentes vs. anteriores",
        compare: "Faturamento histórico ÷ unidades faturadas",
        spark: [],
        sparkColor: "#f472b6",
      }),
      renderCard({
        theme: "recv",
        icon: "recv",
        label: "Contas a receber",
        value: m.totalAberto,
        valueType: "currency",
        formatCurrency,
        meta: `${m.pendentes} pendente(s) · vencidos hoje: ${m.vencidosDia} · no mês: ${m.vencidosMes}`,
        trend: m.receivableTrend,
        invertTrend: true,
        trendLabel: "inadimplência vs. mês anterior",
        compare: `${escapeHtml(formatCurrency(m.totalVencido))} em atraso`,
        spark: [],
        sparkColor: "#fb923c",
      }),
      renderCard({
        theme: "paid-month",
        icon: "paid",
        label: "Recebimentos do mês",
        value: m.recebidoMes,
        valueType: "currency",
        formatCurrency,
        meta: "dias fechados do mês atual",
        trend: m.recebidoMesTrend,
        trendLabel: "vs. mês anterior",
        compare: "Recebimentos efetivos (caixa / PAGO)",
        spark: m.billingDailySpark.slice(-7),
        sparkColor: "#4ade80",
      }),
      renderCard({
        theme: "bill-month",
        icon: "billing",
        label: "Faturamento do mês",
        value: m.faturadoMes,
        valueType: "currency",
        formatCurrency,
        meta: "dias fechados do mês atual",
        trend: m.faturadoMesTrend,
        trendLabel: "vs. mês anterior",
        compare: "Faturamentos registrados no período",
        spark: m.faturadoMesSpark,
        sparkColor: "#38bdf8",
      }),
      renderCard({
        theme: "default",
        icon: "alert",
        label: "Índice de inadimplência",
        value: m.inadimplenciaPct,
        valueType: "pct",
        meta: "vencidos ÷ total em aberto",
        trend: m.inadimplenciaTrend,
        invertTrend: true,
        trendLabel: "vs. período anterior",
        compare: `${escapeHtml(formatCurrency(m.totalVencido))} vencido(s)`,
        spark: [],
        sparkColor: "#f87171",
      }),
      renderCard({
        theme: "flow",
        icon: "flow",
        label: "Fluxo financeiro",
        value: m.fluxoSaldo,
        valueType: "currency",
        formatCurrency,
        meta: `entradas ${formatCurrency(m.fluxoEntradas)} · saídas ${formatCurrency(m.fluxoSaidas)}`,
        trend: m.fluxoTrend,
        trendLabel: "saldo mensal recente",
        compare: "Caixa operacional desde abr/2026",
        spark: m.fluxoSpark,
        sparkColor: "#22d3ee",
      }),
      `<p class="fin-ops-footnote">${escapeHtml(footnote)}</p>`,
    ].join("");
  }

  function financeDashboardInvalidateCache() {
    _cache = null;
  }

  global.financeDashboardRender = financeDashboardRender;
  global.financeDashboardRenderPeriodCards = financeDashboardRenderPeriodCards;
  global.financeDashboardComputePeriodComparison = computePeriodComparison;
  global.financeDashboardInvalidateCache = financeDashboardInvalidateCache;
  global.financeDashboardGetMetrics = getMetrics;
})(typeof window !== "undefined" ? window : globalThis);

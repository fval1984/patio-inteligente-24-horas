/**
 * Dashboard Executivo AmpliPátio — visão limpa focada em decisão.
 * UI only: não altera banco, APIs ou regras de negócio.
 */
(function amplipatioDashboardModule(global) {
  "use strict";

  let _cache = null;
  let _bound = false;
  const HUB_PATIO_CAPACITY = 100;
  const LONG_STAY_TOP = 10;
  const STALE_AGUARDANDO_DAYS = 14;
  const CAPACITY_WARN_PCT = 85;
  const ENTRADAS_SAIDAS_DAYS = 30;
  const VEH_BY_FINANCE_TOP = 8;
  const TOP_RECV_PARTNERS = 8;

  let _filterPeriod = "30d";
  let _filterPartnerId = "";
  let _filterStatus = "";
  let _filterSearch = "";

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

  function inRange(ymd, fromYmd, toYmd) {
    if (!ymd) return false;
    if (fromYmd && ymd < fromYmd) return false;
    if (toYmd && ymd > toYmd) return false;
    return true;
  }

  function resolvePeriodRange(period) {
    const today = todayYmd();
    const curYm = yearMonthFromYmd(today);
    switch (period) {
      case "today":
        return { from: today, to: today, label: "Hoje" };
      case "7d":
        return { from: addDaysYmd(today, -6), to: today, label: "Últimos 7 dias" };
      case "30d":
        return { from: addDaysYmd(today, -29), to: today, label: "Últimos 30 dias" };
      case "month":
        return { from: monthStartYm(curYm), to: today, label: "Mês atual" };
      case "year":
        return { from: `${today.slice(0, 4)}-01-01`, to: today, label: "Ano atual" };
      default:
        return { from: addDaysYmd(today, -29), to: today, label: "Últimos 30 dias" };
    }
  }

  function prevPeriodRange(range) {
    if (!range.from || !range.to) return { from: null, to: null };
    const days =
      Math.round((ymdToDate(range.to).getTime() - ymdToDate(range.from).getTime()) / 86400000) + 1;
    const prevTo = addDaysYmd(range.from, -1);
    const prevFrom = addDaysYmd(prevTo, -(days - 1));
    return { from: prevFrom, to: prevTo };
  }

  function pctChange(current, previous) {
    if (!previous || previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  function isVehicleOnPatio(v) {
    return !!v && String(v.status || "").toUpperCase() !== "REMOVIDO";
  }

  function isVlpStatus(status) {
    const s = String(status || "");
    return s === "LIBERACAO_SOLICITADA" || s === "LIBERACAO_CONFIRMADA" || s === "REMocao_CONFIRMADA" || s.toUpperCase() === "REMOCAO_CONFIRMADA";
  }

  function statusUpper(v) {
    return String(v?.status || "").toUpperCase();
  }

  function partnerById(partners) {
    return new Map((partners || []).map((p) => [String(p.id), p]));
  }

  function vehicleMaps(vehicles) {
    return new Map((vehicles || []).map((v) => [String(v.id), v]));
  }

  function partnerFinanceiraNome(v, pmap) {
    const id = String(v?.localizador_id || v?.responsavel_financeiro_id || "");
    if (!id) return "—";
    const p = pmap.get(id);
    return p?.nome || v?.responsavel_financeiro_nome || "—";
  }

  function vehicleHasVistoria(v) {
    const checklist = v?.vistoria_checklist || {};
    return !!(
      v?.vistoria_data ||
      v?.vistoria_responsavel ||
      v?.vistoria_km ||
      v?.vistoria_combustivel ||
      v?.vistoria_observacoes ||
      checklist.documento ||
      checklist.chave ||
      checklist.estepe ||
      checklist.triangulo_macaco
    );
  }

  function vehicleSemValor(v) {
    return !v?.valor_diaria || Number(v.valor_diaria) <= 0;
  }

  function isRemocaoSolicitadaFlag(v) {
    if (!v) return false;
    const flag = v.remocao_solicitada;
    if (
      flag === true ||
      flag === 1 ||
      flag === "1" ||
      flag === "t" ||
      flag === "true" ||
      flag === "TRUE"
    ) {
      return true;
    }
    const s = String(v.status || "");
    return s === "REMocao_CONFIRMADA" || s.toUpperCase() === "REMOCAO_CONFIRMADA";
  }

  function isLiberadoAguardandoRetirada(v) {
    const s = String(v?.status || "");
    return s === "LIBERACAO_CONFIRMADA" || s === "REMocao_CONFIRMADA" || s.toUpperCase() === "REMOCAO_CONFIRMADA";
  }

  function syncFiltersFromDom() {
    const periodEl = document.getElementById("hubDashFilterPeriod");
    const partnerEl = document.getElementById("hubDashFilterPartner");
    const statusEl = document.getElementById("hubDashFilterStatus");
    const searchEl = document.getElementById("hubDashFilterSearch");
    if (periodEl) _filterPeriod = periodEl.value || "30d";
    if (partnerEl) _filterPartnerId = partnerEl.value || "";
    if (statusEl) _filterStatus = statusEl.value || "";
    if (searchEl) _filterSearch = (searchEl.value || "").trim().toLowerCase();
  }

  function populatePartnerFilter(partners) {
    const sel = document.getElementById("hubDashFilterPartner");
    if (!sel) return;
    const cur = _filterPartnerId || sel.value || "";
    const list = (partners || []).slice().sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"));
    sel.innerHTML =
      `<option value="">Todos</option>` +
      list.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.nome || "-")}</option>`).join("");
    if (cur) sel.value = cur;
  }

  function filterVehicles(vehicles, partners) {
    const pmap = partnerById(partners);
    const q = _filterSearch.replace(/[^a-z0-9]/g, "");
    return (vehicles || []).filter((v) => {
      if (_filterPartnerId && String(v.localizador_id || "") !== String(_filterPartnerId)) return false;
      if (_filterStatus === "no_patio" && !isVehicleOnPatio(v)) return false;
      if (_filterStatus === "vlp" && !isVlpStatus(v.status)) return false;
      if (_filterStatus === "removido" && String(v.status || "").toUpperCase() !== "REMOVIDO") return false;
      if (_filterSearch) {
        const plate = String(v.placa || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const partner = pmap.get(String(v.localizador_id));
        const pName = String(partner?.nome || "").toLowerCase();
        const hay = `${plate} ${pName}`;
        const normHay = hay.replace(/[^a-z0-9]/g, "");
        if (!hay.includes(_filterSearch) && !(q && normHay.includes(q))) return false;
      }
      return true;
    });
  }

  function vehicleStayDays(v, endYmd) {
    const ent = toLocalYmd(v?.data_entrada);
    if (!ent) return 0;
    const end = v.data_saida ? toLocalYmd(v.data_saida) : endYmd || todayYmd();
    if (!end || end < ent) return 0;
    return Math.max(1, Math.ceil((ymdToDate(end).getTime() - ymdToDate(ent).getTime()) / 86400000));
  }

  function dataSignature(data) {
    const v = (data?.vehicles || []).length;
    const p = (data?.partners || []).length;
    const r = (data?.receivables || []).length;
    const c = (data?.cash || []).length;
    const pay = (data?.payables || []).length;
    return `${v}:${p}:${r}:${c}:${pay}:${_filterPeriod}:${_filterPartnerId}:${_filterStatus}:${_filterSearch}`;
  }

  function buildDailySeries(vehicles, days, partnerId) {
    const today = todayYmd();
    const labels = [];
    const entradas = [];
    const saidas = [];
    for (let i = days - 1; i >= 0; i--) {
      const ymd = addDaysYmd(today, -i);
      labels.push(`${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`);
      let e = 0;
      let s = 0;
      for (const v of vehicles) {
        if (partnerId && String(v.localizador_id || "") !== String(partnerId)) continue;
        if (toLocalYmd(v.data_entrada) === ymd) e++;
        if (toLocalYmd(v.data_saida) === ymd) s++;
      }
      entradas.push(e);
      saidas.push(s);
    }
    return { labels, entradas, saidas };
  }

  function computeOperationalStatus(onPatio) {
    let aguardandoConferencia = 0;
    let aguardandoVistoria = 0;
    let aguardandoAutorizacao = 0;
    let liberadosAguardandoRetirada = 0;
    let comPendencias = 0;

    for (const v of onPatio) {
      const st = statusUpper(v);
      if (st === "NO_PATIO" && vehicleSemValor(v)) aguardandoConferencia++;
      if (st === "NO_PATIO" && !vehicleHasVistoria(v)) aguardandoVistoria++;
      if (String(v.status || "") === "LIBERACAO_SOLICITADA") aguardandoAutorizacao++;
      if (isLiberadoAguardandoRetirada(v)) liberadosAguardandoRetirada++;
      if (
        isRemocaoSolicitadaFlag(v) ||
        String(v.nfse_status || "").toUpperCase() === "PENDENTE" ||
        vehicleSemValor(v)
      ) {
        comPendencias++;
      }
    }

    return {
      aguardandoConferencia,
      aguardandoVistoria,
      aguardandoAutorizacao,
      liberadosAguardandoRetirada,
      comPendencias,
    };
  }

  function computeHubMetrics(data) {
    const range = resolvePeriodRange(_filterPeriod);
    const prev = prevPeriodRange(range);
    const vehicles = filterVehicles(data.vehicles, data.partners);
    const allVehicles = data.vehicles || [];
    const today = todayYmd();
    const pmap = partnerById(data.partners);
    const vmapAll = vehicleMaps(data.vehicles);

    const onPatio = vehicles.filter(isVehicleOnPatio);
    const vlp = vehicles.filter((v) => isVlpStatus(v.status));
    const entradasDia = vehicles.filter((v) => toLocalYmd(v.data_entrada) === today).length;
    const saidasDia = vehicles.filter((v) => toLocalYmd(v.data_saida) === today).length;

    const capacity = Number(data.settings?.capacidade_patio) > 0 ? Number(data.settings.capacidade_patio) : HUB_PATIO_CAPACITY;
    const ocupacaoPct = capacity > 0 ? (onPatio.length / capacity) * 100 : 0;

    const financeirasIds = new Set();
    for (const v of onPatio) {
      const id = String(v.localizador_id || "").trim();
      if (id) financeirasIds.add(id);
    }
    const financeirasAtivas = financeirasIds.size;

    const ops = computeOperationalStatus(onPatio);

    const finSnapRaw = typeof global.financeMetricsSnapshot === "function" ? global.financeMetricsSnapshot() : {};
    let aguardandoList =
      typeof global.financeContasAguardandoList === "function" ? global.financeContasAguardandoList() : [];
    let contasRec =
      typeof global.financeContasReceberList === "function" ? global.financeContasReceberList() : [];

    if (_filterPartnerId) {
      const matchPartner = (r) => {
        const v = vmapAll.get(String(r?.vehicle_id));
        return v && String(v.localizador_id || "") === String(_filterPartnerId);
      };
      aguardandoList = aguardandoList.filter(matchPartner);
      contasRec = contasRec.filter(matchPartner);
    }

    const finSnap = _filterPartnerId
      ? {
          ...finSnapRaw,
          totalReceber: contasRec.reduce((s, r) => s + Number(r.valor || 0), 0),
          pendentes: contasRec.filter((r) => String(r.status || "").toUpperCase() !== "PAGO").length,
          aguardandoFaturamento: aguardandoList.length,
        }
      : finSnapRaw;

    const finDash =
      typeof global.financeDashboardGetMetrics === "function"
        ? global.financeDashboardGetMetrics({
            receivables: data.receivables || [],
            payables: data.payables || [],
            cash: data.cash || [],
            vehicles: data.vehicles || [],
            settings: data.settings || {},
          })
        : null;

    const patioDash =
      typeof global.patioDashboardGetMetrics === "function"
        ? global.patioDashboardGetMetrics(data.vehicles || [])
        : null;

    const months = [];
    const billingByMonth = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push(ym);
      billingByMonth.push(0);
    }
    if (finDash) {
      const spark = finDash.faturadoMesSpark || finDash.billingMonthlySpark || [];
      for (let i = 0; i < months.length && i < spark.length; i++) {
        billingByMonth[billingByMonth.length - spark.length + i] = spark[i] || 0;
      }
      if (spark.length === 0 && finDash.faturadoMes != null) {
        billingByMonth[billingByMonth.length - 1] = finDash.faturadoMes || 0;
      }
    }

    const daily = buildDailySeries(allVehicles, ENTRADAS_SAIDAS_DAYS, _filterPartnerId || null);

    const vehByFinanceMap = new Map();
    for (const v of onPatio) {
      const id = String(v.localizador_id || "").trim() || "__sem__";
      const nome = id === "__sem__" ? "Sem financeira" : pmap.get(id)?.nome || "—";
      const cur = vehByFinanceMap.get(id) || { id, nome, count: 0 };
      cur.count += 1;
      vehByFinanceMap.set(id, cur);
    }
    const vehiclesByFinanceira = [...vehByFinanceMap.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, VEH_BY_FINANCE_TOP);

    const longStay = onPatio
      .map((v) => ({
        placa: v.placa || "—",
        financeira: partnerFinanceiraNome(v, pmap),
        days: vehicleStayDays(v, today),
        id: v.id,
      }))
      .filter((x) => x.days > 0)
      .sort((a, b) => b.days - a.days)
      .slice(0, LONG_STAY_TOP);

    const recvByPartner = new Map();
    for (const r of contasRec) {
      if (String(r.status || "").toUpperCase() === "PAGO") continue;
      const veh = vmapAll.get(String(r.vehicle_id));
      const pid = String(veh?.localizador_id || "").trim() || "__sem__";
      const nome =
        pid === "__sem__"
          ? "Sem financeira"
          : pmap.get(pid)?.nome || veh?.responsavel_financeiro_nome || "—";
      const cur = recvByPartner.get(pid) || { financeira: nome, veiculos: new Set(), valor: 0 };
      if (r.vehicle_id) cur.veiculos.add(String(r.vehicle_id));
      cur.valor += Number(r.valor || 0);
      recvByPartner.set(pid, cur);
    }
    const topPendingByFinanceira = [...recvByPartner.values()]
      .map((x) => ({
        financeira: x.financeira,
        veiculos: x.veiculos.size,
        valor: x.valor,
      }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, TOP_RECV_PARTNERS);

    const alerts = [];
    if (longStay.length && longStay[0].days >= 30) {
      const elevated = longStay.filter((x) => x.days >= 30).length;
      alerts.push({
        level: "warn",
        icon: "stay",
        title: `${elevated} veículo(s) com permanência elevada`,
        detail: "Acima de 30 dias no pátio",
        nav: "patio:no_patio",
      });
    }
    if (Number(finSnap.vencidas || 0) > 0) {
      alerts.push({
        level: "danger",
        icon: "late",
        title: `${finSnap.vencidas} conta(s) vencida(s)`,
        detail: `Total ${Number(finSnap.totalVencidas || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
        nav: "financeiro",
      });
    }
    const staleAguardando = aguardandoList.filter((r) => {
      const veh = vmapAll.get(String(r.vehicle_id));
      const sai = toLocalYmd(veh?.data_saida || r.updated_at);
      if (!sai) return false;
      const days = Math.ceil((ymdToDate(today).getTime() - ymdToDate(sai).getTime()) / 86400000);
      return days >= STALE_AGUARDANDO_DAYS;
    });
    if (staleAguardando.length) {
      alerts.push({
        level: "warn",
        icon: "billing",
        title: `${staleAguardando.length} aguardando faturamento parado(s)`,
        detail: `Há mais de ${STALE_AGUARDANDO_DAYS} dias desde a saída`,
        nav: "financeiro",
      });
    }
    if (ocupacaoPct >= CAPACITY_WARN_PCT) {
      alerts.push({
        level: "danger",
        icon: "occupancy",
        title: `Pátio em ${ocupacaoPct.toFixed(0)}% da capacidade`,
        detail: `${onPatio.length} de ${capacity} vagas`,
        nav: "patio:no_patio",
      });
    }
    if (ops.comPendencias > 0) {
      alerts.push({
        level: "info",
        icon: "idle",
        title: `${ops.comPendencias} veículo(s) com pendências`,
        detail: "Remoção, NF-e ou valor diária",
        nav: "patio:no_patio",
      });
    }

    const periodEntradas = (data.vehicles || []).filter((v) => {
      if (_filterPartnerId && String(v.localizador_id || "") !== String(_filterPartnerId)) return false;
      return inRange(toLocalYmd(v.data_entrada), range.from, range.to);
    }).length;
    const periodSaidas = (data.vehicles || []).filter((v) => {
      if (_filterPartnerId && String(v.localizador_id || "") !== String(_filterPartnerId)) return false;
      return inRange(toLocalYmd(v.data_saida), range.from, range.to);
    }).length;
    const prevEntradas = allVehicles.filter((v) =>
      inRange(toLocalYmd(v.data_entrada), prev.from, prev.to)
    ).length;
    const prevSaidas = allVehicles.filter((v) => inRange(toLocalYmd(v.data_saida), prev.from, prev.to)).length;

    return {
      range,
      finSnap,
      finDash,
      patioDash,
      onPatioCount: onPatio.length,
      vlpCount: vlp.length,
      entradasDia,
      saidasDia,
      ocupacaoPct,
      capacity,
      financeirasAtivas,
      ops,
      months,
      billingByMonth,
      dailyLabels: daily.labels,
      dailyEntradas: daily.entradas,
      dailySaidas: daily.saidas,
      vehiclesByFinanceira,
      longStay,
      topPendingByFinanceira,
      alerts,
      entradasTrend: pctChange(periodEntradas, prevEntradas),
      saidasTrend: pctChange(periodSaidas, prevSaidas),
      periodEntradas,
      periodSaidas,
    };
  }

  function getMetrics(data) {
    const key = dataSignature(data);
    if (_cache?.key === key) return _cache.data;
    const result = computeHubMetrics(data);
    _cache = { key, data: result };
    return result;
  }

  function hubInvalidateCache() {
    _cache = null;
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
      return { text: "estável", cls: "hub-ops-trend--flat", arrow: "→" };
    }
    const up = pct > 0;
    const positive = invert ? !up : up;
    return {
      text: `${up ? "+" : ""}${pct.toFixed(1).replace(".", ",")}%`,
      cls: positive ? "hub-ops-trend--up" : "hub-ops-trend--down",
      arrow: up ? "↑" : "↓",
    };
  }

  function barChartSvg(labels, datasets, colors, height) {
    if (!labels?.length) return `<p class="hub-chart-empty">Sem dados no período.</p>`;
    const w = 640;
    const h = height || 200;
    const pad = { l: 8, r: 8, t: 12, b: 28 };
    const innerW = w - pad.l - pad.r;
    const innerH = h - pad.t - pad.b;
    const max = Math.max(1, ...datasets.flatMap((d) => d.values || []));
    const groupW = innerW / labels.length;
    const barW = Math.min(22, (groupW / Math.max(datasets.length, 1)) * 0.65);
    const showEvery = labels.length > 16 ? Math.ceil(labels.length / 10) : 1;
    let svg = "";
    labels.forEach((lbl, i) => {
      const gx = pad.l + i * groupW + groupW / 2;
      datasets.forEach((ds, di) => {
        const val = (ds.values || [])[i] || 0;
        const bh = (val / max) * innerH;
        const x = gx - (datasets.length * barW) / 2 + di * barW;
        const y = pad.t + innerH - bh;
        const tip = ds.tips?.[i] ?? `${ds.name}: ${val}`;
        svg += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" rx="3" fill="${colors[di] || "#60a5fa"}" opacity="0.9"><title>${escapeHtml(tip)}</title></rect>`;
      });
      if (i % showEvery === 0 || i === labels.length - 1) {
        svg += `<text x="${gx}" y="${h - 8}" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.55">${escapeHtml(String(lbl))}</text>`;
      }
    });
    return `<svg class="hub-chart" viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img">${svg}</svg>`;
  }

  function hBarChartSvg(items, fmt) {
    if (!items?.length) return `<p class="hub-chart-empty">Sem dados.</p>`;
    const w = 640;
    const h = Math.min(280, 40 + items.length * 36);
    const max = Math.max(1, ...items.map((i) => i.value));
    let svg = "";
    items.forEach((item, i) => {
      const y = 16 + i * 36;
      const bw = ((item.value || 0) / max) * (w - 180);
      svg += `<text x="8" y="${y + 14}" font-size="11" fill="currentColor" opacity="0.85">${escapeHtml(String(item.label || "").slice(0, 22))}</text>`;
      svg += `<rect x="170" y="${y}" width="${bw.toFixed(1)}" height="22" rx="4" fill="${item.color || "#60a5fa"}" opacity="0.88"><title>${escapeHtml(item.label)}: ${escapeHtml(fmt(item.value))}</title></rect>`;
      svg += `<text x="${(175 + bw).toFixed(1)}" y="${y + 15}" font-size="10" fill="currentColor" opacity="0.7">${escapeHtml(fmt(item.value))}</text>`;
    });
    return `<svg class="hub-chart hub-chart--hbar" viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img">${svg}</svg>`;
  }

  function iconSvg(name) {
    const icons = {
      recv: '<path d="M12 3v18M7 8l5-5 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
      pay: '<path d="M12 21V3M7 16l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
      billing: '<path d="M4 20V10M12 20V4M20 20v-8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
      ticket: '<path d="M4 8h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4V8z" stroke="currentColor" stroke-width="2" fill="none"/>',
      profit: '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="currentColor" stroke-width="2" fill="none"/>',
      vehicle: '<path d="M4 16l2-6h12l2 6M6 16h12M8 20h2M14 20h2" stroke="currentColor" stroke-width="2" fill="none"/>',
      partners: '<path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8" stroke="currentColor" stroke-width="2" fill="none"/>',
      occupancy: '<rect x="3" y="4" width="7" height="16" rx="1.5" stroke="currentColor" stroke-width="2" fill="none"/><rect x="14" y="4" width="7" height="16" rx="1.5" stroke="currentColor" stroke-width="2" fill="none"/>',
      stay: '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 7v5l3 2" stroke="currentColor" stroke-width="2"/>',
      idle: '<path d="M12 9v4M12 17h.01M10.3 4.3l-7.2 12.4A2 2 0 0 0 4.7 20h14.6a2 2 0 0 0 1.6-3.3L13.7 4.3a2 2 0 0 0-3.4 0z" stroke="currentColor" stroke-width="2" fill="none"/>',
      late: '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 7v5l3 2" stroke="currentColor" stroke-width="2"/>',
    };
    return `<svg class="hub-ops-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">${icons[name] || icons.billing}</svg>`;
  }

  function renderKpiCard(opts) {
    const fmt = opts.formatCurrency || ((n) => String(n));
    let value;
    if (opts.valueType === "currency") value = escapeHtml(fmt(opts.value));
    else if (opts.valueType === "pct") value = escapeHtml(`${Number(opts.value).toFixed(1).replace(".", ",")}%`);
    else value = escapeHtml(String(opts.value ?? "—"));
    const nav = opts.nav ? ` data-hub-nav="${escapeHtml(opts.nav)}" tabindex="0" role="button"` : "";
    const clickable = opts.nav ? " hub-ops-card--clickable" : "";
    return `<article class="hub-ops-card hub-kpi-card hub-ops-card--${escapeHtml(opts.theme)}${clickable}"${nav}>
      <div class="hub-ops-card-top">
        <div class="hub-ops-card-icon">${iconSvg(opts.icon)}</div>
      </div>
      <span class="hub-ops-card-label">${escapeHtml(opts.label)}</span>
      <strong class="hub-ops-card-value">${value}</strong>
      <small class="hub-ops-card-meta">${escapeHtml(opts.meta || "")}</small>
    </article>`;
  }

  function renderOpsSituation(ops) {
    const rows = [
      { key: "conferencia", label: "Veículos aguardando conferência", value: ops.aguardandoConferencia, nav: "patio:no_patio" },
      { key: "vistoria", label: "Veículos aguardando vistoria", value: ops.aguardandoVistoria, nav: "patio:no_patio" },
      { key: "autorizacao", label: "Veículos aguardando autorização", value: ops.aguardandoAutorizacao, nav: "patio:vlp" },
      { key: "retirada", label: "Veículos liberados aguardando retirada", value: ops.liberadosAguardandoRetirada, nav: "patio:vlp" },
      { key: "pendencias", label: "Veículos com pendências", value: ops.comPendencias, nav: "patio:no_patio" },
    ];
    return `<section class="hub-dash-section">
      <article class="hub-ops-situation section-card">
        <h3 class="hub-ops-situation-title">Situação Operacional</h3>
        <ul class="hub-ops-situation-list">
          ${rows
            .map(
              (r) => `<li class="hub-ops-situation-item hub-ops-situation-item--${r.key}" data-hub-nav="${escapeHtml(r.nav)}" tabindex="0" role="button">
                <span class="hub-ops-situation-label">${escapeHtml(r.label)}</span>
                <strong class="hub-ops-situation-value">${escapeHtml(String(r.value))}</strong>
              </li>`
            )
            .join("")}
        </ul>
      </article>
    </section>`;
  }

  function renderDataTable(title, headers, bodyHtml, emptyText) {
    return `<section class="hub-dash-section">
      <div class="hub-table-panel section-card">
        <h3 class="hub-table-title">${escapeHtml(title)}</h3>
        <div class="table-wrap hub-table-wrap">
          <table class="table hub-exec-table">
            <thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
            <tbody>${bodyHtml || `<tr><td colspan="${headers.length}" class="hub-table-empty">${escapeHtml(emptyText)}</td></tr>`}</tbody>
          </table>
        </div>
      </div>
    </section>`;
  }

  function renderAlerts(alerts) {
    const el = document.getElementById("hubDashAlerts");
    if (!el) return;
    if (!alerts?.length) {
      el.innerHTML = `<div class="hub-alert hub-alert--ok"><span class="hub-alert-icon">✓</span><span>Operação estável — nenhum alerta crítico.</span></div>`;
      return;
    }
    el.innerHTML = alerts
      .map(
        (a) => `<button type="button" class="hub-alert hub-alert--${a.level}" data-hub-nav="${escapeHtml(a.nav || "")}">
          <span class="hub-alert-icon">${iconSvg(a.icon)}</span>
          <span class="hub-alert-body"><strong>${escapeHtml(a.title)}</strong><small>${escapeHtml(a.detail)}</small></span>
        </button>`
      )
      .join("");
  }

  function hubNavigate(target) {
    if (!target) return;
    const [view, sub] = String(target).split(":");
    const btn = document.querySelector(`#appHeaderMenu button[data-view="${view}"]`);
    if (btn) btn.click();
    if (view === "patio" && sub) {
      setTimeout(() => {
        document.querySelector(`[data-subview="${sub}"]`)?.click();
      }, 100);
    }
  }

  function filterAlertsForGestor(alerts) {
    return (alerts || []).filter((a) => {
      const nav = String(a.nav || "");
      if (nav.startsWith("financeiro")) return false;
      if (nav.startsWith("parceiros")) return false;
      return nav.startsWith("patio");
    });
  }

  function renderChartsSection(m, formatCurrency, { includeFinance }) {
    const monthLabels = m.months.map((ym) => ym.slice(5));
    const vehItems = (m.vehiclesByFinanceira || []).map((r) => ({
      label: r.nome,
      value: r.count,
      color: "#22d3ee",
    }));

    const financeChart = includeFinance
      ? `<div class="hub-chart-panel section-card">
          <h4>Receita Mensal</h4>
          ${barChartSvg(monthLabels, [{ name: "Receita", values: m.billingByMonth }], ["#38bdf8"], 200)}
        </div>`
      : "";

    return `<section class="hub-dash-charts hub-dash-charts--exec">
      <div class="hub-chart-panel section-card">
        <h4>Entradas × Saídas (30 dias)</h4>
        ${barChartSvg(
          m.dailyLabels,
          [
            { name: "Entradas", values: m.dailyEntradas },
            { name: "Saídas", values: m.dailySaidas },
          ],
          ["#34d399", "#f87171"],
          200
        )}
      </div>
      ${financeChart}
      <div class="hub-chart-panel section-card">
        <h4>Veículos por Financeira</h4>
        ${hBarChartSvg(vehItems, (n) => String(n))}
      </div>
    </section>`;
  }

  function renderLongStayTable(m) {
    const body = (m.longStay || [])
      .map(
        (x) => `<tr>
          <td>${escapeHtml(x.placa)}</td>
          <td>${escapeHtml(x.financeira)}</td>
          <td>${escapeHtml(String(x.days))}</td>
        </tr>`
      )
      .join("");
    return renderDataTable(
      "Veículos com maior permanência",
      ["Placa", "Financeira", "Dias no pátio"],
      body,
      "Nenhum veículo no pátio."
    );
  }

  function renderTopRecvTable(m, formatCurrency) {
    const body = (m.topPendingByFinanceira || [])
      .map(
        (x) => `<tr>
          <td>${escapeHtml(x.financeira)}</td>
          <td>${escapeHtml(String(x.veiculos))}</td>
          <td>${escapeHtml(formatCurrency(x.valor))}</td>
        </tr>`
      )
      .join("");
    return renderDataTable(
      "Maiores contas a receber",
      ["Financeira", "Quantidade de veículos", "Valor"],
      body,
      "Nenhum título pendente."
    );
  }

  function amplipatioDashboardRender(data, ctx) {
    const root = document.getElementById("hubDashRoot");
    if (!root) return;
    syncFiltersFromDom();
    populatePartnerFilter(data.partners);
    const isGestorPista = !!(ctx?.isGestorPista || global.isGestorPista);
    const formatCurrency = ctx?.formatCurrency || ((n) => `R$ ${Number(n || 0).toFixed(2)}`);
    const m = getMetrics(data);
    const fin = m.finSnap || {};

    const dashShell = document.getElementById("viewDashboard");
    dashShell?.classList.toggle("hub-dash--gestor-pista", isGestorPista);
    const dashSubtitle = dashShell?.querySelector(".dashboard-subtitle");
    if (dashSubtitle) {
      dashSubtitle.textContent = isGestorPista
        ? "Resumo operacional — veículos no pátio em tempo real."
        : "Visão executiva para tomada de decisão — pátio, ocupação e recebíveis.";
    }
    const dashTitle = dashShell?.querySelector(".dashboard-toolbar h2");
    if (dashTitle && !isGestorPista) dashTitle.textContent = "Dashboard Executivo";
    if (dashTitle && isGestorPista) dashTitle.textContent = "Dashboard operacional";
    const dashPill = dashShell?.querySelector(".pill--premium");
    if (dashPill) dashPill.textContent = isGestorPista ? "Pátio" : "Executivo";
    const dashSearch = document.getElementById("hubDashFilterSearch");
    if (dashSearch) dashSearch.placeholder = isGestorPista ? "Placa ou parceiro…" : "Placa, parceiro, valor…";

    renderAlerts(isGestorPista ? filterAlertsForGestor(m.alerts) : m.alerts);

    const kpiPatio = `
      ${renderKpiCard({ theme: "vnp", icon: "vehicle", label: "Veículos no Pátio", value: m.onPatioCount, meta: `VLP: ${m.vlpCount}`, nav: "patio:no_patio" })}
      ${renderKpiCard({ theme: "in", icon: "vehicle", label: "Entradas Hoje", value: m.entradasDia, meta: `${m.periodEntradas} no período`, nav: "patio:no_patio" })}
      ${renderKpiCard({ theme: "out", icon: "vehicle", label: "Saídas Hoje", value: m.saidasDia, meta: `${m.periodSaidas} no período`, nav: "patio:removidos" })}
      ${renderKpiCard({ theme: "occupancy", icon: "occupancy", label: "Ocupação do Pátio", value: m.ocupacaoPct, valueType: "pct", meta: `${m.onPatioCount} / ${m.capacity} vagas`, nav: "patio:no_patio" })}
    `;

    if (isGestorPista) {
      root.innerHTML = `
        <section class="hub-dash-section">
          <div class="hub-ops-cards hub-ops-cards--kpi hub-ops-cards--kpi-gestor">
            ${kpiPatio}
            ${renderKpiCard({ theme: "active", icon: "partners", label: "Financeiras Ativas", value: m.financeirasAtivas, meta: "com veículos no pátio", nav: "patio:no_patio" })}
          </div>
        </section>
        ${renderOpsSituation(m.ops)}
        ${renderChartsSection(m, formatCurrency, { includeFinance: false })}
        ${renderLongStayTable(m)}
      `;
      return;
    }

    root.innerHTML = `
      <section class="hub-dash-section">
        <div class="hub-ops-cards hub-ops-cards--kpi">
          ${kpiPatio}
          ${renderKpiCard({ theme: "recv", icon: "recv", label: "Contas a Receber", value: fin.totalReceber, valueType: "currency", formatCurrency, meta: `${fin.pendentes || 0} pendente(s)`, nav: "financeiro" })}
          ${renderKpiCard({ theme: "active", icon: "partners", label: "Financeiras Ativas", value: m.financeirasAtivas, meta: "com veículos no pátio", nav: "parceiros" })}
        </div>
      </section>
      ${renderOpsSituation(m.ops)}
      ${renderChartsSection(m, formatCurrency, { includeFinance: true })}
      ${renderLongStayTable(m)}
      ${renderTopRecvTable(m, formatCurrency)}
    `;
  }

  function amplipatioDashboardInit() {
    if (_bound) return;
    _bound = true;
    const debounce = (fn, ms) => {
      let t;
      return () => {
        clearTimeout(t);
        t = setTimeout(fn, ms);
      };
    };
    const refresh = debounce(() => {
      hubInvalidateCache();
      if (typeof global.partnersDashboardInvalidateCache === "function") global.partnersDashboardInvalidateCache();
      if (typeof global.financeDashboardInvalidateCache === "function") global.financeDashboardInvalidateCache();
      if (typeof global.patioDashboardInvalidateCache === "function") global.patioDashboardInvalidateCache();
      if (typeof global.updateDashboard === "function") global.updateDashboard();
    }, 280);

    ["hubDashFilterPeriod", "hubDashFilterPartner", "hubDashFilterStatus"].forEach((id) => {
      document.getElementById(id)?.addEventListener("change", refresh);
    });
    document.getElementById("hubDashFilterSearch")?.addEventListener("input", refresh);

    document.getElementById("viewDashboard")?.addEventListener("click", (e) => {
      const nav = e.target.closest("[data-hub-nav]");
      if (nav) hubNavigate(nav.getAttribute("data-hub-nav"));
    });
  }

  global.amplipatioDashboardRender = amplipatioDashboardRender;
  global.amplipatioDashboardInit = amplipatioDashboardInit;
  global.amplipatioDashboardInvalidateCache = hubInvalidateCache;
})(typeof window !== "undefined" ? window : globalThis);

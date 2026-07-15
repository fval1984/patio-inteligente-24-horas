/**
 * Dashboard Geral AmpliPátio — central inteligente (Financeiro + Pátio + Parceiros).
 */
(function amplipatioDashboardModule(global) {
  "use strict";

  let _cache = null;
  let _bound = false;
  const HUB_PATIO_CAPACITY = 100;
  const LONG_STAY_DAYS = 30;
  const STALE_AGUARDANDO_DAYS = 14;
  const CAPACITY_WARN_PCT = 85;

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
    const VLP = ["LIBERACAO_SOLICITADA", "LIBERACAO_CONFIRMADA", "REMocao_CONFIRMADA"];
    return VLP.includes(status);
  }

  function partnerById(partners) {
    return new Map((partners || []).map((p) => [String(p.id), p]));
  }

  function vehicleMaps(vehicles) {
    return new Map((vehicles || []).map((v) => [String(v.id), v]));
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

  function computeHubMetrics(data) {
    const range = resolvePeriodRange(_filterPeriod);
    const prev = prevPeriodRange(range);
    const vehicles = filterVehicles(data.vehicles, data.partners);
    const allVehicles = data.vehicles || [];
    const today = todayYmd();
    const curYm = yearMonthFromYmd(today);

    const onPatio = vehicles.filter(isVehicleOnPatio);
    const vlp = vehicles.filter((v) => isVlpStatus(v.status));
    const removidos = vehicles.filter((v) => String(v.status || "").toUpperCase() === "REMOVIDO");
    const entradasDia = vehicles.filter((v) => toLocalYmd(v.data_entrada) === today).length;
    const saidasDia = vehicles.filter((v) => toLocalYmd(v.data_saida) === today).length;
    const finalizadosMes = allVehicles.filter(
      (v) =>
        String(v.status || "").toUpperCase() === "REMOVIDO" &&
        yearMonthFromYmd(toLocalYmd(v.data_saida)) === curYm
    ).length;

    const stayList = onPatio.map((v) => vehicleStayDays(v, today));
    const avgStay = stayList.length ? stayList.reduce((a, b) => a + b, 0) / stayList.length : 0;

    const capacity = Number(data.settings?.capacidade_patio) > 0 ? Number(data.settings.capacidade_patio) : HUB_PATIO_CAPACITY;
    const ocupacaoPct = capacity > 0 ? (onPatio.length / capacity) * 100 : 0;

    const statusCounts = {
      no_patio: onPatio.filter((v) => !isVlpStatus(v.status)).length,
      vlp: vlp.length,
      removido: removidos.length,
    };

    const finSnapRaw = typeof global.financeMetricsSnapshot === "function" ? global.financeMetricsSnapshot() : {};
    let aguardandoList =
      typeof global.financeContasAguardandoList === "function" ? global.financeContasAguardandoList() : [];
    let contasRec =
      typeof global.financeContasReceberList === "function" ? global.financeContasReceberList() : [];
    let payAbertas =
      typeof global.financePayablesAbertas === "function" ? global.financePayablesAbertas() : [];

    if (_filterPartnerId) {
      const vmapAll = vehicleMaps(data.vehicles);
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

    const aguardandoValor = aguardandoList.reduce((s, r) => s + Number(r.valor || 0), 0);

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

    const partnersDash =
      typeof global.partnersDashboardGetMetrics === "function"
        ? global.partnersDashboardGetMetrics(
            {
              partners: data.partners || [],
              vehicles: data.vehicles || [],
              receivables: data.receivables || [],
              cash: data.cash || [],
            },
            { period: _filterPeriod, partnerId: _filterPartnerId }
          )
        : null;

    const lucroEstimado = Number(finSnap.recebidoMes || 0) - Number(finSnap.despesasMes || 0);

    const months = [];
    const billingByMonth = [];
    const fluxoByMonth = [];
    const entradasByMonth = [];
    const saidasByMonth = [];
    const partnerGrowthByMonth = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push(ym);
      const mStart = monthStartYm(ym);
      const mEnd = monthEndYm(ym);
      entradasByMonth.push(
        allVehicles.filter((v) => inRange(toLocalYmd(v.data_entrada), mStart, mEnd)).length
      );
      saidasByMonth.push(
        allVehicles.filter((v) => inRange(toLocalYmd(v.data_saida), mStart, mEnd)).length
      );
      partnerGrowthByMonth.push(
        (data.partners || []).filter((p) => {
          const ymd = toLocalYmd(p.created_at);
          return ymd && inRange(ymd, mStart, mEnd);
        }).length
      );
      if (finDash?.faturadoMesSpark && i === 0) {
        billingByMonth.push(finDash.faturadoMes || 0);
      } else {
        billingByMonth.push(0);
      }
      fluxoByMonth.push((finDash?.fluxoSpark || [])[5 - i] || 0);
    }

    if (finDash) {
      const spark = finDash.faturadoMesSpark || finDash.billingMonthlySpark || [];
      for (let i = 0; i < months.length && i < spark.length; i++) {
        billingByMonth[billingByMonth.length - spark.length + i] = spark[i] || billingByMonth[billingByMonth.length - spark.length + i];
      }
    }

    const longStay = onPatio
      .map((v) => ({ v, days: vehicleStayDays(v, today) }))
      .filter((x) => x.days >= LONG_STAY_DAYS)
      .sort((a, b) => b.days - a.days)
      .slice(0, 5);

    const pmap = partnerById(data.partners);
    const topPendingRecv = contasRec
      .filter((r) => String(r.status || "").toUpperCase() !== "PAGO")
      .map((r) => {
        const veh = vehicleMaps(data.vehicles).get(String(r.vehicle_id));
        return {
          id: r.id,
          valor: Number(r.valor || 0),
          placa: veh?.placa || "—",
          parceiro: pmap.get(String(veh?.localizador_id))?.nome || "—",
        };
      })
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 5);

    const alerts = [];
    if (longStay.length) {
      alerts.push({
        level: "warn",
        icon: "stay",
        title: `${longStay.length} veículo(s) com permanência elevada`,
        detail: `Acima de ${LONG_STAY_DAYS} dias no pátio`,
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
    if (partnersDash?.inactive?.length) {
      alerts.push({
        level: "info",
        icon: "idle",
        title: `${partnersDash.inactive.length} parceiro(s) sem movimentação`,
        detail: "No período selecionado",
        nav: "parceiros",
      });
    }
    const staleAguardando = aguardandoList.filter((r) => {
      const veh = vehicleMaps(data.vehicles).get(String(r.vehicle_id));
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
      partnersDash,
      onPatioCount: onPatio.length,
      vlpCount: vlp.length,
      entradasDia,
      saidasDia,
      avgStay: patioDash?.avgStayDays ?? avgStay,
      statusCounts,
      ocupacaoPct,
      capacity,
      finalizadosMes,
      aguardandoValor,
      aguardandoCount: aguardandoList.length,
      pagPendentes: payAbertas.length,
      lucroEstimado,
      months,
      billingByMonth,
      fluxoByMonth,
      entradasByMonth,
      saidasByMonth,
      partnerGrowthByMonth,
      longStay,
      topPendingRecv,
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
    return `<svg class="hub-ops-spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">
      <polygon points="0,${h} ${pts} ${w},${h}" fill="${color}" opacity="0.12"></polygon>
      <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline>
    </svg>`;
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
      svg += `<text x="${gx}" y="${h - 8}" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.55">${escapeHtml(String(lbl).slice(5))}</text>`;
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
      svg += `<text x="8" y="${y + 14}" font-size="11" fill="currentColor" opacity="0.85">${escapeHtml(item.label.slice(0, 22))}</text>`;
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
    };
    return `<svg class="hub-ops-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">${icons[name] || icons.billing}</svg>`;
  }

  function renderCard(opts) {
    const trend = formatTrend(opts.trend ?? 0, opts.invertTrend);
    const fmt = opts.formatCurrency || ((n) => String(n));
    let value;
    if (opts.valueType === "currency") value = escapeHtml(fmt(opts.value));
    else if (opts.valueType === "pct") value = escapeHtml(`${Number(opts.value).toFixed(1).replace(".", ",")}%`);
    else value = escapeHtml(String(opts.value ?? "—"));
    const nav = opts.nav ? ` data-hub-nav="${escapeHtml(opts.nav)}" tabindex="0" role="button"` : "";
    return `<article class="hub-ops-card hub-ops-card--${escapeHtml(opts.theme)} hub-ops-card--clickable"${nav}>
      <div class="hub-ops-card-top">
        <div class="hub-ops-card-icon">${iconSvg(opts.icon)}</div>
        <div class="hub-ops-card-trend ${trend.cls}" title="${escapeHtml(opts.trendLabel || "")}">
          <span>${trend.arrow}</span><span>${escapeHtml(trend.text)}</span>
        </div>
      </div>
      <span class="hub-ops-card-label">${escapeHtml(opts.label)}</span>
      <strong class="hub-ops-card-value">${value}</strong>
      <small class="hub-ops-card-meta">${escapeHtml(opts.meta || "")}</small>
      <div class="hub-ops-card-spark">${sparklineSvg(opts.spark, opts.sparkColor || "#60a5fa")}</div>
      <small class="hub-ops-card-compare">${escapeHtml(opts.compare || "")}</small>
    </article>`;
  }

  function renderRankList(rows, fmt, valueKey) {
    if (!rows?.length) return `<p class="hub-rank-empty">Sem dados no período.</p>`;
    return `<ol class="hub-rank-list">
      ${rows
        .slice(0, 5)
        .map(
          (r, i) => `<li class="hub-rank-item">
            <span class="hub-rank-pos">${i + 1}</span>
            <span class="hub-rank-name">${escapeHtml(r.nome || r.placa || r.label || "—")}</span>
            <span class="hub-rank-val">${escapeHtml(fmt(r[valueKey] ?? r.valor ?? r.revenue ?? 0))}</span>
          </li>`
        )
        .join("")}
    </ol>`;
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

  function amplipatioDashboardRender(data, ctx) {
    const root = document.getElementById("hubDashRoot");
    if (!root) return;
    syncFiltersFromDom();
    populatePartnerFilter(data.partners);
    const isGestorPista = !!(ctx?.isGestorPista || global.isGestorPista);
    const formatCurrency = ctx?.formatCurrency || ((n) => `R$ ${Number(n || 0).toFixed(2)}`);
    const m = getMetrics(data);
    const fin = m.finSnap || {};
    const pd = m.partnersDash;
    const fd = m.finDash;

    const dashShell = document.getElementById("viewDashboard");
    dashShell?.classList.toggle("hub-dash--gestor-pista", isGestorPista);
    const dashSubtitle = dashShell?.querySelector(".dashboard-subtitle");
    if (dashSubtitle) {
      dashSubtitle.textContent = isGestorPista
        ? "Resumo operacional — veículos no pátio em tempo real."
        : "Visão executiva unificada — Financeiro, Pátio e Parceiros em tempo real.";
    }
    const dashSearch = document.getElementById("hubDashFilterSearch");
    if (dashSearch) dashSearch.placeholder = isGestorPista ? "Placa ou parceiro…" : "Placa, parceiro, valor…";

    renderAlerts(isGestorPista ? filterAlertsForGestor(m.alerts) : m.alerts);

    if (isGestorPista) {
      root.innerHTML = `
      <section class="hub-dash-section">
        <h3 class="hub-dash-section-title">Gestão de Pátio</h3>
        <div class="hub-ops-cards">
          ${renderCard({ theme: "vnp", icon: "vehicle", label: "Veículos no pátio", value: m.onPatioCount, meta: `VLP: ${m.vlpCount}`, trend: m.patioDash?.occupancyTrend, spark: m.patioDash?.occupancySpark, sparkColor: "#22d3ee", nav: "patio:no_patio" })}
          ${renderCard({ theme: "in", icon: "vehicle", label: "Entradas do dia", value: m.entradasDia, meta: `${m.periodEntradas} no período`, trend: m.entradasTrend, nav: "patio:no_patio" })}
          ${renderCard({ theme: "out", icon: "vehicle", label: "Saídas do dia", value: m.saidasDia, meta: `${m.periodSaidas} no período`, trend: m.saidasTrend, nav: "patio:no_patio" })}
          ${renderCard({ theme: "stay", icon: "stay", label: "Tempo médio permanência", value: `${Number(m.avgStay).toFixed(1).replace(".", ",")} dias`, meta: "média operacional", trend: m.patioDash?.stayTrend, invertTrend: true, sparkColor: "#fbbf24", nav: "patio:no_patio" })}
          ${renderCard({ theme: "status", icon: "vehicle", label: "Veículos por status", value: `VNP ${m.statusCounts.no_patio}`, meta: `VLP ${m.statusCounts.vlp} · VRP ${m.statusCounts.removido}`, nav: "patio:no_patio" })}
          ${renderCard({ theme: "occupancy", icon: "occupancy", label: "Ocupação do pátio", value: m.ocupacaoPct, valueType: "pct", meta: `${m.onPatioCount} / ${m.capacity} vagas`, trend: m.patioDash?.occupancyTrend, spark: m.patioDash?.occupancySpark, sparkColor: "#06b6d4", nav: "patio:no_patio" })}
          ${renderCard({ theme: "vlp", icon: "vehicle", label: "Aguardando liberação", value: m.vlpCount, meta: "status VLP", nav: "patio:no_patio" })}
          ${renderCard({ theme: "done", icon: "vehicle", label: "Finalizados no mês", value: m.finalizadosMes, meta: "veículos removidos", nav: "patio:no_patio" })}
        </div>
      </section>

      <section class="hub-dash-charts hub-dash-charts--gestor">
        <div class="hub-chart-panel section-card">
          <h4>Entradas × saídas de veículos</h4>
          ${barChartSvg(m.months.map((ym) => ym.slice(5)), [{ name: "Entradas", values: m.entradasByMonth }, { name: "Saídas", values: m.saidasByMonth }], ["#34d399", "#f87171"], 200)}
        </div>
        <div class="hub-chart-panel section-card">
          <h4>Veículos por status</h4>
          ${barChartSvg(["VNP", "VLP", "VRP"], [{ name: "Qtd", values: [m.statusCounts.no_patio, m.statusCounts.vlp, m.statusCounts.removido] }], ["#22d3ee", "#fbbf24", "#94a3b8"], 160)}
        </div>
      </section>

      <section class="hub-dash-rankings hub-dash-rankings--gestor">
        <div class="hub-rank-panel section-card">
          <h4>Maior tempo no pátio</h4>
          <ol class="hub-rank-list">
            ${m.longStay.length ? m.longStay.map((x, i) => `<li class="hub-rank-item"><span class="hub-rank-pos">${i + 1}</span><span class="hub-rank-name">${escapeHtml(x.v.placa || "—")}</span><span class="hub-rank-val">${x.days} dias</span></li>`).join("") : `<p class="hub-rank-empty">Nenhum veículo com permanência elevada.</p>`}
          </ol>
        </div>
        <div class="hub-rank-panel section-card hub-growth-panel">
          <h4>Movimentação no período</h4>
          <ul class="hub-growth-list">
            <li><span>Entradas (${m.range.label})</span><strong class="${formatTrend(m.entradasTrend).cls}">${formatTrend(m.entradasTrend).arrow} ${formatTrend(m.entradasTrend).text}</strong></li>
            <li><span>Saídas (${m.range.label})</span><strong class="${formatTrend(m.saidasTrend).cls}">${formatTrend(m.saidasTrend).arrow} ${formatTrend(m.saidasTrend).text}</strong></li>
            <li><span>Ocupação média</span><strong>${Number(m.avgStay).toFixed(1).replace(".", ",")} dias</strong></li>
          </ul>
          <p class="hub-ops-footnote">${escapeHtml(m.range.label)} · perfil gestor de pista</p>
        </div>
      </section>
    `;
      return;
    }

    const monthLabels = m.months.map((ym) => ym.slice(5));
    const topRev = (pd?.rankedRevenue || []).slice(0, 5).map((r) => ({
      label: r.nome,
      value: r.revenue,
      color: "#60a5fa",
    }));
    const topVeh = (pd?.rankedVehicles || []).slice(0, 5).map((r) => ({
      label: r.nome,
      value: r.vehicles,
      color: "#34d399",
    }));

    root.innerHTML = `
      <section class="hub-dash-section">
        <h3 class="hub-dash-section-title">Financeiro</h3>
        <div class="hub-ops-cards">
          ${renderCard({ theme: "recv", icon: "recv", label: "Contas a receber", value: fin.totalReceber, valueType: "currency", formatCurrency, meta: `${fin.pendentes || 0} pendente(s)`, trend: fd?.receivableTrend, trendLabel: "vs. período anterior", spark: fd?.billingMonthlySpark, sparkColor: "#fb923c", nav: "financeiro" })}
          ${renderCard({ theme: "pay", icon: "pay", label: "Contas a pagar", value: fin.totalPagar, valueType: "currency", formatCurrency, meta: `${fin.vencidas || 0} vencida(s)`, trend: fd?.inadimplenciaTrend, invertTrend: true, trendLabel: "inadimplência", nav: "financeiro" })}
          ${renderCard({ theme: "wait", icon: "billing", label: "Aguardando faturamento", value: m.aguardandoValor, valueType: "currency", formatCurrency, meta: `${m.aguardandoCount} veículo(s)`, nav: "financeiro" })}
          ${renderCard({ theme: "month", icon: "billing", label: "Faturamento mensal", value: fd?.faturadoMes ?? fin.recebidoMes, valueType: "currency", formatCurrency, meta: "mês atual", trend: fd?.faturadoMesTrend, spark: fd?.faturadoMesSpark, sparkColor: "#a78bfa", nav: "financeiro" })}
          ${renderCard({ theme: "ticket", icon: "ticket", label: "Ticket médio financeiro", value: fd?.ticketMedio ?? 0, valueType: "currency", formatCurrency, meta: `${fd?.billedUnits ?? 0} unidade(s) faturada(s)`, trend: fd?.ticketTrend, sparkColor: "#f472b6", nav: "financeiro" })}
          ${renderCard({ theme: "profit", icon: "profit", label: "Lucro estimado do mês", value: m.lucroEstimado, valueType: "currency", formatCurrency, meta: "recebido − despesas", trend: fd?.recebidoMesTrend, sparkColor: "#4ade80", nav: "financeiro" })}
          ${renderCard({ theme: "pending-recv", icon: "recv", label: "Recebimentos pendentes", value: fin.pendentes ?? 0, meta: "títulos em aberto", nav: "financeiro" })}
          ${renderCard({ theme: "pending-pay", icon: "pay", label: "Pagamentos pendentes", value: m.pagPendentes, meta: "contas a pagar abertas", nav: "financeiro" })}
        </div>
      </section>

      <section class="hub-dash-section">
        <h3 class="hub-dash-section-title">Gestão de Pátio</h3>
        <div class="hub-ops-cards">
          ${renderCard({ theme: "vnp", icon: "vehicle", label: "Veículos no pátio", value: m.onPatioCount, meta: `VLP: ${m.vlpCount}`, trend: m.patioDash?.occupancyTrend, spark: m.patioDash?.occupancySpark, sparkColor: "#22d3ee", nav: "patio:no_patio" })}
          ${renderCard({ theme: "in", icon: "vehicle", label: "Entradas do dia", value: m.entradasDia, meta: `${m.periodEntradas} no período`, trend: m.entradasTrend, nav: "patio:no_patio" })}
          ${renderCard({ theme: "out", icon: "vehicle", label: "Saídas do dia", value: m.saidasDia, meta: `${m.periodSaidas} no período`, trend: m.saidasTrend, nav: "patio:removidos" })}
          ${renderCard({ theme: "stay", icon: "stay", label: "Tempo médio permanência", value: `${Number(m.avgStay).toFixed(1).replace(".", ",")} dias`, meta: "média operacional", trend: m.patioDash?.stayTrend, invertTrend: true, sparkColor: "#fbbf24", nav: "patio:no_patio" })}
          ${renderCard({ theme: "status", icon: "vehicle", label: "Veículos por status", value: `VNP ${m.statusCounts.no_patio}`, meta: `VLP ${m.statusCounts.vlp} · VRP ${m.statusCounts.removido}`, nav: "patio:no_patio" })}
          ${renderCard({ theme: "occupancy", icon: "occupancy", label: "Ocupação do pátio", value: m.ocupacaoPct, valueType: "pct", meta: `${m.onPatioCount} / ${m.capacity} vagas`, trend: m.patioDash?.occupancyTrend, spark: m.patioDash?.occupancySpark, sparkColor: "#06b6d4", nav: "patio:no_patio" })}
          ${renderCard({ theme: "vlp", icon: "vehicle", label: "Aguardando liberação", value: m.vlpCount, meta: "status VLP", nav: "patio:no_patio" })}
          ${renderCard({ theme: "done", icon: "vehicle", label: "Finalizados no mês", value: m.finalizadosMes, meta: "veículos removidos", nav: "patio:removidos" })}
        </div>
      </section>

      <section class="hub-dash-section">
        <h3 class="hub-dash-section-title">Parceiros</h3>
        <div class="hub-ops-cards">
          ${renderCard({ theme: "partners", icon: "partners", label: "Parceiros cadastrados", value: pd?.totalPartners ?? 0, meta: `+${pd?.partnersThisMonth ?? 0} no mês`, trend: pd?.partnerGrowthPct, spark: pd?.monthlySeries?.newPartners, sparkColor: "#a78bfa", nav: "parceiros" })}
          ${renderCard({ theme: "active", icon: "partners", label: "Parceiro mais ativo", value: (pd?.rankedActive?.[0]?.nome || "—").slice(0, 20), meta: pd?.rankedActive?.[0] ? `${pd.rankedActive[0].vehicles} veíc.` : "—", trend: pd?.vehiclesTrend, nav: "parceiros" })}
          ${renderCard({ theme: "ticket-p", icon: "ticket", label: "Ticket médio / parceiro", value: pd?.ticketMedio ?? 0, valueType: "currency", formatCurrency, meta: m.range.label, trend: pd?.ticketTrend, nav: "parceiros" })}
          ${renderCard({ theme: "rev-top", icon: "billing", label: "Ranking financeiro", value: (pd?.rankedRevenue?.[0]?.nome || "—").slice(0, 20), meta: pd?.rankedRevenue?.[0] ? formatCurrency(pd.rankedRevenue[0].revenue) : "—", trend: pd?.revenueTrend, nav: "parceiros" })}
          ${renderCard({ theme: "veh-top", icon: "vehicle", label: "Ranking por veículos", value: (pd?.rankedVehicles?.[0]?.nome || "—").slice(0, 20), meta: pd?.rankedVehicles?.[0] ? `${pd.rankedVehicles[0].vehicles} veíc.` : "—", trend: pd?.vehiclesTrend, nav: "parceiros" })}
          ${renderCard({ theme: "idle", icon: "idle", label: "Sem movimentação recente", value: pd?.inactive?.length ?? 0, meta: "parceiros inativos no período", invertTrend: true, nav: "parceiros" })}
        </div>
      </section>

      <section class="hub-dash-charts">
        <div class="hub-chart-panel section-card">
          <h4>Evolução do faturamento mensal</h4>
          ${barChartSvg(monthLabels, [{ name: "Faturamento", values: m.billingByMonth }], ["#a78bfa"], 200)}
        </div>
        <div class="hub-chart-panel section-card">
          <h4>Entradas × saídas de veículos</h4>
          ${barChartSvg(monthLabels, [{ name: "Entradas", values: m.entradasByMonth }, { name: "Saídas", values: m.saidasByMonth }], ["#34d399", "#f87171"], 200)}
        </div>
        <div class="hub-chart-panel section-card">
          <h4>Crescimento de parceiros</h4>
          ${barChartSvg(monthLabels, [{ name: "Novos", values: m.partnerGrowthByMonth }], ["#60a5fa"], 180)}
        </div>
        <div class="hub-chart-panel section-card">
          <h4>Fluxo financeiro mensal</h4>
          ${barChartSvg(monthLabels, [{ name: "Saldo", values: m.fluxoByMonth }], ["#38bdf8"], 180)}
        </div>
        <div class="hub-chart-panel section-card">
          <h4>Veículos por status</h4>
          ${barChartSvg(["VNP", "VLP", "VRP"], [{ name: "Qtd", values: [m.statusCounts.no_patio, m.statusCounts.vlp, m.statusCounts.removido] }], ["#22d3ee", "#fbbf24", "#94a3b8"], 160)}
        </div>
        <div class="hub-chart-panel section-card">
          <h4>Ranking financeiro — top 5</h4>
          ${hBarChartSvg(topRev, formatCurrency)}
        </div>
        <div class="hub-chart-panel section-card">
          <h4>Top parceiros do mês (veículos)</h4>
          ${hBarChartSvg(topVeh, (n) => String(n))}
        </div>
        <div class="hub-chart-panel section-card">
          <h4>Comparativo mensal de desempenho</h4>
          ${barChartSvg(monthLabels, [{ name: "Entradas", values: m.entradasByMonth }, { name: "Faturamento", values: m.billingByMonth }], ["#4ade80", "#a78bfa"], 200)}
        </div>
      </section>

      <section class="hub-dash-rankings">
        <div class="hub-rank-panel section-card">
          <h4>Top 5 — retorno financeiro</h4>
          ${renderRankList(pd?.rankedRevenue, formatCurrency, "revenue")}
        </div>
        <div class="hub-rank-panel section-card">
          <h4>Top 5 — volume de veículos</h4>
          ${renderRankList(pd?.rankedVehicles, (n) => String(n), "vehicles")}
        </div>
        <div class="hub-rank-panel section-card">
          <h4>Maior tempo no pátio</h4>
          <ol class="hub-rank-list">
            ${m.longStay.length ? m.longStay.map((x, i) => `<li class="hub-rank-item"><span class="hub-rank-pos">${i + 1}</span><span class="hub-rank-name">${escapeHtml(x.v.placa || "—")}</span><span class="hub-rank-val">${x.days} dias</span></li>`).join("") : `<p class="hub-rank-empty">Nenhum veículo com permanência elevada.</p>`}
          </ol>
        </div>
        <div class="hub-rank-panel section-card">
          <h4>Maiores recebimentos pendentes</h4>
          <ol class="hub-rank-list">
            ${m.topPendingRecv.length ? m.topPendingRecv.map((r, i) => `<li class="hub-rank-item"><span class="hub-rank-pos">${i + 1}</span><span class="hub-rank-name">${escapeHtml(r.placa)} · ${escapeHtml(r.parceiro)}</span><span class="hub-rank-val">${escapeHtml(formatCurrency(r.valor))}</span></li>`).join("") : `<p class="hub-rank-empty">Nenhum título pendente.</p>`}
          </ol>
        </div>
        <div class="hub-rank-panel section-card hub-growth-panel">
          <h4>Indicadores de crescimento</h4>
          <ul class="hub-growth-list">
            <li><span>Faturamento</span><strong class="${formatTrend(fd?.faturadoMesTrend).cls}">${formatTrend(fd?.faturadoMesTrend).arrow} ${formatTrend(fd?.faturadoMesTrend).text}</strong></li>
            <li><span>Entradas (${m.range.label})</span><strong class="${formatTrend(m.entradasTrend).cls}">${formatTrend(m.entradasTrend).arrow} ${formatTrend(m.entradasTrend).text}</strong></li>
            <li><span>Saídas (${m.range.label})</span><strong class="${formatTrend(m.saidasTrend).cls}">${formatTrend(m.saidasTrend).arrow} ${formatTrend(m.saidasTrend).text}</strong></li>
            <li><span>Parceiros (volume)</span><strong class="${formatTrend(pd?.vehiclesTrend).cls}">${formatTrend(pd?.vehiclesTrend).arrow} ${formatTrend(pd?.vehiclesTrend).text}</strong></li>
            <li><span>Receita parceiros</span><strong class="${formatTrend(pd?.revenueTrend).cls}">${formatTrend(pd?.revenueTrend).arrow} ${formatTrend(pd?.revenueTrend).text}</strong></li>
          </ul>
          <p class="hub-ops-footnote">Comparativo vs. período anterior equivalente · ${escapeHtml(m.range.label)}</p>
        </div>
      </section>
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

/**
 * Dashboard Financeiro — UI (browser runtime).
 * Sobrescreve window.financeDashboardRender para o finance-module continuar funcionando.
 * Indicadores vêm de financialDashboardService.getMetricsFromSnapshot (SVG puro).
 */
(function financialDashboardUiModule(global) {
  "use strict";

  let _bound = false;
  let _filters = {
    period: "month",
    financeiraId: "",
    parceiroId: "",
    status: "",
    search: "",
    customFrom: "",
    customTo: "",
  };

  const PIE_COLORS = [
    "#38bdf8",
    "#34d399",
    "#a78bfa",
    "#fbbf24",
    "#f472b6",
    "#22d3ee",
    "#fb923c",
    "#4ade80",
    "#60a5fa",
    "#e879f9",
  ];

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatMoney(n, ctx) {
    if (ctx?.formatCurrency) return ctx.formatCurrency(n);
    return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function formatPct(n) {
    return `${Number(n || 0).toFixed(2).replace(".", ",")}%`;
  }

  function formatYmdBr(ymd) {
    if (!ymd || ymd.length < 10) return "—";
    return `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}/${ymd.slice(0, 4)}`;
  }

  function getService() {
    return global.financialDashboardService || null;
  }

  function resolveMountRoot() {
    let root = document.getElementById("finDashRoot");
    if (root) return root;

    const compare = document.getElementById("finDashCompareCards");
    const cards = document.getElementById("finDashCards");
    if (compare) compare.innerHTML = "";
    if (!cards) return null;

    let wrap = document.getElementById("finDashUiRoot");
    if (!wrap) {
      cards.innerHTML = "";
      wrap = document.createElement("div");
      wrap.id = "finDashUiRoot";
      wrap.className = "fin-exec-root";
      cards.appendChild(wrap);
    }
    return wrap;
  }

  function syncFiltersFromDom() {
    const periodEl = document.getElementById("finDashFilterPeriod");
    const finEl = document.getElementById("finDashFilterFinanceira");
    const partnerEl =
      document.getElementById("finDashFilterPartner") || document.getElementById("finDashPeriodPartner");
    const statusEl = document.getElementById("finDashFilterStatus");
    const searchEl = document.getElementById("finDashFilterSearch");

    if (periodEl) {
      _filters.period = periodEl.value || "month";
    } else {
      _filters.period = "month";
    }

    _filters.financeiraId = finEl ? finEl.value || "" : "";
    _filters.parceiroId = partnerEl ? partnerEl.value || "" : "";
    _filters.status = statusEl ? statusEl.value || "" : "";
    _filters.search = searchEl ? String(searchEl.value || "").trim() : "";
    _filters.customFrom = document.getElementById("finDashCustomFrom")?.value || "";
    _filters.customTo = document.getElementById("finDashCustomTo")?.value || "";
  }

  function populateSelect(sel, partners, emptyLabel, current) {
    if (!sel) return;
    const cur = current || sel.value || "";
    const list = (partners || [])
      .slice()
      .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"));
    sel.innerHTML =
      `<option value="">${escapeHtml(emptyLabel)}</option>` +
      list
        .map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.nome || "-")}</option>`)
        .join("");
    if (cur && list.some((p) => String(p.id) === String(cur))) sel.value = cur;
  }

  function populatePartnerFilters(partners) {
    const finSel = document.getElementById("finDashFilterFinanceira");
    const partnerSel =
      document.getElementById("finDashFilterPartner") || document.getElementById("finDashPeriodPartner");
    populateSelect(finSel, partners, "Todas as financeiras", _filters.financeiraId);
    populateSelect(partnerSel, partners, "Todos os parceiros", _filters.parceiroId);
  }

  function iconSvg(name) {
    const icons = {
      recv: '<path d="M12 3v18M7 8l5-5 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
      paid: '<path d="M5 12l4 4L19 6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
      billing: '<path d="M4 20V10M12 20V4M20 20v-8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
      late: '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 7v5l3 2" stroke="currentColor" stroke-width="2"/>',
      ticket: '<rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><path d="M8 6v12M16 6v12" stroke="currentColor" stroke-width="2"/>',
      forecast: '<path d="M4 18l5-6 4 3 7-9" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
      alert: '<path d="M12 9v4M12 17h.01M10.3 4.3l-7.2 12.4A2 2 0 0 0 4.7 20h14.6a2 2 0 0 0 1.6-3.3L13.7 4.3a2 2 0 0 0-3.4 0z" stroke="currentColor" stroke-width="2" fill="none"/>',
    };
    return `<svg class="hub-ops-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">${icons[name] || icons.billing}</svg>`;
  }

  function trendClass(pct, invert) {
    const up = Number(pct) >= 0;
    const good = invert ? !up : up;
    return good ? "fin-exec-trend--up" : "fin-exec-trend--down";
  }

  function renderKpiCard(opts) {
    const value =
      opts.valueType === "currency"
        ? escapeHtml(opts.formatCurrency(opts.value))
        : opts.valueType === "pct"
          ? escapeHtml(formatPct(opts.value))
          : escapeHtml(String(opts.value ?? "—"));
    const trendHtml = opts.trend
      ? `<span class="hub-ops-card-trend fin-exec-trend ${trendClass(opts.trend.pct, opts.invertTrend)}">${escapeHtml(opts.trend.label)}</span>`
      : "";
    return `<article class="hub-ops-card hub-kpi-card fin-exec-kpi hub-ops-card--${escapeHtml(opts.theme)}">
      <div class="hub-ops-card-top">
        <div class="hub-ops-card-icon">${iconSvg(opts.icon)}</div>
        ${trendHtml}
      </div>
      <span class="hub-ops-card-label">${escapeHtml(opts.label)}</span>
      <strong class="hub-ops-card-value">${value}</strong>
      <small class="hub-ops-card-meta">${escapeHtml(opts.meta || "")}</small>
    </article>`;
  }

  function barChartSvg(labels, values, color, height) {
    if (!labels?.length) return `<p class="hub-chart-empty">Sem dados no período.</p>`;
    const w = 640;
    const h = height || 200;
    const pad = { l: 8, r: 8, t: 12, b: 28 };
    const innerW = w - pad.l - pad.r;
    const innerH = h - pad.t - pad.b;
    const max = Math.max(1, ...values);
    const groupW = innerW / labels.length;
    const barW = Math.min(28, groupW * 0.62);
    const showEvery = labels.length > 12 ? Math.ceil(labels.length / 8) : 1;
    let svg = "";
    labels.forEach((lbl, i) => {
      const val = values[i] || 0;
      const gx = pad.l + i * groupW + groupW / 2;
      const bh = (val / max) * innerH;
      const x = gx - barW / 2;
      const y = pad.t + innerH - bh;
      svg += `<rect class="fin-exec-bar" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" rx="3" fill="${color || "#38bdf8"}" opacity="0.9"><title>${escapeHtml(String(lbl))}: ${escapeHtml(String(val))}</title></rect>`;
      if (i % showEvery === 0 || i === labels.length - 1) {
        svg += `<text x="${gx}" y="${h - 8}" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.55">${escapeHtml(String(lbl))}</text>`;
      }
    });
    return `<svg class="hub-chart fin-exec-chart" viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img">${svg}</svg>`;
  }

  function lineChartSvg(labels, series, height) {
    if (!labels?.length) return `<p class="hub-chart-empty">Sem dados no período.</p>`;
    const w = 640;
    const h = height || 220;
    const pad = { l: 12, r: 12, t: 16, b: 28 };
    const innerW = w - pad.l - pad.r;
    const innerH = h - pad.t - pad.b;
    const allVals = series.flatMap((s) => s.values || []);
    const max = Math.max(1, ...allVals.map((v) => Math.abs(v)), ...allVals);
    const min = Math.min(0, ...allVals);
    const span = Math.max(1, max - min);
    const n = labels.length;
    const xAt = (i) => pad.l + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    const yAt = (v) => pad.t + innerH - ((v - min) / span) * innerH;

    let svg = "";
    // zero line
    if (min < 0 && max > 0) {
      const zy = yAt(0);
      svg += `<line x1="${pad.l}" y1="${zy.toFixed(1)}" x2="${w - pad.r}" y2="${zy.toFixed(1)}" stroke="currentColor" opacity="0.15"/>`;
    }

    series.forEach((s) => {
      const pts = (s.values || [])
        .map((v, i) => `${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`)
        .join(" ");
      svg += `<polyline class="fin-exec-line" fill="none" stroke="${s.color}" stroke-width="2.2" points="${pts}" opacity="0.92"/>`;
      (s.values || []).forEach((v, i) => {
        svg += `<circle cx="${xAt(i).toFixed(1)}" cy="${yAt(v).toFixed(1)}" r="2.5" fill="${s.color}" opacity="0.9"><title>${escapeHtml(s.name)} · ${escapeHtml(String(labels[i]))}: ${escapeHtml(String(v))}</title></circle>`;
      });
    });

    const showEvery = n > 12 ? Math.ceil(n / 8) : 1;
    labels.forEach((lbl, i) => {
      if (i % showEvery === 0 || i === n - 1) {
        svg += `<text x="${xAt(i)}" y="${h - 8}" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.55">${escapeHtml(String(lbl))}</text>`;
      }
    });

    const legend = series
      .map(
        (s) =>
          `<span class="fin-exec-legend-item"><i style="background:${s.color}"></i>${escapeHtml(s.name)}</span>`
      )
      .join("");

    return `<div class="fin-exec-chart-wrap">
      <div class="fin-exec-legend">${legend}</div>
      <svg class="hub-chart fin-exec-chart" viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img">${svg}</svg>
    </div>`;
  }

  function hBarChartSvg(items, fmt) {
    if (!items?.length) return `<p class="hub-chart-empty">Sem dados.</p>`;
    const w = 640;
    const h = Math.min(320, 36 + items.length * 34);
    const max = Math.max(1, ...items.map((i) => i.value));
    let svg = "";
    items.forEach((item, i) => {
      const y = 12 + i * 34;
      const bw = ((item.value || 0) / max) * (w - 200);
      svg += `<text x="8" y="${y + 14}" font-size="11" fill="currentColor" opacity="0.85">${escapeHtml(String(item.label || "").slice(0, 24))}</text>`;
      svg += `<rect class="fin-exec-hbar" x="180" y="${y}" width="${bw.toFixed(1)}" height="20" rx="4" fill="${item.color || "#60a5fa"}" opacity="0.88"><title>${escapeHtml(item.label)}: ${escapeHtml(fmt(item.value))} (${escapeHtml(formatPct(item.pct || 0))})</title></rect>`;
      svg += `<text x="${(186 + bw).toFixed(1)}" y="${y + 14}" font-size="10" fill="currentColor" opacity="0.7">${escapeHtml(fmt(item.value))}</text>`;
    });
    return `<svg class="hub-chart hub-chart--hbar fin-exec-chart" viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img">${svg}</svg>`;
  }

  function pieChartSvg(items) {
    if (!items?.length) return `<p class="hub-chart-empty">Sem dados.</p>`;
    const total = items.reduce((s, x) => s + (x.value || 0), 0) || 1;
    const cx = 120;
    const cy = 120;
    const r = 90;
    let angle = -Math.PI / 2;
    let paths = "";
    items.forEach((item, i) => {
      const slice = ((item.value || 0) / total) * Math.PI * 2;
      const a0 = angle;
      const a1 = angle + slice;
      angle = a1;
      const x0 = cx + r * Math.cos(a0);
      const y0 = cy + r * Math.sin(a0);
      const x1 = cx + r * Math.cos(a1);
      const y1 = cy + r * Math.sin(a1);
      const large = slice > Math.PI ? 1 : 0;
      const color = item.color || PIE_COLORS[i % PIE_COLORS.length];
      if (slice <= 0) return;
      if (Math.abs(slice - Math.PI * 2) < 1e-6) {
        paths += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity="0.9"><title>${escapeHtml(item.label)}: ${escapeHtml(formatPct(item.pct))}</title></circle>`;
      } else {
        paths += `<path class="fin-exec-pie-slice" d="M ${cx} ${cy} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z" fill="${color}" opacity="0.9"><title>${escapeHtml(item.label)}: ${escapeHtml(formatPct(item.pct))}</title></path>`;
      }
    });
    const legend = items
      .slice(0, 8)
      .map(
        (item, i) =>
          `<li><i style="background:${item.color || PIE_COLORS[i % PIE_COLORS.length]}"></i><span>${escapeHtml(String(item.label || "").slice(0, 22))}</span><strong>${escapeHtml(formatPct(item.pct))}</strong></li>`
      )
      .join("");
    return `<div class="fin-exec-pie-wrap">
      <svg class="hub-chart fin-exec-chart fin-exec-pie" viewBox="0 0 240 240" width="220" height="220" role="img">${paths}</svg>
      <ul class="fin-exec-pie-legend">${legend}</ul>
    </div>`;
  }

  function renderAlerts(alerts, formatCurrency) {
    const a = alerts || {};
    const rows = [];
    if (a.titulosVencidos?.count > 0) {
      rows.push({
        level: "danger",
        title: `${a.titulosVencidos.count} título(s) vencido(s)`,
        detail: formatCurrency(a.titulosVencidos.valor),
      });
    }
    if (a.vencendoHoje?.count > 0) {
      rows.push({
        level: "warn",
        title: `${a.vencendoHoje.count} vencendo hoje`,
        detail: formatCurrency(a.vencendoHoje.valor),
      });
    }
    if (a.vencendo7Dias?.count > 0) {
      rows.push({
        level: "info",
        title: `${a.vencendo7Dias.count} vencendo em 7 dias`,
        detail: formatCurrency(a.vencendo7Dias.valor),
      });
    }
    (a.financeirasMaiorDivida || []).slice(0, 3).forEach((f) => {
      rows.push({
        level: "warn",
        title: `Maior dívida: ${f.nome}`,
        detail: formatCurrency(f.valor),
      });
    });

    if (!rows.length) {
      return `<section class="hub-dash-section fin-exec-alerts">
        <div class="hub-alert hub-alert--ok fin-exec-alert"><span class="hub-alert-icon">✓</span><span>Financeiro estável — nenhum alerta crítico.</span></div>
      </section>`;
    }

    return `<section class="hub-dash-section fin-exec-alerts">
      <div class="fin-exec-alerts-grid">
        ${rows
          .map(
            (r) => `<div class="hub-alert hub-alert--${escapeHtml(r.level)} fin-exec-alert">
              <span class="hub-alert-icon">${iconSvg("alert")}</span>
              <span class="hub-alert-body"><strong>${escapeHtml(r.title)}</strong><small>${escapeHtml(r.detail)}</small></span>
            </div>`
          )
          .join("")}
      </div>
    </section>`;
  }

  function renderDataTable(title, headers, bodyHtml, emptyText) {
    return `<section class="hub-dash-section fin-exec-table-section">
      <div class="hub-table-panel section-card fin-exec-panel">
        <h3 class="hub-table-title">${escapeHtml(title)}</h3>
        <div class="table-wrap hub-table-wrap">
          <table class="table hub-exec-table fin-exec-table">
            <thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
            <tbody>${bodyHtml || `<tr><td colspan="${headers.length}" class="hub-table-empty">${escapeHtml(emptyText)}</td></tr>`}</tbody>
          </table>
        </div>
      </div>
    </section>`;
  }

  function renderIndicadores(ind, formatCurrency) {
    const rows = [
      { label: "Receita hoje", value: formatCurrency(ind.receitaHoje) },
      { label: "Receita semana", value: formatCurrency(ind.receitaSemana) },
      { label: "Receita mês", value: formatCurrency(ind.receitaMes) },
      { label: "Receita ano", value: formatCurrency(ind.receitaAno) },
      { label: "Receita média diária", value: formatCurrency(ind.receitaMediaDiaria) },
      { label: "Receita média mensal", value: formatCurrency(ind.receitaMediaMensal) },
    ];
    return `<section class="hub-dash-section">
      <article class="hub-ops-situation section-card fin-exec-panel fin-exec-indicadores">
        <h3 class="hub-ops-situation-title">Indicadores Financeiros</h3>
        <ul class="hub-ops-situation-list fin-exec-indicadores-list">
          ${rows
            .map(
              (r) => `<li class="hub-ops-situation-item">
                <span class="hub-ops-situation-label">${escapeHtml(r.label)}</span>
                <strong class="hub-ops-situation-value">${escapeHtml(r.value)}</strong>
              </li>`
            )
            .join("")}
        </ul>
      </article>
    </section>`;
  }

  function computeMetrics(data) {
    const service = getService();
    if (!service || typeof service.getMetricsFromSnapshot !== "function") {
      console.error(
        "[financial-dashboard-ui] financialDashboardService indisponível. Inclua financial-metrics-service.js antes deste script."
      );
      return null;
    }
    return service.getMetricsFromSnapshot(
      {
        receivables: data.receivables || [],
        cash: data.cash || [],
        vehicles: data.vehicles || [],
        partners: data.partners || [],
        asOfYmd: data.asOfYmd,
      },
      {
        period: _filters.period,
        financeiraId: _filters.financeiraId,
        parceiroId: _filters.parceiroId,
        status: _filters.status,
        search: _filters.search,
        customFrom: _filters.customFrom,
        customTo: _filters.customTo,
      }
    );
  }

  function sliceFluxoToRange(fluxo, range) {
    const labels = fluxo?.labels || [];
    const fromYm = String(range?.from || "").slice(0, 7);
    const toYm = String(range?.to || "").slice(0, 7);
    const idx = [];
    labels.forEach((lbl, i) => {
      const mm = String(lbl || "").slice(0, 2);
      const yy = String(lbl || "").slice(3);
      const ym = /^\d{2}$/.test(yy) ? `20${yy}-${mm}` : "";
      if (ym && ym >= fromYm && ym <= toYm) idx.push(i);
    });
    const use = idx.length ? idx : labels.map((_, i) => i);
    const entradas = use.map((i) => Number(fluxo.entradas?.[i] || 0));
    const saidas = use.map((i) => Number(fluxo.saidas?.[i] || 0));
    let acc = 0;
    const saldo = entradas.map((e, i) => {
      acc += e - saidas[i];
      return acc;
    });
    return {
      labels: use.map((i) => labels[i]),
      entradas,
      saidas,
      saldo,
    };
  }

  function financeDashboardRender(data, ctx) {
    init();
    const root = resolveMountRoot();
    if (!root) return;

    syncFiltersFromDom();
    populatePartnerFilters(data?.partners);

    const searchEl = document.getElementById("finGlobalSearch");
    const hiddenSearch = document.getElementById("finDashFilterSearch");
    if (searchEl && hiddenSearch && searchEl.value !== hiddenSearch.value) {
      if (!searchEl.dataset.finTouched) searchEl.value = hiddenSearch.value || "";
    }

    const formatCurrency = (n) => formatMoney(n, ctx);
    const m = computeMetrics(data || {});
    if (!m) {
      root.innerHTML = `<p class="fin-ops-footnote">Serviço de métricas financeiras indisponível.</p>`;
      return;
    }

    const k = m.kpis;
    const period = _filters.period || "month";
    const periods = [
      ["today", "Hoje"],
      ["7d", "7 dias"],
      ["month", "Este mês"],
      ["prev_month", "Mês anterior"],
      ["3m", "3 meses"],
      ["custom", "Personalizado"],
    ];
    const periodPills = periods
      .map(
        ([value, label]) =>
          `<button type="button" class="fin-act-period-btn${period === value ? " is-active" : ""}" data-fin-act-period="${value}">${escapeHtml(label)}</button>`
      )
      .join("");

    const rangeLabel = `${formatYmdBr(m.range.from)} até ${formatYmdBr(m.range.to)}`;
    const rangeEl = document.getElementById("finPeriodRangeLabel");
    if (rangeEl) rangeEl.textContent = rangeLabel;

    const aReceber = k.contasAReceber?.valor || 0;
    const recebido = k.recebidoPeriodo?.valor ?? k.recebimentosMes?.valor ?? 0;
    const emAtraso = k.inadimplencia?.valor || 0;
    const resultado = k.resultadoPeriodo || 0;
    const entradas = k.entradasPeriodo || 0;
    const saidas = k.saidasPeriodo || 0;
    const saldoPeriodo = entradas - saidas;
    const fluxo = sliceFluxoToRange(m.fluxo || {}, m.range);

    const alerts = m.alerts || {};
    const recHoje = m.indicadores?.recebidosHoje || 0;
    const attentionItems = [
      {
        tone: "red",
        filter: "vencidos",
        view: "receber",
        count: alerts.titulosVencidos?.count || 0,
        title: "Cobranças vencidas",
        detail: formatCurrency(alerts.titulosVencidos?.valor || 0),
      },
      {
        tone: "amber",
        filter: "vencendo_7",
        view: "receber",
        count: alerts.vencendo7Dias?.count || 0,
        title: "Cobranças vencendo em 7 dias",
        detail: formatCurrency(alerts.vencendo7Dias?.valor || 0),
      },
      {
        tone: "green",
        filter: "recebidos_hoje",
        view: "receber",
        count: recHoje,
        title: "Pagamentos recebidos hoje",
        detail: formatCurrency(m.indicadores?.receitaHoje || 0),
      },
    ];
    const ui = global.financeActionUi;
    const attentionHtml = ui?.renderAttentionCards
      ? ui.renderAttentionCards(attentionItems)
      : "";

    const customOpen = period === "custom" ? "" : " hidden";

    root.innerHTML = `
      <div class="fin-act-home">
        <div class="fin-act-home-head">
          <h2>Financeiro — Visão geral</h2>
          <strong>${escapeHtml(rangeLabel)}</strong>
        </div>
        <div class="fin-act-periods" role="tablist" aria-label="Período">${periodPills}</div>
        <div class="fin-act-custom"${customOpen}>
          <label>De<input type="date" id="finDashCustomFrom" value="${escapeHtml(_filters.customFrom || "")}"></label>
          <label>Até<input type="date" id="finDashCustomTo" value="${escapeHtml(_filters.customTo || "")}"></label>
        </div>
        <section class="fin-act-kpis" aria-label="Visão financeira">
          <button type="button" class="fin-act-kpi fin-act-kpi--recv" data-fin-act-goto="receber" data-fin-act-filter="todos">
            <span class="fin-act-kpi-label">A receber</span>
            <strong class="fin-act-kpi-value">${escapeHtml(formatCurrency(aReceber))}</strong>
            <span class="fin-act-kpi-desc">Total a receber</span>
            <small class="fin-act-kpi-meta">${k.contasAReceber?.titulos || 0} título(s) em aberto</small>
          </button>
          <button type="button" class="fin-act-kpi fin-act-kpi--paid" data-fin-act-goto="receber" data-fin-act-filter="recebidos">
            <span class="fin-act-kpi-label">Recebido</span>
            <strong class="fin-act-kpi-value">${escapeHtml(formatCurrency(recebido))}</strong>
            <span class="fin-act-kpi-desc">Total recebido</span>
            <small class="fin-act-kpi-meta">${k.recebidoPeriodo?.pagamentos || 0} no período</small>
          </button>
          <button type="button" class="fin-act-kpi fin-act-kpi--late" data-fin-act-goto="receber" data-fin-act-filter="vencidos">
            <span class="fin-act-kpi-label">Em atraso</span>
            <strong class="fin-act-kpi-value">${escapeHtml(formatCurrency(emAtraso))}</strong>
            <span class="fin-act-kpi-desc">Total vencido</span>
            <small class="fin-act-kpi-meta">${k.inadimplencia?.titulos || 0} vencido(s)</small>
          </button>
          <button type="button" class="fin-act-kpi fin-act-kpi--result${resultado < 0 ? " is-negative" : ""}" data-fin-act-goto="caixa">
            <span class="fin-act-kpi-label">Resultado</span>
            <strong class="fin-act-kpi-value">${escapeHtml(formatCurrency(resultado))}</strong>
            <span class="fin-act-kpi-desc">Entradas - Saídas</span>
            <small class="fin-act-kpi-meta">No período selecionado</small>
          </button>
        </section>
        <section class="fin-act-panel">
          <h3>Fluxo de caixa</h3>
          <div class="fin-act-flow-stats">
            <div class="fin-act-flow-stat"><span>Entradas</span><strong>${escapeHtml(formatCurrency(entradas))}</strong></div>
            <div class="fin-act-flow-stat"><span>Saídas</span><strong>${escapeHtml(formatCurrency(saidas))}</strong></div>
            <div class="fin-act-flow-stat"><span>Saldo</span><strong>${escapeHtml(formatCurrency(saldoPeriodo))}</strong></div>
          </div>
          ${lineChartSvg(
            fluxo.labels,
            [
              { name: "Entradas", values: fluxo.entradas, color: "#16a34a" },
              { name: "Saídas", values: fluxo.saidas || [], color: "#dc2626" },
              { name: "Saldo", values: fluxo.saldo, color: "#1677ff" },
            ],
            220
          )}
        </section>
        <section class="fin-act-panel">
          <h3>O que precisa da minha atenção</h3>
          ${attentionHtml}
        </section>
        <section class="fin-act-panel">
          <div class="fin-act-section-head">
            <h3>Contas a receber</h3>
            <button type="button" class="fin-act-linkish" data-fin-act-goto="receber" data-fin-act-filter="todos">Ver todos →</button>
          </div>
          <div class="fin-act-chips" id="finDashReceberChips"></div>
          <div id="finDashReceberPreview" class="fin-act-launch-host"></div>
        </section>
        <section class="fin-act-panel">
          <div class="fin-act-section-head">
            <h3>Contas a pagar</h3>
            <button type="button" class="fin-act-linkish" data-fin-act-goto="pagar" data-fin-act-filter="todos">Ver todos →</button>
          </div>
          <div class="fin-act-chips" id="finDashPagarChips"></div>
          <div id="finDashPagarPreview" class="fin-act-launch-host"></div>
        </section>
        <section class="fin-act-panel">
          <div class="fin-act-section-head">
            <h3>Financeiras</h3>
            <button type="button" class="fin-act-linkish" data-fin-act-goto="financeiras">Ver todas →</button>
          </div>
          <div id="finDashFinanceirasPreview"></div>
        </section>
      </div>
    `;
    bindHomeInteractions(root);
    if (typeof global.financeFillDashboardPreviews === "function") {
      global.financeFillDashboardPreviews();
    }
  }

  function bindHomeInteractions(root) {
    if (!root) return;
    const periodSel = document.getElementById("finDashFilterPeriod");
    root.querySelectorAll("[data-fin-act-period]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const value = btn.getAttribute("data-fin-act-period") || "month";
        if (periodSel) {
          if (![...periodSel.options].some((o) => o.value === value)) {
            const opt = document.createElement("option");
            opt.value = value;
            opt.textContent = value;
            periodSel.appendChild(opt);
          }
          periodSel.value = value;
        }
        _filters.period = value;
        invalidateAndRefresh();
      });
    });
    const fromEl = document.getElementById("finDashCustomFrom");
    const toEl = document.getElementById("finDashCustomTo");
    const onCustom = () => {
      _filters.customFrom = fromEl?.value || "";
      _filters.customTo = toEl?.value || "";
      invalidateAndRefresh();
    };
    fromEl?.addEventListener("change", onCustom);
    toEl?.addEventListener("change", onCustom);
    root.querySelectorAll("[data-fin-act-goto]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const view = btn.getAttribute("data-fin-act-goto");
        const filter = btn.getAttribute("data-fin-act-filter") || "";
        if (typeof global.financeActivateActionView === "function") {
          global.financeActivateActionView(view, filter);
        } else if (typeof global.financeActivateSubview === "function") {
          global.financeActivateSubview(view);
        }
      });
    });
  }

  function invalidateAndRefresh() {
    const service = getService();
    if (service && typeof service.invalidateCache === "function") service.invalidateCache();
    if (typeof global.financeRenderDashboard === "function") {
      global.financeRenderDashboard();
      return;
    }
    if (typeof global.updateDashboard === "function") {
      global.updateDashboard();
    }
  }

  function init() {
    if (_bound) return;
    _bound = true;

    const debounce = (fn, ms) => {
      let t;
      return () => {
        clearTimeout(t);
        t = setTimeout(fn, ms);
      };
    };
    const refresh = debounce(invalidateAndRefresh, 280);

    const filterIds = [
      "finDashFilterPeriod",
      "finDashFilterFinanceira",
      "finDashFilterPartner",
      "finDashFilterStatus",
      "finDashPeriodPartner",
      "finDashPeriodMonth",
    ];
    filterIds.forEach((id) => {
      document.getElementById(id)?.addEventListener("change", refresh);
    });
    document.getElementById("finDashFilterSearch")?.addEventListener("input", refresh);
  }

  // Override: finance-module chama window.financeDashboardRender
  global.financeDashboardRender = financeDashboardRender;
  global.financialDashboardUiRender = financeDashboardRender;
  global.financialDashboardUiInit = init;
  global.financialDashboardUiInvalidateCache = invalidateAndRefresh;
})(typeof window !== "undefined" ? window : globalThis);

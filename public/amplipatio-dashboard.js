/**
 * Dashboard Executivo AmpliPátio — UI.
 * Indicadores vêm exclusivamente de DashboardMetricsService (sem SQL próprio por card).
 */
(function amplipatioDashboardModule(global) {
  "use strict";

  let _cache = null;
  let _bound = false;
  const CAPACITY_WARN_PCT = 85;

  let _filterPeriod = "30d";
  let _filterPartnerId = "";
  let _filterStatus = "";
  let _filterSearch = "";

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
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
    const list = (partners || [])
      .slice()
      .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"));
    sel.innerHTML =
      `<option value="">Todos</option>` +
      list.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.nome || "-")}</option>`).join("");
    if (cur) sel.value = cur;
  }

  function dataSignature(data) {
    const v = (data?.vehicles || []).length;
    const p = (data?.partners || []).length;
    const r = (data?.receivables || []).length;
    const c = (data?.cash || []).length;
    const pay = (data?.payables || []).length;
    return `${v}:${p}:${r}:${c}:${pay}:${_filterPeriod}:${_filterPartnerId}:${_filterStatus}:${_filterSearch}`;
  }

  function getMetricsService() {
    return global.dashboardService || global.DashboardMetricsService || null;
  }

  /**
   * Todos os indicadores do hub passam por esta função.
   * Fonte única: DashboardService.getMetricsFromSnapshot.
   */
  function computeHubMetrics(data) {
    const service = getMetricsService();
    if (!service || typeof service.getMetricsFromSnapshot !== "function") {
      console.error(
        "[amplipatio-dashboard] DashboardMetricsService indisponível. Inclua dashboard-metrics-service.js antes deste script."
      );
      return emptyHubMetrics();
    }

    if (typeof service.invalidateCache === "function") service.invalidateCache();

    const result = service.getMetricsFromSnapshot(
      {
        vehicles: data.vehicles || [],
        partners: data.partners || [],
        receivables: data.receivables || [],
        settings: data.settings || {},
      },
      {
        period: _filterPeriod,
        financeiraId: _filterPartnerId,
        parceiroId: _filterPartnerId,
        status: _filterStatus || "",
        search: _filterSearch || "",
      }
    );

    const k = result.kpis;
    const ops = result.operacional;
    // VLP = autorização + liberados (mesma classificação operacional)
    const vlpCount = ops.aguardandoAutorizacao + ops.liberadosAguardandoRetirada;

    const alerts = [];
    if (result.longStay.length && result.longStay[0].days >= 30) {
      const elevated = result.longStay.filter((x) => x.days >= 30).length;
      alerts.push({
        level: "warn",
        icon: "stay",
        title: `${elevated} veículo(s) com permanência elevada`,
        detail: "Acima de 30 dias no pátio",
        nav: "patio:no_patio",
      });
    }
    if (k.ocupacao.percent >= CAPACITY_WARN_PCT) {
      alerts.push({
        level: "danger",
        icon: "occupancy",
        title: `Pátio em ${k.ocupacao.percent.toFixed(0)}% da capacidade`,
        detail: k.ocupacao.label,
        nav: "patio:no_patio",
      });
    }
    if (ops.pendenciasDocumentais > 0) {
      alerts.push({
        level: "info",
        icon: "idle",
        title: `${ops.pendenciasDocumentais} veículo(s) com pendências documentais`,
        detail: "NF-e pendente ou remoção solicitada",
        nav: "patio:no_patio",
      });
    }
    if (!result.auditOk) {
      alerts.push({
        level: "danger",
        icon: "idle",
        title: "Inconsistência nas métricas operacionais",
        detail: "A soma dos grupos não fecha com veículos no pátio",
        nav: "patio:no_patio",
      });
    }

    return {
      range: result.range,
      metricsResult: result,
      finSnap: {
        totalReceber: k.contasAReceber,
        pendentes: k.contasAReceberPendentes,
      },
      onPatioCount: k.veiculosNoPatio,
      vlpCount,
      entradasDia: k.entradasHoje,
      saidasDia: k.saidasHoje,
      ocupacaoPct: k.ocupacao.percent,
      capacity: k.ocupacao.capacity,
      financeirasAtivas: k.financeirasAtivas,
      ops: {
        aguardandoConferencia: ops.aguardandoConferencia,
        aguardandoVistoria: ops.aguardandoVistoria,
        aguardandoAutorizacao: ops.aguardandoAutorizacao,
        liberadosAguardandoRetirada: ops.liberadosAguardandoRetirada,
        comPendencias: ops.pendenciasDocumentais,
      },
      months: result.receitaMensal.months,
      billingByMonth: result.receitaMensal.values,
      dailyLabels: result.dailyFlow30d.labels,
      dailyEntradas: result.dailyFlow30d.entradas,
      dailySaidas: result.dailyFlow30d.saidas,
      vehiclesByFinanceira: result.vehiclesByFinanceira,
      longStay: result.longStay.map((x) => ({
        placa: x.placa,
        financeira: x.financeira,
        days: x.days,
        id: x.vehicleId,
      })),
      topPendingByFinanceira: result.topReceivablesByFinanceira.map((x) => ({
        financeira: x.financeira,
        veiculos: x.veiculos,
        valor: x.valor,
      })),
      alerts,
      periodEntradas: result.dailyFlow30d.entradas.reduce((a, b) => a + b, 0),
      periodSaidas: result.dailyFlow30d.saidas.reduce((a, b) => a + b, 0),
    };
  }

  function emptyHubMetrics() {
    return {
      range: { from: null, to: null, label: "—" },
      finSnap: { totalReceber: 0, pendentes: 0 },
      onPatioCount: 0,
      vlpCount: 0,
      entradasDia: 0,
      saidasDia: 0,
      ocupacaoPct: 0,
      capacity: 100,
      financeirasAtivas: 0,
      ops: {
        aguardandoConferencia: 0,
        aguardandoVistoria: 0,
        aguardandoAutorizacao: 0,
        liberadosAguardandoRetirada: 0,
        comPendencias: 0,
      },
      months: [],
      billingByMonth: [],
      dailyLabels: [],
      dailyEntradas: [],
      dailySaidas: [],
      vehiclesByFinanceira: [],
      longStay: [],
      topPendingByFinanceira: [],
      alerts: [],
      periodEntradas: 0,
      periodSaidas: 0,
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
    const service = getMetricsService();
    if (service && typeof service.invalidateCache === "function") service.invalidateCache();
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
      billing: '<path d="M4 20V10M12 20V4M20 20v-8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
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
      { key: "vistoria", label: "Veículos aguardando vistoria", value: ops.aguardandoVistoria, nav: "patio:vistoria" },
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
        document.querySelector(`#patioSubnav [data-subview="${sub}"]`)?.click();
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

    const ocupacaoMeta = `${m.onPatioCount} de ${m.capacity} vagas`;
    const kpiPatio = `
      ${renderKpiCard({ theme: "vnp", icon: "vehicle", label: "Veículos no Pátio", value: m.onPatioCount, meta: `VLP: ${m.vlpCount}`, nav: "patio:no_patio" })}
      ${renderKpiCard({ theme: "in", icon: "vehicle", label: "Entradas Hoje", value: m.entradasDia, meta: "data de entrada", nav: "patio:no_patio" })}
      ${renderKpiCard({ theme: "out", icon: "vehicle", label: "Saídas Hoje", value: m.saidasDia, meta: "data de saída", nav: "patio:removidos" })}
      ${renderKpiCard({ theme: "occupancy", icon: "occupancy", label: "Ocupação do Pátio", value: m.ocupacaoPct, valueType: "pct", meta: ocupacaoMeta, nav: "patio:no_patio" })}
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

/**
 * Dashboard Operacional — UI (browser runtime).
 * Monta #patioOpsDashRoot dentro de #patioInicioPanel e consome operationalDashboardService.
 */
(function operationalDashboardUiModule(global) {
  "use strict";

  let _bound = false;
  let _stylesInjected = false;
  let _lastData = null;
  let _lastCtx = null;
  let _filters = {
    period: "30d",
    financeiraId: "",
    parceiroId: "",
    status: "",
    search: "",
  };

  const PIE_COLORS = ["#94a3b8", "#60a5fa", "#fbbf24", "#34d399", "#22c55e"];

  const STAGE_COLOR = {
    aguardando_conferencia: "#94a3b8",
    aguardando_vistoria: "#60a5fa",
    aguardando_autorizacao: "#fbbf24",
    em_guarda: "#38bdf8",
    liberados: "#34d399",
  };

  function escapeHtmlDefault(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function esc(str, ctx) {
    if (ctx && typeof ctx.escapeHtml === "function") return ctx.escapeHtml(str);
    return escapeHtmlDefault(str);
  }

  function formatMoney(n, ctx) {
    if (ctx && typeof ctx.formatCurrency === "function") return ctx.formatCurrency(n);
    return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function formatPct(n) {
    return `${Number(n || 0).toFixed(1).replace(".", ",")}%`;
  }

  function formatAvgDays(n) {
    return Number(n || 0).toFixed(1).replace(".", ",");
  }

  function getService() {
    return global.operationalDashboardService || null;
  }

  function hideLegacyInicio() {
    const panel = document.getElementById("patioInicioPanel");
    if (!panel) return;
    panel.querySelectorAll(".patio-inicio-grid").forEach((el) => {
      el.classList.add("ops-dash-legacy-hidden", "hub-dash-legacy-hidden");
      el.setAttribute("hidden", "");
      el.setAttribute("aria-hidden", "true");
    });
    const opsCards = document.getElementById("patioDashOpsCards");
    if (opsCards) {
      opsCards.classList.add("ops-dash-legacy-hidden", "hub-dash-legacy-hidden");
      opsCards.setAttribute("hidden", "");
      opsCards.setAttribute("aria-hidden", "true");
      const section = opsCards.closest(".patio-inicio-ops-section");
      if (section) {
        section.classList.add("ops-dash-legacy-hidden", "hub-dash-legacy-hidden");
        section.setAttribute("hidden", "");
        section.setAttribute("aria-hidden", "true");
      }
    }
  }

  function injectStylesOnce() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    if (document.getElementById("opsDashUiStyles")) return;
    const style = document.createElement("style");
    style.id = "opsDashUiStyles";
    style.textContent = `
      .ops-dash-legacy-hidden { display: none !important; }
      .ops-exec-root { min-height: 120px; }
      .ops-exec-dashboard { display: flex; flex-direction: column; gap: 0; }
      .ops-exec-filters { margin-bottom: 18px; flex-wrap: wrap; }
      .ops-exec-kpis { margin-bottom: 4px; }
      .ops-exec-panel {
        background: rgba(15, 23, 42, 0.35);
        border: 1px solid rgba(148, 163, 184, 0.12);
      }
      .ops-exec-alerts { margin-bottom: 18px; }
      .ops-exec-alerts-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 10px;
      }
      .ops-exec-alert {
        display: flex; align-items: flex-start; gap: 10px;
        padding: 12px 14px; border-radius: 12px;
        border: 1px solid rgba(148,163,184,0.18);
        background: rgba(15,23,42,0.4);
        text-align: left; width: 100%;
      }
      .ops-exec-alert strong { font-size: 0.82rem; display: block; }
      .ops-exec-alert small { font-size: 0.75rem; color: var(--muted); }
      .ops-exec-alert--green { border-color: rgba(52,211,153,0.4); color: #34d399; }
      .ops-exec-alert--yellow { border-color: rgba(251,191,36,0.45); background: rgba(251,191,36,0.06); }
      .ops-exec-alert--red { border-color: rgba(248,113,113,0.45); background: rgba(248,113,113,0.08); }
      .ops-exec-fila {
        display: flex; flex-wrap: wrap; gap: 10px; align-items: stretch;
      }
      .ops-exec-fila-step {
        flex: 1 1 120px; min-width: 110px;
        padding: 14px 12px; border-radius: 12px;
        border: 1px solid rgba(148,163,184,0.14);
        background: rgba(15,23,42,0.45);
        display: flex; flex-direction: column; gap: 6px;
        position: relative;
      }
      .ops-exec-fila-step::after {
        content: "→";
        position: absolute; right: -8px; top: 50%;
        transform: translateY(-50%);
        color: rgba(148,163,184,0.45); font-size: 0.85rem;
        pointer-events: none;
      }
      .ops-exec-fila-step:last-child::after { content: none; }
      .ops-exec-fila-step span { font-size: 0.72rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
      .ops-exec-fila-step strong { font-size: 1.45rem; font-weight: 700; }
      .ops-exec-fila-step--gray { border-color: rgba(148,163,184,0.35); color: #94a3b8; }
      .ops-exec-fila-step--blue { border-color: rgba(96,165,250,0.4); color: #60a5fa; }
      .ops-exec-fila-step--yellow { border-color: rgba(251,191,36,0.4); color: #fbbf24; }
      .ops-exec-fila-step--green { border-color: rgba(52,211,153,0.4); color: #34d399; }
      .ops-exec-mapa {
        display: flex; flex-wrap: wrap; gap: 0; align-items: stretch; justify-content: space-between;
      }
      .ops-exec-mapa-node {
        flex: 1 1 140px; min-width: 120px;
        padding: 16px 14px; text-align: center;
        border: 1px solid rgba(148,163,184,0.16);
        background: linear-gradient(180deg, rgba(30,41,59,0.65), rgba(15,23,42,0.55));
        position: relative;
      }
      .ops-exec-mapa-node:first-child { border-radius: 12px 0 0 12px; }
      .ops-exec-mapa-node:last-child { border-radius: 0 12px 12px 0; }
      .ops-exec-mapa-node:not(:last-child)::after {
        content: "";
        position: absolute; right: -1px; top: 28%; bottom: 28%;
        width: 2px;
        background: linear-gradient(180deg, transparent, rgba(96,165,250,0.55), transparent);
      }
      .ops-exec-mapa-node span { display: block; font-size: 0.72rem; color: var(--muted); margin-bottom: 6px; }
      .ops-exec-mapa-node strong { font-size: 1.55rem; color: #e2e8f0; }
      .ops-exec-legend {
        display: flex; flex-wrap: wrap; gap: 10px 14px;
        margin-bottom: 8px; font-size: 0.75rem; color: var(--muted);
      }
      .ops-exec-legend-item { display: inline-flex; align-items: center; gap: 6px; }
      .ops-exec-legend-item i {
        width: 10px; height: 10px; border-radius: 2px; display: inline-block;
      }
      .ops-exec-pie-wrap {
        display: flex; flex-wrap: wrap; gap: 16px; align-items: center; justify-content: center;
      }
      .ops-exec-pie-legend {
        list-style: none; margin: 0; padding: 0;
        display: flex; flex-direction: column; gap: 8px; min-width: 160px;
      }
      .ops-exec-pie-legend li {
        display: grid; grid-template-columns: 12px 1fr auto; gap: 8px; align-items: center;
        font-size: 0.78rem;
      }
      .ops-exec-pie-legend i { width: 10px; height: 10px; border-radius: 2px; }
      .ops-exec-charts-row { margin-bottom: 24px; }
      @media (max-width: 900px) {
        .ops-exec-fila-step::after { content: none; }
        .ops-exec-mapa-node:first-child,
        .ops-exec-mapa-node:last-child,
        .ops-exec-mapa-node { border-radius: 12px; }
        .ops-exec-mapa { gap: 10px; }
        .ops-exec-mapa-node:not(:last-child)::after { content: none; }
      }
    `;
    document.head.appendChild(style);
  }

  function resolveMountRoot() {
    let root = document.getElementById("patioOpsDashRoot");
    if (root) return root;
    const panel = document.getElementById("patioInicioPanel");
    if (!panel) return null;
    root = document.createElement("div");
    root.id = "patioOpsDashRoot";
    root.className = "ops-exec-root";
    const head = panel.querySelector(".patio-inicio-head");
    if (head && head.nextSibling) {
      panel.insertBefore(root, head.nextSibling);
    } else {
      panel.insertBefore(root, panel.firstChild);
    }
    return root;
  }

  function syncFiltersFromDom() {
    const periodEl = document.getElementById("opsDashFilterPeriod");
    const finEl = document.getElementById("opsDashFilterFinanceira");
    const partnerEl = document.getElementById("opsDashFilterPartner");
    const statusEl = document.getElementById("opsDashFilterStatus");
    const searchEl = document.getElementById("opsDashFilterSearch");

    if (periodEl) _filters.period = periodEl.value || "30d";
    _filters.financeiraId = finEl ? finEl.value || "" : _filters.financeiraId;
    _filters.parceiroId = partnerEl ? partnerEl.value || "" : _filters.parceiroId;
    _filters.status = statusEl ? statusEl.value || "" : _filters.status;
    _filters.search = searchEl ? String(searchEl.value || "").trim() : _filters.search;
  }

  function populateSelect(sel, partners, emptyLabel, current) {
    if (!sel) return;
    const cur = current || sel.value || "";
    const list = (partners || [])
      .slice()
      .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"));
    sel.innerHTML =
      `<option value="">${escapeHtmlDefault(emptyLabel)}</option>` +
      list
        .map((p) => `<option value="${escapeHtmlDefault(p.id)}">${escapeHtmlDefault(p.nome || "-")}</option>`)
        .join("");
    if (cur && list.some((p) => String(p.id) === String(cur))) sel.value = cur;
  }

  function populatePartnerFilters(partners) {
    populateSelect(
      document.getElementById("opsDashFilterFinanceira"),
      partners,
      "Todas as financeiras",
      _filters.financeiraId
    );
    populateSelect(
      document.getElementById("opsDashFilterPartner"),
      partners,
      "Todos os parceiros",
      _filters.parceiroId
    );
  }

  function iconSvg(name) {
    const icons = {
      vehicle: '<path d="M4 16l2-6h12l2 6M6 16h12M8 20h2M14 20h2" stroke="currentColor" stroke-width="2" fill="none"/>',
      in: '<path d="M12 3v18M7 8l5-5 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
      out: '<path d="M12 21V3M7 16l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
      conf: '<path d="M9 11l3 3L22 4" stroke="currentColor" stroke-width="2" fill="none"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" stroke="currentColor" stroke-width="2" fill="none"/>',
      vist: '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 7v5l3 2" stroke="currentColor" stroke-width="2"/>',
      liber: '<path d="M5 12l4 4L19 6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
      alert: '<path d="M12 9v4M12 17h.01M10.3 4.3l-7.2 12.4A2 2 0 0 0 4.7 20h14.6a2 2 0 0 0 1.6-3.3L13.7 4.3a2 2 0 0 0-3.4 0z" stroke="currentColor" stroke-width="2" fill="none"/>',
    };
    return `<svg class="hub-ops-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">${icons[name] || icons.vehicle}</svg>`;
  }

  function renderKpiCard(opts, ctx) {
    const value = esc(String(opts.value ?? "—"), ctx);
    return `<article class="hub-ops-card hub-kpi-card ops-exec-kpi hub-ops-card--${esc(opts.theme, ctx)}">
      <div class="hub-ops-card-top">
        <div class="hub-ops-card-icon">${iconSvg(opts.icon)}</div>
      </div>
      <span class="hub-ops-card-label">${esc(opts.label, ctx)}</span>
      <strong class="hub-ops-card-value">${value}</strong>
      <small class="hub-ops-card-meta">${esc(opts.meta || "", ctx)}</small>
    </article>`;
  }

  function alertLevelClass(priority) {
    if (priority === "red") return "danger";
    if (priority === "yellow") return "warn";
    return "ok";
  }

  function renderAlerts(alerts, ctx) {
    const rows = alerts || [];
    if (!rows.length) {
      return `<section class="hub-dash-section ops-exec-alerts">
        <div class="hub-alert hub-alert--ok ops-exec-alert ops-exec-alert--green">
          <span class="hub-alert-icon">✓</span>
          <span>Operação estável — nenhum alerta crítico.</span>
        </div>
      </section>`;
    }
    return `<section class="hub-dash-section ops-exec-alerts">
      <div class="ops-exec-alerts-grid">
        ${rows
          .map((a) => {
            const p = a.priority || "green";
            const countLabel = a.count > 0 ? ` · ${a.count}` : "";
            return `<div class="hub-alert hub-alert--${alertLevelClass(p)} ops-exec-alert ops-exec-alert--${esc(p, ctx)}">
              <span class="hub-alert-icon">${p === "green" ? "✓" : iconSvg("alert")}</span>
              <span class="hub-alert-body">
                <strong>${esc(a.title, ctx)}${esc(countLabel, ctx)}</strong>
                <small>${esc(a.detail, ctx)}</small>
              </span>
            </div>`;
          })
          .join("")}
      </div>
    </section>`;
  }

  function renderFilterBar(ctx) {
    return `<div class="filter-bar hub-dash-filters ops-exec-filters" id="opsDashFilterBar">
      <label for="opsDashFilterPeriod">Período</label>
      <select id="opsDashFilterPeriod" title="Período de referência">
        <option value="today"${_filters.period === "today" ? " selected" : ""}>Hoje</option>
        <option value="7d"${_filters.period === "7d" ? " selected" : ""}>Últimos 7 dias</option>
        <option value="30d"${_filters.period === "30d" || !_filters.period ? " selected" : ""}>Últimos 30 dias</option>
        <option value="month"${_filters.period === "month" ? " selected" : ""}>Mês atual</option>
        <option value="year"${_filters.period === "year" ? " selected" : ""}>Ano atual</option>
      </select>
      <label for="opsDashFilterFinanceira">Financeira</label>
      <select id="opsDashFilterFinanceira" title="Filtrar por financeira (localizador)">
        <option value="">Todas</option>
      </select>
      <label for="opsDashFilterPartner">Parceiro</label>
      <select id="opsDashFilterPartner" title="Filtrar por responsável financeiro (RPP)">
        <option value="">Todos</option>
      </select>
      <label for="opsDashFilterStatus">Status</label>
      <select id="opsDashFilterStatus" title="Status operacional">
        <option value=""${_filters.status === "" ? " selected" : ""}>Todos</option>
        <option value="no_patio"${_filters.status === "no_patio" ? " selected" : ""}>No pátio</option>
        <option value="vlp"${_filters.status === "vlp" ? " selected" : ""}>VLP</option>
        <option value="removido"${_filters.status === "removido" ? " selected" : ""}>Removido</option>
      </select>
      <label for="opsDashFilterSearch">Busca</label>
      <input type="search" id="opsDashFilterSearch" placeholder="Placa ou financeira…" autocomplete="off" value="${esc(_filters.search || "", ctx)}" />
    </div>`;
  }

  function renderFila(fila, ctx) {
    const steps = [
      { key: "recebidosHoje", label: "Recebidos hoje", value: fila.recebidosHoje, tone: "gray" },
      { key: "aguardandoConferencia", label: "Aguardando conferência", value: fila.aguardandoConferencia, tone: "gray" },
      { key: "aguardandoVistoria", label: "Aguardando vistoria", value: fila.aguardandoVistoria, tone: "blue" },
      { key: "aguardandoAutorizacao", label: "Aguardando autorização", value: fila.aguardandoAutorizacao, tone: "yellow" },
      { key: "liberados", label: "Liberados", value: fila.liberados, tone: "green" },
      { key: "entregues", label: "Entregues", value: fila.entregues, tone: "green" },
    ];
    return `<section class="hub-dash-section">
      <h3 class="hub-dash-section-title">Fila operacional</h3>
      <div class="ops-exec-fila section-card ops-exec-panel" style="padding:14px">
        ${steps
          .map(
            (s) => `<div class="ops-exec-fila-step ops-exec-fila-step--${s.tone}">
              <span>${esc(s.label, ctx)}</span>
              <strong>${esc(String(s.value ?? 0), ctx)}</strong>
            </div>`
          )
          .join("")}
      </div>
    </section>`;
  }

  function renderMapa(mapa, ctx) {
    const nodes = [
      { label: "Recebidos Hoje", value: mapa.recebidosHoje },
      { label: "Em Conferência", value: mapa.emConferencia },
      { label: "Em Guarda", value: mapa.emGuarda },
      { label: "Liberados", value: mapa.liberados },
      { label: "Entregues", value: mapa.entregues },
    ];
    return `<section class="hub-dash-section">
      <h3 class="hub-dash-section-title">Mapa da operação</h3>
      <div class="ops-exec-mapa section-card ops-exec-panel">
        ${nodes
          .map(
            (n) => `<div class="ops-exec-mapa-node">
              <span>${esc(n.label, ctx)}</span>
              <strong>${esc(String(n.value ?? 0), ctx)}</strong>
            </div>`
          )
          .join("")}
      </div>
    </section>`;
  }

  function dualBarChartSvg(labels, seriesA, seriesB, colorA, colorB, height, ctx) {
    if (!labels || !labels.length) return `<p class="hub-chart-empty">Sem dados no período.</p>`;
    const w = 640;
    const h = height || 200;
    const pad = { l: 8, r: 8, t: 12, b: 28 };
    const innerW = w - pad.l - pad.r;
    const innerH = h - pad.t - pad.b;
    const max = Math.max(1, ...seriesA, ...seriesB);
    const groupW = innerW / labels.length;
    const barW = Math.min(12, groupW * 0.35);
    const showEvery = labels.length > 16 ? Math.ceil(labels.length / 10) : 1;
    let svg = "";
    labels.forEach((lbl, i) => {
      const gx = pad.l + i * groupW + groupW / 2;
      const va = seriesA[i] || 0;
      const vb = seriesB[i] || 0;
      const bha = (va / max) * innerH;
      const bhb = (vb / max) * innerH;
      const xa = gx - barW - 1;
      const xb = gx + 1;
      const ya = pad.t + innerH - bha;
      const yb = pad.t + innerH - bhb;
      svg += `<rect class="ops-exec-bar" x="${xa.toFixed(1)}" y="${ya.toFixed(1)}" width="${barW.toFixed(1)}" height="${bha.toFixed(1)}" rx="2" fill="${colorA}" opacity="0.9"><title>${esc(String(lbl), ctx)} · Entradas: ${va}</title></rect>`;
      svg += `<rect class="ops-exec-bar" x="${xb.toFixed(1)}" y="${yb.toFixed(1)}" width="${barW.toFixed(1)}" height="${bhb.toFixed(1)}" rx="2" fill="${colorB}" opacity="0.9"><title>${esc(String(lbl), ctx)} · Saídas: ${vb}</title></rect>`;
      if (i % showEvery === 0 || i === labels.length - 1) {
        svg += `<text x="${gx}" y="${h - 8}" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.55">${esc(String(lbl), ctx)}</text>`;
      }
    });
    return `<div class="ops-exec-chart-wrap">
      <div class="ops-exec-legend">
        <span class="ops-exec-legend-item"><i style="background:${colorA}"></i>Entradas</span>
        <span class="ops-exec-legend-item"><i style="background:${colorB}"></i>Saídas</span>
      </div>
      <svg class="hub-chart ops-exec-chart" viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img">${svg}</svg>
    </div>`;
  }

  function barChartSvg(labels, values, color, height, tipFmt, ctx) {
    if (!labels || !labels.length) return `<p class="hub-chart-empty">Sem dados no período.</p>`;
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
      const tip = tipFmt ? tipFmt(lbl, val) : `${lbl}: ${val}`;
      svg += `<rect class="ops-exec-bar" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" rx="3" fill="${color || "#38bdf8"}" opacity="0.9"><title>${esc(String(tip), ctx)}</title></rect>`;
      if (i % showEvery === 0 || i === labels.length - 1) {
        svg += `<text x="${gx}" y="${h - 8}" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.55">${esc(String(lbl), ctx)}</text>`;
      }
    });
    return `<svg class="hub-chart ops-exec-chart" viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img">${svg}</svg>`;
  }

  function pieChartSvg(items, ctx) {
    if (!items || !items.length) return `<p class="hub-chart-empty">Sem dados.</p>`;
    const total = items.reduce((s, x) => s + (x.value || 0), 0) || 1;
    const cx = 120;
    const cy = 120;
    const r = 90;
    const innerR = 48;
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
      const xi0 = cx + innerR * Math.cos(a1);
      const yi0 = cy + innerR * Math.sin(a1);
      const xi1 = cx + innerR * Math.cos(a0);
      const yi1 = cy + innerR * Math.sin(a0);
      const large = slice > Math.PI ? 1 : 0;
      const color = item.color || PIE_COLORS[i % PIE_COLORS.length];
      if (slice <= 0) return;
      if (Math.abs(slice - Math.PI * 2) < 1e-6) {
        paths += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity="0.9"></circle>`;
        paths += `<circle cx="${cx}" cy="${cy}" r="${innerR}" fill="rgba(15,23,42,0.95)"></circle>`;
      } else {
        paths += `<path class="ops-exec-pie-slice" d="M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} L ${xi0.toFixed(2)} ${yi0.toFixed(2)} A ${innerR} ${innerR} 0 ${large} 0 ${xi1.toFixed(2)} ${yi1.toFixed(2)} Z" fill="${color}" opacity="0.9"><title>${esc(item.label, ctx)}: ${esc(formatPct(item.pct), ctx)}</title></path>`;
      }
    });
    const legend = items
      .map(
        (item, i) =>
          `<li><i style="background:${item.color || PIE_COLORS[i % PIE_COLORS.length]}"></i><span>${esc(String(item.label || "").slice(0, 28), ctx)}</span><strong>${esc(String(item.value || 0), ctx)}</strong></li>`
      )
      .join("");
    return `<div class="ops-exec-pie-wrap">
      <svg class="hub-chart ops-exec-chart ops-exec-pie" viewBox="0 0 240 240" width="200" height="200" role="img">${paths}</svg>
      <ul class="ops-exec-pie-legend">${legend}</ul>
    </div>`;
  }

  function renderDataTable(title, headers, bodyHtml, emptyText, ctx) {
    return `<section class="hub-dash-section ops-exec-table-section">
      <div class="hub-table-panel section-card ops-exec-panel">
        <h3 class="hub-table-title">${esc(title, ctx)}</h3>
        <div class="table-wrap hub-table-wrap">
          <table class="table hub-exec-table ops-exec-table">
            <thead><tr>${headers.map((h) => `<th>${esc(h, ctx)}</th>`).join("")}</tr></thead>
            <tbody>${bodyHtml || `<tr><td colspan="${headers.length}" class="hub-table-empty">${esc(emptyText, ctx)}</td></tr>`}</tbody>
          </table>
        </div>
      </div>
    </section>`;
  }

  function computeMetrics(data) {
    const service = getService();
    if (!service || typeof service.getMetricsFromSnapshot !== "function") {
      console.error(
        "[operational-dashboard-ui] operationalDashboardService indisponível. Inclua operational-metrics-service.js antes deste script."
      );
      return null;
    }
    return service.getMetricsFromSnapshot(
      {
        vehicles: data.vehicles || [],
        partners: data.partners || [],
        events: data.events || [],
        asOfYmd: data.asOfYmd,
      },
      {
        period: _filters.period,
        financeiraId: _filters.financeiraId,
        parceiroId: _filters.parceiroId,
        status: _filters.status,
        search: _filters.search,
      }
    );
  }

  function operationalDashboardRender(data, ctx) {
    init();
    injectStylesOnce();
    hideLegacyInicio();

    _lastData = data || { vehicles: [], partners: [], events: [] };
    _lastCtx = ctx || {};

    const root = resolveMountRoot();
    if (!root) return;

    syncFiltersFromDom();

    const m = computeMetrics(_lastData);
    if (!m) {
      root.innerHTML = `<p class="ops-ops-footnote">Serviço de métricas operacionais indisponível.</p>`;
      return;
    }

    const k = m.kpis;
    const flow = m.entradasSaidas30d || { labels: [], entradas: [], saidas: [] };
    const stay = m.tempoMedioPermanencia12m || { labels: [], avgDays: [] };
    const statusItems = (m.veiculosPorStatus || []).map((s, i) => ({
      label: s.label,
      value: s.count,
      pct: s.pct,
      color: STAGE_COLOR[s.key] || PIE_COLORS[i % PIE_COLORS.length],
    }));

    const acaoBody = (m.aguardandoAcao || [])
      .map(
        (x) => `<tr>
          <td>${esc(x.placa, ctx)}</td>
          <td>${esc(x.financeira, ctx)}</td>
          <td>${esc(x.statusAtual, ctx)}</td>
          <td>${esc(String(x.diasNoPatio), ctx)}</td>
          <td>${esc(x.responsavel, ctx)}</td>
        </tr>`
      )
      .join("");

    const movBody = (m.ultimasMovimentacoes || [])
      .map(
        (x) => `<tr>
          <td>${esc(x.horario, ctx)}</td>
          <td>${esc(x.placa, ctx)}</td>
          <td>${esc(x.evento, ctx)}</td>
          <td>${esc(x.usuario, ctx)}</td>
        </tr>`
      )
      .join("");

    root.innerHTML = `
      <div class="ops-exec-dashboard">
        ${renderFilterBar(ctx)}
        ${renderAlerts(m.alerts, ctx)}

        <section class="hub-dash-section">
          <div class="hub-ops-cards hub-ops-cards--kpi ops-exec-kpis">
            ${renderKpiCard({ theme: "vnp", icon: "vehicle", label: "Veículos no Pátio", value: k.veiculosNoPatio, meta: "estoque atual" }, ctx)}
            ${renderKpiCard({ theme: "in", icon: "in", label: "Entradas Hoje", value: k.entradasHoje, meta: "recebidos no dia" }, ctx)}
            ${renderKpiCard({ theme: "out", icon: "out", label: "Saídas Hoje", value: k.saidasHoje, meta: "entregues no dia" }, ctx)}
            ${renderKpiCard({ theme: "stay", icon: "conf", label: "Aguardando Conferência", value: k.aguardandoConferencia, meta: "sem valor de diária" }, ctx)}
            ${renderKpiCard({ theme: "status", icon: "vist", label: "Aguardando Vistoria", value: k.aguardandoVistoria, meta: "vistoria pendente" }, ctx)}
            ${renderKpiCard({ theme: "done", icon: "liber", label: "Prontos para Liberação", value: k.prontosParaLiberacao, meta: "liberados no pátio" }, ctx)}
          </div>
        </section>

        ${renderFila(m.fila, ctx)}
        ${renderMapa(m.mapa, ctx)}

        <section class="hub-dash-charts hub-dash-charts--exec ops-exec-charts-row">
          <div class="hub-chart-panel section-card ops-exec-panel">
            <h4>Entradas × Saídas (30 dias)</h4>
            ${dualBarChartSvg(flow.labels, flow.entradas, flow.saidas, "#34d399", "#60a5fa", 200, ctx)}
          </div>
          <div class="hub-chart-panel section-card ops-exec-panel">
            <h4>Tempo médio de permanência (12 meses)</h4>
            ${barChartSvg(
              stay.labels,
              stay.avgDays,
              "#fbbf24",
              200,
              (lbl, val) => `${lbl}: ${formatAvgDays(val)} dias`,
              ctx
            )}
          </div>
          <div class="hub-chart-panel section-card ops-exec-panel">
            <h4>Veículos por status</h4>
            ${pieChartSvg(statusItems, ctx)}
          </div>
        </section>

        ${renderDataTable(
          "Veículos aguardando ação",
          ["Placa", "Financeira", "Status atual", "Dias no pátio", "Responsável"],
          acaoBody,
          "Nenhum veículo aguardando ação.",
          ctx
        )}

        ${renderDataTable(
          "Últimas movimentações",
          ["Horário", "Placa", "Evento", "Usuário"],
          movBody,
          "Nenhuma movimentação recente.",
          ctx
        )}
      </div>
    `;

    populatePartnerFilters(_lastData.partners || []);
    // Restore filter values after re-render
    const periodEl = document.getElementById("opsDashFilterPeriod");
    const finEl = document.getElementById("opsDashFilterFinanceira");
    const partnerEl = document.getElementById("opsDashFilterPartner");
    const statusEl = document.getElementById("opsDashFilterStatus");
    const searchEl = document.getElementById("opsDashFilterSearch");
    if (periodEl) periodEl.value = _filters.period || "30d";
    if (finEl && _filters.financeiraId) finEl.value = _filters.financeiraId;
    if (partnerEl && _filters.parceiroId) partnerEl.value = _filters.parceiroId;
    if (statusEl) statusEl.value = _filters.status || "";
    if (searchEl) searchEl.value = _filters.search || "";

    bindFilterListeners();
  }

  function invalidateAndRefresh() {
    const service = getService();
    if (service && typeof service.invalidateCache === "function") service.invalidateCache();

    if (_lastData) {
      operationalDashboardRender(_lastData, _lastCtx || {});
      return;
    }
    if (typeof global.updateDashboard === "function") {
      global.updateDashboard();
      return;
    }
    if (typeof global.refresh === "function") {
      global.refresh();
    }
  }

  function bindFilterListeners() {
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
      syncFiltersFromDom();
      invalidateAndRefresh();
    }, 280);

    const onChange = (e) => {
      const t = e.target;
      if (!t || !t.id) return;
      if (
        t.id === "opsDashFilterPeriod" ||
        t.id === "opsDashFilterFinanceira" ||
        t.id === "opsDashFilterPartner" ||
        t.id === "opsDashFilterStatus" ||
        t.id === "opsDashFilterSearch"
      ) {
        refresh();
      }
    };

    // Delegate on root / panel so listeners survive innerHTML re-renders
    const panel = document.getElementById("patioInicioPanel") || document;
    panel.addEventListener("change", onChange);
    panel.addEventListener("input", (e) => {
      if (e.target && e.target.id === "opsDashFilterSearch") refresh();
    });
  }

  function init() {
    injectStylesOnce();
    hideLegacyInicio();
    bindFilterListeners();
  }

  global.operationalDashboardRender = operationalDashboardRender;
  global.operationalDashboardUiInit = init;
  global.operationalDashboardInvalidateCache = invalidateAndRefresh;
})(typeof window !== "undefined" ? window : globalThis);

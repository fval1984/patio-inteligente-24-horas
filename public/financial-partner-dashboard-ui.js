/**
 * Dashboard de Parceiros — UI (browser runtime).
 * Monta #partnerFinDashRoot na subview dashboard de parceiros.
 * Consome financialPartnerDashboardService.
 */
(function financialPartnerDashboardUiModule(global) {
  "use strict";

  let _bound = false;
  let _stylesInjected = false;
  let _lastData = null;
  let _lastCtx = null;
  let _filters = {
    period: "30d",
    financeiraId: "",
    status: "",
    search: "",
  };

  const CARTEIRA_COLOR = {
    em_guarda: "#38bdf8",
    aguardando_documentacao: "#fbbf24",
    aguardando_autorizacao: "#60a5fa",
    liberados: "#34d399",
    entregues: "#94a3b8",
  };

  const BUCKET_COLOR = {
    "0_15": "#34d399",
    "16_30": "#38bdf8",
    "31_60": "#fbbf24",
    "61_90": "#fb923c",
    "90p": "#f87171",
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
    return global.financialPartnerDashboardService || null;
  }

  function hideLegacyPartnerDash() {
    const ids = ["partnerDashCards", "partnerDashEvolution"];
    ids.forEach(function (id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.add("hub-dash-legacy-hidden", "fp-dash-legacy-hidden");
      el.setAttribute("hidden", "");
      el.setAttribute("aria-hidden", "true");
    });
    document.querySelectorAll(".partner-dash-grid, .partner-dash-toolbar").forEach(function (el) {
      el.classList.add("hub-dash-legacy-hidden", "fp-dash-legacy-hidden");
      el.setAttribute("hidden", "");
      el.setAttribute("aria-hidden", "true");
    });
  }

  function injectStylesOnce() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    if (document.getElementById("fpDashUiStyles")) return;
    const style = document.createElement("style");
    style.id = "fpDashUiStyles";
    style.textContent = `
      .fp-dash-legacy-hidden { display: none !important; }
      .fp-exec-root { min-height: 120px; }
      .fp-exec-dashboard { display: flex; flex-direction: column; gap: 0; }
      .fp-exec-filters { margin-bottom: 18px; flex-wrap: wrap; align-items: flex-end; }
      .fp-exec-filters label[for="fpDashFilterFinanceira"],
      .fp-exec-fin-label {
        color: #38bdf8; font-weight: 600; letter-spacing: 0.02em;
      }
      .fp-exec-filters #fpDashFilterFinanceira,
      .fp-exec-fin-select {
        min-width: 220px;
        border-color: rgba(56, 189, 248, 0.45) !important;
        box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.18);
        font-weight: 600;
      }
      .fp-exec-kpis { margin-bottom: 4px; }
      .fp-exec-panel {
        background: rgba(15, 23, 42, 0.35);
        border: 1px solid rgba(148, 163, 184, 0.12);
      }
      .fp-exec-alerts { margin-bottom: 18px; }
      .fp-exec-alerts-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 10px;
      }
      .fp-exec-alert {
        display: flex; align-items: flex-start; gap: 10px;
        padding: 12px 14px; border-radius: 12px;
        border: 1px solid rgba(148,163,184,0.18);
        background: rgba(15,23,42,0.4);
        text-align: left; width: 100%;
      }
      .fp-exec-alert strong { font-size: 0.82rem; display: block; }
      .fp-exec-alert small { font-size: 0.75rem; color: var(--muted); }
      .fp-exec-alert--green { border-color: rgba(52,211,153,0.4); color: #34d399; }
      .fp-exec-alert--yellow { border-color: rgba(251,191,36,0.45); background: rgba(251,191,36,0.06); }
      .fp-exec-alert--red { border-color: rgba(248,113,113,0.45); background: rgba(248,113,113,0.08); }
      .fp-exec-empty {
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        gap: 10px; padding: 48px 24px; text-align: center;
        border-radius: 14px;
        border: 1px dashed rgba(56, 189, 248, 0.35);
        background: linear-gradient(180deg, rgba(30,41,59,0.55), rgba(15,23,42,0.45));
        margin-bottom: 18px;
      }
      .fp-exec-empty strong { font-size: 1.15rem; color: #e2e8f0; }
      .fp-exec-empty p { margin: 0; color: var(--muted); font-size: 0.9rem; max-width: 360px; }
      .fp-exec-empty-icon {
        width: 48px; height: 48px; border-radius: 12px;
        display: grid; place-items: center;
        background: rgba(56, 189, 248, 0.12); color: #38bdf8;
      }
      .fp-exec-bars { display: flex; flex-direction: column; gap: 12px; padding: 4px 0; }
      .fp-exec-bar-row { display: grid; grid-template-columns: minmax(120px, 1.2fr) 1fr auto; gap: 10px; align-items: center; }
      .fp-exec-bar-label { font-size: 0.8rem; color: var(--muted); }
      .fp-exec-bar-track {
        height: 8px; border-radius: 999px; background: rgba(148,163,184,0.15); overflow: hidden;
      }
      .fp-exec-bar-fill { height: 100%; border-radius: 999px; transition: width 0.45s ease; }
      .fp-exec-bar-meta { font-size: 0.78rem; color: #e2e8f0; white-space: nowrap; text-align: right; min-width: 72px; }
      .fp-exec-mapa {
        display: flex; flex-wrap: wrap; gap: 0; align-items: stretch; justify-content: space-between;
      }
      .fp-exec-mapa-node {
        flex: 1 1 140px; min-width: 110px;
        padding: 16px 12px; text-align: center;
        border: 1px solid rgba(148,163,184,0.16);
        background: linear-gradient(180deg, rgba(30,41,59,0.65), rgba(15,23,42,0.55));
        position: relative;
      }
      .fp-exec-mapa-node:first-child { border-radius: 12px 0 0 12px; }
      .fp-exec-mapa-node:last-child { border-radius: 0 12px 12px 0; }
      .fp-exec-mapa-node:not(:last-child)::after {
        content: "";
        position: absolute; right: -1px; top: 28%; bottom: 28%;
        width: 2px;
        background: linear-gradient(180deg, transparent, rgba(96,165,250,0.55), transparent);
      }
      .fp-exec-mapa-node span { display: block; font-size: 0.72rem; color: var(--muted); margin-bottom: 6px; }
      .fp-exec-mapa-node strong { font-size: 1.45rem; color: #e2e8f0; display: block; }
      .fp-exec-mapa-node small { font-size: 0.72rem; color: var(--muted); }
      .fp-exec-legend {
        display: flex; flex-wrap: wrap; gap: 10px 14px;
        margin-bottom: 8px; font-size: 0.75rem; color: var(--muted);
      }
      .fp-exec-legend-item { display: inline-flex; align-items: center; gap: 6px; }
      .fp-exec-legend-item i {
        width: 10px; height: 10px; border-radius: 2px; display: inline-block;
      }
      .fp-exec-charts-row { margin-bottom: 24px; }
      .fp-exec-nome {
        margin: 0 0 14px; font-size: 0.95rem; color: #94a3b8;
      }
      .fp-exec-nome strong { color: #e2e8f0; }
      @media (max-width: 900px) {
        .fp-exec-mapa-node:first-child,
        .fp-exec-mapa-node:last-child,
        .fp-exec-mapa-node { border-radius: 12px; }
        .fp-exec-mapa { gap: 10px; }
        .fp-exec-mapa-node:not(:last-child)::after { content: none; }
        .fp-exec-bar-row { grid-template-columns: 1fr; gap: 4px; }
        .fp-exec-bar-meta { text-align: left; }
      }
    `;
    document.head.appendChild(style);
  }

  function resolveMountRoot() {
    let root = document.getElementById("partnerFinDashRoot");
    if (root) return root;

    const subview =
      document.querySelector('#viewParceiros .partner-subview[data-subview="dashboard"]') ||
      document.querySelector('.partner-subview[data-subview="dashboard"]');
    if (!subview) return null;

    root = document.createElement("div");
    root.id = "partnerFinDashRoot";
    root.className = "fp-exec-root";

    const cards = document.getElementById("partnerDashCards");
    if (cards && cards.parentNode === subview) {
      subview.insertBefore(root, cards);
    } else {
      const toolbar = subview.querySelector(".partner-dash-toolbar");
      if (toolbar && toolbar.nextSibling) {
        subview.insertBefore(root, toolbar.nextSibling);
      } else if (toolbar) {
        toolbar.insertAdjacentElement("afterend", root);
      } else {
        subview.insertBefore(root, subview.firstChild);
      }
    }
    return root;
  }

  function syncFiltersFromDom() {
    const periodEl = document.getElementById("fpDashFilterPeriod");
    const finEl = document.getElementById("fpDashFilterFinanceira");
    const statusEl = document.getElementById("fpDashFilterStatus");
    const searchEl = document.getElementById("fpDashFilterSearch");

    if (periodEl) _filters.period = periodEl.value || "30d";
    _filters.financeiraId = finEl ? finEl.value || "" : _filters.financeiraId;
    _filters.status = statusEl ? statusEl.value || "" : _filters.status;
    _filters.search = searchEl ? String(searchEl.value || "").trim() : _filters.search;
  }

  function populateFinanceiraSelect(partners) {
    const sel = document.getElementById("fpDashFilterFinanceira");
    if (!sel) return;
    const cur = _filters.financeiraId || sel.value || "";
    const list = (partners || [])
      .slice()
      .sort(function (a, b) {
        return String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR");
      });
    sel.innerHTML =
      `<option value="">Selecione um parceiro</option>` +
      list
        .map(function (p) {
          return `<option value="${escapeHtmlDefault(p.id)}">${escapeHtmlDefault(p.nome || "-")}</option>`;
        })
        .join("");
    if (cur && list.some(function (p) {
      return String(p.id) === String(cur);
    })) {
      sel.value = cur;
    }
  }

  function iconSvg(name) {
    const icons = {
      vehicle: '<path d="M4 16l2-6h12l2 6M6 16h12M8 20h2M14 20h2" stroke="currentColor" stroke-width="2" fill="none"/>',
      in: '<path d="M12 3v18M7 8l5-5 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
      out: '<path d="M12 21V3M7 16l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
      clock: '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 7v5l3 2" stroke="currentColor" stroke-width="2"/>',
      money: '<path d="M12 3v18M7 8l5-5 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M4 12h16" stroke="currentColor" stroke-width="2"/>',
      open: '<rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><path d="M8 6v12M16 6v12" stroke="currentColor" stroke-width="2"/>',
      alert: '<path d="M12 9v4M12 17h.01M10.3 4.3l-7.2 12.4A2 2 0 0 0 4.7 20h14.6a2 2 0 0 0 1.6-3.3L13.7 4.3a2 2 0 0 0-3.4 0z" stroke="currentColor" stroke-width="2" fill="none"/>',
      bank: '<path d="M3 10l9-6 9 6M5 10v8h14v-8M2 20h20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
    };
    return `<svg class="hub-ops-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">${icons[name] || icons.vehicle}</svg>`;
  }

  function renderKpiCard(opts, ctx) {
    const value = esc(String(opts.value ?? "—"), ctx);
    return `<article class="hub-ops-card hub-kpi-card fp-exec-kpi hub-ops-card--${esc(opts.theme, ctx)}">
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
      return `<section class="hub-dash-section fp-exec-alerts">
        <div class="hub-alert hub-alert--ok fp-exec-alert fp-exec-alert--green">
          <span class="hub-alert-icon">✓</span>
          <span>Carteira estável — nenhum alerta.</span>
        </div>
      </section>`;
    }
    return `<section class="hub-dash-section fp-exec-alerts" aria-label="Alertas do Parceiro">
      <div class="fp-exec-alerts-grid">
        ${rows
          .map(function (a) {
            const p = a.priority || "green";
            const countLabel = a.count > 0 ? ` · ${a.count}` : "";
            return `<div class="hub-alert hub-alert--${alertLevelClass(p)} fp-exec-alert fp-exec-alert--${esc(p, ctx)}">
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
    return `<div class="filter-bar hub-dash-filters fp-exec-filters" id="fpDashFilterBar">
      <label for="fpDashFilterPeriod">Período</label>
      <select id="fpDashFilterPeriod" title="Período de referência">
        <option value="today"${_filters.period === "today" ? " selected" : ""}>Hoje</option>
        <option value="7d"${_filters.period === "7d" ? " selected" : ""}>Últimos 7 dias</option>
        <option value="30d"${_filters.period === "30d" || !_filters.period ? " selected" : ""}>Últimos 30 dias</option>
        <option value="month"${_filters.period === "month" ? " selected" : ""}>Mês atual</option>
        <option value="year"${_filters.period === "year" ? " selected" : ""}>Ano atual</option>
      </select>
      <label for="fpDashFilterFinanceira" class="fp-exec-fin-label">Parceiro</label>
      <select id="fpDashFilterFinanceira" class="fp-exec-fin-select" title="Selecione o parceiro (filtro principal)">
        <option value="">Selecione um parceiro</option>
      </select>
      <label for="fpDashFilterStatus">Status</label>
      <select id="fpDashFilterStatus" title="Status operacional">
        <option value=""${_filters.status === "" ? " selected" : ""}>Todos</option>
        <option value="no_patio"${_filters.status === "no_patio" ? " selected" : ""}>No pátio</option>
        <option value="vlp"${_filters.status === "vlp" ? " selected" : ""}>VLP</option>
        <option value="removido"${_filters.status === "removido" ? " selected" : ""}>Removido</option>
      </select>
      <label for="fpDashFilterSearch">Busca</label>
      <input type="search" id="fpDashFilterSearch" placeholder="Placa ou modelo…" autocomplete="off" value="${esc(_filters.search || "", ctx)}" />
    </div>`;
  }

  function renderEmptyState(ctx) {
    return `<div class="fp-exec-empty section-card fp-exec-panel" role="status">
      <div class="fp-exec-empty-icon">${iconSvg("bank")}</div>
      <strong>${esc("Selecione um parceiro", ctx)}</strong>
      <p>${esc("Escolha o parceiro no filtro acima para carregar indicadores, gráficos e a carteira.", ctx)}</p>
    </div>`;
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
    labels.forEach(function (lbl, i) {
      const gx = pad.l + i * groupW + groupW / 2;
      const va = seriesA[i] || 0;
      const vb = seriesB[i] || 0;
      const bha = (va / max) * innerH;
      const bhb = (vb / max) * innerH;
      const xa = gx - barW - 1;
      const xb = gx + 1;
      const ya = pad.t + innerH - bha;
      const yb = pad.t + innerH - bhb;
      svg += `<rect class="fp-exec-bar" x="${xa.toFixed(1)}" y="${ya.toFixed(1)}" width="${barW.toFixed(1)}" height="${bha.toFixed(1)}" rx="2" fill="${colorA}" opacity="0.9"><title>${esc(String(lbl), ctx)} · Entradas: ${va}</title></rect>`;
      svg += `<rect class="fp-exec-bar" x="${xb.toFixed(1)}" y="${yb.toFixed(1)}" width="${barW.toFixed(1)}" height="${bhb.toFixed(1)}" rx="2" fill="${colorB}" opacity="0.9"><title>${esc(String(lbl), ctx)} · Saídas: ${vb}</title></rect>`;
      if (i % showEvery === 0 || i === labels.length - 1) {
        svg += `<text x="${gx}" y="${h - 8}" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.55">${esc(String(lbl), ctx)}</text>`;
      }
    });
    return `<div class="fp-exec-chart-wrap">
      <div class="fp-exec-legend">
        <span class="fp-exec-legend-item"><i style="background:${colorA}"></i>Entradas</span>
        <span class="fp-exec-legend-item"><i style="background:${colorB}"></i>Saídas</span>
      </div>
      <svg class="hub-chart fp-exec-chart" viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img">${svg}</svg>
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
    labels.forEach(function (lbl, i) {
      const val = values[i] || 0;
      const gx = pad.l + i * groupW + groupW / 2;
      const bh = (val / max) * innerH;
      const x = gx - barW / 2;
      const y = pad.t + innerH - bh;
      const tip = tipFmt ? tipFmt(lbl, val) : `${lbl}: ${val}`;
      svg += `<rect class="fp-exec-bar" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" rx="3" fill="${color || "#38bdf8"}" opacity="0.9"><title>${esc(String(tip), ctx)}</title></rect>`;
      if (i % showEvery === 0 || i === labels.length - 1) {
        svg += `<text x="${gx}" y="${h - 8}" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.55">${esc(String(lbl), ctx)}</text>`;
      }
    });
    return `<svg class="hub-chart fp-exec-chart" viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img">${svg}</svg>`;
  }

  function renderPctBars(items, colorMap, ctx) {
    if (!items || !items.length) {
      return `<p class="hub-chart-empty">Sem dados.</p>`;
    }
    return `<div class="fp-exec-bars">
      ${items
        .map(function (item) {
          const color = (colorMap && colorMap[item.key]) || "#38bdf8";
          const pct = Math.max(0, Math.min(100, Number(item.pct || 0)));
          return `<div class="fp-exec-bar-row">
            <span class="fp-exec-bar-label">${esc(item.label, ctx)}</span>
            <div class="fp-exec-bar-track" aria-hidden="true">
              <div class="fp-exec-bar-fill" style="width:${pct.toFixed(1)}%;background:${color}"></div>
            </div>
            <span class="fp-exec-bar-meta">${esc(String(item.count ?? 0), ctx)} · ${esc(formatPct(pct), ctx)}</span>
          </div>`;
        })
        .join("")}
    </div>`;
  }

  function renderCarteira(carteira, ctx) {
    return `<section class="hub-dash-section">
      <article class="hub-ops-situation section-card fp-exec-panel">
        <h3 class="hub-ops-situation-title">Situação da Carteira</h3>
        ${renderPctBars(carteira, CARTEIRA_COLOR, ctx)}
      </article>
    </section>`;
  }

  function renderMapaPermanencia(mapa, ctx) {
    const nodes = mapa || [];
    if (!nodes.length) {
      return `<section class="hub-dash-section">
        <h3 class="hub-dash-section-title">Mapa da Permanência</h3>
        <p class="hub-chart-empty">Sem veículos no pátio.</p>
      </section>`;
    }
    return `<section class="hub-dash-section">
      <h3 class="hub-dash-section-title">Mapa da Permanência</h3>
      <div class="fp-exec-mapa section-card fp-exec-panel">
        ${nodes
          .map(function (n) {
            const color = BUCKET_COLOR[n.key] || "#38bdf8";
            return `<div class="fp-exec-mapa-node" style="border-top:3px solid ${color}">
              <span>${esc(n.label, ctx)}</span>
              <strong>${esc(String(n.count ?? 0), ctx)}</strong>
              <small>${esc(formatPct(n.pct), ctx)}</small>
            </div>`;
          })
          .join("")}
      </div>
    </section>`;
  }

  function renderIndicadores(ind, ctx) {
    const money = function (n) {
      return formatMoney(n, ctx);
    };
    const rows = [
      { label: "Receita no mês", value: money(ind.receitaMes) },
      { label: "Receita no ano", value: money(ind.receitaAno) },
      { label: "Ticket médio por veículo", value: money(ind.ticketMedioPorVeiculo) },
      { label: "Receita média por dia de guarda", value: money(ind.receitaMediaPorDiaGuarda) },
      { label: "Valor médio por veículo armazenado", value: money(ind.valorMedioPorVeiculoArmazenado) },
    ];
    return `<section class="hub-dash-section">
      <article class="hub-ops-situation section-card fp-exec-panel">
        <h3 class="hub-ops-situation-title">Indicadores Financeiros</h3>
        <ul class="hub-ops-situation-list">
          ${rows
            .map(function (r) {
              return `<li class="hub-ops-situation-item">
                <span class="hub-ops-situation-label">${esc(r.label, ctx)}</span>
                <strong class="hub-ops-situation-value">${esc(r.value, ctx)}</strong>
              </li>`;
            })
            .join("")}
        </ul>
      </article>
    </section>`;
  }

  function renderDataTable(title, headers, bodyHtml, emptyText, ctx) {
    return `<section class="hub-dash-section fp-exec-table-section">
      <div class="hub-table-panel section-card fp-exec-panel">
        <h3 class="hub-table-title">${esc(title, ctx)}</h3>
        <div class="table-wrap hub-table-wrap">
          <table class="table hub-exec-table fp-exec-table">
            <thead><tr>${headers.map(function (h) {
              return `<th>${esc(h, ctx)}</th>`;
            }).join("")}</tr></thead>
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
        "[financial-partner-dashboard-ui] financialPartnerDashboardService indisponível. Inclua financial-partner-metrics-service.js antes deste script."
      );
      return null;
    }
    return service.getMetricsFromSnapshot(
      {
        vehicles: data.vehicles || [],
        partners: data.partners || [],
        receivables: data.receivables || [],
        events: data.events || [],
        asOfYmd: data.asOfYmd,
      },
      {
        period: _filters.period,
        financeiraId: _filters.financeiraId,
        status: _filters.status,
        search: _filters.search,
      }
    );
  }

  function restoreFilterValues() {
    const periodEl = document.getElementById("fpDashFilterPeriod");
    const finEl = document.getElementById("fpDashFilterFinanceira");
    const statusEl = document.getElementById("fpDashFilterStatus");
    const searchEl = document.getElementById("fpDashFilterSearch");
    if (periodEl) periodEl.value = _filters.period || "30d";
    if (finEl && _filters.financeiraId) finEl.value = _filters.financeiraId;
    if (statusEl) statusEl.value = _filters.status || "";
    if (searchEl) searchEl.value = _filters.search || "";
  }

  function financialPartnerDashboardRender(data, ctx) {
    init();
    injectStylesOnce();
    hideLegacyPartnerDash();

    _lastData = data || { vehicles: [], partners: [], receivables: [], events: [] };
    _lastCtx = ctx || {};

    const root = resolveMountRoot();
    if (!root) return;

    syncFiltersFromDom();

    const m = computeMetrics(_lastData);
    if (!m) {
      root.innerHTML = `<p class="fp-ops-footnote">Serviço de métricas do parceiro indisponível.</p>`;
      return;
    }

    const hasFin = !!m.hasFinanceira && !!_filters.financeiraId;

    if (!hasFin) {
      root.innerHTML = `
        <div class="fp-exec-dashboard">
          ${renderFilterBar(ctx)}
          ${renderEmptyState(ctx)}
          ${renderAlerts(m.alerts, ctx)}
        </div>
      `;
      populateFinanceiraSelect(_lastData.partners || []);
      restoreFilterValues();
      bindFilterListeners();
      return;
    }

    const k = m.kpis;
    const flow = m.entradasSaidas12m || { labels: [], entradas: [], saidas: [] };
    const stay = m.tempoMedio12m || { labels: [], values: [] };
    const rec = m.receitaMensal12m || { labels: [], values: [] };
    const money = function (n) {
      return formatMoney(n, ctx);
    };

    const vehBody = (m.veiculos || [])
      .map(function (x) {
        return `<tr>
          <td>${esc(x.placa, ctx)}</td>
          <td>${esc(x.modelo, ctx)}</td>
          <td>${esc(x.dataEntrada, ctx)}</td>
          <td>${esc(String(x.diasNoPatio), ctx)}</td>
          <td>${esc(x.status, ctx)}</td>
          <td>${esc(money(x.valorAcumulado), ctx)}</td>
        </tr>`;
      })
      .join("");

    const rankBody = (m.rankingPermanencia || [])
      .map(function (x) {
        return `<tr>
          <td>${esc(x.placa, ctx)}</td>
          <td>${esc(x.modelo, ctx)}</td>
          <td>${esc(String(x.diasNoPatio), ctx)}</td>
          <td>${esc(money(x.valorAcumulado), ctx)}</td>
        </tr>`;
      })
      .join("");

    const movBody = (m.ultimasMovimentacoes || [])
      .map(function (x) {
        return `<tr>
          <td>${esc(x.data, ctx)}</td>
          <td>${esc(x.placa, ctx)}</td>
          <td>${esc(x.evento, ctx)}</td>
          <td>${esc(x.usuario, ctx)}</td>
        </tr>`;
      })
      .join("");

    root.innerHTML = `
      <div class="fp-exec-dashboard">
        ${renderFilterBar(ctx)}
        <p class="fp-exec-nome">Parceiro: <strong>${esc(m.financeiraNome || "—", ctx)}</strong></p>
        ${renderAlerts(m.alerts, ctx)}

        <section class="hub-dash-section">
          <div class="hub-ops-cards hub-ops-cards--kpi fp-exec-kpis">
            ${renderKpiCard({ theme: "vnp", icon: "vehicle", label: "Veículos Ativos", value: k.veiculosAtivos, meta: "armazenados no pátio" }, ctx)}
            ${renderKpiCard({ theme: "in", icon: "in", label: "Entradas no Período", value: k.entradasPeriodo, meta: "recebidos" }, ctx)}
            ${renderKpiCard({ theme: "out", icon: "out", label: "Saídas no Período", value: k.saidasPeriodo, meta: "entregues" }, ctx)}
            ${renderKpiCard({ theme: "stay", icon: "clock", label: "Tempo Médio de Permanência", value: formatAvgDays(k.tempoMedioPermanencia) + " dias", meta: "veículos ativos" }, ctx)}
            ${renderKpiCard({ theme: "profit", icon: "money", label: "Receita Gerada", value: money(k.receitaGerada), meta: "faturado no período" }, ctx)}
            ${renderKpiCard({ theme: "pending-recv", icon: "open", label: "Valor em Aberto", value: money(k.valorEmAberto), meta: "pendente" }, ctx)}
          </div>
        </section>

        <section class="hub-dash-charts hub-dash-charts--exec fp-exec-charts-row">
          <div class="hub-chart-panel section-card fp-exec-panel">
            <h4>Entradas × Saídas (12 meses)</h4>
            ${dualBarChartSvg(flow.labels, flow.entradas, flow.saidas, "#34d399", "#60a5fa", 200, ctx)}
          </div>
          <div class="hub-chart-panel section-card fp-exec-panel">
            <h4>Tempo médio de permanência (12 meses)</h4>
            ${barChartSvg(
              stay.labels,
              stay.values,
              "#fbbf24",
              200,
              function (lbl, val) {
                return `${lbl}: ${formatAvgDays(val)} dias`;
              },
              ctx
            )}
          </div>
          <div class="hub-chart-panel section-card fp-exec-panel">
            <h4>Receita mensal (12 meses)</h4>
            ${barChartSvg(
              rec.labels,
              rec.values,
              "#38bdf8",
              200,
              function (lbl, val) {
                return `${lbl}: ${money(val)}`;
              },
              ctx
            )}
          </div>
        </section>

        ${renderCarteira(m.carteira, ctx)}
        ${renderMapaPermanencia(m.mapaPermanencia, ctx)}
        ${renderIndicadores(m.indicadoresFinanceiros, ctx)}

        ${renderDataTable(
          "Veículos do Parceiro",
          ["Placa", "Modelo", "Data de Entrada", "Dias no Pátio", "Status", "Valor Acumulado"],
          vehBody,
          "Nenhum veículo no pátio para este parceiro.",
          ctx
        )}

        ${renderDataTable(
          "Ranking de Permanência (Top 20)",
          ["Placa", "Modelo", "Dias", "Valor acumulado"],
          rankBody,
          "Sem ranking disponível.",
          ctx
        )}

        ${renderDataTable(
          "Últimas Movimentações",
          ["Data", "Placa", "Evento", "Usuário"],
          movBody,
          "Nenhuma movimentação recente.",
          ctx
        )}
      </div>
    `;

    populateFinanceiraSelect(_lastData.partners || []);
    restoreFilterValues();
    bindFilterListeners();
  }

  function invalidateAndRefresh() {
    const service = getService();
    if (service && typeof service.invalidateCache === "function") service.invalidateCache();

    if (_lastData) {
      financialPartnerDashboardRender(_lastData, _lastCtx || {});
      return;
    }
    if (typeof global.renderPartnersDashboard === "function") {
      global.renderPartnersDashboard();
      return;
    }
    if (typeof global.partnersDashboardRender === "function") {
      global.partnersDashboardRender();
    }
  }

  function bindFilterListeners() {
    if (_bound) return;
    _bound = true;

    const debounce = function (fn, ms) {
      let t;
      return function () {
        clearTimeout(t);
        t = setTimeout(fn, ms);
      };
    };
    const refresh = debounce(function () {
      syncFiltersFromDom();
      invalidateAndRefresh();
    }, 280);

    const onChange = function (e) {
      const t = e.target;
      if (!t || !t.id) return;
      if (
        t.id === "fpDashFilterPeriod" ||
        t.id === "fpDashFilterFinanceira" ||
        t.id === "fpDashFilterStatus" ||
        t.id === "fpDashFilterSearch"
      ) {
        refresh();
      }
    };

    const panel =
      document.querySelector('#viewParceiros .partner-subview[data-subview="dashboard"]') ||
      document.getElementById("viewParceiros") ||
      document;
    panel.addEventListener("change", onChange);
    panel.addEventListener("input", function (e) {
      if (e.target && e.target.id === "fpDashFilterSearch") refresh();
    });
  }

  function init() {
    injectStylesOnce();
    hideLegacyPartnerDash();
    bindFilterListeners();
  }

  global.financialPartnerDashboardRender = financialPartnerDashboardRender;
  global.financialPartnerDashboardUiInit = init;
  global.financialPartnerDashboardInvalidateCache = invalidateAndRefresh;
})(typeof window !== "undefined" ? window : globalThis);

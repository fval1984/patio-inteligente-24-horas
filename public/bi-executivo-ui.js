/**
 * BI Executivo — UI multipágina (browser runtime).
 * Monta #biExecRoot. Consome biService. Não substitui dashboards existentes.
 */
(function biExecutivoUiModule(global) {
  "use strict";

  const PAGES = [
    { id: "visao", label: "Visão Geral" },
    { id: "financeiras", label: "Financeiras" },
    { id: "permanencia", label: "Permanência" },
    { id: "receita", label: "Receita" },
    { id: "movimentacao", label: "Movimentação" },
    { id: "eficiencia", label: "Eficiência" },
    { id: "alertas", label: "Alertas" },
  ];

  let _bound = false;
  let _stylesInjected = false;
  let _page = "visao";
  let _filters = {
    period: "30d",
    financeiraId: "",
    parceiroId: "",
    cidade: "",
    estado: "",
    status: "",
    tipoVeiculo: "",
  };
  let _lastData = null;
  let _lastCtx = null;
  let _lastMetrics = null;
  let _drillStack = [];

  function esc(str, ctx) {
    if (ctx && typeof ctx.escapeHtml === "function") return ctx.escapeHtml(str);
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function money(n, ctx) {
    if (ctx && typeof ctx.formatCurrency === "function") return ctx.formatCurrency(n);
    return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function fmtKpi(k, ctx) {
    const v = Number(k.value || 0);
    if (k.format === "money") return money(v, ctx);
    if (k.format === "days") return v.toFixed(1).replace(".", ",") + " d";
    if (k.format === "pct") return v.toFixed(1).replace(".", ",") + "%";
    return String(Math.round(v));
  }

  function getService() {
    return global.biService || null;
  }

  function injectStylesOnce() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    if (document.getElementById("biExecUiStyles")) return;
    const style = document.createElement("style");
    style.id = "biExecUiStyles";
    style.textContent = `
      .bi-exec-shell { display:flex; flex-direction:column; gap:14px; min-height:60vh; }
      .bi-exec-topbar {
        position:sticky; top:0; z-index:20; display:flex; flex-wrap:wrap; gap:10px 14px;
        align-items:flex-end; padding:12px 14px; border-radius:14px;
        border:1px solid rgba(148,163,184,0.16); background:rgba(15,23,42,0.92);
        backdrop-filter:blur(10px);
      }
      .bi-exec-topbar label { display:flex; flex-direction:column; gap:4px; font-size:0.68rem;
        font-weight:700; letter-spacing:0.04em; text-transform:uppercase; color:var(--muted); }
      .bi-exec-topbar select, .bi-exec-topbar input {
        min-width:132px; max-width:200px; border-radius:10px; border:1px solid rgba(148,163,184,0.22);
        background:rgba(30,41,59,0.9); color:inherit; padding:7px 10px; font-size:0.86rem;
      }
      .bi-exec-actions { display:flex; flex-wrap:wrap; gap:8px; margin-left:auto; align-items:center; }
      .bi-exec-actions button {
        border-radius:10px; border:1px solid rgba(148,163,184,0.22); background:rgba(51,65,85,0.55);
        color:inherit; padding:8px 12px; font-size:0.8rem; font-weight:600; cursor:pointer;
      }
      .bi-exec-actions button:hover { border-color:rgba(56,189,248,0.45); }
      .bi-exec-pages {
        display:flex; flex-wrap:wrap; gap:6px; padding:4px 0 2px;
      }
      .bi-exec-pages button {
        border:1px solid transparent; background:transparent; color:var(--muted);
        padding:8px 12px; border-radius:999px; font-size:0.82rem; font-weight:700; cursor:pointer;
      }
      .bi-exec-pages button.active {
        color:#e2e8f0; background:rgba(56,189,248,0.14); border-color:rgba(56,189,248,0.35);
      }
      .bi-exec-page { animation: biFade .28s ease; }
      @keyframes biFade { from { opacity:0; transform:translateY(4px);} to { opacity:1; transform:none;} }
      .bi-kpi-grid {
        display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:12px; margin-bottom:16px;
      }
      @media (max-width:1200px){ .bi-kpi-grid { grid-template-columns:repeat(3,minmax(0,1fr)); } }
      @media (max-width:720px){ .bi-kpi-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }
      .bi-kpi {
        min-height:104px; padding:16px; border-radius:16px; border:1px solid rgba(148,163,184,0.14);
        background:linear-gradient(160deg, rgba(30,41,59,0.95), rgba(15,23,42,0.88));
        display:flex; flex-direction:column; gap:8px;
      }
      .bi-kpi span { font-size:0.7rem; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; color:var(--muted); }
      .bi-kpi strong { font-size:1.35rem; font-weight:800; line-height:1.15; margin-top:auto; }
      .bi-kpi em { font-style:normal; font-size:0.72rem; color:var(--muted); }
      .bi-charts {
        display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; margin-bottom:16px;
      }
      @media (max-width:980px){ .bi-charts { grid-template-columns:1fr; } }
      .bi-charts--3 { grid-template-columns:repeat(3,minmax(0,1fr)); }
      @media (max-width:1100px){ .bi-charts--3 { grid-template-columns:1fr; } }
      .bi-panel {
        border-radius:16px; border:1px solid rgba(148,163,184,0.14);
        background:rgba(15,23,42,0.55); padding:14px 14px 10px; min-height:220px;
      }
      .bi-panel h4 { margin:0 0 10px; font-size:0.92rem; font-weight:800; }
      .bi-panel.bi-clickable { cursor:pointer; }
      .bi-panel.bi-clickable:hover { border-color:rgba(56,189,248,0.4); }
      .bi-chart-empty { color:var(--muted); font-size:0.85rem; padding:28px 8px; text-align:center; }
      .bi-table-wrap { overflow:auto; border-radius:12px; border:1px solid rgba(148,163,184,0.12); }
      .bi-table { width:100%; border-collapse:collapse; font-size:0.84rem; }
      .bi-table th, .bi-table td { padding:9px 10px; border-bottom:1px solid rgba(148,163,184,0.1); text-align:left; }
      .bi-table th { font-size:0.7rem; text-transform:uppercase; letter-spacing:0.04em; color:var(--muted); }
      .bi-table tr:hover td { background:rgba(148,163,184,0.05); }
      .bi-alert-list { display:flex; flex-direction:column; gap:10px; }
      .bi-alert {
        display:flex; gap:12px; align-items:flex-start; padding:14px 16px; border-radius:14px;
        border:1px solid rgba(148,163,184,0.16); background:rgba(30,41,59,0.45);
      }
      .bi-alert--red { border-color:rgba(248,113,113,0.45); }
      .bi-alert--yellow { border-color:rgba(251,191,36,0.4); }
      .bi-alert--green { border-color:rgba(52,211,153,0.4); }
      .bi-alert-dot { width:10px; height:10px; border-radius:50%; margin-top:5px; flex:0 0 auto; }
      .bi-alert--red .bi-alert-dot { background:#f87171; }
      .bi-alert--yellow .bi-alert-dot { background:#fbbf24; }
      .bi-alert--green .bi-alert-dot { background:#34d399; }
      .bi-alert strong { display:block; font-size:0.95rem; }
      .bi-alert p { margin:4px 0 0; color:var(--muted); font-size:0.84rem; }
      .bi-heat { display:grid; gap:4px; overflow:auto; }
      .bi-heat-row { display:grid; grid-template-columns:140px repeat(5,minmax(48px,1fr)); gap:4px; align-items:center; }
      .bi-heat-cell {
        min-height:36px; border-radius:8px; display:flex; align-items:center; justify-content:center;
        font-size:0.75rem; font-weight:700; background:rgba(148,163,184,0.08);
      }
      .bi-heat-label { font-size:0.75rem; color:var(--muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .bi-pie-legend { display:flex; flex-wrap:wrap; gap:8px 14px; margin-top:8px; font-size:0.75rem; color:var(--muted); }
      .bi-modal-backdrop {
        position:fixed; inset:0; background:rgba(2,6,23,0.72); z-index:1200;
        display:flex; align-items:center; justify-content:center; padding:16px;
      }
      .bi-modal {
        width:min(720px,100%); max-height:85vh; overflow:auto; border-radius:16px;
        border:1px solid rgba(148,163,184,0.2); background:#0f172a; padding:16px 18px;
      }
      .bi-modal header { display:flex; justify-content:space-between; gap:12px; align-items:center; margin-bottom:12px; }
      .bi-modal h3 { margin:0; font-size:1.05rem; }
      .bi-crumb { font-size:0.78rem; color:var(--muted); margin-bottom:10px; }
      .bi-drill-row {
        display:flex; justify-content:space-between; gap:10px; padding:10px 8px;
        border-bottom:1px solid rgba(148,163,184,0.1); cursor:pointer;
      }
      .bi-drill-row:hover { background:rgba(56,189,248,0.08); }
      .bi-meta-bar {
        height:14px; border-radius:999px; background:rgba(148,163,184,0.15); overflow:hidden; margin-top:8px;
      }
      .bi-meta-fill { height:100%; background:linear-gradient(90deg,#38bdf8,#34d399); }
      .bi-footnote { font-size:0.75rem; color:var(--muted); margin:8px 0 0; }
      @media print {
        .bi-exec-topbar .bi-exec-actions, .bi-exec-pages, .header-menu-dropdown, #appHeaderMenuBtn { display:none !important; }
        .bi-exec-shell { gap:8px; }
        .bi-panel, .bi-kpi { break-inside:avoid; }
      }
    `;
    document.head.appendChild(style);
  }

  function optionList(items, selected, allLabel) {
    const opts = [`<option value="">${allLabel}</option>`];
    (items || []).forEach(function (it) {
      const sel = String(it.id) === String(selected) ? " selected" : "";
      opts.push(`<option value="${esc(it.id)}"${sel}>${esc(it.label)}</option>`);
    });
    return opts.join("");
  }

  function syncFiltersFromDom() {
    const g = function (id) {
      const el = document.getElementById(id);
      return el ? el.value : "";
    };
    _filters = {
      period: g("biFilterPeriod") || "30d",
      financeiraId: g("biFilterFinanceira") || "",
      parceiroId: g("biFilterParceiro") || "",
      cidade: g("biFilterCidade") || "",
      estado: g("biFilterEstado") || "",
      status: g("biFilterStatus") || "",
      tipoVeiculo: g("biFilterTipo") || "",
    };
  }

  function computeMetrics(data) {
    const service = getService();
    if (!service) return null;
    const meta =
      typeof global.financeMetaRead === "function" ? global.financeMetaRead() : { nome: "", valor: 0 };
    const settings = Object.assign({}, data.settings || {}, {
      metaReceitaMensal: meta && meta.valor > 0 ? meta.valor : (data.settings && data.settings.metaReceitaMensal) || 0,
      metaReceitaNome: (meta && meta.nome) || (data.settings && data.settings.metaReceitaNome) || "",
    });
    return service.getMetricsFromSnapshot(
      {
        vehicles: data.vehicles || [],
        partners: data.partners || [],
        receivables: data.receivables || [],
        events: data.events || [],
        settings: settings,
        asOfYmd: data.asOfYmd,
        metaReceitaMensal: settings.metaReceitaMensal,
        metaReceitaNome: settings.metaReceitaNome,
      },
      _filters
    );
  }

  function barChartSvg(labels, values, color, height, tipFn, ctx) {
    const vals = values || [];
    const labs = labels || [];
    if (!labs.length) return `<div class="bi-chart-empty">Sem dados</div>`;
    const max = Math.max.apply(null, vals.concat([1]));
    const w = Math.max(320, labs.length * 28);
    const h = height || 180;
    const padL = 8;
    const padB = 28;
    const padT = 12;
    const innerH = h - padB - padT;
    const bw = Math.max(6, (w - padL * 2) / labs.length - 4);
    let rects = "";
    labs.forEach(function (lab, i) {
      const v = Number(vals[i] || 0);
      const bh = (v / max) * innerH;
      const x = padL + i * ((w - padL * 2) / labs.length) + 2;
      const y = padT + innerH - bh;
      const tip = tipFn ? tipFn(lab, v) : lab + ": " + v;
      rects += `<rect x="${x}" y="${y}" width="${bw}" height="${Math.max(1, bh)}" rx="3" fill="${color}" opacity="0.9"><title>${esc(tip, ctx)}</title></rect>`;
      if (labs.length <= 14 || i % Math.ceil(labs.length / 12) === 0) {
        rects += `<text x="${x + bw / 2}" y="${h - 8}" text-anchor="middle" fill="#94a3b8" font-size="9">${esc(String(lab).slice(0, 5), ctx)}</text>`;
      }
    });
    return `<svg class="hub-chart" viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img">${rects}</svg>`;
  }

  function dualBarChartSvg(labels, a, b, cA, cB, height, ctx) {
    const labs = labels || [];
    if (!labs.length) return `<div class="bi-chart-empty">Sem dados</div>`;
    const max = Math.max.apply(null, (a || []).concat(b || []).concat([1]));
    const w = Math.max(360, labs.length * 32);
    const h = height || 190;
    const padT = 12;
    const padB = 28;
    const innerH = h - padB - padT;
    const slot = (w - 16) / labs.length;
    let rects = "";
    labs.forEach(function (lab, i) {
      const x0 = 8 + i * slot;
      const va = Number(a[i] || 0);
      const vb = Number(b[i] || 0);
      const ha = (va / max) * innerH;
      const hb = (vb / max) * innerH;
      const bw = Math.max(4, slot / 2 - 4);
      rects += `<rect x="${x0}" y="${padT + innerH - ha}" width="${bw}" height="${Math.max(1, ha)}" rx="2" fill="${cA}"><title>${esc(lab + " A: " + va, ctx)}</title></rect>`;
      rects += `<rect x="${x0 + bw + 2}" y="${padT + innerH - hb}" width="${bw}" height="${Math.max(1, hb)}" rx="2" fill="${cB}"><title>${esc(lab + " B: " + vb, ctx)}</title></rect>`;
      if (labs.length <= 16 || i % Math.ceil(labs.length / 12) === 0) {
        rects += `<text x="${x0 + slot / 2}" y="${h - 8}" text-anchor="middle" fill="#94a3b8" font-size="9">${esc(String(lab).slice(0, 5), ctx)}</text>`;
      }
    });
    return `<svg class="hub-chart" viewBox="0 0 ${w} ${h}" width="100%" height="${h}">${rects}</svg>`;
  }

  function lineChartSvg(labels, values, color, height, ctx) {
    const labs = labels || [];
    const vals = values || [];
    if (!labs.length) return `<div class="bi-chart-empty">Sem dados</div>`;
    const max = Math.max.apply(null, vals.concat([1]));
    const w = Math.max(320, labs.length * 24);
    const h = height || 180;
    const pad = 12;
    const padB = 26;
    const innerH = h - pad - padB;
    const innerW = w - pad * 2;
    const pts = vals
      .map(function (v, i) {
        const x = pad + (labs.length === 1 ? innerW / 2 : (i / (labs.length - 1)) * innerW);
        const y = pad + innerH - (Number(v || 0) / max) * innerH;
        return x + "," + y;
      })
      .join(" ");
    let dots = "";
    vals.forEach(function (v, i) {
      const x = pad + (labs.length === 1 ? innerW / 2 : (i / (labs.length - 1)) * innerW);
      const y = pad + innerH - (Number(v || 0) / max) * innerH;
      dots += `<circle cx="${x}" cy="${y}" r="2.5" fill="${color}"><title>${esc(labs[i] + ": " + v, ctx)}</title></circle>`;
    });
    return `<svg class="hub-chart" viewBox="0 0 ${w} ${h}" width="100%" height="${h}"><polyline fill="none" stroke="${color}" stroke-width="2" points="${pts}"/>${dots}</svg>`;
  }

  function hbarChartSvg(points, color, ctx) {
    const items = (points || []).slice(0, 12);
    if (!items.length) return `<div class="bi-chart-empty">Sem dados</div>`;
    const max = Math.max.apply(
      null,
      items.map(function (p) {
        return Number(p.value || 0);
      }).concat([1])
    );
    const rows = items
      .map(function (p) {
        const pct = (Number(p.value || 0) / max) * 100;
        return `<div style="display:grid;grid-template-columns:110px 1fr 72px;gap:8px;align-items:center;margin:6px 0">
          <span style="font-size:0.75rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(p.label, ctx)}">${esc(p.label, ctx)}</span>
          <div style="height:10px;border-radius:999px;background:rgba(148,163,184,0.12)"><div style="width:${pct}%;height:100%;border-radius:999px;background:${color}"></div></div>
          <strong style="font-size:0.75rem;text-align:right">${esc(money(p.value, ctx), ctx)}</strong>
        </div>`;
      })
      .join("");
    return `<div class="hub-chart hub-chart--hbar">${rows}</div>`;
  }

  function pieSvg(slices, ctx) {
    const items = slices || [];
    if (!items.length) return `<div class="bi-chart-empty">Sem dados</div>`;
    const total = items.reduce(function (s, x) {
      return s + Number(x.value || 0);
    }, 0) || 1;
    const colors = ["#38bdf8", "#34d399", "#fbbf24", "#fb923c", "#a78bfa", "#f472b6", "#60a5fa", "#94a3b8"];
    let angle = -Math.PI / 2;
    const cx = 90;
    const cy = 90;
    const r = 70;
    let paths = "";
    items.forEach(function (it, i) {
      const frac = Number(it.value || 0) / total;
      const a2 = angle + frac * Math.PI * 2;
      const x1 = cx + r * Math.cos(angle);
      const y1 = cy + r * Math.sin(angle);
      const x2 = cx + r * Math.cos(a2);
      const y2 = cy + r * Math.sin(a2);
      const large = frac > 0.5 ? 1 : 0;
      paths += `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z" fill="${colors[i % colors.length]}" opacity="0.9"><title>${esc(it.label + ": " + money(it.value, ctx), ctx)}</title></path>`;
      angle = a2;
    });
    const legend = items
      .map(function (it, i) {
        return `<span><i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${colors[i % colors.length]};margin-right:5px"></i>${esc(it.label, ctx)} (${esc(Number(it.pct || 0).toFixed(1), ctx)}%)</span>`;
      })
      .join("");
    return `<svg viewBox="0 0 180 180" width="180" height="180">${paths}</svg><div class="bi-pie-legend">${legend}</div>`;
  }

  function renderKpis(list, ctx) {
    return `<div class="bi-kpi-grid">${(list || [])
      .map(function (k) {
        return `<article class="bi-kpi"><span>${esc(k.label, ctx)}</span><strong>${esc(fmtKpi(k, ctx), ctx)}</strong>${
          k.meta ? `<em>${esc(k.meta, ctx)}</em>` : ""
        }</article>`;
      })
      .join("")}</div>`;
  }

  function panel(title, body, drillKey) {
    const cls = drillKey ? "bi-panel bi-clickable" : "bi-panel";
    const attr = drillKey ? ` data-bi-drill="${drillKey}"` : "";
    return `<div class="${cls}"${attr}><h4>${title}</h4>${body}</div>`;
  }

  function renderHeatmap(page, ctx) {
    if (!page.heatmap || !page.heatmap.length) return `<div class="bi-chart-empty">Sem dados de permanência</div>`;
    const cols = page.heatmapCols || [];
    const rowsMap = {};
    page.heatmap.forEach(function (c) {
      if (!rowsMap[c.rowId]) rowsMap[c.rowId] = { label: c.rowLabel, cells: {} };
      rowsMap[c.rowId].cells[c.colKey] = c.value;
    });
    const max = Math.max.apply(
      null,
      page.heatmap.map(function (c) {
        return c.value;
      }).concat([1])
    );
    let html = `<div class="bi-heat-row"><div></div>${cols
      .map(function (c) {
        return `<div class="bi-heat-label" style="text-align:center">${esc(c.label, ctx)}</div>`;
      })
      .join("")}</div>`;
    Object.keys(rowsMap).forEach(function (id) {
      const row = rowsMap[id];
      html += `<div class="bi-heat-row"><div class="bi-heat-label" title="${esc(row.label, ctx)}">${esc(row.label, ctx)}</div>`;
      cols.forEach(function (c) {
        const v = row.cells[c.key] || 0;
        const alpha = 0.12 + (v / max) * 0.75;
        html += `<div class="bi-heat-cell" style="background:rgba(56,189,248,${alpha})">${v || ""}</div>`;
      });
      html += `</div>`;
    });
    return `<div class="bi-heat">${html}</div>`;
  }

  function renderPageVisao(m, ctx) {
    const o = m.overview;
    return `
      ${renderKpis(o.kpis, ctx)}
      <div class="bi-charts">
        ${panel("Entradas × Saídas (24 meses)", dualBarChartSvg(o.entradasSaidas24m.labels, o.entradasSaidas24m.a, o.entradasSaidas24m.b, "#34d399", "#60a5fa", 200, ctx), "mov")}
        ${panel("Receita Mensal (24 meses)", barChartSvg(o.receitaMensal24m.labels, o.receitaMensal24m.values, "#38bdf8", 200, function (l, v) { return l + ": " + money(v, ctx); }, ctx), "receita")}
        ${panel("Ocupação do pátio", lineChartSvg(o.ocupacaoTimeline.labels, o.ocupacaoTimeline.values, "#fbbf24", 190, ctx))}
        ${panel("Tempo médio de permanência", lineChartSvg(o.tempoMedioTimeline.labels, o.tempoMedioTimeline.values, "#fb923c", 190, ctx))}
        ${panel("Receita por Cidade", hbarChartSvg(o.receitaPorCidade, "#34d399", ctx), "geo")}
        ${panel("Receita por Estado", hbarChartSvg(o.receitaPorEstado, "#a78bfa", ctx), "geo")}
      </div>
      <p class="bi-footnote">Cidade/UF: usa campos disponíveis nos dados atuais; quando ausentes, agrupa em “Não informado”.</p>
    `;
  }

  function renderPageFinanceiras(m, ctx) {
    const f = m.financeiras;
    const body = (f.ranking || [])
      .map(function (r) {
        return `<tr data-bi-fin="${esc(r.id, ctx)}" class="bi-drill-fin">
          <td>${esc(r.nome, ctx)}</td>
          <td>${r.veiculos}</td>
          <td>${esc(money(r.receita, ctx), ctx)}</td>
          <td>${r.tempoMedio.toFixed(1).replace(".", ",")}</td>
          <td>${esc(money(r.ticketMedio, ctx), ctx)}</td>
          <td>${r.movimentacoes}</td>
          <td>${r.participacaoPct.toFixed(1).replace(".", ",")}%</td>
        </tr>`;
      })
      .join("");
    const multi = (f.evolucaoMensal.series || [])
      .map(function (s, idx) {
        const colors = ["#38bdf8", "#34d399", "#fbbf24", "#fb923c", "#a78bfa"];
        return lineChartSvg(f.evolucaoMensal.labels, s.values, colors[idx % colors.length], 160, ctx) +
          `<div class="bi-footnote">${esc(s.name, ctx)}</div>`;
      })
      .join("");
    return `
      <div class="bi-panel" style="margin-bottom:14px">
        <h4>Ranking de Financeiras</h4>
        <div class="bi-table-wrap"><table class="bi-table">
          <thead><tr><th>Financeira</th><th>Veículos</th><th>Receita</th><th>Tempo méd.</th><th>Ticket</th><th>Movimentações</th><th>Part. %</th></tr></thead>
          <tbody>${body || `<tr><td colspan="7">Sem dados</td></tr>`}</tbody>
        </table></div>
      </div>
      <div class="bi-charts bi-charts--3">
        ${panel("Receita por Financeira (Top 20)", hbarChartSvg(f.receitaTop20, "#38bdf8", ctx), "receita")}
        ${panel("Participação da Receita", pieSvg(f.participacaoPizza, ctx), "receita")}
        ${panel("Evolução mensal (Top 5)", multi || `<div class="bi-chart-empty">Sem série</div>`)}
      </div>
    `;
  }

  function renderPagePermanencia(m, ctx) {
    const p = m.permanencia;
    const dist = (p.distribuicao || [])
      .map(function (s) {
        return `<div style="display:flex;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid rgba(148,163,184,0.1)">
          <span>${esc(s.label, ctx)}</span>
          <strong>${s.count} · ${s.pct.toFixed(1).replace(".", ",")}%</strong>
        </div>`;
      })
      .join("");
    const rows = (p.top50 || [])
      .map(function (r) {
        return `<tr>
          <td>${esc(r.placa, ctx)}</td><td>${esc(r.modelo, ctx)}</td><td>${esc(r.financeira, ctx)}</td>
          <td>${r.dias}</td><td>${esc(r.status, ctx)}</td><td>${esc(money(r.valorAcumulado, ctx), ctx)}</td>
        </tr>`;
      })
      .join("");
    return `
      <div class="bi-charts">
        ${panel("Distribuição por faixa", dist || `<div class="bi-chart-empty">Sem veículos</div>`)}
        ${panel(
          "Histograma (dias no pátio)",
          barChartSvg(
            (p.histograma || []).map(function (x) { return x.label; }),
            (p.histograma || []).map(function (x) { return x.value; }),
            "#fb923c",
            200,
            null,
            ctx
          )
        )}
      </div>
      <div class="bi-panel" style="margin-bottom:14px"><h4>Heatmap · Dias × Financeira</h4>${renderHeatmap(p, ctx)}</div>
      <div class="bi-panel"><h4>50 veículos com maior permanência</h4>
        <div class="bi-table-wrap"><table class="bi-table">
          <thead><tr><th>Placa</th><th>Modelo</th><th>Financeira</th><th>Dias</th><th>Status</th><th>Valor acum.</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="6">Sem dados</td></tr>`}</tbody>
        </table></div>
      </div>
    `;
  }

  function renderPageReceita(m, ctx) {
    const r = m.receita;
    let metaHtml = `<div class="bi-chart-empty">Nenhuma meta cadastrada no Financeiro</div>`;
    if (r.metaVsRealizado) {
      const meta = r.metaVsRealizado;
      metaHtml = `<div>
        <div style="display:flex;justify-content:space-between;gap:8px"><span>${esc(meta.nome, ctx)}</span><strong>${esc(money(meta.realizado, ctx), ctx)} / ${esc(money(meta.meta, ctx), ctx)}</strong></div>
        <div class="bi-meta-bar"><div class="bi-meta-fill" style="width:${Math.min(100, meta.pct)}%"></div></div>
        <p class="bi-footnote">${meta.pct.toFixed(1).replace(".", ",")}% da meta mensal</p>
      </div>`;
    }
    return `
      ${renderKpis(r.kpis, ctx)}
      <div class="bi-charts">
        ${panel("Receita acumulada (30 dias)", lineChartSvg(r.acumulada.labels, r.acumulada.values, "#34d399", 190, ctx), "receita")}
        ${panel("Receita diária (30 dias)", barChartSvg(r.diaria.labels, r.diaria.values, "#38bdf8", 190, function (l, v) { return l + ": " + money(v, ctx); }, ctx), "receita")}
        ${panel("Comparativo anual", dualBarChartSvg(r.comparativoAnual.labels, r.comparativoAnual.a, r.comparativoAnual.b, "#38bdf8", "#94a3b8", 200, ctx))}
        ${panel("Meta × Realizado", metaHtml)}
      </div>
    `;
  }

  function renderPageMov(m, ctx) {
    const mv = m.movimentacao;
    return `<div class="bi-charts">
      ${panel("Entradas por dia", barChartSvg(mv.entradasPorDia.labels, mv.entradasPorDia.values, "#34d399", 180, null, ctx))}
      ${panel("Saídas por dia", barChartSvg(mv.saidasPorDia.labels, mv.saidasPorDia.values, "#60a5fa", 180, null, ctx))}
      ${panel("Entradas por mês", barChartSvg(mv.entradasPorMes.labels, mv.entradasPorMes.values, "#34d399", 180, null, ctx))}
      ${panel("Saídas por mês", barChartSvg(mv.saidasPorMes.labels, mv.saidasPorMes.values, "#60a5fa", 180, null, ctx))}
      ${panel("Movimentação por cidade", hbarCount(mv.porCidade, "#fbbf24", ctx))}
      ${panel("Movimentação por financeira", hbarCount(mv.porFinanceira, "#a78bfa", ctx))}
    </div>`;
  }

  function hbarCount(points, color, ctx) {
    const items = (points || []).slice(0, 12);
    if (!items.length) return `<div class="bi-chart-empty">Sem dados</div>`;
    const max = Math.max.apply(
      null,
      items.map(function (p) {
        return Number(p.value || 0);
      }).concat([1])
    );
    return items
      .map(function (p) {
        const pct = (Number(p.value || 0) / max) * 100;
        return `<div style="display:grid;grid-template-columns:110px 1fr 40px;gap:8px;align-items:center;margin:6px 0">
          <span style="font-size:0.75rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.label, ctx)}</span>
          <div style="height:10px;border-radius:999px;background:rgba(148,163,184,0.12)"><div style="width:${pct}%;height:100%;border-radius:999px;background:${color}"></div></div>
          <strong style="font-size:0.75rem;text-align:right">${Math.round(p.value)}</strong>
        </div>`;
      })
      .join("");
  }

  function renderPageEficiencia(m, ctx) {
    const e = m.eficiencia;
    const cards = (e.estagios || [])
      .map(function (s) {
        return `<article class="bi-kpi"><span>${esc(s.label, ctx)}</span><strong>${s.avgDays.toFixed(1).replace(".", ",")} d</strong><em>amostra ${s.sample}</em></article>`;
      })
      .join("");
    const garg = hbarCount(
      (e.gargalos || []).map(function (g) {
        return { label: g.label, value: g.avgDays };
      }),
      "#f87171",
      ctx
    );
    return `
      <div class="bi-kpi-grid" style="grid-template-columns:repeat(4,minmax(0,1fr))">${cards}</div>
      <div class="bi-panel"><h4>Gargalos (maior tempo de espera)</h4>${garg}</div>
      <p class="bi-footnote">Tempos estimados a partir de eventos do veículo e datas de entrada/vistoria/saída disponíveis.</p>
    `;
  }

  function renderPageAlertas(m, ctx) {
    const list = m.alertas || [];
    if (!list.length) {
      return `<div class="bi-alert bi-alert--green"><div class="bi-alert-dot"></div><div><strong>Sem alertas críticos</strong><p>Indicadores dentro dos parâmetros no recorte atual.</p></div></div>`;
    }
    return `<div class="bi-alert-list">${list
      .map(function (a) {
        return `<div class="bi-alert bi-alert--${esc(a.priority, ctx)}">
          <div class="bi-alert-dot"></div>
          <div><strong>${esc(a.title, ctx)}</strong><p>${esc(a.detail, ctx)}</p></div>
        </div>`;
      })
      .join("")}</div>`;
  }

  function renderPageContent(m, ctx) {
    switch (_page) {
      case "financeiras":
        return renderPageFinanceiras(m, ctx);
      case "permanencia":
        return renderPagePermanencia(m, ctx);
      case "receita":
        return renderPageReceita(m, ctx);
      case "movimentacao":
        return renderPageMov(m, ctx);
      case "eficiencia":
        return renderPageEficiencia(m, ctx);
      case "alertas":
        return renderPageAlertas(m, ctx);
      default:
        return renderPageVisao(m, ctx);
    }
  }

  function renderShell(m, ctx) {
    const fo = m.filterOptions || {};
    const tabs = PAGES.map(function (p) {
      return `<button type="button" data-bi-page="${p.id}" class="${_page === p.id ? "active" : ""}">${esc(p.label, ctx)}</button>`;
    }).join("");
    return `
      <div class="bi-exec-shell">
        <div class="bi-exec-topbar">
          <label>Período<select id="biFilterPeriod">
            <option value="today"${_filters.period === "today" ? " selected" : ""}>Hoje</option>
            <option value="7d"${_filters.period === "7d" ? " selected" : ""}>7 dias</option>
            <option value="30d"${_filters.period === "30d" ? " selected" : ""}>30 dias</option>
            <option value="month"${_filters.period === "month" ? " selected" : ""}>Mês</option>
            <option value="year"${_filters.period === "year" ? " selected" : ""}>Ano</option>
            <option value="24m"${_filters.period === "24m" ? " selected" : ""}>24 meses</option>
          </select></label>
          <label>Financeira<select id="biFilterFinanceira">${optionList(fo.financeiras, _filters.financeiraId, "Todas")}</select></label>
          <label>Parceiro<select id="biFilterParceiro">${optionList(fo.parceiros, _filters.parceiroId, "Todos")}</select></label>
          <label>Cidade<select id="biFilterCidade">${optionList(fo.cidades, _filters.cidade, "Todas")}</select></label>
          <label>Estado<select id="biFilterEstado">${optionList(fo.estados, _filters.estado, "Todos")}</select></label>
          <label>Status<select id="biFilterStatus">${optionList(fo.statusList, _filters.status, "Todos")}</select></label>
          <label>Tipo<select id="biFilterTipo">${optionList(fo.tiposVeiculo, _filters.tipoVeiculo, "Todos")}</select></label>
          <div class="bi-exec-actions">
            <button type="button" data-bi-export="csv">CSV</button>
            <button type="button" data-bi-export="excel">Excel</button>
            <button type="button" data-bi-export="pdf">PDF</button>
            <button type="button" data-bi-export="print">Imprimir</button>
          </div>
        </div>
        <nav class="bi-exec-pages" aria-label="Páginas do BI">${tabs}</nav>
        <div class="bi-exec-page" data-page="${_page}">${renderPageContent(m, ctx)}</div>
      </div>
    `;
  }

  function closeDrill() {
    document.getElementById("biDrillModal")?.remove();
    _drillStack = [];
  }

  function openDrill(level, ctx) {
    closeDrill();
    if (!level) return;
    _drillStack = [level];
    const backdrop = document.createElement("div");
    backdrop.id = "biDrillModal";
    backdrop.className = "bi-modal-backdrop";
    backdrop.innerHTML = `
      <div class="bi-modal" role="dialog" aria-modal="true">
        <header>
          <h3>${esc(level.label, ctx)}</h3>
          <button type="button" class="secondary" data-bi-drill-close>Fechar</button>
        </header>
        <div class="bi-crumb">Receita → detalhe</div>
        <div id="biDrillBody"></div>
      </div>`;
    document.body.appendChild(backdrop);
    renderDrillBody(ctx);
    backdrop.addEventListener("click", function (e) {
      if (e.target === backdrop || e.target.getAttribute("data-bi-drill-close") != null) closeDrill();
    });
  }

  function renderDrillBody(ctx) {
    const body = document.getElementById("biDrillBody");
    const level = _drillStack[_drillStack.length - 1];
    if (!body || !level) return;
    const crumb = _drillStack.map(function (l) { return l.label; }).join(" → ");
    const crumbEl = document.querySelector("#biDrillModal .bi-crumb");
    if (crumbEl) crumbEl.textContent = crumb;
    body.innerHTML = (level.rows || [])
      .map(function (r) {
        const val =
          r.format === "money" ? money(r.value, ctx) : r.format === "days" ? Number(r.value).toFixed(1) + " d" : String(r.value);
        return `<div class="bi-drill-row" data-bi-drill-id="${esc(r.id, ctx)}">
          <div><strong>${esc(r.label, ctx)}</strong>${r.meta ? `<div class="bi-footnote">${esc(r.meta, ctx)}</div>` : ""}</div>
          <strong>${esc(val, ctx)}</strong>
        </div>`;
      })
      .join("") || `<div class="bi-chart-empty">Sem detalhe</div>`;

    body.querySelectorAll("[data-bi-drill-id]").forEach(function (row) {
      row.addEventListener("click", function () {
        const id = row.getAttribute("data-bi-drill-id");
        const m = _lastMetrics;
        if (!m) return;
        if (level.key === "financeiras" && m.drillVeiculosPorFinanceira[id]) {
          _drillStack.push(m.drillVeiculosPorFinanceira[id]);
          renderDrillBody(ctx);
          return;
        }
        if (String(level.key || "").indexOf("veiculos:") === 0) {
          const v = (_lastData.vehicles || []).find(function (x) {
            return String(x.id) === String(id);
          });
          if (!v) return;
          const hist = (_lastData.events || [])
            .filter(function (e) {
              return String(e.vehicle_id) === String(id);
            })
            .slice(0, 40)
            .map(function (e) {
              return {
                id: String(e.id || e.data_evento || Math.random()),
                label: `${e.data_evento || e.created_at || "—"} · ${e.tipo || "evento"}`,
                value: 0,
                meta: e.responsavel || e.descricao || "",
              };
            });
          _drillStack.push({
            key: "hist:" + id,
            label: `Histórico · ${v.placa || id}`,
            rows: hist.length
              ? hist
              : [
                  {
                    id: "info",
                    label: `${v.placa || "—"} · ${v.status || "—"}`,
                    value: 0,
                    meta: `Entrada ${v.data_entrada || "—"} · Saída ${v.data_saida || "—"}`,
                  },
                ],
          });
          renderDrillBody(ctx);
        }
      });
    });
  }

  function exportRows(format) {
    const m = _lastMetrics;
    if (!m) return;
    const rows = [["Página", "Indicador", "Valor"]];
    (m.overview.kpis || []).forEach(function (k) {
      rows.push(["Visão Geral", k.label, String(k.value)]);
    });
    (m.financeiras.ranking || []).forEach(function (r) {
      rows.push(["Financeiras", r.nome, String(r.receita)]);
    });
    (m.permanencia.top50 || []).forEach(function (r) {
      rows.push(["Permanência", r.placa, String(r.dias)]);
    });
    if (format === "print") {
      global.print();
      return;
    }
    const sep = ";";
    const csv = rows
      .map(function (r) {
        return r
          .map(function (c) {
            return `"${String(c ?? "").replace(/"/g, '""')}"`;
          })
          .join(sep);
      })
      .join("\n");
    const blob = new Blob(["\ufeff" + csv], {
      type: format === "excel" ? "application/vnd.ms-excel;charset=utf-8" : "text/csv;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = format === "excel" ? "bi-executivo.xls" : "bi-executivo.csv";
    a.click();
    URL.revokeObjectURL(a.href);

    if (format === "pdf") {
      if (typeof global.loadJsPdf === "function") {
        Promise.resolve(global.loadJsPdf())
          .then(function () {
            const J = global.jspdf && (global.jspdf.jsPDF || global.jspdf);
            if (!J) {
              global.print();
              return;
            }
            const doc = new J({ unit: "pt", format: "a4" });
            doc.setFontSize(12);
            doc.text("BI Executivo — AMPLIAUTO", 40, 40);
            let y = 64;
            rows.slice(0, 40).forEach(function (r) {
              doc.setFontSize(9);
              doc.text(String(r.join(" | ")).slice(0, 95), 40, y);
              y += 14;
              if (y > 780) {
                doc.addPage();
                y = 40;
              }
            });
            doc.save("bi-executivo.pdf");
          })
          .catch(function () {
            global.print();
          });
      } else {
        global.print();
      }
    }
  }

  function bindRootEvents(root, ctx) {
    root.querySelectorAll("[data-bi-page]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        _page = btn.getAttribute("data-bi-page") || "visao";
        biExecutivoRender(_lastData, _lastCtx || {});
      });
    });
    root.querySelectorAll("[data-bi-export]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        exportRows(btn.getAttribute("data-bi-export"));
      });
    });
    root.querySelectorAll("[data-bi-drill]").forEach(function (el) {
      el.addEventListener("click", function () {
        const key = el.getAttribute("data-bi-drill");
        if (key === "receita" && _lastMetrics) openDrill(_lastMetrics.drillReceitaPorFinanceira, ctx);
      });
    });
    root.querySelectorAll(".bi-drill-fin").forEach(function (tr) {
      tr.style.cursor = "pointer";
      tr.addEventListener("click", function () {
        const id = tr.getAttribute("data-bi-fin");
        if (_lastMetrics && _lastMetrics.drillVeiculosPorFinanceira[id]) {
          openDrill(_lastMetrics.drillReceitaPorFinanceira, ctx);
          _drillStack = [_lastMetrics.drillReceitaPorFinanceira, _lastMetrics.drillVeiculosPorFinanceira[id]];
          const modal = document.getElementById("biDrillModal");
          if (modal) renderDrillBody(ctx);
          else {
            openDrill(_lastMetrics.drillVeiculosPorFinanceira[id], ctx);
          }
        }
      });
    });
  }

  function bindFilterListeners() {
    if (_bound) return;
    _bound = true;
    const root = document.getElementById("viewBiExecutivo") || document;
    const refresh = function () {
      syncFiltersFromDom();
      const svc = getService();
      if (svc && typeof svc.invalidateCache === "function") svc.invalidateCache();
      biExecutivoRender(_lastData, _lastCtx || {});
    };
    root.addEventListener("change", function (e) {
      const id = e.target && e.target.id;
      if (!id || String(id).indexOf("biFilter") !== 0) return;
      refresh();
    });
  }

  function biExecutivoRender(data, ctx) {
    injectStylesOnce();
    bindFilterListeners();
    _lastData = data || { vehicles: [], partners: [], receivables: [], events: [], settings: {} };
    _lastCtx = ctx || {};
    const root = document.getElementById("biExecRoot");
    if (!root) return;
    syncFiltersFromDom();
    const m = computeMetrics(_lastData);
    if (!m) {
      root.innerHTML = `<p class="notice">Serviço de BI indisponível.</p>`;
      return;
    }
    _lastMetrics = m;
    root.innerHTML = renderShell(m, _lastCtx);
    bindRootEvents(root, _lastCtx);
  }

  function biExecutivoInit() {
    injectStylesOnce();
    bindFilterListeners();
  }

  global.biExecutivoRender = biExecutivoRender;
  global.biExecutivoInit = biExecutivoInit;
  global.biExecutivoInvalidateCache = function () {
    const svc = getService();
    if (svc) svc.invalidateCache();
    if (_lastData) biExecutivoRender(_lastData, _lastCtx || {});
  };
})(typeof window !== "undefined" ? window : globalThis);

/**
 * Dashboard do Pátio — central de operação (só apresentação).
 * Números vêm do operationalDashboardService e dos veículos já carregados.
 */
(function operationalDashboardUiModule(global) {
  "use strict";

  let _bound = false;
  let _stylesInjected = false;
  let _lastData = null;
  let _lastCtx = null;
  let _filters = { period: "today", financeiraId: "", parceiroId: "", status: "", search: "" };

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
    const css = `
      .ops-dash-legacy-hidden { display: none !important; }
      .cmd-ops { display: flex; flex-direction: column; gap: 22px; }
      .cmd-ops-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; flex-wrap: wrap; }
      .cmd-ops-head h2 { margin: 0; font-size: 1.15rem; letter-spacing: 0.06em; text-transform: uppercase; }
      .cmd-ops-head p { margin: 4px 0 0; color: var(--ag-muted, #3a4046); font-size: 14px; }
      .cmd-ops-meta { text-align: right; color: var(--ag-muted, #3a4046); font-size: 13px; line-height: 1.45; }
      .cmd-ops-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
      .cmd-ops-kpi { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 12px 14px; min-height: 88px; text-align: left; border-radius: 2px; border: 1px solid var(--ag-border, #9a948a); background: var(--ag-card, #fbf8f3); color: inherit; font: inherit; cursor: pointer; }
      .cmd-ops-kpi span { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ag-muted, #3a4046); }
      .cmd-ops-kpi strong { font-size: 1.85rem; line-height: 1.05; color: #121314; }
      .cmd-ops-kpi--alert { border-left: 3px solid #a15c12; }
      .cmd-ops-kpi--money { grid-column: 1 / -1; min-height: 96px; border-left: 3px solid #2f6b3a; }
      .cmd-ops-kpi--money small { margin-top: 2px; font-size: 12px; color: var(--ag-muted, #3a4046); font-weight: 500; letter-spacing: 0; text-transform: none; }
      .cmd-ops-kpi--money strong { font-variant-numeric: tabular-nums; }
      .cmd-ops-block h3 { margin: 0 0 10px; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; }
      .cmd-ops-attn { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
      .cmd-ops-attn li { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border: 1px solid var(--ag-border, #9a948a); background: var(--ag-card, #fbf8f3); }
      .cmd-ops-dot { width: 10px; height: 10px; border-radius: 50%; flex: 0 0 auto; }
      .cmd-ops-dot--red { background: #9b2c2c; }
      .cmd-ops-dot--yellow { background: #a15c12; }
      .cmd-ops-attn strong { min-width: 1.8rem; font-size: 1.15rem; }
      .cmd-ops-attn span { flex: 1; color: #121314; }
      .cmd-ops-attn button, .cmd-ops-link { min-height: 32px; padding: 6px 12px; font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; }
      .cmd-ops-empty { margin: 0; color: var(--ag-muted, #3a4046); }
      .cmd-ops-today { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
      .cmd-ops-today div { padding: 12px 14px; border: 1px solid var(--ag-border, #9a948a); background: var(--ag-surface-2, #ebe6de); }
      .cmd-ops-today span { display: block; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ag-muted, #3a4046); }
      .cmd-ops-today strong { font-size: 1.5rem; }
      .cmd-ops-today--pos strong { color: #2f6b3a; }
      .cmd-ops-today--neg strong { color: #9b2c2c; }
      .cmd-ops-mov-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
      .cmd-ops-mov { list-style: none; margin: 0; padding: 0; }
      .cmd-ops-mov li { display: grid; grid-template-columns: 4.2rem 6.5rem 1fr; gap: 10px; padding: 8px 0; border-bottom: 1px solid #cfc8bc; font-size: 14px; }
      .cmd-ops-mov time { color: var(--ag-muted, #3a4046); font-variant-numeric: tabular-nums; }
      @media (max-width: 900px) { .cmd-ops-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      @media (max-width: 560px) {
        .cmd-ops-kpis, .cmd-ops-today { grid-template-columns: 1fr; }
        .cmd-ops-head, .cmd-ops-mov-head { flex-direction: column; }
        .cmd-ops-meta { text-align: left; }
      }
    `;
    let style = document.getElementById("opsDashUiStyles");
    if (!style) {
      style = document.createElement("style");
      style.id = "opsDashUiStyles";
      document.head.appendChild(style);
    }
    style.textContent = css;
    _stylesInjected = true;
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
    if (head && head.nextSibling) panel.insertBefore(root, head.nextSibling);
    else panel.insertBefore(root, panel.firstChild);
    return root;
  }

  function isOnPatio(v) {
    if (typeof global.isVehicleOnPatio === "function") return global.isVehicleOnPatio(v);
    const st = String(v.status || "").toUpperCase();
    if (st === "REMOVIDO") return false;
    return !v.data_saida;
  }

  function countRemocao(vehicles) {
    return (vehicles || []).filter((v) => {
      const st = String(v.status || "").toUpperCase();
      return st.includes("REMOCAO") && st !== "REMOVIDO";
    }).length;
  }

  function countVistoria(vehicles, fallback) {
    if (typeof global.vehicleNeedsEntryInspection === "function") {
      return (vehicles || []).filter((v) => global.vehicleNeedsEntryInspection(v)).length;
    }
    return Number(fallback || 0);
  }

  function formatLongDate() {
    try {
      return new Date().toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch (e) {
      return new Date().toLocaleDateString("pt-BR");
    }
  }

  function formatClock() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  function toLocalYmd(value) {
    if (typeof global.toLocalYmd === "function") return global.toLocalYmd(value);
    if (!value) return null;
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) return null;
      const y = value.getFullYear();
      const m = String(value.getMonth() + 1).padStart(2, "0");
      const d = String(value.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    const s = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s.includes("T") ? s : `${s.slice(0, 10)}T12:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    return toLocalYmd(d);
  }

  function todayYmd() {
    return toLocalYmd(new Date()) || "";
  }

  /** 1 diária do dia (valor_diaria), não o acúmulo da permanência. */
  function diariaValorNoDia(vehicle, dayYmd) {
    if (typeof global.calcDiariaValorGeradoNoDiaLocal === "function") {
      return Number(global.calcDiariaValorGeradoNoDiaLocal(vehicle, dayYmd) || 0);
    }
    if (!vehicle?.data_entrada || !dayYmd) return 0;
    const start = toLocalYmd(vehicle.data_entrada);
    if (!start || dayYmd < start) return 0;
    if (vehicle.data_saida) {
      const end = toLocalYmd(vehicle.data_saida);
      if (end && dayYmd > end) return 0;
    }
    const vd = Number(vehicle.valor_diaria);
    return Number.isFinite(vd) && vd > 0 ? vd : 0;
  }

  function diariasGeradasHoje(vehicles) {
    const day = todayYmd();
    let amount = 0;
    let count = 0;
    (vehicles || []).forEach((v) => {
      const val = diariaValorNoDia(v, day);
      if (val > 0) {
        amount += val;
        count += 1;
      }
    });
    return { amount, count };
  }

  function computeMetrics(data) {
    const service = getService();
    if (!service || typeof service.getMetricsFromSnapshot !== "function") {
      console.error("[operational-dashboard-ui] operationalDashboardService indisponível.");
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
        period: "today",
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

    const m = computeMetrics(_lastData);
    if (!m) {
      root.innerHTML = `<p class="cmd-ops-empty">Serviço de métricas operacionais indisponível.</p>`;
      return;
    }

    const vehicles = _lastData.vehicles || [];
    const k = m.kpis || {};
    const onPatio = vehicles.filter(isOnPatio).length;
    const isGestorPista = !!(ctx?.isGestorPista || global.isGestorPista);
    const fmtMoney =
      typeof ctx?.formatCurrency === "function"
        ? ctx.formatCurrency
        : (n) =>
            Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const diariasHoje = diariasGeradasHoje(vehicles);
    const diariasLabel = diariasHoje.count === 1 ? "veículo gerando diária hoje" : "veículos gerando diária hoje";
    const diariasValue = isGestorPista ? "—" : fmtMoney(diariasHoje.amount);
    const diariasHint = isGestorPista
      ? "Valores no perfil do gestor do sistema"
      : `${diariasHoje.count} ${diariasLabel} · só o dia de hoje, sem acúmulo`;
    const entradas = Number(k.entradasHoje || 0);
    const saidas = Number(k.saidasHoje || 0);
    const saldo = entradas - saidas;
    const vistoria = countVistoria(vehicles, k.aguardandoVistoria);
    const remocao = countRemocao(vehicles);
    const autorizacao = Number(m.fila?.aguardandoAutorizacao || 0);
    const conferencia = Number(k.aguardandoConferencia || 0);
    const retirada = Number(m.fila?.liberados || 0);
    const isAdm = !!(ctx?.isAdmDesktopPc || global.isAdmDesktopPc?.());

    const attention = [
      { count: remocao, tone: "red", label: "veículos aguardando remoção", nav: "patio:no_patio" },
      { count: vistoria, tone: "yellow", label: "veículos aguardando vistoria", nav: isAdm ? "patio:no_patio" : "patio:vistoria" },
      { count: autorizacao, tone: "yellow", label: "veículos aguardando autorização", nav: "patio:vlp" },
      { count: conferencia, tone: "yellow", label: "veículos aguardando conferência", nav: "patio:no_patio" },
      { count: retirada, tone: "yellow", label: "veículos aguardando retirada", nav: "patio:vlp" },
    ].filter((x) => x.count > 0);

    const pendencias = attention.reduce((s, x) => s + x.count, 0);
    const recent = (m.ultimasMovimentacoes || []).slice(0, 6);
    const saldoCls = saldo > 0 ? "cmd-ops-today--pos" : saldo < 0 ? "cmd-ops-today--neg" : "";
    const saldoTxt = saldo > 0 ? `+${saldo}` : String(saldo);

    const metaEl = document.getElementById("patioOpsMeta");
    if (metaEl) {
      metaEl.innerHTML = `<div>${esc(formatLongDate(), ctx)}</div><div>Atualizado às ${esc(formatClock(), ctx)}</div>`;
    }

    const attnHtml = attention.length
      ? `<ul class="cmd-ops-attn">${attention
          .map(
            (x) => `<li>
              <i class="cmd-ops-dot cmd-ops-dot--${esc(x.tone, ctx)}" aria-hidden="true"></i>
              <strong>${esc(String(x.count), ctx)}</strong>
              <span>${esc(x.label, ctx)}</span>
              <button type="button" data-hub-nav="${esc(x.nav, ctx)}">Ver</button>
            </li>`
          )
          .join("")}</ul>`
      : `<p class="cmd-ops-empty">Nenhuma pendência operacional no momento.</p>`;

    const movHtml = recent.length
      ? `<ul class="cmd-ops-mov">${recent
          .map(
            (r) =>
              `<li><time>${esc(r.horario || "—", ctx)}</time><span>${esc(r.evento || "—", ctx)}</span><strong>${esc(r.placa || "—", ctx)}</strong></li>`
          )
          .join("")}</ul>`
      : `<p class="cmd-ops-empty">Ainda não há movimentações registadas hoje.</p>`;

    root.innerHTML = `
      <div class="cmd-ops">
        <section class="cmd-ops-kpis" aria-label="Indicadores principais">
          <button type="button" class="cmd-ops-kpi cmd-ops-kpi--money" data-hub-nav="patio:no_patio">
            <span>Diárias geradas hoje</span>
            <strong>${esc(diariasValue, ctx)}</strong>
            <small>${esc(diariasHint, ctx)}</small>
          </button>
          <button type="button" class="cmd-ops-kpi" data-hub-nav="patio:no_patio">
            <span>Veículos no pátio</span>
            <strong>${esc(String(onPatio), ctx)}</strong>
          </button>
          <button type="button" class="cmd-ops-kpi" data-hub-nav="patio:no_patio">
            <span>Entradas hoje</span>
            <strong>${esc(String(entradas), ctx)}</strong>
          </button>
          <button type="button" class="cmd-ops-kpi" data-hub-nav="patio:removidos">
            <span>Saídas hoje</span>
            <strong>${esc(String(saidas), ctx)}</strong>
          </button>
          <button type="button" class="cmd-ops-kpi cmd-ops-kpi--alert" data-hub-nav="patio:no_patio">
            <span>Pendências</span>
            <strong>${esc(String(pendencias), ctx)}</strong>
          </button>
        </section>
        <section class="cmd-ops-block">
          <h3>Precisa da minha atenção</h3>
          ${attnHtml}
        </section>
        <section class="cmd-ops-block">
          <h3>Movimentação de hoje</h3>
          <div class="cmd-ops-today">
            <div><span>Entradas</span><strong>${esc(String(entradas), ctx)}</strong></div>
            <div><span>Saídas</span><strong>${esc(String(saidas), ctx)}</strong></div>
            <div class="${saldoCls}"><span>Saldo</span><strong>${esc(saldoTxt, ctx)}</strong></div>
          </div>
        </section>
        <section class="cmd-ops-block">
          <div class="cmd-ops-mov-head">
            <h3>Últimas movimentações</h3>
            <button type="button" class="cmd-ops-link secondary" data-hub-nav="lista:vrp">Ver todas</button>
          </div>
          ${movHtml}
        </section>
      </div>
    `;
  }

  function invalidateAndRefresh() {
    const service = getService();
    if (service && typeof service.invalidateCache === "function") service.invalidateCache();
    if (_lastData) {
      operationalDashboardRender(_lastData, _lastCtx || {});
      return;
    }
    if (typeof global.updateDashboard === "function") global.updateDashboard();
  }

  function hubNavigatePatio(target) {
    if (!target) return;
    const [view, sub] = String(target).split(":");
    if (view === "patio" && typeof global.openPatioSubview === "function") {
      global.openPatioSubview(sub || "inicio");
      return;
    }
    if (view === "lista" && typeof global.openListaSubview === "function") {
      global.openListaSubview(sub || "vrp");
      return;
    }
    const btn = document.querySelector(`#appHeaderMenu button[data-view="${view}"]`);
    if (btn) btn.click();
    if (view === "patio" && sub) {
      setTimeout(() => {
        document.querySelector(`#patioSubnav [data-subview="${sub}"]`)?.click();
      }, 100);
    }
  }

  function bindPanelListeners() {
    if (_bound) return;
    _bound = true;
    const panel = document.getElementById("patioInicioPanel") || document;
    panel.addEventListener("click", (e) => {
      const nav = e.target.closest("[data-hub-nav]");
      if (nav) hubNavigatePatio(nav.getAttribute("data-hub-nav"));
    });
  }

  function init() {
    injectStylesOnce();
    hideLegacyInicio();
    bindPanelListeners();
  }

  global.operationalDashboardRender = operationalDashboardRender;
  global.operationalDashboardUiInit = init;
  global.operationalDashboardInvalidateCache = invalidateAndRefresh;
})(typeof window !== "undefined" ? window : globalThis);

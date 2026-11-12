/**
 * Dashboard Executivo AmpliPátio — UI.
 * Indicadores vêm exclusivamente de DashboardMetricsService (sem SQL próprio por card).
 */
(function amplipatioDashboardModule(global) {
  "use strict";

  let _cache = null;
  let _bound = false;
  const CAPACITY_WARN_PCT = 85;

  let _filterPeriod = "today";
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
    if (periodEl) _filterPeriod = periodEl.value || "today";
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
      dailyLabels: (result.dailyFlow || result.dailyFlow30d).labels,
      dailyEntradas: (result.dailyFlow || result.dailyFlow30d).entradas,
      dailySaidas: (result.dailyFlow || result.dailyFlow30d).saidas,
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
      periodEntradas: (result.dailyFlow || result.dailyFlow30d).entradas.reduce((a, b) => a + b, 0),
      periodSaidas: (result.dailyFlow || result.dailyFlow30d).saidas.reduce((a, b) => a + b, 0),
      periodLabel: result.range?.label || "Hoje",
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
      periodLabel: "Hoje",
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

  function countAguardandoFaturamento(data) {
    if (typeof global.collectPatioAguardandoFaturamentoReceivables === "function") {
      return global.collectPatioAguardandoFaturamentoReceivables().length;
    }
    if (typeof global.receivableIsAguardandoFaturamentoFinanceiro === "function") {
      return (data.receivables || []).filter((r) => global.receivableIsAguardandoFaturamentoFinanceiro(r)).length;
    }
    return 0;
  }

  function countAguardandoVistoria(vehicles) {
    if (typeof global.vehicleNeedsEntryInspection === "function") {
      return (vehicles || []).filter((v) => global.vehicleNeedsEntryInspection(v)).length;
    }
    return 0;
  }

  function countRegistroPendente(vehicles) {
    if (typeof global.isRegistroPendente === "function") {
      return (vehicles || []).filter((v) => global.isRegistroPendente(v)).length;
    }
    return 0;
  }

  function recentPatioMovements(vehicles, limit) {
    const today = ymdToday();
    const rows = [];
    (vehicles || []).forEach((v) => {
      const placa = String(v.placa || "—");
      if (v.data_entrada && String(v.data_entrada).slice(0, 10) === today) {
        rows.push({ at: v.data_entrada, tipo: "Entrada", placa });
      }
      if (v.data_saida && String(v.data_saida).slice(0, 10) === today) {
        rows.push({ at: v.data_saida, tipo: "Saída", placa });
      }
    });
    rows.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return rows.slice(0, limit);
  }

  function formatClock(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
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

  function greetingName(ctx) {
    if (typeof global.formatOpsUserGreeting === "function") {
      return global.formatOpsUserGreeting(ctx?.userName || global.state?.user?.email || "");
    }
    const raw = String(ctx?.userName || global.state?.user?.email || "").trim();
    if (!raw) return "Olá";
    const local = raw.includes("@") ? raw.split("@")[0] : raw;
    const first = local.split(/[._-]/)[0];
    const nice = first ? first.charAt(0).toUpperCase() + first.slice(1) : "Olá";
    return `Olá, ${nice}`;
  }

  function periodCaption(period) {
    if (period === "today") return "hoje";
    if (period === "7d") return "nos últimos 7 dias";
    return "nos últimos 30 dias";
  }

  function syncPeriodChips() {
    document.querySelectorAll("[data-exec-period]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.getAttribute("data-exec-period") === _filterPeriod);
    });
    const sel = document.getElementById("hubDashFilterPeriod");
    if (sel && sel.value !== _filterPeriod) sel.value = _filterPeriod;
  }

  function renderAttention(items) {
    const visible = items.filter((x) => x.count > 0);
    if (!visible.length) {
      return `<section class="exec-ops-section" id="execOpsAttention">
        <h3>O que precisa da minha atenção</h3>
        <p class="exec-ops-empty">Nenhuma pendência operacional no momento.</p>
      </section>`;
    }
    return `<section class="exec-ops-section" id="execOpsAttention">
      <h3>O que precisa da minha atenção</h3>
      <ul class="exec-ops-attn">
        ${visible
          .map(
            (x) => `<li>
              <button type="button" data-hub-nav="${escapeHtml(x.nav)}">
                <strong>${escapeHtml(String(x.count))}</strong>
                <span>${escapeHtml(x.label)}</span>
              </button>
            </li>`
          )
          .join("")}
      </ul>
    </section>`;
  }

  function renderSituation(ops, onPatio) {
    const rows = [
      { label: "Em custódia", value: ops.aguardandoConferencia },
      { label: "Aguardando vistoria", value: ops.aguardandoVistoria },
      { label: "Aguardando autorização", value: ops.aguardandoAutorizacao },
      { label: "Aguardando retirada", value: ops.liberadosAguardandoRetirada },
      { label: "Com pendência", value: ops.comPendencias },
    ].filter((r) => r.value > 0);
    if (!rows.length) {
      return `<section class="exec-ops-section">
        <h3>Situação dos veículos</h3>
        <p class="exec-ops-empty">${onPatio ? `${onPatio} no pátio.` : "Nenhum veículo no pátio agora."}</p>
      </section>`;
    }
    const max = Math.max(1, ...rows.map((r) => r.value));
    return `<section class="exec-ops-section">
      <h3>Situação dos veículos</h3>
      <ul class="exec-ops-sit">
        ${rows
          .map(
            (r) => `<li>
              <span>${escapeHtml(r.label)}</span>
              <span class="exec-ops-sit-bar"><i style="width:${Math.max(8, (r.value / max) * 100)}%"></i></span>
              <strong>${escapeHtml(String(r.value))}</strong>
            </li>`
          )
          .join("")}
      </ul>
    </section>`;
  }

  function hubNavigate(target) {
    if (!target) return;
    let route = String(target);
    if (route === "patio:vistoria" && (global.isAdmDesktopPc?.() || false)) {
      route = "patio:no_patio";
    }
    const [view, sub] = route.split(":");
    if (route === "exec:attention") {
      document.getElementById("execOpsAttention")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (view === "patio") {
      if (typeof global.openPatioSubview === "function") {
        global.openPatioSubview(sub || "no_patio");
        return;
      }
    }
    if (view === "parceiros" && typeof global.showMainView === "function") {
      global.showMainView("parceiros");
      return;
    }
    if (view === "lista" && typeof global.openListaSubview === "function") {
      global.openListaSubview(sub || "vnp");
      return;
    }
    if (view === "financeiro") {
      if (typeof global.openFinanceSubview === "function") {
        global.openFinanceSubview(sub || "cobrancas");
        return;
      }
    }
    const btn = document.querySelector(`#appHeaderMenu button[data-view="${view}"]`);
    if (btn) btn.click();
    if (view === "patio" && sub) {
      setTimeout(() => {
        document.querySelector(`#patioSubnav [data-subview="${sub}"]`)?.click();
      }, 100);
    }
  }

  function ymdToday() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function vehicleStage(v) {
    if (typeof global.patioStageOfVehicle === "function") return global.patioStageOfVehicle(v);
    const s = String(v?.status || "").toUpperCase();
    if (s === "REMOVIDO") return "vrp";
    if (s === "LIBERACAO_SOLICITADA") return "vsl";
    if (s === "LIBERACAO_CONFIRMADA" || s.includes("REMOCAO_CONFIRMADA")) return "vsc";
    return "vnp";
  }

  function chaveKind(v) {
    if (typeof global.normalizeChaveCondicao === "function") return global.normalizeChaveCondicao(v?.chave_condicao);
    return String(v?.chave_condicao || "").toUpperCase();
  }

  function stayDays(v) {
    if (typeof global.calcDays === "function") return Number(global.calcDays(v) || 0);
    if (!v?.data_entrada) return 0;
    const start = new Date(v.data_entrada);
    const end = v.data_saida ? new Date(v.data_saida) : new Date();
    return Math.max(1, Math.ceil((end - start) / 86400000));
  }

  function moneyFmt(ctx, n) {
    if (ctx && typeof ctx.formatCurrency === "function") return ctx.formatCurrency(n);
    return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function metricChip(nav, label, value) {
    return `<button type="button" class="ag-dash-chip" data-hub-nav="${escapeHtml(nav)}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
    </button>`;
  }

  function finRow(nav, label, value) {
    return `<tr class="ag-dash-row" data-hub-nav="${escapeHtml(nav)}" tabindex="0">
      <td>${escapeHtml(label)}</td>
      <td class="num">${escapeHtml(String(value))}</td>
    </tr>`;
  }

  function buildHomeBoard(data, ctx) {
    const vehicles = data.vehicles || [];
    const today = ymdToday();
    const ym = today.slice(0, 7);
    const hideMoney = !!(ctx?.isGestorPista || ctx?.isVisualizador || global.isGestorPista || global.hidesFinancialValues?.());
    let vnp = 0;
    let vsl = 0;
    let vsc = 0;
    let vrp = 0;
    let inToday = 0;
    let outToday = 0;
    let cChave = 0;
    let sChave = 0;
    let trancado = 0;
    let staySum = 0;
    let stayN = 0;
    vehicles.forEach((v) => {
      const st = vehicleStage(v);
      const yIn = String(v.data_entrada || "").slice(0, 10);
      const yOut = String(v.data_saida || "").slice(0, 10);
      if (yIn === today) inToday += 1;
      if (yOut === today) outToday += 1;
      if (st === "vrp") {
        vrp += 1;
        return;
      }
      vnp += 1;
      if (st === "vsl") vsl += 1;
      if (st === "vsc") vsc += 1;
      const k = chaveKind(v);
      if (k === "C_CHAVE") cChave += 1;
      else if (k === "S_CHAVE") sChave += 1;
      else if (k === "TRANCADO") trancado += 1;
      staySum += stayDays(v);
      stayN += 1;
    });
    const avgStay = stayN ? (staySum / stayN).toFixed(1).replace(".", ",") : "—";

    const recs = data.receivables || [];
    const aguardando = recs.filter((r) =>
      typeof global.receivableIsAguardandoFaturamentoFinanceiro === "function"
        ? global.receivableIsAguardandoFaturamentoFinanceiro(r)
        : false
    );
    const aFaturar = aguardando.reduce((s, r) => s + Number(r.valor || 0), 0);
    const open =
      typeof global.financeContasReceberList === "function" ? global.financeContasReceberList() : recs.filter((r) => String(r.status || "").toUpperCase() === "EM_ABERTO");
    const vencidos = open.filter((r) =>
      typeof global.financeReceivableDisplayStatus === "function"
        ? global.financeReceivableDisplayStatus(r) === "Vencido" || global.financeReceivableDisplayStatus(r) === "Atrasado"
        : false
    );
    const aReceber = open.filter((r) => !vencidos.includes(r));
    const aReceberVal = aReceber.reduce((s, r) => s + Number(r.valor || 0), 0);
    const vencidoVal = vencidos.reduce((s, r) => s + Number(r.valor || 0), 0);
    const dueSoon = open.filter((r) => {
      const due =
        typeof global.financeContaDueYmd === "function" ? global.financeContaDueYmd(r, "receivable") : String(r.period_end || "").slice(0, 10);
      if (!due) return false;
      const d = new Date(`${due}T12:00:00`);
      const t = new Date(`${today}T12:00:00`);
      const diff = (d - t) / 86400000;
      return diff >= 0 && diff <= 7;
    });
    const cash = data.cash || [];
    const recebidoMes = cash.reduce((s, mov) => {
      const ymd =
        typeof global.financeCaixaMovCompetenciaYmd === "function"
          ? global.financeCaixaMovCompetenciaYmd(mov)
          : String(mov.data_movimento || mov.created_at || "").slice(0, 10);
      if (!ymd || ymd.slice(0, 7) !== ym) return s;
      const entrada = typeof global.financeCashIsEntrada === "function" ? global.financeCashIsEntrada(mov) : String(mov.tipo || "").toUpperCase() === "ENTRADA";
      if (!entrada) return s;
      const val = typeof global.financeCashMovValor === "function" ? global.financeCashMovValor(mov) : Number(mov.valor || 0);
      return s + Number(val || 0);
    }, 0);
    const faturadoMes = recs.reduce((s, r) => {
      const end = String(r.period_end || r.created_at || "").slice(0, 10);
      if (!end || end.slice(0, 7) !== ym) return s;
      if (!(Number(r.valor || 0) > 0)) return s;
      return s + Number(r.valor || 0);
    }, 0);
    const pixPend = (global.financePixUi && Array.isArray(global.financePixUi._cache) ? global.financePixUi._cache : []).length;

    const prog = global.partnerProgram;
    const partners = (data.partners || []).filter((p) => {
      if (String(p.status || "ATIVO").toUpperCase() === "INATIVO") return false;
      return prog ? prog.isPartnerProgram(p) : p?.perfil?.programa_cliente_parceiro === true;
    });
    const vmap = new Map(vehicles.map((v) => [String(v.id), v]));
    const partnerRows = partners
      .map((p) => {
        const items = recs
          .filter((r) => {
            const veh = r.vehicle_id ? vmap.get(String(r.vehicle_id)) : null;
            const pid = String(p.id);
            return (
              String(veh?.financeira_id || "") === pid ||
              String(veh?.localizador_id || "") === pid ||
              String(r.partner_id || r.parceiro_id || "") === pid
            );
          })
          .map((r) => ({ receivable: r, vehicle: vmap.get(String(r.vehicle_id)), vehicle_id: r.vehicle_id }));
        const cycles = prog ? prog.countCyclesInMonth(items, ym) : items.filter((i) => String(i.receivable?.period_end || "").slice(0, 7) === ym).length;
        const tar = prog ? prog.tariffFor(p, cycles) : { label: "—", diaria: 0, faixa: "—" };
        const close = prog ? prog.closingForMonth(ym) : { fechamento: "—", vencimento: "—" };
        return {
          nome: p.nome || "Parceiro",
          cycles,
          faixa: tar.diaria ? `R$ ${Number(tar.diaria).toFixed(2).replace(".", ",")}` : "—",
          close,
        };
      })
      .sort((a, b) => b.cycles - a.cycles)
      .slice(0, 8);

    const fmt = (n) => (hideMoney ? "—" : moneyFmt(ctx, n));
    return { vnp, vsl, vsc, vrp, inToday, outToday, cChave, sChave, trancado, avgStay, hideMoney, aFaturar, aReceberVal, vencidoVal, recebidoMes, faturadoMes, dueSoon, pixPend, partners, partnerRows, fmt };
  }

  function amplipatioDashboardRender(data, ctx) {
    const root = document.getElementById("hubDashRoot");
    if (!root) return;
    const greetEl = document.getElementById("execOpsGreeting");
    const dateEl = document.getElementById("execOpsDate");
    const rangeEl = document.getElementById("execOpsRange");
    if (greetEl) greetEl.textContent = greetingName(ctx);
    if (dateEl) dateEl.textContent = formatLongDate();
    if (rangeEl) rangeEl.textContent = "visão geral";
    const alertsEl = document.getElementById("hubDashAlerts");
    if (alertsEl) {
      alertsEl.innerHTML = "";
      alertsEl.hidden = true;
    }
    const b = buildHomeBoard(data, ctx);
    const recent = recentPatioMovements(data.vehicles || [], 6);
    const movBody = recent.length
      ? recent
          .map(
            (r) => `<tr>
              <td>${escapeHtml(formatClock(r.at))}</td>
              <td>${escapeHtml(r.tipo)}</td>
              <td>${escapeHtml(r.placa)}</td>
            </tr>`
          )
          .join("")
      : `<tr><td colspan="3">Nenhuma entrada ou saída hoje.</td></tr>`;
    const partnerBody = b.partnerRows.length
      ? b.partnerRows
          .map(
            (r) => `<tr data-hub-nav="parceiros" tabindex="0" class="ag-dash-row">
              <td>${escapeHtml(r.nome)}</td>
              <td>${escapeHtml(String(r.cycles))}</td>
              <td>${escapeHtml(r.faixa)}</td>
              <td>${escapeHtml(r.close.fechamento)}</td>
              <td>${escapeHtml(r.close.vencimento)}</td>
            </tr>`
          )
          .join("")
      : `<tr><td colspan="5" class="notice">Nenhum cliente no Programa Parceiro.</td></tr>`;

    root.innerHTML = `
      <div class="ag-dash">
        <section class="section-card">
          <div class="toolbar" style="margin:0 0 10px;padding:0;border:0">
            <div><h3 class="ag-dash-h">Operação do pátio</h3></div>
            <div class="actions"><button type="button" class="secondary" data-hub-nav="patio:no_patio">Abrir pátio</button></div>
          </div>
          <div class="ag-dash-strip" role="group" aria-label="Indicadores do pátio">
            ${metricChip("patio:no_patio", "Em guarda", b.vnp)}
            ${metricChip("patio:no_patio", "VSL", b.vsl)}
            ${metricChip("patio:no_patio", "VSC", b.vsc)}
            ${metricChip("patio:removidos", "VRP", b.vrp)}
            ${metricChip("patio:no_patio", "Entradas hoje", b.inToday)}
            ${metricChip("patio:removidos", "Saídas hoje", b.outToday)}
          </div>
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>Hora</th><th>Movimento</th><th>Placa</th></tr></thead>
              <tbody>${movBody}</tbody>
            </table>
          </div>
        </section>
        ${
          b.hideMoney
            ? ""
            : `<section class="section-card">
          <div class="toolbar" style="margin:0 0 10px;padding:0;border:0">
            <div><h3 class="ag-dash-h">Financeiro</h3></div>
            <div class="actions"><button type="button" class="secondary" data-hub-nav="financeiro:cobrancas">Abrir financeiro</button></div>
          </div>
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>Indicador</th><th class="num">Valor</th></tr></thead>
              <tbody>
                ${finRow("financeiro:aguardando", "A faturar", b.fmt(b.aFaturar))}
                ${finRow("financeiro:cobrancas", "A receber", b.fmt(b.aReceberVal))}
                ${finRow("financeiro:receber", "Cobranças vencidas", b.fmt(b.vencidoVal))}
                ${finRow("financeiro:caixa", "Recebido no mês", b.fmt(b.recebidoMes))}
              </tbody>
            </table>
          </div>
        </section>`
        }
        <section class="section-card">
          <div class="toolbar" style="margin:0 0 10px;padding:0;border:0">
            <div>
              <h3 class="ag-dash-h">Clientes parceiros</h3>
              <p class="notice" style="margin:4px 0 0">${escapeHtml(String(b.partners.length))} ativo(s) no programa</p>
            </div>
            <div class="actions"><button type="button" class="secondary" data-hub-nav="parceiros">Abrir parceiros</button></div>
          </div>
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>Cliente</th><th>Ciclos no mês</th><th>Faixa</th><th>Fechamento</th><th>Vencimento</th></tr></thead>
              <tbody>${partnerBody}</tbody>
            </table>
          </div>
        </section>
      </div>
    `;
  }

  function filterAlertsForGestor(alerts) {
    return (alerts || []).filter((a) => {
      const nav = String(a.nav || "");
      if (nav.startsWith("financeiro")) return false;
      if (nav.startsWith("parceiros")) return false;
      return nav.startsWith("patio");
    });
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
      const periodBtn = e.target.closest("[data-exec-period]");
      if (periodBtn) {
        _filterPeriod = periodBtn.getAttribute("data-exec-period") || "today";
        const sel = document.getElementById("hubDashFilterPeriod");
        if (sel) sel.value = _filterPeriod;
        syncPeriodChips();
        refresh();
        return;
      }
      const nav = e.target.closest("[data-hub-nav]");
      if (nav) hubNavigate(nav.getAttribute("data-hub-nav"));
    });
  }

  global.amplipatioDashboardRender = amplipatioDashboardRender;
  global.amplipatioDashboardInit = amplipatioDashboardInit;
  global.amplipatioDashboardInvalidateCache = hubInvalidateCache;
})(typeof window !== "undefined" ? window : globalThis);

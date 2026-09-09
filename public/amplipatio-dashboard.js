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
    const rows = [];
    (vehicles || []).forEach((v) => {
      const placa = String(v.placa || "—");
      if (v.data_entrada) rows.push({ at: v.data_entrada, tipo: "Entrada", placa });
      if (v.data_saida) rows.push({ at: v.data_saida, tipo: "Saída", placa });
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
        global.openPatioSubview(sub || "inicio");
        return;
      }
    }
    if (view === "lista" && typeof global.openListaSubview === "function") {
      global.openListaSubview(sub || "vnp");
      return;
    }
    if (view === "financeiro") {
      if (typeof global.openFinanceSubview === "function") {
        global.openFinanceSubview(sub || "dashboard");
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

  function amplipatioDashboardRender(data, ctx) {
    const root = document.getElementById("hubDashRoot");
    if (!root) return;
    syncFiltersFromDom();
    syncPeriodChips();
    const isGestorPista = !!(ctx?.isGestorPista || global.isGestorPista);
    const isAdmDesktopPc = !!(ctx?.isAdmDesktopPc || global.isAdmDesktopPc?.());
    const m = getMetrics(data);
    const vehicles = data.vehicles || [];
    const vistoria = countAguardandoVistoria(vehicles) || m.ops.aguardandoVistoria;
    const faturamento = isGestorPista ? 0 : countAguardandoFaturamento(data);
    const cr = countRegistroPendente(vehicles);
    const attention = [
      { count: vistoria, label: "veículos aguardando vistoria", nav: isAdmDesktopPc ? "patio:no_patio" : "patio:vistoria" },
      { count: faturamento, label: "veículos aguardando faturamento", nav: "patio:aguardando_faturamento" },
      { count: m.ops.comPendencias, label: "veículos com documentação pendente", nav: "patio:no_patio" },
      { count: m.ops.liberadosAguardandoRetirada, label: "veículos aguardando retirada", nav: "patio:vlp" },
      { count: m.ops.aguardandoAutorizacao, label: "veículos aguardando autorização", nav: "patio:vlp" },
      { count: cr, label: "veículos com registro complementar pendente", nav: "patio:no_patio" },
    ];
    const pendenciasTotal = attention.reduce((s, x) => s + Number(x.count || 0), 0);
    const recent = recentPatioMovements(vehicles, 8);
    const greetEl = document.getElementById("execOpsGreeting");
    const dateEl = document.getElementById("execOpsDate");
    const rangeEl = document.getElementById("execOpsRange");
    if (greetEl) greetEl.textContent = greetingName(ctx);
    if (dateEl) dateEl.textContent = formatLongDate();
    if (rangeEl) rangeEl.textContent = m.periodLabel || periodCaption(_filterPeriod);
    const alertsEl = document.getElementById("hubDashAlerts");
    if (alertsEl) {
      alertsEl.innerHTML = "";
      alertsEl.hidden = true;
    }

    const entradaLabel = _filterPeriod === "today" ? "Entradas hoje" : "Entradas";
    const saidaLabel = _filterPeriod === "today" ? "Saídas hoje" : "Saídas";
    const cap = periodCaption(_filterPeriod);

    root.innerHTML = `
      <section class="exec-ops-kpis" aria-label="Indicadores principais">
        <button type="button" class="exec-ops-kpi" data-hub-nav="patio:no_patio">
          <span>Veículos no pátio</span>
          <strong>${escapeHtml(String(m.onPatioCount))}</strong>
          <small>agora na operação</small>
        </button>
        <button type="button" class="exec-ops-kpi" data-hub-nav="patio:no_patio">
          <span>${escapeHtml(entradaLabel)}</span>
          <strong>${escapeHtml(String(m.periodEntradas))}</strong>
          <small>${escapeHtml(cap)}</small>
        </button>
        <button type="button" class="exec-ops-kpi" data-hub-nav="patio:removidos">
          <span>${escapeHtml(saidaLabel)}</span>
          <strong>${escapeHtml(String(m.periodSaidas))}</strong>
          <small>${escapeHtml(cap)}</small>
        </button>
        <button type="button" class="exec-ops-kpi exec-ops-kpi--alert" data-hub-nav="exec:attention">
          <span>Pendências</span>
          <strong>${escapeHtml(String(pendenciasTotal))}</strong>
          <small>itens que pedem ação</small>
        </button>
      </section>
      ${renderAttention(attention)}
      <section class="exec-ops-section">
        <h3>Movimento do pátio</h3>
        <p class="exec-ops-chart-legend"><span class="exec-ops-dot exec-ops-dot--in"></span> Entradas · <span class="exec-ops-dot exec-ops-dot--out"></span> Saídas</p>
        ${barChartSvg(
          m.dailyLabels,
          [
            { name: "Entradas", values: m.dailyEntradas },
            { name: "Saídas", values: m.dailySaidas },
          ],
          ["#161719", "#8a5a32"],
          180
        )}
      </section>
      ${renderSituation(m.ops, m.onPatioCount)}
      <section class="exec-ops-section">
        <div class="exec-ops-mov-head">
          <h3>Últimas movimentações</h3>
          <button type="button" class="exec-ops-link" data-hub-nav="lista:vrp">Ver todas as movimentações →</button>
        </div>
        ${
          recent.length
            ? `<ul class="exec-ops-mov">${recent
                .map(
                  (r) => `<li><time>${escapeHtml(formatClock(r.at))}</time><span>${escapeHtml(r.tipo)}</span><strong>${escapeHtml(r.placa)}</strong></li>`
                )
                .join("")}</ul>`
            : `<p class="exec-ops-empty">Ainda não há entradas ou saídas registradas.</p>`
        }
      </section>
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

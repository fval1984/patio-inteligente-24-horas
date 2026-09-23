/**
 * Interface simples do Financeiro — só apresentação.
 * Lê receivables, payables, cash_movements e vehicles já carregados.
 * Não grava, não apaga e não recalcula valores históricos.
 */
(function financeSimpleUi(global) {
  "use strict";

  function esc(s) {
    return typeof escapeHtml === "function"
      ? escapeHtml(s)
      : String(s ?? "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
  }

  function money(n) {
    if (typeof formatCurrency === "function") return formatCurrency(n);
    return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function todayYmd() {
    if (typeof financeTodayYmd === "function") return financeTodayYmd();
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function addDays(ymd, days) {
    const d = new Date(`${ymd}T12:00:00`);
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function monthYm() {
    return todayYmd().slice(0, 7);
  }

  function ymdFromDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function weekStartYmd(asOf) {
    const d = new Date(`${asOf}T12:00:00`);
    const day = d.getDay();
    const diff = day === 0 ? 6 : day - 1;
    d.setDate(d.getDate() - diff);
    return ymdFromDate(d);
  }

  function monthStartYmd(asOf) {
    return `${String(asOf).slice(0, 7)}-01`;
  }

  function prevMonthRange(asOf) {
    const d = new Date(`${monthStartYmd(asOf)}T12:00:00`);
    d.setDate(0);
    const to = ymdFromDate(d);
    return { from: `${to.slice(0, 7)}-01`, to };
  }

  function opsDashState() {
    if (!global.finOpsDash) global.finOpsDash = { period: "month", customFrom: "", customTo: "" };
    return global.finOpsDash;
  }

  function opsDashRange() {
    const st = opsDashState();
    const today = todayYmd();
    if (st.period === "today") return { from: today, to: today, label: "Hoje" };
    if (st.period === "week") return { from: weekStartYmd(today), to: today, label: "Esta semana" };
    if (st.period === "prev_month") {
      const r = prevMonthRange(today);
      return { from: r.from, to: r.to, label: "Mês anterior" };
    }
    if (st.period === "custom") {
      let from = st.customFrom || monthStartYmd(today);
      let to = st.customTo || today;
      if (from > to) [from, to] = [to, from];
      return { from, to, label: "Período personalizado" };
    }
    return { from: monthStartYmd(today), to: today, label: "Este mês" };
  }

  function cashInRange(from, to) {
    if (typeof financeCaixaMovsForPeriod === "function") {
      return financeCaixaMovsForPeriod("", { useDomFilters: false, de: from, ate: to });
    }
    return [];
  }

  function cashTotals(movs) {
    if (typeof global.financeCaixaTotalsForMovs === "function") return global.financeCaixaTotalsForMovs(movs);
    let entradas = 0;
    let saidas = 0;
    (movs || []).forEach((mov) => {
      const v = typeof global.financeCashMovValor === "function" ? global.financeCashMovValor(mov) : Number(mov?.valor || 0);
      if (typeof global.financeCashIsEntrada === "function" && global.financeCashIsEntrada(mov)) entradas += v;
      else if (typeof global.financeCashIsSaida === "function" && global.financeCashIsSaida(mov)) saidas += v;
    });
    return { entradas, saidas, saldo: entradas - saidas };
  }

  function isEntrada(mov) {
    return typeof global.financeCashIsEntrada === "function" && global.financeCashIsEntrada(mov);
  }

  function isSaida(mov) {
    return typeof global.financeCashIsSaida === "function" && global.financeCashIsSaida(mov);
  }

  function movValor(mov) {
    return typeof global.financeCashMovValor === "function" ? global.financeCashMovValor(mov) : Number(mov?.valor || 0);
  }

  function movYmd(mov) {
    if (typeof global.financeCaixaMovCompetenciaYmd === "function") return global.financeCaixaMovCompetenciaYmd(mov) || "";
    return String(mov?.data_movimento || mov?.created_at || "").slice(0, 10);
  }

  function stripMeta(text) {
    const raw = String(text || "");
    const mark = "[[finmeta:";
    const end = raw.lastIndexOf("]]");
    if (raw.includes(mark) && end >= 0) return raw.slice(end + 2).trim();
    return raw.trim();
  }

  function monthLabel(ym) {
    const names = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const m = Number(String(ym).slice(5, 7));
    return names[m - 1] || ym;
  }

  function monthsEnding(endYm, count) {
    let y = Number(String(endYm).slice(0, 4));
    let m = Number(String(endYm).slice(5, 7));
    const out = [];
    for (let i = 0; i < count; i += 1) {
      out.unshift(`${y}-${String(m).padStart(2, "0")}`);
      m -= 1;
      if (m === 0) {
        m = 12;
        y -= 1;
      }
    }
    return out;
  }

  function lastDay(ym) {
    const y = Number(String(ym).slice(0, 4));
    const m = Number(String(ym).slice(5, 7));
    const d = new Date(y, m, 0);
    return ymdFromDate(d);
  }

  function chartHtml(range) {
    const endYm = String(range.to || todayYmd()).slice(0, 7);
    const months = monthsEnding(endYm, 6);
    const movs = cashInRange(`${months[0]}-01`, lastDay(months[months.length - 1]));
    const buckets = new Map(months.map((ym) => [ym, { in: 0, out: 0 }]));
    movs.forEach((mov) => {
      const ym = movYmd(mov).slice(0, 7);
      const bucket = buckets.get(ym);
      if (!bucket) return;
      const v = movValor(mov);
      if (isEntrada(mov)) bucket.in += v;
      else if (isSaida(mov)) bucket.out += v;
    });
    const max = Math.max(1, ...[...buckets.values()].flatMap((b) => [b.in, b.out]));
    const bars = months
      .map((ym) => {
        const b = buckets.get(ym);
        const hIn = Math.round((b.in / max) * 100);
        const hOut = Math.round((b.out / max) * 100);
        return `<div class="fin-ops-bar">
          <div class="fin-ops-bar-pair">
            <i class="fin-ops-bar-in" style="height:${hIn}%" title="Entradas ${esc(money(b.in))}"></i>
            <i class="fin-ops-bar-out" style="height:${hOut}%" title="Saídas ${esc(money(b.out))}"></i>
          </div>
          <span>${esc(monthLabel(ym))}</span>
        </div>`;
      })
      .join("");
    return `<section class="fin-ops-chart">
      <h3 class="fin-simple-h">Entradas x Saídas</h3>
      <p class="notice">Evolução mensal do que entrou e do que saiu de fato.</p>
      <div class="fin-ops-legend"><span><i class="fin-ops-dot fin-ops-dot--in"></i> Entradas</span><span><i class="fin-ops-dot fin-ops-dot--out"></i> Saídas</span></div>
      <div class="fin-ops-bars">${bars}</div>
    </section>`;
  }

  function card(label, value, hint, goto, extraClass) {
    const go = goto ? ` data-fin-simple-goto="${esc(goto)}"` : "";
    const cls = extraClass ? ` fin-simple-card--${esc(extraClass)}` : "";
    return `<button type="button" class="fin-simple-card${cls}"${go}>
      <span class="fin-card-label">${esc(label)}</span>
      <strong>${esc(value)}</strong>
      ${hint ? `<small>${esc(hint)}</small>` : ""}
    </button>`;
  }

  function attentionItem(tone, title, count, value, goto) {
    return `<button type="button" class="fin-simple-attn fin-simple-attn--${tone}" data-fin-simple-goto="${esc(goto)}">
      <span>${esc(title)}</span>
      <strong>${esc(String(count))} · ${esc(money(value))}</strong>
    </button>`;
  }

  function diariasGeradasNoDia(vehicles, ymd) {
    if (typeof calcDiariaValorGeradoNoDiaLocal !== "function") return 0;
    return (vehicles || []).reduce((s, v) => s + Number(calcDiariaValorGeradoNoDiaLocal(v, ymd) || 0), 0);
  }

  function diariasGeradasNoMes(vehicles, ym) {
    if (typeof sumDiariasGeradasNoMes === "function") return sumDiariasGeradasNoMes(ym, vehicles || []);
    return 0;
  }

  function contasReceberAbertas() {
    if (typeof financeContasReceberList === "function") return financeContasReceberList();
    return [];
  }

  function statusReceber(r) {
    if (typeof financeReceivableDisplayStatus === "function") return financeReceivableDisplayStatus(r);
    return String(r?.status || "");
  }

  function dueReceber(r) {
    if (typeof financeContaDueYmd === "function") return financeContaDueYmd(r, "receivable");
    return String(r?.period_end || "").slice(0, 10);
  }

  function recentPaid(limit) {
    const list =
      typeof financeReceivablePaidList === "function"
        ? financeReceivablePaidList()
        : (global.state?.receivables || []).filter((r) => String(r.status || "").toUpperCase() === "PAGO");
    return [...list]
      .sort((a, b) => String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || "")))
      .slice(0, limit);
  }

  global.financeDashboardRender = function financeRenderSimpleDashboard(_data, ctx) {
    const root = document.getElementById("finDashRoot");
    if (!root) return;
    document.getElementById("finDashFilterBar")?.classList.add("hub-dash-legacy-hidden");
    const bar = document.getElementById("finDashFilterBar");
    if (bar) {
      bar.hidden = true;
      bar.setAttribute("aria-hidden", "true");
    }

    const m = ctx?.metrics || (typeof global.financeMetrics === "function" ? global.financeMetrics() : {});
    const recs = contasReceberAbertas();
    const today = todayYmd();
    const vencidos = recs.filter((r) => statusReceber(r) === "Vencido" || statusReceber(r) === "Atrasado");
    const vencidoVal = vencidos.reduce((s, r) => s + Number(r.valor || 0), 0);
    const st = opsDashState();
    const range = opsDashRange();
    const movs = cashInRange(range.from, range.to);
    const fluxo = cashTotals(movs);
    const fmt = ctx?.formatCurrency || money;
    const aReceberVal = recs.reduce((s, r) => s + Number(r.valor || 0), 0);
    const saldoPeriodo = Number(fluxo.entradas || 0) - Number(fluxo.saidas || 0);
    const periods = [
      ["today", "Hoje"],
      ["month", "Este mês"],
      ["prev_month", "Mês anterior"],
      ["custom", "Personalizado"],
    ];
    const periodBtns = periods
      .map(
        ([id, label]) =>
          `<button type="button" class="fin-act-chip${st.period === id ? " is-active" : ""}" data-fin-ops-period="${id}">${label}</button>`
      )
      .join("");
    const customHidden = st.period === "custom" ? "" : " hidden";
    const recVenceHoje = recs.filter((r) => dueReceber(r) === today);
    const hojeVal = recVenceHoje.reduce((s, r) => s + Number(r.valor || 0), 0);
    const attn = [];
    if (vencidos.length) attn.push(attentionItem("red", "Títulos vencidos", vencidos.length, vencidoVal, "receber:vencidos"));
    if (recVenceHoje.length) attn.push(attentionItem("yellow", "Títulos vencem hoje", recVenceHoje.length, hojeVal, "receber:hoje"));
    if (recs.length) attn.push(attentionItem("blue", "Títulos aguardando recebimento", recs.length, aReceberVal, "receber:todos"));

    const periodBar = `<div class="fin-act-chips fin-ops-period" aria-label="Período">${periodBtns}</div>
        <div class="fin-ops-custom${customHidden}">
          <label>De <input type="date" id="finOpsCustomFrom" value="${esc(st.customFrom || range.from)}" /></label>
          <label>Até <input type="date" id="finOpsCustomTo" value="${esc(st.customTo || range.to)}" /></label>
        </div>`;

    if (st.screen === "recebidos" || st.screen === "saidas" || st.screen === "fluxo") {
      root.innerHTML = `<div class="fin-simple-dash fin-ops-dash">
        <button type="button" class="secondary" data-fin-ops-home>← Visão financeira</button>
        ${periodBar}
        ${movementScreen(st.screen, movs, fluxo, fmt, range)}
      </div>`;
      return;
    }

    root.innerHTML = `
      <div class="fin-simple-dash fin-ops-dash">
        ${periodBar}
        <p class="notice" style="margin:0 0 12px">Recebido, saídas e saldo usam o período ${esc(range.label)}. A receber e em atraso mostram tudo que ainda está em aberto, inclusive dívidas antigas.</p>
        <div class="fin-simple-grid fin-ops-kpis">
          ${card("A receber", fmt(aReceberVal), `${recs.length} título(s) em aberto`, "receber:todos", "recv")}
          ${card("Recebido", fmt(fluxo.entradas), "Entrou no período", "tela:recebidos", "in")}
          ${card("Em atraso", fmt(vencidoVal), `${vencidos.length} título(s) vencido(s)`, "receber:vencidos", "late")}
          ${card("Saídas", fmt(fluxo.saidas), "Saiu no período", "tela:saidas", "out")}
          ${card("Saldo", fmt(saldoPeriodo), "Recebido − saídas", "tela:fluxo", saldoPeriodo < 0 ? "neg" : "saldo")}
        </div>
        ${chartHtml(range)}
        <h3 class="fin-simple-h">O que precisa da minha atenção</h3>
        ${
          attn.length
            ? `<div class="fin-simple-attn-grid">${attn.join("")}</div>`
            : `<p class="notice">Nada urgente no momento.</p>`
        }
      </div>`;
  };

  function movementScreen(screen, movs, fluxo, fmt, range) {
    if (screen === "fluxo") {
      return `<h3 class="fin-simple-h">Fluxo de caixa</h3>
        <p class="notice">${esc(range.label)}: o que entrou e o que saiu de fato.</p>
        <div class="fin-simple-grid fin-ops-kpis">
          ${card("Entradas", fmt(fluxo.entradas), "Total recebido", "tela:recebidos", "in")}
          ${card("Saídas", fmt(fluxo.saidas), "Total pago", "tela:saidas", "out")}
          ${card("Saldo", fmt(fluxo.saldo), "Entradas − saídas", "", Number(fluxo.saldo) < 0 ? "neg" : "saldo")}
        </div>
        ${chartHtml(range)}`;
    }
    const entrada = screen === "recebidos";
    const rows = (movs || []).filter((mov) => (entrada ? isEntrada(mov) : isSaida(mov)));
    rows.sort((a, b) => movYmd(b).localeCompare(movYmd(a)));
    const total = rows.reduce((s, mov) => s + movValor(mov), 0);
    const body = rows.length
      ? rows.map((mov) => movementRow(mov)).join("")
      : `<tr><td colspan="7" class="notice">Nenhuma movimentação neste período.</td></tr>`;
    return `<h3 class="fin-simple-h">${entrada ? "Recebidos" : "Despesas / Saídas"}</h3>
      <p><strong>Total do período:</strong> ${esc(fmt(total))}</p>
      <div class="table-wrap section-card">
        <table class="table">
          <thead><tr><th>Data</th><th>Devedor</th><th>Placa</th><th>RPP/RPV</th><th>Valor</th><th>Forma</th><th>Ações</th></tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>`;
  }

  function movementRow(mov) {
    const rec = (global.state?.receivables || []).find((r) => String(r.id) === String(mov?.conta_id || ""));
    const pay = !rec ? (global.state?.payables || []).find((p) => String(p.id) === String(mov?.conta_id || "")) : null;
    const vehicle = rec?.vehicle_id ? (global.state?.vehicles || []).find((v) => String(v.id) === String(rec.vehicle_id)) : null;
    const ident = rec && typeof global.financeReceivableDevedorIdentity === "function" ? global.financeReceivableDevedorIdentity(rec) : null;
    const devedor = ident?.nome || pay?.fornecedor || stripMeta(mov?.descricao) || "—";
    const placa = vehicle?.placa || "—";
    const rpp = rec && typeof global.financeReceberRppNome === "function" ? global.financeReceberRppNome(rec, vehicle) : "—";
    const rpv = vehicle && typeof global.financeVehicleRpvNome === "function" ? global.financeVehicleRpvNome(vehicle) : "—";
    const data = typeof formatDate === "function" ? formatDate(movYmd(mov)) : movYmd(mov);
    const forma = mov?.forma_pagamento || "—";
    const abrir = rec
      ? `<button type="button" class="secondary" data-fin-open-recebimento="${esc(rec.id)}">Abrir</button>`
      : "";
    const cdr = vehicle
      ? `<button type="button" class="secondary" data-fin-print-cdr="${esc(vehicle.id)}">Imprimir CDR</button>`
      : "";
    return `<tr>
      <td data-label="Data">${esc(data || "—")}</td>
      <td data-label="Devedor">${esc(devedor || "—")}</td>
      <td data-label="Placa">${esc(placa)}</td>
      <td data-label="RPP/RPV">${esc([rpp, rpv].filter((x) => x && x !== "—").join(" · ") || "—")}</td>
      <td data-label="Valor">${esc(money(movValor(mov)))}</td>
      <td data-label="Forma">${esc(forma)}</td>
      <td data-label="Ações">${abrir} ${cdr}</td>
    </tr>`;
  }

  function accountNameForMov(mov) {
    if (typeof financeMovContaLabel === "function") return financeMovContaLabel(mov) || "Caixa";
    return (global.state?.settings && global.state.settings.conta_bancaria) || "Caixa";
  }

  global.financeRenderContas = function financeRenderContas() {
    const body = document.getElementById("finContasBody");
    const extract = document.getElementById("finContasExtractBody");
    const title = document.getElementById("finContasExtractTitle");
    if (!body) return;
    const movs =
      typeof financeCaixaMovsMerged === "function" ? financeCaixaMovsMerged() : global.state?.cash || [];
    const byName = new Map();
    const def = (global.state?.settings && global.state.settings.conta_bancaria) || "Caixa";
    if (!byName.has(def)) byName.set(def, { entradas: 0, saidas: 0, n: 0 });
    movs.forEach((mov) => {
      const name = accountNameForMov(mov) || def;
      const rec = byName.get(name) || { entradas: 0, saidas: 0, n: 0 };
      const val = typeof financeCashMovValor === "function" ? financeCashMovValor(mov) : Number(mov.valor || 0);
      const entrada = typeof financeCashIsEntrada === "function" ? financeCashIsEntrada(mov) : String(mov.tipo_conta || "").toUpperCase() === "RECEBER";
      if (entrada) rec.entradas += val;
      else rec.saidas += val;
      rec.n += 1;
      byName.set(name, rec);
    });
    const selected = document.getElementById("finContasRoot")?.dataset.account || "";
    body.innerHTML = [...byName.entries()]
      .map(([nome, rec]) => {
        const saldo = rec.entradas - rec.saidas;
        const active = selected === nome ? " fin-row-selected" : "";
        return `<tr class="${active.trim()}" data-fin-conta-nome="${esc(nome)}">
          <td data-label="Conta"><button type="button" class="secondary" data-fin-open-conta="${esc(nome)}">${esc(nome)}</button></td>
          <td data-label="Entradas">${esc(money(rec.entradas))}</td>
          <td data-label="Saídas">${esc(money(rec.saidas))}</td>
          <td data-label="Saldo atual"><strong>${esc(money(saldo))}</strong></td>
          <td data-label="Movimentos">${rec.n}</td>
        </tr>`;
      })
      .join("");

    const focus = selected || [...byName.keys()][0] || def;
    if (title) title.textContent = `Extrato — ${focus}`;
    const extractMovs = [...movs]
      .filter((m) => accountNameForMov(m) === focus)
      .sort((a, b) =>
        String(a.data_movimento || a.created_at || "").localeCompare(String(b.data_movimento || b.created_at || ""))
      );
    let running = 0;
    if (extract) {
      if (!extractMovs.length) {
        extract.innerHTML = `<tr><td colspan="5" class="notice">Nenhuma movimentação nesta conta. O histórico existente permanece no módulo Movimentações.</td></tr>`;
        return;
      }
      extract.innerHTML = extractMovs
        .map((mov) => {
          const entrada = typeof financeCashIsEntrada === "function" ? financeCashIsEntrada(mov) : false;
          const val = typeof financeCashMovValor === "function" ? financeCashMovValor(mov) : Number(mov.valor || 0);
          running += entrada ? val : -val;
          const data =
            typeof formatDate === "function"
              ? formatDate(mov.data_movimento || mov.created_at)
              : String(mov.data_movimento || "").slice(0, 10);
          const desc =
            typeof financeStripFinmeta === "function"
              ? financeStripFinmeta(mov.descricao || "")
              : String(mov.descricao || "—");
          return `<tr>
            <td data-label="Data">${esc(data || "—")}</td>
            <td data-label="Descrição">${esc(desc || "—")}</td>
            <td data-label="Entrada">${entrada ? esc(money(val)) : "—"}</td>
            <td data-label="Saída">${entrada ? "—" : esc(money(val))}</td>
            <td data-label="Saldo após">${esc(money(running))}</td>
          </tr>`;
        })
        .join("");
    }
  };

  global.financeSimpleGoto = function financeSimpleGoto(spec) {
    const [view, quick] = String(spec || "").split(":");
    const range = opsDashRange();
    if (view === "em_patio" || view === "diarias") {
      if (typeof setFinanceView === "function") setFinanceView("em_patio");
      return;
    }
    if (view === "contas") {
      if (typeof setFinanceView === "function") setFinanceView("caixa");
      return;
    }
    if (view === "relatorios") {
      if (typeof setFinanceView === "function") setFinanceView("dashboard");
      return;
    }
    if (view === "caixa") {
      if (typeof setFinanceView === "function") setFinanceView("caixa");
      if (typeof window.financeApplyCaixaOpsFilter === "function") {
        window.financeApplyCaixaOpsFilter({
          tipo: quick === "entrada" || quick === "saida" ? quick : "",
          de: range.from,
          ate: range.to,
        });
      }
      return;
    }
    if (view === "receber") {
      ["finReceberPlaca", "finReceberValorDe", "finReceberValorAte"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = "";
      });
      const rpp = document.getElementById("finReceberRpp");
      if (rpp) rpp.value = "";
      if (typeof global.financePrepareReceberQuick === "function") global.financePrepareReceberQuick(quick || "todos");
      if (typeof setFinanceView === "function") setFinanceView("receber");
      return;
    }
    if (view === "tela") {
      opsDashState().screen = quick || "home";
      if (typeof setFinanceView === "function") setFinanceView("dashboard");
      else if (typeof financeRenderDashboard === "function") financeRenderDashboard();
      return;
    }
    if (view === "pagar") {
      if (typeof setFinanceView === "function") setFinanceView("pagar");
      setTimeout(() => {
        const chip = document.querySelector(`#finPagarQuickFilters [data-fin-act-chip="${quick || "todos"}"]`);
        chip?.click();
      }, 0);
    }
  };

  function renderFinanceSearch(raw) {
    const host = document.getElementById("finSearchResults");
    if (!host) return;
    const q = String(raw || "").trim().toLowerCase();
    if (q.length < 2) {
      host.classList.add("hidden");
      host.innerHTML = "";
      return;
    }
    const vehicles = global.state?.vehicles || [];
    const vmap = new Map(vehicles.map((v) => [String(v.id), v]));
    const hits = [];
    (global.state?.receivables || []).forEach((r) => {
      const v = vmap.get(String(r.vehicle_id || ""));
      const ident = typeof global.financeReceivableDevedorIdentity === "function" ? global.financeReceivableDevedorIdentity(r) : null;
      const rpp = typeof global.financeReceberRppNome === "function" ? global.financeReceberRppNome(r, v) : "";
      const rpv = typeof global.financeVehicleRpvNome === "function" ? global.financeVehicleRpvNome(v) : "";
      const blob = [v?.placa, v?.marca, v?.modelo, ident?.nome, rpp, rpv, r.id, r.descricao, stripMeta(r.observacoes)]
        .join(" ")
        .toLowerCase();
      if (!blob.includes(q)) return;
      const aberto = String(r.status || "").toUpperCase() !== "PAGO";
      hits.push({
        id: r.id,
        title: v?.placa || ident?.nome || "Título",
        sub: `${ident?.nome || "—"} · ${aberto ? "Em aberto" : "Recebido"} · ${money(r.valor)}`,
      });
    });
    if (!hits.length) {
      host.classList.remove("hidden");
      host.innerHTML = `<p class="notice">Nenhum registro encontrado.</p>`;
      return;
    }
    host.classList.remove("hidden");
    host.innerHTML = hits
      .slice(0, 12)
      .map(
        (hit) => `<button type="button" class="fin-search-hit" data-fin-search-hit="${esc(hit.id)}">
          <strong>${esc(hit.title)}</strong>
          <span>${esc(hit.sub)}</span>
        </button>`
      )
      .join("");
  }

  function openSearchHit(id) {
    const input = document.getElementById("finGlobalSearch");
    if (input) input.value = "";
    renderFinanceSearch("");
    const rec = (global.state?.receivables || []).find((r) => String(r.id) === String(id));
    if (!rec) return;
    if (typeof setFinanceView === "function") setFinanceView("receber");
    if (typeof global.financeOpenReceberRegistro === "function") global.financeOpenReceberRegistro(rec.id);
  }

  function openNovoLancamentoModal() {
    document.getElementById("finNovoLancamentoModal")?.classList.remove("hidden");
  }
  function closeNovoLancamentoModal() {
    document.getElementById("finNovoLancamentoModal")?.classList.add("hidden");
  }
  global.financeOpenNovoLancamento = openNovoLancamentoModal;

  function bindOnce() {
    if (bindOnce._done) return;
    bindOnce._done = true;
    document.getElementById("viewFinanceiro")?.addEventListener("click", (e) => {
      const home = e.target.closest("[data-fin-ops-home]");
      if (home) {
        e.preventDefault();
        opsDashState().screen = "home";
        if (typeof financeRenderDashboard === "function") financeRenderDashboard();
        return;
      }
      const openRec = e.target.closest("[data-fin-open-recebimento]");
      if (openRec) {
        e.preventDefault();
        const id = openRec.getAttribute("data-fin-open-recebimento");
        if (typeof setFinanceView === "function") setFinanceView("receber");
        if (typeof global.financeOpenReceberRegistro === "function") global.financeOpenReceberRegistro(id);
        return;
      }
      const cdr = e.target.closest("[data-fin-print-cdr]");
      if (cdr) {
        e.preventDefault();
        const vehicle = (global.state?.vehicles || []).find((v) => String(v.id) === String(cdr.getAttribute("data-fin-print-cdr")));
        if (vehicle && typeof global.openNfseThermalModal === "function") global.openNfseThermalModal(vehicle);
        return;
      }
      const searchHit = e.target.closest("[data-fin-search-hit]");
      if (searchHit) {
        e.preventDefault();
        openSearchHit(searchHit.getAttribute("data-fin-search-hit"));
        return;
      }
      const periodBtn = e.target.closest("[data-fin-ops-period]");
      if (periodBtn) {
        e.preventDefault();
        const st = opsDashState();
        st.period = periodBtn.getAttribute("data-fin-ops-period") || "month";
        if (typeof financeRenderDashboard === "function") financeRenderDashboard();
        return;
      }
      const goto = e.target.closest("[data-fin-simple-goto]");
      if (goto) {
        e.preventDefault();
        global.financeSimpleGoto(goto.getAttribute("data-fin-simple-goto"));
        return;
      }
      const conta = e.target.closest("[data-fin-open-conta]");
      if (conta) {
        const root = document.getElementById("finContasRoot");
        if (root) root.dataset.account = conta.getAttribute("data-fin-open-conta") || "";
        global.financeRenderContas();
        return;
      }
    });
    document.getElementById("viewFinanceiro")?.addEventListener("change", (e) => {
      if (e.target?.id === "finOpsCustomFrom" || e.target?.id === "finOpsCustomTo") {
        const st = opsDashState();
        st.period = "custom";
        st.customFrom = document.getElementById("finOpsCustomFrom")?.value || "";
        st.customTo = document.getElementById("finOpsCustomTo")?.value || "";
        if (typeof financeRenderDashboard === "function") financeRenderDashboard();
      }
    });
    document.getElementById("finSubnav")?.addEventListener("click", (e) => {
      if (e.target.closest("[data-finance-subview-btn='dashboard']")) opsDashState().screen = "home";
    });
    document.getElementById("finGlobalSearch")?.addEventListener("input", () => {
      renderFinanceSearch(document.getElementById("finGlobalSearch")?.value || "");
    });
    document.getElementById("finBtnNovoLancamento")?.addEventListener("click", openNovoLancamentoModal);
    document.getElementById("finNovoLancamentoClose")?.addEventListener("click", closeNovoLancamentoModal);
    document.getElementById("finNovoLancamentoCancel")?.addEventListener("click", closeNovoLancamentoModal);
    document.getElementById("finNovoLancamentoModal")?.addEventListener("click", (e) => {
      if (e.target.id === "finNovoLancamentoModal") closeNovoLancamentoModal();
    });
    document.getElementById("finNovoLancReceita")?.addEventListener("click", () => {
      closeNovoLancamentoModal();
      if (typeof financeOpenReceitaModal === "function") financeOpenReceitaModal(false);
    });
    document.getElementById("finNovoLancDespesa")?.addEventListener("click", () => {
      closeNovoLancamentoModal();
      if (typeof financeOpenDespesaModal === "function") financeOpenDespesaModal();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindOnce);
  } else {
    bindOnce();
  }
})(typeof window !== "undefined" ? window : globalThis);

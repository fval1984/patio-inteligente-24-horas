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
    if (typeof financeCaixaTotalsForMovs === "function") return financeCaixaTotalsForMovs(movs);
    return { entradas: 0, saidas: 0, saldo: 0 };
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

    const m = ctx?.metrics || (typeof financeMetrics === "function" ? financeMetrics() : {});
    const recs = contasReceberAbertas();
    const today = todayYmd();
    const vencidos = recs.filter((r) => statusReceber(r) === "Vencido" || statusReceber(r) === "Atrasado");
    const vencidoVal = vencidos.reduce((s, r) => s + Number(r.valor || 0), 0);
    const pagarAlerts =
      typeof financePayableAlerts === "function" ? financePayableAlerts() : { vencidas: 0, venceHoje: 0, totalVencidas: 0 };
    const paidOpen = (global.state?.receivables || []).filter((r) => {
      if (String(r.status || "").toUpperCase() !== "PAGO") return false;
      if (typeof window.receivableCashMovementExists === "function") {
        return !window.receivableCashMovementExists(r.id);
      }
      return false;
    });
    const st = opsDashState();
    const range = opsDashRange();
    const fluxo = cashTotals(cashInRange(range.from, range.to));
    const fmt = ctx?.formatCurrency || money;
    const aReceberVal = Number(m.totalReceber || 0);
    const aPagarVal = Number(m.totalPagar || 0);
    const saldoPeriodo = Number(fluxo.entradas || 0) - Number(fluxo.saidas || 0);
    const periods = [
      ["today", "Hoje"],
      ["week", "Esta semana"],
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
    const attn = [];
    if (vencidos.length) {
      attn.push(attentionItem("red", "Títulos vencidos", vencidos.length, vencidoVal, "receber:vencidos"));
    }
    if (pagarAlerts.vencidas) {
      attn.push(attentionItem("red", "Contas a pagar vencidas", pagarAlerts.vencidas, pagarAlerts.totalVencidas || 0, "pagar:vencidos"));
    }
    if (pagarAlerts.venceHoje) {
      attn.push(attentionItem("yellow", "Contas vencendo hoje", pagarAlerts.venceHoje, 0, "pagar:hoje"));
    }
    const recVenceHoje = recs.filter((r) => dueReceber(r) === today && statusReceber(r) !== "Recebido");
    if (recVenceHoje.length) {
      attn.push(
        attentionItem(
          "yellow",
          "A receber vencendo hoje",
          recVenceHoje.length,
          recVenceHoje.reduce((s, r) => s + Number(r.valor || 0), 0),
          "receber:hoje"
        )
      );
    }
    if (paidOpen.length) {
      attn.push(
        attentionItem(
          "blue",
          "Recebimentos aguardando entrada",
          paidOpen.length,
          paidOpen.reduce((s, r) => s + Number(r.valor || 0), 0),
          "receber:recebidos"
        )
      );
    }

    root.innerHTML = `
      <div class="fin-simple-dash fin-ops-dash">
        <div class="fin-act-chips fin-ops-period" aria-label="Período">${periodBtns}</div>
        <div class="fin-ops-custom${customHidden}">
          <label>De <input type="date" id="finOpsCustomFrom" value="${esc(st.customFrom || range.from)}" /></label>
          <label>Até <input type="date" id="finOpsCustomTo" value="${esc(st.customTo || range.to)}" /></label>
        </div>
        <p class="notice" style="margin:0 0 12px">Período dos valores recebidos e pagos: ${esc(range.label)} (${esc(range.from)} a ${esc(range.to)}). A receber e a pagar são o que está em aberto agora.</p>
        <div class="fin-simple-grid fin-ops-kpis">
          ${card("A receber", fmt(aReceberVal), `${m.pendentes || 0} título(s) em aberto`, "receber:todos", "recv")}
          ${card("Recebido", fmt(fluxo.entradas), "Já entrou no período", "caixa:entrada", "in")}
          ${card("A pagar", fmt(aPagarVal), `${m.vencidas || 0} vencida(s)`, "pagar:todos", "pay")}
          ${card("Pago", fmt(fluxo.saidas), "Já saiu no período", "caixa:saida", "out")}
          ${card("Saldo", fmt(saldoPeriodo), `${fmt(fluxo.entradas)} − ${fmt(fluxo.saidas)}`, "caixa:todos", saldoPeriodo < 0 ? "neg" : "saldo")}
        </div>
        <div class="fin-simple-grid fin-ops-kpis-mini">
          ${card("Entrou", fmt(fluxo.entradas), "Entradas do período", "caixa:entrada")}
          ${card("Saiu", fmt(fluxo.saidas), "Saídas do período", "caixa:saida")}
        </div>
        <h3 class="fin-simple-h">Precisa de atenção</h3>
        ${
          attn.length
            ? `<div class="fin-simple-attn-grid">${attn.join("")}</div>`
            : `<p class="notice">Nada urgente no momento.</p>`
        }
      </div>`;
  };

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
      if (typeof setFinanceView === "function") setFinanceView("receber");
      setTimeout(() => {
        const chip = document.querySelector(`#finReceberQuickFilters [data-fin-act-chip="${quick || "todos"}"]`);
        chip?.click();
      }, 0);
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

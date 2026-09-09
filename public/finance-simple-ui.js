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

  function card(label, value, hint, goto) {
    const go = goto ? ` data-fin-simple-goto="${esc(goto)}"` : "";
    return `<button type="button" class="fin-simple-card"${go}>
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
    const limit7 = addDays(today, 7);
    const vencidos = recs.filter((r) => statusReceber(r) === "Vencido" || statusReceber(r) === "Atrasado");
    const vencendo = recs.filter((r) => {
      const st = statusReceber(r);
      const due = dueReceber(r);
      if (st === "Recebido" || st === "Vencido" || st === "Atrasado" || !due) return false;
      return due > today && due <= limit7;
    });
    const aReceber = recs.filter((r) => {
      const st = statusReceber(r);
      return st !== "Recebido";
    });
    const recent = recentPaid(5);
    const vehicles = global.state?.vehicles || [];
    const hoje = diariasGeradasNoDia(vehicles, today);
    const mes = diariasGeradasNoMes(vehicles, monthYm());
    const faturado = recs.concat(
      typeof financeReceivablePaidList === "function" ? financeReceivablePaidList() : []
    );
    const faturadoMes = faturado
      .filter((r) => String(r.period_end || r.created_at || "").slice(0, 7) === monthYm())
      .reduce((s, r) => s + Number(r.valor || 0), 0);
    const recebidoMes = Number(m.recebidoMes || 0);
    const aReceberVal = Number(m.totalReceber || 0);
    const vencidoVal = vencidos.reduce((s, r) => s + Number(r.valor || 0), 0);
    const resultado = Number(m.recebidoMes || 0) - Number(m.despesasMes || 0);
    const fmt = ctx?.formatCurrency || money;

    const recentHtml = recent.length
      ? recent
          .map((r) => {
            const v = (vehicles || []).find((x) => String(x.id) === String(r.vehicle_id));
            const placa = v?.placa || "Recebimento";
            return `<li><button type="button" data-fin-simple-goto="receber:recebidos">${esc(placa)} · ${esc(
              fmt(Number(r.valor || 0))
            )}</button></li>`;
          })
          .join("")
      : "<li class='notice'>Nenhum recebimento recente.</li>";

    root.innerHTML = `
      <div class="fin-simple-dash">
        <div class="fin-simple-grid">
          ${card("Saldo atual", fmt(m.saldo || 0), "Contas e caixa", "contas")}
          ${card("Recebido no mês", fmt(m.recebidoMes || 0), "Já entrou", "receber:recebidos")}
          ${card("A receber", fmt(m.totalReceber || 0), `${m.pendentes || 0} em aberto`, "receber:todos")}
          ${card("Vencido", fmt(vencidoVal), `${vencidos.length} título(s)`, "receber:vencidos")}
          ${card("A pagar", fmt(m.totalPagar || 0), `${m.vencidas || 0} despesa(s) vencida(s)`, "pagar:todos")}
          ${card("Despesas do mês", fmt(m.despesasMes || 0), "Já saiu", "pagar:pagos")}
          ${card("Resultado", fmt(resultado), "Recebido − despesas do mês", "relatorios")}
        </div>

        <h3 class="fin-simple-h">Diárias</h3>
        <p class="notice" style="margin:0 0 10px">Receita do pátio: quantidade de diárias × valor da diária do veículo. Sem lançamento paralelo.</p>
        <div class="fin-simple-grid">
          ${card("Diárias geradas hoje", fmt(hoje), "Permanência no dia", "em_patio")}
          ${card("Diárias geradas no mês", fmt(mes), monthYm(), "em_patio")}
          ${card("Valor faturado no mês", fmt(faturadoMes), "Títulos do ciclo", "receber:todos")}
          ${card("Valor recebido", fmt(recebidoMes), "Mês atual", "receber:recebidos")}
          ${card("Valor a receber", fmt(aReceberVal), "Ainda em aberto", "receber:todos")}
          ${card("Valor vencido", fmt(vencidoVal), "Em atraso", "receber:vencidos")}
          ${card("Veículos gerando diárias", String(m.veiculosPatio || 0), "No pátio agora", "em_patio")}
        </div>

        <h3 class="fin-simple-h">Precisa da sua atenção</h3>
        <div class="fin-simple-attn-grid">
          ${attentionItem("red", "Vencidos", vencidos.length, vencidoVal, "receber:vencidos")}
          ${attentionItem("yellow", "Vencendo", vencendo.length, vencendo.reduce((s, r) => s + Number(r.valor || 0), 0), "receber:a_vencer")}
          ${attentionItem("blue", "A receber", aReceber.length, aReceberVal, "receber:todos")}
          ${attentionItem("green", "Recebimentos recentes", recent.length, recent.reduce((s, r) => s + Number(r.valor || 0), 0), "receber:recebidos")}
        </div>
        <ul class="fin-simple-recent">${recentHtml}</ul>
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
    if (view === "em_patio" || view === "diarias") {
      if (typeof setFinanceView === "function") setFinanceView("em_patio");
      return;
    }
    if (view === "contas") {
      if (typeof setFinanceView === "function") setFinanceView("contas");
      return;
    }
    if (view === "relatorios") {
      if (typeof setFinanceView === "function") setFinanceView("relatorios");
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

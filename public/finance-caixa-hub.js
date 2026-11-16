/**
 * Caixa único do financeiro: indicadores, filtros e busca.
 * As listas continuam nos módulos já existentes (a faturar, cobranças e movimentos).
 */
(function financeCaixaHubModule(global) {
  "use strict";

  let filtro = "a_faturar";
  let busca = { placa: "", cliente: "", de: "", ate: "", fatura: "" };
  let indicadores = { aFaturar: 0, faturados: 0, recebidosMes: 0, emAberto: 0 };

  function root() {
    return document.getElementById("finCaixaHub");
  }

  function esc(v) {
    return String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function money(v) {
    if (typeof global.formatCurrency === "function") return global.formatCurrency(v);
    return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function state() {
    return global.__ampliState || global.state || {};
  }

  function todayYmd() {
    if (typeof global.financeTodayYmd === "function") return global.financeTodayYmd();
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function monthStart() {
    return todayYmd().slice(0, 7) + "-01";
  }

  function ymd(v) {
    if (typeof global.toLocalYmd === "function") return global.toLocalYmd(v);
    return String(v || "").slice(0, 10);
  }

  async function calcular() {
    const svc = global.cobrancaService;
    const aFaturar = svc ? svc.billableLines().reduce((s, l) => s + svc.saldoAposAbatimento(l.valor, l.abatimento), 0) : 0;
    let faturados = 0;
    const uid = typeof global.effectiveUserId === "function" ? global.effectiveUserId() : null;
    const supabase = global.supabaseClient || global.supabase;
    if (svc && uid && supabase) {
      try {
        const loaded = await svc.loadCharges(uid, supabase);
        for (const row of loaded.rows || []) {
          const st = String(row.status || "").toUpperCase();
          if (st !== "PENDENTE" && st !== "PARCIAL") continue;
          const snap = svc.paymentSnapshot(row.valor_total, row.valor_recebido || 0);
          faturados += snap.saldo;
        }
      } catch (_e) {
        faturados = 0;
      }
    }
    let recebidosMes = 0;
    const ini = monthStart();
    const fim = todayYmd();
    for (const m of state().cash || []) {
      const t = String(m.tipo_conta || "").toUpperCase();
      if (t !== "RECEBER" && t !== "ENTRADA") continue;
      const dia = ymd(m.data_movimento || m.created_at);
      if (dia && dia >= ini && dia <= fim) recebidosMes += Number(m.valor || 0);
    }
    indicadores = {
      aFaturar,
      faturados,
      recebidosMes,
      emAberto: aFaturar + faturados,
    };
  }

  function render() {
    const el = root();
    if (!el) return;
    const chips = [
      ["a_faturar", "A faturar"],
      ["faturados", "Faturados"],
      ["pagos", "Pagos"],
    ]
      .map(
        ([id, label]) =>
          `<button type="button" class="cob-chip${filtro === id ? " is-on" : ""}" data-caixa-filtro="${id}">${label}</button>`
      )
      .join("");
    el.innerHTML = `
      <div class="cob-kpis">
        <div class="cob-kpi"><span>A faturar</span><strong>${esc(money(indicadores.aFaturar))}</strong></div>
        <div class="cob-kpi"><span>Faturados a receber</span><strong>${esc(money(indicadores.faturados))}</strong></div>
        <div class="cob-kpi"><span>Recebidos no mês</span><strong>${esc(money(indicadores.recebidosMes))}</strong></div>
        <div class="cob-kpi"><span>Total em aberto</span><strong>${esc(money(indicadores.emAberto))}</strong></div>
      </div>
      <div class="cob-filters" role="tablist">${chips}</div>
      <div class="cob-form">
        <label>Placa<input id="caixaBuscaPlaca" type="search" value="${esc(busca.placa)}" placeholder="ABC1D23" autocapitalize="characters" /></label>
        <label>Cliente<input id="caixaBuscaCliente" type="search" value="${esc(busca.cliente)}" placeholder="Nome do cliente" /></label>
        <label>Fatura<input id="caixaBuscaFatura" type="search" value="${esc(busca.fatura)}" placeholder="FAT-000010" /></label>
        <label>De<input id="caixaBuscaDe" type="date" value="${esc(busca.de)}" /></label>
        <label>Até<input id="caixaBuscaAte" type="date" value="${esc(busca.ate)}" /></label>
      </div>
      <div class="cob-actions-row">
        <button type="button" class="cob-btn" data-caixa-buscar="1">Buscar</button>
        <button type="button" class="cob-btn secondary" data-caixa-pix="1">Conferir PIX</button>
        <button type="button" class="cob-btn secondary" data-caixa-quitadas="1">Faturas quitadas</button>
      </div>
      <p class="cob-sub">Fatura emitida não é pagamento. O valor só entra em Pagos depois do recebimento confirmado.</p>`;
  }

  function lerBusca() {
    busca = {
      placa: document.getElementById("caixaBuscaPlaca")?.value || "",
      cliente: document.getElementById("caixaBuscaCliente")?.value || "",
      fatura: document.getElementById("caixaBuscaFatura")?.value || "",
      de: document.getElementById("caixaBuscaDe")?.value || "",
      ate: document.getElementById("caixaBuscaAte")?.value || "",
    };
  }

  function aplicarBusca() {
    lerBusca();
    const texto = [busca.placa, busca.cliente, busca.fatura].filter(Boolean).join(" ");
    if (filtro === "a_faturar") {
      const placa = document.getElementById("patioAguardandoPlaca");
      if (placa) placa.value = busca.placa;
      document.getElementById("patioAguardandoPlacaForm")?.requestSubmit?.();
      const parceiro = document.getElementById("patioAguardandoParceiro");
      if (parceiro && busca.cliente) {
        const alvo = busca.cliente.trim().toLowerCase();
        const opt = [...parceiro.options].find((o) => o.textContent.toLowerCase().includes(alvo));
        if (opt) {
          parceiro.value = opt.value;
          parceiro.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    } else if (filtro === "faturados" || filtro === "quitadas") {
      global.cobrancaUi?.setChargeSearch?.(texto);
    } else if (filtro === "pagos") {
      const campo = document.getElementById("finCaixaBusca");
      if (campo) {
        campo.value = texto;
        campo.dispatchEvent(new Event("input", { bubbles: true }));
      }
      const de = document.getElementById("finCaixaDataDe");
      const ate = document.getElementById("finCaixaDataAte");
      if (de && busca.de) de.value = busca.de;
      if (ate && busca.ate) ate.value = busca.ate;
      if (busca.de || busca.ate) document.getElementById("finCaixaFilterApply")?.click();
    }
  }

  function abrir(next) {
    filtro = next;
    if (next === "a_faturar" && typeof global.openFinanceSubview === "function") {
      global.openFinanceSubview("aguardando", { skipRefresh: true });
    } else if (next === "faturados") {
      global.cobrancaUi?.showCharges?.("pendentes");
      if (typeof global.openFinanceSubview === "function") global.openFinanceSubview("cobrancas", { skipRefresh: true });
    } else if (next === "quitadas") {
      filtro = "pagos";
      global.cobrancaUi?.showCharges?.("recebidos");
      if (typeof global.openFinanceSubview === "function") global.openFinanceSubview("cobrancas", { skipRefresh: true });
    } else if (next === "pix") {
      if (typeof global.openFinanceSubview === "function") global.openFinanceSubview("pix", { skipRefresh: true });
    } else if (typeof global.openFinanceSubview === "function") {
      global.openFinanceSubview("caixa", { skipRefresh: true });
    }
    render();
    aplicarBusca();
  }

  function syncFromView(view) {
    if (document.getElementById("caixaBuscaPlaca")) lerBusca();
    if (view === "aguardando") filtro = "a_faturar";
    else if (view === "cobrancas") filtro = filtro === "pagos" ? "pagos" : "faturados";
    else if (view === "caixa") filtro = "pagos";
    render();
  }

  async function refresh() {
    await calcular();
    render();
  }

  function bind() {
    const el = root();
    if (!el || el.dataset.bound === "1") return;
    el.dataset.bound = "1";
    el.addEventListener("click", (e) => {
      const chip = e.target.closest("[data-caixa-filtro]");
      if (chip) {
        abrir(chip.getAttribute("data-caixa-filtro"));
        return;
      }
      if (e.target.closest("[data-caixa-buscar]")) {
        aplicarBusca();
        return;
      }
      if (e.target.closest("[data-caixa-pix]")) {
        abrir("pix");
        return;
      }
      if (e.target.closest("[data-caixa-quitadas]")) {
        abrir("quitadas");
      }
    });
    const prev = global.setFinanceView;
    if (typeof prev === "function" && !prev._caixaHub) {
      const wrapped = function caixaHubSetFinanceView(view) {
        const out = prev(view);
        syncFromView(view);
        return out;
      };
      wrapped._caixaHub = true;
      global.setFinanceView = wrapped;
    }
  }

  function mount() {
    bind();
    refresh();
  }

  global.financeCaixaHub = { mount, refresh, abrir, syncFromView };
})(typeof window !== "undefined" ? window : globalThis);

/**
 * Caixa operacional — lista única de faturar, receber e recibos.
 * Não reabre as telas antigas de aguardando, cobrança ou histórico.
 */
(function caixaOperacionalModule(global) {
  "use strict";

  const TELAS = new Set(["aguardando", "cobrancas", "caixa", "receber", "em_patio", "dashboard"]);
  let ativo = false;
  let filtro = "a_faturar";
  let q = "";
  let de = "";
  let ate = "";
  let selected = new Set();
  let collapsed = new Set();
  let charges = [];
  let pagosReceivableIds = new Set();
  let built = false;

  function svc() {
    return global.cobrancaService;
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

  function round(n) {
    const v = Number(n || 0);
    if (!Number.isFinite(v)) return 0;
    return Math.round(v * 100) / 100;
  }

  function ymd(v) {
    if (typeof global.toLocalYmd === "function") return global.toLocalYmd(v);
    return String(v || "").slice(0, 10);
  }

  function today() {
    if (typeof global.financeTodayYmd === "function") return global.financeTodayYmd();
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function uid() {
    if (typeof global.effectiveUserId === "function") return global.effectiveUserId();
    return null;
  }

  function supabase() {
    return global.supabaseClient || global.supabase;
  }

  function alocarPagamento(itens, valor) {
    let resto = round(valor);
    return (itens || []).map((item) => {
      const saldo = round(item.saldo);
      if (resto <= 0 || saldo <= 0) return { id: item.id, aplicar: 0 };
      const aplicar = round(Math.min(saldo, resto));
      resto = round(resto - aplicar);
      return { id: item.id, aplicar };
    });
  }

  function noPeriodo(data) {
    const dia = ymd(data);
    if (!de && !ate) return true;
    if (!dia) return false;
    if (de && dia < de) return false;
    if (ate && dia > ate) return false;
    return true;
  }

  function clienteDaLinha(line) {
    const catalog = svc()?.clientCatalog?.() || [];
    const link = (line.links || []).find((l) => l.kind === "partner" || l.kind === "advocacy_office");
    if (!link) return { key: "sem", nome: "Sem cliente definido" };
    const found = catalog.find((c) => c.kind === link.kind && c.id === String(link.id));
    return { key: `${link.kind}:${link.id}`, nome: found?.nome || "Cliente", kind: link.kind, id: String(link.id) };
  }

  function saldoLinha(line) {
    return svc().saldoAposAbatimento(line.valor, line.abatimento);
  }

  function statusRecebivel(r) {
    if (typeof global.receivableFinanceStatus === "function") return String(global.receivableFinanceStatus(r) || "").toUpperCase();
    return String(r?.status || "").trim().toUpperCase();
  }

  function ehPago(r) {
    return ["PAGO", "RECEBIDO", "BAIXADO", "QUITADO"].includes(statusRecebivel(r));
  }

  function ehContaReceber(r) {
    if (!r || ehPago(r)) return false;
    if (typeof global.receivableIsContaReceberFinanceiro === "function") return !!global.receivableIsContaReceberFinanceiro(r);
    return false;
  }

  function recebivelPorId(id) {
    return (global.state?.receivables || []).find((r) => String(r.id) === String(id)) || null;
  }

  function veiculoDo(r) {
    return (global.state?.vehicles || []).find((v) => String(v.id) === String(r?.vehicle_id)) || null;
  }

  function linhaDeRecebivel(r) {
    const pronta = (svc()?.billableLines?.() || []).find((l) => l.receivableId === String(r.id));
    if (pronta) return pronta;
    const v = veiculoDo(r);
    return {
      receivableId: String(r.id),
      vehicleId: r.vehicle_id ? String(r.vehicle_id) : "",
      valor: Number(r.valor || 0),
      abatimento: svc().abatimentoDoRecebivel(r.id),
      placa: v?.placa || "",
      veiculoNome: [v?.marca, v?.modelo].filter(Boolean).join(" ") || r.descricao || "Lançamento",
      links: [],
      servico: r.descricao || "",
      entrada: r.period_start || r.created_at || "",
      saida: r.period_end || r.updated_at || "",
      receivable: r,
    };
  }

  function nomeLinha(line) {
    const peloVinculo = clienteDaLinha(line).nome;
    if (peloVinculo !== "Sem cliente definido") return peloVinculo;
    const r = line.receivable || recebivelPorId(line.receivableId);
    const v = veiculoDo(r);
    return r?.responsavel_pagamento || v?.responsavel || v?.cliente || peloVinculo;
  }

  function cabeNaBusca(line) {
    const blob = `${line.placa} ${line.veiculoNome} ${nomeLinha(line)} ${line.receivableId}`.toLowerCase();
    return !q || blob.includes(q.toLowerCase());
  }

  function linhasAFaturar() {
    return (svc()?.billableLines?.() || []).filter((line) => {
      const r = line.receivable || recebivelPorId(line.receivableId);
      if (r && (ehContaReceber(r) || ehPago(r))) return false;
      if (saldoLinha(line) <= 0) return false;
      if (!noPeriodo(line.saida || line.entrada)) return false;
      return cabeNaBusca(line);
    });
  }

  function linhasAReceber() {
    const vistas = new Set();
    const out = [];
    for (const r of global.state?.receivables || []) {
      if (!r?.id || !ehContaReceber(r)) continue;
      if (svc().isReceivableInActiveCharge?.(r.id)) continue;
      const line = linhaDeRecebivel(r);
      if (saldoLinha(line) <= 0) continue;
      if (!noPeriodo(line.saida || line.entrada || r.created_at)) continue;
      if (!cabeNaBusca(line)) continue;
      vistas.add(line.receivableId);
      out.push(line);
    }
    return out;
  }

  function chaveGrupo(line) {
    const cli = clienteDaLinha(line);
    if (cli.key !== "sem") return cli;
    const nome = nomeLinha(line);
    return { key: `nome:${nome}`, nome };
  }

  function gruposAFaturar(linhas) {
    const map = new Map();
    for (const line of linhas) {
      const cli = chaveGrupo(line);
      if (!map.has(cli.key)) map.set(cli.key, { ...cli, linhas: [] });
      map.get(cli.key).linhas.push(line);
    }
    return [...map.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }

  function faturasAbertas() {
    return charges.filter((row) => {
      const st = String(row.status || "").toUpperCase();
      if (st !== "PENDENTE" && st !== "PARCIAL") return false;
      if (!noPeriodo(row.data_vencimento || row.data_geracao)) return false;
      const ident = row.identificador || `FAT-${String(row.numero_cobranca || 0).padStart(6, "0")}`;
      const blob = `${ident} ${row.parceiro_nome} ${row.busca_texto || ""}`.toLowerCase();
      return !q || blob.includes(q.toLowerCase());
    });
  }

  function recebidos() {
    return charges.filter((row) => {
      const st = String(row.status || "").toUpperCase();
      if (st === "HISTORICO") return false;
      if (st !== "PARCIAL" && !(Number(row.valor_recebido || 0) > 0)) return false;
      if (st === "PAGO") return false;
      if (!noPeriodo(row.data_vencimento || row.data_geracao)) return false;
      const ident = row.identificador || `FAT-${String(row.numero_cobranca || 0).padStart(6, "0")}`;
      const blob = `${ident} ${row.parceiro_nome} ${row.busca_texto || ""}`.toLowerCase();
      return !q || blob.includes(q.toLowerCase());
    });
  }

  function recebidosAvulsos() {
    const out = [];
    for (const r of global.state?.receivables || []) {
      if (!r?.id) continue;
      const line = linhaDeRecebivel(r);
      const pago = ehPago(r);
      const recebido = Number(line.abatimento || 0);
      if (!pago && !(recebido > 0)) continue;
      if (!noPeriodo(line.saida || line.entrada || r.updated_at || r.created_at)) continue;
      if (!cabeNaBusca(line)) continue;
      const total = Number(line.valor || 0);
      out.push({
        id: String(r.id),
        placa: line.placa || line.veiculoNome || "Lançamento",
        nome: nomeLinha(line),
        total,
        recebido: pago ? Math.max(recebido, total) : recebido,
        saldo: pago ? 0 : svc().saldoAposAbatimento(total, recebido),
        pago,
      });
    }
    return out;
  }

  function linhasHistorico() {
    const itens = [];
    for (const r of global.state?.receivables || []) {
      if (!r?.id) continue;
      const line = linhaDeRecebivel(r);
      if (!noPeriodo(line.saida || line.entrada || r.created_at)) continue;
      if (!cabeNaBusca(line)) continue;
      const pago = ehPago(r);
      const recebido = pago ? Math.max(Number(line.abatimento || 0), Number(line.valor || 0)) : Number(line.abatimento || 0);
      itens.push({
        tipo: "veiculo",
        id: line.receivableId,
        titulo: line.placa || line.veiculoNome || "Lançamento",
        nome: nomeLinha(line),
        total: Number(line.valor || 0),
        recebido,
        saldo: pago ? 0 : svc().saldoAposAbatimento(line.valor, line.abatimento),
        situacao: pago ? "Recebido" : ehContaReceber(r) ? "A receber" : "A faturar",
      });
    }
    for (const row of charges) {
      const ident = row.identificador || `FAT-${String(row.numero_cobranca || 0).padStart(6, "0")}`;
      const blob = `${ident} ${row.parceiro_nome || ""} ${row.busca_texto || ""}`.toLowerCase();
      if (q && !blob.includes(q.toLowerCase())) continue;
      if (!noPeriodo(row.data_geracao || row.created_at)) continue;
      const st = String(row.status || "HISTORICO").toUpperCase();
      const snap = svc().paymentSnapshot(row.valor_total, row.valor_recebido || 0);
      itens.push({
        tipo: "fatura",
        id: row.id,
        titulo: ident,
        nome: row.parceiro_nome || "Cliente",
        total: Number(row.valor_total || 0),
        recebido: Number(row.valor_recebido || 0),
        saldo: st === "HISTORICO" ? 0 : snap.saldo,
        situacao: st === "HISTORICO" ? "Fatura antiga" : svc().chargeStatusLabel(st),
      });
    }
    for (const mov of global.state?.cash || []) {
      if (mov?.conta_id && recebivelPorId(mov.conta_id)) continue;
      const titulo = mov.descricao || "Movimento de caixa";
      if (q && !String(titulo).toLowerCase().includes(q.toLowerCase())) continue;
      if (!noPeriodo(mov.data_movimento || mov.created_at)) continue;
      const entrada = ["RECEBER", "ENTRADA"].includes(String(mov.tipo_conta || "").toUpperCase());
      itens.push({
        tipo: "caixa",
        id: mov.id,
        titulo,
        nome: entrada ? "Entrada" : "Saída",
        total: Number(mov.valor || 0),
        recebido: entrada ? Number(mov.valor || 0) : 0,
        saldo: 0,
        situacao: entrada ? "Recebido" : "Saída",
      });
    }
    return itens;
  }

  function totais() {
    const aFaturar = linhasAFaturar().reduce((s, l) => s + saldoLinha(l), 0);
    let aReceber = linhasAReceber().reduce((s, l) => s + saldoLinha(l), 0);
    for (const row of faturasAbertas()) {
      aReceber += svc().paymentSnapshot(row.valor_total, row.valor_recebido || 0).saldo;
    }
    let recebido = 0;
    for (const item of recebidosAvulsos()) {
      recebido += item.pago ? Number(item.total || 0) : Number(item.recebido || 0);
    }
    for (const row of recebidos()) recebido += Number(row.valor_recebido || 0);
    return {
      aFaturar: round(aFaturar),
      aReceber: round(aReceber),
      recebido: round(recebido),
      historico: (global.state?.receivables || []).length + charges.length,
    };
  }

  function host() {
    return document.getElementById("caixaOp");
  }

  function ensure() {
    const finance = document.getElementById("viewFinanceiro");
    if (!finance) return;
    finance.classList.add("caixa-op-on");
    if (document.getElementById("caixaOp")) {
      built = true;
      return;
    }
    const el = document.createElement("div");
    el.id = "caixaOp";
    el.className = "cx";
    el.innerHTML = `
      <div class="cx-metrics" id="caixaOpMetrics"></div>
      <div class="cx-tools">
        <label>Busca<input id="caixaOpBusca" type="search" placeholder="Placa, cliente ou fatura" /></label>
        <label>De<input id="caixaOpDe" type="date" /></label>
        <label>Até<input id="caixaOpAte" type="date" /></label>
        <button type="button" class="cx-btn" id="caixaOpNova">Nova cobrança</button>
      </div>
      <div id="caixaOpLista"></div>
      <div id="caixaOpBar"></div>`;
    finance.appendChild(el);
    el.addEventListener("click", onClick);
    el.addEventListener("input", onInput);
    el.addEventListener("change", onInput);
    document.getElementById("caixaOpModal")?.remove();
    const modal = document.createElement("div");
    modal.id = "caixaOpModal";
    document.body.appendChild(modal);
    modal.addEventListener("click", onModalClick);
    built = true;
  }

  function onInput(e) {
    if (e.target.id === "caixaOpBusca") q = e.target.value || "";
    if (e.target.id === "caixaOpDe") de = e.target.value || "";
    if (e.target.id === "caixaOpAte") ate = e.target.value || "";
    pintarLista();
    pintarBarra();
  }

  function pintar() {
    pintarTotais();
    pintarLista();
    pintarBarra();
  }

  function pintarTotais() {
    const box = document.getElementById("caixaOpMetrics");
    if (!box) return;
    const t = totais();
    const item = (id, nome, texto) =>
      `<button type="button" class="cx-metric${filtro === id ? " is-on" : ""}" data-cx-filtro="${id}"><span>${nome}</span><strong>${esc(texto)}</strong></button>`;
    box.innerHTML =
      item("a_faturar", "A faturar", money(t.aFaturar)) +
      item("a_receber", "A receber", money(t.aReceber)) +
      item("recebido", "Recebido", money(t.recebido)) +
      item("historico", "Histórico", `${t.historico} registros`);
  }

  function linhaHtml(line, grupoNome, situacao) {
    const saldo = saldoLinha(line);
    const on = selected.has(line.receivableId) ? "checked" : "";
    const tag = situacao || "A faturar";
    return `<div class="cx-row" data-cx-open="veiculo" data-cx-id="${esc(line.receivableId)}">
      <input class="cx-check" type="checkbox" data-cx-check="${esc(line.receivableId)}" ${on} aria-label="Selecionar ${esc(line.placa || "veículo")}" />
      <span class="cx-title">${esc(line.placa || line.veiculoNome || "Veículo")}</span>
      <span class="cx-client">${esc(grupoNome)}</span>
      <span class="cx-num cx-hide-sm">${esc(money(line.valor))}</span>
      <span class="cx-num cx-hide-sm">${esc(money(line.abatimento || 0))}</span>
      <span class="cx-num cx-values">${esc(money(saldo))}</span>
      <span class="cx-tag ${tag === "A receber" ? "receber" : ""}">${esc(tag)}</span>
    </div>`;
  }

  function faturaHtml(row, situacao, tag) {
    const ident = row.identificador || `FAT-${String(row.numero_cobranca || 0).padStart(6, "0")}`;
    const snap = svc().paymentSnapshot(row.valor_total, row.valor_recebido || 0);
    const on = selected.has(`fat:${row.id}`) ? "checked" : "";
    const check = situacao === "A receber"
      ? `<input class="cx-check" type="checkbox" data-cx-fat="${esc(row.id)}" ${on} aria-label="Selecionar ${esc(ident)}" />`
      : "<span></span>";
    return `<div class="cx-row" data-cx-open="fatura" data-cx-id="${esc(row.id)}">
      ${check}
      <span class="cx-title">${esc(ident)}</span>
      <span class="cx-client">${esc(row.parceiro_nome || "Cliente")}</span>
      <span class="cx-num cx-hide-sm">${esc(money(row.valor_total))}</span>
      <span class="cx-num cx-hide-sm">${esc(money(row.valor_recebido || 0))}</span>
      <span class="cx-num cx-values">${esc(money(snap.saldo))}</span>
      <span class="cx-tag ${tag}">${esc(situacao)}</span>
    </div>`;
  }

  function pintarLista() {
    const box = document.getElementById("caixaOpLista");
    if (!box || !svc()) return;
    if (filtro === "historico") {
      const itens = linhasHistorico();
      if (!itens.length) {
        box.innerHTML = `<p class="cx-empty">Nenhum registro financeiro neste período.</p>`;
        return;
      }
      box.innerHTML = `<div class="cx-group">${itens
        .map(
          (item) => `<div class="cx-row" data-cx-open="${esc(item.tipo)}" data-cx-id="${esc(item.id)}">
            <span></span>
            <span class="cx-title">${esc(item.titulo)}</span>
            <span class="cx-client">${esc(item.nome)}</span>
            <span class="cx-num cx-hide-sm">${esc(money(item.total))}</span>
            <span class="cx-num cx-hide-sm">${esc(money(item.recebido))}</span>
            <span class="cx-num cx-values">${esc(money(item.saldo))}</span>
            <span class="cx-tag ${item.situacao === "Recebido" ? "pago" : item.situacao === "A receber" ? "receber" : ""}">${esc(item.situacao)}</span>
          </div>`
        )
        .join("")}</div>`;
      return;
    }
    if (filtro === "a_faturar" || filtro === "a_receber") {
      const linhas = filtro === "a_receber" ? linhasAReceber() : linhasAFaturar();
      const grupos = gruposAFaturar(linhas);
      const faturas = filtro === "a_receber" ? faturasAbertas() : [];
      if (!grupos.length && !faturas.length) {
        box.innerHTML = `<p class="cx-empty">${filtro === "a_receber" ? "Nenhuma cobrança em aberto." : "Nenhum valor pendente de cobrança."}</p>`;
        return;
      }
      const tag = filtro === "a_receber" ? "A receber" : "A faturar";
      const gruposHtml = grupos
        .map((g) => {
          const aberto = !collapsed.has(g.key);
          const total = g.linhas.reduce((s, l) => s + saldoLinha(l), 0);
          const ids = g.linhas.map((l) => l.receivableId);
          const allOn = ids.every((id) => selected.has(id));
          return `<section class="cx-group">
            <div class="cx-group-head">
              <input class="cx-check" type="checkbox" data-cx-group="${esc(g.key)}" ${allOn ? "checked" : ""} aria-label="Selecionar ${esc(g.nome)}" />
              <button type="button" class="cx-title" data-cx-toggle="${esc(g.key)}">${esc(g.nome)}</button>
              <span class="cx-client">${g.linhas.length} veículo${g.linhas.length === 1 ? "" : "s"}</span>
              <span class="cx-num cx-hide-sm"></span>
              <span class="cx-num cx-hide-sm"></span>
              <strong class="cx-num cx-values">${esc(money(total))}</strong>
              <span class="cx-tag ${tag === "A receber" ? "receber" : ""}">${tag}</span>
            </div>
            ${aberto ? g.linhas.map((l) => linhaHtml(l, g.nome, tag)).join("") : ""}
          </section>`;
        })
        .join("");
      const faturasHtml = faturas.length
        ? `<div class="cx-group">${faturas.map((row) => faturaHtml(row, "A receber", "receber")).join("")}</div>`
        : "";
      box.innerHTML = `${gruposHtml}${faturasHtml}`;
      return;
    }
    const rows = filtro === "recebido" ? recebidos() : [];
    const avulsos = filtro === "recebido" ? recebidosAvulsos() : [];
    if (!rows.length && !avulsos.length) {
      box.innerHTML = `<p class="cx-empty">${filtro === "recebido" ? "Nenhum recebimento neste período." : "Nenhuma fatura em aberto."}</p>`;
      return;
    }
    const head = `<div class="cx-group"><div class="cx-group-head"><span></span><span>${filtro === "recebido" ? "Recebimento" : "Fatura"}</span><span>Cliente</span><span class="cx-num cx-hide-sm">Total</span><span class="cx-num cx-hide-sm">Recebido</span><span class="cx-num">Saldo</span><span></span></div>`;
    const faturasHtml = rows
      .map((row) => {
        const st = String(row.status || "").toUpperCase();
        const sit = filtro === "recebido" ? (st === "PAGO" ? "Recebido" : "Parcial") : "A receber";
        const tag = st === "PAGO" ? "pago" : "receber";
        return faturaHtml(row, sit, tag);
      })
      .join("");
    const avulsoHtml = avulsos
      .map(
        (item) => `<div class="cx-row" data-cx-open="veiculo" data-cx-id="${esc(item.id)}">
          <span></span>
          <span class="cx-title">${esc(item.placa)}</span>
          <span class="cx-client">${esc(item.nome)}</span>
          <span class="cx-num cx-hide-sm">${esc(money(item.total))}</span>
          <span class="cx-num cx-hide-sm">${esc(money(item.recebido))}</span>
          <span class="cx-num cx-values">${esc(money(item.saldo))}</span>
          <span class="cx-tag ${item.pago ? "pago" : "receber"}">${item.pago ? "Recebido" : "Parcial"}</span>
        </div>`
      )
      .join("");
    box.innerHTML = `${head}${faturasHtml}${avulsoHtml}</div>`;
  }

  function selecionadosVeiculos() {
    const ids = new Set([...selected].filter((id) => !String(id).startsWith("fat:")));
    const pool = filtro === "a_receber" ? linhasAReceber() : linhasAFaturar();
    return pool.filter((l) => ids.has(l.receivableId));
  }

  function selecionadasFaturas() {
    const ids = new Set([...selected].filter((id) => String(id).startsWith("fat:")).map((id) => String(id).slice(4)));
    return faturasAbertas().filter((row) => ids.has(String(row.id)));
  }

  function pintarBarra() {
    const bar = document.getElementById("caixaOpBar");
    if (!bar) return;
    const veiculos = selecionadosVeiculos();
    const faturas = selecionadasFaturas();
    const n = veiculos.length || faturas.length;
    if (!n || filtro === "recebido") {
      bar.innerHTML = "";
      return;
    }
    const total = veiculos.length
      ? veiculos.reduce((s, l) => s + saldoLinha(l), 0)
      : faturas.reduce((s, row) => s + svc().paymentSnapshot(row.valor_total, row.valor_recebido || 0).saldo, 0);
    const cobrar = veiculos.length ? `<button type="button" class="cx-btn" data-cx-acao="cobrar">Gerar cobrança</button>` : "";
    bar.innerHTML = `<strong>${n} selecionado${n === 1 ? "" : "s"} · ${esc(money(total))}</strong><div>${cobrar}<button type="button" class="cx-btn secondary" data-cx-acao="pagar">Registrar pagamento</button></div>`;
  }

  function onClick(e) {
    const check = e.target.closest("[data-cx-check]");
    if (check) {
      e.stopPropagation();
      const id = check.getAttribute("data-cx-check");
      if (check.checked) selected.add(id);
      else selected.delete(id);
      pintarBarra();
      return;
    }
    const fat = e.target.closest("[data-cx-fat]");
    if (fat) {
      e.stopPropagation();
      const id = `fat:${fat.getAttribute("data-cx-fat")}`;
      if (fat.checked) selected.add(id);
      else selected.delete(id);
      pintarBarra();
      return;
    }
    const group = e.target.closest("[data-cx-group]");
    if (group) {
      const key = group.getAttribute("data-cx-group");
      const base = filtro === "a_receber" ? linhasAReceber() : linhasAFaturar();
      const linhas = base.filter((l) => chaveGrupo(l).key === key);
      linhas.forEach((l) => (group.checked ? selected.add(l.receivableId) : selected.delete(l.receivableId)));
      pintarLista();
      pintarBarra();
      return;
    }
    const toggle = e.target.closest("[data-cx-toggle]");
    if (toggle) {
      const key = toggle.getAttribute("data-cx-toggle");
      if (collapsed.has(key)) collapsed.delete(key);
      else collapsed.add(key);
      pintarLista();
      return;
    }
    const filtroBtn = e.target.closest("[data-cx-filtro]");
    if (filtroBtn) {
      filtro = filtroBtn.getAttribute("data-cx-filtro");
      selected = new Set();
      pintar();
      return;
    }
    if (e.target.closest("#caixaOpNova") || e.target.closest("[data-cx-acao='cobrar']")) {
      abrirCobranca();
      return;
    }
    if (e.target.closest("[data-cx-acao='pagar']")) {
      abrirPagamento();
      return;
    }
    const open = e.target.closest("[data-cx-open]");
    if (open && e.target.tagName !== "INPUT") {
      const tipo = open.getAttribute("data-cx-open");
      const id = open.getAttribute("data-cx-id");
      if (tipo === "veiculo") mostrarVeiculo(id);
      else if (tipo === "fatura") mostrarFatura(id);
    }
  }

  function fecharCamadas() {
    document.getElementById("caixaOpModal").innerHTML = "";
    document.getElementById("caixaOpDetail")?.remove();
  }

  function mostrarVeiculo(id) {
    const r = recebivelPorId(id);
    const line = (svc().billableLines() || []).find((l) => l.receivableId === String(id)) || (r ? linhaDeRecebivel(r) : null);
    if (!line) return;
    fecharCamadas();
    const saldo = saldoLinha(line);
    const aside = document.createElement("div");
    aside.id = "caixaOpDetail";
    aside.className = "cx-detail";
    aside.innerHTML = `<div class="cx-panel" role="dialog">
      <button type="button" class="cx-btn secondary" data-cx-fechar="1">Fechar</button>
      <h3>${esc(line.placa || line.veiculoNome)}</h3>
      <p>${esc(nomeLinha(line))} · ${esc(line.servico || "Guarda e custódia")}</p>
      <div class="cx-dl">
        <div><span>Valor do serviço</span><strong>${esc(money(line.valor))}</strong></div>
        <div><span>Já recebido</span><strong>${esc(money(line.abatimento || 0))}</strong></div>
        <div><span>Saldo</span><strong>${esc(money(saldo))}</strong></div>
        <div><span>Situação</span><strong>${esc((() => { const rec = line.receivable || recebivelPorId(line.receivableId); if (rec && ehPago(rec)) return "Recebido"; if (rec && ehContaReceber(rec)) return "A receber"; return "A faturar"; })())}</strong></div>
      </div>
      <p>Período ${esc(svc().formatPeriodLabel(line.entrada, line.saida || svc().todayYmd()))}. A saída do pátio não quita este valor.</p>
    </div>`;
    aside.addEventListener("click", (ev) => {
      if (ev.target === aside || ev.target.closest("[data-cx-fechar]")) aside.remove();
    });
    document.body.appendChild(aside);
  }

  async function mostrarFatura(id) {
    const row = charges.find((c) => String(c.id) === String(id));
    if (!row) return;
    fecharCamadas();
    const items = await svc().loadHistoryItems(id, supabase());
    const lines = svc().snapshotLinesFromItems(items);
    const snap = svc().paymentSnapshot(row.valor_total, row.valor_recebido || 0);
    const ident = row.identificador || `FAT-${String(row.numero_cobranca || 0).padStart(6, "0")}`;
    const aside = document.createElement("div");
    aside.id = "caixaOpDetail";
    aside.className = "cx-detail";
    aside.innerHTML = `<div class="cx-panel" role="dialog">
      <button type="button" class="cx-btn secondary" data-cx-fechar="1">Fechar</button>
      <h3>${esc(ident)}</h3>
      <p>${esc(row.parceiro_nome || "Cliente")}${row.data_vencimento ? ` · vence ${esc(svc().formatDate(row.data_vencimento))}` : ""}</p>
      <div class="cx-dl">
        <div><span>Total</span><strong>${esc(money(row.valor_total))}</strong></div>
        <div><span>Recebido</span><strong>${esc(money(row.valor_recebido || 0))}</strong></div>
        <div><span>Saldo</span><strong>${esc(money(snap.saldo))}</strong></div>
        <div><span>Situação</span><strong>${esc(svc().chargeStatusLabel(row.status))}</strong></div>
      </div>
      <table class="cx-lines"><thead><tr><th>Placa</th><th>Serviço</th><th class="num">Valor</th></tr></thead>
      <tbody>${lines
        .map(
          (l) =>
            `<tr><td>${esc(l.placa || "—")}</td><td>${esc(l.servico || "Serviço")}</td><td class="num">${esc(money(l.valor))}</td></tr>`
        )
        .join("")}</tbody></table>
    </div>`;
    aside.addEventListener("click", (ev) => {
      if (ev.target === aside || ev.target.closest("[data-cx-fechar]")) aside.remove();
    });
    document.body.appendChild(aside);
  }

  function linhasParaCobrar() {
    const escolhidas = selecionadosVeiculos();
    return (escolhidas.length ? escolhidas : linhasAFaturar()).map((l) => ({
      ...l,
      valorOriginal: Number(l.valor || 0),
      abatimento: Number(l.abatimento || 0),
      valor: saldoLinha(l),
    }));
  }

  function abrirCobranca() {
    filtro = "a_faturar";
    pintar();
    const linhas = linhasParaCobrar();
    const catalog = svc().clientCatalog();
    const modal = document.getElementById("caixaOpModal");
    modal.innerHTML = `<div class="cx-modal-back"><form class="cx-dialog" id="caixaOpFormCobrar">
      <h3>Gerar cobrança</h3>
      <div class="cx-choice">
        <label><input type="radio" name="cxCliente" value="cadastrado" checked /> Cliente cadastrado</label>
        <label><input type="radio" name="cxCliente" value="avulso" /> Cliente avulso</label>
      </div>
      <div class="cx-form" id="caixaOpClienteBox">
        <label class="full">Cliente<select id="cxClienteSel"><option value="">Selecione</option>${catalog
          .map((c) => `<option value="${esc(c.key)}">${esc(c.nome)}</option>`)
          .join("")}</select></label>
      </div>
      <table class="cx-lines"><thead><tr><th></th><th>Placa</th><th class="num">Valor</th><th class="num">Abatido</th><th class="num">Saldo</th></tr></thead>
      <tbody>${linhas
        .map(
          (l) => `<tr>
            <td><input type="checkbox" data-cx-modal-line="${esc(l.receivableId)}" checked /></td>
            <td>${esc(l.placa || l.veiculoNome)}</td>
            <td class="num">${esc(money(l.valorOriginal))}</td>
            <td class="num">${esc(money(l.abatimento))}</td>
            <td class="num">${esc(money(l.valor))}</td>
          </tr>`
        )
        .join("")}</tbody></table>
      <label>Vencimento<input id="cxVencimento" type="date" value="${esc(today())}" /></label>
      <p class="cx-total" id="cxTotalCobrar"></p>
      <button type="submit" class="cx-btn">Confirmar e gerar cobrança</button>
    </form></div>`;
    const form = document.getElementById("caixaOpFormCobrar");
    const atualizarTotal = () => {
      let total = 0;
      form.querySelectorAll("[data-cx-modal-line]:checked").forEach((el) => {
        const line = linhas.find((l) => l.receivableId === el.getAttribute("data-cx-modal-line"));
        total += Number(line?.valor || 0);
      });
      document.getElementById("cxTotalCobrar").textContent = `Total da cobrança ${money(total)}`;
    };
    form.querySelectorAll("[data-cx-modal-line]").forEach((el) => el.addEventListener("change", atualizarTotal));
    form.querySelectorAll('input[name="cxCliente"]').forEach((el) =>
      el.addEventListener("change", () => {
        const avulso = form.querySelector('input[name="cxCliente"]:checked')?.value === "avulso";
        document.getElementById("caixaOpClienteBox").innerHTML = avulso
          ? `<label>Nome ou razão social<input id="cxAvulsoNome" required /></label>
             <label>CPF ou CNPJ<input id="cxAvulsoDoc" /></label>
             <label class="full"><input id="cxAvulsoSalvar" type="checkbox" /> Salvar cliente</label>`
          : `<label class="full">Cliente<select id="cxClienteSel"><option value="">Selecione</option>${catalog
              .map((c) => `<option value="${esc(c.key)}">${esc(c.nome)}</option>`)
              .join("")}</select></label>`;
      })
    );
    atualizarTotal();
    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      confirmarCobranca(linhas, form);
    });
  }

  async function confirmarCobranca(linhas, form) {
    const btn = form.querySelector('button[type="submit"]');
    const ids = [...form.querySelectorAll("[data-cx-modal-line]:checked")].map((el) => el.getAttribute("data-cx-modal-line"));
    const escolhidas = linhas.filter((l) => ids.includes(l.receivableId) && l.valor > 0);
    if (!escolhidas.length) {
      alert("Selecione ao menos um veículo com saldo.");
      return;
    }
    const modo = form.querySelector('input[name="cxCliente"]:checked')?.value || "cadastrado";
    let client;
    if (modo === "avulso") {
      const nome = document.getElementById("cxAvulsoNome")?.value?.trim();
      if (!nome) {
        alert("Informe o nome ou a razão social.");
        return;
      }
      client = {
        modo: "avulso",
        nome,
        documento: document.getElementById("cxAvulsoDoc")?.value?.trim() || "",
        tipoLabel: "Cliente avulso",
        salvar: !!document.getElementById("cxAvulsoSalvar")?.checked,
        vencimento: document.getElementById("cxVencimento")?.value || "",
        origem: "caixa",
        subject: { kind: "avulso", id: null },
      };
    } else {
      const key = document.getElementById("cxClienteSel")?.value;
      const found = svc().clientCatalog().find((c) => c.key === key);
      if (!found) {
        alert("Selecione o cliente.");
        return;
      }
      client = {
        modo: "cadastrado",
        nome: found.nome,
        documento: found.documento || "",
        contato: found.contato || "",
        tipoLabel: found.tipoLabel,
        vencimento: document.getElementById("cxVencimento")?.value || "",
        origem: "caixa",
        subject: { kind: found.kind, id: found.id },
      };
    }
    if (btn) btn.disabled = true;
    try {
      await svc().persistCobranca({
        supabase: supabase(),
        uid: uid(),
        subject: client.subject,
        meta: { nome: client.nome, tipoLabel: client.tipoLabel },
        lines: escolhidas,
        sessionUser: null,
        client,
      });
      if (client.salvar) {
        try {
          await svc().saveFinanceClient({
            supabase: supabase(),
            uid: uid(),
            nome: client.nome,
            documento: client.documento,
            contato: client.contato,
          });
        } catch (err) {
          alert(err.message || "A cobrança foi gerada, mas o cliente não foi salvo.");
        }
      }
      selected = new Set();
      fecharCamadas();
      filtro = "a_receber";
      await recarregar();
    } catch (err) {
      alert(err.message || "Não foi possível gerar a cobrança.");
      if (btn) btn.disabled = false;
    }
  }

  function abrirPagamento() {
    const veiculos = selecionadosVeiculos();
    const faturas = selecionadasFaturas();
    const saldo = veiculos.length
      ? veiculos.reduce((s, l) => s + saldoLinha(l), 0)
      : faturas.reduce((s, row) => s + svc().paymentSnapshot(row.valor_total, row.valor_recebido || 0).saldo, 0);
    if (saldo <= 0) {
      alert("Não há saldo pendente na seleção.");
      return;
    }
    const modal = document.getElementById("caixaOpModal");
    modal.innerHTML = `<div class="cx-modal-back"><form class="cx-dialog" id="caixaOpFormPagar">
      <h3>Registrar pagamento</h3>
      <div class="cx-dl">
        <div><span>Valor pendente</span><strong>${esc(money(saldo))}</strong></div>
      </div>
      <div class="cx-form">
        <label>Valor recebido<input id="cxPagoValor" type="number" min="0.01" step="0.01" value="${esc(saldo.toFixed(2))}" required /></label>
        <label>Data<input id="cxPagoData" type="date" value="${esc(today())}" required /></label>
        <label>Origem<input id="cxPagoOrigem" type="text" placeholder="Quem pagou" /></label>
        <label>Forma<select id="cxPagoForma"><option value="PIX">PIX</option><option value="DINHEIRO">Dinheiro</option><option value="TRANSFERENCIA">Transferência</option><option value="CARTAO">Cartão</option></select></label>
      </div>
      <button type="submit" class="cx-btn">Confirmar pagamento</button>
    </form></div>`;
    document.getElementById("caixaOpFormPagar").addEventListener("submit", (ev) => {
      ev.preventDefault();
      confirmarPagamento(veiculos, faturas, saldo);
    });
  }

  async function confirmarPagamento(veiculos, faturas, saldo) {
    const btn = document.querySelector("#caixaOpFormPagar button[type='submit']");
    const valor = round(document.getElementById("cxPagoValor")?.value);
    const data = document.getElementById("cxPagoData")?.value || today();
    const origem = document.getElementById("cxPagoOrigem")?.value?.trim() || "";
    const forma = document.getElementById("cxPagoForma")?.value || "PIX";
    if (!(valor > 0) || valor - saldo > 0.009) {
      alert("O valor recebido precisa ser maior que zero e não pode passar do saldo.");
      return;
    }
    if (btn) btn.disabled = true;
    try {
      if (faturas.length) {
        let resto = valor;
        for (const row of faturas) {
          if (resto <= 0) break;
          const snap = svc().paymentSnapshot(row.valor_total, row.valor_recebido || 0);
          const aplicar = round(Math.min(snap.saldo, resto));
          if (aplicar <= 0) continue;
          const res = await svc().registerChargePayment({
            supabase: supabase(),
            uid: uid(),
            charge: row,
            amount: aplicar,
            forma,
            dataMovimento: data,
            observacao: origem ? `Origem: ${origem}` : "",
          });
          row.valor_recebido = res.charge.valor_recebido;
          row.status = res.charge.status;
          resto = round(resto - aplicar);
        }
      } else {
        await pagarVeiculos(veiculos, valor, { forma, data, origem });
      }
      selected = new Set();
      fecharCamadas();
      await recarregar();
    } catch (err) {
      alert(err.message || "Não foi possível registrar o pagamento.");
      if (btn) btn.disabled = false;
    }
  }

  async function pagarVeiculos(linhas, valor, opts) {
    const plano = alocarPagamento(
      linhas.map((l) => ({ id: l.receivableId, saldo: saldoLinha(l) })),
      valor
    );
    for (const passo of plano) {
      if (passo.aplicar <= 0) continue;
      const line = linhas.find((l) => l.receivableId === passo.id);
      const original = Number(line.valor || 0);
      const acumulado = round(Number(line.abatimento || 0) + passo.aplicar);
      const descricao = `Recebimento ${line.placa || ""} ${opts.origem || ""}`.trim();
      if (acumulado + 0.009 >= original) {
        if (typeof global.finalizeReceivablePayment !== "function") {
          throw new Error("Não foi possível confirmar o pagamento.");
        }
        const quitado = await global.finalizeReceivablePayment(line.receivableId, original, {
          quiet: true,
          skipReload: true,
          dataMovimento: opts.data,
          formaPagamento: opts.forma,
          observacao: opts.origem || "",
          valorOriginal: original,
        });
        if (!quitado) throw new Error(`Não foi possível confirmar o pagamento de ${line.placa || "um veículo"}.`);
        continue;
      }
      if (typeof global.registerReceivableCashMovement !== "function") {
        throw new Error("Não foi possível registrar o pagamento parcial.");
      }
      const rec = (global.state?.receivables || []).find((r) => String(r.id) === String(line.receivableId));
      const gravado = await global.registerReceivableCashMovement(rec || { id: line.receivableId, valor: original, vehicle_id: line.vehicleId }, {
        valor: acumulado,
        dataMovimento: opts.data,
        formaPagamento: opts.forma,
        descricao,
        aprovadoCaixa: true,
      });
      if (gravado?.error) throw new Error(gravado.error.message || "Não foi possível registrar o pagamento parcial.");
    }
  }

  function onModalClick(e) {
    if (e.target.classList?.contains("cx-modal-back")) fecharCamadas();
  }

  async function recarregar() {
    if (typeof global.loadReceivables === "function") await global.loadReceivables();
    if (typeof global.loadCash === "function") await global.loadCash();
    if (typeof global.loadVehicles === "function") await global.loadVehicles();
    await refresh();
    if (typeof global.updateDashboard === "function") global.updateDashboard();
  }

  async function refresh() {
    if (!svc()) return;
    ensure();
    try {
      await svc().refreshBlockedReceivables(uid(), supabase());
      const loaded = await svc().loadCharges(uid(), supabase());
      charges = loaded.rows || [];
      const pagos = charges.filter((row) => String(row.status || "").toUpperCase() === "PAGO").map((row) => row.id);
      pagosReceivableIds = new Set();
      if (pagos.length && supabase()) {
        const itens = await supabase().from("cobranca_itens").select("receivable_id").in("cobranca_id", pagos);
        if (!itens.error) pagosReceivableIds = new Set((itens.data || []).map((item) => String(item.receivable_id || "")));
      }
    } catch (err) {
      console.warn("caixa operacional", err);
    }
    pintar();
  }

  function captura(view) {
    if (!TELAS.has(view)) {
      ativo = false;
      document.getElementById("viewFinanceiro")?.classList.remove("caixa-op-on");
      return false;
    }
    ativo = true;
    ensure();
    document.querySelectorAll("#viewFinanceiro .finance-subview").forEach((el) => {
      el.classList.add("hidden");
      el.hidden = true;
    });
    refresh();
    return true;
  }

  function open() {
    captura("cobrancas");
  }

  function cobrarSelecao(ids) {
    selected = new Set((ids || []).map(String));
    filtro = "a_faturar";
    const finance = document.getElementById("viewFinanceiro");
    if (!finance || finance.classList.contains("hidden")) {
      if (typeof global.openMainView === "function") global.openMainView("financeiro");
    } else {
      captura("aguardando");
    }
    abrirCobranca();
  }

  global.caixaOperacional = {
    captura,
    open,
    refresh,
    cobrarSelecao,
    isActive: () => ativo,
    alocarPagamento,
    gruposAFaturar,
  };
})(typeof window !== "undefined" ? window : globalThis);

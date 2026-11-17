/**
 * Caixa operacional — lista única de faturar, receber e recibos.
 * Não reabre as telas antigas de aguardando, cobrança ou histórico.
 */
(function caixaOperacionalModule(global) {
  "use strict";

  const TELAS = new Set(["aguardando", "cobrancas", "caixa", "receber", "em_patio", "dashboard", "entradas", "saidas"]);
  let ativo = false;
  let filtro = "entradas";
  let prazo = "";
  let tipoMov = "";
  let q = "";
  let de = "";
  let ate = "";
  let mesSelecionado = "";
  let selected = new Set();
  let collapsed = new Set();
  let charges = [];
  let itensPorCobranca = new Map();
  let cobrancaPorRecebivelId = new Map();
  let pagosReceivableIds = new Set();
  let built = false;
  let refreshToken = 0;
  let refreshTimer = 0;
  let contasCache = null;
  let catalogCache = null;
  let linhaMap = null;
  let recebivelMap = null;
  let veiculoMap = null;
  let limiteLista = 200;

  function svc() {
    return global.cobrancaService;
  }

  function dados() {
    return global.__ampliState || global.state || {};
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

  function anoMes(data) {
    const dia = String(data || "").slice(0, 10);
    return /^\d{4}-\d{2}/.test(dia) ? dia.slice(0, 7) : "";
  }

  function mesAtual() {
    return anoMes(today()) || anoMes(new Date().toISOString());
  }

  function mesAtivo() {
    return mesSelecionado || mesAtual();
  }

  function nomeMes(ym) {
    const [y, m] = String(ym || "").split("-");
    const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    const nome = meses[Number(m) - 1] || ym;
    return y ? `${nome}/${y}` : nome;
  }

  function rotuloVeiculo(v) {
    if (!v) return "";
    const placa = String(v.placa || "").trim();
    const nome = [v.marca, v.modelo].filter(Boolean).join(" ").trim();
    if (placa && nome) return `${placa} • ${nome}`;
    return placa || nome;
  }

  function textoVisivel(texto) {
    let s = String(texto || "");
    s = s.replace(/\[\[finmeta:[\s\S]*?\]\]/g, " ");
    s = s.replace(/^\s*di[aá]rias\s*[—\-–:]\s*/i, "");
    s = s.replace(/\s+/g, " ").trim();
    if (!s || s.includes("[[finmeta:") || s.startsWith("{")) return "";
    return s;
  }

  function descricaoMovimento(mov) {
    if (typeof global.financeDescricaoMovimentoVisivel === "function") {
      const pronto = global.financeDescricaoMovimentoVisivel(mov);
      if (pronto) return pronto;
    }
    const rec = recebivelPorId(mov?.conta_id);
    const v = veiculoDo(rec);
    const rotulo = rotuloVeiculo(v);
    const limpo = textoVisivel(mov?.descricao);
    if (rotulo && (v?.marca || v?.modelo)) return rotulo;
    if (limpo) return limpo;
    if (rotulo) return rotulo;
    return movimentoEhEntrada(mov) ? "Entrada" : "Saída";
  }

  function textoDespesa(p) {
    return String(p?.descricao || "")
      .replace(/\[\[finmeta:[\s\S]*?\]\]/g, " ")
      .replace(/\s+/g, " ")
      .trim() || "Despesa";
  }

  function competenciaDespesa(p) {
    return anoMes(p?.data_vencimento) || anoMes(p?.created_at);
  }

  function despesaPaga(p) {
    return String(p?.status || "").toUpperCase() === "PAGO";
  }

  function dedupeDespesas(lista) {
    const seen = new Set();
    const out = [];
    for (const p of lista || []) {
      if (!p?.id || !(Number(p.valor || 0) > 0)) continue;
      const key = [
        textoDespesa(p).toLowerCase(),
        String(p.fornecedor || p.favorecido || "").trim().toLowerCase(),
        String(p.data_vencimento || "").slice(0, 10),
        round(p.valor),
      ].join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(p);
    }
    return out;
  }

  function apurarMes(mes, origem) {
    const referencia = anoMes(`${mes || mesAtivo()}-01`);
    const base = origem || dados() || {};
    const payables = base.payables || [];
    const cashBruto = base.cash || [];
    const cashDedup =
      typeof global.financeDedupeCaixaMovs === "function" ? global.financeDedupeCaixaMovs(cashBruto) : cashBruto;
    const vistosCaixa = new Set();
    const cash = [];
    for (const mov of cashDedup || []) {
      if (!mov || mov.excluir_do_saldo === true) continue;
      const chave = mov.conta_id
        ? `${String(mov.tipo_conta || "").toUpperCase()}|${mov.conta_id}`
        : String(mov.id || `avulso-${cash.length}`);
      if (vistosCaixa.has(chave)) continue;
      vistosCaixa.add(chave);
      cash.push(mov);
    }
    const despesas = dedupeDespesas(payables).filter((p) => competenciaDespesa(p) === referencia);
    const aPagarLista = despesas.filter((p) => !despesaPaga(p));
    const movs = (cash || []).filter((mov) => mov && mov.excluir_do_saldo !== true && anoMes(mov.data_movimento || mov.created_at) === referencia);
    let entradasRecebidas = 0;
    let saidasPagas = 0;
    for (const mov of movs) {
      const valor = Number(mov.valor || 0);
      if (movimentoEhSaida(mov)) saidasPagas += valor;
      else if (movimentoEhEntrada(mov)) entradasRecebidas += valor;
    }
    const abertas = dedupeDespesas(payables.filter((p) => !despesaPaga(p)));
    const porMes = {};
    for (const p of abertas) {
      const chave = competenciaDespesa(p) || "(sem mês)";
      porMes[chave] = round((porMes[chave] || 0) + Number(p.valor || 0));
    }
    return {
      mes: referencia,
      despesas,
      aPagarLista,
      movs,
      entradasRecebidas: round(entradasRecebidas),
      saidasPagas: round(saidasPagas),
      aPagar: round(aPagarLista.reduce((s, p) => s + Number(p.valor || 0), 0)),
      resultado: round(entradasRecebidas - saidasPagas),
      abertoTodosMeses: round(abertas.reduce((s, p) => s + Number(p.valor || 0), 0)),
      abertoPorMes: porMes,
    };
  }

  function movimentosDeduplicados(origem) {
    const base = origem || dados() || {};
    const cashBruto = base.cash || [];
    const cashDedup =
      typeof global.financeDedupeCaixaMovs === "function" ? global.financeDedupeCaixaMovs(cashBruto) : cashBruto;
    const vistosCaixa = new Set();
    const cash = [];
    for (const mov of cashDedup || []) {
      if (!mov || mov.excluir_do_saldo === true) continue;
      const chave = mov.conta_id
        ? `${String(mov.tipo_conta || "").toUpperCase()}|${mov.conta_id}`
        : String(mov.id || `avulso-${cash.length}`);
      if (vistosCaixa.has(chave)) continue;
      vistosCaixa.add(chave);
      cash.push(mov);
    }
    return cash;
  }

  function saldoCaixa(mes, origem) {
    const referencia = anoMes(`${mes || mesAtivo()}-01`);
    const apura = apurarMes(mes || mesAtivo(), origem);
    let inicial = 0;
    for (const mov of movimentosDeduplicados(origem)) {
      const ym = anoMes(mov.data_movimento || mov.created_at);
      if (!ym || ym >= referencia) continue;
      const valor = Number(mov.valor || 0);
      if (movimentoEhSaida(mov)) inicial -= valor;
      else if (movimentoEhEntrada(mov)) inicial += valor;
    }
    inicial = round(inicial);
    return {
      mes: referencia,
      inicial,
      recebido: apura.entradasRecebidas,
      pago: apura.saidasPagas,
      final: round(inicial + apura.entradasRecebidas - apura.saidasPagas),
      aPagar: apura.aPagar,
    };
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
    if (!catalogCache) catalogCache = svc()?.clientCatalog?.() || [];
    const catalog = catalogCache;
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
    if (!recebivelMap) {
      recebivelMap = new Map();
      for (const r of dados()?.receivables || []) if (r?.id != null) recebivelMap.set(String(r.id), r);
    }
    return recebivelMap.get(String(id)) || null;
  }

  function veiculoDo(r) {
    if (!veiculoMap) {
      veiculoMap = new Map();
      for (const v of dados()?.vehicles || []) if (v?.id != null) veiculoMap.set(String(v.id), v);
    }
    return veiculoMap.get(String(r?.vehicle_id || "")) || null;
  }

  function rotuloLinha(line) {
    const r = line?.receivable || recebivelPorId(line?.receivableId);
    const v = veiculoDo(r);
    const estruturado = rotuloVeiculo(v);
    if (estruturado && (v?.marca || v?.modelo)) return estruturado;
    const placa = String(line?.placa || v?.placa || "").trim();
    const nome = String(line?.veiculoNome || "").trim();
    const nomeUtil = nome && nome !== "Lançamento" && nome !== "—" && nome !== placa ? nome : "";
    if (placa && nomeUtil) return `${placa} • ${nomeUtil}`;
    if (estruturado) return estruturado;
    return placa || nomeUtil || "Veículo";
  }

  function linhaDeRecebivel(r) {
    if (!linhaMap) {
      linhaMap = new Map();
      for (const linha of svc()?.billableLines?.() || []) linhaMap.set(String(linha.receivableId), linha);
    }
    const pronta = linhaMap.get(String(r.id));
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

  function passaPeriodo(data) {
    if (!de && !ate) return true;
    const dia = ymd(data);
    if (!dia) return true;
    if (de && dia < de) return false;
    if (ate && dia > ate) return false;
    return true;
  }

  function contasFonte() {
    if (contasCache) return contasCache;
    if (typeof global.financeContasReceberList === "function") {
      try {
        contasCache = global.financeContasReceberList() || [];
        return contasCache;
      } catch (_e) {
        /* a lista antiga continua disponível pelo status do recebível */
      }
    }
    contasCache = (dados()?.receivables || []).filter((r) => ehContaReceber(r) && Number(r.valor || 0) > 0);
    return contasCache;
  }

  function linhasAFaturar() {
    const jaFaturados = new Set(contasFonte().map((r) => String(r.id)));
    return (svc()?.billableLines?.() || []).filter((line) => {
      if (jaFaturados.has(String(line.receivableId))) return false;
      const r = line.receivable || recebivelPorId(line.receivableId);
      if (r && (ehContaReceber(r) || ehPago(r))) return false;
      if (saldoLinha(line) <= 0) return false;
      if (!passaPeriodo(line.saida || line.entrada)) return false;
      return cabeNaBusca(line);
    });
  }

  function idsCobertosPorFatura() {
    const ids = new Set();
    for (const row of faturasAbertas()) {
      for (const item of itensPorCobranca.get(String(row.id)) || []) {
        if (item.receivable_id) ids.add(String(item.receivable_id));
      }
    }
    for (const fat of faturasAntigasEmAberto()) fat.ids.forEach((id) => ids.add(id));
    return ids;
  }

  function linhasAReceber() {
    const cobertos = idsCobertosPorFatura();
    const out = [];
    for (const r of contasFonte()) {
      if (!r?.id || cobertos.has(String(r.id))) continue;
      const base = linhaDeRecebivel(r);
      const line = { ...base, valor: Number(r.valor || 0), abatimento: 0, receivable: r };
      if (!(line.valor > 0)) continue;
      if (!passaPeriodo(r.faturado_em || r.contas_receber_em || r.period_end || r.created_at)) continue;
      const dest = r.cobranca_destinatario_nome || "";
      const blob = `${line.placa} ${line.veiculoNome} ${nomeLinha(line)} ${dest}`.toLowerCase();
      if (q && !blob.includes(q.toLowerCase())) continue;
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
      const snap = svc().paymentSnapshot(row.valor_total, row.valor_recebido || 0);
      if (snap.saldo <= 0) return false;
      if (!passaPeriodo(row.data_vencimento || row.data_geracao || row.created_at)) return false;
      const ident = row.identificador || `FAT-${String(row.numero_cobranca || 0).padStart(6, "0")}`;
      const blob = `${ident} ${row.parceiro_nome} ${row.busca_texto || ""}`.toLowerCase();
      return !q || blob.includes(q.toLowerCase());
    });
  }

  function faturasAntigasEmAberto() {
    const contasIds = new Set(contasFonte().map((r) => String(r.id)));
    const emFaturaNova = new Set();
    for (const row of faturasAbertas()) {
      for (const item of itensPorCobranca.get(String(row.id)) || []) {
        if (item.receivable_id) emFaturaNova.add(String(item.receivable_id));
      }
    }
    const usados = new Set();
    const out = [];
    for (const row of charges) {
      if (String(row.status || "").toUpperCase() !== "HISTORICO") continue;
      const items = itensPorCobranca.get(String(row.id)) || [];
      const ids = items
        .map((item) => String(item.receivable_id || ""))
        .filter((id) => contasIds.has(id) && !emFaturaNova.has(id) && !usados.has(id));
      ids.forEach((id) => usados.add(id));
      if (!ids.length) continue;
      if (!passaPeriodo(row.data_geracao || row.created_at)) continue;
      const ident = row.identificador || `FAT-${String(row.numero_cobranca || 0).padStart(6, "0")}`;
      const blob = `${ident} ${row.parceiro_nome || ""} ${row.busca_texto || ""}`.toLowerCase();
      if (q && !blob.includes(q.toLowerCase())) continue;
      const saldo = ids.reduce((s, id) => s + Number(recebivelPorId(id)?.valor || 0), 0);
      if (saldo <= 0) continue;
      out.push({ row, ids, saldo });
    }
    return out;
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
    for (const r of dados()?.receivables || []) {
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
        placa: rotuloLinha(line),
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
    for (const r of dados()?.receivables || []) {
      if (!r?.id) continue;
      const line = linhaDeRecebivel(r);
      if (!noPeriodo(line.saida || line.entrada || r.created_at)) continue;
      if (!cabeNaBusca(line)) continue;
      const pago = ehPago(r);
      const recebido = pago ? Math.max(Number(line.abatimento || 0), Number(line.valor || 0)) : Number(line.abatimento || 0);
      itens.push({
        tipo: "veiculo",
        id: line.receivableId,
        titulo: rotuloLinha(line),
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
    for (const mov of dados()?.cash || []) {
      if (mov?.conta_id && recebivelPorId(mov.conta_id)) continue;
      const titulo = descricaoMovimento(mov);
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
    let aReceber = linhasAReceber().reduce((s, l) => s + Number(l.valor || 0), 0);
    for (const row of faturasAbertas()) {
      aReceber += svc().paymentSnapshot(row.valor_total, row.valor_recebido || 0).saldo;
    }
    for (const fat of faturasAntigasEmAberto()) aReceber += fat.saldo;
    let recebido = 0;
    for (const item of recebidosAvulsos()) {
      recebido += item.pago ? Number(item.total || 0) : Number(item.recebido || 0);
    }
    for (const row of recebidos()) recebido += Number(row.valor_recebido || 0);
    return {
      aFaturar: round(aFaturar),
      aReceber: round(aReceber),
      recebido: round(recebido),
      historico: (dados()?.receivables || []).length + charges.length,
    };
  }

  function host() {
    return document.getElementById("caixaOp");
  }

  function ensure() {
    const finance = document.getElementById("viewFinanceiro");
    if (!finance) return;
    finance.classList.add("caixa-op-on");
    const jaExiste = document.getElementById("caixaOp");
    if (jaExiste && !jaExiste.querySelector('[data-cx-filtro="entradas"]')) jaExiste.remove();
    if (jaExiste && !document.getElementById("cxHead")) jaExiste.remove();
    if (document.getElementById("caixaOp")) {
      const mes = document.getElementById("caixaOpMes");
      if (mes && !mes.value) mes.value = mesAtivo();
      built = true;
      return;
    }
    const el = document.createElement("div");
    el.id = "caixaOp";
    el.className = "cx";
    el.innerHTML = `
      <header class="cx-head" id="cxHead">
        <div>
          <p class="cx-kicker">AMPLIGUARD</p>
          <h2>Financeiro</h2>
        </div>
        <div class="cx-head-tools">
          <label>Mês<input id="caixaOpMes" type="month" value="${esc(mesAtivo())}" /></label>
          <label class="cx-search">Busca<input id="caixaOpBusca" type="search" placeholder="Placa ou responsável" /></label>
          <button type="button" class="cx-btn" id="caixaOpNova">+ Novo lançamento</button>
        </div>
      </header>
      <div class="cx-metrics" id="caixaOpMetrics" hidden></div>
      <div class="cx-filters" id="caixaOpFiltros">
        <button type="button" class="cx-chip is-on" data-cx-filtro="entradas">Entradas</button>
        <button type="button" class="cx-chip" data-cx-filtro="saidas">Saídas</button>
        <button type="button" class="cx-chip" data-cx-filtro="caixa">Caixa</button>
      </div>
      <div class="cx-tools" id="caixaOpTools"></div>
      <p id="caixaOpErro" class="cx-empty" hidden></p>
      <div id="caixaOpLista"></div>
      <div id="caixaOpBar" class="cx-bar"></div>`;
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
    if (e.target.id === "caixaOpMes") {
      mesSelecionado = e.target.value || mesAtual();
      limiteLista = 200;
      pintar();
      return;
    }
    if (e.target.id === "caixaOpBusca") q = e.target.value || "";
    if (e.target.id === "caixaOpDe") de = e.target.value || "";
    if (e.target.id === "caixaOpAte") ate = e.target.value || "";
    if (e.target.id === "caixaOpTipo") tipoMov = e.target.value || "";
    pintarLista();
    pintarBarra();
  }

  function pintar() {
    contasCache = null;
    catalogCache = null;
    linhaMap = null;
    recebivelMap = null;
    veiculoMap = null;
    try {
      pintarTotais();
      pintarFiltros();
      pintarLista();
      pintarBarra();
      const erro = document.getElementById("caixaOpErro");
      if (erro) erro.hidden = true;
    } catch (err) {
      console.error("financeiro", err);
      const erro = document.getElementById("caixaOpErro");
      if (erro) {
        erro.hidden = false;
        erro.textContent = `Não foi possível montar o financeiro. Os registros continuam salvos. ${err?.message || ""}`;
      }
    }
  }

  function movimentosCaixa() {
    const bruto = dados()?.cash || [];
    const lista = typeof global.financeDedupeCaixaMovs === "function" ? global.financeDedupeCaixaMovs(bruto) : bruto;
    return (lista || []).filter((mov) => mov && mov.excluir_do_saldo !== true);
  }

  function movimentoEhEntrada(mov) {
    if (typeof global.financeCashIsEntrada === "function") return global.financeCashIsEntrada(mov);
    const t = String(mov?.tipo_conta || "").toUpperCase();
    return t === "RECEBER" || t === "ENTRADA";
  }

  function movimentoEhSaida(mov) {
    if (typeof global.financeCashIsSaida === "function") return global.financeCashIsSaida(mov);
    const t = String(mov?.tipo_conta || "").toUpperCase();
    return t === "PAGAR" || t === "SAIDA" || t === "DESPESA";
  }

  function entradasPendentes() {
    const itens = [];
    const vistos = new Set();
    const marcar = (ids) => ids.forEach((id) => id && vistos.add(String(id)));
    for (const row of faturasAbertas()) {
      const snap = svc().paymentSnapshot(row.valor_total, row.valor_recebido || 0);
      itens.push({
        tipo: "fatura",
        id: row.id,
        titulo: row.identificador || `FAT-${String(row.numero_cobranca || 0).padStart(6, "0")}`,
        cliente: row.parceiro_nome || "Cliente",
        data: row.data_geracao,
        venc: row.data_vencimento,
        valor: Number(row.valor_total || 0),
        saldo: snap.saldo,
        situacao: Number(row.valor_recebido || 0) > 0 ? "Parcial" : "Faturado",
      });
      marcar((itensPorCobranca.get(String(row.id)) || []).map((item) => item.receivable_id));
    }
    for (const fat of faturasAntigasEmAberto()) {
      itens.push({
        tipo: "fatura",
        id: fat.row.id,
        titulo: fat.row.identificador || `FAT-${String(fat.row.numero_cobranca || 0).padStart(6, "0")}`,
        cliente: fat.row.parceiro_nome || "Cliente",
        data: fat.row.data_geracao,
        venc: fat.row.data_vencimento,
        valor: Number(fat.row.valor_total || fat.saldo),
        saldo: fat.saldo,
        situacao: "Faturado",
      });
      marcar(fat.ids);
    }
    for (const line of linhasAReceber()) {
      if (vistos.has(String(line.receivableId))) continue;
      const r = line.receivable || recebivelPorId(line.receivableId);
      itens.push({
        tipo: "veiculo",
        id: line.receivableId,
        titulo: rotuloLinha(line),
        cliente: r?.cobranca_destinatario_nome || nomeLinha(line),
        data: r?.faturado_em || r?.contas_receber_em || line.saida || line.entrada,
        venc: (typeof global.financeContaDueYmd === "function" ? global.financeContaDueYmd(r, "receivable") : "") || r?.data_vencimento || "",
        valor: Number(line.valor || 0),
        saldo: Number(line.valor || 0),
        situacao: "Faturado",
      });
    }
    for (const line of linhasAFaturar()) {
      if (vistos.has(String(line.receivableId))) continue;
      const r = line.receivable || recebivelPorId(line.receivableId);
      itens.push({
        tipo: "veiculo",
        id: line.receivableId,
        titulo: rotuloLinha(line),
        cliente: nomeLinha(line),
        data: line.saida || line.entrada,
        venc: r?.data_vencimento || "",
        valor: Number(line.valor || 0),
        saldo: saldoLinha(line),
        situacao: "Pendente",
      });
    }
    const ordem = { Faturado: 0, Parcial: 1, Pendente: 2 };
    return itens
      .filter((item) => {
        if (!passaPeriodo(item.data || item.venc)) return false;
        const blob = `${item.titulo} ${item.cliente} ${item.situacao}`.toLowerCase();
        return !q || blob.includes(q.toLowerCase());
      })
      .sort((a, b) => (ordem[a.situacao] ?? 9) - (ordem[b.situacao] ?? 9) || String(a.cliente).localeCompare(String(b.cliente), "pt-BR"));
  }

  function pagamentoDaDespesa(p) {
    const direta = ymd(p?.data_pagamento);
    if (direta) return direta;
    const mov = movimentosCaixa().find((m) => movimentoEhSaida(m) && String(m.conta_id || "") === String(p?.id || ""));
    return mov ? ymd(mov.data_movimento || mov.created_at) : "";
  }

  function saidasDoMes() {
    const apura = apurarMes(mesAtivo());
    return apura.despesas.filter((p) => {
      if (!passaPeriodo(p.data_vencimento || p.created_at)) return false;
      const blob = `${textoDespesa(p)} ${p.categoria || ""} ${p.fornecedor || ""} ${p.favorecido || ""}`.toLowerCase();
      return !q || blob.includes(q.toLowerCase());
    });
  }

  function vistaAtual() {
    if (filtro === "saidas" || filtro === "despesas") return "saidas";
    if (filtro === "caixa" || filtro === "movimentacoes" || filtro === "historico" || filtro === "recebidos" || filtro === "recebido") return "caixa";
    return "entradas";
  }

  function saldoAbertoEntradas() {
    if (!svc()) return 0;
    const busca = q;
    const inicio = de;
    const fim = ate;
    const corte = prazo;
    q = "";
    de = "";
    ate = "";
    prazo = "";
    const total = entradasPendentes().reduce((s, item) => s + Number(item.saldo || 0), 0);
    q = busca;
    de = inicio;
    ate = fim;
    prazo = corte;
    return round(total);
  }

  function classePrazo(item) {
    const venc = ymd(item.venc);
    if (!venc) return "";
    if (venc < today()) return "atrasado";
    return "vencer";
  }

  function saldoAReceberAcumulado() {
    const busca = q;
    const inicio = de;
    const fim = ate;
    q = "";
    de = "";
    ate = "";
    const total = entradasPendentes()
      .filter((item) => item.situacao === "Faturado" || item.situacao === "Parcial")
      .reduce((s, item) => s + Number(item.saldo || 0), 0);
    q = busca;
    de = inicio;
    ate = fim;
    return total;
  }

  function pintarFiltros() {
    const vista = vistaAtual();
    document.querySelectorAll("[data-cx-filtro]").forEach((btn) => {
      btn.classList.toggle("is-on", btn.getAttribute("data-cx-filtro") === vista);
    });
    const busca = document.getElementById("caixaOpBusca");
    if (busca) {
      busca.placeholder = vista === "saidas" ? "Descrição ou categoria" : vista === "caixa" ? "Descrição" : "Placa ou responsável";
    }
    const tools = document.getElementById("caixaOpTools");
    if (tools) {
      tools.innerHTML = vista === "entradas"
        ? `<button type="button" class="cx-chip ${prazo === "" ? "is-on" : ""}" data-cx-prazo="">Todos</button>
           <button type="button" class="cx-chip ${prazo === "vencer" ? "is-on" : ""}" data-cx-prazo="vencer">A vencer</button>
           <button type="button" class="cx-chip ${prazo === "atrasado" ? "is-on" : ""}" data-cx-prazo="atrasado">Atrasados</button>`
        : "";
    }
  }

  function pintarTotais() {
    const box = document.getElementById("caixaOpMetrics");
    if (!box) return;
    if (vistaAtual() !== "caixa") {
      box.hidden = true;
      box.innerHTML = "";
      return;
    }
    const s = saldoCaixa(mesAtivo());
    const card = (classe, nome, valor, nota) =>
      `<div class="cx-metric ${classe}"><span>${nome}</span><strong>${esc(money(valor))}</strong><small>${esc(nota)}</small></div>`;
    box.hidden = false;
    box.innerHTML =
      card("cx-wait", "Saldo inicial", s.inicial, "Transportado") +
      card("cx-in", "Total recebido", s.recebido, nomeMes(s.mes)) +
      card("cx-out", "Total pago", s.pago, nomeMes(s.mes)) +
      card("cx-result", "Saldo final", s.final, "Inicial + recebido − pago");
  }

  function linhaHtml(line, grupoNome, situacao) {
    const saldo = saldoLinha(line);
    const on = selected.has(line.receivableId) ? "checked" : "";
    const tag = situacao || "A faturar";
    return `<div class="cx-row" data-cx-open="veiculo" data-cx-id="${esc(line.receivableId)}">
      <input class="cx-check" type="checkbox" data-cx-check="${esc(line.receivableId)}" ${on} aria-label="Selecionar ${esc(line.placa || "veículo")}" />
      <span class="cx-title">${esc(rotuloLinha(line))}</span>
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

  function dataCurta(v) {
    if (!v) return "—";
    return svc().formatDate(v);
  }

  function placasDaCobranca(row) {
    const items = itensPorCobranca.get(String(row.id)) || [];
    const placas = items
      .map((item) =>
        rotuloLinha({
          receivableId: item.receivable_id,
          placa: item.snapshot?.placa,
          veiculoNome: item.snapshot?.veiculo,
        })
      )
      .filter((txt) => txt && txt !== "Veículo");
    if (placas.length) return placas.join(", ");
    const n = items.length || Number(row.quantidade_veiculos || 0);
    return n ? `${n} veículo${n === 1 ? "" : "s"}` : "—";
  }

  function faturaReceberHtml(row, saldo) {
    const ident = row.identificador || `FAT-${String(row.numero_cobranca || 0).padStart(6, "0")}`;
    const st = String(row.status || "").toUpperCase();
    const podeMarcar = st === "PENDENTE" || st === "PARCIAL";
    const check = podeMarcar
      ? `<input class="cx-check" type="checkbox" data-cx-fat="${esc(row.id)}" ${selected.has(`fat:${row.id}`) ? "checked" : ""} aria-label="Selecionar ${esc(ident)}" />`
      : "<span></span>";
    return `<div class="cx-row" data-cx-open="fatura" data-cx-id="${esc(row.id)}">
      ${check}
      <span class="cx-title">${esc(ident)}<br><small>${esc(placasDaCobranca(row))}</small></span>
      <span class="cx-client">${esc(row.parceiro_nome || "Cliente")}<br><small>Emissão ${esc(dataCurta(row.data_geracao))} · Venc. ${esc(dataCurta(row.data_vencimento))}</small></span>
      <span class="cx-num cx-hide-sm">${esc(money(row.valor_total))}</span>
      <span class="cx-num cx-hide-sm">${esc(money(row.valor_recebido || 0))}</span>
      <span class="cx-num cx-values">${esc(money(saldo))}</span>
      <span class="cx-tag receber">A receber</span>
    </div>`;
  }

  function linhaReceberHtml(line) {
    const r = line.receivable || recebivelPorId(line.receivableId);
    const v = veiculoDo(r);
    const cob = cobrancaPorRecebivelId.get(String(r?.id || ""));
    const numero = cob?.identificador || v?.placa || line.placa || "Conta a receber";
    const cliente = r?.cobranca_destinatario_nome || nomeLinha(line);
    const emissao = r?.faturado_em || r?.contas_receber_em || r?.created_at;
    const venc = typeof global.financeContaDueYmd === "function" ? global.financeContaDueYmd(r, "receivable") : r?.period_end;
    const on = selected.has(line.receivableId) ? "checked" : "";
    return `<div class="cx-row" data-cx-open="veiculo" data-cx-id="${esc(line.receivableId)}">
      <input class="cx-check" type="checkbox" data-cx-check="${esc(line.receivableId)}" ${on} aria-label="Selecionar ${esc(numero)}" />
      <span class="cx-title">${esc(cob?.identificador ? numero : rotuloLinha(line))}${cob?.identificador ? `<br><small>${esc(rotuloLinha(line))}</small>` : ""}</span>
      <span class="cx-client">${esc(cliente)}<br><small>Emissão ${esc(dataCurta(emissao))} · Venc. ${esc(dataCurta(venc))}</small></span>
      <span class="cx-num cx-hide-sm">${esc(money(line.valor))}</span>
      <span class="cx-num cx-hide-sm">${esc(money(0))}</span>
      <span class="cx-num cx-values">${esc(money(line.valor))}</span>
      <span class="cx-tag receber">A receber</span>
    </div>`;
  }

  function linhaMovimentoHtml(item) {
    return `<div class="cx-row" data-cx-open="${esc(item.tipo)}" data-cx-id="${esc(item.id)}">
      <span></span>
      <span class="cx-title">${esc(item.titulo)}</span>
      <span class="cx-client">${esc(item.cliente)}<br><small>${esc(dataCurta(item.data))} · Venc. ${esc(dataCurta(item.venc))}</small></span>
      <span class="cx-num cx-hide-sm">${esc(money(item.valor))}</span>
      <span class="cx-num cx-hide-sm">${esc(money(Number(item.valor || 0) - Number(item.saldo || 0)))}</span>
      <span class="cx-num cx-values">${esc(money(item.saldo))}</span>
      <span class="cx-tag ${item.situacao === "Pendente" ? "" : "receber"}">${esc(item.situacao)}</span>
    </div>`;
  }

  function celula(label, html, classe) {
    return `<td data-label="${esc(label)}" class="${classe || ""}">${html}</td>`;
  }

  function statusTag(nome, classe) {
    return `<span class="cx-tag ${classe || ""}">${esc(nome)}</span>`;
  }

  function maisBotao(total, pagina) {
    if (total <= pagina) return "";
    return `<button type="button" class="cx-btn secondary" data-cx-mais="1">Mostrar mais ${total - pagina}</button>`;
  }

  function tabela(colunas, linhas, vazio) {
    if (!linhas.length) return `<p class="cx-empty">${vazio}</p>`;
    const head = colunas.map((c) => `<th class="${c.num ? "num" : ""}">${esc(c)}</th>`).join("");
    return `<div class="cx-table-wrap"><table class="cx-table"><thead><tr>${head}</tr></thead><tbody>${linhas.join("")}</tbody></table></div>`;
  }

  function situacaoEntrada(item) {
    if (item.situacao === "Parcial") return "Parcial";
    if (item.situacao === "Faturado") return "Faturado";
    return "Em aberto";
  }

  function contaMovimento(mov) {
    return mov?.conta_nome || mov?.conta_financeira || mov?.banco || mov?.conta || "Caixa";
  }

  function pintarVista() {
    const box = document.getElementById("caixaOpLista");
    const vista = vistaAtual();
    const mes = nomeMes(mesAtivo());
    if (vista === "entradas") {
      let itens = entradasPendentes();
      if (prazo) itens = itens.filter((item) => classePrazo(item) === prazo);
      const pagina = itens.slice(0, limiteLista);
      const rows = pagina.map((item) => {
        const check = item.tipo === "fatura"
          ? `<input class="cx-check" type="checkbox" data-cx-fat="${esc(item.id)}" ${selected.has(`fat:${item.id}`) ? "checked" : ""} aria-label="Selecionar" />`
          : `<input class="cx-check" type="checkbox" data-cx-check="${esc(item.id)}" ${selected.has(item.id) ? "checked" : ""} aria-label="Selecionar" />`;
        const partes = String(item.titulo || "").split("•");
        const placa = item.tipo === "fatura" ? item.titulo : (partes[0] || item.titulo || "—").trim();
        const veiculo = item.tipo === "fatura" ? "Fatura" : (partes.slice(1).join("•") || "—").trim();
        return `<tr data-cx-open="${esc(item.tipo)}" data-cx-id="${esc(item.id)}">
          ${celula("", check, "cx-check-cell")}
          ${celula("Placa", esc(placa || "—"))}
          ${celula("Veículo", esc(veiculo || "—"))}
          ${celula("Responsável", esc(item.cliente || "—"))}
          ${celula("Saída", esc(dataCurta(item.data)))}
          ${celula("Vencimento", esc(dataCurta(item.venc)))}
          ${celula("Valor", esc(money(item.valor)), "num")}
          ${celula("Saldo", esc(money(item.saldo)), "num")}
          ${celula("Situação", statusTag(situacaoEntrada(item), classePrazo(item) === "atrasado" ? "saida" : "receber"))}
          ${celula("", `<button type="button" class="cx-btn" data-cx-receber="${esc(item.id)}" data-cx-tipo="${esc(item.tipo)}">Marcar recebido</button>`)}
        </tr>`;
      });
      box.innerHTML = `<p class="cx-note">Cobranças com saldo. Recebido no ato aparece no Caixa; faturado continua aqui até a quitação.</p>${tabela(["", "Placa", "Veículo", "Responsável", "Saída", "Vencimento", "Valor", "Saldo", "Situação", ""], rows, "Nenhuma cobrança com saldo.")}${maisBotao(itens.length, pagina.length)}`;
      return true;
    }
    if (vista === "saidas") {
      const todas = saidasDoMes();
      const apura = apurarMes(mesAtivo());
      const pagina = todas.slice(0, limiteLista);
      const rows = pagina.map((p) => {
        const paga = despesaPaga(p);
        return `<tr data-cx-open="despesa" data-cx-id="${esc(p.id)}">
          ${celula("Descrição", esc(textoDespesa(p)))}
          ${celula("Categoria", esc(p.categoria || p.payable_category || "Outras"))}
          ${celula("Competência", esc(nomeMes(competenciaDespesa(p))))}
          ${celula("Vencimento", esc(dataCurta(p.data_vencimento)))}
          ${celula("Valor", esc(money(p.valor)), "num")}
          ${celula("Situação", paga ? statusTag("Pago", "pago") : statusTag(ymd(p.data_vencimento) && ymd(p.data_vencimento) < today() ? "Vencida" : "A pagar", "saida"))}
          ${celula("", paga ? "" : `<button type="button" class="cx-btn" data-cx-pagar="${esc(p.id)}">Marcar pago</button>`)}
        </tr>`;
      });
      const anteriores = Object.entries(apura.abertoPorMes || {}).filter(([k, v]) => k && k < apura.mes && Number(v) > 0);
      const aviso = anteriores.length ? ` Há despesas vencidas em meses anteriores; elas continuam pendentes no mês de cada uma.` : "";
      box.innerHTML = `<p class="cx-note">${esc(mes)} · a pagar ${esc(money(apura.aPagar))}. Só entra no Caixa quando o pagamento é confirmado.${esc(aviso)}</p>${tabela(["Descrição", "Categoria", "Competência", "Vencimento", "Valor", "Situação", ""], rows, `Nenhuma despesa de ${esc(mes)}.`)}${maisBotao(todas.length, pagina.length)}`;
      return true;
    }
    if (vista === "caixa") {
      const s = saldoCaixa(mesAtivo());
      const movs = (apurarMes(mesAtivo()).movs || []).filter((mov) => {
        const blob = `${descricaoMovimento(mov)} ${mov.descricao || ""} ${mov.forma_pagamento || ""} ${contaMovimento(mov)}`.toLowerCase();
        return !q || blob.includes(q.toLowerCase());
      });
      const pagina = movs.slice(0, limiteLista);
      const rows = pagina.map((mov) => {
        const entrada = movimentoEhEntrada(mov);
        return `<tr data-cx-open="caixa" data-cx-id="${esc(mov.id)}">
          ${celula("Data", esc(dataCurta(mov.data_movimento || mov.created_at)))}
          ${celula("Descrição", esc(descricaoMovimento(mov)))}
          ${celula("Origem / destino", esc(entrada ? "Recebimento" : "Pagamento"))}
          ${celula("Conta", esc(contaMovimento(mov)))}
          ${celula("Forma", esc(mov.forma_pagamento || "—"))}
          ${celula("Valor", esc(money(entrada ? mov.valor : -Number(mov.valor || 0))), "num")}
        </tr>`;
      });
      box.innerHTML = `<p class="cx-note">${esc(mes)} · saldo final ${esc(money(s.final))}. Pendências de Entradas e Saídas não entram neste saldo.</p>${tabela(["Data", "Descrição", "Origem / destino", "Conta", "Forma", "Valor"], rows, `Nenhuma movimentação em ${esc(mes)}.`)}${maisBotao(movs.length, pagina.length)}`;
      return true;
    }
    if (vista === "movimentacoes") {
      const apura = apurarMes(mesAtivo());
      const movs = apura.movs.filter((mov) => {
        if (!passaPeriodo(mov.data_movimento || mov.created_at)) return false;
        if (tipoMov === "entrada" && !movimentoEhEntrada(mov)) return false;
        if (tipoMov === "saida" && !movimentoEhSaida(mov)) return false;
        const blob = `${descricaoMovimento(mov)} ${mov.descricao || ""} ${mov.forma_pagamento || ""}`.toLowerCase();
        return !q || blob.includes(q.toLowerCase());
      });
      const pagina = movs.slice(0, limiteLista);
      const rows = pagina.map((mov) => {
        const entrada = movimentoEhEntrada(mov);
        return `<tr data-cx-open="caixa" data-cx-id="${esc(mov.id)}">
          ${celula("Descrição", esc(descricaoMovimento(mov)))}
          ${celula("Data", esc(dataCurta(mov.data_movimento || mov.created_at)))}
          ${celula("Forma", esc(mov.forma_pagamento || "—"))}
          ${celula("Valor", esc(money(entrada ? mov.valor : -Number(mov.valor || 0))), "num")}
          ${celula("Tipo", statusTag(entrada ? "Entrada" : "Saída", entrada ? "pago" : "saida"))}
        </tr>`;
      });
      box.innerHTML = `<p class="cx-note">${esc(mes)} · só o dinheiro que entrou ou saiu. Resultado ${esc(money(apura.resultado))}.</p>${tabela(["Descrição", "Data", "Forma", "Valor", "Tipo"], rows, `Nenhuma movimentação em ${esc(mes)}.`)}${maisBotao(movs.length, pagina.length)}`;
      return true;
    }
    if (vista === "recebidos") {
      const apura = apurarMes(mesAtivo());
      const movs = apura.movs.filter((mov) => movimentoEhEntrada(mov) && (!q || `${descricaoMovimento(mov)} ${mov.descricao || ""}`.toLowerCase().includes(q.toLowerCase())));
      const pagina = movs.slice(0, limiteLista);
      const rows = pagina.map((mov) => `<tr data-cx-open="caixa" data-cx-id="${esc(mov.id)}">
        ${celula("Descrição", esc(descricaoMovimento(mov)))}
        ${celula("Data", esc(dataCurta(mov.data_movimento || mov.created_at)))}
        ${celula("Forma", esc(mov.forma_pagamento || "—"))}
        ${celula("Valor", esc(money(mov.valor)), "num")}
        ${celula("Status", statusTag("Recebido", "pago"))}
      </tr>`);
      box.innerHTML = `<p class="cx-note">Recebidos em ${esc(mes)}. Este valor não é o saldo a receber.</p>${tabela(["Descrição", "Data", "Forma", "Valor", "Status"], rows, `Nenhum recebimento em ${esc(mes)}.`)}${maisBotao(movs.length, pagina.length)}`;
      return true;
    }
    if (vista === "despesas") {
      const todas = saidasDoMes();
      const apura = apurarMes(mesAtivo());
      const pagina = todas.slice(0, limiteLista);
      const rows = pagina.map((p) => {
        const paga = despesaPaga(p);
        return `<tr data-cx-open="despesa" data-cx-id="${esc(p.id)}">
          ${celula("Descrição", esc(textoDespesa(p)))}
          ${celula("Categoria", esc(p.categoria || p.payable_category || "Outras"))}
          ${celula("Competência", esc(nomeMes(competenciaDespesa(p))))}
          ${celula("Vencimento", esc(dataCurta(p.data_vencimento)))}
          ${celula("Valor", esc(money(p.valor)), "num")}
          ${celula("Situação", paga ? statusTag("Pago", "pago") : `<button type="button" class="cx-btn" data-cx-pagar="${esc(p.id)}">Pagar</button>`)}
        </tr>`;
      });
      box.innerHTML = `<p class="cx-note">${esc(mes)} · a pagar ${esc(money(apura.aPagar))}. Saída efetiva do caixa: ${esc(money(apura.saidasPagas))}.</p>${tabela(["Descrição", "Categoria", "Competência", "Vencimento", "Valor", "Situação"], rows, `Nenhuma despesa de ${esc(mes)}. Meses futuros não entram aqui.`)}${maisBotao(todas.length, pagina.length)}`;
      return true;
    }
    if (vista === "a_receber") {
      const itens = entradasPendentes().filter((item) => item.situacao === "Faturado" || item.situacao === "Parcial");
      const pagina = itens.slice(0, limiteLista);
      const rows = pagina.map((item) => {
        const recebido = Math.max(0, Number(item.valor || 0) - Number(item.saldo || 0));
        const check = item.tipo === "fatura"
          ? `<input class="cx-check" type="checkbox" data-cx-fat="${esc(item.id)}" ${selected.has(`fat:${item.id}`) ? "checked" : ""} aria-label="Selecionar" />`
          : `<input class="cx-check" type="checkbox" data-cx-check="${esc(item.id)}" ${selected.has(item.id) ? "checked" : ""} aria-label="Selecionar" />`;
        return `<tr data-cx-open="${esc(item.tipo)}" data-cx-id="${esc(item.id)}">
          ${celula("", check, "cx-check-cell")}
          ${celula("Cliente", esc(item.cliente || "Cliente"))}
          ${celula("Placa", esc(item.titulo || "—"))}
          ${celula("Valor", esc(money(item.valor)), "num")}
          ${celula("Recebido", esc(money(recebido)), "num")}
          ${celula("Saldo", esc(money(item.saldo)), "num")}
          ${celula("Vencimento", esc(dataCurta(item.venc)))}
          ${celula("Status", statusTag(item.situacao, "receber"))}
        </tr>`;
      });
      box.innerHTML = `<p class="cx-note">Saldo acumulado a receber, inclusive cobranças de meses anteriores. Faturado ainda não é dinheiro recebido.</p>${tabela(["", "Cliente", "Placa / fatura", "Valor", "Recebido", "Saldo", "Vencimento", "Status"], rows, "Nenhuma conta a receber em aberto.")}${maisBotao(itens.length, pagina.length)}`;
      return true;
    }
    if (vista === "a_faturar") {
      const linhas = linhasAFaturar();
      const pagina = linhas.slice(0, limiteLista);
      const rows = pagina.map((line) => `<tr data-cx-open="veiculo" data-cx-id="${esc(line.receivableId)}">
        ${celula("", `<input class="cx-check" type="checkbox" data-cx-check="${esc(line.receivableId)}" ${selected.has(line.receivableId) ? "checked" : ""} aria-label="Selecionar" />`, "cx-check-cell")}
        ${celula("Cliente", esc(nomeLinha(line)))}
        ${celula("Veículo", esc(rotuloLinha(line)))}
        ${celula("Valor", esc(money(line.valor)), "num")}
        ${celula("Recebido", esc(money(line.abatimento || 0)), "num")}
        ${celula("Saldo", esc(money(saldoLinha(line))), "num")}
        ${celula("Vencimento", esc(dataCurta(line.saida || line.entrada)))}
        ${celula("Status", statusTag("A faturar", ""))}
      </tr>`);
      box.innerHTML = `<p class="cx-note">Veículos ainda sem cobrança. Selecione vários do mesmo cliente para gerar uma fatura só.</p>${tabela(["", "Cliente", "Veículo", "Valor", "Recebido", "Saldo", "Referência", "Status"], rows, "Nenhum valor pendente de cobrança.")}${maisBotao(linhas.length, pagina.length)}`;
      return true;
    }
    return false;
  }

  function pintarLista() {
    const box = document.getElementById("caixaOpLista");
    if (!box || !svc()) return;
    if (pintarVista()) return;
    if (filtro === "entradas") {
      const itens = entradasPendentes();
      const aReceber = itens.filter((item) => item.situacao === "Faturado" || item.situacao === "Parcial").length;
      const aFaturar = itens.filter((item) => item.situacao === "Pendente").length;
      const pagina = itens.slice(0, limiteLista);
      const mais = itens.length > pagina.length
        ? `<button type="button" class="cx-btn" data-cx-mais="1">Mostrar mais ${itens.length - pagina.length}</button>`
        : "";
      box.innerHTML = itens.length
        ? `<p class="cx-total">A receber: ${aReceber} · A faturar: ${aFaturar}</p><div class="cx-group"><div class="cx-group-head"><span></span><span>Placa / fatura</span><span>Cliente</span><span class="cx-num cx-hide-sm">Valor</span><span class="cx-num cx-hide-sm">Recebido</span><span class="cx-num">Saldo</span><span></span></div>${pagina.map(linhaMovimentoHtml).join("")}</div>${mais}`
        : `<p class="cx-empty">Nenhuma entrada pendente. Contas a receber e valores a faturar aparecem aqui.</p>`;
      return;
    }
    if (filtro === "saidas") {
      const todas = saidasDoMes();
      const apura = apurarMes(mesAtivo());
      const itens = todas.slice(0, limiteLista);
      const mais = todas.length > itens.length
        ? `<button type="button" class="cx-btn" data-cx-mais="1">Mostrar mais ${todas.length - itens.length}</button>`
        : "";
      box.innerHTML = itens.length
        ? `<p class="cx-total">${esc(nomeMes(apura.mes))} · A pagar ${esc(money(apura.aPagar))} · Pagas na competência ${esc(money(apura.despesas.filter(despesaPaga).reduce((s, p) => s + Number(p.valor || 0), 0)))}. O pagamento só reduz o Caixa na data em que o dinheiro saiu.</p><div class="cx-group">${itens
            .map((p) => {
              const paga = despesaPaga(p);
              const pagoEm = pagamentoDaDespesa(p);
              return `<div class="cx-row">
                <span></span>
                <span class="cx-title">${esc(textoDespesa(p))}<br><small>${esc(p.categoria || p.payable_category || "Outras")}</small></span>
                <span class="cx-client">${esc(p.fornecedor || p.favorecido || "—")}<br><small>Competência ${esc(nomeMes(competenciaDespesa(p)))} · Venc. ${esc(dataCurta(p.data_vencimento))}${pagoEm ? ` · Pago em ${esc(dataCurta(pagoEm))}` : ""}</small></span>
                <span class="cx-num cx-hide-sm">${esc(money(p.valor))}</span>
                <span class="cx-num cx-hide-sm">${paga ? "Pago" : "Pendente"}</span>
                <span class="cx-num cx-values">${esc(money(paga ? 0 : p.valor))}</span>
                ${paga ? `<span class="cx-tag pago">Pago</span>` : `<button type="button" class="cx-btn" data-cx-pagar="${esc(p.id)}">Pagar</button>`}
              </div>`;
            })
            .join("")}</div>${mais}`
        : `<p class="cx-empty">Nenhuma despesa de ${esc(nomeMes(mesAtivo()))}. Meses futuros não entram nesta conta.</p>`;
      return;
    }
    if (filtro === "caixa") {
      const apura = apurarMes(mesAtivo());
      const movs = apura.movs.filter((mov) => {
        if (!passaPeriodo(mov.data_movimento || mov.created_at)) return false;
        if (tipoMov === "entrada" && !movimentoEhEntrada(mov)) return false;
        if (tipoMov === "saida" && !movimentoEhSaida(mov)) return false;
        const blob = `${mov.descricao || ""} ${mov.forma_pagamento || ""} ${mov.categoria || ""}`.toLowerCase();
        return !q || blob.includes(q.toLowerCase());
      });
      const pagina = movs.slice(0, limiteLista);
      const corpo = pagina
        .map((mov) => {
          const entrada = movimentoEhEntrada(mov);
          return `<div class="cx-row" data-cx-open="caixa" data-cx-id="${esc(mov.id)}">
            <span></span>
            <span class="cx-title">${esc(descricaoMovimento(mov))}</span>
            <span class="cx-client">${esc(dataCurta(mov.data_movimento || mov.created_at))} · ${esc(mov.forma_pagamento || "")}</span>
            <span class="cx-num cx-hide-sm">${entrada ? esc(money(mov.valor)) : ""}</span>
            <span class="cx-num cx-hide-sm">${entrada ? "" : esc(money(mov.valor))}</span>
            <span class="cx-num cx-values">${esc(money(entrada ? mov.valor : -Number(mov.valor || 0)))}</span>
            <span class="cx-tag ${entrada ? "pago" : "receber"}">${entrada ? "Entrada" : "Saída"}</span>
          </div>`;
        })
        .join("");
      const mais = movs.length > pagina.length
        ? `<button type="button" class="cx-btn" data-cx-mais="1">Mostrar mais ${movs.length - pagina.length}</button>`
        : "";
      box.innerHTML = `<p class="cx-total">${esc(nomeMes(apura.mes))} · Recebido ${esc(money(apura.entradasRecebidas))} · Pago ${esc(money(apura.saidasPagas))} · Resultado ${esc(money(apura.resultado))}. Conta só o dinheiro que entrou ou saiu neste mês.</p><div class="cx-group"><div class="cx-group-head"><span></span><span>Movimento</span><span>Data</span><span class="cx-num cx-hide-sm">Entrada</span><span class="cx-num cx-hide-sm">Saída</span><span class="cx-num">Valor</span><span></span></div>${corpo || `<p class="cx-empty">Nenhuma movimentação confirmada em ${esc(nomeMes(apura.mes))}.</p>`}</div>${mais}`;
      return;
    }
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
    if (filtro === "a_receber") {
      const linhas = linhasAReceber();
      const faturas = faturasAbertas();
      const antigas = faturasAntigasEmAberto();
      if (!linhas.length && !faturas.length && !antigas.length) {
        box.innerHTML = `<p class="cx-empty">Nenhuma cobrança em aberto.</p>`;
        return;
      }
      const contaHtml = linhas.map((line) => linhaReceberHtml(line)).join("");
      const novasHtml = faturas.map((row) => faturaReceberHtml(row, svc().paymentSnapshot(row.valor_total, row.valor_recebido || 0).saldo)).join("");
      const antigasHtml = antigas.map((fat) => faturaReceberHtml(fat.row, fat.saldo)).join("");
      box.innerHTML = `<div class="cx-group"><div class="cx-group-head"><span></span><span>Fatura</span><span>Cliente</span><span class="cx-num cx-hide-sm">Original</span><span class="cx-num cx-hide-sm">Recebido</span><span class="cx-num">Saldo</span><span></span></div>${novasHtml}${antigasHtml}${contaHtml}</div>`;
      return;
    }
    if (filtro === "a_faturar") {
      const linhas = linhasAFaturar();
      const grupos = gruposAFaturar(linhas);
      if (!grupos.length) {
        box.innerHTML = `<p class="cx-empty">Nenhum valor pendente de cobrança.</p>`;
        return;
      }
      const tag = "A faturar";
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
            ${aberto ? g.linhas.map((l) => linhaHtml(l, g.nome, "A faturar")).join("") : ""}
          </section>`;
        })
        .join("");
      box.innerHTML = gruposHtml;
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
    if (!n || vistaAtual() !== "entradas") {
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
    const prazoBtn = e.target.closest("[data-cx-prazo]");
    if (prazoBtn) {
      prazo = prazoBtn.getAttribute("data-cx-prazo") || "";
      limiteLista = 200;
      pintar();
      return;
    }
    const receberBtn = e.target.closest("[data-cx-receber]");
    if (receberBtn) {
      const id = receberBtn.getAttribute("data-cx-receber");
      const tipo = receberBtn.getAttribute("data-cx-tipo");
      if (tipo === "fatura") mostrarFatura(id);
      else mostrarVeiculo(id);
      return;
    }
    const filtroBtn = e.target.closest("[data-cx-filtro]");
    if (filtroBtn) {
      filtro = filtroBtn.getAttribute("data-cx-filtro");
      selected = new Set();
      limiteLista = 200;
      pintar();
      return;
    }
    if (e.target.closest("[data-cx-mais]")) {
      limiteLista += 200;
      pintarLista();
      return;
    }
    const pagar = e.target.closest("[data-cx-pagar]");
    if (pagar) {
      confirmarSaida(pagar.getAttribute("data-cx-pagar"));
      return;
    }
    if (e.target.closest("#caixaOpNova")) {
      abrirNovo();
      return;
    }
    if (e.target.closest("[data-cx-novo='cobranca']")) {
      abrirCobranca();
      return;
    }
    if (e.target.closest("[data-cx-novo='despesa']")) {
      abrirDespesa();
      return;
    }
    if (e.target.closest("[data-cx-acao='cobrar']")) {
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
      else if (tipo === "despesa") mostrarDespesa(id);
      else if (tipo === "caixa") mostrarMovimento(id);
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
      <h3>${esc(rotuloLinha(line))}</h3>
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
      <div class="cx-actions">
        ${snap.saldo > 0 ? `<button type="button" class="cx-btn" data-cx-receber-fat="${esc(row.id)}">Registrar recebimento</button>` : ""}
        <button type="button" class="cx-btn secondary" data-cx-imprimir="1">Imprimir demonstrativo</button>
      </div>
      <table class="cx-lines"><thead><tr><th>Placa</th><th>Serviço</th><th class="num">Valor</th></tr></thead>
      <tbody>${lines
        .map(
          (l) =>
            `<tr><td>${esc(rotuloLinha(l))}</td><td>${esc(l.servico || "Serviço")}</td><td class="num">${esc(money(l.valor))}</td></tr>`
        )
        .join("")}</tbody></table>
    </div>`;
    aside.addEventListener("click", (ev) => {
      if (ev.target.closest("[data-cx-receber-fat]")) {
        selected = new Set([`fat:${row.id}`]);
        aside.remove();
        abrirPagamento();
        return;
      }
      if (ev.target.closest("[data-cx-imprimir]")) {
        imprimirPainel(ident, aside.querySelector(".cx-panel")?.innerHTML || "");
        return;
      }
      if (ev.target === aside || ev.target.closest("[data-cx-fechar]")) aside.remove();
    });
    document.body.appendChild(aside);
  }

  function mostrarDespesa(id) {
    const p = (dados()?.payables || []).find((item) => String(item.id) === String(id));
    if (!p) return;
    fecharCamadas();
    const paga = despesaPaga(p);
    const pagoEm = pagamentoDaDespesa(p);
    const aside = document.createElement("div");
    aside.id = "caixaOpDetail";
    aside.className = "cx-detail";
    aside.innerHTML = `<div class="cx-panel" role="dialog">
      <button type="button" class="cx-btn secondary" data-cx-fechar="1">Fechar</button>
      <h3>${esc(textoDespesa(p))}</h3>
      <p>${esc(p.fornecedor || p.favorecido || "Sem favorecido")}</p>
      <div class="cx-dl">
        <div><span>Categoria</span><strong>${esc(p.categoria || p.payable_category || "Outras")}</strong></div>
        <div><span>Competência</span><strong>${esc(nomeMes(competenciaDespesa(p)))}</strong></div>
        <div><span>Vencimento</span><strong>${esc(dataCurta(p.data_vencimento))}</strong></div>
        <div><span>Pagamento</span><strong>${pagoEm ? esc(dataCurta(pagoEm)) : "—"}</strong></div>
        <div><span>Valor</span><strong>${esc(money(p.valor))}</strong></div>
        <div><span>Situação</span><strong>${paga ? "Pago" : "Pendente"}</strong></div>
      </div>
      <p>Pendente não reduz o resultado. A saída entra no mês em que o pagamento foi confirmado.</p>
      ${paga ? "" : `<div class="cx-actions"><button type="button" class="cx-btn" data-cx-pagar="${esc(p.id)}">Confirmar pagamento</button></div>`}
    </div>`;
    aside.addEventListener("click", (ev) => {
      if (ev.target.closest("[data-cx-pagar]")) {
        aside.remove();
        confirmarSaida(p.id);
        return;
      }
      if (ev.target === aside || ev.target.closest("[data-cx-fechar]")) aside.remove();
    });
    document.body.appendChild(aside);
  }

  function mostrarMovimento(id) {
    const mov = movimentosCaixa().find((item) => String(item.id) === String(id));
    if (!mov) return;
    const entrada = movimentoEhEntrada(mov);
    fecharCamadas();
    const aside = document.createElement("div");
    aside.id = "caixaOpDetail";
    aside.className = "cx-detail";
    aside.innerHTML = `<div class="cx-panel" role="dialog">
      <button type="button" class="cx-btn secondary" data-cx-fechar="1">Fechar</button>
      <h3>${esc(descricaoMovimento(mov))}</h3>
      <div class="cx-dl">
        <div><span>Data</span><strong>${esc(dataCurta(mov.data_movimento || mov.created_at))}</strong></div>
        <div><span>Forma</span><strong>${esc(mov.forma_pagamento || "—")}</strong></div>
        <div><span>Valor</span><strong>${esc(money(mov.valor))}</strong></div>
        <div><span>Tipo</span><strong>${entrada ? "Entrada recebida" : "Saída paga"}</strong></div>
        <div><span>Origem</span><strong>${esc(mov.conta_id || "Lançamento de caixa")}</strong></div>
      </div>
    </div>`;
    aside.addEventListener("click", (ev) => {
      if (ev.target === aside || ev.target.closest("[data-cx-fechar]")) aside.remove();
    });
    document.body.appendChild(aside);
  }

  function imprimirPainel(titulo, html) {
    const doc = `<article><h1>${esc(titulo)}</h1>${html}</article>`;
    if (typeof global.printHtmlInHiddenIframe === "function") {
      global.printHtmlInHiddenIframe(doc, { iframeTitle: titulo });
      return;
    }
    const janela = global.open?.("", "_blank");
    if (!janela) return;
    janela.document.write(doc);
    janela.print();
  }

  function abrirNovo() {
    const modal = document.getElementById("caixaOpModal");
    if (!modal) return;
    modal.innerHTML = `<div class="cx-modal-back"><div class="cx-dialog" role="dialog">
      <h3>Novo lançamento</h3>
      <p>Escolha o que vai registrar. Cobrança não é pagamento.</p>
      <div class="cx-actions">
        <button type="button" class="cx-btn" data-cx-novo="cobranca">Nova cobrança</button>
        <button type="button" class="cx-btn secondary" data-cx-novo="despesa">Nova despesa</button>
      </div>
    </div></div>`;
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
            <td>${esc(rotuloLinha(l))}</td>
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
      const rec = (dados()?.receivables || []).find((r) => String(r.id) === String(line.receivableId));
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

  function abrirDespesa() {
    const modal = document.getElementById("caixaOpModal");
    modal.innerHTML = `<div class="cx-modal-back"><form class="cx-dialog" id="caixaOpFormDespesa">
      <h3>Nova despesa</h3>
      <div class="cx-form">
        <label>Descrição<input id="cxDespDesc" required /></label>
        <label>Categoria<select id="cxDespCat"><option>Aluguel</option><option>Salários</option><option>Água</option><option>Energia</option><option>Manutenção</option><option>Fornecedores</option><option>Impostos</option><option>Outras</option></select></label>
        <label>Favorecido<input id="cxDespFav" /></label>
        <label>Valor<input id="cxDespValor" type="number" min="0.01" step="0.01" required /></label>
        <label>Data<input id="cxDespData" type="date" value="${esc(today())}" required /></label>
        <label>Vencimento<input id="cxDespVenc" type="date" value="${esc(today())}" required /></label>
        <label class="full">Observações<input id="cxDespObs" /></label>
        <label class="full"><input id="cxDespRec" type="checkbox" /> Repetir todo mês</label>
      </div>
      <button type="submit" class="cx-btn">Salvar despesa</button>
    </form></div>`;
    document.getElementById("caixaOpFormDespesa").addEventListener("submit", (ev) => {
      ev.preventDefault();
      salvarDespesa();
    });
  }

  async function salvarDespesa() {
    if (typeof global.insertManualPayableLancamento !== "function") {
      alert("Não foi possível gravar a despesa.");
      return;
    }
    const recorrente = !!document.getElementById("cxDespRec")?.checked;
    let res;
    try {
      res = await global.insertManualPayableLancamento({
      descricao: document.getElementById("cxDespDesc")?.value?.trim(),
      categoria: document.getElementById("cxDespCat")?.value || "Outras",
      fornecedor: document.getElementById("cxDespFav")?.value?.trim() || "",
      valor: Number(document.getElementById("cxDespValor")?.value || 0),
      vencimento: document.getElementById("cxDespVenc")?.value || today(),
      dataInicio: document.getElementById("cxDespData")?.value || today(),
      dataFim: recorrente ? document.getElementById("cxDespData")?.value || today() : "",
      observacoes: document.getElementById("cxDespObs")?.value?.trim() || "",
      modo: recorrente ? "RECORRENTE" : "UNICA",
      pago: false,
      lancarNoCaixa: false,
    });
    } catch (err) {
      alert(err.message || "Não foi possível gravar a despesa.");
      return;
    }
    if (res?.error || (!res?.id && !(res?.ids || []).length)) {
      alert(res?.error?.message || "Não foi possível gravar a despesa.");
      return;
    }
    fecharCamadas();
    if (typeof global.loadPayables === "function") await global.loadPayables();
    pintar();
  }

  async function confirmarSaida(id) {
    if (typeof global.finalizePayablePayment !== "function") {
      alert("Não foi possível confirmar o pagamento.");
      return;
    }
    const ok = await global.finalizePayablePayment(id, { dataMovimento: today() });
    if (!ok) return;
    if (typeof global.loadPayables === "function") await global.loadPayables();
    if (typeof global.loadCash === "function") await global.loadCash();
    pintar();
  }

  function maisDias(ymd, dias) {
    const base = new Date(`${ymd || today()}T12:00:00`);
    base.setDate(base.getDate() + dias);
    return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;
  }

  function aposLiberacao(vehicleId) {
    const linhas = (svc()?.billableLines?.() || []).filter((l) => String(l.vehicleId) === String(vehicleId) && saldoLinha(l) > 0);
    if (!linhas.length) return;
    const total = linhas.reduce((s, l) => s + Number(l.valor || 0), 0);
    const abatido = linhas.reduce((s, l) => s + Number(l.abatimento || 0), 0);
    const saldo = Math.max(0, total - abatido);
    const catalog = svc().clientCatalog();
    const modal = document.getElementById("caixaOpModal") || document.body.appendChild(document.createElement("div"));
    modal.id = "caixaOpModal";
    modal.innerHTML = `<div class="cx-modal-back"><form class="cx-dialog" id="caixaOpFormLibera">
      <h3>Entrada da liberação</h3>
      <p>${esc(linhas.map((l) => rotuloLinha(l)).join(", "))}</p>
      <div class="cx-dl">
        <div><span>Valor</span><strong>${esc(money(total))}</strong></div>
        <div><span>Já recebido</span><strong>${esc(money(abatido))}</strong></div>
        <div><span>Saldo</span><strong>${esc(money(saldo))}</strong></div>
      </div>
      <div class="cx-form">
        <label class="full">Responsável<select id="cxLibCliente"><option value="">Novo cliente</option>${catalog.map((c) => `<option value="${esc(c.nome)}">${esc(c.nome)}</option>`).join("")}</select></label>
        <label class="full">Nome<input id="cxLibNome" placeholder="Se for um cliente novo" /></label>
        <label><input type="radio" name="cxLibModo" value="vista" checked /> À vista</label>
        <label><input type="radio" name="cxLibModo" value="faturado" /> Faturado</label>
      </div>
      <button type="submit" class="cx-btn">Confirmar entrada</button>
    </form></div>`;
    document.getElementById("caixaOpFormLibera").addEventListener("submit", (ev) => {
      ev.preventDefault();
      concluirLiberacao(linhas, saldo);
    });
  }

  async function concluirLiberacao(linhas, saldo) {
    const modo = document.querySelector('input[name="cxLibModo"]:checked')?.value || "vista";
    const nome = document.getElementById("cxLibCliente")?.value || document.getElementById("cxLibNome")?.value?.trim() || "";
    const db = supabase();
    const user = uid();
    if (modo === "faturado") {
      const venc = maisDias(today(), 15);
      for (const line of linhas) {
        if (!db || !user) break;
        await db.from("receivables").update({ data_vencimento: venc, cobranca_destinatario_nome: nome || null }).eq("id", line.receivableId).eq("user_id", user);
      }
      fecharCamadas();
      if (typeof global.loadReceivables === "function") await global.loadReceivables();
      filtro = "entradas";
      pintar();
      return;
    }
    for (const line of linhas) {
      if (typeof global.finalizeReceivablePayment !== "function") break;
      await global.finalizeReceivablePayment(line.receivableId, Number(line.valor || 0), {
        quiet: true,
        skipReload: true,
        dataMovimento: today(),
        formaPagamento: "PIX",
        observacao: nome ? `À vista · ${nome}` : "À vista",
        valorOriginal: Number(line.valor || 0),
      });
    }
    fecharCamadas();
    if (typeof global.loadReceivables === "function") await global.loadReceivables();
    if (typeof global.loadCash === "function") await global.loadCash();
    filtro = "caixa";
    pintar();
  }

  function onModalClick(e) {
    if (e.target.closest("[data-cx-novo='cobranca']")) {
      abrirCobranca();
      return;
    }
    if (e.target.closest("[data-cx-novo='despesa']")) {
      abrirDespesa();
      return;
    }
    if (e.target.classList?.contains("cx-modal-back")) fecharCamadas();
  }

  async function recarregar() {
    if (typeof global.loadReceivables === "function") await global.loadReceivables();
    if (typeof global.loadCash === "function") await global.loadCash();
    if (typeof global.loadVehicles === "function") await global.loadVehicles();
    await refresh();
    if (typeof global.updateDashboard === "function") global.updateDashboard();
  }

  async function carregarItens(ids, token) {
    const map = new Map();
    const db = supabase();
    const lista = [...new Set((ids || []).filter(Boolean).map(String))];
    if (!db || !lista.length) return map;
    for (let i = 0; i < lista.length; i += 80) {
      if (token !== refreshToken) return map;
      const slice = lista.slice(i, i + 80);
      const { data, error } = await db.from("cobranca_itens").select("cobranca_id,receivable_id,valor,snapshot").in("receivable_id", slice);
      if (error) {
        console.warn("financeiro itens", error.message || error);
        break;
      }
      for (const item of data || []) {
        const key = String(item.cobranca_id);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(item);
      }
      await new Promise((resolve) => global.setTimeout(resolve, 0));
    }
    return map;
  }

  function indexarCobrancas() {
    cobrancaPorRecebivelId = new Map();
    pagosReceivableIds = new Set();
    for (const row of charges) {
      const pago = String(row.status || "").toUpperCase() === "PAGO";
      for (const item of itensPorCobranca.get(String(row.id)) || []) {
        if (!item.receivable_id) continue;
        const recId = String(item.receivable_id);
        if (!cobrancaPorRecebivelId.has(recId)) cobrancaPorRecebivelId.set(recId, row);
        if (pago) pagosReceivableIds.add(recId);
      }
    }
  }

  async function refresh() {
    if (!svc()) return;
    const token = ++refreshToken;
    ensure();
    pintar();
    try {
      await svc().refreshBlockedReceivables(uid(), supabase());
      if (token !== refreshToken) return;
      const loaded = await svc().loadCharges(uid(), supabase());
      if (token !== refreshToken) return;
      charges = loaded.rows || [];
      contasCache = null;
      const ids = contasFonte().map((r) => r.id);
      itensPorCobranca = await carregarItens(ids, token);
      if (token !== refreshToken) return;
      indexarCobrancas();
      pintar();
    } catch (err) {
      console.error("financeiro", err);
      const erro = document.getElementById("caixaOpErro");
      if (erro) {
        erro.hidden = false;
        erro.textContent = `A consulta do financeiro falhou. Os registros continuam salvos. ${err?.message || ""}`;
      }
    }
  }

  function captura(view) {
    if (!TELAS.has(view)) {
      ativo = false;
      document.getElementById("viewFinanceiro")?.classList.remove("caixa-op-on");
      return false;
    }
    ativo = true;
    if (view === "entradas" || view === "saidas" || view === "caixa") filtro = view;
    ensure();
    document.querySelectorAll("#viewFinanceiro .finance-subview").forEach((el) => {
      el.classList.add("hidden");
      el.hidden = true;
    });
    try {
      pintar();
    } catch (err) {
      console.error("financeiro", err);
    }
    if (typeof global.clearTimeout === "function") global.clearTimeout(refreshTimer);
    if (typeof global.setTimeout === "function") {
      refreshTimer = global.setTimeout(() => {
        refresh().catch((err) => console.error("financeiro", err));
      }, 40);
    }
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
    aposLiberacao,
    isActive: () => ativo,
    contagemAReceber() {
      const contas = linhasAReceber().length;
      const novas = faturasAbertas().length;
      const antigas = faturasAntigasEmAberto().length;
      return {
        contasAntigas: contasFonte().length,
        exibidas: contas + novas + antigas,
        faturas: charges.length,
      };
    },
    alocarPagamento,
    apurarMes,
    saldoCaixa,
    resumoPainel(mes) {
      const caixa = saldoCaixa(mes || mesAtivo());
      return {
        recebido: caixa.recebido,
        pago: caixa.pago,
        aReceber: saldoAbertoEntradas(),
        aPagar: caixa.aPagar,
        mes: caixa.mes,
      };
    },
    descricaoMovimento,
    gruposAFaturar,
  };
})(typeof window !== "undefined" ? window : globalThis);

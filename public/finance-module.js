/**
 * Módulo Financeiro Amplipatio — integrado ao pátio existente.
 * Depende de globals definidos em app.html (state, calcTotal, formatCurrency, etc.).
 */
(function () {
  let currentFinanceView = "dashboard";
  let financeFilterBanco = "";
  let financeFilterStatus = "";
  let financeFilterTipo = "";
  let financeFilterPeriodo = "";
  let financeSortReceber = "vencimento";

  let finPagarBusca = "";
  let finPagarStatus = "";
  let finPagarTipo = "";
  let finPagarCategoria = "";
  let finPagarFornecedor = "";
  let finPagarConta = "";
  let finPagarPeriodoDe = "";
  let finPagarPeriodoAte = "";
  let refreshFinanceDataPromise = null;

  function financeCanLoadData() {
    return typeof effectiveUserId === "function" && !!effectiveUserId() && !!supabase;
  }

  function financeRoot() {
    return document.getElementById("viewFinanceiro");
  }

  function financeTodayYmd() {
    return toLocalYmd(new Date().toISOString());
  }

  function financeVehicleById() {
    return new Map((state.vehicles || []).map((v) => [v.id, v]));
  }

  function financePartnerLabel(id) {
    return (state.partners || []).find((p) => p.id === id)?.nome || "—";
  }

  function financeInstituicaoNome(vehicle) {
    if (!vehicle) return "—";
    const ass = financePartnerLabel(vehicle.assessoria_id);
    const loc = financePartnerLabel(vehicle.localizador_id);
    return vehicleRpfNome(vehicle) !== "—" ? vehicleRpfNome(vehicle) : ass !== "—" ? ass : loc;
  }

  function financePayableMeta(p) {
    return financeMetaUnpack(p?.observacoes || "");
  }

  function financePayableContaBancaria(p) {
    const { meta } = financePayableMeta(p);
    return meta.conta_bancaria || state.settings?.conta_bancaria || "Caixa";
  }

  function financePayablePaidSum(payableId) {
    return (state.cash || [])
      .filter((m) => m.tipo_conta === "PAGAR" && String(m.conta_id) === String(payableId))
      .reduce((s, m) => s + Number(m.valor || 0), 0);
  }

  function financePayableDisplayStatus(p) {
    if (!p) return "—";
    const st = String(p.status || "").toUpperCase();
    if (st === "PAGO") return "Pago";
    const valor = Number(p.valor || 0);
    const paid = financePayablePaidSum(p.id);
    if (paid > 0 && paid < valor) return "Parcial";
    const due = financeContaDueYmd(p, "payable");
    const today = financeTodayYmd();
    if (due && today && due < today) return "Vencido";
    return "Pendente";
  }

  function financePayableStatusClass(st) {
    if (st === "Pago") return "fin-tag fin-tag--ok";
    if (st === "Vencido") return "fin-tag fin-tag--late";
    if (st === "Parcial") return "fin-tag fin-tag--partial";
    return "fin-tag fin-tag--open";
  }

  function financeRecorrenciaLabel(p) {
    const { meta } = financePayableMeta(p);
    const iv = String(meta.recorrencia || "mensal").toLowerCase();
    const map = { semanal: "Semanal", quinzenal: "Quinzenal", mensal: "Mensal", anual: "Anual" };
    return map[iv] || "Mensal";
  }

  function financeIsRecorrente(p) {
    const tipo = String(p?.tipo || "").toUpperCase();
    if (tipo === "RECORRENTE") return true;
    return financeEntryModoFromRecord(p, "payable") === "RECORRENTE";
  }

  function financeIsRecorrenteReceivable(r) {
    return financeEntryModoFromRecord(r, "receivable") === "RECORRENTE";
  }

  function financeEntryTipoLabel(record, kind) {
    const modo = financeEntryModoFromRecord(record, kind);
    if (modo === "RECORRENTE") {
      const { meta } = financeMetaUnpack(record?.observacoes || "");
      const iv = String(meta.recorrencia || "mensal").toLowerCase();
      const map = { semanal: "Semanal", quinzenal: "Quinzenal", mensal: "Mensal", anual: "Anual" };
      return `Recorrente · ${map[iv] || "Mensal"}`;
    }
    if (modo === "PARCELADA") return "Parcelada";
    if (kind === "receivable" && record?.vehicle_id) return "Pátio";
    return "Única";
  }

  function financeEntryTipoBadgeHtml(record, kind) {
    const modo = financeEntryModoFromRecord(record, kind);
    const label = financeEntryTipoLabel(record, kind);
    if (modo === "RECORRENTE") return `<span class="finance-lanc-badge finance-lanc-badge--recorrente">${escapeHtml(label)}</span>`;
    if (modo === "PARCELADA") return `<span class="finance-lanc-badge finance-lanc-badge--parcelada">${escapeHtml(label)}</span>`;
    if (kind === "receivable" && record?.vehicle_id) return `<span class="finance-lanc-badge">Pátio</span>`;
    return `<span class="finance-lanc-badge">${escapeHtml(label)}</span>`;
  }

  function financeMatchesTipoFilter(record, kind, filter) {
    if (!filter) return true;
    const modo = financeEntryModoFromRecord(record, kind);
    if (filter === "recorrente") return modo === "RECORRENTE";
    if (filter === "parcelada") return modo === "PARCELADA";
    if (filter === "patio") return kind === "receivable" && !!record?.vehicle_id;
    if (filter === "unica") return modo === "UNICA" && !(kind === "receivable" && record?.vehicle_id);
    return true;
  }

  /** Veículos no pátio gerando receita (não é conta a receber ainda). */
  function financeVehiclesEmGeracao() {
    const statuses = ["NO_PATIO", "LIBERACAO_SOLICITADA", "LIBERACAO_CONFIRMADA", "REMocao_CONFIRMADA"];
    return (state.vehicles || [])
      .filter((v) => statuses.includes(v.status))
      .map((v) => {
        const dias = Math.max(
          1,
          Math.ceil((Date.now() - new Date(v.data_entrada || Date.now()).getTime()) / 86400000)
        );
        return { vehicle: v, dias, valor: calcTotal(v), instituicao: financeInstituicaoNome(v) };
      })
      .sort((a, b) => String(b.vehicle.data_entrada || "").localeCompare(String(a.vehicle.data_entrada || "")));
  }

  function financeDefaultDueYmd(fromYmd) {
    const base = fromYmd ? new Date(`${fromYmd}T12:00:00`) : new Date();
    base.setDate(base.getDate() + 30);
    return toLocalYmd(base.toISOString());
  }

  function financeReceivableDisplayStatus(r) {
    if (!r) return "—";
    if (r.status === "PAGO") return "Recebido";
    const due = financeContaDueYmd(r, "receivable");
    const today = financeTodayYmd();
    if (due && today && due < today) return "Atrasado";
    return "Pendente";
  }

  function financeReceivableStatusClass(st) {
    if (st === "Recebido") return "fin-tag fin-tag--ok";
    if (st === "Atrasado") return "fin-tag fin-tag--late";
    return "fin-tag fin-tag--open";
  }

  function financeContasAguardandoList() {
    return (state.receivables || []).filter((r) => {
      if (!r || r.status === "PAGO") return false;
      if (receivableSemCobrancaFinanceira(r)) return false;
      if (receivableIsContaReceberFinanceiro(r)) return false;
      if (!r.vehicle_id) return false;
      if (receivableNaFilaAguardandoTriagem(r)) return true;
      if (r.status === RECEIVABLE_AGUARDANDO_LANCAMENTO) return true;
      return r.status === "EM_ABERTO" && receivableCicloEncerradoParaFinanceiro(r);
    });
  }

  function financeContasReceberList() {
    const vmap = financeVehicleById();
    let list = (state.receivables || []).filter((r) => receivableIsContaReceberFinanceiro(r));
    const q = (financeFilterBanco || "").trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const v = vmap.get(r.vehicle_id);
        const blob = [r.responsavel_pagamento, r.observacoes, v?.placa, v?.marca, v?.modelo, financeInstituicaoNome(v)]
          .join(" ")
          .toLowerCase();
        return blob.includes(q);
      });
    }
    if (financeFilterStatus === "pendente") {
      list = list.filter((r) => financeReceivableDisplayStatus(r) === "Pendente");
    } else if (financeFilterStatus === "atrasado") {
      list = list.filter((r) => financeReceivableDisplayStatus(r) === "Atrasado");
    }
    if (financeFilterTipo) {
      list = list.filter((r) => financeMatchesTipoFilter(r, "receivable", financeFilterTipo));
    }
    list.sort((a, b) => {
      if (financeSortReceber === "valor") return Number(b.valor || 0) - Number(a.valor || 0);
      if (financeSortReceber === "placa") {
        const pa = financeVehicleById().get(a.vehicle_id)?.placa || "";
        const pb = financeVehicleById().get(b.vehicle_id)?.placa || "";
        return pa.localeCompare(pb, "pt-BR");
      }
      const da = financeContaDueYmd(a, "receivable") || "9999-99-99";
      const db = financeContaDueYmd(b, "receivable") || "9999-99-99";
      return da.localeCompare(db);
    });
    return list;
  }

  function financeContasPagarList() {
    let list = [...(state.payables || [])];
    const q = finPagarBusca.trim().toLowerCase();
    if (q) {
      list = list.filter((p) => {
        const blob = [p.fornecedor, p.descricao, payableCategoryLabel(p.payable_category), p.observacoes]
          .join(" ")
          .toLowerCase();
        return blob.includes(q);
      });
    }
    if (finPagarCategoria) {
      list = list.filter((p) => String(p.payable_category || "OUTROS") === finPagarCategoria);
    }
    if (finPagarFornecedor.trim()) {
      const f = finPagarFornecedor.trim().toLowerCase();
      list = list.filter((p) => String(p.fornecedor || "").toLowerCase().includes(f));
    }
    if (finPagarConta.trim()) {
      const c = finPagarConta.trim().toLowerCase();
      list = list.filter((p) => financePayableContaBancaria(p).toLowerCase().includes(c));
    }
    if (finPagarPeriodoDe) {
      list = list.filter((p) => {
        const due = financeContaDueYmd(p, "payable");
        return due && due >= finPagarPeriodoDe;
      });
    }
    if (finPagarPeriodoAte) {
      list = list.filter((p) => {
        const due = financeContaDueYmd(p, "payable");
        return due && due <= finPagarPeriodoAte;
      });
    }
    if (finPagarStatus) {
      list = list.filter((p) => {
        const st = financePayableDisplayStatus(p);
        if (finPagarStatus === "pendente") return st === "Pendente";
        if (finPagarStatus === "vencido") return st === "Vencido";
        if (finPagarStatus === "vencendo_hoje") {
          const due = financeContaDueYmd(p, "payable");
          return st !== "Pago" && due === financeTodayYmd();
        }
        if (finPagarStatus === "pago") return st === "Pago";
        if (finPagarStatus === "parcial") return st === "Parcial";
        return true;
      });
    }
    if (finPagarTipo) {
      list = list.filter((p) => financeMatchesTipoFilter(p, "payable", finPagarTipo));
    }
    list.sort((a, b) => {
      const da = financeContaDueYmd(a, "payable") || "9999-99-99";
      const db = financeContaDueYmd(b, "payable") || "9999-99-99";
      return da.localeCompare(db);
    });
    return list;
  }

  function financePayablesAbertas() {
    return (state.payables || []).filter((p) => financePayableDisplayStatus(p) !== "Pago");
  }

  function financeHistoricoRecebidos() {
    return (state.receivables || []).filter((r) => r.status === "PAGO" && r.vehicle_id);
  }

  function financeCaixaEntradas() {
    return (state.cash || []).filter((m) => m.tipo_conta === "RECEBER");
  }

  function financeCaixaSaidas() {
    return (state.cash || []).filter((m) => m.tipo_conta === "PAGAR");
  }

  function financeSaldoCaixa() {
    const ent = financeCaixaEntradas().reduce((s, m) => s + Number(m.valor || 0), 0);
    const sai = financeCaixaSaidas().reduce((s, m) => s + Number(m.valor || 0), 0);
    return ent - sai;
  }

  function financeTotalEntradas() {
    return financeCaixaEntradas().reduce((s, m) => s + Number(m.valor || 0), 0);
  }

  function financeTotalSaidas() {
    return financeCaixaSaidas().reduce((s, m) => s + Number(m.valor || 0), 0);
  }

  function financeRecebidoMesAtual() {
    const ym = yearMonthFromYmd(financeTodayYmd());
    return sumReceivableRevenueByMonth(ym, state.receivables || [], state.cash || []);
  }

  function financeDespesasMesAtual() {
    const ym = yearMonthFromYmd(financeTodayYmd());
    return financeCaixaSaidas()
      .filter((m) => yearMonthFromYmd(toLocalYmd(m.data_movimento || m.created_at)) === ym)
      .reduce((s, m) => s + Number(m.valor || 0), 0);
  }

  function financeRecebidoHoje() {
    const today = financeTodayYmd();
    return sumReceivableRevenueByDay(today, state.receivables || [], state.cash || []);
  }

  function financePayableAlerts() {
    const today = financeTodayYmd();
    const abertas = financePayablesAbertas();
    let vencidas = 0;
    let venceHoje = 0;
    let proximas = 0;
    let totalVencidas = 0;
    abertas.forEach((p) => {
      const due = financeContaDueYmd(p, "payable");
      const val = Number(p.valor || 0);
      if (!due) return;
      if (due < today) {
        vencidas++;
        totalVencidas += val;
      } else if (due === today) {
        venceHoje++;
      } else {
        const days = Math.floor((new Date(`${due}T00:00:00`) - new Date(`${today}T00:00:00`)) / 86400000);
        if (days <= 7) proximas++;
      }
    });
    return { vencidas, venceHoje, proximas, totalVencidas };
  }

  function financeMetrics() {
    const emGeracao = financeVehiclesEmGeracao();
    const contasRec = financeContasReceberList();
    const abertas = financePayablesAbertas();
    const alerts = financePayableAlerts();
    const totalGeracao = emGeracao.reduce((s, x) => s + x.valor, 0);
    const totalReceber = contasRec.reduce((s, r) => s + Number(r.valor || 0), 0);
    const totalPagar = abertas.reduce((s, p) => s + Number(p.valor || 0), 0);
    const pendentes = contasRec.filter((r) => financeReceivableDisplayStatus(r) !== "Recebido").length;
    const recebidosMes = financeHistoricoRecebidos().filter((r) => {
      const ym = yearMonthFromYmd(toLocalYmd(r.updated_at || r.created_at));
      return ym === yearMonthFromYmd(financeTodayYmd());
    }).length;
    return {
      totalGeracao,
      totalReceber,
      totalPagar,
      recebidoMes: financeRecebidoMesAtual(),
      despesasMes: financeDespesasMesAtual(),
      veiculosPatio: emGeracao.length,
      pendentes,
      recebidosMes,
      saldo: financeSaldoCaixa(),
      entradas: financeTotalEntradas(),
      saidas: financeTotalSaidas(),
      recebidoHoje: financeRecebidoHoje(),
      vencidas: alerts.vencidas,
      venceHoje: alerts.venceHoje,
      proximas: alerts.proximas,
      totalVencidas: alerts.totalVencidas,
      aguardandoFaturamento: financeContasAguardandoList().length,
    };
  }

  function financeDiariasFromReceivable(r, vehicle) {
    const br = receivableFinanceBreakdown(r);
    if (br?.dias) return br.dias;
    if (r.period_start && r.period_end) {
      const d1 = new Date(r.period_start);
      const d2 = new Date(r.period_end);
      return Math.max(1, Math.ceil((d2 - d1) / 86400000));
    }
    if (vehicle) {
      return Math.max(
        1,
        Math.ceil((new Date(vehicle.data_saida || Date.now()) - new Date(vehicle.data_entrada)) / 86400000)
      );
    }
    return "—";
  }

  function financePopulateCategoriaFilter() {
    const sel = document.getElementById("finPagarCategoria");
    if (!sel || sel.dataset.filled) return;
    const cats = typeof getLancDespesaCategorias === "function" ? getLancDespesaCategorias() : [];
    sel.innerHTML =
      `<option value="">Todas</option>` +
      cats.map((c) => `<option value="${escapeHtml(c.value)}">${escapeHtml(c.label)}</option>`).join("");
    sel.dataset.filled = "1";
  }

  function financeRenderDashboard() {
    const m = financeMetrics();
    const el = document.getElementById("finDashCards");
    if (!el) return;
    el.innerHTML = `
      <div class="fin-card fin-card--recv"><span class="fin-card-label">Total a receber</span><strong>${escapeHtml(formatCurrency(m.totalReceber))}</strong><small>${m.pendentes} pendente(s)</small></div>
      <div class="fin-card fin-card--pay"><span class="fin-card-label">Total a pagar</span><strong>${escapeHtml(formatCurrency(m.totalPagar))}</strong><small>${m.vencidas} vencida(s)</small></div>
      <div class="fin-card fin-card--month"><span class="fin-card-label">Receitas do mês</span><strong>${escapeHtml(formatCurrency(m.recebidoMes))}</strong><small>entradas confirmadas</small></div>
      <div class="fin-card fin-card--expense"><span class="fin-card-label">Despesas do mês</span><strong>${escapeHtml(formatCurrency(m.despesasMes))}</strong><small>saídas registradas</small></div>
      <div class="fin-card fin-card--saldo"><span class="fin-card-label">Saldo atual</span><strong>${escapeHtml(formatCurrency(m.saldo))}</strong><small>entradas − saídas</small></div>
      <div class="fin-card fin-card--gen"><span class="fin-card-label">Receita em geração</span><strong>${escapeHtml(formatCurrency(m.totalGeracao))}</strong><small>${m.veiculosPatio} no pátio</small></div>
      <div class="fin-card fin-card--late"><span class="fin-card-label">Contas vencidas</span><strong>${m.vencidas}</strong><small>${escapeHtml(formatCurrency(m.totalVencidas))}</small></div>
      <div class="fin-card fin-card--open"><span class="fin-card-label">Aguardando faturamento</span><strong>${m.aguardandoFaturamento}</strong><small>veículo(s) pós-saída</small></div>
      <div class="fin-card fin-card--today"><span class="fin-card-label">Vencendo hoje</span><strong>${m.venceHoje}</strong><small>${m.proximas} nos próximos 7 dias</small></div>
    `;
    const period = document.getElementById("finChartPeriod")?.value || "mes";
    if (typeof renderDashboardFinanceCharts === "function") {
      renderDashboardFinanceCharts(period, {
        flow: "finChartFlowSvg",
        balance: "finChartBalanceSvg",
        compare: "finChartCompareSvg",
        expense: "finChartExpenseSvg",
        clients: "finChartClientsSvg",
        aging: "finChartAgingSvg",
      });
    }
  }

  function financeRenderEmPatio() {
    const body = document.getElementById("finEmPatioBody");
    const totalEl = document.getElementById("finEmPatioTotal");
    if (!body) return;
    const rows = financeVehiclesEmGeracao();
    if (totalEl) totalEl.textContent = formatCurrency(rows.reduce((s, x) => s + x.valor, 0));
    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="6" class="notice">Nenhum veículo gerando receita no pátio.</td></tr>`;
      return;
    }
    body.innerHTML = rows
      .map(({ vehicle: v, dias, valor, instituicao }) => {
        return `<tr>
          <td data-label="Veículo"><strong>${escapeHtml(v.placa || "—")}</strong><br /><span class="notice">${escapeHtml([v.marca, v.modelo].filter(Boolean).join(" ") || "—")}</span></td>
          <td data-label="Financeira / banco">${escapeHtml(instituicao)}</td>
          <td data-label="Entrada">${escapeHtml(formatDateTime(v.data_entrada))}</td>
          <td data-label="Dias">${dias}</td>
          <td data-label="Valor acumulado">${escapeHtml(formatCurrency(valor))}</td>
          <td data-label="Situação"><span class="fin-tag fin-tag--gen">Em geração</span></td>
        </tr>`;
      })
      .join("");
  }

  function financeRenderReceber() {
    const body = document.getElementById("finReceberBody");
    const totalEl = document.getElementById("finReceberTotal");
    if (!body) return;
    const vmap = financeVehicleById();
    const list = financeContasReceberList();
    if (totalEl) totalEl.textContent = formatCurrency(list.reduce((s, r) => s + Number(r.valor || 0), 0));
    if (!list.length) {
      body.innerHTML = `<tr><td colspan="6" class="notice">Nenhuma conta a receber pendente. Cadastre mensalistas em «+ Nova receita» (tipo Recorrente) ou veja «Aguardando faturamento».</td></tr>`;
      return;
    }
    body.innerHTML = list
      .map((r) => {
        const v = vmap.get(r.vehicle_id);
        const st = financeReceivableDisplayStatus(r);
        const due = financeContaDueYmd(r, "receivable");
        const isPatio = !!r.vehicle_id;
        const clienteHtml = isPatio
          ? `<strong>${escapeHtml(v?.placa || "—")}</strong><br /><span class="notice">${escapeHtml([v?.marca, v?.modelo].filter(Boolean).join(" ") || "—")}</span>`
          : `<strong>${escapeHtml(r.responsavel_pagamento || "—")}</strong>`;
        const servicoHtml = isPatio
          ? `${escapeHtml(financeInstituicaoNome(v))}<br /><span class="notice">${escapeHtml(String(financeDiariasFromReceivable(r, v)))} diária(s)</span>`
          : `${escapeHtml(typeof receivableCategoryLabel === "function" ? receivableCategoryLabel(r.receivable_category) : "—")}<br /><span class="notice">${escapeHtml(financeMetaUnpack(r.observacoes || "").text || r.observacoes || "—")}</span>`;
        const btnPay =
          st !== "Recebido"
            ? `<div style="margin-top:6px"><button type="button" class="secondary fin-btn-confirm" data-fin-receber-id="${escapeHtml(String(r.id))}">Confirmar pagamento</button></div>`
            : "";
        return `<tr>
          <td data-label="Cliente / Veículo">${clienteHtml}</td>
          <td data-label="Serviço / Descrição">${servicoHtml}</td>
          <td data-label="Tipo">${financeEntryTipoBadgeHtml(r, "receivable")}</td>
          <td data-label="Valor">${escapeHtml(formatCurrency(Number(r.valor || 0)))}</td>
          <td data-label="Vencimento">${escapeHtml(due ? formatDate(due) : "—")}</td>
          <td data-label="Status"><span class="${financeReceivableStatusClass(st)}">${escapeHtml(st)}</span>${btnPay}</td>
        </tr>`;
      })
      .join("");
  }

  function financeRenderAguardando() {
    const body = document.getElementById("finAguardandoBody");
    const totalEl = document.getElementById("finAguardandoTotal");
    if (!body) return;
    const vmap = financeVehicleById();
    const list = financeContasAguardandoList();
    if (totalEl) totalEl.textContent = formatCurrency(list.reduce((s, r) => s + Number(r.valor || 0), 0));
    if (!list.length) {
      body.innerHTML = `<tr><td colspan="6" class="notice">Nenhum veículo aguardando faturamento. Após saída (VRP), o registro aparece aqui até ir para Contas a receber.</td></tr>`;
      return;
    }
    body.innerHTML = list
      .map((r) => {
        const v = vmap.get(r.vehicle_id);
        const saida = v?.data_saida || r.period_end;
        return `<tr>
          <td data-label="Veículo"><strong>${escapeHtml(v?.placa || "—")}</strong><br /><span class="notice">${escapeHtml([v?.marca, v?.modelo].filter(Boolean).join(" ") || "—")}</span></td>
          <td data-label="Financeira / RPF">${escapeHtml(r.responsavel_pagamento || financeInstituicaoNome(v))}</td>
          <td data-label="Saída">${escapeHtml(saida ? formatDate(saida) : "—")}</td>
          <td data-label="Valor">${escapeHtml(formatCurrency(Number(r.valor || 0)))}</td>
          <td data-label="Status"><span class="fin-tag fin-tag--open">Aguardando</span></td>
          <td data-label=""><button type="button" class="secondary fin-btn-aguardando-ok" data-fin-aguardando-id="${escapeHtml(String(r.id))}">Liberar p/ receber</button></td>
        </tr>`;
      })
      .join("");
  }

  function financeRenderPagarAlerts() {
    const el = document.getElementById("finPagarAlerts");
    if (!el) return;
    const a = financePayableAlerts();
    el.innerHTML = `
      <div class="fin-alert fin-alert--late"><span>Vencidas</span><strong>${a.vencidas}</strong></div>
      <div class="fin-alert fin-alert--today"><span>Vencem hoje</span><strong>${a.venceHoje}</strong></div>
      <div class="fin-alert fin-alert--soon"><span>Próximos 7 dias</span><strong>${a.proximas}</strong></div>
    `;
  }

  function financeRenderPagar() {
    financePopulateCategoriaFilter();
    financeRenderPagarAlerts();
    const body = document.getElementById("finPagarBody");
    const totalEl = document.getElementById("finPagarTotal");
    if (!body) return;
    const list = financeContasPagarList();
    const abertas = list.filter((p) => financePayableDisplayStatus(p) !== "Pago");
    if (totalEl) totalEl.textContent = formatCurrency(abertas.reduce((s, p) => s + Number(p.valor || 0), 0));
    if (!list.length) {
      const total = (state.payables || []).length;
      body.innerHTML = `<tr><td colspan="10" class="notice">Nenhuma despesa com os filtros atuais.${total ? ` (${total} no total — limpe filtros ou clique Atualizar)` : " Cadastre em + Nova despesa."}</td></tr>`;
      return;
    }
    body.innerHTML = list
      .map((p) => {
        const st = financePayableDisplayStatus(p);
        const due = financeContaDueYmd(p, "payable");
        const btnPay =
          st !== "Pago"
            ? `<button type="button" class="secondary fin-btn-pagar" data-fin-pagar-id="${escapeHtml(String(p.id))}">Pagar</button>`
            : "";
        return `<tr>
          <td data-label="Fornecedor">${escapeHtml(p.fornecedor || "—")}</td>
          <td data-label="Descrição">${escapeHtml(p.descricao || "—")}</td>
          <td data-label="Categoria">${escapeHtml(payableCategoryLabel(p.payable_category))}</td>
          <td data-label="Tipo">${financeEntryTipoBadgeHtml(p, "payable")}</td>
          <td data-label="Valor">${escapeHtml(formatCurrency(Number(p.valor || 0)))}</td>
          <td data-label="Vencimento">${escapeHtml(due ? formatDate(due) : "—")}</td>
          <td data-label="Forma">${escapeHtml(p.forma_pagamento || "—")}</td>
          <td data-label="Conta">${escapeHtml(financePayableContaBancaria(p))}</td>
          <td data-label="Status"><span class="${financePayableStatusClass(st)}">${escapeHtml(st)}</span></td>
          <td data-label="">${btnPay}</td>
        </tr>`;
      })
      .join("");
  }

  function financeMovContaLabel(m) {
    if (m.tipo_conta === "RECEBER") {
      const rec = (state.receivables || []).find((r) => String(r.id) === String(m.conta_id));
      return state.settings?.conta_bancaria || "Caixa";
    }
    const pay = (state.payables || []).find((p) => String(p.id) === String(m.conta_id));
    return pay ? financePayableContaBancaria(pay) : state.settings?.conta_bancaria || "Caixa";
  }

  function financeRenderCaixa() {
    const body = document.getElementById("finCaixaBody");
    const summaryEl = document.getElementById("finCaixaSummary");
    const m = financeMetrics();
    if (summaryEl) {
      const saldoPorConta = new Map();
      const defaultConta = state.settings?.conta_bancaria || "Caixa";
      saldoPorConta.set(defaultConta, 0);
      (state.cash || []).forEach((mov) => {
        const conta = financeMovContaLabel(mov);
        const signed = mov.tipo_conta === "PAGAR" ? -Number(mov.valor || 0) : Number(mov.valor || 0);
        saldoPorConta.set(conta, (saldoPorConta.get(conta) || 0) + signed);
      });
      const contasHtml = [...saldoPorConta.entries()]
        .map(([nome, val]) => `<p><strong>${escapeHtml(nome)}:</strong> ${escapeHtml(formatCurrency(val))}</p>`)
        .join("");
      summaryEl.innerHTML = `
        <p><strong>Saldo atual:</strong> ${escapeHtml(formatCurrency(m.saldo))}</p>
        <p><strong>Entradas totais:</strong> <span class="fin-val-entrada">${escapeHtml(formatCurrency(m.entradas))}</span></p>
        <p><strong>Saídas totais:</strong> <span class="fin-val-saida">${escapeHtml(formatCurrency(m.saidas))}</span></p>
        ${contasHtml}
      `;
    }
    if (!body) return;
    let movs = [...(state.cash || [])].sort((a, b) =>
      String(b.data_movimento || b.created_at).localeCompare(String(a.data_movimento || a.created_at))
    );
    if (financeFilterPeriodo) {
      movs = movs.filter(
        (mov) => yearMonthFromYmd(toLocalYmd(mov.data_movimento || mov.created_at)) === financeFilterPeriodo
      );
    }
    if (!movs.length) {
      body.innerHTML = `<tr><td colspan="6" class="notice">Nenhuma movimentação registrada.</td></tr>`;
      return;
    }
    body.innerHTML = movs
      .slice(0, 300)
      .map((mov) => {
        const isEntrada = mov.tipo_conta === "RECEBER";
        const rec = isEntrada ? (state.receivables || []).find((r) => String(r.id) === String(mov.conta_id)) : null;
        const pay = !isEntrada ? (state.payables || []).find((p) => String(p.id) === String(mov.conta_id)) : null;
        const v = rec ? financeVehicleById().get(rec.vehicle_id) : null;
        const tipoLabel = isEntrada ? "Entrada" : "Saída";
        const tipoClass = isEntrada ? "fin-val-entrada" : "fin-val-saida";
        const valSigned = isEntrada ? Number(mov.valor || 0) : -Number(mov.valor || 0);
        let desc = mov.descricao || (isEntrada ? rec?.responsavel_pagamento : pay?.descricao) || "—";
        if (v) desc += `<br /><span class="notice">${escapeHtml(v.placa || "")}</span>`;
        return `<tr>
          <td data-label="Data">${escapeHtml(formatDate(mov.data_movimento || mov.created_at))}</td>
          <td data-label="Tipo"><span class="${tipoClass}">${tipoLabel}</span></td>
          <td data-label="Descrição">${desc}</td>
          <td data-label="Forma">${escapeHtml(mov.forma_pagamento || "—")}</td>
          <td data-label="Valor"><span class="${tipoClass}">${escapeHtml(formatCurrency(valSigned))}</span></td>
          <td data-label="Conta">${escapeHtml(financeMovContaLabel(mov))}</td>
        </tr>`;
      })
      .join("");
  }

  function financeOpenReceitaModal(presetRecorrente) {
    const modal = document.getElementById("finReceitaModal");
    const form = document.getElementById("finReceitaForm");
    if (!modal || !form) return;
    form.reset();
    const today = financeTodayYmd();
    const venc = document.getElementById("finRecVencimento");
    const modo = document.getElementById("finRecModo");
    const cat = document.getElementById("finRecCategoria");
    if (venc) venc.value = today;
    if (modo) modo.value = presetRecorrente ? "RECORRENTE" : "UNICA";
    if (cat && typeof getLancReceitaCategorias === "function") {
      const cats = getLancReceitaCategorias();
      cat.innerHTML = cats.map((c) => `<option value="${escapeHtml(c.value)}">${escapeHtml(c.label)}</option>`).join("");
      if (presetRecorrente) cat.value = "ESTACIONAMENTO_MENSALISTA";
    }
    financeSyncReceitaModoFields();
    const title = document.getElementById("finReceitaModalTitle");
    if (title) title.textContent = presetRecorrente ? "Nova receita recorrente" : "Nova receita";
    if (modal.parentElement !== document.body) document.body.appendChild(modal);
    modal.classList.remove("hidden");
  }

  function financeCloseReceitaModal() {
    document.getElementById("finReceitaModal")?.classList.add("hidden");
  }

  function financeSyncReceitaModoFields() {
    const modo = document.getElementById("finRecModo")?.value || "UNICA";
    document.getElementById("finRecRecorrenciaWrap")?.classList.toggle("hidden", modo !== "RECORRENTE");
    document.getElementById("finRecParcelasWrap")?.classList.toggle("hidden", modo !== "PARCELADA");
  }

  function financeOpenDespesaModal(presetRecorrente) {
    const modal = document.getElementById("finDespesaModal");
    const form = document.getElementById("finDespesaForm");
    if (!modal || !form) return;
    form.reset();
    const today = financeTodayYmd();
    const venc = document.getElementById("finDespVencimento");
    const conta = document.getElementById("finDespConta");
    const modo = document.getElementById("finDespModo");
    const cat = document.getElementById("finDespCategoria");
    if (venc) venc.value = today;
    if (conta) conta.value = state.settings?.conta_bancaria || "";
    if (modo) modo.value = presetRecorrente ? "RECORRENTE" : "UNICA";
    if (cat && typeof getLancDespesaCategorias === "function") {
      const cats = getLancDespesaCategorias();
      cat.innerHTML = cats.map((c) => `<option value="${escapeHtml(c.value)}">${escapeHtml(c.label)}</option>`).join("");
    }
    financeSyncDespesaModoFields();
    const title = document.getElementById("finDespesaModalTitle");
    if (title) title.textContent = presetRecorrente ? "Nova despesa recorrente" : "Nova despesa";
    if (modal.parentElement !== document.body) document.body.appendChild(modal);
    modal.classList.remove("hidden");
  }

  function financeCloseDespesaModal() {
    document.getElementById("finDespesaModal")?.classList.add("hidden");
  }

  function financeSyncDespesaModoFields() {
    const modo = document.getElementById("finDespModo")?.value || "UNICA";
    document.getElementById("finDespRecorrenciaWrap")?.classList.toggle("hidden", modo !== "RECORRENTE");
    document.getElementById("finDespParcelasWrap")?.classList.toggle("hidden", modo !== "PARCELADA");
  }

  function financeExportCsv(rows, filename) {
    if (!rows.length) {
      alert("Nada para exportar com os filtros atuais.");
      return;
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function financeExportCurrentView() {
    const view = currentFinanceView;
    if (view === "pagar") {
      const list = financeContasPagarList();
      const header = ["Fornecedor", "Descrição", "Categoria", "Tipo", "Valor", "Vencimento", "Forma", "Conta", "Status"];
      const rows = [
        header,
        ...list.map((p) => [
          p.fornecedor || "",
          p.descricao || "",
          payableCategoryLabel(p.payable_category),
          financeEntryTipoLabel(p, "payable"),
          Number(p.valor || 0).toFixed(2),
          financeContaDueYmd(p, "payable"),
          p.forma_pagamento || "",
          financePayableContaBancaria(p),
          financePayableDisplayStatus(p),
        ]),
      ];
      financeExportCsv(rows, `contas-a-pagar-${financeTodayYmd()}.csv`);
      return;
    }
    if (view === "receber") {
      const list = financeContasReceberList();
      const vmap = financeVehicleById();
      const rows = [
        ["Cliente / Veículo", "Serviço", "Tipo", "Valor", "Vencimento", "Status"],
        ...list.map((r) => {
          const v = vmap.get(r.vehicle_id);
          return [
            v?.placa || r.responsavel_pagamento || "",
            v ? financeInstituicaoNome(v) : receivableCategoryLabel?.(r.receivable_category) || "",
            financeEntryTipoLabel(r, "receivable"),
            Number(r.valor || 0).toFixed(2),
            financeContaDueYmd(r, "receivable"),
            financeReceivableDisplayStatus(r),
          ];
        }),
      ];
      financeExportCsv(rows, `contas-a-receber-${financeTodayYmd()}.csv`);
      return;
    }
    if (view === "caixa") {
      const rows = [
        ["Data", "Tipo", "Descrição", "Forma", "Valor", "Conta"],
        ...(state.cash || []).map((m) => [
          toLocalYmd(m.data_movimento || m.created_at),
          m.tipo_conta === "RECEBER" ? "Entrada" : "Saída",
          m.descricao || "",
          m.forma_pagamento || "",
          Number(m.valor || 0).toFixed(2),
          financeMovContaLabel(m),
        ]),
      ];
      financeExportCsv(rows, `fluxo-caixa-${financeTodayYmd()}.csv`);
      return;
    }
    alert("Abra Contas a pagar, Contas a receber ou Caixa para exportar.");
  }

  function financePrintSubview() {
    window.print();
  }

  function financeExportPdfHint() {
    alert("Use Imprimir e escolha «Salvar como PDF» no diálogo do navegador.");
    financePrintSubview();
  }

  window.renderFinance = function renderFinance() {
    try {
      financeRoot()?.querySelectorAll(".finance-subview").forEach((p) => {
        const match = p.getAttribute("data-finance-subview") === currentFinanceView;
        p.classList.toggle("hidden", !match);
      });
      financeRoot()?.querySelectorAll("[data-finance-subview-btn]").forEach((btn) => {
        btn.classList.toggle("active", btn.getAttribute("data-finance-subview-btn") === currentFinanceView);
      });
      if (currentFinanceView === "dashboard") financeRenderDashboard();
      else if (currentFinanceView === "em_patio") financeRenderEmPatio();
      else if (currentFinanceView === "receber") financeRenderReceber();
      else if (currentFinanceView === "aguardando") financeRenderAguardando();
      else if (currentFinanceView === "pagar") financeRenderPagar();
      else if (currentFinanceView === "caixa") financeRenderCaixa();
    } catch (e) {
      console.error("renderFinance", e);
    }
  };

  window.refreshFinanceData = async function refreshFinanceData() {
    if (typeof ensureValidSupabaseSession === "function") {
      const session = await ensureValidSupabaseSession();
      if (!session?.user) {
        if (typeof forceSignOutAndLogin === "function") {
          await forceSignOutAndLogin("Sessão expirada. Entre novamente.");
        }
        return;
      }
    } else if (!financeCanLoadData()) {
      return;
    }
    if (refreshFinanceDataPromise) return refreshFinanceDataPromise;
    refreshFinanceDataPromise = (async () => {
      try {
        await Promise.all([
          loadReceivables(),
          loadPayables(),
          loadCash(),
          loadVehicles(),
          typeof loadCycleClosures === "function" ? loadCycleClosures() : Promise.resolve(),
        ]);
        renderFinance();
        updateDashboard?.();
      } catch (e) {
        console.error("refreshFinanceData", e?.message || e);
      } finally {
        refreshFinanceDataPromise = null;
      }
    })();
    return refreshFinanceDataPromise;
  };

  async function financeApproveReceivable(receivableId) {
    const r = (state.receivables || []).find((x) => String(x.id) === String(receivableId));
    if (!r) return;
    const patch = {
      financeiro_aprovado_contas_receber: true,
      patio_liberado_financeiro: true,
      status: r.status === RECEIVABLE_AGUARDANDO_LANCAMENTO ? "EM_ABERTO" : r.status,
    };
    let { error } = await supabase.from("receivables").update(patch).eq("id", receivableId).eq("user_id", effectiveUserId());
    if (error && /column|schema cache|PGRST204/i.test(error.message || "")) {
      addReceberTriagemId(receivableId);
      if (typeof removePatioFinanceiroBloqueadoReceivableId === "function") {
        removePatioFinanceiroBloqueadoReceivableId(receivableId);
      }
      error = null;
    }
    if (error) {
      alert(error.message);
      return;
    }
    if (typeof removePatioFinanceiroBloqueadoReceivableId === "function") {
      removePatioFinanceiroBloqueadoReceivableId(receivableId);
    }
    addReceberTriagemId(receivableId);
    await refreshFinanceData();
    setFinanceView("receber");
  }

  window.setFinanceView = function setFinanceView(view) {
    if (!view || view === "none") return;
    if (view === "recorrentes") {
      currentFinanceView = "pagar";
      finPagarTipo = "recorrente";
      const tipoSel = document.getElementById("finPagarTipo");
      if (tipoSel) tipoSel.value = "recorrente";
    } else {
      currentFinanceView = view;
    }
    renderFinance();
  };

  window.openFinanceSubview = function openFinanceSubview(sub) {
    if (!sub) return;
    setFinanceView(sub);
    const hidden = financeRoot()?.classList.contains("hidden");
    if (hidden && typeof showMainView === "function") {
      showMainView("financeiro");
    } else if (financeCanLoadData()) {
      refreshFinanceData();
    }
  };

  window.returnToPainelFromFinanceFlyout = function returnToPainelFromFinanceFlyout() {
    setFinanceView("dashboard");
  };

  window.bindFinanceDashboardUiOnce = function bindFinanceDashboardUiOnce() {
    if (bindFinanceDashboardUiOnce._done) return;
    bindFinanceDashboardUiOnce._done = true;

    document.getElementById("finSubnav")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-finance-subview-btn]");
      if (!btn) return;
      setFinanceView(btn.getAttribute("data-finance-subview-btn"));
    });

    document.getElementById("finFilterBusca")?.addEventListener("input", (e) => {
      financeFilterBanco = e.target.value || "";
      if (currentFinanceView === "receber") financeRenderReceber();
    });
    document.getElementById("finFilterStatus")?.addEventListener("change", (e) => {
      financeFilterStatus = e.target.value || "";
      financeRenderReceber();
    });
    document.getElementById("finSortReceber")?.addEventListener("change", (e) => {
      financeSortReceber = e.target.value || "vencimento";
      financeRenderReceber();
    });
    document.getElementById("finReceberTipo")?.addEventListener("change", (e) => {
      financeFilterTipo = e.target.value || "";
      financeRenderReceber();
    });
    document.getElementById("finFilterPeriodo")?.addEventListener("change", (e) => {
      financeFilterPeriodo = e.target.value || "";
      financeRenderCaixa();
    });
    document.getElementById("finChartPeriod")?.addEventListener("change", () => financeRenderDashboard());

    const pagarFilterIds = [
      ["finPagarBusca", (v) => { finPagarBusca = v; }],
      ["finPagarStatus", (v) => { finPagarStatus = v; }],
      ["finPagarTipo", (v) => { finPagarTipo = v; }],
      ["finPagarCategoria", (v) => { finPagarCategoria = v; }],
      ["finPagarFornecedor", (v) => { finPagarFornecedor = v; }],
      ["finPagarConta", (v) => { finPagarConta = v; }],
      ["finPagarPeriodoDe", (v) => { finPagarPeriodoDe = v; }],
      ["finPagarPeriodoAte", (v) => { finPagarPeriodoAte = v; }],
    ];
    pagarFilterIds.forEach(([id, setter]) => {
      document.getElementById(id)?.addEventListener("input", (e) => {
        setter(e.target.value || "");
        if (currentFinanceView === "pagar") financeRenderPagar();
      });
      document.getElementById(id)?.addEventListener("change", (e) => {
        setter(e.target.value || "");
        if (currentFinanceView === "pagar") financeRenderPagar();
      });
    });

    document.getElementById("finBtnNovaDespesa")?.addEventListener("click", () => financeOpenDespesaModal(false));
    document.getElementById("finBtnNovaReceita")?.addEventListener("click", () => financeOpenReceitaModal(false));
    document.getElementById("finDespModo")?.addEventListener("change", financeSyncDespesaModoFields);
    document.getElementById("finRecModo")?.addEventListener("change", financeSyncReceitaModoFields);
    document.getElementById("closeFinDespesaModal")?.addEventListener("click", financeCloseDespesaModal);
    document.getElementById("cancelFinDespesaModal")?.addEventListener("click", financeCloseDespesaModal);
    document.getElementById("closeFinReceitaModal")?.addEventListener("click", financeCloseReceitaModal);
    document.getElementById("cancelFinReceitaModal")?.addEventListener("click", financeCloseReceitaModal);

    document.getElementById("finDespesaForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const descricao = document.getElementById("finDespDescricao")?.value?.trim();
      const valor = Number(document.getElementById("finDespValor")?.value);
      const vencimento = document.getElementById("finDespVencimento")?.value;
      const categoria = document.getElementById("finDespCategoria")?.value;
      const fornecedor = document.getElementById("finDespFornecedor")?.value?.trim();
      const formaPagamento = document.getElementById("finDespForma")?.value || "PIX";
      const observacoes = document.getElementById("finDespObs")?.value?.trim() || "";
      const contaBancaria = document.getElementById("finDespConta")?.value?.trim() || "";
      const modo = document.getElementById("finDespModo")?.value || "UNICA";
      const recorrenciaIntervalo = document.getElementById("finDespRecorrencia")?.value || "mensal";
      const parcelas = Number(document.getElementById("finDespParcelas")?.value) || 2;
      if (!descricao || !vencimento || !Number.isFinite(valor) || valor <= 0) {
        alert("Preencha descrição, valor e vencimento.");
        return;
      }
      const submitBtn = e.target.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      try {
        const result = await insertManualPayableLancamento({
          descricao,
          valor,
          vencimento,
          categoria,
          fornecedor,
          formaPagamento,
          observacoes,
          pago: false,
          modo,
          parcelas,
          recorrenciaIntervalo,
          contaBancaria,
        });
        if (result.error) {
          alert(result.error.message || "Não foi possível salvar a despesa.");
          return;
        }
        const anexo = await readFinanceFileInput(document.getElementById("finDespAnexo"));
        if (anexo && result.ids?.length) {
          for (const pid of result.ids) await financeAttachmentSave("payable", pid, anexo);
        } else if (anexo && result.id) {
          await financeAttachmentSave("payable", result.id, anexo);
        }
        financeCloseDespesaModal();
        await Promise.all([loadPayables(), loadCash()]);
        renderFinance();
        updateDashboard?.();
        if (modo === "RECORRENTE") {
          finPagarTipo = "recorrente";
          const tipoSel = document.getElementById("finPagarTipo");
          if (tipoSel) tipoSel.value = "recorrente";
        }
        setFinanceView("pagar");
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });

    document.getElementById("finReceitaForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const cliente = document.getElementById("finRecCliente")?.value?.trim();
      const descricao = document.getElementById("finRecDescricao")?.value?.trim();
      const valor = Number(document.getElementById("finRecValor")?.value);
      const vencimento = document.getElementById("finRecVencimento")?.value;
      const categoria = document.getElementById("finRecCategoria")?.value;
      const formaPagamento = document.getElementById("finRecForma")?.value || "PIX";
      const observacoes = document.getElementById("finRecObs")?.value?.trim() || "";
      const modo = document.getElementById("finRecModo")?.value || "UNICA";
      const recorrenciaIntervalo = document.getElementById("finRecRecorrencia")?.value || "mensal";
      const parcelas = Number(document.getElementById("finRecParcelas")?.value) || 2;
      if (!cliente || !descricao || !vencimento || !Number.isFinite(valor) || valor <= 0) {
        alert("Preencha cliente, descrição, valor e vencimento.");
        return;
      }
      const submitBtn = e.target.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      try {
        const result = await insertManualReceivableLancamento({
          descricao,
          valor,
          data: vencimento,
          vencimento,
          categoria,
          cliente,
          formaPagamento,
          observacoes,
          pago: false,
          modo,
          parcelas,
          recorrenciaIntervalo,
        });
        if (result.error) {
          alert(result.error.message || "Não foi possível salvar a receita.");
          return;
        }
        const anexo = await readFinanceFileInput(document.getElementById("finRecAnexo"));
        if (anexo && result.ids?.length) {
          for (const rid of result.ids) await financeAttachmentSave("receivable", rid, anexo);
        } else if (anexo && result.id) {
          await financeAttachmentSave("receivable", result.id, anexo);
        }
        financeCloseReceitaModal();
        await Promise.all([loadReceivables(), loadCash()]);
        renderFinance();
        updateDashboard?.();
        if (modo === "RECORRENTE") {
          financeFilterTipo = "recorrente";
          const tipoSel = document.getElementById("finReceberTipo");
          if (tipoSel) tipoSel.value = "recorrente";
        }
        setFinanceView("receber");
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });

    document.getElementById("finBtnPrint")?.addEventListener("click", financePrintSubview);
    document.getElementById("finBtnPdf")?.addEventListener("click", financeExportPdfHint);
    document.getElementById("finBtnExcel")?.addEventListener("click", financeExportCurrentView);
    document.getElementById("finBtnRefresh")?.addEventListener("click", () => refreshFinanceData());

    document.getElementById("viewFinanceiro")?.addEventListener("click", async (e) => {
      const btnAg = e.target.closest("[data-fin-aguardando-id]");
      if (btnAg) {
        const id = btnAg.getAttribute("data-fin-aguardando-id");
        if (confirm("Liberar este título para Contas a receber?")) await financeApproveReceivable(id);
        return;
      }
      const btnRec = e.target.closest("[data-fin-receber-id]");
      if (btnRec) {
        const id = btnRec.getAttribute("data-fin-receber-id");
        const r = (state.receivables || []).find((x) => String(x.id) === String(id));
        if (!r) return;
        const v = financeVehicleById().get(r.vehicle_id);
        openReceberBaixaModal({ receivable: r, vehicle: v, valor: r.valor });
        return;
      }
      const btnPag = e.target.closest("[data-fin-pagar-id]");
      if (btnPag) {
        const id = btnPag.getAttribute("data-fin-pagar-id");
        const p = (state.payables || []).find((x) => String(x.id) === String(id));
        if (p) openPagarBaixaModal(p);
      }
    });

    document.getElementById("finDespesaModal")?.addEventListener("click", (e) => {
      if (e.target.id === "finDespesaModal") financeCloseDespesaModal();
    });
    document.getElementById("finReceitaModal")?.addEventListener("click", (e) => {
      if (e.target.id === "finReceitaModal") financeCloseReceitaModal();
    });
  };

  window.getFinanceRoot = function getFinanceRoot() {
    return financeRoot();
  };

  window.financeAutoContaReceberPatch = function financeAutoContaReceberPatch(recPatchBase, dataSaida) {
    const due = financeDefaultDueYmd(dataSaida);
    return {
      ...recPatchBase,
      status: "EM_ABERTO",
      financeiro_aprovado_contas_receber: true,
      data_vencimento: due,
    };
  };
})();

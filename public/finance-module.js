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
  let financeFilterAguardandoPlaca = "";
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

  function financeVehicleRpvNome(v) {
    if (!v) return "—";
    return financePartnerLabel(v.localizador_id);
  }

  function financeReceberRppNome(r, v) {
    if (typeof vehicleRpfNome === "function" && v) {
      const rpf = vehicleRpfNome(v);
      if (rpf && rpf !== "—") return rpf;
    }
    return r.responsavel_pagamento || "—";
  }

  function financeReceberDiariasParts(r, vehicle) {
    if (!r?.vehicle_id || !vehicle) return null;
    let days = null;
    if (typeof receivableFinanceBreakdown === "function") {
      const br = receivableFinanceBreakdown(r, vehicle);
      if (br?.dias != null) days = Number(br.dias);
    }
    const startStr = r.period_start || vehicle.data_entrada;
    const endStr = r.period_end || vehicle.data_saida;
    if (days == null && startStr && endStr) {
      days = Math.max(1, Math.ceil((new Date(endStr).getTime() - new Date(startStr).getTime()) / 86400000));
    } else if (days == null && typeof calcDays === "function" && vehicle.data_entrada && endStr) {
      days = calcDays({ ...vehicle, data_saida: endStr });
    } else if (days == null) {
      days = 0;
    }
    return { days };
  }

  function financeReceberDiariasCell(r, v) {
    const parts = financeReceberDiariasParts(r, v);
    if (!parts) return "—";
    return String(parts.days);
  }

  function financeInstituicaoNome(vehicle) {
    if (!vehicle) return "—";
    const loc = financePartnerLabel(vehicle.localizador_id);
    return vehicleRpfNome(vehicle) !== "—" ? vehicleRpfNome(vehicle) : loc;
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

  function financeNormalizePlate(str) {
    if (typeof normalizePlateSearch === "function") return normalizePlateSearch(str);
    return (str || "")
      .toString()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  function financePlateMatchesQuery(vehicle, queryNorm) {
    if (!queryNorm) return true;
    if (!vehicle?.placa) return false;
    const storedNorm = financeNormalizePlate(vehicle.placa);
    if (typeof plateNormMatchesQuery === "function") {
      return plateNormMatchesQuery(storedNorm, queryNorm);
    }
    return storedNorm.includes(queryNorm) || queryNorm.includes(storedNorm);
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

  function financeContasAguardandoFilteredList() {
    const vmap = financeVehicleById();
    const plateNorm = financeNormalizePlate(financeFilterAguardandoPlaca);
    return financeContasAguardandoList().filter((r) =>
      financePlateMatchesQuery(vmap.get(r.vehicle_id), plateNorm)
    );
  }

  function financeSyncAguardandoPlateHint() {
    const hint = document.getElementById("finAguardandoPlateHint");
    if (!hint) return;
    const q = (financeFilterAguardandoPlaca || "").trim();
    if (!q) {
      hint.textContent = "";
      hint.classList.add("hidden");
      return;
    }
    hint.textContent = `Consulta de placa: ${q}`;
    hint.classList.remove("hidden");
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

  function financeCashIsEntrada(mov) {
    const t = String(mov?.tipo_conta || "").toUpperCase();
    return t === "RECEBER" || t === "ENTRADA";
  }

  function financeCashIsSaida(mov) {
    const t = String(mov?.tipo_conta || "").toUpperCase();
    return t === "PAGAR" || t === "SAIDA" || t === "SAÍDA";
  }

  /** Valor da movimentação; se vier zerado na base, usa o título pago vinculado. */
  function financeCashMovValor(mov) {
    let v = Number(mov?.valor ?? mov?.amount ?? 0);
    if (!Number.isFinite(v)) v = 0;
    if (v > 0) return v;
    const contaId = mov?.conta_id;
    if (contaId == null || contaId === "") return 0;
    if (financeCashIsEntrada(mov)) {
      const rec = (state.receivables || []).find((r) => String(r.id) === String(contaId));
      if (rec && String(rec.status || "").toUpperCase() === "PAGO") {
        v = Number(rec.valor || 0);
      }
    } else if (financeCashIsSaida(mov)) {
      const pay = (state.payables || []).find((p) => String(p.id) === String(contaId));
      if (pay && String(pay.status || "").toUpperCase() === "PAGO") {
        v = Number(pay.valor || 0);
      }
    }
    return Number.isFinite(v) ? v : 0;
  }

  function financeCaixaEntradas() {
    return (state.cash || []).filter((m) => financeCashIsEntrada(m));
  }

  function financeCaixaSaidas() {
    return (state.cash || []).filter((m) => financeCashIsSaida(m));
  }

  function financeSaldoCaixa() {
    const ent = financeCaixaEntradas().reduce((s, m) => s + financeCashMovValor(m), 0);
    const sai = financeCaixaSaidas().reduce((s, m) => s + financeCashMovValor(m), 0);
    return ent - sai;
  }

  function financeTotalEntradas() {
    return financeCaixaEntradas().reduce((s, m) => s + financeCashMovValor(m), 0);
  }

  function financeTotalSaidas() {
    return financeCaixaSaidas().reduce((s, m) => s + financeCashMovValor(m), 0);
  }

  function financeCaixaMovsForPeriod(periodoYm) {
    let movs = [...(state.cash || [])];
    if (periodoYm) {
      movs = movs.filter(
        (mov) => yearMonthFromYmd(toLocalYmd(mov.data_movimento || mov.created_at)) === periodoYm
      );
    }
    return movs;
  }

  function financeCaixaTotalsForMovs(movs) {
    let entradas = 0;
    let saidas = 0;
    movs.forEach((mov) => {
      const v = financeCashMovValor(mov);
      if (financeCashIsEntrada(mov)) entradas += v;
      else if (financeCashIsSaida(mov)) saidas += v;
    });
    return { entradas, saidas, resultado: entradas - saidas };
  }

  function financeSyncCaixaPeriodoFromDom() {
    financeFilterPeriodo = document.getElementById("finFilterPeriodo")?.value || "";
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
    const parts = financeReceberDiariasParts(r, vehicle);
    if (!parts) return "—";
    return parts.days;
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
        const veiculoRpvHtml = isPatio
          ? `<strong>${escapeHtml(v?.placa || "—")}</strong><br /><span class="notice">${escapeHtml([v?.marca, v?.modelo].filter(Boolean).join(" ") || "—")}</span><br /><span class="notice">RPV: ${escapeHtml(financeVehicleRpvNome(v))}</span>`
          : `<span class="notice">—</span>`;
        const rppHtml = escapeHtml(financeReceberRppNome(r, v));
        const diariasHtml = escapeHtml(financeReceberDiariasCell(r, v));
        const btnPay =
          st !== "Recebido"
            ? `<div style="margin-top:6px"><button type="button" class="secondary fin-btn-confirm" data-fin-receber-id="${escapeHtml(String(r.id))}">Confirmar pagamento</button></div>`
            : "";
        return `<tr>
          <td data-label="Veículo / RPV">${veiculoRpvHtml}</td>
          <td data-label="RPP">${rppHtml}</td>
          <td data-label="Diárias">${diariasHtml}</td>
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
    financeSyncAguardandoPlateHint();
    const vmap = financeVehicleById();
    const list = financeContasAguardandoFilteredList();
    const plateFilter = financeNormalizePlate(financeFilterAguardandoPlaca);
    if (totalEl) totalEl.textContent = formatCurrency(list.reduce((s, r) => s + Number(r.valor || 0), 0));
    if (!list.length) {
      body.innerHTML = `<tr><td colspan="6" class="notice">${
        plateFilter
          ? "Nenhum veículo aguardando faturamento com a placa informada."
          : "Nenhum veículo aguardando faturamento. Após saída (VRP), o registro aparece aqui até ir para Contas a receber."
      }</td></tr>`;
      return;
    }
    body.innerHTML = list
      .map((r) => {
        const v = vmap.get(r.vehicle_id);
        const saida = v?.data_saida || r.period_end;
        return `<tr>
          <td data-label="Veículo / RPV"><strong>${escapeHtml(v?.placa || "—")}</strong><br /><span class="notice">${escapeHtml([v?.marca, v?.modelo].filter(Boolean).join(" ") || "—")}</span><br /><span class="notice">RPV: ${escapeHtml(financeVehicleRpvNome(v))}</span></td>
          <td data-label="RPP">${escapeHtml(r.responsavel_pagamento || financeReceberRppNome(r, v))}</td>
          <td data-label="Saída">${escapeHtml(saida ? formatDate(saida) : "—")}</td>
          <td data-label="Valor">${escapeHtml(formatCurrency(Number(r.valor || 0)))}</td>
          <td data-label="Status"><span class="fin-tag fin-tag--open">Aguardando</span></td>
          <td data-label="Ações">
            <div class="fin-row-actions">
              <button type="button" class="secondary fin-btn-aguardando-receber" data-fin-aguardando-receber="${escapeHtml(String(r.id))}">Contas a receber</button>
              <button type="button" class="secondary fin-btn-aguardando-editar" data-fin-aguardando-editar="${escapeHtml(String(r.id))}">Editar</button>
              <button type="button" class="secondary fin-btn-aguardando-apagar" data-fin-aguardando-apagar="${escapeHtml(String(r.id))}">Apagar</button>
              <button type="button" class="secondary fin-btn-aguardando-voltar" data-fin-aguardando-voltar="${escapeHtml(String(r.id))}">Voltar</button>
            </div>
          </td>
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

  function financeCountPaidReceivablesSemCaixa() {
    const paid = (state.receivables || []).filter(
      (r) => String(r.status || "").toUpperCase() === "PAGO" && Number(r.valor || 0) > 0
    );
    const cashIds = new Set(
      (state.cash || [])
        .filter((m) => financeCashIsEntrada(m))
        .map((m) => String(m.conta_id))
    );
    return paid.filter((r) => !cashIds.has(String(r.id))).length;
  }

  async function financeSyncCaixaFromPaidReceivables() {
    const btn = document.getElementById("finCaixaSyncBtn");
    const hint = document.getElementById("finCaixaSyncHint");
    const prev = btn?.textContent;
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Sincronizando…";
    }
    try {
      if (typeof loadReceivables === "function") await loadReceivables();
      let stats = { created: 0, fixed: 0, failed: 0 };
      if (typeof window.syncPaidReceivablesCashMovements === "function") {
        stats = (await window.syncPaidReceivablesCashMovements()) || stats;
      } else if (typeof loadCash === "function") {
        await loadCash();
      }
      if (typeof loadCash === "function") await loadCash();
      financeRenderCaixa();
      if (hint) {
        const missing = financeCountPaidReceivablesSemCaixa();
        if (missing > 0) {
          hint.textContent = `${missing} pagamento(s) confirmado(s) ainda sem entrada visível no caixa. Verifique permissões no Supabase (tabela cash_movements) ou contacte o suporte.`;
          hint.classList.remove("hidden");
        } else if (stats.created + stats.fixed > 0) {
          hint.textContent = `Caixa sincronizado: ${stats.created} entrada(s) criada(s)${stats.fixed ? `, ${stats.fixed} corrigida(s)` : ""}.`;
          hint.classList.remove("hidden");
        } else {
          hint.textContent = "";
          hint.classList.add("hidden");
        }
      }
      return stats;
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = prev || "Sincronizar caixa";
      }
    }
  }

  async function financeRenderCaixaAsync() {
    await financeSyncCaixaFromPaidReceivables();
  }

  function financeRenderCaixa() {
    financeSyncCaixaPeriodoFromDom();
    const body = document.getElementById("finCaixaBody");
    const summaryEl = document.getElementById("finCaixaSummary");
    const periodoYm = financeFilterPeriodo || "";
    const movsPeriodo = financeCaixaMovsForPeriod(periodoYm);
    const totPeriodo = financeCaixaTotalsForMovs(movsPeriodo);
    const totGeral = financeCaixaTotalsForMovs(state.cash || []);
    const saldoGeral = totGeral.resultado;
    if (summaryEl) {
      const saldoPorConta = new Map();
      const defaultConta = state.settings?.conta_bancaria || "Caixa";
      saldoPorConta.set(defaultConta, 0);
      (state.cash || []).forEach((mov) => {
        const conta = financeMovContaLabel(mov);
        const v = financeCashMovValor(mov);
        const signed = financeCashIsSaida(mov) ? -v : v;
        saldoPorConta.set(conta, (saldoPorConta.get(conta) || 0) + signed);
      });
      const contasHtml = [...saldoPorConta.entries()]
        .map(([nome, val]) => `<p><strong>${escapeHtml(nome)}:</strong> ${escapeHtml(formatCurrency(val))}</p>`)
        .join("");
      const periodoLabel = periodoYm
        ? `Competência ${periodoYm}`
        : "Todos os períodos (lista abaixo)";
      summaryEl.innerHTML = `
        <p><strong>${escapeHtml(periodoLabel)}</strong></p>
        <p><strong>Entradas:</strong> <span class="fin-val-entrada">${escapeHtml(formatCurrency(totPeriodo.entradas))}</span></p>
        <p><strong>Saídas:</strong> <span class="fin-val-saida">${escapeHtml(formatCurrency(totPeriodo.saidas))}</span></p>
        <p><strong>Resultado:</strong> <span class="${totPeriodo.resultado >= 0 ? "fin-val-entrada" : "fin-val-saida"}">${escapeHtml(formatCurrency(totPeriodo.resultado))}</span></p>
        <p><strong>Saldo acumulado:</strong> ${escapeHtml(formatCurrency(saldoGeral))}</p>
        ${contasHtml}
      `;
    }
    if (!body) return;
    let movs = [...movsPeriodo].sort((a, b) =>
      String(b.data_movimento || b.created_at).localeCompare(String(a.data_movimento || a.created_at))
    );
    if (!movs.length) {
      const totalMovs = (state.cash || []).length;
      const periodoHint = periodoYm
        ? totalMovs > 0
          ? ` Nenhuma movimentação na competência ${periodoYm}, mas existem ${totalMovs} no total. Limpe o filtro «Competência» para ver todas.`
          : ` Nenhuma movimentação na competência ${periodoYm}. Limpe o filtro «Competência» para ver todas.`
        : "";
      const missingPaid = financeCountPaidReceivablesSemCaixa();
      const missingHint =
        missingPaid > 0
          ? ` Há ${missingPaid} pagamento(s) confirmado(s) sem entrada no caixa — clique em «Sincronizar caixa».`
          : "";
      body.innerHTML = `<tr><td colspan="6" class="notice">Nenhuma movimentação registrada.${periodoHint}${missingHint}</td></tr>`;
      return;
    }
    const rowsHtml = movs
      .slice(0, 300)
      .map((mov) => {
        const isEntrada = financeCashIsEntrada(mov);
        const rec = isEntrada ? (state.receivables || []).find((r) => String(r.id) === String(mov.conta_id)) : null;
        const pay = !isEntrada ? (state.payables || []).find((p) => String(p.id) === String(mov.conta_id)) : null;
        const v = rec ? financeVehicleById().get(rec.vehicle_id) : null;
        const tipoLabel = isEntrada ? "Entrada" : "Saída";
        const tipoClass = isEntrada ? "fin-val-entrada" : "fin-val-saida";
        const amount = financeCashMovValor(mov);
        const valSigned = isEntrada ? amount : -amount;
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
    body.innerHTML =
      rowsHtml +
      `<tr class="fin-caixa-total-row">
        <td colspan="4" data-label=""><strong>Total do período</strong></td>
        <td data-label="Valor"><strong class="${totPeriodo.resultado >= 0 ? "fin-val-entrada" : "fin-val-saida"}">${escapeHtml(formatCurrency(totPeriodo.resultado))}</strong></td>
        <td data-label=""></td>
      </tr>`;
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
        ["Veículo / RPV", "RPP", "Diárias", "Valor", "Vencimento", "Status"],
        ...list.map((r) => {
          const v = vmap.get(r.vehicle_id);
          return [
            v?.placa ? `${v.placa} / ${financeVehicleRpvNome(v)}` : r.responsavel_pagamento || "",
            financeReceberRppNome(r, v),
            financeReceberDiariasCell(r, v),
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

  function financeSyncReceberFiltersFromDom() {
    financeFilterBanco = document.getElementById("finFilterBusca")?.value?.trim() || "";
    financeFilterStatus = document.getElementById("finFilterStatus")?.value || "";
    financeFilterTipo = document.getElementById("finReceberTipo")?.value || "";
    financeSortReceber = document.getElementById("finSortReceber")?.value || "vencimento";
  }

  function financeReceberClienteLogoUrl() {
    const base = window.location?.origin || "";
    return `${base}/assets/recibo-header-logo.png`;
  }

  function financeReceberClienteLogoFallbackUrl() {
    const base = window.location?.origin || "";
    return `${base}/assets/logo.png`;
  }

  function financeReceberClientePartnerFromQuery(query) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return null;
    const partners = state.partners || [];
    const exact = partners.find((p) => String(p.nome || "").trim().toLowerCase() === q);
    if (exact) return exact;
    const partial = partners.filter((p) => String(p.nome || "").trim().toLowerCase().includes(q));
    return partial.length === 1 ? partial[0] : null;
  }

  function financeReceberClienteContext(list) {
    financeSyncReceberFiltersFromDom();
    const vmap = financeVehicleById();
    const busca = (financeFilterBanco || "").trim();
    const rppNames = [
      ...new Set(
        list
          .map((r) => financeReceberRppNome(r, vmap.get(r.vehicle_id)))
          .filter((n) => n && n !== "—")
      ),
    ];
    const plates = [
      ...new Set(
        list.map((r) => vmap.get(r.vehicle_id)?.placa).filter(Boolean)
      ),
    ];
    let destinatario = busca;
    if (!destinatario && rppNames.length === 1) destinatario = rppNames[0];
    else if (!destinatario && plates.length === 1) destinatario = `Placa ${plates[0]}`;
    const partner = financeReceberClientePartnerFromQuery(busca || destinatario);
    return { busca, destinatario: destinatario || "—", partner, rppNames, plates };
  }

  function financeReceberClienteVeiculoCell(r, v) {
    if (v?.placa) {
      const vm = [v.marca, v.modelo].filter(Boolean).join(" ") || "—";
      const rpv = financeVehicleRpvNome(v);
      return `<strong>${escapeHtml(v.placa)}</strong><br /><span class="muted">${escapeHtml(vm)}</span><br /><span class="muted">RPV: ${escapeHtml(rpv)}</span>`;
    }
    return `<span class="muted">${escapeHtml(r.responsavel_pagamento || r.observacoes || "—")}</span>`;
  }

  function financeReceberClientePrintCss() {
    return `
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; margin: 0; color: #0f172a; background: #fff; }
  .doc { max-width: 920px; margin: 0 auto; padding: 24px 28px 32px; }
  .doc-head { text-align: center; border-bottom: 3px solid #dc2626; padding-bottom: 16px; margin-bottom: 18px; }
  .doc-head img { max-height: 52px; max-width: 320px; object-fit: contain; }
  .doc-title { margin: 14px 0 4px; font-size: 1.25rem; font-weight: 700; }
  .doc-sub { margin: 0; color: #475569; font-size: 0.88rem; }
  .doc-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; margin: 14px 0 18px; }
  .doc-box h2 { margin: 0 0 8px; font-size: 0.78rem; letter-spacing: 0.04em; text-transform: uppercase; color: #64748b; }
  .doc-box p { margin: 4px 0; font-size: 0.95rem; }
  .doc-meta { font-size: 0.82rem; color: #475569; margin-bottom: 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
  th, td { border: 1px solid #cbd5e1; padding: 8px 9px; text-align: left; vertical-align: top; }
  th { background: #f1f5f9; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .muted { color: #64748b; font-size: 0.78rem; }
  .total { margin-top: 14px; font-size: 1.05rem; font-weight: 700; text-align: right; }
  .footer { margin-top: 22px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 0.78rem; color: #64748b; text-align: center; }
  @page { margin: 14mm; }
  @media print { .doc { padding: 0; max-width: none; } }`;
  }

  function financeBuildReceberClienteDocument() {
    const list = financeContasReceberList();
    if (!list.length) {
      return { error: "Nenhum título a receber com os filtros atuais." };
    }
    const vmap = financeVehicleById();
    const ctx = financeReceberClienteContext(list);
    const cfg = state.settings || {};
    const nomePatio = (cfg.nome_patio || "").trim() || "AMPLIAUTO";
    const emitente =
      typeof window.reciboEmitenteNome === "function" ? window.reciboEmitenteNome(cfg) : nomePatio;
    const cnpjFmt =
      typeof window.reciboCnpjExibicao === "function" ? window.reciboCnpjExibicao(cfg) : cfg.cnpj || "—";
    const footerLine =
      typeof window.reciboFooterLine === "function" ? window.reciboFooterLine(cfg) : cfg.endereco || "";
    const total = list.reduce((s, r) => s + Number(r.valor || 0), 0);
    const logoUrl = financeReceberClienteLogoUrl();
    const logoFallback = financeReceberClienteLogoFallbackUrl();
    const emitido = typeof formatDateTime === "function" ? formatDateTime(new Date().toISOString()) : new Date().toLocaleString("pt-BR");
    const destLines = [];
    if (ctx.destinatario && ctx.destinatario !== "—") destLines.push(`<p><strong>${escapeHtml(ctx.destinatario)}</strong></p>`);
    if (ctx.partner) {
      const docPartner = ctx.partner.cpf || ctx.partner.cnpj || "";
      if (docPartner) destLines.push(`<p>CNPJ/CPF: ${escapeHtml(docPartner)}</p>`);
      if (ctx.partner.contato) destLines.push(`<p>Contato: ${escapeHtml(ctx.partner.contato)}</p>`);
    } else if (ctx.busca) {
      destLines.push(`<p>Referência: ${escapeHtml(ctx.busca)}</p>`);
    }
    if (ctx.plates.length) {
      destLines.push(`<p>Placa(s): ${escapeHtml(ctx.plates.join(", "))}</p>`);
    }
    const filtros = [
      ctx.busca ? `Busca: ${ctx.busca}` : "",
      financeFilterTipo ? `Tipo: ${financeFilterTipo}` : "",
      financeFilterStatus ? `Status: ${financeFilterStatus}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
    const rowsHtml = list
      .map((r) => {
        const v = vmap.get(r.vehicle_id);
        const due = financeContaDueYmd(r, "receivable");
        return `<tr>
          <td>${financeReceberClienteVeiculoCell(r, v)}</td>
          <td>${escapeHtml(financeReceberRppNome(r, v))}</td>
          <td>${escapeHtml(String(financeReceberDiariasCell(r, v)))}</td>
          <td>${escapeHtml(formatCurrency(Number(r.valor || 0)))}</td>
          <td>${escapeHtml(due ? formatDate(due) : "—")}</td>
        </tr>`;
      })
      .join("");
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8" /><title>${escapeHtml(
      nomePatio
    )} — Contas a receber</title><style>${financeReceberClientePrintCss()}</style></head><body>
  <div class="doc">
    <header class="doc-head">
      <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(nomePatio)}" onerror="this.onerror=null;this.src='${escapeHtml(logoFallback)}';" />
      <h1 class="doc-title">Contas a receber</h1>
      <p class="doc-sub">${escapeHtml(nomePatio)} · CNPJ ${escapeHtml(cnpjFmt)}</p>
    </header>
    <div class="doc-box">
      <h2>Destinatário</h2>
      ${destLines.join("") || `<p class="muted">Consulta sem filtro de busca.</p>`}
    </div>
    <div class="doc-meta">${escapeHtml([`Emitido: ${emitido}`, filtros || "Todos os títulos listados"].join(" · "))}</div>
    <table>
      <thead><tr><th>Veículo / RPV</th><th>RPP</th><th>Diárias</th><th>Valor</th><th>Vencimento</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <p class="total">Total a receber: ${escapeHtml(formatCurrency(total))}</p>
    <footer class="footer">${escapeHtml(emitente)}${footerLine ? ` · ${escapeHtml(footerLine)}` : ""}</footer>
  </div>
</body></html>`;
    const safeName = String(ctx.destinatario || ctx.busca || "cliente")
      .replace(/[^\w\s-]+/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 40) || "cliente";
    return { html, filename: `contas-a-receber-${safeName}-${financeTodayYmd()}`, ctx, list, total, nomePatio, emitente, cnpjFmt, footerLine };
  }

  function financePrintReceberCliente() {
    const doc = financeBuildReceberClienteDocument();
    if (doc.error) {
      alert(doc.error);
      return;
    }
    if (typeof window.printHtmlInHiddenIframe === "function") {
      window.printHtmlInHiddenIframe(doc.html, { iframeTitle: "Contas a receber — cliente", closeModalId: null });
      return;
    }
    alert("Impressão indisponível neste navegador.");
  }

  async function financeDownloadReceberClientePdf() {
    const doc = financeBuildReceberClienteDocument();
    if (doc.error) {
      alert(doc.error);
      return;
    }
    const btn = document.getElementById("finReceberBtnPdf") || document.getElementById("finBtnPdf");
    const prev = btn?.textContent;
    if (btn) {
      btn.disabled = true;
      btn.textContent = "A gerar PDF…";
    }
    try {
      if (typeof window.loadJsPdf !== "function") throw new Error("loadJsPdf");
      await window.loadJsPdf();
      const jsPdfCtor = window.jspdf?.jsPDF;
      if (!jsPdfCtor) throw new Error("jsPDF indisponível");
      const pdf = new jsPdfCtor({ unit: "pt", format: "a4", orientation: "portrait" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const marginX = 42;
      const marginR = 42;
      const contentW = pageW - marginX - marginR;
      const footerY = pageH - 36;
      let y = 0;

      const bandH = 72;
      pdf.setFillColor(10, 11, 15);
      pdf.rect(0, 0, pageW, bandH, "F");
      const logo =
        typeof window.loadReciboLogoDataUrl === "function" ? await window.loadReciboLogoDataUrl() : null;
      if (logo) {
        try {
          const props = pdf.getImageProperties(logo.dataUrl);
          const maxW = 240;
          const maxH = 38;
          let imgW = maxW;
          let imgH = (props.height * imgW) / props.width;
          if (imgH > maxH) {
            imgH = maxH;
            imgW = (props.width * imgH) / props.height;
          }
          pdf.addImage(logo.dataUrl, logo.type, (pageW - imgW) / 2, (bandH - imgH) / 2, imgW, imgH);
        } catch {
          pdf.setTextColor(255, 255, 255);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(16);
          pdf.text(String(doc.nomePatio).toUpperCase(), pageW / 2, bandH / 2 + 5, { align: "center" });
        }
      } else {
        pdf.setTextColor(255, 255, 255);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(16);
        pdf.text(String(doc.nomePatio).toUpperCase(), pageW / 2, bandH / 2 + 5, { align: "center" });
      }
      pdf.setDrawColor(220, 38, 38);
      pdf.setLineWidth(1);
      pdf.line(0, bandH, pageW, bandH);
      y = bandH + 28;

      const ensureSpace = (need) => {
        if (y + need <= footerY) return;
        pdf.addPage();
        y = 48;
      };

      pdf.setTextColor(15, 23, 42);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.text("Contas a receber", pageW / 2, y, { align: "center" });
      y += 16;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9.5);
      pdf.setTextColor(71, 85, 105);
      pdf.text(`${doc.nomePatio} · CNPJ ${doc.cnpjFmt}`, pageW / 2, y, { align: "center" });
      y += 22;

      pdf.setFillColor(248, 250, 252);
      pdf.setDrawColor(226, 232, 240);
      const destTitle = "DESTINATÁRIO";
      const destBody = [];
      if (doc.ctx.destinatario && doc.ctx.destinatario !== "—") destBody.push(String(doc.ctx.destinatario));
      if (doc.ctx.partner) {
        const pdoc = doc.ctx.partner.cpf || doc.ctx.partner.cnpj || "";
        if (pdoc) destBody.push(`CNPJ/CPF: ${pdoc}`);
        if (doc.ctx.partner.contato) destBody.push(`Contato: ${doc.ctx.partner.contato}`);
      } else if (doc.ctx.busca) destBody.push(`Referência: ${doc.ctx.busca}`);
      if (doc.ctx.plates.length) destBody.push(`Placa(s): ${doc.ctx.plates.join(", ")}`);
      if (!destBody.length) destBody.push("Consulta sem filtro de busca.");
      const destLines = destBody.flatMap((line) => pdf.splitTextToSize(line, contentW - 24));
      const boxH = 28 + destLines.length * 12;
      ensureSpace(boxH + 8);
      pdf.rect(marginX, y, contentW, boxH, "FD");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      pdf.text(destTitle, marginX + 12, y + 14);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(15, 23, 42);
      pdf.text(destLines, marginX + 12, y + 28);
      y += boxH + 14;

      pdf.setFontSize(8.5);
      pdf.setTextColor(71, 85, 105);
      const meta = `Emitido: ${typeof formatDateTime === "function" ? formatDateTime(new Date().toISOString()) : new Date().toLocaleString("pt-BR")}`;
      pdf.text(meta, marginX, y);
      y += 16;

      const cols = [
        { label: "Veículo / RPV", w: 150 },
        { label: "RPP", w: 108 },
        { label: "Diárias", w: 48 },
        { label: "Valor", w: 72 },
        { label: "Vencimento", w: 72 },
      ];
      const drawTableHeader = () => {
        ensureSpace(22);
        let x = marginX;
        pdf.setFillColor(241, 245, 249);
        pdf.setDrawColor(203, 213, 225);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        pdf.setTextColor(15, 23, 42);
        cols.forEach((c) => {
          pdf.rect(x, y, c.w, 18, "FD");
          pdf.text(c.label, x + 4, y + 11);
          x += c.w;
        });
        y += 18;
      };
      drawTableHeader();

      const vmap = financeVehicleById();
      doc.list.forEach((r) => {
        const v = vmap.get(r.vehicle_id);
        const due = financeContaDueYmd(r, "receivable");
        const veiculoLines = v?.placa
          ? [String(v.placa), [v.marca, v.modelo].filter(Boolean).join(" ") || "—", `RPV: ${financeVehicleRpvNome(v)}`]
          : [String(r.responsavel_pagamento || r.observacoes || "—")];
        const cellLines = [
          veiculoLines.flatMap((line) => pdf.splitTextToSize(line, cols[0].w - 8)),
          pdf.splitTextToSize(String(financeReceberRppNome(r, v)), cols[1].w - 8),
          [String(financeReceberDiariasCell(r, v))],
          [formatCurrency(Number(r.valor || 0))],
          [due ? formatDate(due) : "—"],
        ];
        const rowH = Math.max(22, ...cellLines.map((lines) => lines.length * 11 + 8));
        if (y + rowH > footerY) {
          pdf.addPage();
          y = 48;
          drawTableHeader();
        }
        let x = marginX;
        cols.forEach((c, idx) => {
          pdf.setDrawColor(203, 213, 225);
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(8.5);
          pdf.setTextColor(15, 23, 42);
          pdf.rect(x, y, c.w, rowH, "S");
          pdf.text(cellLines[idx], x + 4, y + 11);
          x += c.w;
        });
        y += rowH;
      });

      ensureSpace(24);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.text(`Total a receber: ${formatCurrency(doc.total)}`, pageW - marginR, y + 4, { align: "right" });
      y += 18;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      const foot = [doc.emitente, doc.footerLine].filter(Boolean).join(" · ");
      if (foot) pdf.text(pdf.splitTextToSize(foot, contentW), pageW / 2, footerY, { align: "center" });

      pdf.save(`${doc.filename}.pdf`);
    } catch (e) {
      console.error(e);
      alert("Não foi possível gerar o PDF. Tente Imprimir e escolha «Salvar como PDF».");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = prev || "Baixar PDF para cliente";
      }
    }
  }

  function financePrintSubview() {
    if (currentFinanceView === "receber") {
      financePrintReceberCliente();
      return;
    }
    window.print();
  }

  async function financeExportPdfHint() {
    if (currentFinanceView === "receber") {
      await financeDownloadReceberClientePdf();
      return;
    }
    alert("Use Imprimir e escolha «Salvar como PDF» no diálogo do navegador.");
    window.print();
  }

  const FINANCE_SUBVIEWS = ["dashboard", "em_patio", "aguardando", "receber", "pagar", "caixa"];

  function financeRenderSubviewContent(view) {
    if (view === "dashboard") financeRenderDashboard();
    else if (view === "em_patio") financeRenderEmPatio();
    else if (view === "receber") financeRenderReceber();
    else if (view === "aguardando") financeRenderAguardando();
    else if (view === "pagar") financeRenderPagar();
    else if (view === "caixa") financeRenderCaixa();
  }

  function financeActivateSubview(view, opts = {}) {
    if (!view || view === "none") return;
    const resolved = view === "recorrentes" ? "pagar" : view;
    if (!FINANCE_SUBVIEWS.includes(resolved)) return;
    currentFinanceView = resolved;
    if (view === "recorrentes") {
      finPagarTipo = "recorrente";
      const tipoSel = document.getElementById("finPagarTipo");
      if (tipoSel) tipoSel.value = "recorrente";
    }
    const root = financeRoot();
    if (root) {
      FINANCE_SUBVIEWS.forEach((sub) => {
        const panel = root.querySelector(`.finance-subview[data-finance-subview="${sub}"]`);
        if (!panel) return;
        const show = sub === resolved;
        panel.classList.toggle("hidden", !show);
        panel.hidden = !show;
      });
      root.querySelectorAll("[data-finance-subview-btn]").forEach((btn) => {
        btn.classList.toggle("active", btn.getAttribute("data-finance-subview-btn") === resolved);
      });
    }
    if (resolved === "caixa") {
      if (!opts.skipRender) {
        financeRenderCaixaAsync();
        return;
      }
    }
    if (!opts.skipRender) financeRenderSubviewContent(resolved);
  }

  window.renderFinance = function renderFinance() {
    try {
      financeActivateSubview(currentFinanceView, { skipRender: true });
      if (currentFinanceView === "caixa") {
        financeRenderCaixaAsync();
      } else {
        financeRenderSubviewContent(currentFinanceView);
      }
    } catch (e) {
      console.error("renderFinance", e);
    }
  };

  window.getFinanceSubview = function getFinanceSubview() {
    return currentFinanceView;
  };

  function financeResolvePreserveView(opts = {}) {
    if (typeof opts.preserveView === "string" && opts.preserveView !== "none") {
      return opts.preserveView;
    }
    if (opts.preserveView === true) return currentFinanceView;
    return null;
  }

  window.refreshFinanceData = async function refreshFinanceData(opts = {}) {
    const preserveView = financeResolvePreserveView(opts);
    if (preserveView) {
      financeActivateSubview(preserveView);
    }
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
    if (refreshFinanceDataPromise) {
      await refreshFinanceDataPromise;
      if (!preserveView) return;
    }
    refreshFinanceDataPromise = (async () => {
      try {
        await Promise.all([
          loadReceivables(),
          loadPayables(),
          loadCash(),
          loadVehicles(),
          typeof loadCycleClosures === "function" ? loadCycleClosures() : Promise.resolve(),
        ]);
        if (typeof window.syncPaidPayablesCashMovements === "function") {
          await window.syncPaidPayablesCashMovements();
        }
        if (typeof window.syncPaidReceivablesCashMovements === "function") {
          await window.syncPaidReceivablesCashMovements();
        }
        if (preserveView) {
          financeActivateSubview(preserveView);
        } else {
          renderFinance();
        }
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
    const stayView = currentFinanceView;
    if (typeof requireSupabaseSessionForWrite === "function") {
      if (!(await requireSupabaseSessionForWrite())) return;
    }
    const r = (state.receivables || []).find((x) => String(x.id) === String(receivableId));
    if (!r) return;
    const patch = {
      financeiro_aprovado_contas_receber: true,
      patio_liberado_financeiro: true,
      status: r.status === RECEIVABLE_AGUARDANDO_LANCAMENTO ? "EM_ABERTO" : r.status,
    };
    const runUpdate = () =>
      supabase.from("receivables").update(patch).eq("id", receivableId).eq("user_id", effectiveUserId());
    let { error } =
      typeof runSupabaseWrite === "function" ? await runSupabaseWrite(runUpdate) : await runUpdate();
    if (error && /column|schema cache|PGRST204/i.test(error.message || "")) {
      addReceberTriagemId(receivableId);
      if (typeof removePatioFinanceiroBloqueadoReceivableId === "function") {
        removePatioFinanceiroBloqueadoReceivableId(receivableId);
      }
      error = null;
    }
    if (error) {
      if (typeof alertSupabaseError === "function") alertSupabaseError(error, "Não foi possível enviar para Contas a receber.");
      else alert(error.message);
      return;
    }
    if (typeof removePatioFinanceiroBloqueadoReceivableId === "function") {
      removePatioFinanceiroBloqueadoReceivableId(receivableId);
    }
    addReceberTriagemId(receivableId);
    const idx = (state.receivables || []).findIndex((x) => String(x.id) === String(receivableId));
    if (idx >= 0) {
      state.receivables[idx] = { ...state.receivables[idx], ...patch };
    }
    await refreshFinanceData({ preserveView: stayView && stayView !== "none" ? stayView : true });
  }

  window.setFinanceView = function setFinanceView(view) {
    if (!view || view === "none") return;
    financeActivateSubview(view);
  };

  window.openFinanceSubview = function openFinanceSubview(sub, opts = {}) {
    if (!sub) return;
    financeActivateSubview(sub);
    const hidden = financeRoot()?.classList.contains("hidden");
    if (hidden && typeof showMainView === "function") {
      showMainView("financeiro");
    } else if (!opts.skipRefresh && financeCanLoadData()) {
      refreshFinanceData({ preserveView: sub });
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
    document.getElementById("finCaixaSyncBtn")?.addEventListener("click", () => {
      financeSyncCaixaFromPaidReceivables();
    });
    document.getElementById("finChartPeriod")?.addEventListener("change", () => financeRenderDashboard());

    document.getElementById("finAguardandoPlateForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      financeFilterAguardandoPlaca = (document.getElementById("finAguardandoPlaca")?.value || "").trim();
      if (currentFinanceView === "aguardando") financeRenderAguardando();
    });
    document.getElementById("finAguardandoPlacaClear")?.addEventListener("click", () => {
      financeFilterAguardandoPlaca = "";
      const input = document.getElementById("finAguardandoPlaca");
      if (input) input.value = "";
      if (currentFinanceView === "aguardando") financeRenderAguardando();
    });

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
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });

    document.getElementById("finBtnPrint")?.addEventListener("click", financePrintSubview);
    document.getElementById("finBtnPdf")?.addEventListener("click", () => {
      financeExportPdfHint();
    });
    document.getElementById("finReceberBtnPrint")?.addEventListener("click", financePrintReceberCliente);
    document.getElementById("finReceberBtnPdf")?.addEventListener("click", () => {
      financeDownloadReceberClientePdf();
    });
    document.getElementById("finBtnExcel")?.addEventListener("click", financeExportCurrentView);
    document.getElementById("finBtnRefresh")?.addEventListener("click", () => refreshFinanceData());

    document.getElementById("viewFinanceiro")?.addEventListener("click", async (e) => {
      const btnReceber = e.target.closest("[data-fin-aguardando-receber]");
      if (btnReceber) {
        const id = btnReceber.getAttribute("data-fin-aguardando-receber");
        if (confirm("Enviar este título para Contas a receber?")) {
          await financeApproveReceivable(id);
        }
        return;
      }
      const btnEditar = e.target.closest("[data-fin-aguardando-editar]");
      if (btnEditar) {
        const id = btnEditar.getAttribute("data-fin-aguardando-editar");
        if (typeof financeEditAguardandoReceivable === "function") await financeEditAguardandoReceivable(id);
        return;
      }
      const btnApagar = e.target.closest("[data-fin-aguardando-apagar]");
      if (btnApagar) {
        const id = btnApagar.getAttribute("data-fin-aguardando-apagar");
        if (typeof financeDeleteAguardandoReceivable === "function") await financeDeleteAguardandoReceivable(id);
        return;
      }
      const btnVoltar = e.target.closest("[data-fin-aguardando-voltar]");
      if (btnVoltar) {
        const id = btnVoltar.getAttribute("data-fin-aguardando-voltar");
        if (typeof financeVoltarAguardandoReceivable === "function") await financeVoltarAguardandoReceivable(id);
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

  window.financeCashMovValor = financeCashMovValor;
})();

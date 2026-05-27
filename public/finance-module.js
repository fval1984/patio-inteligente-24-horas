/**
 * Módulo Financeiro Amplipatio — integrado ao pátio existente.
 * Depende de globals definidos em app.html (state, calcTotal, formatCurrency, etc.).
 */
(function () {
  let currentFinanceView = "dashboard";
  let financeFilterBanco = "";
  let financeFilterStatus = "";
  let financeFilterPeriodo = "";
  let financeSortReceber = "vencimento";

  function financeRoot() {
    return document.getElementById("viewFinanceiro");
  }

  function financeVehicleById() {
    return new Map((state.vehicles || []).map((v) => [v.id, v]));
  }

  function financePartnerLabel(id) {
    return state.partners.find((p) => p.id === id)?.nome || "—";
  }

  function financeInstituicaoNome(vehicle) {
    if (!vehicle) return "—";
    const ass = financePartnerLabel(vehicle.assessoria_id);
    const loc = financePartnerLabel(vehicle.localizador_id);
    return vehicleRpfNome(vehicle) !== "—" ? vehicleRpfNome(vehicle) : ass !== "—" ? ass : loc;
  }

  /** Veículos no pátio gerando receita (não é conta a receber ainda). */
  function financeVehiclesEmGeracao() {
    const statuses = ["NO_PATIO", "LIBERACAO_SOLICITADA", "LIBERACAO_CONFIRMADA", "REMocao_CONFIRMADA"];
    return (state.vehicles || [])
      .filter((v) => statuses.includes(v.status))
      .map((v) => {
        const dias = Math.max(
          1,
          Math.ceil(
            (Date.now() - new Date(v.data_entrada || Date.now()).getTime()) / 86400000
          )
        );
        return {
          vehicle: v,
          dias,
          valor: calcTotal(v),
          instituicao: financeInstituicaoNome(v),
        };
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
    const today = toLocalYmd(new Date().toISOString());
    if (due && today && due < today) return "Atrasado";
    return "Pendente";
  }

  function financeReceivableStatusClass(st) {
    if (st === "Recebido") return "fin-tag fin-tag--ok";
    if (st === "Atrasado") return "fin-tag fin-tag--late";
    return "fin-tag fin-tag--open";
  }

  function financeContasReceberList() {
    const vmap = financeVehicleById();
    let list = (state.receivables || []).filter((r) => receivableIsContaReceberFinanceiro(r));
    const q = (financeFilterBanco || "").trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const v = vmap.get(r.vehicle_id);
        const blob = [
          r.responsavel_pagamento,
          r.observacoes,
          v?.placa,
          v?.marca,
          v?.modelo,
          financeInstituicaoNome(v),
        ]
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

  function financeHistoricoRecebidos() {
    return (state.receivables || []).filter((r) => r.status === "PAGO" && r.vehicle_id);
  }

  function financeCaixaEntradas() {
    return (state.cash || []).filter((m) => m.tipo_conta === "RECEBER");
  }

  function financeSaldoCaixa() {
    return financeCaixaEntradas().reduce((s, m) => s + Number(m.valor || 0), 0);
  }

  function financeRecebidoMesAtual() {
    const ym = yearMonthFromYmd(toLocalYmd(new Date().toISOString()));
    return sumReceivableRevenueByMonth(ym, state.receivables || [], state.cash || []);
  }

  function financeRecebidoHoje() {
    const today = toLocalYmd(new Date().toISOString());
    return sumReceivableRevenueByDay(today, state.receivables || [], state.cash || []);
  }

  function financeMetrics() {
    const emGeracao = financeVehiclesEmGeracao();
    const contas = financeContasReceberList();
    const totalGeracao = emGeracao.reduce((s, x) => s + x.valor, 0);
    const totalReceber = contas.reduce((s, r) => s + Number(r.valor || 0), 0);
    const pendentes = contas.filter((r) => financeReceivableDisplayStatus(r) !== "Recebido").length;
    const recebidosMes = financeHistoricoRecebidos().filter((r) => {
      const ym = yearMonthFromYmd(toLocalYmd(r.updated_at || r.created_at));
      return ym === yearMonthFromYmd(toLocalYmd(new Date().toISOString()));
    }).length;
    return {
      totalGeracao,
      totalReceber,
      recebidoMes: financeRecebidoMesAtual(),
      veiculosPatio: emGeracao.length,
      pendentes,
      recebidosMes,
      saldo: financeSaldoCaixa(),
      recebidoHoje: financeRecebidoHoje(),
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
    if (vehicle) return Math.max(1, Math.ceil((new Date(vehicle.data_saida || Date.now()) - new Date(vehicle.data_entrada)) / 86400000));
    return "—";
  }

  function financeRenderDashboard() {
    const m = financeMetrics();
    const el = document.getElementById("finDashCards");
    if (!el) return;
    el.innerHTML = `
      <div class="fin-card fin-card--gen"><span class="fin-card-label">Receita em geração</span><strong>${escapeHtml(formatCurrency(m.totalGeracao))}</strong><small>${m.veiculosPatio} veículo(s) no pátio</small></div>
      <div class="fin-card fin-card--recv"><span class="fin-card-label">Contas a receber</span><strong>${escapeHtml(formatCurrency(m.totalReceber))}</strong><small>${m.pendentes} cobrança(s) pendente(s)</small></div>
      <div class="fin-card fin-card--month"><span class="fin-card-label">Recebido no mês</span><strong>${escapeHtml(formatCurrency(m.recebidoMes))}</strong><small>pagamentos confirmados</small></div>
      <div class="fin-card fin-card--today"><span class="fin-card-label">Recebido hoje</span><strong>${escapeHtml(formatCurrency(m.recebidoHoje))}</strong><small>entradas do dia</small></div>
      <div class="fin-card fin-card--saldo"><span class="fin-card-label">Saldo caixa</span><strong>${escapeHtml(formatCurrency(m.saldo))}</strong><small>histórico de recebimentos</small></div>
      <div class="fin-card fin-card--count"><span class="fin-card-label">Recebidas no mês</span><strong>${m.recebidosMes}</strong><small>cobranças quitadas</small></div>
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
      body.innerHTML = `<tr><td colspan="8" class="notice">Nenhuma conta a receber. Veículos que saírem do pátio aparecem aqui automaticamente.</td></tr>`;
      return;
    }
    body.innerHTML = list
      .map((r) => {
        const v = vmap.get(r.vehicle_id);
        const st = financeReceivableDisplayStatus(r);
        const due = financeContaDueYmd(r, "receivable");
        const dias = financeDiariasFromReceivable(r, v);
        return `<tr>
          <td data-label="Veículo"><strong>${escapeHtml(v?.placa || "—")}</strong><br /><span class="notice">${escapeHtml([v?.marca, v?.modelo].filter(Boolean).join(" ") || "—")}</span></td>
          <td data-label="Financeira / banco">${escapeHtml(financeInstituicaoNome(v))}</td>
          <td data-label="Entrada">${escapeHtml(v?.data_entrada ? formatDate(v.data_entrada) : formatDate(r.period_start))}</td>
          <td data-label="Saída">${escapeHtml(v?.data_saida ? formatDate(v.data_saida) : formatDate(r.period_end))}</td>
          <td data-label="Diárias">${escapeHtml(String(dias))}</td>
          <td data-label="Valor">${escapeHtml(formatCurrency(Number(r.valor || 0)))}</td>
          <td data-label="Vencimento">${escapeHtml(due ? formatDate(due) : "—")}</td>
          <td data-label="Status"><span class="${financeReceivableStatusClass(st)}">${escapeHtml(st)}</span>
            <div style="margin-top:6px"><button type="button" class="secondary fin-btn-confirm" data-fin-receber-id="${escapeHtml(String(r.id))}">Confirmar pagamento</button></div>
          </td>
        </tr>`;
      })
      .join("");
  }

  function financeRenderCaixa() {
    const body = document.getElementById("finCaixaBody");
    const saldoEl = document.getElementById("finCaixaSaldo");
    const m = financeMetrics();
    if (saldoEl) saldoEl.textContent = formatCurrency(m.saldo);
    if (!body) return;
    let movs = [...financeCaixaEntradas()].sort(
      (a, b) => String(b.data_movimento || b.created_at).localeCompare(String(a.data_movimento || a.created_at))
    );
    if (financeFilterPeriodo) {
      movs = movs.filter((m) => yearMonthFromYmd(toLocalYmd(m.data_movimento || m.created_at)) === financeFilterPeriodo);
    }
    if (!movs.length) {
      body.innerHTML = `<tr><td colspan="5" class="notice">Nenhuma entrada registrada. Confirme pagamentos em Contas a receber.</td></tr>`;
      return;
    }
    body.innerHTML = movs
      .slice(0, 200)
      .map((m) => {
        const rec = (state.receivables || []).find((r) => String(r.id) === String(m.conta_id));
        const v = rec ? financeVehicleById().get(rec.vehicle_id) : null;
        return `<tr>
          <td data-label="Data">${escapeHtml(formatDate(m.data_movimento || m.created_at))}</td>
          <td data-label="Descrição">${escapeHtml(m.descricao || rec?.responsavel_pagamento || "Recebimento")}${v ? `<br /><span class="notice">${escapeHtml(v.placa || "")}</span>` : ""}</td>
          <td data-label="Forma">${escapeHtml(m.forma_pagamento || "—")}</td>
          <td data-label="Valor">${escapeHtml(formatCurrency(Number(m.valor || 0)))}</td>
          <td data-label="Conta">${escapeHtml(state.settings?.conta_bancaria || "Caixa")}</td>
        </tr>`;
      })
      .join("");
  }

  function financePrintSubview() {
    window.print();
  }

  function financeExportPdfHint() {
    alert("Use Imprimir e escolha «Salvar como PDF» no diálogo do navegador.");
    financePrintSubview();
  }

  window.renderFinance = function renderFinance() {
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
    else if (currentFinanceView === "caixa") financeRenderCaixa();
  };

  window.setFinanceView = function setFinanceView(view) {
    if (!view || view === "none") return;
    currentFinanceView = view;
    renderFinance();
  };

  window.openFinanceSubview = function openFinanceSubview(sub) {
    if (!sub) return;
    setFinanceView(sub);
    if (typeof showMainView === "function") showMainView("financeiro");
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
    document.getElementById("finFilterPeriodo")?.addEventListener("change", (e) => {
      financeFilterPeriodo = e.target.value || "";
      financeRenderCaixa();
    });
    document.getElementById("finChartPeriod")?.addEventListener("change", () => financeRenderDashboard());
    document.getElementById("finBtnPrint")?.addEventListener("click", financePrintSubview);
    document.getElementById("finBtnPdf")?.addEventListener("click", financeExportPdfHint);
    document.getElementById("finBtnRefresh")?.addEventListener("click", async () => {
      await Promise.all([loadReceivables(), loadCash(), loadVehicles()]);
      renderFinance();
      updateDashboard?.();
    });

    document.getElementById("viewFinanceiro")?.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-fin-receber-id]");
      if (!btn) return;
      const id = btn.getAttribute("data-fin-receber-id");
      const r = (state.receivables || []).find((x) => String(x.id) === String(id));
      if (!r) return;
      const v = financeVehicleById().get(r.vehicle_id);
      openReceberBaixaModal({ receivable: r, vehicle: v, valor: r.valor });
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


      const supabaseUrl = "https://mgnfuwlbvwarmjtiwsdh.supabase.co";
      const supabaseKey =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1nbmZ1d2xidndhcm1qdGl3c2RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxNjA2OTAsImV4cCI6MjA4NTczNjY5MH0.uA4i_aGJCu1fSVMdANkmOPfuyDuInaaqeTzyXrEgPD4";

      function resolveSupabaseCreateClient() {
        const g = window.supabase;
        if (g && typeof g.createClient === "function") return g.createClient.bind(g);
        if (g && g.default && typeof g.default.createClient === "function") {
          return g.default.createClient.bind(g.default);
        }
        return null;
      }

      let supabase = null;
      const createClientFn = resolveSupabaseCreateClient();
      if (createClientFn) {
        try {
          supabase = window.supabaseClient || createClientFn(supabaseUrl, supabaseKey);
          window.supabaseClient = supabase;
        } catch (e) {
          console.error(e);
        }
      }

      /** html2canvas só quando precisa (ficha PNG / lista PDF) — uma única carga partilhada */
      let html2canvasLoadPromise = null;
      function loadHtml2Canvas() {
        if (window.html2canvas) return Promise.resolve(window.html2canvas);
        if (html2canvasLoadPromise) return html2canvasLoadPromise;
        html2canvasLoadPromise = new Promise(function (resolve, reject) {
          var s = document.createElement("script");
          s.async = true;
          s.src = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
          s.onload = function () {
            if (window.html2canvas) resolve(window.html2canvas);
            else {
              html2canvasLoadPromise = null;
              reject(new Error("html2canvas"));
            }
          };
          s.onerror = function () {
            html2canvasLoadPromise = null;
            reject(new Error("html2canvas"));
          };
          document.head.appendChild(s);
        });
        return html2canvasLoadPromise;
      }

      let jsPdfLoadPromise = null;
      function loadJsPdf() {
        if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve();
        if (jsPdfLoadPromise) return jsPdfLoadPromise;
        jsPdfLoadPromise = new Promise(function (resolve, reject) {
          var s = document.createElement("script");
          s.async = true;
          s.src = "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js";
          s.onload = function () {
            resolve();
          };
          s.onerror = function () {
            jsPdfLoadPromise = null;
            reject(new Error("jspdf"));
          };
          document.head.appendChild(s);
        });
        return jsPdfLoadPromise;
      }

      const authPanel = document.getElementById("authPanel");
      const appPanel = document.getElementById("appPanel");
      const authStatus = document.getElementById("authStatus");
      const userInfo = document.getElementById("userInfo");

      const tabLogin = document.getElementById("tabLogin");
      const tabRegister = document.getElementById("tabRegister");
      const loginForm = document.getElementById("loginForm");
      const registerForm = document.getElementById("registerForm");

      const logoutBtn = document.getElementById("logoutBtn");
      const themeToggle = document.getElementById("themeToggle");
      const themeLabel = document.getElementById("themeLabel");

      const openVehicleForm = document.getElementById("openVehicleForm");
      const vehicleModal = document.getElementById("vehicleModal");
      const closeVehicleModal = document.getElementById("closeVehicleModal");
      const vehicleForm = document.getElementById("vehicleForm");
      const cancelVehicleForm = document.getElementById("cancelVehicleForm");
      const vehicleLocator = document.getElementById("vehicleLocator");
      const vehicleAssessor = document.getElementById("vehicleAssessor");
      const vehicleFinancialResponsible = document.getElementById("vehicleFinancialResponsible");
      const vehicleAuctioneer = document.getElementById("vehicleAuctioneer");
      const vehicleExit = document.getElementById("vehicleExit");
      const vehicleModalTitle = document.getElementById("vehicleModalTitle");
      const vehicleModalSubtitle = document.getElementById("vehicleModalSubtitle");

      const openPartnerForm = document.getElementById("openPartnerForm");
      const partnerModal = document.getElementById("partnerModal");
      const closePartnerModal = document.getElementById("closePartnerModal");
      const partnerModalTitle = document.getElementById("partnerModalTitle");
      const partnerForm = document.getElementById("partnerForm");
      const cancelPartnerForm = document.getElementById("cancelPartnerForm");
      const partnerNameLabel = document.getElementById("partnerNameLabel");
      const partnerDocLabel = document.getElementById("partnerDocLabel");
      const partnerContactLabel = document.getElementById("partnerContactLabel");
      const partnerDocInput = document.getElementById("partnerCpf");
      const partnerEmailWrap = document.getElementById("partnerEmailWrap");
      const partnerEmailInput = document.getElementById("partnerEmail");

      const dateModal = document.getElementById("dateModal");
      const closeDateModal = document.getElementById("closeDateModal");
      const cancelDateModal = document.getElementById("cancelDateModal");
      const confirmDateModal = document.getElementById("confirmDateModal");
      const dateModalTitle = document.getElementById("dateModalTitle");
      const dateModalLabel = document.getElementById("dateModalLabel");
      const dateModalInput = document.getElementById("dateModalInput");
      const liberacaoModal = document.getElementById("liberacaoModal");
      const closeLiberacaoModal = document.getElementById("closeLiberacaoModal");
      const cancelLiberacaoModal = document.getElementById("cancelLiberacaoModal");
      const confirmLiberacaoModal = document.getElementById("confirmLiberacaoModal");
      const liberacaoModalTitle = document.getElementById("liberacaoModalTitle");
      const libRowSolicitante = document.getElementById("libRowSolicitante");
      const libRowConfirmador = document.getElementById("libRowConfirmador");
      const libRowResponsavel = document.getElementById("libRowResponsavel");
      const libRowSolicRemocao = document.getElementById("libRowSolicRemocao");
      const libRowRemoveu = document.getElementById("libRowRemoveu");
      const libSolicitanteLabel = document.getElementById("libSolicitanteLabel");
      const libSolicitante = document.getElementById("libSolicitante");
      const libConfirmador = document.getElementById("libConfirmador");
      const libResponsavelPagamento = document.getElementById("libResponsavelPagamento");
      const libSolicitanteRemocao = document.getElementById("libSolicitanteRemocao");
      const libRemoveu = document.getElementById("libRemoveu");

      const openPayableForm = document.getElementById("openPayableForm");
      const payableModal = document.getElementById("payableModal");
      const closePayableModal = document.getElementById("closePayableModal");
      const payableForm = document.getElementById("payableForm");
      const cancelPayableForm = document.getElementById("cancelPayableForm");
      const payableCategory = document.getElementById("payableCategory");
      const lancamentoModal = document.getElementById("lancamentoModal");
      const lancamentoForm = document.getElementById("lancamentoForm");
      const closeLancamentoModal = document.getElementById("closeLancamentoModal");
      const cancelLancamentoForm = document.getElementById("cancelLancamentoForm");
      const lancCategoria = document.getElementById("lancCategoria");
      const lancCliente = document.getElementById("lancCliente");
      const lancClienteWrap = document.getElementById("lancClienteWrap");
      const lancFornecedorWrap = document.getElementById("lancFornecedorWrap");
      let lancamentoTipoAtual = "RECEITA";
      let lancamentoLockTipo = false;

      function syncLancamentoModoFields() {
        const modo = document.getElementById("lancModo")?.value || "UNICA";
        document.getElementById("lancParcelasWrap")?.classList.toggle("hidden", modo !== "PARCELADA");
      }

      function populateLancCentroCustoOptions() {
        const sel = document.getElementById("lancCentroCusto");
        if (!sel) return;
        const current = sel.value;
        const centros = cadastroBaseMerged().centros_custo || [];
        sel.innerHTML =
          `<option value="">Sem centro de custo</option>` +
          centros.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
        if (current && [...sel.options].some((o) => o.value === current)) sel.value = current;
      }

      function syncLancamentoCategoriaOptions() {
        if (!lancCategoria) return;
        const list = lancamentoTipoAtual === "RECEITA" ? getLancReceitaCategorias() : getLancDespesaCategorias();
        lancCategoria.innerHTML = list.map((c) => `<option value="${c.value}">${escapeHtml(c.label)}</option>`).join("");
      }

      function populateLancamentoClienteOptions() {
        if (!lancCliente) return;
        const current = lancCliente.value;
        const parceiros = (state.partners || []).filter((p) => isLocalizadorPartnerType(p.tipo || "PARCEIRO"));
        lancCliente.innerHTML =
          `<option value="">Sem cliente</option>` +
          parceiros
            .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || "")))
            .map((p) => `<option value="${escapeHtml(p.nome || "")}">${escapeHtml(p.nome || "-")}</option>`)
            .join("");
        if (current && [...lancCliente.options].some((o) => o.value === current)) lancCliente.value = current;
      }

      function syncLancamentoModalTipo(tipo) {
        lancamentoTipoAtual = tipo === "DESPESA" ? "DESPESA" : "RECEITA";
        document.querySelectorAll(".lanc-tipo-btn").forEach((btn) => {
          btn.classList.toggle("active", btn.getAttribute("data-lanc-tipo") === lancamentoTipoAtual);
        });
        lancClienteWrap?.classList.toggle("hidden", lancamentoTipoAtual !== "RECEITA");
        lancFornecedorWrap?.classList.toggle("hidden", lancamentoTipoAtual !== "DESPESA");
        document.getElementById("lancNaturezaWrap")?.classList.toggle("hidden", lancamentoTipoAtual !== "DESPESA");
        document.getElementById("lancCentroCustoWrap")?.classList.toggle("hidden", lancamentoTipoAtual !== "DESPESA");
        syncLancamentoCategoriaOptions();
        if (lancamentoTipoAtual === "DESPESA") populateLancCentroCustoOptions();
        syncLancamentoModoFields();
        const categoriaLabel = document.getElementById("lancCategoriaLabel");
        if (categoriaLabel) {
          categoriaLabel.textContent = lancamentoTipoAtual === "RECEITA" ? "Serviço" : "Categoria";
        }
        const title = document.getElementById("lancamentoModalTitle");
        if (title) {
          title.textContent = lancamentoTipoAtual === "RECEITA" ? "Novo lançamento — Receita" : "Novo lançamento — Despesa";
        }
      }

      function openLancamentoModal(presetTipo = "RECEITA", opts = {}) {
        if (!lancamentoModal || !lancamentoForm) return;
        lancamentoLockTipo = !!opts.lockTipo;
        lancamentoForm.reset();
        const today = toLocalYmd(new Date().toISOString());
        const lancData = document.getElementById("lancData");
        const lancVencimento = document.getElementById("lancVencimento");
        if (lancData) lancData.value = today;
        if (lancVencimento) lancVencimento.value = today;
        const lancCompetencia = document.getElementById("lancCompetencia");
        if (lancCompetencia) lancCompetencia.value = financeCompetencia || currentYearMonthLocal();
        const lancModo = document.getElementById("lancModo");
        const presetModo = String(opts.presetModo || "UNICA").toUpperCase();
        if (lancModo) lancModo.value = ["RECORRENTE", "PARCELADA"].includes(presetModo) ? presetModo : "UNICA";
        if (presetModo === "PARCELADA") {
          const lancParcelas = document.getElementById("lancParcelas");
          if (lancParcelas && !lancParcelas.value) lancParcelas.value = "2";
        }
        populateLancamentoClienteOptions();
        populateLancCentroCustoOptions();
        syncLancamentoModalTipo(presetTipo);
        if (lancamentoLockTipo) {
          lancamentoTipoAtual = presetTipo === "DESPESA" ? "DESPESA" : "RECEITA";
          document.querySelectorAll(".lanc-tipo-btn").forEach((btn) => {
            btn.classList.toggle("active", btn.getAttribute("data-lanc-tipo") === lancamentoTipoAtual);
          });
          lancClienteWrap?.classList.toggle("hidden", lancamentoTipoAtual !== "RECEITA");
          lancFornecedorWrap?.classList.toggle("hidden", lancamentoTipoAtual !== "DESPESA");
          document.getElementById("lancNaturezaWrap")?.classList.toggle("hidden", lancamentoTipoAtual !== "DESPESA");
          document.getElementById("lancCentroCustoWrap")?.classList.toggle("hidden", lancamentoTipoAtual !== "DESPESA");
        }
        document.querySelector(".lanc-tipo-toggle")?.classList.toggle("hidden", lancamentoLockTipo);
        syncLancamentoModoFields();
        lancamentoModal.classList.remove("hidden");
      }

      function closeLancamentoModalFn() {
        lancamentoModal?.classList.add("hidden");
        lancamentoForm?.reset();
        lancamentoLockTipo = false;
        document.querySelector(".lanc-tipo-toggle")?.classList.remove("hidden");
      }

      async function insertManualReceivableLancamento({
        descricao,
        valor,
        data,
        vencimento,
        categoria,
        cliente,
        formaPagamento,
        observacoes,
        pago,
        modo = "UNICA",
        parcelas = 2,
        competencia = "",
      }) {
        const clienteNome = String(cliente || "").trim();
        const modoUp = String(modo || "UNICA").toUpperCase();
        const count = modoUp === "PARCELADA" ? Math.max(2, Math.min(60, Number(parcelas) || 2)) : 1;
        const valorParcela = modoUp === "PARCELADA" ? Number(valor) / count : Number(valor);
        const grupoId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const insertedIds = [];

        for (let i = 0; i < count; i++) {
          const dueDate = addMonthsToYmd(vencimento || data, i) || vencimento || data;
          const isLast = i === count - 1;
          const markPago = pago && (count === 1 || isLast);
          const meta = {
            modo: modoUp,
            competencia: competencia || yearMonthFromYmd(data) || "",
            origem_modulo: "CONTROLE_RECEITAS",
            gerou_compromisso: !markPago,
            ...(modoUp === "PARCELADA" ? { parcela: i + 1, parcelas_total: count, grupo_id: grupoId } : {}),
          };
          const obsPacked = financeMetaPack(meta, observacoes || descricao);
          const sub =
            modoUp === "RECORRENTE" ? "RECORRENTE" : modoUp === "PARCELADA" ? `PARCELADA_${i + 1}` : "MANUAL";
          const payload = {
            user_id: effectiveUserId(),
            responsavel_pagamento: clienteNome || descricao,
            receivable_category: categoria,
            valor: valorParcela,
            status: markPago ? "PAGO" : "EM_ABERTO",
            period_start: data,
            period_end: dueDate,
            observacoes: obsPacked,
            forma_pagamento: formaPagamento,
            subcategoria: sub,
            financeiro_aprovado_contas_receber: true,
            patio_liberado_financeiro: true,
          };
          let { data: inserted, error } = await supabase.from("receivables").insert(payload).select("id").single();
          if (error && /column|schema cache|PGRST204/i.test(error.message || "")) {
            const fallback = { ...payload };
            delete fallback.patio_liberado_financeiro;
            delete fallback.financeiro_aprovado_contas_receber;
            delete fallback.forma_pagamento;
            delete fallback.subcategoria;
            ({ data: inserted, error } = await supabase.from("receivables").insert(fallback).select("id").single());
          }
          if (error) return { error };
          const receivableId = inserted?.id;
          if (receivableId) insertedIds.push(receivableId);
          if (receivableId && !markPago && !FINANCE_MANUAL_ONLY) addReceberTriagemId(receivableId);
          if (markPago && receivableId) {
            await supabase.from("cash_movements").insert({
              user_id: effectiveUserId(),
              tipo_conta: "RECEBER",
              conta_id: receivableId,
              valor: valorParcela,
              descricao: descricao || "Receita manual",
              data_movimento: data,
              forma_pagamento: formaPagamento,
            });
          }
        }
        return { id: insertedIds[0], ids: insertedIds };
      }

      async function insertManualPayableLancamento({
        descricao,
        valor,
        vencimento,
        categoria,
        fornecedor,
        formaPagamento,
        observacoes,
        pago,
        modo = "UNICA",
        parcelas = 2,
        natureza = "VARIAVEL",
        centroCusto = "",
        competencia = "",
      }) {
        const modoUp = String(modo || "UNICA").toUpperCase();
        const count = modoUp === "PARCELADA" ? Math.max(2, Math.min(60, Number(parcelas) || 2)) : 1;
        const valorParcela = modoUp === "PARCELADA" ? Number(valor) / count : Number(valor);
        const grupoId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const insertedIds = [];

        for (let i = 0; i < count; i++) {
          const dueDate = addMonthsToYmd(vencimento, i) || vencimento;
          const isLast = i === count - 1;
          const markPago = pago && (count === 1 || isLast);
          const meta = {
            modo: modoUp,
            natureza: String(natureza || "VARIAVEL").toUpperCase(),
            centro_custo: String(centroCusto || "").trim() || null,
            competencia: competencia || yearMonthFromYmd(vencimento) || "",
            origem_modulo: "CONTROLE_DESPESAS",
            gerou_compromisso: !markPago,
            ...(modoUp === "PARCELADA" ? { parcela: i + 1, parcelas_total: count, grupo_id: grupoId } : {}),
          };
          const obsPacked = financeMetaPack(meta, observacoes);
          const payload = {
            user_id: effectiveUserId(),
            tipo: modoUp === "RECORRENTE" ? "RECORRENTE" : modoUp === "PARCELADA" ? "PARCELADA" : "UNICA",
            payable_category: categoria,
            descricao: count > 1 ? `${descricao} (${i + 1}/${count})` : descricao,
            valor: valorParcela,
            data_vencimento: dueDate,
            status: markPago ? "PAGO" : "EM_ABERTO",
            fornecedor: fornecedor || null,
            forma_pagamento: formaPagamento,
            observacoes: obsPacked || null,
            centro_custo: centroCusto || null,
          };
          let { data: inserted, error } = await supabase.from("payables").insert(payload).select("id").single();
          if (error && /column|schema cache|PGRST204/i.test(error.message || "")) {
            const fallback = { ...payload };
            delete fallback.fornecedor;
            delete fallback.forma_pagamento;
            delete fallback.observacoes;
            delete fallback.centro_custo;
            ({ data: inserted, error } = await supabase.from("payables").insert(fallback).select("id").single());
          }
          if (error) return { error };
          const payableId = inserted?.id;
          if (payableId) insertedIds.push(payableId);
          if (markPago && payableId) {
            await supabase.from("cash_movements").insert({
              user_id: effectiveUserId(),
              tipo_conta: "PAGAR",
              conta_id: payableId,
              valor: valorParcela,
              descricao: descricao || "Despesa manual",
              data_movimento: dueDate,
              forma_pagamento: formaPagamento,
            });
          }
        }
        return { id: insertedIds[0], ids: insertedIds };
      }

      async function createNextRecorrenteReceivable(receivable) {
        if (!receivable) return;
        const modo = financeEntryModoFromRecord(receivable, "receivable");
        if (modo !== "RECORRENTE") return;
        const due = String(receivable.period_end || receivable.period_start || "").trim();
        const nextDue = addMonthsToYmd(due, 1);
        const { meta, text } = financeMetaUnpack(receivable.observacoes);
        const payload = {
          user_id: effectiveUserId(),
          responsavel_pagamento: receivable.responsavel_pagamento,
          receivable_category: receivable.receivable_category || "GUARDA_PATIO",
          valor: Number(receivable.valor || 0),
          status: "EM_ABERTO",
          period_start: nextDue,
          period_end: nextDue,
          observacoes: financeMetaPack({ ...meta, modo: "RECORRENTE" }, text),
          forma_pagamento: receivable.forma_pagamento,
          subcategoria: "RECORRENTE",
          financeiro_aprovado_contas_receber: true,
          patio_liberado_financeiro: true,
        };
        let { error } = await supabase.from("receivables").insert(payload);
        if (error && /column|schema cache|PGRST204/i.test(error.message || "")) {
          const fallback = { ...payload };
          delete fallback.patio_liberado_financeiro;
          delete fallback.financeiro_aprovado_contas_receber;
          delete fallback.forma_pagamento;
          delete fallback.subcategoria;
          ({ error } = await supabase.from("receivables").insert(fallback));
        }
        if (error) console.warn("recorrente receita", error.message);
      }

      const fichaModal = document.getElementById("fichaModal");
      const closeFichaModal = document.getElementById("closeFichaModal");
      const printFicha = document.getElementById("printFicha");
      const downloadFicha = document.getElementById("downloadFicha");
      const fichaCapture = document.getElementById("fichaCapture");
      const fichaResumo = document.getElementById("fichaResumo");
      const fichaTimeline = document.getElementById("fichaTimeline");
      const fichaSectionSnf = document.getElementById("fichaSectionSnf");
      const fichaSectionSlv = document.getElementById("fichaSectionSlv");
      const fichaSectionVistoria = document.getElementById("fichaSectionVistoria");
      const fichaModalTitle = document.getElementById("fichaModalTitle");
      const nfseModal = document.getElementById("nfseModal");
      const closeNfseModal = document.getElementById("closeNfseModal");
      const nfseResumo = document.getElementById("nfseResumo");
      const nfseTexto = document.getElementById("nfseTexto");
      const confirmNfse = document.getElementById("confirmNfse");
      const nfseCopyBtn = document.getElementById("nfseCopyBtn");
      const nfseCopyActions = document.getElementById("nfseCopyActions");
      const nfseConfirmActions = document.getElementById("nfseConfirmActions");
      const cancelNfseConfirm = document.getElementById("cancelNfseConfirm");
      const nfseCopyHint = document.getElementById("nfseCopyHint");
      const textModal = document.getElementById("textModal");
      const textModalTitle = document.getElementById("textModalTitle");
      const textModalBody = document.getElementById("textModalBody");
      const closeTextModal = document.getElementById("closeTextModal");
      const closeTextModal2 = document.getElementById("closeTextModal2");
      const copyTextModal = document.getElementById("copyTextModal");
      const reciboModal = document.getElementById("reciboModal");
      const closeReciboModal = document.getElementById("closeReciboModal");
      const cancelReciboModal = document.getElementById("cancelReciboModal");
      const confirmReciboModal = document.getElementById("confirmReciboModal");
      const printReciboModal = document.getElementById("printReciboModal");
      const receberBaixaModal = document.getElementById("receberBaixaModal");
      const pagarBaixaModal = document.getElementById("pagarBaixaModal");
      const financeCobrancaModal = document.getElementById("financeCobrancaModal");
      const financeContaEditModal = document.getElementById("financeContaEditModal");
      const financeContaEditForm = document.getElementById("financeContaEditForm");
      const reciboDestinatarioNome = document.getElementById("reciboDestinatarioNome");
      const reciboDestinatarioDoc = document.getElementById("reciboDestinatarioDoc");

      const tableNoPatio = document.getElementById("tableNoPatio");
      const tableConfirmada = document.getElementById("tableConfirmada");
      const tableRemocaoConfirmada = document.getElementById("tableRemocaoConfirmada");
      const tableRemovidos = document.getElementById("tableRemovidos");
      const tableFechamentoCiclo = document.getElementById("tableFechamentoCiclo");
      const tableLocalizadores = document.getElementById("tableLocalizadores");
      const tableAssessorias = document.getElementById("tableAssessorias");
      const tableInstituicoesFinanceiras = document.getElementById("tableInstituicoesFinanceiras");
      const tableLeiloeiros = document.getElementById("tableLeiloeiros");
      const tableRemocoes = document.getElementById("tableRemocoes");
      const tableFinance = document.getElementById("tableFinance");
      const financeHead = document.getElementById("financeHead");
      const rankByVehicles = document.getElementById("rankByVehicles");
      const rankByRevenue = document.getElementById("rankByRevenue");

      const financeReceber = document.getElementById("financeReceber");
      const financeReceberCount = document.getElementById("financeReceberCount");
      const financePagar = document.getElementById("financePagar");
      const financePagarCount = document.getElementById("financePagarCount");
      const financeCaixa = document.getElementById("financeCaixa");
      const financeCaixaStatus = document.getElementById("financeCaixaStatus");
      const financeCardTitle1 = document.getElementById("financeCardTitle1");
      const financeCardTitle2 = document.getElementById("financeCardTitle2");
      const financeCardTitle3 = document.getElementById("financeCardTitle3");
      const receivableAlert = document.getElementById("receivableAlert");
      const financeFlyoutBackdrop = document.getElementById("financeFlyoutBackdrop");
      const financeFlyoutClose = document.getElementById("financeFlyoutClose");
      const financeMenuPrintOpenRec = document.getElementById("financeMenuPrintOpenRec");
      const financeMenuReload = document.getElementById("financeMenuReload");
      const financeMenuReceberFilters = document.getElementById("financeMenuReceberFilters");
      const financeViewBadge = document.getElementById("financeViewBadge");
      const financeModeBadge = document.getElementById("financeModeBadge");
      const financeBreadcrumb = document.getElementById("financeBreadcrumb");
      const financeOpenFilters = document.getElementById("financeOpenFilters");
      const financeSidebarToggle = document.getElementById("financeSidebarToggle");
      const financeSidebarBackdrop = document.getElementById("financeSidebarBackdrop");
      const financeCompetenciaBadge = document.getElementById("financeCompetenciaBadge");
      const financeDashboardMonth = document.getElementById("financeDashboardMonth");
      const financeDashboardMonthAtual = document.getElementById("financeDashboardMonthAtual");
      const financeFiltersHub = document.getElementById("financeFiltersHub");
      const financeFilters = document.getElementById("financeFilters");
      const financeLancamentosFilters = document.getElementById("financeLancamentosFilters");
      const financeCaixaFilters = document.getElementById("financeCaixaFilters");
      const financeContent = document.getElementById("financeContent");
      const financePlateFilter = document.getElementById("financePlateFilter");
      const financePlateSearchForm = document.getElementById("financePlateSearchForm");
      const clearFinancePlateFilter = document.getElementById("clearFinancePlateFilter");
      const filterFrom = document.getElementById("filterFrom");
      const filterTo = document.getElementById("filterTo");
      const financeReportExtraFilters = document.getElementById("financeReportExtraFilters");
      const reportTipoFiltro = document.getElementById("reportTipoFiltro");
      const reportCategoriaFiltro = document.getElementById("reportCategoriaFiltro");
      const reportClienteFiltro = document.getElementById("reportClienteFiltro");
      const reportFornecedorFiltro = document.getElementById("reportFornecedorFiltro");
      const applyFilter = document.getElementById("applyFilter");
      const clearFilter = document.getElementById("clearFilter");
      const quick7 = document.getElementById("quick7");
      const quick30 = document.getElementById("quick30");
      const quick90 = document.getElementById("quick90");
      const exportHistory = document.getElementById("exportHistory");
      const financeLancTipo = document.getElementById("financeLancTipo");
      const financeLancStatus = document.getElementById("financeLancStatus");
      const financeLancCategoria = document.getElementById("financeLancCategoria");
      const financeLancSubcategoria = document.getElementById("financeLancSubcategoria");
      const financeLancFormaPagamento = document.getElementById("financeLancFormaPagamento");
      const financeLancCompetencia = document.getElementById("financeLancCompetencia");
      const financeLancBusca = document.getElementById("financeLancBusca");
      const financeLancLimpar = document.getElementById("financeLancLimpar");
      const financeLancamentosToolbar = document.getElementById("financeLancamentosToolbar");
      const financeLancSortBy = document.getElementById("financeLancSortBy");
      const financeLancSortDir = document.getElementById("financeLancSortDir");
      const financeLancPageSize = document.getElementById("financeLancPageSize");
      const financeLancOpenPanel = document.getElementById("financeLancOpenPanel");
      const financeLancResultCount = document.getElementById("financeLancResultCount");
      const financeLancPagination = document.getElementById("financeLancPagination");
      const financeLancList = document.getElementById("financeLancList");
      const financeStdTableWrap = document.querySelector("#financeStandardArea .table-wrap");
      const financeLancPageInfo = document.getElementById("financeLancPageInfo");
      const financeLancPrevPage = document.getElementById("financeLancPrevPage");
      const financeLancNextPage = document.getElementById("financeLancNextPage");
      const financeLancSidePanel = document.getElementById("financeLancSidePanel");
      const financeLancClosePanel = document.getElementById("financeLancClosePanel");
      const financeLancResetAdvanced = document.getElementById("financeLancResetAdvanced");
      const financeLancOnlyPago = document.getElementById("financeLancOnlyPago");
      const financeLancOnlyAberto = document.getElementById("financeLancOnlyAberto");
      const financeLancSomenteReceita = document.getElementById("financeLancSomenteReceita");
      const financeLancSomenteDespesa = document.getElementById("financeLancSomenteDespesa");
      const financeLancSemObs = document.getElementById("financeLancSemObs");
      const financeLancComObs = document.getElementById("financeLancComObs");
      const financeCaixaMonth = document.getElementById("financeCaixaMonth");
      const financeCaixaMonthAtual = document.getElementById("financeCaixaMonthAtual");

      const settingsCnpj = document.getElementById("settingsCnpj");
      const settingsName = document.getElementById("settingsName");
      const settingsBank = document.getElementById("settingsBank");
      const settingsEndereco = document.getElementById("settingsEndereco");
      const settingsReciboEmitente = document.getElementById("settingsReciboEmitente");
      const settingsReciboTelefone = document.getElementById("settingsReciboTelefone");
      const settingsCharge = document.getElementById("settingsCharge");
      const settingsInvoice = document.getElementById("settingsInvoice");
      const saveSettings = document.getElementById("saveSettings");

      const trackManagerBtnNovo = document.getElementById("trackManagerBtnNovo");
      const trackManagerFormWrap = document.getElementById("trackManagerFormWrap");
      const trackManagerBtnCancelar = document.getElementById("trackManagerBtnCancelar");
      const trackManagerUsername = document.getElementById("trackManagerUsername");
      const trackManagerPassword = document.getElementById("trackManagerPassword");
      const addTrackManager = document.getElementById("addTrackManager");
      const trackManagerStatus = document.getElementById("trackManagerStatus");
      const trackManagerAccessBox = document.getElementById("trackManagerAccessBox");
      const trackManagerGeneratedLogin = document.getElementById("trackManagerGeneratedLogin");
      const trackManagerGeneratedPassword = document.getElementById("trackManagerGeneratedPassword");
      const trackManagerCopyWhatsApp = document.getElementById("trackManagerCopyWhatsApp");
      const trackManagerLinkUid = document.getElementById("trackManagerLinkUid");
      const trackManagerLinkEmail = document.getElementById("trackManagerLinkEmail");
      const linkTrackManager = document.getElementById("linkTrackManager");
      const trackManagerLinkStatus = document.getElementById("trackManagerLinkStatus");
      const configSubnav = document.getElementById("configSubnav");
      const configPanelDados = document.getElementById("configPanelDados");
      const configPanelUsuarios = document.getElementById("configPanelUsuarios");
      const configGestorGeralEmail = document.getElementById("configGestorGeralEmail");
      const tableTrackManagersBody = document.getElementById("tableTrackManagersBody");
      const configModuleLede = document.getElementById("configModuleLede");
      let currentConfigSubview = "dados";

      const reloadPatio = document.getElementById("reloadPatio");
      const patioFlyoutBackdrop = document.getElementById("patioFlyoutBackdrop");
      const patioFlyoutClose = document.getElementById("patioFlyoutClose");
      const patioMenuNewVehicle = document.getElementById("patioMenuNewVehicle");
      const patioMenuReload = document.getElementById("patioMenuReload");
      const patioMenuPlateFilter = document.getElementById("patioMenuPlateFilter");
      const reloadFinanceiro = document.getElementById("reloadFinanceiro");
      const patioSubnav = document.getElementById("patioSubnav");
      const financeSubnav = document.getElementById("financeSubnav");
      const partnerSubnav = document.getElementById("partnerSubnav");
      const plateFilter = document.getElementById("plateFilter");
      const plateSearchForm = document.getElementById("plateSearchForm");
      const goDashboardFromPlate = document.getElementById("goDashboardFromPlate");
      const clearPlateFilter = document.getElementById("clearPlateFilter");
      const plateFilterPatio = document.getElementById("plateFilterPatio");
      const plateSearchFormPatio = document.getElementById("plateSearchFormPatio");
      const clearPlateFilterPatio = document.getElementById("clearPlateFilterPatio");

      const patioSubviews = document.querySelectorAll(".patio-subview");
      const partnerSubviews = document.querySelectorAll(".partner-subview");
      const financeSubviews = financeSubnav ? financeSubnav.querySelectorAll("button[data-subview]") : [];

      let currentPatioView = null;
      let currentFinanceView = null;
      let currentReceitasSubView = "inicio";
      let currentDespesasSubView = "inicio";
      let currentContasPagarSubView = "inicio";
      let currentContasReceberSubView = "inicio";
      let currentPartnerView = null;
      let reportHasRun = false;
      let financeCompetencia = currentYearMonthLocal();
      let financeSidebarOpen = false;
      let financeFocusMetaGoalCard = false;
      const navStack = ["dashboard"];
      let historyFilter = { from: null, to: null };
      let reportFilter = { tipo: "", categoria: "", cliente: "", fornecedor: "" };
      let lancamentosFilter = {
        tipo: "",
        status: "",
        categoria: "",
        subcategoria: "",
        formaPagamento: "",
        competencia: "",
        busca: "",
      };
      let lancamentosSort = { by: "data", dir: "desc" };
      let lancamentosPagination = { page: 1, pageSize: 20 };
      let lancamentosAdvanced = {
        onlyPago: false,
        onlyAberto: false,
        onlyReceita: false,
        onlyDespesa: false,
        semObs: false,
        comObs: false,
      };
      let caixaFilter = { month: "" };
      let plateQuery = "";
      let financePlateQuery = "";
      let financeReceberStatusFilter = "aberto";
      let financeReceberBuscaFilter = "";
      let financePagarStatusFilter = "aberto";
      let financePagarBuscaFilter = "";
      let financeConciliacaoFilter = "pendentes";
      let financePlateInputTimer = null;
      let vlsListFilterLocatorId = "";
      let vlsListFilterAssessoriaId = "";
      let listaFilterLocatorId = "";
      let listaFilterAssessoriaId = "";
      let listaFilterRpfId = "";
      let listaFilterBanco = "";
      let currentListaView = "vnp";
      let editingVehicleId = null;
      let editingVehicleData = null;
      let nfseVehicleId = null;
      let nfseStatusBeforeOpen = null;

      const state = {
        user: null,
        /** Quando logado como gestor/operador delegado: dono dos dados (veículos, parceiros, etc.). */
        patioOwnerUserId: null,
        partners: [],
        vehicles: [],
        receivables: [],
        cycleClosures: [],
        payables: [],
        cash: [],
        settings: null,
        monthlyClosures: [],
        monthlyClosureLoadError: null,
      };

      function effectiveUserId() {
        return state.patioOwnerUserId || state.user?.id || null;
      }

      async function callFinanceCompetencyApi(path, payload) {
        const resp = await fetch(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload || {}),
        });
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          const msg = json?.error || `Falha ${resp.status} em ${path}`;
          throw new Error(msg);
        }
        return json;
      }

      /** PostgREST: tabela inexistente ou ainda não aplicada no projeto (404 / PGRST205). */
      function isMissingRelationError(err) {
        if (!err) return false;
        const msg = String(err.message || "");
        const code = String(err.code || "");
        if (/PGRST205/i.test(code)) return true;
        if (/patio_cycle_closures|does not exist|relation|schema cache|could not find the table/i.test(msg)) return true;
        return false;
      }

      let isGestorPista = false;

      /** Com false, saída do veículo (VRP) alimenta automaticamente o financeiro. */
      const FINANCE_MANUAL_ONLY = false;

      const FINANCE_VIEW_LABELS = {
        inicio: "Dashboard",
        dashboard: "Dashboard",
        dashboard_financeiro: "Dashboard",
        dashboard_resultado: "Dashboard",
        receitas: "Controle de Receitas",
        despesas: "Controle de Despesas",
        contas_pagar: "Contas a Pagar",
        contas_receber: "Contas a Receber",
        lancamentos: "Controle de Receitas",
        receber: "Contas a Receber",
        ajustes: "Contas a Pagar",
        caixa: "Dashboard",
        clientes: "Clientes",
        triagem: "Aguardando Faturamento",
        aguardando_faturamento: "Aguardando Faturamento",
        relatorios: "Relatórios",
        faturamento: "Faturamento",
      };

      const PATIO_TAB_LABELS = {
        no_patio: { title: "VNP", subtitle: "Veículos no pátio" },
        removidos: { title: "VRP", subtitle: "Veículos removidos do pátio" },
        fechando_ciclo: { title: "Fechando ciclo", subtitle: "Triagem antes do financeiro" },
      };

      const FINANCE_TAB_LABELS = {
        receitas: { title: "Controle de Receitas", subtitle: "Cadastro, categorias e histórico" },
        despesas: { title: "Controle de Despesas", subtitle: "Despesas fixas e variáveis" },
        contas_pagar: { title: "Contas a Pagar", subtitle: "Títulos, vencimentos e pagamentos" },
        contas_receber: { title: "Contas a Receber", subtitle: "Cobrança e baixa de títulos" },
        aguardando_faturamento: {
          title: "Aguardando Faturamento",
          subtitle: "Veículos removidos aguardando fatura",
        },
        clientes: { title: "Clientes", subtitle: "Base de localizadores (RPV)" },
        relatorios: { title: "Relatórios", subtitle: "DRE e exportações" },
      };

      const MODULE_VIEWS = ["patio", "financeiro", "lista", "parceiros", "configuracoes"];

      const MODULE_VIEW_IDS = {
        patio: "viewPatio",
        financeiro: "viewFinanceiro",
        lista: "viewLista",
        parceiros: "viewParceiros",
        configuracoes: "viewConfiguracoes",
      };

      const MODULE_VIEW_LABELS = {
        patio: { title: "Gestão de Pátio", subtitle: "Operação do pátio" },
        financeiro: { title: "Financeiro", subtitle: "Gestão financeira" },
        lista: { title: "Lista", subtitle: "Consultas e relatórios" },
        parceiros: { title: "Rede de parceiros", subtitle: "Cadastro de parceiros" },
        configuracoes: { title: "Configurações", subtitle: "Parâmetros do sistema" },
      };

      let tabModalSystemReady = false;

      function relocateTabModalEl(el) {
        if (!el) return;
        if (el.parentElement === document.body) return;
        document.body.appendChild(el);
      }

      function rehomeViewToAppPanel(el) {
        const appPanel = document.getElementById("appPanel");
        if (!el || !appPanel || appPanel.contains(el)) return;
        const anchor = document.getElementById("vehicleModal");
        if (anchor?.parentElement === appPanel) appPanel.insertBefore(el, anchor);
        else appPanel.appendChild(el);
      }

      function cleanupFloatingTabModals(activeView) {
        if (activeView !== "patio") document.getElementById("patioContent")?.classList.add("hidden");
        if (activeView !== "financeiro") document.getElementById("financeContent")?.classList.add("hidden");
      }

      function rehomeFinanceContentToModule() {
        const el = document.getElementById("financeContent");
        const viewFinanceiro = document.getElementById("viewFinanceiro");
        const financeInicioPanel = document.getElementById("financeInicioPanel");
        if (!el || !viewFinanceiro || viewFinanceiro.contains(el)) return;
        if (financeInicioPanel?.parentElement === viewFinanceiro) {
          financeInicioPanel.insertAdjacentElement("afterend", el);
        } else {
          viewFinanceiro.appendChild(el);
        }
      }

      function ensureTabModalShell(backdropEl, onClose, options = {}) {
        if (!backdropEl) return backdropEl;
        if (backdropEl.dataset.tabModalReady !== "1") {
          backdropEl.dataset.tabModalReady = "1";
          backdropEl.classList.add("modal-backdrop", "tab-view-modal");
          backdropEl.style.marginTop = "0";

          const panel = document.createElement("div");
          panel.className = "modal modal--wide";

          const header = document.createElement("div");
          header.className = "modal-header";
          header.innerHTML = `
          <div>
            <h3 data-tab-modal-title>—</h3>
            <p class="subtitle" data-tab-modal-subtitle></p>
          </div>
          <button type="button" class="modal-close" data-tab-modal-close>Fechar</button>
        `;

          const body = document.createElement("div");
          body.className = "tab-modal-body";

          while (backdropEl.firstChild) body.appendChild(backdropEl.firstChild);

          panel.appendChild(header);
          panel.appendChild(body);
          backdropEl.appendChild(panel);

          backdropEl._tabModalTitle = header.querySelector("[data-tab-modal-title]");
          backdropEl._tabModalSubtitle = header.querySelector("[data-tab-modal-subtitle]");

          header.querySelector("[data-tab-modal-close]")?.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose?.();
          });
          backdropEl.addEventListener("click", (e) => {
            if (e.target !== backdropEl) return;
            if (backdropEl.classList.contains("hidden")) return;
            onClose?.();
          });
          panel.addEventListener("click", (e) => e.stopPropagation());
        }
        if (!options.keepInPlace) relocateTabModalEl(backdropEl);
        return backdropEl;
      }

      function setTabModalMeta(backdropEl, title, subtitle) {
        if (!backdropEl) return;
        if (backdropEl._tabModalTitle) backdropEl._tabModalTitle.textContent = title || "—";
        if (backdropEl._tabModalSubtitle) {
          backdropEl._tabModalSubtitle.textContent = subtitle || "";
          backdropEl._tabModalSubtitle.style.display = subtitle ? "" : "none";
        }
      }

      function hidePartnerTabModal() {
        document.getElementById("partnerTabModal")?.classList.add("hidden");
      }

      function hideConfigTabModal() {
        document.getElementById("configTabModal")?.classList.add("hidden");
      }

      function unwrapTabModalShell(el) {
        if (!el?.dataset?.tabModalReady) return;
        const body = el.querySelector(":scope > .modal.modal--wide > .tab-modal-body, :scope > .tab-modal-panel > .tab-modal-body");
        if (body) {
          while (body.firstChild) el.appendChild(body.firstChild);
          el.querySelector(":scope > .modal.modal--wide, :scope > .tab-modal-panel")?.remove();
        }
        el.classList.remove("modal-backdrop", "tab-view-modal", "tab-modal-backdrop", "module-tab-modal");
        delete el.dataset.tabModalReady;
        el._tabModalTitle = null;
        el._tabModalSubtitle = null;
      }

      function isNavOnModule(moduleName) {
        return (
          navStack.includes(moduleName) &&
          (navStack[navStack.length - 1] === moduleName ||
            (typeof navStack[navStack.length - 1] === "string" &&
              navStack[navStack.length - 1].startsWith(`${moduleName}:`)))
        );
      }

      function restoreTabModalDom() {
        ["patio", "financeiro", "lista", "parceiros"].forEach((key) => {
          const el = document.getElementById(MODULE_VIEW_IDS[key]);
          if (!el) return;
          el.querySelector(":scope > .module-overlay-header")?.remove();
          const legacyPanel = el.querySelector(":scope > .module-overlay-panel");
          if (legacyPanel) {
            while (legacyPanel.firstChild) el.appendChild(legacyPanel.firstChild);
            legacyPanel.remove();
          }
          el.classList.remove("module-overlay-modal", "modal-backdrop", "module-view-modal");
          delete el.dataset.moduleOverlayReady;
          rehomeViewToAppPanel(el);
        });

        unwrapTabModalShell(document.getElementById("patioContent"));
        unwrapTabModalShell(document.getElementById("financeContent"));

        const viewPatio = document.getElementById("viewPatio");
        const patioContent = document.getElementById("patioContent");
        if (patioContent && viewPatio && !viewPatio.contains(patioContent)) {
          const plateBar = document.getElementById("patioPlateSearchBar");
          if (plateBar) plateBar.insertAdjacentElement("afterend", patioContent);
          else viewPatio.appendChild(patioContent);
        }
        const viewFinanceiro = document.getElementById("viewFinanceiro");
        const financeContent = document.getElementById("financeContent");
        if (financeContent && viewFinanceiro && !viewFinanceiro.contains(financeContent)) {
          const financeInicioPanel = document.getElementById("financeInicioPanel");
          if (financeInicioPanel?.parentElement === viewFinanceiro) {
            financeInicioPanel.insertAdjacentElement("afterend", financeContent);
          } else {
            viewFinanceiro.appendChild(financeContent);
          }
        }

        const partnerModal = document.getElementById("partnerTabModal");
        const partnerHost = document.getElementById("viewParceiros");
        if (partnerModal && partnerHost) {
          const body = partnerModal.querySelector(".tab-modal-body");
          const anchor = partnerHost.querySelector(".grid");
          if (body && anchor) {
            let insertAfter = anchor;
            [...body.querySelectorAll(".partner-subview")].forEach((p) => {
              insertAfter.insertAdjacentElement("afterend", p);
              insertAfter = p;
            });
          }
          partnerModal.remove();
        }

        const configModal = document.getElementById("configTabModal");
        const configHost = document.getElementById("viewConfiguracoes");
        if (configModal && configHost) {
          const body = configModal.querySelector(".tab-modal-body");
          if (body) {
            if (configPanelDados && !configHost.contains(configPanelDados)) configHost.appendChild(configPanelDados);
            if (configPanelUsuarios && !configHost.contains(configPanelUsuarios)) configHost.appendChild(configPanelUsuarios);
          }
          configModal.remove();
        }
      }

      function initTabModalSystem() {
        if (tabModalSystemReady) return;
        tabModalSystemReady = true;

        restoreTabModalDom();

        const patioContent = document.getElementById("patioContent");
        if (patioContent) {
          ensureTabModalShell(patioContent, returnToPainelFromPatioFlyout);
        }
      }

      function financeIsDashboardView(view) {
        return financeNormalizeSubview(view) === "inicio";
      }

      function financeOrigemLabel(entry) {
        const modo = String(entry.modo || entry.meta?.modo || "UNICA").toUpperCase();
        const map = { UNICA: "Manual", RECORRENTE: "Recorrente", PARCELADA: "Parcelada" };
        const base = map[modo] || "Manual";
        const mod = entry.meta?.origem_modulo;
        if (mod === "CONTROLE_RECEITAS") return `Receitas · ${base}`;
        if (mod === "CONTROLE_DESPESAS") return `Despesas · ${base}`;
        return base;
      }

      function financeContaStatusLabel(record, kind, todayYmd, flags = {}) {
        const isPaid = record.status === "PAGO";
        const dueYmd =
          kind === "receivable"
            ? financeContaDueYmd(record, "receivable")
            : (record.data_vencimento || "").slice(0, 10);
        const daysFromDue = financeContaDueDays(dueYmd, todayYmd);
        const isOverdue = !isPaid && !!(dueYmd && todayYmd && dueYmd < todayYmd);
        if (isPaid) return kind === "receivable" ? "Recebido" : "Pago";
        if (flags.isento) return "Isento";
        if (isOverdue) return "Atrasado";
        return "Pendente";
      }

      function financeContaStatusClass(label) {
        if (label === "Recebido" || label === "Pago" || label === "Isento") return "success";
        if (label === "Atrasado") return "danger";
        return "warning";
      }

      function financeMovimentosHistoricoHtml(tipoConta) {
        const movs = (state.cash || [])
          .filter((m) => m.tipo_conta === tipoConta)
          .sort((a, b) =>
            String(b.data_movimento || b.created_at).localeCompare(String(a.data_movimento || a.created_at))
          )
          .slice(0, 25);
        if (!movs.length) {
          return `<p class="notice" style="margin-top: 14px">Nenhuma movimentação de caixa registrada.</p>`;
        }
        const rows = movs
          .map((m) => {
            const val = formatCurrency(Number(m.valor || 0));
            const fp = m.forma_pagamento || "—";
            return `<div class="finance-lanc-item" style="padding:8px 0;border-bottom:1px solid var(--border)">
              <strong>${escapeHtml(m.descricao || "Movimento")}</strong>
              <span class="notice" style="display:block;margin-top:2px">${formatDate(m.data_movimento || m.created_at)} · ${escapeHtml(fp)} · ${val}</span>
            </div>`;
          })
          .join("");
        return `<h5 style="margin:16px 0 8px;font-size:0.92rem">Histórico de movimentações (caixa)</h5><div>${rows}</div>`;
      }

      function financeIsSubTabView(view) {
        const v = financeNormalizeSubview(view);
        return [
          "receitas",
          "despesas",
          "contas_pagar",
          "contas_receber",
          "aguardando_faturamento",
          "clientes",
          "relatorios",
        ].includes(v);
      }

      function scrollFinanceSubtabIntoView() {
        const root = document.getElementById("viewFinanceiro");
        const shell = document.getElementById("financeStandardArea");
        if (root) root.scrollTop = 0;
        if (shell) {
          shell.classList.remove("finance-subtab-open");
          void shell.offsetWidth;
          shell.classList.add("finance-subtab-open");
        }
      }

      function applyFinanceSubTabShell(view) {
        const stdArea = document.getElementById("financeStandardArea");
        const flySummary = document.getElementById("financeFlyoutSummaryCards");
        if (financeIsDashboardView(view) || !view || view === "none") {
          stdArea?.classList.add("hidden");
          flySummary?.classList.add("hidden");
          return;
        }
        if (view === "clientes") {
          stdArea?.classList.add("hidden");
        } else {
          stdArea?.classList.remove("hidden");
        }
        flySummary?.classList.add("hidden");
      }

      function financeNormalizeSubview(view) {
        if (!view || view === "none") return view;
        if (
          view === "dashboard" ||
          view === "inicio" ||
          view === "dashboard_financeiro" ||
          view === "dashboard_resultado" ||
          view === "filtros" ||
          view === "metas" ||
          view === "controle_dual" ||
          view === "caixa" ||
          view === "fluxo_caixa" ||
          view === "historico_receber" ||
          view === "historico_pagar"
        ) {
          return "inicio";
        }
        if (view === "lancamentos") return "receitas";
        if (view === "ajustes" || view === "pagar") return "contas_pagar";
        if (view === "receber" || view === "receber_alerta") return "contas_receber";
        if (view === "pre_lancamento" || view === "aguardando_lancamento" || view === "triagem") {
          return FINANCE_MANUAL_ONLY ? "receitas" : "aguardando_faturamento";
        }
        return view;
      }

      function financeIsLancamentosView(view) {
        return ["lancamentos", "receitas", "despesas"].includes(view);
      }

      function financeIsPagarView(view) {
        return ["ajustes", "contas_pagar", "pagar"].includes(view);
      }

      function financeIsReceberView(view) {
        return ["receber", "contas_receber", "receber_alerta"].includes(view);
      }

      function financePaymentChannelTotals(monthYm, cashList) {
        const totals = { caixa: 0, banco: 0, cartoes: 0 };
        (cashList || []).forEach((mov) => {
          const ymd = toLocalYmd(mov.data_movimento || mov.created_at);
          if (!ymd || yearMonthFromYmd(ymd) !== monthYm) return;
          const val = Number(mov.valor || 0);
          if (!val) return;
          const fp = (mov.forma_pagamento || "").toLowerCase();
          if (/cart|cred|deb/.test(fp)) totals.cartoes += val;
          else if (/pix|transf|boleto|ted|doc|bank|banc/.test(fp)) totals.banco += val;
          else totals.caixa += val;
        });
        return totals;
      }

      function isManualFinanceLancamento(r) {
        if (!r) return false;
        if (String(r.subcategoria || "").toUpperCase() === "MANUAL") return true;
        return r.vehicle_id == null || r.vehicle_id === "";
      }

      function receivableCountsForFinanceUi(receivables) {
        const list = Array.isArray(receivables) ? receivables : [];
        if (!FINANCE_MANUAL_ONLY) return list;
        return list.filter(isManualFinanceLancamento);
      }

      const RECEIVABLE_AGUARDANDO_LANCAMENTO = "AGUARDANDO_LANCAMENTO";
      const RECEIVABLE_AGUARDANDO_FATURAMENTO = RECEIVABLE_AGUARDANDO_LANCAMENTO;
      const FINANCE_AUDIT_KEY = "amplipatio_finance_audit_v1";
      /** Fallback se a coluna `financeiro_aprovado_contas_receber` ainda não existir no Supabase. */
      const RECEBER_TRIAGEM_IDS_KEY = "amplipatio_triagem_em_contas_ids";
      /** Ciclo fechado no VRP sem coluna `patio_liberado_financeiro`: IDs bloqueados até OK no pátio. */
      const PATIO_FINANCEIRO_BLOQUEADO_IDS_KEY = "amplipatio_receivable_aguarda_fechamento_patio_ids";
      /** NF enviada quando a coluna `nfse_enviada` não existe na tabela `vehicles`. */
      const NFSE_ENVIADA_VEHICLE_IDS_KEY = "amplipatio_vehicle_nfse_enviada_ids";
      const CADASTRO_BASE_STORAGE_KEY = "amplipatio_financeiro_cadastro_base_v1";
      const FINANCE_META_KEY = "amplipatio_financeiro_meta_v1";
      const FINANCE_RECEBER_FLAGS_KEY = "amplipatio_financeiro_receber_flags_v1";
      const CADASTRO_BASE_FIELDS = [
        { key: "categorias", label: "Categorias" },
        { key: "subcategorias", label: "Subcategorias" },
        { key: "clientes", label: "Clientes" },
        { key: "fornecedores", label: "Fornecedores" },
        { key: "formas_pagamento", label: "Formas de pagamento" },
        { key: "bancos", label: "Bancos" },
        { key: "centros_custo", label: "Centros de custo" },
      ];
      const SERVICOS_RECEITAS = [
        { value: "GUARDA_PATIO", label: "Guarda de pátio" },
        { value: "ESTACIONAMENTO_MENSALISTA", label: "Estacionamento mensalista" },
        { value: "REMOCAO_VEICULOS", label: "Remoção de veículos" },
      ];
      const LANC_RECEITA_CATEGORIAS = SERVICOS_RECEITAS;
      const LANC_DESPESA_CATEGORIAS = [
        { value: "ALUGUEL", label: "Aluguel" },
        { value: "ENERGIA", label: "Energia" },
        { value: "AGUA", label: "Água" },
        { value: "TELEFONE_INTERNET", label: "Telefone / Internet" },
        { value: "FUNCIONARIO", label: "Funcionário" },
        { value: "GUINCHO", label: "Guincho" },
        { value: "MANUTENCAO", label: "Manutenção" },
        { value: "SANGRIA_CAIXA", label: "Sangria de caixa" },
        { value: "OUTROS", label: "Outros" },
      ];

      const FINANCE_ATTACHMENTS_KEY = "amplipatio_finance_attachments_v1";
      const FINANCE_STORAGE_BUCKET = "finance-attachments";
      const FINANCE_CUSTOM_RECEITA_CATS_KEY = "amplipatio_finance_cats_receita_v1";
      const FINANCE_CUSTOM_DESPESA_CATS_KEY = "amplipatio_finance_cats_despesa_v1";
      const FINANCE_META_PREFIX = "[[finmeta:";

      function financeMetaPack(meta, userText) {
        const clean = String(userText || "").replace(/^\[\[finmeta:[\s\S]*?\]\]\s*/, "").trim();
        if (!meta || !Object.keys(meta).length) return clean;
        return `${FINANCE_META_PREFIX}${JSON.stringify(meta)}]] ${clean}`.trim();
      }

      function financeMetaUnpack(obs) {
        const raw = String(obs || "");
        const m = raw.match(/^\[\[finmeta:(\{.*?\})\]\]\s*([\s\S]*)$/);
        if (!m) return { meta: {}, text: raw };
        try {
          return { meta: JSON.parse(m[1]), text: m[2] || "" };
        } catch (e) {
          return { meta: {}, text: raw };
        }
      }

      function financeAttachmentsRead() {
        try {
          const raw = localStorage.getItem(FINANCE_ATTACHMENTS_KEY);
          const obj = JSON.parse(raw || "{}");
          return obj && typeof obj === "object" ? obj : {};
        } catch (e) {
          return {};
        }
      }

      function financeAttachmentsWrite(all) {
        try {
          localStorage.setItem(FINANCE_ATTACHMENTS_KEY, JSON.stringify(all || {}));
        } catch (e) {
          console.warn("finance attachments storage", e);
        }
      }

      function financeAttachmentKey(kind, id) {
        return `${kind}:${String(id)}`;
      }

      function financeAttachmentGet(kind, id) {
        if (!kind || id == null) return null;
        return financeAttachmentsRead()[financeAttachmentKey(kind, id)] || null;
      }

      function financeAttachmentSet(kind, id, payload) {
        if (!kind || id == null || !payload) return;
        const all = financeAttachmentsRead();
        all[financeAttachmentKey(kind, id)] = {
          name: payload.name || "anexo",
          dataUrl: payload.dataUrl || "",
          size: Number(payload.size || 0),
          savedAt: new Date().toISOString(),
          storagePath: payload.storagePath || all[financeAttachmentKey(kind, id)]?.storagePath || null,
        };
        financeAttachmentsWrite(all);
      }

      async function financeAttachmentSave(kind, id, payload) {
        if (!kind || id == null || !payload) return;
        financeAttachmentSet(kind, id, payload);
        if (!supabase || !payload.dataUrl || !effectiveUserId()) return;
        try {
          const safeName = String(payload.name || "anexo").replace(/[^\w.\-]+/g, "_").slice(0, 80);
          const path = `${effectiveUserId()}/${kind}/${id}/${Date.now()}_${safeName}`;
          const res = await fetch(payload.dataUrl);
          const blob = await res.blob();
          const { error } = await supabase.storage.from(FINANCE_STORAGE_BUCKET).upload(path, blob, {
            upsert: true,
            contentType: blob.type || "application/octet-stream",
          });
          if (!error) {
            financeAttachmentSet(kind, id, { ...payload, storagePath: path });
          }
        } catch (e) {
          console.warn("finance attachment cloud upload", e);
        }
      }

      function financeWhatsappDigits(raw) {
        let d = String(raw || "").replace(/\D/g, "");
        if (d.length === 10 || d.length === 11) d = `55${d}`;
        if (d.startsWith("0")) d = d.replace(/^0+/, "");
        return d.length >= 12 ? d : "";
      }

      function cashMovementIsConciliado(mov) {
        return /\[CONCILIADO\]/i.test(String(mov?.descricao || ""));
      }

      function downloadFinanceCsv(filename, headers, rows) {
        const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
        const csv = [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
        const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      }

      function buildFinanceDre(monthYm) {
        const ym = monthYm || financeCompetencia || currentYearMonthLocal();
        const receitas = sumReceivableRevenueByMonth(ym, state.receivables || [], state.cash || []);
        const despesas = sumCashPagamentosNoMes(ym, state.cash || []);
        const sangria = sumCashSangriaNoMes(ym, state.cash || [], state.payables || []);
        const despesasOp = Math.max(0, despesas - sangria);
        const lucro = receitas - despesasOp;
        const pagarPend = (state.payables || [])
          .filter((p) => p.status === "EM_ABERTO")
          .reduce((s, p) => s + Number(p.valor || 0), 0);
        const receberPend = (state.receivables || [])
          .filter((r) => receivableIsContaReceberFinanceiro(r))
          .reduce((s, r) => s + Number(r.valor || 0), 0);
        const [ano, mes] = ym.split("-");
        const competenciaLabel = mes && ano ? `${mes}/${ano}` : ym;
        return {
          ym,
          competenciaLabel,
          receitas,
          despesas: despesasOp,
          sangria,
          lucro,
          pagarPend,
          receberPend,
          rows: [
            ["Receitas (recebidas no período)", receitas],
            ["Despesas operacionais (pagas)", despesasOp],
            ["Sangrias de caixa", sangria],
            ["Resultado (lucro / prejuízo)", lucro],
            ["Contas a receber (saldo em aberto)", receberPend],
            ["Contas a pagar (saldo em aberto)", pagarPend],
          ],
        };
      }

      function exportFinanceDreCsv() {
        const dre = buildFinanceDre();
        downloadFinanceCsv(
          `dre-${dre.ym}.csv`,
          ["Linha", "Valor (R$)", "Competência"],
          dre.rows.map(([label, val]) => [label, Number(val || 0).toFixed(2).replace(".", ","), dre.competenciaLabel])
        );
      }

      function exportFinanceFluxoCsv() {
        const ym = financeCompetencia || currentYearMonthLocal();
        const movs = (state.cash || [])
          .filter((m) => {
            const ymd = toLocalYmd(m.data_movimento || m.created_at);
            return ymd && yearMonthFromYmd(ymd) === ym;
          })
          .sort((a, b) =>
            String(a.data_movimento || a.created_at).localeCompare(String(b.data_movimento || b.created_at))
          );
        const rows = movs.map((m) => {
          const tipo = m.tipo_conta === "RECEBER" ? "Entrada" : "Saída";
          const val = Number(m.valor || 0);
          const sinal = m.tipo_conta === "PAGAR" ? -val : val;
          return [
            formatDate(m.data_movimento || m.created_at),
            tipo,
            m.descricao || "-",
            m.forma_pagamento || "-",
            sinal.toFixed(2).replace(".", ","),
            cashMovementIsConciliado(m) ? "Conciliado" : "Pendente",
          ];
        });
        downloadFinanceCsv(`fluxo-caixa-${ym}.csv`, ["Data", "Tipo", "Descrição", "Forma pagamento", "Valor", "Conciliação"], rows);
      }

      function renderFinanceDrePanel() {
        const body = document.getElementById("financeDreTableBody");
        if (!body) return;
        const dre = buildFinanceDre();
        body.innerHTML = dre.rows
          .map(([label, val]) => {
            const isResult = label.includes("Resultado");
            return `<tr${isResult ? ' style="font-weight:700"' : ""}><td>${escapeHtml(label)}</td><td>${formatCurrency(val)}</td></tr>`;
          })
          .join("");
      }

      function renderFinanceConciliacaoPanel() {
        const body = document.getElementById("financeConciliacaoBody");
        if (!body) return;
        const ym = financeCompetencia || currentYearMonthLocal();
        const filter = financeConciliacaoFilter || "pendentes";
        const movs = (state.cash || [])
          .filter((m) => {
            const ymd = toLocalYmd(m.data_movimento || m.created_at);
            if (!ymd || yearMonthFromYmd(ymd) !== ym) return false;
            const conc = cashMovementIsConciliado(m);
            if (filter === "pendentes") return !conc;
            if (filter === "conciliados") return conc;
            return true;
          })
          .sort((a, b) =>
            String(b.data_movimento || b.created_at).localeCompare(String(a.data_movimento || a.created_at))
          );
        if (!movs.length) {
          body.innerHTML = `<tr><td colspan="6" class="notice">Nenhum movimento para o filtro selecionado.</td></tr>`;
          return;
        }
        body.innerHTML = movs
          .map((m) => {
            const conc = cashMovementIsConciliado(m);
            const tipo = m.tipo_conta === "RECEBER" ? "Entrada" : "Saída";
            const acao = conc
              ? `<span class="tag success">OK</span>`
              : `<button type="button" class="secondary" data-action="conciliar-caixa" data-id="${m.id}">Conciliar</button>`;
            return `<tr>
              <td>${formatDate(m.data_movimento || m.created_at)}</td>
              <td>${tipo}</td>
              <td>${escapeHtml(m.descricao || "-")}</td>
              <td>${formatCurrency(m.valor)}</td>
              <td><span class="tag ${conc ? "success" : "warning"}">${conc ? "Conciliado" : "Pendente"}</span></td>
              <td class="actions">${acao}</td>
            </tr>`;
          })
          .join("");
      }

      function financeCustomCatsRead(key) {
        try {
          const raw = localStorage.getItem(key);
          const arr = JSON.parse(raw || "[]");
          return Array.isArray(arr) ? arr.filter(Boolean) : [];
        } catch (e) {
          return [];
        }
      }

      function financeCustomCatsWrite(key, list) {
        try {
          localStorage.setItem(key, JSON.stringify(list || []));
        } catch (e) {
          console.warn("finance custom cats", e);
        }
      }

      function financeCustomCatValue(label) {
        return String(label || "")
          .trim()
          .toUpperCase()
          .replace(/\s+/g, "_")
          .replace(/[^\w]/g, "")
          .slice(0, 40) || "CUSTOM";
      }

      function getLancReceitaCategorias() {
        const custom = financeCustomCatsRead(FINANCE_CUSTOM_RECEITA_CATS_KEY).map((label) => ({
          value: financeCustomCatValue(label),
          label: String(label).trim(),
        }));
        const seen = new Set(LANC_RECEITA_CATEGORIAS.map((c) => c.value));
        const extra = custom.filter((c) => c.label && !seen.has(c.value));
        return [...LANC_RECEITA_CATEGORIAS, ...extra];
      }

      function getLancDespesaCategorias() {
        const custom = financeCustomCatsRead(FINANCE_CUSTOM_DESPESA_CATS_KEY).map((label) => ({
          value: financeCustomCatValue(label),
          label: String(label).trim(),
        }));
        const seen = new Set(LANC_DESPESA_CATEGORIAS.map((c) => c.value));
        const extra = custom.filter((c) => c.label && !seen.has(c.value));
        return [...LANC_DESPESA_CATEGORIAS, ...extra];
      }

      function addFinanceCustomCategory(tipo, label) {
        const text = String(label || "").trim();
        if (!text) return false;
        const key = tipo === "DESPESA" ? FINANCE_CUSTOM_DESPESA_CATS_KEY : FINANCE_CUSTOM_RECEITA_CATS_KEY;
        const list = financeCustomCatsRead(key);
        if (list.some((x) => String(x).toLowerCase() === text.toLowerCase())) return false;
        list.push(text);
        financeCustomCatsWrite(key, list);
        return true;
      }

      function removeFinanceCustomCategory(tipo, value) {
        const key = tipo === "DESPESA" ? FINANCE_CUSTOM_DESPESA_CATS_KEY : FINANCE_CUSTOM_RECEITA_CATS_KEY;
        const list = financeCustomCatsRead(key);
        const cats = tipo === "DESPESA" ? getLancDespesaCategorias() : getLancReceitaCategorias();
        const found = cats.find((c) => c.value === value);
        if (!found || LANC_RECEITA_CATEGORIAS.some((c) => c.value === value) || LANC_DESPESA_CATEGORIAS.some((c) => c.value === value)) {
          return false;
        }
        financeCustomCatsWrite(
          key,
          list.filter((x) => financeCustomCatValue(x) !== value)
        );
        return true;
      }

      function payableCategoryLabel(code) {
        const key = String(code || "OUTROS").trim();
        const found = getLancDespesaCategorias().find((c) => c.value === key);
        if (found) return found.label;
        return key.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
      }

      function addMonthsToYmd(ymd, months) {
        const due = String(ymd || "").trim();
        if (!due) return null;
        const [y, m, d] = due.split("-").map((v) => Number(v));
        if (!y || !m || !d) return due;
        const base = new Date(y, m - 1, d, 12, 0, 0, 0);
        if (Number.isNaN(base.getTime())) return due;
        const originalDay = base.getDate();
        base.setDate(1);
        base.setMonth(base.getMonth() + Number(months || 0));
        const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
        base.setDate(Math.min(originalDay, lastDay));
        const yy = base.getFullYear();
        const mm = String(base.getMonth() + 1).padStart(2, "0");
        const dd = String(base.getDate()).padStart(2, "0");
        return `${yy}-${mm}-${dd}`;
      }

      function financeEntryModoFromRecord(record, kind) {
        if (kind === "payable") {
          const tipo = String(record?.tipo || "UNICA").toUpperCase();
          if (tipo === "RECORRENTE" || tipo === "PARCELADA") return tipo;
          const { meta } = financeMetaUnpack(record?.observacoes);
          return meta.modo || "UNICA";
        }
        const sub = String(record?.subcategoria || "").toUpperCase();
        if (sub === "RECORRENTE") return "RECORRENTE";
        if (sub.startsWith("PARCELADA")) return "PARCELADA";
        const { meta } = financeMetaUnpack(record?.observacoes);
        return meta.modo || "UNICA";
      }

      function financeModoBadgeHtml(modo, meta) {
        const m = String(modo || "UNICA").toUpperCase();
        if (m === "RECORRENTE") return `<span class="finance-lanc-badge finance-lanc-badge--recorrente">Recorrente</span>`;
        if (m === "PARCELADA") {
          const p = meta?.parcela && meta?.parcelas_total ? ` ${meta.parcela}/${meta.parcelas_total}` : "";
          return `<span class="finance-lanc-badge finance-lanc-badge--parcelada">Parcelada${escapeHtml(p)}</span>`;
        }
        return "";
      }

      function financeNaturezaBadgeHtml(natureza) {
        const n = String(natureza || "").toUpperCase();
        if (n !== "FIXA" && n !== "VARIAVEL") return "";
        return `<span class="finance-lanc-badge">${n === "FIXA" ? "Fixa" : "Variável"}</span>`;
      }

      async function readLancAnexoFile() {
        const input = document.getElementById("lancAnexo");
        const file = input?.files?.[0];
        if (!file) return null;
        if (file.size > 512000) {
          alert("Arquivo muito grande. Use até 500 KB.");
          return null;
        }
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve({ name: file.name, dataUrl: reader.result, size: file.size });
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(file);
        });
      }

      async function openFinanceAttachment(kind, id) {
        const att = financeAttachmentGet(kind, id);
        if (!att) {
          alert("Nenhum comprovante anexado para este registro.");
          return;
        }
        let src = att.dataUrl || "";
        if (att.storagePath && supabase) {
          try {
            const { data, error } = await supabase.storage
              .from(FINANCE_STORAGE_BUCKET)
              .createSignedUrl(att.storagePath, 3600);
            if (!error && data?.signedUrl) src = data.signedUrl;
          } catch (e) {
            console.warn("signed url attachment", e);
          }
        }
        if (!src) {
          alert("Comprovante indisponível neste dispositivo.");
          return;
        }
        if (String(src).startsWith("http")) {
          window.open(src, "_blank");
          return;
        }
        const w = window.open("", "_blank");
        if (!w) {
          alert("Permita pop-ups para visualizar o comprovante.");
          return;
        }
        if (String(src).startsWith("data:application/pdf")) {
          w.document.write(`<iframe src="${src}" style="width:100%;height:100%;border:0" title="Comprovante"></iframe>`);
        } else {
          w.document.write(`<img src="${src}" alt="${escapeHtml(att.name)}" style="max-width:100%;height:auto" />`);
        }
      }

      function buildCobrancaMessage(receivable) {
        const template = String(state.settings?.texto_cobranca || settingsCharge?.value || "").trim();
        const cliente = receivable?.responsavel_pagamento || "Cliente";
        const valor = formatCurrency(Number(receivable?.valor || 0));
        const venc = receivable?.period_end ? formatDate(receivable.period_end) : "—";
        const servico = receivableCategoryLabel(receivable?.receivable_category);
        const base =
          template ||
          "Olá {cliente}, identificamos pendência de {valor} referente a {servico}, com vencimento em {vencimento}. Por favor, entre em contato para regularização.";
        return base
          .replace(/\{cliente\}/gi, cliente)
          .replace(/\{valor\}/gi, valor)
          .replace(/\{vencimento\}/gi, venc)
          .replace(/\{servico\}/gi, servico);
      }

      const FINANCE_SUBVIEW_INTRO = {
        receitas: {
          title: "Controle de Receitas",
          desc: "Cadastre receitas únicas, recorrentes ou parceladas. Organize por serviço, anexe comprovantes e acompanhe o histórico de recebimentos.",
          showCats: true,
          catTipo: "RECEITA",
        },
        despesas: {
          title: "Controle de Despesas",
          desc: "Registre despesas fixas ou variáveis, com categorias personalizadas, centro de custo e anexo de nota fiscal.",
          showCats: true,
          catTipo: "DESPESA",
        },
        contas_pagar: {
          title: "Contas a Pagar",
          desc: "Filtre por vencidas, a vencer ou pagas. Registre pagamentos com data, forma de pagamento e comprovante. Edite títulos em aberto.",
          showCats: false,
          histView: "despesas",
        },
        contas_receber: {
          title: "Contas a Receber",
          desc: "Gestão completa de títulos: filtros, cobrança com preview, baixa com comprovante, histórico de pagamentos e edição de lançamentos manuais.",
          showCats: false,
          histView: "receitas",
        },
      };

      const FINANCE_RECEITAS_SUBVIEWS = {
        inicio: {
          label: "Início",
          title: "Controle de Receitas",
          desc: "",
        },
        cadastro: {
          label: "Cadastro",
          title: "Cadastro de receitas",
          desc: "Registre receitas únicas com cliente, serviço, valor, vencimento e comprovante opcional.",
        },
        categorias: {
          label: "Categorias",
          title: "Categorias de receita",
          desc: "Serviços padrão e categorias personalizadas para classificar cada receita.",
        },
        recorrentes: {
          label: "Recorrentes",
          title: "Receitas recorrentes",
          desc: "Mensalidades e cobranças fixas — o próximo título é gerado ao confirmar o pagamento.",
        },
        parceladas: {
          label: "Parceladas",
          title: "Receitas parceladas",
          desc: "Divida um valor total em parcelas mensais com vencimentos automáticos.",
        },
        anexos: {
          label: "Comprovantes",
          title: "Anexar comprovantes",
          desc: "Comprovantes anexados no cadastro ou na baixa em Contas a receber.",
        },
        historico: {
          label: "Histórico",
          title: "Histórico de recebimentos",
          desc: "Receitas pagas nos últimos 90 dias.",
        },
      };

      const FINANCE_DESPESAS_SUBVIEWS = {
        inicio: {
          label: "Início",
          title: "Controle de Despesas",
          desc: "",
        },
        cadastro: {
          label: "Cadastro",
          title: "Cadastro de despesas",
          desc: "Registre despesas únicas com fornecedor, categoria, valor, vencimento e comprovante opcional.",
        },
        categorias: {
          label: "Categorias",
          title: "Categorias de despesa",
          desc: "Categorias padrão e personalizadas para classificar cada despesa.",
        },
        recorrentes: {
          label: "Recorrentes",
          title: "Despesas recorrentes",
          desc: "Contas fixas — o próximo título é gerado ao confirmar o pagamento.",
        },
        parceladas: {
          label: "Parceladas",
          title: "Despesas parceladas",
          desc: "Divida um valor total em parcelas mensais com vencimentos automáticos.",
        },
        anexos: {
          label: "Comprovantes",
          title: "Anexar comprovantes",
          desc: "Comprovantes anexados no cadastro ou na baixa em Contas a pagar.",
        },
        historico: {
          label: "Histórico",
          title: "Histórico de pagamentos",
          desc: "Despesas pagas nos últimos 90 dias.",
        },
      };

      const FINANCE_CONTAS_PAGAR_SUBVIEWS = {
        inicio: {
          label: "Início",
          title: "Contas a Pagar",
          desc: "",
        },
        aberto: {
          label: "Em aberto",
          title: "Títulos em aberto",
          desc: "Contas pendentes — registre pagamento com data, forma e comprovante.",
        },
        vencidas: {
          label: "Vencidas",
          title: "Títulos vencidos",
          desc: "Contas com vencimento ultrapassado.",
        },
        a_vencer: {
          label: "A vencer",
          title: "A vencer (7 dias)",
          desc: "Títulos com vencimento nos próximos 7 dias.",
        },
        historico: {
          label: "Pagas",
          title: "Histórico de pagamentos",
          desc: "Pagamentos confirmados nos últimos 90 dias.",
        },
        anexos: {
          label: "Comprovantes",
          title: "Comprovantes de pagamento",
          desc: "Notas fiscais e comprovantes anexados às despesas.",
        },
      };

      const FINANCE_CONTAS_RECEBER_SUBVIEWS = {
        inicio: {
          label: "Início",
          title: "Contas a Receber",
          desc: "",
        },
        aberto: {
          label: "Em aberto",
          title: "Títulos em aberto",
          desc: "Recebimentos pendentes — confirme baixa com data, forma e comprovante.",
        },
        vencidas: {
          label: "Vencidas",
          title: "Títulos vencidos",
          desc: "Contas com vencimento ultrapassado — acione cobrança.",
        },
        a_vencer: {
          label: "A vencer",
          title: "A vencer (7 dias)",
          desc: "Títulos com vencimento nos próximos 7 dias.",
        },
        cobranca: {
          label: "Cobrança",
          title: "Cobrança",
          desc: "Títulos em aberto — use «Cobrar» na tabela para preview e registro.",
        },
        historico: {
          label: "Pagas",
          title: "Histórico de recebimentos",
          desc: "Recebimentos confirmados nos últimos 90 dias.",
        },
        anexos: {
          label: "Comprovantes",
          title: "Comprovantes de recebimento",
          desc: "Comprovantes anexados na baixa ou no cadastro.",
        },
      };

      const CONTAS_PAGAR_SUB_STATUS = {
        aberto: "aberto",
        vencidas: "vencido",
        a_vencer: "vencendo",
        historico: "pago",
      };

      const CONTAS_RECEBER_SUB_STATUS = {
        aberto: "aberto",
        vencidas: "vencido",
        a_vencer: "vencendo",
        cobranca: "aberto",
        historico: "pago",
      };

      function financeContasPagarSubShowsTable(sub) {
        return ["aberto", "vencidas", "a_vencer"].includes(sub);
      }

      function financeContasReceberSubShowsTable(sub) {
        return ["aberto", "vencidas", "a_vencer", "cobranca"].includes(sub);
      }

      function financeModuleMainTitle(module) {
        if (module === "receitas") return "Controle de Receitas";
        if (module === "despesas") return "Controle de Despesas";
        if (module === "contas_pagar") return "Contas a Pagar";
        if (module === "contas_receber") return "Contas a Receber";
        return "";
      }

      function setReceitasSubView(sub) {
        const key = FINANCE_RECEITAS_SUBVIEWS[sub] ? sub : "inicio";
        currentReceitasSubView = key;
        syncReceitasSubViewUi();
      }

      function syncReceitasSubViewUi() {
        const cfg = FINANCE_RECEITAS_SUBVIEWS[currentReceitasSubView] || FINANCE_RECEITAS_SUBVIEWS.inicio;
        const titleEl = document.getElementById("financeReceitasPageTitle");
        const descEl = document.getElementById("financeReceitasPageDesc");
        if (titleEl) titleEl.textContent = cfg.title;
        if (descEl) descEl.textContent = cfg.desc;
        document.querySelectorAll("[data-receitas-page]").forEach((el) => {
          const page = el.getAttribute("data-receitas-page");
          el.classList.toggle("hidden", page !== currentReceitasSubView);
        });
        document.querySelectorAll("#financeReceitasSubnav [data-receitas-sub]").forEach((btn) => {
          btn.classList.toggle("active", btn.getAttribute("data-receitas-sub") === currentReceitasSubView);
        });
        if (financeBreadcrumb && currentFinanceView === "receitas") {
          const suffix = currentReceitasSubView === "inicio" ? "" : ` › ${cfg.label}`;
          financeBreadcrumb.textContent = `Início › Financeiro › Controle de Receitas${suffix}`;
        }
        const financePageTitle = document.getElementById("financePageTitle");
        if (financePageTitle && currentFinanceView === "receitas") {
          financePageTitle.textContent =
            currentReceitasSubView === "inicio" ? "Controle de Receitas" : cfg.title;
        }
      }

      function setDespesasSubView(sub) {
        const key = FINANCE_DESPESAS_SUBVIEWS[sub] ? sub : "inicio";
        currentDespesasSubView = key;
        syncDespesasSubViewUi();
      }

      function syncDespesasSubViewUi() {
        const cfg = FINANCE_DESPESAS_SUBVIEWS[currentDespesasSubView] || FINANCE_DESPESAS_SUBVIEWS.inicio;
        const titleEl = document.getElementById("financeDespesasPageTitle");
        const descEl = document.getElementById("financeDespesasPageDesc");
        if (titleEl) titleEl.textContent = cfg.title;
        if (descEl) descEl.textContent = cfg.desc;
        document.querySelectorAll("[data-despesas-page]").forEach((el) => {
          el.classList.toggle("hidden", el.getAttribute("data-despesas-page") !== currentDespesasSubView);
        });
        document.querySelectorAll("#financeDespesasSubnav [data-despesas-sub]").forEach((btn) => {
          btn.classList.toggle("active", btn.getAttribute("data-despesas-sub") === currentDespesasSubView);
        });
        if (financeBreadcrumb && currentFinanceView === "despesas") {
          const suffix = currentDespesasSubView === "inicio" ? "" : ` › ${cfg.label}`;
          financeBreadcrumb.textContent = `Início › Financeiro › Controle de Despesas${suffix}`;
        }
        const financePageTitle = document.getElementById("financePageTitle");
        if (financePageTitle && currentFinanceView === "despesas") {
          financePageTitle.textContent =
            currentDespesasSubView === "inicio" ? "Controle de Despesas" : cfg.title;
        }
      }

      function setContasPagarSubView(sub) {
        const key = FINANCE_CONTAS_PAGAR_SUBVIEWS[sub] ? sub : "inicio";
        currentContasPagarSubView = key;
        if (CONTAS_PAGAR_SUB_STATUS[key]) {
          financePagarStatusFilter = CONTAS_PAGAR_SUB_STATUS[key];
          const st = document.getElementById("financePagarFilterStatus");
          if (st) st.value = financePagarStatusFilter;
        }
        syncContasPagarSubViewUi();
        if (currentFinanceView === "contas_pagar") {
          renderFinance();
        }
      }

      function syncContasPagarSubViewUi() {
        const cfg = FINANCE_CONTAS_PAGAR_SUBVIEWS[currentContasPagarSubView] || FINANCE_CONTAS_PAGAR_SUBVIEWS.inicio;
        const titleEl = document.getElementById("financeContasPagarPageTitle");
        const descEl = document.getElementById("financeContasPagarPageDesc");
        if (titleEl) titleEl.textContent = cfg.title;
        if (descEl) descEl.textContent = cfg.desc;
        document.querySelectorAll("[data-contas-pagar-page]").forEach((el) => {
          el.classList.toggle("hidden", el.getAttribute("data-contas-pagar-page") !== currentContasPagarSubView);
        });
        document.querySelectorAll("#financeContasPagarSubnav [data-contas-pagar-sub]").forEach((btn) => {
          btn.classList.toggle("active", btn.getAttribute("data-contas-pagar-sub") === currentContasPagarSubView);
        });
        const showTable = currentFinanceView === "contas_pagar" && financeContasPagarSubShowsTable(currentContasPagarSubView);
        const showFilters = showTable;
        document.getElementById("financePagarFilters")?.classList.toggle("hidden", !showFilters);
        document.getElementById("financeContasTableShell")?.classList.toggle("hidden", !showTable);
        if (financeBreadcrumb && currentFinanceView === "contas_pagar") {
          const suffix = currentContasPagarSubView === "inicio" ? "" : ` › ${cfg.label}`;
          financeBreadcrumb.textContent = `Início › Financeiro › Contas a Pagar${suffix}`;
        }
        const financePageTitle = document.getElementById("financePageTitle");
        if (financePageTitle && currentFinanceView === "contas_pagar") {
          financePageTitle.textContent =
            currentContasPagarSubView === "inicio" ? "Contas a Pagar" : cfg.title;
        }
      }

      function setContasReceberSubView(sub) {
        const key = FINANCE_CONTAS_RECEBER_SUBVIEWS[sub] ? sub : "inicio";
        currentContasReceberSubView = key;
        if (CONTAS_RECEBER_SUB_STATUS[key]) {
          financeReceberStatusFilter = CONTAS_RECEBER_SUB_STATUS[key];
          const st = document.getElementById("financeReceberFilterStatus");
          if (st) st.value = financeReceberStatusFilter;
        }
        syncContasReceberSubViewUi();
        if (currentFinanceView === "contas_receber") {
          renderFinance();
        }
      }

      function syncContasReceberSubViewUi() {
        const cfg = FINANCE_CONTAS_RECEBER_SUBVIEWS[currentContasReceberSubView] || FINANCE_CONTAS_RECEBER_SUBVIEWS.inicio;
        const titleEl = document.getElementById("financeContasReceberPageTitle");
        const descEl = document.getElementById("financeContasReceberPageDesc");
        if (titleEl) titleEl.textContent = cfg.title;
        if (descEl) descEl.textContent = cfg.desc;
        document.querySelectorAll("[data-contas-receber-page]").forEach((el) => {
          el.classList.toggle("hidden", el.getAttribute("data-contas-receber-page") !== currentContasReceberSubView);
        });
        document.querySelectorAll("#financeContasReceberSubnav [data-contas-receber-sub]").forEach((btn) => {
          btn.classList.toggle("active", btn.getAttribute("data-contas-receber-sub") === currentContasReceberSubView);
        });
        const showTable = currentFinanceView === "contas_receber" && financeContasReceberSubShowsTable(currentContasReceberSubView);
        const showFilters = showTable;
        document.getElementById("financeReceberFilters")?.classList.toggle("hidden", !showFilters);
        document.getElementById("financeContasTableShell")?.classList.toggle("hidden", !showTable);
        if (financeBreadcrumb && currentFinanceView === "contas_receber") {
          const suffix = currentContasReceberSubView === "inicio" ? "" : ` › ${cfg.label}`;
          financeBreadcrumb.textContent = `Início › Financeiro › Contas a Receber${suffix}`;
        }
        const financePageTitle = document.getElementById("financePageTitle");
        if (financePageTitle && currentFinanceView === "contas_receber") {
          financePageTitle.textContent =
            currentContasReceberSubView === "inicio" ? "Contas a Receber" : cfg.title;
        }
      }

      function renderFinanceSubviewIntro(view) {
        const panel = document.getElementById("financeSubviewIntro");
        const receitasPanel = document.getElementById("financeReceitasPanel");
        const despesasPanel = document.getElementById("financeDespesasPanel");
        const contasPagarPanel = document.getElementById("financeContasPagarPanel");
        const contasReceberPanel = document.getElementById("financeContasReceberPanel");
        const histPanel = document.getElementById("financeHistoricoPanel");
        const cfg = FINANCE_SUBVIEW_INTRO[view];
        receitasPanel?.classList.toggle("hidden", view !== "receitas");
        despesasPanel?.classList.toggle("hidden", view !== "despesas");
        contasPagarPanel?.classList.toggle("hidden", view !== "contas_pagar");
        contasReceberPanel?.classList.toggle("hidden", view !== "contas_receber");
        if (view === "receitas") {
          panel?.classList.add("hidden");
          histPanel?.classList.add("hidden");
          syncReceitasSubViewUi();
          return;
        }
        if (view === "despesas") {
          panel?.classList.add("hidden");
          histPanel?.classList.add("hidden");
          syncDespesasSubViewUi();
          return;
        }
        if (view === "contas_pagar") {
          panel?.classList.add("hidden");
          histPanel?.classList.add("hidden");
          syncContasPagarSubViewUi();
          return;
        }
        if (view === "contas_receber") {
          panel?.classList.add("hidden");
          histPanel?.classList.add("hidden");
          syncContasReceberSubViewUi();
          return;
        }
        receitasPanel?.classList.add("hidden");
        despesasPanel?.classList.add("hidden");
        contasPagarPanel?.classList.add("hidden");
        contasReceberPanel?.classList.add("hidden");
        if (!panel || !cfg) {
          panel?.classList.add("hidden");
          histPanel?.classList.add("hidden");
          return;
        }
        panel.classList.remove("hidden");
        const titleEl = document.getElementById("financeSubviewTitle");
        const descEl = document.getElementById("financeSubviewDesc");
        if (titleEl) titleEl.textContent = cfg.title;
        if (descEl) descEl.textContent = cfg.desc;
        const catBar = document.getElementById("financeSubviewCategoryBar");
        if (catBar) {
          catBar.classList.toggle("hidden", !cfg.showCats);
          if (cfg.showCats) renderFinanceCategoryTags(cfg.catTipo);
        }
        if (histPanel) {
          const histView = cfg.histView || (financeIsLancamentosView(view) ? view : null);
          histPanel.classList.toggle("hidden", !histView || view === "receitas" || view === "despesas");
          if (histView && view !== "receitas" && view !== "despesas") renderFinanceHistoricoPanel(histView);
        }
      }

      function renderFinanceCategoryTags(tipo) {
        const wrap =
          currentFinanceView === "receitas"
            ? document.getElementById("financeReceitasCategoryTags")
            : currentFinanceView === "despesas"
              ? document.getElementById("financeDespesasCategoryTags")
              : document.getElementById("financeCategoryTags");
        if (!wrap) return;
        const cats = tipo === "DESPESA" ? getLancDespesaCategorias() : getLancReceitaCategorias();
        const baseValues = new Set(
          (tipo === "DESPESA" ? LANC_DESPESA_CATEGORIAS : LANC_RECEITA_CATEGORIAS).map((c) => c.value)
        );
        const custom = cats.filter((c) => !baseValues.has(c.value));
        if (!custom.length) {
          wrap.innerHTML = `<span class="notice" style="font-size:12px">Nenhuma categoria personalizada ainda.</span>`;
          return;
        }
        wrap.innerHTML = custom
          .map(
            (c) => `
              <span class="finance-category-tag">
                ${escapeHtml(c.label)}
                <button type="button" data-action="remover-categoria" data-tipo="${tipo}" data-value="${escapeHtml(c.value)}" title="Remover">×</button>
              </span>
            `
          )
          .join("");
      }

      function renderFinanceReceitasDefaultCategories() {
        const wrap = document.getElementById("financeReceitasCatsDefault");
        if (!wrap) return;
        wrap.innerHTML = LANC_RECEITA_CATEGORIAS.map(
          (c) => `<span class="finance-category-tag">${escapeHtml(c.label)}</span>`
        ).join("");
      }

      function renderFinanceReceitasSections(allEntries, pageEntries, pagination) {
        const panel = document.getElementById("financeReceitasPanel");
        if (!panel || currentFinanceView !== "receitas") return;
        renderFinanceReceitasDefaultCategories();
        renderFinanceCategoryTags("RECEITA");
        const receitaEntries = allEntries.filter((e) => e.tipo === "RECEITA");
        const recorrentes = receitaEntries.filter((e) => e.modo === "RECORRENTE");
        const parceladas = receitaEntries.filter((e) => e.modo === "PARCELADA");
        const comAnexo = receitaEntries.filter(
          (e) => e.recordKind && e.recordId && financeAttachmentGet(e.recordKind, e.recordId)
        );
        const fill = (id, items, emptyMsg) => {
          const el = document.getElementById(id);
          if (!el) return;
          if (!items.length) {
            el.innerHTML = `<div class="finance-lanc-empty">${emptyMsg}</div>`;
            return;
          }
          el.innerHTML = items.map((e) => renderFinanceLancItemAnalytical(e)).join("");
        };
        const cadastroList = document.getElementById("financeReceitasCadastroList");
        if (cadastroList) {
          if (!pageEntries.length) {
            cadastroList.innerHTML = `<div class="finance-lanc-empty">Nenhuma receita cadastrada. Toque em «+ Nova receita».</div>`;
          } else {
            cadastroList.innerHTML = pageEntries.map((e) => renderFinanceLancItemAnalytical(e)).join("");
          }
        }
        const pagWrap = document.getElementById("financeReceitasCadastroPagination");
        const pageInfo = document.getElementById("financeReceitasCadastroPageInfo");
        const prevBtn = document.getElementById("financeReceitasCadastroPrev");
        const nextBtn = document.getElementById("financeReceitasCadastroNext");
        if (pagWrap && pagination) {
          pagWrap.classList.toggle("hidden", pagination.pages <= 1);
          if (pageInfo) pageInfo.textContent = `Página ${pagination.page} de ${pagination.pages}`;
          if (prevBtn) prevBtn.disabled = pagination.page <= 1;
          if (nextBtn) nextBtn.disabled = pagination.page >= pagination.pages;
        }
        fill(
          "financeReceitasRecorrentesList",
          recorrentes,
          "Nenhuma receita recorrente. Use «+ Recorrente» para cadastrar mensalidades."
        );
        fill(
          "financeReceitasParceladasList",
          parceladas,
          "Nenhuma receita parcelada. Use «+ Parcelada» para dividir um valor."
        );
        fill(
          "financeReceitasAnexosList",
          comAnexo,
          "Nenhum comprovante anexado ainda. Anexe ao cadastrar ou na baixa em Contas a receber."
        );
        renderFinanceReceitasHistorico();
        syncReceitasSubViewUi();
      }

      function renderFinanceReceitasHistorico() {
        const listEl = document.getElementById("financeReceitasHistoricoList");
        if (!listEl || currentFinanceView !== "receitas") return;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 90);
        const cutoffMs = cutoff.getTime();
        const cashByReceivable = new Map(
          state.cash.filter((c) => c.tipo_conta === "RECEBER").map((c) => [String(c.conta_id), c])
        );
        const entries = [];
        state.receivables
          .filter((r) => !FINANCE_MANUAL_ONLY || isManualFinanceLancamento(r))
          .filter((r) => r.status === "PAGO")
          .forEach((r) => {
            const mov = cashByReceivable.get(String(r.id));
            const paidAt = mov?.data_movimento || r.updated_at || r.created_at;
            const paidMs = paidAt ? new Date(paidAt).getTime() : 0;
            if (paidMs && paidMs < cutoffMs) return;
            const { meta, text } = financeMetaUnpack(r.observacoes);
            entries.push({
              data: (r.period_start || paidAt || "").toString().slice(0, 10),
              tipo: "RECEITA",
              descricao: text || r.observacoes || "Receita",
              parte: r.responsavel_pagamento || "-",
              valor: Number(r.valor || 0),
              status: "PAGO",
              categoria: r.receivable_category || "GUARDA_PATIO",
              modo: financeEntryModoFromRecord(r, "receivable"),
              meta,
              recordKind: "receivable",
              recordId: r.id,
            });
          });
        entries.sort((a, b) => String(b.data).localeCompare(String(a.data)));
        if (!entries.length) {
          listEl.innerHTML = `<div class="finance-lanc-empty">Nenhum recebimento nos últimos 90 dias.</div>`;
          return;
        }
        listEl.innerHTML = entries.slice(0, 40).map((e) => renderFinanceLancItem(e)).join("");
      }

      function renderFinanceDespesasDefaultCategories() {
        const wrap = document.getElementById("financeDespesasCatsDefault");
        if (!wrap) return;
        wrap.innerHTML = LANC_DESPESA_CATEGORIAS.map(
          (c) => `<span class="finance-category-tag">${escapeHtml(c.label)}</span>`
        ).join("");
      }

      function renderFinanceDespesasSections(allEntries, pageEntries, pagination) {
        const panel = document.getElementById("financeDespesasPanel");
        if (!panel || currentFinanceView !== "despesas") return;
        renderFinanceDespesasDefaultCategories();
        renderFinanceCategoryTags("DESPESA");
        const despesaEntries = allEntries.filter((e) => e.tipo === "DESPESA");
        const recorrentes = despesaEntries.filter((e) => e.modo === "RECORRENTE");
        const parceladas = despesaEntries.filter((e) => e.modo === "PARCELADA");
        const comAnexo = despesaEntries.filter(
          (e) => e.recordKind && e.recordId && financeAttachmentGet(e.recordKind, e.recordId)
        );
        const fill = (id, items, emptyMsg) => {
          const el = document.getElementById(id);
          if (!el) return;
          if (!items.length) {
            el.innerHTML = `<div class="finance-lanc-empty">${emptyMsg}</div>`;
            return;
          }
          el.innerHTML = items.map((e) => renderFinanceLancItemAnalytical(e)).join("");
        };
        const cadastroList = document.getElementById("financeDespesasCadastroList");
        if (cadastroList) {
          if (!pageEntries.length) {
            cadastroList.innerHTML = `<div class="finance-lanc-empty">Nenhuma despesa cadastrada. Toque em «+ Nova despesa».</div>`;
          } else {
            cadastroList.innerHTML = pageEntries.map((e) => renderFinanceLancItemAnalytical(e)).join("");
          }
        }
        const pagWrap = document.getElementById("financeDespesasCadastroPagination");
        const pageInfo = document.getElementById("financeDespesasCadastroPageInfo");
        const prevBtn = document.getElementById("financeDespesasCadastroPrev");
        const nextBtn = document.getElementById("financeDespesasCadastroNext");
        if (pagWrap && pagination) {
          pagWrap.classList.toggle("hidden", pagination.pages <= 1);
          if (pageInfo) pageInfo.textContent = `Página ${pagination.page} de ${pagination.pages}`;
          if (prevBtn) prevBtn.disabled = pagination.page <= 1;
          if (nextBtn) nextBtn.disabled = pagination.page >= pagination.pages;
        }
        fill(
          "financeDespesasRecorrentesList",
          recorrentes,
          "Nenhuma despesa recorrente. Use «+ Recorrente» para cadastrar contas fixas."
        );
        fill(
          "financeDespesasParceladasList",
          parceladas,
          "Nenhuma despesa parcelada. Use «+ Parcelada» para dividir um valor."
        );
        fill(
          "financeDespesasAnexosList",
          comAnexo,
          "Nenhum comprovante anexado ainda. Anexe ao cadastrar ou na baixa em Contas a pagar."
        );
        renderFinanceDespesasHistorico();
        syncDespesasSubViewUi();
      }

      function renderFinanceDespesasHistorico() {
        const listEl = document.getElementById("financeDespesasHistoricoList");
        if (!listEl || currentFinanceView !== "despesas") return;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 90);
        const cutoffMs = cutoff.getTime();
        const cashByPayable = new Map(
          state.cash.filter((c) => c.tipo_conta === "PAGAR").map((c) => [String(c.conta_id), c])
        );
        const entries = [];
        state.payables
          .filter((p) => p.status === "PAGO")
          .forEach((p) => {
            const mov = cashByPayable.get(String(p.id));
            const paidAt = mov?.data_movimento || p.updated_at || p.created_at;
            const paidMs = paidAt ? new Date(paidAt).getTime() : 0;
            if (paidMs && paidMs < cutoffMs) return;
            const { meta, text } = financeMetaUnpack(p.observacoes);
            entries.push({
              data: (p.data_vencimento || paidAt || "").toString().slice(0, 10),
              tipo: "DESPESA",
              descricao: p.descricao || text || "Despesa",
              parte: p.fornecedor || "-",
              valor: Number(p.valor || 0),
              status: "PAGO",
              categoria: p.payable_category || "OUTROS",
              modo: financeEntryModoFromRecord(p, "payable"),
              meta,
              natureza: meta.natureza,
              recordKind: "payable",
              recordId: p.id,
            });
          });
        entries.sort((a, b) => String(b.data).localeCompare(String(a.data)));
        if (!entries.length) {
          listEl.innerHTML = `<div class="finance-lanc-empty">Nenhum pagamento nos últimos 90 dias.</div>`;
          return;
        }
        listEl.innerHTML = entries.slice(0, 40).map((e) => renderFinanceLancItem(e)).join("");
      }

      function renderFinanceContasPagarHistorico() {
        const listEl = document.getElementById("financeContasPagarHistoricoList");
        if (!listEl || currentFinanceView !== "contas_pagar") return;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 90);
        const cutoffMs = cutoff.getTime();
        const cashByPayable = new Map(
          state.cash.filter((c) => c.tipo_conta === "PAGAR").map((c) => [String(c.conta_id), c])
        );
        const entries = [];
        state.payables
          .filter((p) => p.status === "PAGO")
          .forEach((p) => {
            const mov = cashByPayable.get(String(p.id));
            const paidAt = mov?.data_movimento || p.updated_at || p.created_at;
            const paidMs = paidAt ? new Date(paidAt).getTime() : 0;
            if (paidMs && paidMs < cutoffMs) return;
            const { meta, text } = financeMetaUnpack(p.observacoes);
            entries.push({
              data: (p.data_vencimento || paidAt || "").toString().slice(0, 10),
              tipo: "DESPESA",
              descricao: p.descricao || text || "Despesa",
              parte: p.fornecedor || "-",
              valor: Number(p.valor || 0),
              status: "PAGO",
              categoria: p.payable_category || "OUTROS",
              modo: financeEntryModoFromRecord(p, "payable"),
              meta,
              natureza: meta.natureza,
              recordKind: "payable",
              recordId: p.id,
            });
          });
        entries.sort((a, b) => String(b.data).localeCompare(String(a.data)));
        if (!entries.length) {
          listEl.innerHTML =
            `<div class="finance-lanc-empty">Nenhum pagamento nos últimos 90 dias.</div>` +
            financeMovimentosHistoricoHtml("PAGAR");
          syncContasPagarSubViewUi();
          return;
        }
        listEl.innerHTML =
          entries.slice(0, 40).map((e) => renderFinanceLancItem(e)).join("") +
          financeMovimentosHistoricoHtml("PAGAR");
        syncContasPagarSubViewUi();
      }

      function renderFinanceContasReceberHistorico() {
        const listEl = document.getElementById("financeContasReceberHistoricoList");
        if (!listEl || currentFinanceView !== "contas_receber") return;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 90);
        const cutoffMs = cutoff.getTime();
        const cashByReceivable = new Map(
          state.cash.filter((c) => c.tipo_conta === "RECEBER").map((c) => [String(c.conta_id), c])
        );
        const entries = [];
        state.receivables
          .filter((r) => !FINANCE_MANUAL_ONLY || isManualFinanceLancamento(r))
          .filter((r) => r.status === "PAGO")
          .forEach((r) => {
            const mov = cashByReceivable.get(String(r.id));
            const paidAt = mov?.data_movimento || r.updated_at || r.created_at;
            const paidMs = paidAt ? new Date(paidAt).getTime() : 0;
            if (paidMs && paidMs < cutoffMs) return;
            const { meta, text } = financeMetaUnpack(r.observacoes);
            entries.push({
              data: (r.period_start || paidAt || "").toString().slice(0, 10),
              tipo: "RECEITA",
              descricao: text || r.observacoes || "Receita",
              parte: r.responsavel_pagamento || "-",
              valor: Number(r.valor || 0),
              status: "PAGO",
              categoria: r.receivable_category || "GUARDA_PATIO",
              modo: financeEntryModoFromRecord(r, "receivable"),
              meta,
              recordKind: "receivable",
              recordId: r.id,
            });
          });
        entries.sort((a, b) => String(b.data).localeCompare(String(a.data)));
        if (!entries.length) {
          listEl.innerHTML =
            `<div class="finance-lanc-empty">Nenhum recebimento nos últimos 90 dias.</div>` +
            financeMovimentosHistoricoHtml("RECEBER");
          syncContasReceberSubViewUi();
          return;
        }
        listEl.innerHTML =
          entries.slice(0, 40).map((e) => renderFinanceLancItem(e)).join("") +
          financeMovimentosHistoricoHtml("RECEBER");
        syncContasReceberSubViewUi();
      }

      function renderFinanceContasPagarAnexos() {
        const listEl = document.getElementById("financeContasPagarAnexosList");
        if (!listEl || currentFinanceView !== "contas_pagar") return;
        const comAnexo = state.payables.filter((p) => financeAttachmentGet("payable", p.id));
        if (!comAnexo.length) {
          listEl.innerHTML = `<div class="finance-lanc-empty">Nenhum comprovante anexado a contas a pagar.</div>`;
        } else {
          const entries = comAnexo.map((p) => {
            const { meta, text } = financeMetaUnpack(p.observacoes);
            return {
              data: (p.data_vencimento || p.created_at || "").toString().slice(0, 10),
              tipo: "DESPESA",
              descricao: p.descricao || text || "Despesa",
              parte: p.fornecedor || "-",
              valor: Number(p.valor || 0),
              status: p.status === "PAGO" ? "PAGO" : "ABERTO",
              categoria: p.payable_category || "OUTROS",
              modo: financeEntryModoFromRecord(p, "payable"),
              meta,
              recordKind: "payable",
              recordId: p.id,
            };
          });
          listEl.innerHTML = entries.map((e) => renderFinanceLancItem(e)).join("");
        }
        syncContasPagarSubViewUi();
      }

      function renderFinanceContasReceberAnexos() {
        const listEl = document.getElementById("financeContasReceberAnexosList");
        if (!listEl || currentFinanceView !== "contas_receber") return;
        const comAnexo = state.receivables
          .filter((r) => !FINANCE_MANUAL_ONLY || isManualFinanceLancamento(r))
          .filter((r) => financeAttachmentGet("receivable", r.id));
        if (!comAnexo.length) {
          listEl.innerHTML = `<div class="finance-lanc-empty">Nenhum comprovante anexado a contas a receber.</div>`;
        } else {
          const entries = comAnexo.map((r) => {
            const { meta, text } = financeMetaUnpack(r.observacoes);
            return {
              data: (r.period_start || r.created_at || "").toString().slice(0, 10),
              tipo: "RECEITA",
              descricao: text || r.observacoes || "Receita",
              parte: r.responsavel_pagamento || "-",
              valor: Number(r.valor || 0),
              status: r.status === "PAGO" ? "PAGO" : "ABERTO",
              categoria: r.receivable_category || "GUARDA_PATIO",
              modo: financeEntryModoFromRecord(r, "receivable"),
              meta,
              recordKind: "receivable",
              recordId: r.id,
            };
          });
          listEl.innerHTML = entries.map((e) => renderFinanceLancItem(e)).join("");
        }
        syncContasReceberSubViewUi();
      }

      function renderFinanceHistoricoPanel(view) {
        const listEl = document.getElementById("financeHistoricoList");
        const titleEl = document.getElementById("financeHistoricoTitle");
        if (!listEl) return;
        const isReceita = view === "receitas";
        if (titleEl) {
          titleEl.textContent = isReceita ? "Histórico de recebimentos (últimos 90 dias)" : "Histórico de pagamentos (últimos 90 dias)";
        }
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 90);
        const cutoffMs = cutoff.getTime();
        const cashByReceivable = new Map(
          state.cash.filter((c) => c.tipo_conta === "RECEBER").map((c) => [String(c.conta_id), c])
        );
        const cashByPayable = new Map(
          state.cash.filter((c) => c.tipo_conta === "PAGAR").map((c) => [String(c.conta_id), c])
        );
        const entries = [];
        if (isReceita) {
          state.receivables
            .filter((r) => !FINANCE_MANUAL_ONLY || isManualFinanceLancamento(r))
            .filter((r) => r.status === "PAGO")
            .forEach((r) => {
              const mov = cashByReceivable.get(String(r.id));
              const paidAt = mov?.data_movimento || r.updated_at || r.created_at;
              const paidMs = paidAt ? new Date(paidAt).getTime() : 0;
              if (paidMs && paidMs < cutoffMs) return;
              const { meta, text } = financeMetaUnpack(r.observacoes);
              entries.push({
                data: (r.period_start || paidAt || "").toString().slice(0, 10),
                tipo: "RECEITA",
                descricao: text || r.observacoes || "Receita",
                parte: r.responsavel_pagamento || "-",
                valor: Number(r.valor || 0),
                status: "PAGO",
                categoria: r.receivable_category || "GUARDA_PATIO",
                modo: financeEntryModoFromRecord(r, "receivable"),
                meta,
                recordKind: "receivable",
                recordId: r.id,
              });
            });
        } else {
          state.payables
            .filter((p) => p.status === "PAGO")
            .forEach((p) => {
              const mov = cashByPayable.get(String(p.id));
              const paidAt = mov?.data_movimento || p.updated_at || p.created_at;
              const paidMs = paidAt ? new Date(paidAt).getTime() : 0;
              if (paidMs && paidMs < cutoffMs) return;
              const { meta, text } = financeMetaUnpack(p.observacoes);
              entries.push({
                data: (p.data_vencimento || paidAt || "").toString().slice(0, 10),
                tipo: "DESPESA",
                descricao: p.descricao || text || "Despesa",
                parte: p.fornecedor || "-",
                valor: Number(p.valor || 0),
                status: "PAGO",
                categoria: p.payable_category || "OUTROS",
                modo: financeEntryModoFromRecord(p, "payable"),
                meta,
                natureza: meta.natureza,
                recordKind: "payable",
                recordId: p.id,
              });
            });
        }
        entries.sort((a, b) => String(b.data).localeCompare(String(a.data)));
        if (!entries.length) {
          listEl.innerHTML = `<div class="finance-lanc-empty">Nenhum registro quitado nos últimos 90 dias.</div>`;
          return;
        }
        listEl.innerHTML = entries.slice(0, 30).map((e) => renderFinanceLancItem(e)).join("");
      }

      function receivableCategoryLabel(code) {
        const key = String(code || "GUARDA_PATIO").trim();
        const found = getLancReceitaCategorias().find((c) => c.value === key);
        if (found) return found.label;
        const legacy = {
          SERVICO: "Serviços",
          PRODUTO: "Produtos",
          OUTROS: "Outros",
          RECEITA: "Receita",
        };
        if (legacy[key]) return legacy[key];
        return key.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
      }

      function receberTriagemIdSet() {
        try {
          const raw = localStorage.getItem(RECEBER_TRIAGEM_IDS_KEY);
          const arr = JSON.parse(raw || "[]");
          return new Set((Array.isArray(arr) ? arr : []).map(String));
        } catch (e) {
          return new Set();
        }
      }

      function addReceberTriagemId(id) {
        if (!id) return;
        const s = receberTriagemIdSet();
        s.add(String(id));
        try {
          localStorage.setItem(RECEBER_TRIAGEM_IDS_KEY, JSON.stringify([...s]));
        } catch (e) {
          console.warn("localStorage triagem", e);
        }
      }

      function removeReceberTriagemId(id) {
        if (!id) return;
        const s = receberTriagemIdSet();
        if (!s.delete(String(id))) return;
        try {
          localStorage.setItem(RECEBER_TRIAGEM_IDS_KEY, JSON.stringify([...s]));
        } catch (e) {
          console.warn("localStorage triagem", e);
        }
      }

      function patioFinanceiroBloqueadoReceivableIdSet() {
        try {
          const raw = localStorage.getItem(PATIO_FINANCEIRO_BLOQUEADO_IDS_KEY);
          const arr = JSON.parse(raw || "[]");
          return new Set((Array.isArray(arr) ? arr : []).map(String));
        } catch (e) {
          return new Set();
        }
      }

      function addPatioFinanceiroBloqueadoReceivableId(id) {
        if (!id) return;
        const s = patioFinanceiroBloqueadoReceivableIdSet();
        s.add(String(id));
        try {
          localStorage.setItem(PATIO_FINANCEIRO_BLOQUEADO_IDS_KEY, JSON.stringify([...s]));
        } catch (e) {
          console.warn("localStorage patio financeiro bloqueado", e);
        }
      }

      function removePatioFinanceiroBloqueadoReceivableId(id) {
        if (!id) return;
        const s = patioFinanceiroBloqueadoReceivableIdSet();
        if (!s.delete(String(id))) return;
        try {
          localStorage.setItem(PATIO_FINANCEIRO_BLOQUEADO_IDS_KEY, JSON.stringify([...s]));
        } catch (e) {
          console.warn("localStorage patio financeiro bloqueado", e);
        }
      }

      /**
       * Quando false, o ciclo não entra em «Contas a receber» até OK em Pátio → Fechando ciclo.
       * Sem coluna no Supabase: usa lista local de IDs bloqueados após VRP.
       */
      function receivablePatioLiberadoParaFinanceiro(r) {
        if (!r) return false;
        const v = r.patio_liberado_financeiro;
        if (v === true) return true;
        if (v === false) return false;
        return !patioFinanceiroBloqueadoReceivableIdSet().has(String(r.id));
      }

      function nfseEnviadaVehicleIdSet() {
        try {
          const raw = localStorage.getItem(NFSE_ENVIADA_VEHICLE_IDS_KEY);
          const arr = JSON.parse(raw || "[]");
          return new Set((Array.isArray(arr) ? arr : []).map(String));
        } catch (e) {
          return new Set();
        }
      }

      function addNfseEnviadaVehicleId(id) {
        if (!id) return;
        const s = nfseEnviadaVehicleIdSet();
        s.add(String(id));
        try {
          localStorage.setItem(NFSE_ENVIADA_VEHICLE_IDS_KEY, JSON.stringify([...s]));
        } catch (e) {
          console.warn("localStorage nfse enviada", e);
        }
      }

      function vehicleNfseEnviadaFlag(v) {
        if (!v) return false;
        if (v.nfse_enviada === true) return true;
        return nfseEnviadaVehicleIdSet().has(String(v.id));
      }

      function latestReceivableForVehicle(vehicleId) {
        const list = (state.receivables || []).filter((r) => r.vehicle_id === vehicleId);
        if (!list.length) return null;
        return [...list].sort((a, b) => {
          const ta = new Date(a.created_at || 0).getTime();
          const tb = new Date(b.created_at || 0).getTime();
          if (tb !== ta) return tb - ta;
          return String(b.id || "").localeCompare(String(a.id || ""));
        })[0];
      }

      /** Na fila «Fechando ciclo»: pré-lançamento operacional, ainda sem liberação para o financeiro. */
      function receivableNaFilaFechamentoCicloPatio(r) {
        if (FINANCE_MANUAL_ONLY) return false;
        if (!r || receivableAprovadoParaContasReceber(r)) return false;
        if (r.status === RECEIVABLE_AGUARDANDO_LANCAMENTO) return !receivablePatioLiberadoParaFinanceiro(r);
        if (r.status !== "EM_ABERTO") return false;
        if (!receivableCicloEncerradoParaFinanceiro(r)) return false;
        return !receivablePatioLiberadoParaFinanceiro(r);
      }

      function cadastroBaseReadSaved() {
        try {
          const raw = localStorage.getItem(CADASTRO_BASE_STORAGE_KEY);
          const parsed = JSON.parse(raw || "{}");
          return parsed && typeof parsed === "object" ? parsed : {};
        } catch (e) {
          return {};
        }
      }

      function cadastroBaseWriteSaved(payload) {
        try {
          localStorage.setItem(CADASTRO_BASE_STORAGE_KEY, JSON.stringify(payload || {}));
        } catch (e) {
          console.warn("localStorage cadastro base", e);
        }
      }

      function financeMetaRead() {
        try {
          const raw = localStorage.getItem(FINANCE_META_KEY);
          const parsed = JSON.parse(raw || "{}");
          return {
            nome: String(parsed?.nome || "").trim(),
            valor: Number(parsed?.valor || 0),
          };
        } catch (e) {
          return { nome: "", valor: 0 };
        }
      }

      function financeMetaWrite(meta) {
        try {
          localStorage.setItem(
            FINANCE_META_KEY,
            JSON.stringify({
              nome: String(meta?.nome || "").trim(),
              valor: Number(meta?.valor || 0),
            })
          );
        } catch (e) {
          console.warn("localStorage meta financeira", e);
        }
      }

      function financeReceberFlagsRead() {
        try {
          const raw = localStorage.getItem(FINANCE_RECEBER_FLAGS_KEY);
          const parsed = JSON.parse(raw || "{}");
          return parsed && typeof parsed === "object" ? parsed : {};
        } catch (e) {
          return {};
        }
      }

      function financeReceberFlagsWrite(payload) {
        try {
          localStorage.setItem(FINANCE_RECEBER_FLAGS_KEY, JSON.stringify(payload || {}));
        } catch (e) {
          console.warn("localStorage receber flags", e);
        }
      }

      function financeContaDueYmd(record, kind) {
        if (!record) return "";
        if (kind === "receivable") return String(record.period_end || record.created_at || "").slice(0, 10);
        return String(record.data_vencimento || record.created_at || "").slice(0, 10);
      }

      function financeContaDueDays(dueYmd, todayYmd) {
        if (!dueYmd || !todayYmd) return null;
        return Math.floor((new Date(todayYmd).getTime() - new Date(dueYmd).getTime()) / 86400000);
      }

      function financeContaMatchesStatusFilter(record, kind, statusFilter, todayYmd) {
        const filter = String(statusFilter || "aberto").toLowerCase();
        const isPaid = String(record?.status || "").toUpperCase() === "PAGO";
        if (filter === "pago") return isPaid;
        if (filter === "todas") return true;
        if (isPaid) return false;
        if (filter === "aberto") return true;
        const due = financeContaDueYmd(record, kind);
        const days = financeContaDueDays(due, todayYmd);
        if (days == null) return filter === "aberto";
        if (filter === "vencido") return days > 0;
        if (filter === "vencendo") return days >= -7 && days <= 0;
        return true;
      }

      function financeFormatUltimaCobranca(iso) {
        if (!iso) return "";
        try {
          return formatDateTime(iso);
        } catch (e) {
          return String(iso);
        }
      }

      function collectFinancePagarFilteredList() {
        const todayYmd = toLocalYmd(new Date().toISOString());
        const q = String(financePagarBuscaFilter || "").trim().toLowerCase();
        const financePlateNorm = normalizePlateSearch(financePlateQuery);
        const list = (state.payables || [])
          .filter((p) => {
            if (financePlateNorm) {
              const descNorm = normalizePlateSearch(p.descricao || "");
              if (!descNorm.includes(financePlateNorm)) return false;
            }
            if (!financeContaMatchesStatusFilter(p, "payable", financePagarStatusFilter, todayYmd)) return false;
            if (!q) return true;
            const blob = `${p.descricao || ""} ${p.fornecedor || ""} ${p.payable_category || ""}`.toLowerCase();
            return blob.includes(q);
          })
          .sort((a, b) => String(a.data_vencimento || "").localeCompare(String(b.data_vencimento || "")));
        return { list, todayYmd };
      }

      function readFinanceFileInput(inputEl) {
        const file = inputEl?.files?.[0];
        if (!file) return Promise.resolve(null);
        if (file.size > 512000) {
          alert("Arquivo muito grande. Use até 500 KB.");
          return Promise.resolve(null);
        }
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve({ name: file.name, dataUrl: reader.result, size: file.size });
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(file);
        });
      }

      function renderFinanceMetaCard(saldoAtual) {
        const nomeInput = document.getElementById("financeMetaNome");
        const valorInput = document.getElementById("financeMetaValor");
        const barra = document.getElementById("financeMetaProgressBar");
        const resumo = document.getElementById("financeMetaResumo");
        if (!nomeInput || !valorInput || !barra || !resumo) return;
        const meta = financeMetaRead();
        if (document.activeElement !== nomeInput) nomeInput.value = meta.nome || "";
        if (document.activeElement !== valorInput) valorInput.value = meta.valor > 0 ? String(meta.valor) : "";
        if (!(meta.valor > 0)) {
          barra.style.width = "0%";
          resumo.textContent = "Sem meta definida.";
          return;
        }
        const progressoPct = Math.max(0, Math.min(100, (Number(saldoAtual || 0) / meta.valor) * 100));
        barra.style.width = `${progressoPct.toFixed(1)}%`;
        const faltante = Math.max(0, meta.valor - Number(saldoAtual || 0));
        const nome = meta.nome || "Objetivo financeiro";
        resumo.textContent = `${nome}: ${formatCurrency(Number(saldoAtual || 0))} de ${formatCurrency(meta.valor)} (${progressoPct.toFixed(
          1
        )}%). Faltam ${formatCurrency(faltante)}.`;
      }

      function cadastroBaseNormalizeList(list) {
        const seen = new Set();
        return (Array.isArray(list) ? list : [])
          .map((x) => String(x || "").trim())
          .filter(Boolean)
          .filter((x) => {
            const k = x.toLowerCase();
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          })
          .sort((a, b) => a.localeCompare(b));
      }

      function cadastroBaseDefaults() {
        return {
          categorias: cadastroBaseNormalizeList(state.payables.map((p) => p.payable_category || "")),
          subcategorias: cadastroBaseNormalizeList(state.payables.map((p) => p.subcategoria || p.tipo || "")),
          clientes: cadastroBaseNormalizeList(state.receivables.map((r) => r.responsavel_pagamento || "")),
          fornecedores: cadastroBaseNormalizeList(state.payables.map((p) => p.fornecedor || p.descricao || "")),
          formas_pagamento: cadastroBaseNormalizeList(state.cash.map((m) => m.forma_pagamento || "")),
          bancos: cadastroBaseNormalizeList([state.settings?.conta_bancaria || ""]),
          centros_custo: cadastroBaseNormalizeList(state.payables.map((p) => p.centro_custo || "")),
        };
      }

      function cadastroBaseMerged() {
        const defaults = cadastroBaseDefaults();
        const saved = cadastroBaseReadSaved();
        const merged = {};
        CADASTRO_BASE_FIELDS.forEach(({ key }) => {
          merged[key] = Array.isArray(saved[key]) ? cadastroBaseNormalizeList(saved[key]) : defaults[key] || [];
        });
        return merged;
      }

      /** Aprovado para «Contas a receber»: coluna Supabase (sincroniza entre PCs) ou lista local (fallback). */
      function receivableAprovadoParaContasReceber(r) {
        if (!r) return false;
        if (r.financeiro_aprovado_contas_receber === true) return true;
        return receberTriagemIdSet().has(String(r.id));
      }

      function receivableIsCicloPatioAberto(r) {
        if (!r || r.status !== "EM_ABERTO") return false;
        return r.period_end == null || r.period_end === "";
      }

      /** Ciclo já encerrado no pátio: period_end OU veículo removido (VRP), mesmo sem period_end em dados antigos. Pagamento ainda não quitado no financeiro. */
      function receivableCicloEncerradoParaFinanceiro(r) {
        if (!r || r.status !== "EM_ABERTO") return false;
        if (r.period_end != null && r.period_end !== "") return true;
        const v = state.vehicles.find((x) => x.id === r.vehicle_id);
        return !!(v && v.status === "REMOVIDO");
      }

      function receivableSemCobrancaFinanceira(r) {
        if (!r || Number(r.valor || 0) > 0) return false;
        if (FINANCE_MANUAL_ONLY) return isManualFinanceLancamento(r);
        if (!r.vehicle_id) return false;
        const { meta } = financeMetaUnpack(r.observacoes);
        if (meta?.sem_cobranca === true) return true;
        return true;
      }

      /**
       * Fila «Aguardando lançamento»: status AGUARDANDO no Supabase OU EM_ABERTO com ciclo encerrado
       * ainda não aprovado para «Contas a receber» (Supabase ou fallback local).
       * Veículos com valor R$ 0,00 na saída não entram (sem cobrança).
       */
      function receivableNaFilaAguardandoTriagem(r) {
        if (FINANCE_MANUAL_ONLY) return false;
        if (!r) return false;
        if (receivableSemCobrancaFinanceira(r)) return false;
        if (receivableAprovadoParaContasReceber(r)) return false;
        if (!receivablePatioLiberadoParaFinanceiro(r)) return false;
        if (r.status === RECEIVABLE_AGUARDANDO_LANCAMENTO) return true;
        if (r.status !== "EM_ABERTO") return false;
        if (!receivableCicloEncerradoParaFinanceiro(r)) return false;
        return true;
      }

      /**
       * Registros exibidos em «Contas a receber» (Receber).
       * Só entra aqui após OK na aba Triagem (`financeiro_aprovado_contas_receber`).
       */
      function receivableIsContaReceberFinanceiro(r) {
        if (!r || r.status === "PAGO") return false;
        if (receivableSemCobrancaFinanceira(r)) return false;
        if (FINANCE_MANUAL_ONLY) {
          return isManualFinanceLancamento(r) && r.status === "EM_ABERTO";
        }
        if (receivableNaFilaAguardandoTriagem(r)) return false;
        if (r.status === RECEIVABLE_AGUARDANDO_LANCAMENTO) return receivableAprovadoParaContasReceber(r);
        if (r.status === "EM_ABERTO" && receivableCicloEncerradoParaFinanceiro(r)) {
          return receivableAprovadoParaContasReceber(r);
        }
        if (receivableAprovadoParaContasReceber(r) && r.status === "EM_ABERTO") return true;
        return false;
      }

      function triagemDefaultNfEmitida(receivable, vehicle) {
        const closure = (state.cycleClosures || []).find(
          (c) => String(c.receivable_id) === String(receivable?.id)
        );
        if (closure?.nf_emitida) return true;
        return vehicle?.nfse_status === "EMITIDA";
      }

      /** Data de entrada reconhecida: somente quando o recebimento é marcado como PAGO. */
      function receivableRevenuePaidYmd(r, cashByContaId) {
        if (!r || r.status !== "PAGO") return null;
        const mov = cashByContaId.get(String(r.id));
        if (mov) {
          const movYmd = toLocalYmd(mov.data_movimento || mov.created_at);
          if (movYmd) return movYmd;
        }
        return toLocalYmd(r.updated_at || r.created_at);
      }

      /** Receita reconhecida apenas em recebimentos confirmados (PAGO). */
      function sumReceivableRevenueByMonth(monthYm, receivables, cashMovements) {
        if (!monthYm || !Array.isArray(receivables)) return 0;
        const cashByContaId = new Map(
          (Array.isArray(cashMovements) ? cashMovements : [])
            .filter((m) => m?.tipo_conta === "RECEBER" && m?.conta_id != null)
            .map((m) => [String(m.conta_id), m])
        );
        return receivables.reduce((sum, r) => {
          if (FINANCE_MANUAL_ONLY && !isManualFinanceLancamento(r)) return sum;
          const paidYmd = receivableRevenuePaidYmd(r, cashByContaId);
          if (!paidYmd || yearMonthFromYmd(paidYmd) !== monthYm) return sum;
          return sum + Number(r.valor || 0);
        }, 0);
      }

      function sumReceivableRevenueByDay(dayYmd, receivables, cashMovements) {
        if (!dayYmd || !Array.isArray(receivables)) return 0;
        const cashByContaId = new Map(
          (Array.isArray(cashMovements) ? cashMovements : [])
            .filter((m) => m?.tipo_conta === "RECEBER" && m?.conta_id != null)
            .map((m) => [String(m.conta_id), m])
        );
        return receivables.reduce((sum, r) => {
          if (FINANCE_MANUAL_ONLY && !isManualFinanceLancamento(r)) return sum;
          return receivableRevenuePaidYmd(r, cashByContaId) === dayYmd ? sum + Number(r.valor || 0) : sum;
        }, 0);
      }

      function formatReceivableStatusLabel(c) {
        if (!c) return "-";
        if (c.status === "PAGO") return Number(c.valor || 0) <= 0 && c.vehicle_id ? "Sem cobrança" : "Pago";
        if (receivableNaFilaFechamentoCicloPatio(c)) return "Fechando ciclo (pátio)";
        if (c.status === RECEIVABLE_AGUARDANDO_LANCAMENTO) return "Aguardando Faturamento";
        if (c.status === "EM_ABERTO" && receivableIsCicloPatioAberto(c)) return "Em curso (pátio)";
        if (c.status === "EM_ABERTO" && receivableCicloEncerradoParaFinanceiro(c) && !receivableAprovadoParaContasReceber(c))
          return "Aguardando Faturamento";
        if (c.status === "EM_ABERTO") return "Em aberto (conta a receber)";
        return c.status || "-";
      }

      const currency = new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      });

      function formatCurrency(value) {
        return currency.format(value || 0);
      }

      /** Formata CNPJ com 14 dígitos para exibição; caso contrário devolve o texto original limpo. */
      function formatCnpjForDisplay(raw) {
        const d = String(raw || "").replace(/\D/g, "");
        if (d.length !== 14) return String(raw || "").trim() || "";
        return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
      }

      function setPlateSearchHints(text, visible) {
        document.querySelectorAll(".plate-search-hint").forEach((el) => {
          el.textContent = text || "";
          el.classList.toggle("hidden", !visible);
        });
      }

      function formatDateTime(value) {
        if (!value) return "-";
        const date = new Date(value);
        const dd = String(date.getDate()).padStart(2, "0");
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        const yy = String(date.getFullYear()).slice(-2);
        const hh = String(date.getHours()).padStart(2, "0");
        const min = String(date.getMinutes()).padStart(2, "0");
        return `${dd}-${mm}-${yy} ${hh}:${min}`;
      }

      /** Data em dd/mm/aaaa (ex.: recibo). */
      function formatDateBr(value) {
        if (!value) return "-";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "-";
        const dd = String(date.getDate()).padStart(2, "0");
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        const yyyy = String(date.getFullYear());
        return `${dd}/${mm}/${yyyy}`;
      }

      function formatDate(value) {
        if (!value) return "-";
        const date = new Date(value);
        const dd = String(date.getDate()).padStart(2, "0");
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        const yy = String(date.getFullYear()).slice(-2);
        return `${dd}-${mm}-${yy}`;
      }

      function boolLabel(v) {
        return v ? "Sim" : "Não";
      }

      function escapeHtml(str) {
        if (str == null) return "";
        return String(str)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
      }

      const VLS_PRINT_STATUSES = ["LIBERACAO_SOLICITADA", "LIBERACAO_CONFIRMADA", "REMocao_CONFIRMADA"];
      const VLS_STATUS_LABELS = {
        LIBERACAO_SOLICITADA: "Liberação solicitada",
        LIBERACAO_CONFIRMADA: "Liberação confirmada",
        REMocao_CONFIRMADA: "Remoção solicitada (legado)",
      };

      function isRemocaoSolicitada(v) {
        if (!v) return false;
        const flag = v.remocao_solicitada;
        // Supabase pode devolver booleano, "t"/"f" ou números (e às vezes strings como "1"/"true")
        if (
          flag === true ||
          flag === 1 ||
          flag === "1" ||
          flag === "t" ||
          flag === "true" ||
          flag === "TRUE"
        )
          return true;
        if (v.status === "REMocao_CONFIRMADA") return true;
        return false;
      }

      async function getVehicleWorkflowActors(vehicleId) {
        const actors = {
          solicitante: "",
          confirmador: "",
          responsavelFinanceiro: "",
          solicitanteRemocao: "",
          removeu: "",
        };
        if (!vehicleId) return actors;

        const { data: events } = await supabase
          .from("vehicle_events")
          .select("tipo,responsavel,created_at")
          .eq("vehicle_id", vehicleId)
          .in("tipo", ["LIBERACAO_SOLICITADA", "LIBERACAO_CONFIRMADA", "REMOCAO_SOLICITADA", "REMOVIDO"])
          .order("created_at", { ascending: false })
          .limit(50);

        const getByType = (type) => events?.find((e) => e.tipo === type)?.responsavel || "";
        actors.solicitante = getByType("LIBERACAO_SOLICITADA");
        actors.confirmador = getByType("LIBERACAO_CONFIRMADA");
        actors.solicitanteRemocao = getByType("REMOCAO_SOLICITADA");
        actors.removeu = getByType("REMOVIDO");

        const { data: rec } = await supabase
          .from("receivables")
          .select("responsavel_pagamento,created_at")
          .eq("user_id", effectiveUserId())
          .eq("vehicle_id", vehicleId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        actors.responsavelFinanceiro = rec?.responsavel_pagamento || "";
        return actors;
      }

      async function clearRemocaoSolicitadaOnVehicle(vehicleId) {
        return supabase
          .from("vehicles")
          .update({
            remocao_solicitada: false,
            remocao_solicitada_por: null,
            remocao_solicitada_em: null,
          })
          .eq("id", vehicleId)
          .eq("user_id", effectiveUserId())
          .select("id");
      }

      function toYmdLocal(value) {
        if (!value) return null;
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return null;
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
      }

      function formatYmdToBr(ymd) {
        if (!ymd || String(ymd).length < 10) return ymd || "";
        const [y, m, d] = String(ymd).split("-");
        return `${d}/${m}/${y}`;
      }

      function inDateRangeInclusive(dateValue, fromStr, toStr) {
        const s = toYmdLocal(dateValue);
        if (!s) return false;
        if (fromStr && s < fromStr) return false;
        if (toStr && s > toStr) return false;
        return true;
      }

      function sortVehiclesByPlaca(list) {
        return [...list].sort((a, b) => {
          const pa = (a.placa || "").toLowerCase();
          const pb = (b.placa || "").toLowerCase();
          return pa.localeCompare(pb, "pt-BR");
        });
      }

      function sortVehiclesByRegistroDesc(list) {
        return [...list].sort((a, b) => {
          const ta = new Date(a.data_entrada || a.created_at || 0).getTime();
          const tb = new Date(b.data_entrada || b.created_at || 0).getTime();
          if (tb !== ta) return tb - ta;
          return String(b.id || "").localeCompare(String(a.id || ""), "pt-BR");
        });
      }

      /** VNP unificado: liberação solicitada e confirmada (e remoção confirmada) no topo; depois no pátio. Dentro de cada grupo, entrada mais recente primeiro. */
      const VNP_UNIFIED_STATUS_ORDER = {
        LIBERACAO_SOLICITADA: 0,
        LIBERACAO_CONFIRMADA: 1,
        REMocao_CONFIRMADA: 2,
        NO_PATIO: 3,
      };

      function sortVnpUnifiedForDisplay(list) {
        return [...list].sort((a, b) => {
          const ra = VNP_UNIFIED_STATUS_ORDER[a.status];
          const rb = VNP_UNIFIED_STATUS_ORDER[b.status];
          const oa = ra === undefined ? 50 : ra;
          const ob = rb === undefined ? 50 : rb;
          if (oa !== ob) return oa - ob;
          const ta = new Date(a.data_entrada || a.created_at || 0).getTime();
          const tb = new Date(b.data_entrada || b.created_at || 0).getTime();
          if (tb !== ta) return tb - ta;
          return String(b.id || "").localeCompare(String(a.id || ""), "pt-BR");
        });
      }

      function patioPrintVehicleLine(v) {
        const vehicleLine = [v.marca, v.modelo].filter(Boolean).join(" ").trim() || "-";
        const placa = v.placa || "-";
        return `${escapeHtml(placa)} — ${escapeHtml(vehicleLine)}`;
      }

      function patioPrintPartnerNames(v) {
        const loc = state.partners.find((p) => p.id === v.localizador_id)?.nome || "-";
        const ass = state.partners.find((p) => p.id === v.assessoria_id)?.nome || "-";
        return { loc, ass };
      }

      function patioPrintObsCell(v) {
        const obsRaw = (v.observacoes || "").trim() || "—";
        return escapeHtml(obsRaw).replace(/\n/g, "<br />");
      }

      const REMOVAL_FLOW_ORDER = [
        "NO_PATIO",
        "LIBERACAO_SOLICITADA",
        "LIBERACAO_CONFIRMADA",
        "REMocao_CONFIRMADA",
        "REMOVIDO",
      ];
      const REMOVAL_FLOW_LABELS = {
        NO_PATIO: "No pátio (VNP)",
        LIBERACAO_SOLICITADA: "Liberação solicitada",
        LIBERACAO_CONFIRMADA: "Liberação confirmada",
        REMocao_CONFIRMADA: "Remoção solicitada (legado)",
        REMOVIDO: "Removido (VRP)",
      };

      const LIBERADOS_PAYMENT_PRINT_STATUSES = [
        "LIBERACAO_SOLICITADA",
        "LIBERACAO_CONFIRMADA",
        "REMocao_CONFIRMADA",
        "REMOVIDO",
      ];

      function mergeVlsItems(byStatus) {
        return [
          ...byStatus.LIBERACAO_SOLICITADA,
          ...byStatus.LIBERACAO_CONFIRMADA,
          ...byStatus.REMocao_CONFIRMADA,
        ];
      }

      function filterVlsToolbarItems(items) {
        if (isGestorPista) return items;
        return items.filter((v) => {
          if (vlsListFilterLocatorId && v.localizador_id !== vlsListFilterLocatorId) return false;
          if (vlsListFilterAssessoriaId && v.assessoria_id !== vlsListFilterAssessoriaId) return false;
          return true;
        });
      }

      function syncVlsFilterSelects() {
        const locSel = document.getElementById("vlsFilterLocator");
        const assSel = document.getElementById("vlsFilterAssessoria");
        if (!locSel || !assSel) return;
        const parceiros = state.partners.filter((p) => isLocalizadorPartnerType(p.tipo || "PARCEIRO"));
        const assessorias = state.partners.filter((p) => p.tipo === "ASSESSORIA");
        const opt = (id, label) => {
          const vid = String(id).replace(/"/g, "&quot;");
          return `<option value="${vid}">${escapeHtml(label)}</option>`;
        };
        locSel.innerHTML =
          `<option value="">Todos os RPVs</option>` +
          parceiros.map((p) => opt(p.id, p.nome || "-")).join("");
        assSel.innerHTML =
          `<option value="">Todas as assessorias</option>` +
          assessorias.map((p) => opt(p.id, p.nome || "-")).join("");
        if (parceiros.some((p) => p.id === vlsListFilterLocatorId)) locSel.value = vlsListFilterLocatorId;
        else {
          locSel.value = "";
          vlsListFilterLocatorId = "";
        }
        if (assessorias.some((p) => p.id === vlsListFilterAssessoriaId)) assSel.value = vlsListFilterAssessoriaId;
        else {
          assSel.value = "";
          vlsListFilterAssessoriaId = "";
        }
      }

      function readListaFiltersFromDom() {
        listaFilterLocatorId = document.getElementById("listaFilterLocator")?.value || "";
        listaFilterAssessoriaId = document.getElementById("listaFilterAssessoria")?.value || "";
        listaFilterRpfId = document.getElementById("listaFilterRpf")?.value || "";
        listaFilterBanco = (document.getElementById("listaFilterBanco")?.value || "").trim();
      }

      /** RPF efetivo no veículo: responsável financeiro / pagamento; se vazio, usa o RPV (mesma lista de parceiros). */
      function listaVehicleEffectiveRpfPartnerId(v) {
        if (!v) return "";
        return String(v.responsavel_financeiro_id || v.localizador_id || "").trim();
      }

      /** Nome do RPF para tabelas (parceiro ou nome gravado no veículo). */
      function vehicleRpfNome(v) {
        if (!v) return "—";
        const pid = listaVehicleEffectiveRpfPartnerId(v);
        if (!pid) return "—";
        const nome = state.partners.find((p) => p.id === pid)?.nome || v.responsavel_financeiro_nome || "";
        return (nome || "").trim() || "—";
      }

      /** Identificação visual VNP (no pátio / fluxo) vs VRP (removido). */
      function patioRegistoBadgeHtml(kind) {
        const isVrp = kind === "vrp";
        const label = isVrp ? "VRP" : "VNP";
        const cls = isVrp ? "tag success" : "tag warning";
        const title = isVrp ? "Veículo removido (VRP)" : "No pátio ou em fluxo de liberação (VNP)";
        return `<span class="${cls}" style="margin-right:6px;vertical-align:middle;white-space:nowrap" title="${title}">${label}</span>`;
      }

      function syncListaFilterSelects() {
        const locSel = document.getElementById("listaFilterLocator");
        const assSel = document.getElementById("listaFilterAssessoria");
        const rpfSel = document.getElementById("listaFilterRpf");
        if (!locSel || !assSel || !rpfSel) return;
        const parceiros = state.partners.filter((p) => isLocalizadorPartnerType(p.tipo || "PARCEIRO"));
        const parceirosRpf = state.partners.filter((p) => isRpfPartnerType(p.tipo || "PARCEIRO"));
        const assessorias = state.partners.filter((p) => p.tipo === "ASSESSORIA");
        const opt = (id, label) => {
          const vid = String(id).replace(/"/g, "&quot;");
          return `<option value="${vid}">${escapeHtml(label)}</option>`;
        };
        locSel.innerHTML =
          `<option value="">Todos os RPVs</option>` +
          parceiros.map((p) => opt(p.id, p.nome || "-")).join("");
        assSel.innerHTML =
          `<option value="">Todas as assessorias</option>` +
          assessorias.map((p) => opt(p.id, p.nome || "-")).join("");
        rpfSel.innerHTML =
          `<option value="">Todos os RPF</option>` +
          parceirosRpf.map((p) => opt(p.id, p.nome || "-")).join("");
        if (parceiros.some((p) => p.id === listaFilterLocatorId)) locSel.value = listaFilterLocatorId;
        else {
          locSel.value = "";
          listaFilterLocatorId = "";
        }
        if (assessorias.some((p) => p.id === listaFilterAssessoriaId)) assSel.value = listaFilterAssessoriaId;
        else {
          assSel.value = "";
          listaFilterAssessoriaId = "";
        }
        if (parceirosRpf.some((p) => p.id === listaFilterRpfId)) rpfSel.value = listaFilterRpfId;
        else {
          rpfSel.value = "";
          listaFilterRpfId = "";
        }
      }

      function maybeRefreshListaPanel() {
        const el = document.getElementById("viewLista");
        if (el && !el.classList.contains("hidden")) renderListaPanel();
      }

      function listaTextoBancoMatch(...parts) {
        const q = (listaFilterBanco || "").trim().toLowerCase();
        if (!q) return true;
        const blob = parts
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return blob.includes(q);
      }

      function listaVehicleMatches(v) {
        if (!v) return false;
        if (listaFilterLocatorId && v.localizador_id !== listaFilterLocatorId) return false;
        if (listaFilterAssessoriaId && v.assessoria_id !== listaFilterAssessoriaId) return false;
        if (listaFilterRpfId && listaVehicleEffectiveRpfPartnerId(v) !== String(listaFilterRpfId)) return false;
        return listaTextoBancoMatch(v.observacoes, v.placa, state.settings?.conta_bancaria);
      }

      function listaReceivableMatches(r, vehicle) {
        if (listaFilterLocatorId && (vehicle?.localizador_id || "") !== listaFilterLocatorId) return false;
        if (listaFilterAssessoriaId && (vehicle?.assessoria_id || "") !== listaFilterAssessoriaId) return false;
        if (listaFilterRpfId && listaVehicleEffectiveRpfPartnerId(vehicle) !== String(listaFilterRpfId)) return false;
        return listaTextoBancoMatch(
          r.responsavel_pagamento,
          r.receivable_category,
          vehicle?.observacoes,
          vehicle?.placa,
          state.settings?.conta_bancaria
        );
      }

      function listaPayableMatches(p) {
        const locName = listaFilterLocatorId
          ? state.partners.find((x) => x.id === listaFilterLocatorId)?.nome || ""
          : "";
        const assName = listaFilterAssessoriaId
          ? state.partners.find((x) => x.id === listaFilterAssessoriaId)?.nome || ""
          : "";
        const rpfName = listaFilterRpfId ? state.partners.find((x) => x.id === listaFilterRpfId)?.nome || "" : "";
        const desc = (p.descricao || "").toLowerCase();
        if (listaFilterLocatorId && locName && !desc.includes(String(locName).toLowerCase())) return false;
        if (listaFilterAssessoriaId && assName && !desc.includes(String(assName).toLowerCase())) return false;
        if (listaFilterRpfId && rpfName && !desc.includes(String(rpfName).toLowerCase())) return false;
        if (listaFilterRpfId && !rpfName) return false;
        return listaTextoBancoMatch(p.descricao, p.payable_category, state.settings?.conta_bancaria);
      }

      function listaCashMatches(mov) {
        const rec =
          mov.tipo_conta === "RECEBER" && mov.conta_id != null && mov.conta_id !== ""
            ? state.receivables.find((r) => String(r.id) === String(mov.conta_id))
            : null;
        const pay =
          mov.tipo_conta === "PAGAR" && mov.conta_id != null && mov.conta_id !== ""
            ? state.payables.find((p) => String(p.id) === String(mov.conta_id))
            : null;
        const v = rec ? state.vehicles.find((x) => x.id === rec.vehicle_id) : null;
        if (rec && !listaReceivableMatches(rec, v)) return false;
        if (pay && !listaPayableMatches(pay)) return false;
        if (!rec && !pay) {
          if (listaFilterLocatorId || listaFilterAssessoriaId || listaFilterRpfId) return false;
          return listaTextoBancoMatch(mov.descricao, state.settings?.conta_bancaria);
        }
        return listaTextoBancoMatch(mov.descricao);
      }

      function syncListaSubnavActive() {
        document.querySelectorAll("#listaSubnav button[data-lista-subview]").forEach((btn) => {
          btn.classList.toggle("active", btn.getAttribute("data-lista-subview") === currentListaView);
        });
        updateListaReceberPrintUi();
      }

      function updateListaReceberPrintUi() {
        const isReceberView = currentListaView === "receber" || currentListaView === "receber_alerta";
        document.getElementById("listaFiltersPrintReceber")?.classList.toggle("hidden", !isReceberView);
        document.getElementById("listaFiltersPrint")?.classList.toggle("hidden", isReceberView);
      }

      function collectListaReceberFilteredList({
        alertaOnly = false,
        filterLocId = "",
        filterAssId = "",
        filterRpfId = "",
      } = {}) {
        const vehicleById = new Map((state.vehicles || []).map((v) => [v.id, v]));
        let list = (state.receivables || [])
          .filter((r) => receivableIsContaReceberFinanceiro(r))
          .filter((r) => listaReceivableMatches(r, vehicleById.get(r.vehicle_id)));
        if (filterLocId) {
          list = list.filter((r) => {
            const v = vehicleById.get(r.vehicle_id);
            return (v?.localizador_id || "") === filterLocId;
          });
        }
        if (filterAssId) {
          list = list.filter((r) => {
            const v = vehicleById.get(r.vehicle_id);
            return (v?.assessoria_id || "") === filterAssId;
          });
        }
        if (filterRpfId) {
          list = list.filter((r) => {
            const v = vehicleById.get(r.vehicle_id);
            return listaVehicleEffectiveRpfPartnerId(v) === String(filterRpfId);
          });
        }
        if (alertaOnly) {
          const now = Date.now();
          list = list.filter((r) => {
            if (!r.created_at) return false;
            return Math.floor((now - new Date(r.created_at).getTime()) / 86400000) > 10;
          });
        }
        return { list, vehicleById };
      }

      const OPEN_RECEIVABLES_GROUPED_PRINT_CSS = `
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; margin: 20px; color: #111; }
  h1 { font-size: 1.25rem; margin: 0 0 4px; }
  h2 { font-size: 1.08rem; margin: 22px 0 8px; page-break-after: avoid; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  h3 { font-size: 0.95rem; margin: 14px 0 6px; page-break-after: avoid; }
  h3 .count { font-weight: normal; color: #555; }
  .meta { font-size: 0.8rem; color: #444; margin-bottom: 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 0.76rem; margin-bottom: 14px; }
  th, td { border: 1px solid #bbb; padding: 6px; text-align: left; vertical-align: top; color: #111; }
  th { background: #f0f0f0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @page { margin: 12mm; }
  @media print { body { margin: 0; } }`;

      function buildOpenReceivablesGroupedPrintHtml({
        openRec,
        vehicleById,
        byLoc,
        byResp,
        byAss,
        docTitle,
        headingTitle,
        metaLine,
      }) {
        const partnerByIdMap = new Map((state.partners || []).map((p) => [p.id, p.nome || "-"]));
        const partnerTitle = (k) =>
          k === "__sem__" ? "Não informado" : partnerByIdMap.get(k) || "Parceiro não encontrado";
        const receivableValor = (r) => Number(r.valor || 0);
        const nowMs = Date.now();
        const diasAberto = (r) => {
          if (!r.created_at) return "—";
          return String(Math.floor((nowMs - new Date(r.created_at).getTime()) / 86400000));
        };
        const veiculoCell = (v) =>
          v
            ? `${escapeHtml(v.placa || "-")} — ${escapeHtml([v.marca, v.modelo].filter(Boolean).join(" ") || "-")}`
            : escapeHtml("Veículo não encontrado");
        const locNome = (v) => (v?.localizador_id ? partnerByIdMap.get(v.localizador_id) || "-" : "-");
        const assNome = (v) => (v?.assessoria_id ? partnerByIdMap.get(v.assessoria_id) || "-" : "-");
        const diariasPatioCell = (v) => {
          if (!v?.data_entrada) return "—";
          return String(calcDays(v));
        };
        const theadLoc =
          "<th>Veículo</th><th>RPF</th><th>Assessoria</th><th>Entrada (pátio)</th><th>Saída</th><th>Valor</th><th>Diárias no pátio</th><th>Dias em aberto</th>";
        const theadResp =
          "<th>Veículo</th><th>RPV</th><th>Assessoria</th><th>Entrada (pátio)</th><th>Saída</th><th>Valor</th><th>Diárias no pátio</th><th>Dias em aberto</th>";
        const theadAss =
          "<th>Veículo</th><th>RPF</th><th>RPV</th><th>Entrada (pátio)</th><th>Saída</th><th>Valor</th><th>Diárias no pátio</th><th>Dias em aberto</th>";
        const rowLoc = (r) => {
          const v = vehicleById.get(r.vehicle_id);
          return `<tr>
            <td>${veiculoCell(v)}</td>
            <td>${escapeHtml(r.responsavel_pagamento || "—")}</td>
            <td>${escapeHtml(assNome(v))}</td>
            <td>${escapeHtml(formatReceberEntradaVeiculo(v, r))}</td>
            <td>${escapeHtml(formatReceberSaidaVeiculo(v, r))}</td>
            <td>${escapeHtml(formatCurrency(receivableValor(r)))}</td>
            <td>${escapeHtml(diariasPatioCell(v))}</td>
            <td>${escapeHtml(diasAberto(r))}</td>
          </tr>`;
        };
        const rowResp = (r) => {
          const v = vehicleById.get(r.vehicle_id);
          return `<tr>
            <td>${veiculoCell(v)}</td>
            <td>${escapeHtml(locNome(v))}</td>
            <td>${escapeHtml(assNome(v))}</td>
            <td>${escapeHtml(formatReceberEntradaVeiculo(v, r))}</td>
            <td>${escapeHtml(formatReceberSaidaVeiculo(v, r))}</td>
            <td>${escapeHtml(formatCurrency(receivableValor(r)))}</td>
            <td>${escapeHtml(diariasPatioCell(v))}</td>
            <td>${escapeHtml(diasAberto(r))}</td>
          </tr>`;
        };
        const rowAss = (r) => {
          const v = vehicleById.get(r.vehicle_id);
          return `<tr>
            <td>${veiculoCell(v)}</td>
            <td>${escapeHtml(r.responsavel_pagamento || "—")}</td>
            <td>${escapeHtml(locNome(v))}</td>
            <td>${escapeHtml(formatReceberEntradaVeiculo(v, r))}</td>
            <td>${escapeHtml(formatReceberSaidaVeiculo(v, r))}</td>
            <td>${escapeHtml(formatCurrency(receivableValor(r)))}</td>
            <td>${escapeHtml(diariasPatioCell(v))}</td>
            <td>${escapeHtml(diasAberto(r))}</td>
          </tr>`;
        };
        const subtotal = (recs) => formatCurrency(recs.reduce((s, r) => s + receivableValor(r), 0));
        const blocks = [];
        if (byLoc) {
          blocks.push(`<h2>Por RPV (empresa de remoção)</h2>`);
          const map = bucketOpenReceivablesByKey(openRec, (r) => {
            const v = vehicleById.get(r.vehicle_id);
            return v?.localizador_id || "__sem__";
          });
          const keys = sortPartnerBucketKeys([...map.keys()], partnerByIdMap);
          keys.forEach((key) => {
            const items = sortOpenReceivablesByPlaca(map.get(key) || [], vehicleById);
            const st = subtotal(items);
            blocks.push(
              `<h3>${escapeHtml(partnerTitle(key))} <span class="count">(${items.length} · ${escapeHtml(st)})</span></h3>`
            );
            blocks.push(
              `<table><thead><tr>${theadLoc}</tr></thead><tbody>${items.map(rowLoc).join("")}</tbody></table>`
            );
          });
        }
        if (byResp) {
          blocks.push(`<h2>Por RPF (responsável financeiro)</h2>`);
          const map = bucketOpenReceivablesByKey(openRec, (r) => (r.responsavel_pagamento || "").trim() || "__sem__");
          const keys = sortTextBucketKeys([...map.keys()]);
          keys.forEach((key) => {
            const items = sortOpenReceivablesByPlaca(map.get(key) || [], vehicleById);
            const st = subtotal(items);
            const title = key === "__sem__" ? "Responsável não informado" : key;
            blocks.push(
              `<h3>${escapeHtml(title)} <span class="count">(${items.length} · ${escapeHtml(st)})</span></h3>`
            );
            blocks.push(
              `<table><thead><tr>${theadResp}</tr></thead><tbody>${items.map(rowResp).join("")}</tbody></table>`
            );
          });
        }
        if (byAss) {
          blocks.push(`<h2>Por assessoria</h2>`);
          const map = bucketOpenReceivablesByKey(openRec, (r) => {
            const v = vehicleById.get(r.vehicle_id);
            return v?.assessoria_id || "__sem__";
          });
          const keys = sortPartnerBucketKeys([...map.keys()], partnerByIdMap);
          keys.forEach((key) => {
            const items = sortOpenReceivablesByPlaca(map.get(key) || [], vehicleById);
            const st = subtotal(items);
            blocks.push(
              `<h3>${escapeHtml(partnerTitle(key))} <span class="count">(${items.length} · ${escapeHtml(st)})</span></h3>`
            );
            blocks.push(
              `<table><thead><tr>${theadAss}</tr></thead><tbody>${items.map(rowAss).join("")}</tbody></table>`
            );
          });
        }
        return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8" /><title>${escapeHtml(
          docTitle
        )}</title><style>${OPEN_RECEIVABLES_GROUPED_PRINT_CSS}</style></head><body>
  <h1>${escapeHtml(headingTitle)}</h1>
  <div class="meta">${escapeHtml(metaLine)}</div>
  ${blocks.join("")}
</body></html>`;
      }

      function syncListaReceberPrintFilterOptions() {
        const locSel = document.getElementById("listaPrintFilterLocator");
        const assSel = document.getElementById("listaPrintFilterAssessoria");
        const rpfSel = document.getElementById("listaPrintFilterRpf");
        if (!locSel || !assSel || !rpfSel) return;
        const preserveLoc = locSel.value;
        const preserveAss = assSel.value;
        const preserveRpf = rpfSel.value;
        const parceiros = (state.partners || []).filter((p) => isLocalizadorPartnerType(p.tipo || "PARCEIRO"));
        const parceirosRpf = (state.partners || []).filter((p) => isRpfPartnerType(p.tipo || "PARCEIRO"));
        const assessorias = (state.partners || []).filter((p) => p.tipo === "ASSESSORIA");
        const optId = (id, label) => {
          const v = String(id).replace(/"/g, "&quot;");
          return `<option value="${v}">${escapeHtml(label)}</option>`;
        };
        locSel.innerHTML = `<option value="">Todos os RPVs</option>` + parceiros.map((p) => optId(p.id, p.nome || "-")).join("");
        assSel.innerHTML =
          `<option value="">Todas as assessorias</option>` + assessorias.map((p) => optId(p.id, p.nome || "-")).join("");
        rpfSel.innerHTML = `<option value="">Todos os RPF</option>` + parceirosRpf.map((p) => optId(p.id, p.nome || "-")).join("");
        if (parceiros.some((p) => p.id === preserveLoc)) locSel.value = preserveLoc;
        else locSel.value = "";
        if (assessorias.some((p) => p.id === preserveAss)) assSel.value = preserveAss;
        else assSel.value = "";
        if (parceirosRpf.some((p) => p.id === preserveRpf)) rpfSel.value = preserveRpf;
        else rpfSel.value = "";
      }

      function openListaReceberPrintModal() {
        readListaFiltersFromDom();
        syncListaReceberPrintFilterOptions();
        const locSel = document.getElementById("listaPrintFilterLocator");
        const assSel = document.getElementById("listaPrintFilterAssessoria");
        const rpfSel = document.getElementById("listaPrintFilterRpf");
        if (locSel && listaFilterLocatorId) locSel.value = listaFilterLocatorId;
        if (assSel && listaFilterAssessoriaId) assSel.value = listaFilterAssessoriaId;
        if (rpfSel && listaFilterRpfId) rpfSel.value = listaFilterRpfId;
        document.getElementById("listaReceberPrintModal")?.classList.remove("hidden");
      }

      function runListaReceberGroupedPrint() {
        readListaFiltersFromDom();
        const byLoc = document.getElementById("listaPrintOpenByLocator")?.checked;
        const byResp = document.getElementById("listaPrintOpenByResp")?.checked;
        const byAss = document.getElementById("listaPrintOpenByAssessoria")?.checked;
        if (!byLoc && !byResp && !byAss) {
          alert("Marque pelo menos um agrupamento.");
          return;
        }
        const filterLocId = document.getElementById("listaPrintFilterLocator")?.value || "";
        const filterAssId = document.getElementById("listaPrintFilterAssessoria")?.value || "";
        const filterRpfId = document.getElementById("listaPrintFilterRpf")?.value || "";
        const alertaOnly = currentListaView === "receber_alerta";
        const { list: openRec, vehicleById } = collectListaReceberFilteredList({
          alertaOnly,
          filterLocId,
          filterAssId,
          filterRpfId,
        });
        if (!openRec.length) {
          alert(
            filterLocId || filterAssId || filterRpfId || listaFilterBanco
              ? "Nenhuma conta em aberto com os filtros escolhidos."
              : alertaOnly
                ? "Não há títulos em alerta (+10 dias) para imprimir."
                : "Não há títulos em aberto para receber."
          );
          return;
        }
        const partnerByIdMap = new Map((state.partners || []).map((p) => [p.id, p.nome || "-"]));
        const receivableValor = (r) => Number(r.valor || 0);
        const totalGeral = openRec.reduce((s, r) => s + receivableValor(r), 0);
        const nowStr = formatDateTime(new Date().toISOString());
        const viewLabel =
          document.querySelector(`#listaSubnav button[data-lista-subview="${currentListaView}"]`)?.textContent?.trim() ||
          "Receber";
        const nomePatio = state.settings?.nome_patio || "Pátio";
        const metaParts = [
          `Lista · ${viewLabel}`,
          `${openRec.length} conta(s)`,
          `Total: ${formatCurrency(totalGeral)}`,
          `Emitido em: ${nowStr}`,
        ];
        const filtroIndiv = [];
        if (filterLocId) filtroIndiv.push(`Somente RPV: ${partnerByIdMap.get(filterLocId) || "-"}`);
        if (filterAssId) filtroIndiv.push(`Somente assessoria: ${partnerByIdMap.get(filterAssId) || "-"}`);
        if (filterRpfId) filtroIndiv.push(`Somente RPF: ${partnerByIdMap.get(filterRpfId) || "-"}`);
        if (listaFilterBanco) filtroIndiv.push(`Texto: ${listaFilterBanco}`);
        if (filtroIndiv.length) metaParts.unshift(filtroIndiv.join(" · "));
        const html = buildOpenReceivablesGroupedPrintHtml({
          openRec,
          vehicleById,
          byLoc,
          byResp,
          byAss,
          docTitle: `Lista ${viewLabel}`,
          headingTitle: `${nomePatio} — Lista · ${viewLabel}`,
          metaLine: metaParts.join(" · "),
        });
        printHtmlInHiddenIframe(html, {
          iframeTitle: "Impressão lista receber",
          closeModalId: "listaReceberPrintModal",
        });
      }

      function buildListaVnpVehicleRows() {
        const vehicles = (state.vehicles || []).filter(listaVehicleMatches);
        const byStatus = {
          NO_PATIO: [],
          LIBERACAO_SOLICITADA: [],
          LIBERACAO_CONFIRMADA: [],
          REMocao_CONFIRMADA: [],
          REMOVIDO: [],
        };
        vehicles.forEach((v) => {
          if (byStatus[v.status]) byStatus[v.status].push(v);
        });
        const vlsMerged = mergeVlsItems(byStatus);
        const vnpUnified = sortVnpUnifiedForDisplay([...vlsMerged, ...byStatus.NO_PATIO]);
        return vnpUnified;
      }

      function listaReceberDiasNoCiclo(r, vehicle) {
        const startStr = r.period_start || vehicle?.data_entrada || r.created_at;
        const endStr = r.period_end || vehicle?.data_saida;
        if (!startStr) return null;
        const start = new Date(startStr);
        const end = endStr ? new Date(endStr) : new Date();
        const diffMs = end - start;
        return Math.max(1, Math.ceil(diffMs / 86400000));
      }

      function listaReceberDiariasCellHtml(r, vehicle) {
        const days = listaReceberDiasNoCiclo(r, vehicle);
        const vd = Number(vehicle?.valor_diaria || 0);
        if (days == null) return `<span class="lista-receber-diarias">—</span>`;
        if (vd > 0) {
          return `<span class="lista-receber-diarias"><span class="lista-receber-dias">${escapeHtml(String(days))} diária(s)</span> × ${escapeHtml(formatCurrency(vd))}</span>`;
        }
        return `<span class="lista-receber-diarias"><span class="lista-receber-dias">${escapeHtml(String(days))} diária(s)</span> <span style="opacity: 0.75">(sem valor diário no veículo)</span></span>`;
      }

      function computeListaGrandTotalForCurrentView() {
        readListaFiltersFromDom();
        const vehicleById = new Map((state.vehicles || []).map((v) => [v.id, v]));
        const semVal = isGestorPista;

        if (currentListaView === "vnp") {
          const items = buildListaVnpVehicleRows();
          const label = "Total estimado";
          if (semVal) return { amount: 0, label, hideAmount: true };
          return {
            amount: items.reduce((s, v) => s + Number(calcTotal(v) || 0), 0),
            label,
            hideAmount: false,
          };
        }
        if (currentListaView === "vrp") {
          const items = sortVehiclesByRegistroDesc(
            (state.vehicles || []).filter((v) => v.status === "REMOVIDO" && listaVehicleMatches(v))
          );
          const label = "Total (VRP)";
          if (semVal) return { amount: 0, label, hideAmount: true };
          return {
            amount: items.reduce((s, v) => s + Number(calcTotal(v) || 0), 0),
            label,
            hideAmount: false,
          };
        }
        if (currentListaView === "aguardando_lancamento") {
          const rows = (state.receivables || [])
            .filter((r) => receivableNaFilaAguardandoTriagem(r))
            .filter((r) => listaReceivableMatches(r, vehicleById.get(r.vehicle_id)));
          const label = "Total";
          const amount = rows.reduce((s, r) => s + Number(r.valor || 0), 0);
          return { amount, label, hideAmount: false };
        }
        if (currentListaView === "receber" || currentListaView === "receber_alerta") {
          const openList = (state.receivables || []).filter((r) => receivableIsContaReceberFinanceiro(r));
          const overdueReceivables = openList.filter((r) => {
            if (!r.created_at) return false;
            const created = new Date(r.created_at).getTime();
            const days = Math.floor((Date.now() - created) / 86400000);
            return days > 10;
          });
          let list = openList.filter((r) => listaReceivableMatches(r, vehicleById.get(r.vehicle_id)));
          if (currentListaView === "receber_alerta") {
            list = list.filter((r) => overdueReceivables.some((o) => o.id === r.id));
          }
          const label = currentListaView === "receber_alerta" ? "Total (títulos em alerta)" : "Total em receber";
          const amount = list.reduce((s, r) => s + Number(r.valor || 0), 0);
          return { amount, label, hideAmount: false };
        }
        if (currentListaView === "pagar") {
          const list = (state.payables || []).filter((p) => p.status === "EM_ABERTO" && listaPayableMatches(p));
          const label = "Total contas a pagar";
          const amount = list.reduce((s, p) => s + Number(p.valor || 0), 0);
          return { amount, label, hideAmount: false };
        }
        if (currentListaView === "caixa") {
          const list = (state.cash || []).filter(listaCashMatches);
          const label = "Soma dos valores (movimentos filtrados)";
          const amount = list.reduce((s, mov) => s + Number(mov.valor || 0), 0);
          return { amount, label, hideAmount: false };
        }
        return { amount: 0, label: "Total", hideAmount: false };
      }

      function updateListaCaptureSummary() {
        const hEl = document.getElementById("listaCaptureHeading");
        const tEl = document.getElementById("listaCaptureTotal");
        if (!hEl || !tEl) return;
        const nomePatio = state.settings?.nome_patio || "Pátio";
        const viewLabel =
          document.querySelector(`#listaSubnav button[data-lista-subview="${currentListaView}"]`)?.textContent?.trim() ||
          currentListaView;
        const filtros = [
          listaFilterLocatorId ? `Loc.: ${state.partners.find((p) => p.id === listaFilterLocatorId)?.nome || ""}` : "",
          listaFilterAssessoriaId
            ? `Assessoria: ${state.partners.find((p) => p.id === listaFilterAssessoriaId)?.nome || ""}`
            : "",
          listaFilterRpfId ? `RPF: ${state.partners.find((p) => p.id === listaFilterRpfId)?.nome || ""}` : "",
          listaFilterBanco ? `Texto: ${listaFilterBanco}` : "",
        ]
          .filter(Boolean)
          .join(" · ");
        hEl.innerHTML = `<strong>${escapeHtml(nomePatio)}</strong> — Lista · ${escapeHtml(viewLabel)}<br /><span style="font-size:0.85rem;color:#444">${escapeHtml(
          filtros || "Sem filtros de parceiro/texto"
        )}</span><br /><span style="font-size:0.78rem;color:#666">${escapeHtml(formatDateTime(new Date().toISOString()))}</span>`;
        const g = computeListaGrandTotalForCurrentView();
        if (g.hideAmount) {
          tEl.textContent = "Valor total: não disponível neste perfil.";
        } else {
          tEl.textContent = `${g.label}: ${formatCurrency(g.amount)}`;
        }
      }

      function renderListaPanel(opts = {}) {
        readListaFiltersFromDom();
        const listaPrintVnpSemValores = opts.listaPrintVnpSemValores === true;
        const head = document.getElementById("listaTableHead");
        const body = document.getElementById("listaTableBody");
        if (!head || !body) return;
        syncListaSubnavActive();
        const vehicleById = new Map((state.vehicles || []).map((v) => [v.id, v]));
        const semVal = isGestorPista;
        const locLabel = (id) => state.partners.find((p) => p.id === id)?.nome || "-";
        const captureRoot = document.getElementById("listaCaptureRoot");
        if (captureRoot) {
          captureRoot.classList.toggle(
            "lista-root--receber",
            currentListaView === "receber" || currentListaView === "receber_alerta"
          );
        }

        try {
        if (currentListaView === "vnp") {
          const ocultarValorColuna = semVal || listaPrintVnpSemValores;
          head.innerHTML = `<tr><th>Placa</th><th>Registo</th><th>Veículo</th><th>RPV</th><th>Assessoria</th><th>RPF</th><th>Entrada</th><th>Situação</th>${
            ocultarValorColuna ? "" : "<th>Valor estimado</th>"
          }</tr>`;
          const items = buildListaVnpVehicleRows();
          if (!items.length) {
            body.innerHTML = `<tr><td colspan="${ocultarValorColuna ? "8" : "9"}" class="notice">Nenhum registo com os filtros atuais.</td></tr>`;
            return;
          }
          body.innerHTML = items
            .map((v) => {
              const sit =
                v.status === "NO_PATIO"
                  ? isRemocaoSolicitada(v)
                    ? "No pátio · remoção solicitada"
                    : "No pátio"
                  : VLS_STATUS_LABELS[v.status] || v.status || "-";
              const val = ocultarValorColuna ? "" : `<td data-label="Valor">${escapeHtml(formatCurrency(calcTotal(v)))}</td>`;
              return `<tr>
                <td data-label="Placa">${escapeHtml(v.placa || "-")}</td>
                <td data-label="Registo">${patioRegistoBadgeHtml("vnp")}</td>
                <td data-label="Veículo">${escapeHtml([v.marca, v.modelo].filter(Boolean).join(" ") || "-")}</td>
                <td data-label="RPV">${escapeHtml(locLabel(v.localizador_id))}</td>
                <td data-label="Assessoria">${escapeHtml(locLabel(v.assessoria_id))}</td>
                <td data-label="RPF">${escapeHtml(vehicleRpfNome(v))}</td>
                <td data-label="Entrada">${escapeHtml(formatDateTime(v.data_entrada))}</td>
                <td data-label="Situação">${escapeHtml(sit)}</td>
                ${val}
              </tr>`;
            })
            .join("");
          return;
        }

        if (currentListaView === "vrp") {
          head.innerHTML = `<tr><th>Placa</th><th>Registo</th><th>Veículo</th><th>RPV</th><th>Assessoria</th><th>RPF</th><th>Entrada</th><th>Saída</th>${
            semVal ? "" : "<th>Valor</th>"
          }</tr>`;
          const items = sortVehiclesByRegistroDesc(
            (state.vehicles || []).filter((v) => v.status === "REMOVIDO" && listaVehicleMatches(v))
          );
          if (!items.length) {
            body.innerHTML = `<tr><td colspan="9" class="notice">Nenhum registo com os filtros atuais.</td></tr>`;
            return;
          }
          body.innerHTML = items
            .map((v) => {
              const val = semVal ? "" : `<td data-label="Valor">${escapeHtml(formatCurrency(calcTotal(v)))}</td>`;
              return `<tr>
                <td data-label="Placa">${escapeHtml(v.placa || "-")}</td>
                <td data-label="Registo">${patioRegistoBadgeHtml("vrp")}</td>
                <td data-label="Veículo">${escapeHtml([v.marca, v.modelo].filter(Boolean).join(" ") || "-")}</td>
                <td data-label="RPV">${escapeHtml(locLabel(v.localizador_id))}</td>
                <td data-label="Assessoria">${escapeHtml(locLabel(v.assessoria_id))}</td>
                <td data-label="RPF">${escapeHtml(vehicleRpfNome(v))}</td>
                <td data-label="Entrada">${escapeHtml(formatDateTime(v.data_entrada))}</td>
                <td data-label="Saída">${escapeHtml(formatDateTime(v.data_saida))}</td>
                ${val}
              </tr>`;
            })
            .join("");
          return;
        }

        if (currentListaView === "aguardando_lancamento") {
          head.innerHTML = `<tr><th>Resumo</th><th>Valor</th><th>Estado</th></tr>`;
          const rows = [];
          state.receivables
            .filter((r) => receivableNaFilaAguardandoTriagem(r))
            .filter((r) => listaReceivableMatches(r, vehicleById.get(r.vehicle_id)))
            .forEach((r) => {
              const vehicle = vehicleById.get(r.vehicle_id);
              const vehicleInfo = vehicle
                ? `${vehicle.placa || "-"} • ${[vehicle.marca, vehicle.modelo].filter(Boolean).join(" ")}`
                : "Veículo não encontrado";
              const ini = r.period_start ? formatDate(r.period_start) : "-";
              const fim = r.period_end
                ? formatDate(r.period_end)
                : vehicle?.data_saida
                  ? formatDate(vehicle.data_saida)
                  : "-";
              rows.push(`<tr>
                <td data-label="Resumo">${escapeHtml(r.responsavel_pagamento || "—")}<br /><span class="notice">${escapeHtml(
                  vehicleInfo
                )}</span><br />${escapeHtml(ini)} → ${escapeHtml(fim)}</td>
                <td data-label="Valor">${escapeHtml(formatCurrency(Number(r.valor || 0)))}</td>
                <td data-label="Estado"><span class="tag warning">Aguardando triagem</span></td>
              </tr>`);
            });
          body.innerHTML = rows.length
            ? rows.join("")
            : `<tr><td colspan="3" class="notice">Nenhum registo com os filtros atuais.</td></tr>`;
          return;
        }

        if (currentListaView === "receber" || currentListaView === "receber_alerta") {
          head.innerHTML = `<tr><th>Veículo / responsável</th><th>Entrada (pátio)</th><th>Saída</th><th>Diárias</th><th>Valor</th><th>Estado</th></tr>`;
          const openList = (state.receivables || []).filter((r) => receivableIsContaReceberFinanceiro(r));
          const overdueReceivables = openList.filter((r) => {
            if (!r.created_at) return false;
            const created = new Date(r.created_at).getTime();
            const days = Math.floor((Date.now() - created) / 86400000);
            return days > 10;
          });
          let list = openList.filter((r) => listaReceivableMatches(r, vehicleById.get(r.vehicle_id)));
          if (currentListaView === "receber_alerta") {
            list = list.filter((r) => overdueReceivables.some((o) => o.id === r.id));
          }
          const totalReceber = list.reduce((s, r) => s + Number(r.valor || 0), 0);
          const footReceber = `<tr class="lista-tabela-total">
              <td data-label="Veículo / responsável" colspan="4" style="text-align: right; font-weight: 700">Total (soma dos valores da lista)</td>
              <td data-label="Valor" class="lista-receber-valor">${escapeHtml(formatCurrency(totalReceber))}</td>
              <td data-label="Estado"></td>
            </tr>`;
          if (!list.length) {
            body.innerHTML = `<tr><td colspan="6" class="notice">Nenhum registo com os filtros atuais.</td></tr>${footReceber}`;
            return;
          }
          const rowsHtml = list
            .map((r) => {
              const vehicle = vehicleById.get(r.vehicle_id);
              const vm = [vehicle?.marca, vehicle?.modelo].filter(Boolean).join(" ") || "—";
              const placa = vehicle?.placa || "—";
              const entRaw = vehicle?.data_entrada || r.period_start || r.created_at;
              const saiRaw = vehicle?.data_saida || r.period_end;
              const entLabel = entRaw ? formatDate(entRaw) : "—";
              const saiLabel = saiRaw ? formatDate(saiRaw) : "—";
              const st = r.status === "EM_ABERTO" ? "Em aberto" : r.status || "—";
              return `<tr>
              <td data-label="Veículo / responsável"><span class="lista-receber-placa">${escapeHtml(placa)}</span> · ${escapeHtml(vm)}<br /><span class="notice" style="font-size:0.86rem">${escapeHtml(r.responsavel_pagamento || "—")}</span></td>
              <td data-label="Entrada (pátio)">${escapeHtml(entLabel)}</td>
              <td data-label="Saída">${escapeHtml(saiLabel)}</td>
              <td data-label="Diárias">${listaReceberDiariasCellHtml(r, vehicle)}</td>
              <td data-label="Valor" class="lista-receber-valor">${escapeHtml(formatCurrency(Number(r.valor || 0)))}</td>
              <td data-label="Estado">${escapeHtml(st)}</td>
            </tr>`;
            })
            .join("");
          body.innerHTML = rowsHtml + footReceber;
          return;
        }

        if (currentListaView === "pagar") {
          head.innerHTML = `<tr><th>Descrição</th><th>Vencimento</th><th>Valor</th><th>Estado</th></tr>`;
          const list = (state.payables || []).filter((p) => p.status === "EM_ABERTO" && listaPayableMatches(p));
          if (!list.length) {
            body.innerHTML = `<tr><td colspan="4" class="notice">Nenhum registo com os filtros atuais.</td></tr>`;
            return;
          }
          const totalPagar = list.reduce((s, p) => s + Number(p.valor || 0), 0);
          const rowsPagar = list
            .map((p) => {
              return `<tr>
              <td data-label="Descrição">${escapeHtml(p.descricao || "—")}</td>
              <td data-label="Vencimento">${escapeHtml(p.data_vencimento ? formatDate(p.data_vencimento) : "—")}</td>
              <td data-label="Valor">${escapeHtml(formatCurrency(Number(p.valor || 0)))}</td>
              <td data-label="Estado">${escapeHtml(p.status || "—")}</td>
            </tr>`;
            })
            .join("");
          const footPagar = `<tr class="lista-tabela-total" style="border-top: 2px solid var(--border); background: rgba(148, 163, 184, 0.08)">
              <td data-label="Descrição" colspan="2" style="text-align: right; font-weight: 700">Total</td>
              <td data-label="Valor" style="font-weight: 700">${escapeHtml(formatCurrency(totalPagar))}</td>
              <td data-label="Estado"></td>
            </tr>`;
          body.innerHTML = rowsPagar + footPagar;
          return;
        }

        if (currentListaView === "caixa") {
          head.innerHTML = `<tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Valor</th></tr>`;
          const list = (state.cash || []).filter(listaCashMatches);
          if (!list.length) {
            body.innerHTML = `<tr><td colspan="4" class="notice">Nenhum registo com os filtros atuais.</td></tr>`;
            return;
          }
          body.innerHTML = list
            .map((mov) => {
              return `<tr>
              <td data-label="Data">${escapeHtml(formatDateTime(mov.data_movimento))}</td>
              <td data-label="Tipo">${escapeHtml(mov.tipo_conta || "—")}</td>
              <td data-label="Descrição">${escapeHtml(mov.descricao || "—")}</td>
              <td data-label="Valor">${escapeHtml(formatCurrency(Number(mov.valor || 0)))}</td>
            </tr>`;
            })
            .join("");
          return;
        }

        head.innerHTML = "";
        body.innerHTML = `<tr><td class="notice">Vista de lista não reconhecida.</td></tr>`;
        } finally {
          updateListaCaptureSummary();
        }
      }

      function listaCaptureOnCloneExpandTables(inner) {
        if (!inner) return;
        inner.style.overflow = "visible";
        inner.querySelectorAll(".table-wrap").forEach((el) => {
          el.style.setProperty("max-height", "none", "important");
          el.style.setProperty("overflow", "visible", "important");
          el.style.setProperty("overflow-x", "visible", "important");
          el.style.setProperty("overflow-y", "visible", "important");
        });
      }

      /** Para captura (PDF lista / etc.): html2canvas só «via» a zona visível de .table-wrap com max-height — expande e devolve restore. */
      function expandListaCaptureScrollContainersForExport(root) {
        const restoreFns = [];
        root.querySelectorAll(".table-wrap").forEach((el) => {
          const mh = el.style.maxHeight;
          const ov = el.style.overflow;
          const ovx = el.style.overflowX;
          const ovy = el.style.overflowY;
          el.style.setProperty("max-height", "none", "important");
          el.style.setProperty("overflow", "visible", "important");
          el.style.setProperty("overflow-x", "visible", "important");
          el.style.setProperty("overflow-y", "visible", "important");
          restoreFns.push(() => {
            el.style.removeProperty("max-height");
            el.style.removeProperty("overflow");
            el.style.removeProperty("overflow-x");
            el.style.removeProperty("overflow-y");
            if (mh) el.style.maxHeight = mh;
            if (ov) el.style.overflow = ov;
            if (ovx) el.style.overflowX = ovx;
            if (ovy) el.style.overflowY = ovy;
          });
        });
        const ro = root.style.overflow;
        root.style.setProperty("overflow", "visible", "important");
        restoreFns.push(() => {
          root.style.removeProperty("overflow");
          if (ro) root.style.overflow = ro;
        });
        return () => restoreFns.forEach((fn) => fn());
      }

      async function downloadListaCaptureAsPdf() {
        const root = document.getElementById("listaCaptureRoot");
        if (!root) {
          alert("Área da lista não encontrada.");
          return;
        }
        readListaFiltersFromDom();
        renderListaPanel();
        const btn = document.getElementById("listaFiltersDownloadPdf");
        const prev = btn?.textContent;
        if (btn) {
          btn.disabled = true;
          btn.textContent = "A gerar PDF…";
        }
        try {
          await loadJsPdf();
          const jsPdfCtor = window.jspdf?.jsPDF;
          if (!jsPdfCtor) throw new Error("jsPDF indisponível");
          const html2canvas = await loadHtml2Canvas();
          const releaseExpand = expandListaCaptureScrollContainersForExport(root);
          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          const w = Math.max(1, Math.ceil(root.scrollWidth));
          const h = Math.max(1, Math.ceil(root.scrollHeight));
          let scale = Math.min(2, (window.devicePixelRatio || 1) * 1.5);
          const maxSide = 16384;
          const cap = maxSide / Math.max(w, h, 1);
          if (scale > cap) scale = Math.max(0.55, cap);
          let canvas;
          try {
            canvas = await html2canvas(root, {
              backgroundColor: "#ffffff",
              scale,
              useCORS: true,
              logging: false,
              width: w,
              height: h,
              windowWidth: w,
              windowHeight: h,
              scrollX: 0,
              scrollY: 0,
              onclone(clonedDoc) {
                listaCaptureOnCloneExpandTables(clonedDoc.getElementById("listaCaptureRoot"));
              },
            });
          } finally {
            releaseExpand();
          }
          const doc = new jsPdfCtor({ unit: "pt", format: "a4", orientation: "portrait" });
          const pageW = doc.internal.pageSize.getWidth();
          const pageH = doc.internal.pageSize.getHeight();
          const margin = 36;
          const innerW = pageW - margin * 2;
          const innerH = pageH - margin * 2;
          const pxPerPt = canvas.width / innerW;
          const pageSlicePx = Math.max(1, Math.floor(innerH * pxPerPt));
          const pageCanvas = document.createElement("canvas");
          const pageCtx = pageCanvas.getContext("2d");
          if (!pageCtx) throw new Error("Falha ao preparar paginação do PDF.");
          pageCanvas.width = canvas.width;

          let offsetY = 0;
          let pageIndex = 0;
          while (offsetY < canvas.height) {
            const sliceH = Math.min(pageSlicePx, canvas.height - offsetY);
            pageCanvas.height = sliceH;
            pageCtx.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
            pageCtx.fillStyle = "#ffffff";
            pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
            pageCtx.drawImage(canvas, 0, offsetY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

            const drawW = innerW;
            const drawH = sliceH / pxPerPt;
            const drawX = margin + (innerW - drawW) / 2;
            const drawY = margin + (innerH - drawH) / 2;
            const pageImg = pageCanvas.toDataURL("image/jpeg", 0.92);

            if (pageIndex > 0) doc.addPage();
            doc.addImage(pageImg, "JPEG", drawX, drawY, drawW, drawH);

            offsetY += sliceH;
            pageIndex += 1;
          }
          const safeSub = String(currentListaView || "lista").replace(/[^\w-]+/g, "_");
          const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
          doc.save(`lista-${safeSub}-${stamp}.pdf`);
        } catch (e) {
          console.error(e);
          alert("Não foi possível gerar o PDF. Verifique a ligação à Internet ou tente noutro navegador.");
        } finally {
          if (btn) {
            btn.disabled = false;
            btn.textContent = prev || "Baixar PDF (A4)";
          }
        }
      }

      function runListaPrintDocument() {
        readListaFiltersFromDom();
        const listaPrintVnpSemValores = currentListaView === "vnp";
        renderListaPanel({ listaPrintVnpSemValores });
        const nomePatio = state.settings?.nome_patio || "Pátio";
        const headHtml = document.getElementById("listaTableHead")?.innerHTML || "";
        const bodyHtml = document.getElementById("listaTableBody")?.innerHTML || "";
        const filtros = [
          listaFilterLocatorId ? `RPV: ${state.partners.find((p) => p.id === listaFilterLocatorId)?.nome || listaFilterLocatorId}` : "",
          listaFilterAssessoriaId ? `Assessoria: ${state.partners.find((p) => p.id === listaFilterAssessoriaId)?.nome || listaFilterAssessoriaId}` : "",
          listaFilterRpfId ? `RPF: ${state.partners.find((p) => p.id === listaFilterRpfId)?.nome || listaFilterRpfId}` : "",
          listaFilterBanco ? `Texto: ${listaFilterBanco}` : "",
        ]
          .filter(Boolean)
          .join(" · ");
        const viewLabel = document.querySelector(`#listaSubnav button[data-lista-subview="${currentListaView}"]`)?.textContent?.trim() || currentListaView;
        const metaParts = [viewLabel, filtros || "Sem filtros adicionais", `Emitido: ${formatDateTime(new Date().toISOString())}`];
        if (listaPrintVnpSemValores) metaParts.push("Impressão sem coluna de valor estimado nem total");
        const meta = metaParts.join(" · ");
        const g = computeListaGrandTotalForCurrentView();
        const totalBlock = listaPrintVnpSemValores
          ? ""
          : g.hideAmount
            ? `<p style="margin-top:12px;font-weight:600">${escapeHtml("Valor total: não disponível neste perfil.")}</p>`
            : `<p style="margin-top:12px;font-weight:700;font-size:1.05rem">${escapeHtml(`${g.label}: ${formatCurrency(g.amount)}`)}</p>`;
        const printCss = `
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; margin: 20px; color: #111; }
  h1 { font-size: 1.2rem; margin: 0 0 6px; color: #111; }
  .meta { font-size: 0.82rem; color: #333; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
  th, td { border: 1px solid #bbb; padding: 6px; text-align: left; vertical-align: top; color: #111; }
  th { background: #f0f0f0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .tag { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; border: 1px solid #cbd5e1; background: #f1f5f9 !important; color: #0f172a !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .tag.success { background: #dcfce7 !important; color: #14532d !important; border-color: #86efac; }
  .tag.warning { background: #fef9c3 !important; color: #713f12 !important; border-color: #fde047; }
  .notice { color: #334155 !important; }
  .lista-receber-valor, .lista-receber-placa { color: #0f172a !important; font-weight: 700; font-variant-numeric: tabular-nums; }
  .lista-receber-diarias { color: #1e293b !important; }
  @page { margin: 12mm; }`;
        const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8" /><title>${escapeHtml(
          nomePatio
        )} — Lista</title><style>${printCss}</style></head><body>
  <h1>${escapeHtml(nomePatio)} — Lista · ${escapeHtml(viewLabel)}</h1>
  <div class="meta">${escapeHtml(meta)}</div>
  <table><thead>${headHtml}</thead><tbody>${bodyHtml}</tbody></table>
  ${totalBlock}
</body></html>`;
        printHtmlInHiddenIframe(html, { iframeTitle: "Impressão lista", closeModalId: null });
        if (listaPrintVnpSemValores) renderListaPanel();
      }

      function printHtmlInHiddenIframe(html, opts = {}) {
        const iframeTitle = opts.iframeTitle || "Impressão";
        const closeModalId = opts.closeModalId || null;
        const iframe = document.createElement("iframe");
        iframe.setAttribute("title", iframeTitle);
        iframe.setAttribute("aria-hidden", "true");
        iframe.style.cssText =
          "position:fixed;left:-9999px;top:0;width:900px;height:1200px;border:0;opacity:0;pointer-events:none;z-index:-1;overflow:hidden;";
        document.body.appendChild(iframe);
        const win = iframe.contentWindow;
        if (!win) {
          iframe.remove();
          alert("Não foi possível preparar a impressão neste navegador.");
          return false;
        }
        win.document.open();
        win.document.write(html);
        win.document.close();
        win.focus();
        const removeIframe = () => {
          try {
            iframe.remove();
          } catch (e) {
            /* ignore */
          }
        };
        setTimeout(() => {
          try {
            win.print();
          } catch (e) {
            /* ignore */
          }
          setTimeout(removeIframe, 800);
        }, 300);
        if (closeModalId) document.getElementById(closeModalId)?.classList.add("hidden");
        return true;
      }

      function bucketVehiclesByPartnerField(vehicles, field) {
        const m = new Map();
        vehicles.forEach((v) => {
          const raw = v[field];
          const key = raw != null && raw !== "" ? raw : "__sem__";
          if (!m.has(key)) m.set(key, []);
          m.get(key).push(v);
        });
        return m;
      }

      function sortPartnerBucketKeys(keys, partnerByIdMap) {
        const label = (k) =>
          k === "__sem__" ? "Não informado" : partnerByIdMap.get(k) || "Parceiro não encontrado";
        const sem = keys.filter((k) => k === "__sem__");
        const rest = keys
          .filter((k) => k !== "__sem__")
          .sort((a, b) => label(a).localeCompare(label(b), "pt-BR"));
        return [...rest, ...sem];
      }

      function sortTextBucketKeys(keys) {
        const sem = keys.filter((k) => k === "__sem__");
        const rest = keys
          .filter((k) => k !== "__sem__")
          .sort((a, b) => a.localeCompare(b, "pt-BR"));
        return [...rest, ...sem];
      }

      function sortOpenReceivablesByPlaca(recs, vehicleById) {
        return [...recs].sort((a, b) => {
          const pa = (vehicleById.get(a.vehicle_id)?.placa || "").toLowerCase();
          const pb = (vehicleById.get(b.vehicle_id)?.placa || "").toLowerCase();
          return pa.localeCompare(pb, "pt-BR");
        });
      }

      function bucketOpenReceivablesByKey(recs, keyFn) {
        const m = new Map();
        recs.forEach((r) => {
          const k = keyFn(r);
          if (!m.has(k)) m.set(k, []);
          m.get(k).push(r);
        });
        return m;
      }

      function openPatioPartnerPrintModal() {
        document.getElementById("patioPartnerPrintModal")?.classList.remove("hidden");
      }

      function runPatioPartnerPrintDocument() {
        const byLoc = document.getElementById("printPartnerByLocator")?.checked;
        const byAss = document.getElementById("printPartnerByAssessoria")?.checked;
        const byRem = document.getElementById("printPartnerByRemoval")?.checked;
        const excludeRemoved = document.getElementById("printPartnerExcludeRemoved")?.checked;
        if (!byLoc && !byAss && !byRem) {
          alert("Marque pelo menos um agrupamento: RPV, assessoria ou etapa de remoção.");
          return;
        }
        let vehicles = state.vehicles || [];
        if (excludeRemoved) {
          vehicles = vehicles.filter((v) => v.status !== "REMOVIDO");
        }
        const partnerByIdMap = new Map((state.partners || []).map((p) => [p.id, p.nome || "-"]));
        const partnerTitle = (k) =>
          k === "__sem__" ? "Não informado" : partnerByIdMap.get(k) || "Parceiro não encontrado";

        const nomePatio = state.settings?.nome_patio || "Pátio";
        const nowStr = formatDateTime(new Date().toISOString());
        const metaLine = [
          excludeRemoved ? "Ocultando removidos (VRP)" : "Inclui removidos no agrupamento",
          `Total no relatório: ${vehicles.length} veículo(s)`,
          `Emitido em: ${nowStr}`,
          ...(isGestorPista ? ["Perfil gestor de pista: colunas monetárias omitidas"] : []),
        ].join(" · ");

        const theadLoc =
          "<th>Veículo</th><th>Entrada</th><th>Saída</th><th>Assessoria</th>" +
          patioPrintMoneyHeaderHtml() +
          "<th>Observações</th>";
        const theadAss =
          "<th>Veículo</th><th>Entrada</th><th>Saída</th><th>Empresa de remoção</th>" +
          patioPrintMoneyHeaderHtml() +
          "<th>Observações</th>";
        const theadRem =
          "<th>Veículo</th><th>Entrada</th><th>Saída</th><th>RPV</th><th>Assessoria</th>" +
          patioPrintMoneyHeaderHtml() +
          "<th>Observações</th>";

        const rowLoc = (v) => {
          const { ass } = patioPrintPartnerNames(v);
          const sai = v.data_saida ? formatDateTime(v.data_saida) : "—";
          return `<tr>
            <td>${patioPrintVehicleLine(v)}</td>
            <td>${escapeHtml(formatDateTime(v.data_entrada))}</td>
            <td>${escapeHtml(sai)}</td>
            <td>${escapeHtml(ass)}</td>
            ${patioPrintMoneyCellsHtml(v)}
            <td>${patioPrintObsCell(v)}</td>
          </tr>`;
        };
        const rowAss = (v) => {
          const { loc } = patioPrintPartnerNames(v);
          const sai = v.data_saida ? formatDateTime(v.data_saida) : "—";
          return `<tr>
            <td>${patioPrintVehicleLine(v)}</td>
            <td>${escapeHtml(formatDateTime(v.data_entrada))}</td>
            <td>${escapeHtml(sai)}</td>
            <td>${escapeHtml(loc)}</td>
            ${patioPrintMoneyCellsHtml(v)}
            <td>${patioPrintObsCell(v)}</td>
          </tr>`;
        };
        const rowRem = (v) => {
          const { loc, ass } = patioPrintPartnerNames(v);
          const sai = v.data_saida ? formatDateTime(v.data_saida) : "—";
          return `<tr>
            <td>${patioPrintVehicleLine(v)}</td>
            <td>${escapeHtml(formatDateTime(v.data_entrada))}</td>
            <td>${escapeHtml(sai)}</td>
            <td>${escapeHtml(loc)}</td>
            <td>${escapeHtml(ass)}</td>
            ${patioPrintMoneyCellsHtml(v)}
            <td>${patioPrintObsCell(v)}</td>
          </tr>`;
        };

        const blocks = [];
        if (!vehicles.length) {
          blocks.push(
            `<p class="empty-note">Nenhum veículo neste relatório. Desmarque “Ocultar removidos” ou verifique o cadastro.</p>`
          );
        } else {
          if (byLoc) {
            blocks.push(`<h2>Por empresa de remoção (RPV)</h2>`);
            const map = bucketVehiclesByPartnerField(vehicles, "localizador_id");
            const keys = sortPartnerBucketKeys([...map.keys()], partnerByIdMap);
            keys.forEach((key) => {
              const items = sortVehiclesByPlaca(map.get(key) || []);
              blocks.push(
                `<h3>${escapeHtml(partnerTitle(key))} <span class="count">(${items.length})</span></h3>`
              );
              if (!items.length) {
                blocks.push(`<p class="empty-note">Nenhum veículo.</p>`);
              } else {
                blocks.push(
                  `<table><thead><tr>${theadLoc}</tr></thead><tbody>${items.map(rowLoc).join("")}</tbody></table>`
                );
              }
            });
          }

          if (byAss) {
            blocks.push(`<h2>Por assessoria</h2>`);
            const map = bucketVehiclesByPartnerField(vehicles, "assessoria_id");
            const keys = sortPartnerBucketKeys([...map.keys()], partnerByIdMap);
            keys.forEach((key) => {
              const items = sortVehiclesByPlaca(map.get(key) || []);
              blocks.push(
                `<h3>${escapeHtml(partnerTitle(key))} <span class="count">(${items.length})</span></h3>`
              );
              if (!items.length) {
                blocks.push(`<p class="empty-note">Nenhum veículo.</p>`);
              } else {
                blocks.push(
                  `<table><thead><tr>${theadAss}</tr></thead><tbody>${items.map(rowAss).join("")}</tbody></table>`
                );
              }
            });
          }

          if (byRem) {
            blocks.push(`<h2>Por etapa de remoção (fluxo no pátio)</h2>`);
            REMOVAL_FLOW_ORDER.forEach((st) => {
              const items = sortVehiclesByPlaca(vehicles.filter((v) => v.status === st));
              if (!items.length) return;
              const lab = REMOVAL_FLOW_LABELS[st] || st;
              blocks.push(`<h3>${escapeHtml(lab)} <span class="count">(${items.length})</span></h3>`);
              blocks.push(
                `<table><thead><tr>${theadRem}</tr></thead><tbody>${items.map(rowRem).join("")}</tbody></table>`
              );
            });
            const known = new Set(REMOVAL_FLOW_ORDER);
            const outros = sortVehiclesByPlaca(vehicles.filter((v) => !known.has(v.status)));
            if (outros.length) {
              blocks.push(`<h3>Outros status <span class="count">(${outros.length})</span></h3>`);
              blocks.push(
                `<table><thead><tr>${theadRem}</tr></thead><tbody>${outros.map(rowRem).join("")}</tbody></table>`
              );
            }
          }
        }

        const printCss = `
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; margin: 20px; color: #111; }
  h1 { font-size: 1.25rem; margin: 0 0 4px; }
  h2 { font-size: 1.08rem; margin: 22px 0 8px; page-break-after: avoid; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  h3 { font-size: 0.95rem; margin: 14px 0 6px; page-break-after: avoid; }
  h3 .count { font-weight: normal; color: #555; }
  .meta { font-size: 0.8rem; color: #444; margin-bottom: 14px; }
  .empty-note { font-size: 0.85rem; color: #666; font-style: italic; margin: 0 0 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 0.76rem; margin-bottom: 14px; }
  th, td { border: 1px solid #bbb; padding: 6px; text-align: left; vertical-align: top; color: #111; }
  th { background: #f0f0f0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @page { margin: 12mm; }
  @media print { body { margin: 0; } }`;

        const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8" /><title>Veículos por parceiro e remoção</title>
<style>${printCss}</style></head><body>
  <h1>${escapeHtml(nomePatio)} — Veículos por parceiro e remoção</h1>
  <div class="meta">${escapeHtml(metaLine)}</div>
  ${blocks.join("")}
</body></html>`;

        printHtmlInHiddenIframe(html, {
          iframeTitle: "Impressão por parceiro e remoção",
          closeModalId: "patioPartnerPrintModal",
        });
      }

      function openPatioLiberadosPrintModal() {
        const modal = document.getElementById("patioLiberadosPrintModal");
        modal?.classList.remove("hidden");
      }

      function runPatioLiberadosPrintDocument() {
        const byLoc = document.getElementById("printLibByLocator")?.checked;
        const byAss = document.getElementById("printLibByAssessoria")?.checked;
        if (!byLoc && !byAss) {
          alert("Marque pelo menos um agrupamento: RPV ou assessoria.");
          return;
        }

        const vehicles = (state.vehicles || []).filter((v) =>
          LIBERADOS_PAYMENT_PRINT_STATUSES.includes(v.status)
        );

        const partnerByIdMap = new Map((state.partners || []).map((p) => [p.id, p.nome || "-"]));
        const partnerTitle = (k) =>
          k === "__sem__" ? "Não informado" : partnerByIdMap.get(k) || "Parceiro não encontrado";

        const nomePatio = state.settings?.nome_patio || "Pátio";
        const nowStr = formatDateTime(new Date().toISOString());
        const metaLine = [
          `Total: ${vehicles.length} veículo(s)`,
          `Emitido em: ${nowStr}`,
          ...(isGestorPista ? ["Perfil gestor de pista: colunas monetárias omitidas"] : []),
        ].join(" · ");

        const situacaoCell = (v) => escapeHtml(REMOVAL_FLOW_LABELS[v.status] || v.status || "—");
        const theadLoc =
          "<th>Veículo</th><th>Entrada</th><th>Saída</th><th>Situação</th><th>Assessoria</th>" +
          patioPrintMoneyHeaderHtml() +
          "<th>Observações</th>";
        const theadAss =
          "<th>Veículo</th><th>Entrada</th><th>Saída</th><th>Situação</th><th>Empresa de remoção</th>" +
          patioPrintMoneyHeaderHtml() +
          "<th>Observações</th>";

        const rowLoc = (v) => {
          const { ass } = patioPrintPartnerNames(v);
          const sai = v.data_saida ? formatDateTime(v.data_saida) : "—";
          return `<tr>
            <td>${patioPrintVehicleLine(v)}</td>
            <td>${escapeHtml(formatDateTime(v.data_entrada))}</td>
            <td>${escapeHtml(sai)}</td>
            <td>${situacaoCell(v)}</td>
            <td>${escapeHtml(ass)}</td>
            ${patioPrintMoneyCellsHtml(v)}
            <td>${patioPrintObsCell(v)}</td>
          </tr>`;
        };
        const rowAss = (v) => {
          const { loc } = patioPrintPartnerNames(v);
          const sai = v.data_saida ? formatDateTime(v.data_saida) : "—";
          return `<tr>
            <td>${patioPrintVehicleLine(v)}</td>
            <td>${escapeHtml(formatDateTime(v.data_entrada))}</td>
            <td>${escapeHtml(sai)}</td>
            <td>${situacaoCell(v)}</td>
            <td>${escapeHtml(loc)}</td>
            ${patioPrintMoneyCellsHtml(v)}
            <td>${patioPrintObsCell(v)}</td>
          </tr>`;
        };

        const blocks = [];
        if (!vehicles.length) {
          blocks.push(`<p class="empty-note">Nenhum veículo em liberação ou removidos com estes critérios.</p>`);
        } else {
          if (byLoc) {
            blocks.push(`<h2>Por RPV (empresa de remoção)</h2>`);
            const map = bucketVehiclesByPartnerField(vehicles, "localizador_id");
            const keys = sortPartnerBucketKeys([...map.keys()], partnerByIdMap);
            keys.forEach((key) => {
              const items = sortVehiclesByPlaca(map.get(key) || []);
              blocks.push(
                `<h3>${escapeHtml(partnerTitle(key))} <span class="count">(${items.length})</span></h3>`
              );
              if (!items.length) {
                blocks.push(`<p class="empty-note">Nenhum veículo.</p>`);
              } else {
                blocks.push(
                  `<table><thead><tr>${theadLoc}</tr></thead><tbody>${items.map(rowLoc).join("")}</tbody></table>`
                );
              }
            });
          }
          if (byAss) {
            blocks.push(`<h2>Por assessoria</h2>`);
            const map = bucketVehiclesByPartnerField(vehicles, "assessoria_id");
            const keys = sortPartnerBucketKeys([...map.keys()], partnerByIdMap);
            keys.forEach((key) => {
              const items = sortVehiclesByPlaca(map.get(key) || []);
              blocks.push(
                `<h3>${escapeHtml(partnerTitle(key))} <span class="count">(${items.length})</span></h3>`
              );
              if (!items.length) {
                blocks.push(`<p class="empty-note">Nenhum veículo.</p>`);
              } else {
                blocks.push(
                  `<table><thead><tr>${theadAss}</tr></thead><tbody>${items.map(rowAss).join("")}</tbody></table>`
                );
              }
            });
          }
        }

        const printCss = `
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; margin: 20px; color: #111; }
  h1 { font-size: 1.25rem; margin: 0 0 4px; }
  h2 { font-size: 1.08rem; margin: 22px 0 8px; page-break-after: avoid; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  h3 { font-size: 0.95rem; margin: 14px 0 6px; page-break-after: avoid; }
  h3 .count { font-weight: normal; color: #555; }
  .meta { font-size: 0.8rem; color: #444; margin-bottom: 14px; }
  .empty-note { font-size: 0.85rem; color: #666; font-style: italic; margin: 0 0 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 0.76rem; margin-bottom: 14px; }
  th, td { border: 1px solid #bbb; padding: 6px; text-align: left; vertical-align: top; color: #111; }
  th { background: #f0f0f0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @page { margin: 12mm; }
  @media print { body { margin: 0; } }`;

        const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8" /><title>Liberados — pátio</title>
<style>${printCss}</style></head><body>
  <h1>${escapeHtml(nomePatio)} — Veículos em liberação e removidos</h1>
  <div class="meta">${escapeHtml(metaLine)}</div>
  <p class="meta">Inclui veículos em fase de liberação e VRP (removidos), conforme filtros.</p>
  ${blocks.join("")}
</body></html>`;

        printHtmlInHiddenIframe(html, {
          iframeTitle: "Impressão liberados (pátio)",
          closeModalId: "patioLiberadosPrintModal",
        });
      }

      function financeReceivableMatchesPlateQuery(r, vehicleById, financePlateNorm) {
        if (!financePlateNorm) return true;
        const v = vehicleById.get(r.vehicle_id);
        if (!v || !v.placa) return false;
        return plateNormMatchesQuery(normalizePlateSearch(v.placa), financePlateNorm);
      }

      function formatReceberEntradaVeiculo(v, r) {
        const raw = v?.data_entrada || r.period_start || r.created_at;
        return raw ? formatDate(raw) : "—";
      }

      function formatReceberSaidaVeiculo(v, r) {
        const raw = v?.data_saida || r.period_end;
        return raw ? formatDate(raw) : "—";
      }

      function receberBarFilterMatches(r, vehicle) {
        const locSel = document.getElementById("financeReceberFilterLoc");
        const assSel = document.getElementById("financeReceberFilterAss");
        const respSel = document.getElementById("financeReceberFilterResp");
        const filterLocId = locSel?.value || "";
        const filterAssId = assSel?.value || "";
        const filterRespEnc = respSel?.value || "";
        const filterResp = filterRespEnc ? decodeURIComponent(filterRespEnc) : "";
        if (filterLocId && (vehicle?.localizador_id || "") !== filterLocId) return false;
        if (filterAssId && (vehicle?.assessoria_id || "") !== filterAssId) return false;
        if (filterResp && (r.responsavel_pagamento || "").trim() !== filterResp) return false;
        return true;
      }

      function syncFinanceReceberBarOptions() {
        const locSel = document.getElementById("financeReceberFilterLoc");
        const assSel = document.getElementById("financeReceberFilterAss");
        const respSel = document.getElementById("financeReceberFilterResp");
        if (!locSel || !assSel || !respSel) return;
        const preserveLoc = locSel.value;
        const preserveAss = assSel.value;
        const preserveResp = respSel.value;
        const openList = (state.receivables || []).filter((r) => receivableIsContaReceberFinanceiro(r));
        const partnersList = state.partners || [];
        const parceiros = partnersList.filter((p) => isLocalizadorPartnerType(p.tipo || "PARCEIRO"));
        const assessorias = partnersList.filter((p) => p.tipo === "ASSESSORIA");
        const optId = (id, label) => {
          const v = String(id).replace(/"/g, "&quot;");
          return `<option value="${v}">${escapeHtml(label)}</option>`;
        };
        locSel.innerHTML =
          `<option value="">Todos os RPVs</option>` +
          parceiros.map((p) => optId(p.id, p.nome || "-")).join("");
        assSel.innerHTML =
          `<option value="">Todas as assessorias</option>` +
          assessorias.map((p) => optId(p.id, p.nome || "-")).join("");
        const names = [
          ...new Set(openList.map((r) => (r.responsavel_pagamento || "").trim()).filter(Boolean)),
        ].sort((a, b) => a.localeCompare(b, "pt-BR"));
        respSel.innerHTML =
          `<option value="">Todos os responsáveis</option>` +
          names.map((n) => `<option value="${encodeURIComponent(n)}">${escapeHtml(n)}</option>`).join("");
        if (parceiros.some((p) => p.id === preserveLoc)) locSel.value = preserveLoc;
        else locSel.value = "";
        if (assessorias.some((p) => p.id === preserveAss)) assSel.value = preserveAss;
        else assSel.value = "";
        if (preserveResp) {
          try {
            const dec = decodeURIComponent(preserveResp);
            if (names.includes(dec)) respSel.value = encodeURIComponent(dec);
            else respSel.value = "";
          } catch (e) {
            respSel.value = "";
          }
        } else respSel.value = "";
      }

      function collectFinanceReceberFilteredList({ alertaOnly = false } = {}) {
        const vehicleById = new Map(state.vehicles.map((v) => [v.id, v]));
        const financePlateNorm = normalizePlateSearch(financePlateQuery);
        const todayYmd = toLocalYmd(new Date().toISOString());
        const q = String(financeReceberBuscaFilter || "").trim().toLowerCase();
        let list = (state.receivables || []).filter((r) => {
          const isPaid = r.status === "PAGO";
          const isManual = isManualFinanceLancamento(r);
          const isOpenConta = receivableIsContaReceberFinanceiro(r);
          const statusF = String(financeReceberStatusFilter || "aberto").toLowerCase();
          if (statusF === "pago") {
            if (!isPaid) return false;
            if (FINANCE_MANUAL_ONLY && !isManual) return false;
          } else if (statusF === "todas") {
            if (isPaid) {
              if (FINANCE_MANUAL_ONLY && !isManual) return false;
            } else if (!isOpenConta) {
              return false;
            }
          } else if (!isOpenConta) {
            return false;
          }
          if (!financeReceivableMatchesPlateQuery(r, vehicleById, financePlateNorm)) return false;
          if (!receberBarFilterMatches(r, vehicleById.get(r.vehicle_id))) return false;
          if (!financeContaMatchesStatusFilter(r, "receivable", financeReceberStatusFilter, todayYmd)) return false;
          if (q) {
            const blob = `${r.responsavel_pagamento || ""} ${r.observacoes || ""}`.toLowerCase();
            if (!blob.includes(q)) return false;
          }
          return true;
        });
        if (alertaOnly) {
          list = list.filter((r) => {
            const due = financeContaDueYmd(r, "receivable");
            const days = financeContaDueDays(due, todayYmd);
            return days != null && days > 0;
          });
        }
        return { list, vehicleById, todayYmd };
      }

      function syncFinanceOpenRecPrintFilterOptions() {
        const locSel = document.getElementById("financePrintFilterLocator");
        const assSel = document.getElementById("financePrintFilterAssessoria");
        const respSel = document.getElementById("financePrintFilterResponsavel");
        if (!locSel || !assSel || !respSel) return;

        const preserveLoc = locSel.value;
        const preserveAss = assSel.value;
        const preserveResp = respSel.value;

        const vehicleById = new Map(state.vehicles.map((v) => [v.id, v]));
        const financePlateNorm = normalizePlateSearch(financePlateQuery);
        const openList = (state.receivables || []).filter(
          (r) =>
            receivableIsContaReceberFinanceiro(r) && financeReceivableMatchesPlateQuery(r, vehicleById, financePlateNorm)
        );

        const partnersList = state.partners || [];
        const parceiros = partnersList.filter((p) => isLocalizadorPartnerType(p.tipo || "PARCEIRO"));
        const assessorias = partnersList.filter((p) => p.tipo === "ASSESSORIA");

        const optId = (id, label) => {
          const v = String(id).replace(/"/g, "&quot;");
          return `<option value="${v}">${escapeHtml(label)}</option>`;
        };

        locSel.innerHTML =
          `<option value="">Todos os RPVs</option>` +
          parceiros.map((p) => optId(p.id, p.nome || "-")).join("");
        assSel.innerHTML =
          `<option value="">Todas as assessorias</option>` +
          assessorias.map((p) => optId(p.id, p.nome || "-")).join("");

        const names = [
          ...new Set(openList.map((r) => (r.responsavel_pagamento || "").trim()).filter(Boolean)),
        ].sort((a, b) => a.localeCompare(b, "pt-BR"));
        respSel.innerHTML =
          `<option value="">Todos os responsáveis</option>` +
          names.map((n) => `<option value="${encodeURIComponent(n)}">${escapeHtml(n)}</option>`).join("");

        if (parceiros.some((p) => p.id === preserveLoc)) locSel.value = preserveLoc;
        else locSel.value = "";
        if (assessorias.some((p) => p.id === preserveAss)) assSel.value = preserveAss;
        else assSel.value = "";
        if (preserveResp) {
          try {
            const dec = decodeURIComponent(preserveResp);
            if (names.includes(dec)) respSel.value = encodeURIComponent(dec);
            else respSel.value = "";
          } catch (e) {
            respSel.value = "";
          }
        } else respSel.value = "";
      }

      function openFinanceOpenRecPrintModal() {
        syncFinanceOpenRecPrintFilterOptions();
        const bl = document.getElementById("financeReceberFilterLoc");
        const ba = document.getElementById("financeReceberFilterAss");
        const br = document.getElementById("financeReceberFilterResp");
        const pl = document.getElementById("financePrintFilterLocator");
        const pa = document.getElementById("financePrintFilterAssessoria");
        const pr = document.getElementById("financePrintFilterResponsavel");
        if (bl && pl && bl.value) pl.value = bl.value;
        if (ba && pa && ba.value) pa.value = ba.value;
        if (br && pr && br.value) pr.value = br.value;
        document.getElementById("financeOpenRecPrintModal")?.classList.remove("hidden");
      }

      function runFinanceOpenReceivablesPrint() {
        const byLoc = document.getElementById("financePrintOpenByLocator")?.checked;
        const byResp = document.getElementById("financePrintOpenByResp")?.checked;
        const byAss = document.getElementById("financePrintOpenByAssessoria")?.checked;
        if (!byLoc && !byResp && !byAss) {
          alert("Marque pelo menos um agrupamento.");
          return;
        }

        const financePlateNorm = normalizePlateSearch(financePlateQuery);
        const vehicleById = new Map(state.vehicles.map((v) => [v.id, v]));
        const partnerByIdMap = new Map((state.partners || []).map((p) => [p.id, p.nome || "-"]));

        let openRec = (state.receivables || []).filter(
          (r) =>
            receivableIsContaReceberFinanceiro(r) && financeReceivableMatchesPlateQuery(r, vehicleById, financePlateNorm)
        );

        const filterLocId = document.getElementById("financePrintFilterLocator")?.value || "";
        const filterAssId = document.getElementById("financePrintFilterAssessoria")?.value || "";
        const filterRespEnc = document.getElementById("financePrintFilterResponsavel")?.value || "";
        const filterResp = filterRespEnc ? decodeURIComponent(filterRespEnc) : "";

        openRec = openRec.filter((r) => {
          const v = vehicleById.get(r.vehicle_id);
          if (filterLocId && (v?.localizador_id || "") !== filterLocId) return false;
          if (filterAssId && (v?.assessoria_id || "") !== filterAssId) return false;
          if (filterResp && (r.responsavel_pagamento || "").trim() !== filterResp) return false;
          return true;
        });

        if (!openRec.length) {
          alert(
            filterLocId || filterAssId || filterResp
              ? "Nenhuma conta em aberto com os filtros escolhidos (placa, RPV, assessoria ou responsável)."
              : financePlateNorm
                ? "Nenhuma conta em aberto com o filtro de placa atual. Limpe a busca ou ajuste a placa."
                : "Não há títulos em aberto para receber."
          );
          return;
        }

        const receivableValor = (r) => Number(r.valor || 0);
        const nomePatio = state.settings?.nome_patio || "Pátio";
        const nowStr = formatDateTime(new Date().toISOString());
        const totalGeral = openRec.reduce((s, r) => s + receivableValor(r), 0);
        const metaParts = [
          `${openRec.length} conta(s) em aberto`,
          `Total: ${formatCurrency(totalGeral)}`,
          `Emitido em: ${nowStr}`,
        ];
        if (financePlateQuery.trim()) {
          metaParts.unshift(`Filtro placa: ${financePlateQuery.trim()}`);
        }
        const filtroIndiv = [];
        if (filterLocId) {
          filtroIndiv.push(`Somente RPV: ${partnerByIdMap.get(filterLocId) || "-"}`);
        }
        if (filterAssId) {
          filtroIndiv.push(`Somente assessoria: ${partnerByIdMap.get(filterAssId) || "-"}`);
        }
        if (filterResp) {
          filtroIndiv.push(`Somente responsável: ${filterResp}`);
        }
        if (filtroIndiv.length) {
          metaParts.unshift(filtroIndiv.join(" · "));
        }

        const html = buildOpenReceivablesGroupedPrintHtml({
          openRec,
          vehicleById,
          byLoc,
          byResp,
          byAss,
          docTitle: "Receber em aberto",
          headingTitle: `${nomePatio} — Receber em aberto`,
          metaLine: metaParts.join(" · "),
        });

        printHtmlInHiddenIframe(html, {
          iframeTitle: "Impressão a receber em aberto",
          closeModalId: "financeOpenRecPrintModal",
        });
      }

      function openPatioPrintModal() {
        const modal = document.getElementById("patioPrintModal");
        const fromEl = document.getElementById("printPatioFrom");
        const toEl = document.getElementById("printPatioTo");
        if (!modal || !fromEl || !toEl) return;
        const now = new Date();
        const first = new Date(now.getFullYear(), now.getMonth(), 1);
        fromEl.value = toYmdLocal(first);
        toEl.value = toYmdLocal(now);
        modal.classList.remove("hidden");
      }

      function applyPatioPrintPreset(kind) {
        const fromEl = document.getElementById("printPatioFrom");
        const toEl = document.getElementById("printPatioTo");
        if (!fromEl || !toEl) return;
        const now = new Date();
        const toStr = toYmdLocal(now);
        toEl.value = toStr;
        if (kind === "month") {
          const first = new Date(now.getFullYear(), now.getMonth(), 1);
          fromEl.value = toYmdLocal(first);
          return;
        }
        const days = kind === 90 ? 90 : 30;
        const fromD = new Date(now.getTime() - (days - 1) * 86400000);
        fromEl.value = toYmdLocal(fromD);
      }

      function runPatioPrintDocument() {
        const fromEl = document.getElementById("printPatioFrom");
        const toEl = document.getElementById("printPatioTo");
        const incVnp = document.getElementById("printPatioIncludeVnp")?.checked;
        const incVrp = document.getElementById("printPatioIncludeVrp")?.checked;
        const incNfse = document.getElementById("printPatioIncludeNfse")?.checked;
        const fromStr = fromEl?.value || "";
        const toStr = toEl?.value || "";
        const needsPeriod = incVrp || incNfse;
        if (needsPeriod) {
          if (!fromStr || !toStr) {
            alert("Para VRP ou NFSe pendente, informe a data inicial e a data final.");
            return;
          }
          if (fromStr > toStr) {
            alert("A data inicial não pode ser maior que a data final.");
            return;
          }
        }
        if (!incVnp && !incVrp && !incNfse) {
          alert("Marque pelo menos uma listagem: VNP, VRP ou NFSe pendente.");
          return;
        }

        const vehicles = state.vehicles || [];
        const nomePatio = state.settings?.nome_patio || "Pátio";
        const nowStr = formatDateTime(new Date().toISOString());
        const metaParts = [];
        if (incVnp) metaParts.push("VNP: lista unificada atual (sem filtro por data)");
        if (needsPeriod && fromStr && toStr) {
          metaParts.push(`VRP/NFSe: ${formatYmdToBr(fromStr)} a ${formatYmdToBr(toStr)}`);
        }
        metaParts.push(`Emitido em: ${nowStr}`);
        if (isGestorPista) metaParts.push("Perfil gestor de pista: colunas monetárias omitidas nas tabelas");
        const metaLine = metaParts.join(" · ");

        const sections = [];

        const pushTable = (title, subtitle, theadHtml, bodyRowsHtml, count, emptyText) => {
          const emptyMsg = emptyText || "Nenhum registro.";
          sections.push(`
            <h2>${escapeHtml(title)}</h2>
            <p class="section-sub">${escapeHtml(subtitle)} · ${count} veículo(s)</p>
            ${
              count === 0
                ? `<p class="empty-note">${escapeHtml(emptyMsg)}</p>`
                : `<table>
              <thead><tr>${theadHtml}</tr></thead>
              <tbody>${bodyRowsHtml}</tbody>
            </table>`
            }
          `);
        };

        if (incVnp) {
          const list = sortVehiclesByPlaca(
            vehicles.filter(
              (v) => v.status === "NO_PATIO" || VLS_PRINT_STATUSES.includes(v.status)
            )
          );
          const rows = list
            .map((v) => {
              const { loc, ass } = patioPrintPartnerNames(v);
              const sit =
                v.status === "NO_PATIO" ? "No pátio" : VLS_STATUS_LABELS[v.status] || v.status || "-";
              return `<tr>
                <td>${patioPrintVehicleLine(v)}</td>
                <td>${escapeHtml(formatDateTime(v.data_entrada))}</td>
                <td>${escapeHtml(sit)}</td>
                <td>${escapeHtml(loc)}</td>
                <td>${escapeHtml(ass)}</td>
                ${patioPrintMoneyCellsHtml(v)}
                <td>${patioPrintObsCell(v)}</td>
              </tr>`;
            })
            .join("");
          pushTable(
            "VNP — No pátio e liberação em andamento",
            "Mesma lista unificada do sistema (antes da remoção / VRP)",
            "<th>Veículo</th><th>Data de entrada</th><th>Situação</th><th>RPV</th><th>Assessoria</th>" +
              patioPrintMoneyHeaderHtml() +
              "<th>Observações</th>",
            rows,
            list.length,
            "Nenhum veículo nesta lista."
          );
        }

        if (incVrp) {
          const list = sortVehiclesByPlaca(
            vehicles.filter((v) => {
              if (v.status !== "REMOVIDO") return false;
              const ref = v.data_saida || v.data_entrada;
              return inDateRangeInclusive(ref, fromStr, toStr);
            })
          );
          const rows = list
            .map((v) => {
              const { loc, ass } = patioPrintPartnerNames(v);
              return `<tr>
                <td>${patioPrintVehicleLine(v)}</td>
                <td>${escapeHtml(formatDateTime(v.data_entrada))}</td>
                <td>${escapeHtml(formatDateTime(v.data_saida))}</td>
                <td>${escapeHtml(loc)}</td>
                <td>${escapeHtml(ass)}</td>
                ${patioPrintMoneyCellsHtml(v)}
                <td>${patioPrintObsCell(v)}</td>
              </tr>`;
            })
            .join("");
          pushTable(
            "VRP — Veículos removidos",
            "Filtrado por data de saída no período (se não houver saída, usa a data de entrada)",
            "<th>Veículo</th><th>Entrada</th><th>Saída</th><th>RPV</th><th>Assessoria</th>" +
              patioPrintMoneyHeaderHtml() +
              "<th>Observações</th>",
            rows,
            list.length,
            "Nenhum veículo removido neste período."
          );
        }

        if (incNfse) {
          const list = sortVehiclesByPlaca(
            vehicles.filter((v) => {
              if (v.nfse_status !== "PENDENTE") return false;
              const ref = v.nfse_requested_at || v.data_entrada;
              return inDateRangeInclusive(ref, fromStr, toStr);
            })
          );
          const rows = list
            .map((v) => {
              const { loc, ass } = patioPrintPartnerNames(v);
              const req = v.nfse_requested_at ? formatDateTime(v.nfse_requested_at) : "—";
              return `<tr>
                <td>${patioPrintVehicleLine(v)}</td>
                <td>${escapeHtml(formatDateTime(v.data_entrada))}</td>
                <td>${escapeHtml(req)}</td>
                <td>${escapeHtml(loc)}</td>
                <td>${escapeHtml(ass)}</td>
                ${patioPrintMoneyCellsHtml(v)}
                <td>${patioPrintObsCell(v)}</td>
              </tr>`;
            })
            .join("");
          pushTable(
            "NFSe pendente",
            "Veículos com NFSe pendente; período pela data da solicitação ou, se vazia, pela entrada",
            "<th>Veículo</th><th>Data de entrada</th><th>Solicitação NFSe</th><th>RPV</th><th>Assessoria</th>" +
              patioPrintMoneyHeaderHtml() +
              "<th>Observações</th>",
            rows,
            list.length,
            "Nenhum veículo com NFSe pendente neste período."
          );
        }

        const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8" /><title>Listagens do pátio</title>
<style>
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; margin: 20px; color: #111; }
  h1 { font-size: 1.25rem; margin: 0 0 4px; }
  h2 { font-size: 1.05rem; margin: 22px 0 6px; page-break-after: avoid; }
  .meta { font-size: 0.8rem; color: #444; margin-bottom: 14px; }
  .section-sub { font-size: 0.78rem; color: #555; margin: 0 0 8px; }
  .empty-note { font-size: 0.85rem; color: #666; font-style: italic; margin: 0 0 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 0.78rem; margin-bottom: 8px; }
  th, td { border: 1px solid #bbb; padding: 7px; text-align: left; vertical-align: top; color: #111; }
  th { background: #f0f0f0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @page { margin: 12mm; }
  @media print { body { margin: 0; } h2 { page-break-before: auto; } }
</style></head><body>
  <h1>${escapeHtml(nomePatio)} — Listagens do pátio</h1>
  <div class="meta">${escapeHtml(metaLine)}</div>
  ${sections.join("")}
</body></html>`;

        printHtmlInHiddenIframe(html, {
          iframeTitle: "Impressão listagens do pátio",
          closeModalId: "patioPrintModal",
        });
      }

      function toLocalInput(dateValue) {
        if (!dateValue) return "";
        const date = new Date(dateValue);
        const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
        return local.toISOString().slice(0, 16);
      }

      function calcTotal(vehicle) {
        if (!vehicle?.data_entrada || !vehicle?.valor_diaria) return 0;
        const start = new Date(vehicle.data_entrada);
        const end = vehicle.data_saida ? new Date(vehicle.data_saida) : new Date();
        const diffMs = end - start;
        const days = Math.max(1, Math.ceil(diffMs / 86400000));
        return days * Number(vehicle.valor_diaria);
      }

      /** Cabeçalhos HTML de valores nas impressões do pátio (vazio para gestor de pista). */
      function patioPrintMoneyHeaderHtml() {
        return isGestorPista ? "" : "<th>Diária</th><th>Total estimado</th>";
      }

      /** Células HTML de diária + total estimado (vazio para gestor de pista). */
      function patioPrintMoneyCellsHtml(v) {
        if (isGestorPista) return "";
        const vd = Number(v?.valor_diaria);
        const diaria = Number.isFinite(vd) && vd >= 0 ? vd : 0;
        return `<td>${escapeHtml(formatCurrency(diaria))}</td><td>${escapeHtml(formatCurrency(calcTotal(v)))}</td>`;
      }

      /** O veículo está em permanência no pátio em algum momento do dia civil local `dayYmd` (YYYY-MM-DD)? */
      function vehicleStayIncludesLocalCalendarDay(vehicle, dayYmd) {
        if (!vehicle?.data_entrada || !dayYmd) return false;
        const start = toLocalYmd(vehicle.data_entrada);
        if (!start || dayYmd < start) return false;
        if (!vehicle.data_saida) return true;
        const end = toLocalYmd(vehicle.data_saida);
        if (!end) return true;
        return dayYmd <= end;
      }

      /** Valor de diária «gerado» só naquele dia civil: 1× valor_diária se houver permanência nesse dia. */
      function calcDiariaValorGeradoNoDiaLocal(vehicle, dayYmd) {
        if (!vehicleStayIncludesLocalCalendarDay(vehicle, dayYmd)) return 0;
        const vd = Number(vehicle.valor_diaria);
        if (!vd || vd <= 0) return 0;
        return vd;
      }

      /** Soma das diárias «geradas» (permanência × valor da diária) em todos os dias do mês YYYY-MM. */
      function sumDiariasGeradasNoMes(monthYm, vehicles) {
        if (!monthYm || !vehicles?.length) return 0;
        const [yy, mm] = monthYm.split("-").map((x) => Number(x));
        if (!yy || !mm) return 0;
        const last = new Date(yy, mm, 0).getDate();
        let total = 0;
        for (let d = 1; d <= last; d++) {
          const dayYmd = `${yy}-${String(mm).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          for (const v of vehicles) {
            total += calcDiariaValorGeradoNoDiaLocal(v, dayYmd);
          }
        }
        return total;
      }

      function sumCashPagamentosNoMes(monthYm, cashList) {
        if (!monthYm || !cashList) return 0;
        return cashList
          .filter((m) => {
            const ymd = toLocalYmd(m.data_movimento || m.created_at);
            return ymd && yearMonthFromYmd(ymd) === monthYm && m.tipo_conta === "PAGAR";
          })
          .reduce((s, m) => s + Number(m.valor || 0), 0);
      }

      function isCashMovementSangria(mov, payableById) {
        if (!mov || mov.tipo_conta !== "PAGAR") return false;
        const desc = String(mov.descricao || "").toUpperCase();
        if (desc.includes("SANGRIA")) return true;
        const payable = payableById.get(String(mov.conta_id || ""));
        const cat = String(payable?.payable_category || "").toUpperCase();
        return cat === "SANGRIA_CAIXA";
      }

      function sumCashSangriaNoMes(monthYm, cashList, payables) {
        if (!monthYm || !Array.isArray(cashList)) return 0;
        const payableById = new Map((Array.isArray(payables) ? payables : []).map((p) => [String(p.id), p]));
        return cashList
          .filter((m) => {
            const ymd = toLocalYmd(m.data_movimento || m.created_at);
            if (!ymd || yearMonthFromYmd(ymd) !== monthYm) return false;
            return isCashMovementSangria(m, payableById);
          })
          .reduce((s, m) => s + Number(m.valor || 0), 0);
      }

      function sumCashPagamentosNoDia(dayYmd, cashList) {
        if (!dayYmd || !cashList) return 0;
        return cashList
          .filter((m) => m.tipo_conta === "PAGAR" && toLocalYmd(m.data_movimento || m.created_at) === dayYmd)
          .reduce((s, m) => s + Number(m.valor || 0), 0);
      }

      function formatFinanceExtratoDayLabel(dayYmd) {
        const todayYmd = toLocalYmd(new Date().toISOString());
        if (dayYmd === todayYmd) return "Hoje";
        const [ty, tm, td] = todayYmd.split("-").map((x) => Number(x));
        const prev = new Date(ty, tm - 1, td);
        prev.setDate(prev.getDate() - 1);
        const py = prev.getFullYear();
        const pm = String(prev.getMonth() + 1).padStart(2, "0");
        const pd = String(prev.getDate()).padStart(2, "0");
        if (dayYmd === `${py}-${pm}-${pd}`) return "Ontem";
        const parts = (dayYmd || "").split("-");
        if (parts.length !== 3) return dayYmd || "—";
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }

      function vehiclesDiariasAggregatedForDay(dayYmd, vehicles) {
        const rows = [];
        for (const v of vehicles || []) {
          const val = calcDiariaValorGeradoNoDiaLocal(v, dayYmd);
          if (val > 0) rows.push({ vehicle: v, val });
        }
        rows.sort((a, b) =>
          String(a.vehicle.placa || "").localeCompare(String(b.vehicle.placa || ""), "pt-BR")
        );
        return rows;
      }

      function countVeiculosOperacaoPatio() {
        const st = ["NO_PATIO", "LIBERACAO_SOLICITADA", "LIBERACAO_CONFIRMADA", "REMocao_CONFIRMADA"];
        return (state.vehicles || []).filter((v) => st.includes(v.status)).length;
      }

      function calcPeriodTotal(vehicle, periodStart, periodEnd) {
        return calcFinanceChargeBreakdown(vehicle, periodStart, periodEnd).total;
      }

      /** Detalhamento da cobrança na saída do veículo (diárias, remoção e taxas). */
      function calcFinanceChargeBreakdown(vehicle, periodStart, periodEnd, opts = {}) {
        const valorDiaria = Number(vehicle?.valor_diaria || 0);
        const start = periodStart ? new Date(periodStart) : vehicle?.data_entrada ? new Date(vehicle.data_entrada) : null;
        const end = periodEnd
          ? new Date(periodEnd)
          : vehicle?.data_saida
            ? new Date(vehicle.data_saida)
            : new Date();
        const dias = start ? Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000)) : calcDays(vehicle);
        const diariasTotal = dias * valorDiaria;
        const aplicarRemocao = opts.aplicarRemocao != null ? !!opts.aplicarRemocao : isRemocaoSolicitada(vehicle);
        const taxaRemocao = aplicarRemocao ? Number(state.settings?.taxa_remocao || 0) : 0;
        const taxasAdicionais = Number(opts.taxasAdicionais || 0);
        const total = diariasTotal + taxaRemocao + taxasAdicionais;
        return {
          dias,
          valorDiaria,
          diariasTotal,
          taxaRemocao,
          taxasAdicionais,
          total,
          periodStart: start ? start.toISOString() : null,
          periodEnd: end.toISOString(),
        };
      }

      function receivableFinanceBreakdown(receivable, vehicle) {
        const { meta } = financeMetaUnpack(receivable?.observacoes);
        if (meta?.calculo_patio) return meta.calculo_patio;
        return calcFinanceChargeBreakdown(
          vehicle,
          receivable?.period_start,
          receivable?.period_end || vehicle?.data_saida,
          { aplicarRemocao: meta?.aplicar_remocao, taxasAdicionais: meta?.taxas_adicionais }
        );
      }

      function financeAuditReadAll() {
        try {
          const raw = localStorage.getItem(FINANCE_AUDIT_KEY);
          const obj = JSON.parse(raw || "{}");
          return obj && typeof obj === "object" ? obj : {};
        } catch (e) {
          return {};
        }
      }

      function financeAuditAppend(receivableId, action, details = {}) {
        if (!receivableId) return;
        const all = financeAuditReadAll();
        const key = String(receivableId);
        const entry = {
          at: new Date().toISOString(),
          action,
          user: state.session?.user?.email || state.session?.user?.id || "Sistema",
          ...details,
        };
        all[key] = [...(all[key] || []), entry];
        try {
          localStorage.setItem(FINANCE_AUDIT_KEY, JSON.stringify(all));
        } catch (e) {
          console.warn("finance audit", e);
        }
      }

      function financeAuditHtml(receivableId) {
        const rows = (financeAuditReadAll()[String(receivableId)] || []).slice().reverse();
        if (!rows.length) return `<p class="notice">Nenhum histórico registrado.</p>`;
        return rows
          .map((e) => {
            const when = formatDate(e.at);
            const extra = e.note || e.observacao || e.valor != null ? ` · ${escapeHtml(String(e.note || e.observacao || formatCurrency(e.valor)))}` : "";
            return `<div class="finance-lanc-item" style="padding:6px 0;border-bottom:1px solid var(--border)">
              <strong>${escapeHtml(e.action || "Alteração")}</strong>
              <span class="notice" style="display:block;margin-top:2px">${escapeHtml(when)} · ${escapeHtml(e.user || "—")}${extra}</span>
            </div>`;
          })
          .join("");
      }

      function financeCobrancaNumero(r) {
        if (!r?.id) return "—";
        const ymd = toLocalYmd(r.period_end || r.created_at || new Date().toISOString());
        const seq = String(r.id).replace(/-/g, "").slice(0, 6).toUpperCase();
        return ymd ? `CR-${ymd.replace(/-/g, "")}-${seq}` : `CR-${seq}`;
      }

      function financeIsAguardandoFaturamentoView(view) {
        const v = financeNormalizeSubview(view);
        return v === "aguardando_faturamento" || v === "triagem";
      }

      function financeReceivableOperacionalStatus(r, todayYmd, flags = {}) {
        if (!r) return { label: "—", class: "warning" };
        if (receivableSemCobrancaFinanceira(r) && r.status === "PAGO") {
          return { label: "Sem cobrança", class: "success" };
        }
        if (flags.isento) return { label: "Cancelado", class: "danger" };
        if (r.status === "CANCELADO") return { label: "Cancelado", class: "danger" };
        if (r.status === "PAGO") return { label: "Pago", class: "success" };
        if (receivableNaFilaAguardandoTriagem(r)) return { label: "Aguardando Faturamento", class: "warning" };
        const valorCobranca = Number(r.valor || 0);
        const movRec = (state.cash || []).find((m) => m.tipo_conta === "RECEBER" && String(m.conta_id) === String(r.id));
        const pagoParcial = !!(movRec && Number(movRec.valor || 0) > 0 && r.status !== "PAGO" && Number(movRec.valor || 0) < valorCobranca);
        if (pagoParcial) return { label: "Pago Parcialmente", class: "warning" };
        const dueYmd = financeContaDueYmd(r, "receivable");
        const isOverdue = !!(dueYmd && todayYmd && dueYmd < todayYmd);
        if (isOverdue) return { label: "Vencido", class: "danger" };
        if (receivableIsContaReceberFinanceiro(r)) return { label: "Aguardando Pagamento", class: "warning" };
        return { label: "Aguardando Pagamento", class: "warning" };
      }

      function renderFinanceCalculoDetalheHtml(receivable, vehicle) {
        const b = receivableFinanceBreakdown(receivable, vehicle);
        const vm = vehicle ? [vehicle.marca, vehicle.modelo].filter(Boolean).join(" ") : "—";
        return `
          <div style="line-height:1.6;font-size:13px">
            <p><strong>Placa:</strong> ${escapeHtml(vehicle?.placa || "—")}</p>
            <p><strong>Veículo:</strong> ${escapeHtml(vm)}</p>
            <p><strong>Cliente:</strong> ${escapeHtml(receivable?.responsavel_pagamento || "—")}</p>
            <p><strong>Entrada:</strong> ${escapeHtml(formatDate(receivable?.period_start || vehicle?.data_entrada))}</p>
            <p><strong>Saída:</strong> ${escapeHtml(formatDate(receivable?.period_end || vehicle?.data_saida))}</p>
            <hr style="border:none;border-top:1px solid var(--border);margin:10px 0" />
            <p><strong>Dias armazenados:</strong> ${b.dias}</p>
            <p><strong>Valor diária:</strong> ${escapeHtml(formatCurrency(b.valorDiaria))}</p>
            <p><strong>Total diárias:</strong> ${escapeHtml(formatCurrency(b.diariasTotal))}</p>
            <p><strong>Taxa de remoção:</strong> ${escapeHtml(formatCurrency(b.taxaRemocao))}</p>
            <p><strong>Taxas adicionais:</strong> ${escapeHtml(formatCurrency(b.taxasAdicionais))}</p>
            <p><strong>Total da cobrança:</strong> ${escapeHtml(formatCurrency(b.total || receivable?.valor || 0))}</p>
          </div>`;
      }

      function startOfLocalDayIso(dateStr) {
        // dateStr: "YYYY-MM-DD"
        const [y, m, d] = (dateStr || "").split("-").map((v) => Number(v));
        if (!y || !m || !d) return null;
        const local = new Date(y, m - 1, d, 0, 0, 0, 0);
        return local.toISOString();
      }

      function endOfPreviousLocalDayIso(dateStr) {
        const start = startOfLocalDayIso(dateStr);
        if (!start) return null;
        const startMs = new Date(start).getTime();
        return new Date(startMs - 1).toISOString();
      }

      /** Último instante do dia local YYYY-MM-DD (23:59:59.999). */
      function endOfLocalDayIso(dateStr) {
        const [y, m, d] = (dateStr || "").split("-").map((v) => Number(v));
        if (!y || !m || !d) return null;
        const nextMidnight = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
        return new Date(nextMidnight.getTime() - 1).toISOString();
      }

      /** Início do dia local seguinte ao YYYY-MM-DD informado (novo ciclo). */
      function startOfNextLocalDayIso(dateStr) {
        const [y, m, d] = (dateStr || "").split("-").map((v) => Number(v));
        if (!y || !m || !d) return null;
        return new Date(y, m - 1, d + 1, 0, 0, 0, 0).toISOString();
      }

      function formatNextCalendarDayPt(dateStr) {
        const [y, m, d] = (dateStr || "").split("-").map((v) => Number(v));
        if (!y || !m || !d) return "";
        const dt = new Date(y, m - 1, d + 1);
        const dd = String(dt.getDate()).padStart(2, "0");
        const mm = String(dt.getMonth() + 1).padStart(2, "0");
        const yy = dt.getFullYear();
        return `${dd}/${mm}/${yy}`;
      }

      function calcDays(vehicle) {
        if (!vehicle?.data_entrada) return 0;
        const start = new Date(vehicle.data_entrada);
        const end = vehicle.data_saida ? new Date(vehicle.data_saida) : new Date();
        const diffMs = end - start;
        return Math.max(1, Math.ceil(diffMs / 86400000));
      }

      function calcHours(vehicle) {
        if (!vehicle?.data_entrada) return 0;
        const start = new Date(vehicle.data_entrada);
        const end = vehicle.data_saida ? new Date(vehicle.data_saida) : new Date();
        const diffMs = end - start;
        return Math.max(0, Math.floor(diffMs / 3600000));
      }

      function setEmptyRow(tbody, message, columns) {
        const colspan = columns || 6;
        tbody.innerHTML = `<tr><td class="empty" colspan="${colspan}">${message}</td></tr>`;
      }

      function applyTheme(theme) {
        document.documentElement.setAttribute("data-theme", theme);
        if (themeLabel) {
          themeLabel.textContent = theme === "dark" ? "Tema escuro" : "Tema claro";
        }
      }

      applyTheme("dark");

      function setStatus(message, type) {
        if (!authStatus) return;
        authStatus.textContent = message;
        authStatus.className = "status " + (type || "");
      }

      function stylizeLogo() {
        return;
      }

      function toggleAuthTab(isLogin) {
        tabLogin.classList.toggle("active", isLogin);
        tabRegister.classList.toggle("active", !isLogin);
        loginForm.classList.toggle("hidden", !isLogin);
        registerForm.classList.toggle("hidden", isLogin);
        setStatus("", "");
      }

      tabLogin.addEventListener("click", () => toggleAuthTab(true));
      tabRegister.addEventListener("click", () => toggleAuthTab(false));

      stylizeLogo();

      function normalizeManagerLogin(raw) {
        return (raw || "")
          .toString()
          .trim()
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9._-]/g, ".")
          .replace(/\.+/g, ".")
          .replace(/^\.|\.$/g, "");
      }

      function managerLoginToEmail(loginRaw) {
        const norm = normalizeManagerLogin(loginRaw);
        if (!norm) return "";
        return `${norm}@gestor.invalid`;
      }

      function resolveManagerIdentityToEmail(inputRaw) {
        const raw = (inputRaw || "").trim();
        if (!raw) return "";
        if (raw.includes("@")) return raw.toLowerCase();
        return managerLoginToEmail(raw);
      }

      function displayManagerIdentity(emailOrLogin) {
        const s = (emailOrLogin || "").trim();
        if (!s) return "—";
        const m = s.match(/^([a-z0-9._-]+)@gestor\.(local|invalid)$/i);
        if (m) return m[1];
        return s;
      }

      loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!supabase) {
          setStatus(
            "Não foi possível carregar o sistema (rede ou bloqueador). Use Wi-Fi, desative bloqueio de scripts/CDN e recarregue.",
            "error"
          );
          return;
        }
        setStatus("Entrando...", "");
        const loginInput = document.getElementById("loginEmail").value.trim();
        const email = resolveManagerIdentityToEmail(loginInput);
        const password = document.getElementById("loginPassword").value;
        if (!email) {
          setStatus("Informe o utilizador ou o e-mail.", "error");
          return;
        }

        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setStatus(error.message, "error");
          return;
        }
        setStatus("Login realizado com sucesso.", "success");
      });

      registerForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!supabase) {
          setStatus(
            "Não foi possível carregar o sistema (rede ou bloqueador). Recarregue a página ou tente outra rede.",
            "error"
          );
          return;
        }
        setStatus("Criando conta...", "");
        const loginRaw = document.getElementById("registerUsername").value.trim();
        const password = document.getElementById("registerPassword").value;
        if (!loginRaw) {
          setStatus("Informe o nome de utilizador.", "error");
          return;
        }
        if (!password || password.length < 6) {
          setStatus("A senha deve ter pelo menos 6 caracteres.", "error");
          return;
        }
        const email = resolveManagerIdentityToEmail(loginRaw);
        if (!email) {
          setStatus("Nome de utilizador inválido.", "error");
          return;
        }
        if (!loginRaw.includes("@") && !isValidManagerLogin(loginRaw)) {
          setStatus(
            "Nome de utilizador inválido: use 3 a 48 caracteres (letras, números, ponto, hífen ou underscore), ou um e-mail completo com @.",
            "error"
          );
          return;
        }

        function formatRegisterError(msg) {
          const m = (msg || "").toLowerCase();
          if (/rate limit|429|email rate limit|too many requests|over_email_send_rate|exceeded/i.test(m)) {
            return (
              "Limite de e-mails do Supabase (muitas confirmações enviadas). " +
              "No painel: Authentication → Providers → Email → desative «Confirm email» para contas de teste, " +
              "ou aguarde ~1 hora. Com o deploy atual, o registo normal usa o servidor e não depende desse e-mail."
            );
          }
          return msg || "Erro ao registar.";
        }

        const registerApiUrl = new URL("/api/register", window.location.origin).href;
        try {
          const regResp = await fetch(registerApiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ loginRaw, password }),
          });
          const regJson = await regResp.json().catch(() => ({}));
          if (regResp.ok) {
            const { error: signErr } = await supabase.auth.signInWithPassword({ email, password });
            if (signErr) {
              setStatus(
                `Conta criada, mas o login automático falhou: ${signErr.message}. Use a aba «Entrar» com o mesmo utilizador e senha.`,
                "error"
              );
              return;
            }
            setStatus("Conta criada e sessão iniciada.", "success");
            return;
          }
          if (regResp.status !== 404) {
            if (regResp.status === 422 || regResp.status === 409) {
              const signTry = await supabase.auth.signInWithPassword({ email, password });
              if (!signTry.error) {
                setStatus("Este utilizador já estava registado. Sessão iniciada.", "success");
                return;
              }
            }
            setStatus(formatRegisterError(regJson?.error || `Erro ${regResp.status}`), "error");
            return;
          }
        } catch (e) {
          console.warn("register_api", e);
        }

        const { error } = await supabase.auth.signUp({ email, password });
        if (error) {
          setStatus(formatRegisterError(error.message), "error");
          return;
        }
        setStatus("Conta criada. Entre na aba «Entrar» com o mesmo utilizador e senha.", "success");
      });

      logoutBtn.addEventListener("click", async () => {
        if (supabase) await supabase.auth.signOut();
      });

      async function showApp(user) {
        authPanel.classList.add("hidden");
        appPanel.classList.remove("hidden");
        document.getElementById("appHeaderMenuWrap")?.classList.remove("hidden");
        userInfo.textContent = user ? `Logado como ${displayManagerIdentity(user.email || "")}` : "Logado";
        state.user = user;
        await loadPatioDelegatedRole();
        applyRoleRestrictions();
        loadAll();
      }

      function showAuth() {
        authPanel.classList.remove("hidden");
        appPanel.classList.add("hidden");
        document.getElementById("appHeaderMenuWrap")?.classList.add("hidden");
        document.body.classList.remove("menus-no-modulo");
        lastAppHeaderModuleView = null;
        closeAppHeaderMenu();
        userInfo.textContent = "Não autenticado";
        state.user = null;
        state.patioOwnerUserId = null;
        isGestorPista = false;
        document.getElementById("gestorPistaWelcomeBanner")?.classList.add("hidden");
      }

      async function loadPatioDelegatedRole() {
        isGestorPista = false;
        state.patioOwnerUserId = null;
        try {
          if (!supabase || !state?.user?.id) return false;
          let { data, error } = await supabase
            .from("track_managers")
            .select("owner_user_id, role")
            .eq("user_id", state.user.id)
            .maybeSingle();
          if (error && /role|column|schema cache|PGRST204/i.test(error.message || "")) {
            const r2 = await supabase
              .from("track_managers")
              .select("owner_user_id")
              .eq("user_id", state.user.id)
              .maybeSingle();
            data = r2.data || null;
            error = r2.error;
          }
          if (error || !data || !data.owner_user_id) {
            if (error) console.warn("track_managers", error);
            return false;
          }
          state.patioOwnerUserId = data.owner_user_id;
          isGestorPista = true;
          return true;
        } catch (e) {
          console.warn("track_managers: load failed", e);
          return false;
        }
      }

      function applyRoleRestrictions() {
        document.getElementById("track-manager-hide-values-style")?.remove();
        document.getElementById("vehicleForm")?.classList.remove("operador-simplified");
        document.querySelectorAll("#appHeaderMenu .header-menu-details").forEach((el) => el.classList.remove("hidden"));
        document.querySelectorAll("#headerDetailsLista [data-lista-gestor-hide], #listaSubnav [data-lista-gestor-hide]").forEach((el) => {
          el.classList.remove("hidden");
        });
        document.querySelectorAll("#headerDetailsPatio [data-header-patio-sub]").forEach((el) => el.classList.remove("hidden"));
        document.querySelectorAll("#appHeaderMenu button[data-view]").forEach((btn) => {
          btn.style.display = "";
        });
        document.getElementById("openParceirosFromPatio")?.classList.remove("hidden");
        document.getElementById("openParceirosFromFinanceiro")?.classList.remove("hidden");
        document.getElementById("openConfigFromPatio")?.classList.remove("hidden");
        document.getElementById("openConfigFromFinanceiro")?.classList.remove("hidden");
        patioSubnav?.querySelector('[data-subview="removidos"]')?.classList.remove("hidden");
        patioSubnav?.querySelector('[data-subview="fechando_ciclo"]')?.classList.remove("hidden");
        const vehicleDailyReset = document.getElementById("vehicleDaily");
        const vehicleDailyWrap = vehicleDailyReset?.closest("div");
        if (vehicleDailyWrap) vehicleDailyWrap.style.display = "";
        if (vehicleDailyReset) vehicleDailyReset.required = true;

        document.getElementById("gestorPistaWelcomeBanner")?.classList.add("hidden");
        if (!isGestorPista) {
          document.getElementById("dashboardSystemEntry")?.classList.remove("dashboard-system-entry--single");
          document.getElementById("dashboardModuleFinanceWrap")?.classList.remove("hidden");
          document.getElementById("financeTopDashboard")?.classList.remove("hidden");
          showMainView("dashboard");
          return;
        }

        try {
          navStack.splice(0, navStack.length, "patio", "patio:inicio");
        } catch (e) {
          console.warn("navStack", e);
        }

        const hideGestorMainNavItem = (btn) => {
          const view = btn.getAttribute("data-view");
          if (!view) return;
          btn.style.display = view === "dashboard" ? "" : "none";
        };
        document.querySelectorAll("#appHeaderMenu button[data-view]").forEach(hideGestorMainNavItem);
        document.getElementById("headerDetailsFinance")?.classList.add("hidden");
        document.getElementById("headerDetailsConfig")?.classList.add("hidden");
        document.getElementById("headerDetailsParceiros")?.classList.add("hidden");
        document.querySelectorAll("#headerDetailsLista [data-lista-gestor-hide], #listaSubnav [data-lista-gestor-hide]").forEach((el) => {
          el.classList.add("hidden");
        });
        document
          .querySelectorAll(
            '#headerDetailsPatio [data-header-patio-sub="removidos"], #headerDetailsPatio [data-header-patio-sub="fechando_ciclo"]'
          )
          .forEach((el) => el.classList.add("hidden"));
        document.getElementById("dashboardModuleFinanceWrap")?.classList.add("hidden");
        document.getElementById("financeTopDashboard")?.classList.add("hidden");
        document.getElementById("dashboardSystemEntry")?.classList.add("dashboard-system-entry--single");
        document.getElementById("openConfigFromPatio")?.classList.add("hidden");
        document.getElementById("openConfigFromFinanceiro")?.classList.add("hidden");

        showMainView("patio");
        setPatioView("inicio");

        document.getElementById("openParceirosFromPatio")?.classList.add("hidden");
        document.getElementById("openParceirosFromFinanceiro")?.classList.add("hidden");
        patioSubnav?.querySelector('[data-subview="removidos"]')?.classList.add("hidden");
        patioSubnav?.querySelector('[data-subview="fechando_ciclo"]')?.classList.add("hidden");

        const style = document.createElement("style");
        style.id = "track-manager-hide-values-style";
        let css = `
          #viewPatio [data-subview="no_patio"] table thead th:nth-child(6),
          #viewPatio [data-subview="no_patio"] table tbody td:nth-child(6) {
            display: none !important;
          }
          #viewPatio [data-subview="removidos"] table thead th:nth-child(7),
          #viewPatio [data-subview="removidos"] table tbody td:nth-child(7) {
            display: none !important;
          }
          #viewPatio [data-subview="fechando_ciclo"] table thead th:nth-child(7),
          #viewPatio [data-subview="fechando_ciclo"] table tbody td:nth-child(7) {
            display: none !important;
          }
        `;
        css += `
          #vehicleForm.operador-simplified .field-operador-hide { display: none !important; }
        `;
        style.textContent = css;
        document.head.appendChild(style);

        document.getElementById("gestorPistaWelcomeBanner")?.classList.remove("hidden");
      }

      async function bootstrap() {
        initTabModalSystem();
        bindFinanceDashboardUiOnce();
        if (!supabase) {
          showAuth();
          setStatus(
            "Sem conexão com o servidor de login. Confira a internet, use https:// neste site e desative bloqueador de anúncios para cdn.jsdelivr.net.",
            "error"
          );
          return;
        }
        try {
          const { data, error } = await supabase.auth.getSession();
          if (error) {
            console.error(error);
            showAuth();
            setStatus("Não foi possível verificar a sessão. Recarregue a página.", "error");
            return;
          }
          if (data.session && data.session.user) {
            showApp(data.session.user);
          } else {
            showAuth();
          }
        } catch (e) {
          console.error(e);
          showAuth();
          setStatus("Erro ao iniciar. Recarregue ou tente outro navegador.", "error");
        }
      }

      if (supabase) {
        supabase.auth.onAuthStateChange((event, session) => {
          if (event === "SIGNED_OUT" || event === "TOKEN_REFRESH_FAILED") {
            showAuth();
            setStatus("Sessão expirada. Faça login novamente.", "error");
            return;
          }
          if (session && session.user) {
            showApp(session.user);
          } else {
            showAuth();
          }
        });
      }

      async function loadPartners() {
        const { data, error } = await supabase
          .from("partners")
          .select("*")
          .eq("user_id", effectiveUserId())
          .order("created_at", { ascending: false });
        if (error) {
          console.error(error);
          return;
        }
        state.partners = data || [];
        renderPartners();
        renderPartnerOptions();
        maybeRefreshListaPanel();
      }

      async function loadVehicles() {
        const { data, error } = await supabase
          .from("vehicles")
          .select("*")
          .eq("user_id", effectiveUserId())
          .order("data_entrada", { ascending: false });
        if (error) {
          console.error(error);
          return;
        }
        state.vehicles = data || [];
        renderVehicles();
        maybeRefreshListaPanel();
      }

      async function loadReceivables() {
        const { data, error } = await supabase
          .from("receivables")
          .select("*")
          .eq("user_id", effectiveUserId())
          .order("created_at", { ascending: false });
        if (error) {
          console.error(error);
          return;
        }
        state.receivables = data || [];
        maybeRefreshListaPanel();
      }

      async function loadCycleClosures() {
        const { data, error } = await supabase
          .from("patio_cycle_closures")
          .select("*")
          .eq("user_id", effectiveUserId())
          .order("created_at", { ascending: false });
        if (error) {
          if (!isMissingRelationError(error)) console.error(error);
          state.cycleClosures = [];
          return;
        }
        state.cycleClosures = data || [];
      }

      async function loadPayables() {
        const { data, error } = await supabase
          .from("payables")
          .select("*")
          .eq("user_id", effectiveUserId())
          .order("created_at", { ascending: false });
        if (error) {
          console.error(error);
          return;
        }
        state.payables = data || [];
        maybeRefreshListaPanel();
      }

      async function loadCash() {
        const { data, error } = await supabase
          .from("cash_movements")
          .select("*")
          .eq("user_id", effectiveUserId())
          .order("created_at", { ascending: false });
        if (error) {
          console.error(error);
          return;
        }
        state.cash = data || [];
        maybeRefreshListaPanel();
      }

      async function loadSettings() {
        const { data, error } = await supabase
          .from("settings")
          .select("*")
          .eq("user_id", effectiveUserId())
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error && error.code !== "PGRST116") {
          console.error(error);
          return;
        }
        state.settings = data || null;
        if (state.settings) {
          settingsCnpj.value = state.settings.cnpj || "";
          settingsName.value = state.settings.nome_patio || "";
          if (settingsEndereco) settingsEndereco.value = state.settings.endereco || "";
          if (settingsReciboEmitente) settingsReciboEmitente.value = state.settings.recibo_emitente_nome || "";
          if (settingsReciboTelefone) settingsReciboTelefone.value = state.settings.recibo_telefone || "";
          settingsBank.value = state.settings.conta_bancaria || "";
          settingsCharge.value = state.settings.texto_cobranca || "";
          settingsInvoice.value = state.settings.texto_nota_fiscal || "";
          if (!state.settings.operational_month && state.settings.id) {
            const curYm = currentYearMonthLocal();
            const { error: opErr } = await supabase
              .from("settings")
              .update({ operational_month: curYm })
              .eq("id", state.settings.id);
            if (!opErr) state.settings.operational_month = curYm;
          }
        }
        maybeRefreshListaPanel();
      }

      function currentYearMonthLocal() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      }

      function addOneYearMonth(ym) {
        const [y, m] = ym.split("-").map(Number);
        const d = new Date(y, m, 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      }

      function formatYearMonthLong(ym) {
        if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return ym || "—";
        const [y, m] = ym.split("-").map(Number);
        const names = [
          "Janeiro",
          "Fevereiro",
          "Março",
          "Abril",
          "Maio",
          "Junho",
          "Julho",
          "Agosto",
          "Setembro",
          "Outubro",
          "Novembro",
          "Dezembro",
        ];
        return `${names[m - 1]} de ${y}`;
      }

      function toLocalYmd(iso) {
        if (!iso) return null;
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return null;
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      }

      function yearMonthFromYmd(ymd) {
        if (!ymd || ymd.length < 7) return null;
        return ymd.slice(0, 7);
      }

      function lastDayOfYearMonth(ym) {
        const [y, m] = ym.split("-").map(Number);
        const last = new Date(y, m, 0);
        return `${y}-${String(m).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
      }

      function getOperationalMonth() {
        const op = state.settings?.operational_month;
        if (op && /^\d{4}-\d{2}$/.test(op)) return op;
        return currentYearMonthLocal();
      }

      function computeMonthClosureStats(ym) {
        const first = `${ym}-01`;
        const last = lastDayOfYearMonth(ym);
        let entered = 0;
        let exited = 0;
        let inYardEnd = 0;
        (state.vehicles || []).forEach((v) => {
          const entYmd = toLocalYmd(v.data_entrada);
          if (!entYmd) return;
          if (yearMonthFromYmd(entYmd) === ym) entered++;
          if (v.data_saida) {
            const saiYmd = toLocalYmd(v.data_saida);
            if (saiYmd && yearMonthFromYmd(saiYmd) === ym) exited++;
          }
          if (entYmd > last) return;
          if (v.data_saida) {
            const saiYmd = toLocalYmd(v.data_saida);
            if (saiYmd && saiYmd <= last) return;
          }
          inYardEnd++;
        });

        let revenue = 0;
        let expense = 0;
        (state.cash || []).forEach((mov) => {
          const ds = (mov.data_movimento || mov.created_at || "").toString().slice(0, 10);
          if (!ds || ds < first || ds > last) return;
          const val = Number(mov.valor || 0);
          if (mov.tipo_conta === "RECEBER") revenue += val;
          if (mov.tipo_conta === "PAGAR") expense += val;
        });

        const openRec = (state.receivables || [])
          .filter((r) => receivableIsContaReceberFinanceiro(r))
          .reduce((s, r) => s + Number(r.valor || 0), 0);
        const openPag = (state.payables || [])
          .filter((p) => p.status === "EM_ABERTO")
          .reduce((s, p) => s + Number(p.valor || 0), 0);
        const caixa = (state.cash || []).reduce((sum, mov) => {
          if (mov.tipo_conta === "PAGAR") return sum - Number(mov.valor || 0);
          return sum + Number(mov.valor || 0);
        }, 0);

        return { entered, exited, inYardEnd, revenue, expense, openRec, openPag, caixa };
      }

      async function loadMonthlyClosures() {
        state.monthlyClosures = [];
        state.monthlyClosureLoadError = null;
        if (!supabase || !state.user?.id) return;
        const { data, error } = await supabase
          .from("monthly_closures")
          .select("*")
          .eq("user_id", effectiveUserId())
          .order("year_month", { ascending: false });
        if (error) {
          state.monthlyClosureLoadError = error.message || String(error);
          return;
        }
        state.monthlyClosures = data || [];
      }

      function renderFinanceClosurePanel() {
        const hint = document.getElementById("closureSetupHint");
        const btn = document.getElementById("btnCloseOperationalMonth");
        const status = document.getElementById("closureOperationalStatus");
        const opYm = getOperationalMonth();
        const nextYm = addOneYearMonth(opYm);
        document.getElementById("closureOperationalTitle").textContent = formatYearMonthLong(opYm);
        document.getElementById("closureNextMonth").textContent = formatYearMonthLong(nextYm);

        if (state.monthlyClosureLoadError) {
          if (hint) {
            hint.textContent =
              "Não foi possível carregar fechamentos. Rode o SQL em supabase/monthly_closures.sql no Supabase e recarregue. Erro: " +
              state.monthlyClosureLoadError;
            hint.classList.remove("hidden");
          }
          if (btn) btn.disabled = true;
        } else {
          if (hint) hint.classList.add("hidden");
          if (btn) btn.disabled = false;
        }

        const st = computeMonthClosureStats(opYm);
        document.getElementById("closurePrevEntradas").textContent = String(st.entered);
        document.getElementById("closurePrevSaidas").textContent = String(st.exited);
        document.getElementById("closurePrevPatioFim").textContent = String(st.inYardEnd);
        document.getElementById("closurePrevReceita").textContent = formatCurrency(st.revenue);
        document.getElementById("closurePrevDespesa").textContent = formatCurrency(st.expense);
        document.getElementById("closurePrevRecAberto").textContent = formatCurrency(st.openRec);
        document.getElementById("closurePrevPagAberto").textContent = formatCurrency(st.openPag);
        document.getElementById("closurePrevCaixa").textContent = formatCurrency(st.caixa);

        const closedSet = new Set((state.monthlyClosures || []).map((r) => r.year_month));
        if (btn) {
          btn.disabled = !!state.monthlyClosureLoadError || closedSet.has(opYm);
        }
        if (status) {
          if (state.monthlyClosureLoadError) {
            status.textContent = "Erro";
            status.className = "tag danger";
          } else if (closedSet.has(opYm)) {
            status.textContent = "Encerrado";
            status.className = "tag warning";
          } else {
            status.textContent = "Aberto";
            status.className = "tag success";
          }
        }

        const tbody = document.getElementById("closureHistoryBody");
        if (!tbody) return;
        const rows = state.monthlyClosures || [];
        if (!rows.length) {
          tbody.innerHTML = `<tr><td colspan="8"><em>Nenhum mês encerrado ainda.</em></td></tr>`;
          return;
        }
        tbody.innerHTML = rows
          .map((r) => {
            const dt = r.closed_at ? formatDateTime(r.closed_at) : "—";
            return `<tr>
              <td>${formatYearMonthLong(r.year_month)}</td>
              <td>${r.vehicles_entered}</td>
              <td>${r.vehicles_exited}</td>
              <td>${r.vehicles_in_yard_end}</td>
              <td>${formatCurrency(r.revenue_in_month)}</td>
              <td>${formatCurrency(r.expense_in_month)}</td>
              <td>${formatCurrency(r.cash_balance_end)}</td>
              <td>${dt}</td>
            </tr>`;
          })
          .join("");
      }

      async function loadAll() {
        if (isGestorPista) {
          await Promise.all([loadPartners(), loadVehicles()]);
          probeVehiclesRpfColumns().catch(() => {});
          return;
        }
        await Promise.all([
          loadPartners(),
          loadVehicles(),
          loadReceivables(),
          loadCycleClosures(),
          loadPayables(),
          loadCash(),
          loadSettings(),
          loadMonthlyClosures(),
        ]);
        probeVehiclesRpfColumns().catch(() => {});
        const userId = effectiveUserId();
        if (userId && !FINANCE_MANUAL_ONLY) {
          // Competência: tentativa automática diária (espelho contábil), sem bloquear o fluxo legado.
          callFinanceCompetencyApi("/api/finance/generate-daily-charges", { userId }).catch((e) =>
            console.warn("finance competency daily job", e?.message || e)
          );
        }
        renderFinance();
        updateDashboard();
      }

      function renderDashboardFinanceCharts(period, svgIds) {
        const ids = svgIds || {
          flow: "dashboardCashFlowSvg",
          balance: "dashboardBalanceSvg",
          compare: "dashboardCompareSvg",
          expense: "dashboardExpenseCategorySvg",
          clients: "dashboardTopClientsSvg",
          aging: "dashboardAgingSvg",
        };
        const mode = ["dia", "semana", "mes"].includes(period) ? period : "mes";
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const buckets = [];
        const bucketMap = new Map();
        const mkYmd = (date) =>
          `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        const addBucket = (key, label) => {
          const bucket = { key, label, entrada: 0, saida: 0 };
          buckets.push(bucket);
          bucketMap.set(key, bucket);
        };
        if (mode === "dia") {
          for (let i = 13; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const key = mkYmd(d);
            addBucket(key, `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`);
          }
        } else if (mode === "semana") {
          const base = new Date(today);
          const day = base.getDay();
          const diffToMonday = day === 0 ? 6 : day - 1;
          base.setDate(base.getDate() - diffToMonday);
          for (let i = 7; i >= 0; i--) {
            const d = new Date(base);
            d.setDate(d.getDate() - i * 7);
            const key = mkYmd(d);
            addBucket(key, `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`);
          }
        } else {
          for (let i = 5; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            addBucket(key, String(d.getMonth() + 1).padStart(2, "0"));
          }
        }
        if (!buckets.length) return;
        const firstKey = buckets[0].key;
        let saldoInicial = 0;
        (state.cash || []).forEach((mov) => {
          const ymd = toLocalYmd(mov.data_movimento || mov.created_at);
          if (!ymd) return;
          let key = null;
          if (mode === "dia") key = ymd;
          else if (mode === "semana") {
            const d = new Date(`${ymd}T00:00:00`);
            const day = d.getDay();
            const diffToMonday = day === 0 ? 6 : day - 1;
            d.setDate(d.getDate() - diffToMonday);
            key = mkYmd(d);
          } else key = yearMonthFromYmd(ymd);
          const val = Number(mov.valor || 0);
          const signed = mov.tipo_conta === "PAGAR" ? -val : val;
          if (key && bucketMap.has(key)) {
            if (mov.tipo_conta === "PAGAR") bucketMap.get(key).saida += val;
            else bucketMap.get(key).entrada += val;
          } else if ((mode === "mes" && yearMonthFromYmd(ymd) < firstKey) || (mode !== "mes" && ymd < firstKey)) {
            saldoInicial += signed;
          }
        });
        const maxFlow = Math.max(1, ...buckets.map((b) => b.entrada), ...buckets.map((b) => b.saida));
        const flowPointsIn = buckets
          .map((b, i) => `${18 + (i * 320) / Math.max(1, buckets.length - 1)},${108 - (b.entrada / maxFlow) * 84}`)
          .join(" ");
        const flowPointsOut = buckets
          .map((b, i) => `${18 + (i * 320) / Math.max(1, buckets.length - 1)},${108 - (b.saida / maxFlow) * 84}`)
          .join(" ");
        const flowSvg = document.getElementById(ids.flow);
        if (flowSvg) {
          flowSvg.innerHTML = `
            <polyline points="${flowPointsIn}" fill="none" stroke="#38bdf8" stroke-width="3"></polyline>
            <polyline points="${flowPointsOut}" fill="none" stroke="#f87171" stroke-width="3"></polyline>
          `;
        }
        const saldos = [];
        let saldo = saldoInicial;
        buckets.forEach((b) => {
          saldo += b.entrada - b.saida;
          saldos.push(saldo);
        });
        const minSaldo = Math.min(0, ...saldos);
        const maxSaldo = Math.max(1, ...saldos);
        const spanSaldo = Math.max(1, maxSaldo - minSaldo);
        const saldoPoints = saldos
          .map((v, i) => `${18 + (i * 320) / Math.max(1, saldos.length - 1)},${108 - ((v - minSaldo) / spanSaldo) * 84}`)
          .join(" ");
        const balanceSvg = document.getElementById(ids.balance);
        if (balanceSvg) {
          balanceSvg.innerHTML = `<polyline points="${saldoPoints}" fill="none" stroke="#e11d2e" stroke-width="3"></polyline>`;
        }
        const compareSvg = document.getElementById(ids.compare);
        if (compareSvg) {
          const slot = 320 / Math.max(1, buckets.length);
          const barW = Math.max(6, Math.min(16, slot / 3));
          compareSvg.innerHTML = buckets
            .map((b, i) => {
              const x = 18 + i * slot + slot * 0.2;
              const hIn = Math.max(2, (b.entrada / maxFlow) * 84);
              const hOut = Math.max(2, (b.saida / maxFlow) * 84);
              return `
                <rect x="${x}" y="${108 - hIn}" width="${barW}" height="${hIn}" rx="3" fill="#60a5fa"></rect>
                <rect x="${x + barW + 3}" y="${108 - hOut}" width="${barW}" height="${hOut}" rx="3" fill="#fb7185"></rect>
              `;
            })
            .join("");
        }
        const topExpenseCategories = [...(state.payables || [])]
          .reduce((acc, p) => {
            const cat =
              (p.payable_category || p.categoria || p.centro_custo || p.subcategoria || "Outros").toString().trim() || "Outros";
            acc.set(cat, (acc.get(cat) || 0) + Number(p.valor || 0));
            return acc;
          }, new Map());
        const expenseRows = [...topExpenseCategories.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);
        const expenseMax = Math.max(1, ...expenseRows.map(([, v]) => v));
        const expenseSvg = document.getElementById(ids.expense);
        if (expenseSvg) {
          expenseSvg.innerHTML = expenseRows.length
            ? expenseRows
                .map(([name, value], idx) => {
                  const y = 10 + idx * 23;
                  const w = 180 * (value / expenseMax);
                  return `
                    <text x="8" y="${y + 11}" font-size="9" fill="currentColor">${escapeHtml(name).slice(0, 18)}</text>
                    <rect x="150" y="${y}" width="${w}" height="10" rx="3" fill="#fb7185"></rect>
                    <text x="${155 + w}" y="${y + 9}" font-size="9" fill="currentColor">${escapeHtml(formatCurrency(value))}</text>
                  `;
                })
                .join("")
            : `<text x="8" y="20" font-size="10" fill="currentColor">Sem despesas lançadas.</text>`;
        }
        const topClientsMap = [...(state.receivables || [])]
          .reduce((acc, r) => {
            const client = (r.responsavel_pagamento || r.cliente || "Sem cliente").toString().trim() || "Sem cliente";
            acc.set(client, (acc.get(client) || 0) + Number(r.valor || 0));
            return acc;
          }, new Map());
        const topClients = [...topClientsMap.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);
        const topClientsMax = Math.max(1, ...topClients.map(([, v]) => v));
        const topClientsSvg = document.getElementById(ids.clients);
        if (topClientsSvg) {
          topClientsSvg.innerHTML = topClients.length
            ? topClients
                .map(([name, value], idx) => {
                  const y = 10 + idx * 23;
                  const w = 180 * (value / topClientsMax);
                  return `
                    <text x="8" y="${y + 11}" font-size="9" fill="currentColor">${escapeHtml(name).slice(0, 18)}</text>
                    <rect x="150" y="${y}" width="${w}" height="10" rx="3" fill="#60a5fa"></rect>
                    <text x="${155 + w}" y="${y + 9}" font-size="9" fill="currentColor">${escapeHtml(formatCurrency(value))}</text>
                  `;
                })
                .join("")
            : `<text x="8" y="20" font-size="10" fill="currentColor">Sem clientes lançados.</text>`;
        }
        const agingBuckets = [
          { key: "vencido", label: "Vencido", receber: 0, pagar: 0 },
          { key: "d0_30", label: "0-30", receber: 0, pagar: 0 },
          { key: "d31_60", label: "31-60", receber: 0, pagar: 0 },
          { key: "d61p", label: "61+", receber: 0, pagar: 0 },
        ];
        const daysUntil = (ymd) => {
          if (!ymd) return null;
          const due = new Date(`${ymd}T00:00:00`);
          const diff = Math.floor((due.getTime() - today.getTime()) / 86400000);
          return Number.isFinite(diff) ? diff : null;
        };
        const placeAging = (days, amount, side) => {
          if (days == null) return;
          let bucket = null;
          if (days < 0) bucket = agingBuckets[0];
          else if (days <= 30) bucket = agingBuckets[1];
          else if (days <= 60) bucket = agingBuckets[2];
          else bucket = agingBuckets[3];
          bucket[side] += amount;
        };
        (state.receivables || []).forEach((r) => {
          if (r.status === "PAGO") return;
          const ymd = toLocalYmd(r.data_vencimento || r.period_end || r.created_at);
          placeAging(daysUntil(ymd), Number(r.valor || 0), "receber");
        });
        (state.payables || []).forEach((p) => {
          if (p.status === "PAGO") return;
          const ymd = toLocalYmd(p.data_vencimento || p.created_at);
          placeAging(daysUntil(ymd), Number(p.valor || 0), "pagar");
        });
        const agingMax = Math.max(1, ...agingBuckets.map((b) => b.receber), ...agingBuckets.map((b) => b.pagar));
        const agingSvg = document.getElementById(ids.aging);
        if (agingSvg) {
          agingSvg.innerHTML = agingBuckets
            .map((b, idx) => {
              const x = 18 + idx * 78;
              const hr = Math.max(2, (b.receber / agingMax) * 72);
              const hp = Math.max(2, (b.pagar / agingMax) * 72);
              return `
                <rect x="${x}" y="${104 - hr}" width="20" height="${hr}" rx="3" fill="#60a5fa"></rect>
                <rect x="${x + 24}" y="${104 - hp}" width="20" height="${hp}" rx="3" fill="#fb7185"></rect>
                <text x="${x}" y="118" font-size="9" fill="currentColor">${b.label}</text>
              `;
            })
            .join("");
        }
      }

      function sumReceivableFaturadoByMonth(monthYm, receivables) {
        if (!monthYm || !Array.isArray(receivables)) return 0;
        return receivables.reduce((sum, r) => {
          if (FINANCE_MANUAL_ONLY && !isManualFinanceLancamento(r)) return sum;
          if (!r.vehicle_id) return sum;
          const ymd = toLocalYmd(r.period_end || r.created_at);
          if (!ymd || yearMonthFromYmd(ymd) !== monthYm) return sum;
          return sum + Number(r.valor || 0);
        }, 0);
      }

      function renderFinanceOperacionalDashboard(monthYm) {
        const todayYmd = toLocalYmd(new Date().toISOString());
        const receberFlags = financeReceberFlagsRead();
        const patioReceivables = (state.receivables || []).filter((r) => !FINANCE_MANUAL_ONLY || isManualFinanceLancamento(r));
        const emAbertoList = patioReceivables.filter((r) => {
          const flags = receberFlags[String(r.id)] || {};
          if (flags.isento) return false;
          if (r.status === "PAGO") return false;
          return receivableIsContaReceberFinanceiro(r) || receivableNaFilaAguardandoTriagem(r);
        });
        const faturadoMes = sumReceivableFaturadoByMonth(monthYm, state.receivables);
        const recebidoMes = sumReceivableRevenueByMonth(monthYm, state.receivables, state.cash || []);
        const emAberto = emAbertoList.reduce((sum, r) => sum + Number(r.valor || 0), 0);
        const vencidosList = emAbertoList.filter((r) => {
          if (receivableNaFilaAguardandoTriagem(r)) return false;
          const due = financeContaDueYmd(r, "receivable");
          return !!(due && todayYmd && due < todayYmd);
        });
        const vencido = vencidosList.reduce((sum, r) => sum + Number(r.valor || 0), 0);
        const _setOp = (id, txt) => {
          const el = document.getElementById(id);
          if (el) el.textContent = txt;
        };
        _setOp("fdFaturadoMes", formatCurrency(faturadoMes));
        _setOp("fdFaturadoMesMeta", `Competência ${monthYm.slice(5, 7)}/${monthYm.slice(0, 4)}`);
        _setOp("fdRecebidoMes", formatCurrency(recebidoMes));
        _setOp("fdRecebidoMesMeta", "Pagamentos confirmados");
        _setOp("fdEmAberto", formatCurrency(emAberto));
        _setOp("fdEmAbertoMeta", `${emAbertoList.length} título(s)`);
        _setOp("fdVencido", formatCurrency(vencido));
        _setOp("fdVencidoMeta", `${vencidosList.length} título(s)`);
      }

      function renderFinanceResultadoDashboard(monthYm) {
        const entradas = sumReceivableRevenueByMonth(monthYm, state.receivables || [], state.cash || []);
        const saidasCash = sumCashPagamentosNoMes(monthYm, state.cash || []);
        const sangria = sumCashSangriaNoMes(monthYm, state.cash || [], state.payables || []);
        const saidas = Math.max(0, saidasCash - sangria);
        const lucro = entradas - saidas;
        const _setRes = (id, txt) => {
          const el = document.getElementById(id);
          if (el) el.textContent = txt;
        };
        _setRes("fdReceitasMes", formatCurrency(entradas));
        _setRes("fdDespesasMes", formatCurrency(saidas));
        _setRes("fdLucroLiquido", formatCurrency(lucro));
        _setRes("fdReceitasMesMeta", `Competência ${monthYm.slice(5, 7)}/${monthYm.slice(0, 4)}`);
        _setRes("fdDespesasMesMeta", "Saídas operacionais no período");
        _setRes("fdLucroLiquidoMeta", lucro >= 0 ? "Superavit no período" : "Deficit no período");
        const card = document.getElementById("fdLucroCard");
        if (card) {
          card.classList.remove("finance-ft-resumo-card--profit", "finance-ft-resumo-card--loss");
          card.classList.add(lucro >= 0 ? "finance-ft-resumo-card--profit" : "finance-ft-resumo-card--loss");
        }
      }

      function renderFinanceOperacionalCharts(period) {
        const today = new Date();
        const buckets = [];
        const count = period === "dia" ? 7 : period === "semana" ? 8 : 6;
        for (let i = count - 1; i >= 0; i--) {
          let label = "";
          let monthYm = "";
          if (period === "mes") {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            monthYm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            label = `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`;
          } else {
            const d = new Date(today);
            d.setDate(d.getDate() - i * (period === "semana" ? 7 : 1));
            monthYm = toLocalYmd(d.toISOString());
            label = period === "semana" ? `S${count - i}` : d.getDate().toString();
          }
          const faturado =
            period === "mes"
              ? sumReceivableFaturadoByMonth(monthYm, state.receivables)
              : 0;
          const recebido =
            period === "mes"
              ? sumReceivableRevenueByMonth(monthYm, state.receivables, state.cash || [])
              : sumReceivableRevenueByDay(monthYm, state.receivables, state.cash || []);
          buckets.push({ label, faturado, recebido });
        }
        const maxVal = Math.max(1, ...buckets.map((b) => b.faturado), ...buckets.map((b) => b.recebido));
        const renderBars = (svgId, key, color) => {
          const svg = document.getElementById(svgId);
          if (!svg) return;
          const slot = 320 / Math.max(1, buckets.length);
          const barW = Math.max(8, Math.min(28, slot * 0.55));
          svg.innerHTML = buckets
            .map((b, i) => {
              const x = 18 + i * slot + slot * 0.15;
              const h = Math.max(2, (b[key] / maxVal) * 84);
              return `
                <rect x="${x}" y="${108 - h}" width="${barW}" height="${h}" rx="3" fill="${color}"></rect>
                <text x="${x}" y="118" font-size="9" fill="currentColor">${escapeHtml(b.label)}</text>
              `;
            })
            .join("");
        };
        renderBars("ffFaturamentoMesSvg", "faturado", "#38bdf8");
        renderBars("ffRecebimentosMesSvg", "recebido", "#34d399");
        const todayYmd = toLocalYmd(today.toISOString());
        const receberFlags = financeReceberFlagsRead();
        let vencidoTotal = 0;
        let abertoNoPrazo = 0;
        (state.receivables || []).forEach((r) => {
          if (!receivableIsContaReceberFinanceiro(r) || r.status === "PAGO") return;
          if ((receberFlags[String(r.id)] || {}).isento) return;
          const val = Number(r.valor || 0);
          const due = financeContaDueYmd(r, "receivable");
          if (due && todayYmd && due < todayYmd) vencidoTotal += val;
          else abertoNoPrazo += val;
        });
        const inadSvg = document.getElementById("ffInadimplenciaSvg");
        if (inadSvg) {
          const total = Math.max(1, vencidoTotal + abertoNoPrazo);
          const hv = Math.max(2, (vencidoTotal / total) * 84);
          const ha = Math.max(2, (abertoNoPrazo / total) * 84);
          inadSvg.innerHTML = `
            <rect x="60" y="${108 - hv}" width="80" height="${hv}" rx="4" fill="#f87171"></rect>
            <rect x="200" y="${108 - ha}" width="80" height="${ha}" rx="4" fill="#60a5fa"></rect>
            <text x="60" y="118" font-size="9" fill="currentColor">Vencido</text>
            <text x="200" y="118" font-size="9" fill="currentColor">No prazo</text>
          `;
        }
      }

      function renderFinanceModuleCharts() {
        if (!financeIsDashboardView(currentFinanceView)) return;
        const monthKeyFin = financeCompetencia || currentYearMonthLocal();
        renderFinanceOperacionalDashboard(monthKeyFin);
        renderFinanceResultadoDashboard(monthKeyFin);
        const period = document.getElementById("financeChartPeriod")?.value || "mes";
        renderFinanceOperacionalCharts(period);
        renderDashboardFinanceCharts(period, { compare: "ffCompareSvg" });
      }

      function updateDashboard() {
        const noPatio = state.vehicles.filter((v) => v.status === "NO_PATIO");
        const vls = state.vehicles.filter((v) =>
          ["LIBERACAO_SOLICITADA", "LIBERACAO_CONFIRMADA", "REMocao_CONFIRMADA"].includes(v.status)
        );
        const todayYmd = toLocalYmd(new Date().toISOString());
        const currentYm = yearMonthFromYmd(todayYmd);
        const startOfWeekYmd = (() => {
          const now = new Date();
          const day = now.getDay();
          const diffToMonday = day === 0 ? 6 : day - 1;
          now.setHours(0, 0, 0, 0);
          now.setDate(now.getDate() - diffToMonday);
          const y = now.getFullYear();
          const m = String(now.getMonth() + 1).padStart(2, "0");
          const d = String(now.getDate()).padStart(2, "0");
          return `${y}-${m}-${d}`;
        })();
        const entradasHoje = state.vehicles.filter((v) => toLocalYmd(v.data_entrada) === todayYmd).length;
        const saidasHoje = state.vehicles.filter((v) => toLocalYmd(v.data_saida) === todayYmd).length;
        const entradasMes = state.vehicles.filter(
          (v) => yearMonthFromYmd(toLocalYmd(v.data_entrada)) === currentYm
        ).length;
        const saidasMes = state.vehicles.filter(
          (v) => yearMonthFromYmd(toLocalYmd(v.data_saida)) === currentYm
        ).length;
        const entradasSemana = state.vehicles.filter((v) => {
          const ymdEntrada = toLocalYmd(v.data_entrada);
          return ymdEntrada && ymdEntrada >= startOfWeekYmd && ymdEntrada <= todayYmd;
        }).length;
        const saidasSemana = state.vehicles.filter((v) => {
          const ymdSaida = toLocalYmd(v.data_saida);
          return ymdSaida && ymdSaida >= startOfWeekYmd && ymdSaida <= todayYmd;
        }).length;
        const elV = document.getElementById("cardVeiculos");
        const elS = document.getElementById("cardSolicitadas");
        const elEH = document.getElementById("cardEntradasHoje");
        const elSH = document.getElementById("cardSaidasHoje");
        const elSS = document.getElementById("cardSaidasSemana");
        const elEHMeta = document.getElementById("cardEntradasHojeMeta");
        const elSHMeta = document.getElementById("cardSaidasHojeMeta");
        const elSSMeta = document.getElementById("cardSaidasSemanaMeta");
        if (elV) elV.textContent = (noPatio.length + vls.length).toString();
        if (elS) elS.textContent = entradasMes.toString();
        if (elEH) elEH.textContent = saidasMes.toString();
        if (elSH) elSH.textContent = String(entradasSemana);
        if (elSS) elSS.textContent = String(saidasSemana);
        if (elEHMeta) elEHMeta.textContent = `Mês atual: ${currentYm}`;
        if (elSHMeta) elSHMeta.textContent = `Desde ${formatDateBr(startOfWeekYmd)}`;
        if (elSSMeta) elSSMeta.textContent = `Desde ${formatDateBr(startOfWeekYmd)}`;
        const elVrp = document.getElementById("cardVrp");
        const elNfse = document.getElementById("cardNfsePendente");
        if (elVrp) elVrp.textContent = String(entradasHoje);
        if (elNfse) elNfse.textContent = String(saidasHoje);
        const pdVnp = document.getElementById("patioDashVnp");
        const pdVlp = document.getElementById("patioDashVlp");
        const pdED = document.getElementById("patioDashEntradasDia");
        const pdSD = document.getElementById("patioDashSaidasDia");
        const pdES = document.getElementById("patioDashEntradasSemana");
        const pdSS = document.getElementById("patioDashSaidasSemana");
        const pdEM = document.getElementById("patioDashEntradasMes");
        const pdSM = document.getElementById("patioDashSaidasMes");
        if (pdVnp) pdVnp.textContent = String(noPatio.length);
        if (pdVlp) pdVlp.textContent = String(vls.length);
        if (pdED) pdED.textContent = String(entradasHoje);
        if (pdSD) pdSD.textContent = String(saidasHoje);
        if (pdES) pdES.textContent = String(entradasSemana);
        if (pdSS) pdSS.textContent = String(saidasSemana);
        if (pdEM) pdEM.textContent = String(entradasMes);
        if (pdSM) pdSM.textContent = String(saidasMes);

        // Cards financeiros do painel principal.
        const dashboardFinanceReceberValue = document.getElementById("dashboardFinanceReceberValue");
        const dashboardFinanceReceberMeta = document.getElementById("dashboardFinanceReceberMeta");
        const dashboardFinancePagarValue = document.getElementById("dashboardFinancePagarValue");
        const dashboardFinancePagarMeta = document.getElementById("dashboardFinancePagarMeta");
        const dashboardFinanceCaixaValue = document.getElementById("dashboardFinanceCaixaValue");
        const dashboardFinanceCaixaMeta = document.getElementById("dashboardFinanceCaixaMeta");
        const dashboardDiariasPatioValue = document.getElementById("dashboardDiariasPatioValue");
        const dashboardDiariasPatioMeta = document.getElementById("dashboardDiariasPatioMeta");
        const openReceivablesFinanceiro = (state.receivables || []).filter((r) => receivableIsContaReceberFinanceiro(r));
        const openPayablesFinanceiro = (state.payables || []).filter((p) => p.status === "EM_ABERTO");
        const totalReceberDashboard = openReceivablesFinanceiro.reduce((sum, r) => sum + Number(r.valor || 0), 0);
        const totalPagarDashboard = openPayablesFinanceiro.reduce((sum, p) => sum + Number(p.valor || 0), 0);
        const caixaDashboard = (state.cash || []).reduce((sum, mov) => {
          if (mov.tipo_conta === "PAGAR") return sum - Number(mov.valor || 0);
          return sum + Number(mov.valor || 0);
        }, 0);
        const veiculosNoPatioHoje = [...noPatio, ...vls];
        const diariasDemonstrativasHoje = veiculosNoPatioHoje.reduce(
          (sum, v) => sum + Number(calcDiariaValorGeradoNoDiaLocal(v, todayYmd) || 0),
          0
        );
        if (dashboardFinanceReceberValue) dashboardFinanceReceberValue.textContent = formatCurrency(totalReceberDashboard);
        if (dashboardFinanceReceberMeta) dashboardFinanceReceberMeta.textContent = `${openReceivablesFinanceiro.length} em aberto`;
        if (dashboardFinancePagarValue) dashboardFinancePagarValue.textContent = formatCurrency(totalPagarDashboard);
        if (dashboardFinancePagarMeta) dashboardFinancePagarMeta.textContent = `${openPayablesFinanceiro.length} em aberto`;
        if (dashboardFinanceCaixaValue) dashboardFinanceCaixaValue.textContent = formatCurrency(caixaDashboard);
        if (dashboardFinanceCaixaMeta)
          dashboardFinanceCaixaMeta.textContent = `Movimentações: ${(state.cash || []).length} · saldo consolidado`;
        if (dashboardDiariasPatioValue) dashboardDiariasPatioValue.textContent = formatCurrency(diariasDemonstrativasHoje);
        if (dashboardDiariasPatioMeta) dashboardDiariasPatioMeta.textContent = `${veiculosNoPatioHoje.length} no pátio (demonstrativo)`;

        const chartPeriodEl = document.getElementById("dashboardChartPeriod");
        const selectedPeriod = chartPeriodEl?.value || "mes";
        renderDashboardFinanceCharts(selectedPeriod);
        if (chartPeriodEl && !chartPeriodEl.dataset.bound) {
          chartPeriodEl.addEventListener("change", () => renderDashboardFinanceCharts(chartPeriodEl.value || "mes"));
          chartPeriodEl.dataset.bound = "1";
        }
      }

      /** Para busca: só letras/números; ignora hífen/espaço (consulta acontece apenas no OK). */
      function normalizePlateSearch(str) {
        return (str || "")
          .toString()
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "");
      }

      function vehiclePlateSearchActivityTs(v) {
        const parts = [v.updated_at, v.data_saida, v.data_entrada, v.nfse_requested_at, v.created_at].filter(Boolean);
        let best = 0;
        for (const p of parts) {
          const t = new Date(p).getTime();
          if (!Number.isNaN(t)) best = Math.max(best, t);
        }
        return best;
      }

      function pickMostRecentPlateVehicle(matches) {
        return [...matches].sort((a, b) => {
          const d = vehiclePlateSearchActivityTs(b) - vehiclePlateSearchActivityTs(a);
          if (d !== 0) return d;
          return String(b.id || "").localeCompare(String(a.id || ""), "pt-BR");
        })[0];
      }

      function resolvePlateSearchSubview(v) {
        if (!v) return "no_patio";
        if (v.status === "REMOVIDO") {
          const r = latestReceivableForVehicle(v.id);
          if (r && receivableNaFilaFechamentoCicloPatio(r)) return "removidos";
          return "removidos";
        }
        return "no_patio";
      }

      function syncPatioPlateInputFromHeader() {
        if (plateFilter && plateFilterPatio) plateFilterPatio.value = plateFilter.value;
      }

      function scrollPlateSearchVehicleIntoView(vehicleId) {
        if (vehicleId == null || vehicleId === "") return;
        const safe = String(vehicleId).replace(/"/g, "");
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const row = document.querySelector(`tr[data-vehicle-row="${safe}"]`);
            row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
          });
        });
      }

      /** Busca no financeiro: placa completa ou trecho (Mercosul ou antiga). */
      function plateNormMatchesQuery(storedNorm, queryNorm) {
        if (!queryNorm) return true;
        if (!storedNorm) return false;
        return storedNorm.includes(queryNorm) || queryNorm.includes(storedNorm);
      }

      /**
       * Consulta na base (não só a lista em memória): outro veículo não removido com a mesma placa
       * (ignora hífen/espaço e maiúsculas). excludeVehicleId = edição do próprio registo.
       */
      async function findActiveVehicleDuplicatePlacaRemote(placaInput, excludeVehicleId) {
        const norm = normalizePlateSearch(placaInput);
        if (!norm) return { queryError: null, duplicate: null };
        const { data, error } = await supabase
          .from("vehicles")
          .select("id,placa,status")
          .eq("user_id", effectiveUserId())
          .neq("status", "REMOVIDO");
        if (error) return { queryError: error, duplicate: null };
        const duplicate =
          (data || []).find(
            (v) =>
              (!excludeVehicleId || v.id !== excludeVehicleId) && normalizePlateSearch(v.placa) === norm
          ) || null;
        return { queryError: null, duplicate };
      }

      function partnerNomeNorm(nome) {
        return (nome || "")
          .toString()
          .trim()
          .toLowerCase()
          .replace(/\s+/g, " ");
      }

      function partnerDocDigits(cpf) {
        return (cpf || "").toString().replace(/\D/g, "");
      }

      function normalizePartnerType(type) {
        const raw = (type || "PARCEIRO").toString().trim().toUpperCase();
        if (raw === "PARCEIRO") return "LOCALIZADOR";
        return raw;
      }

      function isLocalizadorPartnerType(type) {
        return normalizePartnerType(type) === "LOCALIZADOR";
      }

      function isRpfPartnerType(type) {
        const t = normalizePartnerType(type || "PARCEIRO");
        return t === "LOCALIZADOR" || t === "INSTITUICAO_FINANCEIRA";
      }

      function partnerNomeById(partnerId) {
        const id = String(partnerId || "").trim();
        if (!id) return "";
        return (state.partners.find((p) => String(p.id) === id)?.nome || "").trim();
      }

      /** null = ainda não verificado; true/false = colunas responsavel_financeiro_* na tabela vehicles */
      let vehiclesRpfColumnsOk = null;

      async function probeVehiclesRpfColumns() {
        if (vehiclesRpfColumnsOk !== null) return vehiclesRpfColumnsOk;
        if (!supabase) {
          vehiclesRpfColumnsOk = false;
          return false;
        }
        const { error } = await supabase.from("vehicles").select("responsavel_financeiro_id").limit(1);
        if (!error) {
          vehiclesRpfColumnsOk = true;
          return true;
        }
        const msg = error.message || "";
        vehiclesRpfColumnsOk = !/responsavel_financeiro|PGRST204|column|schema cache/i.test(msg);
        return vehiclesRpfColumnsOk;
      }

      function readVehicleRpfFields() {
        const rpfId = String(vehicleFinancialResponsible?.value || "").trim() || null;
        let rpfNome = rpfId ? partnerNomeById(rpfId) : "";
        if (!rpfNome && rpfId && vehicleFinancialResponsible?.selectedOptions?.[0]) {
          const label = (vehicleFinancialResponsible.selectedOptions[0].textContent || "").trim();
          if (label && label !== "Sem RPF") rpfNome = label;
        }
        return {
          responsavel_financeiro_id: rpfId,
          responsavel_financeiro_nome: rpfId ? rpfNome || null : null,
        };
      }

      function partnerTypeFromSubview(view) {
        if (view === "assessorias") return "ASSESSORIA";
        if (view === "instituicoes_financeiras") return "INSTITUICAO_FINANCEIRA";
        if (view === "leiloeiros") return "LEILOEIRO";
        if (view === "remocoes") return "REMOCAO";
        return "LOCALIZADOR";
      }

      /** Parceiro/assessoria com mesmo nome (no mesmo tipo) ou mesmo documento (11+ dígitos). */
      function findDuplicatePartner({ nome, cpf, tipo, excludePartnerId }) {
        const t = normalizePartnerType(tipo || "LOCALIZADOR");
        const nameKey = partnerNomeNorm(nome);
        const doc = partnerDocDigits(cpf);
        const list = state.partners || [];
        return (
          list.find((p) => {
            if (excludePartnerId && p.id === excludePartnerId) return false;
            if (normalizePartnerType(p.tipo || "PARCEIRO") !== t) return false;
            if (nameKey && partnerNomeNorm(p.nome) === nameKey) return true;
            if (doc.length >= 11 && partnerDocDigits(p.cpf) === doc) return true;
            return false;
          }) || null
        );
      }

      function applyPlateSearchFromDashboard() {
        const raw = plateFilter.value.trim().toLowerCase();
        const norm = normalizePlateSearch(raw);
        if (norm.length === 0) {
          plateQuery = "";
          setPlateSearchHints("", false);
          syncPatioPlateInputFromHeader();
          renderVehicles();
          return;
        }
        setPlateSearchHints("", false);
        plateQuery = raw;
        syncPatioPlateInputFromHeader();
        const matches = (state.vehicles || []).filter((v) => normalizePlateSearch(v.placa) === norm);
        goToPatioForPlateSearch();
        if (matches.length) {
          const target = pickMostRecentPlateVehicle(matches);
          openPatioSubview(resolvePlateSearchSubview(target));
          renderVehicles();
          scrollPlateSearchVehicleIntoView(target.id);
        } else {
          renderVehicles();
        }
      }

      function renderVehicles() {
        const qNorm = normalizePlateSearch(plateQuery);
        const filteredVehicles = qNorm
          ? state.vehicles.filter((v) => normalizePlateSearch(v.placa) === qNorm)
          : state.vehicles;
        const byStatus = {
          NO_PATIO: [],
          LIBERACAO_SOLICITADA: [],
          LIBERACAO_CONFIRMADA: [],
          REMocao_CONFIRMADA: [],
          REMOVIDO: [],
        };
        filteredVehicles.forEach((v) => {
          if (byStatus[v.status]) {
            byStatus[v.status].push(v);
          }
        });
        const fechamentoCicloReceivables = (state.receivables || []).filter(
          (r) =>
            receivableNaFilaFechamentoCicloPatio(r) && filteredVehicles.some((v) => v.id === r.vehicle_id)
        );

        const vlsMerged = mergeVlsItems(byStatus);
        const vlsForTable = filterVlsToolbarItems(vlsMerged);
        const vlsToolbar = document.getElementById("vlsToolbarFilters");
        if (vlsToolbar) {
          vlsToolbar.classList.toggle("hidden", !!isGestorPista);
          if (!isGestorPista) {
            syncVlsFilterSelects();
          }
        }

        const vnpUnified = sortVnpUnifiedForDisplay([...vlsForTable, ...byStatus.NO_PATIO]);
        const patioCardTitle1 = document.getElementById("patioCardTitle1");
        const patioCardTitle2 = document.getElementById("patioCardTitle2");
        const patioCardTitle3 = document.getElementById("patioCardTitle3");
        const patioCardValue1 = document.getElementById("patioCardValue1");
        const patioCardValue2 = document.getElementById("patioCardValue2");
        const patioCardValue3 = document.getElementById("patioCardValue3");
        const patioCardMeta1 = document.getElementById("patioCardMeta1");
        const patioCardMeta2 = document.getElementById("patioCardMeta2");
        const patioCardMeta3 = document.getElementById("patioCardMeta3");
        if (currentPatioView === "removidos") {
          if (patioCardTitle1) patioCardTitle1.textContent = "VRP";
          if (patioCardTitle2) patioCardTitle2.textContent = "Valor total estimado";
          if (patioCardTitle3) patioCardTitle3.textContent = "Saídas registradas";
          if (patioCardValue1) patioCardValue1.textContent = String(byStatus.REMOVIDO.length);
          if (patioCardValue2)
            patioCardValue2.textContent = formatCurrency(
              byStatus.REMOVIDO.reduce((s, v) => s + (isGestorPista ? 0 : Number(calcTotal(v) || 0)), 0)
            );
          if (patioCardValue3) patioCardValue3.textContent = String(byStatus.REMOVIDO.filter((v) => !!v.data_saida).length);
          if (patioCardMeta1) patioCardMeta1.textContent = "veículos removidos";
          if (patioCardMeta2) patioCardMeta2.textContent = isGestorPista ? "valores ocultos" : "soma dos removidos";
          if (patioCardMeta3) patioCardMeta3.textContent = "com data de saída";
        } else if (currentPatioView === "fechando_ciclo") {
          if (patioCardTitle1) patioCardTitle1.textContent = "Fechando ciclo";
          if (patioCardTitle2) patioCardTitle2.textContent = "Valor aguardando faturamento";
          if (patioCardTitle3) patioCardTitle3.textContent = "Próximo passo";
          if (patioCardValue1) patioCardValue1.textContent = String(fechamentoCicloReceivables.length);
          if (patioCardValue2)
            patioCardValue2.textContent = formatCurrency(
              fechamentoCicloReceivables.reduce((s, r) => s + (isGestorPista ? 0 : Number(r.valor || 0)), 0)
            );
          if (patioCardValue3) patioCardValue3.textContent = "Financeiro";
          if (patioCardMeta1) patioCardMeta1.textContent = "ciclos nesta fila";
          if (patioCardMeta2) patioCardMeta2.textContent = isGestorPista ? "valores ocultos" : "soma dos ciclos";
          if (patioCardMeta3) patioCardMeta3.textContent = "Vai para Receber após OK";
        } else {
          if (patioCardTitle1) patioCardTitle1.textContent = "VNP";
          if (patioCardTitle2) patioCardTitle2.textContent = "Liberação";
          if (patioCardTitle3) patioCardTitle3.textContent = "Remoção solicitada";
          if (patioCardValue1) patioCardValue1.textContent = String(vnpUnified.length);
          if (patioCardValue2) patioCardValue2.textContent = String(vlsForTable.length);
          if (patioCardValue3)
            patioCardValue3.textContent = String(filteredVehicles.filter((v) => v.status === "NO_PATIO" && isRemocaoSolicitada(v)).length);
          if (patioCardMeta1) patioCardMeta1.textContent = "no pátio + fluxo";
          if (patioCardMeta2) patioCardMeta2.textContent = "em andamento";
          if (patioCardMeta3) patioCardMeta3.textContent = "antes da efetivação";
        }

        renderVnpUnifiedTable(tableNoPatio, vnpUnified);
        renderRemovedVehicles(tableRemovidos, byStatus.REMOVIDO);
        renderFechamentoCicloTable(tableFechamentoCiclo, fechamentoCicloReceivables);
        updateDashboard();

        if (qNorm) {
          applyGlobalPlateSearchLayout(byStatus, vlsForTable.length, fechamentoCicloReceivables.length);
        } else {
          setPlateSearchHints("", false);
          setPatioView(currentPatioView, { silent: true });
        }
      }

      function applyGlobalPlateSearchLayout(byStatus, vlsFilteredCount, fechandoCicloCount) {
        const vlsCount =
          typeof vlsFilteredCount === "number"
            ? vlsFilteredCount
            : mergeVlsItems(byStatus).length;
        const unifiedVnpCount = byStatus.NO_PATIO.length + vlsCount;
        const nFech = typeof fechandoCicloCount === "number" ? fechandoCicloCount : 0;
        const counts = {
          no_patio: unifiedVnpCount,
          removidos: byStatus.REMOVIDO.length,
          fechando_ciclo: nFech,
        };
        const total = counts.no_patio + counts.removidos + counts.fechando_ciclo;

        setPlateSearchHints(total === 0 ? "Nenhum veículo com esta placa." : "", total === 0);

        patioSubnav.querySelectorAll("button[data-subview]").forEach((btn) => {
          const key = btn.getAttribute("data-subview");
          const n = counts[key] || 0;
          btn.classList.toggle("active", n > 0);
        });

        if (total === 0) {
          patioSubviews.forEach((panel) => {
            panel.classList.remove("hidden");
          });
          return;
        }

        patioSubviews.forEach((panel) => {
          const key = panel.getAttribute("data-subview");
          const show = (counts[key] || 0) > 0;
          panel.classList.toggle("hidden", !show);
          if (show) {
            panel.classList.remove("air-open");
            void panel.offsetWidth;
            panel.classList.add("air-open");
          }
        });
      }

      function renderVnpUnifiedTable(tbody, items) {
        if (!items.length) {
          setEmptyRow(tbody, "Nenhum veículo no pátio.", 9);
          return;
        }
        const semValores = isGestorPista;
        tbody.innerHTML = items
          .map((v) => {
            const total = calcTotal(v);
            const localizador = state.partners.find((p) => p.id === v.localizador_id)?.nome || "-";
            const assessoria = state.partners.find((p) => p.id === v.assessoria_id)?.nome || "-";
            const rpfNome = vehicleRpfNome(v);
            const valorCell = semValores
              ? "-"
              : `${formatCurrency(total)}<span class="notice">(${calcDays(v)} diárias • ${calcHours(v)}h)</span>`;

            const emPipeline = v.status !== "NO_PATIO";
            const semValorDiaria = !v.valor_diaria || Number(v.valor_diaria) <= 0;
            const rowClasses = [];
            if (emPipeline || isRemocaoSolicitada(v)) rowClasses.push("vnp-row-liberacao");
            if (semValorDiaria) rowClasses.push("vnp-row-sem-valor");
            const rowClass = rowClasses.join(" ");
            const situacaoTags = [];
            if (emPipeline) {
              situacaoTags.push(
                `<span class="tag warning">${escapeHtml(VLS_STATUS_LABELS[v.status] || v.status || "-")}</span>`
              );
            }
            if (semValorDiaria) {
              situacaoTags.push(`<span class="tag danger">Sem valor</span>`);
            }
            if (v.status !== "REMocao_CONFIRMADA" && isRemocaoSolicitada(v)) {
              situacaoTags.push(`<span class="tag notice">Remoção solicitada</span>`);
            }
            const situacaoHtml =
              situacaoTags.length > 0 ? `<div class="vnp-situacao">${situacaoTags.join("")}</div>` : "";

            let actionsCell = "";
            if (isGestorPista) {
              if (v.status === "LIBERACAO_SOLICITADA") {
                actionsCell = `<button class="secondary" data-action="confirmar_liberacao" data-id="${v.id}">Liberação confirmada</button>`;
              } else {
                actionsCell = `<span class="notice">Sem permissão de ação</span>`;
              }
            } else {
              let fluxoBtn = "";
              if (v.status === "NO_PATIO") {
                fluxoBtn = `<button class="secondary" data-action="solicitar" data-id="${v.id}">Liberação solicitada</button>`;
              } else if (v.status === "LIBERACAO_SOLICITADA") {
                fluxoBtn = `<button class="secondary" data-action="confirmar_liberacao" data-id="${v.id}">Confirmar liberação</button>`;
              } else if (v.status === "LIBERACAO_CONFIRMADA") {
                fluxoBtn = `<button class="secondary" data-action="confirmar" data-id="${v.id}">VRP</button>`;
              } else if (v.status === "REMocao_CONFIRMADA") {
                fluxoBtn = `<button class="secondary" data-action="confirmar" data-id="${v.id}">VRP</button>`;
              }
              actionsCell = `
                  ${fluxoBtn}
                  <button class="secondary" data-action="ficha" data-id="${v.id}">Ficha</button>
                  ${nfseActionButtonHtml(v)}
                  <button class="secondary" data-action="voltar" data-id="${v.id}" title="Volta um passo no fluxo">Voltar</button>
                  <button class="secondary" data-action="editar" data-id="${v.id}">Editar</button>
                  <button class="secondary" data-action="apagar" data-id="${v.id}">Apagar</button>
                `;
            }

            return `
              <tr class="${rowClass}" data-vehicle-row="${v.id}">
                <td data-label="Placa">${v.placa || "-"}${situacaoHtml}</td>
                <td data-label="Registo">${patioRegistoBadgeHtml("vnp")}</td>
                <td data-label="Veículo">${[v.marca, v.modelo].filter(Boolean).join(" ") || "-"}</td>
                <td data-label="RPV">${localizador}</td>
                <td data-label="Assessoria">${assessoria}</td>
                <td data-label="RPF">${escapeHtml(rpfNome)}</td>
                <td data-label="Entrada">${formatDateTime(v.data_entrada)}</td>
                <td data-label="Valor">${valorCell}</td>
                <td class="actions" data-label="Ações">${actionsCell}</td>
              </tr>
            `;
          })
          .join("");
      }

      function setPatioView(view, opts = {}) {
        const silent = opts.silent === true;
        if (view === "liberacao_solicitada") view = "no_patio";
        if (view === "nfse_pendente") view = "no_patio";
        currentPatioView = view;
        const isNone = !view || view === "none";
        const isDashboard = view === "dashboard";
        const isInicio = view === "inicio";
        const isContentView = !isNone && !isDashboard && !isInicio;
        patioSubnav.querySelectorAll("button[data-subview]").forEach((btn) => {
          btn.classList.toggle("active", !isNone && btn.getAttribute("data-subview") === view);
        });
        document.getElementById("patioPlateSearchBar")?.classList.toggle("hidden", isDashboard || isInicio);
        const patioRoot = document.getElementById("viewPatio");
        patioRoot?.classList.remove("patio-flyout-open", "patio-subview-fullscreen");
        patioRoot?.classList.toggle("patio-subtab-modal-open", isContentView);
        patioFlyoutBackdrop?.classList.add("hidden");
        const patioContent = document.getElementById("patioContent");
        const patioInicioPanel = document.getElementById("patioInicioPanel");
        if (patioInicioPanel) patioInicioPanel.classList.toggle("hidden", !isInicio);
        if (patioContent) {
          patioContent.classList.toggle("hidden", !isContentView);
          if (isContentView) {
            ensureTabModalShell(patioContent, returnToPainelFromPatioFlyout);
            const meta = PATIO_TAB_LABELS[view] || { title: view, subtitle: "" };
            setTabModalMeta(patioContent, meta.title, meta.subtitle);
          }
        }
        let shownPanel = null;
        patioSubviews.forEach((panel) => {
          const match = !isNone && !isInicio && panel.getAttribute("data-subview") === view;
          panel.classList.toggle("hidden", !match);
          if (match) shownPanel = panel;
        });
        if (shownPanel && !silent) {
          shownPanel.classList.remove("air-open");
          void shownPanel.offsetWidth;
          shownPanel.classList.add("air-open");
        }
      }

      function setPartnerView(view) {
        currentPartnerView = view;
        const isNone = !view || view === "none";
        partnerSubnav.querySelectorAll("button").forEach((btn) => {
          btn.classList.toggle("active", !isNone && btn.getAttribute("data-subview") === view);
        });
        let shownPanel = null;
        partnerSubviews.forEach((panel) => {
          const match = !isNone && panel.getAttribute("data-subview") === view;
          panel.classList.toggle("hidden", !match);
          if (match) shownPanel = panel;
        });
        if (shownPanel) {
          shownPanel.classList.remove("air-open");
          void shownPanel.offsetWidth;
          shownPanel.classList.add("air-open");
        }
        if (view === "assessorias") openPartnerForm.textContent = "Nova assessoria";
        else if (view === "instituicoes_financeiras") openPartnerForm.textContent = "Nova instituição financeira";
        else if (view === "leiloeiros") openPartnerForm.textContent = "Novo leiloeiro";
        else if (view === "remocoes") openPartnerForm.textContent = "Novo serviço de remoção";
        else openPartnerForm.textContent = "Novo RPV";
        syncPartnerFormForCurrentView();
      }

      function syncPartnerFormForCurrentView() {
        const isAssessoria = currentPartnerView === "assessorias";
        if (partnerNameLabel) {
          if (currentPartnerView === "localizadores") partnerNameLabel.textContent = "Nome do RPV";
          else if (currentPartnerView === "assessorias") partnerNameLabel.textContent = "Nome da assessoria";
          else if (currentPartnerView === "instituicoes_financeiras")
            partnerNameLabel.textContent = "Nome da instituição financeira";
          else if (currentPartnerView === "leiloeiros") partnerNameLabel.textContent = "Nome do leiloeiro";
          else if (currentPartnerView === "remocoes") partnerNameLabel.textContent = "Nome do serviço de remoção";
          else partnerNameLabel.textContent = "Nome";
        }
        if (partnerDocLabel) partnerDocLabel.textContent = "CNPJ";
        if (partnerContactLabel) partnerContactLabel.textContent = "Pessoa de contato";
        if (partnerDocInput) {
          partnerDocInput.placeholder = "00.000.000/0000-00";
          partnerDocInput.required = isAssessoria;
        }
        if (partnerEmailWrap) partnerEmailWrap.classList.toggle("hidden", isAssessoria);
        if (isAssessoria && partnerEmailInput) partnerEmailInput.value = "";
      }

      function renderFechamentoCicloTable(tbody, items) {
        if (!tbody) return;
        if (!items.length) {
          setEmptyRow(
            tbody,
            "Nenhum ciclo aguardando esta triagem. Depois do VRP (saída efetiva), o registro aparece aqui até confirmar OK para o financeiro.",
            9
          );
          return;
        }
        const semValores = isGestorPista;
        tbody.innerHTML = items
          .map((c) => {
            const vehicle = state.vehicles.find((v) => v.id === c.vehicle_id);
            if (!vehicle) return "";
            const rpfNome =
              String(c.responsavel_financeiro || "").trim() ||
              state.partners.find((p) => p.id === vehicle.responsavel_financeiro_id)?.nome ||
              vehicle.responsavel_financeiro_nome ||
              "-";
            const nfEmitida = c.nf_emitida === true || vehicle.nfse_status === "EMITIDA";
            const nfEmitTag = nfEmitida
              ? `<span class="tag success">Emitida</span>`
              : `<span class="tag warning">${escapeHtml(vehicle.nfse_status || "-")}</span>`;
            const valorCiclo = semValores ? "-" : formatCurrency(Number(c.valor || 0));
            const nfEmitChecked = nfEmitida ? " checked" : "";
            const nfEnvChecked = c.nf_enviada === true || vehicleNfseEnviadaFlag(vehicle) ? " checked" : "";
            const pIni = c.period_start ? formatDate(c.period_start) : "-";
            const pFim = c.period_end ? formatDate(c.period_end) : vehicle.data_saida ? formatDate(vehicle.data_saida) : "-";
            const diarias = Number(c.diarias || 0);
            return `
              <tr data-closure-row="${c.id}" data-vehicle-row="${vehicle.id}">
                <td data-label="Placa">${escapeHtml(vehicle.placa || "-")}</td>
                <td data-label="Registo">${patioRegistoBadgeHtml("vrp")}</td>
                <td data-label="Veículo">${escapeHtml([vehicle.marca, vehicle.modelo].filter(Boolean).join(" ") || "-")}</td>
                <td data-label="RPF">${escapeHtml(rpfNome)}</td>
                <td data-label="NF emitida">${nfEmitTag}<label class="notice" style="display:block;margin-top:6px"><input type="checkbox" class="fechamento-check-nf-emitida"${nfEmitChecked}/> confirmo</label></td>
                <td data-label="NF enviada"><label><input type="checkbox" class="fechamento-check-nf-enviada"${nfEnvChecked}/> NF já enviada</label></td>
                <td data-label="Diárias / período">${diarias > 0 ? `${diarias} diária(s)` : "-"}<span class="notice" style="display:block">${escapeHtml(pIni)} -> ${escapeHtml(pFim)}</span></td>
                <td data-label="Valor do ciclo">${valorCiclo}</td>
                <td data-label="Triagem">
                  <label style="display:block;margin-bottom:6px"><input type="checkbox" class="fechamento-check-rpf"/> RPF conferido</label>
                  <button type="button" class="secondary" data-action="editar_fechamento_ciclo" data-id="${vehicle.id}" data-closure-id="${c.id}">Editar triagem</button>
                  ${
                    FINANCE_MANUAL_ONLY
                      ? `<span class="notice" style="display:block;margin-top:6px">Financeiro manual — registre em Lançamentos.</span>`
                      : `<button type="button" class="secondary" data-action="patio_liberar_financeiro" data-id="${vehicle.id}" data-closure-id="${c.id}">OK -> Financeiro</button>`
                  }
                </td>
              </tr>`;
          })
          .join("");
      }
      function renderRemovedVehicles(tbody, items) {
        if (!items.length) {
          setEmptyRow(tbody, "Nenhum veículo removido.", 10);
          return;
        }
        const semValores = isGestorPista;
        tbody.innerHTML = items
          .map((v) => {
            const total = calcTotal(v);
            const status = v.status === "REMOVIDO" ? "Removido" : "Outro";
            const localizador =
              state.partners.find((p) => p.id === v.localizador_id)?.nome || "-";
            const assessoria =
              state.partners.find((p) => p.id === v.assessoria_id)?.nome || "-";
            const rpfNome = vehicleRpfNome(v);

            const valorCell = semValores
              ? "-"
              : `${formatCurrency(total)}<span class="notice">(${calcDays(v)} diárias • ${calcHours(v)}h)</span>`;

            let actionsCell = "";
            if (isGestorPista) {
              actionsCell = `<span class="notice">Sem permissão de ação</span><span class="tag success">${status}</span>`;
            } else {
              actionsCell = `
                  <button class="secondary" data-action="ficha" data-id="${v.id}">Ficha</button>
                  <button class="secondary" data-action="voltar" data-id="${v.id}" title="Desfaz remoção feita por engano e volta para o passo anterior">Voltar</button>
                  ${nfseActionButtonHtml(v)}
                  <button class="secondary" data-action="editar" data-id="${v.id}">Editar</button>
                  <button class="secondary" data-action="apagar" data-id="${v.id}">Apagar</button>
                  <span class="tag success">${status}</span>
                `;
            }

            return `
              <tr data-vehicle-row="${v.id}">
                <td data-label="Placa">${v.placa || "-"}</td>
                <td data-label="Registo">${patioRegistoBadgeHtml("vrp")}</td>
                <td data-label="Veículo">${[v.marca, v.modelo].filter(Boolean).join(" ") || "-"}</td>
                <td data-label="RPV">${localizador}</td>
                <td data-label="Assessoria">${assessoria}</td>
                <td data-label="RPF">${escapeHtml(rpfNome)}</td>
                <td data-label="Entrada">${formatDateTime(v.data_entrada)}</td>
                <td data-label="Saída">${formatDateTime(v.data_saida)}</td>
                <td data-label="Valor">${valorCell}</td>
                <td class="actions" data-label="Ações">${actionsCell}</td>
              </tr>
            `;
          })
          .join("");
      }

      function buildNfseText(vehicle) {
        const dias = calcDays(vehicle);
        const total = formatCurrency(calcTotal(vehicle));
        const entrada = formatDate(vehicle.data_entrada);
        const saida = vehicle.data_saida ? formatDate(vehicle.data_saida) : formatDate(new Date());
        const placa = vehicle.placa || "-";
        const veiculo = [vehicle.marca, vehicle.modelo].filter(Boolean).join(" ") || "-";
        return `Serviço de guarda e custódia de veículo automotor realizado em pátio particular. Veículo: ${veiculo} de placa ${placa} Período de permanência:\n${entrada} a ${saida} (${dias} diárias) Valor total a pagar: ${total}. Dados para Pagamento: Fernando Vasconcellos de Albuquerque Lima CNPJ: 57.936.119/0001-98 Banco Inter (Código 077) Agência: 0001 Conta Corrente PJ: 44506284-3 PIX (CNPJ): 57.936.119/0001-98.`;
      }

      function nfseActionButtonHtml(vehicle) {
        const emitida = vehicle.nfse_status === "EMITIDA";
        const cls = emitida ? " nfse-action-btn--emitida" : "";
        return `<button type="button" class="secondary nfse-action-btn${cls}" data-action="nfse" data-id="${vehicle.id}">NFSe</button>`;
      }

      function resetNfseModalUi() {
        nfseCopyActions?.classList.remove("hidden");
        nfseConfirmActions?.classList.add("hidden");
        if (nfseCopyHint) nfseCopyHint.classList.remove("hidden");
      }

      async function cancelNfseModal() {
        const vid = nfseVehicleId;
        const prev = nfseStatusBeforeOpen;
        nfseModal?.classList.add("hidden");
        nfseVehicleId = null;
        nfseStatusBeforeOpen = null;
        resetNfseModalUi();
        if (!vid || !supabase) return;
        const current = state.vehicles.find((v) => String(v.id) === String(vid));
        if (
          prev &&
          prev !== "EMITIDA" &&
          current?.nfse_status === "PENDENTE" &&
          (prev === "NAO_SOLICITADA" || !prev)
        ) {
          await supabase
            .from("vehicles")
            .update({ nfse_status: "NAO_SOLICITADA", nfse_requested_at: null })
            .eq("id", vid)
            .eq("user_id", effectiveUserId());
          await loadVehicles();
          updateDashboard();
        }
        await refreshFichaIfOpen(vid);
      }

      const RECIBO_EMITENTE_PADRAO = "Fernando Vasconcellos de Albuquerque Lima";
      const RECIBO_CNPJ_PADRAO = "57.936.119/0001-98";
      const RECIBO_RODAPE_PADRAO = "Rua Marques de Baipendi, 119 — Campo Grande, Recife-PE — (81) 9 9991-8484";
      const RECIBO_PATIO_PADRAO = "AMPLIAUTO";

      function reciboEmitenteNome(settings) {
        const v = (settings?.recibo_emitente_nome || "").trim();
        return v || RECIBO_EMITENTE_PADRAO;
      }

      function reciboCnpjExibicao(settings) {
        const raw = (settings?.cnpj || "").trim();
        const fmt = formatCnpjForDisplay(raw);
        if (fmt) return fmt;
        if (raw.replace(/\D/g, "").length === 14) return formatCnpjForDisplay(raw) || RECIBO_CNPJ_PADRAO;
        return RECIBO_CNPJ_PADRAO;
      }

      function reciboFooterLine(settings) {
        const e = (settings?.endereco || "").trim().replace(/\n/g, " ");
        const t = (settings?.recibo_telefone || "").trim();
        if (e && t) return `${e} — ${t}`;
        if (e) return e;
        if (t) return t;
        return RECIBO_RODAPE_PADRAO;
      }

      function buildRecebimentoReciboText({ receivable, vehicle, destinatario, valor }) {
        const cfg = state.settings || {};
        const placa = vehicle?.placa || "-";
        const marca = vehicle?.marca || "";
        const modelo = vehicle?.modelo || "";
        const veiculoDesc = [marca, modelo].filter(Boolean).join(" ").trim() || "—";
        const emitente = reciboEmitenteNome(cfg);
        const cnpjFmt = reciboCnpjExibicao(cfg);
        const nomePatio = (cfg.nome_patio || "").trim() || RECIBO_PATIO_PADRAO;
        const dIni = receivable?.period_start ? formatDateBr(receivable.period_start) : "-";
        const dFim = receivable?.period_end ? formatDateBr(receivable.period_end) : "-";
        const dEntrada =
          vehicle?.data_entrada != null && vehicle.data_entrada !== ""
            ? formatDateBr(vehicle.data_entrada)
            : dIni;
        const dSaida =
          vehicle?.data_saida != null && vehicle.data_saida !== ""
            ? formatDateBr(vehicle.data_saida)
            : dFim;
        const corpo =
          `Eu, ${emitente}, inscrito no CNPJ ${cnpjFmt}, recebi a quantia de ${formatCurrency(
            valor
          )} do Sr(a). ${destinatario || "—"}, referente às estadias do veículo ${veiculoDesc}, placa ${placa}, em pátio particular ${nomePatio}, de ${dEntrada} a ${dSaida}.\n\nPor este documento, dou plena e total\nquitação referente ao pagamento das estadias referidas acima.`;
        const parts = [corpo, "", reciboFooterLine(cfg)];
        return parts.join("\n");
      }

      async function loadReciboLogoDataUrl() {
        const paths = ["/assets/recibo-header-logo.png", "/assets/logo.png"];
        for (const path of paths) {
          try {
            const r = await fetch(path, { cache: "force-cache" });
            if (!r.ok) continue;
            const blob = await r.blob();
            const mime = (blob.type || "").toLowerCase();
            const type = mime.includes("png") ? "PNG" : "JPEG";
            const dataUrl = await new Promise((resolve, reject) => {
              const fr = new FileReader();
              fr.onloadend = () => resolve(String(fr.result || ""));
              fr.onerror = reject;
              fr.readAsDataURL(blob);
            });
            return { dataUrl, type };
          } catch {
            /* tenta próximo ficheiro */
          }
        }
        return null;
      }

      async function downloadReciboPdf({ receivable, vehicle, destinatarioNome, destinatarioDoc, valor }) {
        await loadJsPdf();
        const jsPdfCtor = window.jspdf?.jsPDF;
        if (!jsPdfCtor) throw new Error("jsPDF indisponível");
        const doc = new jsPdfCtor({ unit: "pt", format: "a4" });
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const marginX = 48;
        const marginR = 48;
        const contentW = pageW - marginX - marginR;
        const footerBand = 46;
        const yFooterTop = pageH - footerBand;

        const s = state.settings || {};
        const emitente = reciboEmitenteNome(s);
        const cnpjFmt = reciboCnpjExibicao(s);
        const nomePatio = (s.nome_patio || "").trim() || RECIBO_PATIO_PADRAO;
        const pessoa = (destinatarioNome || "").trim() || "—";
        const pessoaDoc = (destinatarioDoc || "").trim() || "—";
        const placa = vehicle?.placa || "—";
        const marca = (vehicle?.marca || "").trim();
        const modelo = (vehicle?.modelo || "").trim();
        const veiculoDesc = [marca, modelo].filter(Boolean).join(" ").trim() || "—";
        const dIni = receivable?.period_start ? formatDateBr(receivable.period_start) : "—";
        const dFim = receivable?.period_end ? formatDateBr(receivable.period_end) : "—";
        const dEntrada =
          vehicle?.data_entrada != null && vehicle.data_entrada !== ""
            ? formatDateBr(vehicle.data_entrada)
            : dIni;
        const dSaida =
          vehicle?.data_saida != null && vehicle.data_saida !== ""
            ? formatDateBr(vehicle.data_saida)
            : dFim;
        const valorTxt = formatCurrency(valor);
        const footerLine = reciboFooterLine(s);

        const bandH = 76;
        doc.setFillColor(10, 11, 15);
        doc.rect(0, 0, pageW, bandH, "F");

        const logo = await loadReciboLogoDataUrl();
        if (logo) {
          try {
            const props = doc.getImageProperties(logo.dataUrl);
            const maxW = 260;
            const maxH = 40;
            let imgW = maxW;
            let imgH = (props.height * imgW) / props.width;
            if (imgH > maxH) {
              imgH = maxH;
              imgW = (props.width * imgH) / props.height;
            }
            const xL = (pageW - imgW) / 2;
            const yL = (bandH - imgH) / 2;
            doc.addImage(logo.dataUrl, logo.type, xL, yL, imgW, imgH);
          } catch {
            doc.setTextColor(255, 255, 255);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(17);
            doc.text(nomePatio.toUpperCase(), pageW / 2, bandH / 2 + 5, { align: "center" });
          }
        } else {
          doc.setTextColor(255, 255, 255);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(17);
          doc.text(nomePatio.toUpperCase(), pageW / 2, bandH / 2 + 5, { align: "center" });
        }

        doc.setDrawColor(220, 38, 38);
        doc.setLineWidth(1.1);
        doc.line(0, bandH, pageW, bandH);

        let y = bandH + 46;
        doc.setTextColor(15, 23, 42);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13.5);
        doc.text("RECIBO DE QUITAÇÃO DE ESTADIAS", pageW / 2, y, { align: "center" });
        y += 14;
        y += 26;

        const emitBoxH = 54;
        doc.setFillColor(248, 250, 252);
        doc.rect(marginX, y, contentW, emitBoxH, "F");
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.4);
        doc.rect(marginX, y, contentW, emitBoxH, "S");
        const yEmit = y + 14;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text("EMITENTE", marginX + 12, yEmit);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text(`${emitente},`, marginX + 12, yEmit + 14);
        doc.text(`inscrito no CNPJ ${cnpjFmt}.`, marginX + 12, yEmit + 28);
        y += emitBoxH + 18;

        const drawBar = (label) => {
          doc.setFillColor(51, 65, 85);
          doc.rect(marginX, y, contentW, 17, "F");
          doc.setTextColor(255, 255, 255);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5);
          doc.text(label, marginX + 10, y + 11.5);
          y += 21;
          doc.setTextColor(15, 23, 42);
        };

        const rowL = (label, value) => {
          const hasVal = String(value || "").trim().length > 0;
          if (!hasVal && label) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10.5);
            doc.setTextColor(15, 23, 42);
            const one = doc.splitTextToSize(label, contentW - 24);
            doc.text(one, marginX + 12, y + 11);
            y += Math.max(22, one.length * 12 + 10);
            return;
          }
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5);
          doc.setTextColor(100, 116, 139);
          doc.text(label, marginX + 12, y + 11);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10.5);
          doc.setTextColor(15, 23, 42);
          const lines = doc.splitTextToSize(value || "—", contentW - 118);
          doc.text(lines, marginX + 104, y + 11);
          y += Math.max(22, lines.length * 12 + 10);
        };

        drawBar("QUEM EFETUOU O PAGAMENTO");
        rowL("Nome:", pessoa);
        rowL("CPF / CNPJ:", pessoaDoc);
        y += 4;

        drawBar("VEÍCULO E PERÍODO");
        rowL("Veículo:", veiculoDesc);
        rowL("Placa:", placa);
        rowL("Estadias:", `${dEntrada} até ${dSaida}`);
        rowL("Valor recebido:", valorTxt);
        y += 20;
        doc.setFont("times", "italic");
        doc.setFontSize(10.5);
        doc.setTextColor(30, 41, 59);
        doc.text("Por este documento, dou plena e total", marginX + 12, y + 12);
        y += 15;
        doc.text("quitação referente ao pagamento das estadias referidas acima.", marginX + 12, y + 12);
        y += 28;

        y += 8;

        doc.setFont("helvetica", "italic");
        doc.setFontSize(9.5);
        doc.setTextColor(71, 85, 105);
        doc.text(`Local e data: Recife-PE, ${formatDateBr(new Date().toISOString())}.`, marginX + 10, y);
        y += 22;

        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.6);
        doc.line(marginX, yFooterTop - 2, marginX + contentW, yFooterTop - 2);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        const footLines = doc.splitTextToSize(footerLine, contentW - 8);
        let fy = yFooterTop + 10;
        footLines.forEach((ln) => {
          doc.text(ln, pageW / 2, fy, { align: "center" });
          fy += 11.5;
        });

        const safePlate = (placa || "veiculo").replace(/[^a-z0-9_-]+/gi, "_");
        doc.save(`recibo_recebimento_${safePlate}.pdf`);
      }

      function printReciboRecebimento({ receivable, vehicle, destinatarioNome, destinatarioDoc, valor }) {
        const s = state.settings || {};
        const emitente = reciboEmitenteNome(s);
        const cnpjFmt = reciboCnpjExibicao(s);
        const nomePatio = (s.nome_patio || "").trim() || RECIBO_PATIO_PADRAO;
        const pessoa = (destinatarioNome || "").trim() || "—";
        const pessoaDoc = (destinatarioDoc || "").trim() || "—";
        const placa = vehicle?.placa || "—";
        const marca = (vehicle?.marca || "").trim();
        const modelo = (vehicle?.modelo || "").trim();
        const veiculoDesc = [marca, modelo].filter(Boolean).join(" ").trim() || "—";
        const dIni = receivable?.period_start ? formatDateBr(receivable.period_start) : "—";
        const dFim = receivable?.period_end ? formatDateBr(receivable.period_end) : "—";
        const dEntrada =
          vehicle?.data_entrada != null && vehicle.data_entrada !== ""
            ? formatDateBr(vehicle.data_entrada)
            : dIni;
        const dSaida =
          vehicle?.data_saida != null && vehicle.data_saida !== ""
            ? formatDateBr(vehicle.data_saida)
            : dFim;
        const valorTxt = formatCurrency(valor);
        const footerLine = reciboFooterLine(s);

        const printCss = `
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; margin: 20px; color: #111827; }
  h1 { font-size: 1.15rem; margin: 0 0 6px; }
  .meta { font-size: 0.82rem; color: #334155; margin: 0 0 12px; }
  .box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; margin: 10px 0; }
  .label { font-weight: 700; font-size: 0.78rem; color: #475569; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 6px; }
  .line { margin: 4px 0; font-size: 0.92rem; }
  .quit { margin-top: 18px; font-style: italic; }
  .sign { margin-top: 24px; font-size: 0.88rem; }
  .footer { margin-top: 28px; padding-top: 10px; border-top: 1px solid #cbd5e1; font-size: 0.8rem; color: #475569; text-align: center; }
  @page { margin: 12mm; }
  @media print { body { margin: 0; } }`;

        const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8" /><title>Recibo de recebimento</title>
<style>${printCss}</style></head><body>
  <h1>RECIBO DE QUITAÇÃO DE ESTADIAS</h1>
  <div class="meta">${escapeHtml(nomePatio)} • Emitido em ${escapeHtml(formatDateTime(new Date().toISOString()))}</div>

  <div class="box">
    <div class="label">Emitente</div>
    <div class="line"><strong>${escapeHtml(emitente)}</strong> — CNPJ ${escapeHtml(cnpjFmt)}</div>
  </div>

  <div class="box">
    <div class="label">Quem efetuou o pagamento</div>
    <div class="line"><strong>Nome:</strong> ${escapeHtml(pessoa)}</div>
    <div class="line"><strong>CPF/CNPJ:</strong> ${escapeHtml(pessoaDoc)}</div>
  </div>

  <div class="box">
    <div class="label">Veículo e período</div>
    <div class="line"><strong>Veículo:</strong> ${escapeHtml(veiculoDesc)}</div>
    <div class="line"><strong>Placa:</strong> ${escapeHtml(placa)}</div>
    <div class="line"><strong>Estadias:</strong> ${escapeHtml(`${dEntrada} até ${dSaida}`)}</div>
    <div class="line"><strong>Valor recebido:</strong> ${escapeHtml(valorTxt)}</div>
  </div>

  <p class="quit">Por este documento, dou plena e total quitação referente ao pagamento das estadias acima.</p>
  <p class="sign">Local e data: Recife-PE, ${escapeHtml(formatDateBr(new Date().toISOString()))}.</p>
  <div class="footer">${escapeHtml(footerLine)}</div>
</body></html>`;

        return printHtmlInHiddenIframe(html, { iframeTitle: "Impressão de recibo de recebimento" });
      }

      async function openNfseModal(vehicle) {
        nfseVehicleId = vehicle.id;
        nfseStatusBeforeOpen = vehicle.nfse_status || "NAO_SOLICITADA";
        resetNfseModalUi();
        const emitida = vehicle.nfse_status === "EMITIDA";
        nfseResumo.textContent = `Veículo: ${vehicle.placa || "-"} • ${[vehicle.marca, vehicle.modelo].filter(Boolean).join(" ")}${
          emitida ? " • Nota já emitida" : ""
        }`;
        nfseTexto.value = buildNfseText(vehicle);
        if (!emitida && (!vehicle.nfse_status || vehicle.nfse_status === "NAO_SOLICITADA")) {
          await supabase
            .from("vehicles")
            .update({ nfse_status: "PENDENTE", nfse_requested_at: new Date().toISOString() })
            .eq("id", vehicle.id)
            .eq("user_id", effectiveUserId());
          await loadVehicles();
          updateDashboard();
        }
        if (emitida) {
          nfseCopyHint.textContent = "Nota já confirmada como emitida. Você pode copiar o texto novamente se precisar.";
          nfseConfirmActions?.classList.add("hidden");
        } else if (nfseCopyHint) {
          nfseCopyHint.textContent = "Toque em «Copiar texto» e depois confirme se a nota já foi emitida.";
        }
        await refreshFichaIfOpen(vehicle.id);
        nfseModal.classList.remove("hidden");
      }

      async function openFicha(vehicle) {
        if (fichaModalTitle) {
          fichaModalTitle.textContent = `Ficha — ${vehicle.placa || "veículo"}`;
        }
        fichaModal.dataset.openVehicleId = vehicle.id;

        if (isGestorPista) {
          const locNome = state.partners.find((p) => p.id === vehicle.localizador_id)?.nome || "-";
          const dias = calcDays(vehicle);
          const horas = calcHours(vehicle);
          fichaResumo.innerHTML = `
            <strong>${vehicle.placa || "-"}</strong> • ${[vehicle.marca, vehicle.modelo].filter(Boolean).join(" ") || "-"}<br />
            RPV: ${escapeHtml(locNome)}<br />
            Entrada: ${formatDateTime(vehicle.data_entrada)}${
            vehicle.data_saida ? ` • Saída: ${formatDateTime(vehicle.data_saida)}` : ""
          }<br />
            <span class="notice">Tempo no pátio: ${dias} dia(s) • ${horas} h (referência operacional, sem valores).</span>
          `;
          if (fichaSectionSnf) {
            fichaSectionSnf.innerHTML = `<p class="notice" style="margin:0">Nota fiscal e valores não estão disponíveis para o gestor de pista.</p>`;
          }
          if (fichaSectionSlv) {
            const sit = VLS_STATUS_LABELS[vehicle.status] || vehicle.status || "-";
            const remG = isRemocaoSolicitada(vehicle)
              ? " • Remoção solicitada (registada)"
              : "";
            fichaSectionSlv.innerHTML = `<p class="notice" style="margin:0">Situação: <strong>${escapeHtml(
              sit
            )}</strong>${escapeHtml(remG)}. Liberação e alterações só pelo administrador.</p>`;
          }
        } else {
          const { data: ciclos, error: ciclosError } = await supabase
            .from("receivables")
            .select("responsavel_pagamento,valor,period_start,period_end,status")
            .eq("user_id", effectiveUserId())
            .eq("vehicle_id", vehicle.id)
            .order("period_start", { ascending: true });

          const ciclosHtml =
            !ciclos || !ciclos.length
              ? "<em>Sem ciclos financeiros cadastrados.</em>"
              : ciclos
                  .map((c, idx) => {
                    const inicio = c.period_start ? formatDate(c.period_start) : "-";
                    const fim = c.period_end ? formatDate(c.period_end) : "aberto";
                    const status = formatReceivableStatusLabel(c);
                    return `Ciclo ${idx + 1}: ${inicio} a ${fim} • ${c.responsavel_pagamento || "-"} • ${formatCurrency(
                      c.valor
                    )} (${status})`;
                  })
                  .join("<br />");

          fichaResumo.innerHTML = `
          <strong>${vehicle.placa || "-"}</strong> • ${[vehicle.marca, vehicle.modelo].filter(Boolean).join(" ") || "-"}<br />
          Entrada: ${formatDateTime(vehicle.data_entrada)} • Saída: ${formatDateTime(vehicle.data_saida)}<br />
          Valor de referência (diárias): ${formatCurrency(calcTotal(vehicle))}<br />
          <span class="notice">Cobrança e pagamento: módulo Financeiro (após encerrar o ciclo no pátio).</span><br />
          <span class="notice">Ciclos financeiros:</span><br />
          ${ciclosError ? "<em>Erro ao carregar ciclos.</em>" : ciclosHtml}
        `;
        }

        if (fichaSectionSnf && !isGestorPista) {
            const st = vehicle.nfse_status || "NAO_SOLICITADA";
            let statusLine = "";
            if (st === "EMITIDA") {
              statusLine = `Status: <strong>NFSe emitida</strong>${
                vehicle.nfse_issued_at ? ` • ${formatDateTime(vehicle.nfse_issued_at)}` : ""
              }.`;
            } else if (st === "PENDENTE") {
              statusLine = `Status: <strong>Pendente de emissão</strong>${
                vehicle.nfse_requested_at ? ` • Solicitada em ${formatDateTime(vehicle.nfse_requested_at)}` : ""
              }.`;
            } else {
              statusLine =
                "Status: nota fiscal ainda <strong>não solicitada</strong>. Use o botão <strong>NFSe</strong> na lista VNP.";
            }
            fichaSectionSnf.innerHTML = `<p class="notice" style="margin:0">${statusLine}</p>`;
        }

        if (fichaSectionSlv && !isGestorPista) {
            const rem = isRemocaoSolicitada(vehicle);
            let situacao = "";
            if (vehicle.status === "NO_PATIO") {
              situacao =
                '<p class="notice" style="margin:0">Veículo <strong>no pátio</strong>. Pode registar <strong>liberação solicitada</strong>.</p>';
            } else if (vehicle.status === "LIBERACAO_SOLICITADA") {
              situacao =
                '<p class="notice" style="margin:0"><strong>Liberação solicitada</strong>. Próximo passo operacional: <strong>Liberação confirmada</strong> (define o RPF e abre o ciclo).</p>';
            } else if (vehicle.status === "LIBERACAO_CONFIRMADA") {
              situacao =
                '<p class="notice" style="margin:0">Liberação <strong>confirmada</strong>. Próximo passo: botão <strong>VRP</strong> para finalizar a saída.</p>';
            } else if (vehicle.status === "REMocao_CONFIRMADA") {
              situacao =
                '<p class="notice" style="margin:0">Estado <strong>legado</strong> de remoção solicitada. Próximo passo: <strong>Remoção efetivada</strong>.</p>';
            } else {
              situacao = `<p class="notice" style="margin:0">Situação: ${escapeHtml(
                VLS_STATUS_LABELS[vehicle.status] || vehicle.status || "-"
              )}</p>`;
            }
            const botoes = [];
            if (vehicle.status === "NO_PATIO") {
              botoes.push(
                `<button type="button" class="secondary" data-action="solicitar" data-id="${vehicle.id}">Liberação solicitada</button>`
              );
            } else if (vehicle.status === "LIBERACAO_SOLICITADA") {
              botoes.push(
                `<button type="button" class="secondary" data-action="confirmar_liberacao" data-id="${vehicle.id}">Confirmar liberação</button>`
              );
            } else if (vehicle.status === "LIBERACAO_CONFIRMADA") {
              botoes.push(
                `<button type="button" class="secondary" data-action="confirmar" data-id="${vehicle.id}">VRP</button>`
              );
            } else if (vehicle.status === "REMocao_CONFIRMADA") {
              botoes.push(
                `<button type="button" class="secondary" data-action="confirmar" data-id="${vehicle.id}">VRP</button>`
              );
            }
            fichaSectionSlv.innerHTML = `${situacao}<div class="ficha-inline-actions">${botoes.join("")}</div>`;
        }

        if (fichaSectionVistoria) {
          const vistoriaData = vehicle.vistoria_data ? formatDateTime(vehicle.vistoria_data) : "-";
          const vistoriaResp = vehicle.vistoria_responsavel || "-";
          const vistoriaKm = vehicle.vistoria_km || "-";
          const vistoriaComb = vehicle.vistoria_combustivel || "-";
          const vistoriaObs = vehicle.vistoria_observacoes || "-";
          const checklist = vehicle.vistoria_checklist || {};
          const hasVistoria =
            !!vehicle.vistoria_data ||
            !!vehicle.vistoria_responsavel ||
            !!vehicle.vistoria_km ||
            !!vehicle.vistoria_combustivel ||
            !!vehicle.vistoria_observacoes ||
            !!checklist.documento ||
            !!checklist.chave ||
            !!checklist.estepe ||
            !!checklist.triangulo_macaco;
          fichaSectionVistoria.innerHTML = hasVistoria
            ? `
              <p class="notice" style="margin:0 0 8px">
                Data: <strong>${escapeHtml(vistoriaData)}</strong> • Responsável: <strong>${escapeHtml(vistoriaResp)}</strong>
              </p>
              <p style="margin:0 0 8px">
                KM: <strong>${escapeHtml(vistoriaKm)}</strong> • Combustível: <strong>${escapeHtml(vistoriaComb)}</strong>
              </p>
              <p style="margin:0 0 8px">
                Documento: <strong>${boolLabel(!!checklist.documento)}</strong> •
                Chave: <strong>${boolLabel(!!checklist.chave)}</strong> •
                Estepe: <strong>${boolLabel(!!checklist.estepe)}</strong> •
                Triângulo/Macaco: <strong>${boolLabel(!!checklist.triangulo_macaco)}</strong>
              </p>
              <p style="margin:0">
                Avarias/observações: ${escapeHtml(vistoriaObs)}
              </p>
            `
            : `<p class="notice" style="margin:0">Sem laudo de vistoria cadastrado neste veículo.</p>`;
        }

        const { data, error } = await supabase
          .from("vehicle_events")
          .select("*")
          .eq("vehicle_id", vehicle.id)
          .order("data_evento", { ascending: true });

        if (error) {
          fichaTimeline.innerHTML = `<div class="timeline-item">Erro ao carregar histórico.</div>`;
        } else if (!data || !data.length) {
          fichaTimeline.innerHTML = `<div class="timeline-item">Sem histórico ainda.</div>`;
        } else {
          fichaTimeline.innerHTML = data
            .map((evt) => {
              const title = evt.tipo
                .replace("LIBERACAO_", "Liberação ")
                .replace("REMocao_", "Remoção ")
                .replace("REMOVIDO", "Removido");
              return `
                <div class="timeline-item">
                  <div class="timeline-title">${title}</div>
                  <div>${evt.descricao || "-"}</div>
                  <div class="timeline-meta">Responsável: ${evt.responsavel || "-"} • ${formatDateTime(
                evt.data_evento
              )}</div>
                </div>
              `;
            })
            .join("");
        }
        fichaModal.classList.remove("hidden");
      }

      async function refreshFichaIfOpen(vehicleId) {
        if (!vehicleId || !fichaModal || fichaModal.classList.contains("hidden")) return;
        const v = state.vehicles.find((x) => x.id === vehicleId);
        if (v) await openFicha(v);
      }

      function renderPartners() {
        const parceiros = state.partners.filter((p) => isLocalizadorPartnerType(p.tipo || "PARCEIRO"));
        const assessorias = state.partners.filter((p) => p.tipo === "ASSESSORIA");
        const instituicoesFinanceiras = state.partners.filter((p) => p.tipo === "INSTITUICAO_FINANCEIRA");
        const leiloeiros = state.partners.filter((p) => p.tipo === "LEILOEIRO");
        const remocoes = state.partners.filter((p) => p.tipo === "REMOCAO");

        if (!parceiros.length) {
          setEmptyRow(tableLocalizadores, "Nenhum RPV cadastrado.", 5);
        } else {
          tableLocalizadores.innerHTML = parceiros
            .map((p) => {
              return `
                <tr>
                  <td>${p.nome || "-"}</td>
                  <td>${formatCnpjForDisplay(p.cpf) || "-"}</td>
                  <td>${p.contato || "-"}</td>
                  <td><span class="tag">Ativo</span></td>
                  <td class="actions">
                    <button class="secondary" data-action="editar-parceiro" data-id="${p.id}">Editar</button>
                    <button class="secondary" data-action="apagar-parceiro" data-id="${p.id}">Apagar</button>
                  </td>
                </tr>
              `;
            })
            .join("");
        }

        if (!assessorias.length) {
          setEmptyRow(tableAssessorias, "Nenhuma assessoria cadastrada.", 5);
        } else {
          tableAssessorias.innerHTML = assessorias
            .map((p) => {
              return `
                <tr>
                  <td>${p.nome || "-"}</td>
                  <td>${formatCnpjForDisplay(p.cpf) || "-"}</td>
                  <td>${p.contato || "-"}</td>
                  <td><span class="tag">Ativo</span></td>
                  <td class="actions">
                    <button class="secondary" data-action="editar-parceiro" data-id="${p.id}">Editar</button>
                    <button class="secondary" data-action="apagar-parceiro" data-id="${p.id}">Apagar</button>
                  </td>
                </tr>
              `;
            })
            .join("");
        }

        if (!instituicoesFinanceiras.length) {
          setEmptyRow(tableInstituicoesFinanceiras, "Nenhuma instituição financeira cadastrada.", 5);
        } else {
          tableInstituicoesFinanceiras.innerHTML = instituicoesFinanceiras
            .map((p) => {
              return `
                <tr>
                  <td>${p.nome || "-"}</td>
                  <td>${formatCnpjForDisplay(p.cpf) || "-"}</td>
                  <td>${p.contato || "-"}</td>
                  <td><span class="tag">Ativo</span></td>
                  <td class="actions">
                    <button class="secondary" data-action="editar-parceiro" data-id="${p.id}">Editar</button>
                    <button class="secondary" data-action="apagar-parceiro" data-id="${p.id}">Apagar</button>
                  </td>
                </tr>
              `;
            })
            .join("");
        }

        if (!leiloeiros.length) {
          setEmptyRow(tableLeiloeiros, "Nenhum leiloeiro cadastrado.", 5);
        } else {
          tableLeiloeiros.innerHTML = leiloeiros
            .map((p) => {
              return `
                <tr>
                  <td>${p.nome || "-"}</td>
                  <td>${formatCnpjForDisplay(p.cpf) || "-"}</td>
                  <td>${p.contato || "-"}</td>
                  <td><span class="tag">Ativo</span></td>
                  <td class="actions">
                    <button class="secondary" data-action="editar-parceiro" data-id="${p.id}">Editar</button>
                    <button class="secondary" data-action="apagar-parceiro" data-id="${p.id}">Apagar</button>
                  </td>
                </tr>
              `;
            })
            .join("");
        }

        if (!remocoes.length) {
          setEmptyRow(tableRemocoes, "Nenhum serviço de remoção cadastrado.", 5);
        } else {
          tableRemocoes.innerHTML = remocoes
            .map((p) => {
              return `
                <tr>
                  <td>${p.nome || "-"}</td>
                  <td>${formatCnpjForDisplay(p.cpf) || "-"}</td>
                  <td>${p.contato || "-"}</td>
                  <td><span class="tag">Ativo</span></td>
                  <td class="actions">
                    <button class="secondary" data-action="editar-parceiro" data-id="${p.id}">Editar</button>
                    <button class="secondary" data-action="apagar-parceiro" data-id="${p.id}">Apagar</button>
                  </td>
                </tr>
              `;
            })
            .join("");
        }

        renderPartnerRankings();
      }

      function renderPartnerRankings() {
        const parceiros = state.partners.filter((p) => isLocalizadorPartnerType(p.tipo || "PARCEIRO"));
        const partnerMap = new Map(parceiros.map((p) => [p.id, p.nome || "-"]));

        const vehiclesByPartner = new Map();
        state.vehicles.forEach((v) => {
          if (!v.localizador_id) return;
          vehiclesByPartner.set(v.localizador_id, (vehiclesByPartner.get(v.localizador_id) || 0) + 1);
        });
        const topVehicles = [...vehiclesByPartner.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([id, count], idx) => `${idx + 1}. ${partnerMap.get(id) || "Parceiro"} (${count})`);
        rankByVehicles.textContent = topVehicles.length ? topVehicles.join(" • ") : "Sem dados";

        const receivableMap = new Map(state.receivables.map((r) => [r.id, r]));
        const vehicleMap = new Map(state.vehicles.map((v) => [v.id, v]));
        const revenueByPartner = new Map();
        state.cash
          .filter((c) => c.tipo_conta === "RECEBER")
          .forEach((c) => {
            const receivable = receivableMap.get(c.conta_id);
            if (!receivable) return;
            const vehicle = vehicleMap.get(receivable.vehicle_id);
            if (!vehicle || vehicle.status !== "REMOVIDO") return;
            if (!vehicle.localizador_id) return;
            revenueByPartner.set(
              vehicle.localizador_id,
              (revenueByPartner.get(vehicle.localizador_id) || 0) + Number(c.valor || 0)
            );
          });
        const topRevenue = [...revenueByPartner.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([id, total], idx) => `${idx + 1}. ${partnerMap.get(id) || "Parceiro"} (${formatCurrency(total)})`);
        rankByRevenue.textContent = topRevenue.length ? topRevenue.join(" • ") : "Sem dados";
      }

      function renderPartnerOptions() {
        vehicleLocator.innerHTML = `<option value="">Sem RPV</option>`;
        if (vehicleFinancialResponsible) vehicleFinancialResponsible.innerHTML = `<option value="">Sem RPF</option>`;
        vehicleAssessor.innerHTML = `<option value="">Sem assessoria</option>`;
        if (vehicleAuctioneer) vehicleAuctioneer.innerHTML = `<option value="">Sem leiloeiro</option>`;
        state.partners.forEach((p) => {
          const type = normalizePartnerType(p.tipo || "PARCEIRO");
          const option = document.createElement("option");
          option.value = p.id;
          option.textContent = p.nome;
          if (type === "ASSESSORIA") {
            vehicleAssessor.appendChild(option);
          } else if (type === "LEILOEIRO" && vehicleAuctioneer) {
            vehicleAuctioneer.appendChild(option);
          } else if (type === "LOCALIZADOR") {
            vehicleLocator.appendChild(option);
          }
          if (vehicleFinancialResponsible && isRpfPartnerType(type)) {
            const optionRpf = document.createElement("option");
            optionRpf.value = p.id;
            optionRpf.textContent = p.nome;
            vehicleFinancialResponsible.appendChild(optionRpf);
          }
        });
      }

      function openPartnerRegistrationFlow(targetType) {
        const normalizedTarget = normalizePartnerType(targetType || "LOCALIZADOR");
        const isAssessoria = normalizedTarget === "ASSESSORIA";
        openMainView("parceiros");
        let targetSubview = "localizadores";
        if (normalizedTarget === "ASSESSORIA") targetSubview = "assessorias";
        else if (normalizedTarget === "INSTITUICAO_FINANCEIRA") targetSubview = "instituicoes_financeiras";
        else if (normalizedTarget === "LEILOEIRO") targetSubview = "leiloeiros";
        else if (normalizedTarget === "REMOCAO") targetSubview = "remocoes";
        openPartnerSubview(targetSubview);
        if (isAssessoria) partnerModalTitle.textContent = "Nova assessoria";
        else if (normalizedTarget === "INSTITUICAO_FINANCEIRA") partnerModalTitle.textContent = "Nova instituição financeira";
        else if (normalizedTarget === "LEILOEIRO") partnerModalTitle.textContent = "Novo leiloeiro";
        else if (normalizedTarget === "REMOCAO") partnerModalTitle.textContent = "Novo serviço de remoção";
        else partnerModalTitle.textContent = "Novo RPV";
        syncPartnerFormForCurrentView();
        partnerForm.reset();
        partnerModal.classList.remove("hidden");
      }

      function openVehicleModal(mode, vehicle) {
        if (isGestorPista && mode === "edit") {
          alert("O gestor de pista não pode editar veículos.");
          return;
        }
        editingVehicleId = mode === "edit" ? vehicle.id : null;
        editingVehicleData = mode === "edit" ? vehicle : null;
        vehicleModalTitle.textContent = mode === "edit" ? "Editar veículo" : "Registrar veículo";
        vehicleModalSubtitle.textContent =
          mode === "edit"
            ? "Atualize os dados do veículo"
            : "Cadastro de entrada no pátio";
        vehicleForm.classList.remove("operador-simplified");
        vehicleForm.reset();
        vehicleExit.value = "";
        if (mode === "edit" && vehicle) {
          document.getElementById("vehiclePlate").value = vehicle.placa || "";
          document.getElementById("vehicleBrand").value = vehicle.marca || "";
          document.getElementById("vehicleModel").value = vehicle.modelo || "";
          document.getElementById("vehicleDaily").value = vehicle.valor_diaria || "";
          document.getElementById("vehicleEntry").value = toLocalInput(vehicle.data_entrada);
          vehicleExit.value = toLocalInput(vehicle.data_saida);
          vehicleLocator.value = vehicle.localizador_id || "";
          vehicleAssessor.value = vehicle.assessoria_id || "";
          if (vehicleFinancialResponsible)
            vehicleFinancialResponsible.value = vehicle.responsavel_financeiro_id || "";
          if (vehicleAuctioneer) vehicleAuctioneer.value = vehicle.leiloeiro_id || "";
          document.getElementById("vehicleNotes").value = vehicle.observacoes || "";
          const inspectionDateEl = document.getElementById("vehicleInspectionDate");
          const inspectionResponsibleEl = document.getElementById("vehicleInspectionResponsible");
          const inspectionKmEl = document.getElementById("vehicleInspectionKm");
          const inspectionFuelEl = document.getElementById("vehicleInspectionFuel");
          const inspectionDocEl = document.getElementById("vehicleInspectionDoc");
          const inspectionKeyEl = document.getElementById("vehicleInspectionKey");
          const inspectionStepEl = document.getElementById("vehicleInspectionStep");
          const inspectionTowEl = document.getElementById("vehicleInspectionTow");
          const inspectionDamageEl = document.getElementById("vehicleInspectionDamage");
          if (inspectionDateEl) inspectionDateEl.value = toLocalInput(vehicle.vistoria_data);
          if (inspectionResponsibleEl) inspectionResponsibleEl.value = vehicle.vistoria_responsavel || "";
          if (inspectionKmEl) inspectionKmEl.value = vehicle.vistoria_km || "";
          if (inspectionFuelEl) inspectionFuelEl.value = vehicle.vistoria_combustivel || "";
          if (inspectionDocEl) inspectionDocEl.checked = !!vehicle.vistoria_checklist?.documento;
          if (inspectionKeyEl) inspectionKeyEl.checked = !!vehicle.vistoria_checklist?.chave;
          if (inspectionStepEl) inspectionStepEl.checked = !!vehicle.vistoria_checklist?.estepe;
          if (inspectionTowEl) inspectionTowEl.checked = !!vehicle.vistoria_checklist?.triangulo_macaco;
          if (inspectionDamageEl) inspectionDamageEl.value = vehicle.vistoria_observacoes || "";
        } else {
          const entryInput = document.getElementById("vehicleEntry");
          if (!entryInput.value) {
            entryInput.value = toLocalInput(new Date());
          }
          if (vehicleFinancialResponsible) vehicleFinancialResponsible.value = "";
          if (vehicleAuctioneer) vehicleAuctioneer.value = "";
        }
        const vd = document.getElementById("vehicleDaily");
        if (vd) vd.required = true;
        vehicleModal.classList.remove("hidden");
      }

      function renderFinanceExtratoDom(monthYm) {
        const root = document.getElementById("fdExtratoRoot");
        if (!root) return;
        const vehicles = state.vehicles || [];
        const cash = state.cash || [];
        const pr = (monthYm || "").split("-");
        const yy = Number(pr[0]);
        const mm = Number(pr[1]);
        if (!yy || !mm) {
          root.innerHTML = `<p class="notice">Selecione um mês.</p>`;
          return;
        }
        const last = new Date(yy, mm, 0).getDate();
        const chunks = [];
        for (let d = last; d >= 1; d--) {
          const dayYmd = `${yy}-${String(mm).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          let diarias = 0;
          let nv = 0;
          for (const v of vehicles) {
            const val = calcDiariaValorGeradoNoDiaLocal(v, dayYmd);
            if (val > 0) {
              diarias += val;
              nv++;
            }
          }
          const despesas = sumCashPagamentosNoDia(dayYmd, cash);
          if (diarias <= 0 && despesas <= 0) continue;

          const title = formatFinanceExtratoDayLabel(dayYmd);
          let rowsHtml = "";
          if (diarias > 0) {
            rowsHtml += `
        <div class="fin-dash-row">
          <button type="button" class="fin-dash-row-btn" data-fin-diarias-day="${dayYmd}">
            <div class="fin-dash-row-main">
              <span class="fin-dash-row-label">Diárias</span>
              <span class="fin-dash-row-meta">${nv} veículo${nv !== 1 ? "s" : ""}</span>
            </div>
            <span class="fin-dash-row-val fin-txt-pos">+ ${formatCurrency(diarias)}</span>
          </button>
        </div>`;
          }
          if (despesas > 0) {
            rowsHtml += `
        <div class="fin-dash-row">
          <div class="fin-dash-row-main">
            <span class="fin-dash-row-label">Despesas</span>
            <span class="fin-dash-row-meta">Pagamentos no caixa</span>
          </div>
          <span class="fin-dash-row-val fin-txt-neg">− ${formatCurrency(despesas)}</span>
        </div>`;
          }
          chunks.push(`
      <article class="fin-dash-day">
        <div class="fin-dash-day-head">${escapeHtml(title)}</div>
        <div class="fin-dash-day-rows">${rowsHtml}</div>
      </article>
    `);
        }
        root.innerHTML = chunks.length ? chunks.join("") : `<p class="notice">Sem movimento neste mês.</p>`;
      }

      function openFinDiariasDayModal(dayYmd) {
        const modal = document.getElementById("finDiariasDayModal");
        const titleEl = document.getElementById("finDiariasDayModalTitle");
        const subEl = document.getElementById("finDiariasDayModalSub");
        const listEl = document.getElementById("finDiariasDayModalList");
        if (!modal || !listEl) return;
        const rows = vehiclesDiariasAggregatedForDay(dayYmd, state.vehicles || []);
        const total = rows.reduce((s, r) => s + r.val, 0);
        if (titleEl) titleEl.textContent = `Diárias · ${formatFinanceExtratoDayLabel(dayYmd)}`;
        if (subEl) subEl.textContent = `Total ${formatCurrency(total)} · ${rows.length} veículo(s)`;
        listEl.innerHTML = rows.length
          ? rows
              .map(
                (r) => `
          <li>
            <button type="button" data-fin-vehicle-row="${escapeHtml(String(r.vehicle.id))}">
              <span>${escapeHtml(r.vehicle.placa || "—")}</span>
              <span class="fin-txt-pos">${formatCurrency(r.val)}</span>
            </button>
          </li>`
              )
              .join("")
          : `<li><p class="notice" style="margin:12px">Sem diárias neste dia.</p></li>`;
        modal.classList.remove("hidden");
      }

      function openFinVehicleSnapModal(vehicleId) {
        const modal = document.getElementById("finVehicleSnapModal");
        const v = (state.vehicles || []).find((x) => String(x.id) === String(vehicleId));
        const titleEl = document.getElementById("finVehicleSnapTitle");
        const subEl = document.getElementById("finVehicleSnapSub");
        const bodyEl = document.getElementById("finVehicleSnapBody");
        if (!modal || !bodyEl) return;
        if (!v) {
          if (titleEl) titleEl.textContent = "Veículo";
          if (subEl) subEl.textContent = "";
          bodyEl.textContent = "Registo não encontrado.";
          modal.classList.remove("hidden");
          return;
        }
        const totalAcc = calcTotal(v);
        let diasStr = "—";
        if (v.data_entrada) {
          const endMs = new Date(v.data_saida || Date.now()).getTime();
          const startMs = new Date(v.data_entrada).getTime();
          diasStr = String(Math.max(1, Math.ceil((endMs - startMs) / 86400000)));
        }
        if (titleEl) titleEl.textContent = v.placa || "Veículo";
        if (subEl) subEl.textContent = [v.marca, v.modelo].filter(Boolean).join(" · ") || "Detalhes";
        bodyEl.innerHTML = `<strong>Total acumulado (diárias)</strong>: ${formatCurrency(totalAcc)}<br/><strong>Entrada</strong>: ${formatDateBr(v.data_entrada)}<br/><strong>Dias no pátio</strong>: ${diasStr}<br/><strong>Valor da diária</strong>: ${formatCurrency(Number(v.valor_diaria || 0))}`;
        modal.classList.remove("hidden");
      }

      let financeDashUiBound = false;
      function bindFinanceDashboardUiOnce() {
        if (financeDashUiBound) return;
        financeDashUiBound = true;
        document.body.addEventListener("click", (e) => {
          const diariasBtn = e.target.closest("[data-fin-diarias-day]");
          if (diariasBtn) {
            const day = diariasBtn.getAttribute("data-fin-diarias-day");
            if (day) openFinDiariasDayModal(day);
            return;
          }
          const vehBtn = e.target.closest("[data-fin-vehicle-row]");
          if (vehBtn) {
            const id = vehBtn.getAttribute("data-fin-vehicle-row");
            if (id) {
              openFinVehicleSnapModal(id);
              document.getElementById("finDiariasDayModal")?.classList.add("hidden");
            }
          }
        });
        document.getElementById("finDiariasDayModalClose")?.addEventListener("click", () => {
          document.getElementById("finDiariasDayModal")?.classList.add("hidden");
        });
        document.getElementById("finVehicleSnapClose")?.addEventListener("click", () => {
          document.getElementById("finVehicleSnapModal")?.classList.add("hidden");
        });
        document.getElementById("finDiariasDayModal")?.addEventListener("click", (e) => {
          if (e.target.id === "finDiariasDayModal") document.getElementById("finDiariasDayModal").classList.add("hidden");
        });
        document.getElementById("finVehicleSnapModal")?.addEventListener("click", (e) => {
          if (e.target.id === "finVehicleSnapModal") document.getElementById("finVehicleSnapModal").classList.add("hidden");
        });
      }

      function setFinanceLancListMode(active) {
        financeLancList?.classList.toggle("hidden", !active);
        financeStdTableWrap?.classList.toggle("hidden", !!active);
      }

      function renderFinanceLancItem(entry) {
        const isReceita = entry.tipo === "RECEITA";
        const tipoClass = isReceita ? "receita" : "despesa";
        const statusClass = entry.status === "PAGO" ? "finance-ft-status--pago" : "finance-ft-status--pendente";
        const statusLabel = entry.status === "PAGO" ? "Pago" : "Pendente";
        const parteHtml =
          entry.parte && entry.parte !== "-"
            ? `<span class="finance-lanc-parte">${escapeHtml(entry.parte)}</span>`
            : "";
        const valorFmt = `${isReceita ? "" : "− "}${formatCurrency(entry.valor)}`;
        const catLabel = isReceita ? receivableCategoryLabel(entry.categoria) : payableCategoryLabel(entry.categoria);
        const badges = [
          financeModoBadgeHtml(entry.modo, entry.meta),
          financeNaturezaBadgeHtml(entry.natureza || entry.meta?.natureza),
        ]
          .filter(Boolean)
          .join("");
        const badgesHtml = badges ? `<span class="finance-lanc-badges">${badges}</span>` : "";
        const attKind = entry.recordKind;
        const attId = entry.recordId;
        const hasAtt = attKind && attId && financeAttachmentGet(attKind, attId);
        const attBtn =
          hasAtt && attKind && attId
            ? `<button type="button" class="secondary" style="font-size:11px;padding:3px 8px" data-action="ver-comprovante" data-kind="${escapeHtml(attKind)}" data-id="${escapeHtml(attId)}">📎 Comprovante</button>`
            : "";
        return `
          <article class="finance-lanc-item finance-lanc-item--${tipoClass}">
            <div class="finance-lanc-main">
              <div class="finance-lanc-desc">
                <strong>${escapeHtml(entry.descricao)}</strong>
                ${parteHtml}
              </div>
              <div class="finance-lanc-valor finance-lanc-valor--${tipoClass}">${valorFmt}</div>
            </div>
            <div class="finance-lanc-foot">
              <span class="tag">${escapeHtml(catLabel)}</span>
              ${badgesHtml}
              <span class="finance-lanc-tipo finance-lanc-tipo--${tipoClass}">${isReceita ? "Receita" : "Despesa"}</span>
              <span class="finance-lanc-data">${formatDate(entry.data)}</span>
              <span class="finance-ft-status ${statusClass}">${statusLabel}</span>
              ${attBtn}
            </div>
          </article>
        `;
      }

      function renderFinanceLancItemAnalytical(entry) {
        const isReceita = entry.tipo === "RECEITA";
        const tipoClass = isReceita ? "receita" : "despesa";
        const valorFmt = `${isReceita ? "" : "− "}${formatCurrency(entry.valor)}`;
        const catLabel = isReceita ? receivableCategoryLabel(entry.categoria) : payableCategoryLabel(entry.categoria);
        const competencia = entry.competencia || entry.meta?.competencia || "—";
        const competenciaFmt =
          competencia && competencia.includes("-")
            ? `${competencia.slice(5, 7)}/${competencia.slice(0, 4)}`
            : competencia;
        const centro = entry.meta?.centro_custo || entry.natureza || "—";
        const origem = financeOrigemLabel(entry);
        const realizado = entry.status === "PAGO";
        const attKind = entry.recordKind;
        const attId = entry.recordId;
        const hasAtt = attKind && attId && financeAttachmentGet(attKind, attId);
        const attBtn =
          hasAtt && attKind && attId
            ? `<button type="button" class="secondary" style="font-size:11px;padding:3px 8px" data-action="ver-comprovante" data-kind="${escapeHtml(attKind)}" data-id="${escapeHtml(attId)}">📎</button>`
            : "";
        const compromissoHint =
          !realizado && entry.meta?.gerou_compromisso !== false
            ? `<span class="tag warning">Conta ${isReceita ? "a receber" : "a pagar"} gerada</span>`
            : "";
        return `
          <article class="finance-lanc-item finance-lanc-item--analitico finance-lanc-item--${tipoClass}">
            <div class="finance-lanc-main">
              <div class="finance-lanc-desc">
                <strong>${escapeHtml(entry.descricao)}</strong>
              </div>
              <div class="finance-lanc-valor finance-lanc-valor--${tipoClass}">${valorFmt}</div>
            </div>
            <div class="finance-lanc-meta-grid">
              <span>Categoria: <strong>${escapeHtml(catLabel)}</strong></span>
              ${!isReceita ? `<span>Centro de custo: <strong>${escapeHtml(String(centro))}</strong></span>` : ""}
              <span>Competência: <strong>${escapeHtml(competenciaFmt)}</strong></span>
              <span>Origem: <strong>${escapeHtml(origem)}</strong></span>
              <span>Realizado: <strong>${realizado ? "Sim" : "Não"}</strong></span>
            </div>
            <div class="finance-lanc-foot">
              ${compromissoHint}
              <span class="finance-ft-status ${realizado ? "finance-ft-status--pago" : "finance-ft-status--pendente"}">${realizado ? "Realizado" : "Provisão"}</span>
              ${attBtn}
            </div>
          </article>
        `;
      }

      function renderFinance() {
        const financeCaixaScrollNotice = document.getElementById("financeCaixaScrollNotice");
        if (financeCaixaScrollNotice) financeCaixaScrollNotice.classList.add("hidden");
        const todayYmdLocal = toLocalYmd(new Date().toISOString());
        const openReceivablesFinanceiro = state.receivables.filter((r) => receivableIsContaReceberFinanceiro(r));
        const openPayables = state.payables.filter((p) => p.status === "EM_ABERTO");
        const financePlateNorm = normalizePlateSearch(financePlateQuery);
        const vehicleById = new Map(state.vehicles.map((v) => [v.id, v]));
        const matchesVehicleId = (vehicleId) => {
          if (!financePlateNorm) return true;
          const v = vehicleById.get(vehicleId);
          if (!v || !v.placa) return false;
          return plateNormMatchesQuery(normalizePlateSearch(v.placa), financePlateNorm);
        };
        const payableDescMatchesPlate = (p) => {
          if (!financePlateNorm) return true;
          const descNorm = normalizePlateSearch(p.descricao || "");
          return descNorm.includes(financePlateNorm);
        };
        const totalReceber = openReceivablesFinanceiro.reduce((sum, r) => sum + Number(r.valor || 0), 0);
        const totalPagar = openPayables.reduce((sum, p) => sum + Number(p.valor || 0), 0);
        const caixa = state.cash.reduce((sum, mov) => {
          if (mov.tipo_conta === "PAGAR") return sum - Number(mov.valor || 0);
          return sum + Number(mov.valor || 0);
        }, 0);
        renderFinanceMetaCard(caixa);
        if (financeIsDashboardView(currentFinanceView) && financeFocusMetaGoalCard) {
          financeFocusMetaGoalCard = false;
          setTimeout(() => {
            document.getElementById("fdLucroCard")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 40);
        }

        const overdueReceivables = openReceivablesFinanceiro.filter((r) => {
          if (!r.created_at) return false;
          const created = new Date(r.created_at).getTime();
          const days = Math.floor((Date.now() - created) / 86400000);
          return days > 10;
        });
        const triagemList = state.receivables
          .filter((r) => receivableNaFilaAguardandoTriagem(r))
          .filter((r) => matchesVehicleId(r.vehicle_id));
        const payablesFiltered = openPayables.filter(payableDescMatchesPlate);
        const receivablesFilteredBase = openReceivablesFinanceiro.filter((r) => matchesVehicleId(r.vehicle_id));
        const receivablesFiltered =
          currentFinanceView === "receber_alerta"
            ? receivablesFilteredBase.filter((r) => overdueReceivables.some((o) => o.id === r.id))
            : receivablesFilteredBase;
        const sumReceivablesFiltered = receivablesFiltered.reduce((s, r) => s + Number(r.valor || 0), 0);
        const sumPayablesFiltered = payablesFiltered.reduce((s, p) => s + Number(p.valor || 0), 0);
        const sumTriagem = triagemList.reduce((s, r) => s + Number(r.valor || 0), 0);
        const maxPagar = payablesFiltered.reduce((m, p) => Math.max(m, Number(p.valor || 0)), 0);
        const caixaMonth = caixaFilter.month || currentYearMonthLocal();
        const cashMonthMovements = state.cash.filter((m) => {
          const ymd = toLocalYmd(m.data_movimento || m.created_at);
          if (!ymd || yearMonthFromYmd(ymd) !== caixaMonth) return false;
          // Fluxo/caixa não deve antecipar lançamentos com data futura.
          if (todayYmdLocal && ymd > todayYmdLocal) return false;
          return true;
        });
        const entradasCaixa = cashMonthMovements
          .filter((m) => m.tipo_conta === "RECEBER")
          .reduce((s, m) => s + Number(m.valor || 0), 0);
        const saidasCaixa = cashMonthMovements
          .filter((m) => m.tipo_conta === "PAGAR")
          .reduce((s, m) => s + Number(m.valor || 0), 0);
        const setFinanceSummaryCards = ({ t1, v1, m1, t2, v2, m2, t3, v3, m3, c1, c2, c3 }) => {
          if (financeCardTitle1) financeCardTitle1.textContent = t1;
          if (financeCardTitle2) financeCardTitle2.textContent = t2;
          if (financeCardTitle3) financeCardTitle3.textContent = t3;
          if (financeReceber) financeReceber.textContent = v1;
          if (financePagar) financePagar.textContent = v2;
          if (financeCaixa) financeCaixa.textContent = v3;
          if (financeReceberCount) {
            financeReceberCount.textContent = m1;
            financeReceberCount.className = c1 || "tag warning";
          }
          if (financePagarCount) {
            financePagarCount.textContent = m2;
            financePagarCount.className = c2 || "tag";
          }
          if (financeCaixaStatus) {
            financeCaixaStatus.textContent = m3;
            financeCaixaStatus.className = c3 || "tag success";
          }
        };
        if (currentFinanceView === "triagem" || currentFinanceView === "aguardando_faturamento") {
          setFinanceSummaryCards({
            t1: "Aguardando Faturamento",
            v1: formatCurrency(sumTriagem),
            m1: `${triagemList.length} veículo(s)`,
            t2: "Valor total na fila",
            v2: formatCurrency(sumTriagem),
            m2: "calculado na saída",
            t3: "Pendentes de cobrança",
            v3: String(triagemList.length),
            m3: "gerar cobrança / fatura",
            c1: "tag warning",
            c2: "tag warning",
            c3: "tag warning",
          });
        } else if (financeIsLancamentosView(currentFinanceView)) {
          setFinanceSummaryCards({
            t1: "Total de receitas em aberto",
            v1: formatCurrency(sumReceivablesFiltered),
            m1: `${receivablesFiltered.length} lançamento(s)`,
            t2: "Total de despesas em aberto",
            v2: formatCurrency(sumPayablesFiltered),
            m2: `${payablesFiltered.length} lançamento(s)`,
            t3: "Saldo atual em caixa",
            v3: formatCurrency(caixa),
            m3: caixa >= 0 ? "posição positiva" : "posição negativa",
            c1: "tag warning",
            c2: "tag danger",
            c3: caixa >= 0 ? "tag success" : "tag warning",
          });
        } else if (financeIsReceberView(currentFinanceView)) {
          const ticket = receivablesFiltered.length ? sumReceivablesFiltered / receivablesFiltered.length : 0;
          setFinanceSummaryCards({
            t1: "Total a receber",
            v1: formatCurrency(sumReceivablesFiltered),
            m1: `${receivablesFiltered.length} pendente(s)`,
            t2: "Ticket médio",
            v2: formatCurrency(ticket),
            m2: "por título",
            t3: "Vencidos",
            v3: String(receivablesFiltered.filter((r) => overdueReceivables.some((o) => o.id === r.id)).length),
            m3: "em atraso",
            c1: "tag warning",
            c2: "tag",
            c3: "tag danger",
          });
        } else if (financeIsPagarView(currentFinanceView)) {
          const media = payablesFiltered.length ? sumPayablesFiltered / Math.max(1, payablesFiltered.length) : 0;
          const overduePagar = payablesFiltered.filter((p) => {
            const due = (p.data_vencimento || "").slice(0, 10);
            return due && due < todayYmdLocal;
          });
          setFinanceSummaryCards({
            t1: "Total a pagar",
            v1: formatCurrency(sumPayablesFiltered),
            m1: `${payablesFiltered.length} pendente(s)`,
            t2: "Ticket médio",
            v2: formatCurrency(media),
            m2: "por título",
            t3: "Vencidas",
            v3: String(overduePagar.length),
            m3: "em atraso",
            c1: "tag warning",
            c2: "tag",
            c3: "tag danger",
          });
        } else if (currentFinanceView === "faturamento") {
          const descontos = sumPayablesFiltered;
          const bruto = sumReceivablesFiltered + descontos;
          const liquido = sumReceivablesFiltered;
          setFinanceSummaryCards({
            t1: "Receita bruta",
            v1: formatCurrency(bruto),
            m1: "período selecionado",
            t2: "Deduções",
            v2: formatCurrency(descontos),
            m2: "descontos e isenções",
            t3: "Receita líquida",
            v3: formatCurrency(liquido),
            m3: "bruta menos deduções",
            c1: "tag success",
            c2: "tag warning",
            c3: "tag success",
          });
        } else if (currentFinanceView === "caixa" || currentFinanceView === "fluxo_caixa") {
          const [anoCaixa, mesCaixa] = caixaMonth.split("-");
          const competenciaCaixa = mesCaixa && anoCaixa ? `${mesCaixa}/${anoCaixa}` : caixaMonth;
          setFinanceSummaryCards({
            t1: "Saldo em caixa",
            v1: formatCurrency(caixa),
            m1: caixa >= 0 ? "posição positiva" : "posição negativa",
            t2: "Entradas em caixa",
            v2: formatCurrency(entradasCaixa),
            m2: `recebimentos em ${competenciaCaixa}`,
            t3: "Saídas em caixa",
            v3: formatCurrency(saidasCaixa),
            m3: `pagamentos em ${competenciaCaixa}`,
            c1: caixa >= 0 ? "tag success" : "tag warning",
            c2: "tag success",
            c3: "tag warning",
          });
        } else {
          setFinanceSummaryCards({
            t1: "Receitas em aberto",
            v1: formatCurrency(totalReceber),
            m1: `${openReceivablesFinanceiro.length} em aberto`,
            t2: "Despesas em aberto",
            v2: formatCurrency(totalPagar),
            m2: `${openPayables.length} previstas`,
            t3: "Saldo em caixa",
            v3: formatCurrency(caixa),
            m3: caixa >= 0 ? "Positivo" : "Negativo",
            c1: "tag warning",
            c2: "tag",
            c3: caixa >= 0 ? "tag success" : "tag warning",
          });
        }

        if (!FINANCE_MANUAL_ONLY) {
          state.receivables.forEach((r) => {
            if (!receivableIsCicloPatioAberto(r)) return;
            const vehicle = state.vehicles.find((v) => v.id === r.vehicle_id);
            if (!vehicle) return;
            const totalAtual = calcTotal(vehicle);
            if (Number(r.valor || 0) !== Number(totalAtual)) {
              supabase
                .from("receivables")
                .update({ valor: totalAtual })
                .eq("id", r.id)
                .eq("user_id", effectiveUserId());
              r.valor = totalAtual;
            }
          });
        }

        const now = Date.now();
        if (overdueReceivables.length) {
          receivableAlert.textContent = `Atenção: ${overdueReceivables.length} título(s) em receber estão em aberto há mais de 10 dias.`;
          receivableAlert.classList.remove("hidden");
        } else {
          receivableAlert.classList.add("hidden");
          receivableAlert.textContent = "";
        }

        const stdArea = document.getElementById("financeStandardArea");
        const cloArea = document.getElementById("financeClosureArea");
        const hideAllFinanceAreas = () => {
          if (stdArea) stdArea.classList.add("hidden");
          if (cloArea) cloArea.classList.add("hidden");
          document.getElementById("financeClientesArea")?.classList.add("hidden");
          document.getElementById("financeFlyoutSummaryCards")?.classList.add("hidden");
        };
        const monthKeyFin = financeCompetencia || currentYearMonthLocal();
        const entradasMesDiarias = sumReceivableRevenueByMonth(monthKeyFin, state.receivables || [], state.cash || []);
        const saidasMesFinance = sumCashPagamentosNoMes(monthKeyFin, state.cash || []);
        const sangriaMesFinance = sumCashSangriaNoMes(monthKeyFin, state.cash || [], state.payables || []);
        const saidasOperacionaisMesFinance = Math.max(0, saidasMesFinance - sangriaMesFinance);
        const resultadoMesFinance = entradasMesDiarias - saidasOperacionaisMesFinance;

        const _fd = (id) => document.getElementById(id);
        const _set = (id, txt) => {
          const el = _fd(id);
          if (el) el.textContent = txt;
        };

        const dashTopArea = document.getElementById("financeTopDashboard");
        const applyFinanceCaixaKpiStrip = (prefix, opts) => {
          const { saldo, entradas, saidas, resultado, entradasHint, saidasHint, resultadoLabel, saldoHint } = opts;
          _set(`${prefix}CaixaAtual`, formatCurrency(saldo));
          _set(`${prefix}CaixaStatus`, saldoHint || (saldo >= 0 ? "Saldo consolidado no caixa" : "Caixa com saldo negativo"));
          _set(`${prefix}EntradasMes`, formatCurrency(entradas));
          _set(`${prefix}EntradasMesHint`, entradasHint || "Recebimentos no caixa");
          _set(`${prefix}SaidasMes`, formatCurrency(saidas));
          _set(`${prefix}SaidasMesHint`, saidasHint || "Pagamentos no caixa");
          _set(`${prefix}ResultadoMes`, formatCurrency(resultado));
          _set(`${prefix}ResultadoMesLabel`, resultadoLabel || (resultado >= 0 ? "Entradas − saídas (superavit)" : "Entradas − saídas (deficit)"));
          const resEmoji = _fd(`${prefix}ResultadoTituloEmoji`);
          if (resEmoji) resEmoji.textContent = resultado >= 0 ? "🟢" : "🔴";
          const resCard = _fd(`${prefix}ResultadoCard`);
          if (resCard) {
            resCard.classList.remove(
              "finance-kpi-card--profit",
              "finance-kpi-card--loss",
              "kpi-alert-success",
              "kpi-alert-danger",
              "finance-ft-resumo-card--profit",
              "finance-ft-resumo-card--loss"
            );
            resCard.classList.add(resultado >= 0 ? "finance-kpi-card--profit" : "finance-kpi-card--loss");
            resCard.classList.add(resultado >= 0 ? "kpi-alert-success" : "kpi-alert-danger");
            resCard.classList.add(resultado >= 0 ? "finance-ft-resumo-card--profit" : "finance-ft-resumo-card--loss");
          }
        };
        if (dashTopArea) {
          applyFinanceCaixaKpiStrip("fdt", {
            saldo: caixa,
            entradas: entradasMesDiarias,
            saidas: saidasMesFinance,
            resultado: resultadoMesFinance,
            entradasHint: "Total a receber (competência)",
            saidasHint: "Descontos concedidos",
            resultadoLabel: "Faturamento líquido",
          });
        }
        if (_fd("fdiCaixaAtual")) {
          applyFinanceCaixaKpiStrip("fdi", {
            saldo: caixa,
            entradas: entradasMesDiarias,
            saidas: saidasMesFinance,
            resultado: resultadoMesFinance,
          });
        }

        if (_fd("fdFaturadoMes")) {
          renderFinanceOperacionalDashboard(monthKeyFin);
        }
        if (financeIsDashboardView(currentFinanceView)) {
          renderFinanceModuleCharts();
          renderFinanceDrePanel();
          renderFinanceConciliacaoPanel();
          return;
        }
        if (currentFinanceView === "clientes") {
          hideAllFinanceAreas();
          const clientesArea = document.getElementById("financeClientesArea");
          if (clientesArea) clientesArea.classList.remove("hidden");
          renderFinanceClientes();
          return;
        }
        if (currentFinanceView === "filtros") {
          hideAllFinanceAreas();
          return;
        }
        if (currentFinanceView === "fechamento_mensal") {
          hideAllFinanceAreas();
          if (cloArea) cloArea.classList.remove("hidden");
          renderFinanceClosurePanel();
          return;
        }
        hideAllFinanceAreas();
        if (stdArea) stdArea.classList.remove("hidden");
        setFinanceLancListMode(false);

        const rows = [];

        const flySummary = document.getElementById("financeFlyoutSummaryCards");
        const caixaResumoPanel = document.getElementById("financeCaixaResumoPanel");

        if (currentFinanceView === "caixa") {
          if (flySummary) flySummary.classList.add("hidden");
          if (caixaResumoPanel) caixaResumoPanel.classList.remove("hidden");
          if (financeStdTableWrap) financeStdTableWrap.classList.remove("hidden");
          document.getElementById("financeCaixaScrollNotice")?.classList.remove("hidden");
          const rSaldo = document.getElementById("fcResumoSaldo");
          const rSaldoM = document.getElementById("fcResumoSaldoMeta");
          const rEnt = document.getElementById("fcResumoEntradas");
          const rEntM = document.getElementById("fcResumoEntradasMeta");
          const rSai = document.getElementById("fcResumoSaidas");
          const rSaiM = document.getElementById("fcResumoSaidasMeta");
          const rRes = document.getElementById("fcResumoResultado");
          const rResM = document.getElementById("fcResumoResultadoMeta");
          const rCard = document.getElementById("fcResumoResultadoCard");
          const [anoC, mesC] = caixaMonth.split("-");
          const compLab = mesC && anoC ? `${mesC}/${anoC}` : caixaMonth;
          if (rSaldo) rSaldo.textContent = formatCurrency(caixa);
          if (rSaldoM) rSaldoM.textContent = caixa >= 0 ? "Posição consolidada" : "Saldo negativo";
          if (rEnt) rEnt.textContent = formatCurrency(entradasCaixa);
          if (rEntM) rEntM.textContent = `Recebimentos em ${compLab}`;
          if (rSai) rSai.textContent = formatCurrency(saidasCaixa);
          if (rSaiM) rSaiM.textContent = `Pagamentos em ${compLab}`;
          const resMes = entradasCaixa - saidasCaixa;
          if (rRes) rRes.textContent = formatCurrency(resMes);
          if (rResM) rResM.textContent = resMes >= 0 ? "Entradas − saídas (superavit)" : "Entradas − saídas (deficit)";
          if (rCard) {
            rCard.classList.remove("finance-kpi-card--profit", "finance-kpi-card--loss", "kpi-alert-success", "kpi-alert-danger");
            rCard.classList.add(resMes >= 0 ? "finance-kpi-card--profit" : "finance-kpi-card--loss");
            rCard.classList.add(resMes >= 0 ? "kpi-alert-success" : "kpi-alert-danger");
          }
          financeHead.innerHTML = `
            <tr>
              <th>Data</th>
              <th>Tipo</th>
              <th>Descrição</th>
              <th>Valor</th>
              <th>Ações</th>
            </tr>`;
          const receivableByContaId = (contaId) => {
            if (contaId == null || contaId === "") return null;
            return state.receivables.find((r) => String(r.id) === String(contaId)) || null;
          };
          state.cash
            .filter((mov) => {
              const ymdMov = toLocalYmd(mov.data_movimento || mov.created_at);
              if (!ymdMov || yearMonthFromYmd(ymdMov) !== caixaMonth) return false;
              if (todayYmdLocal && ymdMov > todayYmdLocal) return false;
              return true;
            })
            .sort((a, b) => String(b.data_movimento || b.created_at).localeCompare(String(a.data_movimento || a.created_at)))
            .forEach((mov) => {
              const isReceber = mov.tipo_conta === "RECEBER";
              const rec = isReceber ? receivableByContaId(mov.conta_id) : null;
              const valorFmt = formatCurrency(Number(mov.valor || 0));
              const valorCell = isReceber ? valorFmt : `− ${valorFmt}`;
              rows.push(`
                <tr>
                  <td>${formatDate(mov.data_movimento || mov.created_at)}</td>
                  <td>${isReceber ? "Entrada" : "Saída"}</td>
                  <td>${escapeHtml(mov.descricao || (rec ? "Recebimento" : "Pagamento"))}</td>
                  <td>${valorCell}</td>
                  <td class="actions">
                    ${isReceber && rec ? `<button class="secondary" type="button" data-action="recibo-receber" data-id="${rec.id}">Recibo</button>` : ""}
                  </td>
                </tr>
              `);
            });
          if (!rows.length) {
            setEmptyRow(tableFinance, "Nenhum movimento de caixa neste mês.", 5);
          } else {
            tableFinance.innerHTML = rows.join("");
          }
          return;
        }
        if (flySummary) {
          flySummary.classList.toggle(
            "hidden",
            financeIsSubTabView(currentFinanceView) || financeIsDashboardView(currentFinanceView)
          );
        }
        if (caixaResumoPanel) caixaResumoPanel.classList.add("hidden");
        if (financeStdTableWrap) financeStdTableWrap.classList.remove("hidden");

        if (currentFinanceView === "cadastro_base") {
          financeHead.innerHTML = `
            <tr>
              <th>Cadastro</th>
              <th>Itens (editável)</th>
              <th>Novo item</th>
              <th>Ações</th>
            </tr>`;
          const base = cadastroBaseMerged();
          CADASTRO_BASE_FIELDS.forEach(({ key, label }) => {
            const list = base[key] || [];
            const badges = list.length
              ? list
                  .map(
                    (item) =>
                      `<span class="tag" style="margin:2px 4px 2px 0; display:inline-flex; gap:6px; align-items:center;">
                        ${escapeHtml(item)}
                        <button class="secondary" type="button" data-action="cadastro-remove-item" data-base-key="${key}" data-base-item="${encodeURIComponent(item)}" style="padding:0 6px; min-width:0;">×</button>
                      </span>`
                  )
                  .join("")
              : `<span class="notice">Sem itens</span>`;
            rows.push(`
              <tr>
                <td>${escapeHtml(label)}<br /><span class="notice">${list.length} item(ns)</span></td>
                <td><div class="finance-cadastro-badges">${badges}</div></td>
                <td>
                  <input id="cadastroBaseInput_${key}" type="text" placeholder="Adicionar ${escapeHtml(label.toLowerCase())}" style="min-width: 220px" />
                </td>
                <td class="actions">
                  <button class="secondary" type="button" data-action="cadastro-add-item" data-base-key="${key}">Adicionar</button>
                  <button class="secondary" type="button" data-action="cadastro-reset-list" data-base-key="${key}">Restaurar</button>
                </td>
              </tr>
            `);
          });
          tableFinance.innerHTML = rows.join("");
          return;
        }

        if (financeIsLancamentosView(currentFinanceView)) {
          renderFinanceSubviewIntro(currentFinanceView);
          if (flySummary) flySummary.classList.add("hidden");
          setFinanceLancListMode(true);
          const qBusca = String(lancamentosFilter.busca || "").trim().toLowerCase();
          const cashByReceivable = new Map(
            state.cash
              .filter((c) => c.tipo_conta === "RECEBER")
              .map((c) => [String(c.conta_id), c])
          );
          const cashByPayable = new Map(
            state.cash
              .filter((c) => c.tipo_conta === "PAGAR")
              .map((c) => [String(c.conta_id), c])
          );
          const toCompetencia = (ymd) => {
            if (!ymd) return "";
            const ym = yearMonthFromYmd(ymd);
            if (!ym) return "";
            return `${ym.slice(5, 7)}/${ym.slice(0, 4)}`;
          };
          const entries = [];
          state.receivables
            .filter((r) => matchesVehicleId(r.vehicle_id))
            .filter((r) => !FINANCE_MANUAL_ONLY || isManualFinanceLancamento(r))
            .forEach((r) => {
              const dataBase = (r.period_start || r.created_at || "").toString().slice(0, 10);
              const mov = cashByReceivable.get(String(r.id));
              const dataPagamento = r.status === "PAGO" ? (mov?.data_movimento || r.updated_at || r.created_at || "") : "";
              const { meta, text } = financeMetaUnpack(r.observacoes);
              entries.push({
                data: dataBase,
                mes: dataBase ? dataBase.slice(5, 7) : "-",
                ano: dataBase ? dataBase.slice(0, 4) : "-",
                tipo: "RECEITA",
                categoria: r.receivable_category || "GUARDA_PATIO",
                subcategoria: r.subcategoria || "Geral",
                descricao: text || r.observacoes || "Lançamento de receita",
                parte: r.responsavel_pagamento || "-",
                formaPagamento: mov?.forma_pagamento || r.forma_pagamento || "Não informado",
                valor: Number(r.valor || 0),
                status: r.status === "PAGO" ? "PAGO" : "ABERTO",
                dataPagamento,
                competencia: meta.competencia
                  ? `${String(meta.competencia).slice(5, 7)}/${String(meta.competencia).slice(0, 4)}`
                  : toCompetencia(dataBase),
                observacoes: text || r.observacoes || "-",
                modo: financeEntryModoFromRecord(r, "receivable"),
                meta,
                recordKind: "receivable",
                recordId: r.id,
              });
            });
          state.payables
            .filter(payableDescMatchesPlate)
            .forEach((p) => {
              const dataBase = (p.data_vencimento || p.created_at || "").toString().slice(0, 10);
              const mov = cashByPayable.get(String(p.id));
              const dataPagamento = p.status === "PAGO" ? (mov?.data_movimento || p.updated_at || p.created_at || "") : "";
              const { meta, text } = financeMetaUnpack(p.observacoes);
              entries.push({
                data: dataBase,
                mes: dataBase ? dataBase.slice(5, 7) : "-",
                ano: dataBase ? dataBase.slice(0, 4) : "-",
                tipo: "DESPESA",
                categoria: p.payable_category || "OUTROS",
                subcategoria: p.subcategoria || p.tipo || "Geral",
                descricao: p.descricao || text || "-",
                parte: p.fornecedor || "-",
                formaPagamento: mov?.forma_pagamento || p.forma_pagamento || "Não informado",
                valor: Number(p.valor || 0),
                status: p.status === "PAGO" ? "PAGO" : "ABERTO",
                dataPagamento,
                competencia: meta.competencia
                  ? `${String(meta.competencia).slice(5, 7)}/${String(meta.competencia).slice(0, 4)}`
                  : toCompetencia(dataBase),
                observacoes: text || p.observacoes || p.tipo || "-",
                modo: financeEntryModoFromRecord(p, "payable"),
                meta,
                natureza: meta.natureza || p.centro_custo,
                recordKind: "payable",
                recordId: p.id,
              });
            });
          if (currentFinanceView === "receitas") {
            entries.splice(0, entries.length, ...entries.filter((e) => e.tipo === "RECEITA"));
          } else if (currentFinanceView === "despesas") {
            entries.splice(0, entries.length, ...entries.filter((e) => e.tipo === "DESPESA"));
          }
          const syncSelectOptions = (selectEl, values, defaultLabel = "Todas") => {
            if (!selectEl) return;
            const current = selectEl.value;
            const opts = [...new Set(values.map((v) => String(v || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
            selectEl.innerHTML = [`<option value="">${defaultLabel}</option>`, ...opts.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`)].join("");
            if (current && opts.includes(current)) selectEl.value = current;
          };
          syncSelectOptions(financeLancCategoria, entries.map((e) => e.categoria), "Todas");
          syncSelectOptions(financeLancSubcategoria, entries.map((e) => e.subcategoria), "Todas");
          syncSelectOptions(financeLancFormaPagamento, entries.map((e) => e.formaPagamento), "Todas");
          syncSelectOptions(financeLancCompetencia, entries.map((e) => e.competencia), "Todas");
          const acceptEntry = (entry) => {
            if (lancamentosFilter.tipo && entry.tipo !== lancamentosFilter.tipo) return false;
            if (lancamentosFilter.status && entry.status !== lancamentosFilter.status) return false;
            if (lancamentosFilter.categoria && entry.categoria !== lancamentosFilter.categoria) return false;
            if (lancamentosFilter.subcategoria && entry.subcategoria !== lancamentosFilter.subcategoria) return false;
            if (lancamentosFilter.formaPagamento && entry.formaPagamento !== lancamentosFilter.formaPagamento) return false;
            if (lancamentosFilter.competencia && entry.competencia !== lancamentosFilter.competencia) return false;
            if (lancamentosAdvanced.onlyPago && entry.status !== "PAGO") return false;
            if (lancamentosAdvanced.onlyAberto && entry.status !== "ABERTO") return false;
            if (lancamentosAdvanced.onlyReceita && entry.tipo !== "RECEITA") return false;
            if (lancamentosAdvanced.onlyDespesa && entry.tipo !== "DESPESA") return false;
            if (lancamentosAdvanced.semObs && String(entry.observacoes || "").trim() !== "-") return false;
            if (lancamentosAdvanced.comObs && String(entry.observacoes || "").trim() === "-") return false;
            if (
              qBusca &&
              !`${entry.descricao || ""} ${entry.parte || ""}`.toLowerCase().includes(qBusca)
            ) return false;
            return true;
          };
          const sortedEntries = entries
            .filter(acceptEntry)
            .sort((a, b) => {
              const dir = lancamentosSort.dir === "asc" ? 1 : -1;
              const by = lancamentosSort.by || "data";
              if (by === "valor") return (Number(a.valor || 0) - Number(b.valor || 0)) * dir;
              if (by === "tipo") return String(a.tipo || "").localeCompare(String(b.tipo || "")) * dir;
              if (by === "status") return String(a.status || "").localeCompare(String(b.status || "")) * dir;
              if (by === "categoria") return String(a.categoria || "").localeCompare(String(b.categoria || "")) * dir;
              if (by === "competencia") return String(a.competencia || "").localeCompare(String(b.competencia || "")) * dir;
              return String(a.data || "").localeCompare(String(b.data || "")) * dir;
            });
          const totalRows = sortedEntries.length;
          const size = Math.max(1, Number(lancamentosPagination.pageSize || 20));
          const pages = Math.max(1, Math.ceil(totalRows / size));
          lancamentosPagination.page = Math.min(Math.max(1, Number(lancamentosPagination.page || 1)), pages);
          const start = (lancamentosPagination.page - 1) * size;
          const pageEntries = sortedEntries.slice(start, start + size);
          if (financeLancResultCount) financeLancResultCount.textContent = `${totalRows} registro(s)`;
          if (financeLancPageInfo) financeLancPageInfo.textContent = `Página ${lancamentosPagination.page} de ${pages}`;
          if (financeLancPrevPage) financeLancPrevPage.disabled = lancamentosPagination.page <= 1;
          if (financeLancNextPage) financeLancNextPage.disabled = lancamentosPagination.page >= pages;
          if (currentFinanceView === "receitas") {
            financeLancList?.classList.add("hidden");
            financeLancPagination?.classList.add("hidden");
            financeLancList?.closest(".section-card")?.classList.add("hidden");
            renderFinanceReceitasSections(sortedEntries, pageEntries, {
              page: lancamentosPagination.page,
              pages,
            });
          } else if (currentFinanceView === "despesas") {
            financeLancList?.classList.add("hidden");
            financeLancPagination?.classList.add("hidden");
            financeLancList?.closest(".section-card")?.classList.add("hidden");
            renderFinanceDespesasSections(sortedEntries, pageEntries, {
              page: lancamentosPagination.page,
              pages,
            });
          } else {
            financeLancList?.closest(".section-card")?.classList.remove("hidden");
            financeLancList?.classList.remove("hidden");
            if (financeLancList) {
              if (!pageEntries.length) {
                financeLancList.innerHTML = `<div class="finance-lanc-empty">Nenhum lançamento encontrado.</div>`;
              } else {
                financeLancList.innerHTML = pageEntries.map((entry) => renderFinanceLancItem(entry)).join("");
              }
            }
          }
          return;
        }

        if (financeIsAguardandoFaturamentoView(currentFinanceView)) {
          financeHead.innerHTML = `
            <tr>
              <th>Placa</th>
              <th>Veículo</th>
              <th>Cliente</th>
              <th>Entrada</th>
              <th>Saída</th>
              <th>Dias</th>
              <th>Valor total</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>`;
          state.receivables
            .filter((r) => receivableNaFilaAguardandoTriagem(r))
            .filter((r) => matchesVehicleId(r.vehicle_id))
            .forEach((r) => {
              const vehicle = state.vehicles.find((v) => v.id === r.vehicle_id);
              const breakdown = receivableFinanceBreakdown(r, vehicle);
              const vehicleLabel = vehicle ? [vehicle.marca, vehicle.modelo].filter(Boolean).join(" ") || "—" : "—";
              const placa = vehicle?.placa || "—";
              const cliente = r.responsavel_pagamento || vehicle?.financeira_nome || "—";
              const ini = r.period_start ? formatDate(r.period_start) : vehicle?.data_entrada ? formatDate(vehicle.data_entrada) : "-";
              const fim = r.period_end ? formatDate(r.period_end) : vehicle?.data_saida ? formatDate(vehicle.data_saida) : "-";
              const valor = Number(r.valor || breakdown.total || 0);
              const nfChecked = triagemDefaultNfEmitida(r, vehicle) ? " checked" : "";
              rows.push(`
                <tr>
                  <td>${escapeHtml(placa)}</td>
                  <td>${escapeHtml(vehicleLabel)}</td>
                  <td>${escapeHtml(cliente)}</td>
                  <td>${escapeHtml(ini)}</td>
                  <td>${escapeHtml(fim)}</td>
                  <td>${breakdown.dias}</td>
                  <td>${formatCurrency(valor)}</td>
                  <td><span class="tag warning">Aguardando Faturamento</span></td>
                  <td class="actions">
                    <button type="button" class="secondary" data-action="detalhes-calculo-faturamento" data-id="${r.id}">Ver cálculo</button>
                    <label class="finance-check" style="margin: 0 4px 0 0; display: inline-flex; align-items: center; gap: 4px; font-size: 12px">
                      <input type="checkbox" class="triagem-nf-emitida"${nfChecked} /> NF
                    </label>
                    <select class="triagem-pagamento" style="min-width: 9rem; margin-right: 4px">
                      <option value="aguardando" selected>Aguardando pagamento</option>
                      <option value="pago">Já pago</option>
                    </select>
                    <button type="button" class="secondary" data-action="gerar-fatura-faturamento" data-id="${r.id}">Gerar fatura</button>
                    <button type="button" data-action="confirmar_triagem" data-id="${r.id}" title="Gerar cobrança e enviar para Contas a Receber">Gerar cobrança</button>
                  </td>
                </tr>
              `);
            });
          if (!rows.length) {
            setEmptyRow(
              tableFinance,
              "Nenhum veículo aguardando faturamento. Após a saída (VRP), o registro aparece aqui com o valor calculado automaticamente.",
              9
            );
          } else {
            tableFinance.innerHTML = rows.join("");
          }
          return;
        }

        if (currentFinanceView === "relatorios") {
          // Relatório simplificado: RPV + RF + totais em aberto/aguardando.
          financeFiltersHub?.classList.add("hidden");
          financeFilters?.classList.add("hidden");
          financeReportExtraFilters?.classList.add("hidden");
          financePlateSearchForm?.classList.add("hidden");
          financeLancamentosFilters?.classList.add("hidden");
          financeLancamentosToolbar?.classList.add("hidden");
          financeCaixaFilters?.classList.add("hidden");
          document.getElementById("financeReceberFilters")?.classList.add("hidden");
          document.getElementById("financePagarFilters")?.classList.add("hidden");
          financeLancSidePanel?.classList.add("hidden");
          financeHead.innerHTML = `
            <tr>
              <th>Nome do RPV</th>
              <th>RF</th>
              <th>Pagamento em aberto</th>
              <th>Aguardando lançamento</th>
            </tr>`;
          const partnerById = new Map((state.partners || []).map((p) => [String(p.id), p.nome || "-"]));
          const grouped = new Map();
          (state.receivables || []).forEach((r) => {
            if (!matchesVehicleId(r.vehicle_id)) return;
            const v = vehicleById.get(r.vehicle_id);
            const rpv = v?.localizador_id ? partnerById.get(String(v.localizador_id)) || "-" : "-";
            const rf = String(r.responsavel_pagamento || "Não informado").trim() || "Não informado";
            const key = `${rpv}__${rf}`;
            const cur = grouped.get(key) || { rpv, rf, aberto: 0, aguardando: 0 };
            const valor = Number(r.valor || 0);
            if (r.status === RECEIVABLE_AGUARDANDO_LANCAMENTO || receivableNaFilaAguardandoTriagem(r)) {
              cur.aguardando += valor;
            } else if (r.status === "EM_ABERTO" && receivableIsContaReceberFinanceiro(r)) {
              cur.aberto += valor;
            }
            grouped.set(key, cur);
          });
          const reportRows = [...grouped.values()]
            .filter((x) => x.aberto > 0 || x.aguardando > 0)
            .sort((a, b) => `${a.rpv} ${a.rf}`.localeCompare(`${b.rpv} ${b.rf}`));
          if (!reportRows.length) {
            setEmptyRow(tableFinance, "Sem dados para o relatório simplificado.", 4);
          } else {
            tableFinance.innerHTML = reportRows
              .map(
                (x) => `
                  <tr>
                    <td>${escapeHtml(x.rpv)}</td>
                    <td>${escapeHtml(x.rf)}</td>
                    <td>${formatCurrency(x.aberto)}</td>
                    <td>${formatCurrency(x.aguardando)}</td>
                  </tr>
                `
              )
              .join("");
          }
          return;
        }

        if (currentFinanceView === "fluxo_caixa") {
          if (financeCaixaScrollNotice) financeCaixaScrollNotice.classList.remove("hidden");
          financeHead.innerHTML = `
            <tr>
              <th>Data</th>
              <th>Tipo</th>
              <th>Descrição</th>
              <th>Valor</th>
              <th>Ações</th>
            </tr>`;
          const receivableByContaId = (contaId) => {
            if (contaId == null || contaId === "") return null;
            const sid = String(contaId);
            return state.receivables.find((r) => String(r.id) === sid) || null;
          };
          const payableByContaId = (contaId) => {
            if (contaId == null || contaId === "") return null;
            const sid = String(contaId);
            return state.payables.find((p) => String(p.id) === sid) || null;
          };
          state.cash
            .filter((mov) => {
              const ymdMov = toLocalYmd(mov.data_movimento || mov.created_at);
              if (!ymdMov || yearMonthFromYmd(ymdMov) !== caixaMonth) return false;
              if (todayYmdLocal && ymdMov > todayYmdLocal) return false;
              if (!financePlateNorm) return true;
              if (mov.tipo_conta === "RECEBER") {
                const rec = receivableByContaId(mov.conta_id);
                if (rec) return matchesVehicleId(rec.vehicle_id);
                const d = normalizePlateSearch(mov.descricao || "");
                return d.includes(financePlateNorm);
              }
              const dMov = normalizePlateSearch(mov.descricao || "");
              if (dMov.includes(financePlateNorm)) return true;
              if (mov.tipo_conta === "PAGAR" && mov.conta_id) {
                const pay = payableByContaId(mov.conta_id);
                if (pay) return payableDescMatchesPlate(pay);
              }
              return false;
            })
            .forEach((mov) => {
              const recVinculado =
                mov.tipo_conta === "RECEBER" && mov.conta_id ? receivableByContaId(mov.conta_id) : null;
              const payVinculado =
                mov.tipo_conta === "PAGAR" && mov.conta_id ? payableByContaId(mov.conta_id) : null;
              const tipoMovLabel = mov.tipo_conta === "RECEBER" ? "Recebido" : "Pago";
              const receberQuitadoPodeGestionar =
                mov.tipo_conta === "RECEBER" && recVinculado && recVinculado.status === "PAGO";
              const pagarQuitadoPodeGestionar =
                mov.tipo_conta === "PAGAR" && payVinculado && payVinculado.status === "PAGO";
              let acoesCell = "—";
              if (receberQuitadoPodeGestionar) {
                const rid = mov.conta_id;
                acoesCell = `
                  <button class="secondary" type="button" data-action="recibo" data-id="${rid}" title="Gerar recibo de recebimento">Recibo</button>
                  <button class="secondary" type="button" data-action="conciliar-caixa" data-id="${mov.id}" title="Marca este lançamento como conciliado">Conciliar</button>
                  <button class="secondary" type="button" data-action="editar-recebido" data-id="${rid}" title="Ajustar cliente ou valor recebido">Editar</button>
                  <button class="secondary" type="button" data-action="estornar-caixa" data-id="${mov.id}" title="Estorna este lançamento e devolve para receber">Estornar</button>
                `;
              } else if (pagarQuitadoPodeGestionar) {
                const pid = mov.conta_id;
                acoesCell = `
                  <button class="secondary" type="button" data-action="editar-pago" data-id="${pid}" title="Ajustar saída já registrada">Editar</button>
                  <button class="secondary" type="button" data-action="apagar-pago" data-id="${pid}" title="Remover saída do caixa">Apagar</button>
                `;
              }
              rows.push(`
              <tr>
                <td>${formatDateTime(mov.data_movimento)}</td>
                <td>${tipoMovLabel}</td>
                <td>${mov.descricao || "-"}</td>
                <td>${formatCurrency(mov.valor)}</td>
                <td class="actions">${acoesCell}</td>
              </tr>
            `);
            });
          if (!rows.length) {
            setEmptyRow(tableFinance, "Nenhuma entrada ou saída no caixa.", 5);
          } else {
            tableFinance.innerHTML = rows.join("");
          }
          return;
        }

        if (financeIsPagarView(currentFinanceView)) {
          renderFinanceSubviewIntro("contas_pagar");
          if (currentContasPagarSubView === "inicio") {
            syncContasPagarSubViewUi();
            setEmptyRow(tableFinance, "Escolha uma sub-aba acima para ver os títulos.", 8);
            return;
          }
          if (currentContasPagarSubView === "historico") {
            renderFinanceContasPagarHistorico();
            return;
          }
          if (currentContasPagarSubView === "anexos") {
            renderFinanceContasPagarAnexos();
            return;
          }
          syncContasPagarSubViewUi();
          financeHead.innerHTML = `
            <tr>
              <th>Vencimento</th>
              <th>Descrição</th>
              <th>Fornecedor</th>
              <th>Categoria</th>
              <th>Valor</th>
              <th>Dias em atraso</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>`;
        } else if (financeIsReceberView(currentFinanceView)) {
          renderFinanceSubviewIntro("contas_receber");
          if (currentContasReceberSubView === "inicio") {
            syncContasReceberSubViewUi();
            setEmptyRow(tableFinance, "Escolha uma sub-aba acima para ver os títulos.", 9);
            return;
          }
          if (currentContasReceberSubView === "historico") {
            renderFinanceContasReceberHistorico();
            return;
          }
          if (currentContasReceberSubView === "anexos") {
            renderFinanceContasReceberAnexos();
            return;
          }
          syncContasReceberSubViewUi();
          financeHead.innerHTML = `
            <tr>
              <th>Nº cobrança</th>
              <th>Cliente</th>
              <th>Veículo</th>
              <th>Placa</th>
              <th>Valor</th>
              <th>Emissão</th>
              <th>Vencimento</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>`;
        } else {
          document.getElementById("financeSubviewIntro")?.classList.add("hidden");
          document.getElementById("financeHistoricoPanel")?.classList.add("hidden");
          financeHead.innerHTML = `
            <tr>
              <th>Vencimento</th>
              <th>Cliente</th>
              <th>Serviço</th>
              <th>Valor</th>
              <th>Status</th>
              <th>Dias em atraso</th>
              <th>Recebido em</th>
              <th>Alertas automáticos</th>
              <th>Ações</th>
            </tr>`;
        }

        if (financeIsReceberView(currentFinanceView)) {
          syncFinanceReceberBarOptions();
          const { list: recvFiltered, todayYmd: recvToday } = collectFinanceReceberFilteredList({ alertaOnly: false });
          const receberFlags = financeReceberFlagsRead();
          const showPaidRows = financeReceberStatusFilter === "pago" || financeReceberStatusFilter === "todas";

          recvFiltered.forEach((r) => {
            const dueYmd = financeContaDueYmd(r, "receivable");
            const isPaid = r.status === "PAGO";
            const vehicle = vehicleById.get(r.vehicle_id);
            const valorCobranca = Number(r.valor || 0);
            const movRec = (state.cash || []).find((m) => m.tipo_conta === "RECEBER" && String(m.conta_id) === String(r.id));
            const flags = receberFlags[String(r.id)] || {};
            const opStatus = financeReceivableOperacionalStatus(r, recvToday, flags);
            const vehicleLabel = vehicle ? [vehicle.marca, vehicle.modelo].filter(Boolean).join(" ") || "—" : isManualFinanceLancamento(r) ? "Lançamento manual" : "—";
            const placa = vehicle?.placa || "—";
            const hasAtt = financeAttachmentGet("receivable", r.id);
            const acoesAberto = `
                    <button class="secondary" data-action="detalhes-receber" data-id="${r.id}">Ver detalhes</button>
                    <button class="secondary" data-action="cobrar-receber" data-id="${r.id}" title="Preview e copiar cobrança">Cobrar</button>
                    ${isManualFinanceLancamento(r) ? `<button class="secondary" data-action="editar-receber" data-id="${r.id}">Editar</button>` : ""}
                    ${hasAtt ? `<button class="secondary" data-action="ver-comprovante" data-kind="receivable" data-id="${r.id}">Comprovante</button>` : ""}
                    <button class="secondary" data-action="aplicar-desconto" data-id="${r.id}">Aplicar desconto</button>
                    <button class="secondary" data-action="negociar-receber" data-id="${r.id}">Negociar</button>
                    <button class="secondary" data-action="receber" data-id="${r.id}" title="Confirmar pagamento recebido">Confirmar Pagamento</button>
                  `;
            const acoesPago = `
                    <button class="secondary" data-action="detalhes-receber" data-id="${r.id}">Ver detalhes</button>
                    ${hasAtt ? `<button class="secondary" data-action="ver-comprovante" data-kind="receivable" data-id="${r.id}">Comprovante</button>` : ""}
                    <button class="secondary" data-action="recibo" data-id="${r.id}">Recibo</button>
                  `;
            rows.push(`
                <tr>
                  <td>${escapeHtml(financeCobrancaNumero(r))}</td>
                  <td>${escapeHtml(r.responsavel_pagamento || "Responsável não informado")}</td>
                  <td>${escapeHtml(vehicleLabel)}</td>
                  <td>${escapeHtml(placa)}</td>
                  <td>${formatCurrency(valorCobranca)}</td>
                  <td>${formatDate(r.period_end || r.created_at)}</td>
                  <td>${formatDate(dueYmd || r.period_end || r.created_at)}</td>
                  <td><span class="tag ${opStatus.class}">${escapeHtml(opStatus.label)}</span></td>
                  <td class="actions">${isPaid ? acoesPago : acoesAberto}</td>
                </tr>
              `);
          });
          if (!recvFiltered.length && !showPaidRows && financeReceberStatusFilter === "aberto") {
            /* empty handled below */
          }
        }

        if (financeIsPagarView(currentFinanceView)) {
          rows.push(`
            <tr>
              <td colspan="8" class="actions">
                <button class="secondary" type="button" data-action="nova-despesa">+ Nova conta a pagar</button>
              </td>
            </tr>
          `);
          const { list: pagarFiltered, todayYmd: pagarToday } = collectFinancePagarFilteredList();
          pagarFiltered.forEach((p) => {
            const due = (p.data_vencimento || "").slice(0, 10);
            const isPaid = p.status === "PAGO";
            const daysFromDue = financeContaDueDays(due, pagarToday);
            const isOverdue = !isPaid && !!(due && pagarToday && due < pagarToday);
            const atrasoDias = isOverdue ? Math.max(0, daysFromDue) : 0;
            const statusLabel = isPaid ? "Pago" : isOverdue ? "Vencido" : daysFromDue != null && daysFromDue >= -7 && daysFromDue < 0 ? "A vencer" : "Pendente";
            const statusClass = isPaid ? "success" : isOverdue ? "danger" : daysFromDue != null && daysFromDue < 0 ? "warning" : "warning";
            const alertaPagar = isPaid
              ? "Quitado"
              : isOverdue
                ? `Vencido há ${atrasoDias} dia(s)`
                : daysFromDue != null && daysFromDue >= -7 && daysFromDue < 0
                  ? `Vence em ${Math.abs(daysFromDue)} dia(s)`
                  : "No prazo";
            const hasAtt = financeAttachmentGet("payable", p.id);
            const movPay = (state.cash || []).find((m) => m.tipo_conta === "PAGAR" && String(m.conta_id) === String(p.id));
            const acoes = isPaid
              ? `
                  <button class="secondary" data-action="editar-pago" data-id="${p.id}">Editar</button>
                  ${hasAtt ? `<button class="secondary" data-action="ver-comprovante" data-kind="payable" data-id="${p.id}">Comprovante</button>` : ""}
                  <button class="secondary" data-action="apagar-pago" data-id="${p.id}">Apagar</button>
                `
              : `
                  <button class="secondary" data-action="pagar" data-id="${p.id}">Registrar pagamento</button>
                  <button class="secondary" data-action="editar-despesa" data-id="${p.id}">Editar</button>
                  <button class="secondary" data-action="apagar-despesa" data-id="${p.id}">Excluir</button>
                `;
            rows.push(`
              <tr>
                <td>${formatDate(p.data_vencimento)}</td>
                <td>${escapeHtml(p.descricao || "Despesa")}</td>
                <td>${escapeHtml(p.fornecedor || "Fornecedor não informado")}</td>
                <td>${escapeHtml(payableCategoryLabel(p.payable_category))}</td>
                <td>${formatCurrency(p.valor)}</td>
                <td>${isPaid ? formatDate(movPay?.data_movimento || p.updated_at) : `${atrasoDias} dia(s)`}<br /><span class="notice">${alertaPagar}</span></td>
                <td><span class="tag ${statusClass}">${statusLabel}</span></td>
                <td class="actions">${acoes}</td>
              </tr>
            `);
          });
        }

        if (currentFinanceView === "faturamento") {
          financeHead.innerHTML = `
            <tr>
              <th>Métrica</th>
              <th>Valor</th>
              <th>Período</th>
              <th>Base</th>
            </tr>`;
          const periodo = financeCompetencia || currentYearMonthLocal();
          const ded = state.payables.filter((p) => p.status === "PAGO").reduce((s, p) => s + Number(p.valor || 0), 0);
          const rec = state.cash.filter((c) => c.tipo_conta === "RECEBER").reduce((s, c) => s + Number(c.valor || 0), 0);
          const bruto = rec + ded;
          rows.push(`<tr><td>Faturamento bruto</td><td>${formatCurrency(bruto)}</td><td>${periodo}</td><td>Entradas + deduções</td></tr>`);
          rows.push(`<tr><td>Deduções</td><td>${formatCurrency(ded)}</td><td>${periodo}</td><td>Descontos e isenções</td></tr>`);
          rows.push(`<tr><td>Faturamento líquido</td><td>${formatCurrency(rec)}</td><td>${periodo}</td><td>Bruto menos deduções</td></tr>`);
        }

        if (currentFinanceView === "historico_pagar") {
          financeHead.innerHTML = `
            <tr>
              <th>Tipo</th>
              <th>Origem</th>
              <th>Valor</th>
              <th>Data</th>
              <th>Status</th>
              <th></th>
            </tr>`;
          const cashByPayable = new Map(
            state.cash.filter((c) => c.tipo_conta === "PAGAR").map((c) => [c.conta_id, c])
          );
          const filtered = state.payables.filter((p) => p.status === "PAGO").filter((p) => {
            if (!historyFilter.from && !historyFilter.to) return true;
            const mov = cashByPayable.get(p.id);
            const dateStr = (mov?.data_movimento || p.data_vencimento || "").toString().slice(0, 10);
            if (!dateStr) return false;
            if (historyFilter.from && dateStr < historyFilter.from) return false;
            if (historyFilter.to && dateStr > historyFilter.to) return false;
            return true;
          }).filter(payableDescMatchesPlate);
          filtered.forEach((p) => {
            const mov = cashByPayable.get(p.id);
            rows.push(`
              <tr>
                <td>Pagar</td>
                <td>${p.descricao || "Despesa"}</td>
                <td>${formatCurrency(mov?.valor || p.valor)}</td>
                <td>${formatDate(mov?.data_movimento || p.data_vencimento)}</td>
                <td><span class="tag success">Pago</span></td>
                <td class="actions">
                  <button class="secondary" data-action="editar-pago" data-id="${p.id}">Editar</button>
                  <button class="secondary" data-action="apagar-pago" data-id="${p.id}">Apagar</button>
                </td>
              </tr>
            `);
          });
        }

        if (!rows.length) {
          const emptyMsg = financeIsReceberView(currentFinanceView)
              ? "Nenhum título em receber com os filtros atuais (placa, RPV, assessoria ou responsável)."
              : financeIsPagarView(currentFinanceView)
                ? "Nenhuma conta a pagar com os filtros atuais."
                : financeIsLancamentosView(currentFinanceView)
                  ? "Nenhum lançamento encontrado com os filtros atuais."
                  : "Nenhum registro financeiro.";
          setEmptyRow(tableFinance, emptyMsg, 6);
        } else {
          tableFinance.innerHTML = rows.join("");
        }
        maybeRefreshListaPanel();
      }

      function setFinanceView(view) {
        const previousFinanceView = currentFinanceView;
        view = financeNormalizeSubview(view);
        if (view === "cadastro_base") view = "contas_pagar";
        currentFinanceView = view;
        if (view === "receitas") {
          lancamentosFilter.tipo = "RECEITA";
          if (financeLancTipo) financeLancTipo.value = "RECEITA";
          if (previousFinanceView !== "receitas") currentReceitasSubView = "inicio";
        } else if (view === "despesas") {
          lancamentosFilter.tipo = "DESPESA";
          if (financeLancTipo) financeLancTipo.value = "DESPESA";
          if (previousFinanceView !== "despesas") currentDespesasSubView = "inicio";
        } else if (view === "contas_pagar") {
          if (previousFinanceView !== "contas_pagar") currentContasPagarSubView = "inicio";
        } else if (view === "contas_receber") {
          if (previousFinanceView !== "contas_receber") currentContasReceberSubView = "inicio";
        }
        const isNone = !view || view === "none";
        const isInicio = view === "inicio";
        const isDashboard = isInicio;
        const isFiltersView = false;
        const financeRoot = document.getElementById("viewFinanceiro");
        const isLayoutV2 = !!financeRoot?.classList.contains("finance-module-shell");
        const isFlyoutView = !isLayoutV2 && !isNone && !isInicio;
        if (view === "relatorios" && previousFinanceView !== "relatorios") {
          reportHasRun = false;
        }
        const isFullscreenSubview = isFlyoutView;
        if (financeRoot) {
          if (isNone) financeRoot.removeAttribute("data-finance-view");
          else financeRoot.setAttribute("data-finance-view", view);
          financeRoot.classList.toggle("finance-subview-fullscreen", isFullscreenSubview);
        }
        if (financeFlyoutClose) financeFlyoutClose.textContent = "X";
        if (financeViewBadge) financeViewBadge.textContent = `Visão: ${FINANCE_VIEW_LABELS[view] || "Dashboard"}`;
        const pageTitle = FINANCE_VIEW_LABELS[view] || "Dashboard";
        const financePageTitle = document.getElementById("financePageTitle");
        if (financePageTitle) financePageTitle.textContent = pageTitle;
        if (financeBreadcrumb) financeBreadcrumb.textContent = `Início › Financeiro › ${pageTitle}`;
        if (financeModeBadge) {
          financeModeBadge.textContent = isDashboard
            ? "Modo executivo"
            : isFlyoutView
              ? "Modo operacional"
              : "Modo executivo";
        }
        if (financeCompetenciaBadge) {
          financeCompetenciaBadge.textContent = `Competência: ${formatYearMonthLong(financeCompetencia || currentYearMonthLocal())}`;
        }
        if (financeDashboardMonth) financeDashboardMonth.value = financeCompetencia || currentYearMonthLocal();
        financeSubnav?.querySelectorAll("button").forEach((btn) => {
          const btnSubview = btn.getAttribute("data-subview");
          btn.classList.toggle("active", !isNone && btnSubview === view);
        });
        if (isNone) {
          financeFiltersHub?.classList.add("hidden");
          financeFilters?.classList.add("hidden");
          financeLancamentosFilters?.classList.add("hidden");
          financeLancamentosToolbar?.classList.add("hidden");
          financeLancPagination?.classList.add("hidden");
          financeLancSidePanel?.classList.add("hidden");
          financeCaixaFilters?.classList.add("hidden");
          receivableAlert?.classList.add("hidden");
          if (financeContent) financeContent.classList.add("hidden");
          document.getElementById("financeInicioPanel")?.classList.add("hidden");
          financeRoot?.classList.remove("finance-flyout-open", "finance-subview-fullscreen", "finance-subtab-modal-open");
          financeSidebarOpen = false;
          financeRoot?.classList.remove("finance-sidebar-open");
          if (financeSidebarToggle) financeSidebarToggle.setAttribute("aria-expanded", "false");
          financeSidebarBackdrop?.classList.add("hidden");
          financeFlyoutBackdrop?.classList.add("hidden");
          document.getElementById("financeAguardandoIntro")?.classList.add("hidden");
          document.getElementById("financeReceberFilters")?.classList.add("hidden");
          document.getElementById("financePagarFilters")?.classList.add("hidden");
          rehomeFinanceContentToModule();
          renderFinance();
          return;
        }
        const isTabModalView = !isNone && !isInicio;
        const showFinanceContent = isTabModalView && !isFiltersView;
        const showFiltersHub = false;
        const showPlateSearchFilter = false;
        const showReportFilters = view === "relatorios";
        const showLancamentosFilters = financeIsLancamentosView(view);
        const showLancamentosToolbar = financeIsLancamentosView(view);
        const showCaixaFilters = false;
        const showReceberFilters =
          financeIsReceberView(view) && financeContasReceberSubShowsTable(currentContasReceberSubView);
        const showPagarFilters =
          financeIsPagarView(view) && financeContasPagarSubShowsTable(currentContasPagarSubView);
        financeFiltersHub?.classList.toggle("hidden", !showFinanceContent);
        if (financePlateSearchForm) financePlateSearchForm.classList.toggle("hidden", !showPlateSearchFilter);
        financeRoot?.classList.toggle("finance-flyout-open", false);
        financeFlyoutBackdrop?.classList.toggle("hidden", true);
        const financeInicioPanel = document.getElementById("financeInicioPanel");
        if (financeInicioPanel) {
          financeInicioPanel.classList.toggle("hidden", !isInicio);
          if (isInicio) {
            financeInicioPanel.classList.remove("air-open");
            void financeInicioPanel.offsetWidth;
            financeInicioPanel.classList.add("air-open");
          }
        }
        financeRoot?.classList.toggle("finance-subtab-modal-open", isTabModalView);
        if (financeContent) {
          financeContent.classList.toggle("hidden", !showFinanceContent);
          if (showFinanceContent) {
            ensureTabModalShell(financeContent, returnToPainelFromFinanceFlyout);
            const tabMeta = FINANCE_TAB_LABELS[view] || { title: pageTitle, subtitle: "" };
            setTabModalMeta(financeContent, tabMeta.title, tabMeta.subtitle);
            financeContent.classList.remove("air-open");
            void financeContent.offsetWidth;
            financeContent.classList.add("air-open");
          } else {
            rehomeFinanceContentToModule();
          }
        }
        financeRoot?.classList.remove("finance-flyout-open", "finance-subview-fullscreen");
        financeFlyoutBackdrop?.classList.add("hidden");
        financeFilters?.classList.toggle("hidden", !showReportFilters);
        financeReportExtraFilters?.classList.toggle("hidden", !showReportFilters);
        financeLancamentosFilters?.classList.toggle("hidden", !showLancamentosFilters);
        financeLancamentosToolbar?.classList.toggle("hidden", !showLancamentosToolbar);
        financeLancPagination?.classList.toggle("hidden", !financeIsLancamentosView(view));
        if (!financeIsLancamentosView(view)) financeLancSidePanel?.classList.add("hidden");
        financeCaixaFilters?.classList.toggle("hidden", !showCaixaFilters);
        if (view === "caixa") {
          caixaFilter.month = financeCompetencia || currentYearMonthLocal();
          if (financeCaixaMonth) financeCaixaMonth.value = caixaFilter.month;
        }
        if (view === "fluxo_caixa") {
          caixaFilter.month = caixaFilter.month || financeCompetencia || currentYearMonthLocal();
          if (financeCaixaMonth) financeCaixaMonth.value = caixaFilter.month;
        }
        const triagemIntro = document.getElementById("financeAguardandoIntro");
        if (triagemIntro) {
          if (financeIsAguardandoFaturamentoView(view)) {
            triagemIntro.textContent =
              "Veículos removidos do pátio (VRP) entram aqui com valor calculado automaticamente. Revise o cálculo, gere cobrança e fatura, e envie para Contas a Receber quando estiver pronto.";
            triagemIntro.classList.remove("hidden");
          } else {
            triagemIntro.classList.add("hidden");
          }
        }
        document.getElementById("financeReceberFilters")?.classList.toggle("hidden", !showReceberFilters);
        document.getElementById("financePagarFilters")?.classList.toggle("hidden", !showPagarFilters);
        if (showReceberFilters) {
          const st = document.getElementById("financeReceberFilterStatus");
          if (st && st.value !== financeReceberStatusFilter) st.value = financeReceberStatusFilter;
        }
        if (showPagarFilters) {
          const st = document.getElementById("financePagarFilterStatus");
          if (st && st.value !== financePagarStatusFilter) st.value = financePagarStatusFilter;
        }
        const financeNovoClienteBtn = document.getElementById("financeNovoClienteBtn");
        const financeNovoLancamentoBtn = document.getElementById("financeNovoLancamentoBtn");
        if (financeNovoClienteBtn) financeNovoClienteBtn.classList.toggle("hidden", view !== "clientes");
        if (financeNovoLancamentoBtn) {
          financeNovoLancamentoBtn.classList.toggle(
            "hidden",
            view === "receitas" ||
              view === "despesas" ||
              (!financeIsLancamentosView(view) && !financeIsPagarView(view))
          );
          financeNovoLancamentoBtn.textContent =
            view === "despesas" || view === "contas_pagar" ? "+ Nova despesa" : "+ Nova receita";
        }
        if (financeLancTipo) {
          financeLancTipo.disabled = view === "receitas" || view === "despesas";
        }
        document.getElementById("financeReceitasPanel")?.classList.toggle("hidden", view !== "receitas");
        document.getElementById("financeDespesasPanel")?.classList.toggle("hidden", view !== "despesas");
        document.getElementById("financeContasPagarPanel")?.classList.toggle("hidden", view !== "contas_pagar");
        document.getElementById("financeContasReceberPanel")?.classList.toggle("hidden", view !== "contas_receber");
        if (view !== "receitas" && view !== "despesas") financeLancList?.classList.remove("hidden");
        if (!financeIsPagarView(view) && !financeIsReceberView(view)) {
          document.getElementById("financeContasTableShell")?.classList.remove("hidden");
        }
        applyFinanceSubTabShell(view);
        renderFinance();
        if (financeIsSubTabView(view)) scrollFinanceSubtabIntoView();
      }

      function renderFinanceClientes() {
        const tableEl = document.getElementById("tableFinanceClientes");
        if (!tableEl) return;
        const busca = String(document.getElementById("financeClientesBusca")?.value || "")
          .trim()
          .toLowerCase();
        const parceiros = (state.partners || []).filter((p) => isLocalizadorPartnerType(p.tipo || "PARCEIRO"));
        const receivableMap = new Map((state.receivables || []).map((r) => [r.id, r]));
        const vehicleMap = new Map((state.vehicles || []).map((v) => [v.id, v]));
        const revenueByPartner = new Map();
        const vehiclesByPartner = new Map();
        (state.vehicles || []).forEach((v) => {
          if (!v.localizador_id) return;
          vehiclesByPartner.set(v.localizador_id, (vehiclesByPartner.get(v.localizador_id) || 0) + 1);
        });
        (state.cash || [])
          .filter((c) => c.tipo_conta === "RECEBER")
          .forEach((c) => {
            const receivable = receivableMap.get(c.conta_id);
            if (!receivable) return;
            const vehicle = vehicleMap.get(receivable.vehicle_id);
            if (!vehicle?.localizador_id) return;
            revenueByPartner.set(
              vehicle.localizador_id,
              (revenueByPartner.get(vehicle.localizador_id) || 0) + Number(c.valor || 0)
            );
          });
        const filtered = parceiros.filter((p) => {
          if (!busca) return true;
          const hay = `${p.nome || ""} ${p.contato || ""} ${p.email || ""} ${p.cpf || ""}`.toLowerCase();
          return hay.includes(busca);
        });
        const totalReceita = [...revenueByPartner.values()].reduce((s, v) => s + v, 0);
        const ticket = filtered.length ? totalReceita / filtered.length : 0;
        const setEl = (id, txt) => {
          const el = document.getElementById(id);
          if (el) el.textContent = txt;
        };
        setEl("fcTotalClientes", String(filtered.length));
        setEl("fcReceitaClientes", formatCurrency(totalReceita));
        setEl("fcTicketClientes", formatCurrency(ticket));
        if (!filtered.length) {
          setEmptyRow(tableEl, busca ? "Nenhum cliente encontrado para a busca." : "Nenhum localizador cadastrado. Toque em + Novo cliente.", 5);
          return;
        }
        const initials = (name) => {
          const parts = String(name || "?").trim().split(/\s+/).filter(Boolean);
          if (!parts.length) return "?";
          if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
          return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        };
        tableEl.innerHTML = filtered
          .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || "")))
          .map((p) => {
            const receita = revenueByPartner.get(p.id) || 0;
            const veiculos = vehiclesByPartner.get(p.id) || 0;
            const contato = [p.contato, p.email].filter(Boolean).join(" • ") || "-";
            return `
              <tr>
                <td>
                  <span class="finance-ft-client-avatar">${escapeHtml(initials(p.nome))}</span>
                  ${escapeHtml(p.nome || "-")}
                </td>
                <td>${escapeHtml(contato)}</td>
                <td>${veiculos}</td>
                <td>${formatCurrency(receita)}</td>
                <td class="actions">
                  <button class="secondary" type="button" data-action="editar-parceiro" data-id="${p.id}">Editar</button>
                </td>
              </tr>
            `;
          })
          .join("");
      }

      function refreshFinanceTableDataLabels() {
        if (!financeHead || !tableFinance) return;
        const headers = Array.from(financeHead.querySelectorAll("th")).map((th) => (th.textContent || "").trim() || "Campo");
        Array.from(tableFinance.querySelectorAll("tr")).forEach((tr) => {
          Array.from(tr.children).forEach((td, idx) => {
            if (!(td instanceof HTMLElement)) return;
            td.setAttribute("data-label", headers[idx] || "Campo");
          });
        });
      }
      function getFinanceRoot() {
        return document.getElementById("viewFinanceiro");
      }

      const closePatioMenu = () => {
        patioSubnav?.classList.remove("open");
      };
      function returnToPainelFromPatioFlyout() {
        setPatioView("none", { silent: true });
        navStack.splice(0, navStack.length, "patio", "patio:inicio");
        showMainView("patio");
        setPatioView("inicio");
        setFinanceView("none");
      }
      function returnToPainelFromFinanceFlyout() {
        if (currentFinanceView === "inicio" || currentFinanceView === "none") {
          rehomeFinanceContentToModule();
          return;
        }
        const top = navStack[navStack.length - 1];
        if (top && typeof top === "string" && top.startsWith("financeiro:") && top !== "financeiro:inicio") {
          navStack.pop();
        }
        if (navStack[navStack.length - 1] === "financeiro") {
          navStack.push("financeiro:inicio");
        } else if (navStack[navStack.length - 1] !== "financeiro:inicio") {
          navStack.splice(0, navStack.length, "financeiro", "financeiro:inicio");
        }
        showMainView("financeiro");
        setFinanceView("inicio");
      }
      patioFlyoutBackdrop?.addEventListener("click", returnToPainelFromPatioFlyout);

      openVehicleForm?.addEventListener("click", () => {
        openVehicleModal("create");
      });
      patioMenuNewVehicle?.addEventListener("click", () => {
        closePatioMenu();
        openVehicleModal("create");
      });

      cancelVehicleForm.addEventListener("click", () => {
        vehicleForm.reset();
        editingVehicleId = null;
        vehicleModal.classList.add("hidden");
      });

      openPartnerForm.addEventListener("click", () => {
        if (currentPartnerView === "assessorias") partnerModalTitle.textContent = "Nova assessoria";
        else if (currentPartnerView === "instituicoes_financeiras")
          partnerModalTitle.textContent = "Nova instituição financeira";
        else if (currentPartnerView === "leiloeiros") partnerModalTitle.textContent = "Novo leiloeiro";
        else if (currentPartnerView === "remocoes") partnerModalTitle.textContent = "Novo serviço de remoção";
        else partnerModalTitle.textContent = "Novo RPV";
        syncPartnerFormForCurrentView();
        partnerForm.reset();
        partnerModal.classList.remove("hidden");
      });

      cancelPartnerForm.addEventListener("click", () => {
        partnerForm.reset();
        partnerModal.classList.add("hidden");
      });

      const openNewPayableModal = () => {
        openLancamentoModal("DESPESA");
      };
      openPayableForm?.addEventListener("click", openNewPayableModal);

      cancelPayableForm.addEventListener("click", () => {
        payableForm.reset();
        payableModal.classList.add("hidden");
      });

      closeVehicleModal.addEventListener("click", () => vehicleModal.classList.add("hidden"));
      closePartnerModal.addEventListener("click", () => partnerModal.classList.add("hidden"));
      closeDateModal.addEventListener("click", () => {
        dateModal.classList.add("hidden");
        if (dateModalResolver) {
          dateModalResolver(null);
          dateModalResolver = null;
        }
      });
      closeLiberacaoModal.addEventListener("click", () => {
        liberacaoModal.classList.add("hidden");
        if (liberacaoModalResolver) {
          liberacaoModalResolver(null);
          liberacaoModalResolver = null;
        }
      });
      closePayableModal.addEventListener("click", () => payableModal.classList.add("hidden"));
      closeLancamentoModal?.addEventListener("click", closeLancamentoModalFn);
      cancelLancamentoForm?.addEventListener("click", closeLancamentoModalFn);
      document.querySelectorAll(".lanc-tipo-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          if (lancamentoLockTipo) return;
          syncLancamentoModalTipo(btn.getAttribute("data-lanc-tipo"));
        });
      });
      document.getElementById("lancModo")?.addEventListener("change", syncLancamentoModoFields);
      lancamentoForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const descricao = document.getElementById("lancDesc")?.value?.trim() || "";
        const valor = Number(document.getElementById("lancValor")?.value || 0);
        const data = document.getElementById("lancData")?.value || "";
        const vencimento = document.getElementById("lancVencimento")?.value || data;
        const categoria =
          lancCategoria?.value || (lancamentoTipoAtual === "RECEITA" ? "GUARDA_PATIO" : "OUTROS");
        const formaPagamento = document.getElementById("lancFormaPagamento")?.value || "PIX";
        const observacoes = document.getElementById("lancObs")?.value?.trim() || "";
        const pago = document.getElementById("lancStatus")?.value === "PAGO";
        const competencia = document.getElementById("lancCompetencia")?.value || yearMonthFromYmd(data);
        const modo = document.getElementById("lancModo")?.value || "UNICA";
        const parcelas = Number(document.getElementById("lancParcelas")?.value || 2);
        const natureza = document.getElementById("lancNatureza")?.value || "VARIAVEL";
        const centroCusto = document.getElementById("lancCentroCusto")?.value || "";
        if (!descricao || !data || !(valor > 0)) {
          alert("Preencha descrição, valor e data.");
          return;
        }
        if (modo === "PARCELADA" && parcelas < 2) {
          alert("Informe pelo menos 2 parcelas.");
          return;
        }
        const submitBtn = document.getElementById("lancSubmitBtn");
        if (submitBtn) submitBtn.disabled = true;
        try {
          const anexo = await readLancAnexoFile();
          if (lancamentoTipoAtual === "RECEITA") {
            const cliente = lancCliente?.value || "";
            const result = await insertManualReceivableLancamento({
              descricao,
              valor,
              data,
              vencimento,
              categoria,
              cliente,
              formaPagamento,
              observacoes,
              pago,
              modo,
              parcelas,
              competencia,
            });
            if (result.error) {
              alert(result.error.message || "Não foi possível salvar a receita.");
              return;
            }
            if (anexo && result.ids?.length) {
              for (const rid of result.ids) await financeAttachmentSave("receivable", rid, anexo);
            } else if (anexo && result.id) {
              await financeAttachmentSave("receivable", result.id, anexo);
            }
            await Promise.all([loadReceivables(), loadCash()]);
            if (!pago) {
              alert(
                `Receita registrada no Controle de Receitas.\n\nTítulo gerado automaticamente em Contas a Receber com vencimento em ${formatDate(vencimento)}.`
              );
            }
          } else {
            const fornecedor = document.getElementById("lancFornecedor")?.value?.trim() || "";
            const result = await insertManualPayableLancamento({
              descricao,
              valor,
              vencimento,
              categoria,
              fornecedor,
              formaPagamento,
              observacoes,
              pago,
              modo,
              parcelas,
              natureza,
              centroCusto,
              competencia,
            });
            if (result.error) {
              alert(result.error.message || "Não foi possível salvar a despesa.");
              return;
            }
            if (anexo && result.ids?.length) {
              for (const pid of result.ids) await financeAttachmentSave("payable", pid, anexo);
            } else if (anexo && result.id) {
              await financeAttachmentSave("payable", result.id, anexo);
            }
            await Promise.all([loadPayables(), loadCash()]);
            if (!pago) {
              alert(
                `Despesa registrada no Controle de Despesas.\n\nTítulo gerado automaticamente em Contas a Pagar com vencimento em ${formatDate(vencimento)}.`
              );
            }
          }
          closeLancamentoModalFn();
          renderFinance();
          updateDashboard();
        } finally {
          if (submitBtn) submitBtn.disabled = false;
        }
      });
      closeFichaModal.addEventListener("click", () => {
        fichaModal.classList.add("hidden");
        delete fichaModal.dataset.openVehicleId;
      });
      closeNfseModal.addEventListener("click", () => {
        void cancelNfseModal();
      });
      cancelNfseConfirm?.addEventListener("click", () => {
        void cancelNfseModal();
      });
      nfseCopyBtn?.addEventListener("click", async () => {
        if (!nfseTexto?.value) return;
        try {
          await navigator.clipboard.writeText(nfseTexto.value);
        } catch (e) {
          nfseTexto.focus();
          nfseTexto.select();
          try {
            document.execCommand("copy");
          } catch (err) {
            alert("Não foi possível copiar automaticamente. Selecione o texto e copie manualmente.");
            return;
          }
        }
        const vehicle = state.vehicles.find((v) => String(v.id) === String(nfseVehicleId));
        if (vehicle?.nfse_status === "EMITIDA") return;
        nfseConfirmActions?.classList.remove("hidden");
        if (nfseCopyHint) {
          nfseCopyHint.textContent = "Texto copiado. Confirme se a nota já foi emitida ou cancele para manter como estava.";
        }
      });
      printFicha.addEventListener("click", () => window.print());
      downloadFicha.addEventListener("click", async () => {
        if (!fichaCapture) return;
        let h2c;
        try {
          h2c = await loadHtml2Canvas();
        } catch (e) {
          alert("Não foi possível carregar a ferramenta de imagem. Verifique a internet.");
          return;
        }
        if (!h2c) return;
        try {
          const canvas = await h2c(fichaCapture, { backgroundColor: "#ffffff", scale: 2 });
          const link = document.createElement("a");
          link.href = canvas.toDataURL("image/png");
          link.download = "ficha-veiculo.png";
          link.click();
        } catch (e) {
          console.error(e);
          alert("Não foi possível gerar a imagem neste aparelho.");
        }
      });
      closeTextModal.addEventListener("click", () => textModal.classList.add("hidden"));
      closeTextModal2.addEventListener("click", () => textModal.classList.add("hidden"));
      function hideReciboModalResumo() {
        const resumo = document.getElementById("reciboModalResumoAuto");
        if (resumo) {
          resumo.innerHTML = "";
          resumo.classList.add("hidden");
        }
      }
      function hideReciboModalAndMaybeReturn() {
        reciboModal.classList.add("hidden");
        hideReciboModalResumo();
        if (reciboModalResolver) {
          reciboModalResolver(null);
          reciboModalResolver = null;
        }
      }
      closeReciboModal?.addEventListener("click", hideReciboModalAndMaybeReturn);
      cancelReciboModal?.addEventListener("click", hideReciboModalAndMaybeReturn);
      confirmReciboModal?.addEventListener("click", async () => {
        const fields = readReciboDestinatarioFields();
        if (!fields) return;
        const ctx = pendingReciboContext;
        reciboModal.classList.add("hidden");
        hideReciboModalResumo();
        if (reciboModalResolver) {
          reciboModalResolver(fields);
          reciboModalResolver = null;
          return;
        }
        if (ctx?.receivable) {
          await downloadReciboPdf({
            receivable: ctx.receivable,
            vehicle: ctx.vehicle,
            destinatarioNome: fields.nome,
            destinatarioDoc: fields.doc,
            valor: ctx.valor ?? Number(ctx.receivable.valor || 0),
          });
          pendingReciboContext = null;
        }
      });
      printReciboModal?.addEventListener("click", () => {
        const fields = readReciboDestinatarioFields();
        if (!fields) return;
        const ctx = pendingReciboContext;
        if (!ctx?.receivable) {
          alert("Abra o recibo a partir de «Dar baixa e emitir recibo» ou do caixa.");
          return;
        }
        printReciboRecebimento({
          receivable: ctx.receivable,
          vehicle: ctx.vehicle,
          destinatarioNome: fields.nome,
          destinatarioDoc: fields.doc,
          valor: ctx.valor ?? Number(ctx.receivable.valor || 0),
        });
      });
      document.getElementById("closeReceberBaixaModal")?.addEventListener("click", closeReceberBaixaModal);
      document.getElementById("cancelReceberBaixaModal")?.addEventListener("click", closeReceberBaixaModal);
      receberBaixaModal?.addEventListener("click", (e) => {
        if (e.target === e.currentTarget) closeReceberBaixaModal();
      });
      document.getElementById("receberBaixaOk")?.addEventListener("click", () => {
        void executeReceberBaixa("ok");
      });
      document.getElementById("receberBaixaGerarPdf")?.addEventListener("click", () => {
        void executeReceberBaixa("pdf");
      });
      document.getElementById("closePagarBaixaModal")?.addEventListener("click", closePagarBaixaModal);
      document.getElementById("cancelPagarBaixaModal")?.addEventListener("click", closePagarBaixaModal);
      pagarBaixaModal?.addEventListener("click", (e) => {
        if (e.target === e.currentTarget) closePagarBaixaModal();
      });
      document.getElementById("pagarBaixaConfirm")?.addEventListener("click", () => {
        void executePagarBaixa();
      });
      document.getElementById("closeFinanceCobrancaModal")?.addEventListener("click", closeFinanceCobrancaModal);
      document.getElementById("cancelFinanceCobrancaModal")?.addEventListener("click", closeFinanceCobrancaModal);
      financeCobrancaModal?.addEventListener("click", (e) => {
        if (e.target === e.currentTarget) closeFinanceCobrancaModal();
      });
      document.getElementById("financeCobrancaCopiar")?.addEventListener("click", async () => {
        const id = pendingCobrancaReceivableId;
        const txt = document.getElementById("financeCobrancaTexto")?.value || "";
        if (!id || !txt.trim()) return;
        try {
          await navigator.clipboard.writeText(txt);
        } catch (e) {
          /* fallback abaixo */
        }
        const flags = financeReceberFlagsRead();
        flags[String(id)] = { ...(flags[String(id)] || {}), ultima_cobranca: new Date().toISOString() };
        const tel = document.getElementById("financeCobrancaTelefone")?.value?.trim();
        if (tel) flags[String(id)].telefone_cobranca = tel;
        financeReceberFlagsWrite(flags);
        closeFinanceCobrancaModal();
        alert("Mensagem copiada e envio registrado.");
        renderFinance();
      });
      document.getElementById("financeCobrancaWhatsapp")?.addEventListener("click", async () => {
        const id = pendingCobrancaReceivableId;
        const txt = document.getElementById("financeCobrancaTexto")?.value || "";
        const telRaw = document.getElementById("financeCobrancaTelefone")?.value || "";
        const digits = financeWhatsappDigits(telRaw);
        if (!digits) {
          alert("Informe um número de WhatsApp válido (DDD + número).");
          return;
        }
        if (id) {
          const flags = financeReceberFlagsRead();
          flags[String(id)] = {
            ...(flags[String(id)] || {}),
            ultima_cobranca: new Date().toISOString(),
            telefone_cobranca: telRaw.trim(),
          };
          financeReceberFlagsWrite(flags);
        }
        const url = `https://wa.me/${digits}?text=${encodeURIComponent(txt)}`;
        window.open(url, "_blank");
        closeFinanceCobrancaModal();
        renderFinance();
      });
      document.getElementById("closeFinanceContaEditModal")?.addEventListener("click", closeFinanceContaEditModal);
      document.getElementById("cancelFinanceContaEditModal")?.addEventListener("click", closeFinanceContaEditModal);
      financeContaEditModal?.addEventListener("click", (e) => {
        if (e.target === e.currentTarget) closeFinanceContaEditModal();
      });
      financeContaEditForm?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const ctx = pendingContaEdit;
        if (!ctx?.record?.id) return;
        const valor = Number(document.getElementById("financeContaEditValor")?.value || 0);
        const vencimento = document.getElementById("financeContaEditVencimento")?.value || "";
        const categoria = document.getElementById("financeContaEditCategoria")?.value || "";
        if (!(valor > 0) || !vencimento) {
          alert("Informe valor e vencimento.");
          return;
        }
        if (ctx.kind === "receivable") {
          const cliente = document.getElementById("financeContaEditCliente")?.value?.trim() || "";
          const { error } = await supabase
            .from("receivables")
            .update({
              responsavel_pagamento: cliente || ctx.record.responsavel_pagamento,
              valor,
              period_end: vencimento,
              receivable_category: categoria,
            })
            .eq("id", ctx.record.id)
            .eq("user_id", effectiveUserId());
          if (error) {
            alert(error.message);
            return;
          }
          await loadReceivables();
        } else {
          const descricao = document.getElementById("financeContaEditDesc")?.value?.trim() || "";
          const fornecedor = document.getElementById("financeContaEditFornecedor")?.value?.trim() || "";
          const { error } = await supabase
            .from("payables")
            .update({
              descricao: descricao || null,
              fornecedor: fornecedor || null,
              valor,
              data_vencimento: vencimento,
              payable_category: categoria,
            })
            .eq("id", ctx.record.id)
            .eq("user_id", effectiveUserId());
          if (error) {
            alert(error.message);
            return;
          }
          await loadPayables();
        }
        closeFinanceContaEditModal();
        renderFinance();
        updateDashboard();
      });
      copyTextModal.addEventListener("click", async () => {
        if (!textModalBody.value) return;
        await navigator.clipboard.writeText(textModalBody.value);
      });
      confirmDateModal.addEventListener("click", () => {
        const value = dateModalInput.value || null;
        if (!value) {
          alert("Selecione uma data para continuar.");
          return;
        }
        dateModal.classList.add("hidden");
        if (dateModalResolver) {
          dateModalResolver(value);
          dateModalResolver = null;
        }
      });
      cancelDateModal.addEventListener("click", () => {
        dateModal.classList.add("hidden");
        if (dateModalResolver) {
          dateModalResolver(null);
          dateModalResolver = null;
        }
      });
      cancelLiberacaoModal.addEventListener("click", () => {
        liberacaoModal.classList.add("hidden");
        if (liberacaoModalResolver) {
          liberacaoModalResolver(null);
          liberacaoModalResolver = null;
        }
        workflowModalConfig = null;
      });
      confirmLiberacaoModal.addEventListener("click", () => {
        if (!workflowModalConfig) return;
        const solicitante = (libSolicitante.value || "").trim();
        const confirmador = (libConfirmador.value || "").trim();
        const responsavelFinanceiro = (libResponsavelPagamento.value || "").trim();
        const solicitanteRemocao = (libSolicitanteRemocao.value || "").trim();
        const removeu = (libRemoveu.value || "").trim();
        const required = workflowModalConfig.requiredFields || [];
        if (required.includes("solicitante") && !solicitante) return alert("Informe quem solicitou a liberação.");
        if (required.includes("confirmador") && !confirmador) return alert("Informe quem confirmou a liberação.");
        if (required.includes("responsavelFinanceiro") && !responsavelFinanceiro)
          return alert("Informe o RPF (responsável financeiro / pagamento).");
        if (required.includes("solicitanteRemocao") && !solicitanteRemocao)
          return alert("Informe quem solicitou a remoção.");
        if (required.includes("removeu") && !removeu) return alert("Informe quem removeu o veículo.");
        liberacaoModal.classList.add("hidden");
        if (liberacaoModalResolver) {
          liberacaoModalResolver({
            solicitante,
            confirmador,
            responsavelFinanceiro,
            solicitanteRemocao,
            removeu,
          });
          liberacaoModalResolver = null;
        }
        workflowModalConfig = null;
      });

      [vehicleModal, partnerModal, dateModal, liberacaoModal, payableModal, lancamentoModal, fichaModal, nfseModal, textModal, reciboModal, receberBaixaModal, pagarBaixaModal, financeCobrancaModal, financeContaEditModal, document.getElementById("financeCalculoDetalheModal")].filter(Boolean).forEach((modal) => {
        modal.addEventListener("click", (event) => {
          if (event.target === modal) {
            modal.classList.add("hidden");
            if (modal === fichaModal) delete fichaModal.dataset.openVehicleId;
            if (modal === dateModal && dateModalResolver) {
              dateModalResolver(null);
              dateModalResolver = null;
            }
            if (modal === liberacaoModal && liberacaoModalResolver) {
              liberacaoModalResolver(null);
              liberacaoModalResolver = null;
              workflowModalConfig = null;
            }
            if (modal === reciboModal) {
              hideReciboModalAndMaybeReturn();
            }
          }
        });
      });

      function openTextModal(title, body) {
        textModalTitle.textContent = title;
        textModalBody.value = body;
        textModal.classList.remove("hidden");
      }

      let dateModalResolver = null;
      let liberacaoModalResolver = null;
      let reciboModalResolver = null;
      let workflowModalConfig = null;
      function openDateModal({ title, label, type = "date", value = "" }) {
        return new Promise((resolve) => {
          dateModalResolver = resolve;
          dateModalTitle.textContent = title || "Selecionar data";
          dateModalLabel.textContent = label || (type === "datetime-local" ? "Data e hora" : "Data");
          dateModalInput.type = type;
          dateModalInput.value = value || "";
          dateModal.classList.remove("hidden");
          // showPicker exige gesto do usuário; deixamos o usuário abrir o calendário.
        });
      }

      function setWorkflowFieldVisibility(row, visible) {
        if (!row) return;
        row.classList.toggle("hidden", !visible);
        row.setAttribute("aria-hidden", visible ? "false" : "true");
      }

      function readReciboDestinatarioFields() {
        const nome = (reciboDestinatarioNome?.value || "").trim();
        const doc = (reciboDestinatarioDoc?.value || "").trim();
        if (!nome) {
          alert("Informe o nome do direcionado.");
          return null;
        }
        if (!doc) {
          alert("Informe o CPF ou CNPJ do direcionado.");
          return null;
        }
        return { nome, doc };
      }

      let pendingReciboContext = null;
      let pendingBaixaReceber = null;
      let pendingBaixaPagar = null;
      let pendingCobrancaReceivableId = null;
      let pendingContaEdit = null;

      function openReceberBaixaModal({ receivable, vehicle, valor }) {
        if (!receivable || !receberBaixaModal) return;
        pendingBaixaReceber = {
          receivableId: receivable.id,
          valor: Number(valor || receivable.valor || 0),
          receivable,
          vehicle: vehicle || null,
        };
        const resumo = document.getElementById("receberBaixaResumo");
        if (resumo) {
          const placa = vehicle?.placa || "—";
          const vm = [vehicle?.marca, vehicle?.modelo].filter(Boolean).join(" ") || "—";
          const val = formatCurrency(Number(valor || receivable.valor || 0));
          const servico = receivableCategoryLabel(receivable.receivable_category);
          resumo.innerHTML = `<strong>${escapeHtml(receivable.responsavel_pagamento || "Responsável")}</strong><br />
            ${vehicle ? `Veículo: <strong>${escapeHtml(vm)}</strong> — placa <strong>${escapeHtml(placa)}</strong><br />` : ""}
            Serviço: <strong>${escapeHtml(servico)}</strong><br />
            Valor a receber: <strong>${escapeHtml(val)}</strong>`;
        }
        const dataEl = document.getElementById("receberBaixaData");
        const formaEl = document.getElementById("receberBaixaForma");
        const anexoEl = document.getElementById("receberBaixaAnexo");
        if (dataEl) dataEl.value = toLocalYmd(new Date().toISOString());
        if (formaEl) formaEl.value = receivable.forma_pagamento || "PIX";
        if (anexoEl) anexoEl.value = "";
        const obsEl = document.getElementById("receberBaixaObs");
        if (obsEl) obsEl.value = "";
        const nomeEl = document.getElementById("receberBaixaReciboNome");
        const docEl = document.getElementById("receberBaixaReciboDoc");
        if (nomeEl) nomeEl.value = receivable.responsavel_pagamento || "";
        if (docEl) docEl.value = "";
        if (receberBaixaModal.parentElement !== document.body) {
          document.body.appendChild(receberBaixaModal);
        }
        receberBaixaModal.classList.remove("hidden");
        document.getElementById("receberBaixaOk")?.focus();
      }

      function openPagarBaixaModal(payable) {
        if (!payable || !pagarBaixaModal) return;
        pendingBaixaPagar = { payableId: payable.id, payable };
        const resumo = document.getElementById("pagarBaixaResumo");
        if (resumo) {
          resumo.innerHTML = `<strong>${escapeHtml(payable.descricao || "Despesa")}</strong><br />
            Fornecedor: <strong>${escapeHtml(payable.fornecedor || "—")}</strong><br />
            Vencimento: <strong>${escapeHtml(formatDate(payable.data_vencimento))}</strong><br />
            Valor: <strong>${escapeHtml(formatCurrency(Number(payable.valor || 0)))}</strong>`;
        }
        const dataEl = document.getElementById("pagarBaixaData");
        const formaEl = document.getElementById("pagarBaixaForma");
        const anexoEl = document.getElementById("pagarBaixaAnexo");
        if (dataEl) dataEl.value = toLocalYmd(new Date().toISOString());
        if (formaEl) formaEl.value = payable.forma_pagamento || "PIX";
        if (anexoEl) anexoEl.value = "";
        if (pagarBaixaModal.parentElement !== document.body) document.body.appendChild(pagarBaixaModal);
        pagarBaixaModal.classList.remove("hidden");
      }

      function closePagarBaixaModal() {
        pagarBaixaModal?.classList.add("hidden");
        pendingBaixaPagar = null;
      }

      function openFinanceCobrancaModal(receivable) {
        if (!receivable || !financeCobrancaModal) return;
        pendingCobrancaReceivableId = receivable.id;
        const txt = document.getElementById("financeCobrancaTexto");
        const ult = document.getElementById("financeCobrancaUltima");
        if (txt) txt.value = buildCobrancaMessage(receivable);
        const flags = financeReceberFlagsRead()[String(receivable.id)] || {};
        if (ult) {
          ult.textContent = flags.ultima_cobranca
            ? `Última cobrança registrada em ${financeFormatUltimaCobranca(flags.ultima_cobranca)}`
            : "Nenhuma cobrança registrada ainda para este título.";
        }
        const telEl = document.getElementById("financeCobrancaTelefone");
        if (telEl) {
          const nome = String(receivable.responsavel_pagamento || "").trim().toLowerCase();
          const parceiro = (state.partners || []).find(
            (p) => String(p.nome || "").trim().toLowerCase() === nome
          );
          const contato = parceiro?.contato || flags.telefone_cobranca || "";
          telEl.value = contato.replace(/\D/g, "").length >= 10 ? contato : "";
        }
        if (financeCobrancaModal.parentElement !== document.body) document.body.appendChild(financeCobrancaModal);
        financeCobrancaModal.classList.remove("hidden");
        txt?.focus();
      }

      function closeFinanceCobrancaModal() {
        financeCobrancaModal?.classList.add("hidden");
        pendingCobrancaReceivableId = null;
      }

      function openFinanceContaEditModal(ctx) {
        if (!ctx?.kind || !ctx?.record || !financeContaEditModal) return;
        pendingContaEdit = ctx;
        const r = ctx.record;
        const title = document.getElementById("financeContaEditTitle");
        const catSel = document.getElementById("financeContaEditCategoria");
        const descWrap = document.getElementById("financeContaEditDescWrap");
        const cliWrap = document.getElementById("financeContaEditClienteWrap");
        const forWrap = document.getElementById("financeContaEditFornecedorWrap");
        if (ctx.kind === "receivable") {
          if (title) title.textContent = "Editar conta a receber";
          descWrap?.classList.add("hidden");
          cliWrap?.classList.remove("hidden");
          forWrap?.classList.add("hidden");
          document.getElementById("financeContaEditCliente").value = r.responsavel_pagamento || "";
          if (catSel) {
            catSel.innerHTML = getLancReceitaCategorias()
              .map((c) => `<option value="${c.value}">${escapeHtml(c.label)}</option>`)
              .join("");
            catSel.value = r.receivable_category || "GUARDA_PATIO";
          }
          document.getElementById("financeContaEditVencimento").value = (r.period_end || r.period_start || "").slice(0, 10);
        } else {
          if (title) title.textContent = "Editar conta a pagar";
          descWrap?.classList.remove("hidden");
          cliWrap?.classList.add("hidden");
          forWrap?.classList.remove("hidden");
          document.getElementById("financeContaEditDesc").value = r.descricao || "";
          document.getElementById("financeContaEditFornecedor").value = r.fornecedor || "";
          if (catSel) {
            catSel.innerHTML = getLancDespesaCategorias()
              .map((c) => `<option value="${c.value}">${escapeHtml(c.label)}</option>`)
              .join("");
            catSel.value = r.payable_category || "OUTROS";
          }
          document.getElementById("financeContaEditVencimento").value = (r.data_vencimento || "").slice(0, 10);
        }
        document.getElementById("financeContaEditValor").value = Number(r.valor || 0);
        if (financeContaEditModal.parentElement !== document.body) document.body.appendChild(financeContaEditModal);
        financeContaEditModal.classList.remove("hidden");
      }

      function closeFinanceContaEditModal() {
        financeContaEditModal?.classList.add("hidden");
        pendingContaEdit = null;
        financeContaEditForm?.reset();
      }

      document.getElementById("closeFinanceCalculoDetalheModal")?.addEventListener("click", () => {
        document.getElementById("financeCalculoDetalheModal")?.classList.add("hidden");
      });
      document.getElementById("cancelFinanceCalculoDetalheModal")?.addEventListener("click", () => {
        document.getElementById("financeCalculoDetalheModal")?.classList.add("hidden");
      });

      function closeReceberBaixaModal() {
        receberBaixaModal?.classList.add("hidden");
        pendingBaixaReceber = null;
      }

      async function executeReceberBaixa(mode) {
        const pending = pendingBaixaReceber;
        if (!pending) return;
        let destinatarioNome = "";
        let destinatarioDoc = "";
        if (mode === "pdf") {
          destinatarioNome = (document.getElementById("receberBaixaReciboNome")?.value || "").trim();
          destinatarioDoc = (document.getElementById("receberBaixaReciboDoc")?.value || "").trim();
          if (!destinatarioNome) {
            alert("Informe o nome para o recibo em PDF.");
            return;
          }
        }
        const dataMov = document.getElementById("receberBaixaData")?.value || toLocalYmd(new Date().toISOString());
        const formaPagamento = document.getElementById("receberBaixaForma")?.value || "PIX";
        const observacao = (document.getElementById("receberBaixaObs")?.value || "").trim();
        const anexo = await readFinanceFileInput(document.getElementById("receberBaixaAnexo"));
        closeReceberBaixaModal();
        const result = await finalizeReceivablePayment(pending.receivableId, pending.valor, {
          dataMovimento: dataMov,
          formaPagamento,
          anexo,
          observacao,
        });
        if (!result) return;
        if (mode === "pdf") {
          try {
            await downloadReciboPdf({
              receivable: result.receivable,
              vehicle: result.vehicle,
              destinatarioNome,
              destinatarioDoc: destinatarioDoc || "—",
              valor: result.valor,
            });
          } catch (e) {
            console.error(e);
            alert("Baixa confirmada, mas não foi possível gerar o PDF do recibo.");
          }
        }
      }

      async function executePagarBaixa() {
        const pending = pendingBaixaPagar;
        if (!pending) return;
        const dataMov = document.getElementById("pagarBaixaData")?.value || toLocalYmd(new Date().toISOString());
        const formaPagamento = document.getElementById("pagarBaixaForma")?.value || "PIX";
        const anexo = await readFinanceFileInput(document.getElementById("pagarBaixaAnexo"));
        closePagarBaixaModal();
        await finalizePayablePayment(pending.payableId, { dataMovimento: dataMov, formaPagamento, anexo });
      }

      function openReciboModalWithContext(ctx) {
        if (!ctx?.receivable) return;
        pendingReciboContext = ctx;
        if (reciboDestinatarioNome) reciboDestinatarioNome.value = ctx.receivable.responsavel_pagamento || "";
        if (reciboDestinatarioDoc) reciboDestinatarioDoc.value = "";
        const resumo = document.getElementById("reciboModalResumoAuto");
        const vehicle = ctx.vehicle;
        const receivable = ctx.receivable;
        if (resumo && receivable && vehicle) {
          const placa = vehicle.placa || "—";
          const vm = [vehicle.marca, vehicle.modelo].filter(Boolean).join(" ") || "—";
          const pi = receivable.period_start ? formatDateBr(receivable.period_start) : "—";
          const pf = receivable.period_end ? formatDateBr(receivable.period_end) : "—";
          const val = formatCurrency(ctx.valor ?? Number(receivable.valor || 0));
          resumo.innerHTML = `<strong>Dados que vão no PDF (automático)</strong><br />
            Veículo: <strong>${escapeHtml(vm)}</strong> — placa <strong>${escapeHtml(placa)}</strong><br />
            Estadias (período): <strong>${escapeHtml(pi)}</strong> a <strong>${escapeHtml(pf)}</strong><br />
            Valor: <strong>${escapeHtml(val)}</strong>`;
          resumo.classList.remove("hidden");
        } else if (resumo) {
          resumo.innerHTML = "";
          resumo.classList.add("hidden");
        }
        reciboModal?.classList.remove("hidden");
      }

      async function finalizeReceivablePayment(receivableId, totalAtual, opts = {}) {
        const receivable = state.receivables.find((r) => r.id === receivableId);
        if (!receivable) {
          alert("Recebimento não encontrado. Atualize a página (Financeiro) e tente de novo.");
          return null;
        }
        if (receivable.status === "PAGO") {
          alert("Este recebimento já foi marcado como pago.");
          return null;
        }
        const dataMov = opts.dataMovimento || toLocalYmd(new Date().toISOString());
        const formaPagamento = opts.formaPagamento || receivable.forma_pagamento || "PIX";
        const vehicle = state.vehicles.find((v) => v.id === receivable.vehicle_id);
        const { error } = await supabase
          .from("receivables")
          .update({ status: "PAGO", valor: totalAtual, financeiro_aprovado_contas_receber: false, forma_pagamento: formaPagamento })
          .eq("id", receivableId)
          .eq("user_id", effectiveUserId());
        if (error) {
          const { error: errFallback } = await supabase
            .from("receivables")
            .update({ status: "PAGO", valor: totalAtual })
            .eq("id", receivableId)
            .eq("user_id", effectiveUserId());
          if (errFallback) {
            alert(errFallback.message);
            return null;
          }
        }
        if (receivable.vehicle_id) {
          await supabase
            .from("vehicles")
            .update({ payment_status: "PAGO" })
            .eq("id", receivable.vehicle_id)
            .eq("user_id", effectiveUserId());
        }
        const { data: existingMov } = await supabase
          .from("cash_movements")
          .select("id")
          .eq("conta_id", receivableId)
          .eq("tipo_conta", "RECEBER")
          .limit(1);
        const vehicleInfo = `${vehicle?.placa || "-"} • ${[vehicle?.marca, vehicle?.modelo].filter(Boolean).join(" ")}`.trim();
        const descMov = vehicleInfo ? `Diárias - ${vehicleInfo}` : receivable.responsavel_pagamento || "Receita";
        if (!existingMov || existingMov.length === 0) {
          await supabase.from("cash_movements").insert({
            user_id: effectiveUserId(),
            tipo_conta: "RECEBER",
            conta_id: receivableId,
            valor: totalAtual,
            descricao: descMov,
            data_movimento: dataMov,
            forma_pagamento: formaPagamento,
          });
        } else {
          await supabase
            .from("cash_movements")
            .update({ valor: totalAtual, data_movimento: dataMov, forma_pagamento: formaPagamento })
            .eq("conta_id", receivableId)
            .eq("tipo_conta", "RECEBER");
        }
        if (opts.anexo) await financeAttachmentSave("receivable", receivableId, opts.anexo);
        financeAuditAppend(receivableId, "Pagamento confirmado", {
          valor: totalAtual,
          formaPagamento,
          dataMovimento: dataMov,
          observacao: opts.observacao || "",
        });
        try {
          const userId = effectiveUserId();
          if (userId) {
            await callFinanceCompetencyApi("/api/finance/register-payment", {
              userId,
              receivableId,
              vehicleId: receivable.vehicle_id || null,
              amount: totalAtual,
            });
          }
        } catch (e) {
          console.warn("finance competency register payment", e?.message || e);
        }
        removeReceberTriagemId(receivableId);
        await createNextRecorrenteReceivable(receivable);
        await Promise.all([loadReceivables(), loadCash(), loadVehicles()]);
        renderFinance();
        updateDashboard();
        const paidReceivable = state.receivables.find((r) => r.id === receivableId) || {
          ...receivable,
          status: "PAGO",
          valor: totalAtual,
        };
        return {
          receivable: paidReceivable,
          vehicle: vehicle || null,
          valor: totalAtual,
        };
      }

      async function finalizePayablePayment(payableId, opts = {}) {
        const payable = state.payables.find((p) => p.id === payableId);
        if (!payable) {
          alert("Conta a pagar não encontrada.");
          return false;
        }
        if (payable.status === "PAGO") {
          alert("Esta conta já foi paga.");
          return false;
        }
        const dataMov = opts.dataMovimento || toLocalYmd(new Date().toISOString());
        const formaPagamento = opts.formaPagamento || payable.forma_pagamento || "PIX";
        const { error } = await supabase
          .from("payables")
          .update({ status: "PAGO", forma_pagamento: formaPagamento })
          .eq("id", payableId)
          .eq("user_id", effectiveUserId());
        if (error) {
          const { error: errFb } = await supabase
            .from("payables")
            .update({ status: "PAGO" })
            .eq("id", payableId)
            .eq("user_id", effectiveUserId());
          if (errFb) {
            alert(errFb.message);
            return false;
          }
        }
        await supabase.from("cash_movements").insert({
          user_id: effectiveUserId(),
          tipo_conta: "PAGAR",
          conta_id: payableId,
          valor: payable.valor,
          descricao: payable.descricao,
          data_movimento: dataMov,
          forma_pagamento: formaPagamento,
        });
        if (opts.anexo) await financeAttachmentSave("payable", payableId, opts.anexo);

        if ((payable.tipo || "").toUpperCase() === "RECORRENTE" || financeEntryModoFromRecord(payable, "payable") === "RECORRENTE") {
          const nextDue = addMonthsToYmd(payable.data_vencimento, 1);
          const { meta, text } = financeMetaUnpack(payable.observacoes);
          const nextPayload = {
            user_id: effectiveUserId(),
            tipo: "RECORRENTE",
            payable_category: payable.payable_category || "OUTROS",
            descricao: payable.descricao || null,
            valor: Number(payable.valor || 0),
            data_vencimento: nextDue,
            status: "EM_ABERTO",
            fornecedor: payable.fornecedor || null,
            observacoes: financeMetaPack({ ...meta, modo: "RECORRENTE" }, text),
          };
          let { error: nextErr } = await supabase.from("payables").insert(nextPayload);
          if (nextErr && /column|schema cache|PGRST204/i.test(nextErr.message || "")) {
            const fb = { ...nextPayload };
            delete fb.fornecedor;
            delete fb.observacoes;
            ({ error: nextErr } = await supabase.from("payables").insert(fb));
          }
          if (nextErr) {
            alert(`Pagamento registrado, mas falhou ao gerar o próximo título recorrente: ${nextErr.message}`);
          }
        }
        await Promise.all([loadPayables(), loadCash()]);
        renderFinance();
        updateDashboard();
        return true;
      }

      function openReciboDestinatarioModal({ defaultNome = "", defaultDoc = "", receivable = null, vehicle = null }) {
        return new Promise((resolve) => {
          reciboModalResolver = resolve;
          if (reciboDestinatarioNome) reciboDestinatarioNome.value = defaultNome;
          if (reciboDestinatarioDoc) reciboDestinatarioDoc.value = defaultDoc;
          const resumo = document.getElementById("reciboModalResumoAuto");
          if (resumo) {
            if (receivable && vehicle) {
              const placa = vehicle.placa || "—";
              const vm = [vehicle.marca, vehicle.modelo].filter(Boolean).join(" ") || "—";
              const pi = receivable.period_start ? formatDateBr(receivable.period_start) : "—";
              const pf = receivable.period_end ? formatDateBr(receivable.period_end) : "—";
              const val = formatCurrency(Number(receivable.valor || 0));
              resumo.innerHTML = `<strong>Dados que vão no PDF (automático)</strong><br />
                Veículo: <strong>${escapeHtml(vm)}</strong> — placa <strong>${escapeHtml(placa)}</strong><br />
                Estadias (período): <strong>${escapeHtml(pi)}</strong> a <strong>${escapeHtml(pf)}</strong><br />
                Valor: <strong>${escapeHtml(val)}</strong>`;
              resumo.classList.remove("hidden");
            } else {
              resumo.innerHTML = "";
              resumo.classList.add("hidden");
            }
          }
          reciboModal.classList.remove("hidden");
        });
      }

      function openWorkflowStepModal({
        title = "Fluxo VNP",
        submitLabel = "Confirmar",
        requiredFields = [],
        values = {},
        readonly = {},
      }) {
        return new Promise((resolve) => {
          liberacaoModalResolver = resolve;
          workflowModalConfig = { requiredFields };

          if (liberacaoModalTitle) liberacaoModalTitle.textContent = title;
          if (confirmLiberacaoModal) confirmLiberacaoModal.textContent = submitLabel;
          if (libSolicitanteLabel) libSolicitanteLabel.textContent = "Quem solicitou a liberação?";

          setWorkflowFieldVisibility(libRowSolicitante, requiredFields.includes("solicitante") || !!values.solicitante);
          setWorkflowFieldVisibility(libRowConfirmador, requiredFields.includes("confirmador") || !!values.confirmador);
          setWorkflowFieldVisibility(
            libRowResponsavel,
            requiredFields.includes("responsavelFinanceiro") || !!values.responsavelFinanceiro
          );
          setWorkflowFieldVisibility(
            libRowSolicRemocao,
            requiredFields.includes("solicitanteRemocao") || !!values.solicitanteRemocao
          );
          setWorkflowFieldVisibility(libRowRemoveu, requiredFields.includes("removeu") || !!values.removeu);

          libSolicitante.value = values.solicitante || "";
          libConfirmador.value = values.confirmador || "";
          libResponsavelPagamento.value = values.responsavelFinanceiro || "";
          libSolicitanteRemocao.value = values.solicitanteRemocao || "";
          libRemoveu.value = values.removeu || "";

          libSolicitante.readOnly = !!readonly.solicitante;
          libConfirmador.readOnly = !!readonly.confirmador;
          libResponsavelPagamento.readOnly = !!readonly.responsavelFinanceiro;
          libSolicitanteRemocao.readOnly = !!readonly.solicitanteRemocao;
          libRemoveu.readOnly = !!readonly.removeu;

          liberacaoModal.classList.remove("hidden");
        });
      }

      const triggerPatioReload = () => loadVehicles();
      reloadPatio?.addEventListener("click", triggerPatioReload);
      patioMenuReload?.addEventListener("click", () => {
        closePatioMenu();
        triggerPatioReload();
      });
      patioMenuPlateFilter?.addEventListener("click", () => {
        closePatioMenu();
        openPatioSubview("no_patio");
        setTimeout(() => document.getElementById("plateFilterPatio")?.focus(), 60);
      });

      document.getElementById("vlsFilterLocator")?.addEventListener("change", (e) => {
        vlsListFilterLocatorId = e.target.value || "";
        renderVehicles();
      });
      document.getElementById("vlsFilterAssessoria")?.addEventListener("change", (e) => {
        vlsListFilterAssessoriaId = e.target.value || "";
        renderVehicles();
      });
      document.getElementById("vlsFiltersClear")?.addEventListener("click", () => {
        vlsListFilterLocatorId = "";
        vlsListFilterAssessoriaId = "";
        const loc = document.getElementById("vlsFilterLocator");
        const ass = document.getElementById("vlsFilterAssessoria");
        if (loc) loc.value = "";
        if (ass) ass.value = "";
        renderVehicles();
      });

      document.getElementById("listaSubnav")?.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-lista-subview]");
        if (!btn) return;
        openListaSubview(btn.getAttribute("data-lista-subview"));
      });
      document.getElementById("listaFiltersApply")?.addEventListener("click", () => {
        readListaFiltersFromDom();
        renderListaPanel();
      });
      document.getElementById("listaFiltersPrint")?.addEventListener("click", () => {
        runListaPrintDocument();
      });
      document.getElementById("listaFiltersPrintReceber")?.addEventListener("click", () => {
        openListaReceberPrintModal();
      });
      document.getElementById("listaFiltersDownloadPdf")?.addEventListener("click", () => {
        void downloadListaCaptureAsPdf();
      });
      document.getElementById("closeListaReceberPrintModal")?.addEventListener("click", () => {
        document.getElementById("listaReceberPrintModal")?.classList.add("hidden");
      });
      document.getElementById("cancelListaReceberPrintModal")?.addEventListener("click", () => {
        document.getElementById("listaReceberPrintModal")?.classList.add("hidden");
      });
      document.getElementById("confirmListaReceberPrintModal")?.addEventListener("click", () => {
        runListaReceberGroupedPrint();
      });
      document.getElementById("listaPrintFilterClear")?.addEventListener("click", () => {
        ["listaPrintFilterLocator", "listaPrintFilterAssessoria", "listaPrintFilterRpf"].forEach((id) => {
          const el = document.getElementById(id);
          if (el) el.value = "";
        });
        syncListaReceberPrintFilterOptions();
      });
      document.getElementById("listaReceberPrintModal")?.addEventListener("click", (e) => {
        if (e.target === e.currentTarget) e.currentTarget.classList.add("hidden");
      });
      document.getElementById("listaFiltersClear")?.addEventListener("click", () => {
        listaFilterLocatorId = "";
        listaFilterAssessoriaId = "";
        listaFilterRpfId = "";
        listaFilterBanco = "";
        const loc = document.getElementById("listaFilterLocator");
        const ass = document.getElementById("listaFilterAssessoria");
        const rpf = document.getElementById("listaFilterRpf");
        const banco = document.getElementById("listaFilterBanco");
        if (loc) loc.value = "";
        if (ass) ass.value = "";
        if (rpf) rpf.value = "";
        if (banco) banco.value = "";
        syncListaFilterSelects();
        renderListaPanel();
      });

      document.getElementById("openFinanceOpenRecPrint")?.addEventListener("click", () => {
        openFinanceOpenRecPrintModal();
      });
      financeMenuPrintOpenRec?.addEventListener("click", () => {
        closeFinanceMenu();
        openFinanceOpenRecPrintModal();
      });
      document.getElementById("closeFinanceOpenRecPrintModal")?.addEventListener("click", () => {
        document.getElementById("financeOpenRecPrintModal")?.classList.add("hidden");
      });
      document.getElementById("cancelFinanceOpenRecPrintModal")?.addEventListener("click", () => {
        document.getElementById("financeOpenRecPrintModal")?.classList.add("hidden");
      });
      document.getElementById("confirmFinanceOpenRecPrintModal")?.addEventListener("click", () => {
        runFinanceOpenReceivablesPrint();
      });
      document.getElementById("financePrintFilterClear")?.addEventListener("click", () => {
        ["financePrintFilterLocator", "financePrintFilterAssessoria", "financePrintFilterResponsavel"].forEach(
          (id) => {
            const el = document.getElementById(id);
            if (el) el.value = "";
          }
        );
        syncFinanceOpenRecPrintFilterOptions();
      });
      document.getElementById("financeOpenRecPrintModal")?.addEventListener("click", (e) => {
        if (e.target === e.currentTarget) e.currentTarget.classList.add("hidden");
      });

      ["financeReceberFilterLoc", "financeReceberFilterAss", "financeReceberFilterResp", "financeReceberFilterStatus"].forEach((id) => {
        document.getElementById(id)?.addEventListener("change", () => {
          if (id === "financeReceberFilterStatus") {
            financeReceberStatusFilter = document.getElementById("financeReceberFilterStatus")?.value || "aberto";
          }
          renderFinance();
        });
      });
      document.getElementById("financeReceberFilterBusca")?.addEventListener("input", () => {
        financeReceberBuscaFilter = document.getElementById("financeReceberFilterBusca")?.value || "";
        renderFinance();
      });
      document.getElementById("clearFinanceReceberFilters")?.addEventListener("click", () => {
        ["financeReceberFilterLoc", "financeReceberFilterAss", "financeReceberFilterResp"].forEach((sid) => {
          const el = document.getElementById(sid);
          if (el) el.value = "";
        });
        financeReceberStatusFilter = "aberto";
        financeReceberBuscaFilter = "";
        const st = document.getElementById("financeReceberFilterStatus");
        const busca = document.getElementById("financeReceberFilterBusca");
        if (st) st.value = "aberto";
        if (busca) busca.value = "";
        renderFinance();
      });
      document.getElementById("financePagarFilterStatus")?.addEventListener("change", () => {
        financePagarStatusFilter = document.getElementById("financePagarFilterStatus")?.value || "aberto";
        renderFinance();
      });
      document.getElementById("financePagarFilterBusca")?.addEventListener("input", () => {
        financePagarBuscaFilter = document.getElementById("financePagarFilterBusca")?.value || "";
        renderFinance();
      });
      document.getElementById("clearFinancePagarFilters")?.addEventListener("click", () => {
        financePagarStatusFilter = "aberto";
        financePagarBuscaFilter = "";
        const st = document.getElementById("financePagarFilterStatus");
        const busca = document.getElementById("financePagarFilterBusca");
        if (st) st.value = "aberto";
        if (busca) busca.value = "";
        renderFinance();
      });

      const triggerFinanceReload = () => {
        Promise.all([
          loadReceivables(),
          loadCycleClosures(),
          loadPayables(),
          loadCash(),
          loadSettings(),
          loadMonthlyClosures(),
          loadVehicles(),
        ]).then(() => {
          renderFinance();
          updateDashboard();
        });
      };
      reloadFinanceiro?.addEventListener("click", triggerFinanceReload);
      financeMenuReload?.addEventListener("click", () => {
        closeFinanceMenu();
        triggerFinanceReload();
      });

      financeMenuReceberFilters?.addEventListener("click", () => {
        closeFinanceMenu();
        openFinanceSubview("receber");
        setTimeout(() => document.getElementById("financeReceberFilterLoc")?.focus(), 60);
      });

      document.getElementById("btnCloseOperationalMonth")?.addEventListener("click", async () => {
        if (!supabase || !state.user?.id) return;
        if (!state.settings?.id) {
          alert("Salve as configurações do pátio uma vez (aba Configurações) para poder gravar o mês operacional.");
          return;
        }
        const ym = getOperationalMonth();
        const st = computeMonthClosureStats(ym);
        const nextYm = addOneYearMonth(ym);
        if (
          !confirm(
            `Fechar ${formatYearMonthLong(ym)} e abrir ${formatYearMonthLong(nextYm)}? Os dados em aberto permanecem nos cadastros.`
          )
        ) {
          return;
        }
        const { error: insErr } = await supabase.from("monthly_closures").insert({
          user_id: effectiveUserId(),
          year_month: ym,
          vehicles_entered: st.entered,
          vehicles_exited: st.exited,
          vehicles_in_yard_end: st.inYardEnd,
          open_receivables_value: st.openRec,
          open_payables_value: st.openPag,
          cash_balance_end: st.caixa,
          revenue_in_month: st.revenue,
          expense_in_month: st.expense,
        });
        if (insErr) {
          if (insErr.code === "23505" || /duplicate|unique/i.test(insErr.message || "")) {
            alert("Este mês já foi encerrado.");
          } else {
            alert(insErr.message);
          }
          return;
        }
        const { error: updErr } = await supabase
          .from("settings")
          .update({ operational_month: nextYm })
          .eq("id", state.settings.id);
        if (updErr) {
          alert("Fechamento gravado, mas falhou ao avançar o mês operacional: " + updErr.message);
          await loadMonthlyClosures();
          renderFinance();
          return;
        }
        state.settings.operational_month = nextYm;
        await loadMonthlyClosures();
        renderFinance();
        alert(`Mês encerrado. Mês operacional atual: ${formatYearMonthLong(nextYm)}.`);
      });

      patioSubnav.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-subview]");
        if (!button) return;
        closePatioMenu();
        if (normalizePlateSearch(plateQuery)) {
          plateFilter.value = "";
          plateQuery = "";
          setPlateSearchHints("", false);
          renderVehicles();
        }
        openPatioSubview(button.getAttribute("data-subview"));
      });

      function bindModuleCardActivate(el, fn) {
        if (!el) return;
        el.addEventListener("click", fn);
        el.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fn();
          }
        });
      }
      bindModuleCardActivate(document.getElementById("cardFinanceReceberLink"), () => openFinanceSubview("contas_receber"));
      bindModuleCardActivate(document.getElementById("cardFinancePagarLink"), () => openFinanceSubview("contas_pagar"));
      bindModuleCardActivate(document.getElementById("cardFinanceCaixaLink"), () => openFinanceSubview("inicio"));

      document.getElementById("financeExportDreBtn")?.addEventListener("click", exportFinanceDreCsv);
      document.getElementById("financeExportFluxoBtn")?.addEventListener("click", exportFinanceFluxoCsv);
      document.getElementById("financeConciliacaoFilter")?.addEventListener("change", () => {
        financeConciliacaoFilter = document.getElementById("financeConciliacaoFilter")?.value || "pendentes";
        renderFinanceConciliacaoPanel();
      });
      document.getElementById("financeInicioPanel")?.addEventListener("click", (e) => {
        const quickBtn = e.target.closest("[data-finance-quick]");
        if (quickBtn) {
          openFinanceSubview(quickBtn.getAttribute("data-finance-quick"));
          return;
        }
        const subBtn = e.target.closest("[data-finance-subtab]");
        if (subBtn) {
          openFinanceSubview(subBtn.getAttribute("data-finance-subtab"));
        }
      });
      document.getElementById("financeInicioPanel")?.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        const subBtn = e.target.closest("[data-finance-subtab]");
        if (!subBtn) return;
        e.preventDefault();
        openFinanceSubview(subBtn.getAttribute("data-finance-subtab"));
      });
      document.getElementById("financeNovoClienteBtn")?.addEventListener("click", () => {
        currentPartnerView = "localizadores";
        if (partnerModalTitle) partnerModalTitle.textContent = "Novo cliente (localizador)";
        syncPartnerFormForCurrentView();
        partnerForm?.reset();
        partnerModal?.classList.remove("hidden");
      });
      document.getElementById("financeNovoLancamentoBtn")?.addEventListener("click", () => {
        const tipo =
          currentFinanceView === "despesas" || financeIsPagarView(currentFinanceView) ? "DESPESA" : "RECEITA";
        openLancamentoModal(tipo, { lockTipo: financeIsLancamentosView(currentFinanceView) });
      });
      document.getElementById("financeReceitasNovaBtn")?.addEventListener("click", () => {
        openLancamentoModal("RECEITA", { lockTipo: true, presetModo: "UNICA" });
      });
      document.getElementById("financeReceitasNovaRecorrenteBtn")?.addEventListener("click", () => {
        openLancamentoModal("RECEITA", { lockTipo: true, presetModo: "RECORRENTE" });
      });
      document.getElementById("financeReceitasNovaParceladaBtn")?.addEventListener("click", () => {
        openLancamentoModal("RECEITA", { lockTipo: true, presetModo: "PARCELADA" });
      });
      document.getElementById("financeReceitasAddCategoryBtn")?.addEventListener("click", () => {
        const input = document.getElementById("financeReceitasCategoryInput");
        const label = input?.value?.trim();
        if (!label) return;
        if (!addFinanceCustomCategory("RECEITA", label)) {
          alert("Categoria já existe ou nome inválido.");
          return;
        }
        if (input) input.value = "";
        syncLancamentoCategoriaOptions();
        renderFinanceCategoryTags("RECEITA");
        renderFinance();
      });
      document.getElementById("financeReceitasCategoryTags")?.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-action='remover-categoria']");
        if (!btn) return;
        const value = btn.getAttribute("data-value");
        if (!removeFinanceCustomCategory("RECEITA", value)) return;
        syncLancamentoCategoriaOptions();
        renderFinanceCategoryTags("RECEITA");
        renderFinance();
      });
      document.getElementById("financeReceitasCadastroPrev")?.addEventListener("click", () => {
        lancamentosPagination.page = Math.max(1, Number(lancamentosPagination.page || 1) - 1);
        renderFinance();
      });
      document.getElementById("financeReceitasCadastroNext")?.addEventListener("click", () => {
        lancamentosPagination.page = Number(lancamentosPagination.page || 1) + 1;
        renderFinance();
      });
      document.getElementById("financeReceitasSubnav")?.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-receitas-sub]");
        if (!btn) return;
        setReceitasSubView(btn.getAttribute("data-receitas-sub"));
      });
      document.getElementById("financeReceitasPanel")?.addEventListener("click", (e) => {
        const gotoBtn = e.target.closest("[data-receitas-goto]");
        if (gotoBtn) {
          setReceitasSubView(gotoBtn.getAttribute("data-receitas-goto"));
          return;
        }
        const btn = e.target.closest("[data-action='ver-comprovante']");
        if (!btn) return;
        openFinanceAttachment(btn.getAttribute("data-kind"), btn.getAttribute("data-id"));
      });
      document.getElementById("financeDespesasSubnav")?.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-despesas-sub]");
        if (!btn) return;
        setDespesasSubView(btn.getAttribute("data-despesas-sub"));
      });
      document.getElementById("financeDespesasPanel")?.addEventListener("click", (e) => {
        const gotoBtn = e.target.closest("[data-despesas-goto]");
        if (gotoBtn) {
          setDespesasSubView(gotoBtn.getAttribute("data-despesas-goto"));
          return;
        }
        const btn = e.target.closest("[data-action='ver-comprovante']");
        if (!btn) return;
        openFinanceAttachment(btn.getAttribute("data-kind"), btn.getAttribute("data-id"));
      });
      document.getElementById("financeDespesasNovaBtn")?.addEventListener("click", () => {
        openLancamentoModal("DESPESA", { lockTipo: true, presetModo: "UNICA" });
      });
      document.getElementById("financeDespesasNovaRecorrenteBtn")?.addEventListener("click", () => {
        openLancamentoModal("DESPESA", { lockTipo: true, presetModo: "RECORRENTE" });
      });
      document.getElementById("financeDespesasNovaParceladaBtn")?.addEventListener("click", () => {
        openLancamentoModal("DESPESA", { lockTipo: true, presetModo: "PARCELADA" });
      });
      document.getElementById("financeDespesasAddCategoryBtn")?.addEventListener("click", () => {
        const input = document.getElementById("financeDespesasCategoryInput");
        const label = input?.value?.trim();
        if (!label) return;
        if (!addFinanceCustomCategory("DESPESA", label)) {
          alert("Categoria já existe ou nome inválido.");
          return;
        }
        if (input) input.value = "";
        syncLancamentoCategoriaOptions();
        renderFinanceCategoryTags("DESPESA");
        renderFinance();
      });
      document.getElementById("financeDespesasCategoryTags")?.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-action='remover-categoria']");
        if (!btn) return;
        const value = btn.getAttribute("data-value");
        if (!removeFinanceCustomCategory("DESPESA", value)) return;
        syncLancamentoCategoriaOptions();
        renderFinanceCategoryTags("DESPESA");
        renderFinance();
      });
      document.getElementById("financeDespesasCadastroPrev")?.addEventListener("click", () => {
        lancamentosPagination.page = Math.max(1, Number(lancamentosPagination.page || 1) - 1);
        renderFinance();
      });
      document.getElementById("financeDespesasCadastroNext")?.addEventListener("click", () => {
        lancamentosPagination.page = Number(lancamentosPagination.page || 1) + 1;
        renderFinance();
      });
      document.getElementById("financeContasPagarSubnav")?.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-contas-pagar-sub]");
        if (!btn) return;
        setContasPagarSubView(btn.getAttribute("data-contas-pagar-sub"));
      });
      document.getElementById("financeContasPagarPanel")?.addEventListener("click", (e) => {
        const gotoBtn = e.target.closest("[data-contas-pagar-goto]");
        if (gotoBtn) {
          setContasPagarSubView(gotoBtn.getAttribute("data-contas-pagar-goto"));
          return;
        }
        const btn = e.target.closest("[data-action='ver-comprovante']");
        if (!btn) return;
        openFinanceAttachment(btn.getAttribute("data-kind"), btn.getAttribute("data-id"));
      });
      document.getElementById("financeContasPagarNovaBtn")?.addEventListener("click", () => {
        openLancamentoModal("DESPESA", { lockTipo: true, presetModo: "UNICA" });
      });
      document.getElementById("financeContasReceberSubnav")?.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-contas-receber-sub]");
        if (!btn) return;
        setContasReceberSubView(btn.getAttribute("data-contas-receber-sub"));
      });
      document.getElementById("financeContasReceberPanel")?.addEventListener("click", (e) => {
        const gotoBtn = e.target.closest("[data-contas-receber-goto]");
        if (gotoBtn) {
          setContasReceberSubView(gotoBtn.getAttribute("data-contas-receber-goto"));
          return;
        }
        const btn = e.target.closest("[data-action='ver-comprovante']");
        if (!btn) return;
        openFinanceAttachment(btn.getAttribute("data-kind"), btn.getAttribute("data-id"));
      });
      document.getElementById("financeContasReceberNovaBtn")?.addEventListener("click", () => {
        openLancamentoModal("RECEITA", { lockTipo: true, presetModo: "UNICA" });
      });
      document.getElementById("financeAddCategoryBtn")?.addEventListener("click", () => {
        const input = document.getElementById("financeNewCategoryInput");
        const label = input?.value?.trim();
        if (!label) return;
        const tipo =
          currentFinanceView === "despesas" ? "DESPESA" : currentFinanceView === "receitas" ? "RECEITA" : "RECEITA";
        if (!addFinanceCustomCategory(tipo, label)) {
          alert("Categoria já existe ou nome inválido.");
          return;
        }
        if (input) input.value = "";
        syncLancamentoCategoriaOptions();
        renderFinanceCategoryTags(tipo);
        renderFinance();
      });
      document.getElementById("financeCategoryTags")?.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-action='remover-categoria']");
        if (!btn) return;
        const tipo = btn.getAttribute("data-tipo") === "DESPESA" ? "DESPESA" : "RECEITA";
        const value = btn.getAttribute("data-value");
        if (!removeFinanceCustomCategory(tipo, value)) return;
        syncLancamentoCategoriaOptions();
        renderFinanceCategoryTags(tipo);
        renderFinance();
      });
      document.getElementById("financeHistoricoList")?.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-action='ver-comprovante']");
        if (!btn) return;
        openFinanceAttachment(btn.getAttribute("data-kind"), btn.getAttribute("data-id"));
      });
      document.getElementById("financeLancList")?.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-action='ver-comprovante']");
        if (!btn) return;
        openFinanceAttachment(btn.getAttribute("data-kind"), btn.getAttribute("data-id"));
      });
      document.getElementById("financeChartPeriod")?.addEventListener("change", () => {
        if (financeIsDashboardView(currentFinanceView)) renderFinanceModuleCharts();
      });
      document.getElementById("financeClientesBusca")?.addEventListener("input", () => {
        if (currentFinanceView === "clientes") renderFinanceClientes();
      });

      document.getElementById("dashboardOpenPatio")?.addEventListener("click", () => openMainView("patio"));
      document.getElementById("dashboardOpenFinance")?.addEventListener("click", () => openMainView("financeiro"));
      document.getElementById("dashboardOpenLista")?.addEventListener("click", () => openMainView("lista"));
      document.getElementById("dashboardOpenParceiros")?.addEventListener("click", () => openMainView("parceiros"));
      document.getElementById("dashboardOpenConfiguracoes")?.addEventListener("click", () => openMainView("configuracoes"));

      document.getElementById("openParceirosFromPatio")?.addEventListener("click", () => openPartnerSubview("localizadores"));
      document.getElementById("openConfigFromPatio")?.addEventListener("click", () => openMainView("configuracoes"));
      document.getElementById("exitParceirosToPatio")?.addEventListener("click", () => closeStackTop());
      document.getElementById("exitConfigToPatio")?.addEventListener("click", () => closeStackTop());

      const cardVeiculosLink = document.getElementById("cardVeiculosLink");
      const cardSolicitadasLink = document.getElementById("cardSolicitadasLink");
      const cardEntradasHojeLink = document.getElementById("cardEntradasHojeLink");
      const cardSaidasHojeLink = document.getElementById("cardSaidasHojeLink");
      const cardSaidasSemanaLink = document.getElementById("cardSaidasSemanaLink");
      const cardVrpLink = document.getElementById("cardVrpLink");
      const cardNfsePendenteLink = document.getElementById("cardNfsePendenteLink");

      let lastAppHeaderModuleView = null;

      const views = {
        dashboard: document.getElementById("viewDashboard"),
        patio: document.getElementById("viewPatio"),
        parceiros: document.getElementById("viewParceiros"),
        financeiro: document.getElementById("viewFinanceiro"),
        lista: document.getElementById("viewLista"),
        configuracoes: document.getElementById("viewConfiguracoes"),
      };

      function syncHeaderMenuModuleHighlight(view) {
        const menu = document.getElementById("appHeaderMenu");
        if (!menu) return;
        menu.querySelectorAll(".header-menu-details").forEach((d) => d.classList.remove("header-menu-details--current"));
        const top = menu.querySelector(".header-menu-top");
        if (top) top.classList.toggle("header-menu-top--current", view === "dashboard");
        if (view === "patio") menu.querySelector("#headerDetailsPatio")?.classList.add("header-menu-details--current");
        else if (view === "parceiros") menu.querySelector("#headerDetailsParceiros")?.classList.add("header-menu-details--current");
        else if (view === "financeiro") menu.querySelector("#headerDetailsFinance")?.classList.add("header-menu-details--current");
        else if (view === "lista") menu.querySelector("#headerDetailsLista")?.classList.add("header-menu-details--current");
        else if (view === "configuracoes") menu.querySelector("#headerDetailsConfig")?.classList.add("header-menu-details--current");
      }

      function showMainView(view) {
        if (view !== "patio") {
          patioSubnav?.classList.remove("open");
          patioFlyoutBackdrop?.classList.add("hidden");
          document.getElementById("viewPatio")?.classList.remove("patio-flyout-open", "patio-subview-fullscreen");
          setPatioView("none", { silent: true });
        }
        if (view !== "financeiro") {
          financeSubnav?.classList.remove("open");
          financeFlyoutBackdrop?.classList.add("hidden");
          document.getElementById("viewFinanceiro")?.classList.remove("finance-flyout-open", "finance-subview-fullscreen");
          setFinanceView("none");
        }
        cleanupFloatingTabModals(view);
        document.querySelectorAll("#appHeaderMenu button[data-view]").forEach((btn) => {
          btn.classList.toggle("active", btn.getAttribute("data-view") === view);
        });
        document.body.classList.remove("app-module-patio", "app-module-finance");
        if (view === "financeiro") {
          document.body.classList.add("app-module-finance");
          document.title = "Amplipatio · Financeiro do pátio";
        } else if (view === "patio") {
          document.body.classList.add("app-module-patio");
          document.title = "Amplipatio · Gestão de pátio";
        } else if (view === "lista") {
          document.title = "Amplipatio · Lista";
        } else if (view === "dashboard") {
          document.title = "Amplipatio · AMPLIPATIO";
        } else {
          document.title = "Amplipatio";
        }
        Object.values(views).forEach((panel) => panel?.classList.add("hidden"));
        if (views[view]) {
          views[view].classList.remove("hidden");
          views[view].classList.remove("air-open");
          void views[view].offsetWidth;
          views[view].classList.add("air-open");
        }
        if (view === "configuracoes") {
          setConfigSubview("dados");
        }
        const headerModViews = ["dashboard", "patio", "parceiros", "financeiro", "lista", "configuracoes"];
        if (headerModViews.includes(view) && lastAppHeaderModuleView !== view) {
          document.querySelectorAll("#appHeaderMenu > .header-menu-details").forEach((d) => d.removeAttribute("open"));
          lastAppHeaderModuleView = view;
        }
        syncHeaderMenuModuleHighlight(view);
      }

      function setConfigSubview(sub) {
        currentConfigSubview = sub === "usuarios" ? "usuarios" : "dados";
        configSubnav?.querySelectorAll("button[data-config-subview]").forEach((btn) => {
          btn.classList.toggle("active", btn.getAttribute("data-config-subview") === currentConfigSubview);
        });
        configPanelDados?.classList.toggle("hidden", currentConfigSubview !== "dados");
        configPanelUsuarios?.classList.toggle("hidden", currentConfigSubview !== "usuarios");
        const saveCfgBtn = document.getElementById("saveSettings");
        if (saveCfgBtn) saveCfgBtn.classList.toggle("hidden", currentConfigSubview !== "dados");
        if (configModuleLede) {
          configModuleLede.textContent =
            currentConfigSubview === "usuarios"
              ? "Gestor geral (conta principal) e gestores de pista delegados."
              : "CNPJ, nome do pátio e textos de cobrança e nota — use Salvar alterações.";
        }
        if (currentConfigSubview === "usuarios") {
          refreshConfigUsuariosPanel();
        }
      }

      async function refreshConfigUsuariosPanel() {
        if (configGestorGeralEmail)
          configGestorGeralEmail.textContent = displayManagerIdentity(state.user?.email || "") || "—";
        await loadTrackManagersList();
      }

      async function loadTrackManagersList() {
        if (!tableTrackManagersBody || !supabase || !state.user?.id || isGestorPista) return;
        let { data, error } = await supabase
          .from("track_managers")
          .select("email, role")
          .eq("owner_user_id", state.user.id)
          .order("email", { ascending: true });
        if (error && /role|column|schema cache|PGRST204/i.test(error.message || "")) {
          const r2 = await supabase
            .from("track_managers")
            .select("email")
            .eq("owner_user_id", state.user.id)
            .order("email", { ascending: true });
          data = (r2.data || []).map((row) => ({ ...row, role: "GESTOR_PISTA" }));
          error = r2.error;
        }
        if (error) {
          tableTrackManagersBody.innerHTML = `<tr><td colspan="2"><em>Erro ao carregar lista.</em></td></tr>`;
          console.warn(error);
          return;
        }
        const rows = data || [];
        if (!rows.length) {
          tableTrackManagersBody.innerHTML = `<tr><td colspan="2"><em>Nenhum gestor de pista. Cria um acima.</em></td></tr>`;
          return;
        }
        tableTrackManagersBody.innerHTML = rows
          .map((r) => {
            const perfil = "Gestor de pista";
            const rotulo = escapeHtml(displayManagerIdentity((r.email || "—").trim()));
            return `<tr><td data-label="Nome / login">${rotulo}</td><td data-label="Perfil">${escapeHtml(perfil)}</td></tr>`;
          })
          .join("");
      }

      configSubnav?.addEventListener("click", (event) => {
        const btn = event.target.closest("button[data-config-subview]");
        if (!btn) return;
        setConfigSubview(btn.getAttribute("data-config-subview"));
      });

      function openMainView(view) {
        if (isGestorPista && view !== "patio" && view !== "lista") {
          showMainView("patio");
          setPatioView("inicio");
          return;
        }
        const top = navStack[navStack.length - 1];
        if (top === view || (typeof top === "string" && top.startsWith(`${view}:`))) {
          showMainView(view);
          return;
        }

        navStack.push(view);
        showMainView(view);

        if (view === "patio") {
          setPatioView("inicio");
          navStack.push("patio:inicio");
        }
        if (view === "parceiros") setPartnerView("none");
        if (view === "financeiro") {
          setFinanceView("inicio");
          navStack.push("financeiro:inicio");
        }
        if (view === "lista") {
          syncListaFilterSelects();
          renderListaPanel();
        }
      }

      function goToPatioForPlateSearch() {
        const top = navStack[navStack.length - 1];
        const onPatio = top === "patio" || (typeof top === "string" && top.startsWith("patio:"));
        if (!onPatio) {
          openMainView("patio");
        } else {
          showMainView("patio");
        }
      }

      function openPatioSubview(sub) {
        if (sub === "liberacao_solicitada") sub = "no_patio";
        if (sub === "nfse_pendente") sub = "no_patio";
        if (sub === "fechando_ciclo") sub = "removidos";
        const top = navStack[navStack.length - 1];
        if (!sub) return;
        if (top === `patio:${sub}`) return;
        if (top && typeof top === "string" && top.startsWith("patio:")) navStack.pop();

        if (!isNavOnModule("patio")) {
          navStack.splice(0, navStack.length, "patio");
        }

        showMainView("patio");
        navStack.push(`patio:${sub}`);
        setPatioView(sub);
      }

      function openPartnerSubview(sub) {
        const top = navStack[navStack.length - 1];
        if (!sub) return;
        if (top === `parceiros:${sub}`) return;
        if (top && typeof top === "string" && top.startsWith("parceiros:")) navStack.pop();

        if (!isNavOnModule("parceiros")) {
          navStack.splice(0, navStack.length, "parceiros");
        }

        showMainView("parceiros");
        if (navStack[navStack.length - 1] !== "parceiros") {
          setPartnerView("none");
        }

        navStack.push(`parceiros:${sub}`);
        setPartnerView(sub);
      }

      function openFinanceSubview(sub) {
        const top = navStack[navStack.length - 1];
        if (!sub) return;
        if (sub === "metas") financeFocusMetaGoalCard = true;
        sub = financeNormalizeSubview(sub);
        const sameSub = top === `financeiro:${sub}`;
        if (top && typeof top === "string" && top.startsWith("financeiro:") && !sameSub) navStack.pop();

        if (sub === "inicio") {
          closeFinanceMenu?.();
          if (navStack[navStack.length - 1] !== "financeiro") {
            navStack.push("financeiro");
            showMainView("financeiro");
          } else {
            showMainView("financeiro");
          }
          if (!sameSub) navStack.push("financeiro:inicio");
          setFinanceView("inicio");
          return;
        }

        if (isNavOnModule("financeiro")) {
          if (navStack[navStack.length - 1] !== "financeiro") {
            navStack.push("financeiro");
          }
          showMainView("financeiro");
          if (!sameSub) navStack.push(`financeiro:${sub}`);
          setFinanceView(sub);
          return;
        }

        navStack.splice(0, navStack.length, "financeiro");
        showMainView("financeiro");
        navStack.push(`financeiro:${sub}`);
        setFinanceView(sub);
      }

      function openListaSubview(sub) {
        if (!sub) return;
        if (sub === "aguardando_lancamento") sub = "receber";
        if (
          isGestorPista &&
          ["receber", "receber_alerta", "pagar", "caixa", "historico_receber"].includes(sub)
        ) {
          alert("Com o perfil de gestor de pista só estão disponíveis as listas VNP e VRP.");
          sub = "vnp";
        }
        const top = navStack[navStack.length - 1];
        if (top === `lista:${sub}`) {
          currentListaView = sub;
          syncListaSubnavActive();
          renderListaPanel();
          return;
        }
        if (top && typeof top === "string" && top.startsWith("lista:")) navStack.pop();

        if (!isNavOnModule("lista")) {
          navStack.splice(0, navStack.length, "lista");
        }

        showMainView("lista");

        navStack.push(`lista:${sub}`);
        currentListaView = sub;
        syncListaSubnavActive();
        renderListaPanel();
      }

      function closeStackTop() {
        if (navStack.length <= 1) return;
        const current = navStack[navStack.length - 1];
        if (
          typeof current === "string" &&
          current.startsWith("financeiro:") &&
          current !== "financeiro:inicio" &&
          financeContent &&
          !financeContent.classList.contains("hidden")
        ) {
          returnToPainelFromFinanceFlyout();
          return;
        }
        navStack.pop();
        const top = navStack[navStack.length - 1];

        if (top === "dashboard") return showMainView("dashboard");
        if (top === "patio") {
          showMainView("patio");
          return setPatioView("inicio");
        }
        if (top === "parceiros") {
          showMainView("parceiros");
          return setPartnerView("none");
        }
        if (top === "financeiro") {
          showMainView("financeiro");
          return setFinanceView("inicio");
        }
        if (top === "configuracoes") return showMainView("configuracoes");

        if (top === "lista") {
          showMainView("lista");
          currentListaView = "vnp";
          syncListaSubnavActive();
          return renderListaPanel();
        }
        if (top && typeof top === "string" && top.startsWith("lista:")) {
          const sub = top.split(":")[1];
          showMainView("lista");
          currentListaView = sub;
          syncListaSubnavActive();
          return renderListaPanel();
        }

        if (top && typeof top === "string" && top.startsWith("patio:")) {
          const sub = top.split(":")[1];
          showMainView("patio");
          return setPatioView(sub);
        }
        if (top && typeof top === "string" && top.startsWith("parceiros:")) {
          const sub = top.split(":")[1];
          showMainView("parceiros");
          return setPartnerView(sub);
        }
        if (top && typeof top === "string" && top.startsWith("financeiro:")) {
          const sub = top.split(":")[1];
          showMainView("financeiro");
          return setFinanceView(sub);
        }
      }

      cardVeiculosLink.addEventListener("click", () => openPatioSubview("no_patio"));
      cardSolicitadasLink.addEventListener("click", () => openPatioSubview("no_patio"));
      cardEntradasHojeLink?.addEventListener("click", () => openPatioSubview("removidos"));
      cardSaidasHojeLink?.addEventListener("click", () => openPatioSubview("no_patio"));
      cardSaidasSemanaLink?.addEventListener("click", () => openPatioSubview("removidos"));
      cardVrpLink?.addEventListener("click", () => openPatioSubview("no_patio"));
      cardNfsePendenteLink?.addEventListener("click", () => openPatioSubview("removidos"));

      if (plateSearchForm) {
        plateSearchForm.addEventListener("submit", (event) => {
          event.preventDefault();
          applyPlateSearchFromDashboard();
        });
      }
      goDashboardFromPlate?.addEventListener("click", () => {
        showMainView("dashboard");
        closeAppHeaderMenu();
      });

      // Busca duplicada dentro do "Gestão de Pátio" (para gestor não precisar abrir Painel).
      if (plateSearchFormPatio) {
        plateSearchFormPatio.addEventListener("submit", (event) => {
          event.preventDefault();
          if (!plateFilter || !plateFilterPatio) return;
          plateFilter.value = plateFilterPatio.value;
          applyPlateSearchFromDashboard();
        });
      }

      clearPlateFilter.addEventListener("click", () => {
        plateFilter.value = "";
        plateQuery = "";
        syncPatioPlateInputFromHeader();
        setPlateSearchHints("", false);
        renderVehicles();
      });

      if (clearPlateFilterPatio) {
        clearPlateFilterPatio.addEventListener("click", () => {
          if (plateFilter) plateFilter.value = "";
          if (plateFilterPatio) plateFilterPatio.value = "";
          plateQuery = "";
          setPlateSearchHints("", false);
          renderVehicles();
        });
      }

      if (financePlateSearchForm) {
        financePlateSearchForm.addEventListener("submit", (event) => {
          event.preventDefault();
          financePlateQuery = (financePlateFilter?.value || "").trim().toLowerCase();
          renderFinance();
        });
      }
      if (clearFinancePlateFilter) {
        clearFinancePlateFilter.addEventListener("click", () => {
          if (financePlateFilter) financePlateFilter.value = "";
          financePlateQuery = "";
          renderFinance();
        });
      }
      if (financePlateFilter) {
        financePlateFilter.addEventListener("input", () => {
          if (financePlateInputTimer) clearTimeout(financePlateInputTimer);
          financePlateInputTimer = setTimeout(() => {
            financePlateQuery = (financePlateFilter.value || "").trim().toLowerCase();
            renderFinance();
          }, 320);
        });
      }
      if (financeDashboardMonth && !financeDashboardMonth.value) {
        financeDashboardMonth.value = financeCompetencia || currentYearMonthLocal();
      }
      financeDashboardMonth?.addEventListener("change", () => {
        financeCompetencia = (financeDashboardMonth.value || "").trim() || currentYearMonthLocal();
        caixaFilter.month = financeCompetencia;
        if (financeCaixaMonth) financeCaixaMonth.value = caixaFilter.month;
        if (financeCompetenciaBadge) {
          financeCompetenciaBadge.textContent = `Competência: ${formatYearMonthLong(financeCompetencia)}`;
        }
        renderFinance();
      });
      financeDashboardMonthAtual?.addEventListener("click", () => {
        financeCompetencia = currentYearMonthLocal();
        caixaFilter.month = financeCompetencia;
        if (financeCaixaMonth) financeCaixaMonth.value = caixaFilter.month;
        if (financeDashboardMonth) financeDashboardMonth.value = financeCompetencia;
        if (financeCompetenciaBadge) {
          financeCompetenciaBadge.textContent = `Competência: ${formatYearMonthLong(financeCompetencia)}`;
        }
        renderFinance();
      });
      document.getElementById("financeMetaSalvar")?.addEventListener("click", () => {
        const nome = String(document.getElementById("financeMetaNome")?.value || "").trim();
        const valor = Number(document.getElementById("financeMetaValor")?.value || 0);
        if (!(valor > 0)) {
          alert("Informe um valor alvo maior que zero.");
          return;
        }
        financeMetaWrite({ nome, valor });
        renderFinance();
      });
      document.getElementById("financeMetaLimpar")?.addEventListener("click", () => {
        financeMetaWrite({ nome: "", valor: 0 });
        renderFinance();
      });
      document.addEventListener("click", (event) => {
        const jumpBtn = event.target.closest("[data-finance-month-jump]");
        if (!jumpBtn) return;
        const ym = (jumpBtn.getAttribute("data-finance-month-jump") || "").trim();
        if (!/^\d{4}-\d{2}$/.test(ym)) return;
        financeCompetencia = ym;
        caixaFilter.month = ym;
        if (financeDashboardMonth) financeDashboardMonth.value = ym;
        if (financeCaixaMonth) financeCaixaMonth.value = ym;
        if (financeCompetenciaBadge) financeCompetenciaBadge.textContent = `Competência: ${formatYearMonthLong(ym)}`;
        renderFinance();
      });
      if (!caixaFilter.month) caixaFilter.month = currentYearMonthLocal();
      if (financeCaixaMonth && !financeCaixaMonth.value) financeCaixaMonth.value = caixaFilter.month;
      financeCaixaMonth?.addEventListener("change", () => {
        caixaFilter.month = (financeCaixaMonth.value || "").trim() || currentYearMonthLocal();
        financeCaixaMonth.value = caixaFilter.month;
        if (currentFinanceView === "caixa" || currentFinanceView === "fluxo_caixa") renderFinance();
      });
      financeCaixaMonthAtual?.addEventListener("click", () => {
        caixaFilter.month = currentYearMonthLocal();
        if (financeCaixaMonth) financeCaixaMonth.value = caixaFilter.month;
        if (currentFinanceView === "caixa" || currentFinanceView === "fluxo_caixa") renderFinance();
      });
      const syncLancamentosFilters = () => {
        lancamentosFilter = {
          tipo: (financeLancTipo?.value || "").trim(),
          status: (financeLancStatus?.value || "").trim(),
          categoria: (financeLancCategoria?.value || "").trim(),
          subcategoria: (financeLancSubcategoria?.value || "").trim(),
          formaPagamento: (financeLancFormaPagamento?.value || "").trim(),
          competencia: (financeLancCompetencia?.value || "").trim(),
          busca: (financeLancBusca?.value || "").trim(),
        };
        lancamentosPagination.page = 1;
        if (financeIsLancamentosView(currentFinanceView)) renderFinance();
      };
      const syncLancamentosSort = () => {
        lancamentosSort = {
          by: (financeLancSortBy?.value || "data").trim() || "data",
          dir: (financeLancSortDir?.value || "desc").trim() || "desc",
        };
        lancamentosPagination.page = 1;
        if (financeIsLancamentosView(currentFinanceView)) renderFinance();
      };
      const syncLancamentosPageSize = () => {
        lancamentosPagination.pageSize = Math.max(1, Number(financeLancPageSize?.value || 20));
        lancamentosPagination.page = 1;
        if (financeIsLancamentosView(currentFinanceView)) renderFinance();
      };
      const syncLancamentosAdvanced = () => {
        lancamentosAdvanced = {
          onlyPago: !!financeLancOnlyPago?.checked,
          onlyAberto: !!financeLancOnlyAberto?.checked,
          onlyReceita: !!financeLancSomenteReceita?.checked,
          onlyDespesa: !!financeLancSomenteDespesa?.checked,
          semObs: !!financeLancSemObs?.checked,
          comObs: !!financeLancComObs?.checked,
        };
        if (lancamentosAdvanced.onlyPago && financeLancOnlyAberto) financeLancOnlyAberto.checked = false;
        if (lancamentosAdvanced.onlyAberto && financeLancOnlyPago) financeLancOnlyPago.checked = false;
        if (lancamentosAdvanced.onlyReceita && financeLancSomenteDespesa) financeLancSomenteDespesa.checked = false;
        if (lancamentosAdvanced.onlyDespesa && financeLancSomenteReceita) financeLancSomenteReceita.checked = false;
        if (lancamentosAdvanced.semObs && financeLancComObs) financeLancComObs.checked = false;
        if (lancamentosAdvanced.comObs && financeLancSemObs) financeLancSemObs.checked = false;
        lancamentosAdvanced.onlyPago = !!financeLancOnlyPago?.checked;
        lancamentosAdvanced.onlyAberto = !!financeLancOnlyAberto?.checked;
        lancamentosAdvanced.onlyReceita = !!financeLancSomenteReceita?.checked;
        lancamentosAdvanced.onlyDespesa = !!financeLancSomenteDespesa?.checked;
        lancamentosAdvanced.semObs = !!financeLancSemObs?.checked;
        lancamentosAdvanced.comObs = !!financeLancComObs?.checked;
        lancamentosPagination.page = 1;
        if (financeIsLancamentosView(currentFinanceView)) renderFinance();
      };
      financeLancTipo?.addEventListener("change", syncLancamentosFilters);
      financeLancStatus?.addEventListener("change", syncLancamentosFilters);
      financeLancCategoria?.addEventListener("change", syncLancamentosFilters);
      financeLancSubcategoria?.addEventListener("change", syncLancamentosFilters);
      financeLancFormaPagamento?.addEventListener("change", syncLancamentosFilters);
      financeLancCompetencia?.addEventListener("change", syncLancamentosFilters);
      financeLancBusca?.addEventListener("input", syncLancamentosFilters);
      financeLancSortBy?.addEventListener("change", syncLancamentosSort);
      financeLancSortDir?.addEventListener("change", syncLancamentosSort);
      financeLancPageSize?.addEventListener("change", syncLancamentosPageSize);
      financeLancPrevPage?.addEventListener("click", () => {
        lancamentosPagination.page = Math.max(1, Number(lancamentosPagination.page || 1) - 1);
        if (financeIsLancamentosView(currentFinanceView)) renderFinance();
      });
      financeLancNextPage?.addEventListener("click", () => {
        lancamentosPagination.page = Number(lancamentosPagination.page || 1) + 1;
        if (financeIsLancamentosView(currentFinanceView)) renderFinance();
      });
      [
        financeLancOnlyPago,
        financeLancOnlyAberto,
        financeLancSomenteReceita,
        financeLancSomenteDespesa,
        financeLancSemObs,
        financeLancComObs,
      ].forEach((el) => el?.addEventListener("change", syncLancamentosAdvanced));
      financeLancOpenPanel?.addEventListener("click", () => {
        financeLancSidePanel?.classList.toggle("hidden");
      });
      financeLancClosePanel?.addEventListener("click", () => financeLancSidePanel?.classList.add("hidden"));
      financeLancResetAdvanced?.addEventListener("click", () => {
        if (financeLancOnlyPago) financeLancOnlyPago.checked = false;
        if (financeLancOnlyAberto) financeLancOnlyAberto.checked = false;
        if (financeLancSomenteReceita) financeLancSomenteReceita.checked = false;
        if (financeLancSomenteDespesa) financeLancSomenteDespesa.checked = false;
        if (financeLancSemObs) financeLancSemObs.checked = false;
        if (financeLancComObs) financeLancComObs.checked = false;
        syncLancamentosAdvanced();
      });
      financeLancLimpar?.addEventListener("click", () => {
        if (financeLancTipo) financeLancTipo.value = "";
        if (financeLancStatus) financeLancStatus.value = "";
        if (financeLancCategoria) financeLancCategoria.value = "";
        if (financeLancSubcategoria) financeLancSubcategoria.value = "";
        if (financeLancFormaPagamento) financeLancFormaPagamento.value = "";
        if (financeLancCompetencia) financeLancCompetencia.value = "";
        if (financeLancBusca) financeLancBusca.value = "";
        if (financeLancSortBy) financeLancSortBy.value = "data";
        if (financeLancSortDir) financeLancSortDir.value = "desc";
        if (financeLancPageSize) financeLancPageSize.value = "20";
        if (financeLancOnlyPago) financeLancOnlyPago.checked = false;
        if (financeLancOnlyAberto) financeLancOnlyAberto.checked = false;
        if (financeLancSomenteReceita) financeLancSomenteReceita.checked = false;
        if (financeLancSomenteDespesa) financeLancSomenteDespesa.checked = false;
        if (financeLancSemObs) financeLancSemObs.checked = false;
        if (financeLancComObs) financeLancComObs.checked = false;
        syncLancamentosSort();
        syncLancamentosPageSize();
        syncLancamentosAdvanced();
        syncLancamentosFilters();
      });
      const syncReportFilters = () => {
        reportFilter = {
          tipo: (reportTipoFiltro?.value || "").trim(),
          categoria: (reportCategoriaFiltro?.value || "").trim(),
          cliente: (reportClienteFiltro?.value || "").trim(),
          fornecedor: (reportFornecedorFiltro?.value || "").trim(),
        };
        if (currentFinanceView === "relatorios") renderFinance();
      };
      reportTipoFiltro?.addEventListener("change", syncReportFilters);
      reportCategoriaFiltro?.addEventListener("change", syncReportFilters);
      reportClienteFiltro?.addEventListener("change", syncReportFilters);
      reportFornecedorFiltro?.addEventListener("change", syncReportFilters);

      function closeFinanceMenu() {
        financeSubnav?.classList.remove("open");
      }
      financeFlyoutBackdrop?.addEventListener("click", (e) => {
        if (e.target !== financeFlyoutBackdrop) return;
        if (financeFlyoutBackdrop.classList.contains("hidden")) return;
        returnToPainelFromFinanceFlyout();
      });
      financeOpenFilters?.addEventListener("click", () => openFinanceSubview("filtros"));
      financeSidebarToggle?.addEventListener("click", () => {
        const financeRootEl = getFinanceRoot();
        financeSidebarOpen = !financeSidebarOpen;
        financeRootEl?.classList.toggle("finance-sidebar-open", financeSidebarOpen);
        financeSidebarToggle.setAttribute("aria-expanded", financeSidebarOpen ? "true" : "false");
        financeSidebarBackdrop?.classList.toggle("hidden", !financeSidebarOpen);
      });
      financeSidebarBackdrop?.addEventListener("click", () => {
        financeSidebarOpen = false;
        getFinanceRoot()?.classList.remove("finance-sidebar-open");
        financeSidebarToggle?.setAttribute("aria-expanded", "false");
        financeSidebarBackdrop?.classList.add("hidden");
      });
      if (tableFinance) {
        const financeTableObserver = new MutationObserver(() => refreshFinanceTableDataLabels());
        financeTableObserver.observe(tableFinance, { childList: true, subtree: true });
      }
      if (financeHead) {
        const financeHeadObserver = new MutationObserver(() => refreshFinanceTableDataLabels());
        financeHeadObserver.observe(financeHead, { childList: true, subtree: true });
      }

      financeSubnav?.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-subview]");
        if (!button) return;
        closeFinanceMenu();
        if (financeSidebarOpen) {
          financeSidebarOpen = false;
          getFinanceRoot()?.classList.remove("finance-sidebar-open");
          financeSidebarToggle?.setAttribute("aria-expanded", "false");
          financeSidebarBackdrop?.classList.add("hidden");
        }
        openFinanceSubview(button.getAttribute("data-subview"));
      });
      applyFilter.addEventListener("click", () => {
        historyFilter.from = filterFrom.value || null;
        historyFilter.to = filterTo.value || null;
        if (currentFinanceView === "relatorios") {
          reportHasRun = true;
          if (financeContent) financeContent.classList.remove("hidden");
        }
        renderFinance();
      });

      clearFilter.addEventListener("click", () => {
        filterFrom.value = "";
        filterTo.value = "";
        historyFilter = { from: null, to: null };
        if (reportTipoFiltro) reportTipoFiltro.value = "";
        if (reportCategoriaFiltro) reportCategoriaFiltro.value = "";
        if (reportClienteFiltro) reportClienteFiltro.value = "";
        if (reportFornecedorFiltro) reportFornecedorFiltro.value = "";
        reportFilter = { tipo: "", categoria: "", cliente: "", fornecedor: "" };
        if (currentFinanceView === "relatorios") reportHasRun = false;
        renderFinance();
      });

      function applyQuickDays(days) {
        const now = new Date();
        const from = new Date(now.getTime() - days * 86400000);
        const to = now;
        const fromStr = new Date(from.getTime() - from.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
        const toStr = new Date(to.getTime() - to.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
        filterFrom.value = fromStr;
        filterTo.value = toStr;
        historyFilter = { from: fromStr, to: toStr };
        if (currentFinanceView === "relatorios") {
          reportHasRun = true;
          if (financeContent) financeContent.classList.remove("hidden");
        }
        renderFinance();
      }

      quick7.addEventListener("click", () => applyQuickDays(7));
      quick30.addEventListener("click", () => applyQuickDays(30));
      quick90.addEventListener("click", () => applyQuickDays(90));

      exportHistory.addEventListener("click", () => {
        if (!["historico_receber", "historico_pagar"].includes(currentFinanceView)) return;

        const fpNorm = normalizePlateSearch(financePlateQuery);
        const exportVehicleById = new Map(state.vehicles.map((v) => [v.id, v]));
        const exportReceivableMatchesPlate = (r) => {
          if (!fpNorm) return true;
          const v = exportVehicleById.get(r.vehicle_id);
          if (!v || !v.placa) return false;
          return plateNormMatchesQuery(normalizePlateSearch(v.placa), fpNorm);
        };
        const exportPayableMatchesPlate = (p) => {
          if (!fpNorm) return true;
          return normalizePlateSearch(p.descricao || "").includes(fpNorm);
        };

        if (currentFinanceView === "historico_receber") {
          const cashByReceivable = new Map(
            state.cash.filter((c) => c.tipo_conta === "RECEBER").map((c) => [c.conta_id, c])
          );
          const rows = state.receivables
            .filter((r) => r.status === "PAGO")
            .filter(exportReceivableMatchesPlate)
            .filter((r) => {
              if (!historyFilter.from && !historyFilter.to) return true;
              const mov = cashByReceivable.get(r.id);
              const dateStr = (mov?.data_movimento || r.created_at || r.period_end || r.period_start || "").toString().slice(0, 10);
              if (!dateStr) return false;
              if (historyFilter.from && dateStr < historyFilter.from) return false;
              if (historyFilter.to && dateStr > historyFilter.to) return false;
              return true;
            })
            .map((r) => {
              const vehicle = state.vehicles.find((v) => v.id === r.vehicle_id);
              const origem = vehicle ? `${vehicle.placa || "-"} ${vehicle.marca || ""} ${vehicle.modelo || ""}`.trim() : "-";
              const mov = cashByReceivable.get(r.id);
              const data = formatDate(mov?.data_movimento || r.created_at || r.period_end || r.period_start);
              const valor = formatCurrency(mov?.valor || r.valor);
              return [data, origem, valor, "Pago"];
            });

          const csv = ["Data,Origem,Valor,Status", ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
          const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = "historico-recebimentos.csv";
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(url);
          return;
        }

        const cashByPayable = new Map(
          state.cash.filter((c) => c.tipo_conta === "PAGAR").map((c) => [c.conta_id, c])
        );
        const rows = state.payables
          .filter((p) => p.status === "PAGO")
          .filter(exportPayableMatchesPlate)
          .filter((p) => {
            if (!historyFilter.from && !historyFilter.to) return true;
            const mov = cashByPayable.get(p.id);
            const dateStr = (mov?.data_movimento || p.data_vencimento || "").toString().slice(0, 10);
            if (!dateStr) return false;
            if (historyFilter.from && dateStr < historyFilter.from) return false;
            if (historyFilter.to && dateStr > historyFilter.to) return false;
            return true;
          })
          .map((p) => {
            const mov = cashByPayable.get(p.id);
            const data = formatDate(mov?.data_movimento || p.data_vencimento);
            const valor = formatCurrency(mov?.valor || p.valor);
            return [data, p.descricao || "Despesa", valor, "Pago"];
          });

        const csv = ["Data,Origem,Valor,Status", ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "historico-pagamentos.csv";
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      });

      partnerSubnav.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-subview]");
        if (!button) return;
        openPartnerSubview(button.getAttribute("data-subview"));
      });

      vehicleForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (isGestorPista && editingVehicleId) {
          alert("O gestor de pista não pode editar veículos.");
          return;
        }
        const vehicleDailyEl = document.getElementById("vehicleDaily");
        const vehicleDailyRaw = (vehicleDailyEl?.value || "").toString().trim();
        if (!vehicleDailyRaw) {
          alert("Informe o valor da diária.");
          return;
        }
        const vehicleDailyValue = vehicleDailyRaw ? Number(vehicleDailyRaw.replace(",", ".")) : 0;
        if (!Number.isFinite(vehicleDailyValue) || vehicleDailyValue < 0) {
          alert("Valor da diária inválido.");
          return;
        }
        const inspectionDateEl = document.getElementById("vehicleInspectionDate");
        const inspectionResponsibleEl = document.getElementById("vehicleInspectionResponsible");
        const inspectionKmEl = document.getElementById("vehicleInspectionKm");
        const inspectionFuelEl = document.getElementById("vehicleInspectionFuel");
        const inspectionDocEl = document.getElementById("vehicleInspectionDoc");
        const inspectionKeyEl = document.getElementById("vehicleInspectionKey");
        const inspectionStepEl = document.getElementById("vehicleInspectionStep");
        const inspectionTowEl = document.getElementById("vehicleInspectionTow");
        const inspectionDamageEl = document.getElementById("vehicleInspectionDamage");
        const rpfFields = readVehicleRpfFields();
        if (rpfFields.responsavel_financeiro_id) {
          const rpfColsOk = await probeVehiclesRpfColumns();
          if (!rpfColsOk) {
            alert(
              "Não foi possível gravar o RPF: a base de dados ainda não tem as colunas responsavel_financeiro_id / responsavel_financeiro_nome na tabela vehicles.\n\n" +
                "No Supabase → SQL Editor, execute o ficheiro supabase/vehicles_recursos_avancados.sql (ou npm run db:apply-vehicles com SUPABASE_DB_URL no .env.local) e tente salvar de novo."
            );
            return;
          }
        }
        const payload = {
          user_id: effectiveUserId(),
          placa: document.getElementById("vehiclePlate").value.trim(),
          marca: document.getElementById("vehicleBrand").value.trim(),
          modelo: document.getElementById("vehicleModel").value.trim(),
          valor_diaria: vehicleDailyValue,
          data_entrada: new Date(document.getElementById("vehicleEntry").value).toISOString(),
          data_saida: vehicleExit.value ? new Date(vehicleExit.value).toISOString() : null,
          localizador_id: vehicleLocator.value || null,
          responsavel_financeiro_id: rpfFields.responsavel_financeiro_id,
          responsavel_financeiro_nome: rpfFields.responsavel_financeiro_nome,
          assessoria_id: vehicleAssessor.value || null,
          leiloeiro_id: vehicleAuctioneer?.value || null,
          observacoes: document.getElementById("vehicleNotes").value.trim(),
          status: editingVehicleData?.status || "NO_PATIO",
          payment_status: editingVehicleData?.payment_status || "EM_ABERTO",
          nfse_status: editingVehicleData?.nfse_status || "NAO_SOLICITADA",
          nfse_requested_at: editingVehicleData?.nfse_requested_at || null,
          nfse_issued_at: editingVehicleData?.nfse_issued_at || null,
          vistoria_data: inspectionDateEl?.value ? new Date(inspectionDateEl.value).toISOString() : null,
          vistoria_responsavel: inspectionResponsibleEl?.value?.trim() || "",
          vistoria_km: inspectionKmEl?.value?.trim() || "",
          vistoria_combustivel: inspectionFuelEl?.value || "",
          vistoria_checklist: {
            documento: !!inspectionDocEl?.checked,
            chave: !!inspectionKeyEl?.checked,
            estepe: !!inspectionStepEl?.checked,
            triangulo_macaco: !!inspectionTowEl?.checked,
          },
          vistoria_observacoes: inspectionDamageEl?.value?.trim() || "",
        };
        if (!normalizePlateSearch(payload.placa)) {
          alert("Informe uma placa válida.");
          return;
        }
        const { queryError: dupQErr, duplicate: dupV } = await findActiveVehicleDuplicatePlacaRemote(
          payload.placa,
          editingVehicleId || null
        );
        if (dupQErr) {
          alert(dupQErr.message || "Não foi possível verificar se a placa já existe.");
          return;
        }
        if (dupV) {
          alert(
            `Esta placa já está a ser usada no veículo «${dupV.placa || payload.placa}». Não é permitido ter dois cadastros do mesmo veículo: altere a placa ou conclua a remoção (VRP) do registo anterior.`
          );
          return;
        }
        const runVehicleSave = (p) =>
          editingVehicleId
            ? supabase.from("vehicles").update(p).eq("id", editingVehicleId).eq("user_id", effectiveUserId())
            : supabase.from("vehicles").insert(p);

        let tryPayload = { ...payload };
        let { error } = await runVehicleSave(tryPayload);
        /** @type {string[]} */
        const degradedGroups = [];
        const stripVistoriaFrom = (p) => {
          const o = { ...p };
          delete o.vistoria_data;
          delete o.vistoria_responsavel;
          delete o.vistoria_km;
          delete o.vistoria_combustivel;
          delete o.vistoria_checklist;
          delete o.vistoria_observacoes;
          return o;
        };
        const stripLeiloeiroFrom = (p) => {
          const o = { ...p };
          delete o.leiloeiro_id;
          return o;
        };
        const stripRpfFrom = (p) => {
          const o = { ...p };
          delete o.responsavel_financeiro_id;
          delete o.responsavel_financeiro_nome;
          return o;
        };
        const advancedKindsFromError = (msg) => {
          const m = msg || "";
          const kinds = [];
          if (/vistoria_/i.test(m)) kinds.push("vistoria");
          if (/leiloeiro_id/i.test(m)) kinds.push("leiloeiro");
          if (/responsavel_financeiro_/i.test(m)) kinds.push("rpf");
          return kinds;
        };
        for (let guard = 0; error && guard < 8; guard++) {
          const kinds = advancedKindsFromError(error.message || "");
          if (!kinds.length) break;
          if (kinds.includes("rpf") && rpfFields.responsavel_financeiro_id) {
            alert(
              "Não foi possível gravar o RPF neste veículo. Confirme no Supabase que existem as colunas responsavel_financeiro_id e responsavel_financeiro_nome (execute supabase/vehicles_recursos_avancados.sql) e tente novamente.\n\n" +
                (error.message || "")
            );
            return;
          }
          const before = JSON.stringify(tryPayload);
          for (const k of kinds) {
            if (k === "vistoria") tryPayload = stripVistoriaFrom(tryPayload);
            else if (k === "leiloeiro") tryPayload = stripLeiloeiroFrom(tryPayload);
            else if (k === "rpf") tryPayload = stripRpfFrom(tryPayload);
            if (!degradedGroups.includes(k)) degradedGroups.push(k);
          }
          if (JSON.stringify(tryPayload) === before) break;
          ({ error } = await runVehicleSave(tryPayload));
        }
        if (!error && degradedGroups.length) {
          const partes = [];
          if (degradedGroups.includes("vistoria")) partes.push("laudo de vistoria");
          if (degradedGroups.includes("leiloeiro")) partes.push("leiloeiro");
          if (degradedGroups.includes("rpf")) partes.push("RPF (responsável financeiro)");
          alert(
            "Veículo salvo, mas a base ainda não tem coluna(s) para: " +
              partes.join(", ") +
              ". No Supabase (SQL Editor), execute supabase/vehicles_recursos_avancados.sql — ou o início de finance_competency_schema.sql (inclui o mesmo bloco) — e grave o veículo de novo."
          );
        }
        if (error) {
          const msg = error.message || "";
          if (/duplicate key|unique constraint|23505/i.test(msg)) {
            alert(
              "Não foi possível gravar: já existe outro veículo ativo com esta placa (regra na base de dados). " +
                "Se acabou de alterar dados noutro separador, atualize a página."
            );
          } else {
            alert(msg);
          }
          return;
        }
        const savedEditId = editingVehicleId;
        vehicleForm.reset();
        editingVehicleId = null;
        editingVehicleData = null;
        vehicleModal.classList.add("hidden");
        await loadVehicles();
        await refreshFichaIfOpen(savedEditId);
      });

      confirmNfse.addEventListener("click", async () => {
        if (!nfseVehicleId) return;
        const { error } = await supabase
          .from("vehicles")
          .update({ nfse_status: "EMITIDA", nfse_issued_at: new Date().toISOString() })
          .eq("id", nfseVehicleId)
          .eq("user_id", effectiveUserId());
        if (error) {
          alert(error.message);
          return;
        }
        const vid = nfseVehicleId;
        nfseVehicleId = null;
        nfseStatusBeforeOpen = null;
        nfseModal.classList.add("hidden");
        resetNfseModalUi();
        await loadVehicles();
        updateDashboard();
        await refreshFichaIfOpen(vid);
      });

      partnerForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const payload = {
          user_id: effectiveUserId(),
          nome: document.getElementById("partnerName").value.trim(),
          cpf: document.getElementById("partnerCpf").value.trim(),
          email: document.getElementById("partnerEmail").value.trim(),
          contato: document.getElementById("partnerContact").value.trim(),
          tipo: partnerTypeFromSubview(currentPartnerView),
        };
        if (payload.tipo === "ASSESSORIA" && partnerDocDigits(payload.cpf).length !== 14) {
          alert("Informe um CNPJ válido com 14 dígitos para a assessoria.");
          return;
        }
        const dupP = findDuplicatePartner({
          nome: payload.nome,
          cpf: payload.cpf,
          tipo: payload.tipo,
          excludePartnerId: null,
        });
        if (dupP) {
          alert(
            "Já existe um cadastro nesta lista com o mesmo nome ou com o mesmo CPF/CNPJ (só dígitos). Use outro nome ou corrija o documento."
          );
          return;
        }
        const { error } = await supabase.from("partners").insert(payload);
        if (error) {
          const msg = error.message || "";
          if (/duplicate key|unique constraint|23505/i.test(msg)) {
            alert(
              "Não foi possível gravar: duplicidade de nome ou documento (índice na base de dados). Corrija ou atualize a página."
            );
          } else {
            alert(msg);
          }
          return;
        }
        partnerForm.reset();
        partnerModal.classList.add("hidden");
        loadPartners();
      });

      payableForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const payload = {
          user_id: effectiveUserId(),
          tipo: document.getElementById("payableType").value,
          payable_category: (payableCategory?.value || "OUTROS").trim(),
          descricao: document.getElementById("payableDesc").value.trim(),
          valor: Number(document.getElementById("payableValue").value),
          data_vencimento: document.getElementById("payableDue").value,
          status: "EM_ABERTO",
        };
        const { error } = await supabase.from("payables").insert(payload);
        if (error) {
          alert(error.message);
          return;
        }
        payableForm.reset();
        payableModal.classList.add("hidden");
        loadPayables().then(() => renderFinance());
      });

      saveSettings.addEventListener("click", async () => {
        const enderecoVal = settingsEndereco ? settingsEndereco.value.trim() : "";
        const emitenteVal = settingsReciboEmitente ? settingsReciboEmitente.value.trim() : "";
        const telefoneVal = settingsReciboTelefone ? settingsReciboTelefone.value.trim() : "";
        const payload = {
          user_id: effectiveUserId(),
          cnpj: settingsCnpj.value.trim(),
          nome_patio: settingsName.value.trim(),
          endereco: enderecoVal,
          recibo_emitente_nome: emitenteVal,
          recibo_telefone: telefoneVal,
          conta_bancaria: settingsBank.value.trim(),
          texto_cobranca: settingsCharge.value.trim(),
          texto_nota_fiscal: settingsInvoice.value.trim(),
        };
        const settingsOp = state.settings?.id
          ? supabase.from("settings").update(payload).eq("id", state.settings.id)
          : supabase.from("settings").insert(payload);
        let { error } = await settingsOp;
        if (error && /endereco|recibo_emitente|recibo_telefone|column/i.test(error.message || "")) {
          const { endereco: _e, recibo_emitente_nome: _r, recibo_telefone: _t, ...rest } = payload;
          const fallbackOp = state.settings?.id
            ? supabase.from("settings").update(rest).eq("id", state.settings.id)
            : supabase.from("settings").insert(rest);
          const retry = await fallbackOp;
          error = retry.error;
          if (!error) {
            alert(
              "Configurações salvas (sem gravar endereço / emitente / telefone do recibo). Execute no Supabase o script supabase/settings_endereco.sql e volte a guardar."
            );
            loadSettings();
            return;
          }
        }
        if (error) {
          alert(error.message);
          return;
        }
        alert("Configurações salvas.");
        loadSettings();
      });

      function isValidManagerLogin(s) {
        const norm = normalizeManagerLogin(s);
        return norm.length >= 3 && norm.length <= 48;
      }

      function hideTrackManagerAccessBox() {
        trackManagerAccessBox?.classList.add("hidden");
        if (trackManagerGeneratedLogin) trackManagerGeneratedLogin.value = "";
        if (trackManagerGeneratedPassword) trackManagerGeneratedPassword.value = "";
      }

      function showTrackManagerAccessBox(login, pwd) {
        if (!trackManagerAccessBox) return;
        if (trackManagerGeneratedLogin) trackManagerGeneratedLogin.value = login || "";
        if (trackManagerGeneratedPassword) trackManagerGeneratedPassword.value = pwd || "";
        trackManagerAccessBox.classList.remove("hidden");
      }

      document.getElementById("gestorPistaWelcomeDismiss")?.addEventListener("click", () => {
        document.getElementById("gestorPistaWelcomeBanner")?.classList.add("hidden");
      });

      trackManagerBtnNovo?.addEventListener("click", () => {
        hideTrackManagerAccessBox();
        trackManagerFormWrap?.classList.remove("hidden");
        trackManagerUsername?.focus();
      });
      trackManagerBtnCancelar?.addEventListener("click", () => {
        trackManagerFormWrap?.classList.add("hidden");
        if (trackManagerUsername) trackManagerUsername.value = "";
        if (trackManagerPassword) trackManagerPassword.value = "";
        if (trackManagerStatus) trackManagerStatus.textContent = "";
        hideTrackManagerAccessBox();
      });

      trackManagerCopyWhatsApp?.addEventListener("click", async () => {
        const login = (trackManagerGeneratedLogin?.value || "").trim();
        const pwd = (trackManagerGeneratedPassword?.value || "").trim();
        if (!login || !pwd) {
          if (trackManagerStatus) trackManagerStatus.textContent = "Não há login/senha para copiar.";
          return;
        }
        const u = new URL(window.location.href);
        u.hash = "";
        const appUrl = u.toString();
        const text = `App: ${appUrl}\nNome (campo Utilizador ou e-mail): ${login}\nSenha: ${pwd}`;
        try {
          await navigator.clipboard.writeText(text);
          if (trackManagerStatus) trackManagerStatus.textContent = "Mensagem copiada. Cole no WhatsApp e envie ao gestor.";
        } catch {
          if (trackManagerStatus) trackManagerStatus.textContent = "Não foi possível copiar. Selecione os campos acima e copie manualmente.";
        }
      });

      if (addTrackManager) {
        addTrackManager.addEventListener("click", async () => {
          if (!supabase) {
            if (trackManagerStatus) trackManagerStatus.textContent = "Sistema indisponível. Recarregue a página.";
            return;
          }
          if (!state?.user?.id) {
            if (trackManagerStatus)
              trackManagerStatus.textContent =
                "Inicie sessão com a conta principal (dono do pátio) antes de criar gestores de pista.";
            return;
          }
          hideTrackManagerAccessBox();
          const nomeRaw = (trackManagerUsername?.value || "").trim();
          const ownerChosenPassword = (trackManagerPassword?.value || "").trim();
          if (!nomeRaw) {
            if (trackManagerStatus) trackManagerStatus.textContent = "Indique o nome do novo utilizador.";
            return;
          }
          if (!nomeRaw.includes("@") && !isValidManagerLogin(nomeRaw)) {
            if (trackManagerStatus)
              trackManagerStatus.textContent =
                "Nome inválido: use 3 a 48 caracteres (letras, números, . - _) ou um e-mail completo com @.";
            return;
          }
          const email = resolveManagerIdentityToEmail(nomeRaw);
          if (!email) {
            if (trackManagerStatus) trackManagerStatus.textContent = "Não foi possível montar o utilizador. Verifique o nome.";
            return;
          }
          if (!ownerChosenPassword) {
            if (trackManagerStatus) trackManagerStatus.textContent = "Indique a senha (mínimo 6 caracteres).";
            return;
          }
          if (ownerChosenPassword.length < 6) {
            if (trackManagerStatus) trackManagerStatus.textContent = "A senha deve ter pelo menos 6 caracteres.";
            return;
          }
          const nomeParaEntrar = nomeRaw.includes("@") ? nomeRaw.toLowerCase() : normalizeManagerLogin(nomeRaw) || nomeRaw;
          if (trackManagerStatus) trackManagerStatus.textContent = "A criar utilizador…";

          let accessToken = "";
          try {
            let sessionRes = await supabase.auth.getSession();
            accessToken = sessionRes?.data?.session?.access_token || "";
            if (!accessToken) {
              const { data: ref } = await supabase.auth.refreshSession();
              accessToken = ref?.session?.access_token || "";
            }
            if (!accessToken) {
              if (trackManagerStatus)
                trackManagerStatus.textContent = "Sessão expirada ou inexistente. Saia e volte a entrar na conta principal.";
              return;
            }

            const createTrackManagerApiUrl = new URL("/api/create-track-manager", window.location.origin).href;
            const resp = await fetch(createTrackManagerApiUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                access_token: accessToken,
                anon_key: supabaseKey,
                email,
                password: ownerChosenPassword,
              }),
            });

            const raw = await resp.text();
            const trimmed = raw.trim();
            if (resp.ok && trimmed.startsWith("<")) {
              if (trackManagerStatus)
                trackManagerStatus.textContent =
                  "O servidor devolveu HTML em vez da API JSON. Confirme que o site está no deploy Next.js na Vercel (rota /api/create-track-manager) e que não está a abrir só um ficheiro estático antigo.";
              return;
            }

            let json = {};
            try {
              json = trimmed ? JSON.parse(trimmed) : {};
            } catch {
              json = {};
            }

            if (resp.status === 404) {
              if (trackManagerStatus)
                trackManagerStatus.textContent =
                  "API /api/create-track-manager não encontrada (404). Confirme deploy Next.js na Vercel neste domínio e variáveis SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e SUPABASE_ANON_KEY.";
              return;
            }

            if (!resp.ok) {
              const rawParts = [json?.error, json?.details]
                .filter((x) => typeof x === "string" && String(x).trim())
                .map((x) => String(x).trim());
              const parts = [...new Set(rawParts)];
              let msg = parts.join(" — ") || `Erro HTTP ${resp.status} ao criar gestor.`;
              const mlow = msg.toLowerCase();
              if (/rate limit|429|over_email_send_rate|email rate limit|exceeded/i.test(mlow)) {
                msg =
                  "Limite de e-mails do Supabase. Desative confirmações por e-mail (Authentication → Providers → Email) ou aguarde. A criação pelo painel Admin não deve enviar e-mail se o projeto estiver atualizado.";
              }
              if (resp.status === 500 && !json?.error) {
                msg =
                  "Erro no servidor (500). Na Vercel confirme SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e SUPABASE_ANON_KEY em Production e faça Redeploy.";
              }
              if (trackManagerStatus) trackManagerStatus.textContent = msg;
              console.warn("create-track-manager", resp.status, json, "raw:", trimmed.slice(0, 400));
              return;
            }

            if (!json.user_id && !json.already_linked) {
              if (trackManagerStatus)
                trackManagerStatus.textContent =
                  json?.error ||
                  "Resposta inválida da API (sem utilizador criado). Verifique os logs do deploy na Vercel.";
              return;
            }

            const newUserId = json?.user_id || "";
            const loginEmail = (json?.email || "").trim();
            const pwdForShare =
              typeof json?.initial_password === "string" && json.initial_password
                ? json.initial_password
                : ownerChosenPassword;
            if (trackManagerStatus) {
              if (json?.already_linked) {
                trackManagerStatus.textContent =
                  json?.message ||
                  `Este utilizador já estava associado. Nome: ${escapeHtml(displayManagerIdentity(loginEmail))} | User ID: ${newUserId || "—"}`;
                hideTrackManagerAccessBox();
              } else if (json?.existing_auth_user && json?.message) {
                trackManagerStatus.textContent = `${json.message} Nome: ${escapeHtml(displayManagerIdentity(loginEmail))} | User ID: ${newUserId}`;
                hideTrackManagerAccessBox();
              } else {
                trackManagerStatus.textContent = "Utilizador criado. Envie nome e senha ao funcionário (copiar em baixo).";
                if (nomeParaEntrar && pwdForShare) showTrackManagerAccessBox(nomeParaEntrar, pwdForShare);
                else hideTrackManagerAccessBox();
              }
            }
            trackManagerFormWrap?.classList.add("hidden");
            if (trackManagerUsername) trackManagerUsername.value = "";
            if (trackManagerPassword) trackManagerPassword.value = "";
            await loadTrackManagersList();
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            if (trackManagerStatus)
              trackManagerStatus.textContent =
                msg || "Falha de rede ao contactar a API. Verifique a ligação e o domínio da app.";
            console.error(e);
          }
        });
      }

      function isTrackManagerUuid(s) {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test((s || "").trim());
      }

      if (linkTrackManager) {
        linkTrackManager.addEventListener("click", async () => {
          if (!supabase || !state?.user?.id) return;
          const uid = (trackManagerLinkUid?.value || "").trim();
          const identityRaw = (trackManagerLinkEmail?.value || "").trim();
          if (uid.includes("@")) {
            if (trackManagerLinkStatus)
              trackManagerLinkStatus.textContent =
                "No campo de cima cola só o UUID do Supabase (Authentication → Users). Em baixo indique o utilizador (ou e-mail) para a lista.";
            return;
          }
          if (!isTrackManagerUuid(uid)) {
            if (trackManagerLinkStatus)
              trackManagerLinkStatus.textContent = "Cole um User UID válido (formato UUID).";
            return;
          }
          if (!identityRaw) {
            if (trackManagerLinkStatus)
              trackManagerLinkStatus.textContent = "Indique o nome de utilizador (ou e-mail) para aparecer na lista.";
            return;
          }
          const email = resolveManagerIdentityToEmail(identityRaw);
          if (uid === state.user.id) {
            if (trackManagerLinkStatus)
              trackManagerLinkStatus.textContent = "Não pode associar a própria conta como gestor delegado.";
            return;
          }
          if (trackManagerLinkStatus) trackManagerLinkStatus.textContent = "A associar…";

          try {
            const { data: dup, error: dupErr } = await supabase
              .from("track_managers")
              .select("user_id")
              .eq("owner_user_id", state.user.id)
              .eq("user_id", uid)
              .maybeSingle();
            if (dupErr) throw dupErr;
            if (dup) {
              if (trackManagerLinkStatus)
                trackManagerLinkStatus.textContent = "Este utilizador já está associado como gestor de pista.";
              return;
            }

            const base = { owner_user_id: state.user.id, user_id: uid, email };
            let ins = await supabase.from("track_managers").insert({ ...base, role: "GESTOR_PISTA" });
            let err = ins.error;
            if (err && /role|column|PGRST204|schema cache/i.test(err.message || "")) {
              ins = await supabase.from("track_managers").insert(base);
              err = ins.error;
            }
            if (err) {
              const hint =
                /row-level security|RLS|42501/i.test(err.message || "")
                  ? " Executa no Supabase o ficheiro supabase/track_managers_rls_policies.sql."
                  : "";
              throw new Error((err.message || "Erro ao associar.") + hint);
            }

            if (trackManagerLinkStatus)
              trackManagerLinkStatus.textContent = "Gestor associado. O utilizador pode iniciar sessão com a palavra-passe definida no Auth.";
            if (trackManagerLinkUid) trackManagerLinkUid.value = "";
            if (trackManagerLinkEmail) trackManagerLinkEmail.value = "";
            await loadTrackManagersList();
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            if (trackManagerLinkStatus) trackManagerLinkStatus.textContent = msg || "Erro ao associar.";
            console.error(e);
          }
        });
      }

      async function handleVnpVehicleAction(button) {
        const id = button.getAttribute("data-id");
        const action = button.getAttribute("data-action");

        if (action === "editar_fechamento_ciclo") {
          if (isGestorPista) return;
          const closureId = button.getAttribute("data-closure-id");
          const closure = (state.cycleClosures || []).find((x) => x.id === closureId);
          const vehicle = state.vehicles.find((v) => v.id === id);
          if (!closure || !vehicle || closure.sent_to_finance) {
            alert("Este registro já não está nesta fila. Atualize o pátio.");
            return;
          }
          const novoRpf = prompt(
            "RPF — responsável financeiro / pagamento (triagem):",
            closure.responsavel_financeiro || vehicle.responsavel_financeiro_nome || ""
          );
          if (novoRpf == null) return;
          const periodStartYmd = toYmdLocal(closure.period_start || vehicle.data_entrada || new Date().toISOString());
          const periodEndYmd = toYmdLocal(closure.period_end || vehicle.data_saida || new Date().toISOString());
          const novoInicio = await openDateModal({ title: "Data inicial do ciclo", label: "Início", type: "date", value: periodStartYmd || "" });
          if (!novoInicio) return;
          const novoFim = await openDateModal({ title: "Data final do ciclo", label: "Fim", type: "date", value: periodEndYmd || novoInicio });
          if (!novoFim) return;
          const isoInicio = startOfLocalDayIso(novoInicio);
          const isoFim = endOfLocalDayIso(novoFim);
          if (!isoInicio || !isoFim || new Date(isoFim).getTime() < new Date(isoInicio).getTime()) {
            alert("Período inválido.");
            return;
          }
          const diariasCalc = Math.max(1, Math.ceil((new Date(isoFim).getTime() - new Date(isoInicio).getTime()) / 86400000));
          const valorSugerido = calcPeriodTotal(vehicle, isoInicio, isoFim);
          const valorInput = prompt("Valor do ciclo (R$)", String(Number(closure.valor || valorSugerido || 0).toFixed(2)).replace(".", ","));
          if (valorInput == null) return;
          const valorNovo = Number(String(valorInput).replace(/\./g, "").replace(",", "."));
          if (!Number.isFinite(valorNovo) || valorNovo < 0) {
            alert("Valor inválido.");
            return;
          }
          const { error: cloErr } = await supabase
            .from("patio_cycle_closures")
            .update({
              responsavel_financeiro: String(novoRpf || "").trim() || null,
              period_start: isoInicio,
              period_end: isoFim,
              diarias: diariasCalc,
              valor: valorNovo,
              updated_at: new Date().toISOString(),
            })
            .eq("id", closure.id)
            .eq("user_id", effectiveUserId());
          if (cloErr) {
            alert(
              isMissingRelationError(cloErr)
                ? "A tabela patio_cycle_closures não existe neste Supabase. Execute supabase/patio_cycle_closures.sql no SQL Editor."
                : cloErr.message
            );
            return;
          }
          if (closure.receivable_id && !FINANCE_MANUAL_ONLY) {
            await supabase
              .from("receivables")
              .update({
                responsavel_pagamento: String(novoRpf || "").trim() || null,
                period_start: isoInicio,
                period_end: isoFim,
                valor: valorNovo,
              })
              .eq("id", closure.receivable_id)
              .eq("user_id", effectiveUserId());
          }
          await Promise.all([loadVehicles(), loadReceivables(), loadCycleClosures()]);
          renderVehicles();
          updateDashboard();
          alert("Triagem atualizada em Fechando ciclo.");
          return;
        }

        if (action === "patio_liberar_financeiro") {
          if (FINANCE_MANUAL_ONLY) {
            alert("O financeiro é lançado manualmente. Use Financeiro → Lançamentos para registrar receitas e despesas.");
            return;
          }
          if (isGestorPista) return;
          const closureId = button.getAttribute("data-closure-id");
          const closure = (state.cycleClosures || []).find((x) => x.id === closureId);
          const vehicle = state.vehicles.find((v) => v.id === id);
          if (!closure || !vehicle || closure.sent_to_finance) {
            alert("Este registro já não está nesta fila. Atualize o pátio.");
            return;
          }
          const tr = button.closest("tr");
          const rpfOk = !!tr?.querySelector(".fechamento-check-rpf")?.checked;
          const nfEmitOk = !!tr?.querySelector(".fechamento-check-nf-emitida")?.checked;
          const nfEnvOk = !!tr?.querySelector(".fechamento-check-nf-enviada")?.checked;
          if (!rpfOk || !nfEmitOk || !nfEnvOk) {
            alert("Marque os três itens: RPF conferido, NF emitida confirmada e NF já enviada.");
            return;
          }
          const { error: cloErr } = await supabase
            .from("patio_cycle_closures")
            .update({
              triagem_ok: true,
              nf_emitida: true,
              nf_enviada: true,
              sent_to_finance: true,
              triaged_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", closure.id)
            .eq("user_id", effectiveUserId());
          if (cloErr) {
            alert(
              isMissingRelationError(cloErr)
                ? "A tabela patio_cycle_closures não existe neste Supabase. Execute supabase/patio_cycle_closures.sql no SQL Editor."
                : cloErr.message
            );
            return;
          }

          let nfErr = (
            await supabase
              .from("vehicles")
              .update({ nfse_enviada: true })
              .eq("id", vehicle.id)
              .eq("user_id", effectiveUserId())
          ).error;
          if (nfErr && /nfse_enviada|column|schema cache|PGRST204/i.test(nfErr.message || "")) {
            nfErr = null;
            addNfseEnviadaVehicleId(vehicle.id);
          } else if (nfErr) {
            alert(nfErr.message);
            return;
          }

          if (closure.receivable_id) {
            let libErr = (
              await supabase
                .from("receivables")
                .update({ patio_liberado_financeiro: true })
                .eq("id", closure.receivable_id)
                .eq("user_id", effectiveUserId())
            ).error;
            if (libErr && /patio_liberado|column|schema cache|PGRST204/i.test(libErr.message || "")) {
              libErr = null;
            } else if (libErr) {
              alert(libErr.message);
              return;
            }
            removePatioFinanceiroBloqueadoReceivableId(closure.receivable_id);
          }

          await Promise.all([loadVehicles(), loadReceivables(), loadCycleClosures()]);
          renderVehicles();
          renderFinance();
          updateDashboard();
          openMainView("financeiro");
          openFinanceSubview("receber");
          alert("Ciclo liberado para o Financeiro na aba Receber.");
          return;
        }

        const vehicle = state.vehicles.find((v) => v.id === id);
        if (!vehicle) return;

        if (isGestorPista && action !== "confirmar_liberacao") {
          return;
        }

        if (action === "apagar") {
          if (!confirm("Deseja apagar este veículo?")) return;
          const { error } = await supabase.from("vehicles").delete().eq("id", id).eq("user_id", effectiveUserId());
          if (error) {
            alert(error.message);
            return;
          }
          fichaModal.classList.add("hidden");
          delete fichaModal.dataset.openVehicleId;
          await loadVehicles();
          return;
        }

        if (action === "ficha") {
          await openFicha(vehicle);
          return;
        }

        if (action === "nfse") {
          await openNfseModal(vehicle);
          return;
        }

        if (action === "voltar") {
          const canBackVrp = vehicle.status === "REMOVIDO";
          const canBackVnp =
            ["LIBERACAO_SOLICITADA", "LIBERACAO_CONFIRMADA", "REMocao_CONFIRMADA"].includes(vehicle.status) ||
            (vehicle.status === "NO_PATIO" && isRemocaoSolicitada(vehicle));

          if (!canBackVnp && !canBackVrp) {
            alert("A ação Voltar só está disponível para veículos em fluxo de liberação ou no VRP.");
            return;
          }
          if (canBackVnp && !confirm("Voltar este veículo para o passo anterior no VNP?")) return;
          if (canBackVrp && !confirm("Desfazer esta remoção e voltar o veículo para o passo anterior?")) return;

          if (canBackVnp) {
            if (vehicle.status === "NO_PATIO" && isRemocaoSolicitada(vehicle)) {
              const { error: clrErr } = await clearRemocaoSolicitadaOnVehicle(id);
              if (clrErr) {
                alert(
                  clrErr.message +
                    (/column|schema cache|PGRST204/i.test(clrErr.message || "")
                      ? " Execute no Supabase o ficheiro supabase/vehicles_remocao_solicitada.sql."
                      : "")
                );
                return;
              }
              await supabase.from("vehicle_events").insert({
                vehicle_id: id,
                tipo: "STATUS_REVERTIDO_VNP",
                responsavel: state.user?.email || "Administrador",
                descricao: "Remoção solicitada desfeita (veículo continua no pátio).",
              });
              await loadVehicles();
              renderVehicles();
              updateDashboard();
              await refreshFichaIfOpen(id);
              return;
            }
            if (vehicle.status === "LIBERACAO_CONFIRMADA" && isRemocaoSolicitada(vehicle)) {
              const { error: clrErr } = await clearRemocaoSolicitadaOnVehicle(id);
              if (clrErr) {
                alert(
                  clrErr.message +
                    (/column|schema cache|PGRST204/i.test(clrErr.message || "")
                      ? " Execute no Supabase o ficheiro supabase/vehicles_remocao_solicitada.sql."
                      : "")
                );
                return;
              }
              await supabase.from("vehicle_events").insert({
                vehicle_id: id,
                tipo: "STATUS_REVERTIDO_VNP",
                responsavel: state.user?.email || "Administrador",
                descricao: "Remoção solicitada desfeita (liberação confirmada mantida).",
              });
              await loadVehicles();
              renderVehicles();
              updateDashboard();
              await refreshFichaIfOpen(id);
              return;
            }
            const prevMap = {
              LIBERACAO_SOLICITADA: "NO_PATIO",
              LIBERACAO_CONFIRMADA: "LIBERACAO_SOLICITADA",
              REMocao_CONFIRMADA: "LIBERACAO_CONFIRMADA",
            };
            const previousStatus = prevMap[vehicle.status] || "NO_PATIO";
            const extraClear =
              vehicle.status === "REMocao_CONFIRMADA"
                ? {
                    remocao_solicitada: false,
                    remocao_solicitada_por: null,
                    remocao_solicitada_em: null,
                  }
                : {};
            let backRes = await supabase
              .from("vehicles")
              .update({ status: previousStatus, data_saida: null, ...extraClear })
              .eq("id", id)
              .eq("user_id", effectiveUserId())
              .select("id");
            let backErr = backRes.error;
            if (
              backErr &&
              /column|schema cache|PGRST204/i.test(backErr.message || "") &&
              Object.keys(extraClear).length
            ) {
              backRes = await supabase
                .from("vehicles")
                .update({ status: previousStatus, data_saida: null })
                .eq("id", id)
                .eq("user_id", effectiveUserId())
                .select("id");
              backErr = backRes.error;
            }
            if (backErr) {
              alert(backErr.message);
              return;
            }
            if (!backRes.data || backRes.data.length === 0) {
              alert("Não foi possível voltar o veículo. Verifique se ele pertence ao utilizador atual e atualize a página.");
              return;
            }
            await supabase.from("vehicle_events").insert({
              vehicle_id: id,
              tipo: "STATUS_REVERTIDO_VNP",
              responsavel: state.user?.email || "Administrador",
              descricao: `Fluxo revertido manualmente: ${VLS_STATUS_LABELS[vehicle.status] || vehicle.status} → ${VLS_STATUS_LABELS[previousStatus] || previousStatus}.`,
            });
            await loadVehicles();
            renderVehicles();
            updateDashboard();
            await refreshFichaIfOpen(id);
            return;
          }

          let previousStatus = "LIBERACAO_CONFIRMADA";
          try {
            const { data: eventsBack, error: eventsBackErr } = await supabase
              .from("vehicle_events")
              .select("tipo,descricao,created_at")
              .eq("vehicle_id", id)
              .in("tipo", ["REMOVIDO", "REMocao_CONFIRMADA", "LIBERACAO_CONFIRMADA", "LIBERACAO_SOLICITADA"])
              .order("created_at", { ascending: false })
              .limit(30);
            if (eventsBackErr) throw eventsBackErr;
            const events = eventsBack || [];
            const removedEvent = events.find((e) => e.tipo === "REMOVIDO");
            if (removedEvent?.descricao) {
              const m = String(removedEvent.descricao).match(/PREV_STATUS=([A-Z_]+)/);
              if (m?.[1]) previousStatus = m[1];
            }
            if (!["LIBERACAO_SOLICITADA", "LIBERACAO_CONFIRMADA", "REMocao_CONFIRMADA"].includes(previousStatus)) {
              const idxRemoved = events.findIndex((e) => e.tipo === "REMOVIDO");
              const older = idxRemoved >= 0 ? events.slice(idxRemoved + 1) : events;
              const prevByTipo = older.find((e) =>
                ["REMocao_CONFIRMADA", "LIBERACAO_CONFIRMADA", "LIBERACAO_SOLICITADA"].includes(e.tipo)
              );
              if (prevByTipo) previousStatus = prevByTipo.tipo;
            }
          } catch (e) {
            console.warn("voltar_vrp_prev_status", e);
          }
          if (!["LIBERACAO_SOLICITADA", "LIBERACAO_CONFIRMADA", "REMocao_CONFIRMADA"].includes(previousStatus)) {
            previousStatus = "LIBERACAO_CONFIRMADA";
          }

          // Retorna ao passo anterior identificado no fluxo de liberação.
          const reabreRemocaoSolicitada =
            previousStatus === "LIBERACAO_CONFIRMADA"
              ? { remocao_solicitada: true, remocao_solicitada_por: null, remocao_solicitada_em: null }
              : {};
          let vehicleBackRes = await supabase
            .from("vehicles")
            .update({
              status: previousStatus,
              data_saida: null,
              payment_status: "EM_ABERTO",
              ...reabreRemocaoSolicitada,
            })
            .eq("id", id)
            .eq("user_id", effectiveUserId())
            .select("id");
          const vehicleBackErr = vehicleBackRes.error;
          if (vehicleBackErr) {
            if (/column|schema cache|PGRST204/i.test(vehicleBackErr.message || "")) {
              vehicleBackRes = await supabase
                .from("vehicles")
                .update({ status: previousStatus, data_saida: null, payment_status: "EM_ABERTO" })
                .eq("id", id)
                .eq("user_id", effectiveUserId())
                .select("id");
              if (vehicleBackRes.error) {
                alert(vehicleBackRes.error.message);
                return;
              }
            } else {
              alert(vehicleBackErr.message);
              return;
            }
          }
          if (!vehicleBackRes.data || vehicleBackRes.data.length === 0) {
            alert("Não foi possível desfazer a remoção. Verifique se o veículo pertence ao utilizador atual e atualize a página.");
            return;
          }

          // Reabre o ciclo financeiro fechado no momento da remoção (quando existir).
          if (!FINANCE_MANUAL_ONLY) {
          const { data: lastCycle, error: qCycleErr } = await supabase
            .from("receivables")
            .select("id,period_start,period_end,status")
            .eq("user_id", effectiveUserId())
            .eq("vehicle_id", id)
            .not("period_end", "is", null)
            .in("status", [RECEIVABLE_AGUARDANDO_LANCAMENTO, "EM_ABERTO"])
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (qCycleErr) {
            alert(qCycleErr.message);
            return;
          }
          if (lastCycle?.id) {
            const reopenedVehicle = { ...vehicle, status: previousStatus, data_saida: null };
            const valorReaberto = calcPeriodTotal(reopenedVehicle, lastCycle.period_start, null);
            const { error: reopenErr } = await supabase
              .from("receivables")
              .update({
                period_end: null,
                status: "EM_ABERTO",
                valor: valorReaberto,
                financeiro_aprovado_contas_receber: false,
                patio_liberado_financeiro: true,
              })
              .eq("id", lastCycle.id)
              .eq("user_id", effectiveUserId());
            if (reopenErr) {
              // fallback para ambientes sem a coluna financeiro_aprovado_contas_receber
              if (/financeiro_aprovado|patio_liberado|column|schema cache|PGRST204/i.test(reopenErr.message || "")) {
                const { error: reopenFallbackErr } = await supabase
                  .from("receivables")
                  .update({
                    period_end: null,
                    status: "EM_ABERTO",
                    valor: valorReaberto,
                  })
                  .eq("id", lastCycle.id)
                  .eq("user_id", effectiveUserId());
                if (reopenFallbackErr) {
                  alert(reopenFallbackErr.message);
                  return;
                }
              } else {
                alert(reopenErr.message);
                return;
              }
            }
            removeReceberTriagemId(lastCycle.id);
            removePatioFinanceiroBloqueadoReceivableId(lastCycle.id);
            await supabase
              .from("cash_movements")
              .delete()
              .eq("conta_id", lastCycle.id)
              .eq("tipo_conta", "RECEBER")
              .eq("user_id", effectiveUserId());
          }
          }

          await supabase.from("vehicle_events").insert({
            vehicle_id: id,
            tipo: "REMOCAO_DESFEITA",
            responsavel: state.user?.email || "Administrador",
            descricao: `Remoção desfeita manualmente. Veículo retornado ao passo anterior (${VLS_STATUS_LABELS[previousStatus] || previousStatus}).`,
          });

          await Promise.all(
            FINANCE_MANUAL_ONLY ? [loadVehicles()] : [loadVehicles(), loadReceivables(), loadCash()]
          );
          if (!FINANCE_MANUAL_ONLY) renderFinance();
          updateDashboard();
          await refreshFichaIfOpen(id);
          return;
        }

        if (action === "confirmar_liberacao") {
          if (vehicle.status !== "LIBERACAO_SOLICITADA") {
            alert("Esta ação só pode ser usada quando o veículo está em «Liberação solicitada».");
            return;
          }
          const actors = await getVehicleWorkflowActors(id);
          const libData = await openWorkflowStepModal({
            title: "Confirmar liberação",
            submitLabel: "OK",
            requiredFields: ["confirmador", "responsavelFinanceiro"],
            values: {
              solicitante: actors.solicitante,
              confirmador: actors.confirmador,
              responsavelFinanceiro: actors.responsavelFinanceiro,
            },
            readonly: { solicitante: true },
          });
          if (!libData) return;
          const responsavel = String(libData.responsavelFinanceiro || "").trim();
          const confirmador = String(libData.confirmador || "").trim();
          const { error: upErr } = await supabase
            .from("vehicles")
            .update({ status: "LIBERACAO_CONFIRMADA" })
            .eq("id", id)
            .eq("user_id", effectiveUserId());
          if (upErr) {
            alert(upErr.message);
            return;
          }

          if (!FINANCE_MANUAL_ONLY) {
          const { data: existingCycle, error: cycleCheckErr } = await supabase
            .from("receivables")
            .select("id,period_start,period_end,status")
            .eq("user_id", effectiveUserId())
            .eq("vehicle_id", id)
            .is("period_end", null)
            .eq("status", "EM_ABERTO")
            .limit(1);
          if (cycleCheckErr) console.warn(cycleCheckErr);

          if (!existingCycle || existingCycle.length === 0) {
            const periodStart = vehicle.data_entrada || new Date().toISOString();
            const valor = calcPeriodTotal(vehicle, periodStart, null);
            const { error: insErr } = await supabase.from("receivables").insert({
              user_id: effectiveUserId(),
              vehicle_id: id,
              responsavel_pagamento: responsavel,
              receivable_category: "GUARDA_PATIO",
              valor,
              status: "EM_ABERTO",
              period_start: periodStart,
              period_end: null,
            });
            if (insErr) {
              alert(insErr.message);
              return;
            }
          } else {
            const { error: updRecErr } = await supabase
              .from("receivables")
              .update({ responsavel_pagamento: responsavel })
              .eq("user_id", effectiveUserId())
              .eq("vehicle_id", id)
              .is("period_end", null)
              .eq("status", "EM_ABERTO");
            if (updRecErr) {
              alert(updRecErr.message);
              return;
            }
          }
          }

          await supabase.from("vehicle_events").insert({
            vehicle_id: id,
            tipo: "LIBERACAO_CONFIRMADA",
            responsavel: confirmador || responsavel,
            descricao: `Liberação confirmada por ${confirmador || "-"}. RPF: ${responsavel}.`,
          });
          await loadVehicles();
          if (!FINANCE_MANUAL_ONLY) await Promise.all([loadReceivables(), loadCycleClosures()]);
          else await loadCycleClosures();
          renderVehicles();
          if (!FINANCE_MANUAL_ONLY) renderFinance();
          updateDashboard();
          await refreshFichaIfOpen(id);
          return;
        }

        if (action === "remocao_solicitada") {
          if (vehicle.status === "REMOVIDO") {
            alert("Veículo já consta como removido.");
            return;
          }
          if (vehicle.status !== "LIBERACAO_CONFIRMADA") {
            alert("A confirmação de remoção só pode ser feita após a liberação confirmada.");
            return;
          }
          if (isRemocaoSolicitada(vehicle)) {
            alert("A remoção já foi solicitada para este veículo.");
            return;
          }
          const actors = await getVehicleWorkflowActors(id);
          const remData = await openWorkflowStepModal({
            title: "Confirmar remoção",
            submitLabel: "OK",
            requiredFields: ["solicitanteRemocao"],
            values: {
              solicitante: actors.solicitante,
              confirmador: actors.confirmador,
              responsavelFinanceiro: actors.responsavelFinanceiro,
              solicitanteRemocao: actors.solicitanteRemocao,
            },
            readonly: {
              solicitante: true,
              confirmador: true,
              responsavelFinanceiro: true,
            },
          });
          if (!remData) return;
          const por = String(remData.solicitanteRemocao || "").trim();
          const agora = new Date().toISOString();
          const { error: upErr } = await supabase
            .from("vehicles")
            .update({
              remocao_solicitada: true,
              remocao_solicitada_por: por,
              remocao_solicitada_em: agora,
            })
            .eq("id", id)
            .eq("user_id", effectiveUserId());
          if (upErr) {
            alert(
              upErr.message +
                (/column|schema cache|PGRST204/i.test(upErr.message || "")
                  ? " Execute no Supabase o ficheiro supabase/vehicles_remocao_solicitada.sql."
                  : "")
            );
            return;
          }
          await supabase.from("vehicle_events").insert({
            vehicle_id: id,
            tipo: "REMOCAO_SOLICITADA",
            responsavel: por,
            descricao: "Remoção solicitada (registo operacional). A remoção efetivada só após liberação confirmada.",
          });
          await loadVehicles();
          renderVehicles();
          updateDashboard();
          await refreshFichaIfOpen(id);
          return;
        }

        if (action === "trocar-responsavel") {
          if (FINANCE_MANUAL_ONLY) {
            alert(
              "O financeiro é lançado manualmente. Atualize o RPF no cadastro do veículo e registre valores em Financeiro → Lançamentos."
            );
            return;
          }
          // Responsável atual “acerta” diárias até o fim do dia do acerto (inclusive);
          // a partir do dia seguinte, o ciclo é do novo responsável.
          const novoResp = prompt("Novo RPF (responsável financeiro / pagamento):");
          if (!novoResp) return;
          const dataAcerto = await openDateModal({
            title: "Data do acerto das diárias (até este dia, inclusive, fica com o responsável atual)",
            label: "Data do acerto",
            type: "date",
          });
          if (!dataAcerto) return;

          const periodEnd = endOfLocalDayIso(dataAcerto);
          const periodStartNew = startOfNextLocalDayIso(dataAcerto);
          if (!periodEnd || !periodStartNew) {
            alert("Data inválida.");
            return;
          }

          const { data: currentCycle, error: cycleErr } = await supabase
            .from("receivables")
            .select("id,period_start,period_end,status,valor,vehicle_id")
            .eq("user_id", effectiveUserId())
            .eq("vehicle_id", id)
            .is("period_end", null)
            .eq("status", "EM_ABERTO")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (cycleErr) {
            alert(cycleErr.message);
            return;
          }
          if (!currentCycle) {
            alert("Nenhum ciclo em aberto encontrado para este veículo.");
            return;
          }

          // fecha ciclo atual
          const valorFechamento = calcPeriodTotal(vehicle, currentCycle.period_start, periodEnd);
          let { error: closeErr } = await supabase
            .from("receivables")
            .update({
              period_end: periodEnd,
              valor: valorFechamento,
              status: RECEIVABLE_AGUARDANDO_LANCAMENTO,
            })
            .eq("id", currentCycle.id)
            .eq("user_id", effectiveUserId());
          if (closeErr && /invalid input value for enum payment_status/i.test(closeErr.message || "")) {
            // Compatibilidade temporária para bases onde payment_status ainda não aceita AGUARDANDO_LANCAMENTO.
            closeErr = (
              await supabase
                .from("receivables")
                .update({
                  period_end: periodEnd,
                  valor: valorFechamento,
                  status: "EM_ABERTO",
                })
                .eq("id", currentCycle.id)
                .eq("user_id", effectiveUserId())
            ).error;
          }
          if (closeErr) {
            alert(closeErr.message);
            return;
          }

          // abre novo ciclo
          const valorNovo = calcPeriodTotal(vehicle, periodStartNew, null);
          const { error: newErr } = await supabase.from("receivables").insert({
            user_id: effectiveUserId(),
            vehicle_id: id,
            responsavel_pagamento: novoResp,
            receivable_category: "GUARDA_PATIO",
            valor: valorNovo,
            status: "EM_ABERTO",
            period_start: periodStartNew,
            period_end: null,
          });
          if (newErr) {
            alert(newErr.message);
            return;
          }

          await supabase.from("vehicle_events").insert({
            vehicle_id: id,
            tipo: "RESPONSAVEL_TROCADO",
            responsavel: novoResp,
            descricao: `Troca de responsável: ciclo anterior encerrado em ${dataAcerto} (inclusive). Novo responsável (${novoResp}) a partir de ${formatNextCalendarDayPt(
              dataAcerto
            )}.`,
          });

          await Promise.all([loadReceivables(), loadCycleClosures()]);
          try {
            const userId = effectiveUserId();
            if (userId) {
              await callFinanceCompetencyApi("/api/finance/close-vehicle-cycle", {
                userId,
                vehicleId: id,
                discountAmount: 0,
                isFullWaiver: false,
                closeDate: dataAcerto,
              });
            }
          } catch (e) {
            console.warn("finance competency close cycle", e?.message || e);
          }
          renderFinance();
          alert(
            `Ciclo do responsável anterior encerrado em ${dataAcerto} (fim desse dia). O encerramento foi enviado ao Financeiro (aba «Receber»). Novo responsável a partir de ${formatNextCalendarDayPt(
              dataAcerto
            )}.`
          );
          await refreshFichaIfOpen(id);
          return;
        }

        if (action === "editar") {
          openVehicleModal("edit", vehicle);
          return;
        }

        if (action === "solicitar") {
          const libData = await openWorkflowStepModal({
            title: "Liberação solicitada",
            submitLabel: "OK",
            requiredFields: ["solicitante"],
          });
          if (!libData) return;
          const { solicitante } = libData;
          if (!solicitante || !String(solicitante).trim()) {
            alert("Informe quem solicitou a liberação.");
            return;
          }
          await supabase.from("vehicle_events").insert({
            vehicle_id: id,
            tipo: "LIBERACAO_SOLICITADA",
            responsavel: solicitante,
            descricao: "Liberação solicitada.",
          });
          const { error: upErr } = await supabase
            .from("vehicles")
            .update({
              status: "LIBERACAO_SOLICITADA",
            })
            .eq("id", id)
            .eq("user_id", effectiveUserId());
          if (upErr) {
            alert(upErr.message);
            return;
          }

          await loadVehicles();
          updateDashboard();
          await refreshFichaIfOpen(id);
          return;
        }

        if (action === "confirmar") {
          const podeEfetivarRemocao =
            vehicle.status === "REMocao_CONFIRMADA" || vehicle.status === "LIBERACAO_CONFIRMADA";
          if (!podeEfetivarRemocao) {
            alert(
              "A remoção só pode ser efetivada depois da liberação confirmada."
            );
            return;
          }
          const actors = await getVehicleWorkflowActors(id);
          const vrpData = await openWorkflowStepModal({
            title: "VRP - Efetivar saída",
            submitLabel: "OK",
            requiredFields: ["removeu"],
            values: {
              solicitante: actors.solicitante,
              confirmador: actors.confirmador,
              responsavelFinanceiro: actors.responsavelFinanceiro,
              solicitanteRemocao: actors.solicitanteRemocao,
              removeu: actors.removeu,
            },
            readonly: {
              solicitante: true,
              confirmador: true,
              responsavelFinanceiro: true,
              solicitanteRemocao: true,
            },
          });
          if (!vrpData) return;
          const responsavel = String(vrpData.removeu || "").trim();
          const dataSaida = new Date().toISOString();
          const previousStatus = vehicle.status;
          const { error: eventError } = await supabase.from("vehicle_events").insert({
            vehicle_id: id,
            tipo: "REMOVIDO",
            responsavel,
            descricao: `Remoção efetivada — veículo removido do pátio. PREV_STATUS=${previousStatus}`,
          });
          if (eventError) {
            alert(eventError.message);
            return;
          }
          let updatedVehicle = null;
          let vehicleError = null;
          const updFull = await supabase
            .from("vehicles")
            .update({
              status: "REMOVIDO",
              data_saida: dataSaida,
              remocao_solicitada: false,
              remocao_solicitada_por: null,
              remocao_solicitada_em: null,
            })
            .eq("id", id)
            .eq("user_id", effectiveUserId())
            .select("id");
          updatedVehicle = updFull.data;
          vehicleError = updFull.error;
          if (vehicleError && /column|schema cache|PGRST204/i.test(vehicleError.message || "")) {
            const updMin = await supabase
              .from("vehicles")
              .update({ status: "REMOVIDO", data_saida: dataSaida })
              .eq("id", id)
              .eq("user_id", effectiveUserId())
              .select("id");
            updatedVehicle = updMin.data;
            vehicleError = updMin.error;
          }
          if (vehicleError) {
            alert(vehicleError.message);
            return;
          }
          if (!updatedVehicle || updatedVehicle.length === 0) {
            alert("Não foi possível atualizar o veículo. Verifique se o registro está no seu usuário.");
            return;
          }

          let vrpSemCobranca = false;
          if (!FINANCE_MANUAL_ONLY) {
          const { data: cycleAberto, error: cycleQErr } = await supabase
            .from("receivables")
            .select("id,period_start")
            .eq("user_id", effectiveUserId())
            .eq("vehicle_id", id)
            .is("period_end", null)
            .eq("status", "EM_ABERTO")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (cycleQErr) {
            console.warn(cycleQErr);
          }
          if (cycleAberto?.id) {
            const hadRemocao = isRemocaoSolicitada(vehicle);
            const closedVehicle = { ...vehicle, status: "REMOVIDO", data_saida: dataSaida };
            const breakdown = calcFinanceChargeBreakdown(closedVehicle, cycleAberto.period_start, dataSaida, {
              aplicarRemocao: hadRemocao,
            });
            const valorFechamento = breakdown.total;
            vrpSemCobranca = !(valorFechamento > 0);
            const calcMeta = financeMetaPack(
              {
                calculo_patio: breakdown,
                aplicar_remocao: hadRemocao,
                origem_modulo: "PATIO_VRP",
                gerado_em: dataSaida,
                sem_cobranca: vrpSemCobranca,
              },
              vrpSemCobranca
                ? "Sem cobrança — valor zerado na saída (VRP)"
                : `Cobrança automática — ${breakdown.dias} dia(s) × ${formatCurrency(breakdown.valorDiaria)}`
            );
            const recPatchBase = {
              period_end: dataSaida,
              valor: valorFechamento,
              patio_liberado_financeiro: true,
              observacoes: calcMeta,
            };
            const recPatchFull = vrpSemCobranca
              ? {
                  ...recPatchBase,
                  status: "PAGO",
                  financeiro_aprovado_contas_receber: true,
                }
              : {
                  ...recPatchBase,
                  status: RECEIVABLE_AGUARDANDO_LANCAMENTO,
                  financeiro_aprovado_contas_receber: false,
                };
            let { error: recErr } = await supabase
              .from("receivables")
              .update(recPatchFull)
              .eq("id", cycleAberto.id)
              .eq("user_id", effectiveUserId());
            if (
              recErr &&
              /patio_liberado|financeiro_aprovado|column|schema cache|PGRST204/i.test(recErr.message || "")
            ) {
              const recPatchFallback = { ...recPatchBase };
              recPatchFallback.status = vrpSemCobranca ? "PAGO" : RECEIVABLE_AGUARDANDO_LANCAMENTO;
              recErr = (
                await supabase
                  .from("receivables")
                  .update(recPatchFallback)
                  .eq("id", cycleAberto.id)
                  .eq("user_id", effectiveUserId())
              ).error;
            }
            if (recErr && /invalid input value for enum payment_status/i.test(recErr.message || "")) {
              const recPatchEnum = {
                ...recPatchBase,
                status: vrpSemCobranca ? "PAGO" : "EM_ABERTO",
                patio_liberado_financeiro: true,
                financeiro_aprovado_contas_receber: vrpSemCobranca,
              };
              recErr = (
                await supabase
                  .from("receivables")
                  .update(recPatchEnum)
                  .eq("id", cycleAberto.id)
                  .eq("user_id", effectiveUserId())
              ).error;
              if (
                recErr &&
                /patio_liberado|financeiro_aprovado|column|schema cache|PGRST204/i.test(recErr.message || "")
              ) {
                recErr = (
                  await supabase
                    .from("receivables")
                    .update({
                      period_end: dataSaida,
                      valor: valorFechamento,
                      status: vrpSemCobranca ? "PAGO" : "EM_ABERTO",
                    })
                    .eq("id", cycleAberto.id)
                    .eq("user_id", effectiveUserId())
                ).error;
              }
            }
            if (recErr) {
              alert(recErr.message);
              return;
            }
            removePatioFinanceiroBloqueadoReceivableId(cycleAberto.id);
            if (vrpSemCobranca) {
              removeReceberTriagemId(cycleAberto.id);
              const flags = financeReceberFlagsRead();
              flags[String(cycleAberto.id)] = {
                ...(flags[String(cycleAberto.id)] || {}),
                isento: true,
                sem_cobranca: true,
              };
              financeReceberFlagsWrite(flags);
              financeAuditAppend(cycleAberto.id, "Encerrado sem cobrança (valor R$ 0,00)", {
                valor: 0,
                note: `${breakdown.dias} dia(s), diária ${formatCurrency(breakdown.valorDiaria)}`,
              });
            } else {
              removeReceberTriagemId(cycleAberto.id);
              financeAuditAppend(cycleAberto.id, "Enviado para Aguardando Faturamento", {
                valor: valorFechamento,
                note: `${breakdown.dias} dia(s), remoção: ${formatCurrency(breakdown.taxaRemocao)}`,
              });
            }

            const dIni = new Date(cycleAberto.period_start);
            const dFim = new Date(dataSaida);
            const diarias = Math.max(1, Math.ceil((dFim.getTime() - dIni.getTime()) / 86400000));
            const fechamentoPayload = {
              user_id: effectiveUserId(),
              vehicle_id: id,
              receivable_id: cycleAberto.id,
              responsavel_financeiro: actors.responsavelFinanceiro || null,
              period_start: cycleAberto.period_start,
              period_end: dataSaida,
              diarias,
              valor: valorFechamento,
              nf_emitida: vehicle.nfse_status === "EMITIDA",
              nf_enviada: vehicleNfseEnviadaFlag(vehicle),
              triagem_ok: vrpSemCobranca,
              sent_to_finance: vrpSemCobranca,
            };
            const { error: fechamentoErr } = await supabase.from("patio_cycle_closures").insert(fechamentoPayload);
            if (fechamentoErr) {
              if (isMissingRelationError(fechamentoErr)) {
                alert(
                  "A tabela patio_cycle_closures ainda não existe neste projeto Supabase. Abra o SQL Editor, execute o script «supabase/patio_cycle_closures.sql» do repositório e recarregue o painel."
                );
                return;
              }
              alert(fechamentoErr.message);
              return;
            }
          }
          }

          await loadVehicles();
          if (!FINANCE_MANUAL_ONLY) await Promise.all([loadReceivables(), loadCycleClosures()]);
          else await loadCycleClosures();
          if (!FINANCE_MANUAL_ONLY) {
          try {
            const userId = effectiveUserId();
            if (userId) {
              await callFinanceCompetencyApi("/api/finance/close-vehicle-cycle", {
                userId,
                vehicleId: id,
                discountAmount: 0,
                isFullWaiver: vrpSemCobranca,
                closeDate: dataSaida,
              });
            }
          } catch (e) {
            console.warn("finance competency close cycle", e?.message || e);
          }
          }
          if (!FINANCE_MANUAL_ONLY) renderFinance();
          updateDashboard();
          alert(
            FINANCE_MANUAL_ONLY
              ? "Veículo removido do pátio (VRP). Registre o financeiro manualmente em Financeiro → Lançamentos."
              : vrpSemCobranca
                ? "Veículo removido do pátio (VRP). Valor R$ 0,00 — encerrado sem cobrança no financeiro."
                : "Veículo removido do pátio (VRP). O valor foi calculado e enviado para Financeiro → Aguardando Faturamento."
          );
          if (!FINANCE_MANUAL_ONLY && !vrpSemCobranca) openFinanceSubview("aguardando_faturamento");
          fichaModal.classList.add("hidden");
          delete fichaModal.dataset.openVehicleId;
          return;
        }
      }

      document.getElementById("viewPatio").addEventListener("click", async (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button || !event.currentTarget.contains(button)) return;
        await handleVnpVehicleAction(button);
      });

      fichaModal.addEventListener("click", async (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button || !fichaModal.contains(button)) return;
        await handleVnpVehicleAction(button);
      });

      document.getElementById("viewParceiros").addEventListener("click", async (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;
        const id = button.getAttribute("data-id");
        const action = button.getAttribute("data-action");
        const partner = state.partners.find((p) => p.id === id);
        if (!partner) return;

        if (action === "apagar-parceiro") {
          if (!confirm("Deseja apagar este parceiro?")) return;
          const { error } = await supabase.from("partners").delete().eq("id", id).eq("user_id", effectiveUserId());
          if (error) alert(error.message);
          loadPartners();
          return;
        }

        if (action === "editar-parceiro") {
          const isAssessoria = normalizePartnerType(partner.tipo || "PARCEIRO") === "ASSESSORIA";
          const nome = prompt(isAssessoria ? "Nome da assessoria:" : "Nome:", partner.nome || "");
          const cpf = prompt(isAssessoria ? "CNPJ:" : "CPF/CNPJ:", partner.cpf || "");
          const contato = prompt(isAssessoria ? "Pessoa de contato:" : "Contato:", partner.contato || "");
          const email = isAssessoria ? partner.email || "" : prompt("E-mail:", partner.email || "");
          const nomeFinal = nome != null ? String(nome).trim() : "";
          const cpfFinal = cpf != null ? String(cpf).trim() : "";
          if (isAssessoria && partnerDocDigits(cpfFinal).length !== 14) {
            alert("Informe um CNPJ válido com 14 dígitos.");
            return;
          }
          const dupE = findDuplicatePartner({
            nome: nomeFinal,
            cpf: cpfFinal,
            tipo: partner.tipo,
            excludePartnerId: id,
          });
          if (dupE) {
            alert("Já existe outro cadastro com o mesmo nome ou documento nesta categoria.");
            return;
          }
          const { error } = await supabase
            .from("partners")
            .update({
              nome: nomeFinal || null,
              cpf: cpfFinal || null,
              contato: contato || null,
              email: email || null,
            })
            .eq("id", id)
            .eq("user_id", effectiveUserId());
          if (error) {
            const msg = error.message || "";
            if (/duplicate key|unique constraint|23505/i.test(msg)) {
              alert("Não foi possível gravar: nome ou documento duplicado.");
            } else {
              alert(msg);
            }
          }
          loadPartners();
        }
      });

      document.getElementById("viewFinanceiro").addEventListener("click", async (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;
        const id = button.getAttribute("data-id");
        const action = button.getAttribute("data-action");
        const baseKey = button.getAttribute("data-base-key");

        if (action === "cadastro-add-item") {
          const validKeys = new Set(CADASTRO_BASE_FIELDS.map((f) => f.key));
          if (!baseKey || !validKeys.has(baseKey)) return;
          const input = document.getElementById(`cadastroBaseInput_${baseKey}`);
          const value = String(input?.value || "").trim();
          if (!value) {
            alert("Informe um item para adicionar.");
            return;
          }
          const current = cadastroBaseMerged()[baseKey] || [];
          const next = cadastroBaseNormalizeList([...current, value]);
          const saved = cadastroBaseReadSaved();
          saved[baseKey] = next;
          cadastroBaseWriteSaved(saved);
          if (input) input.value = "";
          renderFinance();
          return;
        }

        if (action === "cadastro-remove-item") {
          const validKeys = new Set(CADASTRO_BASE_FIELDS.map((f) => f.key));
          if (!baseKey || !validKeys.has(baseKey)) return;
          const item = decodeURIComponent(button.getAttribute("data-base-item") || "");
          if (!item) return;
          const current = cadastroBaseMerged()[baseKey] || [];
          const next = current.filter((x) => x.toLowerCase() !== item.toLowerCase());
          const saved = cadastroBaseReadSaved();
          saved[baseKey] = cadastroBaseNormalizeList(next);
          cadastroBaseWriteSaved(saved);
          renderFinance();
          return;
        }

        if (action === "cadastro-reset-list") {
          const validKeys = new Set(CADASTRO_BASE_FIELDS.map((f) => f.key));
          if (!baseKey || !validKeys.has(baseKey)) return;
          const saved = cadastroBaseReadSaved();
          delete saved[baseKey];
          cadastroBaseWriteSaved(saved);
          renderFinance();
          return;
        }

        if (action === "cobrar-receber") {
          const receivable = state.receivables.find((r) => r.id === id);
          if (!receivable) return;
          openFinanceCobrancaModal(receivable);
          return;
        }

        if (action === "ver-comprovante") {
          const kind = button.getAttribute("data-kind");
          openFinanceAttachment(kind, id);
          return;
        }

        if (action === "cobranca") {
          const receivable = state.receivables.find((r) => r.id === id);
          if (!receivable) return;
          const texto = state.settings?.texto_cobranca || "Cobrança de diárias";
          const vehicle = state.vehicles.find((v) => v.id === receivable.vehicle_id);
          const vehicleInfo = vehicle
            ? `${vehicle.placa || "-"} • ${[vehicle.marca, vehicle.modelo].filter(Boolean).join(" ")}`
            : "-";
          const body = `${texto}\nResponsável: ${receivable.responsavel_pagamento || "-"}\nVeículo: ${vehicleInfo}\nValor: ${formatCurrency(
            receivable.valor
          )}`;
          openTextModal("Cobrança", body);
          return;
        }

        if (action === "nota") {
          const receivable = state.receivables.find((r) => r.id === id);
          if (!receivable) return;
          const vehicle = state.vehicles.find((v) => v.id === receivable.vehicle_id);
          if (!vehicle) return;
          openTextModal("Nota Fiscal", buildNfseText(vehicle));
          return;
        }

        if (action === "detalhes-receber") {
          const receivable = state.receivables.find((r) => r.id === id);
          if (!receivable) return;
          const vehicle = state.vehicles.find((v) => v.id === receivable.vehicle_id);
          const flags = financeReceberFlagsRead()[String(receivable.id)] || {};
          const mov = (state.cash || []).find((m) => m.tipo_conta === "RECEBER" && String(m.conta_id) === String(receivable.id));
          const opStatus = financeReceivableOperacionalStatus(receivable, toLocalYmd(new Date().toISOString()), flags);
          const texto = [
            `Nº cobrança: ${financeCobrancaNumero(receivable)}`,
            `Cliente: ${receivable.responsavel_pagamento || "-"}`,
            `Veículo: ${vehicle ? `${vehicle.placa || "-"} • ${[vehicle.marca, vehicle.modelo].filter(Boolean).join(" ")}` : "-"}`,
            `Valor: ${formatCurrency(Number(receivable.valor || 0))}`,
            `Status: ${opStatus.label}`,
            `Emissão: ${formatDate(receivable.period_end || receivable.created_at)}`,
            `Vencimento: ${formatDate(financeContaDueYmd(receivable, "receivable") || receivable.period_end || receivable.created_at)}`,
            receivable.status === "PAGO" && mov ? `Recebido em: ${formatDate(mov.data_movimento)} (${mov.forma_pagamento || "—"})` : null,
            flags.ultima_cobranca ? `Última cobrança: ${financeFormatUltimaCobranca(flags.ultima_cobranca)}` : null,
            `Período: ${formatDate(receivable.period_start)} até ${formatDate(receivable.period_end || receivable.created_at)}`,
            "",
            "--- Histórico ---",
          ]
            .filter((x) => x !== null)
            .join("\n");
          const auditRows = (financeAuditReadAll()[String(receivable.id)] || [])
            .map((e) => `${formatDate(e.at)} · ${e.action}${e.observacao ? ` · ${e.observacao}` : ""}`)
            .join("\n");
          openTextModal("Detalhes da cobrança", `${texto}\n${auditRows || "Sem histórico."}`);
          return;
        }

        if (action === "negociar-receber") {
          const receivable = state.receivables.find((r) => r.id === id);
          if (!receivable) return;
          const flags = financeReceberFlagsRead();
          const key = String(receivable.id);
          const curr = flags[key] || {};
          flags[key] = { ...curr, negociacao: !curr.negociacao };
          financeReceberFlagsWrite(flags);
          renderFinance();
          return;
        }

        if (action === "aplicar-desconto") {
          const receivable = state.receivables.find((r) => r.id === id);
          if (!receivable) return;
          const atual = Number(receivable.valor || 0);
          if (!(atual > 0)) {
            alert("Este registro já está zerado.");
            return;
          }
          const entrada = prompt(
            "Informe o valor do desconto (R$) ou digite ISENTO para isenção total.",
            ""
          );
          if (entrada == null) return;
          const raw = String(entrada).trim().toUpperCase();
          const isFullWaiver = raw === "ISENTO";
          const desconto = isFullWaiver ? atual : Number(raw.replace(",", "."));
          if (!isFullWaiver && (!Number.isFinite(desconto) || desconto <= 0)) {
            alert("Desconto inválido.");
            return;
          }
          const aplicado = Math.min(atual, Math.max(0, Number(desconto || 0)));
          const novoValor = Number((atual - aplicado).toFixed(2));
          const { error } = await supabase
            .from("receivables")
            .update({ valor: novoValor, status: novoValor === 0 ? "PAGO" : "EM_ABERTO" })
            .eq("id", receivable.id)
            .eq("user_id", effectiveUserId());
          if (error) {
            alert(error.message);
            return;
          }
          const flags = financeReceberFlagsRead();
          flags[String(receivable.id)] = {
            ...(flags[String(receivable.id)] || {}),
            isento: isFullWaiver,
            descontoAplicado: aplicado,
          };
          financeReceberFlagsWrite(flags);
          try {
            const userId = effectiveUserId();
            if (userId && receivable.vehicle_id && !FINANCE_MANUAL_ONLY) {
              await callFinanceCompetencyApi("/api/finance/close-vehicle-cycle", {
                userId,
                vehicleId: receivable.vehicle_id,
                discountAmount: aplicado,
                isFullWaiver,
              });
            }
          } catch (e) {
            console.warn("finance competency apply discount", e?.message || e);
          }
          await loadReceivables();
          renderFinance();
          updateDashboard();
          return;
        }

        if (action === "confirmar_triagem") {
          const receivable = state.receivables.find((r) => r.id === id);
          if (!receivable || !receivableNaFilaAguardandoTriagem(receivable)) {
            alert("Registo não encontrado ou já tratado. Atualize o financeiro.");
            return;
          }
          const tr = button.closest("tr");
          const nfEmitida = !!tr?.querySelector(".triagem-nf-emitida")?.checked;
          const pagamento = tr?.querySelector(".triagem-pagamento")?.value || "aguardando";
          const vehicle = state.vehicles.find((v) => v.id === receivable.vehicle_id);
          const valor = Number(receivable.valor || 0);
          const closure = (state.cycleClosures || []).find(
            (c) => String(c.receivable_id) === String(id) && !c.sent_to_finance
          );
          if (closure?.id) {
            const { error: cloErr } = await supabase
              .from("patio_cycle_closures")
              .update({
                nf_emitida: nfEmitida,
                triagem_ok: true,
                sent_to_finance: true,
                triaged_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("id", closure.id)
              .eq("user_id", effectiveUserId());
            if (cloErr && !isMissingRelationError(cloErr)) {
              console.warn("patio_cycle_closures triagem", cloErr);
            }
          }
          if (nfEmitida && vehicle?.id && vehicle.nfse_status !== "EMITIDA") {
            await supabase
              .from("vehicles")
              .update({ nfse_status: "EMITIDA", nfse_issued_at: new Date().toISOString() })
              .eq("id", vehicle.id)
              .eq("user_id", effectiveUserId());
          }
          if (pagamento === "pago") {
            if (valor <= 0) {
              alert("Valor inválido para registo de pagamento.");
              return;
            }
            const patchPago = { financeiro_aprovado_contas_receber: true };
            const { error: preErr } = await supabase
              .from("receivables")
              .update(patchPago)
              .eq("id", id)
              .eq("user_id", effectiveUserId());
            if (preErr && !/financeiro_aprovado|column|schema cache|PGRST204/i.test(preErr.message || "")) {
              alert(preErr.message);
              return;
            }
            addReceberTriagemId(id);
            const result = await finalizeReceivablePayment(id, valor);
            if (!result) return;
            await Promise.all([loadReceivables(), loadCycleClosures(), loadCash(), loadVehicles()]);
            renderFinance();
            updateDashboard();
            alert("Cobrança concluída. Pagamento registrado.");
            return;
          }
          const patch = { financeiro_aprovado_contas_receber: true };
          if (receivable.status === RECEIVABLE_AGUARDANDO_LANCAMENTO) {
            patch.status = "EM_ABERTO";
          }
          const { error } = await supabase.from("receivables").update(patch).eq("id", id).eq("user_id", effectiveUserId());
          if (error) {
            const colMissing = /financeiro_aprovado|column|schema cache|PGRST204/i.test(error.message || "");
            if (colMissing && receivable.status === RECEIVABLE_AGUARDANDO_LANCAMENTO) {
              const { error: err2 } = await supabase
                .from("receivables")
                .update({ status: "EM_ABERTO" })
                .eq("id", id)
                .eq("user_id", effectiveUserId());
              if (err2) {
                alert(err2.message);
                return;
              }
            } else if (colMissing && receivable.status === "EM_ABERTO") {
              /* coluna ainda não criada: só marca local */
            } else {
              alert(error.message);
              return;
            }
          }
          addReceberTriagemId(id);
          financeAuditAppend(id, "Cobrança gerada", { note: pagamento === "pago" ? "Com pagamento imediato" : "Aguardando Pagamento" });
          await Promise.all([loadReceivables(), loadCycleClosures(), loadVehicles()]);
          renderFinance();
          updateDashboard();
          alert("Cobrança gerada. Registro enviado para Contas a Receber com status Aguardando Pagamento.");
          return;
        }

        if (action === "detalhes-calculo-faturamento") {
          const receivable = state.receivables.find((r) => r.id === id);
          if (!receivable) return;
          const vehicle = state.vehicles.find((v) => v.id === receivable.vehicle_id);
          const bodyEl = document.getElementById("financeCalculoDetalheBody");
          const histEl = document.getElementById("financeCalculoDetalheHistorico");
          if (bodyEl) bodyEl.innerHTML = renderFinanceCalculoDetalheHtml(receivable, vehicle);
          if (histEl) {
            histEl.innerHTML = `<h5 style="margin:8px 0;font-size:0.92rem">Histórico</h5>${financeAuditHtml(receivable.id)}`;
          }
          document.getElementById("financeCalculoDetalheModal")?.classList.remove("hidden");
          return;
        }

        if (action === "gerar-fatura-faturamento") {
          const receivable = state.receivables.find((r) => r.id === id);
          if (!receivable) return;
          const vehicle = state.vehicles.find((v) => v.id === receivable.vehicle_id);
          if (!vehicle) {
            alert("Veículo não encontrado para gerar fatura.");
            return;
          }
          const tr = button.closest("tr");
          const nfEmitida = !!tr?.querySelector(".triagem-nf-emitida")?.checked;
          if (nfEmitida && vehicle.nfse_status !== "EMITIDA") {
            await supabase
              .from("vehicles")
              .update({ nfse_status: "EMITIDA", nfse_issued_at: new Date().toISOString() })
              .eq("id", vehicle.id)
              .eq("user_id", effectiveUserId());
          }
          financeAuditAppend(id, "Fatura gerada/visualizada", { note: nfEmitida ? "NF marcada como emitida" : "Preview de NF" });
          openTextModal("Nota Fiscal / Fatura", buildNfseText(vehicle));
          return;
        }

        if (action === "lancar_conta") {
          const receivable = state.receivables.find((r) => r.id === id);
          if (!receivable || !receivableNaFilaAguardandoTriagem(receivable)) {
            alert("Registo não encontrado ou já tratado. Atualize o financeiro.");
            return;
          }
          const patch = { financeiro_aprovado_contas_receber: true };
          if (receivable.status === RECEIVABLE_AGUARDANDO_LANCAMENTO) {
            patch.status = "EM_ABERTO";
          }
          const { error } = await supabase.from("receivables").update(patch).eq("id", id).eq("user_id", effectiveUserId());
          if (error) {
            const colMissing = /financeiro_aprovado|column|schema cache|PGRST204/i.test(error.message || "");
            if (colMissing && receivable.status === RECEIVABLE_AGUARDANDO_LANCAMENTO) {
              const { error: err2 } = await supabase
                .from("receivables")
                .update({ status: "EM_ABERTO" })
                .eq("id", id)
                .eq("user_id", effectiveUserId());
              if (err2) {
                alert(err2.message);
                return;
              }
            } else if (colMissing && receivable.status === "EM_ABERTO") {
              /* coluna ainda não criada: só marca local */
            } else {
              alert(error.message);
              return;
            }
          }
          addReceberTriagemId(id);
          await Promise.all([loadReceivables(), loadCycleClosures()]);
          renderFinance();
          updateDashboard();
          return;
        }

        if (action === "receber_aguardando") {
          const receivable = state.receivables.find((r) => r.id === id);
          if (!receivable || !receivableNaFilaAguardandoTriagem(receivable)) {
            alert("Registo não encontrado ou já lançado. Atualize o financeiro.");
            return;
          }
          const valorPago = Number(receivable.valor || 0);
          if (valorPago <= 0) {
            alert("Valor inválido para registo de pagamento.");
            return;
          }
          const vehicle = state.vehicles.find((v) => v.id === receivable.vehicle_id);
          openReceberBaixaModal({ receivable, vehicle, valor: valorPago });
          return;
        }

        if (action === "recibo") {
          const receivable = state.receivables.find((r) => r.id === id);
          if (!receivable || receivable.status !== "PAGO") {
            alert("Só é possível emitir recibo de recebimentos já pagos.");
            return;
          }
          const vehicle = state.vehicles.find((v) => v.id === receivable.vehicle_id);
          const mov = (state.cash || []).find(
            (m) => m.tipo_conta === "RECEBER" && String(m.conta_id) === String(id)
          );
          openReciboModalWithContext({
            receivable,
            vehicle: vehicle || null,
            valor: Number(mov?.valor || receivable.valor || 0),
          });
          return;
        }

        if (action === "receber") {
          const receivable = state.receivables.find((r) => r.id === id);
          if (!receivable) {
            alert("Recebimento não encontrado. Atualize a página (Financeiro) e tente de novo.");
            return;
          }
          if (!receivableIsContaReceberFinanceiro(receivable)) {
            alert(
              "Este registro ainda não está na aba «Receber». Se o ciclo acabou de sair do pátio, confirme o OK em «Fechando ciclo»."
            );
            return;
          }
          const totalAtual = Number(receivable.valor || 0);
          if (totalAtual <= 0) {
            alert("Valor inválido para recebimento. Confira o valor do ciclo ou atualize os dados do veículo.");
            return;
          }
          const vehicle = state.vehicles.find((v) => v.id === receivable.vehicle_id);
          openReceberBaixaModal({ receivable, vehicle, valor: totalAtual });
          return;
        }

        if (action === "editar-receber") {
          const receivable = state.receivables.find((r) => r.id === id);
          if (!receivable || receivable.status === "PAGO") return;
          if (!isManualFinanceLancamento(receivable)) {
            alert("Só é possível editar títulos manuais.");
            return;
          }
          openFinanceContaEditModal({ kind: "receivable", record: receivable });
          return;
        }

        if (action === "pagar") {
          const payable = state.payables.find((p) => p.id === id);
          if (!payable) return;
          openPagarBaixaModal(payable);
          return;
        }

        if (action === "nova-despesa") {
          openLancamentoModal("DESPESA");
          return;
        }

        if (action === "editar-despesa") {
          const payable = state.payables.find((p) => p.id === id);
          if (!payable || payable.status === "PAGO") return;
          openFinanceContaEditModal({ kind: "payable", record: payable });
          return;
        }

        if (action === "apagar-despesa") {
          if (!confirm("Excluir esta despesa?")) return;
          const { error } = await supabase.from("payables").delete().eq("id", id).eq("user_id", effectiveUserId());
          if (error) alert(error.message);
          await loadPayables();
          renderFinance();
        }

        if (action === "editar-conta-receber") {
          const receivable = state.receivables.find((r) => r.id === id);
          if (!receivable) {
            alert("Registo não encontrado. Atualize o financeiro.");
            return;
          }
          if (receivable.status === "PAGO") {
            alert("Este recebimento já está quitado. Use «Histórico de recebimentos» para ajustar.");
            return;
          }
          const emContaReceber = receivableIsContaReceberFinanceiro(receivable);
          const naFilaAguardando = receivableNaFilaAguardandoTriagem(receivable);
          if (!emContaReceber && !naFilaAguardando) {
            alert(
              "É possível editar ciclos somente na aba «Receber» (ainda não pagos). Atualize o financeiro."
            );
            return;
          }
          const vehicle = receivable.vehicle_id
            ? state.vehicles.find((v) => v.id === receivable.vehicle_id)
            : null;

          const responsavel = prompt("Responsável pelo pagamento:", receivable.responsavel_pagamento || "");
          if (responsavel === null) return;

          const catOptions = SERVICOS_RECEITAS.map((c) => `${c.value} — ${c.label}`).join("\n");
          const catRaw = prompt(
            `Serviço (código — nome):\n${catOptions}\n\nInforme o código:`,
            receivable.receivable_category || "GUARDA_PATIO"
          );
          if (catRaw === null) return;
          const receivable_category = catRaw.trim() || "GUARDA_PATIO";

          const inicioInput = await openDateModal({
            title: "Início do período de cobrança",
            label: "Data e hora inicial",
            type: "datetime-local",
            value: toLocalInput(receivable.period_start || receivable.created_at),
          });
          if (!inicioInput) return;
          const inicioMs = new Date(inicioInput).getTime();
          if (Number.isNaN(inicioMs)) {
            alert("Data/hora inicial inválida.");
            return;
          }
          const period_start = new Date(inicioInput).toISOString();

          const fimDefault = receivable.period_end || vehicle?.data_saida || "";
          const fimInput = await openDateModal({
            title: "Fim do período de cobrança",
            label: "Data e hora final",
            type: "datetime-local",
            value: fimDefault ? toLocalInput(fimDefault) : "",
          });
          if (!fimInput) return;
          const fimMs = new Date(fimInput).getTime();
          if (Number.isNaN(fimMs)) {
            alert("Data/hora final inválida.");
            return;
          }
          const period_end = new Date(fimInput).toISOString();
          if (fimMs < inicioMs) {
            alert("A data final deve ser posterior ou igual à inicial.");
            return;
          }

          const podeRecalc = !!(vehicle && Number(vehicle.valor_diaria) > 0);
          let numValor;
          if (podeRecalc) {
            numValor = calcPeriodTotal(vehicle, period_start, period_end);
          } else {
            const valorStr = prompt(
              "Valor (R$) — não foi possível recalcular automaticamente (veículo sem diária ou sem ligação). Indique manualmente:",
              String(receivable.valor ?? "")
            );
            if (valorStr === null) return;
            numValor = Number(String(valorStr).trim().replace(",", "."));
            if (!Number.isFinite(numValor) || numValor < 0) {
              alert("Valor inválido.");
              return;
            }
          }

          const { error } = await supabase
            .from("receivables")
            .update({
              responsavel_pagamento: responsavel.trim() || null,
              receivable_category,
              period_start,
              period_end,
              valor: numValor,
            })
            .eq("id", id)
            .eq("user_id", effectiveUserId());
          if (error) {
            alert(error.message);
            return;
          }
          await Promise.all([loadReceivables(), loadCycleClosures()]);
          renderFinance();
          updateDashboard();
          return;
        }

        if (action === "editar-recebido") {
          const receivable = state.receivables.find((r) => r.id === id);
          if (!receivable) return;
          const responsavel = prompt("Responsável pelo pagamento:", receivable.responsavel_pagamento || "");
          const valor = prompt("Valor:", receivable.valor || "");
          const numValor = Number(valor || 0);
          const { error } = await supabase
            .from("receivables")
            .update({
              responsavel_pagamento: responsavel || null,
              valor: numValor,
            })
            .eq("id", id)
            .eq("user_id", effectiveUserId());
          if (error) {
            alert(error.message);
            return;
          }
          if (receivable.status === "PAGO") {
            await supabase
              .from("cash_movements")
              .update({ valor: numValor })
              .eq("conta_id", id)
              .eq("tipo_conta", "RECEBER")
              .eq("user_id", effectiveUserId());
          }
          await Promise.all([loadReceivables(), loadCash()]);
          renderFinance();
          return;
        }

        if (action === "apagar-recebido") {
          if (!confirm("Excluir este recebimento?")) return;
          const { error } = await supabase.from("receivables").delete().eq("id", id).eq("user_id", effectiveUserId());
          if (error) {
            alert(error.message);
            return;
          }
          removeReceberTriagemId(id);
          await supabase
            .from("cash_movements")
            .delete()
            .eq("conta_id", id)
            .eq("tipo_conta", "RECEBER")
            .eq("user_id", effectiveUserId());
          await Promise.all([loadReceivables(), loadCash()]);
          renderFinance();
          updateDashboard();
          return;
        }

        if (action === "conciliar-caixa") {
          const mov = state.cash.find((m) => String(m.id) === String(id));
          if (!mov) {
            alert("Lançamento de caixa não encontrado.");
            return;
          }
          const descricaoAtual = String(mov.descricao || "").trim();
          const base = descricaoAtual ? descricaoAtual.replace(/\s*\[CONCILIADO\]\s*$/i, "").trim() : "Recebimento conciliado";
          const novaDescricao = `${base} [CONCILIADO]`;
          const { error } = await supabase
            .from("cash_movements")
            .update({ descricao: novaDescricao })
            .eq("id", mov.id)
            .eq("user_id", effectiveUserId());
          if (error) {
            alert(error.message);
            return;
          }
          await loadCash();
          renderFinance();
          updateDashboard();
          return;
        }

        if (action === "estornar-caixa") {
          const mov = state.cash.find((m) => String(m.id) === String(id));
          if (!mov || mov.tipo_conta !== "RECEBER" || !mov.conta_id) {
            alert("Movimento inválido para estorno.");
            return;
          }
          if (!confirm("Estornar este recebimento? O valor volta para a aba Receber.")) return;
          const { error: delErr } = await supabase
            .from("cash_movements")
            .delete()
            .eq("id", mov.id)
            .eq("user_id", effectiveUserId());
          if (delErr) {
            alert(delErr.message);
            return;
          }
          const { error: upErr } = await supabase
            .from("receivables")
            .update({ status: "EM_ABERTO", financeiro_aprovado_contas_receber: false })
            .eq("id", mov.conta_id)
            .eq("user_id", effectiveUserId());
          if (upErr) {
            const { error: upFallback } = await supabase
              .from("receivables")
              .update({ status: "EM_ABERTO" })
              .eq("id", mov.conta_id)
              .eq("user_id", effectiveUserId());
            if (upFallback) {
              alert(upFallback.message);
              return;
            }
          }
          await Promise.all([loadReceivables(), loadCash()]);
          renderFinance();
          updateDashboard();
          return;
        }

        if (action === "voltar-caixa-receber") {
          const mov = state.cash.find((m) => String(m.id) === String(id));
          if (!mov || mov.tipo_conta !== "RECEBER" || !mov.conta_id) {
            alert("Movimento inválido ou já atualizado. Atualize o financeiro.");
            return;
          }
          const receivable = state.receivables.find((r) => r.id === mov.conta_id);
          if (!receivable || receivable.status !== "PAGO") {
            alert("Este lançamento já não está ligado a um recebimento quitado. Atualize a página.");
            return;
          }
          if (
            !confirm(
              "Desfazer este lançamento no caixa e voltar o título para «Receber» em aberto? O movimento de entrada será apagado."
            )
          )
            return;
          const { error: delErr } = await supabase
            .from("cash_movements")
            .delete()
            .eq("id", mov.id)
            .eq("user_id", effectiveUserId());
          if (delErr) {
            alert(delErr.message);
            return;
          }
          const { error: upErr } = await supabase
            .from("receivables")
            .update({ status: "EM_ABERTO", financeiro_aprovado_contas_receber: false })
            .eq("id", receivable.id)
            .eq("user_id", effectiveUserId());
          if (upErr) {
            const { error: upFallback } = await supabase
              .from("receivables")
              .update({ status: "EM_ABERTO" })
              .eq("id", receivable.id)
              .eq("user_id", effectiveUserId());
            if (upFallback) {
              alert(upFallback.message);
              await loadCash();
              renderFinance();
              return;
            }
          }
          if (receivable.vehicle_id) {
            const outroPagoMesmoVeiculo = state.receivables.some(
              (r) =>
                r.vehicle_id === receivable.vehicle_id &&
                r.id !== receivable.id &&
                r.status === "PAGO"
            );
            if (!outroPagoMesmoVeiculo) {
              const { error: vErr } = await supabase
                .from("vehicles")
                .update({ payment_status: "EM_ABERTO" })
                .eq("id", receivable.vehicle_id)
                .eq("user_id", effectiveUserId());
              if (vErr) console.warn("voltar_caixa_vehicle_payment_status", vErr);
            }
          }
          await Promise.all([loadReceivables(), loadCash(), loadVehicles()]);
          renderFinance();
          updateDashboard();
          return;
        }

        if (action === "editar-pago") {
          const payable = state.payables.find((p) => p.id === id);
          if (!payable) return;
          const descricao = prompt("Descrição:", payable.descricao || "");
          const valor = prompt("Valor:", payable.valor || "");
          const data = await openDateModal({
            title: "Data do pagamento",
            label: "Data",
            type: "date",
            value: payable.data_vencimento || "",
          });
          if (!data) return;
          const { error } = await supabase
            .from("payables")
            .update({ descricao: descricao || null, valor: Number(valor || 0), data_vencimento: data || null })
            .eq("id", id)
            .eq("user_id", effectiveUserId());
          if (error) {
            alert(error.message);
            return;
          }
          await loadPayables();
          renderFinance();
          return;
        }

        if (action === "apagar-pago") {
          if (!confirm("Excluir este pagamento?")) return;
          const { error } = await supabase.from("payables").delete().eq("id", id).eq("user_id", effectiveUserId());
          if (error) {
            alert(error.message);
            return;
          }
          await supabase
            .from("cash_movements")
            .delete()
            .eq("conta_id", id)
            .eq("tipo_conta", "PAGAR")
            .eq("user_id", effectiveUserId());
          await Promise.all([loadPayables(), loadCash()]);
          renderFinance();
          updateDashboard();
          return;
        }
      });

      /** Fecha só o painel suspenso; mantém `<details>` abertos até mudar de módulo em `showMainView`. */
      function closeAppHeaderMenu() {
        const b = document.getElementById("appHeaderMenuBtn");
        const p = document.getElementById("appHeaderMenu");
        const bd = document.getElementById("appHeaderMenuBackdrop");
        b?.setAttribute("aria-expanded", "false");
        p?.classList.add("hidden");
        bd?.classList.add("hidden");
      }

      function openAppHeaderMenu() {
        const b = document.getElementById("appHeaderMenuBtn");
        const p = document.getElementById("appHeaderMenu");
        const bd = document.getElementById("appHeaderMenuBackdrop");
        b?.setAttribute("aria-expanded", "true");
        p?.classList.remove("hidden");
        bd?.classList.remove("hidden");
      }

      function toggleAppHeaderMenu(e) {
        if (e) e.stopPropagation();
        const p = document.getElementById("appHeaderMenu");
        if (p?.classList.contains("hidden")) openAppHeaderMenu();
        else closeAppHeaderMenu();
      }

      function navigateMainViewFromNav(view) {
        if (!view) return;
        if (view === "dashboard") {
          navStack.splice(0, navStack.length, "dashboard");
          showMainView("dashboard");
          setPatioView("dashboard");
          setPartnerView("none");
          setFinanceView("none");
          return;
        }
        openMainView(view);
      }

      function syncHeaderMenuHighlightFromDom() {
        const order = ["dashboard", "patio", "parceiros", "financeiro", "lista", "configuracoes"];
        for (const name of order) {
          const el = views[name];
          if (el && !el.classList.contains("hidden")) {
            lastAppHeaderModuleView = name;
            syncHeaderMenuModuleHighlight(name);
            return;
          }
        }
      }

      document.querySelectorAll('[data-close-stack="true"]').forEach((btn) => {
        btn.addEventListener("click", closeStackTop);
      });

      document.getElementById("appHeaderMenuBtn")?.addEventListener("click", toggleAppHeaderMenu);
      document.getElementById("appHeaderMenuBackdrop")?.addEventListener("click", () => closeAppHeaderMenu());
      document.querySelectorAll("#appHeaderMenu > .header-menu-details").forEach((det) => {
        det.addEventListener("toggle", () => {
          if (!det.open) return;
          document.querySelectorAll("#appHeaderMenu > .header-menu-details").forEach((o) => {
            if (o !== det) o.open = false;
          });
        });
      });
      document.getElementById("appHeaderMenu")?.addEventListener("click", (e) => {
        const dashBtn = e.target.closest("#appHeaderMenu > button[data-view]");
        if (dashBtn) {
          e.preventDefault();
          closeAppHeaderMenu();
          navigateMainViewFromNav(dashBtn.getAttribute("data-view"));
          return;
        }

        const listaHdr = e.target.closest("#appHeaderMenu [data-lista-subview]");
        if (listaHdr) {
          e.preventDefault();
          const sub = listaHdr.getAttribute("data-lista-subview");
          openMainView("lista");
          openListaSubview(sub);
          closeAppHeaderMenu();
          return;
        }

        const patioSub = e.target.closest("[data-header-patio-sub]");
        if (patioSub) {
          e.preventDefault();
          if (normalizePlateSearch(plateQuery)) {
            if (plateFilter) plateFilter.value = "";
            plateQuery = "";
            setPlateSearchHints("", false);
            renderVehicles();
          }
          openPatioSubview(patioSub.getAttribute("data-header-patio-sub"));
          closeAppHeaderMenu();
          return;
        }

        const patioAct = e.target.closest("[data-header-patio]");
        if (patioAct && !patioAct.hasAttribute("data-header-patio-sub")) {
          e.preventDefault();
          const k = patioAct.getAttribute("data-header-patio");
          const onPatio =
            navStack[navStack.length - 1] === "patio" ||
            (typeof navStack[navStack.length - 1] === "string" && navStack[navStack.length - 1].startsWith("patio:"));
          if (!onPatio) openMainView("patio");
          else showMainView("patio");
          if (k === "new-vehicle") openVehicleModal("create");
          closeAppHeaderMenu();
          return;
        }

        const partnerSub = e.target.closest("[data-header-partner-sub]");
        if (partnerSub) {
          e.preventDefault();
          openPartnerSubview(partnerSub.getAttribute("data-header-partner-sub"));
          closeAppHeaderMenu();
          return;
        }

        const finPanel = e.target.closest("[data-header-finance-panel]");
        if (finPanel) {
          e.preventDefault();
          closeFinanceMenu();
          closeAppHeaderMenu();
          openFinanceSubview(finPanel.getAttribute("data-header-finance-panel") || "inicio");
          return;
        }

        const finSub = e.target.closest("[data-header-finance-sub]");
        if (finSub) {
          e.preventDefault();
          closeFinanceMenu();
          openFinanceSubview(finSub.getAttribute("data-header-finance-sub"));
          closeAppHeaderMenu();
          return;
        }

        const finAct = e.target.closest("[data-header-finance-action]");
        if (finAct) {
          e.preventDefault();
          const id = finAct.getAttribute("data-header-finance-action");
          closeFinanceMenu();
          openMainView("financeiro");
          document.getElementById(id)?.click();
          closeAppHeaderMenu();
          return;
        }

        const cfgSub = e.target.closest("[data-header-config-sub]");
        if (cfgSub) {
          e.preventDefault();
          openMainView("configuracoes");
          setConfigSubview(cfgSub.getAttribute("data-header-config-sub"));
          closeAppHeaderMenu();
          return;
        }
      });
      document.getElementById("appHeaderMenuLogout")?.addEventListener("click", () => {
        closeAppHeaderMenu();
        logoutBtn?.click();
      });
      document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        const p = document.getElementById("appHeaderMenu");
        if (!p || p.classList.contains("hidden")) return;
        closeAppHeaderMenu();
      });
      document.addEventListener("click", (e) => {
        const p = document.getElementById("appHeaderMenu");
        const wrap = document.getElementById("appHeaderMenuWrap");
        if (!p || !wrap || wrap.classList.contains("hidden") || p.classList.contains("hidden")) return;
        if (wrap.contains(e.target)) return;
        closeAppHeaderMenu();
      });

      bootstrap();
      setPatioView("inicio");
      setFinanceView("none");
      setPartnerView("none");
      syncHeaderMenuHighlightFromDom();
    
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
  let financeFilterAguardandoPeriodo = "";
  let financeFilterAguardandoDataDe = "";
  let financeFilterAguardandoDataAte = "";
  let financeFilterAguardandoRppId = "";
  let financeFilterReceberDataDe = "";
  let financeFilterReceberDataAte = "";
  let financeFilterReceberPlaca = "";
  let financeFilterReceberRppId = "";
  let financeFilterCaixaDataDe = "";
  let financeFilterCaixaDataAte = "";
  let financeFilterCaixaPlaca = "";
  let financeFilterCaixaRppId = "";
  /** "" | "entrada" | "saida" */
  let financeFilterCaixaTipo = "";
  const financeRowSelection = {
    aguardando: new Set(),
    receber: new Set(),
    pagar: new Set(),
  };
  let financeBatchConfirmContext = null;
  let refreshFinanceDataPromise = null;
  let finCadastroTipo = "PRESTADOR";
  let finCadastroBusca = "";
  let finContactEditingId = null;

  const FINANCE_ORIGEM_MODULO_LABELS = {
    CONTROLE_RECEITAS: "Controle de receitas",
    CONTROLE_DESPESAS: "Controle de despesas",
    PATIO_VRP: "Pátio (VRP)",
  };

  function financeCanLoadData() {
    return typeof effectiveUserId === "function" && !!effectiveUserId() && !!supabase;
  }

  function financeRoot() {
    return document.getElementById("viewFinanceiro");
  }

  function financeTodayYmd() {
    return toLocalYmd(new Date().toISOString());
  }

  /** Mês marco do caixa (gravado em settings.caixa_reset_ym após o reset). */
  function financeGetCaixaResetYm() {
    const ym = state.settings?.caixa_reset_ym;
    return ym && /^\d{4}-\d{2}$/.test(String(ym)) ? String(ym) : "";
  }

  function financeCaixaResetActive() {
    return !!financeGetCaixaResetYm();
  }

  const FINANCE_MANUAL_CAIXA_RESET_YM = "MANUAL_CAIXA_V1";

  /** Modo caixa manual (Opção 1): só aprovado_caixa=true impacta saldo e relatórios. */
  function financeOperationalModeActive() {
    return (
      state.settings?.finance_manual_caixa_mode === true ||
      state.settings?.caixa_reset_ym === FINANCE_MANUAL_CAIXA_RESET_YM ||
      !!state.settings?.caixa_operational_reset_at
    );
  }

  function financeCashMetaFromDescricao(descricao) {
    const raw = String(descricao || "");
    if (!raw.startsWith(FINANCE_META_PREFIX_LOCAL)) return { meta: {}, text: raw };
    const end = raw.indexOf("]]");
    if (end < 0) return { meta: {}, text: raw };
    try {
      return { meta: JSON.parse(raw.slice(FINANCE_META_PREFIX_LOCAL.length, end)), text: raw.slice(end + 2).trim() };
    } catch {
      return { meta: {}, text: raw };
    }
  }

  function financeCashAprovadoFromMov(mov) {
    if (!mov) return false;
    if (mov.aprovado_caixa === true) return true;
    return financeCashMetaFromDescricao(mov.descricao).meta.aprovado_caixa === true;
  }

  function financeCashExcluirFromMov(mov) {
    if (!mov) return false;
    if (mov.excluir_do_saldo === true) return true;
    return financeCashMetaFromDescricao(mov.descricao).meta.excluir_do_saldo === true;
  }

  function financeCaixaOpeningBalance() {
    if (!financeOperationalModeActive()) return 0;
    return Number(state.settings?.caixa_opening_balance || 0);
  }

  function financeCashMovIsLegacyNeutralized(mov) {
    if (!mov) return false;
    if (financeCashExcluirFromMov(mov)) return true;
    return !financeCashAprovadoFromMov(mov);
  }

  /** Movimentação aprovada para o caixa operacional (APROVADO_CAIXA). */
  function financeCashAprovadoCaixa(mov) {
    if (!mov) return false;
    if (financeCashExcluirFromMov(mov)) return false;
    if (financeOperationalModeActive()) return financeCashAprovadoFromMov(mov);
    return !financeCashMovIsLegacyNeutralized(mov);
  }

  /** Histórico bruto (não usar na listagem operacional do Caixa). */
  function financeCaixaMovsHistorico() {
    return financeDedupeCaixaMovs((state.cash || []).filter((m) => financeMovInCaixaWindow(m)));
  }

  /** Todas as movimentações entram na lista de histórico (auditoria). */
  function financeMovInCaixaWindow(mov) {
    return !!mov;
  }

  function financeReceivableInCaixaWindow(r) {
    if (!r || String(r.status || "").toUpperCase() !== "PAGO") return false;
    return Number(r.valor || 0) > 0;
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

  const FINANCE_META_PREFIX_LOCAL = "[[finmeta:";

  function financeMetaUnpackLocal(obs) {
    const raw = String(obs || "");
    if (!raw.startsWith(FINANCE_META_PREFIX_LOCAL)) return { meta: {}, text: raw };
    const end = raw.indexOf("]]");
    if (end < 0) return { meta: {}, text: financeStripFinmeta(raw) };
    const jsonPart = raw.slice(FINANCE_META_PREFIX_LOCAL.length, end);
    const text = raw.slice(end + 2).trim();
    try {
      return { meta: JSON.parse(jsonPart), text };
    } catch {
      return { meta: {}, text: financeStripFinmeta(raw) };
    }
  }

  /** Texto humano depois do bloco [[finmeta:{...}]] (ex.: Zera caixa). */
  function financeTextAfterFinmeta(s) {
    const str = String(s || "").trim();
    if (!str.includes(FINANCE_META_PREFIX_LOCAL)) return str;
    const lastEnd = str.lastIndexOf("]]");
    if (lastEnd >= 0) {
      const tail = str.slice(lastEnd + 2).trim();
      if (tail && !tail.includes(FINANCE_META_PREFIX_LOCAL)) return tail;
    }
    let raw = str;
    while (raw.includes(FINANCE_META_PREFIX_LOCAL)) {
      const start = raw.indexOf(FINANCE_META_PREFIX_LOCAL);
      const end = raw.indexOf("]]", start);
      if (end < 0) break;
      raw = (raw.slice(0, start) + raw.slice(end + 2)).trim();
    }
    return raw;
  }

  function financeStripFinmeta(s) {
    return financeTextAfterFinmeta(s);
  }

  /** Nunca exibir [[finmeta:...]] na UI. */
  function financeDisplaySafeText(s) {
    const t = financeTextAfterFinmeta(s);
    if (!t || t.includes(FINANCE_META_PREFIX_LOCAL)) return "—";
    return t;
  }

  function financeNormalizeQuemPagouText(value) {
    const clean = financeDisplaySafeText(value);
    if (!clean || clean === "—") return "—";
    const tabChunk =
      clean
        .split(/\t+/)
        .map((p) => p.trim())
        .find(Boolean) || clean;
    const dashChunk =
      tabChunk
        .split(/\s*—\s*/)
        .map((p) => p.trim())
        .find(Boolean) || tabChunk;
    return dashChunk || "—";
  }

  function financeLooksLikeMetaNoise(value) {
    const t = String(value || "");
    return /\[\[finmeta|^\s*\{.*\}\s*$|origem_modulo|competencia|forma_pagamento/i.test(t);
  }

  /** Caixa — coluna Pagante: só quem pagou (origem), sem JSON. */
  function financeQuemPagouCaixa(mov, rec) {
    rec = rec || financeFindReceivableForMov(mov);
    if (rec) {
      const t = financeReceivableTypedFields(rec);
      if (t.origem && t.origem !== "—") return financeNormalizeQuemPagouText(t.origem);
    }
    if (rec?.vehicle_id) {
      const v = financeVehicleById().get(rec.vehicle_id);
      const rpp = financeReceberRppNome(rec, v);
      if (rpp && rpp !== "—" && !String(rpp).includes(FINANCE_META_PREFIX_LOCAL)) {
        return financeNormalizeQuemPagouText(rpp);
      }
      if (v?.placa) return financeNormalizeQuemPagouText(v.placa);
    }
    for (const src of [rec?.responsavel_pagamento, rec?.observacoes, mov?.descricao]) {
      const nome = financeTextAfterFinmeta(src);
      if (!nome || nome.includes(FINANCE_META_PREFIX_LOCAL)) continue;
      return financeNormalizeQuemPagouText(nome);
    }
    return financeNormalizeQuemPagouText(mov?.descricao);
  }

  /** Caixa — coluna Descrição (texto digitado, não quem pagou). */
  function financeCaixaDescricaoEntrada(mov, rec) {
    rec = rec || financeFindReceivableForMov(mov);
    if (rec && financeIsManualReceivable(rec)) {
      const t = financeReceivableTypedFields(rec);
      if (t.descricao && t.descricao !== "—") return t.descricao;
      return financeDisplaySafeText(mov?.descricao) || "—";
    }
    const v = rec?.vehicle_id ? financeVehicleById().get(rec.vehicle_id) : null;
    const desc = financeDisplaySafeText(mov?.descricao);
    if (desc && desc !== "—") return desc;
    if (v?.placa) return `Diárias — ${v.placa}`;
    return "—";
  }


  function financeIsManualReceivable(r) {
    if (!r) return false;
    if (typeof isManualFinanceLancamento === "function") return isManualFinanceLancamento(r);
    if (String(r.subcategoria || "").toUpperCase() === "MANUAL") return true;
    return r.vehicle_id == null || r.vehicle_id === "";
  }

  function financeFindReceivableForMov(mov) {
    if (!mov?.conta_id) return null;
    const id = String(mov.conta_id);
    const list = state.receivables || [];
    let rec = list.find((r) => String(r.id) === id);
    if (rec) return rec;
    const descClean = financeStripFinmeta(mov.descricao);
    if (!descClean) return null;
    return (
      list.find((r) => financeStripFinmeta(r.responsavel_pagamento) === descClean) ||
      list.find((r) => financeReceivableOrigemDescricao(r).origem === descClean) ||
      null
    );
  }

  function financeReceivableLabel(r) {
    if (!r) return "—";
    if (typeof financeReceivableDisplayText === "function") {
      const t = financeReceivableDisplayText(r);
      if (t && t !== "—" && !String(t).startsWith(FINANCE_META_PREFIX_LOCAL)) return t;
    }
    const raw =
      typeof financeReceivableMetaText === "function"
        ? financeReceivableMetaText(r)
        : r?.observacoes || r?.responsavel_pagamento || "";
    const unpack =
      typeof financeMetaUnpack === "function" ? financeMetaUnpack(raw) : financeMetaUnpackLocal(raw);
    const clean = String(unpack.text || "").trim();
    if (clean && !clean.startsWith(FINANCE_META_PREFIX_LOCAL)) return clean;
    return financeStripFinmeta(raw) || "—";
  }

  /** Campos digitados no formulário (receita sem veículo) — sem finmeta nem rótulos do sistema. */
  function financeReceivableTypedFields(r) {
    if (!r) return { origem: "—", descricao: "—", rpp: "—", observacoes: "" };
    const raw =
      typeof financeReceivableMetaText === "function"
        ? financeReceivableMetaText(r)
        : r?.observacoes || r?.responsavel_pagamento || "";
    const unpack =
      typeof financeMetaUnpack === "function" ? financeMetaUnpack(raw) : financeMetaUnpackLocal(raw);
    const meta = unpack.meta || {};
    let origem = financeDisplaySafeText(meta.origem_texto || "");
    let descricao = financeDisplaySafeText(meta.descricao_texto || "");
    let rpp = financeDisplaySafeText(meta.rpp_texto || "");
    let observacoes = financeDisplaySafeText(meta.observacoes_texto || "");
    if (origem === "—") origem = "";
    if (descricao === "—") descricao = "";
    if (rpp === "—") rpp = "";
    if (observacoes === "—") observacoes = "";
    const parts = financeTextAfterFinmeta(unpack.text || "")
      .split(/\s*—\s*/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (!origem && parts[0]) origem = parts[0];
    if (!descricao && parts.length >= 2) descricao = parts[1];
    if (!rpp && parts.length >= 3 && /^RPP\s*:/i.test(parts[2])) rpp = parts[2].replace(/^RPP\s*:\s*/i, "").trim();
    if (!observacoes && parts.length >= 3) {
      const obsStart = rpp && /^RPP\s*:/i.test(parts[2]) ? 3 : 2;
      observacoes = parts.slice(obsStart).join(" — ");
    }
    if (!descricao && parts.length === 1) descricao = parts[0];
    return {
      origem: origem || "—",
      descricao: descricao || "—",
      rpp: rpp || "—",
      observacoes: observacoes || "",
    };
  }

  function financeReceivableOrigemDescricao(r) {
    const t = financeReceivableTypedFields(r);
    return { origem: t.origem, descricao: t.descricao };
  }

  function financeReceivableManualCellHtml(r) {
    const t = financeReceivableTypedFields(r);
    const lines = [
      t.origem !== "—" ? `<span class="notice">Origem: ${escapeHtml(t.origem)}</span>` : "",
      t.descricao !== "—" ? `<span class="notice">Descrição: ${escapeHtml(t.descricao)}</span>` : "",
      t.observacoes ? `<span class="notice">Obs.: ${escapeHtml(t.observacoes)}</span>` : "",
    ].filter(Boolean);
    return lines.length ? lines.join("<br />") : "—";
  }

  function financeReceivableOrigemCellText(r, v) {
    if (financeIsManualReceivable(r)) return financeReceivableTypedFields(r).origem;
    if (v?.placa) return v.placa;
    return financeReceivableLabel(r);
  }

  function financeReceivableDescricaoCellText(r, v) {
    if (financeIsManualReceivable(r)) return financeReceivableTypedFields(r).descricao;
    const parts = [];
    const vm = [v?.marca, v?.modelo].filter(Boolean).join(" ");
    if (vm) parts.push(vm);
    const rpv = financeVehicleRpvNome(v);
    if (rpv && rpv !== "—") parts.push(`RPV: ${rpv}`);
    const diarias = financeReceberDiariasCell(r, v);
    if (diarias && diarias !== "—") parts.push(`Diárias: ${diarias}`);
    return parts.join(" — ") || financeReceivableServicoLabel(r);
  }

  function financeReceivableDescricaoCellHtml(r, v) {
    const text = financeReceivableDescricaoCellText(r, v);
    if (!financeIsManualReceivable(r)) return escapeHtml(text || "—");
    const obs = financeReceivableTypedFields(r).observacoes;
    return `${escapeHtml(text || "—")}${obs ? `<br /><span class="notice">Obs.: ${escapeHtml(obs)}</span>` : ""}`;
  }

  function financeRowActionsHtml(kind, id, opts = {}) {
    const safeId = escapeHtml(String(id));
    const canPay = opts.canPay === true;
    const canCaixa = opts.canCaixa === true;
    const payBtn = canPay
      ? `<button type="button" class="secondary fin-btn-${kind}-pg" data-fin-${kind}-pg="${safeId}">PG</button>`
      : "";
    const caixaBtn =
      canCaixa && (kind === "pagar" || kind === "receber")
        ? `<button type="button" class="secondary fin-btn-${kind}-caixa" data-fin-${kind}-caixa="${safeId}">Caixa</button>`
        : "";
    return `<div class="fin-row-actions">
      ${payBtn}
      ${caixaBtn}
      <button type="button" class="secondary fin-btn-${kind}-editar" data-fin-${kind}-editar="${safeId}">Editar</button>
      <button type="button" class="secondary fin-btn-${kind}-voltar" data-fin-${kind}-voltar="${safeId}">Voltar</button>
      <button type="button" class="secondary fin-btn-${kind}-apagar" data-fin-${kind}-apagar="${safeId}">Apagar</button>
    </div>`;
  }

  function financeRowIsSelected(view, id) {
    return financeRowSelection[view]?.has(String(id)) ?? false;
  }

  function financeRowCheckCell(view, id) {
    const checked = financeRowIsSelected(view, id);
    return `<td class="fin-td-select" data-label="Selecionar"><input type="checkbox" class="fin-row-check" data-fin-row-check="${escapeHtml(view)}" value="${escapeHtml(String(id))}"${checked ? " checked" : ""} aria-label="Selecionar registro"></td>`;
  }

  function financePruneRowSelection(view, visibleIds) {
    const set = financeRowSelection[view];
    if (!set) return;
    const visible = new Set(visibleIds.map(String));
    for (const id of [...set]) {
      if (!visible.has(id)) set.delete(id);
    }
  }

  function financeUpdateBatchBar(view) {
    const count = financeRowSelection[view]?.size || 0;
    document.querySelectorAll(`[data-fin-batch-view="${view}"]`).forEach((btn) => {
      btn.classList.toggle("hidden", count < 1);
      btn.disabled = count < 1;
      const base = btn.getAttribute("data-fin-batch-label") || btn.textContent.replace(/\s*\(\d+\)\s*$/, "");
      btn.textContent = count > 0 ? `${base} (${count})` : base;
    });
    const selectAll = document.querySelector(`[data-fin-select-all="${view}"]`);
    const checks = document.querySelectorAll(`.fin-row-check[data-fin-row-check="${view}"]`);
    if (!selectAll) return;
    if (!checks.length) {
      selectAll.checked = false;
      selectAll.indeterminate = false;
      return;
    }
    const checkedCount = [...checks].filter((c) => c.checked).length;
    selectAll.checked = checkedCount === checks.length;
    selectAll.indeterminate = checkedCount > 0 && checkedCount < checks.length;
  }

  function financeOpenBatchConfirmModal(opts) {
    financeBatchConfirmContext = { view: opts.view, action: opts.action };
    const modal = document.getElementById("finBatchDeleteModal");
    const titleEl = document.getElementById("finBatchDeleteTitle");
    const subEl = document.getElementById("finBatchDeleteSub");
    const msg = document.getElementById("finBatchDeleteMessage");
    const confirmBtn = document.getElementById("finBatchDeleteConfirm");
    const payFields = document.getElementById("finBatchPayFields");
    if (titleEl) titleEl.textContent = opts.title || "Confirmar";
    if (subEl) subEl.textContent = opts.subtitle || "";
    if (msg) msg.textContent = opts.message || "";
    if (confirmBtn) confirmBtn.textContent = opts.confirmLabel || "Confirmar";
    if (payFields) {
      payFields.classList.toggle("hidden", !opts.showPayFields);
      if (opts.showPayFields) {
        const dataEl = document.getElementById("finBatchPayData");
        const formaEl = document.getElementById("finBatchPayForma");
        if (dataEl) dataEl.value = financeTodayYmd();
        if (formaEl) formaEl.value = "PIX";
      }
    }
    modal?.classList.remove("hidden");
  }

  function financeCloseBatchConfirmModal() {
    financeBatchConfirmContext = null;
    document.getElementById("finBatchDeleteModal")?.classList.add("hidden");
    document.getElementById("finBatchPayFields")?.classList.add("hidden");
  }

  function financeOpenBatchDeleteModal(view, count) {
    financeOpenBatchConfirmModal({
      view,
      action: "delete",
      title: "Confirmar exclusão",
      subtitle: "Esta ação não pode ser desfeita.",
      message: `Deseja realmente apagar ${count} registro(s) selecionado(s)?`,
      confirmLabel: "Confirmar exclusão",
      showPayFields: false,
    });
  }

  function financeCloseBatchDeleteModal() {
    financeCloseBatchConfirmModal();
  }

  async function financeBatchPromoteAguardando(ids) {
    let ok = 0;
    let fail = 0;
    for (const id of ids) {
      if (await financePromoteReceivableToContasReceber(id)) ok += 1;
      else fail += 1;
    }
    return { ok, fail };
  }

  async function financeBatchPgReceber(ids, opts = {}) {
    const finalize =
      typeof window.finalizeReceivablePayment === "function"
        ? window.finalizeReceivablePayment
        : typeof finalizeReceivablePayment === "function"
          ? finalizeReceivablePayment
          : null;
    if (!finalize) return { ok: 0, fail: ids.length, skip: 0 };
    let ok = 0;
    let fail = 0;
    let skip = 0;
    for (const id of ids) {
      const r = (state.receivables || []).find((x) => String(x.id) === String(id));
      if (!r) {
        fail += 1;
        continue;
      }
      if (String(r.status || "").toUpperCase() === "PAGO") {
        skip += 1;
        continue;
      }
      const valor = Number(r.valor || 0);
      const result = await finalize(id, valor, {
        dataMovimento: opts.dataMovimento,
        formaPagamento: opts.formaPagamento,
      });
      if (result) ok += 1;
      else fail += 1;
    }
    return { ok, fail, skip };
  }

  async function financeBatchCaixaReceber(ids, opts = {}) {
    const finalize =
      typeof window.finalizeReceivablePayment === "function"
        ? window.finalizeReceivablePayment
        : typeof finalizeReceivablePayment === "function"
          ? finalizeReceivablePayment
          : null;
    let ok = 0;
    let fail = 0;
    let skip = 0;
    for (const id of ids) {
      const r = (state.receivables || []).find((x) => String(x.id) === String(id));
      if (!r) {
        fail += 1;
        continue;
      }
      const st = String(r.status || "").toUpperCase();
      if (st === "PAGO") {
        if (financeReceivableHasCaixa(id)) {
          skip += 1;
          continue;
        }
        const res = await financeRecoverCashForReceivableClient(r, {
          paidDate: opts.dataMovimento,
          formaPagamento: opts.formaPagamento,
        });
        if (res.ok && res.action === "created") ok += 1;
        else if (res.ok) skip += 1;
        else fail += 1;
        continue;
      }
      if (!finalize) {
        fail += 1;
        continue;
      }
      const valor = Number(r.valor || 0);
      const result = await finalize(id, valor, {
        dataMovimento: opts.dataMovimento,
        formaPagamento: opts.formaPagamento,
      });
      if (result) ok += 1;
      else fail += 1;
    }
    return { ok, fail, skip };
  }

  function financeBatchResultMessage(action, stats) {
    const parts = [];
    if (stats.ok) parts.push(`${stats.ok} concluído(s)`);
    if (stats.skip) parts.push(`${stats.skip} ignorado(s)`);
    if (stats.fail) parts.push(`${stats.fail} falha(s)`);
    if (!parts.length) return "Nenhum registro processado.";
    const labels = {
      promote: "Envio para Contas a receber",
      pg: "Pagamento (PG)",
      caixa: "Registro no caixa",
      delete: "Exclusão",
    };
    return `${labels[action] || "Operação"}: ${parts.join(", ")}.`;
  }

  async function financeDeleteCashForReceivableIds(ids) {
    const uid = typeof effectiveUserId === "function" ? effectiveUserId() : null;
    if (!uid || !ids?.length || typeof supabase === "undefined") return 0;
    const runDel = (q) => (typeof runSupabaseWrite === "function" ? runSupabaseWrite(q) : q());
    const { data: movs } = await supabase
      .from("cash_movements")
      .select("id,tipo_conta")
      .eq("user_id", uid)
      .in("conta_id", ids);
    const movIds = (movs || [])
      .filter((m) => {
        const t = String(m?.tipo_conta || "").toUpperCase();
        return t === "RECEBER" || t === "ENTRADA";
      })
      .map((m) => m.id);
    if (!movIds.length) return 0;
    const { error } = await runDel(() => supabase.from("cash_movements").delete().in("id", movIds).eq("user_id", uid));
    return error ? 0 : movIds.length;
  }

  async function financeDeleteCashForPayableIds(ids) {
    const uid = typeof effectiveUserId === "function" ? effectiveUserId() : null;
    if (!uid || !ids?.length || typeof supabase === "undefined") return 0;
    const runDel = (q) => (typeof runSupabaseWrite === "function" ? runSupabaseWrite(q) : q());
    const { data: movs } = await supabase
      .from("cash_movements")
      .select("id,tipo_conta")
      .eq("user_id", uid)
      .in("conta_id", ids);
    const movIds = (movs || [])
      .filter((m) => {
        const t = String(m?.tipo_conta || "").toUpperCase();
        return t === "PAGAR" || t === "SAIDA" || t === "SAÍDA";
      })
      .map((m) => m.id);
    if (!movIds.length) return 0;
    const { error } = await runDel(() => supabase.from("cash_movements").delete().in("id", movIds).eq("user_id", uid));
    return error ? 0 : movIds.length;
  }

  async function financeBatchDeleteAguardando(ids) {
    const uid = typeof effectiveUserId === "function" ? effectiveUserId() : null;
    if (!uid || !ids.length) return { ok: false, error: "Usuário não autenticado." };
    const runDel = (q) => (typeof runSupabaseWrite === "function" ? runSupabaseWrite(q) : q());
    await runDel(() =>
      supabase.from("cash_movements").delete().in("conta_id", ids).eq("tipo_conta", "RECEBER").eq("user_id", uid)
    );
    const closureIds = (state.cycleClosures || [])
      .filter((c) => ids.includes(String(c.receivable_id)))
      .map((c) => c.id);
    if (closureIds.length) {
      await runDel(() => supabase.from("patio_cycle_closures").delete().in("id", closureIds).eq("user_id", uid));
    }
    const { error } = await runDel(() => supabase.from("receivables").delete().in("id", ids).eq("user_id", uid));
    if (error) {
      return {
        ok: false,
        error: typeof alertSupabaseError === "function" ? null : error.message,
        supabaseError: error,
      };
    }
    for (const id of ids) {
      const r = (state.receivables || []).find((x) => String(x.id) === String(id));
      if (r?.vehicle_id && typeof window.addFinanceAguardandoDismissed === "function") {
        const vehicle = (state.vehicles || []).find((v) => String(v.id) === String(r.vehicle_id));
        window.addFinanceAguardandoDismissed(r.vehicle_id, r.period_end || vehicle?.data_saida);
      }
      if (typeof window.removeReceberTriagemId === "function") window.removeReceberTriagemId(id);
      if (typeof window.removePatioFinanceiroBloqueadoReceivableId === "function") {
        window.removePatioFinanceiroBloqueadoReceivableId(id);
      }
    }
    return { ok: true };
  }

  async function financeBatchDeleteReceber(ids) {
    const uid = typeof effectiveUserId === "function" ? effectiveUserId() : null;
    if (!uid || !ids.length) return { ok: false, error: "Usuário não autenticado." };
    await financeDeleteCashForReceivableIds(ids);
    const runDel = () => supabase.from("receivables").delete().in("id", ids).eq("user_id", uid);
    const { error } = typeof runSupabaseWrite === "function" ? await runSupabaseWrite(runDel) : await runDel();
    if (error) return { ok: false, supabaseError: error };
    return { ok: true };
  }

  async function financeBatchDeletePagar(ids) {
    const uid = typeof effectiveUserId === "function" ? effectiveUserId() : null;
    if (!uid || !ids.length) return { ok: false, error: "Usuário não autenticado." };
    await financeDeleteCashForPayableIds(ids);
    const runDel = () => supabase.from("payables").delete().in("id", ids).eq("user_id", uid);
    const { error } = typeof runSupabaseWrite === "function" ? await runSupabaseWrite(runDel) : await runDel();
    if (error) return { ok: false, supabaseError: error };
    return { ok: true };
  }

  async function financeExecuteBatchConfirm() {
    const ctx = financeBatchConfirmContext;
    if (!ctx?.view || !ctx?.action) return;
    const view = ctx.view;
    const action = ctx.action;
    const ids = [...(financeRowSelection[view] || [])];
    if (!ids.length) return;
    if (typeof requireSupabaseSessionForWrite === "function" && !(await requireSupabaseSessionForWrite())) return;

    const payOpts = {
      dataMovimento: document.getElementById("finBatchPayData")?.value || financeTodayYmd(),
      formaPagamento: document.getElementById("finBatchPayForma")?.value || "PIX",
    };

    let stats = { ok: 0, fail: 0, skip: 0 };
    if (action === "delete") {
      if (view === "aguardando") {
        const result = await financeBatchDeleteAguardando(ids);
        if (!result.ok) {
          if (result.supabaseError && typeof alertSupabaseError === "function") {
            alertSupabaseError(result.supabaseError, "Não foi possível apagar os registros selecionados.");
          } else {
            alert(result.error || "Não foi possível apagar os registros selecionados.");
          }
          return;
        }
        stats.ok = ids.length;
      } else if (view === "receber") {
        const result = await financeBatchDeleteReceber(ids);
        if (!result.ok) {
          if (result.supabaseError && typeof alertSupabaseError === "function") {
            alertSupabaseError(result.supabaseError, "Não foi possível apagar os registros selecionados.");
          } else {
            alert(result.error || "Não foi possível apagar os registros selecionados.");
          }
          return;
        }
        stats.ok = ids.length;
      } else if (view === "pagar") {
        const result = await financeBatchDeletePagar(ids);
        if (!result.ok) {
          if (result.supabaseError && typeof alertSupabaseError === "function") {
            alertSupabaseError(result.supabaseError, "Não foi possível apagar os registros selecionados.");
          } else {
            alert(result.error || "Não foi possível apagar os registros selecionados.");
          }
          return;
        }
        stats.ok = ids.length;
      }
    } else if (action === "promote" && view === "aguardando") {
      stats = await financeBatchPromoteAguardando(ids);
    } else if (action === "pg" && view === "receber") {
      stats = await financeBatchPgReceber(ids, payOpts);
    } else if (action === "caixa" && view === "receber") {
      stats = await financeBatchCaixaReceber(ids, payOpts);
    }

    financeRowSelection[view]?.clear();
    financeCloseBatchConfirmModal();
    if (view === "aguardando" && typeof loadCycleClosures === "function") {
      await loadCycleClosures();
    }
    await financeReloadAfterAction();
    if (action !== "delete" || stats.fail) {
      alert(financeBatchResultMessage(action, stats));
    }
  }

  async function financeExecuteBatchDelete(view) {
    financeBatchConfirmContext = { view, action: "delete" };
    await financeExecuteBatchConfirm();
  }

  async function financeReloadAfterAction() {
    await Promise.all([
      typeof loadReceivables === "function" ? loadReceivables() : Promise.resolve(),
      typeof loadPayables === "function" ? loadPayables() : Promise.resolve(),
      typeof loadCash === "function" ? loadCash() : Promise.resolve(),
      typeof loadVehicles === "function" ? loadVehicles() : Promise.resolve(),
    ]);
    if (typeof updateDashboard === "function") updateDashboard();
    if (typeof renderFinance === "function") renderFinance();
  }

  async function financeDeleteCashForPayableClient(payableId) {
    const uid = typeof effectiveUserId === "function" ? effectiveUserId() : null;
    if (!uid || !payableId || typeof supabase === "undefined") return 0;
    const { data: movs } = await supabase
      .from("cash_movements")
      .select("id,tipo_conta")
      .eq("user_id", uid)
      .eq("conta_id", payableId);
    let removed = 0;
    for (const mov of movs || []) {
      const t = String(mov?.tipo_conta || "").toUpperCase();
      if (t !== "PAGAR" && t !== "SAIDA" && t !== "SAÍDA") continue;
      const runDel = () => supabase.from("cash_movements").delete().eq("id", mov.id).eq("user_id", uid);
      const { error } = typeof runSupabaseWrite === "function" ? await runSupabaseWrite(runDel) : await runDel();
      if (!error) removed += 1;
    }
    return removed;
  }

  function financePayableTypedFields(p) {
    if (!p) return { fornecedor: "—", descricao: "—", observacoes: "" };
    const raw =
      typeof financePayableMetaText === "function"
        ? financePayableMetaText(p)
        : p?.observacoes || p?.descricao || "";
    const unpack =
      typeof financeMetaUnpack === "function" ? financeMetaUnpack(raw) : financeMetaUnpackLocal(raw);
    const meta = unpack.meta || {};
    let fornecedor = financeDisplaySafeText(meta.fornecedor_texto || p.fornecedor || "");
    let descricao = financeDisplaySafeText(meta.descricao_texto || "");
    let observacoes = financeDisplaySafeText(meta.observacoes_texto || "");
    const parts = financeTextAfterFinmeta(unpack.text || "")
      .split(/\s*—\s*/)
      .map((x) => x.trim())
      .filter(Boolean);
    if (!fornecedor && parts[0]) fornecedor = parts[0];
    if (!descricao && parts.length >= 2) descricao = parts[1];
    if (!observacoes && parts.length >= 3) observacoes = parts.slice(2).join(" — ");
    if (!descricao && parts.length === 1) descricao = parts[0];
    return {
      fornecedor: fornecedor || "—",
      descricao: descricao || "—",
      observacoes: observacoes || "",
    };
  }

  function financeCaixaEntradaLabels(mov, rec) {
    return {
      pagante: financeQuemPagouCaixa(mov, rec),
      descricao: financeCaixaDescricaoEntrada(mov, rec),
    };
  }

  function financeSanitizeCaixaTableCells(root) {
    if (!root) return;
    root.querySelectorAll('td[data-label="Origem"], td[data-label="Pagante"]').forEach((td) => {
      const t = td.textContent || "";
      if (!t.includes(FINANCE_META_PREFIX_LOCAL)) return;
      const clean = financeNormalizeQuemPagouText(financeTextAfterFinmeta(t));
      if (clean && !clean.includes(FINANCE_META_PREFIX_LOCAL)) td.textContent = clean;
    });
    root.querySelectorAll('td[data-label="Descrição"]').forEach((td) => {
      const t = td.textContent || "";
      if (!t.includes(FINANCE_META_PREFIX_LOCAL)) return;
      const clean = financeTextAfterFinmeta(t);
      if (clean && !clean.includes(FINANCE_META_PREFIX_LOCAL)) td.textContent = clean;
    });
  }

  function financeReceivableServicoLabel(r) {
    if (typeof receivableCategoryLabel === "function" && r?.receivable_category) {
      return receivableCategoryLabel(r.receivable_category);
    }
    return r?.receivable_category || "—";
  }

  function financeReceberRppNome(r, v) {
    if (financeIsManualReceivable(r)) return financeReceivableTypedFields(r).rpp;
    if (typeof vehicleRpfNome === "function" && v) {
      const rpf = vehicleRpfNome(v);
      if (rpf && rpf !== "—") return rpf;
    }
    return financeReceivableLabel(r);
  }

  function financeVehicleEffectiveRppPartnerId(v) {
    if (typeof listaVehicleEffectiveRpfPartnerId === "function") return listaVehicleEffectiveRpfPartnerId(v);
    if (!v) return "";
    return String(v.responsavel_financeiro_id || v.localizador_id || "").trim();
  }

  function financePartnerNomeById(partnerId) {
    if (!partnerId) return "";
    return String((state.partners || []).find((p) => String(p.id) === String(partnerId))?.nome || "").trim();
  }

  function financeReceivableRppPartnerId(r, v) {
    if (!r) return "";
    if (financeIsManualReceivable(r)) {
      const rppName = String(financeReceivableTypedFields(r).rpp || "").trim();
      if (!rppName || rppName === "—") return "";
      const exact = (state.partners || []).find(
        (p) => String(p.nome || "").trim().toLowerCase() === rppName.toLowerCase()
      );
      if (exact?.id) return String(exact.id);
      const partial = (state.partners || []).find((p) => {
        const n = String(p.nome || "").trim().toLowerCase();
        return n && (rppName.toLowerCase().includes(n) || n.includes(rppName.toLowerCase()));
      });
      return partial?.id ? String(partial.id) : "";
    }
    return financeVehicleEffectiveRppPartnerId(v);
  }

  function financeReceivableMatchesRppFilter(r, v, rppPartnerId) {
    if (!rppPartnerId) return true;
    const pid = String(rppPartnerId);
    if (financeReceivableRppPartnerId(r, v) === pid) return true;
    const partnerName = financePartnerNomeById(pid).toLowerCase();
    if (!partnerName) return false;
    const rppLabel = String(financeReceberRppNome(r, v) || "")
      .trim()
      .toLowerCase();
    return !!rppLabel && rppLabel !== "—" && (rppLabel === partnerName || rppLabel.includes(partnerName));
  }

  function financePopulateRppFilterSelect(selectId, currentValue) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const parceiros = [...(state.partners || [])].sort((a, b) =>
      String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR")
    );
    const opt = (id, label) => {
      const vid = String(id).replace(/"/g, "&quot;");
      return `<option value="${vid}">${escapeHtml(label)}</option>`;
    };
    sel.innerHTML =
      `<option value="">Todos os RPP</option>` + parceiros.map((p) => opt(p.id, p.nome || "-")).join("");
    if (currentValue && parceiros.some((p) => String(p.id) === String(currentValue))) sel.value = currentValue;
    else sel.value = "";
  }

  function financePopulateFinanceRppFilters() {
    financePopulateRppFilterSelect("finAguardandoRpp", financeFilterAguardandoRppId);
    financePopulateRppFilterSelect("finReceberRpp", financeFilterReceberRppId);
    financePopulateRppFilterSelect("finCaixaRpp", financeFilterCaixaRppId);
  }

  window.financePopulateFinanceRppFilters = financePopulateFinanceRppFilters;
  window.financeContasAguardandoList = financeContasAguardandoList;

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
    const raw =
      typeof financePayableMetaText === "function"
        ? financePayableMetaText(p)
        : p?.observacoes || p?.descricao || "";
    return financeMetaUnpack(raw);
  }

  function financeIsManualPayable(p) {
    if (!p) return false;
    const { meta } = financePayableMeta(p);
    if (meta.geracao_automatica === true) return false;
    return meta.cadastro_manual === true;
  }

  function financePayableContaBancaria(p) {
    const { meta } = financePayableMeta(p);
    return meta.conta_bancaria || state.settings?.conta_bancaria || "Caixa";
  }

  function financePayablePaidSum(payableId) {
    return financeCaixaMovsMerged()
      .filter((m) => financeCashIsSaida(m) && String(m.conta_id) === String(payableId))
      .reduce((s, m) => s + financeCashMovValor(m), 0);
  }

  /** Data de competência da entrada de caixa vinculada a um recebível pago. */
  function financeReceivableCashCompetenciaYmd(r) {
    if (!r) return "";
    const raw =
      typeof financeReceivableMetaText === "function"
        ? financeReceivableMetaText(r)
        : r?.observacoes || r?.responsavel_pagamento || r?.descricao || "";
    const { meta } = financeMetaUnpack(raw);
    const fromMeta = toLocalYmd(meta?.data_pagamento || meta?.data_recebimento || "");
    if (fromMeta) return fromMeta;
    const period = toLocalYmd(r.period_end || r.period_start || "");
    if (period) return period;
    return toLocalYmd(r.updated_at || r.created_at || "") || "";
  }

  /** Data de competência da saída de caixa vinculada a uma despesa paga. */
  function financePayableCashCompetenciaYmd(p) {
    if (!p) return "";
    const { meta } = financePayableMeta(p);
    const fromMeta = toLocalYmd(meta?.data_pagamento || meta?.data_baixa || "");
    if (fromMeta) return fromMeta;
    const fromPay = toLocalYmd(p.data_pagamento || "");
    if (fromPay) return fromPay;
    const due = financeContaDueYmd(p, "payable");
    if (due) return due;
    if (String(p.status || "").toUpperCase() === "PAGO") {
      const paid = toLocalYmd(p.updated_at || "");
      if (paid) return paid;
    }
    return toLocalYmd(p.created_at || "") || "";
  }

  /** Data padrão nos modais PG/Caixa (retroativa: vencimento ou data de pagamento já informada). */
  function financePayableDefaultBaixaDateYmd(p) {
    return financePayableCashCompetenciaYmd(p) || financeTodayYmd();
  }

  /** Data civil (YYYY-MM-DD) usada para filtrar/agrupar movimentações do caixa. */
  function financeCaixaMovCompetenciaYmd(mov) {
    if (!mov) return "";
    if (financeCashIsSaida(mov) && mov.conta_id != null && mov.conta_id !== "") {
      const pay = (state.payables || []).find((p) => String(p.id) === String(mov.conta_id));
      if (pay) {
        const payComp = financePayableCashCompetenciaYmd(pay);
        const movComp = toLocalYmd(mov.data_movimento || "");
        const { meta } = financePayableMeta(pay);
        const hasExplicitPayDate = !!(meta?.data_pagamento || meta?.data_baixa || pay.data_pagamento);
        if (hasExplicitPayDate && payComp) return payComp;
        return movComp || payComp || toLocalYmd(mov.created_at) || "";
      }
    }
    if (financeCashIsEntrada(mov)) {
      const rec = financeCashMovLinkedReceivable(mov);
      if (rec) {
        const recComp = financeReceivableCashCompetenciaYmd(rec);
        const movComp = toLocalYmd(mov.data_movimento || "");
        const raw =
          typeof financeReceivableMetaText === "function"
            ? financeReceivableMetaText(rec)
            : rec?.observacoes || rec?.responsavel_pagamento || "";
        const { meta } = financeMetaUnpack(raw);
        const hasExplicitPayDate = !!(meta?.data_pagamento || meta?.data_recebimento);
        if (hasExplicitPayDate && recComp) return recComp;
        return movComp || recComp || toLocalYmd(mov.created_at) || "";
      }
    }
    return toLocalYmd(mov.data_movimento || mov.created_at) || "";
  }

  /** @deprecated Saídas de payables não são mais sintetizadas no caixa — registro manual apenas. */
  function financeSaidasFromPaidPayables() {
    return [];
  }

  /** Movimentações que impactam saldo, fluxo, lucro e dashboards (somente APROVADO_CAIXA no modo manual). */
  function financeCaixaMovsMerged() {
    const cashOperacional = (state.cash || []).filter(
      (m) => financeMovInCaixaWindow(m) && financeCashAprovadoCaixa(m)
    );
    if (financeOperationalModeActive()) {
      return financeDedupeCaixaMovs(cashOperacional);
    }
    return financeDedupeCaixaMovs([...cashOperacional, ...financeSyntheticCashEntradasFromPaidReceivables()]);
  }

  function financePaidPayablesSemCaixa() {
    const cashPayableIds = new Set(
      financeDedupeCaixaMovs(state.cash || [])
        .filter((m) => financeCashIsSaida(m) && m.conta_id != null && m.conta_id !== "")
        .map((m) => String(m.conta_id))
    );
    return (state.payables || []).filter(
      (p) =>
        String(p.status || "").toUpperCase() === "PAGO" &&
        Number(p.valor || 0) > 0 &&
        !cashPayableIds.has(String(p.id))
    );
  }

  function financeCountPaidPayablesSemCaixa() {
    return financePaidPayablesSemCaixa().length;
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

  function financeReceivableIdsComCaixaHistoricoInvalido() {
    if (!financeOperationalModeActive()) return new Set();
    const ids = new Set();
    for (const m of state.cash || []) {
      if (!m?.conta_id || !financeCashIsEntrada(m)) continue;
      if (!financeCashAprovadoCaixa(m)) ids.add(String(m.conta_id));
    }
    return ids;
  }

  function financeContasAguardandoList() {
    const legacyCaixaRecIds = financeReceivableIdsComCaixaHistoricoInvalido();
    const matched = (state.receivables || []).filter((r) => {
      if (!r || r.status === "PAGO") return false;
      if (receivableSemCobrancaFinanceira(r)) return false;
      if (receivableIsContaReceberFinanceiro(r)) return false;
      if (!r.vehicle_id) return false;
      if (legacyCaixaRecIds.has(String(r.id))) return true;
      if (typeof receivableOrfaoEntreFilasFinanceiro === "function" && receivableOrfaoEntreFilasFinanceiro(r)) {
        return true;
      }
      if (receivableNaFilaAguardandoTriagem(r)) return true;
      if (r.status === RECEIVABLE_AGUARDANDO_LANCAMENTO) return true;
      return r.status === "EM_ABERTO" && receivableCicloEncerradoParaFinanceiro(r);
    });
    const deduped = financeDedupePatioReceivables(matched);
    if (typeof window.financeIsAguardandoDismissed !== "function") return deduped;
    const vmap = financeVehicleById();
    return deduped.filter((r) => !window.financeIsAguardandoDismissed(r, vmap.get(r.vehicle_id)));
  }

  function financeParseBrDateToYmd(str) {
    const s = String(str || "").trim();
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (!m) return null;
    return `${m[3]}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
  }

  /** Ex.: "15/04/2026 a 01/05/2026" ou "15-04-2026" */
  function financeParseDateRangeText(text) {
    const raw = String(text || "").trim();
    if (!raw) return null;
    const parts = raw.split(/\s+(?:a|até|ate)\s+/i).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const de = financeParseBrDateToYmd(parts[0]);
      const ate = financeParseBrDateToYmd(parts[1]);
      if (de && ate) {
        const [d0, d1] = de <= ate ? [de, ate] : [ate, de];
        return { de: d0, ate: d1 };
      }
    }
    const one = financeParseBrDateToYmd(raw);
    if (one) return { de: one, ate: one };
    return null;
  }

  function financeApplyDateRangeToState(parsed, setDe, setAte, deInputId, ateInputId) {
    if (!parsed) return false;
    setDe(parsed.de);
    setAte(parsed.ate);
    const deEl = deInputId ? document.getElementById(deInputId) : null;
    const ateEl = ateInputId ? document.getElementById(ateInputId) : null;
    if (deEl) deEl.value = parsed.de;
    if (ateEl) ateEl.value = parsed.ate;
    return true;
  }

  function financeSyncAguardandoFiltersFromDom() {
    financeFilterAguardandoPlaca = (document.getElementById("finAguardandoPlaca")?.value || "").trim();
    financeFilterAguardandoRppId = document.getElementById("finAguardandoRpp")?.value || "";
    financeFilterAguardandoPeriodo = document.getElementById("finAguardandoPeriodo")?.value || "";
    financeFilterAguardandoDataDe = document.getElementById("finAguardandoDataDe")?.value || "";
    financeFilterAguardandoDataAte = document.getElementById("finAguardandoDataAte")?.value || "";
    const busca = (document.getElementById("finAguardandoDataBusca")?.value || "").trim();
    const parsed = financeParseDateRangeText(busca);
    if (parsed) {
      financeFilterAguardandoDataDe = parsed.de;
      financeFilterAguardandoDataAte = parsed.ate;
      const deEl = document.getElementById("finAguardandoDataDe");
      const ateEl = document.getElementById("finAguardandoDataAte");
      if (deEl) deEl.value = parsed.de;
      if (ateEl) ateEl.value = parsed.ate;
    }
  }

  function financeSyncReceberPlacaFromDom() {
    financeFilterReceberPlaca = (document.getElementById("finReceberPlaca")?.value || "").trim();
    financeFilterReceberRppId = document.getElementById("finReceberRpp")?.value || "";
  }

  function financeSyncReceberDateFiltersFromDom() {
    financeFilterReceberDataDe = document.getElementById("finReceberDataDe")?.value || "";
    financeFilterReceberDataAte = document.getElementById("finReceberDataAte")?.value || "";
    const busca = (document.getElementById("finReceberDataBusca")?.value || "").trim();
    const parsed = financeParseDateRangeText(busca);
    if (parsed) {
      financeFilterReceberDataDe = parsed.de;
      financeFilterReceberDataAte = parsed.ate;
      const deEl = document.getElementById("finReceberDataDe");
      const ateEl = document.getElementById("finReceberDataAte");
      if (deEl) deEl.value = parsed.de;
      if (ateEl) ateEl.value = parsed.ate;
    }
  }

  function financeSyncCaixaFiltersFromDom() {
    financeFilterPeriodo = document.getElementById("finFilterPeriodo")?.value || "";
    financeFilterCaixaRppId = document.getElementById("finCaixaRpp")?.value || "";
    financeFilterCaixaPlaca = (document.getElementById("finCaixaPlaca")?.value || "").trim();
    financeFilterCaixaDataDe = document.getElementById("finCaixaDataDe")?.value || "";
    financeFilterCaixaDataAte = document.getElementById("finCaixaDataAte")?.value || "";
    const busca = (document.getElementById("finCaixaDataBusca")?.value || "").trim();
    const parsed = financeParseDateRangeText(busca);
    if (parsed) {
      financeFilterCaixaDataDe = parsed.de;
      financeFilterCaixaDataAte = parsed.ate;
      const deEl = document.getElementById("finCaixaDataDe");
      const ateEl = document.getElementById("finCaixaDataAte");
      if (deEl) deEl.value = parsed.de;
      if (ateEl) ateEl.value = parsed.ate;
    }
  }

  /** Competência pela data de saída do ciclo (VRP). */
  function financeReceivableSaidaYmd(r, vehicle) {
    return toLocalYmd(vehicle?.data_saida || r?.period_end || r?.updated_at || r?.created_at) || "";
  }

  function financeReceivableSaidaYm(r, vehicle) {
    return yearMonthFromYmd(financeReceivableSaidaYmd(r, vehicle)) || "";
  }

  function financeYmdInRange(ymd, de, ate) {
    if (!ymd) return !(de || ate);
    if (de && ymd < de) return false;
    if (ate && ymd > ate) return false;
    return true;
  }

  function financeContasAguardandoFilteredList() {
    const vmap = financeVehicleById();
    const plateNorm = financeNormalizePlate(financeFilterAguardandoPlaca);
    const periodo = (financeFilterAguardandoPeriodo || "").trim();
    const de = (financeFilterAguardandoDataDe || "").trim();
    const ate = (financeFilterAguardandoDataAte || "").trim();
    const rppId = (financeFilterAguardandoRppId || "").trim();
    return financeContasAguardandoList().filter((r) => {
      const v = vmap.get(r.vehicle_id);
      if (!financePlateMatchesQuery(v, plateNorm)) return false;
      if (!financeReceivableMatchesRppFilter(r, v, rppId)) return false;
      if (de || ate) {
        if (!financeYmdInRange(financeReceivableSaidaYmd(r, v), de, ate)) return false;
      } else if (periodo && financeReceivableSaidaYm(r, v) !== periodo) {
        return false;
      }
      return true;
    });
  }

  function financeSyncAguardandoFilterHint() {
    const hint = document.getElementById("finAguardandoPlateHint");
    if (!hint) return;
    const q = (financeFilterAguardandoPlaca || "").trim();
    const rppNome = financePartnerNomeById(financeFilterAguardandoRppId);
    const periodo = (financeFilterAguardandoPeriodo || "").trim();
    const de = (financeFilterAguardandoDataDe || "").trim();
    const ate = (financeFilterAguardandoDataAte || "").trim();
    const parts = [];
    if (q) parts.push(`placa: ${q}`);
    if (rppNome) parts.push(`RPP: ${rppNome}`);
    if (periodo) {
      const [y, m] = periodo.split("-");
      parts.push(`mês: ${m}/${y}`);
    }
    if (de || ate) {
      parts.push(`saída: ${de ? formatDate(de) : "…"} — ${ate ? formatDate(ate) : "…"}`);
    }
    if (!parts.length) {
      hint.textContent = "";
      hint.classList.add("hidden");
      return;
    }
    hint.textContent = `Filtros — ${parts.join(" · ")}`;
    hint.classList.remove("hidden");
  }

  function financeSyncReceberFilterHint() {
    const hint = document.getElementById("finReceberPlateHint");
    if (!hint) return;
    const q = (financeFilterReceberPlaca || "").trim();
    const rppNome = financePartnerNomeById(financeFilterReceberRppId);
    const de = (financeFilterReceberDataDe || "").trim();
    const ate = (financeFilterReceberDataAte || "").trim();
    const parts = [];
    if (q) parts.push(`placa: ${q}`);
    if (rppNome) parts.push(`RPP: ${rppNome}`);
    if (de || ate) {
      parts.push(`saída: ${de ? formatDate(de) : "…"} — ${ate ? formatDate(ate) : "…"}`);
    }
    if (!parts.length) {
      hint.textContent = "";
      hint.classList.add("hidden");
      return;
    }
    hint.textContent = `Filtros — ${parts.join(" · ")}`;
    hint.classList.remove("hidden");
  }

  function financeCashMovMatchesRpp(mov, rppPartnerId) {
    if (!rppPartnerId) return true;
    const rec = financeCashMovLinkedReceivable(mov);
    if (!rec) return false;
    const v = financeVehicleById().get(rec.vehicle_id);
    return financeReceivableMatchesRppFilter(rec, v, rppPartnerId);
  }

  function financeCashMovMatchesPlaca(mov, plateNorm) {
    if (!plateNorm) return true;
    const vmap = financeVehicleById();
    const rec = financeCashMovLinkedReceivable(mov);
    if (rec) {
      const v = vmap.get(rec.vehicle_id);
      if (financePlateMatchesQuery(v, plateNorm)) return true;
    }
    const descPlaca = financePlacaFromCashDesc(mov?.descricao);
    if (descPlaca && (descPlaca.includes(plateNorm) || plateNorm.includes(descPlaca))) return true;
    const blob = String(mov?.descricao || "").toLowerCase();
    return blob.includes(plateNorm);
  }

  function financeContasReceberList() {
    const vmap = financeVehicleById();
    let list = (state.receivables || []).filter((r) => receivableIsContaReceberFinanceiro(r));
    const plateNorm = financeNormalizePlate(financeFilterReceberPlaca);
    const rppId = (financeFilterReceberRppId || "").trim();
    if (plateNorm) {
      list = list.filter((r) => financePlateMatchesQuery(vmap.get(r.vehicle_id), plateNorm));
    }
    if (rppId) {
      list = list.filter((r) => financeReceivableMatchesRppFilter(r, vmap.get(r.vehicle_id), rppId));
    }
    const qRaw = (financeFilterBanco || "").trim();
    const q = qRaw.toLowerCase();
    const buscaDateRange = financeParseDateRangeText(qRaw);
    if (buscaDateRange) {
      list = list.filter((r) => {
        const v = vmap.get(r.vehicle_id);
        const refYmd = r.vehicle_id
          ? financeReceivableSaidaYmd(r, v)
          : financeContaDueYmd(r, "receivable") || "";
        return financeYmdInRange(refYmd, buscaDateRange.de, buscaDateRange.ate);
      });
    } else if (q) {
      list = list.filter((r) => {
        const v = vmap.get(r.vehicle_id);
        const saidaYmd = toLocalYmd(r.period_end || v?.data_saida || "");
        const saidaYm = yearMonthFromYmd(saidaYmd) || "";
        const typed = financeIsManualReceivable(r) ? financeReceivableTypedFields(r) : null;
        const blob = [
          typed ? [typed.origem, typed.descricao, typed.observacoes].join(" ") : financeReceivableLabel(r),
          r.observacoes,
          v?.placa,
          v?.marca,
          v?.modelo,
          financeInstituicaoNome(v),
          saidaYmd,
          saidaYm,
          saidaYmd ? formatDate(saidaYmd) : "",
          v?.data_saida ? formatDate(v.data_saida) : "",
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
    if (financeFilterTipo) {
      list = list.filter((r) => financeMatchesTipoFilter(r, "receivable", financeFilterTipo));
    }
    const de = (financeFilterReceberDataDe || "").trim();
    const ate = (financeFilterReceberDataAte || "").trim();
    if (de || ate) {
      list = list.filter((r) => {
        const v = vmap.get(r.vehicle_id);
        const refYmd = r.vehicle_id
          ? financeReceivableSaidaYmd(r, v)
          : financeContaDueYmd(r, "receivable") || "";
        return financeYmdInRange(refYmd, de, ate);
      });
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
    return financeDedupePatioReceivables(list);
  }

  function financeContasPagarList() {
    let list = (state.payables || []).filter((p) => financeIsManualPayable(p));
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
    return (state.payables || []).filter(
      (p) => financeIsManualPayable(p) && financePayableDisplayStatus(p) !== "Pago"
    );
  }

  function financeHistoricoRecebidos() {
    return (state.receivables || []).filter((r) => r.status === "PAGO" && r.vehicle_id);
  }

  function financeCashIsEntrada(mov) {
    const t = String(mov?.tipo_conta || "").toUpperCase();
    return t === "RECEBER" || t === "ENTRADA";
  }

  function financeCashIsSaida(mov) {
    const t = String(mov?.tipo_conta || "").toUpperCase().replace(/\s/g, "");
    return (
      t === "PAGAR" ||
      t === "SAIDA" ||
      t === "SAÍDA" ||
      t === "DESPESA" ||
      t === "SANGRIA" ||
      t.includes("SAIDA") ||
      t.includes("PAGAR")
    );
  }

  /** Valor da movimentação; se vier zerado na base, usa o título pago vinculado. */
  function financeReceivableCycleRank(r) {
    let score = 0;
    if (r?.period_end) score += 1e15;
    const ts = new Date(r?.period_end || r?.updated_at || r?.created_at || 0).getTime();
    if (Number.isFinite(ts)) score += ts;
    if (Number(r?.valor || 0) > 0) score += 1e12;
    return score;
  }

  /** Um título por veículo + fim de ciclo (evita VRP/sync duplicado no faturamento). */
  function financeDedupePatioReceivables(receivables) {
    const byKey = new Map();
    const manual = [];
    for (const r of receivables || []) {
      if (!r) continue;
      if (!r.vehicle_id) {
        manual.push(r);
        continue;
      }
      const endYmd = toLocalYmd(r.period_end || r.updated_at || r.created_at) || "sem-data";
      const key = `${String(r.vehicle_id)}|${endYmd}`;
      const prev = byKey.get(key);
      if (!prev || financeReceivableCycleRank(r) >= financeReceivableCycleRank(prev)) {
        byKey.set(key, r);
      }
    }
    return [...manual, ...byKey.values()];
  }

  function financeCashMovLinkedReceivable(mov) {
    if (!mov?.conta_id) return null;
    return (state.receivables || []).find((r) => String(r.id) === String(mov.conta_id)) || null;
  }

  function financePlacaFromCashDesc(descricao) {
    const m = String(descricao || "").match(/(?:Diárias|Recebimento|Recuperação caixa)\s*[—\-]\s*([A-Z0-9]+)/i);
    return m ? financeNormalizePlate(m[1]) : "";
  }

  function financeCashMovEntradaBusinessKey(mov) {
    if (mov?.conta_id != null && mov.conta_id !== "") return `c:${String(mov.conta_id)}`;
    const ymd = toLocalYmd(mov?.data_movimento || mov?.created_at) || "";
    const valorKey = Math.round(Number(mov?.valor ?? 0) * 100);
    const rec = financeCashMovLinkedReceivable(mov);
    if (rec?.vehicle_id) return `v:${String(rec.vehicle_id)}|${ymd}|${valorKey}`;
    const placa = financePlacaFromCashDesc(mov?.descricao);
    if (placa) return `p:${placa}|${ymd}|${valorKey}`;
    return `id:${mov?.id || Math.random()}`;
  }

  function financeCashMovRank(mov) {
    let score = 0;
    if (!mov?._syntheticPendingCaixa) score += 1e12;
    const t = String(mov?.tipo_conta || "").toUpperCase();
    if (t === "RECEBER") score += 100;
    else if (t === "ENTRADA") score += 50;
    else if (t === "PAGAR") score += 80;
    else if (t === "SAIDA" || t === "SAÍDA") score += 70;
    if (mov?.id && !String(mov.id).startsWith("derived-pay-")) score += 200;
    if (Number(financeCashMovValor(mov) || 0) > 0) score += 10;
    const ts = new Date(mov?.data_movimento || mov?.created_at || 0).getTime();
    if (Number.isFinite(ts)) score += ts / 1e6;
    return score;
  }

  /** Uma entrada/saída por veículo/data/valor ou por conta vinculada. */
  function financeDedupeCaixaMovs(movs) {
    const entradaByKey = new Map();
    const saidaByConta = new Map();
    const loose = [];
    for (const mov of movs || []) {
      if (financeCashIsEntrada(mov)) {
        const key = financeCashMovEntradaBusinessKey(mov);
        const prev = entradaByKey.get(key);
        if (!prev || financeCashMovRank(mov) >= financeCashMovRank(prev)) entradaByKey.set(key, mov);
      } else if (financeCashIsSaida(mov)) {
        const contaId = mov?.conta_id;
        if (contaId != null && contaId !== "") {
          const key = String(contaId);
          const prev = saidaByConta.get(key);
          if (!prev || financeCashMovRank(mov) >= financeCashMovRank(prev)) saidaByConta.set(key, mov);
        } else {
          loose.push(mov);
        }
      } else {
        loose.push(mov);
      }
    }
    return [...loose, ...entradaByKey.values(), ...saidaByConta.values()];
  }

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

  function financePaidReceivablesSemCaixa() {
    const cashIds = new Set(
      financeDedupeCaixaMovs(state.cash || [])
        .filter((m) => financeCashIsEntrada(m))
        .map((m) => String(m.conta_id))
        .filter(Boolean)
    );
    return (state.receivables || []).filter(
      (r) =>
        String(r.status || "").toUpperCase() === "PAGO" &&
        Number(r.valor || 0) > 0 &&
        !cashIds.has(String(r.id))
    );
  }

  function financeSyntheticCashEntradasFromPaidReceivables() {
    if (financeOperationalModeActive()) return [];
    const cashEntradas = financeDedupeCaixaMovs(state.cash || []).filter((m) => financeCashIsEntrada(m));
    const businessKeysWithCash = new Set(cashEntradas.map((m) => financeCashMovEntradaBusinessKey(m)));
    const vmap = financeVehicleById();
    return financePaidReceivablesSemCaixa()
      .filter((r) => financeReceivableInCaixaWindow(r))
      .map((r) => {
        const v = vmap.get(r.vehicle_id);
        const placa = v?.placa || "—";
        const syn = {
          id: `syn-rec-${r.id}`,
          tipo_conta: "RECEBER",
          conta_id: r.id,
          valor: Number(r.valor || 0),
          data_movimento: financeReceivableCashCompetenciaYmd(r) || toLocalYmd(new Date().toISOString()),
          forma_pagamento:
            (typeof financeReceivableFormaPagamento === "function"
              ? financeReceivableFormaPagamento(r)
              : r.forma_pagamento) || "PIX",
          descricao: `Recebimento ${placa}`,
          _syntheticPendingCaixa: true,
        };
        return syn;
      })
      .filter((syn) => !businessKeysWithCash.has(financeCashMovEntradaBusinessKey(syn)));
  }

  function financeCaixaEntradas() {
    return financeCaixaMovsMerged().filter((m) => financeCashIsEntrada(m));
  }

  function financeCaixaSaidas() {
    return financeCaixaMovsMerged().filter((m) => financeCashIsSaida(m));
  }

  function financeSaldoCaixa() {
    const ent = financeCaixaEntradas().reduce((s, m) => s + financeCashMovValor(m), 0);
    const sai = financeCaixaSaidas().reduce((s, m) => s + financeCashMovValor(m), 0);
    return financeCaixaOpeningBalance() + ent - sai;
  }

  function financeTotalEntradas() {
    return financeCaixaEntradas().reduce((s, m) => s + financeCashMovValor(m), 0);
  }

  function financeTotalSaidas() {
    return financeCaixaSaidas().reduce((s, m) => s + financeCashMovValor(m), 0);
  }

  function financeCaixaMovsForPeriod(periodoYm, opts = {}) {
    const useDomFilters = opts.useDomFilters !== false;
    const auditView = opts.auditView === true && !financeOperationalModeActive();
    let movs = auditView ? financeCaixaMovsHistorico() : financeCaixaMovsMerged();
    const de = useDomFilters ? (financeFilterCaixaDataDe || "").trim() : String(opts.de || "").trim();
    const ate = useDomFilters ? (financeFilterCaixaDataAte || "").trim() : String(opts.ate || "").trim();
    const tipoFilter = useDomFilters ? financeFilterCaixaTipo : opts.tipo || "";
    const plateNorm = useDomFilters
      ? financeNormalizePlate(financeFilterCaixaPlaca)
      : financeNormalizePlate(opts.placa || "");
    const rppId = useDomFilters ? (financeFilterCaixaRppId || "").trim() : String(opts.rppId || "").trim();
    if (de || ate) {
      movs = movs.filter((mov) => financeYmdInRange(financeCaixaMovCompetenciaYmd(mov), de, ate));
    }
    if (periodoYm) {
      movs = movs.filter((mov) => yearMonthFromYmd(financeCaixaMovCompetenciaYmd(mov)) === periodoYm);
    }
    if (tipoFilter === "entrada") {
      movs = movs.filter((mov) => financeCashIsEntrada(mov));
    } else if (tipoFilter === "saida") {
      movs = movs.filter((mov) => financeCashIsSaida(mov));
    }
    if (plateNorm) {
      movs = movs.filter((mov) => financeCashMovMatchesPlaca(mov, plateNorm));
    }
    if (rppId) {
      movs = movs.filter((mov) => financeCashMovMatchesRpp(mov, rppId));
    }
    return movs;
  }

  function financeUpdateCaixaTipoFilterUi() {
    const entradaBtn = document.getElementById("finCaixaFilterEntrada");
    const saidaBtn = document.getElementById("finCaixaFilterSaida");
    if (entradaBtn) {
      entradaBtn.classList.toggle("active", financeFilterCaixaTipo === "entrada");
      entradaBtn.setAttribute("aria-pressed", financeFilterCaixaTipo === "entrada" ? "true" : "false");
    }
    if (saidaBtn) {
      saidaBtn.classList.toggle("active", financeFilterCaixaTipo === "saida");
      saidaBtn.setAttribute("aria-pressed", financeFilterCaixaTipo === "saida" ? "true" : "false");
    }
  }

  function financeCaixaTotalsForMovs(movs) {
    let entradas = 0;
    let saidas = 0;
    movs.forEach((mov) => {
      const v = financeCashMovValor(mov);
      if (financeCashIsEntrada(mov)) entradas += v;
      else if (financeCashIsSaida(mov)) saidas += v;
    });
    return { entradas, saidas, saldo: entradas - saidas };
  }

  function financeSyncCaixaPeriodoFromDom() {
    financeSyncCaixaFiltersFromDom();
  }

  function financeRecebidoMesAtual() {
    return financeReceitasMesAtual();
  }

  function financeDespesasMesAtual(ym) {
    const periodoYm = ym || yearMonthFromYmd(financeTodayYmd());
    return financeCaixaMovsForPeriod(periodoYm, { useDomFilters: false })
      .filter((m) => financeCashIsSaida(m))
      .reduce((s, m) => s + financeCashMovValor(m), 0);
  }

  function financeReceitasMesAtual(ym) {
    const periodoYm = ym || yearMonthFromYmd(financeTodayYmd());
    return financeCaixaMovsForPeriod(periodoYm, { useDomFilters: false })
      .filter((m) => financeCashIsEntrada(m))
      .reduce((s, m) => s + financeCashMovValor(m), 0);
  }

  function financeEnsureCaixaPeriodoDefault() {
    const periodoEl = document.getElementById("finFilterPeriodo");
    if (!periodoEl || periodoEl.value) return;
    const fallback =
      typeof getOperationalMonth === "function"
        ? getOperationalMonth()
        : yearMonthFromYmd(financeTodayYmd());
    if (fallback) {
      periodoEl.value = fallback;
      financeFilterPeriodo = fallback;
    }
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
    const el = document.getElementById("finDashCards");
    if (!el) return;
    if (typeof window.financeDashboardRender === "function") {
      window.financeDashboardRender(
        {
          receivables: state.receivables || [],
          payables: state.payables || [],
          cash: state.cash || [],
          vehicles: state.vehicles || [],
          settings: state.settings || {},
        },
        { formatCurrency, escapeHtml }
      );
      return;
    }
    const m = financeMetrics();
    el.innerHTML = `
      <div class="fin-card fin-card--recv"><span class="fin-card-label">Total a receber</span><strong>${escapeHtml(formatCurrency(m.totalReceber))}</strong><small>${m.pendentes} pendente(s)</small></div>
      <div class="fin-card fin-card--pay"><span class="fin-card-label">Total a pagar</span><strong>${escapeHtml(formatCurrency(m.totalPagar))}</strong><small>${m.vencidas} vencida(s)</small></div>
      <div class="fin-card fin-card--month"><span class="fin-card-label">Entradas confirmadas</span><strong>${escapeHtml(formatCurrency(m.recebidoMes))}</strong><small>mês atual</small></div>
      <div class="fin-card fin-card--expense"><span class="fin-card-label">Despesas do mês</span><strong>${escapeHtml(formatCurrency(m.despesasMes))}</strong><small>saídas registradas</small></div>
      <div class="fin-card fin-card--saldo"><span class="fin-card-label">Saldo atual</span><strong>${escapeHtml(formatCurrency(m.saldo))}</strong><small>entradas − saídas</small></div>
      <div class="fin-card fin-card--gen"><span class="fin-card-label">Receita em geração</span><strong>${escapeHtml(formatCurrency(m.totalGeracao))}</strong><small>${m.veiculosPatio} no pátio</small></div>
      <div class="fin-card fin-card--late"><span class="fin-card-label">Contas vencidas</span><strong>${m.vencidas}</strong><small>${escapeHtml(formatCurrency(m.totalVencidas))}</small></div>
      <div class="fin-card fin-card--open"><span class="fin-card-label">Aguardando faturamento</span><strong>${m.aguardandoFaturamento}</strong><small>veículo(s) pós-saída</small></div>
      <div class="fin-card fin-card--today"><span class="fin-card-label">Vencendo hoje</span><strong>${m.venceHoje}</strong><small>${m.proximas} nos próximos 7 dias</small></div>
    `;
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
    financeSyncReceberFiltersFromDom();
    financeSyncReceberDateFiltersFromDom();
    financeSyncReceberFilterHint();
    const body = document.getElementById("finReceberBody");
    const totalEl = document.getElementById("finReceberTotal");
    if (!body) return;
    const vmap = financeVehicleById();
    const list = financeContasReceberList();
    const plateFilter = financeNormalizePlate(financeFilterReceberPlaca);
    const hasOtherFilters =
      plateFilter ||
      !!(financeFilterReceberRppId || "").trim() ||
      !!(financeFilterBanco || "").trim() ||
      !!financeFilterStatus ||
      !!financeFilterTipo ||
      !!(financeFilterReceberDataDe || financeFilterReceberDataAte);
    if (totalEl) totalEl.textContent = formatCurrency(list.reduce((s, r) => s + Number(r.valor || 0), 0));
    if (!list.length) {
      financePruneRowSelection("receber", []);
      financeUpdateBatchBar("receber");
      body.innerHTML = `<tr><td colspan="8" class="notice">${
        hasOtherFilters
          ? "Nenhuma conta a receber com os filtros informados (placa, RPP, busca, tipo, status e/ou datas)."
          : "Nenhuma conta a receber pendente. Cadastre mensalistas em «+ Nova receita» (tipo Recorrente) ou veja «Aguardando faturamento»."
      }</td></tr>`;
      return;
    }
    financePruneRowSelection(
      "receber",
      list.map((r) => r.id)
    );
    body.innerHTML = list
      .map((r) => {
        const v = vmap.get(r.vehicle_id);
        const st = financeReceivableDisplayStatus(r);
        const due = financeContaDueYmd(r, "receivable");
        const isManual = financeIsManualReceivable(r);
        const origemHtml = escapeHtml(financeReceivableOrigemCellText(r, v));
        const descricaoHtml = financeReceivableDescricaoCellHtml(r, v);
        const rppHtml = escapeHtml(financeReceberRppNome(r, v));
        const actionsHtml = financeRowActionsHtml("receber", r.id, {
          canPay: st !== "Recebido",
          canCaixa: st === "Recebido" && !financeReceivableHasCaixa(r.id),
        });
        const rowSel = financeRowIsSelected("receber", r.id) ? " fin-row-selected" : "";
        return `<tr class="${rowSel.trim()}">
          ${financeRowCheckCell("receber", r.id)}
          <td data-label="Origem">${origemHtml}</td>
          <td data-label="Descrição">${descricaoHtml}</td>
          <td data-label="RPP">${rppHtml}</td>
          <td data-label="Valor">${escapeHtml(formatCurrency(Number(r.valor || 0)))}</td>
          <td data-label="Vencimento">${escapeHtml(due ? formatDate(due) : "—")}</td>
          <td data-label="Status"><span class="${financeReceivableStatusClass(st)}">${escapeHtml(st)}</span></td>
          <td data-label="Ações">${actionsHtml}</td>
        </tr>`;
      })
      .join("");
    financeUpdateBatchBar("receber");
  }

  function financeRenderAguardando() {
    financeSyncAguardandoFiltersFromDom();
    const body = document.getElementById("finAguardandoBody");
    const totalEl = document.getElementById("finAguardandoTotal");
    if (!body) return;
    financeSyncAguardandoFilterHint();
    const vmap = financeVehicleById();
    const list = financeContasAguardandoFilteredList();
    const plateFilter = financeNormalizePlate(financeFilterAguardandoPlaca);
    const rppFilter = !!(financeFilterAguardandoRppId || "").trim();
    const periodoFilter = (financeFilterAguardandoPeriodo || "").trim();
    const dataFilter = !!(financeFilterAguardandoDataDe || financeFilterAguardandoDataAte);
    if (totalEl) totalEl.textContent = formatCurrency(list.reduce((s, r) => s + Number(r.valor || 0), 0));
    if (!list.length) {
      financePruneRowSelection("aguardando", []);
      financeUpdateBatchBar("aguardando");
      body.innerHTML = `<tr><td colspan="7" class="notice">${
        plateFilter || rppFilter || periodoFilter || dataFilter
          ? "Nenhum veículo aguardando faturamento com os filtros informados (placa, RPP, mês e/ou datas)."
          : "Nenhum veículo aguardando faturamento. Após saída (VRP), o registro aparece aqui até ir para Contas a receber."
      }</td></tr>`;
      return;
    }
    financePruneRowSelection(
      "aguardando",
      list.map((r) => r.id)
    );
    body.innerHTML = list
      .map((r) => {
        const v = vmap.get(r.vehicle_id);
        const saida = v?.data_saida || r.period_end;
        const rowSel = financeRowIsSelected("aguardando", r.id) ? " fin-row-selected" : "";
        return `<tr class="${rowSel.trim()}">
          ${financeRowCheckCell("aguardando", r.id)}
          <td data-label="Veículo / RPV"><strong>${escapeHtml(v?.placa || "—")}</strong><br /><span class="notice">${escapeHtml([v?.marca, v?.modelo].filter(Boolean).join(" ") || "—")}</span><br /><span class="notice">RPV: ${escapeHtml(financeVehicleRpvNome(v))}</span></td>
          <td data-label="RPP">${escapeHtml(financeReceberRppNome(r, v))}</td>
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
    financeUpdateBatchBar("aguardando");
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
      financePruneRowSelection("pagar", []);
      financeUpdateBatchBar("pagar");
      const total = (state.payables || []).length;
      body.innerHTML = `<tr><td colspan="11" class="notice">Nenhuma despesa com os filtros atuais.${total ? ` (${total} no total — limpe filtros ou clique Atualizar)` : " Cadastre em + Nova despesa."}</td></tr>`;
      return;
    }
    financePruneRowSelection(
      "pagar",
      list.map((p) => p.id)
    );
    body.innerHTML = list
      .map((p) => {
        const st = financePayableDisplayStatus(p);
        const due = financeContaDueYmd(p, "payable");
        const hasCash =
          typeof window.payableCashMovementExists === "function" && window.payableCashMovementExists(p.id);
        const actionsHtml = financeRowActionsHtml("pagar", p.id, {
          canPay: st !== "Pago",
          canCaixa: st === "Pago" && !hasCash,
        });
        const rowSel = financeRowIsSelected("pagar", p.id) ? " fin-row-selected" : "";
        return `<tr class="${rowSel.trim()}">
          ${financeRowCheckCell("pagar", p.id)}
          <td data-label="Fornecedor">${escapeHtml(financePayableTypedFields(p).fornecedor)}</td>
          <td data-label="Descrição">${escapeHtml(financePayableTypedFields(p).descricao)}</td>
          <td data-label="Categoria">${escapeHtml(payableCategoryLabel(p.payable_category))}</td>
          <td data-label="Tipo">${financeEntryTipoBadgeHtml(p, "payable")}</td>
          <td data-label="Valor">${escapeHtml(formatCurrency(Number(p.valor || 0)))}</td>
          <td data-label="Vencimento">${escapeHtml(due ? formatDate(due) : "—")}</td>
          <td data-label="Forma">${escapeHtml(p.forma_pagamento || "—")}</td>
          <td data-label="Conta">${escapeHtml(financePayableContaBancaria(p))}</td>
          <td data-label="Status"><span class="${financePayableStatusClass(st)}">${escapeHtml(st)}</span></td>
          <td data-label="Ações">${actionsHtml}</td>
        </tr>`;
      })
      .join("");
    financeUpdateBatchBar("pagar");
  }

  function financeMovContaLabel(m) {
    if (m.tipo_conta === "RECEBER") {
      const rec = (state.receivables || []).find((r) => String(r.id) === String(m.conta_id));
      return state.settings?.conta_bancaria || "Caixa";
    }
    const pay = (state.payables || []).find((p) => String(p.id) === String(m.conta_id));
    return pay ? financePayableContaBancaria(pay) : state.settings?.conta_bancaria || "Caixa";
  }

  function financeCashPaganteLabel(mov, rec, pay, vehicle) {
    if (financeCashIsEntrada(mov)) {
      if (rec) {
        if (financeIsManualReceivable(rec)) {
          return financeQuemPagouCaixa(mov, rec);
        }
        const rpp = financeReceberRppNome(rec, vehicle);
        if (rpp && rpp !== "—") return financeStripFinmeta(rpp);
        return financeCaixaEntradaLabels(mov, rec).pagante;
      }
      return financeStripFinmeta(mov?.descricao) || "—";
    }
    if (financeCashIsSaida(mov)) {
      const raw = pay?.fornecedor || pay?.descricao || "—";
      if (typeof financeMetaUnpack === "function" && typeof financePayableMetaText === "function") {
        const { text } = financeMetaUnpack(financePayableMetaText(pay));
        if (text) return financeStripFinmeta(text);
      }
      return financeStripFinmeta(raw);
    }
    return "—";
  }

  function financeCountPaidReceivablesSemCaixa() {
    return financePaidReceivablesSemCaixa().length;
  }

  let financeCaixaMissingSyncPromise = null;

  async function financeSyncMissingPayablesCashSilent() {
    /* Saídas de caixa para contas a pagar são registradas manualmente (botão Caixa). */
    return;
  }

  async function financePurgeAutoPayablesOnce() {
    const key = "finance_purge_auto_payables_v1";
    try {
      if (localStorage.getItem(key) === "1") return { skipped: true };
    } catch (e) {
      /* ignore */
    }
    const uid = typeof effectiveUserId === "function" ? effectiveUserId() : null;
    if (!uid) return { skipped: true };
    const keepManualFromYmd = financeTodayYmd();
    try {
      const resp = await fetch("/api/finance/cleanup-auto-payables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid, keepManualFromYmd }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        console.warn("financePurgeAutoPayablesOnce", data?.error || resp.status);
        return { ok: false, error: data?.error };
      }
      try {
        localStorage.setItem(key, "1");
      } catch (e) {
        /* ignore */
      }
      if (typeof loadPayables === "function") await loadPayables();
      if (typeof loadCash === "function") await loadCash();
      return { ok: true, stats: data?.stats };
    } catch (e) {
      console.warn("financePurgeAutoPayablesOnce", e?.message || e);
      return { ok: false, error: e?.message || String(e) };
    }
  }

  async function financePurgeOldPayablesOnce() {
    const key = "finance_purge_old_payables_v2";
    try {
      if (localStorage.getItem(key) === "1") return { skipped: true };
    } catch (e) {
      /* ignore */
    }
    const uid = typeof effectiveUserId === "function" ? effectiveUserId() : null;
    if (!uid) return { skipped: true };
    const keepFromYm =
      typeof getOperationalMonth === "function"
        ? getOperationalMonth()
        : yearMonthFromYmd(financeTodayYmd());
    try {
      const resp = await fetch("/api/finance/cleanup-old-payables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid, keepFromYm }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        console.warn("financePurgeOldPayablesOnce", data?.error || resp.status);
        return { ok: false, error: data?.error };
      }
      try {
        localStorage.setItem(key, "1");
      } catch (e) {
        /* ignore */
      }
      if (typeof loadPayables === "function") await loadPayables();
      if (typeof loadCash === "function") await loadCash();
      return { ok: true, stats: data?.stats };
    } catch (e) {
      console.warn("financePurgeOldPayablesOnce", e?.message || e);
      return { ok: false, error: e?.message || String(e) };
    }
  }

  async function financeEnsureMissingCashInCaixa() {
    if (financeOperationalModeActive()) return;
    if (!financeCaixaMissingSyncPromise) {
      financeCaixaMissingSyncPromise = (async () => {
        try {
          if (typeof loadPayables === "function") await loadPayables();
          if (typeof loadCash === "function") await loadCash();
        } catch (e) {
          console.warn("financeEnsureMissingCashInCaixa", e?.message || e);
        }
      })();
    }
    return financeCaixaMissingSyncPromise;
  }

  /** VRP abr/mai 2026 — placa + valor + saída (+ pagamento para desambiguar VIP Polo). */
  const FINANCE_VRP_CAIXA_RECOVERY_ENTRIES = [
    { plate: "SHT9J35", valor: 60, saidaDate: "2026-05-26", paidDate: "2026-05-29" },
    { plate: "QLC1E25", valor: 60, saidaDate: "2026-05-26", paidDate: "2026-05-28" },
    { plate: "CFZ3J00", valor: 200, saidaDate: "2026-05-26", paidDate: "2026-05-29" },
    { plate: "PGQ3I89", valor: 210, saidaDate: "2026-05-22", paidDate: "2026-05-28" },
    { plate: "SOK3G87", valor: 105, saidaDate: "2026-05-22", paidDate: "2026-05-29" },
    { plate: "PDV8F14", valor: 210, saidaDate: "2026-05-22", paidDate: "2026-05-28" },
    { plate: "PCC5J55", valor: 120, saidaDate: "2026-05-21", paidDate: "2026-05-25" },
    { plate: "SOT1H11", valor: 200, saidaDate: "2026-05-21", paidDate: "2026-05-29" },
    { plate: "SOP9J15", valor: 105, saidaDate: "2026-05-20", paidDate: "2026-05-26" },
    { plate: "RUS0B38", valor: 180, saidaDate: "2026-05-20", paidDate: "2026-05-25" },
    { plate: "SHB6H60", valor: 30, saidaDate: "2026-05-19", paidDate: "2026-05-19" },
    { plate: "SOY9E09", valor: 90, saidaDate: "2026-05-19", paidDate: "2026-05-21" },
    { plate: "PZO7C79", valor: 330, saidaDate: "2026-05-18", paidDate: "2026-05-29" },
    { plate: "QLI9J77", valor: 60, saidaDate: "2026-05-18", paidDate: "2026-05-20" },
    { plate: "UHM0A38", valor: 250, saidaDate: "2026-05-16", paidDate: "2026-05-25" },
    { plate: "PDW3A12", valor: 330, saidaDate: "2026-05-14", paidDate: "2026-05-25" },
    { plate: "SOH9F30", valor: 140, saidaDate: "2026-05-13", paidDate: "2026-05-27" },
    { plate: "PCM9G77", valor: 150, saidaDate: "2026-05-08", paidDate: "2026-05-12" },
    { plate: "QQN9E59", valor: 60, saidaDate: "2026-05-07", paidDate: "2026-05-08" },
    { plate: "RNG8B19", valor: 75, saidaDate: "2026-05-05", paidDate: "2026-05-08" },
    { plate: "PDR7B60", valor: 90, saidaDate: "2026-05-05", paidDate: "2026-05-08" },
    { plate: "SOF0G64", valor: 90, saidaDate: "2026-05-05", paidDate: "2026-05-08" },
    { plate: "RZK5J04", valor: 90, saidaDate: "2026-05-05", paidDate: "2026-05-08" },
    { plate: "SOX5F86", valor: 330, saidaDate: "2026-05-04", paidDate: "2026-05-25" },
    { plate: "SFV6B80", valor: 800, saidaDate: "2026-05-03", paidDate: "2026-05-11" },
    { plate: "RTM1I82", valor: 600, saidaDate: "2026-04-30", paidDate: "2026-05-20" },
    { plate: "QPO2F05", valor: 150, saidaDate: "2026-04-30", paidDate: "2026-05-04" },
    { plate: "SNO9B38", valor: 210, saidaDate: "2026-04-30", paidDate: "2026-05-06" },
    { plate: "SNO8G48", valor: 240, saidaDate: "2026-04-30", paidDate: "2026-05-08" },
    { plate: "SNO9D08", valor: 210, saidaDate: "2026-04-30", paidDate: "2026-05-06" },
    { plate: "SNO8G38", valor: 240, saidaDate: "2026-04-30", paidDate: "2026-05-08" },
    { plate: "SNO7I98", valor: 210, saidaDate: "2026-04-30", paidDate: "2026-05-06" },
    { plate: "SNO8H38", valor: 210, saidaDate: "2026-04-30", paidDate: "2026-05-06" },
    { plate: "SNO8H58", valor: 210, saidaDate: "2026-04-30", paidDate: "2026-05-06" },
    { plate: "SNO8E98", valor: 210, saidaDate: "2026-04-30", paidDate: "2026-05-06" },
    { plate: "SNO8C88", valor: 210, saidaDate: "2026-04-30", paidDate: "2026-05-06" },
    { plate: "SNO8D68", valor: 210, saidaDate: "2026-04-30", paidDate: "2026-05-06" },
    { plate: "SNO8G68", valor: 210, saidaDate: "2026-04-30", paidDate: "2026-05-06" },
    { plate: "SNO7F38", valor: 210, saidaDate: "2026-04-30", paidDate: "2026-05-06" },
    { plate: "SNO9A58", valor: 210, saidaDate: "2026-04-30", paidDate: "2026-05-06" },
    { plate: "SNO8E38", valor: 210, saidaDate: "2026-04-30", paidDate: "2026-05-06" },
    { plate: "RZZ1J57", valor: 150, saidaDate: "2026-04-29", paidDate: "2026-05-04" },
    { plate: "PGL3H13", valor: 300, saidaDate: "2026-04-29", paidDate: "2026-05-08" },
    { plate: "HXR1I28", valor: 240, saidaDate: "2026-04-28", paidDate: "2026-05-06" },
    { plate: "PDI2C97", valor: 330, saidaDate: "2026-04-27", paidDate: "2026-05-08" },
    { plate: "PDM4C51", valor: 240, saidaDate: "2026-04-27", paidDate: "2026-05-05" },
    { plate: "SOL5I69", valor: 465, saidaDate: "2026-04-24", paidDate: "2026-05-25" },
    { plate: "RZV1B76", valor: 360, saidaDate: "2026-04-24", paidDate: "2026-05-05" },
    { plate: "QYX2D91", valor: 300, saidaDate: "2026-04-23", paidDate: "2026-05-08" },
    { plate: "QXM8G83", valor: 630, saidaDate: "2026-04-15", paidDate: "2026-05-06" },
    { plate: "RII2H22", valor: 690, saidaDate: "2026-04-14", paidDate: "2026-05-29" },
    { plate: "PDW8260", valor: 375, saidaDate: "2026-04-09", paidDate: "2026-05-04" },
    { plate: "SNY4J16", valor: 420, saidaDate: "2026-04-07", paidDate: "2026-05-04" },
    { plate: "SOQ9C44", valor: 585, saidaDate: "2026-03-27", paidDate: "2026-05-04" },
    { plate: "RZS1C42", valor: 960, saidaDate: "2026-03-23", paidDate: "2026-05-25" },
    { plate: "QYA5C45", valor: 795, saidaDate: "2026-03-13", paidDate: "2026-05-04" },
    { plate: "SOW4G62", valor: 795, saidaDate: "2026-03-13", paidDate: "2026-05-04" },
    { plate: "SNZ7F17", valor: 900, saidaDate: "2026-03-06", paidDate: "2026-05-04" },
  ];
  const FINANCE_MAY_2026_VRP_RECOVERY = FINANCE_VRP_CAIXA_RECOVERY_ENTRIES;
  /** Lista VRP: pagamentos sem caixa → voltar para Aguardando faturamento e dar baixa de novo. */
  const FINANCE_REVERT_TO_AGUARDANDO_ENTRIES = FINANCE_VRP_CAIXA_RECOVERY_ENTRIES;

  /** Pagos com R$ 0,00 — recalcular valor, manter PAGO e registrar entrada no caixa. */
  const FINANCE_ZERO_VALOR_PAGO_FIX_ENTRIES = [
    { plate: "QLC1E25", valor: 0, saidaDate: "2026-05-28", paidDate: "2026-06-01", includeZeroValor: true },
    { plate: "QYP9F00", valor: 0, saidaDate: "2026-04-02", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "QPO2F05", valor: 0, saidaDate: "2026-05-04", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "QQN9E59", valor: 0, saidaDate: "2026-05-08", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "SHB6H60", valor: 0, saidaDate: "2026-05-19", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "KKY4389", valor: 0, saidaDate: "2026-04-13", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "QKQ9348", valor: 0, saidaDate: "2026-04-29", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "SNZ7F17", valor: 0, saidaDate: "2026-05-04", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "SOW4G62", valor: 0, saidaDate: "2026-05-04", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "QYA5C45", valor: 0, saidaDate: "2026-05-04", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "SOQ9C44", valor: 0, saidaDate: "2026-05-04", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "SNY4J16", valor: 0, saidaDate: "2026-05-04", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "PDW8260", valor: 0, saidaDate: "2026-05-04", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "UHM8D60", valor: 0, saidaDate: "2026-04-28", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "SNN5A22", valor: 0, saidaDate: "2026-04-30", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "SIZ4F67", valor: 0, saidaDate: "2026-05-28", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "FCI1J96", valor: 0, saidaDate: "2026-03-26", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "PGR8747", valor: 0, saidaDate: "2026-03-25", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "PCG7556", valor: 0, saidaDate: "2026-02-20", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "PDY4F95", valor: 0, saidaDate: "2026-05-04", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "PDW9D44", valor: 0, saidaDate: "2026-03-04", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "RTL3G87", valor: 0, saidaDate: "2026-04-20", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "PDA8420", valor: 0, saidaDate: "2026-04-20", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "QYR1E87", valor: 0, saidaDate: "2026-04-16", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "QQK8J81", valor: 0, saidaDate: "2026-03-10", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "DSF7D74", valor: 0, saidaDate: "2026-02-05", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "SNO8E38", valor: 0, saidaDate: "2026-04-30", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "SNO9A58", valor: 0, saidaDate: "2026-04-30", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "SNO8G68", valor: 0, saidaDate: "2026-04-30", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "SNO7F38", valor: 0, saidaDate: "2026-04-30", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "SNO8D68", valor: 0, saidaDate: "2026-04-30", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "SNO8C88", valor: 0, saidaDate: "2026-04-30", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "SNO8E98", valor: 0, saidaDate: "2026-04-30", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "SNO8H58", valor: 0, saidaDate: "2026-04-30", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "SNO7I98", valor: 0, saidaDate: "2026-04-30", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "SNO8H38", valor: 0, saidaDate: "2026-04-30", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "SNO8G38", valor: 0, saidaDate: "2026-04-30", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "SNO8G48", valor: 0, saidaDate: "2026-04-30", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "SNO9B38", valor: 0, saidaDate: "2026-04-30", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "SNO8G38", valor: 0, saidaDate: "2026-05-08", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "SNO9B38", valor: 0, saidaDate: "2026-05-06", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "SNO9D08", valor: 0, saidaDate: "2026-05-06", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "SNO7I98", valor: 0, saidaDate: "2026-05-06", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "SNO8H58", valor: 0, saidaDate: "2026-05-06", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "SNO8D68", valor: 0, saidaDate: "2026-05-06", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "SNO7F38", valor: 0, saidaDate: "2026-05-06", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "SNO9A58", valor: 0, saidaDate: "2026-05-06", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "SNO8E38", valor: 0, saidaDate: "2026-05-06", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "SNO8E98", valor: 0, saidaDate: "2026-05-06", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "SNO8C88", valor: 0, saidaDate: "2026-05-06", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "SNO8H38", valor: 0, saidaDate: "2026-05-06", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "SNO8G68", valor: 0, saidaDate: "2026-05-06", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "SNO8G48", valor: 0, saidaDate: "2026-05-08", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "SUH6B38", valor: 0, saidaDate: "2026-03-24", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "RZQ8E78", valor: 0, saidaDate: "2026-02-20", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "RUV2E49", valor: 0, saidaDate: "2026-03-03", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "PEC2H21", valor: 0, saidaDate: "2026-02-20", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "MZE8942", valor: 0, saidaDate: "2026-03-03", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "NME8J96", valor: 0, saidaDate: "2026-03-03", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "PFZ0A85", valor: 0, saidaDate: "2026-03-03", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "PFS0240", valor: 0, saidaDate: "2026-03-03", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "RZQ8B88", valor: 0, saidaDate: "2026-04-16", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "SHU2G14", valor: 0, saidaDate: "2026-04-10", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "QYT3D79", valor: 0, saidaDate: "2026-04-06", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "END3I82", valor: 0, saidaDate: "2026-03-25", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "RZL7E72", valor: 0, saidaDate: "2026-04-02", paidDate: "2026-05-28", includeZeroValor: true },
    { plate: "SHB8A03", valor: 0, saidaDate: "2026-04-29", paidDate: "2026-05-26", includeZeroValor: true },
    { plate: "QYW3D26", valor: 0, saidaDate: "2026-04-23", paidDate: "2026-05-26", includeZeroValor: true },
    { plate: "RFW4F34", valor: 0, saidaDate: "2026-04-23", paidDate: "2026-05-26", includeZeroValor: true },
    { plate: "PGQ2H63", valor: 0, saidaDate: "2026-04-23", paidDate: "2026-05-26", includeZeroValor: true },
    { plate: "RTM1I82", valor: 0, saidaDate: "2026-05-20", paidDate: "2026-05-20", includeZeroValor: true },
    { plate: "SFV6B80", valor: 0, saidaDate: "2026-05-11", paidDate: "2026-05-11", includeZeroValor: true },
    { plate: "QYE7E85", valor: 0, saidaDate: "2026-05-04", paidDate: "2026-05-08", includeZeroValor: true },
  ];

  function financeNormalizePlateKey(p) {
    return String(p || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  function financeYmdWithinDays(a, b, days = 1) {
    if (!a || !b) return false;
    if (a === b) return true;
    const da = new Date(`${a}T12:00:00`).getTime();
    const db = new Date(`${b}T12:00:00`).getTime();
    if (!Number.isFinite(da) || !Number.isFinite(db)) return false;
    return Math.abs(da - db) / 86400000 <= days;
  }

  function financePickReceivableForPlateEntry(entry, excludeIds = new Set()) {
    const plateKey = financeNormalizePlateKey(entry.plate);
    const vehicleIds = new Set(
      (state.vehicles || [])
        .filter((v) => financeNormalizePlateKey(v.placa) === plateKey)
        .map((v) => String(v.id))
    );
    if (!vehicleIds.size) return null;
    const ymd = typeof toLocalYmd === "function" ? toLocalYmd : (v) => String(v || "").slice(0, 10);
    let candidates = (state.receivables || []).filter(
      (r) =>
        r?.id &&
        vehicleIds.has(String(r.vehicle_id)) &&
        r.period_end &&
        !excludeIds.has(String(r.id)) &&
        (entry.includeZeroValor || entry.valor === 0 || Number(r.valor || 0) > 0)
    );
    if (entry.valor != null && entry.valor > 0) {
      const byValor = candidates.filter((r) => Math.abs(Number(r.valor || 0) - Number(entry.valor)) < 0.01);
      if (byValor.length) candidates = byValor;
    } else if (entry.includeZeroValor || entry.valor === 0) {
      const byZero = candidates.filter((r) => Math.abs(Number(r.valor || 0)) < 0.01);
      if (byZero.length) candidates = byZero;
    }
    const saidaYmd = entry.saidaDate ? ymd(entry.saidaDate) : null;
    const paidYmd = entry.paidDate ? ymd(entry.paidDate) : null;
    if (saidaYmd) {
      const bySaida = candidates.filter((r) => {
        if (ymd(r.period_end) === saidaYmd) return true;
        const v = (state.vehicles || []).find((x) => String(x.id) === String(r.vehicle_id));
        return v?.data_saida && ymd(v.data_saida) === saidaYmd;
      });
      if (bySaida.length) candidates = bySaida;
    }
    if (paidYmd && candidates.length > 1) {
      const byPaid = candidates.filter((r) => {
        const payYmd = ymd(r.updated_at || r.period_end);
        return payYmd === paidYmd || financeYmdWithinDays(payYmd, paidYmd);
      });
      if (byPaid.length) candidates = byPaid;
    } else if (!saidaYmd && paidYmd) {
      const byPaid = candidates.filter((r) => {
        const payYmd = ymd(r.updated_at || r.period_end);
        const endYmd = ymd(r.period_end);
        return payYmd === paidYmd || endYmd === paidYmd || financeYmdWithinDays(payYmd, paidYmd);
      });
      if (byPaid.length) candidates = byPaid;
    }
    candidates.sort((a, b) => {
      const aPaid = String(a.status || "").toUpperCase() === "PAGO" ? 1 : 0;
      const bPaid = String(b.status || "").toUpperCase() === "PAGO" ? 1 : 0;
      if (bPaid !== aPaid) return bPaid - aPaid;
      return String(b.period_end || "").localeCompare(String(a.period_end || ""));
    });
    return candidates[0] || null;
  }

  async function financeDeleteCashForReceivableClient(receivableId) {
    const uid = typeof effectiveUserId === "function" ? effectiveUserId() : null;
    if (!uid || !receivableId || typeof supabase === "undefined") return 0;
    let removed = 0;
    const runDel = (q) => (typeof runSupabaseWrite === "function" ? runSupabaseWrite(q) : q());
    const { data: movs } = await supabase
      .from("cash_movements")
      .select("id,tipo_conta")
      .eq("user_id", uid)
      .eq("conta_id", receivableId);
    for (const mov of movs || []) {
      const t = String(mov?.tipo_conta || "").toUpperCase();
      if (t !== "RECEBER" && t !== "ENTRADA") continue;
      const { error } = await runDel(() =>
        supabase.from("cash_movements").delete().eq("id", mov.id).eq("user_id", uid)
      );
      if (!error) removed += 1;
    }
    return removed;
  }

  function financeRecalcReceivableValorForRevert(rec) {
    const v = (state.vehicles || []).find((x) => String(x.id) === String(rec?.vehicle_id));
    if (typeof receivableFinanceBreakdown === "function") {
      const b = receivableFinanceBreakdown(rec, v);
      const t = Number(b?.total ?? 0);
      if (t > 0) return t;
    }
    if (v && typeof calcPeriodTotal === "function") {
      const t = Number(calcPeriodTotal(v, rec.period_start, rec.period_end) || 0);
      if (t > 0) return t;
    }
    return Number(rec?.valor || 0);
  }

  function financeLookupExpectedValorForEntry(entry) {
    const plateKey = financeNormalizePlateKey(entry?.plate);
    const ymd = typeof toLocalYmd === "function" ? toLocalYmd : (v) => String(v || "").slice(0, 10);
    const saidaYmd = entry?.saidaDate ? ymd(entry.saidaDate) : null;
    const matches = FINANCE_VRP_CAIXA_RECOVERY_ENTRIES.filter(
      (e) => financeNormalizePlateKey(e.plate) === plateKey && Number(e.valor || 0) > 0
    );
    if (!matches.length) return null;
    if (saidaYmd) {
      const exact = matches.find((e) => ymd(e.saidaDate) === saidaYmd);
      if (exact) return Number(exact.valor);
    }
    if (matches.length === 1) return Number(matches[0].valor);
    return null;
  }

  function financeResolveValorForZeroFix(rec, entry = {}) {
    const recalc = financeRecalcReceivableValorForRevert(rec);
    if (recalc > 0) return recalc;
    const expected = financeLookupExpectedValorForEntry(entry);
    return expected != null && expected > 0 ? expected : 0;
  }

  async function financeFixZeroValorPagoClientSide(rec, entry = {}) {
    if (!rec?.id) return { ok: false, error: "no_rec", action: "failed" };
    if (String(rec.status || "").toUpperCase() !== "PAGO") {
      return { ok: false, error: "not_pago", action: "failed" };
    }
    const uid = typeof effectiveUserId === "function" ? effectiveUserId() : null;
    if (!uid) return { ok: false, error: "no_user", action: "failed" };
    if (typeof requireSupabaseSessionForWrite === "function" && !(await requireSupabaseSessionForWrite())) {
      return { ok: false, error: "no_session", action: "failed" };
    }
    const valorNovo = financeResolveValorForZeroFix(rec, entry);
    if (!(valorNovo > 0)) {
      return { ok: false, error: "valor_still_zero", action: "failed" };
    }
    const valorAtual = Number(rec.valor || 0);
    const needsValorUpdate = valorAtual < 0.01 || Math.abs(valorAtual - valorNovo) > 0.01;
    if (needsValorUpdate) {
      const runUpd = (body) =>
        typeof runSupabaseWrite === "function"
          ? runSupabaseWrite(() => supabase.from("receivables").update(body).eq("id", rec.id).eq("user_id", uid))
          : supabase.from("receivables").update(body).eq("id", rec.id).eq("user_id", uid);
      const { error } = await runUpd({ valor: valorNovo });
      if (error) return { ok: false, error: error.message, action: "failed" };
      rec.valor = valorNovo;
    }
    if (financeReceivableHasCaixa(rec.id)) {
      return { ok: true, action: "valor_only", valorFixed: needsValorUpdate };
    }
    const ymd = typeof toLocalYmd === "function" ? toLocalYmd : (v) => String(v || "").slice(0, 10);
    const dataMov =
      (entry.paidDate ? ymd(entry.paidDate) : null) ||
      ymd(rec.updated_at || rec.period_end || rec.created_at) ||
      ymd(new Date().toISOString());
    const vehicle = (state.vehicles || []).find((v) => String(v.id) === String(rec.vehicle_id));
    const cashResult = await registerReceivableCashMovement(rec, {
      valor: valorNovo,
      dataMovimento: dataMov,
      vehicle,
    });
    if (cashResult.error && !financeReceivableHasCaixa(rec.id)) {
      return { ok: false, error: cashResult.error?.message || "cash_failed", action: "failed", valorFixed: needsValorUpdate };
    }
    return { ok: true, action: "fixed", valorFixed: needsValorUpdate, cashCreated: true };
  }

  async function financeFixZeroValorPagoClientBatch(entries) {
    if (typeof loadReceivables === "function") await loadReceivables();
    if (typeof loadCash === "function") await loadCash();
    const seen = new Set();
    let fixed = 0;
    let valorOnly = 0;
    let failed = 0;
    let skipped = 0;
    const notFound = [];
    const notFoundEntries = [];
    for (const entry of entries) {
      const rec = financePickReceivableForPlateEntry(entry, seen);
      if (!rec) {
        notFound.push(`${entry.plate} saída ${entry.saidaDate ?? "?"} pago ${entry.paidDate ?? "?"}`);
        notFoundEntries.push(entry);
        continue;
      }
      seen.add(String(rec.id));
      const st = String(rec.status || "").toUpperCase();
      if (st !== "PAGO") {
        failed += 1;
        notFound.push(`${entry.plate}: status ${st} (esperado PAGO)`);
        continue;
      }
      if (Number(rec.valor || 0) > 0 && financeReceivableHasCaixa(rec.id)) {
        skipped += 1;
        continue;
      }
      const result = await financeFixZeroValorPagoClientSide(rec, entry);
      if (result.action === "fixed") fixed += 1;
      else if (result.action === "valor_only") valorOnly += 1;
      else {
        failed += 1;
        notFound.push(`${entry.plate}: ${result.error || "falha"}`);
      }
    }
    if (typeof loadReceivables === "function") await loadReceivables();
    if (typeof loadCash === "function") await loadCash();
    return { fixed, valorOnly, failed, skipped, notFound, notFoundEntries };
  }

  async function financeFixZeroValorPagoViaApi(payload, ui = {}) {
    const btn = ui.btnId ? document.getElementById(ui.btnId) : null;
    const hint = ui.hintId ? document.getElementById(ui.hintId) : null;
    const prev = btn?.textContent;
    if (btn) {
      btn.disabled = true;
      if (ui.btnBusy) btn.textContent = ui.btnBusy;
    }
    let stats = { fixed: 0, valorOnly: 0, failed: 0, skipped: 0 };
    let notFound = [];
    try {
      const entries = payload.fixEntries || FINANCE_ZERO_VALOR_PAGO_FIX_ENTRIES;
      if (!entries.length) throw new Error("Lista vazia para correção.");
      const batch = await financeFixZeroValorPagoClientBatch(entries);
      stats = {
        fixed: batch.fixed,
        valorOnly: batch.valorOnly,
        failed: batch.failed,
        skipped: batch.skipped,
      };
      notFound = batch.notFound || [];
      if (typeof loadReceivables === "function") await loadReceivables();
      if (typeof loadCash === "function") await loadCash();
      if (hint) {
        const parts = [];
        if (stats.fixed > 0) parts.push(`${stats.fixed} corrigido(s) com entrada no caixa`);
        if (stats.valorOnly > 0) parts.push(`${stats.valorOnly} valor(es) atualizado(s) (já tinha caixa)`);
        if (stats.skipped > 0) parts.push(`${stats.skipped} já ok`);
        if (stats.failed > 0) parts.push(`${stats.failed} falha(s)`);
        if (notFound.length) {
          parts.push(
            `${notFound.length} não corrigido(s): ${notFound.slice(0, 5).join("; ")}${notFound.length > 5 ? "…" : ""}`
          );
        }
        hint.textContent = parts.length
          ? `Correção concluída: ${parts.join(", ")}.`
          : "Nenhum registro foi corrigido.";
        hint.classList.remove("hidden");
      }
      if (typeof renderFinance === "function") renderFinance();
      return stats;
    } catch (e) {
      console.warn("financeFixZeroValorPagoViaApi", e?.message || e);
      if (hint) {
        hint.textContent = e?.message || "Não foi possível corrigir os registros agora.";
        hint.classList.remove("hidden");
      }
      return stats;
    } finally {
      if (typeof ui.onDone === "function") ui.onDone();
      if (btn) {
        btn.disabled = false;
        btn.textContent = prev || ui.btnDefault || btn.textContent;
      }
    }
  }

  async function financeRevertReceivableClientSide(rec) {
    if (!rec?.id || String(rec.status || "").toUpperCase() !== "PAGO") {
      return { ok: false, error: "not_pago" };
    }
    const uid = typeof effectiveUserId === "function" ? effectiveUserId() : null;
    if (!uid) return { ok: false, error: "no_user" };
    if (typeof requireSupabaseSessionForWrite === "function" && !(await requireSupabaseSessionForWrite())) {
      return { ok: false, error: "no_session" };
    }
    const aguardando =
      typeof RECEIVABLE_AGUARDANDO_LANCAMENTO !== "undefined" ? RECEIVABLE_AGUARDANDO_LANCAMENTO : "AGUARDANDO_LANCAMENTO";
    const cashRemoved = await financeDeleteCashForReceivableClient(rec.id);
    const valorRestaurado = financeRecalcReceivableValorForRevert(rec);
    const patch = {
      status: aguardando,
      financeiro_aprovado_contas_receber: false,
      patio_liberado_financeiro: true,
    };
    if (valorRestaurado > 0) patch.valor = valorRestaurado;
    const runUpd = (body) =>
      typeof runSupabaseWrite === "function"
        ? runSupabaseWrite(() => supabase.from("receivables").update(body).eq("id", rec.id).eq("user_id", uid))
        : supabase.from("receivables").update(body).eq("id", rec.id).eq("user_id", uid);
    let { error } = await runUpd(patch);
    if (error && /column|schema cache|PGRST204|financeiro_aprovado|patio_liberado/i.test(error.message || "")) {
      ({ error } = await runUpd({ status: aguardando }));
    }
    if (error && /invalid input value for enum payment_status.*AGUARDANDO/i.test(error.message || "")) {
      ({ error } = await runUpd({ status: "EM_ABERTO", financeiro_aprovado_contas_receber: false, patio_liberado_financeiro: true }));
      if (error && /column|schema cache|PGRST204|financeiro_aprovado|patio_liberado/i.test(error.message || "")) {
        ({ error } = await runUpd({ status: "EM_ABERTO" }));
      }
    }
    if (!error && rec.vehicle_id) {
      await supabase
        .from("vehicles")
        .update({ payment_status: "EM_ABERTO" })
        .eq("id", rec.vehicle_id)
        .eq("user_id", uid);
    }
    return { ok: !error, error: error?.message, cashRemoved };
  }

  async function financeRevertToAguardandoClientBatch(entries) {
    if (typeof loadReceivables === "function") await loadReceivables();
    if (typeof loadCash === "function") await loadCash();
    const seen = new Set();
    let reverted = 0;
    let failed = 0;
    let skipped = 0;
    let cashRemoved = 0;
    const notFound = [];
    const notFoundEntries = [];
    const revertedIds = [];
    for (const entry of entries) {
      const rec = financePickReceivableForPlateEntry(entry, seen);
      if (!rec) {
        notFound.push(`${entry.plate} R$ ${entry.valor ?? "?"} saída ${entry.saidaDate ?? entry.paidDate ?? ""}`);
        notFoundEntries.push(entry);
        continue;
      }
      seen.add(String(rec.id));
      const st = String(rec.status || "").toUpperCase();
      const aguardando =
        typeof RECEIVABLE_AGUARDANDO_LANCAMENTO !== "undefined" ? RECEIVABLE_AGUARDANDO_LANCAMENTO : "AGUARDANDO_LANCAMENTO";
      if (st === aguardando || (st === "EM_ABERTO" && !rec.financeiro_aprovado_contas_receber)) {
        skipped += 1;
        continue;
      }
      if (st !== "PAGO") {
        failed += 1;
        notFound.push(`${entry.plate}: status ${st} (esperado PAGO)`);
        continue;
      }
      const result = await financeRevertReceivableClientSide(rec);
      if (!result.ok) {
        failed += 1;
        notFound.push(`${entry.plate}: ${result.error || "falha"}`);
        continue;
      }
      reverted += 1;
      cashRemoved += Number(result.cashRemoved || 0);
      revertedIds.push(rec.id);
      if (typeof removeReceberTriagemId === "function") removeReceberTriagemId(rec.id);
      if (typeof removePatioFinanceiroBloqueadoReceivableId === "function") {
        removePatioFinanceiroBloqueadoReceivableId(rec.id);
      }
    }
    if (typeof loadReceivables === "function") await loadReceivables();
    if (typeof loadCash === "function") await loadCash();
    return { reverted, failed, skipped, cashRemoved, notFound, notFoundEntries, revertedIds };
  }

  function financeReceivableHasCaixa(receivableId) {
    if (typeof receivableCashMovementExists === "function") {
      return receivableCashMovementExists(receivableId);
    }
    return (state.cash || []).some((m) => {
      if (String(m.conta_id) !== String(receivableId)) return false;
      const t = String(m.tipo_conta || "").toUpperCase();
      return t === "RECEBER" || t === "ENTRADA";
    });
  }

  async function financeRecoverCashForReceivableClient(rec, entry = {}) {
    if (!rec?.id || String(rec.status || "").toUpperCase() !== "PAGO") {
      return { ok: false, error: "not_pago", action: "skipped" };
    }
    if (financeReceivableHasCaixa(rec.id)) {
      return { ok: true, action: "skipped", reason: "already_in_caixa" };
    }
    const ymd = typeof toLocalYmd === "function" ? toLocalYmd : (v) => String(v || "").slice(0, 10);
    const dataMov =
      (entry.paidDate ? ymd(entry.paidDate) : null) ||
      ymd(rec.updated_at || rec.period_end || rec.created_at) ||
      ymd(new Date().toISOString());
    const vehicle = (state.vehicles || []).find((v) => String(v.id) === String(rec.vehicle_id));
    const registerCash =
      typeof window.registerReceivableCashMovement === "function"
        ? window.registerReceivableCashMovement
        : typeof registerReceivableCashMovement === "function"
          ? registerReceivableCashMovement
          : null;
    if (!registerCash) {
      return { ok: false, error: "register_unavailable", action: "failed" };
    }
    const result = await registerCash(rec, {
      valor: entry.valor != null ? Number(entry.valor) : Number(rec.valor || 0),
      dataMovimento: dataMov,
      formaPagamento: entry.formaPagamento || financeReceivableFormaPagamento(rec),
      vehicle,
      aprovadoCaixa: true,
    });
    if (result.error) return { ok: false, error: result.error?.message || "cash_failed", action: "failed" };
    return { ok: true, action: "created" };
  }

  async function financeRecoverCashClientBatch(entries) {
    if (typeof loadReceivables === "function") await loadReceivables();
    if (typeof loadCash === "function") await loadCash();
    const seen = new Set();
    let created = 0;
    let failed = 0;
    let skipped = 0;
    const notFound = [];
    const notFoundEntries = [];
    for (const entry of entries) {
      const rec = financePickReceivableForPlateEntry(entry, seen);
      if (!rec) {
        notFound.push(`${entry.plate} R$ ${entry.valor ?? "?"} saída ${entry.saidaDate ?? entry.paidDate ?? ""}`);
        notFoundEntries.push(entry);
        continue;
      }
      seen.add(String(rec.id));
      const result = await financeRecoverCashForReceivableClient(rec, entry);
      if (result.action === "created") created += 1;
      else if (result.action === "skipped") skipped += 1;
      else {
        failed += 1;
        notFound.push(`${entry.plate}: ${result.error || "falha no caixa"}`);
      }
    }
    if (typeof loadCash === "function") await loadCash();
    return { created, failed, skipped, notFound, notFoundEntries };
  }

  async function financeSyncMissingCashClient() {
    if (typeof loadReceivables === "function") await loadReceivables();
    if (typeof loadCash === "function") await loadCash();
    let created = 0;
    let failed = 0;
    let skipped = 0;
    const paid = (state.receivables || []).filter(
      (r) => String(r.status || "").toUpperCase() === "PAGO" && Number(r.valor || 0) > 0
    );
    for (const rec of paid) {
      if (financeReceivableHasCaixa(rec.id)) {
        skipped += 1;
        continue;
      }
      const result = await financeRecoverCashForReceivableClient(rec, {});
      if (result.action === "created") created += 1;
      else if (result.action === "skipped") skipped += 1;
      else failed += 1;
    }
    if (typeof loadCash === "function") await loadCash();
    return { created, failed, skipped };
  }

  async function financeSyncMissingCashForPeriod(periodoYm) {
    if (typeof loadReceivables === "function") await loadReceivables();
    if (typeof loadCash === "function") await loadCash();
    let created = 0;
    let failed = 0;
    let skipped = 0;
    const paid = (state.receivables || []).filter((r) => {
      if (String(r.status || "").toUpperCase() !== "PAGO") return false;
      if (!(Number(r.valor || 0) > 0)) return false;
      if (!r.vehicle_id) return false;
      if (!periodoYm) return true;
      const ymd = toLocalYmd(r.updated_at || r.period_end || r.created_at);
      return yearMonthFromYmd(ymd) === periodoYm;
    });
    for (const rec of paid) {
      if (financeReceivableHasCaixa(rec.id)) {
        skipped += 1;
        continue;
      }
      const result = await financeRecoverCashForReceivableClient(rec, {});
      if (result.action === "created") created += 1;
      else if (result.action === "skipped") skipped += 1;
      else failed += 1;
    }
    if (typeof loadCash === "function") await loadCash();
    return { created, failed, skipped, total: paid.length };
  }

  async function financeRecoverCaixaMaio2026() {
    const periodoYm = "2026-05";
    const ok = window.confirm(
      "Recuperar entradas no caixa de maio/2026?\n\n" +
        "Serão criadas entradas apenas para pagamentos ainda com status PAGO e valor > 0, " +
        "sem apagar movimentações existentes.\n\n" +
        "Registros já revertidos para «Aguardando faturamento» não entram no caixa — " +
        "dê baixa neles novamente pelo fluxo normal."
    );
    if (!ok) return;
    return financeRecoverCashViaApi(
      { syncMissingForPeriod: periodoYm },
      {
        hintId: null,
        btnId: "finCaixaRecoverMaioBtn",
        btnBusy: "Recuperando maio/2026…",
        btnDefault: "Recuperar entradas maio/2026",
        onDone: () => financeRenderCaixa(),
      }
    );
  }

  async function financeRevertToAguardandoViaApi(payload, ui = {}) {
    const btn = ui.btnId ? document.getElementById(ui.btnId) : null;
    const hint = ui.hintId ? document.getElementById(ui.hintId) : null;
    const prev = btn?.textContent;
    if (btn) {
      btn.disabled = true;
      if (ui.btnBusy) btn.textContent = ui.btnBusy;
    }
    let stats = { reverted: 0, failed: 0, skipped: 0, cashRemoved: 0 };
    let notFound = [];
    try {
      const entries = payload.revertEntries || payload.recoverEntries || [];
      if (!entries.length) throw new Error("Lista vazia para reversão.");

      let batch = await financeRevertToAguardandoClientBatch(entries);
      stats = {
        reverted: batch.reverted,
        failed: batch.failed,
        skipped: batch.skipped,
        cashRemoved: batch.cashRemoved,
      };
      notFound = batch.notFound || [];

      if (batch.notFoundEntries?.length && typeof callRegisterCashReceivableApi === "function") {
        const api = await callRegisterCashReceivableApi({
          revertToAguardando: true,
          revertEntries: batch.notFoundEntries,
        });
        if (api.ok) {
          stats.reverted += Number(api.stats?.reverted || 0);
          stats.failed += Number(api.stats?.failed || 0);
          stats.skipped += Number(api.stats?.skipped || 0);
          stats.cashRemoved += Number(api.stats?.cashRemoved || 0);
          if (Array.isArray(api.revertedIds)) {
            for (const id of api.revertedIds) {
              if (typeof removeReceberTriagemId === "function") removeReceberTriagemId(id);
              if (typeof removePatioFinanceiroBloqueadoReceivableId === "function") {
                removePatioFinanceiroBloqueadoReceivableId(id);
              }
            }
          }
          notFound = Array.isArray(api.notFound) ? api.notFound : notFound;
          if (typeof loadReceivables === "function") await loadReceivables();
          if (typeof loadCash === "function") await loadCash();
        }
      }

      if (hint) {
        const parts = [];
        if (stats.reverted > 0) parts.push(`${stats.reverted} revertido(s) para Aguardando Faturamento`);
        if (stats.cashRemoved > 0) parts.push(`${stats.cashRemoved} entrada(s) removida(s) do caixa`);
        if (stats.skipped > 0) parts.push(`${stats.skipped} já não estava(m) como PAGO`);
        if (stats.failed > 0) parts.push(`${stats.failed} falha(s)`);
        if (notFound.length) {
          parts.push(
            `${notFound.length} não encontrado(s): ${notFound.slice(0, 5).join("; ")}${notFound.length > 5 ? "…" : ""}`
          );
        }
        hint.textContent = parts.length
          ? `Reversão concluída: ${parts.join(", ")}. Valores recalculados quando possível. Confira em «Aguardando faturamento».`
          : "Nenhum registro foi revertido.";
        hint.classList.remove("hidden");
      }
      if (typeof renderFinance === "function") renderFinance();
      if (typeof setFinanceView === "function" && ui.openAguardando) setFinanceView("aguardando");
      return stats;
    } catch (e) {
      console.warn("financeRevertToAguardandoViaApi", e?.message || e);
      if (hint) {
        hint.textContent = e?.message || "Não foi possível reverter os registros agora.";
        hint.classList.remove("hidden");
      }
      return stats;
    } finally {
      if (typeof ui.onDone === "function") ui.onDone();
      if (btn) {
        btn.disabled = false;
        btn.textContent = prev || ui.btnDefault || btn.textContent;
      }
    }
  }

  async function financeRecoverCashViaApi(payload, ui = {}) {
    const btn = ui.btnId ? document.getElementById(ui.btnId) : null;
    const hint = ui.hintId ? document.getElementById(ui.hintId) : null;
    const prev = btn?.textContent;
    if (btn) {
      btn.disabled = true;
      if (ui.btnBusy) btn.textContent = ui.btnBusy;
    }
    let stats = { created: 0, fixed: 0, failed: 0, markedPaid: 0, skipped: 0, removed: 0 };
    let notFound = [];
    try {
      if (payload.syncMissingForPeriod) {
        const batch = await financeSyncMissingCashForPeriod(payload.syncMissingForPeriod);
        stats.created = batch.created;
        stats.failed = batch.failed;
        stats.skipped = batch.skipped;
        if (typeof callRegisterCashReceivableApi === "function") {
          const api = await callRegisterCashReceivableApi({ syncMissing: true, skipDedupe: true });
          if (api.ok) {
            stats.created += Number(api.stats?.created || 0);
            stats.fixed += Number(api.stats?.updated || api.stats?.fixed || 0);
            stats.failed += Number(api.stats?.failed || 0);
            stats.markedPaid += Number(api.stats?.markedPaid || 0);
            if (typeof loadReceivables === "function") await loadReceivables();
            if (typeof loadCash === "function") await loadCash();
          }
        }
      } else if (payload.syncMissing) {
        const batch = await financeSyncMissingCashClient();
        stats.created = batch.created;
        stats.failed = batch.failed;
        stats.skipped = batch.skipped;
        if (typeof callRegisterCashReceivableApi === "function") {
          const api = await callRegisterCashReceivableApi({ syncMissing: true, skipDedupe: true });
          if (api.ok) {
            stats.created += Number(api.stats?.created || 0);
            stats.fixed += Number(api.stats?.updated || api.stats?.fixed || 0);
            stats.failed += Number(api.stats?.failed || 0);
            stats.markedPaid += Number(api.stats?.markedPaid || 0);
            stats.removed += Number(api.stats?.removed || 0);
            if (typeof loadReceivables === "function") await loadReceivables();
            if (typeof loadCash === "function") await loadCash();
          }
        }
      } else {
        const entries = payload.recoverEntries || [];
        if (!entries.length) throw new Error("Lista vazia para recuperação.");
        let batch = await financeRecoverCashClientBatch(entries);
        stats.created = batch.created;
        stats.failed = batch.failed;
        stats.skipped = batch.skipped;
        notFound = batch.notFound || [];
        if (batch.notFoundEntries?.length && typeof callRegisterCashReceivableApi === "function") {
          const api = await callRegisterCashReceivableApi({ recoverEntries: batch.notFoundEntries });
          if (api.ok) {
            stats.created += Number(api.stats?.created || 0);
            stats.fixed += Number(api.stats?.updated || api.stats?.fixed || 0);
            stats.failed += Number(api.stats?.failed || 0);
            stats.markedPaid += Number(api.stats?.markedPaid || 0);
            stats.removed += Number(api.stats?.removed || 0);
            if (Array.isArray(api.notFound)) notFound = api.notFound;
            if (typeof loadReceivables === "function") await loadReceivables();
            if (typeof loadCash === "function") await loadCash();
          }
        }
      }

      if (typeof loadReceivables === "function") await loadReceivables();
      if (typeof loadCash === "function") await loadCash();
      if (hint) {
        const missing = financeCountPaidReceivablesSemCaixa();
        const parts = [];
        if (stats.created > 0) parts.push(`${stats.created} entrada(s) criada(s) no caixa`);
        if (stats.fixed > 0) parts.push(`${stats.fixed} corrigida(s)`);
        if (stats.skipped > 0) parts.push(`${stats.skipped} já tinha(m) caixa ou ignorado(s)`);
        if (stats.markedPaid > 0) parts.push(`${stats.markedPaid} marcada(s) como PAGO`);
        if (stats.removed > 0) parts.push(`${stats.removed} duplicata(s) removida(s)`);
        if (stats.failed > 0) parts.push(`${stats.failed} falha(s)`);
        if (notFound.length) {
          parts.push(
            `${notFound.length} não encontrado(s): ${notFound.slice(0, 5).join("; ")}${notFound.length > 5 ? "…" : ""}`
          );
        }
        if (parts.length) {
          hint.textContent = `Recuperação concluída: ${parts.join(", ")}.`;
          hint.classList.remove("hidden");
        } else if (missing > 0) {
          hint.textContent = `${missing} pagamento(s) ainda sem entrada no caixa — tente «Recuperar VRP (lista completa)» ou execute o SQL no Supabase.`;
          hint.classList.remove("hidden");
        } else {
          hint.textContent = "Caixa já estava sincronizado.";
          hint.classList.remove("hidden");
        }
      }
      if (typeof renderFinance === "function") renderFinance();
      return stats;
    } catch (e) {
      console.warn("financeRecoverCashViaApi", e?.message || e);
      if (hint) {
        hint.textContent = e?.message || "Não foi possível recuperar o caixa agora.";
        hint.classList.remove("hidden");
      }
      return stats;
    } finally {
      if (typeof ui.onDone === "function") ui.onDone();
      if (btn) {
        btn.disabled = false;
        btn.textContent = prev || ui.btnDefault || btn.textContent;
      }
    }
  }

  async function financeRenderCaixaAsync() {
    await financeEnsureMissingCashInCaixa();
    financeRenderCaixa();
  }

  function financeRenderCaixa() {
    financeEnsureCaixaPeriodoDefault();
    financeSyncCaixaPeriodoFromDom();
    financeUpdateCaixaTipoFilterUi();
    const body = document.getElementById("finCaixaBody");
    const summaryEl = document.getElementById("finCaixaSummary");
    const periodoYm = financeFilterPeriodo || "";
    const de = (financeFilterCaixaDataDe || "").trim();
    const ate = (financeFilterCaixaDataAte || "").trim();
    const movsOperacionais = financeCaixaMovsForPeriod(periodoYm);
    const totPeriodo = financeCaixaTotalsForMovs(movsOperacionais);
    if (summaryEl) {
      const periodoLabel = de || ate
        ? `Período ${de ? formatDate(de) : "…"} — ${ate ? formatDate(ate) : "…"}`
        : periodoYm
          ? `Competência ${periodoYm}`
          : "Todos os períodos (lista abaixo)";
      const tipoLabel =
        financeFilterCaixaTipo === "entrada"
          ? " · apenas entradas"
          : financeFilterCaixaTipo === "saida"
            ? " · apenas saídas"
            : "";
      const placaLabel = (financeFilterCaixaPlaca || "").trim()
        ? ` · placa: ${escapeHtml(financeFilterCaixaPlaca.trim())}`
        : "";
      const rppNome = financePartnerNomeById(financeFilterCaixaRppId);
      const rppLabel = rppNome ? ` · RPP: ${escapeHtml(rppNome)}` : "";
      const saldoOperacional = financeSaldoCaixa();
      summaryEl.innerHTML = `
        <p><strong>${escapeHtml(periodoLabel)}${escapeHtml(tipoLabel)}${placaLabel}${rppLabel}</strong></p>
        <p><strong>Entrada (operacional):</strong> <span class="fin-val-entrada">${escapeHtml(formatCurrency(totPeriodo.entradas))}</span></p>
        <p><strong>Saída (operacional):</strong> <span class="fin-val-saida">${escapeHtml(formatCurrency(totPeriodo.saidas))}</span></p>
        <p><strong>Saldo operacional:</strong> <span class="${saldoOperacional >= 0 ? "fin-val-entrada" : "fin-val-saida"}">${escapeHtml(formatCurrency(saldoOperacional))}</span></p>
      `;
    }
    if (!body) return;
    let movs = [...movsOperacionais].sort((a, b) =>
      financeCaixaMovCompetenciaYmd(b).localeCompare(financeCaixaMovCompetenciaYmd(a))
    );
    if (!movs.length) {
      const totalMovs = financeCaixaMovsMerged().length;
      const periodoHint = de || ate
        ? " Nenhuma movimentação no intervalo de datas informado."
        : periodoYm
          ? totalMovs > 0
            ? ` Nenhuma movimentação na competência ${periodoYm}, mas existem ${totalMovs} no total. Limpe o filtro «Competência» para ver todas.`
            : ` Nenhuma movimentação na competência ${periodoYm}. Limpe o filtro «Competência» para ver todas.`
          : "";
      const tipoHint =
        financeFilterCaixaTipo === "entrada"
          ? " Nenhuma entrada no filtro atual."
          : financeFilterCaixaTipo === "saida"
            ? " Nenhuma saída no filtro atual."
            : "";
      const placaHint = financeNormalizePlate(financeFilterCaixaPlaca)
        ? " Nenhuma movimentação para a placa informada."
        : "";
      const rppHint = (financeFilterCaixaRppId || "").trim()
        ? " Nenhuma movimentação para o RPP selecionado."
        : "";
      body.innerHTML = `<tr><td colspan="5" class="notice">Nenhuma movimentação registrada.${periodoHint}${placaHint}${rppHint}${tipoHint}</td></tr>`;
      return;
    }
    const rowsHtml = movs
      .slice(0, 300)
      .map((mov) => {
        const isEntrada = financeCashIsEntrada(mov);
        const auditBadge =
          financeOperationalModeActive() && financeCashAprovadoCaixa(mov)
            ? `<span class="fin-tag fin-tag--ok" title="Conta no saldo operacional">Aprovado</span> `
            : "";
        const rec = isEntrada
          ? (state.receivables || []).find((r) => String(r.id) === String(mov.conta_id)) ||
            financeFindReceivableForMov(mov)
          : null;
        const pay = !isEntrada ? (state.payables || []).find((p) => String(p.id) === String(mov.conta_id)) : null;
        const v = rec ? financeVehicleById().get(rec.vehicle_id) : null;
        const tipoLabel = isEntrada ? "Entrada" : "Saída";
        const tipoClass = isEntrada ? "fin-val-entrada" : "fin-val-saida";
        const amount = financeCashMovValor(mov);
        const valSigned = isEntrada ? amount : -amount;
        let pagante = "—";
        let descText = "—";
        if (isEntrada) {
          pagante = financeQuemPagouCaixa(mov, rec);
          descText = financeCaixaDescricaoEntrada(mov, rec);
          if (financeLooksLikeMetaNoise(descText) || descText === "—") {
            descText = pagante;
          }
        } else {
          pagante = financeCashPaganteLabel(mov, rec, pay, v);
          descText = financeStripFinmeta(mov.descricao || pay?.descricao || pay?.fornecedor || "—");
          if (pay && typeof financeMetaUnpack === "function" && typeof financePayableMetaText === "function") {
            const { text } = financeMetaUnpack(financePayableMetaText(pay));
            if (text) descText = financeStripFinmeta(text);
          }
        }
        pagante = financeDisplaySafeText(pagante);
        descText = financeDisplaySafeText(descText);
        if (financeLooksLikeMetaNoise(pagante)) pagante = financeNormalizeQuemPagouText(mov?.descricao || rec?.responsavel_pagamento);
        if (financeLooksLikeMetaNoise(descText)) descText = pagante;
        let desc = auditBadge + escapeHtml(descText);
        if (v?.placa) desc += `<br /><span class="notice">${escapeHtml(v.placa)}</span>`;
        const dataComp = financeCaixaMovCompetenciaYmd(mov);
        return `<tr>
          <td data-label="Data">${escapeHtml(formatDate(dataComp || mov.data_movimento || mov.created_at))}</td>
          <td data-label="Tipo"><span class="${tipoClass}">${tipoLabel}</span></td>
          <td data-label="Origem">${escapeHtml(pagante)}</td>
          <td data-label="Descrição">${desc}</td>
          <td data-label="Valor"><span class="${tipoClass}">${escapeHtml(formatCurrency(valSigned))}</span></td>
        </tr>`;
      })
      .join("");
    body.innerHTML =
      rowsHtml +
      `<tr class="fin-caixa-total-row">
        <td colspan="4" data-label=""><strong>Saldo operacional</strong></td>
        <td data-label="Valor"><strong class="${financeSaldoCaixa() >= 0 ? "fin-val-entrada" : "fin-val-saida"}">${escapeHtml(formatCurrency(financeSaldoCaixa()))}</strong></td>
      </tr>`;
    financeSanitizeCaixaTableCells(body);
  }

  function financeOpenReceitaModal(presetRecorrente) {
    const modal = document.getElementById("finReceitaModal");
    const form = document.getElementById("finReceitaForm");
    if (!modal || !form) return;
    form.reset();
    const today = financeTodayYmd();
    const venc = document.getElementById("finRecVencimento");
    const dataLanc = document.getElementById("finRecDataLancamento");
    const dataRec = document.getElementById("finRecDataRecebimento");
    const jaRec = document.getElementById("finRecJaRecebido");
    const modo = document.getElementById("finRecModo");
    const cat = document.getElementById("finRecCategoria");
    if (dataLanc) dataLanc.value = today;
    if (venc) venc.value = today;
    if (dataRec) dataRec.value = today;
    if (jaRec) jaRec.checked = false;
    if (modo) modo.value = presetRecorrente ? "RECORRENTE" : "UNICA";
    if (cat && typeof getLancReceitaCategorias === "function") {
      const cats = getLancReceitaCategorias();
      cat.innerHTML = cats.map((c) => `<option value="${escapeHtml(c.value)}">${escapeHtml(c.label)}</option>`).join("");
      if (presetRecorrente) cat.value = "ESTACIONAMENTO_MENSALISTA";
    }
    financeSyncReceitaModoFields();
    financePopulateContactSelects();
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
    const jaRec = document.getElementById("finRecJaRecebido");
    const wrapRec = document.getElementById("finRecDataRecebimentoWrap");
    if (wrapRec) wrapRec.classList.toggle("hidden", !jaRec?.checked);
  }

  function financeSyncFinRecDataRecebimentoFromLancamento() {
    const dataLanc = document.getElementById("finRecDataLancamento")?.value;
    const dataRec = document.getElementById("finRecDataRecebimento");
    if (dataRec && dataLanc) dataRec.value = dataLanc;
  }

  async function financeEditReceberPrompt(receivableId) {
    const rec = (state.receivables || []).find((r) => String(r.id) === String(receivableId));
    if (!rec) return alert("Conta a receber não encontrada.");
    if (typeof requireSupabaseSessionForWrite === "function" && !(await requireSupabaseSessionForWrite())) return;
    const uid = typeof effectiveUserId === "function" ? effectiveUserId() : null;
    if (!uid) return;
    const v = financeVehicleById().get(rec.vehicle_id);
    const typed = financeReceivableTypedFields(rec);
    const origem = prompt("Origem:", financeReceivableOrigemCellText(rec, v));
    if (origem == null) return;
    const descricao = prompt("Descrição:", financeReceivableDescricaoCellText(rec, v));
    if (descricao == null) return;
    const rpp = prompt("RPP:", financeReceberRppNome(rec, v));
    if (rpp == null) return;
    const valorRaw = prompt("Valor:", String(Number(rec.valor || 0)));
    if (valorRaw == null) return;
    const valor = Number(String(valorRaw).replace(",", "."));
    if (!Number.isFinite(valor) || valor < 0) return alert("Valor inválido.");
    const vencimento = prompt("Vencimento (AAAA-MM-DD):", financeContaDueYmd(rec, "receivable") || "");
    if (vencimento == null) return;
    const patch = { valor, period_end: vencimento || rec.period_end };
    if (financeIsManualReceivable(rec)) {
      const raw = typeof financeReceivableMetaText === "function" ? financeReceivableMetaText(rec) : rec.responsavel_pagamento || "";
      const { meta } = typeof financeMetaUnpack === "function" ? financeMetaUnpack(raw) : { meta: {} };
      const newMeta = { ...(meta || {}), origem_texto: origem.trim(), descricao_texto: descricao.trim(), rpp_texto: rpp.trim() };
      const userText = [origem.trim(), descricao.trim(), rpp.trim() ? `RPP: ${rpp.trim()}` : "", typed.observacoes]
        .filter(Boolean)
        .join(" — ");
      patch.responsavel_pagamento =
        typeof financeMetaPack === "function" ? financeMetaPack(newMeta, userText) : userText;
    }
    const write = () => supabase.from("receivables").update(patch).eq("id", rec.id).eq("user_id", uid);
    const { error } = typeof runSupabaseWrite === "function" ? await runSupabaseWrite(write) : await write();
    if (error) return typeof alertSupabaseError === "function" ? alertSupabaseError(error, "Não foi possível editar a conta a receber.") : alert(error.message);
    await financeReloadAfterAction();
  }

  async function financeDeleteReceberPrompt(receivableId) {
    const rec = (state.receivables || []).find((r) => String(r.id) === String(receivableId));
    if (!rec) return alert("Conta a receber não encontrada.");
    if (!confirm("Apagar esta conta a receber?")) return;
    if (typeof requireSupabaseSessionForWrite === "function" && !(await requireSupabaseSessionForWrite())) return;
    const uid = typeof effectiveUserId === "function" ? effectiveUserId() : null;
    if (!uid) return;
    await financeDeleteCashForReceivableClient(rec.id);
    const write = () => supabase.from("receivables").delete().eq("id", rec.id).eq("user_id", uid);
    const { error } = typeof runSupabaseWrite === "function" ? await runSupabaseWrite(write) : await write();
    if (error) return typeof alertSupabaseError === "function" ? alertSupabaseError(error, "Não foi possível apagar a conta a receber.") : alert(error.message);
    await financeReloadAfterAction();
  }

  async function financeVoltarReceberPrompt(receivableId) {
    const rec = (state.receivables || []).find((r) => String(r.id) === String(receivableId));
    if (!rec) return alert("Conta a receber não encontrada.");
    if (!confirm("Voltar esta conta a receber?")) return;
    if (String(rec.status || "").toUpperCase() === "PAGO") {
      const result = await financeRevertReceivableClientSide(rec);
      if (!result.ok) alert(result.error || "Não foi possível voltar a conta a receber.");
    } else {
      if (typeof requireSupabaseSessionForWrite === "function" && !(await requireSupabaseSessionForWrite())) return;
      const uid = typeof effectiveUserId === "function" ? effectiveUserId() : null;
      const patch = rec.vehicle_id
        ? { status: "EM_ABERTO", financeiro_aprovado_contas_receber: false }
        : { status: "EM_ABERTO" };
      const write = () => supabase.from("receivables").update(patch).eq("id", rec.id).eq("user_id", uid);
      const { error } = typeof runSupabaseWrite === "function" ? await runSupabaseWrite(write) : await write();
      if (error) typeof alertSupabaseError === "function" ? alertSupabaseError(error, "Não foi possível voltar a conta a receber.") : alert(error.message);
    }
    await financeReloadAfterAction();
  }

  async function financeEditPagarPrompt(payableId) {
    const pay = (state.payables || []).find((p) => String(p.id) === String(payableId));
    if (!pay) return alert("Conta a pagar não encontrada.");
    if (typeof requireSupabaseSessionForWrite === "function" && !(await requireSupabaseSessionForWrite())) return;
    const uid = typeof effectiveUserId === "function" ? effectiveUserId() : null;
    if (!uid) return;
    const typed = financePayableTypedFields(pay);
    const fornecedor = prompt("Fornecedor:", typed.fornecedor === "—" ? "" : typed.fornecedor);
    if (fornecedor == null) return;
    const descricao = prompt("Descrição:", typed.descricao === "—" ? "" : typed.descricao);
    if (descricao == null) return;
    const valorRaw = prompt("Valor:", String(Number(pay.valor || 0)));
    if (valorRaw == null) return;
    const valor = Number(String(valorRaw).replace(",", "."));
    if (!Number.isFinite(valor) || valor < 0) return alert("Valor inválido.");
    const vencimento = prompt("Vencimento (AAAA-MM-DD):", financeContaDueYmd(pay, "payable") || "");
    if (vencimento == null) return;
    const raw = typeof financePayableMetaText === "function" ? financePayableMetaText(pay) : pay.descricao || "";
    const { meta } = typeof financeMetaUnpack === "function" ? financeMetaUnpack(raw) : { meta: {} };
    const newMeta = { ...(meta || {}), fornecedor_texto: fornecedor.trim(), descricao_texto: descricao.trim() };
    const userText = [fornecedor.trim(), descricao.trim(), typed.observacoes].filter(Boolean).join(" — ");
    const patch = {
      fornecedor: fornecedor.trim() || null,
      descricao: typeof financeMetaPack === "function" ? financeMetaPack(newMeta, userText || descricao.trim()) : descricao.trim(),
      valor,
      data_vencimento: vencimento || pay.data_vencimento,
    };
    const write = () => supabase.from("payables").update(patch).eq("id", pay.id).eq("user_id", uid);
    const { error } = typeof runSupabaseWrite === "function" ? await runSupabaseWrite(write) : await write();
    if (error) return typeof alertSupabaseError === "function" ? alertSupabaseError(error, "Não foi possível editar a conta a pagar.") : alert(error.message);
    await financeReloadAfterAction();
  }

  async function financeDeletePagarPrompt(payableId) {
    const pay = (state.payables || []).find((p) => String(p.id) === String(payableId));
    if (!pay) return alert("Conta a pagar não encontrada.");
    if (!confirm("Apagar esta conta a pagar?")) return;
    if (typeof requireSupabaseSessionForWrite === "function" && !(await requireSupabaseSessionForWrite())) return;
    const uid = typeof effectiveUserId === "function" ? effectiveUserId() : null;
    if (!uid) return;
    await financeDeleteCashForPayableClient(pay.id);
    const write = () => supabase.from("payables").delete().eq("id", pay.id).eq("user_id", uid);
    const { error } = typeof runSupabaseWrite === "function" ? await runSupabaseWrite(write) : await write();
    if (error) return typeof alertSupabaseError === "function" ? alertSupabaseError(error, "Não foi possível apagar a conta a pagar.") : alert(error.message);
    await financeReloadAfterAction();
  }

  async function financeVoltarPagarPrompt(payableId) {
    const pay = (state.payables || []).find((p) => String(p.id) === String(payableId));
    if (!pay) return alert("Conta a pagar não encontrada.");
    if (!confirm("Voltar esta conta a pagar para em aberto?")) return;
    if (typeof requireSupabaseSessionForWrite === "function" && !(await requireSupabaseSessionForWrite())) return;
    const uid = typeof effectiveUserId === "function" ? effectiveUserId() : null;
    if (!uid) return;
    await financeDeleteCashForPayableClient(pay.id);
    const write = () => supabase.from("payables").update({ status: "EM_ABERTO" }).eq("id", pay.id).eq("user_id", uid);
    const { error } = typeof runSupabaseWrite === "function" ? await runSupabaseWrite(write) : await write();
    if (error) return typeof alertSupabaseError === "function" ? alertSupabaseError(error, "Não foi possível voltar a conta a pagar.") : alert(error.message);
    await financeReloadAfterAction();
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
    financePopulateContactSelects();
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
          financePayableTypedFields(p).fornecedor,
          financePayableTypedFields(p).descricao,
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
        ["Origem", "Descrição", "RPP", "Valor", "Vencimento", "Status"],
        ...list.map((r) => {
          const v = vmap.get(r.vehicle_id);
          return [
            financeReceivableOrigemCellText(r, v),
            financeReceivableDescricaoCellText(r, v),
            financeReceberRppNome(r, v),
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
      const vmap = financeVehicleById();
      const rows = [
        ["Data", "Tipo", "Origem", "Descrição", "Valor"],
        ...financeCaixaMovsMerged().map((m) => {
          const isEntrada = financeCashIsEntrada(m);
          const rec = isEntrada
            ? (state.receivables || []).find((r) => String(r.id) === String(m.conta_id)) ||
              financeFindReceivableForMov(m)
            : null;
          const pay = !isEntrada ? (state.payables || []).find((p) => String(p.id) === String(m.conta_id)) : null;
          const v = rec ? vmap.get(rec.vehicle_id) : null;
          const entradaLabels = isEntrada ? financeCaixaEntradaLabels(m, rec) : null;
          return [
            toLocalYmd(m.data_movimento || m.created_at),
            isEntrada ? "Entrada" : "Saída",
            isEntrada ? entradaLabels.pagante : financeCashPaganteLabel(m, rec, pay, v),
            isEntrada ? entradaLabels.descricao : financeStripFinmeta(m.descricao || pay?.descricao || ""),
            financeCashMovValor(m).toFixed(2),
          ];
        }),
      ];
      financeExportCsv(rows, `fluxo-caixa-${financeTodayYmd()}.csv`);
      return;
    }
    alert("Abra Contas a pagar, Contas a receber ou Caixa para exportar.");
  }

  function financeSyncReceberFiltersFromDom() {
    financeSyncReceberPlacaFromDom();
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
    if (financeIsManualReceivable(r)) return financeReceivableManualCellHtml(r);
    return `<span class="muted">${escapeHtml(financeReceivableLabel(r))}</span>`;
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
          <td>${escapeHtml(financeReceivableOrigemCellText(r, v))}</td>
          <td>${financeReceivableDescricaoCellHtml(r, v)}</td>
          <td>${escapeHtml(financeReceberRppNome(r, v))}</td>
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
      <thead><tr><th>Origem</th><th>Descrição</th><th>RPP</th><th>Valor</th><th>Vencimento</th></tr></thead>
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
        { label: "Origem", w: 105 },
        { label: "Descrição", w: 150 },
        { label: "RPP", w: 105 },
        { label: "Valor", w: 72 },
        { label: "Vencimento", w: 68 },
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
        const origemLines = [financeReceivableOrigemCellText(r, v)];
        const descricaoLines = [financeReceivableDescricaoCellText(r, v)];
        const cellLines = [
          origemLines.flatMap((line) => pdf.splitTextToSize(line, cols[0].w - 8)),
          descricaoLines.flatMap((line) => pdf.splitTextToSize(line, cols[1].w - 8)),
          pdf.splitTextToSize(String(financeReceberRppNome(r, v)), cols[2].w - 8),
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

  const FINANCE_SUBVIEWS = ["dashboard", "em_patio", "aguardando", "receber", "pagar", "caixa", "cadastros"];

  const FIN_CADASTRO_TIPO_LABELS = {
    PRESTADOR: "Prestador de serviço",
    FORNECEDOR: "Fornecedor",
    CLIENTE: "Cliente",
  };

  function financeContactsByTipo(tipo) {
    return (state.financeContacts || []).filter((c) => String(c.tipo || "").toUpperCase() === String(tipo || "").toUpperCase());
  }

  function financeContactById(id) {
    return (state.financeContacts || []).find((c) => String(c.id) === String(id)) || null;
  }

  function financePopulateContactSelects() {
    const despSel = document.getElementById("finDespContactSelect");
    const recSel = document.getElementById("finRecContactSelect");
    const payTypes = ["FORNECEDOR", "PRESTADOR"];
    if (despSel) {
      const cur = despSel.value;
      despSel.innerHTML =
        `<option value="">— Digitar manualmente —</option>` +
        payTypes
          .flatMap((t) => financeContactsByTipo(t))
          .map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.nome)} (${escapeHtml(FIN_CADASTRO_TIPO_LABELS[c.tipo] || c.tipo)})</option>`)
          .join("");
      if (cur) despSel.value = cur;
    }
    if (recSel) {
      const cur = recSel.value;
      recSel.innerHTML =
        `<option value="">— Digitar manualmente —</option>` +
        financeContactsByTipo("CLIENTE")
          .map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.nome)}</option>`)
          .join("");
      if (cur) recSel.value = cur;
    }
  }
  window.financePopulateContactSelects = financePopulateContactSelects;

  function financeApplyContactToDespesaForm(contactId) {
    const contact = financeContactById(contactId);
    if (!contact) return;
    const forn = document.getElementById("finDespFornecedor");
    const desc = document.getElementById("finDespDescricao");
    const val = document.getElementById("finDespValor");
    const venc = document.getElementById("finDespVencimento");
    const cat = document.getElementById("finDespCategoria");
    const forma = document.getElementById("finDespForma");
    const conta = document.getElementById("finDespConta");
    const modo = document.getElementById("finDespModo");
    const rec = document.getElementById("finDespRecorrencia");
    if (forn) forn.value = contact.nome || "";
    if (desc) desc.value = contact.descricao_padrao || `${contact.nome} — recorrente`;
    if (val && contact.valor_padrao != null) val.value = String(Number(contact.valor_padrao));
    if (forma && contact.forma_pagamento) forma.value = contact.forma_pagamento;
    if (conta) conta.value = contact.conta_bancaria || state.settings?.conta_bancaria || "";
    if (cat && contact.payable_category) cat.value = contact.payable_category;
    if (modo) modo.value = contact.recorrente_ativo ? "RECORRENTE" : "UNICA";
    if (rec && contact.recorrencia) rec.value = contact.recorrencia;
    if (venc && contact.dia_vencimento) {
      const ym = typeof currentYearMonthLocal === "function" ? currentYearMonthLocal() : financeTodayYmd().slice(0, 7);
      const due =
        typeof financeContactDueYmdForMonth === "function"
          ? financeContactDueYmdForMonth(contact, ym)
          : financeTodayYmd();
      if (due) venc.value = due;
    }
    financeSyncDespesaModoFields();
  }

  function financeApplyContactToReceitaForm(contactId) {
    const contact = financeContactById(contactId);
    if (!contact) return;
    const cli = document.getElementById("finRecCliente");
    const desc = document.getElementById("finRecDescricao");
    const val = document.getElementById("finRecValor");
    const venc = document.getElementById("finRecVencimento");
    const dataLanc = document.getElementById("finRecDataLancamento");
    const cat = document.getElementById("finRecCategoria");
    const forma = document.getElementById("finRecForma");
    const modo = document.getElementById("finRecModo");
    const rec = document.getElementById("finRecRecorrencia");
    if (cli) cli.value = contact.nome || "";
    if (desc) desc.value = contact.descricao_padrao || `${contact.nome} — recorrente`;
    if (val && contact.valor_padrao != null) val.value = String(Number(contact.valor_padrao));
    if (forma && contact.forma_pagamento) forma.value = contact.forma_pagamento;
    if (cat && contact.receivable_category) cat.value = contact.receivable_category;
    if (modo) modo.value = contact.recorrente_ativo ? "RECORRENTE" : "UNICA";
    if (rec && contact.recorrencia) rec.value = contact.recorrencia;
    const dueYm = typeof currentYearMonthLocal === "function" ? currentYearMonthLocal() : financeTodayYmd().slice(0, 7);
    const due =
      typeof financeContactDueYmdForMonth === "function"
        ? financeContactDueYmdForMonth(contact, dueYm)
        : financeTodayYmd();
    if (venc && due) venc.value = due;
    if (dataLanc && due) dataLanc.value = due;
    financeSyncReceitaModoFields();
  }

  function financeSyncContactModalTipoFields() {
    const tipo = document.getElementById("finContactTipo")?.value || "PRESTADOR";
    const recOn = document.getElementById("finContactRecorrente")?.checked;
    document.getElementById("finContactRecorrenteFields")?.classList.toggle("hidden", !recOn);
    document.getElementById("finContactPayableCatWrap")?.classList.toggle("hidden", tipo === "CLIENTE");
    document.getElementById("finContactReceivableCatWrap")?.classList.toggle("hidden", tipo !== "CLIENTE");
    document.getElementById("finContactContaWrap")?.classList.toggle("hidden", tipo === "CLIENTE");
  }

  function financeFillContactCategorySelects() {
    const payCat = document.getElementById("finContactPayableCat");
    const recCat = document.getElementById("finContactReceivableCat");
    if (payCat && typeof getLancDespesaCategorias === "function") {
      const cats = getLancDespesaCategorias();
      payCat.innerHTML = cats.map((c) => `<option value="${escapeHtml(c.value)}">${escapeHtml(c.label)}</option>`).join("");
    }
    if (recCat && typeof getLancReceitaCategorias === "function") {
      const cats = getLancReceitaCategorias();
      recCat.innerHTML = cats.map((c) => `<option value="${escapeHtml(c.value)}">${escapeHtml(c.label)}</option>`).join("");
    }
  }

  function financeOpenContactModal(contact, presetTipo) {
    const modal = document.getElementById("finContactModal");
    const form = document.getElementById("finContactForm");
    if (!modal || !form) return;
    form.reset();
    financeFillContactCategorySelects();
    finContactEditingId = contact?.id || null;
    const tipo = contact?.tipo || presetTipo || finCadastroTipo || "PRESTADOR";
    document.getElementById("finContactId").value = contact?.id || "";
    document.getElementById("finContactTipo").value = tipo;
    document.getElementById("finContactAtivo").value = contact?.ativo === false ? "0" : "1";
    document.getElementById("finContactNome").value = contact?.nome || "";
    document.getElementById("finContactDocumento").value = contact?.documento || "";
    document.getElementById("finContactTelefone").value = contact?.telefone || "";
    document.getElementById("finContactEmail").value = contact?.email || "";
    document.getElementById("finContactContato").value = contact?.contato || "";
    document.getElementById("finContactObs").value = contact?.observacoes || "";
    const rec = document.getElementById("finContactRecorrente");
    if (rec) rec.checked = !!contact?.recorrente_ativo;
    document.getElementById("finContactRecorrencia").value = contact?.recorrencia || "mensal";
    document.getElementById("finContactDiaVenc").value = String(contact?.dia_vencimento || 5);
    document.getElementById("finContactValor").value =
      contact?.valor_padrao != null ? String(Number(contact.valor_padrao)) : "";
    document.getElementById("finContactForma").value = contact?.forma_pagamento || "PIX";
    document.getElementById("finContactDescricao").value = contact?.descricao_padrao || "";
    document.getElementById("finContactConta").value = contact?.conta_bancaria || state.settings?.conta_bancaria || "";
    if (contact?.payable_category) document.getElementById("finContactPayableCat").value = contact.payable_category;
    if (contact?.receivable_category) document.getElementById("finContactReceivableCat").value = contact.receivable_category;
    financeSyncContactModalTipoFields();
    const title = document.getElementById("finContactModalTitle");
    if (title) title.textContent = contact ? "Editar cadastro" : "Novo cadastro";
    if (modal.parentElement !== document.body) document.body.appendChild(modal);
    modal.classList.remove("hidden");
  }

  function financeCloseContactModal() {
    document.getElementById("finContactModal")?.classList.add("hidden");
    finContactEditingId = null;
  }

  async function financeSaveContactFromForm(e) {
    e.preventDefault();
    if (typeof requireSupabaseSessionForWrite === "function" && !(await requireSupabaseSessionForWrite())) return;
    const uid = typeof effectiveUserId === "function" ? effectiveUserId() : null;
    if (!uid) return;
    const tipo = document.getElementById("finContactTipo")?.value || "PRESTADOR";
    const nome = document.getElementById("finContactNome")?.value?.trim();
    if (!nome) return alert("Informe o nome.");
    const recorrente = document.getElementById("finContactRecorrente")?.checked === true;
    const valorRaw = document.getElementById("finContactValor")?.value;
    const valor = valorRaw === "" || valorRaw == null ? null : Number(valorRaw);
    if (recorrente && (!Number.isFinite(valor) || valor <= 0)) {
      return alert("Para recorrência automática, informe um valor padrão maior que zero.");
    }
    const payload = {
      user_id: uid,
      tipo,
      nome,
      documento: document.getElementById("finContactDocumento")?.value?.trim() || null,
      email: document.getElementById("finContactEmail")?.value?.trim() || null,
      telefone: document.getElementById("finContactTelefone")?.value?.trim() || null,
      contato: document.getElementById("finContactContato")?.value?.trim() || null,
      observacoes: document.getElementById("finContactObs")?.value?.trim() || null,
      recorrente_ativo: recorrente,
      recorrencia: document.getElementById("finContactRecorrencia")?.value || "mensal",
      valor_padrao: valor,
      dia_vencimento: Math.min(28, Math.max(1, Number(document.getElementById("finContactDiaVenc")?.value) || 5)),
      payable_category:
        tipo === "CLIENTE" ? null : document.getElementById("finContactPayableCat")?.value || "OUTROS",
      receivable_category:
        tipo === "CLIENTE" ? document.getElementById("finContactReceivableCat")?.value || "ESTACIONAMENTO_MENSALISTA" : null,
      descricao_padrao: document.getElementById("finContactDescricao")?.value?.trim() || null,
      forma_pagamento: document.getElementById("finContactForma")?.value || "PIX",
      conta_bancaria: document.getElementById("finContactConta")?.value?.trim() || null,
      ativo: document.getElementById("finContactAtivo")?.value !== "0",
      updated_at: new Date().toISOString(),
    };
    const id = finContactEditingId || document.getElementById("finContactId")?.value;
    const write = id
      ? () => supabase.from("finance_contacts").update(payload).eq("id", id).eq("user_id", uid)
      : () => supabase.from("finance_contacts").insert(payload);
    const { error } = typeof runSupabaseWrite === "function" ? await runSupabaseWrite(write) : await write();
    if (error) {
      if (/relation|schema cache|does not exist|PGRST205/i.test(error.message || "")) {
        return alert("Execute no Supabase o script supabase/finance_contacts.sql e tente novamente.");
      }
      return typeof alertSupabaseError === "function"
        ? alertSupabaseError(error, "Não foi possível salvar o cadastro.")
        : alert(error.message);
    }
    financeCloseContactModal();
    if (typeof loadFinanceContacts === "function") await loadFinanceContacts();
    financeRenderCadastros();
    financePopulateContactSelects();
  }

  async function financeDeleteContact(contactId) {
    if (!contactId) return;
    if (!window.confirm("Excluir este cadastro? Lançamentos já gerados não serão removidos.")) return;
    if (typeof requireSupabaseSessionForWrite === "function" && !(await requireSupabaseSessionForWrite())) return;
    const uid = typeof effectiveUserId === "function" ? effectiveUserId() : null;
    const write = () => supabase.from("finance_contacts").delete().eq("id", contactId).eq("user_id", uid);
    const { error } = typeof runSupabaseWrite === "function" ? await runSupabaseWrite(write) : await write();
    if (error) {
      return typeof alertSupabaseError === "function"
        ? alertSupabaseError(error, "Não foi possível excluir.")
        : alert(error.message);
    }
    if (typeof loadFinanceContacts === "function") await loadFinanceContacts();
    financeRenderCadastros();
    financePopulateContactSelects();
  }

  async function financeGerarLancamentoFromContact(contactId) {
    const contact = financeContactById(contactId);
    if (!contact) return alert("Cadastro não encontrado.");
    if (typeof requireSupabaseSessionForWrite === "function" && !(await requireSupabaseSessionForWrite())) return;
    const ym = typeof currentYearMonthLocal === "function" ? currentYearMonthLocal() : financeTodayYmd().slice(0, 7);
    const due =
      typeof financeContactDueYmdForMonth === "function"
        ? financeContactDueYmdForMonth(contact, ym)
        : financeTodayYmd();
    if (typeof window.createLancamentoFromFinanceContact !== "function") return;
    const res = await window.createLancamentoFromFinanceContact(contact, due);
    if (res?.error) return alert(res.error.message || "Falha ao gerar lançamento.");
    await Promise.all([
      typeof loadReceivables === "function" ? loadReceivables() : Promise.resolve(),
      typeof loadPayables === "function" ? loadPayables() : Promise.resolve(),
    ]);
    renderFinance();
    alert("Lançamento gerado para o mês atual.");
  }

  function financeRenderCadastros() {
    const body = document.getElementById("finCadastrosBody");
    const hint = document.getElementById("finCadastrosSchemaHint");
    if (!body) return;
    if (state.financeContactsLoadError && /relation|schema cache|does not exist|PGRST205/i.test(state.financeContactsLoadError.message || "")) {
      if (hint) {
        hint.textContent =
          "Para usar cadastros financeiros, execute no Supabase (SQL Editor) o script supabase/finance_contacts.sql.";
        hint.classList.remove("hidden");
      }
      body.innerHTML = `<tr><td colspan="8"><em>Cadastros indisponíveis até criar a tabela no Supabase.</em></td></tr>`;
      return;
    }
    if (hint) hint.classList.add("hidden");
    const q = String(finCadastroBusca || "").trim().toLowerCase();
    let list = financeContactsByTipo(finCadastroTipo);
    if (q) {
      list = list.filter((c) =>
        [c.nome, c.documento, c.email, c.telefone, c.contato, c.descricao_padrao]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }
    if (!list.length) {
      body.innerHTML = `<tr><td colspan="8"><em>Nenhum cadastro nesta categoria.</em></td></tr>`;
      return;
    }
    body.innerHTML = list
      .map((c) => {
        const rec = c.recorrente_ativo
          ? `<span class="finance-lanc-badge finance-lanc-badge--recorrente">${escapeHtml(c.recorrencia || "mensal")}</span>`
          : "—";
        const venc = c.dia_vencimento ? `Dia ${Number(c.dia_vencimento)}` : "—";
        const status = c.ativo === false ? `<span class="tag">Inativo</span>` : `<span class="tag ok">Ativo</span>`;
        return `<tr>
          <td data-label="Nome"><strong>${escapeHtml(c.nome || "—")}</strong></td>
          <td data-label="Documento">${escapeHtml(c.documento || "—")}</td>
          <td data-label="Contato">${escapeHtml([c.telefone, c.email].filter(Boolean).join(" · ") || c.contato || "—")}</td>
          <td data-label="Recorrente">${rec}</td>
          <td data-label="Valor">${escapeHtml(c.valor_padrao != null ? formatCurrency(Number(c.valor_padrao)) : "—")}</td>
          <td data-label="Vencimento">${escapeHtml(venc)}</td>
          <td data-label="Status">${status}</td>
          <td data-label="Ações" class="actions">
            <button type="button" class="secondary fin-contact-edit" data-id="${escapeHtml(c.id)}">Editar</button>
            <button type="button" class="secondary fin-contact-gerar" data-id="${escapeHtml(c.id)}">Gerar mês</button>
            <button type="button" class="secondary fin-contact-del" data-id="${escapeHtml(c.id)}">Excluir</button>
          </td>
        </tr>`;
      })
      .join("");
    body.querySelectorAll(".fin-contact-edit").forEach((btn) => {
      btn.addEventListener("click", () => financeOpenContactModal(financeContactById(btn.getAttribute("data-id"))));
    });
    body.querySelectorAll(".fin-contact-gerar").forEach((btn) => {
      btn.addEventListener("click", () => financeGerarLancamentoFromContact(btn.getAttribute("data-id")));
    });
    body.querySelectorAll(".fin-contact-del").forEach((btn) => {
      btn.addEventListener("click", () => financeDeleteContact(btn.getAttribute("data-id")));
    });
  }

  function financeNormalizeFinanceView(view) {
    if (view === "recebidos") return "caixa";
    if (view === "recorrentes") return "pagar";
    return view;
  }

  function financeRenderSubviewContent(view) {
    if (view === "dashboard") financeRenderDashboard();
    else if (view === "em_patio") financeRenderEmPatio();
    else if (view === "receber") financeRenderReceber();
    else if (view === "aguardando") financeRenderAguardando();
    else if (view === "pagar") financeRenderPagar();
    else if (view === "caixa") financeRenderCaixa();
    else if (view === "cadastros") financeRenderCadastros();
  }

  function financeActivateSubview(view, opts = {}) {
    if (!view || view === "none") return;
    const resolved = financeNormalizeFinanceView(view);
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
    if (opts.skipRender) return;
    financePopulateFinanceRppFilters();
    if (resolved === "caixa") {
      financeEnsureCaixaPeriodoDefault();
      financeRenderCaixaAsync();
      return;
    }
    financeRenderSubviewContent(resolved);
  }

  window.renderFinance = function renderFinance() {
    financePopulateFinanceRppFilters();
    financePurgeRecebidosUi();
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

  const FINANCE_CAIXA_REPAIR_KEY = "finance_caixa_repair_v2_done";

  async function financeRunCaixaRepairIfNeeded() {
    if (financeOperationalModeActive()) return null;
    const userId = typeof effectiveUserId === "function" ? effectiveUserId() : null;
    if (!userId) return null;
    try {
      const prev = localStorage.getItem(FINANCE_CAIXA_REPAIR_KEY);
      if (prev === userId) return null;
      let json = null;
      const repairResp = await fetch("/api/finance/repair-caixa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (repairResp.ok) {
        json = await repairResp.json().catch(() => ({}));
      } else if (typeof window.callRegisterCashReceivableApi === "function") {
        json = await window.callRegisterCashReceivableApi({ syncMissing: true, repairCash: true });
        if (!json?.ok) {
          console.warn("financeRunCaixaRepairIfNeeded fallback", json?.error || repairResp.status);
          return null;
        }
      } else {
        console.warn("financeRunCaixaRepairIfNeeded", repairResp.status);
        return null;
      }
      localStorage.setItem(FINANCE_CAIXA_REPAIR_KEY, userId);
      if (typeof loadCash === "function") await loadCash();
      if (typeof loadSettings === "function") await loadSettings();
      console.info("financeRunCaixaRepairIfNeeded", json);
      return json;
    } catch (e) {
      console.warn("financeRunCaixaRepairIfNeeded", e?.message || e);
      return null;
    }
  }

  window.financeRunCaixaRepairIfNeeded = financeRunCaixaRepairIfNeeded;

  window.refreshFinanceData = async function refreshFinanceData(opts = {}) {
    const preserveView = financeResolvePreserveView(opts);
    if (preserveView) {
      financeActivateSubview(preserveView, { skipRender: true });
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
          typeof loadPartners === "function" ? loadPartners() : Promise.resolve(),
          loadReceivables(),
          loadPayables(),
          loadCash(),
          loadVehicles(),
          typeof loadCycleClosures === "function" ? loadCycleClosures() : Promise.resolve(),
          typeof loadFinanceContacts === "function" ? loadFinanceContacts() : Promise.resolve(),
        ]);
        financePopulateFinanceRppFilters();
        if (typeof window.ensureRecorrentesAutomaticos === "function") {
          const recorrenteStats = await window.ensureRecorrentesAutomaticos();
          if (recorrenteStats?.created > 0) {
            await Promise.all([
              typeof loadReceivables === "function" ? loadReceivables() : Promise.resolve(),
              typeof loadPayables === "function" ? loadPayables() : Promise.resolve(),
            ]);
          }
        }
        if (typeof financeRunCaixaRepairIfNeeded === "function") {
          await financeRunCaixaRepairIfNeeded();
        }
        if (
          !financeOperationalModeActive() &&
          typeof window.syncPaidReceivablesCashMovements === "function"
        ) {
          await window.syncPaidReceivablesCashMovements();
        }
        if (preserveView) {
          financeActivateSubview(preserveView);
        } else {
          renderFinance();
        }
        updateDashboard?.();
        if (typeof window.syncLostReceivablesToContasReceber === "function") {
          window.syncLostReceivablesToContasReceber().catch((e) => {
            console.warn("syncLostReceivablesToContasReceber", e?.message || e);
          });
        }
        if (typeof window.syncVrpVehiclesMissingAguardandoFaturamento === "function") {
          try {
            await window.syncVrpVehiclesMissingAguardandoFaturamento();
          } catch (e) {
            console.warn("syncVrpVehiclesMissingAguardandoFaturamento", e?.message || e);
          }
        }
      } catch (e) {
        console.error("refreshFinanceData", e?.message || e);
        if (preserveView) {
          financeActivateSubview(preserveView);
        } else if (typeof renderFinance === "function") {
          renderFinance();
        }
      } finally {
        refreshFinanceDataPromise = null;
      }
    })();
    return refreshFinanceDataPromise;
  };

  async function financePromoteReceivableToContasReceber(receivableId) {
    const r = (state.receivables || []).find((x) => String(x.id) === String(receivableId));
    if (!r) return false;
    if (typeof window.ensureReceivablePromotedToContasReceber === "function") {
      return !!(await window.ensureReceivablePromotedToContasReceber(receivableId));
    }
    if (typeof addReceberTriagemId === "function") addReceberTriagemId(receivableId);
    return true;
  }

  async function financeApproveReceivable(receivableId) {
    const stayView = currentFinanceView;
    if (typeof requireSupabaseSessionForWrite === "function") {
      if (!(await requireSupabaseSessionForWrite())) return;
    }
    const ok = await financePromoteReceivableToContasReceber(receivableId);
    if (!ok) {
      alert("Não foi possível enviar para Contas a receber. Atualize a página e tente novamente.");
      return;
    }
    await refreshFinanceData({ preserveView: stayView && stayView !== "none" ? stayView : true });
  }

  function financePurgeRecebidosUi() {
    document
      .querySelectorAll(
        '[data-finance-subview-btn="recebidos"], button[data-finance-subview="recebidos"], .finance-subview[data-finance-subview="recebidos"]'
      )
      .forEach((el) => el.remove());
    if (currentFinanceView === "recebidos") {
      financeActivateSubview("caixa", { skipRender: true });
    }
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

  function financeStartFixZeroValorPago(ui = {}) {
    const n = FINANCE_ZERO_VALOR_PAGO_FIX_ENTRIES.length;
    const ok = window.confirm(
      `Corrigir ${n} pagamento(s) com R$ 0,00?\n\n` +
        "O valor será recalculado (diárias do pátio), o status permanece «Recebido» e a entrada será criada no caixa. " +
        "Nenhum registro voltará para «Aguardando faturamento»."
    );
    if (!ok) return Promise.resolve(null);
    return financeFixZeroValorPagoViaApi(
      { fixEntries: FINANCE_ZERO_VALOR_PAGO_FIX_ENTRIES },
      {
        hintId: ui.hintId || "finRecebidosRecoverHint",
        btnId: ui.btnId,
        btnBusy: ui.btnBusy || "Corrigindo valores…",
        btnDefault: ui.btnDefault || "Corrigir R$ 0 → caixa",
        onDone:
          ui.onDone ||
          (() => {
            financeRenderCaixa();
            if (typeof renderListaPanel === "function") renderListaPanel();
          }),
      }
    );
  }

  window.financeStartFixZeroValorPago = financeStartFixZeroValorPago;

  window.bindFinanceDashboardUiOnce = function bindFinanceDashboardUiOnce() {
    if (bindFinanceDashboardUiOnce._done) return;
    bindFinanceDashboardUiOnce._done = true;
    financePurgeRecebidosUi();

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
    document.getElementById("finReceberRpp")?.addEventListener("change", () => {
      if (currentFinanceView === "receber") financeRenderReceber();
    });
    document.getElementById("finAguardandoPlateForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      if (currentFinanceView === "aguardando") financeRenderAguardando();
    });
    document.getElementById("finAguardandoPlaca")?.addEventListener("input", () => {
      if (currentFinanceView === "aguardando") financeRenderAguardando();
    });
    document.getElementById("finAguardandoPeriodo")?.addEventListener("change", () => {
      if (currentFinanceView === "aguardando") financeRenderAguardando();
    });
    document.getElementById("finAguardandoRpp")?.addEventListener("change", () => {
      if (currentFinanceView === "aguardando") financeRenderAguardando();
    });
    ["finAguardandoDataDe", "finAguardandoDataAte", "finAguardandoDataBusca"].forEach((id) => {
      document.getElementById(id)?.addEventListener("change", () => {
        if (currentFinanceView === "aguardando") financeRenderAguardando();
      });
      document.getElementById(id)?.addEventListener("search", () => {
        if (currentFinanceView === "aguardando") financeRenderAguardando();
      });
    });
    document.getElementById("finReceberPlaca")?.addEventListener("input", () => {
      if (currentFinanceView === "receber") financeRenderReceber();
    });
    document.getElementById("finReceberPlacaClear")?.addEventListener("click", () => {
      ["finReceberPlaca", "finReceberRpp"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = "";
      });
      financeFilterReceberPlaca = "";
      financeFilterReceberRppId = "";
      if (currentFinanceView === "receber") financeRenderReceber();
    });
    document.getElementById("finCaixaPlaca")?.addEventListener("input", () => {
      if (currentFinanceView === "caixa") financeRenderCaixa();
    });
    document.getElementById("finAguardandoPlacaClear")?.addEventListener("click", () => {
      [
        "finAguardandoPlaca",
        "finAguardandoRpp",
        "finAguardandoPeriodo",
        "finAguardandoDataDe",
        "finAguardandoDataAte",
        "finAguardandoDataBusca",
      ].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = "";
      });
      financeFilterAguardandoPlaca = "";
      financeFilterAguardandoRppId = "";
      financeFilterAguardandoPeriodo = "";
      financeFilterAguardandoDataDe = "";
      financeFilterAguardandoDataAte = "";
      if (currentFinanceView === "aguardando") financeRenderAguardando();
    });

    ["finReceberDataDe", "finReceberDataAte", "finReceberDataBusca"].forEach((id) => {
      document.getElementById(id)?.addEventListener("change", () => {
        if (currentFinanceView === "receber") financeRenderReceber();
      });
      document.getElementById(id)?.addEventListener("search", () => {
        if (currentFinanceView === "receber") financeRenderReceber();
      });
    });
    document.getElementById("finCaixaFilterEntrada")?.addEventListener("click", () => {
      financeFilterCaixaTipo = financeFilterCaixaTipo === "entrada" ? "" : "entrada";
      financeRenderCaixa();
    });
    document.getElementById("finCaixaFilterSaida")?.addEventListener("click", () => {
      financeFilterCaixaTipo = financeFilterCaixaTipo === "saida" ? "" : "saida";
      financeRenderCaixa();
    });
    document.getElementById("finCaixaFilterApply")?.addEventListener("click", () => financeRenderCaixa());
    document.getElementById("finCaixaFilterClear")?.addEventListener("click", () => {
      ["finCaixaPlaca", "finCaixaRpp", "finCaixaDataDe", "finCaixaDataAte", "finCaixaDataBusca", "finFilterPeriodo"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = "";
      });
      financeFilterPeriodo = "";
      financeFilterCaixaPlaca = "";
      financeFilterCaixaRppId = "";
      financeFilterCaixaDataDe = "";
      financeFilterCaixaDataAte = "";
      financeFilterCaixaTipo = "";
      financeRenderCaixa();
    });
    document.getElementById("finCaixaRpp")?.addEventListener("change", () => {
      if (currentFinanceView === "caixa") financeRenderCaixa();
    });
    ["finCaixaPlaca", "finCaixaDataDe", "finCaixaDataAte", "finCaixaDataBusca", "finFilterPeriodo"].forEach((id) => {
      document.getElementById(id)?.addEventListener("change", () => {
        if (currentFinanceView === "caixa") financeRenderCaixa();
      });
      document.getElementById(id)?.addEventListener("search", () => {
        if (currentFinanceView === "caixa") financeRenderCaixa();
      });
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

    document.getElementById("viewFinanceiro")?.addEventListener("change", (e) => {
      const rowCheck = e.target.closest(".fin-row-check");
      if (rowCheck) {
        const view = rowCheck.getAttribute("data-fin-row-check");
        const id = rowCheck.value;
        if (!view || !id) return;
        if (rowCheck.checked) financeRowSelection[view]?.add(String(id));
        else financeRowSelection[view]?.delete(String(id));
        const tr = rowCheck.closest("tr");
        tr?.classList.toggle("fin-row-selected", rowCheck.checked);
        financeUpdateBatchBar(view);
        return;
      }
      const selectAll = e.target.closest(".fin-select-all");
      if (selectAll) {
        const view = selectAll.getAttribute("data-fin-select-all");
        if (!view) return;
        const checks = document.querySelectorAll(`.fin-row-check[data-fin-row-check="${view}"]`);
        financeRowSelection[view]?.clear();
        checks.forEach((chk) => {
          chk.checked = selectAll.checked;
          if (selectAll.checked) financeRowSelection[view]?.add(String(chk.value));
          chk.closest("tr")?.classList.toggle("fin-row-selected", selectAll.checked);
        });
        financeUpdateBatchBar(view);
      }
    });

    document.getElementById("viewFinanceiro")?.addEventListener("click", (e) => {
      const batchBtn = e.target.closest("[data-fin-batch-action]");
      if (batchBtn) {
        const view = batchBtn.getAttribute("data-fin-batch-view");
        const action = batchBtn.getAttribute("data-fin-batch-action");
        const count = financeRowSelection[view]?.size || 0;
        if (!view || !action || count < 1) return;
        if (action === "delete") {
          financeOpenBatchDeleteModal(view, count);
          return;
        }
        if (action === "promote") {
          financeOpenBatchConfirmModal({
            view,
            action,
            title: "Enviar para Contas a receber",
            subtitle: "Os títulos selecionados sairão de Aguardando faturamento.",
            message: `Enviar ${count} registro(s) selecionado(s) para Contas a receber?`,
            confirmLabel: "Confirmar envio",
            showPayFields: false,
          });
          return;
        }
        if (action === "pg") {
          financeOpenBatchConfirmModal({
            view,
            action,
            title: "Confirmar pagamento (PG)",
            subtitle: "Valor integral de cada título, com a data e forma informadas abaixo.",
            message: `Confirmar pagamento de ${count} conta(s) a receber selecionada(s)?`,
            confirmLabel: "Confirmar PG",
            showPayFields: true,
          });
          return;
        }
        if (action === "caixa") {
          financeOpenBatchConfirmModal({
            view,
            action,
            title: "Registrar no caixa",
            subtitle: "Pendentes serão quitados; pagos sem caixa receberão entrada.",
            message: `Registrar no caixa ${count} registro(s) selecionado(s)?`,
            confirmLabel: "Confirmar caixa",
            showPayFields: true,
          });
          return;
        }
      }
    });

    document.getElementById("finBatchDeleteConfirm")?.addEventListener("click", async () => {
      const btn = document.getElementById("finBatchDeleteConfirm");
      if (btn) btn.disabled = true;
      try {
        await financeExecuteBatchConfirm();
      } finally {
        if (btn) btn.disabled = false;
      }
    });
    document.getElementById("finBatchDeleteCancel")?.addEventListener("click", financeCloseBatchConfirmModal);
    document.getElementById("finBatchDeleteClose")?.addEventListener("click", financeCloseBatchConfirmModal);
    document.getElementById("finBatchDeleteModal")?.addEventListener("click", (e) => {
      if (e.target.id === "finBatchDeleteModal") financeCloseBatchConfirmModal();
    });

    document.getElementById("finBtnNovaDespesa")?.addEventListener("click", () => financeOpenDespesaModal(false));
    document.getElementById("finBtnNovaReceita")?.addEventListener("click", () => financeOpenReceitaModal(false));
    document.getElementById("finBtnNovoContato")?.addEventListener("click", () => financeOpenContactModal(null, finCadastroTipo));
    document.getElementById("finCadastroBusca")?.addEventListener("input", (e) => {
      finCadastroBusca = e.target.value || "";
      if (currentFinanceView === "cadastros") financeRenderCadastros();
    });
    document.getElementById("finCadastroSubnav")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-fin-cadastro-tipo]");
      if (!btn) return;
      finCadastroTipo = btn.getAttribute("data-fin-cadastro-tipo") || "PRESTADOR";
      document.querySelectorAll("#finCadastroSubnav [data-fin-cadastro-tipo]").forEach((b) => {
        b.classList.toggle("active", b.getAttribute("data-fin-cadastro-tipo") === finCadastroTipo);
      });
      financeRenderCadastros();
    });
    document.getElementById("finContactForm")?.addEventListener("submit", financeSaveContactFromForm);
    document.getElementById("finContactTipo")?.addEventListener("change", financeSyncContactModalTipoFields);
    document.getElementById("finContactRecorrente")?.addEventListener("change", financeSyncContactModalTipoFields);
    document.getElementById("closeFinContactModal")?.addEventListener("click", financeCloseContactModal);
    document.getElementById("cancelFinContactModal")?.addEventListener("click", financeCloseContactModal);
    document.getElementById("finDespContactSelect")?.addEventListener("change", (e) => {
      const id = e.target.value;
      if (id) financeApplyContactToDespesaForm(id);
    });
    document.getElementById("finRecContactSelect")?.addEventListener("change", (e) => {
      const id = e.target.value;
      if (id) financeApplyContactToReceitaForm(id);
    });
    document.getElementById("finDespModo")?.addEventListener("change", financeSyncDespesaModoFields);
    document.getElementById("finRecModo")?.addEventListener("change", financeSyncReceitaModoFields);
    document.getElementById("finRecJaRecebido")?.addEventListener("change", financeSyncReceitaModoFields);
    document.getElementById("finRecDataLancamento")?.addEventListener("change", () => {
      if (document.getElementById("finRecJaRecebido")?.checked) financeSyncFinRecDataRecebimentoFromLancamento();
    });
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
        const contactId = document.getElementById("finDespContactSelect")?.value || null;
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
          financeContactId: contactId || null,
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
      const origem = document.getElementById("finRecCliente")?.value?.trim();
      const rpp = document.getElementById("finRecRpp")?.value?.trim();
      const descricao = document.getElementById("finRecDescricao")?.value?.trim();
      const valor = Number(document.getElementById("finRecValor")?.value);
      const dataLancamento = document.getElementById("finRecDataLancamento")?.value;
      const vencimento = document.getElementById("finRecVencimento")?.value;
      const jaRecebido = document.getElementById("finRecJaRecebido")?.checked === true;
      const dataRecebimento =
        document.getElementById("finRecDataRecebimento")?.value || dataLancamento;
      const categoria = document.getElementById("finRecCategoria")?.value;
      const formaPagamento = document.getElementById("finRecForma")?.value || "PIX";
      const observacoes = document.getElementById("finRecObs")?.value?.trim() || "";
      const modo = document.getElementById("finRecModo")?.value || "UNICA";
      const recorrenciaIntervalo = document.getElementById("finRecRecorrencia")?.value || "mensal";
      const parcelas = Number(document.getElementById("finRecParcelas")?.value) || 2;
      if (!origem || !descricao || !dataLancamento || !vencimento || !Number.isFinite(valor) || valor <= 0) {
        alert("Preencha origem, descrição, data do lançamento, valor e vencimento.");
        return;
      }
      if (jaRecebido && !dataRecebimento) {
        alert("Informe a data do recebimento no caixa.");
        return;
      }
      const submitBtn = e.target.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      try {
        const contactId = document.getElementById("finRecContactSelect")?.value || null;
        const result = await insertManualReceivableLancamento({
          descricao,
          valor,
          data: dataLancamento,
          vencimento,
          categoria,
          cliente: origem,
          rpp,
          formaPagamento,
          observacoes,
          pago: jaRecebido,
          dataPagamento: jaRecebido ? dataRecebimento : "",
          modo,
          parcelas,
          recorrenciaIntervalo,
          financeContactId: contactId || null,
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
      const btnReceberPg = e.target.closest("[data-fin-receber-pg]");
      if (btnReceberPg) {
        const id = btnReceberPg.getAttribute("data-fin-receber-pg");
        const r = (state.receivables || []).find((x) => String(x.id) === String(id));
        if (!r) return;
        const v = financeVehicleById().get(r.vehicle_id);
        openReceberBaixaModal({ receivable: r, vehicle: v, valor: r.valor });
        return;
      }
      const btnReceberCaixa = e.target.closest("[data-fin-receber-caixa]");
      if (btnReceberCaixa) {
        const id = btnReceberCaixa.getAttribute("data-fin-receber-caixa");
        const r = (state.receivables || []).find((x) => String(x.id) === String(id));
        if (!r) return;
        const v = financeVehicleById().get(r.vehicle_id);
        openReceberBaixaModal({ receivable: r, vehicle: v, valor: r.valor, mode: "caixa" });
        return;
      }
      const btnReceberEditar = e.target.closest("[data-fin-receber-editar]");
      if (btnReceberEditar) {
        await financeEditReceberPrompt(btnReceberEditar.getAttribute("data-fin-receber-editar"));
        return;
      }
      const btnReceberVoltar = e.target.closest("[data-fin-receber-voltar]");
      if (btnReceberVoltar) {
        await financeVoltarReceberPrompt(btnReceberVoltar.getAttribute("data-fin-receber-voltar"));
        return;
      }
      const btnReceberApagar = e.target.closest("[data-fin-receber-apagar]");
      if (btnReceberApagar) {
        await financeDeleteReceberPrompt(btnReceberApagar.getAttribute("data-fin-receber-apagar"));
        return;
      }
      const btnPagarPg = e.target.closest("[data-fin-pagar-pg]");
      if (btnPagarPg) {
        const id = btnPagarPg.getAttribute("data-fin-pagar-pg");
        const p = (state.payables || []).find((x) => String(x.id) === String(id));
        if (p) openPagarBaixaModal(p, { mode: "payment" });
        return;
      }
      const btnPagarCaixa = e.target.closest("[data-fin-pagar-caixa]");
      if (btnPagarCaixa) {
        const id = btnPagarCaixa.getAttribute("data-fin-pagar-caixa");
        const p = (state.payables || []).find((x) => String(x.id) === String(id));
        if (p) openPagarBaixaModal(p, { mode: "caixa" });
        return;
      }
      const btnPagarEditar = e.target.closest("[data-fin-pagar-editar]");
      if (btnPagarEditar) {
        await financeEditPagarPrompt(btnPagarEditar.getAttribute("data-fin-pagar-editar"));
        return;
      }
      const btnPagarVoltar = e.target.closest("[data-fin-pagar-voltar]");
      if (btnPagarVoltar) {
        await financeVoltarPagarPrompt(btnPagarVoltar.getAttribute("data-fin-pagar-voltar"));
        return;
      }
      const btnPagarApagar = e.target.closest("[data-fin-pagar-apagar]");
      if (btnPagarApagar) {
        await financeDeletePagarPrompt(btnPagarApagar.getAttribute("data-fin-pagar-apagar"));
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

  window.financeGetCaixaResetYm = financeGetCaixaResetYm;
  window.financeCaixaResetActive = financeCaixaResetActive;
  window.financeMovInCaixaWindow = financeMovInCaixaWindow;
  window.financeCaixaResetPreview = async function financeCaixaResetPreview(opts = {}) {
    const userId = typeof effectiveUserId === "function" ? effectiveUserId() : null;
    if (!userId) return { ok: false, error: "Usuário não autenticado." };
    const resp = await fetch("/api/finance/caixa-reset/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, resetYm: opts.resetYm }),
    });
    return resp.json();
  };
  window.financeCaixaResetExecute = async function financeCaixaResetExecute(opts = {}) {
    const userId = typeof effectiveUserId === "function" ? effectiveUserId() : null;
    if (!userId) return { ok: false, error: "Usuário não autenticado." };
    const resp = await fetch("/api/finance/caixa-reset/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        resetYm: opts.resetYm,
        confirm: opts.confirm || "EXECUTE_CAIXA_RESET",
      }),
    });
    const data = await resp.json();
    if (data.ok && typeof refreshFinanceData === "function") await refreshFinanceData();
    return data;
  };
  window.financeOperationalModeActive = financeOperationalModeActive;
  window.financeCashAprovadoCaixa = financeCashAprovadoCaixa;
  window.financeCashAprovadoFromMov = financeCashAprovadoFromMov;
  window.financeCashExcluirFromMov = financeCashExcluirFromMov;
  window.financeCashMovIsLegacyNeutralized = financeCashMovIsLegacyNeutralized;
  window.financeCaixaMovsHistorico = financeCaixaMovsHistorico;
  window.financeSaldoCaixa = financeSaldoCaixa;
  window.financeCashMovValor = financeCashMovValor;
  window.financeDedupeCaixaMovs = financeDedupeCaixaMovs;
  window.financeCaixaMovsMerged = financeCaixaMovsMerged;
  window.financeCaixaMovsForPeriod = financeCaixaMovsForPeriod;
  window.financeCaixaMovCompetenciaYmd = financeCaixaMovCompetenciaYmd;
  window.financeReceivableCashCompetenciaYmd = financeReceivableCashCompetenciaYmd;
  window.financePayableCashCompetenciaYmd = financePayableCashCompetenciaYmd;
  window.financePayableDefaultBaixaDateYmd = financePayableDefaultBaixaDateYmd;
  window.financeIsManualPayable = financeIsManualPayable;
  window.financeDedupePatioReceivables = financeDedupePatioReceivables;
  window.financeParseDateRangeText = financeParseDateRangeText;
  window.financeYmdInRange = financeYmdInRange;
  window.financeReceivableSaidaYmd = financeReceivableSaidaYmd;
})();

/**
 * LOGS TEMPORÁRIOS — auditoria de persistência Contas a Receber.
 * Remover após estabilizar o problema de mensalistas.
 */
(function () {
  const KEY = "amplipatio_finance_persist_audit_v1";
  const MAX = 80;

  function now() {
    return new Date().toISOString();
  }

  function uid() {
    try {
      if (typeof effectiveUserId === "function") return effectiveUserId() || null;
    } catch (_) {}
    return null;
  }

  function push(entry) {
    const row = { t: now(), user_id: uid(), ...entry };
    try {
      const prev = JSON.parse(localStorage.getItem(KEY) || "[]");
      const next = Array.isArray(prev) ? prev : [];
      next.push(row);
      while (next.length > MAX) next.shift();
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch (_) {}
    console.info("[finance-persist-audit]", row.op, row);
    return row;
  }

  function summarizeReceivables(rows) {
    const list = Array.isArray(rows) ? rows : [];
    const isManual =
      typeof window.receivableIsManualControleReceitas === "function"
        ? window.receivableIsManualControleReceitas
        : (r) => !r?.vehicle_id;
    const isConta =
      typeof window.receivableIsContaReceberFinanceiro === "function"
        ? window.receivableIsContaReceberFinanceiro
        : () => false;
    const manual = list.filter(isManual);
    const manualVisible = manual.filter(isConta);
    const manualHidden = manual.filter((r) => !isConta(r));
    const byStatus = {};
    manual.forEach((r) => {
      const st = String(r.status || "").toUpperCase() || "?";
      byStatus[st] = (byStatus[st] || 0) + 1;
    });
    return {
      total: list.length,
      manual_total: manual.length,
      manual_visible_contas_receber: manualVisible.length,
      manual_hidden: manualHidden.length,
      manual_by_status: byStatus,
      hidden_sample: manualHidden.slice(0, 5).map((r) => ({
        id: r.id,
        status: r.status,
        valor: r.valor,
        subcategoria: r.subcategoria,
        aprovado: r.financeiro_aprovado_contas_receber,
        period_end: r.period_end,
      })),
    };
  }

  window.financePersistAudit = {
    save(payload) {
      return push({ op: "SAVE", ...payload });
    },
    edit(payload) {
      return push({ op: "EDIT", ...payload });
    },
    load(payload) {
      return push({ op: "LOAD", ...payload });
    },
    delete(payload) {
      return push({ op: "DELETE", ...payload });
    },
    sync(payload) {
      return push({ op: "SYNC", ...payload });
    },
    summarizeReceivables,
    dump() {
      try {
        return JSON.parse(localStorage.getItem(KEY) || "[]");
      } catch (_) {
        return [];
      }
    },
    clear() {
      try {
        localStorage.removeItem(KEY);
      } catch (_) {}
    },
  };
})();

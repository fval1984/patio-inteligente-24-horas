/**
 * Conferir PIX — registro manual e vínculo a títulos.
 * Não altera cobranças fechadas; só grava pix_recebimentos / pix_alocacoes.
 */
(function financePixUi(global) {
  "use strict";

  let cache = [];
  let missingTable = false;

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function money(n) {
    if (typeof formatCurrency === "function") return formatCurrency(n);
    return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function uid() {
    if (typeof effectiveUserId === "function") return effectiveUserId();
    return global.state?.user?.id || null;
  }

  function db() {
    return global.supabaseClient || global.supabase;
  }

  function today() {
    if (typeof financeTodayYmd === "function") return financeTodayYmd();
    return new Date().toISOString().slice(0, 10);
  }

  function openReceivables() {
    if (typeof financeContasReceberList === "function") return financeContasReceberList() || [];
    return (global.state?.receivables || []).filter((r) => String(r.status || "").toUpperCase() !== "PAGO");
  }

  function receivableLabel(r) {
    const v = (global.state?.vehicles || []).find((x) => String(x.id) === String(r.vehicle_id));
    const placa = v?.placa || "—";
    const nome = v ? [v.marca, v.modelo].filter(Boolean).join(" ") : "Título";
    return `${placa} · ${nome} · ${money(r.valor)}`;
  }

  async function loadRows() {
    const client = db();
    const owner = uid();
    if (!client || !owner) {
      cache = [];
      return;
    }
    const { data, error } = await client
      .from("pix_recebimentos")
      .select("*, pix_alocacoes(*)")
      .eq("user_id", owner)
      .order("data_recebimento", { ascending: false })
      .limit(80);
    if (error) {
      missingTable = /schema cache|does not exist|pix_recebimentos/i.test(error.message || "");
      cache = [];
      return;
    }
    missingTable = false;
    cache = data || [];
  }

  function allocated(row) {
    return (row.pix_alocacoes || []).reduce((s, a) => s + Number(a.valor || 0), 0);
  }

  function render() {
    const host = document.getElementById("finPixRoot");
    if (!host) return;
    const recs = openReceivables();
    const recOpts = recs
      .map((r) => `<option value="${esc(r.id)}">${esc(receivableLabel(r))}</option>`)
      .join("");
    const rows = cache.length
      ? cache
          .map((row) => {
            const used = allocated(row);
            const rest = Math.max(0, Number(row.valor || 0) - used);
            return `<tr>
              <td>${esc(String(row.data_recebimento || "").slice(0, 10))}</td>
              <td>${esc(money(row.valor))}</td>
              <td>${esc(row.pagador_nome || "—")}</td>
              <td>${esc(row.txid || "—")}</td>
              <td>${esc(money(used))}</td>
              <td>${esc(money(rest))}</td>
            </tr>`;
          })
          .join("")
      : `<tr><td colspan="6" class="notice">Nenhum PIX conferido ainda.</td></tr>`;
    host.innerHTML = `
      <p class="notice">Registre o PIX recebido e vincule a um ou mais títulos em aberto. Pagamento parcial deixa o saldo no título. A importação de extrato bancário fica para uma etapa seguinte.</p>
      ${
        missingTable
          ? `<p class="notice">Para gravar no banco, execute <strong>supabase/pix_conciliacao.sql</strong> no SQL Editor. Nenhum registro financeiro existente é alterado.</p>`
          : ""
      }
      <form id="finPixForm" class="fin-pix-form">
        <label>Data <input type="date" id="finPixData" required value="${esc(today())}" /></label>
        <label>Valor <input type="number" id="finPixValor" min="0.01" step="0.01" required /></label>
        <label>Pagador <input type="text" id="finPixPagador" maxlength="120" /></label>
        <label>Identificador (txid) <input type="text" id="finPixTxid" maxlength="80" /></label>
        <label class="fin-pix-span">Vincular a título(s)
          <select id="finPixTitulos" multiple size="6">${recOpts || "<option disabled>Nenhum título em aberto</option>"}</select>
        </label>
        <button type="submit">Registrar PIX</button>
      </form>
      <div class="table-wrap section-card">
        <table class="table">
          <thead><tr><th>Data</th><th>Valor</th><th>Pagador</th><th>Txid</th><th>Vinculado</th><th>Saldo do PIX</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  async function onSubmit(event) {
    event.preventDefault();
    const client = db();
    const owner = uid();
    if (!client || !owner) {
      alert("Faça login para registrar o PIX.");
      return;
    }
    const valor = Number(document.getElementById("finPixValor")?.value || 0);
    const data = document.getElementById("finPixData")?.value || today();
    const pagador = String(document.getElementById("finPixPagador")?.value || "").trim();
    const txid = String(document.getElementById("finPixTxid")?.value || "").trim();
    const sel = [...(document.getElementById("finPixTitulos")?.selectedOptions || [])].map((o) => o.value).filter(Boolean);
    if (!(valor > 0)) {
      alert("Informe o valor do PIX.");
      return;
    }
    const payload = {
      user_id: owner,
      data_recebimento: data,
      valor,
      pagador_nome: pagador || null,
      txid: txid || null,
      origem: "manual",
      created_by: global.state?.user?.id || null,
      created_by_email: global.state?.user?.email || null,
    };
    const { data: row, error } = await client.from("pix_recebimentos").insert(payload).select("id").maybeSingle();
    if (error) {
      if (/duplicate|unique/i.test(error.message || "")) {
        alert("Este identificador de transação já foi registrado.");
        return;
      }
      alert(
        /schema cache|does not exist/i.test(error.message || "")
          ? "Execute supabase/pix_conciliacao.sql no Supabase para ativar a conciliação PIX."
          : error.message
      );
      return;
    }
    if (row?.id && sel.length) {
      const share = Math.round((valor / sel.length) * 100) / 100;
      let remaining = valor;
      const allocs = sel.map((receivableId, i) => {
        const v = i === sel.length - 1 ? remaining : Math.min(share, remaining);
        remaining = Math.round((remaining - v) * 100) / 100;
        return {
          user_id: owner,
          pix_id: row.id,
          receivable_id: receivableId,
          valor: v,
          created_by_email: global.state?.user?.email || null,
        };
      });
      await client.from("pix_alocacoes").insert(allocs);
      await client.from("pix_auditoria").insert({
        user_id: owner,
        pix_id: row.id,
        acao: "registrar",
        detalhe: { titulos: sel, valor },
        usuario_email: global.state?.user?.email || null,
      });
    }
    await loadRows();
    render();
  }

  function bindHost() {
    const host = document.getElementById("finPixRoot");
    if (!host || host.dataset.pixBound) return;
    host.dataset.pixBound = "1";
    host.addEventListener("submit", (event) => {
      if (event.target && event.target.id === "finPixForm") void onSubmit(event);
    });
  }

  async function refresh() {
    bindHost();
    await loadRows();
    render();
  }

  global.financePixUi = { refresh };
})(typeof window !== "undefined" ? window : globalThis);

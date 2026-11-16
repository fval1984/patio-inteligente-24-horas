/**
 * Caderneta do parceiro — lê os mesmos recebimentos, faturas e pagamentos.
 * Não cria cobrança nem altera valor.
 */
(function parceiroCadernetaModule(global) {
  "use strict";

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

  function veiculoDoParceiro(partnerId, vehicles) {
    const id = String(partnerId);
    return (vehicles || []).filter((v) =>
      [v.localizador_id, v.leiloeiro_id, v.patio_parceiro_id, v.responsavel_financeiro_id, v.rpp_id, v.rpv_id].some(
        (value) => String(value || "") === id
      )
    );
  }

  function render() {
    const root = document.getElementById("parceiroCadernetaRoot");
    if (!root) return;
    const partners = global.state?.partners || [];
    const escolhido = root.dataset.partner || "";
    const opcoes = partners
      .filter((p) => p?.id && p.ativo !== false)
      .map((p) => `<option value="${esc(p.id)}" ${String(p.id) === escolhido ? "selected" : ""}>${esc(p.nome || "Parceiro")}</option>`)
      .join("");
    const partner = partners.find((p) => String(p.id) === escolhido);
    const veiculos = partner ? veiculoDoParceiro(partner.id, global.state?.vehicles) : [];
    const ids = new Set(veiculos.map((v) => String(v.id)));
    const recs = (global.state?.receivables || []).filter((r) => ids.has(String(r.vehicle_id)));
    const pagos = recs.filter((r) => String(r.status || "").toUpperCase() === "PAGO");
    const abertos = recs.filter((r) => String(r.status || "").toUpperCase() !== "PAGO" && Number(r.valor || 0) > 0);
    const saldo = abertos.reduce((s, r) => s + Number(r.valor || 0), 0);
    const recebido = pagos.reduce((s, r) => s + Number(r.valor || 0), 0);
    root.innerHTML = `
      <h3 style="margin:0 0 8px">Cadernetas</h3>
      <p class="notice">Os valores são os mesmos do financeiro. Esta tela não gera cobrança nova.</p>
      <label>Parceiro <select id="cadernetaParceiro"><option value="">Selecione</option>${opcoes}</select></label>
      ${
        partner
          ? `<div class="cx-dl" style="margin-top:12px">
              <div><span>Veículos</span><strong>${veiculos.length}</strong></div>
              <div><span>Recebido</span><strong>${esc(money(recebido))}</strong></div>
              <div><span>Saldo pendente</span><strong>${esc(money(saldo))}</strong></div>
            </div>
            <table class="cx-lines"><thead><tr><th>Placa</th><th>Situação</th><th>Valor</th></tr></thead>
            <tbody>${recs
              .map((r) => {
                const v = veiculos.find((item) => String(item.id) === String(r.vehicle_id));
                const pago = String(r.status || "").toUpperCase() === "PAGO";
                return `<tr><td>${esc(v?.placa || "—")}</td><td>${pago ? "Recebido" : "Pendente"}</td><td>${esc(money(r.valor))}</td></tr>`;
              })
              .join("") || `<tr><td colspan="3">Nenhum lançamento vinculado.</td></tr>`}</tbody></table>`
          : ""
      }`;
    document.getElementById("cadernetaParceiro")?.addEventListener("change", (ev) => {
      root.dataset.partner = ev.target.value;
      render();
    });
  }

  global.parceiroCaderneta = { render };
})(typeof window !== "undefined" ? window : globalThis);

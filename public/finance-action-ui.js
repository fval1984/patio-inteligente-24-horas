/**
 * Cartões, detalhes e financeiras — apresentação do módulo Financeiro.
 * Não altera regras de baixa/pagamento; só organiza a interface.
 */
(function financeActionUiModule(global) {
  "use strict";

  function esc(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function monthLabel(ym) {
    if (!ym || ym.length < 7) return "—";
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
    return `${names[(m || 1) - 1] || ym} ${y || ""}`.trim();
  }

  function statusClass(kind) {
    if (kind === "late") return "fin-act-status fin-act-status--late";
    if (kind === "soon") return "fin-act-status fin-act-status--soon";
    if (kind === "ok") return "fin-act-status fin-act-status--ok";
    return "fin-act-status fin-act-status--open";
  }

  function renderLaunchCards(host, cards, emptyText, kind) {
    if (!host) return;
    if (!cards?.length) {
      host.innerHTML = `<p class="fin-act-empty">${esc(emptyText || "Nenhum lançamento.")}</p>`;
      return;
    }
    const actionLabel = kind === "pagar" ? "Pagar" : "Receber";
    const actionAttr = kind === "pagar" ? "data-fin-group-pagar" : "data-fin-group-receber";
    const singleAttr = kind === "pagar" ? "data-fin-pagar-pg" : "data-fin-receber-pg";
    host.innerHTML = `<div class="fin-act-launch-list">${cards
      .map((c) => {
        const unpaid = (c.actionIds || []).filter(Boolean);
        const ids = unpaid.join(",");
        const actionBtn =
          unpaid.length === 1
            ? `<button type="button" class="fin-act-primary" ${singleAttr}="${esc(unpaid[0])}">${actionLabel}</button>`
            : unpaid.length > 1
              ? `<button type="button" class="fin-act-primary" data-fin-act-detalhe="${esc(kind)}" data-fin-act-ids="${esc((c.allIds || []).join(","))}">${actionLabel}</button>`
              : "";
        return `<article class="fin-act-launch">
          <div>
            <h4>${esc(c.title)}</h4>
            <p>${esc(c.subtitle || "")}</p>
            <p>${esc(c.dueLabel || "")}</p>
          </div>
          <div>
            <div class="fin-act-launch-amount">${esc(c.amountLabel)}</div>
            <span class="${statusClass(c.statusKind)}">${esc(c.status)}</span>
          </div>
          <div class="fin-act-launch-actions">
            ${actionBtn}
            <button type="button" class="secondary" data-fin-act-detalhe="${esc(kind)}" data-fin-act-ids="${esc((c.allIds || []).join(","))}">Detalhes</button>
          </div>
        </article>`;
      })
      .join("")}</div>`;
  }

  function ensureDetailModal() {
    let modal = document.getElementById("finActDetailModal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "finActDetailModal";
    modal.className = "modal-backdrop hidden";
    modal.innerHTML = `<div class="modal">
      <div class="modal-header">
        <div>
          <h3 id="finActDetailTitle">Detalhes</h3>
          <p class="subtitle" id="finActDetailSub" style="margin:4px 0 0"></p>
        </div>
        <button type="button" class="modal-close" id="finActDetailClose" aria-label="Fechar">Fechar</button>
      </div>
      <div id="finActDetailBody"></div>
    </div>`;
    (document.body || document.getElementById("viewFinanceiro")).appendChild(modal);
    modal.addEventListener("click", (e) => {
      if (e.target.id === "finActDetailModal") closeDetailModal();
    });
    modal.querySelector("#finActDetailClose")?.addEventListener("click", closeDetailModal);
    return modal;
  }

  function openDetailModal(title, subtitle, bodyHtml) {
    const modal = ensureDetailModal();
    const t = document.getElementById("finActDetailTitle");
    const s = document.getElementById("finActDetailSub");
    const b = document.getElementById("finActDetailBody");
    if (t) t.textContent = title || "Detalhes";
    if (s) s.textContent = subtitle || "";
    if (b) b.innerHTML = bodyHtml || "";
    modal.classList.remove("hidden");
  }

  function closeDetailModal() {
    document.getElementById("finActDetailModal")?.classList.add("hidden");
  }

  function renderDetailRows(rows) {
    return `<div class="fin-act-detail-grid">${(rows || [])
      .map((r) => {
        const value = r.html ? String(r.value || "") : esc(r.value);
        return `<div><span>${esc(r.label)}</span><strong>${value}</strong></div>`;
      })
      .join("")}</div>`;
  }

  function renderReceberDetailItems(items) {
    if (!items?.length) return `<p class="fin-act-empty">Nenhum registro neste grupo.</p>`;
    return `<div class="fin-act-item-list">${items
      .map((item) => {
        const receiveBtn =
          item.canReceive && item.id
            ? `<button type="button" class="fin-act-primary" data-fin-receber-pg="${esc(item.id)}">Receber ${esc(item.amountLabel || "")}</button>`
            : "";
        const vehicleBtn = item.vehicleId
          ? `<button type="button" class="secondary" data-fin-open-vehicle="${esc(item.vehicleId)}">${esc(item.placa || "Veículo")}</button>`
          : "";
        return `<article class="fin-act-item">
          <div>
            <h4>${esc(item.title)}</h4>
            ${item.servico ? `<p class="fin-act-item-servico">Serviço: ${esc(item.servico)}</p>` : ""}
            <p>${esc(item.subtitle || "")}</p>
            <p>${esc(item.dueLabel || "")}</p>
          </div>
          <div>
            <div class="fin-act-launch-amount">${esc(item.amountLabel)}</div>
            <span class="${statusClass(item.statusKind)}">${esc(item.status)}</span>
          </div>
          <div class="fin-act-launch-actions">
            ${receiveBtn}
            ${vehicleBtn}
          </div>
          ${item.historyHtml ? `<div class="fin-act-item-hist"><h5>Histórico deste serviço</h5>${item.historyHtml}</div>` : ""}
        </article>`;
      })
      .join("")}</div>`;
  }

  function renderAttentionCards(items) {
    return `<div class="fin-act-attention-grid">${(items || [])
      .map(
        (a) => `<button type="button" class="fin-act-attention-card fin-act-attention-card--${esc(a.tone)}" data-fin-act-goto="${esc(a.view)}" data-fin-act-filter="${esc(a.filter)}">
          <span class="fin-act-attention-count">${esc(String(a.count ?? 0))}</span>
          <span class="fin-act-attention-title">${esc(a.title)}</span>
          <small>${esc(a.detail || "")}</small>
          <span class="fin-act-attention-go">Ver agora →</span>
        </button>`
      )
      .join("")}</div>`;
  }

  function renderLancamentoCards(host, cards, emptyText) {
    if (!host) return;
    if (!cards?.length) {
      host.innerHTML = `<p class="fin-act-empty">${esc(emptyText || "Nenhum lançamento.")}</p>`;
      return;
    }
    host.innerHTML = `<div class="fin-act-launch-list">${cards
      .map((c) => {
        const kind = c.kind === "pagar" || c.kind === "saida" ? "pagar" : "receber";
        const unpaid = (c.actionIds || []).filter(Boolean);
        const actionLabel = kind === "pagar" ? "Pagar" : "Receber";
        const actionAttr = kind === "pagar" ? "data-fin-group-pagar" : "data-fin-group-receber";
        const singleAttr = kind === "pagar" ? "data-fin-pagar-pg" : "data-fin-receber-pg";
        const actionBtn =
          unpaid.length === 1
            ? `<button type="button" class="fin-act-primary" ${singleAttr}="${esc(unpaid[0])}">${actionLabel}</button>`
            : unpaid.length > 1
              ? `<button type="button" class="fin-act-primary" ${actionAttr}="${esc(unpaid.join(","))}">${actionLabel}</button>`
              : "";
        const vehicleBtn = c.vehicleId
          ? `<button type="button" class="secondary" data-fin-open-vehicle="${esc(c.vehicleId)}">${esc(c.placa || "Veículo")}</button>`
          : "";
        return `<article class="fin-act-launch">
          <div>
            <h4>${esc(c.title)}</h4>
            <p>${esc(c.subtitle || "")}</p>
            <p>${esc(c.dueLabel || "")}</p>
          </div>
          <div>
            <div class="fin-act-launch-amount">${esc(c.amountLabel)}</div>
            <span class="${statusClass(c.statusKind)}">${esc(c.status)}</span>
          </div>
          <div class="fin-act-launch-actions">
            ${actionBtn}
            ${vehicleBtn}
            <button type="button" class="secondary" data-fin-act-detalhe="${esc(kind)}" data-fin-act-ids="${esc((c.allIds || []).join(","))}">Detalhes</button>
          </div>
        </article>`;
      })
      .join("")}</div>`;
  }

  function renderReportCards(host, items) {
    if (!host) return;
    host.innerHTML = `<div class="fin-act-report-grid">${(items || [])
      .map(
        (r) => `<article class="fin-act-report">
          <h4>${esc(r.title)}</h4>
          <p>${esc(r.detail || "")}</p>
          <div class="fin-act-launch-actions">
            <button type="button" class="fin-act-primary" data-fin-report="${esc(r.id)}" data-fin-report-fmt="print">Imprimir / PDF</button>
            <button type="button" class="secondary" data-fin-report="${esc(r.id)}" data-fin-report-fmt="csv">Excel / CSV</button>
          </div>
        </article>`
      )
      .join("")}</div>`;
  }

  function renderFinanceirasTable(host, rows, emptyText) {
    if (!host) return;
    if (!rows?.length) {
      host.innerHTML = `<p class="fin-act-empty">${esc(emptyText || "Nenhuma financeira com movimento.")}</p>`;
      return;
    }
    host.innerHTML = `<div class="fin-act-table-wrap"><table class="table fin-act-table">
      <thead><tr><th>Financeira</th><th>Veículos</th><th>A receber</th><th>Recebido</th><th>Em aberto</th></tr></thead>
      <tbody>${rows
        .map(
          (r) => `<tr data-fin-act-financeira="${esc(r.id)}">
            <td>${esc(r.nome)}</td>
            <td>${esc(String(r.veiculos))}</td>
            <td>${esc(r.aReceberLabel)}</td>
            <td>${esc(r.recebidoLabel)}</td>
            <td>${esc(r.emAbertoLabel)}</td>
          </tr>`
        )
        .join("")}</tbody>
    </table></div>
    <div class="fin-financeiras-detail"></div>`;
  }

  global.financeActionUi = {
    monthLabel,
    renderLaunchCards,
    renderLancamentoCards,
    renderReceberDetailItems,
    renderAttentionCards,
    renderReportCards,
    openDetailModal,
    closeDetailModal,
    renderDetailRows,
    renderFinanceirasTable,
    ensureDetailModal,
  };
})(typeof window !== "undefined" ? window : globalThis);

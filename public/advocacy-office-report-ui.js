/**
 * Relatório detalhado de escritório — tela, impressão e PDF.
 * Usa o mesmo HTML do documento. Não grava nem altera veículos, pátio ou financeiro.
 */
(function advocacyOfficeReportUi(global) {
  "use strict";

  const LOGO = "/assets/ampliguard-marca.png?v=20260917logo2";
  const FOOTER = "AMPLIGUARD – Guarda, Custódia e Remoção de Veículos";
  let _token = 0;
  let _bound = false;
  let _issuedLabel = "";

  function svc() {
    return global.advocacyOfficesService;
  }

  function esc(str) {
    return String(str != null ? str : "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function dash(value) {
    const s = String(value == null ? "" : value).trim();
    return s ? s : "—";
  }

  function fmtYmd(ymd) {
    if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(String(ymd))) return "—";
    const [y, m, d] = String(ymd).split("-");
    return `${d}/${m}/${y}`;
  }

  function fmtDates(list) {
    if (!list || !list.length) return "—";
    return list.map((d) => fmtYmd(d)).join(" · ");
  }

  function fmtMoney(n) {
    if (n == null || n === "") return "—";
    const x = Number(n);
    if (!Number.isFinite(x)) return "—";
    return x.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function fmtWhen(date) {
    try {
      return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    } catch (_e) {
      return date.toLocaleString("pt-BR");
    }
  }

  function state() {
    return global.__ampliState || {};
  }

  function setActions(on) {
    ["aoPrintReport", "aoPdfReport"].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.hidden = !on;
      el.classList.toggle("hidden", !on);
    });
  }

  function classifyReceivable(r) {
    if (!r) return { skip: true };
    if (typeof global.receivableSemCobrancaFinanceira === "function" && global.receivableSemCobrancaFinanceira(r)) {
      return { skip: true };
    }
    if (typeof global.financeReceivableIsDuplicateOfPaidCycle === "function" && global.financeReceivableIsDuplicateOfPaidCycle(r)) {
      return { skip: true };
    }
    const display =
      typeof global.financeReceivableDisplayStatus === "function" ? global.financeReceivableDisplayStatus(r) : "";
    const received =
      display === "Recebido" ||
      (typeof global.receivableFluxoFinanceiroQuitado === "function" && global.receivableFluxoFinanceiroQuitado(r));
    const awaiting =
      !received &&
      typeof global.receivableIsAguardandoFaturamentoFinanceiro === "function" &&
      global.receivableIsAguardandoFaturamentoFinanceiro(r);
    const inReceber =
      typeof global.receivableIsContaReceberFinanceiro === "function" && global.receivableIsContaReceberFinanceiro(r);
    const fatConcluido =
      typeof global.receivableFaturamentoConcluido === "function" && global.receivableFaturamentoConcluido(r);
    const billed = !!(received || (!awaiting && (inReceber || fatConcluido)));
    const overdue = !!(billed && !received && (display === "Vencido" || display === "Atrasado"));
    const closures = state().cycleClosures || [];
    const closure = closures.find((c) => String(c.receivable_id) === String(r.id));
    const toYmd = (v) => (svc() ? svc().toLocalYmd(v) || "" : "");
    let pagoEm = "";
    if (received && typeof global.financeMetaUnpack === "function") {
      try {
        const meta = global.financeMetaUnpack(r.observacoes || "").meta || {};
        pagoEm = toYmd(meta.data_pagamento || meta.data_recebimento);
      } catch (_e) {
        pagoEm = "";
      }
    }
    if (received && !pagoEm) {
      const dates = (state().cash || [])
        .filter((m) => String(m.conta_id) === String(r.id))
        .map((m) => toYmd(m.data_movimento))
        .filter(Boolean)
        .sort();
      pagoEm = dates.length ? dates[dates.length - 1] : "";
    }
    return {
      skip: false,
      valor: Number(r.valor || 0),
      billed,
      received: !!received,
      overdue,
      faturadoEm: billed ? toYmd(r.faturado_em) || toYmd(closure && closure.faturado_em) : "",
      pagoEm,
    };
  }

  async function loadEvents(ids) {
    const map = {};
    const client = global.supabaseClient;
    const service = svc();
    if (!client || !service || !ids.length) return map;
    const tipos = ["LIBERACAO_SOLICITADA", "LIBERACAO_CONFIRMADA", "REMOCAO_CONFIRMADA", "REMOVIDO"];
    for (let i = 0; i < ids.length; i += 80) {
      const chunk = ids.slice(i, i + 80);
      let data = null;
      try {
        const res = await client.from("vehicle_events").select("vehicle_id,tipo,created_at").in("vehicle_id", chunk).in("tipo", tipos);
        if (!res.error) data = res.data || [];
      } catch (_e) {
        data = null;
      }
      (data || []).forEach((e) => {
        const id = String(e.vehicle_id || "");
        if (!id) return;
        const bucket = map[id] || (map[id] = {});
        const tipo = String(e.tipo || "").toUpperCase();
        const day = service.toLocalYmd(e.created_at) || "";
        if (!day) return;
        if (tipo === "LIBERACAO_SOLICITADA") {
          if (!bucket.solicitacao || day < bucket.solicitacao) bucket.solicitacao = day;
        } else if (tipo === "LIBERACAO_CONFIRMADA" || tipo === "REMOCAO_CONFIRMADA") {
          if (!bucket.confirmacao || day < bucket.confirmacao) bucket.confirmacao = day;
        } else if (tipo === "REMOVIDO") {
          if (!bucket.retirada || day > bucket.retirada) bucket.retirada = day;
        }
      });
    }
    return map;
  }

  function filterLines(filters) {
    const st = state();
    const service = svc();
    const bits = [];
    bits.push(`Período: ${fmtYmd(filters.from)} a ${fmtYmd(filters.to)}`);
    if (filters.entradaFrom || filters.entradaTo) {
      bits.push(`Entrada: ${fmtYmd(filters.entradaFrom)} a ${fmtYmd(filters.entradaTo)}`);
    }
    if (filters.saidaFrom || filters.saidaTo) {
      bits.push(`Saída: ${fmtYmd(filters.saidaFrom)} a ${fmtYmd(filters.saidaTo)}`);
    }
    if (filters.managerId) {
      bits.push(`Gestor de Carteira: ${dash(service.managerName(filters.managerId, st.advocacyOfficeManagers || []))}`);
    }
    if (filters.patioId) {
      const p = (st.partners || []).find((x) => String(x.id) === String(filters.patioId));
      bits.push(`Pátio: ${dash(p && p.nome)}`);
    }
    if (filters.status) {
      const labels = { VNP: "No Pátio", VSL: "Solicitação de Liberação", VSC: "Liberação Confirmada", VRP: "Retirado do Pátio" };
      bits.push(`Status: ${labels[filters.status] || filters.status}`);
    }
    if (filters.faturamento === "faturado") bits.push("Faturamento: Faturado");
    if (filters.faturamento === "nao_faturado") bits.push("Faturamento: Não faturado");
    if (filters.pagamento === "pago") bits.push("Pagamento: Pago");
    if (filters.pagamento === "aberto") bits.push("Pagamento: Em aberto");
    if (filters.pagamento === "vencido") bits.push("Pagamento: Vencido");
    if (filters.financeiraId) {
      const p = (st.partners || []).find((x) => String(x.id) === String(filters.financeiraId));
      bits.push(`Financeira: ${dash(p && p.nome)}`);
    }
    if (filters.tipoVeiculo) bits.push(`Tipo: ${filters.tipoVeiculo}`);
    if (filters.situacaoPatio) bits.push(`Situação no pátio: ${filters.situacaoPatio}`);
    return bits;
  }

  function field(label, value) {
    return `<div><span>${esc(label)}</span> ${esc(dash(value))}</div>`;
  }

  function summaryRows(summary) {
    const rows = [
      ["Total de veículos", String(summary.veiculos)],
      ["Veículos atualmente no pátio", String(summary.noPatio)],
      ["Veículos com solicitação de liberação", String(summary.vsl)],
      ["Veículos com liberação confirmada", String(summary.vsc)],
      ["Veículos já retirados", String(summary.retirados)],
      ["Total de diárias geradas", String(summary.diarias)],
      ["Valor total das estadias", fmtMoney(summary.estadia)],
      ["Valor já faturado", fmtMoney(summary.faturado)],
      ["Valor recebido", fmtMoney(summary.recebido)],
      ["Valor em aberto", fmtMoney(summary.aberto)],
    ];
    if (summary.vencido > 0) rows.push(["Valor vencido", fmtMoney(summary.vencido)]);
    return rows;
  }

  function renderHtml(model) {
    const office = model.office || {};
    const summary = model.summary || {};
    const vehicles = model.vehicles || [];
    const lines = filterLines(model.filters || {});
    const sumBody = summaryRows(summary)
      .map(
        (pair) =>
          `<tr data-ao-block data-ao-role="row"><td>${esc(pair[0])}</td><td>${esc(pair[1])}</td></tr>`
      )
      .join("");
    const vehiclesHtml = vehicles.length
      ? vehicles
          .map((r) => {
            return `<article class="ao-veh" data-ao-block>
              <h3>${esc(dash(r.placa))} · ${esc(dash(r.veiculo))}</h3>
              <p class="ao-stage">${esc(r.situacao)}</p>
              <div class="ao-fields">
                ${field("RPP/RPV", r.rppRpv)}
                ${field("Placa", r.placa)}
                ${field("Marca/Modelo", r.veiculo)}
                ${field("Cor", r.cor)}
                ${field("Parceiro", r.parceiro)}
                ${field("Escritório", r.escritorio)}
                ${field("Gestor de Carteira", r.gestor)}
                ${field("Pátio", r.patio)}
                ${field("Data de entrada", fmtYmd(r.dataEntrada))}
                ${field("Solicitação de liberação", fmtYmd(r.dataSolicitacao))}
                ${field("Confirmação da liberação", fmtYmd(r.dataConfirmacao))}
                ${field("Retirada / saída", fmtYmd(r.dataSaida))}
                ${field("Dias de estadia", r.dias ? String(r.dias) : "—")}
                ${field("Valor da diária", fmtMoney(r.valorDiaria))}
                ${field("Valor total da estadia", fmtMoney(r.estadia))}
                ${field("Situação do veículo", r.situacao)}
                ${field("Situação do faturamento", r.faturamento)}
                ${field("Situação do pagamento", r.pagamento)}
                ${field("Data do faturamento", fmtDates(r.faturadoEm))}
                ${field("Data do pagamento", fmtDates(r.pagoEm))}
                ${field("Observações", r.observacoes)}
              </div>
            </article>`;
          })
          .join("")
      : `<p class="ao-empty" data-ao-block>Nenhum veículo encontrado com os filtros selecionados.</p>`;
    const finHead = `<thead>
      <tr>
        <th>Placa</th><th>Veículo</th><th>Dias</th><th>Diária</th><th>Estadia</th>
        <th>Faturado</th><th>Recebido</th><th>Em aberto</th><th>Vencido</th>
        <th>Faturamento</th><th>Pagamento</th><th>Faturado em</th><th>Pago em</th>
      </tr>
    </thead>`;
    const finRows = vehicles.length
      ? vehicles
          .map(
            (r) => `<tr data-ao-block data-ao-role="row">
              <td>${esc(dash(r.placa))}</td>
              <td>${esc(dash(r.veiculo))}</td>
              <td>${esc(r.dias ? String(r.dias) : "—")}</td>
              <td>${esc(fmtMoney(r.valorDiaria))}</td>
              <td>${esc(fmtMoney(r.estadia))}</td>
              <td>${esc(fmtMoney(r.faturadoValor))}</td>
              <td>${esc(fmtMoney(r.recebido))}</td>
              <td>${esc(fmtMoney(r.aberto))}</td>
              <td>${esc(r.vencido > 0 ? fmtMoney(r.vencido) : "—")}</td>
              <td>${esc(dash(r.faturamento))}</td>
              <td>${esc(dash(r.pagamento))}</td>
              <td>${esc(fmtDates(r.faturadoEm))}</td>
              <td>${esc(fmtDates(r.pagoEm))}</td>
            </tr>`
          )
          .join("")
      : `<tr data-ao-block data-ao-role="row"><td colspan="13">Nenhum veículo no filtro.</td></tr>`;
    const semDiaria =
      summary.semDiaria > 0
        ? `<p class="ao-note" data-ao-block>${summary.semDiaria} veículo(s) sem valor de diária cadastrado. Esses registros não entram no valor total das estadias.</p>`
        : "";
    return `<article class="ao-doc" id="aoOfficeDoc">
      <div class="ao-doc-head" data-ao-block>
        <img src="${esc(LOGO)}" alt="AMPLIGUARD" />
        <h1>RELATÓRIO DETALHADO DE ESCRITÓRIO</h1>
        <p class="ao-office-name">${esc(dash(office.name))}</p>
        <p>CNPJ: ${esc(dash(office.cnpj))}</p>
        <p>Gestor(es) de Carteira: ${esc(dash(office.managers))}</p>
        <p>${esc(lines[0] || "")}</p>
        <p>Emitido em ${esc(_issuedLabel)}</p>
        ${lines.length > 1 ? `<p class="ao-filters">${esc(lines.slice(1).join(" · "))}</p>` : ""}
      </div>
      <h2 data-ao-block>Resumo geral</h2>
      <p class="ao-note" data-ao-block>No pátio reúne quem ainda não foi retirado (VNP, VSL e VSC). Solicitação e liberação confirmada são etapas desse grupo. No pátio + retirados = total de veículos.</p>
      <table class="ao-table">
        <thead><tr><th>Indicador</th><th>Valor</th></tr></thead>
        <tbody>${sumBody}</tbody>
      </table>
      ${semDiaria}
      <h2 data-ao-block>Relação detalhada dos veículos</h2>
      <p class="ao-note" data-ao-block>Fluxo do pátio: VNP → VSL → VSC → VRP. Dias de estadia: da entrada até a saída, ou até a data de emissão se o veículo ainda está no pátio.</p>
      ${vehiclesHtml}
      <h2 data-ao-block>Informações financeiras</h2>
      <p class="ao-note" data-ao-block>Valores lidos dos títulos já gravados no financeiro. Total a receber é o valor faturado que ainda não foi recebido. O vencido é a parte desse valor com vencimento anterior à emissão. Veículo sem título faturado fica como não faturado, sem valor em aberto inventado.</p>
      <table class="ao-table">
        <thead><tr><th>Indicador</th><th>Valor</th></tr></thead>
        <tbody>
          <tr data-ao-block data-ao-role="row"><td>Total das estadias</td><td>${esc(fmtMoney(summary.estadia))}</td></tr>
          <tr data-ao-block data-ao-role="row"><td>Total faturado</td><td>${esc(fmtMoney(summary.faturado))}</td></tr>
          <tr data-ao-block data-ao-role="row"><td>Total a receber</td><td>${esc(fmtMoney(summary.aberto))}</td></tr>
          <tr data-ao-block data-ao-role="row"><td>Total recebido</td><td>${esc(fmtMoney(summary.recebido))}</td></tr>
          <tr data-ao-block data-ao-role="row"><td>Total vencido</td><td>${esc(summary.vencido > 0 ? fmtMoney(summary.vencido) : "—")}</td></tr>
          <tr data-ao-block data-ao-role="row"><td>Registros em aberto</td><td>${esc(String(summary.registrosAbertos || 0))}</td></tr>
          <tr data-ao-block data-ao-role="row"><td>Registros pagos</td><td>${esc(String(summary.registrosPagos || 0))}</td></tr>
        </tbody>
      </table>
      <h2 data-ao-block>Detalhamento financeiro por veículo</h2>
      <table class="ao-table ao-fin">
        ${finHead}
        <tbody>${finRows}</tbody>
      </table>
      <div class="ao-foot-screen">
        <span>${esc(FOOTER)}</span>
        <span>Emitido em ${esc(_issuedLabel)}</span>
      </div>
      <div class="ao-foot-print" aria-hidden="true">
        <span>${esc(FOOTER)}</span>
        <span>Emitido em ${esc(_issuedLabel)}</span>
        <span>Página <span class="ao-page-num"></span></span>
      </div>
    </article>`;
  }

  const DOC_CSS = `
    #aoOfficeDoc.ao-doc { background:#fff; color:#0f2744; font-family:"Segoe UI", system-ui, sans-serif; padding:16px 16px 8px; border:1px solid #e2e8f0; border-radius:12px; }
    #aoOfficeDoc .ao-doc-head { display:block; text-align:center; background:#fff; color:#0f2744; border-bottom:3px solid #b91c1c; padding:0 0 12px; margin:0 0 14px; }
    #aoOfficeDoc .ao-doc-head img { display:block; margin:0 auto 8px; height:64px; width:auto; max-width:280px; max-height:64px; object-fit:contain; }
    #aoOfficeDoc .ao-doc-head h1 { display:block; margin:10px 0 6px; font-size:16pt; letter-spacing:.02em; color:#0f2744; background:transparent; }
    #aoOfficeDoc .ao-doc-head p { display:block; margin:2px 0; font-size:10.5pt; color:#0f2744; }
    .ao-office-name { font-size:13pt !important; font-weight:700; }
    .ao-filters { color:#475569; font-size:9.5pt !important; }
    .ao-doc h2 { margin:16px 0 8px; font-size:12.5pt; border-bottom:1px solid #e2e8f0; padding-bottom:4px; page-break-after:avoid; }
    .ao-note { margin:0 0 8px; color:#475569; font-size:9pt; }
    .ao-empty { margin:8px 0 12px; }
    .ao-table { width:100%; border-collapse:collapse; margin:0 0 12px; }
    .ao-table th, .ao-table td { border:1px solid #cbd5e1; padding:5px 6px; text-align:left; vertical-align:top; font-size:8.5pt; }
    .ao-table th { background:#f1f5f9; font-size:8pt; }
    .ao-fin { font-size:8pt; }
    .ao-veh { border:1px solid #cbd5e1; border-radius:8px; padding:8px 10px; margin:0 0 8px; page-break-inside:avoid; break-inside:avoid; }
    .ao-veh h3 { margin:0; font-size:11pt; }
    .ao-stage { margin:2px 0 6px; font-weight:700; color:#9f1239; font-size:9.5pt; }
    .ao-fields { display:grid; grid-template-columns:1fr 1fr; gap:2px 14px; }
    .ao-fields div { font-size:9pt; }
    .ao-fields span { color:#64748b; }
    #aoOfficeDoc .ao-foot-screen, #aoOfficeDoc .ao-foot-print { display:flex; justify-content:space-between; gap:8px; margin-top:16px; padding-top:8px; border-top:1px solid #e2e8f0; color:#64748b; font-size:8.5pt; background:#fff; position:static; }
    #aoOfficeDoc .ao-foot-print { display:none; }
    @media print {
      .ao-doc { border:0; border-radius:0; padding:0 0 16mm; }
      .ao-foot-screen { display:none !important; }
      .ao-foot-print { display:flex !important; position:fixed; left:0; right:0; bottom:0; margin:0; padding:4px 0; background:#fff; }
      .ao-page-num::after { content: counter(page); }
      thead { display:table-header-group; }
      tr, .ao-veh, .ao-doc-head { break-inside:avoid; page-break-inside:avoid; }
      h2 { break-after:avoid; page-break-after:avoid; }
    }
  `;

  function ensureStyles() {
    if (document.getElementById("aoOfficeReportStyles")) return;
    const style = document.createElement("style");
    style.id = "aoOfficeReportStyles";
    style.textContent = DOC_CSS;
    document.head.appendChild(style);
  }

  function docEl() {
    return document.getElementById("aoOfficeDoc");
  }

  function printDoc() {
    const doc = docEl();
    if (!doc) {
      alert("Gere o relatório do escritório antes de imprimir.");
      return;
    }
    const origin = global.location && global.location.origin ? global.location.origin : "";
    const html = doc.outerHTML.replace(LOGO, origin + LOGO);
    const page = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Relatório detalhado de escritório</title>
      <style>${DOC_CSS} @page { margin: 12mm; }</style></head><body>${html}</body></html>`;
    const iframe = document.createElement("iframe");
    iframe.setAttribute("title", "Relatório de escritório");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText =
      "position:fixed;left:-9999px;top:0;width:1100px;height:1400px;border:0;opacity:0;pointer-events:none;z-index:-1;";
    document.body.appendChild(iframe);
    const win = iframe.contentWindow;
    if (!win) {
      iframe.remove();
      alert("Não foi possível preparar a impressão neste navegador.");
      return;
    }
    win.document.open();
    win.document.write(page);
    win.document.close();
    const imgs = Array.from(win.document.images || []);
    const ready = Promise.all(
      imgs.map(
        (img) =>
          new Promise((resolve) => {
            if (img.complete) resolve();
            else {
              img.onload = () => resolve();
              img.onerror = () => resolve();
            }
          })
      )
    );
    const timeout = new Promise((resolve) => setTimeout(resolve, 1200));
    Promise.race([ready, timeout]).then(() => {
      try {
        win.focus();
        win.print();
      } catch (_e) {
        /* ignore */
      }
      setTimeout(() => iframe.remove(), 1500);
    });
  }

  async function downloadPdf() {
    const doc = docEl();
    if (!doc) {
      alert("Gere o relatório do escritório antes de baixar o PDF.");
      return;
    }
    const btn = document.getElementById("aoPdfReport");
    const prev = btn ? btn.textContent : "";
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Gerando PDF…";
    }
    try {
      if (typeof global.loadJsPdf === "function") await global.loadJsPdf();
      if (typeof global.loadHtml2Canvas === "function") await global.loadHtml2Canvas();
      const jsPdfCtor = global.jspdf && global.jspdf.jsPDF;
      const html2canvas = global.html2canvas;
      if (!jsPdfCtor || typeof html2canvas !== "function") {
        alert("Não foi possível carregar o gerador de PDF.");
        return;
      }
      await renderPdf(doc, jsPdfCtor, html2canvas);
    } catch (err) {
      console.error(err);
      alert("Não foi possível gerar o PDF.");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = prev || "Baixar PDF";
      }
    }
  }

  function blockHeight(el) {
    const rect = el.getBoundingClientRect();
    const cs = global.getComputedStyle(el);
    const mt = parseFloat(cs.marginTop) || 0;
    const mb = parseFloat(cs.marginBottom) || 0;
    return Math.ceil(rect.height + mt + mb);
  }

  async function renderPdf(doc, jsPdfCtor, html2canvas) {
    const widthPx = 1120;
    const marginMm = 8;
    const footerMm = 8;
    const pageW = 297;
    const pageH = 210;
    const contentW = pageW - marginMm * 2;
    const contentH = pageH - marginMm * 2 - footerMm;
    const sandbox = document.createElement("div");
    sandbox.style.cssText = `position:fixed;left:0;top:0;width:${widthPx}px;background:#fff;z-index:-1;pointer-events:none;`;
    sandbox.innerHTML = doc.outerHTML;
    document.body.appendChild(sandbox);
    const imgs = Array.from(sandbox.querySelectorAll("img"));
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise((resolve) => {
            if (img.complete) resolve();
            else {
              img.onload = () => resolve();
              img.onerror = () => resolve();
            }
          })
      )
    );
    sandbox.querySelectorAll(".ao-foot-screen, .ao-foot-print").forEach((el) => el.remove());
    const pxPerMm = widthPx / contentW;
    const maxPx = Math.floor(contentH * pxPerMm) - 6;
    const items = [];
    sandbox.querySelectorAll("[data-ao-block]").forEach((el) => {
      if (el.tagName === "TR") {
        const table = el.closest("table");
        const thead = table ? table.querySelector("thead") : null;
        items.push({
          type: "row",
          el,
          h: Math.max(1, blockHeight(el)),
          thead,
          theadH: thead ? Math.max(1, blockHeight(thead)) : 0,
          table,
        });
      } else {
        items.push({ type: "block", el, h: Math.max(1, blockHeight(el)) });
      }
    });
    const pages = [];
    let page = [];
    let used = 0;
    let lastTable = null;
    const flush = () => {
      if (page.length) pages.push(page);
      page = [];
      used = 0;
      lastTable = null;
    };
    items.forEach((item) => {
      let need = item.h;
      let prefix = null;
      if (item.type === "row" && item.thead) {
        if (used === 0 || lastTable !== item.table) {
          need += item.theadH;
          prefix = item.thead;
        }
      }
      if (used > 0 && used + need > maxPx) {
        flush();
        if (item.type === "row" && item.thead) {
          need = item.h + item.theadH;
          prefix = item.thead;
        }
      }
      if (item.h > maxPx && used === 0 && !prefix) {
        page.push(item.el);
        flush();
        return;
      }
      if (prefix) {
        page.push(prefix);
        used += item.theadH;
      }
      page.push(item.el);
      used += item.h;
      if (item.type === "row") lastTable = item.table;
    });
    flush();

    const pdf = new jsPdfCtor({ orientation: "landscape", unit: "mm", format: "a4" });
    try {
    for (let i = 0; i < pages.length; i += 1) {
      const wrap = document.createElement("div");
      wrap.className = "ao-doc";
      wrap.style.width = `${widthPx}px`;
      wrap.style.padding = "0";
      wrap.style.border = "0";
      wrap.style.borderRadius = "0";
      let table = null;
      pages[i].forEach((el) => {
        if (el.tagName === "THEAD" || el.tagName === "TR") {
          if (!table) {
            table = document.createElement("table");
            table.className = "ao-table";
            wrap.appendChild(table);
          }
          if (el.tagName === "THEAD") table.appendChild(el.cloneNode(true));
          else {
            let body = table.querySelector("tbody");
            if (!body) {
              body = document.createElement("tbody");
              table.appendChild(body);
            }
            body.appendChild(el.cloneNode(true));
          }
        } else {
          table = null;
          wrap.appendChild(el.cloneNode(true));
        }
      });
      sandbox.appendChild(wrap);
      const canvas = await html2canvas(wrap, { backgroundColor: "#ffffff", scale: 1.5, useCORS: true });
      wrap.remove();
      const imgH = (canvas.height * contentW) / canvas.width;
      const drawH = Math.min(imgH, contentH);
      const drawW = imgH > contentH ? contentW * (contentH / imgH) : contentW;
      if (i > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", marginMm, marginMm, drawW, drawH);
    }
    const total = pdf.internal.getNumberOfPages();
    for (let n = 1; n <= total; n += 1) {
      pdf.setPage(n);
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      pdf.text(FOOTER, marginMm, pageH - 5);
      pdf.text(`Emitido em ${_issuedLabel}`, pageW / 2, pageH - 5, { align: "center" });
      pdf.text(`Página ${n} de ${total}`, pageW - marginMm, pageH - 5, { align: "right" });
    }
    } finally {
      sandbox.remove();
    }
    const safe = String((doc.querySelector(".ao-office-name") || {}).textContent || "escritorio")
      .trim()
      .toLowerCase()
      .replace(/[^\w]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    pdf.save(`relatorio-escritorio-${safe || "escritorio"}.pdf`);
  }

  async function show(root, filters) {
    bind();
    ensureStyles();
    const token = ++_token;
    setActions(false);
    if (!root || !svc()) return;
    const officeId = String((filters && filters.officeId) || "");
    if (!officeId) {
      root.innerHTML = `<p class="notice">Selecione um escritório para gerar o relatório detalhado.</p>`;
      return;
    }
    root.innerHTML = `<p class="notice">Montando o relatório do escritório…</p>`;
    const st = state();
    const preloadFilters = Object.assign({}, filters, { faturamento: "", pagamento: "" });
    const candidates = svc().buildOfficeReport({
      vehicles: st.vehicles || [],
      offices: st.advocacyOffices || [],
      partners: st.partners || [],
      managers: st.advocacyOfficeManagers || [],
      receivables: [],
      filters: preloadFilters,
      patioFallbackName: "",
    }).vehicles;
    let events = {};
    try {
      events = await loadEvents(candidates.map((r) => r.id).filter(Boolean));
    } catch (_e) {
      events = {};
    }
    if (token !== _token) return;
    _issuedLabel = fmtWhen(new Date());
    const model = svc().buildOfficeReport({
      vehicles: st.vehicles || [],
      offices: st.advocacyOffices || [],
      partners: st.partners || [],
      managers: st.advocacyOfficeManagers || [],
      receivables: st.receivables || [],
      filters,
      eventsByVehicle: events,
      patioFallbackName: (st.settings && st.settings.nome_patio) || "",
      classifyReceivable,
    });
    if (token !== _token) return;
    root.innerHTML = renderHtml(model);
    setActions(true);
  }

  function cancel() {
    _token += 1;
    setActions(false);
  }

  function bind() {
    if (_bound) return;
    _bound = true;
    document.getElementById("aoPrintReport")?.addEventListener("click", () => printDoc());
    document.getElementById("aoPdfReport")?.addEventListener("click", () => downloadPdf());
  }

  global.advocacyOfficeReport = { show, cancel, bind, print: printDoc, downloadPdf };
})(typeof window !== "undefined" ? window : globalThis);

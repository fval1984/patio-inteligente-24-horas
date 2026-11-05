/**
 * UI do Extrato de valores gerados pelo pátio. Somente leitura + impressão/PDF.
 */
(function patioExtratoUiModule(global) {
  "use strict";

  const LOGO = "/assets/ampliguard-marca.png?v=20260917logo2";
  const FOOTER = "AMPLIGUARD – Guarda, Custódia e Remoção de Veículos";
  let bound = false;
  let lastReport = null;
  let lastResumo = null;
  let previewOpen = false;
  let screen = "extrato";

  function svc() {
    return global.patioExtratoService;
  }

  function state() {
    return global.__ampliState || {};
  }

  function root() {
    return document.getElementById("patioExtratoRoot");
  }

  function esc(str) {
    if (typeof global.escapeHtml === "function") return global.escapeHtml(str);
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function money(v) {
    return svc().formatCurrency(v);
  }

  function injectStyles() {
    if (document.getElementById("patioExtratoStyles")) return;
    const style = document.createElement("style");
    style.id = "patioExtratoStyles";
    style.textContent = `
      #patioExtratoRoot { display:flex; flex-direction:column; gap:14px; flex:1 1 auto; min-height:0; overflow:auto; }
      #patioExtratoRoot .px-lede { margin:0; color:var(--muted, #64748b); font-size:14px; }
      #patioExtratoRoot .px-bar { display:flex; flex-wrap:wrap; gap:10px; align-items:end; }
      #patioExtratoRoot .px-bar label { display:flex; flex-direction:column; gap:4px; font-size:12px; font-weight:600; }
      #patioExtratoRoot .px-actions { display:flex; flex-wrap:wrap; gap:8px; }
      #patioExtratoRoot .px-kpis { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:10px; }
      #patioExtratoRoot .px-kpi { border:1px solid rgba(148,163,184,.28); border-radius:12px; padding:12px 14px; background:#fff; }
      #patioExtratoRoot .px-kpi span { display:block; font-size:11px; color:#64748b; text-transform:uppercase; letter-spacing:.04em; }
      #patioExtratoRoot .px-kpi strong { display:block; margin-top:4px; font-size:1.05rem; }
      #patioExtratoRoot .px-kpi.is-total { border-color:rgba(155,44,44,.35); background:linear-gradient(180deg,#fff,#f8fafc); }
      #patioExtratoRoot .px-kpi.is-total strong { color:#9b2c2c; font-size:1.2rem; }
      #patioExtratoRoot .px-modes { display:flex; flex-wrap:wrap; gap:8px; }
      #patioExtratoRoot .px-modes button.is-on { background:#1e3a5f; color:#fff; border-color:#1e3a5f; }
      #patioExtratoRoot .px-resumo { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:14px; }
      #patioExtratoRoot .px-card { border:1px solid rgba(30,58,95,.18); border-radius:16px; padding:18px 18px 16px; background:#fff; box-shadow:0 8px 24px rgba(15,23,42,.06); }
      #patioExtratoRoot .px-card span { display:block; font-size:12px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#64748b; }
      #patioExtratoRoot .px-card strong { display:block; margin-top:10px; font-size:1.45rem; font-variant-numeric:tabular-nums; color:#0f172a; }
      #patioExtratoRoot .px-card small { display:block; margin-top:8px; color:#64748b; font-size:12px; }
      #patioExtratoRoot .px-card.is-gerado { background:linear-gradient(180deg,#1e3a5f,#152a46); color:#fff; border-color:#1e3a5f; }
      #patioExtratoRoot .px-card.is-gerado span, #patioExtratoRoot .px-card.is-gerado small { color:rgba(255,255,255,.78); }
      #patioExtratoRoot .px-card.is-gerado strong { color:#f5d76e; font-size:1.7rem; }
      #patioExtratoRoot .px-card.is-ok { border-color:rgba(21,128,61,.28); }
      #patioExtratoRoot .px-card.is-ok strong { color:#15803d; }
      #patioExtratoRoot .px-card.is-wait { border-color:rgba(180,83,9,.28); }
      #patioExtratoRoot .px-card.is-wait strong { color:#b45309; }
      #patioExtratoRoot .px-card.is-open { border-color:rgba(155,44,44,.28); }
      #patioExtratoRoot .px-card.is-open strong { color:#9b2c2c; }
      #patioExtratoRoot .px-periodo { margin:0; font-weight:600; color:#1e3a5f; }
      #patioExtratoRoot .px-month { display:flex; flex-direction:column; gap:10px; padding:4px 0 18px; border-bottom:1px solid #e2e8f0; }
      #patioExtratoRoot .px-month:last-child { border-bottom:0; }
      #patioExtratoRoot .px-month h3 { margin:0; font-size:1.05rem; color:#1e3a5f; }
      .px-doc-month { page-break-inside:avoid; margin:0 0 18px; padding:0 0 14px; border-bottom:1px solid #cbd5e1; font-family:system-ui,sans-serif; }
      .px-doc-month h2 { margin:0 0 4px; font-size:14px; color:#1e3a5f; letter-spacing:.04em; }
      .px-doc-month .px-doc-sum { margin-top:8px; }
      #patioExtratoRoot .table-wrap { overflow:auto; }
      #patioExtratoRoot table.px-table { width:100%; border-collapse:collapse; font-size:13px; }
      #patioExtratoRoot table.px-table th, #patioExtratoRoot table.px-table td { border-bottom:1px solid #e2e8f0; padding:8px 10px; text-align:left; vertical-align:top; }
      #patioExtratoRoot table.px-table th { font-size:11px; text-transform:uppercase; letter-spacing:.03em; color:#475569; background:#f8fafc; }
      #patioExtratoRoot table.px-table td.num { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
      #patioExtratoRoot .px-empty { margin:0; color:#64748b; }
      #patioExtratoPreview.hidden { display:none !important; }
      #patioExtratoPreview { position:fixed; inset:0; z-index:80; background:rgba(15,23,42,.55); overflow:auto; padding:24px 12px; }
      #patioExtratoPreview .px-paper-wrap { max-width:920px; margin:0 auto; }
      .px-doc { background:#fff; color:#111; font-family:Georgia,"Times New Roman",serif; padding:28px 32px 36px; box-shadow:0 18px 50px rgba(0,0,0,.25); }
      .px-doc-head { display:flex; flex-direction:column; align-items:center; gap:8px; border-bottom:2px solid #1e3a5f; padding-bottom:14px; margin-bottom:16px; }
      .px-doc-head img { height:52px; width:auto; object-fit:contain; }
      .px-doc-head h1 { margin:0; font-size:16px; letter-spacing:.12em; text-align:center; color:#1e3a5f; }
      .px-doc-meta { width:100%; display:flex; justify-content:space-between; gap:12px; font-size:12px; color:#334155; font-family:system-ui,sans-serif; }
      .px-doc table { width:100%; border-collapse:collapse; font-size:11px; font-family:system-ui,sans-serif; }
      .px-doc th, .px-doc td { border-bottom:1px solid #cbd5e1; padding:6px 7px; text-align:left; vertical-align:top; }
      .px-doc thead th { background:#1e3a5f; color:#fff; font-weight:700; }
      .px-doc td.num { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
      .px-doc tbody tr:nth-child(even) td { background:#f8fafc; }
      .px-doc-foot { margin-top:18px; border-top:2px solid #1e3a5f; padding-top:12px; font-family:system-ui,sans-serif; }
      .px-doc-sum { display:grid; grid-template-columns:1fr auto; gap:6px 18px; font-size:13px; }
      .px-doc-total { margin-top:12px; background:#1e3a5f; color:#fff; padding:10px 14px; display:flex; justify-content:space-between; font-weight:700; font-size:15px; }
      .px-doc-brand { margin-top:16px; text-align:center; font-size:11px; color:#64748b; }
      @media print {
        #patioExtratoPreview { position:static; background:transparent; padding:0; }
        .px-doc { box-shadow:none; }
      }
    `;
    document.head.appendChild(style);
  }

  function currentInputs() {
    const fromEl = document.getElementById("patioExtratoDe");
    const toEl = document.getElementById("patioExtratoAte");
    const def = svc().defaultPeriod();
    return {
      fromYmd: (fromEl?.value || def.fromYmd).slice(0, 10),
      toYmd: (toEl?.value || def.toYmd).slice(0, 10),
    };
  }

  function towCtx() {
    const cache = typeof global.reboqueTransporteGetCache === "function" ? global.reboqueTransporteGetCache() : null;
    return {
      towServices: cache?.services || [],
      towDrivers: cache?.drivers || [],
    };
  }

  function buildReport() {
    const { fromYmd, toYmd } = currentInputs();
    if (!fromYmd || !toYmd) {
      alert("Informe a data inicial e a data final.");
      return null;
    }
    if (fromYmd > toYmd) {
      alert("A data inicial não pode ser posterior à data final.");
      return null;
    }
    const st = state();
    lastReport = svc().buildExtrato({
      fromYmd,
      toYmd,
      vehicles: st.vehicles || [],
      receivables: st.receivables || [],
      partners: st.partners || [],
      ...towCtx(),
    });
    lastReport.emitidoEm = new Date().toLocaleString("pt-BR");
    return lastReport;
  }

  function buildResumo() {
    const { fromYmd, toYmd } = currentInputs();
    if (!fromYmd || !toYmd) {
      alert("Informe a data inicial e a data final.");
      return null;
    }
    if (fromYmd > toYmd) {
      alert("A data inicial não pode ser posterior à data final.");
      return null;
    }
    const st = state();
    lastResumo = svc().buildResumoMensal({
      fromYmd,
      toYmd,
      vehicles: st.vehicles || [],
      receivables: st.receivables || [],
      cash: st.cash || [],
      partners: st.partners || [],
    });
    lastResumo.emitidoEm = new Date().toLocaleString("pt-BR");
    return lastResumo;
  }

  function kpi(label, value, extraClass) {
    return `<div class="px-kpi${extraClass ? ` ${extraClass}` : ""}"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
  }

  function sitClass(code) {
    if (code === "pago") return "success";
    if (code === "aguardando_pagamento" || code === "faturado") return "warning";
    return "";
  }

  function tableBody(rows) {
    if (!rows.length) {
      return `<tr><td class="empty" colspan="9">Nenhum veículo com saída confirmada neste período.</td></tr>`;
    }
    return rows
      .map(
        (r) => `<tr>
          <td data-label="Placa">${esc(r.placa)}</td>
          <td data-label="Marca/modelo">${esc(r.marcaModelo)}</td>
          <td data-label="Entrada">${esc(r.entradaLabel)}</td>
          <td data-label="Saída">${esc(r.saidaLabel)}</td>
          <td class="num" data-label="Diárias">${esc(r.diarias)}</td>
          <td class="num" data-label="Valor gerado">${esc(money(r.valorGerado))}</td>
          <td data-label="Responsável">${esc(r.tomador)}</td>
          <td data-label="Quem trouxe">${esc(r.quemTrouxe)}</td>
          <td data-label="Situação"><span class="tag ${sitClass(r.situacaoCode)}">${esc(r.situacaoLabel)}</span></td>
        </tr>`
      )
      .join("");
  }

  function documentHtml(report, opts) {
    const forPrint = !!(opts && opts.forPrint);
    const s = report.summary;
    const rows = report.rows
      .map(
        (r) => `<tr>
          <td>${esc(r.placa)}</td>
          <td>${esc(r.marcaModelo)}</td>
          <td>${esc(r.entradaLabel)}</td>
          <td>${esc(r.saidaLabel)}</td>
          <td class="num">${esc(r.diarias)}</td>
          <td class="num">${esc(money(r.valorGerado))}</td>
          <td>${esc(r.tomador)}</td>
          <td>${esc(r.quemTrouxe)}</td>
          <td>${esc(r.situacaoLabel)}</td>
        </tr>`
      )
      .join("");
    const empty = `<tr><td colspan="9">Nenhum veículo com saída confirmada neste período.</td></tr>`;
    return `<div class="px-doc"${forPrint ? "" : ' id="pxPaper"'}>
      <header class="px-doc-head">
        <img src="${esc(LOGO)}" alt="AMPLIGUARD" />
        <h1>EXTRATO DE VALORES GERADOS PELO PÁTIO</h1>
        <div class="px-doc-meta">
          <span>Período: ${esc(report.periodoLabel)}</span>
          <span>Emissão: ${esc(report.emitidoEm || "")}</span>
        </div>
      </header>
      <table>
        <thead>
          <tr>
            <th>Placa</th>
            <th>Marca / modelo</th>
            <th>Entrada</th>
            <th>Saída</th>
            <th>Diárias</th>
            <th>Valor gerado</th>
            <th>Responsável pelo pagamento</th>
            <th>Quem trouxe</th>
            <th>Situação financeira</th>
          </tr>
        </thead>
        <tbody>${rows || empty}</tbody>
      </table>
      <footer class="px-doc-foot">
        <div class="px-doc-sum">
          <span>Quantidade de veículos</span><strong>${esc(s.veiculos)}</strong>
          <span>Valor já recebido</span><strong>${esc(money(s.recebido))}</strong>
          <span>Valor aguardando recebimento</span><strong>${esc(money(s.aguardandoRecebimento))}</strong>
          <span>Valor aguardando faturamento</span><strong>${esc(money(s.aguardandoFaturamento))}</strong>
          <span>Valor já faturado</span><strong>${esc(money(s.jaFaturado))}</strong>
        </div>
        <div class="px-doc-total"><span>VALOR TOTAL GERADO</span><span>${esc(money(s.gerado))}</span></div>
        <p class="px-doc-brand">${esc(FOOTER)}</p>
      </footer>
    </div>`;
  }

  function resumoMonthCards(month) {
    const s = month.summary;
    return `
      <section class="px-month">
        <h3>${esc(month.monthLabel)}</h3>
        <p class="px-periodo">${esc(month.periodoLabel)}</p>
        <div class="px-resumo">
          <article class="px-card is-gerado">
            <span>Valor total gerado</span>
            <strong>${esc(money(s.gerado))}</strong>
            <small>${esc(String(s.veiculos))} ciclo(s) finalizado(s) no mês</small>
          </article>
          <article class="px-card is-ok">
            <span>Valor recebido</span>
            <strong>${esc(money(s.recebido))}</strong>
            <small>Pagamentos desses ciclos, mesmo que em outra data</small>
          </article>
          <article class="px-card is-wait">
            <span>Aguardando faturamento</span>
            <strong>${esc(money(s.aguardandoFaturamento))}</strong>
            <small>Saiu no mês e ainda não foi faturado</small>
          </article>
          <article class="px-card is-open">
            <span>Valor em aberto</span>
            <strong>${esc(money(s.emAberto))}</strong>
            <small>Já faturado e ainda não recebido</small>
          </article>
        </div>
      </section>`;
  }

  function resumoCards(resumo) {
    const months = resumo.months || [];
    if (!months.length) {
      return `<p class="px-empty">Nenhum mês no intervalo informado.</p>`;
    }
    return `<p class="px-periodo">Meses: ${esc(resumo.coberturaLabel)}</p>${months.map(resumoMonthCards).join("")}`;
  }

  function resumoDocumentHtml(resumo, opts) {
    const forPrint = !!(opts && opts.forPrint);
    const months = resumo.months || [];
    const blocks = months
      .map((month) => {
        const s = month.summary;
        return `<section class="px-doc-month">
          <h2>${esc(month.monthLabel)}</h2>
          <div class="px-doc-meta"><span>Período: ${esc(month.periodoLabel)}</span><span>${esc(String(s.veiculos))} veículo(s)</span></div>
          <div class="px-doc-sum">
            <span>Valor total gerado</span><strong>${esc(money(s.gerado))}</strong>
            <span>Valor recebido</span><strong>${esc(money(s.recebido))}</strong>
            <span>Aguardando faturamento</span><strong>${esc(money(s.aguardandoFaturamento))}</strong>
            <span>Valor em aberto</span><strong>${esc(money(s.emAberto))}</strong>
          </div>
        </section>`;
      })
      .join("");
    return `<div class="px-doc"${forPrint ? "" : ' id="pxPaperResumo"'}>
      <header class="px-doc-head">
        <img src="${esc(LOGO)}" alt="AMPLIGUARD" />
        <h1>RESUMO FINANCEIRO POR PERÍODO</h1>
        <div class="px-doc-meta">
          <span>Meses: ${esc(resumo.coberturaLabel || "")}</span>
          <span>Emissão: ${esc(resumo.emitidoEm || "")}</span>
        </div>
      </header>
      ${blocks || "<p>Nenhum mês no intervalo informado.</p>"}
      <p class="px-doc-brand">${esc(FOOTER)}</p>
    </div>`;
  }

  function render() {
    const el = root();
    if (!el) return;
    injectStyles();
    const def = svc().defaultPeriod();
    const fromVal = document.getElementById("patioExtratoDe")?.value || def.fromYmd;
    const toVal = document.getElementById("patioExtratoAte")?.value || def.toYmd;
    const isResumo = screen === "resumo";
    const report = lastReport;
    const s = report?.summary;
    const kpis = !isResumo && report
      ? `<div class="px-kpis">
          ${kpi("Veículos que saíram", String(s.veiculos))}
          ${kpi("Já recebido", money(s.recebido))}
          ${kpi("Aguardando recebimento", money(s.aguardandoRecebimento))}
          ${kpi("Aguardando faturamento", money(s.aguardandoFaturamento))}
          ${kpi("Já faturado", money(s.jaFaturado))}
          ${kpi("Valor total gerado", money(s.gerado), "is-total")}
        </div>`
      : "";
    const actions = !isResumo && report
      ? `<div class="px-actions">
          <button type="button" class="secondary" data-px-act="view">Visualizar extrato</button>
          <button type="button" class="secondary" data-px-act="print">Imprimir extrato</button>
          <button type="button" data-px-act="pdf">Gerar PDF</button>
        </div>`
      : "";
    const table = !isResumo && report
      ? `<div class="table-wrap"><table class="table stacked px-table">
          <thead><tr>
            <th>Placa</th><th>Marca / modelo</th><th>Entrada</th><th>Saída</th>
            <th>Diárias</th><th>Valor gerado</th><th>Responsável</th><th>Quem trouxe</th><th>Situação</th>
          </tr></thead>
          <tbody>${tableBody(report.rows)}</tbody>
        </table></div>`
      : !isResumo
        ? `<p class="px-empty">Selecione o período e clique em Gerar extrato. Entram somente veículos com saída confirmada nas datas informadas.</p>`
        : "";
    const resumoActions = isResumo && lastResumo
      ? `<div class="px-actions">
          <button type="button" class="secondary" data-px-act="view-resumo">Visualizar</button>
          <button type="button" class="secondary" data-px-act="print-resumo">Imprimir</button>
          <button type="button" data-px-act="pdf-resumo">Gerar PDF</button>
        </div>`
      : "";
    const resumoBlock = isResumo
      ? lastResumo
        ? resumoCards(lastResumo)
        : `<p class="px-empty">Informe a data inicial e a data final e clique em Consultar. Cada mês do intervalo é apurado do dia 1 ao último dia, com os mesmos quatro indicadores.</p>`
      : "";
    const lede = isResumo
      ? "Escolha o intervalo (por exemplo janeiro a outubro). O sistema monta um mês por vez, do início ao fim, para consulta e impressão."
      : "Consulta independente das listas do pátio. O valor gerado é o dos serviços dos veículos que efetivamente saíram no período — não o acumulado de quem ainda está no pátio.";

    el.innerHTML = `
      <div class="px-modes">
        <button type="button" class="secondary${isResumo ? "" : " is-on"}" data-px-act="mode-extrato">Extrato de valores</button>
        <button type="button" class="secondary${isResumo ? " is-on" : ""}" data-px-act="mode-resumo">Resumo financeiro por período</button>
      </div>
      <p class="px-lede">${esc(lede)}</p>
      <form id="patioExtratoForm" class="px-bar filter-bar" action="#" novalidate>
        <label for="patioExtratoDe">Data inicial
          <input id="patioExtratoDe" type="date" required value="${esc(fromVal)}" />
        </label>
        <label for="patioExtratoAte">Data final
          <input id="patioExtratoAte" type="date" required value="${esc(toVal)}" />
        </label>
        <button type="submit">${isResumo ? "Consultar" : "Gerar extrato"}</button>
      </form>
      ${resumoActions}
      ${actions}
      ${kpis}
      ${table}
      ${resumoBlock}
    `;
    renderPreviewLayer();
  }

  function previewHost() {
    let host = document.getElementById("patioExtratoPreview");
    if (host) return host;
    host = document.createElement("div");
    host.id = "patioExtratoPreview";
    host.className = "hidden";
    host.setAttribute("role", "dialog");
    host.setAttribute("aria-label", "Visualizar extrato");
    document.body.appendChild(host);
    return host;
  }

  function renderPreviewLayer() {
    const host = previewHost();
    const isResumoPreview = previewOpen === "resumo";
    const isExtratoPreview = previewOpen === "extrato" || previewOpen === true;
    if (!previewOpen || (isResumoPreview && !lastResumo) || (isExtratoPreview && !lastReport)) {
      host.classList.add("hidden");
      host.innerHTML = "";
      return;
    }
    host.classList.remove("hidden");
    if (isResumoPreview) {
      host.innerHTML = `<div class="px-paper-wrap">
        <div class="px-actions" style="margin-bottom:12px;justify-content:flex-end">
          <button type="button" class="secondary" data-px-act="close">Fechar</button>
          <button type="button" class="secondary" data-px-act="print-resumo">Imprimir</button>
          <button type="button" data-px-act="pdf-resumo">Gerar PDF</button>
        </div>
        ${resumoDocumentHtml(lastResumo)}
      </div>`;
      return;
    }
    host.innerHTML = `<div class="px-paper-wrap">
      <div class="px-actions" style="margin-bottom:12px;justify-content:flex-end">
        <button type="button" class="secondary" data-px-act="close">Fechar</button>
        <button type="button" class="secondary" data-px-act="print">Imprimir extrato</button>
        <button type="button" data-px-act="pdf">Gerar PDF</button>
      </div>
      ${documentHtml(lastReport)}
    </div>`;
  }

  function ensureReport() {
    if (lastReport) return lastReport;
    return buildReport();
  }

  function printReport() {
    const report = ensureReport();
    if (!report) return;
    try {
    const css = `
      @page { size: A4; margin: 12mm; }
      body { margin:0; color:#111; }
      .px-doc { box-shadow:none; padding:0; }
      .px-doc-head img { height:48px; }
      thead { display:table-header-group; }
      tfoot, .px-doc-foot { display:table-row-group; }
      tr { page-break-inside:avoid; }
    `;
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8" />
      <title>Extrato de valores gerados pelo pátio</title>
      <style>${document.getElementById("patioExtratoStyles")?.textContent || ""}${css}</style>
      </head><body>${documentHtml(report, { forPrint: true })}</body></html>`;
    if (typeof global.printHtmlInHiddenIframe === "function") {
      global.printHtmlInHiddenIframe(html, { iframeTitle: "Extrato do pátio" });
      return;
    }
    const w = window.open("", "_blank");
    if (!w) {
      alert("O navegador bloqueou a janela de impressão. Permita pop-ups para este site.");
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
    } catch (e) {
      console.error(e);
      alert(e.message || "Não foi possível imprimir o extrato.");
    }
  }

  function printHtmlDoc(title, bodyHtml) {
    const css = `
      @page { size: A4; margin: 12mm; }
      body { margin:0; color:#111; }
      .px-doc { box-shadow:none; padding:0; }
      .px-doc-head img { height:48px; }
      .px-doc-month { page-break-inside:avoid; }
    `;
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8" />
      <title>${esc(title)}</title>
      <style>${document.getElementById("patioExtratoStyles")?.textContent || ""}${css}</style>
      </head><body>${bodyHtml}</body></html>`;
    if (typeof global.printHtmlInHiddenIframe === "function") {
      global.printHtmlInHiddenIframe(html, { iframeTitle: title });
      return;
    }
    const w = window.open("", "_blank");
    if (!w) {
      alert("O navegador bloqueou a janela de impressão. Permita pop-ups para este site.");
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  }

  function ensureResumo() {
    if (lastResumo) return lastResumo;
    return buildResumo();
  }

  function printResumo() {
    const resumo = ensureResumo();
    if (!resumo) return;
    try {
      printHtmlDoc("Resumo financeiro por período", resumoDocumentHtml(resumo, { forPrint: true }));
    } catch (e) {
      console.error(e);
      alert(e.message || "Não foi possível imprimir o resumo.");
    }
  }

  async function drawResumoPdf() {
    const resumo = ensureResumo();
    if (!resumo) return;
    if (typeof global.loadJsPdf !== "function") throw new Error("PDF indisponível");
    await global.loadJsPdf();
    const jsPdfCtor = global.jspdf?.jsPDF;
    if (!jsPdfCtor) throw new Error("jsPDF indisponível");
    const pdf = new jsPdfCtor({ unit: "pt", format: "a4", orientation: "portrait" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const mx = 42;
    const contentW = pageW - mx * 2;
    const footerY = pageH - 36;
    const headerH = 64;
    const logo = typeof global.loadReciboLogoDataUrl === "function" ? await global.loadReciboLogoDataUrl() : null;

    const drawHeader = () => {
      pdf.setFillColor(16, 17, 20);
      pdf.rect(0, 0, pageW, headerH, "F");
      if (logo) {
        try {
          const props = pdf.getImageProperties(logo.dataUrl);
          const maxW = 220;
          const maxH = 40;
          let imgW = maxW;
          let imgH = (props.height * imgW) / props.width;
          if (imgH > maxH) {
            imgH = maxH;
            imgW = (props.width * imgH) / props.height;
          }
          pdf.addImage(logo.dataUrl, logo.type, (pageW - imgW) / 2, (headerH - imgH) / 2, imgW, imgH);
        } catch (_e) {
          pdf.setTextColor(255, 255, 255);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(14);
          pdf.text("AMPLIGUARD", pageW / 2, headerH / 2 + 5, { align: "center" });
        }
      } else {
        pdf.setTextColor(255, 255, 255);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(14);
        pdf.text("AMPLIGUARD", pageW / 2, headerH / 2 + 5, { align: "center" });
      }
      pdf.setDrawColor(212, 175, 55);
      pdf.setLineWidth(1.4);
      pdf.line(0, headerH, pageW, headerH);
    };

    const drawFooter = (page, pages) => {
      pdf.setDrawColor(180, 180, 180);
      pdf.line(mx, footerY, pageW - mx, footerY);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(70, 70, 70);
      pdf.text(FOOTER, mx, footerY + 14);
      pdf.text(`Página ${page}/${pages}`, pageW - mx, footerY + 14, { align: "right" });
    };

    drawHeader();
    let y = headerH + 22;
    pdf.setTextColor(16, 17, 20);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.text("RESUMO FINANCEIRO POR PERÍODO", pageW / 2, y, { align: "center" });
    y += 16;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text(`Meses: ${resumo.coberturaLabel || ""}`, mx, y);
    pdf.text(`Emissão: ${resumo.emitidoEm || ""}`, pageW - mx, y, { align: "right" });
    y += 18;

    (resumo.months || []).forEach((month) => {
      const blockH = 118;
      if (y + blockH > footerY - 8) {
        pdf.addPage();
        drawHeader();
        y = headerH + 22;
      }
      pdf.setFillColor(30, 58, 95);
      pdf.rect(mx, y, contentW, 22, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.text(month.monthLabel, mx + 10, y + 15);
      y += 30;
      pdf.setTextColor(16, 17, 20);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.text(`Período: ${month.periodoLabel}  ·  ${month.summary.veiculos} veículo(s)`, mx, y);
      y += 16;
      const lines = [
        ["Valor total gerado", money(month.summary.gerado)],
        ["Valor recebido", money(month.summary.recebido)],
        ["Aguardando faturamento", money(month.summary.aguardandoFaturamento)],
        ["Valor em aberto", money(month.summary.emAberto)],
      ];
      lines.forEach((pair) => {
        pdf.text(pair[0], mx, y);
        pdf.setFont("helvetica", "bold");
        pdf.text(pair[1], pageW - mx, y, { align: "right" });
        pdf.setFont("helvetica", "normal");
        y += 14;
      });
      y += 12;
    });

    const pages = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      pdf.setPage(i);
      drawFooter(i, pages);
    }
    const first = (resumo.months && resumo.months[0] && resumo.months[0].ym) || "";
    const last = (resumo.months && resumo.months[resumo.months.length - 1] && resumo.months[resumo.months.length - 1].ym) || "";
    pdf.save(`resumo-financeiro-${first}_${last}.pdf`);
  }

  function wrapPdfText(pdf, text, maxWidth) {
    const s = String(text || "");
    const parts = pdf.splitTextToSize(s, maxWidth);
    return Array.isArray(parts) ? parts : [s];
  }

  async function drawPdf() {
    const report = ensureReport();
    if (!report) return;
    if (typeof global.loadJsPdf !== "function") throw new Error("PDF indisponível");
    await global.loadJsPdf();
    const jsPdfCtor = global.jspdf?.jsPDF;
    if (!jsPdfCtor) throw new Error("jsPDF indisponível");
    const pdf = new jsPdfCtor({ unit: "pt", format: "a4", orientation: "portrait" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const mx = 32;
    const contentW = pageW - mx * 2;
    const footerY = pageH - 36;
    const headerH = 64;
    const logo = typeof global.loadReciboLogoDataUrl === "function" ? await global.loadReciboLogoDataUrl() : null;

    const drawHeader = () => {
      pdf.setFillColor(16, 17, 20);
      pdf.rect(0, 0, pageW, headerH, "F");
      if (logo) {
        try {
          const props = pdf.getImageProperties(logo.dataUrl);
          const maxW = 220;
          const maxH = 40;
          let imgW = maxW;
          let imgH = (props.height * imgW) / props.width;
          if (imgH > maxH) {
            imgH = maxH;
            imgW = (props.width * imgH) / props.height;
          }
          pdf.addImage(logo.dataUrl, logo.type, (pageW - imgW) / 2, (headerH - imgH) / 2, imgW, imgH);
        } catch (_e) {
          pdf.setTextColor(255, 255, 255);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(14);
          pdf.text("AMPLIGUARD", pageW / 2, headerH / 2 + 5, { align: "center" });
        }
      } else {
        pdf.setTextColor(255, 255, 255);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(14);
        pdf.text("AMPLIGUARD", pageW / 2, headerH / 2 + 5, { align: "center" });
      }
      pdf.setDrawColor(212, 175, 55);
      pdf.setLineWidth(1.4);
      pdf.line(0, headerH, pageW, headerH);
    };

    const drawFooter = (page, pages) => {
      pdf.setDrawColor(180, 180, 180);
      pdf.line(mx, footerY, pageW - mx, footerY);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(70, 70, 70);
      pdf.text(FOOTER, mx, footerY + 14);
      pdf.text(`Página ${page}/${pages}`, pageW - mx, footerY + 14, { align: "right" });
    };

    drawHeader();
    let y = headerH + 22;
    pdf.setTextColor(16, 17, 20);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.text("EXTRATO DE VALORES GERADOS PELO PÁTIO", pageW / 2, y, { align: "center" });
    y += 16;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text(`Período: ${report.periodoLabel}`, mx, y);
    pdf.text(`Emissão: ${report.emitidoEm || ""}`, pageW - mx, y, { align: "right" });
    y += 16;

    const colParts = [0.85, 1.2, 0.7, 0.7, 0.5, 0.85, 1.15, 1.15, 1.0];
    const colSum = colParts.reduce((a, b) => a + b, 0);
    const colHeads = ["Placa", "Marca/modelo", "Entrada", "Saída", "Dias", "Valor", "Responsável", "Quem trouxe", "Situação"];
    const cols = colHeads.map((h, i) => ({ h, w: (colParts[i] / colSum) * contentW }));
    const rowMin = 16;

    const paintTableHead = () => {
      pdf.setFillColor(30, 58, 95);
      pdf.rect(mx, y, contentW, rowMin, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7);
      let x = mx;
      cols.forEach((c) => {
        pdf.text(c.h, x + 3, y + 11);
        x += c.w;
      });
      y += rowMin;
      pdf.setTextColor(16, 17, 20);
      pdf.setFont("helvetica", "normal");
    };

    paintTableHead();
    const numericIdx = { 4: 1, 5: 1 };
    (report.rows || []).forEach((row, idx) => {
      const vals = [
        row.placa,
        row.marcaModelo,
        row.entradaLabel,
        row.saidaLabel,
        String(row.diarias),
        money(row.valorGerado),
        row.tomador,
        row.quemTrouxe,
        row.situacaoLabel,
      ];
      const lines = vals.map((val, i) => wrapPdfText(pdf, val, cols[i].w - 6));
      const lineCount = Math.max(1, ...lines.map((p) => p.length));
      const h = Math.max(rowMin, lineCount * 9 + 6);
      if (y + h > footerY - 8) {
        pdf.addPage();
        drawHeader();
        y = headerH + 14;
        paintTableHead();
      }
      if (idx % 2 === 1) {
        pdf.setFillColor(248, 250, 252);
        pdf.rect(mx, y, contentW, h, "F");
      }
      pdf.setDrawColor(210, 210, 210);
      pdf.line(mx, y + h, mx + contentW, y + h);
      pdf.setFontSize(7);
      let x = mx;
      lines.forEach((parts, i) => {
        const align = numericIdx[i] ? { align: "right" } : undefined;
        const tx = numericIdx[i] ? x + cols[i].w - 3 : x + 3;
        pdf.text(parts, tx, y + 10, align);
        x += cols[i].w;
      });
      y += h;
    });

    const s = report.summary;
    const boxH = 92;
    if (y + boxH > footerY - 8) {
      pdf.addPage();
      drawHeader();
      y = headerH + 22;
    }
    y += 12;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    const sumLines = [
      [`Quantidade de veículos`, String(s.veiculos)],
      [`Valor já recebido`, money(s.recebido)],
      [`Valor aguardando recebimento`, money(s.aguardandoRecebimento)],
      [`Valor aguardando faturamento`, money(s.aguardandoFaturamento)],
      [`Valor já faturado`, money(s.jaFaturado)],
    ];
    sumLines.forEach((pair) => {
      pdf.text(pair[0], mx, y);
      pdf.text(pair[1], pageW - mx, y, { align: "right" });
      y += 13;
    });
    y += 6;
    pdf.setFillColor(30, 58, 95);
    pdf.rect(mx, y, contentW, 22, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text("VALOR TOTAL GERADO", mx + 10, y + 15);
    pdf.text(money(s.gerado), pageW - mx - 10, y + 15, { align: "right" });

    const pages = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      pdf.setPage(i);
      drawFooter(i, pages);
    }
    const stamp = (report.fromYmd || "") + "_" + (report.toYmd || "");
    pdf.save(`extrato-patio-${stamp}.pdf`);
  }

  async function onPdf(btn, kind) {
    const prev = btn ? btn.textContent : "";
    if (btn) {
      btn.disabled = true;
      btn.textContent = "A gerar PDF…";
    }
    try {
      if (kind === "resumo") await drawResumoPdf();
      else await drawPdf();
    } catch (e) {
      console.error(e);
      alert(e.message || "Não foi possível gerar o PDF.");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = prev || "Gerar PDF";
      }
    }
  }

  function handleUiClick(ev) {
    const t = ev.target;
    if (!t || typeof t.closest !== "function") return;
    const btn = t.closest("[data-px-act]");
    if (!btn) {
      if (t.id === "patioExtratoPreview") {
        previewOpen = false;
        renderPreviewLayer();
      }
      return;
    }
    ev.preventDefault();
    const act = btn.getAttribute("data-px-act");
    if (act === "view") {
      if (!ensureReport()) return;
      previewOpen = "extrato";
      renderPreviewLayer();
    } else if (act === "print") {
      printReport();
    } else if (act === "pdf") {
      onPdf(btn);
    } else if (act === "view-resumo") {
      if (!ensureResumo()) return;
      previewOpen = "resumo";
      renderPreviewLayer();
    } else if (act === "print-resumo") {
      printResumo();
    } else if (act === "pdf-resumo") {
      onPdf(btn, "resumo");
    } else if (act === "close") {
      previewOpen = false;
      renderPreviewLayer();
    } else if (act === "mode-extrato") {
      screen = "extrato";
      render();
    } else if (act === "mode-resumo") {
      screen = "resumo";
      render();
    }
  }

  async function prepareData() {
    const jobs = [];
    if (typeof global.reboqueTransporteEnsureLoaded === "function") {
      jobs.push(Promise.resolve(global.reboqueTransporteEnsureLoaded()).catch(() => null));
    }
    const st = state();
    const needFinance =
      screen === "resumo" || !(st.receivables && st.receivables.length);
    if (needFinance && typeof global.refreshFinanceData === "function") {
      jobs.push(Promise.resolve(global.refreshFinanceData({ preserveView: true })).catch(() => null));
    }
    if (jobs.length) await Promise.all(jobs);
  }

  function onSubmit(ev) {
    if (ev.target?.id !== "patioExtratoForm") return;
    ev.preventDefault();
    previewOpen = false;
    const btn = ev.target.querySelector("button[type='submit']");
    const isResumo = screen === "resumo";
    if (btn) {
      btn.disabled = true;
      btn.textContent = isResumo ? "Consultando…" : "Gerando…";
    }
    Promise.resolve(prepareData())
      .then(() => {
        const ok = isResumo ? buildResumo() : buildReport();
        if (ok) render();
      })
      .finally(() => {
        const again = document.querySelector("#patioExtratoForm button[type='submit']");
        if (again) {
          again.disabled = false;
          again.textContent = screen === "resumo" ? "Consultar" : "Gerar extrato";
        }
      });
  }

  function bindOnce() {
    if (bound) return;
    bound = true;
    document.addEventListener("click", handleUiClick, true);
    document.addEventListener("submit", onSubmit, true);
  }

  function onShow() {
    bindOnce();
    injectStyles();
    if (typeof global.reboqueTransporteBind === "function") global.reboqueTransporteBind();
    render();
  }

  global.patioExtratoUi = { onShow, render, bindOnce };
})(typeof window !== "undefined" ? window : globalThis);

/**
 * UI do módulo Cobrança. Somente leitura sobre dados existentes + geração de PDF.
 */
(function cobrancaUiModule(global) {
  "use strict";

  const svc = () => global.cobrancaService;
  let bound = false;
  let screen = "list";
  let search = "";
  let tipoFilter = "todos";
  let partnerSearch = "";
  let listPage = 0;
  let lineStatus = "todos";
  let lineSearch = "";
  let periodDe = "";
  let periodAte = "";
  let linePage = 0;
  let currentSubject = null;
  let currentMeta = null;
  let selectedIds = new Set();
  let previewLines = [];
  let previewDoc = null;
  let historyRows = [];
  let historyMissing = false;

  function root() {
    return document.getElementById("cobrancaRoot");
  }

  function state() {
    return global.__ampliState || {};
  }

  function uid() {
    if (typeof global.effectiveUserId === "function") return global.effectiveUserId();
    return state().patioOwnerUserId || state().user?.id || null;
  }

  function supabase() {
    return global.supabaseClient || global.supabase;
  }

  function esc(v) {
    return svc().escapeHtml(v);
  }

  function money(v) {
    return svc().formatCurrency(v);
  }

  function d(v) {
    return v ? svc().formatDate(v) : "—";
  }

  function partnerNome(line) {
    return currentMeta?.nome || "—";
  }

  function ensureDataThen(fn) {
    const st = state();
    const need = !(st.receivables && st.receivables.length) && typeof global.refreshFinanceData === "function";
    if (need && uid()) {
      Promise.resolve(global.refreshFinanceData({ preserveView: true })).finally(fn);
      return;
    }
    if (typeof global.loadAdvocacyOffices === "function") {
      Promise.resolve(global.loadAdvocacyOffices()).catch(() => null).finally(fn);
      return;
    }
    fn();
  }

  function render() {
    const el = root();
    if (!el) return;
    if (screen === "partner" && currentSubject) renderPartner(el);
    else if (screen === "preview") renderPreview(el);
    else renderList(el);
  }

  function renderList(el) {
    const lines = svc().openLines();
    const cards = svc().filterCards(svc().partnerCards(lines), { search, tipo: tipoFilter });
    const pageSize = svc().PAGE_SIZE;
    const pages = Math.max(1, Math.ceil(cards.length / pageSize));
    if (listPage >= pages) listPage = pages - 1;
    const slice = cards.slice(listPage * pageSize, listPage * pageSize + pageSize);
    const chips = svc()
      .FILTER_TIPOS.map(
        (t) =>
          `<button type="button" class="cob-chip${tipoFilter === t.id ? " is-on" : ""}" data-cob-tipo="${esc(t.id)}">${esc(t.label)}</button>`
      )
      .join("");
    const body =
      slice.length === 0
        ? `<p class="cob-empty">Nenhum parceiro com valores em aberto para este filtro.</p>`
        : `<div class="cob-grid">${slice
            .map(
              (c) => `<article class="cob-card">
                <span class="cob-tipo">${esc(c.tipoLabel)}</span>
                <h3>${esc(c.nome)}</h3>
                <div class="cob-metrics">
                  <div>Veículos em aberto<strong>${c.veiculos}</strong></div>
                  <div>Valor em aberto<strong>${esc(money(c.total))}</strong></div>
                  <div class="is-late">Vencidos<strong>${esc(money(c.vencido))}</strong></div>
                  <div>A vencer<strong>${esc(money(c.aVencer))}</strong></div>
                </div>
                <button type="button" class="cob-btn" data-cob-open="${esc(c.kind)}" data-cob-id="${esc(c.id)}">ABRIR COBRANÇA</button>
              </article>`
            )
            .join("")}</div>`;
    el.innerHTML = `
      <div class="cob-toolbar">
        <div>
          <h2>Cobrança</h2>
          <p class="cob-sub">Controle de valores em aberto por parceiro</p>
        </div>
      </div>
      <input class="cob-search" id="cobSearchPartner" type="search" placeholder="Pesquisar parceiro..." value="${esc(search)}" />
      <div class="cob-filters">${chips}</div>
      ${body}
      ${pagerHtml(listPage, pages, "list")}`;
  }

  function pagerHtml(page, pages, which) {
    if (pages <= 1) return "";
    return `<div class="cob-pager">
      <button type="button" class="cob-btn secondary" data-cob-page="${which}" data-dir="-1" ${page <= 0 ? "disabled" : ""}>Anterior</button>
      <span>${page + 1} / ${pages}</span>
      <button type="button" class="cob-btn secondary" data-cob-page="${which}" data-dir="1" ${page >= pages - 1 ? "disabled" : ""}>Próxima</button>
    </div>`;
  }

  function statusClass(label) {
    if (label === "Vencido") return "late";
    if (label === "A vencer") return "open";
    return "";
  }

  function renderPartner(el) {
    const all = svc().openLines().filter((l) => svc().lineMatchesPartner(l, currentSubject));
    const lines = svc().filterLines(all, { status: lineStatus, search: lineSearch, de: periodDe, ate: periodAte });
    const sums = svc().summarizeLines(all);
    const pageSize = svc().PAGE_SIZE;
    const pages = Math.max(1, Math.ceil(lines.length / pageSize));
    if (linePage >= pages) linePage = Math.max(0, pages - 1);
    const slice = lines.slice(linePage * pageSize, linePage * pageSize + pageSize);
    const allIds = lines.map((l) => l.receivableId);
    const selectedOnPage = slice.filter((l) => selectedIds.has(l.receivableId)).length;
    const hist =
      historyMissing
        ? `<p class="cob-empty">Histórico indisponível até aplicar supabase/cobrancas.sql (não altera dados financeiros).</p>`
        : historyRows.length
          ? `<div class="cob-table-wrap"><table class="cob-table"><thead><tr>
              <th>Nº</th><th>Data</th><th>Período</th><th class="num">Veículos</th><th class="num">Valor</th><th>Ações</th>
            </tr></thead><tbody>${historyRows
              .map((h) => {
                const num = String(h.numero_cobranca || 0).padStart(6, "0");
                const per = svc().formatPeriodLabel(h.periodo_inicio, h.periodo_fim);
                return `<tr>
                  <td data-label="Nº">${esc(num)}</td>
                  <td data-label="Data">${esc(d(h.data_geracao || h.created_at))}</td>
                  <td data-label="Período">${esc(per)}</td>
                  <td class="num" data-label="Veículos">${esc(h.quantidade_veiculos || 0)}</td>
                  <td class="num" data-label="Valor">${esc(money(h.valor_total))}</td>
                  <td data-label="Ações">
                    <button type="button" class="cob-btn secondary" data-cob-hist="${esc(h.id)}" data-act="view">Visualizar</button>
                    <button type="button" class="cob-btn secondary" data-cob-hist="${esc(h.id)}" data-act="pdf">Baixar PDF</button>
                    <button type="button" class="cob-btn secondary" data-cob-hist="${esc(h.id)}" data-act="print">Imprimir</button>
                    <button type="button" class="cob-btn danger" data-cob-hist="${esc(h.id)}" data-act="delete">Apagar</button>
                  </td>
                </tr>`;
              })
              .join("")}</tbody></table></div>`
          : `<p class="cob-empty">Nenhum documento gerado ainda para este parceiro.</p>`;

    const rows =
      slice.length === 0
        ? `<tr><td colspan="8">Nenhum registro em aberto com os filtros atuais.</td></tr>`
        : slice
            .map((line) => {
              const checked = selectedIds.has(line.receivableId) ? "checked" : "";
              return `<tr data-cob-line="${esc(line.receivableId)}">
                <td data-label="Sel."><input type="checkbox" data-cob-check="${esc(line.receivableId)}" ${checked} /></td>
                <td data-label="Veículo">${esc(line.veiculoNome)}</td>
                <td data-label="Placa">${esc(line.placa || "—")}</td>
                <td data-label="Entrada">${esc(d(line.entrada))}</td>
                <td data-label="Saída">${esc(line.saida ? d(line.saida) : "—")}</td>
                <td class="num" data-label="Dias">${esc(line.dias === "" ? "—" : line.dias)}</td>
                <td class="num" data-label="Valor">${esc(money(line.valor))}</td>
                <td data-label="Status"><span class="cob-tag ${statusClass(line.statusLabel)}">${esc(line.statusLabel)}</span></td>
              </tr>`;
            })
            .join("");

    el.innerHTML = `
      <div class="cob-toolbar">
        <div>
          <button type="button" class="cob-btn secondary" data-cob-back="list">← Voltar</button>
          <h2 style="margin-top:10px">Cobrança</h2>
          <p class="cob-sub"><strong>Parceiro:</strong> ${esc(currentMeta.nome)} · <strong>Tipo:</strong> ${esc(currentMeta.tipoLabel)}</p>
        </div>
      </div>
      <div class="cob-kpis">
        <div class="cob-kpi"><span>Total em aberto</span><strong>${esc(money(sums.total))}</strong></div>
        <div class="cob-kpi is-late"><span>Vencido</span><strong>${esc(money(sums.vencido))}</strong></div>
        <div class="cob-kpi"><span>A vencer</span><strong>${esc(money(sums.aVencer))}</strong></div>
        <div class="cob-kpi"><span>Veículos</span><strong>${esc(sums.veiculos)}</strong></div>
      </div>
      <h3>Veículos em aberto</h3>
      <div class="cob-filters">
        <button type="button" class="cob-chip${lineStatus === "todos" ? " is-on" : ""}" data-cob-lstatus="todos">Todos</button>
        <button type="button" class="cob-chip${lineStatus === "vencidos" ? " is-on" : ""}" data-cob-lstatus="vencidos">Vencidos</button>
        <button type="button" class="cob-chip${lineStatus === "a_vencer" ? " is-on" : ""}" data-cob-lstatus="a_vencer">A vencer</button>
        <button type="button" class="cob-chip${lineStatus === "em_aberto" ? " is-on" : ""}" data-cob-lstatus="em_aberto">Em aberto</button>
      </div>
      <div class="cob-actions-row">
        <input class="cob-search" id="cobSearchLine" type="search" placeholder="Placa, chassi, modelo, código…" value="${esc(lineSearch)}" />
        <label>De <input type="date" id="cobPeriodDe" value="${esc(periodDe)}" /></label>
        <label>Até <input type="date" id="cobPeriodAte" value="${esc(periodAte)}" /></label>
      </div>
      <div class="cob-actions-row">
        <button type="button" class="cob-btn secondary" data-cob-sel="all">Selecionar todos</button>
        <button type="button" class="cob-btn secondary" data-cob-sel="none">Desmarcar todos</button>
        <span>${selectedIds.size} selecionado(s)${selectedOnPage ? ` · ${selectedOnPage} nesta página` : ""}</span>
        <button type="button" class="cob-btn" data-cob-gerar="1">GERAR COBRANÇA</button>
      </div>
      <div class="cob-table-wrap">
        <table class="cob-table">
          <thead>
            <tr>
              <th></th><th>Veículo</th><th>Placa</th><th>Entrada</th><th>Saída</th>
              <th class="num">Dias</th><th class="num">Valor</th><th>Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      ${pagerHtml(linePage, pages, "lines")}
      <h3 style="margin-top:22px">Histórico de cobranças</h3>
      ${hist}
    `;
  }

  function paperHtml(doc) {
    const rows = (doc.lines || [])
      .map(
        (line) => `<tr>
          <td>${esc(line.veiculoNome)}</td>
          <td>${esc(line.placa || "—")}</td>
          <td>${esc(d(line.entrada))}</td>
          <td>${esc(line.saida ? d(line.saida) : "—")}</td>
          <td>${esc(svc().formatPeriodLabel(line.entrada, line.saida || svc().todayYmd()))}</td>
          <td style="text-align:right">${esc(line.dias === "" || line.dias == null ? "—" : line.dias)}</td>
          <td style="text-align:right">${esc(money(line.valor))}</td>
        </tr>`
      )
      .join("");
    const logo = "/assets/ampliguard-header-trim.png?v=12";
    const num = String(doc.numero || 0).padStart(6, "0");
    return `<div class="cob-preview-paper" id="cobPaper">
      <img class="cob-preview-logo" src="${esc(logo)}" alt="AMPLIAUTO" />
      <h1>COBRANÇA Nº ${esc(num)}</h1>
      <div class="cob-preview-meta">
        <p><strong>Parceiro:</strong> ${esc(doc.parceiroNome)}</p>
        <p><strong>Tipo:</strong> ${esc(doc.parceiroTipo)}</p>
        <p><strong>Data de emissão:</strong> ${esc(doc.dataEmissao)}</p>
        <p><strong>Período da cobrança:</strong> ${esc(doc.periodoLabel)}</p>
      </div>
      <div class="cob-preview-sum">
        <p><strong>Quantidade de veículos:</strong> ${esc(doc.veiculos)}</p>
        <p><strong>Total de diárias:</strong> ${esc(money(doc.diarias))}</p>
        <p><strong>Outros valores:</strong> ${esc(money(doc.outros))}</p>
      </div>
      <h3>Detalhamento</h3>
      <table>
        <thead><tr>
          <th>Veículo</th><th>Placa</th><th>Entrada</th><th>Saída</th><th>Período</th><th>Dias</th><th>Valor</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="cob-preview-total"><strong>TOTAL DA COBRANÇA: ${esc(money(doc.total))}</strong></p>
      <p class="cob-preview-foot">AMPLIAUTO · Documento de cobrança gerado pelo sistema · ${esc(doc.geradoEm)}</p>
    </div>`;
  }

  function renderPreview(el) {
    const doc = previewDoc;
    if (!doc) {
      el.innerHTML = `<p class="cob-empty">Pré-visualização indisponível.</p>`;
      return;
    }
    el.innerHTML = `
      <div class="cob-toolbar">
        <div>
          <h2>Cobrança</h2>
          <p class="cob-sub">Pré-visualização do documento</p>
        </div>
        <div class="cob-actions-row">
          <button type="button" class="cob-btn secondary" data-cob-back="partner">← VOLTAR</button>
          <button type="button" class="cob-btn" data-cob-pdf="1">BAIXAR PDF</button>
          <button type="button" class="cob-btn secondary" data-cob-print="1">IMPRIMIR</button>
        </div>
      </div>
      ${paperHtml(doc)}
    `;
  }

  function buildPreviewDoc(lines, extra) {
    const sums = svc().selectedSummary(lines);
    const now = new Date();
    const geradoEm = now.toLocaleString("pt-BR");
    return {
      numero: extra?.numero || 0,
      parceiroNome: currentMeta.nome,
      parceiroTipo: currentMeta.tipoLabel,
      dataEmissao: svc().formatDate(svc().todayYmd()),
      periodoLabel: sums.periodoLabel,
      veiculos: sums.veiculos,
      diarias: sums.diarias,
      outros: sums.outros,
      total: sums.total,
      geradoEm,
      lines,
      cobrancaId: extra?.id || null,
    };
  }

  async function openPartner(kind, id) {
    currentSubject = { kind, id };
    currentMeta = svc().subjectMeta(currentSubject);
    selectedIds = new Set();
    lineStatus = "todos";
    lineSearch = "";
    periodDe = "";
    periodAte = "";
    linePage = 0;
    screen = "partner";
    historyRows = [];
    historyMissing = false;
    render();
    const hist = await svc().loadHistory(currentSubject, uid(), supabase());
    if (hist && hist.missingTable) {
      historyMissing = true;
      historyRows = [];
    } else {
      historyRows = Array.isArray(hist) ? hist : [];
    }
    if (screen === "partner") render();
  }

  function goGerar() {
    const all = svc().openLines().filter((l) => svc().lineMatchesPartner(l, currentSubject));
    if (!all.length) {
      alert("Este parceiro não possui valores em aberto.");
      return;
    }
    const ids = svc().dedupeReceivableIds([...selectedIds]);
    if (!ids.length) {
      alert("Selecione pelo menos um registro para gerar a cobrança.");
      return;
    }
    const lines = svc().linesByReceivableIds(all, ids);
    if (lines.length !== ids.length) {
      alert("Há inconsistência entre o lançamento financeiro e o veículo. Atualize a lista e tente novamente.");
      return;
    }
    previewLines = lines;
    previewDoc = buildPreviewDoc(lines, { numero: 0 });
    screen = "preview";
    render();
  }

  function printDoc(doc) {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Cobrança</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:24px}
        h1{letter-spacing:.12em;text-align:center}
        img{display:block;margin:0 auto 8px;max-height:52px}
        table{width:100%;border-collapse:collapse;font-size:12px;margin-top:12px}
        th,td{border:1px solid #ccc;padding:6px 8px}
        .total{text-align:right;font-size:16px;margin-top:14px}
        .foot{margin-top:28px;text-align:center;font-size:11px;color:#444}
      </style></head><body>${paperHtml(doc)}</body></html>`;
    if (typeof global.printHtmlInHiddenIframe === "function") {
      global.printHtmlInHiddenIframe(html, { iframeTitle: "Cobrança" });
      return;
    }
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
      w.focus();
      w.print();
    }
  }

  async function drawPdf(doc) {
    if (typeof global.loadJsPdf !== "function") throw new Error("PDF indisponível");
    await global.loadJsPdf();
    const jsPdfCtor = global.jspdf?.jsPDF;
    if (!jsPdfCtor) throw new Error("jsPDF indisponível");
    const pdf = new jsPdfCtor({ unit: "pt", format: "a4", orientation: "portrait" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const mx = 42;
    const contentW = pageW - mx * 2;
    const footerY = pageH - 40;
    const headerH = 70;
    const logo = typeof global.loadReciboLogoDataUrl === "function" ? await global.loadReciboLogoDataUrl() : null;

    const drawHeader = () => {
      pdf.setFillColor(16, 17, 20);
      pdf.rect(0, 0, pageW, headerH, "F");
      if (logo) {
        try {
          const props = pdf.getImageProperties(logo.dataUrl);
          const maxW = 260;
          const maxH = 44;
          let imgW = maxW;
          let imgH = (props.height * imgW) / props.width;
          if (imgH > maxH) {
            imgH = maxH;
            imgW = (props.width * imgH) / props.height;
          }
          pdf.addImage(logo.dataUrl, logo.type, (pageW - imgW) / 2, (headerH - imgH) / 2, imgW, imgH);
        } catch {
          pdf.setTextColor(255, 255, 255);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(16);
          pdf.text("AMPLIAUTO", pageW / 2, headerH / 2 + 5, { align: "center" });
        }
      } else {
        pdf.setTextColor(255, 255, 255);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(16);
        pdf.text("AMPLIAUTO", pageW / 2, headerH / 2 + 5, { align: "center" });
      }
      pdf.setDrawColor(155, 44, 44);
      pdf.setLineWidth(1.2);
      pdf.line(0, headerH, pageW, headerH);
    };

    const drawFooter = (page, pages) => {
      pdf.setDrawColor(180, 180, 180);
      pdf.line(mx, footerY, pageW - mx, footerY);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(70, 70, 70);
      pdf.text("AMPLIAUTO · Documento de cobrança gerado pelo sistema", mx, footerY + 14);
      pdf.text(`${doc.geradoEm} · Página ${page}/${pages}`, pageW - mx, footerY + 14, { align: "right" });
    };

    drawHeader();
    let y = headerH + 28;
    const num = String(doc.numero || 0).padStart(6, "0");
    pdf.setTextColor(16, 17, 20);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.text(`COBRANÇA Nº ${num}`, pageW / 2, y, { align: "center" });
    y += 22;
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    const meta = [
      `Parceiro: ${doc.parceiroNome}`,
      `Tipo: ${doc.parceiroTipo}`,
      `Data de emissão: ${doc.dataEmissao}`,
      `Período da cobrança: ${doc.periodoLabel}`,
      `Quantidade de veículos: ${doc.veiculos}`,
      `Total de diárias: ${money(doc.diarias)}`,
      `Outros valores: ${money(doc.outros)}`,
    ];
    meta.forEach((line) => {
      pdf.text(line, mx, y);
      y += 14;
    });
    y += 8;

    const colParts = [1.7, 0.9, 0.85, 0.85, 1.2, 0.5, 0.95];
    const colSum = colParts.reduce((a, b) => a + b, 0);
    const colHeads = ["Veículo", "Placa", "Entrada", "Saída", "Período", "Dias", "Valor"];
    const cols = colHeads.map((h, i) => ({ h, w: (colParts[i] / colSum) * contentW }));
    const rowH = 18;

    const paintTableHead = () => {
      pdf.setFillColor(30, 58, 95);
      pdf.rect(mx, y, contentW, rowH, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      let x = mx;
      cols.forEach((c) => {
        pdf.text(c.h, x + 4, y + 12);
        x += c.w;
      });
      y += rowH;
      pdf.setTextColor(16, 17, 20);
      pdf.setFont("helvetica", "normal");
    };

    paintTableHead();
    const rows = doc.lines || [];
    rows.forEach((line) => {
      if (y + rowH > footerY - 8) {
        pdf.addPage();
        drawHeader();
        y = headerH + 16;
        paintTableHead();
      }
      const vals = [
        String(line.veiculoNome || "").slice(0, 28),
        line.placa || "—",
        d(line.entrada),
        line.saida ? d(line.saida) : "—",
        svc().formatPeriodLabel(line.entrada, line.saida || svc().todayYmd()),
        line.dias === "" || line.dias == null ? "—" : String(line.dias),
        money(line.valor),
      ];
      let x = mx;
      pdf.setDrawColor(210, 210, 210);
      pdf.line(mx, y + rowH, mx + contentW, y + rowH);
      vals.forEach((val, i) => {
        const align = i >= 5 ? { align: "right" } : undefined;
        const tx = i >= 5 ? x + cols[i].w - 4 : x + 4;
        pdf.text(String(val), tx, y + 12, align);
        x += cols[i].w;
      });
      y += rowH;
    });

    y += 16;
    if (y + 28 > footerY) {
      pdf.addPage();
      drawHeader();
      y = headerH + 24;
    }
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.text(`TOTAL DA COBRANÇA: ${money(doc.total)}`, pageW - mx, y, { align: "right" });

    const pages = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      pdf.setPage(i);
      drawFooter(i, pages);
    }
    const safe = String(doc.parceiroNome || "parceiro")
      .replace(/[^\w\s-]+/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 40);
    pdf.save(`cobranca-${num}-${safe}.pdf`);
  }

  async function persistIfNeeded() {
    if (previewDoc?.cobrancaId) return previewDoc;
    try {
      const created = await svc().persistCobranca({
        supabase: supabase(),
        uid: uid(),
        subject: currentSubject,
        meta: currentMeta,
        lines: previewLines,
        sessionUser: state().user || state().session?.user || null,
      });
      previewDoc = buildPreviewDoc(previewLines, created);
      previewDoc.numero = created.numero_cobranca;
      previewDoc.cobrancaId = created.id;
      historyRows = [created].concat(historyRows || []);
      return previewDoc;
    } catch (e) {
      const msg = String(e.message || e);
      if (/tabelas de histórico|schema cache|does not exist|relation/i.test(msg)) {
        previewDoc = previewDoc || buildPreviewDoc(previewLines, { numero: 0 });
        previewDoc.numero = previewDoc.numero || 0;
        return previewDoc;
      }
      throw e;
    }
  }

  async function onPdf() {
    try {
      const doc = await persistIfNeeded();
      await drawPdf(doc);
      render();
    } catch (e) {
      alert(e.message || "Não foi possível gerar o PDF.");
    }
  }

  async function onPrint() {
    try {
      const doc = await persistIfNeeded();
      printDoc(doc);
      render();
    } catch (e) {
      alert(e.message || "Não foi possível imprimir.");
    }
  }

  async function openHistory(id, act) {
    const row = historyRows.find((h) => String(h.id) === String(id));
    if (!row) return;
    if (act === "delete") {
      await deleteHistory(row);
      return;
    }
    const items = await svc().loadHistoryItems(id, supabase());
    const lines = svc().snapshotLinesFromItems(items);
    const doc = {
      numero: row.numero_cobranca,
      parceiroNome: row.parceiro_nome || currentMeta?.nome,
      parceiroTipo: row.parceiro_tipo || currentMeta?.tipoLabel,
      dataEmissao: svc().formatDate(row.data_geracao || row.created_at),
      periodoLabel: svc().formatPeriodLabel(row.periodo_inicio, row.periodo_fim),
      veiculos: row.quantidade_veiculos,
      diarias: lines.reduce((s, l) => s + Number(l.diarias || 0), 0),
      outros: lines.reduce((s, l) => s + Number(l.outros || 0), 0),
      total: Number(row.valor_total || 0),
      geradoEm: row.data_geracao ? new Date(row.data_geracao).toLocaleString("pt-BR") : "",
      lines,
      cobrancaId: row.id,
    };
    previewLines = lines;
    previewDoc = doc;
    if (act === "pdf") {
      await drawPdf(doc);
      return;
    }
    if (act === "print") {
      printDoc(doc);
      return;
    }
    screen = "preview";
    render();
  }

  async function deleteHistory(row) {
    const num = String(row.numero_cobranca || 0).padStart(6, "0");
    const ok = window.confirm(
      `Apagar a cobrança Nº ${num}?\n\nIsto remove só o documento do histórico. Não altera contas a receber, baixas nem veículos.`
    );
    if (!ok) return;
    try {
      await svc().deleteCobranca(row.id, uid(), supabase());
      historyRows = historyRows.filter((h) => String(h.id) !== String(row.id));
      if (previewDoc?.cobrancaId && String(previewDoc.cobrancaId) === String(row.id)) {
        previewDoc = null;
        screen = "partner";
      }
      render();
    } catch (e) {
      alert(e.message || "Não foi possível apagar o registro.");
    }
  }

  function onRootClick(e) {
    const tipoBtn = e.target.closest("[data-cob-tipo]");
    if (tipoBtn) {
      tipoFilter = tipoBtn.getAttribute("data-cob-tipo");
      listPage = 0;
      render();
      return;
    }
    const openBtn = e.target.closest("[data-cob-open]");
    if (openBtn) {
      openPartner(openBtn.getAttribute("data-cob-open"), openBtn.getAttribute("data-cob-id"));
      return;
    }
    const back = e.target.closest("[data-cob-back]");
    if (back) {
      screen = back.getAttribute("data-cob-back") === "list" ? "list" : "partner";
      render();
      return;
    }
    const st = e.target.closest("[data-cob-lstatus]");
    if (st) {
      lineStatus = st.getAttribute("data-cob-lstatus");
      linePage = 0;
      render();
      return;
    }
    const sel = e.target.closest("[data-cob-sel]");
    if (sel) {
      const all = svc()
        .filterLines(
          svc().openLines().filter((l) => svc().lineMatchesPartner(l, currentSubject)),
          { status: lineStatus, search: lineSearch, de: periodDe, ate: periodAte }
        )
        .map((l) => l.receivableId);
      if (sel.getAttribute("data-cob-sel") === "all") all.forEach((id) => selectedIds.add(id));
      else selectedIds.clear();
      render();
      return;
    }
    if (e.target.closest("[data-cob-gerar]")) {
      goGerar();
      return;
    }
    if (e.target.closest("[data-cob-pdf]")) {
      onPdf();
      return;
    }
    if (e.target.closest("[data-cob-print]")) {
      onPrint();
      return;
    }
    const pageBtn = e.target.closest("[data-cob-page]");
    if (pageBtn) {
      const which = pageBtn.getAttribute("data-cob-page");
      const dir = Number(pageBtn.getAttribute("data-dir") || 0);
      if (which === "list") listPage = Math.max(0, listPage + dir);
      else linePage = Math.max(0, linePage + dir);
      render();
      return;
    }
    const hist = e.target.closest("[data-cob-hist]");
    if (hist) {
      openHistory(hist.getAttribute("data-cob-hist"), hist.getAttribute("data-act"));
      return;
    }
    const chk = e.target.closest("[data-cob-check]");
    if (chk) {
      const id = chk.getAttribute("data-cob-check");
      if (chk.checked) selectedIds.add(id);
      else selectedIds.delete(id);
      return;
    }
    const tr = e.target.closest("tr[data-cob-line]");
    if (tr && !e.target.closest("input")) {
      showLineModal(tr.getAttribute("data-cob-line"));
    }
  }

  function showLineModal(receivableId) {
    const line = svc()
      .openLines()
      .find((l) => l.receivableId === String(receivableId));
    if (!line) return;
    const bd = document.createElement("div");
    bd.className = "cob-modal-backdrop";
    bd.innerHTML = `<div class="cob-modal" role="dialog">
      <h3>Veículo</h3>
      <dl>
        <dt>Modelo</dt><dd>${esc(line.veiculoNome)}</dd>
        <dt>Placa</dt><dd>${esc(line.placa || "—")}</dd>
        <dt>Data de entrada</dt><dd>${esc(d(line.entrada))}</dd>
        <dt>Data de saída</dt><dd>${esc(line.saida ? d(line.saida) : "—")}</dd>
        <dt>Parceiro</dt><dd>${esc(partnerNome(line))}</dd>
        <dt>Dias no pátio</dt><dd>${esc(line.dias === "" ? "—" : line.dias)}</dd>
        <dt>Valor da diária</dt><dd>${esc(line.valorDiaria != null ? money(line.valorDiaria) : "—")}</dd>
        <dt>Valor acumulado</dt><dd>${esc(money(line.valor))}</dd>
        <dt>Status financeiro</dt><dd>${esc(line.statusLabel)}</dd>
      </dl>
      <div class="cob-actions-row" style="margin-top:16px">
        <button type="button" class="cob-btn" data-cob-close-modal="1">Fechar</button>
      </div>
    </div>`;
    bd.addEventListener("click", (ev) => {
      if (ev.target === bd || ev.target.closest("[data-cob-close-modal]")) bd.remove();
    });
    document.body.appendChild(bd);
  }

  function onRootInput(e) {
    if (e.target.id === "cobSearchPartner") {
      search = e.target.value;
      listPage = 0;
      render();
      const input = document.getElementById("cobSearchPartner");
      if (input) {
        input.focus();
        const len = input.value.length;
        input.setSelectionRange(len, len);
      }
      return;
    }
    if (e.target.id === "cobSearchLine") {
      lineSearch = e.target.value;
      linePage = 0;
      const el = e.target;
      const pos = el.selectionStart;
      render();
      const again = document.getElementById("cobSearchLine");
      if (again) {
        again.focus();
        again.setSelectionRange(pos, pos);
      }
      return;
    }
    if (e.target.id === "cobPeriodDe") {
      periodDe = e.target.value;
      linePage = 0;
      render();
      return;
    }
    if (e.target.id === "cobPeriodAte") {
      periodAte = e.target.value;
      linePage = 0;
      render();
    }
  }

  function bindOnce() {
    if (bound) return;
    bound = true;
    const el = root();
    if (!el) return;
    el.addEventListener("click", onRootClick);
    el.addEventListener("input", onRootInput);
    el.addEventListener("change", onRootInput);
  }

  function mount() {
    bindOnce();
    screen = "list";
    ensureDataThen(() => render());
  }

  global.cobrancaUi = {
    bindOnce,
    mount,
    render,
  };
})(typeof window !== "undefined" ? window : globalThis);

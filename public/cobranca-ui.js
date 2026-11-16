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
  let preserveOnMount = false;
  let presetIds = null;
  let chargeRows = [];
  let chargeSearch = "";
  let chargesMissing = false;
  let chargesLoaded = false;
  let currentCharge = null;
  let compose = emptyCompose();

  function emptyCompose() {
    return {
      titulo: "Faturar em conjunto",
      modo: "cadastrado",
      clientKey: "",
      busca: "",
      nome: "",
      documento: "",
      contato: "",
      salvar: false,
      vencimento: "",
      origem: "financeiro",
      selected: new Set(),
      client: null,
    };
  }

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
    else if (screen === "compose") renderCompose(el);
    else if (screen === "pendentes" || screen === "recebidos") renderCharges(el);
    else if (screen === "detalhe") renderDetalhe(el);
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
      <div class="cob-actions-row cob-main-actions">
        <button type="button" class="cob-btn" data-cob-nav="nova">Nova cobrança</button>
        <button type="button" class="cob-btn" data-cob-nav="conjunto">Faturar em conjunto</button>
        <button type="button" class="cob-btn secondary" data-cob-nav="pendentes">Cobranças pendentes</button>
        <button type="button" class="cob-btn secondary" data-cob-nav="recebidos">Pagamentos recebidos</button>
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

  function programHintHtml() {
    const prog = global.partnerProgram;
    if (!prog || !currentMeta) return "";
    const p =
      (global.state?.partners || []).find((x) => String(x.id) === String(currentMeta.id)) ||
      { perfil: { programa_cliente_parceiro: currentMeta.programa } };
    const ym = svc().todayYmd().slice(0, 7);
    const items = svc()
      .openLines()
      .filter((l) => svc().lineMatchesPartner(l, currentSubject))
      .map((l) => ({ receivable: { period_end: l.saida, id: l.receivableId }, vehicle: l.vehicle, vehicle_id: l.vehicleId }));
    const cycles = prog.countCyclesInMonth(items, ym);
    const tar = prog.tariffFor(p, cycles);
    const close = prog.closingForMonth(ym);
    return `<p class="notice">${esc(tar.label)} · Ciclos neste mês: ${cycles} · Fechamento ${esc(close.fechamento)} · Vencimento ${esc(close.vencimento)}. O valor do título já gravado não é recalculado aqui.</p>`;
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

    const gerarLabel = () => {
      const chosen = lines.filter((l) => selectedIds.has(l.receivableId));
      if (!chosen.length) return "Faturar em conjunto";
      return `Faturar em conjunto (${chosen.length}) · ${money(svc().summarizeLines(chosen).total)}`;
    };

    const rows =
      slice.length === 0
        ? `<tr><td colspan="9">Nenhum registro em aberto com os filtros atuais.</td></tr>`
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
                <td data-label="Ações"><button type="button" class="cob-btn danger" data-cob-hide="${esc(line.receivableId)}">Apagar</button></td>
              </tr>`;
            })
            .join("");

    el.innerHTML = `
      <div class="cob-toolbar">
        <div>
          <button type="button" class="cob-btn secondary" data-cob-back="list">← Voltar</button>
          <h2 style="margin-top:10px">Cobrança</h2>
          <p class="cob-sub"><strong>Parceiro:</strong> ${esc(currentMeta.nome)} · <strong>Tipo:</strong> ${esc(currentMeta.tipoLabel)}</p>
          ${programHintHtml()}
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
        <button type="button" class="cob-btn danger" data-cob-hide-sel="1">Apagar selecionados</button>
        <button type="button" class="cob-btn" data-cob-gerar="1" ${selectedIds.size ? "" : "disabled"}>${esc(gerarLabel())}</button>
      </div>
      <div class="cob-table-wrap">
        <table class="cob-table">
          <thead>
            <tr>
              <th></th><th>Veículo</th><th>Placa</th><th>Entrada</th><th>Saída</th>
              <th class="num">Dias</th><th class="num">Valor</th><th>Status</th><th>Ações</th>
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
          <td>${esc(line.servico || svc().serviceLabel(line))}</td>
          <td>${esc(d(line.entrada))}</td>
          <td>${esc(line.saida ? d(line.saida) : "—")}</td>
          <td>${esc(svc().formatPeriodLabel(line.entrada, line.saida || svc().todayYmd()))}</td>
          <td style="text-align:right">${esc(line.dias === "" || line.dias == null ? "—" : line.dias)}</td>
          <td style="text-align:right">${esc(money(line.valor))}</td>
        </tr>`
      )
      .join("");
    const logo = "/assets/ampliguard-marca.png?v=20260917logo2";
    const num = String(doc.numero || 0).padStart(6, "0");
    return `<div class="cob-preview-paper" id="cobPaper">
      <img class="cob-preview-logo" src="${esc(logo)}" alt="AMPLIAUTO" />
      <h1>COBRANÇA Nº ${esc(num)}</h1>
      <div class="cob-preview-meta">
        <p><strong>Cliente:</strong> ${esc(doc.parceiroNome)}</p>
        <p><strong>Tipo:</strong> ${esc(doc.parceiroTipo)}</p>
        <p><strong>Data de emissão:</strong> ${esc(doc.dataEmissao)}</p>
        <p><strong>Período da cobrança:</strong> ${esc(doc.periodoLabel)}</p>
        ${doc.vencimento ? `<p><strong>Vencimento:</strong> ${esc(d(doc.vencimento))}</p>` : ""}
        ${Number(doc.abatimentos) > 0 ? `<p><strong>Abatimentos já recebidos:</strong> ${esc(money(doc.abatimentos))}</p>` : ""}
      </div>
      <div class="cob-preview-sum">
        <p><strong>Quantidade de veículos:</strong> ${esc(doc.veiculos)}</p>
        <p><strong>Total de diárias:</strong> ${esc(money(doc.diarias))}</p>
        <p><strong>Outros valores:</strong> ${esc(money(doc.outros))}</p>
      </div>
      <h3>Detalhamento</h3>
      <table>
        <thead><tr>
          <th>Veículo</th><th>Placa</th><th>Serviço</th><th>Entrada</th><th>Saída</th><th>Período</th><th>Dias</th><th>Valor</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="cob-preview-total"><strong>TOTAL DA COBRANÇA: ${esc(money(doc.total))}</strong></p>
      <p class="cob-preview-foot">AMPLIAUTO · Demonstrativo de cobrança · não é nota fiscal · ${esc(doc.geradoEm)}</p>
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
          <button type="button" class="cob-btn" data-cob-confirm="1">Confirmar cobrança</button>
          <button type="button" class="cob-btn secondary" data-cob-pdf="1">BAIXAR PDF</button>
          <button type="button" class="cob-btn secondary" data-cob-print="1">IMPRIMIR</button>
          <button type="button" class="cob-btn secondary" data-cob-whatsapp="1">WhatsApp</button>
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
      vencimento: extra?.vencimento || compose.client?.vencimento || "",
      abatimentos: (lines || []).reduce((s, l) => s + Number(l.abatimento || 0), 0),
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
    const lines = svc().linesByReceivableIds(all, ids).map((l) => ({
      ...l,
      valorOriginal: Number(l.valor || 0),
      abatimento: Number(l.abatimento || 0),
      valor: svc().saldoAposAbatimento(l.valor, l.abatimento),
    }));
    if (lines.length !== ids.length) {
      alert("Há inconsistência entre o lançamento financeiro e o veículo. Atualize a lista e tente novamente.");
      return;
    }
    previewLines = lines;
    compose.client = {
      modo: "cadastrado",
      nome: currentMeta?.nome || "",
      documento: "",
      contato: currentMeta?.whatsapp || "",
      tipoLabel: currentMeta?.tipoLabel || "Cliente",
      salvar: false,
      origem: "financeiro",
      subject: currentSubject,
    };
    previewDoc = buildPreviewDoc(lines, { numero: 0 });
    preserveOnMount = true;
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
      pdf.text("AMPLIAUTO · Demonstrativo de cobrança · não é nota fiscal", mx, footerY + 14);
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
      `Cliente: ${doc.parceiroNome}`,
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

    const colParts = [1.4, 0.75, 1.05, 0.72, 0.72, 0.95, 0.42, 0.8];
    const colSum = colParts.reduce((a, b) => a + b, 0);
    const colHeads = ["Veículo", "Placa", "Serviço", "Entrada", "Saída", "Período", "Dias", "Valor"];
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
        String(line.veiculoNome || "").slice(0, 22),
        line.placa || "—",
        String(line.servico || svc().serviceLabel(line)).slice(0, 18),
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
        const align = i >= 6 ? { align: "right" } : undefined;
        const tx = i >= 6 ? x + cols[i].w - 4 : x + 4;
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
        subject: compose.client?.subject || currentSubject,
        meta: currentMeta,
        lines: previewLines,
        client: compose.client,
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

  function shareWhatsapp() {
    const doc = previewDoc;
    if (!doc) return;
    const digits = String(currentMeta?.whatsapp || "").replace(/\D/g, "");
    const num = String(doc.numero || 0).padStart(6, "0");
    const text = `AMPLIGUARD — Cobrança ${num}\nCliente: ${doc.parceiroNome}\nVeículos: ${doc.veiculos}\nPeríodo: ${doc.periodoLabel}\nTotal: ${money(doc.total)}\nSituação: em aberto (remoção do pátio não quita o valor).`;
    const url = digits
      ? `https://wa.me/55${digits.replace(/^55/, "")}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener");
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

  function hideLines(ids) {
    const list = svc().dedupeReceivableIds(ids);
    if (!list.length) {
      alert("Selecione pelo menos um registro para apagar.");
      return;
    }
    const ok = window.confirm(
      list.length === 1
        ? "Apagar este registro da lista de Cobrança?\nO título no Financeiro não será alterado."
        : `Apagar ${list.length} registros da lista de Cobrança?\nOs títulos no Financeiro não serão alterados.`
    );
    if (!ok) return;
    svc().hideReceivableIds(list);
    list.forEach((id) => selectedIds.delete(id));
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
    const nav = e.target.closest("[data-cob-nav]");
    if (nav) {
      const dest = nav.getAttribute("data-cob-nav");
      if (dest === "nova" || dest === "conjunto") {
        openCompose(dest === "nova" ? "Nova cobrança" : "Faturar em conjunto", [], "financeiro");
        return;
      }
      preserveOnMount = true;
      chargeRows = [];
      chargesLoaded = false;
      chargeSearch = "";
      screen = dest === "recebidos" ? "recebidos" : "pendentes";
      render();
      return;
    }
    const openCharge = e.target.closest("[data-cob-open-charge]");
    if (openCharge) {
      void openDetalhe(openCharge.getAttribute("data-cob-open-charge"));
      return;
    }
    if (e.target.closest("[data-cob-compose-go]")) {
      goComposePreview();
      return;
    }
    if (e.target.closest("[data-cob-confirm]")) {
      void confirmCharge();
      return;
    }
    const back = e.target.closest("[data-cob-back]");
    if (back) {
      const dest = back.getAttribute("data-cob-back");
      if (dest === "list") {
        preserveOnMount = false;
        screen = "list";
      } else if (screen === "preview") {
        screen = currentSubject?.id ? "partner" : "compose";
      } else {
        screen = "partner";
      }
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
    const hideOne = e.target.closest("[data-cob-hide]");
    if (hideOne) {
      e.preventDefault();
      e.stopPropagation();
      hideLines([hideOne.getAttribute("data-cob-hide")]);
      return;
    }
    if (e.target.closest("[data-cob-hide-sel]")) {
      hideLines([...selectedIds]);
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
    if (e.target.closest("[data-cob-whatsapp]")) {
      shareWhatsapp();
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
    const pick = e.target.closest("[data-cob-pick]");
    if (pick) {
      const id = pick.getAttribute("data-cob-pick");
      if (pick.checked) compose.selected.add(id);
      else compose.selected.delete(id);
      const chosen = svc().billableLines().filter((l) => compose.selected.has(l.receivableId));
      const btn = document.getElementById("cobComposeGo");
      if (btn) {
        btn.disabled = !chosen.length;
        const saldo = chosen.reduce((s, l) => s + svc().saldoAposAbatimento(l.valor, l.abatimento), 0);
        btn.textContent = `Gerar cobrança (${chosen.length}) · ${money(saldo)}`;
      }
      return;
    }
    const chk = e.target.closest("[data-cob-check]");
    if (chk) {
      const id = chk.getAttribute("data-cob-check");
      if (chk.checked) selectedIds.add(id);
      else selectedIds.delete(id);
      const gerar = document.querySelector("#cobrancaRoot [data-cob-gerar]");
      if (gerar) {
        const chosen = svc()
          .openLines()
          .filter((l) => svc().lineMatchesPartner(l, currentSubject) && selectedIds.has(l.receivableId));
        gerar.disabled = !chosen.length;
        gerar.textContent = chosen.length
          ? `Faturar em conjunto (${chosen.length}) · ${money(svc().summarizeLines(chosen).total)}`
          : "Faturar em conjunto";
      }
      return;
    }
    const tr = e.target.closest("tr[data-cob-line]");
    if (tr && !e.target.closest("input") && !e.target.closest("button")) {
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
      return;
    }
    if (e.target.name === "cobClienteModo" || e.target.id === "cobClienteBusca" || e.target.id === "cobClienteSelect") {
      captureCompose();
      const pos = e.target.selectionStart;
      const id = e.target.id;
      render();
      if (id === "cobClienteBusca") {
        const again = document.getElementById("cobClienteBusca");
        if (again) {
          again.focus();
          if (pos != null) again.setSelectionRange(pos, pos);
        }
      }
      return;
    }
    if (e.target.id === "cobAvulsoNome" || e.target.id === "cobAvulsoDoc" || e.target.id === "cobAvulsoContato" || e.target.id === "cobAvulsoSalvar") {
      captureCompose();
      return;
    }
    if (e.target.id === "cobChargeSearch") {
      chargeSearch = e.target.value;
      const pos = e.target.selectionStart;
      render();
      const again = document.getElementById("cobChargeSearch");
      if (again) {
        again.focus();
        if (pos != null) again.setSelectionRange(pos, pos);
      }
    }
  }

  function captureCompose() {
    const modo = document.querySelector('#cobrancaRoot input[name="cobClienteModo"]:checked');
    if (modo) compose.modo = modo.value === "avulso" ? "avulso" : "cadastrado";
    const busca = document.getElementById("cobClienteBusca");
    if (busca) compose.busca = busca.value;
    const sel = document.getElementById("cobClienteSelect");
    if (sel) compose.clientKey = sel.value;
    const nome = document.getElementById("cobAvulsoNome");
    if (nome) compose.nome = nome.value;
    const doc = document.getElementById("cobAvulsoDoc");
    if (doc) compose.documento = doc.value;
    const contato = document.getElementById("cobAvulsoContato");
    if (contato) compose.contato = contato.value;
    const salvar = document.getElementById("cobAvulsoSalvar");
    if (salvar) compose.salvar = !!salvar.checked;
    const venc = document.getElementById("cobVencimento");
    if (venc) compose.vencimento = venc.value;
  }

  function clientFromCompose() {
    if (compose.modo === "avulso") {
      const nome = String(compose.nome || "").trim();
      return {
        modo: "avulso",
        nome,
        documento: String(compose.documento || "").trim(),
        contato: String(compose.contato || "").trim(),
        tipoLabel: "Cliente avulso",
        salvar: !!compose.salvar,
        origem: compose.origem || "financeiro",
        vencimento: compose.vencimento || "",
        subject: { kind: "avulso", id: null },
      };
    }
    const found = svc().clientCatalog().find((c) => c.key === compose.clientKey);
    if (!found) return null;
    return {
      modo: "cadastrado",
      nome: found.nome,
      documento: found.documento || "",
      contato: found.contato || "",
      tipoLabel: found.tipoLabel,
      salvar: false,
      origem: compose.origem || "financeiro",
      vencimento: compose.vencimento || "",
      subject: { kind: found.kind, id: found.id },
    };
  }

  function renderCompose(el) {
    const catalog = svc().clientCatalog().filter((c) => {
      const q = String(compose.busca || "").trim().toLowerCase();
      if (!q) return true;
      return `${c.nome} ${c.documento} ${c.tipoLabel}`.toLowerCase().includes(q);
    });
    const options = catalog
      .map(
        (c) =>
          `<option value="${esc(c.key)}"${c.key === compose.clientKey ? " selected" : ""}>${esc(c.nome)} · ${esc(c.tipoLabel)}</option>`
      )
      .join("");
    const lines = svc().billableLines();
    const chosen = lines.filter((l) => compose.selected.has(l.receivableId));
    const total = chosen.reduce((s, l) => s + svc().saldoAposAbatimento(l.valor, l.abatimento), 0);
    const rows = lines.length
      ? lines
          .map((line) => {
            const checked = compose.selected.has(line.receivableId) ? "checked" : "";
            return `<tr>
              <td data-label="Sel."><input type="checkbox" data-cob-pick="${esc(line.receivableId)}" ${checked} /></td>
              <td data-label="Placa">${esc(line.placa || "—")}</td>
              <td data-label="Serviço">${esc(line.servico || svc().serviceLabel(line))}</td>
              <td data-label="Período">${esc(svc().formatPeriodLabel(line.entrada, line.saida || svc().todayYmd()))}</td>
              <td class="num" data-label="Valor">${esc(money(line.valor))}</td>
              <td class="num" data-label="Abatido">${esc(money(line.abatimento || 0))}</td>
              <td class="num" data-label="Saldo">${esc(money(svc().saldoAposAbatimento(line.valor, line.abatimento)))}</td>
            </tr>`;
          })
          .join("")
      : `<tr><td colspan="7">Nenhum veículo com valor pendente disponível para faturar.</td></tr>`;
    const avulso = compose.modo === "avulso";
    el.innerHTML = `
      <div class="cob-toolbar">
        <div>
          <button type="button" class="cob-btn secondary" data-cob-back="list">← Voltar</button>
          <h2 style="margin-top:10px">${esc(compose.titulo || "Faturar em conjunto")}</h2>
          <p class="cob-sub">Escolha o cliente e os veículos. Os valores originais não são recalculados.</p>
        </div>
      </div>
      <div class="cob-choice">
        <label><input type="radio" name="cobClienteModo" value="cadastrado" ${avulso ? "" : "checked"} /> Cliente cadastrado</label>
        <label><input type="radio" name="cobClienteModo" value="avulso" ${avulso ? "checked" : ""} /> Informar cliente na hora</label>
      </div>
      ${
        avulso
          ? `<div class="cob-form">
              <label>Nome ou razão social<input id="cobAvulsoNome" type="text" value="${esc(compose.nome)}" autocomplete="name" /></label>
              <label>CPF ou CNPJ<input id="cobAvulsoDoc" type="text" value="${esc(compose.documento)}" inputmode="numeric" /></label>
              <label>Contato<input id="cobAvulsoContato" type="text" value="${esc(compose.contato)}" /></label>
              <label class="cob-checkline"><input id="cobAvulsoSalvar" type="checkbox" ${compose.salvar ? "checked" : ""} /> Salvar este cliente para futuras cobranças</label>
            </div>`
          : `<div class="cob-form">
              <label>Buscar cliente<input id="cobClienteBusca" type="search" value="${esc(compose.busca)}" placeholder="Nome, documento ou tipo" /></label>
              <label>Cliente<select id="cobClienteSelect"><option value="">Selecione</option>${options}</select></label>
            </div>`
      }
      <div class="cob-table-wrap">
        <table class="cob-table">
          <thead><tr><th></th><th>Placa</th><th>Serviço</th><th>Período</th><th class="num">Valor</th><th class="num">Abatido</th><th class="num">Saldo</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="cob-form">
        <label>Vencimento da cobrança<input id="cobVencimento" type="date" value="${esc(compose.vencimento || "")}" /></label>
      </div>
      <div class="cob-actions-row">
        <button type="button" class="cob-btn" id="cobComposeGo" data-cob-compose-go="1" ${chosen.length ? "" : "disabled"}>Gerar cobrança (${chosen.length}) · ${esc(money(total))}</button>
      </div>`;
  }

  function goComposePreview() {
    captureCompose();
    const client = clientFromCompose();
    if (!client?.nome) {
      alert(compose.modo === "avulso" ? "Informe o nome ou a razão social." : "Selecione um cliente cadastrado.");
      return;
    }
    if (client.salvar && !client.documento) {
      alert("Informe o CPF ou CNPJ para salvar o cliente.");
      return;
    }
    const lines = svc()
      .billableLines()
      .filter((l) => compose.selected.has(l.receivableId))
      .map((l) => {
        const original = Number(l.valor || 0);
        const abatimento = Number(l.abatimento || 0);
        return {
          ...l,
          valorOriginal: original,
          abatimento,
          valor: svc().saldoAposAbatimento(original, abatimento),
        };
      });
    if (!lines.length) {
      alert("Selecione pelo menos um veículo com valor pendente.");
      return;
    }
    compose.client = client;
    currentSubject = client.subject;
    currentMeta = { nome: client.nome, tipoLabel: client.tipoLabel, whatsapp: client.contato, id: client.subject?.id || null };
    previewLines = lines;
    previewDoc = buildPreviewDoc(lines, { numero: 0 });
    preserveOnMount = true;
    screen = "preview";
    render();
  }

  async function confirmCharge() {
    try {
      const doc = await persistIfNeeded();
      if (compose.client?.salvar) {
        try {
          await svc().saveFinanceClient({
            supabase: supabase(),
            uid: uid(),
            nome: compose.client.nome,
            documento: compose.client.documento,
            contato: compose.client.contato,
          });
        } catch (err) {
          alert(err.message || "A cobrança foi gerada, mas o cliente não foi salvo.");
        }
        compose.client.salvar = false;
      }
      await svc().refreshBlockedReceivables(uid(), supabase());
      await openDetalhe(doc.cobrancaId);
    } catch (e) {
      alert(e.message || "Não foi possível confirmar a cobrança.");
    }
  }

  async function openDetalhe(id) {
    const loaded = await svc().loadCharges(uid(), supabase());
    chargesMissing = !!loaded.missingTable;
    chargeRows = loaded.rows || [];
    currentCharge = chargeRows.find((row) => String(row.id) === String(id)) || currentCharge;
    if (!currentCharge) {
      alert("Cobrança gravada, mas não foi possível reabri-la agora.");
      return;
    }
    const items = await svc().loadHistoryItems(id, supabase());
    previewLines = svc().snapshotLinesFromItems(items);
    currentMeta = {
      nome: currentCharge.parceiro_nome,
      tipoLabel: currentCharge.parceiro_tipo,
      whatsapp: currentCharge.cliente_contato || "",
    };
    previewDoc = {
      numero: currentCharge.numero_cobranca,
      parceiroNome: currentCharge.parceiro_nome,
      parceiroTipo: currentCharge.parceiro_tipo,
      dataEmissao: svc().formatDate(currentCharge.data_geracao || currentCharge.created_at),
      periodoLabel: svc().formatPeriodLabel(currentCharge.periodo_inicio, currentCharge.periodo_fim),
      veiculos: currentCharge.quantidade_veiculos,
      diarias: previewLines.reduce((s, l) => s + Number(l.diarias || 0), 0),
      outros: previewLines.reduce((s, l) => s + Number(l.outros || 0), 0),
      total: Number(currentCharge.valor_total || 0),
      geradoEm: currentCharge.data_geracao ? new Date(currentCharge.data_geracao).toLocaleString("pt-BR") : "",
      lines: previewLines,
      cobrancaId: currentCharge.id,
    };
    preserveOnMount = true;
    screen = "detalhe";
    render();
  }

  function renderDetalhe(el) {
    const row = currentCharge;
    if (!row) {
      el.innerHTML = `<p class="cob-empty">Cobrança indisponível.</p>`;
      return;
    }
    const ident = row.identificador || `FAT-${String(row.numero_cobranca || 0).padStart(6, "0")}`;
    const recebido = Number(row.valor_recebido || 0);
    const total = Number(row.valor_total || 0);
    const snap = svc().paymentSnapshot(total, recebido);
    const status = String(row.status || "PENDENTE").toUpperCase() === "HISTORICO" ? "HISTORICO" : snap.status;
    const podePagar = status === "PENDENTE" || status === "PARCIAL";
    const rows = (previewLines || [])
      .map(
        (line) => `<tr>
          <td data-label="Placa">${esc(line.placa || "—")}</td>
          <td data-label="Serviço">${esc(line.servico || svc().serviceLabel(line))}</td>
          <td data-label="Período">${esc(svc().formatPeriodLabel(line.entrada, line.saida || svc().todayYmd()))}</td>
          <td class="num" data-label="Valor">${esc(money(line.valor))}</td>
        </tr>`
      )
      .join("");
    el.innerHTML = `
      <div class="cob-toolbar">
        <div>
          <button type="button" class="cob-btn secondary" data-cob-nav="${status === "PAGO" || status === "HISTORICO" ? "recebidos" : "pendentes"}">← Voltar</button>
          <h2 style="margin-top:10px">${esc(ident)}</h2>
          <p class="cob-sub">${esc(row.parceiro_nome || "Cliente")} · <span class="cob-tag">${esc(svc().chargeStatusLabel(status))}</span></p>
          <p class="cob-sub">Demonstrativo de cobrança. Não é nota fiscal. O saldo é único; a composição por veículo permanece abaixo.</p>
        </div>
        <div class="cob-actions-row">
          <button type="button" class="cob-btn" data-cob-pdf="1">Baixar PDF</button>
          <button type="button" class="cob-btn secondary" data-cob-print="1">Imprimir</button>
          <button type="button" class="cob-btn secondary" data-cob-whatsapp="1">Compartilhar</button>
        </div>
      </div>
      <div class="cob-kpis">
        <div class="cob-kpi"><span>Total</span><strong>${esc(money(total))}</strong></div>
        <div class="cob-kpi"><span>Recebido</span><strong>${esc(money(recebido))}</strong></div>
        <div class="cob-kpi"><span>Saldo</span><strong>${esc(money(snap.saldo))}</strong></div>
        <div class="cob-kpi"><span>Veículos</span><strong>${esc(row.quantidade_veiculos || previewLines.length)}</strong></div>
      </div>
      <div class="cob-table-wrap">
        <table class="cob-table">
          <thead><tr><th>Placa</th><th>Serviço</th><th>Período</th><th class="num">Valor</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="4">Sem itens.</td></tr>`}</tbody>
        </table>
      </div>
      <p class="cob-preview-total"><strong>TOTAL ${esc(money(total))}</strong></p>
      ${
        podePagar
          ? `<form id="cobPayForm" class="cob-form">
              <p class="cob-sub">Registre o PIX. Pagamento parcial mantém o saldo. A quitação dá baixa em todos os veículos de uma vez, sem alterar o valor original de cada um.</p>
              <label>Valor recebido<input id="cobPayValor" type="number" min="0.01" step="0.01" value="${esc(snap.saldo.toFixed(2))}" /></label>
              <label>Forma<select id="cobPayForma"><option value="PIX">PIX</option><option value="DINHEIRO">Dinheiro</option><option value="TRANSFERENCIA">Transferência</option></select></label>
              <label>Data<input id="cobPayData" type="date" value="${esc(svc().todayYmd())}" /></label>
              <button type="submit" class="cob-btn">Confirmar recebimento</button>
            </form>`
          : `<p class="notice">Esta cobrança está ${esc(svc().chargeStatusLabel(status).toLowerCase())}.</p>`
      }`;
    document.getElementById("cobPayForm")?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      void submitPayment();
    });
  }

  async function submitPayment() {
    const amount = Number(document.getElementById("cobPayValor")?.value || 0);
    const forma = document.getElementById("cobPayForma")?.value || "PIX";
    const dataMovimento = document.getElementById("cobPayData")?.value || svc().todayYmd();
    try {
      const res = await svc().registerChargePayment({
        supabase: supabase(),
        uid: uid(),
        charge: currentCharge,
        amount,
        forma,
        dataMovimento,
      });
      currentCharge = res.charge;
      const snap = res.snap;
      alert(snap.status === "PAGO" ? "Pagamento confirmado. Todos os veículos desta fatura foram quitados." : "Pagamento parcial registrado. O saldo restante continua em aberto.");
      await openDetalhe(currentCharge.id);
    } catch (e) {
      alert(e.message || "Não foi possível registrar o pagamento.");
    }
  }

  async function renderCharges(el) {
    const bucket = screen === "recebidos" ? "recebidos" : "pendentes";
    const title = bucket === "recebidos" ? "Pagamentos recebidos" : "Cobranças pendentes";
    if (!chargesLoaded) {
      el.innerHTML = `<p class="cob-sub">Carregando…</p>`;
      const loaded = await svc().loadCharges(uid(), supabase());
      chargesLoaded = true;
      chargesMissing = !!loaded.missingTable;
      chargeRows = loaded.rows || [];
      if (screen !== "pendentes" && screen !== "recebidos") return;
    }
    const rows = svc().filterCharges(chargeRows, { bucket, search: chargeSearch });
    const body = chargesMissing
      ? `<p class="cob-empty">Histórico indisponível até aplicar supabase/cobrancas.sql.</p>`
      : rows.length
        ? `<div class="cob-table-wrap"><table class="cob-table"><thead><tr>
            <th>Fatura</th><th>Cliente</th><th class="num">Veículos</th><th class="num">Total</th><th class="num">Saldo</th><th>Status</th><th></th>
          </tr></thead><tbody>${rows
            .map((row) => {
              const ident = row.identificador || `FAT-${String(row.numero_cobranca || 0).padStart(6, "0")}`;
              const snap = svc().paymentSnapshot(row.valor_total, row.valor_recebido || 0);
              const st = String(row.status || "HISTORICO").toUpperCase();
              return `<tr>
                <td data-label="Fatura">${esc(ident)}</td>
                <td data-label="Cliente">${esc(row.parceiro_nome || "—")}</td>
                <td class="num" data-label="Veículos">${esc(row.quantidade_veiculos || 0)}</td>
                <td class="num" data-label="Total">${esc(money(row.valor_total))}</td>
                <td class="num" data-label="Saldo">${esc(money(st === "HISTORICO" ? 0 : snap.saldo))}</td>
                <td data-label="Status">${esc(svc().chargeStatusLabel(st))}</td>
                <td data-label="Ações"><button type="button" class="cob-btn secondary" data-cob-open-charge="${esc(row.id)}">Abrir</button></td>
              </tr>`;
            })
            .join("")}</tbody></table></div>`
        : `<p class="cob-empty">Nenhuma cobrança nesta lista.</p>`;
    el.innerHTML = `
      <div class="cob-toolbar">
        <div>
          <button type="button" class="cob-btn secondary" data-cob-back="list">← Voltar</button>
          <h2 style="margin-top:10px">${esc(title)}</h2>
          <p class="cob-sub">Busque por cliente, placa ou número da fatura.</p>
        </div>
      </div>
      <input class="cob-search" id="cobChargeSearch" type="search" value="${esc(chargeSearch)}" placeholder="Cliente, placa ou fatura" />
      ${body}`;
  }

  function openCompose(titulo, ids, origem) {
    preserveOnMount = true;
    compose = emptyCompose();
    compose.titulo = titulo;
    compose.origem = origem || "financeiro";
    presetIds = new Set((ids || []).map(String));
    compose.selected = new Set(presetIds);
    screen = "compose";
    if (typeof global.openMainView === "function") global.openMainView("financeiro");
    if (typeof global.openFinanceSubview === "function") global.openFinanceSubview("cobrancas", { skipRefresh: true });
    else render();
  }

  function offerAfterExit(vehicleId, message) {
    const lines = svc().billableLines().filter((l) => String(l.vehicleId) === String(vehicleId));
    if (!lines.length) return false;
    const total = svc().summarizeLines(lines).total;
    const placas = lines.map((l) => l.placa || "sem placa").join(", ");
    document.getElementById("cobExitModal")?.remove();
    const bd = document.createElement("div");
    bd.id = "cobExitModal";
    bd.className = "cob-modal-backdrop";
    bd.innerHTML = `<div class="cob-modal" role="dialog">
      <h3>Saída registrada</h3>
      <p>${esc(message || "O veículo saiu do pátio. O pagamento não é obrigatório agora.")}</p>
      <p><strong>${esc(placas)}</strong> · ${esc(money(total))}</p>
      <div class="cob-actions-row">
        <button type="button" class="cob-btn" data-cob-exit="agora">Cobrar agora</button>
        <button type="button" class="cob-btn secondary" data-cob-exit="pendente">Deixar pendente</button>
        <button type="button" class="cob-btn secondary" data-cob-exit="depois">Incluir em conjunto depois</button>
      </div>
    </div>`;
    bd.addEventListener("click", (ev) => {
      const act = ev.target.closest("[data-cob-exit]")?.getAttribute("data-cob-exit");
      if (ev.target === bd) {
        bd.remove();
        return;
      }
      if (!act) return;
      bd.remove();
      if (act === "agora") openCompose("Nova cobrança", lines.map((l) => l.receivableId), "saida");
    });
    document.body.appendChild(bd);
    return true;
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
    if (!preserveOnMount) screen = "list";
    ensureDataThen(async () => {
      try {
        await svc().refreshBlockedReceivables(uid(), supabase());
      } catch (_e) {
        /* sem a coluna status a lista segue como antes */
      }
      if (presetIds) {
        const live = new Set(svc().billableLines().map((l) => l.receivableId));
        const wanted = [...presetIds].map(String);
        compose.selected = new Set(wanted.filter((id) => live.has(id)));
        presetIds = null;
        screen = "compose";
        preserveOnMount = true;
        if (wanted.length && compose.selected.size < wanted.length) {
          alert("Algum registro já está em cobrança ativa ou não está pendente e ficou de fora.");
        }
      }
      render();
    });
  }

  global.cobrancaUi = {
    bindOnce,
    mount,
    render,
    openConjunto(ids) {
      openCompose("Gerar cobrança", ids, "financeiro");
    },
    showCharges(bucket) {
      preserveOnMount = true;
      chargesLoaded = false;
      chargeRows = [];
      chargeSearch = "";
      screen = bucket === "recebidos" ? "recebidos" : "pendentes";
      if (root()) render();
    },
    setChargeSearch(text) {
      chargeSearch = String(text || "");
      if (screen === "pendentes" || screen === "recebidos") render();
    },
    offerAfterExit,
  };
})(typeof window !== "undefined" ? window : globalThis);

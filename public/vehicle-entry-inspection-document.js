/**
 * Impressão e PDF da Vistoria Eletrônica — somente apresentação (read-only).
 * Não altera vistoria, banco ou fluxos existentes.
 */
(function vehicleEntryInspectionDocumentModule(global) {
  "use strict";

  const LOGO_SRC = "/assets/ampliguard-header.png?v=3";
  const PHOTO_SIZE = "4cm";

  let _stylesInjected = false;

  function esc(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fmtDateTime(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    } catch (e) {
      return String(iso);
    }
  }

  function fmtDateOnly(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString("pt-BR");
    } catch (e) {
      return String(iso);
    }
  }

  function classificationLabel(id) {
    const map = {
      BOM: "BOM",
      REGULAR: "REGULAR",
      DANIFICADO: "DANIFICADO",
      SEM_TESTE: "SEM TESTE",
      INEXISTENTE: "INEXISTENTE",
    };
    return map[id] || id || "—";
  }

  function pdfFileName(vehicle, inspection) {
    const placa = String(vehicle?.placa || "")
      .replace(/\W+/g, "")
      .toUpperCase();
    const d = inspection?.completed_at ? new Date(inspection.completed_at) : new Date();
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const datePart = `${dd}-${mm}-${yyyy}`;
    if (placa) return `Vistoria_${placa}_${datePart}.pdf`;
    const num = inspection?.inspection_number || inspection?.id || "doc";
    return `Vistoria_${num}_${datePart}.pdf`;
  }

  function injectStylesOnce() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    if (document.getElementById("veiDocumentStyles")) return;
    const style = document.createElement("style");
    style.id = "veiDocumentStyles";
    style.textContent = `
      .vei-doc { color: #111; font-family: Arial, Helvetica, sans-serif; font-size: 10pt; line-height: 1.35; }
      .vei-doc-header { text-align: center; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 2px solid #1e293b; }
      .vei-doc-header img.vei-doc-logo { max-width: 280px; max-height: 72px; width: auto; height: auto; object-fit: contain; margin: 0 auto 8px; display: block; }
      .vei-doc-title { margin: 0; font-size: 16pt; letter-spacing: 0.06em; text-transform: uppercase; color: #0f172a; }
      .vei-doc-subtitle { margin: 4px 0 0; font-size: 10pt; color: #475569; }
      .vei-doc-section { margin: 16px 0 18px; break-inside: avoid-page; page-break-inside: avoid; }
      .vei-doc-section h3 { margin: 0 0 8px; font-size: 11pt; text-transform: uppercase; letter-spacing: 0.05em; color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
      .vei-doc-section h4 { margin: 12px 0 6px; font-size: 10pt; text-transform: uppercase; color: #334155; }
      .vei-doc-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 14px; margin-bottom: 4px; }
      .vei-doc-grid .vei-doc-field span { display: block; font-size: 8pt; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; }
      .vei-doc-grid .vei-doc-field strong { font-size: 10pt; color: #0f172a; word-break: break-word; }
      .vei-doc-table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-top: 6px; }
      .vei-doc-table th, .vei-doc-table td { border: 1px solid #cbd5e1; padding: 5px 7px; vertical-align: top; }
      .vei-doc-table th { background: #f1f5f9; text-align: left; font-weight: 700; }
      .vei-doc-table td.cls { font-weight: 700; white-space: nowrap; }
      .vei-doc-damage { border: 1px solid #fecaca; background: #fff7f7; border-radius: 6px; padding: 8px 10px; margin-bottom: 8px; break-inside: avoid; page-break-inside: avoid; }
      .vei-doc-damage strong { display: block; margin-bottom: 4px; }
      .vei-doc-notes { white-space: pre-wrap; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; }
      .vei-doc-diagram { text-align: center; margin: 8px 0; }
      .vei-doc-diagram svg { max-width: 100%; height: auto; }
      .vei-doc-photo-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px 10px; margin-top: 8px; }
      .vei-doc-photo-cell { break-inside: avoid; page-break-inside: avoid; text-align: center; }
      .vei-doc-photo-label { margin: 0 0 4px; font-size: 8pt; font-weight: 700; line-height: 1.2; min-height: 2.4em; display: flex; align-items: flex-end; justify-content: center; }
      .vei-doc-photo-frame { width: ${PHOTO_SIZE}; height: ${PHOTO_SIZE}; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 4px; overflow: hidden; background: #f8fafc; display: flex; align-items: center; justify-content: center; }
      .vei-doc-photo-frame img { max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain; display: block; }
      .vei-doc-photo-empty { font-size: 8pt; color: #94a3b8; padding: 8px; }
      .vei-doc-withdrawal { margin-top: 20px; padding-top: 14px; border-top: 2px solid #1e293b; break-inside: avoid-page; page-break-inside: avoid; }
      .vei-doc-withdrawal p { margin: 0 0 14px; text-align: justify; }
      .vei-doc-field-line { margin: 12px 0; }
      .vei-doc-field-line label { display: block; font-weight: 700; margin-bottom: 6px; }
      .vei-doc-line { border-bottom: 1px solid #334155; min-height: 28px; }
      .vei-doc-sign-line { border-bottom: 1px solid #334155; min-height: 48px; margin-top: 8px; }
      .vei-doc-page-hdr { display: none; }
      @media print {
        @page { size: A4 portrait; margin: 12mm; }
        body * { visibility: hidden !important; }
        .vei-print-root, .vei-print-root * { visibility: visible !important; }
        .vei-print-root {
          position: absolute; left: 0; top: 0; width: 100%;
          padding: 0; background: #fff !important; color: #111 !important;
        }
        .vei-no-print { display: none !important; }
        .vei-modal-backdrop { position: static !important; background: #fff !important; padding: 0 !important; overflow: visible !important; }
        .vei-modal { box-shadow: none !important; border: none !important; max-width: none !important; margin: 0 !important; }
        .vei-modal-head { display: none !important; }
        .vei-modal-body { padding: 0 !important; }
        .vei-doc-photo-grid { grid-template-columns: repeat(4, 1fr); }
        .vei-doc-section { break-inside: auto; page-break-inside: auto; }
        .vei-doc-photo-cell, .vei-doc-damage, .vei-doc-withdrawal { break-inside: avoid; page-break-inside: avoid; }
      }
      @media screen and (max-width: 720px) {
        .vei-doc-photo-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
    `;
    document.head.appendChild(style);
  }

  function partnerName(ctx, id) {
    if (typeof ctx?.partnerName === "function") return ctx.partnerName(ctx, id);
    const p = (ctx?.partners || []).find((x) => x.id === id);
    return p?.nome || "—";
  }

  function metaField(label, value) {
    const v = value == null || value === "" ? "—" : value;
    return `<div class="vei-doc-field"><span>${esc(label)}</span><strong>${esc(v)}</strong></div>`;
  }

  function buildChecklistSection(helpers, draft) {
    const CHECKLIST = helpers.CHECKLIST || [];
    let html = "";
    let lastCat = "";
    CHECKLIST.forEach((it) => {
      if (it.category !== lastCat) {
        if (lastCat) html += "</tbody></table>";
        lastCat = it.category;
        html += `<h4>${esc(it.category)}</h4><table class="vei-doc-table"><thead><tr><th>Item</th><th>Classificação</th></tr></thead><tbody>`;
      }
      const cls = classificationLabel(draft.classifications[it.key]);
      html += `<tr><td>${esc(it.label)}</td><td class="cls">${esc(cls)}</td></tr>`;
    });
    if (lastCat) html += "</tbody></table>";
    return html;
  }

  function buildDamagesSection(draft, photosByDamage) {
    if (!draft.damages?.length) {
      return '<p style="margin:0;color:#64748b">Nenhuma avaria registrada no checklist.</p>';
    }
    return draft.damages
      .map((d, idx) => {
        const linked = photosByDamage[d.id] || photosByDamage[idx] || [];
        const photoHtml = linked.length
          ? `<div class="vei-doc-photo-grid">${linked.map((p) => renderPhotoCell(p.label, p.url)).join("")}</div>`
          : d.photoPreview
            ? `<div class="vei-doc-photo-grid">${renderPhotoCell(d.area_label || "Avaria", d.photoPreview)}</div>`
            : "";
        return (
          `<div class="vei-doc-damage">` +
          `<strong>${esc(d.area_label || d.item_key || "Área")} — ${esc(d.damage_type || "—")}</strong>` +
          (d.severity ? `<div><em>Gravidade:</em> ${esc(d.severity)}</div>` : "") +
          (d.description ? `<div><em>Descrição:</em> ${esc(d.description)}</div>` : "") +
          (d.notes ? `<div><em>Observação:</em> ${esc(d.notes)}</div>` : "") +
          photoHtml +
          `</div>`
        );
      })
      .join("");
  }

  function renderPhotoCell(label, url) {
    const img = url
      ? `<img src="${esc(url)}" alt="${esc(label)}" crossorigin="anonymous"/>`
      : `<span class="vei-doc-photo-empty">Sem imagem</span>`;
    return (
      `<div class="vei-doc-photo-cell">` +
      `<p class="vei-doc-photo-label">${esc(label)}</p>` +
      `<div class="vei-doc-photo-frame">${img}</div>` +
      `</div>`
    );
  }

  function organizePhotos(photos, damages) {
    const standardOrder = global.vehicleEntryInspectionPhotosMobile?.STANDARD_SLOTS || [];
    const standardKeys = new Set(standardOrder.map((s) => s.key));
    const labelByKey = {};
    standardOrder.forEach((s) => {
      labelByKey[s.key] = s.label;
    });

    const standard = [];
    const extraDamage = [];
    const checklistDamage = [];
    const other = [];

    (photos || []).forEach((p) => {
      const entry = {
        url: p.url || "",
        label: p.photo_label || p.file_name || "Foto",
        type: p.photo_type || "",
        damage_id: p.damage_id || null,
      };
      if (entry.type === "avaria_extra") {
        extraDamage.push(entry);
      } else if (entry.damage_id) {
        checklistDamage.push(entry);
      } else if (entry.type && standardKeys.has(entry.type)) {
        standard.push({ ...entry, label: labelByKey[entry.type] || entry.label, order: standardOrder.findIndex((s) => s.key === entry.type) });
      } else if (entry.type && labelByKey[entry.type]) {
        standard.push({ ...entry, label: labelByKey[entry.type], order: standardOrder.findIndex((s) => s.key === entry.type) });
      } else {
        other.push(entry);
      }
    });

    standard.sort((a, b) => (a.order < 0 ? 999 : a.order) - (b.order < 0 ? 999 : b.order));

    const photosByDamage = {};
    checklistDamage.forEach((p) => {
      const key = p.damage_id;
      if (!photosByDamage[key]) photosByDamage[key] = [];
      photosByDamage[key].push(p);
    });

    (damages || []).forEach((d, idx) => {
      if (!photosByDamage[d.id] && d.photoPreview) {
        photosByDamage[d.id || idx] = [{ url: d.photoPreview, label: d.area_label || "Avaria" }];
      }
    });

    return { standard, extraDamage, other, photosByDamage };
  }

  function buildPhotoGrid(cells) {
    if (!cells.length) return "";
    return `<div class="vei-doc-photo-grid">${cells.map((c) => renderPhotoCell(c.label, c.url)).join("")}</div>`;
  }

  function buildPrintHtml(options) {
    injectStylesOnce();
    const { vehicle, ctx, inspection, detail, draft, helpers } = options;
    const h = helpers || {};
    const fmt = h.fmtDateTime || fmtDateTime;
    const rDiagram = h.renderDiagram;

    const titleNum = inspection?.inspection_number ? ` nº ${inspection.inspection_number}` : "";
    const { standard, extraDamage, other, photosByDamage } = organizePhotos(detail?.photos, detail?.damages);

    const rpfNome =
      vehicle?.responsavel_financeiro_nome || partnerName(ctx, vehicle?.responsavel_financeiro_id);
    const leiloeiro = partnerName(ctx, vehicle?.leiloeiro_id);

    let vehicleGrid =
      metaField("Placa", vehicle?.placa) +
      metaField("Marca", vehicle?.marca) +
      metaField("Modelo", vehicle?.modelo) +
      metaField("Ano", vehicle?.ano) +
      metaField("Cor", vehicle?.cor) +
      metaField("Chassi", vehicle?.chassi) +
      metaField("Data de entrada", fmt(vehicle?.data_entrada)) +
      metaField("Data de saída", vehicle?.data_saida ? fmt(vehicle?.data_saida) : "—") +
      metaField("RPV (localizador)", partnerName(ctx, vehicle?.localizador_id)) +
      metaField("RPF (responsável financeiro)", rpfNome) +
      metaField("Leiloeiro", leiloeiro !== "—" ? leiloeiro : null);

    if (vehicle?.vistoria_km) vehicleGrid += metaField("Quilometragem (cadastro LV)", vehicle.vistoria_km);
    if (vehicle?.observacoes) vehicleGrid += metaField("Observações do veículo", vehicle.observacoes);

    const inspGrid =
      metaField("Nº da vistoria", inspection?.inspection_number) +
      metaField("ID da vistoria", inspection?.id) +
      metaField("Data da vistoria", fmt(inspection?.completed_at)) +
      metaField("Responsável pela vistoria", inspection?.completed_by_name) +
      metaField("Tipo", inspection?.inspection_type || "ENTRADA") +
      metaField("Status", "CONCLUÍDA");

    const checklistHtml = buildChecklistSection(h, draft);
    const damagesHtml = buildDamagesSection(draft, photosByDamage);

    const diagramHtml =
      draft.diagramMarkers?.length && typeof rDiagram === "function"
        ? `<div class="vei-doc-diagram">${rDiagram(draft, true)}</div>`
        : "";

    const standardPhotosHtml = standard.length ? buildPhotoGrid(standard) : "";
    const extraPhotosHtml = extraDamage.length
      ? buildPhotoGrid(extraDamage.map((p, i) => ({ ...p, label: p.label || `Avaria ${i + 1}` })))
      : "";
    const otherPhotosHtml = other.length ? buildPhotoGrid(other) : "";

    return (
      `<div class="vei-doc vei-print-root" id="veiPrintDocument">` +
      `<header class="vei-doc-header">` +
      `<img class="vei-doc-logo" src="${LOGO_SRC}" alt="AMPLIGUARD"/>` +
      `<h2 class="vei-doc-title">Vistoria Eletrônica</h2>` +
      `<p class="vei-doc-subtitle">Vistoria de entrada${esc(titleNum)} · ${esc(fmt(inspection?.completed_at))}</p>` +
      `</header>` +
      `<section class="vei-doc-section"><h3>Identificação da vistoria</h3><div class="vei-doc-grid">${inspGrid}</div></section>` +
      `<section class="vei-doc-section"><h3>Identificação do veículo</h3><div class="vei-doc-grid">${vehicleGrid}</div></section>` +
      `<section class="vei-doc-section"><h3>Itens da vistoria</h3>${checklistHtml}</section>` +
      (diagramHtml
        ? `<section class="vei-doc-section"><h3>Diagrama de avarias — 4 vistas</h3>${diagramHtml}</section>`
        : "") +
      `<section class="vei-doc-section"><h3>Avarias registradas</h3>${damagesHtml}</section>` +
      (draft.generalNotes
        ? `<section class="vei-doc-section"><h3>Observações gerais da vistoria</h3><div class="vei-doc-notes">${esc(draft.generalNotes)}</div></section>`
        : "") +
      (standardPhotosHtml || extraPhotosHtml || otherPhotosHtml
        ? `<section class="vei-doc-section"><h3>Registro fotográfico</h3>${standardPhotosHtml}${otherPhotosHtml ? `<h4 style="margin-top:12px">Outras fotografias</h4>${otherPhotosHtml}` : ""}</section>`
        : "") +
      (extraPhotosHtml
        ? `<section class="vei-doc-section"><h3>Avarias — registro fotográfico</h3>${extraPhotosHtml}</section>`
        : "") +
      `<section class="vei-doc-section vei-doc-withdrawal">` +
      `<h3>Termo de retirada do veículo</h3>` +
      `<p>Declaro, para os devidos fins, que estou retirando o veículo identificado nesta vistoria, responsabilizando-me pelo recebimento do veículo na data abaixo indicada.</p>` +
      `<div class="vei-doc-field-line"><label>Nome completo:</label><div class="vei-doc-line"></div></div>` +
      `<div class="vei-doc-field-line"><label>CPF:</label><div class="vei-doc-line"></div></div>` +
      `<div class="vei-doc-field-line"><label>Data da retirada:</label><div class="vei-doc-line">____ / ____ / ______</div></div>` +
      `<div class="vei-doc-field-line"><label>Assinatura do responsável:</label><div class="vei-doc-sign-line"></div></div>` +
      `</section>` +
      `</div>`
    );
  }

  async function downloadPdf(ctx, vehicle, inspection, detail) {
    const root = document.getElementById("veiPrintDocument") || document.querySelector(".vei-print-root");
    if (!root) {
      alert("Documento da vistoria não encontrado.");
      return;
    }

    const loadJsPdf = ctx?.loadJsPdf || global.loadJsPdf;
    const loadHtml2Canvas = global.loadHtml2Canvas;
    if (!loadJsPdf || !loadHtml2Canvas) {
      alert("Recursos de PDF indisponíveis. Atualize a página e tente novamente.");
      return;
    }

    const btn = document.getElementById("veiPdfBtn");
    const prev = btn?.textContent;
    if (btn) {
      btn.disabled = true;
      btn.textContent = "A gerar PDF…";
    }

    try {
      await loadJsPdf();
      const jsPdfCtor = global.jspdf?.jsPDF;
      if (!jsPdfCtor) throw new Error("jsPDF indisponível");
      const html2canvas = await loadHtml2Canvas();

      root.classList.add("vei-doc-export-mode");
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      const w = Math.max(1, Math.ceil(root.scrollWidth));
      const h = Math.max(1, Math.ceil(root.scrollHeight));
      let scale = Math.min(2, (global.devicePixelRatio || 1) * 1.5);
      const maxSide = 16384;
      const cap = maxSide / Math.max(w, h, 1);
      if (scale > cap) scale = Math.max(0.55, cap);

      const canvas = await html2canvas(root, {
        backgroundColor: "#ffffff",
        scale,
        useCORS: true,
        allowTaint: false,
        logging: false,
        width: w,
        height: h,
        windowWidth: w,
        windowHeight: h,
        scrollX: 0,
        scrollY: 0,
        onclone(clonedDoc) {
          const cloned = clonedDoc.getElementById("veiPrintDocument") || clonedDoc.querySelector(".vei-print-root");
          cloned?.classList.add("vei-doc-export-mode");
        },
      });

      const doc = new jsPdfCtor({ unit: "pt", format: "a4", orientation: "portrait" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 28;
      const innerW = pageW - margin * 2;
      const innerH = pageH - margin * 2;
      const pxPerPt = canvas.width / innerW;
      const pageSlicePx = Math.max(1, Math.floor(innerH * pxPerPt));
      const pageCanvas = document.createElement("canvas");
      const pageCtx = pageCanvas.getContext("2d");
      if (!pageCtx) throw new Error("Falha ao preparar PDF.");

      pageCanvas.width = canvas.width;
      let offsetY = 0;
      let pageIndex = 0;
      const totalPages = Math.ceil(canvas.height / pageSlicePx);

      while (offsetY < canvas.height) {
        const sliceH = Math.min(pageSlicePx, canvas.height - offsetY);
        pageCanvas.height = sliceH;
        pageCtx.fillStyle = "#ffffff";
        pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        pageCtx.drawImage(canvas, 0, offsetY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

        const drawW = innerW;
        const drawH = sliceH / pxPerPt;
        const drawX = margin;
        const drawY = margin;

        if (pageIndex > 0) doc.addPage();
        doc.addImage(pageCanvas.toDataURL("image/jpeg", 0.92), "JPEG", drawX, drawY, drawW, drawH);

        doc.setFontSize(8);
        doc.setTextColor(100);
        const footer = `Página ${pageIndex + 1} de ${totalPages} · Vistoria nº ${inspection?.inspection_number || "—"}`;
        doc.text(footer, pageW / 2, pageH - 14, { align: "center" });

        offsetY += sliceH;
        pageIndex += 1;
      }

      doc.save(pdfFileName(vehicle, inspection));
    } catch (e) {
      console.error("vei pdf", e);
      alert("Não foi possível gerar o PDF. Tente imprimir ou use outro navegador.");
    } finally {
      root?.classList.remove("vei-doc-export-mode");
      if (btn) {
        btn.disabled = false;
        btn.textContent = prev || "Baixar PDF";
      }
    }
  }

  global.vehicleEntryInspectionDocument = {
    injectStylesOnce,
    buildPrintHtml,
    downloadPdf,
    pdfFileName,
  };
})(typeof window !== "undefined" ? window : globalThis);

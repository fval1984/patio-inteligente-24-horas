/**
 * Impressão e PDF da Vistoria Eletrônica — somente apresentação (read-only).
 * Não altera vistoria, banco ou fluxos existentes.
 */
(function vehicleEntryInspectionDocumentModule(global) {
  "use strict";

  const LOGO_SRC = "/assets/ampliguard-header.png?v=3";
  const PHOTO_SIZE = "4cm";
  const A4_WIDTH_PX = 794;
  const CANVAS_MAX_SIDE = 16384;

  /** Descrições padronizadas em português para o registro fotográfico (impressão/PDF). */
  const PHOTO_LABEL_PT = {
    front: "Frente",
    diag_front_left: "Diagonal dianteira esquerda",
    diag_front_right: "Diagonal dianteira direita",
    side_left: "Lateral esquerda",
    side_right: "Lateral direita",
    rear: "Traseira",
    diag_rear_left: "Diagonal traseira esquerda",
    diag_rear_right: "Diagonal traseira direita",
    roof: "Teto",
    plate: "Placa",
    odometer: "Odômetro",
    dashboard_on: "Painel de instrumentos com o veículo ligado",
    battery: "Bateria",
    spare: "Estepe",
    jack_tools: "Chave de rodas e triângulo",
    seats_front: "Bancos dianteiros",
    seats_rear: "Bancos traseiros",
    chassis: "Chassi",
    engine: "Motor",
    wheel_fl: "Roda dianteira esquerda",
    wheel_fr: "Roda dianteira direita",
    wheel_rl: "Roda traseira esquerda",
    wheel_rr: "Roda traseira direita",
    interior_front: "Interior dianteiro",
    interior_rear: "Interior traseiro",
    trunk: "Porta-malas",
  };

  const PHOTO_LABEL_ALIASES = {
    Dianteira: "Frente",
    "Odômetro / Quilometragem": "Odômetro",
    "Chassi / Número do chassi": "Chassi",
  };

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

  function photoLabelFromType(type) {
    if (!type) return null;
    return PHOTO_LABEL_PT[type] || null;
  }

  function isTechnicalPhotoLabel(str) {
    if (str == null) return true;
    const s = String(str).trim();
    if (!s) return true;
    if (/\.(jpe?g|png|webp|gif|heic|bmp)$/i.test(s)) return true;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return true;
    if (PHOTO_LABEL_PT[s]) return true;
    if (/^[a-z]+(_[a-z0-9]+)+$/i.test(s)) return true;
    if (/^foto adicional de avaria\s*\d*$/i.test(s)) return true;
    return false;
  }

  function resolveStandardPhotoLabel(type, fallbackLabel) {
    const fromType = photoLabelFromType(type);
    if (fromType) return fromType;
    const fb = String(fallbackLabel || "").trim();
    if (fb && PHOTO_LABEL_ALIASES[fb]) return PHOTO_LABEL_ALIASES[fb];
    if (fb && !isTechnicalPhotoLabel(fb)) return fb;
    return "Foto";
  }

  function formatDamagePhotoLabel(photo, damage) {
    const rawLabel = String(photo?.photo_label || photo?.label || "").trim();
    let desc = "";
    if (rawLabel && !isTechnicalPhotoLabel(rawLabel)) {
      desc = rawLabel;
    } else if (damage?.area_label && !isTechnicalPhotoLabel(damage.area_label)) {
      desc = String(damage.area_label).trim();
    } else if (damage?.description) {
      desc = String(damage.description).trim();
    }
    if (desc) {
      if (/^avaria(\s*[—\-:]|$)/i.test(desc)) {
        return desc.charAt(0).toUpperCase() + desc.slice(1);
      }
      return `Avaria — ${desc}`;
    }
    return "Avaria";
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

  function documentCssRules() {
    return `
      .vei-doc { color: #111; font-family: Arial, Helvetica, sans-serif; font-size: 10pt; line-height: 1.35; }
      .vei-doc-header { text-align: center; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 2px solid #1e293b; break-inside: avoid; page-break-inside: avoid; }
      .vei-doc-header img.vei-doc-logo { max-width: 480px; max-height: 120px; width: auto; height: auto; object-fit: contain; margin: 0 auto 10px; display: block; }
      .vei-doc-title { margin: 0; font-size: 16pt; letter-spacing: 0.06em; text-transform: uppercase; color: #0f172a; }
      .vei-doc-subtitle { margin: 4px 0 0; font-size: 10pt; color: #475569; }
      .vei-doc-section { margin: 16px 0 18px; break-inside: auto; page-break-inside: auto; }
      .vei-doc-section h3 { margin: 0 0 8px; font-size: 11pt; text-transform: uppercase; letter-spacing: 0.05em; color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; break-after: avoid; page-break-after: avoid; }
      .vei-doc-section h4 { margin: 12px 0 6px; font-size: 10pt; text-transform: uppercase; color: #334155; break-after: avoid; page-break-after: avoid; }
      .vei-doc-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 14px; margin-bottom: 4px; }
      .vei-doc-grid .vei-doc-field span { display: block; font-size: 8pt; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; }
      .vei-doc-grid .vei-doc-field strong { font-size: 10pt; color: #0f172a; word-break: break-word; }
      .vei-doc-table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-top: 6px; }
      .vei-doc-table th, .vei-doc-table td { border: 1px solid #cbd5e1; padding: 5px 7px; vertical-align: top; }
      .vei-doc-table th { background: #f1f5f9; text-align: left; font-weight: 700; }
      .vei-doc-table td.cls { font-weight: 700; white-space: nowrap; }
      .vei-doc-table thead { display: table-header-group; }
      .vei-doc-table tr { break-inside: avoid; page-break-inside: avoid; }
      .vei-doc-checklist-cat { margin-top: 10px; break-inside: auto; page-break-inside: auto; }
      .vei-doc-card {
        border: 1.5px solid #94a3b8; margin: 0 0 12px; break-inside: avoid-page; page-break-inside: avoid;
      }
      .vei-doc-card-title {
        margin: 0; padding: 6px 8px; font-size: 10pt; font-weight: 800; text-transform: uppercase;
        letter-spacing: 0.05em; background: #e2e8f0; border-bottom: 1.5px solid #94a3b8;
        break-after: avoid; page-break-after: avoid;
      }
      .vei-doc-block-title {
        margin: 0; padding: 5px 8px 3px; font-size: 8.5pt; font-weight: 700; text-transform: uppercase;
        color: #475569; border-top: 1px solid #e2e8f0;
      }
      .vei-doc-check-table th.vei-doc-cls-h, .vei-doc-check-table td.vei-doc-cls-cell {
        width: 28px; text-align: center; padding: 3px 2px;
      }
      .vei-doc-check-table td.vei-doc-cls-cell.on {
        font-weight: 900; background: #fef3c7;
      }
      .vei-doc-damage { border: 1px solid #fecaca; background: #fff7f7; border-radius: 6px; padding: 8px 10px; margin-bottom: 8px; break-inside: avoid; page-break-inside: avoid; }
      .vei-doc-damage strong { display: block; margin-bottom: 4px; }
      .vei-doc-notes { white-space: pre-wrap; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; }
      .vei-doc-diagram { text-align: center; margin: 8px 0; break-inside: avoid; page-break-inside: avoid; }
      .vei-doc-diagram-stack { position: relative; width: 100%; max-width: 800px; margin: 0 auto; }
      .vei-doc-diagram-stack img.vei-doc-diagram-img { width: 100%; height: auto; display: block; }
      .vei-doc-diagram-stack svg.vei-doc-diagram-markers { position: absolute; left: 0; top: 0; width: 100%; height: 100%; pointer-events: none; }
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
      .vei-doc-edit .vei-doc-cls-cell { padding: 2px; vertical-align: middle; }
      .vei-doc-edit .vei-class-btn.vei-doc-class-btn {
        width: 26px; height: 26px; min-width: 26px; padding: 0; margin: 0 auto; display: flex;
        align-items: center; justify-content: center; border: 1px solid #cbd5e1; border-radius: 4px;
        background: #fff; font-weight: 800; font-size: 9pt; cursor: pointer; line-height: 1;
      }
      .vei-doc-edit .vei-class-btn.vei-doc-class-btn.active {
        background: #fef3c7; border-color: #f59e0b; box-shadow: inset 0 0 0 1px #f59e0b;
      }
      .vei-doc-edit .vei-doc-inline-field {
        width: 100%; box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 4px;
        padding: 4px 6px; font-size: 9pt;
      }
      .vei-doc-edit .vei-doc-notes-edit {
        width: 100%; box-sizing: border-box; min-height: 88px; border: 1px solid #cbd5e1;
        border-radius: 6px; padding: 8px 10px; font-family: inherit; font-size: 10pt; resize: vertical;
      }
      .vei-doc-edit .vei-item-pending td.vei-td-label { background: #fff7ed; }
      .vei-doc-export-mode {
        width: ${A4_WIDTH_PX}px !important;
        max-width: ${A4_WIDTH_PX}px !important;
        height: auto !important;
        max-height: none !important;
        overflow: visible !important;
        background: #fff !important;
      }
    `;
  }

  function getPrintStylesheet() {
    return `
      @page { size: A4 portrait; margin: 12mm; }
      html, body {
        margin: 0; padding: 0;
        background: #fff !important;
        color: #111 !important;
        height: auto !important;
        max-height: none !important;
        overflow: visible !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      ${documentCssRules()}
      .vei-doc { width: 100%; max-width: 100%; }
      .vei-doc-photo-grid { grid-template-columns: repeat(4, 1fr); }
      img { max-width: 100%; }
    `;
  }

  function injectStylesOnce() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    if (document.getElementById("veiDocumentStyles")) return;
    const style = document.createElement("style");
    style.id = "veiDocumentStyles";
    style.textContent =
      documentCssRules() +
      `
      @media screen and (max-width: 720px) {
        .vei-doc-photo-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
    `;
    document.head.appendChild(style);
  }

  async function waitForImages(container, timeoutMs) {
    if (!container) return;
    const imgs = [...container.querySelectorAll("img")];
    const timeout = timeoutMs || 12000;
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise((resolve) => {
            if (img.complete && img.naturalWidth > 0) {
              resolve();
              return;
            }
            const done = () => resolve();
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
            setTimeout(done, timeout);
          })
      )
    );
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

  function classificationShort(id) {
    const map = { BOM: "B", REGULAR: "R", DANIFICADO: "D", SEM_TESTE: "S", INEXISTENTE: "I" };
    return map[id] || "";
  }

  function buildChecklistSection(helpers, draft, detailItems) {
    const variant = draft?.inspectionVariant || "LEVE";
    const cfg = helpers.getVariantConfig ? helpers.getVariantConfig(variant) : null;
    const cards = cfg?.cards || helpers.INSPECTION_CARDS || [];
    const checklist = cfg?.checklist || helpers.CHECKLIST || [];
    const formExtras = draft.formExtras || {};

    let html =
      '<p class="vei-doc-legend" style="margin:0 0 10px;font-size:8.5pt;text-align:center;border:1px solid #cbd5e1;padding:6px;background:#f8fafc">' +
      "<strong>Legenda:</strong> B — Bom · R — Regular · D — Danificado · S — Sem Teste · I — Inexistente</p>";

    cards.forEach((card, cardIdx) => {
      html += `<div class="vei-doc-card">`;
      html += `<h4 class="vei-doc-card-title">${esc(cardIdx + 1)}. ${esc(card.title)}</h4>`;
      card.blocks.forEach((block, blockIdx) => {
        if (block.title) {
          html += `<h5 class="vei-doc-block-title">${esc(block.title)}</h5>`;
        } else if (blockIdx > 0 && card.blocks.length > 1) {
          html += `<h5 class="vei-doc-block-title">Bloco ${blockIdx + 1}</h5>`;
        }
        if (block.textFields?.length) {
          html += '<table class="vei-doc-table"><tbody>';
          block.textFields.forEach((tf) => {
            html += `<tr><td><strong>${esc(tf.label)}</strong></td><td>${esc(formExtras[tf.key] || "—")}</td></tr>`;
          });
          html += "</tbody></table>";
        }
        html += '<table class="vei-doc-table vei-doc-check-table"><thead><tr><th>Item</th>';
        ["B", "R", "D", "S", "I"].forEach((h) => {
          html += `<th class="vei-doc-cls-h">${h}</th>`;
        });
        html += "</tr></thead><tbody>";
        block.items.forEach((it) => {
          const kind = it.kind || "classify";
          if (kind === "text") {
            html += `<tr><td colspan="6"><strong>${esc(it.label)}:</strong> ${esc(formExtras[it.key] || "—")}</td></tr>`;
            return;
          }
          if (kind !== "classify") return;
          const sel = draft.classifications[it.key];
          html += `<tr><td>${esc(it.label)}</td>`;
          ["BOM", "REGULAR", "DANIFICADO", "SEM_TESTE", "INEXISTENTE"].forEach((clsId) => {
            const on = sel === clsId;
            html += `<td class="vei-doc-cls-cell${on ? " on" : ""}">${on ? esc(classificationShort(clsId)) : ""}</td>`;
          });
          html += "</tr>";
          if (it.numberKey) {
            html += `<tr><td colspan="6"><em>${esc(it.numberLabel || "Quantidade")}:</em> ${esc(formExtras[it.numberKey] || "—")}</td></tr>`;
          }
        });
        html += "</tbody></table>";
      });
      html += "</div>";
    });

    const knownKeys = new Set(checklist.filter((it) => it.kind === "classify").map((it) => it.key));
    const legacy = (detailItems || []).filter((it) => it.item_key && !knownKeys.has(it.item_key));
    if (legacy.length) {
      html += `<div class="vei-doc-card"><h4 class="vei-doc-card-title">Itens (registro anterior)</h4>`;
      html += '<table class="vei-doc-table"><thead><tr><th>Item</th><th>Categoria</th><th>Classificação</th></tr></thead><tbody>';
      legacy.forEach((it) => {
        html += `<tr><td>${esc(it.item_label || it.item_key)}</td><td>${esc(it.category || "—")}</td><td class="cls">${esc(classificationLabel(it.classification))}</td></tr>`;
      });
      html += "</tbody></table></div>";
    }

    return html;
  }

  function buildChecklistSectionEditable(helpers, draft) {
    const variant = draft?.inspectionVariant || "LEVE";
    const cfg = helpers.getVariantConfig ? helpers.getVariantConfig(variant) : null;
    const cards = cfg?.cards || helpers.INSPECTION_CARDS || [];
    const formExtras = draft.formExtras || {};
    const classifications = helpers.CLASSIFICATIONS || [
      { id: "BOM", label: "Bom" },
      { id: "REGULAR", label: "Regular" },
      { id: "DANIFICADO", label: "Danificado" },
      { id: "SEM_TESTE", label: "Sem teste" },
      { id: "INEXISTENTE", label: "Inexistente" },
    ];
    const classShort = helpers.CLASS_SHORT || classificationShort;

    let html =
      '<p class="vei-doc-legend" style="margin:0 0 10px;font-size:8.5pt;text-align:center;border:1px solid #cbd5e1;padding:6px;background:#f8fafc">' +
      "<strong>Legenda:</strong> B — Bom · R — Regular · D — Danificado · S — Sem Teste · I — Inexistente</p>";

    cards.forEach((card, cardIdx) => {
      html += `<div class="vei-doc-card">`;
      html += `<h4 class="vei-doc-card-title">${esc(cardIdx + 1)}. ${esc(card.title)}</h4>`;
      card.blocks.forEach((block, blockIdx) => {
        if (block.title) {
          html += `<h5 class="vei-doc-block-title">${esc(block.title)}</h5>`;
        } else if (blockIdx > 0 && card.blocks.length > 1) {
          html += `<h5 class="vei-doc-block-title">Bloco ${blockIdx + 1}</h5>`;
        }
        if (block.textFields?.length) {
          html += '<table class="vei-doc-table"><tbody>';
          block.textFields.forEach((tf) => {
            const val = formExtras[tf.key] || "";
            html +=
              `<tr><td><strong>${esc(tf.label)}</strong></td><td>` +
              `<input type="text" class="vei-text-field vei-doc-inline-field" data-extra-key="${esc(tf.key)}" value="${esc(val)}" placeholder="${esc(tf.placeholder || "")}"/>` +
              `</td></tr>`;
          });
          html += "</tbody></table>";
        }
        html += '<table class="vei-doc-table vei-doc-check-table"><thead><tr><th>Item</th>';
        ["B", "R", "D", "S", "I"].forEach((h) => {
          html += `<th class="vei-doc-cls-h">${h}</th>`;
        });
        html += "</tr></thead><tbody>";
        block.items.forEach((it) => {
          const kind = it.kind || "classify";
          if (kind === "text") {
            const val = formExtras[it.key] || "";
            html += `<tr class="vei-text-row"><td colspan="6">`;
            html += `<strong>${esc(it.label)}:</strong> `;
            html += `<input type="text" class="vei-text-field vei-doc-inline-field" data-extra-key="${esc(it.key)}" value="${esc(val)}" placeholder="${esc(it.placeholder || "")}" style="max-width:280px"/>`;
            html += `</td></tr>`;
            return;
          }
          if (kind !== "classify") return;
          const sel = draft.classifications?.[it.key];
          html += `<tr class="vei-item vei-doc-item${!sel ? " vei-item-pending" : ""}" data-item-key="${esc(it.key)}">`;
          html += `<td class="vei-td-label">${esc(it.label)}</td>`;
          classifications.forEach((c) => {
            const clsId = c.id || c;
            const short = typeof classShort === "function" ? classShort(clsId) : classShort[clsId] || classificationShort(clsId);
            const active = sel === clsId;
            html +=
              `<td class="vei-doc-cls-cell${active ? " on" : ""}">` +
              `<button type="button" class="vei-class-btn vei-doc-class-btn${active ? " active" : ""}" data-class="${esc(clsId)}" data-item="${esc(it.key)}" aria-label="${esc(c.label || clsId)}" title="${esc(c.label || clsId)}">` +
              `<span class="vei-class-btn-label" aria-hidden="true">${esc(short)}</span>` +
              `</button></td>`;
          });
          html += "</tr>";
          if (it.numberKey) {
            const qVal = formExtras[it.numberKey] || "";
            html += `<tr class="vei-qty-row"><td colspan="6">`;
            html += `<em>${esc(it.numberLabel || "Quantidade")}:</em> `;
            html += `<input type="number" min="0" step="1" class="vei-number-field vei-doc-inline-field" data-extra-key="${esc(it.numberKey)}" value="${esc(qVal)}" style="max-width:120px;display:inline-block"/>`;
            html += `</td></tr>`;
          }
        });
        html += "</tbody></table>";
      });
      html += "</div>";
    });

    return html;
  }

  function buildItemDamagePhotosSection(detail) {
    const photos = (detail?.photos || []).filter(
      (p) => p.photo_type?.startsWith("avaria_item_") || (p.item_key && p.photo_label?.toLowerCase().includes("avaria"))
    );
    if (!photos.length) return "";
    return (
      `<section class="vei-doc-section"><h3>Fotos adicionais de avarias</h3>` +
      `<div class="vei-doc-photo-grid">${photos
        .map((p) => {
          let label = p.photo_label || p.item_key || "Avaria";
          if (!/danificado/i.test(label)) {
            const base = String(label).replace(/^avaria\s*[—\-]\s*/i, "").trim();
            label = base ? `${base} — Danificado` : "Danificado";
          }
          return renderPhotoCell(label, p.url);
        })
        .join("")}</div></section>`
    );
  }

  function buildDamagesSection(draft, photosByDamage) {
    if (!draft.damages?.length) {
      return '<p style="margin:0;color:#64748b">Nenhuma avaria registrada no checklist.</p>';
    }
    return draft.damages
      .map((d, idx) => {
        const linked = photosByDamage[d.id] || photosByDamage[idx] || [];
        const photoHtml = linked.length
          ? `<div class="vei-doc-photo-grid">${linked.map((p) => renderPhotoCell(formatDamagePhotoLabel(p, d), p.url)).join("")}</div>`
          : d.photoPreview
            ? `<div class="vei-doc-photo-grid">${renderPhotoCell(formatDamagePhotoLabel({ label: d.area_label }, d), d.photoPreview)}</div>`
            : "";
        return (
          `<div class="vei-doc-damage">` +
          `<strong>AVARIA — ${esc(String(d.area_label || d.item_key || "Área").replace(/^avaria\s*[—\-]\s*/i, ""))}</strong>` +
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
      ? `<img src="${esc(url)}" alt="${esc(label)}" crossorigin="anonymous" loading="eager"/>`
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
    const standardKeys = new Set([...Object.keys(PHOTO_LABEL_PT), ...standardOrder.map((s) => s.key)]);

    const standard = [];
    const extraDamage = [];
    const checklistDamage = [];
    const other = [];

    (photos || []).forEach((p) => {
      const entry = {
        url: p.url || "",
        label: p.photo_label || p.file_name || "",
        type: p.photo_type || "",
        damage_id: p.damage_id || null,
        photo_label: p.photo_label || "",
      };
      if (entry.type === "avaria_extra") {
        extraDamage.push({ ...entry, label: formatDamagePhotoLabel(entry) });
      } else if (entry.damage_id) {
        checklistDamage.push(entry);
      } else if (entry.type && standardKeys.has(entry.type)) {
        standard.push({
          ...entry,
          label: resolveStandardPhotoLabel(entry.type, entry.label),
          order: standardOrder.findIndex((s) => s.key === entry.type),
        });
      } else {
        other.push({ ...entry, label: resolveStandardPhotoLabel(entry.type, entry.label) });
      }
    });

    standard.sort((a, b) => (a.order < 0 ? 999 : a.order) - (b.order < 0 ? 999 : b.order));

    const photosByDamage = {};
    checklistDamage.forEach((p) => {
      const key = p.damage_id;
      const damage = (damages || []).find((d) => d.id === p.damage_id);
      const labeled = { ...p, label: formatDamagePhotoLabel(p, damage) };
      if (!photosByDamage[key]) photosByDamage[key] = [];
      photosByDamage[key].push(labeled);
    });

    (damages || []).forEach((d, idx) => {
      if (!photosByDamage[d.id] && d.photoPreview) {
        photosByDamage[d.id || idx] = [
          { url: d.photoPreview, label: formatDamagePhotoLabel({ label: d.area_label }, d) },
        ];
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
    const rDiagram = h.renderDiagramForPrint || h.renderDiagram;

    const titleNum = inspection?.inspection_number ? ` nº ${inspection.inspection_number}` : "";
    const { standard, extraDamage, other, photosByDamage } = organizePhotos(detail?.photos, detail?.damages);

    const normalizedDraft = {
      ...draft,
      inspectionVariant: draft.inspectionVariant || inspection?.inspection_variant || "LEVE",
      formExtras: draft.formExtras || inspection?.form_extras || {},
      diagramMarkers:
        global.vehicleEntryInspection?.normalizeDiagramMarkers?.(draft.diagramMarkers) ||
        draft.diagramMarkers ||
        [],
    };

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

    const variantLabel = h.getVariantConfig
      ? h.getVariantConfig(normalizedDraft.inspectionVariant).label
      : normalizedDraft.inspectionVariant || "Leve";

    const inspGrid =
      metaField("Nº da vistoria", inspection?.inspection_number) +
      metaField("Tipo de vistoria", variantLabel) +
      metaField("ID da vistoria", inspection?.id) +
      metaField("Data da vistoria", fmt(inspection?.completed_at)) +
      metaField("Responsável pela vistoria", inspection?.completed_by_name) +
      metaField("Tipo", inspection?.inspection_type || "ENTRADA") +
      metaField("Status", "CONCLUÍDA");

    const checklistHtml = buildChecklistSection(h, normalizedDraft, detail?.items);
    const damagesHtml = buildDamagesSection(normalizedDraft, photosByDamage);

    const diagramHtml =
      typeof rDiagram === "function"
        ? `<div class="vei-doc-diagram">${rDiagram(normalizedDraft, true)}</div>`
        : "";

    const standardPhotosHtml = standard.length ? buildPhotoGrid(standard) : "";
    const extraPhotosHtml = extraDamage.length ? buildPhotoGrid(extraDamage) : "";
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
      `<section class="vei-doc-section vei-doc-section-checklist"><h3>Itens da vistoria</h3>${checklistHtml}</section>` +
      (typeof rDiagram === "function"
        ? `<section class="vei-doc-section"><h3>Diagrama de avarias — 4 vistas</h3>${diagramHtml}</section>`
        : "") +
      `<section class="vei-doc-section"><h3>Avarias registradas</h3>${damagesHtml}</section>` +
      (normalizedDraft.generalNotes
        ? `<section class="vei-doc-section"><h3>Observações gerais da vistoria</h3><div class="vei-doc-notes">${esc(normalizedDraft.generalNotes)}</div></section>`
        : "") +
      (standardPhotosHtml || otherPhotosHtml
        ? `<section class="vei-doc-section"><h3>Registro fotográfico</h3>${standardPhotosHtml}${otherPhotosHtml ? `<h4 style="margin-top:12px">Outras fotografias</h4>${otherPhotosHtml}` : ""}</section>`
        : "") +
      buildItemDamagePhotosSection(detail) +
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

  function buildEditablePrintHtml(options) {
    injectStylesOnce();
    const { vehicle, ctx, inspection, detail, draft, helpers, diagramHtml, mobilePhotosHtml, itemDamagePhotosHtml, finalizeLabel } =
      options;
    const h = helpers || {};
    const fmt = h.fmtDateTime || fmtDateTime;

    const titleNum = inspection?.inspection_number ? ` nº ${inspection.inspection_number}` : "";
    const { standard, extraDamage, other, photosByDamage } = organizePhotos(detail?.photos, detail?.damages);

    const normalizedDraft = {
      ...draft,
      inspectionVariant: draft.inspectionVariant || inspection?.inspection_variant || "LEVE",
      formExtras: draft.formExtras || inspection?.form_extras || {},
      diagramMarkers:
        global.vehicleEntryInspection?.normalizeDiagramMarkers?.(draft.diagramMarkers) ||
        draft.diagramMarkers ||
        [],
    };

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

    const variantLabel = h.getVariantConfig
      ? h.getVariantConfig(normalizedDraft.inspectionVariant).label
      : normalizedDraft.inspectionVariant || "Leve";

    const inspGrid =
      metaField("Nº da vistoria", inspection?.inspection_number) +
      metaField("Tipo de vistoria", variantLabel) +
      metaField("ID da vistoria", inspection?.id) +
      metaField("Data da vistoria", fmt(inspection?.completed_at)) +
      metaField("Responsável pela vistoria", inspection?.completed_by_name) +
      metaField("Tipo", inspection?.inspection_type || "ENTRADA") +
      metaField("Status", "CONCLUÍDA");

    const checklistHtml = `<div id="veiDocChecklistHost">${buildChecklistSectionEditable(h, normalizedDraft)}</div>`;
    const damagesHtml = buildDamagesSection(normalizedDraft, photosByDamage);

    const diagramSection =
      diagramHtml != null
        ? `<section class="vei-doc-section"><h3>Diagrama de avarias — 4 vistas</h3><div class="vei-doc-diagram" id="veiDocDiagramHost">${diagramHtml}</div></section>`
        : "";

    const standardPhotosHtml = standard.length ? buildPhotoGrid(standard) : "";
    const extraPhotosHtml = extraDamage.length ? buildPhotoGrid(extraDamage) : "";
    const otherPhotosHtml = other.length ? buildPhotoGrid(other) : "";

    const notesVal = normalizedDraft.generalNotes || "";

    return (
      `<div class="vei-doc vei-doc-edit vei-print-root" id="veiPrintDocument">` +
      `<header class="vei-doc-header">` +
      `<img class="vei-doc-logo" src="${LOGO_SRC}" alt="AMPLIGUARD"/>` +
      `<h2 class="vei-doc-title">Vistoria Eletrônica</h2>` +
      `<p class="vei-doc-subtitle">Editar vistoria de entrada${esc(titleNum)} · ${esc(fmt(inspection?.completed_at))}</p>` +
      `</header>` +
      `<section class="vei-doc-section"><h3>Identificação da vistoria</h3><div class="vei-doc-grid">${inspGrid}</div></section>` +
      `<section class="vei-doc-section"><h3>Identificação do veículo</h3><div class="vei-doc-grid">${vehicleGrid}</div></section>` +
      `<section class="vei-doc-section vei-doc-section-checklist"><h3>Itens da vistoria</h3>${checklistHtml}</section>` +
      diagramSection +
      `<section class="vei-doc-section"><h3>Avarias registradas</h3>${damagesHtml}</section>` +
      `<section class="vei-doc-section"><h3>Observações gerais da vistoria</h3>` +
      `<textarea class="vei-doc-notes-edit vei-notes" id="veiGeneralNotes" placeholder="Informações adicionais…">${esc(notesVal)}</textarea></section>` +
      (mobilePhotosHtml
        ? `<section class="vei-doc-section"><h3>Registro fotográfico</h3><div id="veiDocMobilePhotosHost">${mobilePhotosHtml}</div></section>`
        : standardPhotosHtml || otherPhotosHtml
          ? `<section class="vei-doc-section"><h3>Registro fotográfico</h3>${standardPhotosHtml}${otherPhotosHtml ? `<h4 style="margin-top:12px">Outras fotografias</h4>${otherPhotosHtml}` : ""}</section>`
          : "") +
      (itemDamagePhotosHtml
        ? `<section class="vei-doc-section"><h3>Fotos adicionais de avarias</h3><div id="veiDocItemDamagePhotosHost">${itemDamagePhotosHtml}</div></section>`
        : buildItemDamagePhotosSection(detail)) +
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
      `</div>` +
      '<div class="vei-actions vei-no-print">' +
      `<button type="button" id="veiFinalizeBtn">${esc(finalizeLabel || "Salvar vistoria")}</button>` +
      '<button type="button" class="secondary" id="veiModalCloseInner">Cancelar</button>' +
      "</div>"
    );
  }

  async function printDocument(sourceRoot, inspection) {
    const root = sourceRoot || document.getElementById("veiPrintDocument") || document.querySelector(".vei-print-root");
    if (!root) {
      alert("Documento da vistoria não encontrado.");
      return;
    }

    await waitForImages(root);

    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.title = "Impressão da vistoria";
    iframe.style.cssText = "position:fixed;width:0;height:0;border:0;visibility:hidden;left:-9999px;top:0;";
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument;
    const win = iframe.contentWindow;
    if (!doc || !win) {
      iframe.remove();
      alert("Não foi possível preparar a impressão.");
      return;
    }

    const title = `Vistoria ${inspection?.inspection_number || ""}`.trim();

    doc.open();
    doc.write("<!DOCTYPE html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\">");
    doc.write(`<title>${esc(title || "Vistoria Eletrônica")}</title>`);
    doc.write(`<style>${getPrintStylesheet()}</style>`);
    doc.write("</head><body>");
    doc.write(root.outerHTML);
    doc.write("</body></html>");
    doc.close();

    await waitForImages(doc.body);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const cleanup = () => {
      try {
        iframe.remove();
      } catch (e) {
        /* ignore */
      }
    };

    win.addEventListener("afterprint", cleanup, { once: true });
    setTimeout(cleanup, 120000);

    win.focus();
    win.print();
  }

  async function prepareCaptureRoot(sourceRoot) {
    await waitForImages(sourceRoot);

    const host = document.createElement("div");
    host.id = "veiPdfCaptureHost";
    host.setAttribute("aria-hidden", "true");
    host.style.cssText = [
      "position:fixed",
      "left:-20000px",
      "top:0",
      `width:${A4_WIDTH_PX}px`,
      "height:auto",
      "max-height:none",
      "overflow:visible",
      "background:#fff",
      "z-index:-1",
      "pointer-events:none",
    ].join(";");

    const clone = sourceRoot.cloneNode(true);
    clone.id = "veiPdfCaptureClone";
    clone.classList.add("vei-doc-export-mode");
    host.appendChild(clone);
    document.body.appendChild(host);

    await waitForImages(host);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    return { host, root: clone };
  }

  async function captureDocumentCanvas(root, html2canvas) {
    const w = Math.max(1, Math.ceil(root.scrollWidth || root.offsetWidth || A4_WIDTH_PX));
    const h = Math.max(1, Math.ceil(root.scrollHeight || root.offsetHeight || 1));
    let scale = Math.min(2, (global.devicePixelRatio || 1) * 1.5);
    const cap = CANVAS_MAX_SIDE / Math.max(w, h, 1);
    if (scale > cap) scale = Math.max(0.4, cap);

    const baseOpts = {
      backgroundColor: "#ffffff",
      useCORS: true,
      allowTaint: false,
      logging: false,
      scrollX: 0,
      scrollY: 0,
    };

    if (h * scale <= CANVAS_MAX_SIDE) {
      return html2canvas(root, {
        ...baseOpts,
        scale,
        width: w,
        height: h,
        windowWidth: w,
        windowHeight: h,
      });
    }

    const blocks = root.querySelectorAll(":scope > header, :scope > section");
    if (!blocks.length) {
      scale = CANVAS_MAX_SIDE / h;
      return html2canvas(root, {
        ...baseOpts,
        scale,
        width: w,
        height: h,
        windowWidth: w,
        windowHeight: h,
      });
    }

    const canvases = [];
    for (const block of blocks) {
      const bh = Math.max(1, block.scrollHeight || block.offsetHeight);
      const bw = Math.max(1, block.scrollWidth || block.offsetWidth || w);
      let blockScale = scale;
      if (bh * blockScale > CANVAS_MAX_SIDE) {
        blockScale = CANVAS_MAX_SIDE / bh;
      }
      const c = await html2canvas(block, {
        ...baseOpts,
        scale: blockScale,
        width: bw,
        height: bh,
        windowWidth: bw,
        windowHeight: bh,
      });
      canvases.push(c);
    }

    const stitched = document.createElement("canvas");
    stitched.width = Math.max(...canvases.map((c) => c.width));
    stitched.height = canvases.reduce((sum, c) => sum + c.height, 0);
    const ctx = stitched.getContext("2d");
    if (!ctx) throw new Error("Falha ao compor canvas do PDF.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, stitched.width, stitched.height);
    let y = 0;
    canvases.forEach((c) => {
      ctx.drawImage(c, 0, y);
      y += c.height;
    });
    return stitched;
  }

  async function downloadPdf(ctx, vehicle, inspection, detail) {
    const sourceRoot =
      document.getElementById("veiPrintDocument") || document.querySelector(".vei-print-root");
    if (!sourceRoot) {
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

    let captureHost = null;
    try {
      await loadJsPdf();
      const jsPdfCtor = global.jspdf?.jsPDF;
      if (!jsPdfCtor) throw new Error("jsPDF indisponível");
      const html2canvas = await loadHtml2Canvas();

      const prepared = await prepareCaptureRoot(sourceRoot);
      captureHost = prepared.host;
      const captureRoot = prepared.root;

      const canvas = await captureDocumentCanvas(captureRoot, html2canvas);

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
      const totalPages = Math.max(1, Math.ceil(canvas.height / pageSlicePx));

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
      captureHost?.remove();
      if (btn) {
        btn.disabled = false;
        btn.textContent = prev || "Baixar PDF";
      }
    }
  }

  global.vehicleEntryInspectionDocument = {
    injectStylesOnce,
    buildPrintHtml,
    buildEditablePrintHtml,
    buildChecklistSectionEditable,
    printDocument,
    downloadPdf,
    pdfFileName,
  };
})(typeof window !== "undefined" ? window : globalThis);

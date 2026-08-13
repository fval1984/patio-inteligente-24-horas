/**
 * Vistoria de entrada eletrônica — AMPLIGUARD (Gestão de Pátio)
 * Novos veículos: AGUARDANDO_VISTORIA → vistoria → NO_PATIO (VNP)
 */
(function vehicleEntryInspectionModule(global) {
  "use strict";

  const STORAGE_BUCKET = "vehicle-inspection-photos";
  const CLASSIFICATIONS = [
    { id: "BOM", label: "BOM", short: "B" },
    { id: "REGULAR", label: "REGULAR", short: "R" },
    { id: "DANIFICADO", label: "DANIFICADO", short: "D" },
    { id: "SEM_TESTE", label: "SEM TESTE", short: "S" },
    { id: "INEXISTENTE", label: "INEXISTENTE", short: "I" },
  ];

  const CLASS_SHORT = { BOM: "B", REGULAR: "R", DANIFICADO: "D", SEM_TESTE: "S", INEXISTENTE: "I" };

  const checklistMod = global.vehicleEntryInspectionChecklist || {};
  const INSPECTION_CARDS = checklistMod.INSPECTION_CARDS || [];
  const CHECKLIST = checklistMod.CHECKLIST || [];
  const CARD_COUNT = checklistMod.CARD_COUNT || INSPECTION_CARDS.length || 1;

  const DAMAGE_TYPES = [
    "Arranhão",
    "Risco",
    "Amassado",
    "Quebrado",
    "Trincado",
    "Danificado",
    "Falta de peça",
    "Oxidação",
    "Outro",
  ];

  const DIAGRAM_W = 800;
  const DIAGRAM_H = 566;
  const DIAGRAM_SRC = "/vehicle-inspection-diagram-4v.webp";

  let _stylesInjected = false;
  let _modalEl = null;
  let _session = null;
  let _schemaReady = null;

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
      return iso;
    }
  }

  function partnerName(ctx, id) {
    const p = (ctx.partners || []).find((x) => x.id === id);
    return p?.nome || "—";
  }

  function emptyDraft() {
    const classifications = {};
    CHECKLIST.forEach((it) => {
      classifications[it.key] = null;
    });
    return {
      generalNotes: "",
      classifications,
      damages: [],
      diagramMarkers: [],
      pendingPhotos: [],
      standardPhotos: {},
      extraDamagePhotos: [],
      currentPhotoStep: 0,
      currentCardIndex: 0,
    };
  }

  function draftStorageKey(vehicleId) {
    return `vei_draft_v2_${String(vehicleId || "")}`;
  }

  function persistDraftToStorage(vehicleId, draft) {
    if (!vehicleId || !draft) return;
    try {
      const payload = {
        classifications: draft.classifications,
        generalNotes: draft.generalNotes,
        diagramMarkers: draft.diagramMarkers,
        damages: (draft.damages || []).map((d) => ({
          item_key: d.item_key,
          area_label: d.area_label,
          damage_type: d.damage_type,
          severity: d.severity,
          description: d.description,
          notes: d.notes,
          photoPreview: d.photoPreview || null,
        })),
        currentCardIndex: draft.currentCardIndex || 0,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(draftStorageKey(vehicleId), JSON.stringify(payload));
    } catch (e) {
      console.warn("vei draft persist", e);
    }
  }

  function loadDraftFromStorage(vehicleId) {
    if (!vehicleId) return null;
    try {
      const raw = localStorage.getItem(draftStorageKey(vehicleId));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      const draft = emptyDraft();
      if (parsed.classifications && typeof parsed.classifications === "object") {
        Object.keys(parsed.classifications).forEach((k) => {
          if (k in draft.classifications) draft.classifications[k] = parsed.classifications[k];
        });
      }
      draft.generalNotes = parsed.generalNotes || "";
      draft.diagramMarkers = normalizeDiagramMarkers(parsed.diagramMarkers);
      draft.damages = Array.isArray(parsed.damages) ? parsed.damages : [];
      draft.currentCardIndex = Math.max(0, Math.min(CARD_COUNT - 1, Number(parsed.currentCardIndex) || 0));
      return draft;
    } catch (e) {
      return null;
    }
  }

  function clearDraftStorage(vehicleId) {
    try {
      localStorage.removeItem(draftStorageKey(vehicleId));
    } catch (e) {
      /* ignore */
    }
  }

  function cardItemKeys(cardIndex) {
    const card = INSPECTION_CARDS[cardIndex];
    if (!card) return [];
    const keys = [];
    card.blocks.forEach((block) => {
      block.items.forEach((it) => keys.push(it.key));
    });
    return keys;
  }

  function cardItemLabels(cardIndex) {
    const card = INSPECTION_CARDS[cardIndex];
    if (!card) return [];
    const labels = new Map();
    card.blocks.forEach((block) => {
      block.items.forEach((it) => labels.set(it.key, it.label));
    });
    return labels;
  }

  function missingItemsInCard(draft, cardIndex) {
    const labels = cardItemLabels(cardIndex);
    return cardItemKeys(cardIndex)
      .filter((key) => !draft.classifications[key])
      .map((key) => labels.get(key) || key);
  }

  function findCardIndexForItemKey(itemKey) {
    for (let i = 0; i < INSPECTION_CARDS.length; i++) {
      if (cardItemKeys(i).includes(itemKey)) return i;
    }
    return 0;
  }

  function classifiedCount(draft) {
    let done = 0;
    CHECKLIST.forEach((it) => {
      if (draft.classifications[it.key]) done++;
    });
    return done;
  }

  function progressPct(draft) {
    const total = CHECKLIST.length;
    return Math.round((classifiedCount(draft) / total) * 100);
  }

  function missingItems(draft) {
    return CHECKLIST.filter((it) => !draft.classifications[it.key]).map((it) => it.label);
  }

  function scrollToFirstMissingItem(root, draft) {
    const first = CHECKLIST.find((it) => !draft.classifications[it.key]);
    if (!first || !root) return;
    const cardIdx = findCardIndexForItemKey(first.key);
    if (draft.currentCardIndex !== cardIdx) {
      draft.currentCardIndex = cardIdx;
      if (_session?.ctx && _session?.vehicle?.id) {
        persistDraftToStorage(_session.vehicle.id, draft);
      }
      refreshEditUI(root, draft, _session?.ctx);
      return;
    }
    const el = root.querySelector(`.vei-item[data-item-key="${first.key}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("vei-item-highlight");
    window.setTimeout(() => el.classList.remove("vei-item-highlight"), 2800);
  }

  function formatMissingAlert(miss) {
    if (!miss.length) return "";
    if (miss.length <= 14) {
      return miss.map((label) => `• ${label}`).join("\n");
    }
    return (
      miss
        .slice(0, 12)
        .map((label) => `• ${label}`)
        .join("\n") + `\n… e mais ${miss.length - 12} item(ns).`
    );
  }

  function injectStylesOnce() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    if (document.getElementById("veiInspectionStyles")) return;
    const style = document.createElement("style");
    style.id = "veiInspectionStyles";
    style.textContent = `
      .vei-modal-backdrop {
        position: fixed; inset: 0; z-index: 1200;
        background: rgba(2, 6, 23, 0.72); backdrop-filter: blur(8px);
        display: flex; align-items: flex-start; justify-content: center;
        padding: 16px; overflow: auto;
      }
      .vei-modal-backdrop.hidden { display: none !important; }
      .vei-modal {
        width: min(1280px, 100%); max-height: none;
        background: var(--card); border: 1px solid var(--border);
        border-radius: var(--radius); box-shadow: var(--shadow);
        padding: 0; margin: 12px 0 32px;
      }
      .vei-modal-head {
        display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
        padding: 18px 22px; border-bottom: 1px solid var(--border);
        position: sticky; top: 0; z-index: 2;
        background: inherit; border-radius: var(--radius) var(--radius) 0 0;
      }
      .vei-modal-body { padding: 18px 22px 24px; }
      .vei-meta-grid {
        display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 10px 16px; margin-bottom: 18px;
        padding: 14px 16px; border-radius: 12px;
        border: 1px solid rgba(148,163,184,0.16); background: rgba(148,163,184,0.05);
      }
      .vei-meta-grid span { display: block; font-size: 0.72rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
      .vei-meta-grid strong { font-size: 0.95rem; }
      .vei-progress {
        display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap;
      }
      .vei-progress-bar {
        flex: 1 1 200px; height: 8px; border-radius: 999px;
        background: rgba(148,163,184,0.18); overflow: hidden;
      }
      .vei-progress-bar i { display: block; height: 100%; background: linear-gradient(90deg, #d4af37, #34d399); transition: width 0.25s; }
      .vei-layout { display: block; }
      .vei-layout > * { min-width: 0; }
      .vei-section { margin-bottom: 20px; }
      .vei-section h4 {
        margin: 0 0 10px; font-size: 0.78rem; letter-spacing: 0.08em;
        text-transform: uppercase; color: var(--muted);
      }
      .vei-item {
        display: block;
        padding: 6px 0;
        border-bottom: 1px solid rgba(148,163,184,0.1);
      }
      .vei-item.vei-item-pending {
        background: rgba(251, 191, 36, 0.06);
        border-left: 3px solid #fbbf24;
        padding: 6px 0 6px 8px;
        margin-left: -4px;
        border-radius: 0 8px 8px 0;
      }
      .vei-item.vei-item-highlight {
        animation: veiItemPulse 0.85s ease-in-out 3;
      }
      @keyframes veiItemPulse {
        0%, 100% { background: rgba(251, 191, 36, 0.06); }
        50% { background: rgba(251, 191, 36, 0.22); }
      }
      .vei-item-label {
        font-size: 0.82rem;
        font-weight: 600;
        margin-bottom: 5px;
        line-height: 1.25;
      }
      .vei-class-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px;
      }
      .vei-class-btn {
        appearance: none;
        flex: 0 0 auto;
        width: auto;
        min-height: 0;
        border: 1px solid rgba(148,163,184,0.22);
        background: rgba(15,23,42,0.35);
        color: var(--muted);
        border-radius: 6px;
        padding: 4px 7px;
        font-size: 0.62rem;
        font-weight: 700;
        cursor: pointer;
        text-align: center;
        line-height: 1.15;
        white-space: nowrap;
        touch-action: manipulation;
        user-select: none;
        -webkit-user-select: none;
      }
      .vei-class-btn .vei-class-btn-label { pointer-events: none; display: inline; }
      @media (max-width: 900px) {
        .vei-item { padding: 7px 0; }
        .vei-class-row {
          flex-wrap: nowrap;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          gap: 3px;
          padding-bottom: 1px;
        }
        .vei-class-btn {
          padding: 5px 6px;
          font-size: 0.6rem;
          min-height: 30px;
        }
      }
      .vei-class-btn.active {
        border-color: rgba(212,175,55,0.75); color: #fff;
        background: rgba(212,175,55,0.35); box-shadow: inset 0 0 0 2px rgba(212,175,55,0.55);
      }
      .vei-class-btn[data-class="DANIFICADO"].active { border-color: rgba(248,113,113,0.55); background: rgba(248,113,113,0.12); color: #fecaca; }
      .vei-form-legend {
        font-size: 0.78rem; color: var(--muted); margin: 0 0 14px;
        padding: 8px 10px; border: 1px solid rgba(148,163,184,0.2);
        background: rgba(148,163,184,0.06); text-align: center;
      }
      .vei-form-legend strong { color: inherit; font-weight: 800; letter-spacing: 0.04em; }
      .vei-card-form {
        border: 2px solid rgba(148,163,184,0.35); background: rgba(15,23,42,0.25);
        margin-bottom: 16px;
      }
      .vei-card-title {
        font-size: 0.95rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase;
        padding: 10px 12px; border-bottom: 2px solid rgba(148,163,184,0.35);
        background: rgba(148,163,184,0.08);
      }
      .vei-card-num { color: var(--muted); margin-right: 6px; }
      .vei-block-title {
        font-size: 0.72rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
        padding: 8px 12px 4px; color: var(--muted); border-top: 1px solid rgba(148,163,184,0.15);
      }
      .vei-form-table {
        width: 100%; border-collapse: collapse; font-size: 0.78rem;
      }
      .vei-form-table thead th {
        border-bottom: 2px solid rgba(148,163,184,0.35);
        padding: 6px 4px; font-size: 0.68rem; font-weight: 800; text-align: center;
        background: rgba(148,163,184,0.06);
      }
      .vei-form-table .vei-th-item { text-align: left; padding-left: 10px; width: 48%; }
      .vei-form-table .vei-th-cls { width: 10.4%; }
      .vei-form-table tbody td {
        border-bottom: 1px solid rgba(148,163,184,0.12);
        padding: 4px 3px; vertical-align: middle;
      }
      .vei-form-table .vei-td-label {
        padding-left: 10px; font-weight: 600; line-height: 1.25;
      }
      .vei-form-table .vei-td-cls { text-align: center; padding: 3px 2px; }
      .vei-form-table tr.vei-item-pending { background: rgba(251, 191, 36, 0.08); }
      .vei-form-table tr.vei-item-pending .vei-td-label { box-shadow: inset 3px 0 0 #fbbf24; }
      .vei-cell-btn {
        width: 100%; min-width: 28px; max-width: 36px; min-height: 26px;
        padding: 2px 0 !important; margin: 0 auto; display: block;
        border-radius: 2px !important; font-size: 0.68rem !important;
      }
      .vei-form-table .vei-cls-on {
        font-weight: 900; background: rgba(212,175,55,0.25); color: inherit;
      }
      .vei-card-nav {
        display: flex; align-items: center; justify-content: space-between; gap: 10px;
        padding: 12px; border-top: 2px solid rgba(148,163,184,0.35);
        background: rgba(148,163,184,0.04); flex-wrap: wrap;
      }
      .vei-card-progress {
        font-weight: 800; font-size: 0.85rem; letter-spacing: 0.04em;
        padding: 6px 12px; border: 1px solid rgba(148,163,184,0.25);
        background: rgba(15,23,42,0.35);
      }
      #veiCardNext, #veiFinalizeBtn { min-width: 140px; }
      .vei-last-card-extras { margin-top: 4px; }
      .vei-side-panel {
        border: 1px solid rgba(148,163,184,0.16); border-radius: 14px;
        padding: 14px; background: rgba(15,23,42,0.35);
        min-width: 0; max-width: 100%; overflow: hidden;
      }
      .vei-diagram-footer {
        width: 100%; margin: 24px 0 8px; text-align: center; clear: both;
      }
      .vei-diagram-footer > h4 {
        margin: 0 0 12px; font-size: 0.85rem; letter-spacing: 0.04em;
      }
      .vei-diagram-wrap { text-align: center; margin-bottom: 0; width: 100%; max-width: min(640px, 100%); margin-left: auto; margin-right: auto; }
      .vei-diagram { width: 100%; max-width: min(640px, 100%); height: auto; display: block; margin: 0 auto; cursor: crosshair; touch-action: manipulation; }
      .vei-diagram .vei-diagram-img { pointer-events: none; }
      .vei-diagram .vei-marker { fill: #ef4444; stroke: #fff; stroke-width: 2; pointer-events: none; }
      .vei-damage-list { display: flex; flex-direction: column; gap: 10px; margin-top: 10px; }
      .vei-damage-card {
        border: 1px solid rgba(248,113,113,0.28); border-radius: 10px;
        padding: 10px; font-size: 0.82rem; background: rgba(248,113,113,0.06);
      }
      .vei-damage-form {
        display: grid; gap: 8px; margin-top: 10px;
      }
      .vei-damage-form input, .vei-damage-form select, .vei-damage-form textarea {
        width: 100%; border-radius: 8px; border: 1px solid var(--border);
        background: var(--bg); color: inherit; padding: 8px 10px; font: inherit;
      }
      .vei-notes { width: 100%; min-height: 88px; border-radius: 10px; border: 1px solid var(--border); background: var(--bg); color: inherit; padding: 10px 12px; font: inherit; }
      .vei-notes-block { margin-top: 20px; }
      .vei-notes-block label { display: block; font-weight: 600; margin-bottom: 8px; }
      .vei-damage-host-hidden { display: none !important; }
      .vei-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; justify-content: flex-end; }
      .vei-readonly-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
      .vei-readonly-table th, .vei-readonly-table td { border: 1px solid rgba(148,163,184,0.18); padding: 6px 8px; text-align: center; }
      .vei-readonly-table th:first-child, .vei-readonly-table td:first-child { text-align: left; min-width: 140px; }
      .vei-readonly-table .on { background: rgba(212,175,55,0.2); font-weight: 800; }
      .vei-photo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; margin-top: 10px; }
      .vei-photo-grid img { width: 100%; border-radius: 8px; border: 1px solid var(--border); object-fit: cover; aspect-ratio: 4/3; }
    `;
    document.head.appendChild(style);
  }

  function ensureModal() {
    if (_modalEl) return _modalEl;
    injectStylesOnce();
    const backdrop = document.createElement("div");
    backdrop.id = "veiInspectionBackdrop";
    backdrop.className = "vei-modal-backdrop hidden";
    backdrop.innerHTML =
      '<div class="vei-modal" role="dialog" aria-modal="true" aria-labelledby="veiModalTitle">' +
      '<div class="vei-modal-head vei-no-print">' +
      '<div><h3 id="veiModalTitle" style="margin:0">Vistoria de entrada</h3><p class="subtitle" id="veiModalSubtitle" style="margin:4px 0 0"></p></div>' +
      '<button type="button" class="secondary" id="veiModalClose">Fechar</button>' +
      "</div>" +
      '<div class="vei-modal-body" id="veiModalBody"></div>' +
      "</div>";
    document.body.appendChild(backdrop);
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closeModal();
    });
    backdrop.querySelector("#veiModalClose")?.addEventListener("click", closeModal);
    _modalEl = backdrop;
    return backdrop;
  }

  function closeModal() {
    _modalEl?.classList.add("hidden");
    _session = null;
  }

  function diagramMarkerCoords(m) {
    const cx = Number(m?.cx);
    const cy = Number(m?.cy);
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
    if (cx <= 100 && cy <= 100) {
      return { cx: (cx / 100) * DIAGRAM_W, cy: (cy / 100) * DIAGRAM_H };
    }
    return { cx, cy };
  }

  function renderMobilePhotosSection(draft) {
    const mod = global.vehicleEntryInspectionPhotosMobile;
    if (!mod || !mod.isCaptureDevice()) return "";
    return mod.renderSection(draft);
  }

  function refreshMobilePhotosUI(root, draft) {
    const mod = global.vehicleEntryInspectionPhotosMobile;
    if (!mod || !mod.isCaptureDevice()) return;
    const host = root.querySelector("#veiMobilePhotosHost");
    if (!host) return;
    host.innerHTML = mod.renderSection(draft);
    mod.bindEvents(root, draft, () => refreshMobilePhotosUI(root, draft));
  }

  function bindMobilePhotosIfNeeded(root, draft) {
    refreshMobilePhotosUI(root, draft);
  }

  function diagramAbsUrl() {
    try {
      return new URL(DIAGRAM_SRC, global.location?.origin || "").href;
    } catch (e) {
      return DIAGRAM_SRC;
    }
  }

  function renderDiagram(draft, readOnly) {
    const forPrint = readOnly === true || readOnly === "print";
    if (forPrint) return renderDiagramForPrint(draft);
    const markers = draft.diagramMarkers || [];
    const marks = markers
      .map((m) => {
        const p = diagramMarkerCoords(m);
        if (!p) return "";
        return `<circle class="vei-marker" cx="${p.cx}" cy="${p.cy}" r="9"></circle>`;
      })
      .join("");
    const src = esc(diagramAbsUrl());
    return (
      '<div class="vei-diagram-wrap">' +
      `<svg class="vei-diagram" viewBox="0 0 ${DIAGRAM_W} ${DIAGRAM_H}" style="max-width:100%;height:auto" aria-label="Diagrama do veículo — 4 vistas">` +
      `<image class="vei-diagram-img" href="${src}" xlink:href="${src}" x="0" y="0" width="${DIAGRAM_W}" height="${DIAGRAM_H}" preserveAspectRatio="xMidYMid meet"/>` +
      `<rect class="vei-diagram-hit" x="0" y="0" width="${DIAGRAM_W}" height="${DIAGRAM_H}" fill="transparent"/>` +
      marks +
      "</svg></div>"
    );
  }

  /** Diagrama para impressão/PDF — img + SVG overlay (html2canvas imprime melhor que SVG &lt;image&gt;). */
  function renderDiagramForPrint(draft) {
    const markers = draft.diagramMarkers || [];
    const marks = markers
      .map((m) => {
        const p = diagramMarkerCoords(m);
        if (!p) return "";
        return `<circle fill="#dc2626" stroke="#fff" stroke-width="2" cx="${p.cx}" cy="${p.cy}" r="9"></circle>`;
      })
      .join("");
    const src = esc(diagramAbsUrl());
    return (
      '<div class="vei-doc-diagram-stack" style="position:relative;width:100%;max-width:800px;margin:0 auto;">' +
      `<img class="vei-doc-diagram-img" src="${src}" alt="Diagrama do veículo — 4 vistas" crossorigin="anonymous" loading="eager" style="width:100%;height:auto;display:block;"/>` +
      `<svg class="vei-doc-diagram-markers" viewBox="0 0 ${DIAGRAM_W} ${DIAGRAM_H}" aria-hidden="true" style="position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;">` +
      marks +
      "</svg></div>"
    );
  }

  function normalizeDiagramMarkers(raw) {
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  }

  function svgPointFromEvent(svg, evt) {
    if (!svg || !evt) return null;
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const vb = svg.viewBox.baseVal;
    const vw = vb.width || DIAGRAM_W;
    const vh = vb.height || DIAGRAM_H;
    const vx = vb.x || 0;
    const vy = vb.y || 0;
    let clientX = evt.clientX;
    let clientY = evt.clientY;
    if (evt.touches && evt.touches[0]) {
      clientX = evt.touches[0].clientX;
      clientY = evt.touches[0].clientY;
    }
    const x = ((clientX - rect.left) / rect.width) * vw + vx;
    const y = ((clientY - rect.top) / rect.height) * vh + vy;
    if (x < 0 || y < 0 || x > vx + vw || y > vy + vh) return null;
    return { cx: Math.round(x * 10) / 10, cy: Math.round(y * 10) / 10 };
  }

  function eventTargetElement(evt) {
    const t = evt?.target;
    if (!t) return null;
    if (t.nodeType === 1) return t;
    return t.parentElement || null;
  }

  function syncClassificationsFromDom(root, draft) {
    if (!root || !draft?.classifications) return;
    root.querySelectorAll(".vei-item[data-item-key]").forEach((row) => {
      const key = row.getAttribute("data-item-key");
      if (!key) return;
      const activeBtn = row.querySelector(".vei-class-btn.active[data-class]");
      if (activeBtn) {
        const cls = activeBtn.getAttribute("data-class");
        if (cls) draft.classifications[key] = cls;
      }
    });
  }

  function buildInspectionItemsPayload(draft) {
    return CHECKLIST.map((it) => ({
      category: it.category,
      item_key: it.key,
      item_label: it.label,
      classification: draft.classifications[it.key] || "",
    }));
  }

  function handleEditModalInteraction(evt) {
    const draft = _session?.draft;
    const ctx = _session?.ctx;
    if (!draft || _session.mode !== "edit" || !ctx) return;

    const root = document.getElementById("veiModalBody");
    if (!root) return;

    const hit = eventTargetElement(evt);
    if (!hit) return;

    const classBtn = hit.closest?.(".vei-class-btn[data-class]");
    if (classBtn && root.contains(classBtn)) {
      evt.preventDefault();
      const itemKey = classBtn.getAttribute("data-item");
      const cls = classBtn.getAttribute("data-class");
      if (itemKey && cls) {
        draft.classifications[itemKey] = cls;
        if (_session?.vehicle?.id) persistDraftToStorage(_session.vehicle.id, draft);
        refreshEditUI(root, draft, ctx);
      }
      return;
    }

    const diagramSvg = hit.closest?.("svg.vei-diagram");
    if (diagramSvg && root.contains(diagramSvg) && !hit.classList?.contains("vei-marker")) {
      const pt = svgPointFromEvent(diagramSvg, evt);
      if (pt) {
        draft.diagramMarkers.push(pt);
        if (_session?.vehicle?.id) persistDraftToStorage(_session.vehicle.id, draft);
        refreshEditUI(root, draft, ctx);
      }
      return;
    }

    const addDmgBtn = hit.closest?.(".vei-add-damage-btn");
    if (addDmgBtn && root.contains(addDmgBtn)) {
      openDamageForm(root, draft, ctx, addDmgBtn.getAttribute("data-damage-item"));
      return;
    }

    const rmDmgBtn = hit.closest?.(".vei-remove-damage");
    if (rmDmgBtn && root.contains(rmDmgBtn)) {
      draft.damages.splice(Number(rmDmgBtn.getAttribute("data-damage-idx")), 1);
      refreshEditUI(root, draft, ctx);
      return;
    }

    if (hit.closest?.("#veiCardPrev")) {
      evt.preventDefault();
      syncClassificationsFromDom(root, draft);
      if ((draft.currentCardIndex || 0) > 0) {
        draft.currentCardIndex = (draft.currentCardIndex || 0) - 1;
        if (_session?.vehicle?.id) persistDraftToStorage(_session.vehicle.id, draft);
        refreshEditUI(root, draft, ctx);
      }
      return;
    }

    if (hit.closest?.("#veiCardNext")) {
      evt.preventDefault();
      syncClassificationsFromDom(root, draft);
      const cardIdx = draft.currentCardIndex || 0;
      const missCard = missingItemsInCard(draft, cardIdx);
      if (missCard.length) {
        alert(
          `Preencha todos os itens deste card antes de continuar.\n\nPendentes (${missCard.length}):\n${formatMissingAlert(missCard)}`
        );
        return;
      }
      draft.currentCardIndex = Math.min(CARD_COUNT - 1, cardIdx + 1);
      if (_session?.vehicle?.id) persistDraftToStorage(_session.vehicle.id, draft);
      refreshEditUI(root, draft, ctx);
      root.scrollTop = 0;
      return;
    }

    if (hit.closest?.("#veiFinalizeBtn")) {
      evt.preventDefault();
      syncClassificationsFromDom(root, draft);
      finalizeInspection(root, draft, ctx);
      return;
    }

    if (hit.closest?.("#veiModalCloseInner")) {
      closeModal();
    }
  }

  function ensureModalInteraction() {
    const backdrop = ensureModal();
    if (backdrop.dataset.veiInteractionBound === "1") return;
    backdrop.dataset.veiInteractionBound = "1";
    backdrop.addEventListener("click", handleEditModalInteraction);
    backdrop.addEventListener("input", (evt) => {
      if (evt.target?.id === "veiGeneralNotes" && _session?.draft) {
        _session.draft.generalNotes = evt.target.value;
        if (_session?.vehicle?.id) persistDraftToStorage(_session.vehicle.id, _session.draft);
      }
    });
  }

  function ensureEditModalEvents(root, ctx) {
    ensureModalInteraction();
    if (root && ctx) {
      _session.ctx = ctx;
    }
  }

  function renderFormLegend() {
    return (
      '<div class="vei-form-legend">' +
      "Legenda: " +
      '<strong>B</strong> — Bom · <strong>R</strong> — Regular · <strong>D</strong> — Danificado · ' +
      "<strong>S</strong> — Sem Teste · <strong>I</strong> — Inexistente" +
      "</div>"
    );
  }

  function renderCardStep(cardIndex, draft, readOnly) {
    const card = INSPECTION_CARDS[cardIndex];
    if (!card) return "";
    const isLast = cardIndex === CARD_COUNT - 1;
    let html = '<div class="vei-card-form">';
    html += `<div class="vei-card-title"><span class="vei-card-num">${cardIndex + 1}.</span> ${esc(card.title)}</div>`;

    card.blocks.forEach((block, blockIdx) => {
      if (block.title) {
        html += `<div class="vei-block-title">${esc(block.title)}</div>`;
      } else if (blockIdx > 0 && card.blocks.length > 1) {
        html += `<div class="vei-block-title">Bloco ${blockIdx + 1}</div>`;
      }
      html += '<table class="vei-form-table"><thead><tr><th class="vei-th-item">Item</th>';
      CLASSIFICATIONS.forEach((c) => {
        html += `<th class="vei-th-cls">${esc(CLASS_SHORT[c.id] || c.label.charAt(0))}</th>`;
      });
      html += "</tr></thead><tbody>";
      block.items.forEach((it) => {
        const sel = draft.classifications[it.key];
        html += `<tr class="vei-item${!readOnly && !sel ? " vei-item-pending" : ""}" data-item-key="${esc(it.key)}">`;
        html += `<td class="vei-td-label">${esc(it.label)}`;
        if (!readOnly && sel === "DANIFICADO") {
          html += ` <button type="button" class="secondary vei-add-damage-btn" data-damage-item="${esc(it.key)}" style="font-size:0.68rem;padding:2px 6px;margin-left:4px">+ Avaria</button>`;
        }
        html += "</td>";
        CLASSIFICATIONS.forEach((c) => {
          const short = CLASS_SHORT[c.id] || c.label.charAt(0);
          if (readOnly) {
            html += `<td class="vei-td-cls${sel === c.id ? " vei-cls-on" : ""}">${sel === c.id ? esc(short) : ""}</td>`;
          } else {
            html += `<td class="vei-td-cls"><button type="button" class="vei-class-btn vei-cell-btn${sel === c.id ? " active" : ""}" data-class="${c.id}" data-item="${esc(it.key)}" aria-label="${esc(c.label)}" title="${esc(c.label)}">${esc(short)}</button></td>`;
          }
        });
        html += "</tr>";
      });
      html += "</tbody></table>";
    });

    if (!readOnly && !isLast) {
      html += '<div class="vei-card-nav">';
      html += `<button type="button" class="secondary vei-card-prev" id="veiCardPrev"${cardIndex === 0 ? " disabled" : ""}>Anterior</button>`;
      html += `<span class="vei-card-progress" id="veiCardProgress">${cardIndex + 1} / ${CARD_COUNT}</span>`;
      html += '<button type="button" id="veiCardNext">OK, próximo</button>';
      html += "</div>";
    }
    html += "</div>";
    return html;
  }

  function renderLastCardExtras(draft) {
    const cardIdx = CARD_COUNT - 1;
    return (
      '<div class="vei-last-card-extras">' +
      '<div class="vei-diagram-footer">' +
      "<h4>Diagrama de avarias — 4 vistas</h4>" +
      '<div id="veiDiagramHost">' +
      renderDiagram(draft, false) +
      "</div></div>" +
      '<div id="veiMobilePhotosHost">' +
      renderMobilePhotosSection(draft) +
      "</div>" +
      '<div class="vei-notes-block">' +
      '<label for="veiGeneralNotes">Observações gerais da vistoria</label>' +
      `<textarea class="vei-notes" id="veiGeneralNotes" placeholder="Informações adicionais…">${esc(draft.generalNotes)}</textarea>` +
      "</div>" +
      '<div class="vei-card-nav">' +
      `<button type="button" class="secondary vei-card-prev" id="veiCardPrev"${cardIdx === 0 ? " disabled" : ""}>Anterior</button>` +
      `<span class="vei-card-progress" id="veiCardProgress">${cardIdx + 1} / ${CARD_COUNT}</span>` +
      '<button type="button" id="veiFinalizeBtn">Finalizar vistoria</button>' +
      "</div>" +
      '<div class="vei-actions vei-no-print">' +
      '<button type="button" class="secondary" id="veiModalCloseInner">Cancelar</button>' +
      "</div></div>"
    );
  }

  /** Legado: todas as seções (somente consulta interna). */
  function renderChecklistRows(draft, readOnly) {
    let html = "";
    INSPECTION_CARDS.forEach((card, idx) => {
      html += renderCardStep(idx, draft, readOnly);
    });
    return html;
  }

  function renderDamageList(draft, readOnly) {
    if (!draft.damages.length) return '<p class="notice" style="margin:0">Nenhuma avaria registrada.</p>';
    return (
      '<div class="vei-damage-list">' +
      draft.damages
        .map(
          (d, idx) =>
            `<div class="vei-damage-card" data-damage-idx="${idx}">` +
            `<strong>${esc(d.area_label || d.item_key || "Área")}</strong> — ${esc(d.damage_type || "—")}` +
            (d.description ? `<div>${esc(d.description)}</div>` : "") +
            (d.notes ? `<div class="notice">${esc(d.notes)}</div>` : "") +
            (d.photoPreview ? `<img src="${d.photoPreview}" alt="Foto avaria" style="max-width:120px;margin-top:6px;border-radius:8px"/>` : "") +
            (!readOnly ? `<button type="button" class="secondary vei-remove-damage" data-damage-idx="${idx}" style="margin-top:6px">Remover</button>` : "") +
            `</div>`
        )
        .join("") +
      "</div>"
    );
  }

  function renderVehicleMeta(vehicle, ctx, inspection) {
    const inspLine = inspection
      ? `<div><span>Nº vistoria</span><strong>${esc(inspection.inspection_number)}</strong></div>` +
        `<div><span>Data/hora</span><strong>${esc(fmtDateTime(inspection.completed_at))}</strong></div>` +
        `<div><span>Responsável</span><strong>${esc(inspection.completed_by_name || "—")}</strong></div>` +
        `<div><span>Status</span><strong>CONCLUÍDA</strong></div>`
      : `<div><span>Data/hora vistoria</span><strong>${esc(fmtDateTime(new Date().toISOString()))}</strong></div>`;
    return (
      '<div class="vei-meta-grid">' +
      `<div><span>Placa</span><strong>${esc(vehicle.placa || "—")}</strong></div>` +
      `<div><span>Marca / Modelo</span><strong>${esc([vehicle.marca, vehicle.modelo].filter(Boolean).join(" ") || "—")}</strong></div>` +
      `<div><span>Ano</span><strong>${esc(vehicle.ano || "—")}</strong></div>` +
      `<div><span>Cor</span><strong>${esc(vehicle.cor || "—")}</strong></div>` +
      `<div><span>Chassi</span><strong>${esc(vehicle.chassi || "—")}</strong></div>` +
      `<div><span>Entrada</span><strong>${esc(ctx.formatDateTime ? ctx.formatDateTime(vehicle.data_entrada) : fmtDateTime(vehicle.data_entrada))}</strong></div>` +
      `<div><span>RPV</span><strong>${esc(partnerName(ctx, vehicle.localizador_id))}</strong></div>` +
      inspLine +
      "</div>"
    );
  }

  function bindEditEvents(root, draft, ctx) {
    ensureEditModalEvents(root, ctx);
  }

  function openDamageForm(root, draft, ctx, itemKey, areaLabel) {
    const item = CHECKLIST.find((x) => x.key === itemKey);
    const label = areaLabel || item?.label || itemKey;
    const formHtml =
      '<div class="vei-damage-form" id="veiDamageForm">' +
      `<p class="notice" style="margin:0 0 6px">Registrar avaria: <strong>${esc(label)}</strong></p>` +
      '<label>Tipo<input id="veiDmgType" list="veiDmgTypes"/></label>' +
      '<datalist id="veiDmgTypes">' +
      DAMAGE_TYPES.map((t) => `<option value="${esc(t)}"></option>`).join("") +
      "</datalist>" +
      '<label>Gravidade<select id="veiDmgSeverity"><option value="">—</option><option>Leve</option><option>Média</option><option>Grave</option></select></label>' +
      '<label>Descrição<textarea id="veiDmgDesc" rows="2"></textarea></label>' +
      '<label>Observação<textarea id="veiDmgNotes" rows="2"></textarea></label>' +
      '<label>Foto<input type="file" id="veiDmgPhoto" accept="image/*" capture="environment"/></label>' +
      '<div style="display:flex;gap:8px;margin-top:6px">' +
      '<button type="button" id="veiDmgSave">Salvar avaria</button>' +
      '<button type="button" class="secondary" id="veiDmgCancel">Cancelar</button>' +
      "</div></div>";
    const host = root.querySelector("#veiDamageFormHost");
    if (!host) return;
    host.innerHTML = formHtml;
    host.querySelector("#veiDmgCancel")?.addEventListener("click", () => {
      host.innerHTML = "";
    });
    host.querySelector("#veiDmgSave")?.addEventListener("click", async () => {
      const damage = {
        item_key: itemKey,
        area_label: label,
        damage_type: host.querySelector("#veiDmgType")?.value || "Outro",
        severity: host.querySelector("#veiDmgSeverity")?.value || "",
        description: host.querySelector("#veiDmgDesc")?.value || "",
        notes: host.querySelector("#veiDmgNotes")?.value || "",
        photoFile: host.querySelector("#veiDmgPhoto")?.files?.[0] || null,
        photoPreview: null,
      };
      if (damage.photoFile) {
        damage.photoPreview = await readFileAsDataUrl(damage.photoFile);
      }
      draft.damages.push(damage);
      host.innerHTML = "";
      refreshEditUI(root, draft, ctx);
    });
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ""));
      r.onerror = () => resolve("");
      r.readAsDataURL(file);
    });
  }

  function refreshEditUI(root, draft, ctx) {
    const cardIdx = Math.max(0, Math.min(CARD_COUNT - 1, draft.currentCardIndex || 0));
    draft.currentCardIndex = cardIdx;
    const done = classifiedCount(draft);
    const total = CHECKLIST.length;
    const pct = progressPct(draft);
    const miss = missingItems(draft);
    const cardHost = root.querySelector("#veiCardHost");
    const extrasHost = root.querySelector("#veiLastCardExtrasHost");
    const progressText = root.querySelector("#veiProgressText");
    const progressBar = root.querySelector("#veiProgressBar i");
    if (progressText) {
      progressText.textContent = `Vistoria: card ${cardIdx + 1}/${CARD_COUNT} · ${done}/${total} itens (${pct}%)`;
    }
    if (progressBar) progressBar.style.width = `${pct}%`;
    if (cardHost) cardHost.innerHTML = renderCardStep(cardIdx, draft, false);
    if (extrasHost) {
      extrasHost.innerHTML = cardIdx === CARD_COUNT - 1 ? renderLastCardExtras(draft) : "";
      if (cardIdx === CARD_COUNT - 1) {
        bindMobilePhotosIfNeeded(extrasHost, draft);
      }
    } else if (cardIdx === CARD_COUNT - 1) {
      const diagramHost = root.querySelector("#veiDiagramHost");
      if (diagramHost) diagramHost.innerHTML = renderDiagram(draft, false);
      refreshMobilePhotosUI(root, draft);
    }
    const warn = root.querySelector("#veiMissingWarn");
    if (warn) {
      warn.textContent = miss.length
        ? `Itens pendentes no total (${miss.length}). Use «OK, próximo» em cada card — o sistema indica o que falta.`
        : "Checklist completo — pode finalizar a vistoria no último card.";
      warn.style.color = miss.length ? "#fbbf24" : "#34d399";
    }
  }

  function buildEditHtml(vehicle, ctx, draft) {
    const cardIdx = Math.max(0, Math.min(CARD_COUNT - 1, draft.currentCardIndex || 0));
    draft.currentCardIndex = cardIdx;
    const done = classifiedCount(draft);
    const total = CHECKLIST.length;
    const pct = progressPct(draft);
    const miss = missingItems(draft);
    return (
      renderVehicleMeta(vehicle, ctx, null) +
      `<div class="vei-progress"><span id="veiProgressText">Vistoria: card ${cardIdx + 1}/${CARD_COUNT} · ${done}/${total} itens (${pct}%)</span>` +
      `<div class="vei-progress-bar" id="veiProgressBar"><i style="width:${pct}%"></i></div></div>` +
      `<p id="veiMissingWarn" class="notice" style="margin:0 0 12px;color:${miss.length ? "#fbbf24" : "#34d399"}">${
        miss.length
          ? `Itens pendentes no total (${miss.length}). Preencha um card por vez.`
          : "Checklist completo — finalize no último card."
      }</p>` +
      renderFormLegend() +
      '<div id="veiCardHost">' +
      renderCardStep(cardIdx, draft, false) +
      "</div>" +
      '<div id="veiLastCardExtrasHost">' +
      (cardIdx === CARD_COUNT - 1 ? renderLastCardExtras(draft) : "") +
      "</div>" +
      '<div id="veiDamageFormHost"></div>' +
      '<div id="veiDamageListHost" class="vei-damage-host-hidden" aria-hidden="true"></div>'
    );
  }

  function buildReadonlyHtml(vehicle, ctx, inspection, detail) {
    const draft = detailToDraft(detail);
    const docMod = global.vehicleEntryInspectionDocument;
    const documentHtml = docMod
      ? docMod.buildPrintHtml({
          vehicle,
          ctx: { ...ctx, partnerName: (c, id) => partnerName(c, id) },
          inspection,
          detail,
          draft,
          helpers: {
            CHECKLIST,
            INSPECTION_CARDS,
            CLASSIFICATIONS,
            CLASS_SHORT,
            fmtDateTime,
            renderDiagram,
            renderDiagramForPrint,
          },
        })
      : `<div class="vei-print-root"><p>Documento indisponível.</p></div>`;

    return (
      documentHtml +
      '<div class="vei-actions vei-no-print">' +
      '<button type="button" class="secondary" id="veiPrintBtn">🖨️ Imprimir vistoria</button>' +
      '<button type="button" id="veiPdfBtn">⬇️ Baixar vistoria</button>' +
      '<button type="button" class="secondary" id="veiModalCloseInner">Fechar</button>' +
      "</div>"
    );
  }

  function detailToDraft(detail) {
    const draft = emptyDraft();
    draft.generalNotes = detail.inspection?.general_notes || "";
    draft.diagramMarkers = normalizeDiagramMarkers(detail.inspection?.diagram_markers);
    (detail.items || []).forEach((it) => {
      draft.classifications[it.item_key] = it.classification;
    });
    draft.damages = (detail.damages || []).map((d) => ({
      id: d.id,
      item_key: d.item_key,
      area_label: d.area_label,
      damage_type: d.damage_type,
      severity: d.severity,
      description: d.description,
      notes: d.notes,
      photoPreview: (detail.photos || []).find((p) => p.damage_id === d.id)?.url || null,
    }));
    return draft;
  }

  async function probeSchema(ctx) {
    if (_schemaReady != null) return _schemaReady;
    if (!ctx.supabase || !ctx.effectiveUserId()) {
      _schemaReady = false;
      return false;
    }
    const { error } = await ctx.supabase
      .from("vehicle_entry_inspections")
      .select("id")
      .eq("user_id", ctx.effectiveUserId())
      .limit(1);
    _schemaReady = !error || !/relation|schema cache|does not exist|PGRST205/i.test(error.message || "");
    return _schemaReady;
  }

  async function loadInspectionDetail(ctx, inspectionId) {
    const uid = ctx.effectiveUserId();
    const { data: inspection, error } = await ctx.supabase
      .from("vehicle_entry_inspections")
      .select("*")
      .eq("id", inspectionId)
      .eq("user_id", uid)
      .maybeSingle();
    if (error || !inspection) return null;

    const [{ data: items }, { data: damages }, { data: photos }] = await Promise.all([
      ctx.supabase.from("vehicle_entry_inspection_items").select("*").eq("inspection_id", inspectionId),
      ctx.supabase.from("vehicle_entry_inspection_damages").select("*").eq("inspection_id", inspectionId),
      ctx.supabase.from("vehicle_entry_inspection_photos").select("*").eq("inspection_id", inspectionId),
    ]);

    const photoUrls = [];
    for (const p of photos || []) {
      let url = "";
      if (p.storage_path && ctx.supabase) {
        const signed = await ctx.supabase.storage.from(STORAGE_BUCKET).createSignedUrl(p.storage_path, 3600);
        url = signed.data?.signedUrl || "";
      }
      photoUrls.push({ ...p, url });
    }

    return { inspection, items: items || [], damages: damages || [], photos: photoUrls };
  }

  async function findCompletedInspectionForVehicle(ctx, vehicleId) {
    const uid = ctx.effectiveUserId();
    const { data } = await ctx.supabase
      .from("vehicle_entry_inspections")
      .select("*")
      .eq("user_id", uid)
      .eq("vehicle_id", vehicleId)
      .eq("inspection_type", "ENTRADA")
      .eq("status", "CONCLUIDA")
      .maybeSingle();
    return data || null;
  }

  async function uploadPhotos(ctx, inspectionId, damages) {
    const uid = ctx.effectiveUserId();
    if (!ctx.supabase || !uid) return;
    for (let i = 0; i < damages.length; i++) {
      const d = damages[i];
      if (!d.photoFile && !d.photoPreview) continue;
      try {
        let blob;
        if (d.photoFile) blob = d.photoFile;
        else {
          const res = await fetch(d.photoPreview);
          blob = await res.blob();
        }
        const safeName = String(d.photoFile?.name || `avaria_${i}.jpg`).replace(/[^\w.\-]+/g, "_").slice(0, 80);
        const path = `${uid}/inspections/${inspectionId}/${Date.now()}_${safeName}`;
        const { error: upErr } = await ctx.supabase.storage.from(STORAGE_BUCKET).upload(path, blob, {
          upsert: true,
          contentType: blob.type || "image/jpeg",
        });
        if (!upErr) {
          await ctx.supabase.from("vehicle_entry_inspection_photos").insert({
            inspection_id: inspectionId,
            storage_path: path,
            file_name: safeName,
          });
        }
      } catch (e) {
        console.warn("vei photo upload", e);
      }
    }
  }

  async function finalizeInspection(root, draft, ctx) {
    syncClassificationsFromDom(root, draft);
    const miss = missingItems(draft);
    if (miss.length) {
      scrollToFirstMissingItem(root, draft);
      alert(
        `Classifique todos os ${CHECKLIST.length} itens do checklist antes de finalizar.\n\n` +
          `Pendentes (${miss.length}):\n${formatMissingAlert(miss)}\n\n` +
          `Dica: toque no botão (BOM, REGULAR, etc.) até a linha deixar de ficar amarela.`
      );
      return;
    }
    const btn = root.querySelector("#veiFinalizeBtn");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Finalizando…";
    }
    try {
      const session = await ctx.getAccessToken();
      if (!session) {
        alert("Sessão expirada. Entre novamente.");
        return;
      }
      const items = buildInspectionItemsPayload(draft);
      const damages = draft.damages.map((d) => ({
        item_key: d.item_key,
        area_label: d.area_label,
        damage_type: d.damage_type,
        severity: d.severity,
        description: d.description,
        notes: d.notes,
      }));
      const res = await fetch("/api/vehicles/complete-entry-inspection", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session}` },
        body: JSON.stringify({
          access_token: session,
          vehicle_id: _session.vehicle.id,
          general_notes: draft.generalNotes,
          diagram_markers: normalizeDiagramMarkers(draft.diagramMarkers),
          items,
          damages,
        }),
      });
      let json = {};
      try {
        json = await res.json();
      } catch (parseErr) {
        console.error("vei finalize parse", parseErr);
        alert(
          res.ok
            ? "Vistoria pode ter sido gravada, mas a resposta do servidor foi inválida. Atualize a página e verifique o VNP."
            : "Não foi possível finalizar a vistoria (resposta inválida do servidor)."
        );
        return;
      }
      if (!res.ok || !json.ok) {
        const errMsg = json.error || "Não foi possível finalizar a vistoria.";
        if (/checklist|classificad|item\(ns\)|pendente/i.test(errMsg)) {
          scrollToFirstMissingItem(root, draft);
        }
        alert(errMsg);
        return;
      }

      let postWarn = "";
      try {
        await uploadPhotos(ctx, json.inspection_id, draft.damages);
      } catch (photoErr) {
        console.warn("vei damage photos", photoErr);
        postWarn += "\n\nAviso: algumas fotos de avaria podem não ter sido enviadas.";
      }
      try {
        if (global.vehicleEntryInspectionPhotosMobile?.uploadAll) {
          await global.vehicleEntryInspectionPhotosMobile.uploadAll(
            ctx,
            json.inspection_id,
            _session.vehicle.id,
            draft,
            {
              inspectorName: json.inspector_name,
              inspectorUserId: ctx.effectiveUserId(),
            }
          );
        }
      } catch (mobilePhotoErr) {
        console.warn("vei mobile photos", mobilePhotoErr);
        postWarn += "\n\nAviso: algumas fotos do registro mobile podem não ter sido enviadas.";
      }
      try {
        if (typeof ctx.loadVehicles === "function") await ctx.loadVehicles();
        if (typeof ctx.loadVehicleInspections === "function") await ctx.loadVehicleInspections();
        if (typeof ctx.renderVehicles === "function") ctx.renderVehicles();
      } catch (reloadErr) {
        console.warn("vei reload after finalize", reloadErr);
      }

      const wasEntryFlow = !_session.retroactive;
      const completedVehicle = _session.vehicle;
      clearDraftStorage(completedVehicle?.id);
      alert(
        `Vistoria nº ${json.inspection_number} concluída.\nResponsável: ${json.inspector_name || "—"}\nData: ${fmtDateTime(json.completed_at)}${postWarn}`
      );
      closeModal();
      try {
        if (wasEntryFlow && typeof ctx.onInspectionCompleted === "function") {
          ctx.onInspectionCompleted(completedVehicle, {
            inspectionId: json.inspection_id,
            inspectionNumber: json.inspection_number,
          });
        }
      } catch (navErr) {
        console.warn("vei onInspectionCompleted", navErr);
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao finalizar vistoria. Verifique se a vistoria foi gravada e atualize a página.");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Finalizar vistoria";
      }
    }
  }

  async function downloadPdf(ctx, vehicle, inspection, detail) {
    if (global.vehicleEntryInspectionDocument?.downloadPdf) {
      await global.vehicleEntryInspectionDocument.downloadPdf(ctx, vehicle, inspection, detail);
      return;
    }
    alert("Módulo de PDF indisponível. Atualize a página.");
  }

  function openEditModal(vehicle, ctx, opts) {
    ensureModal();
    const retroactive = !!opts?.retroactive;
    const saved = loadDraftFromStorage(vehicle.id);
    const draft = saved || emptyDraft();
    _session = { vehicle, mode: "edit", draft, retroactive, ctx };
    const modal = _modalEl;
    modal.classList.remove("hidden");
    document.getElementById("veiModalTitle").textContent = "Vistoria do veículo";
    document.getElementById("veiModalSubtitle").textContent = retroactive
      ? `Placa ${vehicle.placa || "—"} — vistoria retroativa · preencha card a card`
      : `Placa ${vehicle.placa || "—"} — um card por vez (${CARD_COUNT} etapas)`;
    const body = document.getElementById("veiModalBody");
    body.innerHTML = buildEditHtml(vehicle, ctx, _session.draft);
    ensureEditModalEvents(body, ctx);
    bindMobilePhotosIfNeeded(body, _session.draft);
  }

  async function openViewModal(vehicle, ctx, inspectionId) {
    ensureModal();
    const detail = await loadInspectionDetail(ctx, inspectionId);
    if (!detail) {
      alert("Vistoria não encontrada.");
      return;
    }
    _session = { vehicle, mode: "view", detail };
    const modal = _modalEl;
    modal.classList.remove("hidden");
    document.getElementById("veiModalTitle").textContent = `Vistoria de entrada nº ${detail.inspection.inspection_number}`;
    document.getElementById("veiModalSubtitle").textContent = `Placa ${vehicle.placa || "—"} — consulta`;
    const body = document.getElementById("veiModalBody");
    body.innerHTML = buildReadonlyHtml(vehicle, ctx, detail.inspection, detail);
    body.querySelector("#veiModalCloseInner")?.addEventListener("click", closeModal);
    body.querySelector("#veiPrintBtn")?.addEventListener("click", () => {
      const root = body.querySelector("#veiPrintDocument") || body.querySelector(".vei-print-root");
      if (global.vehicleEntryInspectionDocument?.printDocument) {
        global.vehicleEntryInspectionDocument.printDocument(root, detail.inspection);
      } else {
        alert("Impressão indisponível. Atualize a página e tente novamente.");
      }
    });
    body.querySelector("#veiPdfBtn")?.addEventListener("click", () => downloadPdf(ctx, vehicle, detail.inspection, detail));
  }

  function canStartInspection(vehicle, ctx) {
    if (!vehicle) return false;
    const s = String(vehicle.status || "").toUpperCase();
    if (s === "REMOVIDO") return false;
    if (vehicleHasCompletedInspection(ctx, vehicle.id)) return false;
    if (s === "AGUARDANDO_VISTORIA") return true;
    if (typeof ctx.isVehicleOnPatio === "function") return ctx.isVehicleOnPatio(vehicle);
    return s !== "REMOVIDO" && s !== "AGUARDANDO_VISTORIA";
  }

  async function openForVehicle(vehicle, ctx, opts) {
    if (!(await probeSchema(ctx))) {
      alert(
        "A vistoria eletrônica ainda não está disponível nesta base.\n\nExecute supabase/vehicle_entry_inspections.sql no SQL Editor do Supabase."
      );
      return;
    }
    if (opts?.mode === "view") {
      const insp = opts.inspection || (await findCompletedInspectionForVehicle(ctx, vehicle.id));
      if (!insp) {
        alert("Este veículo não possui vistoria eletrônica concluída.");
        return;
      }
      await openViewModal(vehicle, ctx, insp.id);
      return;
    }
    if (!canStartInspection(vehicle, ctx)) {
      if (vehicleHasCompletedInspection(ctx, vehicle.id)) {
        alert("Este veículo já possui vistoria de entrada concluída.");
      } else {
        alert("Este veículo não está disponível para vistoria.");
      }
      return;
    }
    const retroactive = String(vehicle.status || "").toUpperCase() !== "AGUARDANDO_VISTORIA";
    openEditModal(vehicle, ctx, { retroactive });
  }

  function renderAwaitingTable(tbody, vehicles, ctx) {
    if (!tbody) return;
    const list = (vehicles || []).filter((v) => v.status === "AGUARDANDO_VISTORIA");
    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="9" class="notice" style="text-align:center;padding:18px">Nenhum veículo aguardando vistoria.</td></tr>`;
      return;
    }
    tbody.innerHTML = list
      .map((v) => {
        const loc = partnerName(ctx, v.localizador_id);
        const isGp = !!ctx.isGestorPista;
        const isAdmPc = !!ctx.isAdmDesktopPc;
        let actions = "";
        if (isGp) {
          actions = `<button class="secondary" data-action="vistoria" data-id="${v.id}">Vistoria</button>`;
        } else if (isAdmPc) {
          actions =
            `<button class="secondary" data-action="editar" data-id="${v.id}">Editar</button>` +
            `<button class="secondary" data-action="apagar" data-id="${v.id}">Apagar</button>`;
        } else {
          actions =
            `<button class="secondary" data-action="vistoria" data-id="${v.id}">Vistoria</button>` +
            `<button class="secondary" data-action="editar" data-id="${v.id}">Editar</button>` +
            `<button class="secondary" data-action="apagar" data-id="${v.id}">Apagar</button>`;
        }
        return (
          `<tr data-vehicle-row="${v.id}">` +
          `<td data-label="Placa">${esc(v.placa || "—")}</td>` +
          `<td data-label="Marca">${esc(v.marca || "—")}</td>` +
          `<td data-label="Modelo">${esc(v.modelo || "—")}</td>` +
          `<td data-label="Ano">${esc(v.ano || "—")}</td>` +
          `<td data-label="Cor">${esc(v.cor || "—")}</td>` +
          `<td data-label="Entrada">${esc(ctx.formatDateTime ? ctx.formatDateTime(v.data_entrada) : fmtDateTime(v.data_entrada))}</td>` +
          `<td data-label="RPV">${esc(loc)}</td>` +
          `<td data-label="Status"><span class="tag warning">Aguardando vistoria</span></td>` +
          `<td class="actions" data-label="Ações">${actions}</td>` +
          `</tr>`
        );
      })
      .join("");
  }

  function vehicleHasCompletedInspection(ctx, vehicleId) {
    const map = ctx.inspectionIndex || {};
    if (vehicleId == null || vehicleId === "") return false;
    const key = String(vehicleId);
    return !!(map[key] || map[vehicleId]);
  }

  global.vehicleEntryInspection = {
    CHECKLIST,
    INSPECTION_CARDS,
    CARD_COUNT,
    CLASSIFICATIONS,
    CLASS_SHORT,
    INSPECTION_ITEM_COUNT: CHECKLIST.length,
    probeSchema,
    openForVehicle,
    renderAwaitingTable,
    findCompletedInspectionForVehicle,
    loadInspectionDetail,
    canStartInspection,
    vehicleHasCompletedInspection,
    renderDiagram,
    renderDiagramForPrint,
    normalizeDiagramMarkers,
    DIAGRAM_SRC,
  };
})(typeof window !== "undefined" ? window : globalThis);

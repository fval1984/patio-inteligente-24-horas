/**
 * Registro fotográfico da Vistoria Eletrônica — EXCLUSIVO MOBILE.
 * Não altera UI desktop; captura via câmera do celular.
 */
(function vehicleEntryInspectionPhotosMobileModule(global) {
  "use strict";

  const STORAGE_BUCKET = "vehicle-inspection-photos";

  const PHOTO_PROFILES = {
    LEVE: null,
    PESADOS: null,
    TRATORES: null,
    MOTOS: null,
  };

  function getStandardSlots(draft) {
    const variant = String(draft?.inspectionVariant || "LEVE").toUpperCase();
    const fromChecklist = global.vehicleEntryInspectionChecklist?.LEVE_PHOTO_SLOTS;
    if (variant === "LEVE" && fromChecklist?.length) return fromChecklist;
    if (PHOTO_PROFILES[variant]?.length) return PHOTO_PROFILES[variant];
    return LEGACY_STANDARD_SLOTS;
  }

  const LEGACY_STANDARD_SLOTS = [
    { key: "diag_front_left", category: "EXTERIOR", label: "Diagonal dianteira esquerda" },
    { key: "front", category: "EXTERIOR", label: "Dianteira" },
    { key: "diag_front_right", category: "EXTERIOR", label: "Diagonal dianteira direita" },
    { key: "side_left", category: "EXTERIOR", label: "Lateral esquerda" },
    { key: "side_right", category: "EXTERIOR", label: "Lateral direita" },
    { key: "rear", category: "EXTERIOR", label: "Traseira" },
    { key: "diag_rear_left", category: "EXTERIOR", label: "Diagonal traseira esquerda" },
    { key: "diag_rear_right", category: "EXTERIOR", label: "Diagonal traseira direita" },
    { key: "roof", category: "EXTERIOR", label: "Teto" },
    { key: "plate", category: "IDENTIFICACAO", label: "Placa" },
    { key: "odometer", category: "IDENTIFICACAO", label: "Odômetro / Quilometragem" },
    { key: "dashboard", category: "IDENTIFICACAO", label: "Painel" },
    { key: "chassis", category: "IDENTIFICACAO", label: "Chassi / Número do chassi" },
    { key: "engine", category: "MOTOR_E_RODAS", label: "Motor" },
    { key: "wheel_fl", category: "MOTOR_E_RODAS", label: "Roda dianteira esquerda" },
    { key: "wheel_fr", category: "MOTOR_E_RODAS", label: "Roda dianteira direita" },
    { key: "wheel_rl", category: "MOTOR_E_RODAS", label: "Roda traseira esquerda" },
    { key: "wheel_rr", category: "MOTOR_E_RODAS", label: "Roda traseira direita" },
    { key: "interior_front", category: "INTERIOR", label: "Interior dianteiro" },
    { key: "interior_rear", category: "INTERIOR", label: "Interior traseiro" },
    { key: "trunk", category: "INTERIOR", label: "Porta-malas" },
  ];

  function slotsForDraft(draft) {
    return getStandardSlots(draft);
  }

  let _stylesInjected = false;

  function esc(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /** Detecção confiável: celular real (touch + sem hover + largura estreita). */
  function isCaptureDevice() {
    if (typeof window === "undefined") return false;
    try {
      const narrow = window.matchMedia("(max-width: 768px)").matches;
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      const noHover = window.matchMedia("(hover: none)").matches;
      return narrow && coarse && noHover;
    } catch (e) {
      return false;
    }
  }

  function initDraftPhotos(draft) {
    if (!draft.standardPhotos || typeof draft.standardPhotos !== "object") draft.standardPhotos = {};
    if (!Array.isArray(draft.extraDamagePhotos)) draft.extraDamagePhotos = [];
    const slots = slotsForDraft(draft);
    if (draft.currentPhotoStep == null || draft.currentPhotoStep < 0) draft.currentPhotoStep = 0;
    if (draft.currentPhotoStep >= slots.length) draft.currentPhotoStep = Math.max(0, slots.length - 1);
  }

  function slotPhoto(draft, key) {
    return draft.standardPhotos[key] || null;
  }

  function countStandardDone(draft) {
    let n = 0;
    slotsForDraft(draft).forEach((s) => {
      const p = slotPhoto(draft, s.key);
      if (p && (p.preview || p.file)) n++;
    });
    return n;
  }

  function injectStylesOnce() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    if (document.getElementById("veiMobilePhotoStyles")) return;
    const style = document.createElement("style");
    style.id = "veiMobilePhotoStyles";
    style.textContent = `
      .vei-mobile-photos {
        margin: 22px 0 8px;
        padding: 16px 14px 18px;
        border-radius: 14px;
        border: 1px solid rgba(34, 211, 238, 0.28);
        background: rgba(34, 211, 238, 0.06);
      }
      .vei-mobile-photos h4 {
        margin: 0 0 6px;
        font-size: 0.88rem;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: #67e8f9;
      }
      .vei-mobile-photos .vei-photo-progress {
        font-size: 0.92rem;
        font-weight: 700;
        margin-bottom: 14px;
        color: var(--text, #e2e8f0);
      }
      .vei-mobile-photos .vei-photo-step-label {
        font-size: 0.78rem;
        color: var(--muted);
        margin-bottom: 4px;
      }
      .vei-mobile-photos .vei-photo-step-title {
        font-size: 1rem;
        font-weight: 800;
        margin-bottom: 12px;
        line-height: 1.3;
      }
      .vei-mobile-photos .vei-photo-preview {
        width: 100%;
        max-width: 360px;
        margin: 0 auto 14px;
        aspect-ratio: 4/3;
        border-radius: 12px;
        border: 2px dashed rgba(148, 163, 184, 0.35);
        background: rgba(15, 23, 42, 0.45);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }
      .vei-mobile-photos .vei-photo-preview img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .vei-mobile-photos .vei-photo-preview-empty {
        color: var(--muted);
        font-size: 0.85rem;
        padding: 12px;
        text-align: center;
      }
      .vei-mobile-photos .vei-photo-done {
        color: #34d399;
        font-weight: 700;
        font-size: 0.88rem;
        margin-bottom: 10px;
        text-align: center;
      }
      .vei-mobile-photos .vei-photo-actions {
        display: flex;
        flex-direction: column;
        gap: 10px;
        max-width: 360px;
        margin: 0 auto;
      }
      .vei-mobile-photos .vei-photo-btn {
        appearance: none;
        border: none;
        border-radius: 12px;
        padding: 16px 18px;
        font-size: 1rem;
        font-weight: 800;
        cursor: pointer;
        min-height: 52px;
        touch-action: manipulation;
        width: 100%;
      }
      .vei-mobile-photos .vei-photo-btn-primary {
        background: linear-gradient(135deg, #22d3ee, #0891b2);
        color: #0f172a;
        box-shadow: 0 8px 20px rgba(34, 211, 238, 0.25);
      }
      .vei-mobile-photos .vei-photo-btn-secondary {
        background: transparent;
        color: var(--primary, #67e8f9);
        border: 2px solid rgba(34, 211, 238, 0.45);
      }
      .vei-mobile-photos .vei-photo-nav {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }
      .vei-mobile-photos .vei-photo-checklist {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
        margin-top: 16px;
        font-size: 0.68rem;
      }
      .vei-mobile-photos .vei-photo-check-item {
        padding: 6px 8px;
        border-radius: 8px;
        border: 1px solid rgba(148, 163, 184, 0.18);
        background: rgba(15, 23, 42, 0.35);
      }
      .vei-mobile-photos .vei-photo-check-item.done {
        border-color: rgba(52, 211, 153, 0.45);
        background: rgba(52, 211, 153, 0.1);
        color: #6ee7b7;
      }
      .vei-mobile-photos .vei-photo-check-item.pending {
        color: var(--muted);
      }
      .vei-mobile-photos .vei-extra-damage {
        margin-top: 20px;
        padding-top: 16px;
        border-top: 1px solid rgba(148, 163, 184, 0.18);
      }
      .vei-mobile-photos .vei-extra-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
        gap: 8px;
        margin-top: 10px;
      }
      .vei-mobile-photos .vei-extra-grid figure {
        margin: 0;
        position: relative;
      }
      .vei-mobile-photos .vei-extra-grid img {
        width: 100%;
        border-radius: 8px;
        aspect-ratio: 1;
        object-fit: cover;
        border: 1px solid var(--border);
      }
      .vei-mobile-photos .vei-extra-remove {
        position: absolute;
        top: 4px;
        right: 4px;
        width: 28px;
        height: 28px;
        border-radius: 999px;
        border: none;
        background: rgba(220, 38, 38, 0.9);
        color: #fff;
        font-size: 14px;
        line-height: 1;
        cursor: pointer;
      }
      .vei-mobile-photos .vei-photo-capture-input {
        position: absolute;
        width: 1px;
        height: 1px;
        opacity: 0;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
      }
    `;
    document.head.appendChild(style);
  }

  function renderSection(draft) {
    initDraftPhotos(draft);
    injectStylesOnce();

    const slots = slotsForDraft(draft);
    const step = draft.currentPhotoStep;
    const slot = slots[step];
    if (!slot) return "";
    const photo = slotPhoto(draft, slot.key);
    const hasPhoto = !!(photo && photo.preview);
    const done = countStandardDone(draft);
    const total = slots.length;

    const checklist = slots.map((s, i) => {
      const p = slotPhoto(draft, s.key);
      const ok = !!(p && p.preview);
      return (
        `<div class="vei-photo-check-item${ok ? " done" : " pending"}${i === step ? " active" : ""}" data-photo-jump="${i}">` +
        `${ok ? "✓ " : ""}${esc(s.label)}` +
        `</div>`
      );
    }).join("");

    return (
      '<section class="vei-mobile-photos" id="veiMobilePhotos">' +
      "<h4>Registro fotográfico</h4>" +
      `<p class="vei-photo-progress">Fotos: ${done}/${total}</p>` +
      `<p class="vei-photo-step-label">${step + 1}/${total}</p>` +
      `<p class="vei-photo-step-title">${esc(slot.label.toUpperCase())}</p>` +
      '<div class="vei-photo-preview">' +
      (hasPhoto
        ? `<img src="${esc(photo.preview)}" alt="${esc(slot.label)}"/>`
        : '<div class="vei-photo-preview-empty">Nenhuma foto registrada para este item</div>') +
      "</div>" +
      (hasPhoto ? '<p class="vei-photo-done">✓ Registrada</p>' : "") +
      '<div class="vei-photo-actions">' +
      `<button type="button" class="vei-photo-btn vei-photo-btn-primary" id="veiPhotoTakeBtn">${hasPhoto ? "📷 Refazer foto" : "📷 Tirar foto"}</button>` +
      '<div class="vei-photo-nav">' +
      `<button type="button" class="vei-photo-btn vei-photo-btn-secondary" id="veiPhotoPrevBtn"${step <= 0 ? " disabled" : ""}>← Anterior</button>` +
      `<button type="button" class="vei-photo-btn vei-photo-btn-secondary" id="veiPhotoNextBtn"${step >= total - 1 ? " disabled" : ""}>Próxima →</button>` +
      "</div>" +
      "</div>" +
      '<div class="vei-photo-checklist">' +
      checklist +
      "</div>" +
      '<input type="file" class="vei-photo-capture-input" id="veiPhotoCaptureInput" accept="image/*" capture="environment"/>' +
      "</section>"
    );
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ""));
      r.onerror = () => resolve("");
      r.readAsDataURL(file);
    });
  }

  function bindEvents(root, draft, onRefresh) {
    const section = root.querySelector("#veiMobilePhotos") || root.closest?.("#veiMobilePhotos") || root;
    if (!section || !section.querySelector) return;

    initDraftPhotos(draft);

    const captureInput = section.querySelector("#veiPhotoCaptureInput");

    section.querySelector("#veiPhotoTakeBtn")?.addEventListener("click", () => {
      captureInput?.click();
    });

    captureInput?.addEventListener("change", async () => {
      const file = captureInput.files?.[0];
      captureInput.value = "";
      if (!file) return;
      const slot = slotsForDraft(draft)[draft.currentPhotoStep];
      if (!slot) return;
      const preview = await readFileAsDataUrl(file);
      draft.standardPhotos[slot.key] = {
        file,
        preview,
        capturedAt: new Date().toISOString(),
        label: slot.label,
        category: slot.category,
      };
      onRefresh();
    });

    section.querySelector("#veiPhotoPrevBtn")?.addEventListener("click", () => {
      if (draft.currentPhotoStep > 0) {
        draft.currentPhotoStep--;
        onRefresh();
      }
    });

    section.querySelector("#veiPhotoNextBtn")?.addEventListener("click", () => {
      if (draft.currentPhotoStep < slotsForDraft(draft).length - 1) {
        draft.currentPhotoStep++;
        onRefresh();
      }
    });

    section.querySelectorAll("[data-photo-jump]").forEach((el) => {
      el.addEventListener("click", () => {
        const idx = Number(el.getAttribute("data-photo-jump"));
        if (Number.isFinite(idx) && idx >= 0 && idx < slotsForDraft(draft).length) {
          draft.currentPhotoStep = idx;
          onRefresh();
        }
      });
    });
  }

  async function uploadBlob(ctx, path, blob) {
    return ctx.supabase.storage.from(STORAGE_BUCKET).upload(path, blob, {
      upsert: true,
      contentType: blob.type || "image/jpeg",
    });
  }

  async function insertPhotoRow(ctx, row) {
    const full = { ...row };
    let { error } = await ctx.supabase.from("vehicle_entry_inspection_photos").insert(full);
    if (error && /column|schema cache|photo_type/i.test(error.message || "")) {
      const basic = {
        inspection_id: row.inspection_id,
        storage_path: row.storage_path,
        file_name: row.file_name,
      };
      ({ error } = await ctx.supabase.from("vehicle_entry_inspection_photos").insert(basic));
    }
    if (error) {
      console.warn("vei insertPhotoRow", error.message || error);
      return error;
    }
    return null;
  }

  async function uploadAll(ctx, inspectionId, vehicleId, draft, meta) {
    if (!ctx.supabase || !inspectionId) return;
    initDraftPhotos(draft);

    const uid = ctx.effectiveUserId();
    if (!uid) return;

    const inspectorName = meta?.inspectorName || "Utilizador";
    const inspectorUserId = meta?.inspectorUserId || uid;
    const now = Date.now();

    for (const slot of slotsForDraft(draft)) {
      const p = slotPhoto(draft, slot.key);
      if (!p || !p.file) continue;
      try {
        const safeName = `${slot.key}.jpg`;
        const path = `${uid}/inspections/${inspectionId}/standard/${now}_${safeName}`;
        const { error: upErr } = await uploadBlob(ctx, path, p.file);
        if (upErr) continue;
        await insertPhotoRow(ctx, {
          inspection_id: inspectionId,
          storage_path: path,
          file_name: safeName,
          photo_type: slot.key,
          photo_category: slot.category,
          photo_label: slot.label,
          vehicle_id: vehicleId,
          captured_by_user_id: inspectorUserId,
          captured_by_name: inspectorName,
          captured_at: p.capturedAt || new Date().toISOString(),
        });
      } catch (e) {
        console.warn("vei standard photo upload", slot.key, e);
      }
    }

    for (let i = 0; i < (draft.extraDamagePhotos || []).length; i++) {
      const ex = draft.extraDamagePhotos[i];
      if (!ex?.file) continue;
      try {
        const safeName = `avaria_extra_${i + 1}.jpg`;
        const path = `${uid}/inspections/${inspectionId}/extra/${now}_${safeName}`;
        const { error: upErr } = await uploadBlob(ctx, path, ex.file);
        if (upErr) continue;
        await insertPhotoRow(ctx, {
          inspection_id: inspectionId,
          storage_path: path,
          file_name: safeName,
          photo_type: "avaria_extra",
          photo_category: "AVARIAS",
          photo_label: `Foto adicional de avaria ${i + 1}`,
          vehicle_id: vehicleId,
          captured_by_user_id: inspectorUserId,
          captured_by_name: inspectorName,
          captured_at: ex.capturedAt || new Date().toISOString(),
        });
      } catch (e) {
        console.warn("vei extra damage photo upload", i, e);
      }
    }
  }

  global.vehicleEntryInspectionPhotosMobile = {
    getStandardSlots,
    LEGACY_STANDARD_SLOTS,
    STANDARD_SLOTS: LEGACY_STANDARD_SLOTS,
    STANDARD_COUNT: LEGACY_STANDARD_SLOTS.length,
    isCaptureDevice,
    renderSection,
    bindEvents,
    uploadAll,
    initDraftPhotos,
    countStandardDone,
  };

  if (typeof document !== "undefined" && !document.getElementById("veiMobilePhotoStylesDesktop")) {
    const guard = document.createElement("style");
    guard.id = "veiMobilePhotoStylesDesktop";
    guard.textContent =
      ".vei-mobile-photos .vei-photo-btn { cursor: pointer; }" +
      "@media (min-width:769px){.vei-mobile-photos .vei-photo-preview{max-width:480px}}";
    document.head.appendChild(guard);
  }
})(typeof window !== "undefined" ? window : globalThis);

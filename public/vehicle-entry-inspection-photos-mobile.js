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
        max-width: none;
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
        object-fit: contain;
        object-position: center;
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
        position: relative;
        z-index: 6;
      }
      .vei-mobile-photos .vei-photo-btn {
        appearance: none;
        display: block;
        position: relative;
        overflow: hidden;
        box-sizing: border-box;
        border: none;
        border-radius: 12px;
        padding: 16px 18px;
        font-size: 1rem;
        font-weight: 800;
        cursor: pointer;
        min-height: 52px;
        touch-action: manipulation;
        width: 100%;
        text-align: center;
        z-index: 6;
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
      .vei-mobile-photos .vei-photo-native-input {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
        opacity: 0;
        cursor: pointer;
        font-size: 24px;
        z-index: 6;
      }
      .vei-mobile-photos .vei-photo-btn-text {
        pointer-events: none;
        position: relative;
        z-index: 1;
      }
      .vei-photo-native-input--detached {
        position: fixed;
        left: 0;
        bottom: 0;
        width: 44px;
        height: 44px;
        margin: 0;
        opacity: 0.01;
        z-index: 0;
        pointer-events: none;
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
      `<label class="vei-photo-btn vei-photo-btn-primary" id="veiPhotoTakeBtn"><span class="vei-photo-btn-text">${hasPhoto ? "📷 Refazer foto" : "📷 Tirar foto"}</span>` +
      '<input type="file" accept="image/*" capture="environment" class="vei-photo-native-input" id="veiPhotoCaptureInput" tabindex="-1"/>' +
      "</label>" +
      '<label class="vei-photo-btn vei-photo-btn-secondary" id="veiPhotoGalleryBtn"><span class="vei-photo-btn-text">📁 Galeria</span>' +
      '<input type="file" accept="image/*" class="vei-photo-native-input" id="veiPhotoGalleryInput" tabindex="-1"/>' +
      "</label>" +
      '<div class="vei-photo-nav">' +
      `<button type="button" class="vei-photo-btn vei-photo-btn-secondary" id="veiPhotoPrevBtn"${step <= 0 ? " disabled" : ""}>← Anterior</button>` +
      `<button type="button" class="vei-photo-btn vei-photo-btn-secondary" id="veiPhotoNextBtn"${step >= total - 1 ? " disabled" : ""}>Próxima →</button>` +
      "</div>" +
      "</div>" +
      '<div class="vei-photo-checklist">' +
      checklist +
      "</div>" +
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

  function resolvePhotosHost(root) {
    if (!root) return null;
    if (root.id === "veiMobilePhotosHost") return root;
    if (typeof root.closest === "function") {
      const nested = root.closest("#veiMobilePhotosHost");
      if (nested) return nested;
    }
    if (typeof root.querySelector === "function") {
      const found = root.querySelector("#veiMobilePhotosHost");
      if (found) return found;
    }
    return null;
  }

  async function applyCapturedStandardPhoto(draft, file) {
    initDraftPhotos(draft);
    if (!file || !draft) return false;
    const slot = slotsForDraft(draft)[draft.currentPhotoStep];
    if (!slot) return false;
    const preview = await readFileAsDataUrl(file);
    if (!preview) return false;
    draft.standardPhotos[slot.key] = {
      file,
      preview,
      capturedAt: new Date().toISOString(),
      label: slot.label,
      category: slot.category,
    };
    return true;
  }

  function stepPhoto(draft, delta) {
    initDraftPhotos(draft);
    const total = slotsForDraft(draft).length;
    const next = (draft.currentPhotoStep || 0) + delta;
    if (next < 0 || next >= total) return false;
    draft.currentPhotoStep = next;
    return true;
  }

  function jumpPhoto(draft, idx) {
    initDraftPhotos(draft);
    const total = slotsForDraft(draft).length;
    if (!Number.isFinite(idx) || idx < 0 || idx >= total) return false;
    draft.currentPhotoStep = idx;
    return true;
  }

  function syncSection(host, draft) {
    if (!host) return false;
    initDraftPhotos(draft);
    injectStylesOnce();
    let section = host.querySelector?.("#veiMobilePhotos");
    if (!section) {
      host.innerHTML = renderSection(draft);
      return true;
    }

    const slots = slotsForDraft(draft);
    const step = draft.currentPhotoStep || 0;
    const slot = slots[step];
    if (!slot) return false;
    const photo = slotPhoto(draft, slot.key);
    const hasPhoto = !!(photo && photo.preview);
    const done = countStandardDone(draft);
    const total = slots.length;

    const progress = section.querySelector(".vei-photo-progress");
    if (progress) progress.textContent = `Fotos: ${done}/${total}`;
    const stepLabel = section.querySelector(".vei-photo-step-label");
    if (stepLabel) stepLabel.textContent = `${step + 1}/${total}`;
    const title = section.querySelector(".vei-photo-step-title");
    if (title) title.textContent = String(slot.label || "").toUpperCase();

    const preview = section.querySelector(".vei-photo-preview");
    if (preview) {
      if (hasPhoto) {
        preview.querySelector(".vei-photo-preview-empty")?.remove();
        let img = preview.querySelector("img");
        if (!img) {
          img = document.createElement("img");
          preview.appendChild(img);
        }
        if (img.getAttribute("src") !== photo.preview) img.setAttribute("src", photo.preview);
        img.alt = slot.label || "";
      } else {
        preview.innerHTML = '<div class="vei-photo-preview-empty">Nenhuma foto registrada para este item</div>';
      }
    }

    let doneMsg = section.querySelector(".vei-photo-done");
    if (hasPhoto) {
      if (!doneMsg) {
        doneMsg = document.createElement("p");
        doneMsg.className = "vei-photo-done";
        preview?.insertAdjacentElement("afterend", doneMsg);
      }
      doneMsg.textContent = "✓ Registrada";
    } else if (doneMsg) {
      doneMsg.remove();
    }

    const takeText = section.querySelector("#veiPhotoTakeBtn .vei-photo-btn-text");
    if (takeText) takeText.textContent = hasPhoto ? "📷 Refazer foto" : "📷 Tirar foto";

    const prevBtn = section.querySelector("#veiPhotoPrevBtn");
    const nextBtn = section.querySelector("#veiPhotoNextBtn");
    if (prevBtn) {
      if (step <= 0) prevBtn.setAttribute("disabled", "");
      else prevBtn.removeAttribute("disabled");
    }
    if (nextBtn) {
      if (step >= total - 1) nextBtn.setAttribute("disabled", "");
      else nextBtn.removeAttribute("disabled");
    }

    section.querySelectorAll("[data-photo-jump]").forEach((el) => {
      const i = Number(el.getAttribute("data-photo-jump"));
      const s = slots[i];
      const p = s ? slotPhoto(draft, s.key) : null;
      const ok = !!(p && p.preview);
      el.classList.toggle("done", ok);
      el.classList.toggle("pending", !ok);
      el.classList.toggle("active", i === step);
      el.textContent = `${ok ? "✓ " : ""}${s?.label || ""}`;
    });
    return false;
  }

  function bindEvents() {
    /* Captura e navegação ficam no listener delegado do modal, para não recriar o input da câmera. */
  }

  function blobFromDraftPhoto(p) {
    if (!p) return Promise.resolve(null);
    if (p.file) return Promise.resolve(p.file);
    if (p.storage_path && !p.preview) return Promise.resolve(null);
    const preview = String(p.preview || "");
    if (preview.indexOf("data:") === 0) {
      return fetch(preview).then((r) => r.blob()).catch(() => null);
    }
    return Promise.resolve(null);
  }

  function compressPhotoBlob(blob) {
    return new Promise((resolve) => {
      if (!blob) return resolve(null);
      if (typeof Image === "undefined" || typeof document === "undefined") return resolve(blob);
      const img = new Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        try {
          const max = 1600;
          let w = img.naturalWidth || 0;
          let h = img.naturalHeight || 0;
          if (!w || !h) {
            URL.revokeObjectURL(url);
            return resolve(blob);
          }
          if (w > max || h > max) {
            const scale = max / Math.max(w, h);
            w = Math.round(w * scale);
            h = Math.round(h * scale);
          }
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            URL.revokeObjectURL(url);
            return resolve(blob);
          }
          ctx.drawImage(img, 0, 0, w, h);
          canvas.toBlob(
            (out) => {
              URL.revokeObjectURL(url);
              resolve(out || blob);
            },
            "image/jpeg",
            0.72
          );
        } catch (e) {
          URL.revokeObjectURL(url);
          resolve(blob);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(blob);
      };
      img.src = url;
    });
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const s = String(r.result || "");
        const comma = s.indexOf(",");
        resolve(comma >= 0 ? s.slice(comma + 1) : s);
      };
      r.onerror = () => reject(r.error || new Error("Falha ao ler a foto"));
      r.readAsDataURL(blob);
    });
  }

  async function uploadPhotoViaApi(ctx, payload) {
    if (typeof ctx?.getAccessToken !== "function") return { ok: false, error: "Sessão em falta." };
    const session = await ctx.getAccessToken();
    if (!session) return { ok: false, error: "Sessão em falta." };
    const res = await fetch("/api/vehicles/entry-inspection-photo", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session}` },
      body: JSON.stringify({ access_token: session, ...payload }),
    });
    let json = {};
    try {
      json = await res.json();
    } catch (e) {
      json = {};
    }
    if (!res.ok || !json?.ok) {
      return { ok: false, error: json.error || "Não foi possível gravar a foto." };
    }
    return { ok: true, storage_path: json.storage_path, url: json.url };
  }

  async function uploadOneStandardPhoto(ctx, inspectionId, vehicleId, slot, photo, meta) {
    if (photo?.storage_path && !photo?.file && String(photo.preview || "").indexOf("data:") !== 0) {
      return { ok: true, skipped: true };
    }
    const raw = await blobFromDraftPhoto(photo);
    if (!raw) return { ok: false, error: `Sem arquivo para ${slot.label}` };
    const compressed = (await compressPhotoBlob(raw)) || raw;
    const dataBase64 = await blobToBase64(compressed);
    const result = await uploadPhotoViaApi(ctx, {
      inspection_id: inspectionId,
      vehicle_id: vehicleId || "",
      photo_type: slot.key,
      photo_label: slot.label,
      photo_category: slot.category,
      file_name: `${slot.key}.jpg`,
      content_type: "image/jpeg",
      data_base64: dataBase64,
      captured_at: photo.capturedAt || new Date().toISOString(),
    });
    if (result.ok && photo) {
      photo.storage_path = result.storage_path;
      if (result.url) photo.preview = result.url;
      photo.file = null;
    }
    return result;
  }

  async function uploadAll(ctx, inspectionId, vehicleId, draft, meta) {
    initDraftPhotos(draft);
    const errors = [];
    let uploaded = 0;
    for (const slot of slotsForDraft(draft)) {
      const p = slotPhoto(draft, slot.key);
      if (!p || (!p.file && !p.preview && !p.storage_path)) continue;
      if (!p.file && p.storage_path && String(p.preview || "").indexOf("data:") !== 0) continue;
      try {
        const result = await uploadOneStandardPhoto(ctx, inspectionId, vehicleId, slot, p, meta);
        if (result.ok && !result.skipped) uploaded += 1;
        else if (!result.ok) errors.push(result.error || slot.label);
      } catch (e) {
        console.warn("vei standard photo upload", slot.key, e);
        errors.push(slot.label);
      }
    }

    for (let i = 0; i < (draft.extraDamagePhotos || []).length; i++) {
      const ex = draft.extraDamagePhotos[i];
      if (!ex || (!ex.file && String(ex.preview || "").indexOf("data:") !== 0)) continue;
      try {
        const raw = await blobFromDraftPhoto(ex);
        if (!raw) {
          errors.push(ex.label || `Avaria ${i + 1}`);
          continue;
        }
        const compressed = (await compressPhotoBlob(raw)) || raw;
        const dataBase64 = await blobToBase64(compressed);
        const result = await uploadPhotoViaApi(ctx, {
          inspection_id: inspectionId,
          vehicle_id: vehicleId || "",
          photo_type: "avaria_extra",
          photo_label: ex.label || ex.area_label || ex.description || `Avaria adicional ${i + 1}`,
          photo_category: "AVARIAS",
          file_name: `avaria_extra_${i + 1}.jpg`,
          content_type: "image/jpeg",
          data_base64: dataBase64,
          captured_at: ex.capturedAt || new Date().toISOString(),
        });
        if (result.ok) {
          uploaded += 1;
          ex.storage_path = result.storage_path;
          if (result.url) ex.preview = result.url;
          ex.file = null;
        } else errors.push(result.error || `Avaria ${i + 1}`);
      } catch (e) {
        console.warn("vei extra damage photo upload", i, e);
        errors.push(`Avaria ${i + 1}`);
      }
    }

    return { uploaded, failed: errors.length, errors };
  }

  global.vehicleEntryInspectionPhotosMobile = {
    getStandardSlots,
    LEGACY_STANDARD_SLOTS,
    STANDARD_SLOTS: LEGACY_STANDARD_SLOTS,
    STANDARD_COUNT: LEGACY_STANDARD_SLOTS.length,
    isCaptureDevice,
    resolvePhotosHost,
    applyCapturedStandardPhoto,
    stepPhoto,
    jumpPhoto,
    renderSection,
    syncSection,
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
      "@media (min-width:769px){.vei-mobile-photos .vei-photo-preview{max-width:640px}}";
    document.head.appendChild(guard);
  }
})(typeof window !== "undefined" ? window : globalThis);

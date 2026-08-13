/**
 * Placa veicular BR — componente visual reutilizável (antiga + Mercosul).
 * Não altera normalização/armazenamento; apenas apresentação.
 */
(function vehiclePlateUIModule(global) {
  "use strict";

  function esc(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /** Remove hífen/espaço; mantém letras/números; maiúsculas; máx. 7 chars. */
  function stripPlate(str) {
    return String(str || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 7);
  }

  function isMercosulComplete(clean) {
    return /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/.test(clean);
  }

  function isOldComplete(clean) {
    return /^[A-Z]{3}[0-9]{4}$/.test(clean);
  }

  function inferType(clean) {
    if (!clean) return "empty";
    if (clean.length >= 5 && /^[A-Z]{3}[0-9][A-Z]/.test(clean)) return "mercosul";
    if (clean.length >= 4 && /^[A-Z]{3}[0-9]/.test(clean)) {
      if (clean.length >= 5 && /[A-Z]/.test(clean[4])) return "mercosul";
      return "old";
    }
    if (/^[A-Z]{0,3}$/.test(clean)) return "old";
    return "old";
  }

  function formatOldDisplay(clean) {
    if (clean.length <= 3) return clean;
    return `${clean.slice(0, 3)}-${clean.slice(3)}`;
  }

  function buildPartialText(clean, type) {
    if (!clean) return { main: "", ghost: "" };
    if (type === "mercosul") {
      const main = clean;
      const ghost = "_______".slice(clean.length);
      return { main, ghost };
    }
    if (clean.length <= 3) return { main: clean, ghost: clean.length < 3 ? "-____".slice(clean.length) : "-____" };
    const main = formatOldDisplay(clean);
    const missing = Math.max(0, 8 - main.length);
    return { main, ghost: missing ? "-".repeat(Math.min(1, missing)) + "0".repeat(Math.max(0, missing - 1)) : "" };
  }

  /**
   * Analisa placa para renderização visual.
   * @returns {{ type: string, clean: string, display: string, complete: boolean, partial: boolean }}
   */
  function analyzePlate(plate) {
    const clean = stripPlate(plate);
    if (!clean) {
      return { type: "empty", clean: "", display: "", complete: false, partial: true };
    }

    if (clean.length === 7) {
      if (isMercosulComplete(clean)) {
        return { type: "mercosul", clean, display: clean, complete: true, partial: false };
      }
      if (isOldComplete(clean)) {
        return { type: "old", clean, display: formatOldDisplay(clean), complete: true, partial: false };
      }
      if (/^[A-Z]{3}[0-9][A-Z]/.test(clean)) {
        return { type: "mercosul", clean, display: clean, complete: true, partial: false };
      }
      return { type: "old", clean, display: formatOldDisplay(clean), complete: true, partial: false };
    }

    const type = inferType(clean);
    const partial = true;
    if (type === "mercosul") {
      return { type: "mercosul", clean, display: clean, complete: false, partial };
    }
    return { type: "old", clean, display: formatOldDisplay(clean), complete: false, partial };
  }

  function renderChars(info) {
    const parts = buildPartialText(info.clean, info.type);
    if (!parts.main && info.type === "empty") return `<span class="vp-plate__text">—</span>`;
    if (!info.partial || info.complete) {
      return `<span class="vp-plate__text">${esc(info.display)}</span>`;
    }
    return `<span class="vp-plate__text">${esc(parts.main)}<span class="vp-plate__ghost">${esc(parts.ghost)}</span></span>`;
  }

  function renderMercosulPlate(info, size, opts) {
    const body =
      opts && opts.editableEmpty && !info.clean
        ? `<span class="vp-plate__text"><span class="vp-plate__ghost">_______</span></span>`
        : renderMercosulGhostChars(info);
    return `<span class="vp-plate vp-plate--mercosul vp-plate--${size}${info.partial ? " vp-plate--partial" : ""}${info.complete ? " vp-plate--complete" : ""}" role="img" aria-label="Placa ${esc(info.display || info.clean || "veículo")}">
      <span class="vp-plate__merco">
        <span class="vp-plate__merco-band">
          <span class="vp-plate__merco-country">BR</span>
          <span class="vp-plate__merco-flag" aria-hidden="true"></span>
        </span>
        <span class="vp-plate__body vp-plate__body--merco">${body}</span>
      </span>
    </span>`;
  }

  function renderOldChars(info, opts) {
    if (!info.clean && info.type === "empty") {
      if (opts && opts.editableEmpty) {
        return `<span class="vp-plate__text vp-plate__text--old"><span class="vp-plate__old-letters vp-plate__ghost">___</span><span class="vp-plate__old-sep">-</span><span class="vp-plate__old-digits vp-plate__ghost">____</span></span>`;
      }
      return `<span class="vp-plate__text vp-plate__text--old"><span class="vp-plate__old-letters">—</span></span>`;
    }
    const clean = info.clean || "";
    const letters = clean.slice(0, 3);
    const digits = clean.slice(3);
    const ghostLetters = "___".slice(letters.length);
    const ghostDigits = "____".slice(digits.length);

    if (!info.partial || info.complete) {
      const disp = info.display || formatOldDisplay(clean);
      const m = disp.match(/^([A-Z]{3})-?([0-9]{0,4})$/);
      const L = m ? m[1] : letters;
      const D = m ? m[2] : digits;
      return `<span class="vp-plate__text vp-plate__text--old"><span class="vp-plate__old-letters">${esc(L)}</span><span class="vp-plate__old-sep">-</span><span class="vp-plate__old-digits">${esc(D)}</span></span>`;
    }

    return `<span class="vp-plate__text vp-plate__text--old"><span class="vp-plate__old-letters">${esc(letters)}<span class="vp-plate__ghost">${esc(ghostLetters)}</span></span><span class="vp-plate__old-sep">-</span><span class="vp-plate__old-digits">${esc(digits)}<span class="vp-plate__ghost">${esc(ghostDigits)}</span></span></span>`;
  }

  function renderOldPlate(info, size, opts) {
    return `<span class="vp-plate vp-plate--old vp-plate--${size}${info.partial ? " vp-plate--partial" : ""}${info.complete ? " vp-plate--complete" : ""}" role="img" aria-label="Placa ${esc(info.display || info.clean || "veículo")}">
      <span class="vp-plate__old">
        <span class="vp-plate__old-header" aria-hidden="true">UF - MUNICÍPIO</span>
        <span class="vp-plate__body vp-plate__body--old">${renderOldChars(info, opts)}</span>
      </span>
    </span>`;
  }

  function renderMercosulGhostChars(info) {
    const clean = info.clean || "";
    const ghost = "_______".slice(clean.length);
    if (!info.partial || info.complete) {
      return `<span class="vp-plate__text">${esc(info.display || clean)}</span>`;
    }
    return `<span class="vp-plate__text">${esc(clean)}<span class="vp-plate__ghost">${esc(ghost)}</span></span>`;
  }

  /**
   * HTML da placa visual.
   * @param {string} plate
   * @param {{ size?: string, showText?: boolean, showEmpty?: boolean, editableEmpty?: boolean, placeholder?: string, wrap?: boolean }} [opts]
   */
  function renderPlateHtml(plate, opts = {}) {
    const size = opts.size || "sm";
    const info = analyzePlate(plate);
    let visual = "";
    const renderOpts = opts.editableEmpty ? { editableEmpty: true } : undefined;

    if (info.type === "empty") {
      if (!opts.showEmpty) return opts.placeholder ? `<span class="vp-plate-empty">${esc(opts.placeholder)}</span>` : "";
      visual = renderOldPlate(
        { type: "empty", clean: "", display: opts.placeholder || "—", complete: false, partial: true },
        size,
        renderOpts
      );
    } else if (info.type === "mercosul") {
      visual = renderMercosulPlate(info, size, renderOpts);
    } else {
      visual = renderOldPlate(info, size, renderOpts);
    }

    const caption =
      opts.showText && (plate || info.display)
        ? `<span class="vp-plate-caption">${esc(String(plate || info.display).trim())}</span>`
        : "";

    if (opts.wrap === false) return `${visual}${caption}`;
    return `<span class="vp-plate-wrap">${visual}${caption}</span>`;
  }

  function renderPlateEditorVisual(input, size) {
    const clean = stripPlate(input.value);
    return renderPlateHtml(clean, {
      size,
      showEmpty: true,
      editableEmpty: !clean,
      wrap: false,
    });
  }

  function syncPlateEditorVisual(input) {
    const editor = input.closest(".vp-plate-editor");
    if (!editor) return;
    const visual = editor.querySelector(".vp-plate-editor__visual");
    if (!visual) return;
    const size = editor.getAttribute("data-vp-size") || "sm";
    const clean = stripPlate(input.value);
    if (input.value !== clean) input.value = clean;
    visual.innerHTML = renderPlateEditorVisual(input, size);
    const info = analyzePlate(clean);
    editor.classList.toggle("vp-plate-editor--empty", !clean);
    editor.classList.toggle("vp-plate-editor--old", info.type === "old" || info.type === "empty");
    editor.classList.toggle("vp-plate-editor--mercosul", info.type === "mercosul");
    editor.classList.toggle("vp-plate-editor--focused", document.activeElement === input);
  }

  function attachPlateEditor(input, opts) {
    if (!input || input.dataset.vpEditorBound === "1") return input;
    input.dataset.vpEditorBound = "1";

    const size =
      (opts && opts.size) ||
      input.getAttribute("data-vp-size") ||
      input.closest("[data-vp-size]")?.getAttribute("data-vp-size") ||
      "sm";

    input.classList.add("vp-plate-editor__input");
    input.setAttribute("maxlength", "8");
    input.setAttribute("autocomplete", "off");
    input.setAttribute("autocorrect", "off");
    input.setAttribute("autocapitalize", "characters");
    input.setAttribute("spellcheck", "false");
    input.removeAttribute("placeholder");

    let editor = input.closest(".vp-plate-editor");
    if (!editor) {
      editor = document.createElement("div");
      editor.className = "vp-plate-editor";
      editor.setAttribute("data-vp-size", size);
      input.parentNode.insertBefore(editor, input);
      editor.appendChild(input);
    } else {
      editor.setAttribute("data-vp-size", size);
    }

    let visual = editor.querySelector(".vp-plate-editor__visual");
    if (!visual) {
      visual = document.createElement("div");
      visual.className = "vp-plate-editor__visual";
      editor.appendChild(visual);
    }

    const label = document.querySelector(`label[for="${input.id}"]`);
    if (label && !label.classList.contains("sr-only")) {
      label.classList.add("vp-plate-editor__label");
    }

    function focusEditor() {
      input.focus();
      try {
        input.setSelectionRange(input.value.length, input.value.length);
      } catch (e) {
        /* ignore */
      }
    }

    function onInput() {
      syncPlateEditorVisual(input);
    }

    input.addEventListener("input", onInput);
    input.addEventListener("focus", onInput);
    input.addEventListener("blur", onInput);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        input.closest("form")?.requestSubmit();
      }
    });

    editor.addEventListener("click", focusEditor);

    syncPlateEditorVisual(input);
    return input;
  }

  function initPlateEditors(root) {
    const scope = root || document;
    scope.querySelectorAll(".vp-plate-editor input").forEach((input) => attachPlateEditor(input));
    scope.querySelectorAll("[data-vp-editor]").forEach((el) => {
      const input = el.matches("input") ? el : el.querySelector("input");
      if (input) attachPlateEditor(input);
    });
    scope.querySelectorAll("[data-vp-editor-input]").forEach((input) => attachPlateEditor(input));
    ["plateFilter", "plateFilterPatio"].forEach((id) => {
      const el = document.getElementById(id);
      if (el && el.dataset.vpEditorBound !== "1") attachPlateEditor(el);
    });
  }

  function bindLiveInput(input, previewEl) {
    if (!input || !previewEl) return;
    const update = () => {
      previewEl.innerHTML = renderPlateHtml(input.value, { size: "lg", showEmpty: true, placeholder: "···" });
    };
    input.addEventListener("input", update);
    input.addEventListener("change", update);
    update();
  }

  function attachPreviewToInput(input) {
    if (!input || input.dataset.vpBound === "1") return;
    input.dataset.vpBound = "1";

    let row = input.closest(".vp-input-row");
    if (!row) {
      row = document.createElement("div");
      row.className = "vp-input-row";
      input.parentNode.insertBefore(row, input);
      row.appendChild(input);
    }

    let slot = row.querySelector(".vp-preview-slot");
    if (!slot) {
      slot = document.createElement("div");
      slot.className = "vp-preview-slot";
      slot.setAttribute("aria-live", "polite");
      row.appendChild(slot);
    }

    bindLiveInput(input, slot);
  }

  function initLiveInputs(root) {
    const scope = root || document;
    scope.querySelectorAll("[data-vp-live]").forEach((input) => {
      if (input.dataset.vpEditorBound === "1" || input.hasAttribute("data-vp-editor-input")) return;
      attachPreviewToInput(input);
    });
    ["vehiclePlate"].forEach((id) => {
      const el = document.getElementById(id);
      if (el && el.dataset.vpEditorBound !== "1") attachPreviewToInput(el);
    });
  }

  function hydrate(root) {
    const scope = root || document;
    scope.querySelectorAll("[data-vp-plate]").forEach((el) => {
      const plate = el.getAttribute("data-vp-plate") || "";
      const size = el.getAttribute("data-vp-size") || "sm";
      const showText = el.hasAttribute("data-vp-show-text");
      el.innerHTML = renderPlateHtml(plate, {
        size,
        showText,
        showEmpty: true,
        placeholder: "—",
      });
    });
  }

  global.vehiclePlateUI = {
    stripPlate,
    analyzePlate,
    renderPlateHtml,
    renderHtml: renderPlateHtml,
    attachPreviewToInput,
    attachPlateEditor,
    syncPlateEditorVisual,
    initLiveInputs,
    initPlateEditors,
    hydrate,
  };
})(typeof window !== "undefined" ? window : globalThis);

/**
 * Vistoria de entrada eletrônica — AMPLIGUARD (Gestão de Pátio)
 * Cadastro: NO_PATIO no VNP (bola vermelha) até concluir a vistoria (bola verde).
 * A aba Vistoria lista os veículos ainda não vistoriados.
 */
(function vehicleEntryInspectionModule(global) {
  "use strict";

  const STORAGE_BUCKET = "vehicle-inspection-photos";
  const CLASSIFICATIONS = [
    { id: "BOM", label: "Bom", short: "B" },
    { id: "REGULAR", label: "Regular", short: "R" },
    { id: "DANIFICADO", label: "Danificada", short: "D" },
    { id: "SEM_TESTE", label: "Sem Teste", short: "S" },
    { id: "INEXISTENTE", label: "Inexistente", short: "I" },
  ];

  const CLASS_SHORT = { BOM: "B", REGULAR: "R", DANIFICADO: "D", SEM_TESTE: "S", INEXISTENTE: "I" };

  const checklistMod = global.vehicleEntryInspectionChecklist || {};

  function getVariantConfig(variant) {
    if (checklistMod.getVariantConfig) return checklistMod.getVariantConfig(variant || "LEVE");
    return {
      id: "LEVE",
      label: "Vistoria Leve",
      cards: checklistMod.INSPECTION_CARDS || [],
      checklist: checklistMod.CHECKLIST || [],
      classifyKeys: checklistMod.INSPECTION_CHECKLIST_KEYS || [],
      cardCount: checklistMod.CARD_COUNT || 1,
      diagram: "/vehicle-inspection-diagram-leve.webp",
    };
  }

  function draftCfg(draft) {
    return getVariantConfig(draft?.inspectionVariant || "LEVE");
  }

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
  const DEFAULT_DIAGRAM_SRC = "/vehicle-inspection-diagram-leve.webp";

  let _stylesInjected = false;
  let _modalEl = null;
  let _session = null;
  let _schemaReady = null;
  let _ignoreUiUntil = 0;
  let _photoSyncTimer = 0;
  let _resumeListenersBound = false;
  let _inspectorIdentity = null;
  const ACTIVE_EDIT_KEY = "vei_active_edit_v1";
  const INSPECTOR_SESSION_KEY = "vei_inspector_session_v1";

  function armCameraUiGuard(ms) {
    _ignoreUiUntil = Date.now() + (ms || 1800);
  }

  function isCameraUiGuarded() {
    return Date.now() < _ignoreUiUntil;
  }

  function isCoarsePointer() {
    try {
      return window.matchMedia("(pointer: coarse)").matches || window.matchMedia("(hover: none)").matches;
    } catch (e) {
      return "ontouchstart" in window;
    }
  }

  function isPhotoCaptureControl(el) {
    if (!el || typeof el.closest !== "function") return false;
    return !!(
      el.closest("input[type='file']") ||
      el.closest("#veiPhotoTakeBtn") ||
      el.closest("#veiPhotoGalleryBtn") ||
      el.closest("[data-damage-photo-capture]") ||
      el.closest("[data-damage-photo-add]") ||
      el.closest(".vei-photo-native-input")
    );
  }

  function markActiveEdit() {
    try {
      if (!_session?.vehicle?.id || _session.mode !== "edit") return;
      sessionStorage.setItem(
        ACTIVE_EDIT_KEY,
        JSON.stringify({
          vehicleId: _session.vehicle.id,
          variant: _session.draft?.inspectionVariant || "LEVE",
          editingInspectionId: _session.editingInspectionId || null,
          ts: Date.now(),
        })
      );
    } catch (e) {
      /* ignore */
    }
  }

  function clearActiveEdit() {
    try {
      sessionStorage.removeItem(ACTIVE_EDIT_KEY);
    } catch (e) {
      /* ignore */
    }
  }

  function clearInspectorIdentity() {
    _inspectorIdentity = null;
    try {
      sessionStorage.removeItem(INSPECTOR_SESSION_KEY);
    } catch (e) {
      /* ignore */
    }
  }

  function persistInspectorIdentity(identity) {
    if (!identity?.inspectorToken || !identity?.inspectorUserId) return;
    _inspectorIdentity = {
      inspectorUserId: String(identity.inspectorUserId),
      inspectorName: String(identity.inspectorName || ""),
      inspectorToken: String(identity.inspectorToken),
      vehicleId: identity.vehicleId ? String(identity.vehicleId) : "",
      ts: Date.now(),
    };
    try {
      sessionStorage.setItem(INSPECTOR_SESSION_KEY, JSON.stringify(_inspectorIdentity));
    } catch (e) {
      /* ignore */
    }
  }

  function readInspectorIdentity(vehicleId) {
    let current = _inspectorIdentity;
    if (!current) {
      try {
        current = JSON.parse(sessionStorage.getItem(INSPECTOR_SESSION_KEY) || "null");
      } catch (e) {
        current = null;
      }
    }
    if (!current?.inspectorToken || !current?.inspectorUserId) return null;
    if (Date.now() - Number(current.ts || 0) > 8 * 60 * 60 * 1000) {
      clearInspectorIdentity();
      return null;
    }
    if (vehicleId && current.vehicleId && String(current.vehicleId) !== String(vehicleId)) return null;
    _inspectorIdentity = current;
    return current;
  }

  function requiresInspectorIdentification(ctx) {
    return !!(ctx && (ctx.requiresInspectorIdentification || ctx.isVistoriador));
  }

  function ensureIdentifyModal() {
    let el = document.getElementById("veiIdentifyBackdrop");
    if (el) return el;
    el = document.createElement("div");
    el.id = "veiIdentifyBackdrop";
    el.className = "vei-identify-backdrop hidden";
    el.innerHTML =
      '<div class="vei-identify-modal" role="dialog" aria-modal="true" aria-labelledby="veiIdentifyTitle">' +
      '<h3 id="veiIdentifyTitle">IDENTIFICAÇÃO DO VISTORIADOR</h3>' +
      '<p class="vei-identify-lede">Informe o seu usuário e senha para iniciar esta vistoria. O tablet pode permanecer com a sessão compartilhada.</p>' +
      '<form id="veiIdentifyForm" autocomplete="off">' +
      '<label for="veiIdentifyUser">Usuário</label>' +
      '<input id="veiIdentifyUser" name="vei-inspector-user" type="text" inputmode="text" autocomplete="off" autocapitalize="none" spellcheck="false" required />' +
      '<label for="veiIdentifyPass">Senha</label>' +
      '<input id="veiIdentifyPass" name="vei-inspector-pass" type="password" autocomplete="off" required />' +
      '<p class="vei-identify-error hidden" id="veiIdentifyError" role="alert"></p>' +
      '<div class="vei-identify-actions">' +
      '<button type="submit" id="veiIdentifySubmit">ENTRAR E INICIAR VISTORIA</button>' +
      '<button type="button" class="secondary" id="veiIdentifyCancel">CANCELAR</button>' +
      "</div></form></div>";
    document.body.appendChild(el);
    return el;
  }

  function hideIdentifyModal() {
    const el = document.getElementById("veiIdentifyBackdrop");
    el?.classList.add("hidden");
    const form = document.getElementById("veiIdentifyForm");
    if (form) form.reset();
    const err = document.getElementById("veiIdentifyError");
    if (err) {
      err.textContent = "";
      err.classList.add("hidden");
    }
  }

  function promptInspectorIdentification(ctx, vehicle) {
    return new Promise((resolve) => {
      const backdrop = ensureIdentifyModal();
      const form = backdrop.querySelector("#veiIdentifyForm");
      const userInput = backdrop.querySelector("#veiIdentifyUser");
      const passInput = backdrop.querySelector("#veiIdentifyPass");
      const errEl = backdrop.querySelector("#veiIdentifyError");
      const submitBtn = backdrop.querySelector("#veiIdentifySubmit");
      const cancelBtn = backdrop.querySelector("#veiIdentifyCancel");

      function setError(msg) {
        if (!errEl) return;
        errEl.textContent = msg || "";
        errEl.classList.toggle("hidden", !msg);
      }

      function cleanup() {
        form?.removeEventListener("submit", onSubmit);
        cancelBtn?.removeEventListener("click", onCancel);
        backdrop.removeEventListener("click", onBackdrop);
      }

      function finish(value) {
        cleanup();
        hideIdentifyModal();
        resolve(value);
      }

      function onCancel(e) {
        if (e) e.preventDefault();
        finish(null);
      }

      function onBackdrop(e) {
        if (e.target === backdrop) onCancel(e);
      }

      async function onSubmit(e) {
        e.preventDefault();
        const username = String(userInput?.value || "").trim();
        const password = String(passInput?.value || "");
        if (!username || !password) {
          setError("Usuário ou senha inválidos.");
          return;
        }
        const session = await (ctx.getAccessToken ? ctx.getAccessToken() : null);
        if (!session) {
          setError("Sessão do tablet expirada. Entre novamente.");
          return;
        }
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = "Validando…";
        }
        setError("");
        try {
          const res = await fetch("/api/vehicles/identify-inspector", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session}` },
            body: JSON.stringify({ access_token: session, username, password }),
          });
          let json = {};
          try {
            json = await res.json();
          } catch (parseErr) {
            json = {};
          }
          if (!res.ok || !json.ok || !json.inspector_token || !json.inspector_id) {
            setError(json.error || "Usuário ou senha inválidos.");
            return;
          }
          persistInspectorIdentity({
            inspectorUserId: json.inspector_id,
            inspectorName: json.inspector_name || username,
            inspectorToken: json.inspector_token,
            vehicleId: vehicle?.id,
          });
          finish(readInspectorIdentity(vehicle?.id));
        } catch (err) {
          console.warn("vei identify-inspector", err);
          setError("Usuário ou senha inválidos.");
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "ENTRAR E INICIAR VISTORIA";
          }
        }
      }

      cleanup();
      form?.addEventListener("submit", onSubmit);
      cancelBtn?.addEventListener("click", onCancel);
      backdrop.addEventListener("click", onBackdrop);
      backdrop.classList.remove("hidden");
      setError("");
      setTimeout(() => userInput?.focus(), 50);
    });
  }

  async function ensureInspectorForStart(ctx, vehicle) {
    if (!requiresInspectorIdentification(ctx)) return true;
    const existing = readInspectorIdentity(vehicle?.id);
    if (existing) return true;
    const identified = await promptInspectorIdentification(ctx, vehicle);
    return !!identified;
  }

  function readActiveEdit() {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(ACTIVE_EDIT_KEY) || "null");
      if (!parsed?.vehicleId) return null;
      if (Date.now() - Number(parsed.ts || 0) > 8 * 60 * 60 * 1000) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function persistOpenDraft() {
    if (_session?.mode === "edit" && _session.vehicle?.id && _session.draft) {
      persistDraftToStorage(_session.vehicle.id, _session.draft);
      markActiveEdit();
    }
  }

  function keepEditModalOpen() {
    if (_session?.mode === "edit" && _modalEl) {
      _modalEl.classList.remove("hidden");
    }
  }

  function bindResumeListenersOnce() {
    if (_resumeListenersBound || typeof document === "undefined") return;
    _resumeListenersBound = true;
    document.addEventListener("visibilitychange", () => {
      if (!_session || _session.mode !== "edit") return;
      if (document.visibilityState === "hidden") {
        persistOpenDraft();
        armCameraUiGuard(2200);
        return;
      }
      armCameraUiGuard(1800);
      keepEditModalOpen();
    });
    global.addEventListener?.("pageshow", () => {
      if (!_session || _session.mode !== "edit") return;
      armCameraUiGuard(1800);
      keepEditModalOpen();
    });
  }

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

  function finalizeButtonLabel() {
    return _session?.editingInspectionId ? "Salvar vistoria" : "Finalizar vistoria";
  }

  function partnerName(ctx, id) {
    const p = (ctx.partners || []).find((x) => x.id === id);
    return p?.nome || "—";
  }

  function emptyDraftForVariant(variant) {
    const cfg = getVariantConfig(variant || "LEVE");
    const classifications = {};
    const formExtras = {};
    cfg.checklist.forEach((it) => {
      if (it.kind === "classify") classifications[it.key] = null;
      else if (it.kind === "text" || it.kind === "number" || it.kind === "choice" || it.kind === "pick") {
        formExtras[it.key] = "";
      } else if (it.kind === "fuel_gauge") {
        formExtras[it.key] = null;
      }
      if (it.textKey && formExtras[it.textKey] == null) formExtras[it.textKey] = "";
      if (it.textKey2 && formExtras[it.textKey2] == null) formExtras[it.textKey2] = "";
    });
    return {
      inspectionVariant: cfg.id || variant || "LEVE",
      generalNotes: "",
      classifications,
      formExtras,
      itemDamagePhotos: {},
      damages: [],
      diagramMarkers: [],
      pendingPhotos: [],
      standardPhotos: {},
      extraDamagePhotos: [],
      currentPhotoStep: 0,
      currentCardIndex: 0,
      closingStep: "card",
    };
  }

  function getClosingStep(draft) {
    return draft?.closingStep || "card";
  }

  function nextClosingStep(draft, current) {
    const order = ["card", "photos", "damage_photos", "diagram", "finalize"];
    let idx = order.indexOf(current);
    while (idx < order.length - 1) {
      idx += 1;
      const step = order[idx];
      if (step === "damage_photos" && !getDamagedClassifyItems(draft).length) continue;
      return step;
    }
    return "finalize";
  }

  function prevClosingStep(draft, current) {
    const order = ["card", "photos", "damage_photos", "diagram", "finalize"];
    let idx = order.indexOf(current);
    while (idx > 0) {
      idx -= 1;
      const step = order[idx];
      if (step === "damage_photos" && !getDamagedClassifyItems(draft).length) continue;
      return step;
    }
    return "card";
  }

  function pruneItemDamagePhotos(draft) {
    if (!draft?.itemDamagePhotos) return;
    const damagedKeys = new Set(getDamagedClassifyItems(draft).map((it) => it.key));
    Object.keys(draft.itemDamagePhotos).forEach((key) => {
      if (!damagedKeys.has(key)) delete draft.itemDamagePhotos[key];
    });
  }

  function emptyDraft(variant) {
    return emptyDraftForVariant(variant || "LEVE");
  }

  function draftStorageKey(vehicleId) {
    return `vei_draft_v3_${String(vehicleId || "")}`;
  }

  function savedClassificationsStorageKey(inspectionId) {
    return `vei_saved_cls_v1_${String(inspectionId || "")}`;
  }

  function persistSavedClassifications(inspectionId, classifications) {
    if (!inspectionId || !classifications) return;
    try {
      const payload = {};
      Object.keys(classifications).forEach((k) => {
        const cls = normalizeClassificationValue(classifications[k]);
        if (k && cls) payload[k] = cls;
      });
      localStorage.setItem(savedClassificationsStorageKey(inspectionId), JSON.stringify(payload));
    } catch (e) {
      /* ignore */
    }
  }

  function loadSavedClassifications(inspectionId) {
    if (!inspectionId) return null;
    try {
      const raw = localStorage.getItem(savedClassificationsStorageKey(inspectionId));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  function persistDraftToStorage(vehicleId, draft) {
    if (!vehicleId || !draft) return;
    try {
      const payload = {
        inspectionVariant: draft.inspectionVariant || "LEVE",
        classifications: draft.classifications,
        formExtras: draft.formExtras || {},
        itemDamagePhotos: Object.fromEntries(
          Object.entries(draft.itemDamagePhotos || {}).map(([k, v]) => [
            k,
            { preview: v?.preview || null, capturedAt: v?.capturedAt || null },
          ])
        ),
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
        standardPhotos: draft.standardPhotos || {},
        currentPhotoStep: draft.currentPhotoStep || 0,
        currentCardIndex: draft.currentCardIndex || 0,
        closingStep: draft.closingStep || "card",
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
      const raw = localStorage.getItem(draftStorageKey(vehicleId)) || localStorage.getItem(`vei_draft_v2_${vehicleId}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      const draft = emptyDraftForVariant(parsed.inspectionVariant || "LEVE");
      if (parsed.classifications && typeof parsed.classifications === "object") {
        Object.keys(parsed.classifications).forEach((k) => {
          draft.classifications[k] = parsed.classifications[k];
        });
      }
      if (parsed.formExtras && typeof parsed.formExtras === "object") {
        Object.assign(draft.formExtras, parsed.formExtras);
      }
      if (parsed.itemDamagePhotos && typeof parsed.itemDamagePhotos === "object") {
        draft.itemDamagePhotos = parsed.itemDamagePhotos;
      }
      draft.generalNotes = parsed.generalNotes || "";
      draft.diagramMarkers = normalizeDiagramMarkers(parsed.diagramMarkers);
      draft.damages = Array.isArray(parsed.damages) ? parsed.damages : [];
      draft.standardPhotos = parsed.standardPhotos || {};
      draft.currentPhotoStep = Number(parsed.currentPhotoStep) || 0;
      draft.closingStep = parsed.closingStep || "card";
      const maxCard = draftCfg(draft).cardCount - 1;
      draft.currentCardIndex = Math.max(0, Math.min(maxCard, Number(parsed.currentCardIndex) || 0));
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

  function cardClassifyKeys(draft, cardIndex) {
    const card = draftCfg(draft).cards[cardIndex];
    if (!card) return [];
    const keys = [];
    card.blocks.forEach((block) => {
      block.items.forEach((it) => {
        if ((it.kind || "classify") === "classify") keys.push(it.key);
      });
    });
    return keys;
  }

  function cardClassifyLabels(draft, cardIndex) {
    const card = draftCfg(draft).cards[cardIndex];
    const labels = new Map();
    if (!card) return labels;
    card.blocks.forEach((block) => {
      block.items.forEach((it) => {
        if ((it.kind || "classify") === "classify") labels.set(it.key, it.label);
      });
    });
    return labels;
  }

  function allowedClassIds(it) {
    if (Array.isArray(it?.classIds) && it.classIds.length) return it.classIds;
    return CLASSIFICATIONS.map((c) => c.id);
  }

  function parseFuelMark(raw) {
    return checklistMod.parseFuelMark ? checklistMod.parseFuelMark(raw) : null;
  }

  function isItemFilled(draft, it) {
    if (!it) return true;
    const extras = draft.formExtras || {};
    const kind = it.kind || "classify";
    if (kind === "classify") return !!draft.classifications[it.key];
    if (kind === "choice" || kind === "pick") {
      if (it.required && !extras[it.key]) return false;
      if (it.textWhen && it.textKey && extras[it.key] === it.textWhen) {
        return String(extras[it.textKey] || "").trim() !== "";
      }
      return !it.required || !!extras[it.key];
    }
    if (kind === "number") {
      if (!it.required) return true;
      return extras[it.key] !== "" && extras[it.key] != null;
    }
    if (kind === "fuel_gauge") {
      if (!it.required) return true;
      return !!parseFuelMark(extras[it.key] || extras.ini_fuel_gauge);
    }
    if (kind === "text" && it.required) return String(extras[it.key] || "").trim() !== "";
    if (it.textWhen && it.textKey && extras[it.key] === it.textWhen) {
      return String(extras[it.textKey] || "").trim() !== "";
    }
    return true;
  }

  function trackedChecklistItems(draft) {
    return draftCfg(draft).checklist.filter((it) => {
      const kind = it.kind || "classify";
      if (kind === "classify") return true;
      if (kind === "choice" || kind === "pick" || kind === "number" || kind === "fuel_gauge") return !!it.required;
      return false;
    });
  }

  function cardTrackedItems(draft, cardIndex) {
    const card = draftCfg(draft).cards[cardIndex];
    if (!card) return [];
    const items = [];
    card.blocks.forEach((block) => {
      if (block.fuelGauge) {
        items.push({
          key: "ini_fuel_gauge",
          label: "Nível de combustível",
          kind: "fuel_gauge",
          required: true,
        });
      }
      (block.items || []).forEach((it) => items.push(it));
    });
    return items;
  }

  function missingItemsInCard(draft, cardIndex) {
    const missing = [];
    cardTrackedItems(draft, cardIndex).forEach((it) => {
      if (!isItemFilled(draft, it)) missing.push(it.label);
    });
    return missing;
  }

  function findCardIndexForItemKey(draft, itemKey) {
    const cards = draftCfg(draft).cards;
    for (let i = 0; i < cards.length; i++) {
      if (cardTrackedItems(draft, i).some((it) => it.key === itemKey)) return i;
    }
    return 0;
  }

  function classifiedCount(draft) {
    let done = 0;
    trackedChecklistItems(draft).forEach((it) => {
      if (isItemFilled(draft, it)) done++;
    });
    return done;
  }

  function progressPct(draft) {
    const total = trackedChecklistItems(draft).length;
    if (!total) return 0;
    return Math.round((classifiedCount(draft) / total) * 100);
  }

  function missingItems(draft) {
    return trackedChecklistItems(draft)
      .filter((it) => !isItemFilled(draft, it))
      .map((it) => it.label);
  }

  function getDamagedClassifyItems(draft) {
    return draftCfg(draft).checklist.filter(
      (it) => it.kind === "classify" && draft.classifications[it.key] === "DANIFICADO"
    );
  }

  function labelForItemKey(draft, itemKey) {
    const it = draftCfg(draft).checklist.find((x) => x.key === itemKey);
    return it?.label || itemKey;
  }

  function scrollToFirstMissingItem(root, draft) {
    const first = trackedChecklistItems(draft).find((it) => !isItemFilled(draft, it));
    if (!first || !root) return;
    if (_session?.allCardsVisible || _session?.editLayout === "checklist") {
      // scroll only — all cards visíveis
    } else {
      const cardIdx = findCardIndexForItemKey(draft, first.key);
      if (draft.currentCardIndex !== cardIdx) {
        draft.currentCardIndex = cardIdx;
        if (_session?.vehicle?.id) persistDraftToStorage(_session.vehicle.id, draft);
        refreshCurrentEditUI(root, draft, _session?.ctx);
        return;
      }
    }
    const el =
      root.querySelector(`.vei-item[data-item-key="${first.key}"]`) ||
      root.querySelector(`[data-extra-key="${first.key}"]`) ||
      (first.kind === "fuel_gauge" ? root.querySelector("svg.vei-fuel-gauge") : null);
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

  function formatInspectionServerError(raw) {
    const msg = String(raw || "").trim();
    if (!msg) return "Não foi possível finalizar a vistoria.";
    if (/AGUARDANDO_VISTORIA|invalid input value for enum vehicle_status/i.test(msg)) {
      return (
        "A base de dados ainda não foi atualizada para a vistoria eletrônica.\n\n" +
        "Peça ao administrador para executar no Supabase → SQL Editor o arquivo:\n" +
        "supabase/vehicle_entry_inspection_fix_status_enum.sql\n\n" +
        "Depois aguarde alguns segundos, atualize a página e tente finalizar novamente."
      );
    }
    if (/complete_vehicle_entry_inspection|schema cache|relation.*vehicle_entry_inspection/i.test(msg)) {
      return (
        "Estrutura da vistoria eletrônica não encontrada no Supabase.\n\n" +
        "Execute supabase/vehicle_entry_inspections.sql no SQL Editor e tente novamente."
      );
    }
    return msg;
  }

  function injectStylesOnce() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    if (document.getElementById("veiInspectionStyles")) return;
    const style = document.createElement("style");
    style.id = "veiInspectionStyles";
    style.textContent = `
      .vei-item.vei-item-highlight {
        animation: veiItemPulse 0.85s ease-in-out 3;
      }
      @keyframes veiItemPulse {
        0%, 100% { background: rgba(251, 191, 36, 0.06); }
        50% { background: rgba(251, 191, 36, 0.22); }
      }
      .vei-damage-host-hidden { display: none !important; }
      @media print { .vei-no-print { display: none !important; } }
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
      '<div class="vei-modal-head-actions">' +
      '<button type="button" class="secondary hidden" id="veiHeadPrintBtn">Imprimir</button>' +
      '<button type="button" class="secondary hidden" id="veiHeadPdfBtn">PDF</button>' +
      '<button type="button" class="secondary hidden" id="veiHeadDeleteBtn">Apagar vistoria</button>' +
      '<button type="button" class="secondary" id="veiModalClose">Fechar</button>' +
      "</div></div>" +
      '<div class="vei-modal-body" id="veiModalBody"></div>' +
      "</div>";
    document.body.appendChild(backdrop);
    backdrop.addEventListener("click", (e) => {
      if (e.target !== backdrop) return;
      if (isCameraUiGuarded() || isCoarsePointer()) return;
      closeModal();
    });
    backdrop.querySelector("#veiModalClose")?.addEventListener("click", closeModal);
    _modalEl = backdrop;
    return backdrop;
  }

  function closeModal(opts) {
    if (_session?.mode === "edit" && _session.vehicle?.id && _session.draft && !_session.editingInspectionId) {
      persistDraftToStorage(_session.vehicle.id, _session.draft);
    }
    if (!opts?.keepActive) clearActiveEdit();
    _modalEl?.classList.add("hidden");
    _session = null;
    document.getElementById("veiHeadPrintBtn")?.classList.add("hidden");
    document.getElementById("veiHeadPdfBtn")?.classList.add("hidden");
    document.getElementById("veiHeadDeleteBtn")?.classList.add("hidden");
    document.getElementById("veiPrintHostHidden")?.replaceChildren();
  }

  function setViewModalActionsVisible(visible, opts) {
    document.getElementById("veiHeadPrintBtn")?.classList.toggle("hidden", !visible);
    document.getElementById("veiHeadPdfBtn")?.classList.toggle("hidden", !visible);
    const showDelete = !!(visible && opts?.canDelete);
    document.getElementById("veiHeadDeleteBtn")?.classList.toggle("hidden", !showDelete);
  }

  function mountHiddenPrintDocument(vehicle, ctx, inspection, detail) {
    const backdrop = ensureModal();
    let host = document.getElementById("veiPrintHostHidden");
    if (!host) {
      host = document.createElement("div");
      host.id = "veiPrintHostHidden";
      host.className = "vei-no-print";
      host.setAttribute("aria-hidden", "true");
      host.style.cssText =
        "position:fixed;left:-20000px;top:0;width:794px;max-width:794px;overflow:visible;pointer-events:none;opacity:0;";
      backdrop.appendChild(host);
    }
    host.replaceChildren();
    const root = buildPrintDocumentRoot(vehicle, ctx, inspection, detail);
    if (root) host.appendChild(root);
    return host.querySelector("#veiPrintDocument") || host.querySelector(".vei-print-root");
  }

  function canDeleteCompletedInspection(ctx) {
    return !!(ctx && !ctx.isGestorPista && !ctx.isVistoriador);
  }

  async function deleteCompletedInspection(vehicle, ctx, inspection, opts) {
    if (!canDeleteCompletedInspection(ctx)) {
      alert("Apenas o gestor principal pode apagar uma vistoria.");
      return false;
    }
    const insp = inspection || {};
    const inspectionId = String(insp.id || "").trim();
    const vehicleId = String(vehicle?.id || insp.vehicle_id || "").trim();
    if (!vehicleId) {
      alert("Veículo em falta.");
      return false;
    }
    const n = insp.inspection_number ? ` nº ${insp.inspection_number}` : "";
    const placa = String(vehicle?.placa || "").trim();
    if (opts?.confirm !== false) {
      const ok = confirm(
        `Apagar a vistoria${n}${placa ? ` do veículo ${placa}` : ""}?\n\n` +
          "As fotos e o checklist serão removidos. O veículo não é apagado.\n" +
          "Se ainda estiver no pátio, poderá ser vistoriado de novo."
      );
      if (!ok) return false;
    }
    if (typeof ctx?.getAccessToken !== "function") {
      alert("Sessão em falta.");
      return false;
    }
    const session = await ctx.getAccessToken();
    if (!session) {
      alert("Sessão em falta. Entre novamente.");
      return false;
    }
    let res;
    try {
      res = await fetch("/api/vehicles/delete-entry-inspection", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session}` },
        body: JSON.stringify({
          access_token: session,
          vehicle_id: vehicleId,
          inspection_id: inspectionId || undefined,
        }),
      });
    } catch (e) {
      alert("Não foi possível apagar a vistoria. Verifique a rede e tente novamente.");
      return false;
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.ok) {
      alert(json?.error || "Não foi possível apagar a vistoria.");
      return false;
    }
    closeModal();
    clearDraftStorage(vehicleId);
    try {
      if (inspectionId) localStorage.removeItem(savedClassificationsStorageKey(inspectionId));
    } catch (e) {
      /* ignore */
    }
    if (ctx.inspectionIndex && vehicleId) {
      delete ctx.inspectionIndex[vehicleId];
      delete ctx.inspectionIndex[String(vehicleId)];
    }
    if (typeof ctx.loadVehicleInspections === "function") await ctx.loadVehicleInspections();
    if (typeof ctx.loadVehicles === "function") await ctx.loadVehicles();
    if (typeof ctx.renderVehicles === "function") ctx.renderVehicles();
    if (typeof ctx.onInspectionDeleted === "function") {
      ctx.onInspectionDeleted({ vehicleId, revertedToAguardando: !!json.reverted_to_aguardando });
    }
    alert("Vistoria apagada. O veículo permanece no VNP, aguardando nova vistoria.");
    return true;
  }

  function bindViewModalActions(vehicle, ctx, inspection, detail) {
    const docMod = global.vehicleEntryInspectionDocument;
    const runPrint = async () => {
      let root =
        document.getElementById("veiPrintDocument") ||
        document.querySelector("#veiPrintHostHidden .vei-print-root");
      if (!root) root = mountHiddenPrintDocument(vehicle, ctx, inspection, detail);
      if (docMod?.printDocument) await docMod.printDocument(root, inspection);
      else alert("Impressão indisponível. Atualize a página.");
    };
    const runPdf = async () => {
      if (!document.getElementById("veiPrintDocument")) {
        mountHiddenPrintDocument(vehicle, ctx, inspection, detail);
      }
      await downloadPdf(ctx, vehicle, inspection, detail);
    };
    const headPrint = document.getElementById("veiHeadPrintBtn");
    const headPdf = document.getElementById("veiHeadPdfBtn");
    const headDelete = document.getElementById("veiHeadDeleteBtn");
    if (headPrint) headPrint.onclick = (e) => { e.preventDefault(); runPrint(); };
    if (headPdf) headPdf.onclick = (e) => { e.preventDefault(); runPdf(); };
    if (headDelete) {
      headDelete.onclick = async (e) => {
        e.preventDefault();
        await deleteCompletedInspection(vehicle, ctx, inspection);
      };
    }
    document.getElementById("veiPrintBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      runPrint();
    });
    document.getElementById("veiPdfBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      runPdf();
    });
    document.getElementById("veiDeleteBtn")?.addEventListener("click", async (e) => {
      e.preventDefault();
      await deleteCompletedInspection(vehicle, ctx, inspection);
    });
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
    if (!mod?.renderSection) return "";
    return mod.renderSection(draft);
  }

  function refreshMobilePhotosUI(root, draft) {
    const mod = global.vehicleEntryInspectionPhotosMobile;
    if (!mod?.renderSection) return;
    const host = (typeof mod.resolvePhotosHost === "function" ? mod.resolvePhotosHost(root) : null) ||
      (root?.id === "veiMobilePhotosHost" ? root : root?.querySelector?.("#veiMobilePhotosHost"));
    if (!host) return;
    if (typeof mod.syncSection === "function") {
      mod.syncSection(host, draft);
    } else {
      host.innerHTML = mod.renderSection(draft);
    }
  }

  function scheduleMobilePhotosSync(root, draft) {
    window.clearTimeout(_photoSyncTimer);
    _photoSyncTimer = window.setTimeout(() => {
      if (!_session || _session.draft !== draft) return;
      refreshMobilePhotosUI(root || document.getElementById("veiModalBody"), draft);
    }, 400);
  }

  function bindMobilePhotosIfNeeded(root, draft) {
    refreshMobilePhotosUI(root, draft);
  }

  function diagramSrcForDraft(draft) {
    return draftCfg(draft).diagram || DEFAULT_DIAGRAM_SRC;
  }

  function diagramAbsUrl(draft) {
    const src = diagramSrcForDraft(draft);
    try {
      return new URL(src, global.location?.origin || "").href;
    } catch (e) {
      return src;
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
    const src = esc(diagramAbsUrl(draft));
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
    const src = esc(diagramAbsUrl(draft));
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
    if (!draft.formExtras) draft.formExtras = {};
    root.querySelectorAll(".vei-text-field[data-extra-key]").forEach((el) => {
      const key = el.getAttribute("data-extra-key");
      if (key) draft.formExtras[key] = el.value || "";
    });
    root.querySelectorAll(".vei-number-field[data-extra-key]").forEach((el) => {
      const key = el.getAttribute("data-extra-key");
      if (key) draft.formExtras[key] = el.value || "";
    });
  }

  function buildInspectionItemsPayload(draft) {
    return draftCfg(draft).checklist
      .filter((it) => it.kind === "classify")
      .map((it) => ({
        category: it.category,
        item_key: it.key,
        item_label: it.label,
        classification: draft.classifications[it.key] || "",
      }));
  }

  function buildDamagesPayload(draft) {
    const damaged = getDamagedClassifyItems(draft);
    const list = damaged.map((it) => ({
      item_key: it.key,
      area_label: it.label,
      damage_type: "Danificado",
      severity: "",
      description: "Item marcado como danificado no checklist",
      notes: "",
      client_key: it.key,
    }));
    (draft.damages || []).forEach((d) => {
      if (!list.some((x) => x.item_key === d.item_key)) list.push({ ...d, client_key: d.item_key || d.area_label });
    });
    return list;
  }

  async function handleInspectionFileInputChange(input) {
    const draft = _session?.draft;
    if (!draft || !input || input.type !== "file") return;
    const file = input.files?.[0];
    const inputId = input.id;
    const damageItem = input.getAttribute?.("data-damage-item");
    input.value = "";
    if (!file) return;
    armCameraUiGuard(1800);
    persistOpenDraft();
    const root = document.getElementById("veiModalBody");
    const photosMod = global.vehicleEntryInspectionPhotosMobile;

    if (inputId === "veiPhotoCaptureInput" || inputId === "veiPhotoGalleryInput") {
      const ok = await photosMod?.applyCapturedStandardPhoto?.(draft, file);
      if (ok) {
        if (_session?.vehicle?.id) persistDraftToStorage(_session.vehicle.id, draft);
        if (root) scheduleMobilePhotosSync(root, draft);
      }
      return;
    }

    if (damageItem || inputId === "veiDamagePhotoCaptureInput" || inputId === "veiDamagePhotoGalleryInput") {
      const key = damageItem || _session?.pendingDamagePhotoKey;
      if (!key) return;
      const preview = await readFileAsDataUrl(file);
      if (!preview) return;
      if (!draft.itemDamagePhotos) draft.itemDamagePhotos = {};
      draft.itemDamagePhotos[key] = { file, preview, capturedAt: new Date().toISOString() };
      _session.pendingDamagePhotoKey = null;
      if (_session?.vehicle?.id) persistDraftToStorage(_session.vehicle.id, draft);
      if (root) {
        window.setTimeout(() => {
          if (_session?.draft !== draft) return;
          refreshDamagePhotosHost(root, draft, _session.ctx);
        }, 400);
      }
    }
  }

  function paintFuelGaugeMark(svg, mark) {
    if (!svg) return;
    const parsed = parseFuelMark(mark);
    const existing = svg.querySelector(".vei-fuel-x");
    if (!parsed) {
      if (existing) existing.remove();
      return;
    }
    const vb = svg.viewBox?.baseVal;
    const w = vb && vb.width ? vb.width : checklistMod.FUEL_GAUGE_VB?.w || 360;
    const h = vb && vb.height ? vb.height : checklistMod.FUEL_GAUGE_VB?.h || 150;
    const x = (parsed.x / 100) * w;
    const y = (parsed.y / 100) * h;
    if (existing) {
      existing.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
      return;
    }
    const ns = "http://www.w3.org/2000/svg";
    const g = document.createElementNS(ns, "g");
    g.setAttribute("class", "vei-fuel-x");
    g.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    g.style.pointerEvents = "none";
    const s = 11;
    [
      [-s, -s, s, s],
      [s, -s, -s, s],
    ].forEach((pts) => {
      const line = document.createElementNS(ns, "line");
      line.setAttribute("x1", String(pts[0]));
      line.setAttribute("y1", String(pts[1]));
      line.setAttribute("x2", String(pts[2]));
      line.setAttribute("y2", String(pts[3]));
      line.setAttribute("stroke", "#dc2626");
      line.setAttribute("stroke-width", "3.2");
      line.setAttribute("stroke-linecap", "round");
      g.appendChild(line);
    });
    svg.appendChild(g);
  }

  function paintClassificationRow(row, cls) {
    if (!row) return;
    row.classList.toggle("vei-item-pending", !cls);
    row.querySelectorAll(".vei-class-btn[data-class]").forEach((btn) => {
      const on = btn.getAttribute("data-class") === cls;
      btn.classList.toggle("active", on);
      btn.classList.toggle("vei-cls-on", on);
      if (btn.classList.contains("vei-cls-box")) {
        const code = CLASS_SHORT[btn.getAttribute("data-class")] || "";
        btn.textContent = on ? code : "";
      }
    });
  }

  function updateChecklistProgressChrome(root, draft) {
    if (!root || !draft) return;
    const cfg = draftCfg(draft);
    const done = classifiedCount(draft);
    const total = trackedChecklistItems(draft).length;
    const pct = progressPct(draft);
    const miss = missingItems(draft);
    const progressText = root.querySelector("#veiProgressText");
    const progressBar = root.querySelector("#veiProgressBar i");
    const warn = root.querySelector("#veiMissingWarn");
    if (progressText) progressText.textContent = `${cfg.label}: ${done}/${total} itens (${pct}%)`;
    if (progressBar) progressBar.style.width = `${pct}%`;
    if (warn) {
      warn.textContent = miss.length
        ? `Itens pendentes (${miss.length}). Preencha todas as opções de cada seção.`
        : "Checklist completo — role até o final para salvar.";
      warn.style.color = miss.length ? "#d97706" : "#16a34a";
    }
  }

  function refreshDamagePhotosHost(root, draft, ctx) {
    if (!root || !draft) return;
    const itemPhotosHost = root.querySelector("#veiDocItemDamagePhotosHost");
    const closingHost = root.querySelector("#veiDamagePhotosSection")?.parentElement;
    if (itemPhotosHost) {
      itemPhotosHost.innerHTML = renderItemDamagePhotosSection(draft, false);
      bindItemDamagePhotoEvents(itemPhotosHost, draft, () => refreshDamagePhotosHost(root, draft, ctx));
    } else if (closingHost && getClosingStep(draft) === "damage_photos") {
      refreshCurrentEditUI(root, draft, ctx);
    }
  }

  function handleEditModalInteraction(evt) {
    const draft = _session?.draft;
    const ctx = _session?.ctx;
    if (_session.mode !== "edit" || !draft || !ctx) return;

    const root = document.getElementById("veiModalBody");
    if (!root) return;

    const hit = eventTargetElement(evt);
    if (!hit) return;

    if (isPhotoCaptureControl(hit)) {
      persistOpenDraft();
      if (isCameraUiGuarded()) {
        evt.preventDefault();
        evt.stopPropagation();
      }
      return;
    }

    if (isCameraUiGuarded()) {
      if (hit.closest?.("#veiFinalizeBtn") || hit.closest?.("#veiModalClose") || hit.closest?.("#veiModalCloseInner")) {
        evt.preventDefault();
        evt.stopPropagation();
        return;
      }
    }

    const photosMod = global.vehicleEntryInspectionPhotosMobile;
    const photoJump = hit.closest?.("[data-photo-jump]");
    if (photoJump && root.contains(photoJump)) {
      const idx = Number(photoJump.getAttribute("data-photo-jump"));
      if (photosMod?.jumpPhoto?.(draft, idx)) {
        if (_session?.vehicle?.id) persistDraftToStorage(_session.vehicle.id, draft);
        refreshMobilePhotosUI(root, draft);
      }
      return;
    }
    if (hit.closest?.("#veiPhotoPrevBtn") && root.contains(hit.closest("#veiPhotoPrevBtn"))) {
      evt.preventDefault();
      if (photosMod?.stepPhoto?.(draft, -1)) {
        if (_session?.vehicle?.id) persistDraftToStorage(_session.vehicle.id, draft);
        refreshMobilePhotosUI(root, draft);
      }
      return;
    }
    if (hit.closest?.("#veiPhotoNextBtn") && root.contains(hit.closest("#veiPhotoNextBtn"))) {
      evt.preventDefault();
      if (photosMod?.stepPhoto?.(draft, 1)) {
        if (_session?.vehicle?.id) persistDraftToStorage(_session.vehicle.id, draft);
        refreshMobilePhotosUI(root, draft);
      }
      return;
    }

    const choiceBtn = hit.closest?.(".vei-choice-btn[data-extra-key]");
    if (choiceBtn && root.contains(choiceBtn)) {
      evt.preventDefault();
      evt.stopPropagation();
      const extraKey = choiceBtn.getAttribute("data-extra-key");
      const value = choiceBtn.getAttribute("data-choice");
      if (extraKey && value) {
        if (!draft.formExtras) draft.formExtras = {};
        draft.formExtras[extraKey] = value;
        root.querySelectorAll(`.vei-choice-btn[data-extra-key="${extraKey}"]`).forEach((btn) => {
          const on = btn.getAttribute("data-choice") === value;
          btn.classList.toggle("active", on);
          btn.setAttribute("aria-pressed", on ? "true" : "false");
        });
        root.querySelectorAll(`[data-text-when-for="${extraKey}"]`).forEach((el) => {
          const when = el.getAttribute("data-text-when-value");
          el.style.display = when && when !== value ? "none" : "";
        });
        updateChecklistProgressChrome(root, draft);
        if (_session?.vehicle?.id) persistDraftToStorage(_session.vehicle.id, draft);
      }
      return;
    }

    const classBtn = hit.closest?.(".vei-class-btn[data-class]");
    if (classBtn && root.contains(classBtn)) {
      evt.preventDefault();
      const itemKey = classBtn.getAttribute("data-item");
      const cls = classBtn.getAttribute("data-class");
      if (itemKey && cls) {
        const prev = draft.classifications[itemKey];
        draft.classifications[itemKey] = cls;
        if (cls !== "DANIFICADO" && draft.itemDamagePhotos?.[itemKey]) {
          delete draft.itemDamagePhotos[itemKey];
        }
        pruneItemDamagePhotos(draft);
        paintClassificationRow(classBtn.closest(".vei-item"), cls);
        updateChecklistProgressChrome(root, draft);
        if (prev === "DANIFICADO" || cls === "DANIFICADO") {
          refreshDamagePhotosHost(root, draft, ctx);
        }
        if (_session?.vehicle?.id) persistDraftToStorage(_session.vehicle.id, draft);
      }
      return;
    }

    const diagramSvg = hit.closest?.("svg.vei-diagram");
    if (diagramSvg && root.contains(diagramSvg) && !hit.classList?.contains("vei-marker")) {
      const pt = svgPointFromEvent(diagramSvg, evt);
      if (pt) {
        draft.diagramMarkers.push(pt);
        if (_session?.vehicle?.id) persistDraftToStorage(_session.vehicle.id, draft);
        refreshCurrentEditUI(root, draft, ctx);
      }
      return;
    }

    const fuelSvg = hit.closest?.("svg.vei-fuel-gauge");
    if (fuelSvg && root.contains(fuelSvg) && !fuelSvg.classList.contains("vei-fuel-gauge--ro")) {
      const pt = svgPointFromEvent(fuelSvg, evt);
      const mark = checklistMod.fuelMarkFromSvgPoint
        ? checklistMod.fuelMarkFromSvgPoint(pt)
        : pt
          ? { x: Math.round((pt.cx / 360) * 1000) / 10, y: Math.round((pt.cy / 150) * 1000) / 10 }
          : null;
      if (mark) {
        if (!draft.formExtras) draft.formExtras = {};
        draft.formExtras.ini_fuel_gauge = mark;
        paintFuelGaugeMark(fuelSvg, mark);
        updateChecklistProgressChrome(root, draft);
        if (_session?.vehicle?.id) persistDraftToStorage(_session.vehicle.id, draft);
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
      refreshCurrentEditUI(root, draft, ctx);
      return;
    }

    if (hit.closest?.("#veiCardPrev")) {
      evt.preventDefault();
      syncClassificationsFromDom(root, draft);
      if ((draft.currentCardIndex || 0) > 0) {
        draft.currentCardIndex = (draft.currentCardIndex || 0) - 1;
        draft.closingStep = "card";
        if (_session?.vehicle?.id) persistDraftToStorage(_session.vehicle.id, draft);
        refreshCurrentEditUI(root, draft, ctx);
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
      const lastIdx = draftCfg(draft).cardCount - 1;
      if (cardIdx >= lastIdx) {
        draft.closingStep = "photos";
      } else {
        draft.currentCardIndex = cardIdx + 1;
        draft.closingStep = "card";
      }
      if (_session?.vehicle?.id) persistDraftToStorage(_session.vehicle.id, draft);
      refreshEditUI(root, draft, ctx);
      root.scrollTop = 0;
      return;
    }

    if (hit.closest?.("#veiClosingNext")) {
      evt.preventDefault();
      syncClassificationsFromDom(root, draft);
      pruneItemDamagePhotos(draft);
      const step = getClosingStep(draft);
      draft.closingStep = nextClosingStep(draft, step);
      if (_session?.vehicle?.id) persistDraftToStorage(_session.vehicle.id, draft);
      refreshEditUI(root, draft, ctx);
      root.scrollTop = 0;
      return;
    }

    if (hit.closest?.("#veiClosingPrev")) {
      evt.preventDefault();
      syncClassificationsFromDom(root, draft);
      draft.closingStep = prevClosingStep(draft, getClosingStep(draft));
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
    bindResumeListenersOnce();
    if (backdrop.dataset.veiInteractionBound === "1") return;
    backdrop.dataset.veiInteractionBound = "1";
    backdrop.addEventListener("click", handleEditModalInteraction);
    backdrop.addEventListener(
      "pointerdown",
      (evt) => {
        if (!_session || _session.mode !== "edit") return;
        const t = eventTargetElement(evt);
        if (isPhotoCaptureControl(t)) {
          persistOpenDraft();
          if (isCameraUiGuarded()) {
            evt.preventDefault();
            evt.stopPropagation();
            return;
          }
        }
        const dmg = t?.closest?.("[data-damage-photo-capture], [data-damage-photo-add]");
        if (!dmg) return;
        _session.pendingDamagePhotoKey =
          dmg.getAttribute("data-damage-photo-capture") || dmg.getAttribute("data-damage-photo-add");
      },
      true
    );
    backdrop.addEventListener("change", (evt) => {
      const t = evt.target;
      if (!t || !_session?.draft) return;
      void handleInspectionFileInputChange(t);
    });
    backdrop.addEventListener("input", (evt) => {
      const t = evt.target;
      if (!t || !_session?.draft) return;
      if (t.id === "veiGeneralNotes") {
        _session.draft.generalNotes = t.value;
      } else if (t.classList?.contains("vei-text-field") || t.classList?.contains("vei-number-field")) {
        const key = t.getAttribute("data-extra-key");
        if (key) {
          if (!_session.draft.formExtras) _session.draft.formExtras = {};
          let val = t.value || "";
          if (t.classList.contains("vei-number-field")) {
            val = String(val).replace(/[^\d]/g, "");
            if (t.value !== val) t.value = val;
          }
          _session.draft.formExtras[key] = val;
        }
      }
      if (_session?.vehicle?.id) persistDraftToStorage(_session.vehicle.id, _session.draft);
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
      '<span class="vei-leg vei-leg--b"><i>B</i> Bom</span>' +
      '<span class="vei-leg vei-leg--r"><i>R</i> Regular</span>' +
      '<span class="vei-leg vei-leg--d"><i>D</i> Danificada</span>' +
      '<span class="vei-leg vei-leg--s"><i>S</i> Sem teste</span>' +
      '<span class="vei-leg vei-leg--i"><i>I</i> Inexistente</span>' +
      "</div>"
    );
  }

  function renderEditStatusBar(vehicle) {
    const vehicleLine =
      [vehicle.marca, vehicle.modelo].filter(Boolean).join(" ") +
      (vehicle.placa ? " · " + vehicle.placa : "") +
      (vehicle.ano ? " · " + vehicle.ano : "");
    return (
      '<div class="vei-status-bar">' +
      '<span class="vei-status-label">Vistoria em andamento</span>' +
      `<span class="vei-status-vehicle">${esc(vehicleLine || "—")}</span>` +
      "</div>"
    );
  }

  function renderCardStepper(draft) {
    const cfg = draftCfg(draft);
    const current = Math.max(0, Math.min(cfg.cardCount - 1, draft.currentCardIndex || 0));
    let html =
      '<div class="vei-stepper" id="veiStepper" role="navigation" aria-label="Etapas da vistoria">';
    cfg.cards.forEach((card, i) => {
      const cls = i === current ? " active" : i < current ? " done" : "";
      const label = String(card.title || "")
        .split(/\s+/)
        .slice(0, 2)
        .join(" ");
      html += `<div class="vei-step${cls}" data-step="${i}">`;
      html += `<span class="vei-step-num">${i + 1}</span>`;
      html += `<span class="vei-step-label">${esc(label || card.title || "")}</span>`;
      html += "</div>";
    });
    html += "</div>";
    return html;
  }

  function renderChoiceButtons(extraKey, choices, selected, readOnly) {
    let html = '<span class="vei-choice-group">';
    (choices || []).forEach((ch) => {
      const value = ch.value || ch;
      const label = ch.label || ch;
      const on = selected === value;
      if (readOnly) {
        html += `<span class="vei-choice-btn${on ? " active" : ""}">${esc(label)}</span>`;
      } else {
        html += `<button type="button" class="secondary vei-choice-btn${on ? " active" : ""}" data-extra-key="${esc(extraKey)}" data-choice="${esc(value)}" aria-pressed="${on ? "true" : "false"}">${esc(label)}</button>`;
      }
    });
    html += "</span>";
    return html;
  }

  function renderChoiceFollowup(it, draft, readOnly) {
    if (!it.textKey || !it.textWhen) return "";
    const extras = draft.formExtras || {};
    const hidden = extras[it.key] !== it.textWhen;
    const val = extras[it.textKey] || "";
    let html = `<span class="vei-choice-followup" data-text-when-for="${esc(it.key)}" data-text-when-value="${esc(it.textWhen)}"${hidden ? ' style="display:none"' : ""}>`;
    html += `<label>${esc(it.textLabel || "Quais?")}</label> `;
    if (readOnly) html += `<span>${esc(val || "—")}</span>`;
    else {
      html += `<input type="text" class="vei-text-field vei-pertences-field" data-extra-key="${esc(it.textKey)}" value="${esc(val)}" placeholder="${esc(it.textPlaceholder || "Descreva os pertences")}"/>`;
    }
    html += "</span>";
    return html;
  }

  function renderItemExtraRows(it, draft, readOnly, colSpan) {
    const extras = draft.formExtras || {};
    let html = "";
    if (it.choiceKey && it.choices && it.choices.length) {
      html += `<tr class="vei-extra-row"><td colspan="${colSpan}">`;
      html += `<label>${esc(it.choiceLabel || "Tipo")}</label> `;
      html += renderChoiceButtons(it.choiceKey, it.choices, extras[it.choiceKey] || "", readOnly);
      html += "</td></tr>";
    }
    if (it.numberKey) {
      const qVal = extras[it.numberKey] || "";
      html += `<tr class="vei-qty-row vei-extra-row"><td colspan="${colSpan}">`;
      html += `<label>${esc(it.numberLabel || "Quantidade")}</label> `;
      if (readOnly) html += esc(qVal || "—");
      else html += `<input type="number" min="0" step="1" class="vei-number-field" data-extra-key="${esc(it.numberKey)}" value="${esc(qVal)}" style="max-width:120px"/>`;
      html += "</td></tr>";
    }
    if (it.textKey) {
      const triggerVal = extras[it.key] || extras[it.choiceKey] || "";
      const hidden = !!(it.textWhen && triggerVal !== it.textWhen);
      const val = extras[it.textKey] || "";
      html += `<tr class="vei-text-row vei-extra-row"${it.textWhen ? ` data-text-when-for="${esc(it.key)}" data-text-when-value="${esc(it.textWhen)}"` : ""}${hidden ? ' style="display:none"' : ""}><td colspan="${colSpan}">`;
      html += `<label>${esc(it.textLabel || "")}</label> `;
      if (readOnly) html += esc(val || "—");
      else html += `<input type="text" class="vei-text-field" data-extra-key="${esc(it.textKey)}" value="${esc(val)}" placeholder="${esc(it.textPlaceholder || "")}"/>`;
      html += "</td></tr>";
    }
    if (it.textKey2) {
      const val = extras[it.textKey2] || "";
      html += `<tr class="vei-text-row vei-extra-row"><td colspan="${colSpan}">`;
      html += `<label>${esc(it.textLabel2 || "")}</label> `;
      if (readOnly) html += esc(val || "—");
      else html += `<input type="text" class="vei-text-field" data-extra-key="${esc(it.textKey2)}" value="${esc(val)}" placeholder="${esc(it.textPlaceholder2 || "")}"/>`;
      html += "</td></tr>";
    }
    return html;
  }

  function renderCardStep(cardIndex, draft, readOnly, opts) {
    opts = opts || {};
    const cfg = draftCfg(draft);
    const card = cfg.cards[cardIndex];
    if (!card) return "";
    const cardCount = cfg.cardCount;
    const isLast = cardIndex === cardCount - 1;
    const colSpan = CLASSIFICATIONS.length + 1;
    let html = '<div class="vei-card-form">';
    html += `<div class="vei-card-header-bar">`;
    html += `<span class="vei-card-title-text">${cardIndex + 1}. ${esc(card.title)}</span>`;
    html += `</div>`;

    let clsHeadRendered = false;

    card.blocks.forEach((block, blockIdx) => {
      if (block.title) {
        html += `<div class="vei-block-title">${esc(block.title)}</div>`;
      } else if (blockIdx > 0 && card.blocks.length > 1) {
        html += `<div class="vei-block-title">Bloco ${blockIdx + 1}</div>`;
      }
      if (block.fuelGauge) {
        const mark = draft.formExtras?.ini_fuel_gauge;
        html += '<div class="vei-fuel-gauge-wrap">';
        html += checklistMod.renderFuelGaugeSvg
          ? checklistMod.renderFuelGaugeSvg(mark, { readOnly })
          : "";
        if (!readOnly) {
          html += '<p class="vei-fuel-gauge-hint">Toque no diagrama para marcar o nível com um X vermelho.</p>';
        }
        html += "</div>";
      }
      if (block.textFields?.length) {
        html += '<table class="vei-form-table"><tbody>';
        block.textFields.forEach((tf) => {
          const val = draft.formExtras?.[tf.key] || "";
          html += `<tr class="vei-text-row"><td colspan="${colSpan}">`;
          html += `<label>${esc(tf.label)}</label>`;
          if (readOnly) {
            html += `<div>${esc(val || "—")}</div>`;
          } else {
            html += `<input type="text" class="vei-text-field" data-extra-key="${esc(tf.key)}" value="${esc(val)}" placeholder="${esc(tf.placeholder || "")}"/>`;
          }
          html += "</td></tr>";
        });
        html += "</tbody></table>";
      }
      const items = block.items || [];
      if (!items.length) return;
      const hasClassify = items.some((it) => (it.kind || "classify") === "classify");
      html += '<table class="vei-form-table vei-checklist-table">';
      html += '<colgroup><col class="vei-col-item"/><col class="vei-col-cls" span="5"/></colgroup>';
      if (hasClassify && !clsHeadRendered) {
        html += '<thead class="vei-thead-cols"><tr><th class="vei-th-item">Item</th>';
        CLASSIFICATIONS.forEach((c) => {
          html += `<th class="vei-th-cls" title="${esc(c.label)}">${esc(CLASS_SHORT[c.id] || c.label.charAt(0))}</th>`;
        });
        html += "</tr></thead>";
        clsHeadRendered = true;
      }
      html += "<tbody>";
      items.forEach((it) => {
        const kind = it.kind || "classify";
        if (kind === "text") {
          const val = draft.formExtras?.[it.key] || "";
          html += `<tr class="vei-text-row"><td colspan="${colSpan}">`;
          html += `<label>${esc(it.label)}</label>`;
          if (readOnly) html += `<div>${esc(val || "—")}</div>`;
          else html += `<input type="text" class="vei-text-field" data-extra-key="${esc(it.key)}" value="${esc(val)}" placeholder="${esc(it.placeholder || "")}"/>`;
          html += "</td></tr>";
          return;
        }
        if (kind === "number") {
          const val = draft.formExtras?.[it.key] || "";
          html += `<tr class="vei-text-row vei-number-item"><td colspan="${colSpan}">`;
          html += `<label>${esc(it.label)}</label> `;
          if (readOnly) html += `<div>${esc(val || "—")}</div>`;
          else {
            html += `<input type="text" inputmode="numeric" pattern="[0-9]*" class="vei-number-field" data-extra-key="${esc(it.key)}" value="${esc(val)}" placeholder="Somente números"/>`;
          }
          html += "</td></tr>";
          return;
        }
        if (kind === "choice" || kind === "pick") {
          const sel = draft.formExtras?.[it.key] || "";
          const optsList = it.choices || it.options || [];
          html += `<tr class="vei-text-row vei-choice-item"><td colspan="${colSpan}">`;
          html += `<label>${esc(it.label)}</label> `;
          html += renderChoiceButtons(it.key, optsList, sel, readOnly);
          html += renderChoiceFollowup(it, draft, readOnly);
          html += "</td></tr>";
          html += renderItemExtraRows(
            it.textWhen ? Object.assign({}, it, { textKey: null }) : it,
            draft,
            readOnly,
            colSpan
          );
          return;
        }
        if (kind !== "classify") return;
        const sel = draft.classifications[it.key];
        const allowed = allowedClassIds(it);
        html += `<tr class="vei-item${!readOnly && !sel ? " vei-item-pending" : ""}" data-item-key="${esc(it.key)}">`;
        html += `<td class="vei-td-label">${esc(it.label)}</td>`;
        CLASSIFICATIONS.forEach((c) => {
          const short = CLASS_SHORT[c.id] || c.label.charAt(0);
          if (!allowed.includes(c.id)) {
            html += '<td class="vei-td-cls vei-td-cls-na"></td>';
            return;
          }
          if (readOnly) {
            html += `<td class="vei-td-cls"><span class="vei-cls-box${sel === c.id ? " vei-cls-on" : ""}">${sel === c.id ? esc(short) : ""}</span></td>`;
          } else if (opts.docStyleCells) {
            html += `<td class="vei-td-cls"><button type="button" class="vei-class-btn vei-cls-box${sel === c.id ? " vei-cls-on active" : ""}" data-class="${c.id}" data-item="${esc(it.key)}" aria-label="${esc(c.label)}" title="${esc(c.label)}">${sel === c.id ? esc(short) : ""}</button></td>`;
          } else {
            html += `<td class="vei-td-cls"><button type="button" class="vei-class-btn vei-cell-btn${sel === c.id ? " active" : ""}" data-class="${c.id}" data-item="${esc(it.key)}" aria-label="${esc(c.label)}" title="${esc(c.label)}"><span class="vei-class-btn-label" aria-hidden="true">${esc(short)}</span></button></td>`;
          }
        });
        html += "</tr>";
        html += renderItemExtraRows(it, draft, readOnly, colSpan);
      });
      html += "</tbody></table>";
    });

    if (!readOnly && !opts.allCardsVisible && (!isLast || getClosingStep(draft) === "card")) {
      html += '<div class="vei-card-nav">';
      html += `<button type="button" class="secondary vei-card-prev" id="veiCardPrev"${cardIndex === 0 ? " disabled" : ""}>Anterior</button>`;
      html += `<span class="vei-card-progress" id="veiCardProgress">${cardIndex + 1} / ${cardCount}</span>`;
      html += '<button type="button" id="veiCardNext">OK, próximo</button>';
      html += "</div>";
    }
    html += "</div>";
    return html;
  }

  function renderItemDamagePhotosSection(draft, readOnly) {
    const damaged = getDamagedClassifyItems(draft);
    if (!damaged.length) return "";
    if (!draft.itemDamagePhotos) draft.itemDamagePhotos = {};
    let html =
      '<div class="vei-damage-photos-section" id="veiDamagePhotosSection">' +
      "<h4>Fotos adicionais de avarias</h4>";
    damaged.forEach((it) => {
      const photo = draft.itemDamagePhotos[it.key];
      html += '<div class="vei-damage-photo-item" data-damage-photo-key="' + esc(it.key) + '">';
      html += `<strong>${esc(it.label)} — Danificada</strong>`;
      if (photo?.preview) {
        html += `<img class="vei-damage-photo-preview" src="${esc(photo.preview)}" alt="${esc(it.label)}"/>`;
      }
      if (!readOnly) {
        html +=
          `<label class="secondary vei-damage-photo-btn" data-damage-photo-capture="${esc(it.key)}">` +
          `<span class="vei-photo-btn-text">${photo?.preview ? "Refazer foto" : "Tirar foto"}</span>` +
          `<input type="file" accept="image/*" capture="environment" class="vei-photo-native-input" data-damage-photo-file="capture" data-damage-item="${esc(it.key)}"/>` +
          "</label>" +
          `<label class="secondary vei-damage-photo-btn" data-damage-photo-add="${esc(it.key)}">` +
          '<span class="vei-photo-btn-text">Galeria</span>' +
          `<input type="file" accept="image/*" class="vei-photo-native-input" data-damage-photo-file="gallery" data-damage-item="${esc(it.key)}"/>` +
          "</label>";
        if (photo?.preview) {
          html += `<button type="button" class="secondary vei-damage-photo-clear" data-damage-photo-clear="${esc(it.key)}">Remover</button>`;
        }
      }
      html += "</div>";
    });
    html += "</div>";
    return html;
  }

  function renderClosingNav(draft, step) {
    const labels = {
      photos: "Registro fotográfico",
      damage_photos: "Fotos adicionais de avarias",
      diagram: "Diagrama do veículo",
      finalize: "Finalização",
    };
    const isFinalize = step === "finalize";
    return (
      '<div class="vei-card-nav">' +
      `<button type="button" class="secondary" id="veiClosingPrev">Anterior</button>` +
      `<span class="vei-card-progress">${esc(labels[step] || step)}</span>` +
      (isFinalize
        ? `<button type="button" id="veiFinalizeBtn">${esc(finalizeButtonLabel())}</button>`
        : '<button type="button" id="veiClosingNext">OK, próximo</button>') +
      "</div>"
    );
  }

  function bindItemDamagePhotoEvents(root, draft, onRefresh) {
    const section = root.querySelector("#veiDamagePhotosSection") || root;
    if (!section || !draft) return;
    section.querySelectorAll("[data-damage-photo-capture]").forEach((btn) => {
      btn.addEventListener("pointerdown", () => {
        const key = btn.getAttribute("data-damage-photo-capture");
        if (_session) _session.pendingDamagePhotoKey = key;
        persistOpenDraft();
      });
    });
    section.querySelectorAll("[data-damage-photo-add]").forEach((btn) => {
      btn.addEventListener("pointerdown", () => {
        const key = btn.getAttribute("data-damage-photo-add");
        if (_session) _session.pendingDamagePhotoKey = key;
        persistOpenDraft();
      });
    });
    section.querySelectorAll("[data-damage-photo-clear]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-damage-photo-clear");
        if (key && draft.itemDamagePhotos) delete draft.itemDamagePhotos[key];
        if (_session?.vehicle?.id) persistDraftToStorage(_session.vehicle.id, draft);
        onRefresh();
      });
    });
  }

  function renderLastCardExtras(draft) {
    const step = getClosingStep(draft);
    if (step === "card") return "";

    const cfg = draftCfg(draft);
    let html = '<div class="vei-last-card-extras">';

    if (step === "photos") {
      html += '<div id="veiMobilePhotosHost">' + renderMobilePhotosSection(draft) + "</div>";
      html += renderClosingNav(draft, "photos");
    } else if (step === "damage_photos") {
      html += renderItemDamagePhotosSection(draft, false);
      html += renderClosingNav(draft, "damage_photos");
    } else if (step === "diagram") {
      html +=
        '<div class="vei-diagram-footer">' +
        `<h4>Diagrama de avarias — ${esc(cfg.shortLabel || cfg.label || "veículo")}</h4>` +
        '<div id="veiDiagramHost">' +
        renderDiagram(draft, false) +
        "</div></div>";
      html += renderClosingNav(draft, "diagram");
    } else if (step === "finalize") {
      html +=
        '<div class="vei-notes-block">' +
        '<label for="veiGeneralNotes">Observações gerais da vistoria</label>' +
        `<textarea class="vei-notes" id="veiGeneralNotes" placeholder="Informações adicionais…">${esc(draft.generalNotes)}</textarea>` +
        "</div>";
      html += renderClosingNav(draft, "finalize");
    }

    html +=
      '<div class="vei-actions vei-no-print">' +
      '<button type="button" class="secondary" id="veiModalCloseInner">Cancelar</button>' +
      "</div></div>";
    return html;
  }

  /** Todas as seções visíveis (consulta / edição em scroll). */
  function renderChecklistRows(draft, readOnly, opts) {
    opts = opts || {};
    let html = '<div class="vei-cards-stack">';
    draftCfg(draft).cards.forEach((card, idx) => {
      html += '<div class="vei-card-panel">' + renderCardStep(idx, draft, readOnly, opts) + "</div>";
    });
    html += "</div>";
    return html;
  }

  function buildChecklistViewHtml(draft, readOnly, options) {
    options = options || {};
    const rowOpts = {
      allCardsVisible: options.allCardsVisible !== false,
      docStyleCells: options.docStyleCells !== false,
    };
    const cfg = draftCfg(draft);
    let html = '<div class="vei-shell vei-checklist-view">';

    if (options.showProgress && !readOnly) {
      const done = classifiedCount(draft);
      const total = trackedChecklistItems(draft).length;
      const pct = progressPct(draft);
      const miss = missingItems(draft);
      html +=
        `<div class="vei-progress"><span id="veiProgressText">${esc(cfg.label)}: ${done}/${total} itens (${pct}%)</span>` +
        `<div class="vei-progress-bar" id="veiProgressBar"><i style="width:${pct}%"></i></div></div>` +
        `<p id="veiMissingWarn" class="notice" style="margin:0;color:${miss.length ? "#d97706" : "#16a34a"}">${
          miss.length ? `Itens pendentes (${miss.length}). Preencha todas as opções de cada seção.` : "Checklist completo — role até o final para salvar."
        }</p>`;
    }

    if (options.showLegend !== false) html += renderFormLegend();
    html += `<div id="veiChecklistHost">${renderChecklistRows(draft, readOnly, rowOpts)}</div>`;
    if (options.extrasHtml) html += options.extrasHtml;
    if (options.actionsHtml) html += options.actionsHtml;
    html += "</div>";
    return html;
  }

  function buildEditExtrasAllHtml(draft) {
    const cfg = draftCfg(draft);
    return (
      '<div class="vei-edit-extras">' +
      '<div class="vei-card-panel">' +
      '<div class="vei-section-head">Registro fotográfico</div>' +
      '<div class="vei-section-body"><div id="veiMobilePhotosHost">' +
      renderMobilePhotosSection(draft) +
      "</div></div></div>" +
      '<div class="vei-card-panel">' +
      '<div class="vei-section-head">Fotos adicionais de avarias</div>' +
      '<div class="vei-section-body" id="veiDocItemDamagePhotosHost">' +
      renderItemDamagePhotosSection(draft, false) +
      "</div></div>" +
      '<div class="vei-card-panel">' +
      `<div class="vei-section-head">Diagrama de avarias — ${esc(cfg.shortLabel || cfg.label || "veículo")}</div>` +
      '<div class="vei-section-body"><div id="veiDiagramHost">' +
      renderDiagram(draft, false) +
      "</div></div></div>" +
      '<div class="vei-card-panel">' +
      '<div class="vei-section-head">Observações gerais</div>' +
      '<div class="vei-section-body">' +
      '<label for="veiGeneralNotes">Observações gerais da vistoria</label>' +
      `<textarea class="vei-notes" id="veiGeneralNotes" placeholder="Informações adicionais…">${esc(draft.generalNotes || "")}</textarea>` +
      "</div></div></div>"
    );
  }

  function buildReadonlyExtrasHtml(vehicle, ctx, inspection, detail, draft) {
    const cfg = draftCfg(draft);
    const docMod = global.vehicleEntryInspectionDocument;
    docMod?.injectStylesOnce?.();
    let html = '<div class="vei-edit-extras">';

    const photosHtml = docMod?.buildViewPhotosHtml ? docMod.buildViewPhotosHtml(detail) : "";
    if (photosHtml) {
      html +=
        '<div class="vei-card-panel">' +
        '<div class="vei-section-head">Registro fotográfico</div>' +
        `<div class="vei-section-body">${photosHtml}</div></div>`;
    }

    html +=
      '<div class="vei-card-panel">' +
      `<div class="vei-section-head">Diagrama de avarias — ${esc(cfg.shortLabel || cfg.label || "veículo")}</div>` +
      '<div class="vei-section-body vei-doc-diagram">' +
      renderDiagramForPrint(draft) +
      "</div></div>";

    if (draft.generalNotes) {
      html +=
        '<div class="vei-card-panel">' +
        '<div class="vei-section-head">Observações gerais</div>' +
        `<div class="vei-section-body vei-readonly-notes">${esc(draft.generalNotes)}</div></div>`;
    }

    html += "</div>";
    return html;
  }

  function buildPrintDocumentRoot(vehicle, ctx, inspection, detail) {
    const draft = detailToDraft(detail);
    const docMod = global.vehicleEntryInspectionDocument;
    if (!docMod?.buildPrintHtml) return null;
    const host = document.createElement("div");
    host.innerHTML = docMod.buildPrintHtml({
      vehicle,
      ctx: { ...ctx, partnerName: (c, id) => partnerName(c, id) },
      inspection,
      detail,
      draft,
      helpers: {
        getVariantConfig,
        draftCfg,
        CLASSIFICATIONS,
        CLASS_SHORT,
        fmtDateTime,
        renderDiagram,
        renderDiagramForPrint,
        diagramSrcForDraft,
      },
    });
    return host.querySelector("#veiPrintDocument") || host.querySelector(".vei-print-root") || host.firstElementChild;
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

  function renderVehicleMeta(vehicle, ctx, inspection, draft) {
    const variantLabel = draft ? draftCfg(draft).label : inspection?.inspection_variant ? getVariantConfig(inspection.inspection_variant).label : "";
    const inspLine = inspection
      ? `<div><span>Nº vistoria</span><strong>${esc(inspection.inspection_number)}</strong></div>` +
        `<div><span>Tipo</span><strong>${esc(variantLabel || inspection.inspection_variant || "—")}</strong></div>` +
        `<div><span>Data/hora</span><strong>${esc(fmtDateTime(inspection.completed_at))}</strong></div>` +
        `<div><span>Responsável</span><strong>${esc(inspection.completed_by_name || "—")}</strong></div>` +
        `<div><span>Status</span><strong>CONCLUÍDA</strong></div>`
      : `<div><span>Tipo de vistoria</span><strong>${esc(variantLabel || "—")}</strong></div>` +
        `<div><span>Data/hora vistoria</span><strong>${esc(fmtDateTime(new Date().toISOString()))}</strong></div>` +
        `<div><span>Responsável</span><strong>${esc(readInspectorIdentity(vehicle?.id)?.inspectorName || "—")}</strong></div>`;
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
    const item = draftCfg(draft).checklist.find((x) => x.key === itemKey);
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
      refreshCurrentEditUI(root, draft, ctx);
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
    const cfg = draftCfg(draft);
    const cardIdx = Math.max(0, Math.min(cfg.cardCount - 1, draft.currentCardIndex || 0));
    draft.currentCardIndex = cardIdx;
    const isLast = cardIdx === cfg.cardCount - 1;
    let closingStep = isLast ? getClosingStep(draft) : "card";
    if (!isLast) draft.closingStep = "card";
    else if (closingStep === "damage_photos" && !getDamagedClassifyItems(draft).length) {
      draft.closingStep = "diagram";
      closingStep = "diagram";
    }

    const done = classifiedCount(draft);
    const total = trackedChecklistItems(draft).length;
    const pct = progressPct(draft);
    const miss = missingItems(draft);
    const cardHost = root.querySelector("#veiCardHost");
    const extrasHost = root.querySelector("#veiLastCardExtrasHost");
    const progressText = root.querySelector("#veiProgressText");
    const progressBar = root.querySelector("#veiProgressBar i");

    const stepLabels = {
      card: `card ${cardIdx + 1}/${cfg.cardCount}`,
      photos: "registro fotográfico",
      damage_photos: "fotos adicionais de avarias",
      diagram: "diagrama",
      finalize: "finalização",
    };
    const progressLabel = isLast && closingStep !== "card" ? stepLabels[closingStep] : stepLabels.card;

    if (progressText) {
      progressText.textContent = `${cfg.label}: ${progressLabel} · ${done}/${total} itens (${pct}%)`;
    }
    if (progressBar) progressBar.style.width = `${pct}%`;
    if (cardHost) {
      cardHost.innerHTML = isLast && closingStep !== "card" ? "" : renderCardStep(cardIdx, draft, false);
    }
    if (extrasHost) {
      extrasHost.innerHTML = isLast ? renderLastCardExtras(draft) : "";
      if (isLast && closingStep === "photos") {
        bindMobilePhotosIfNeeded(extrasHost, draft);
      }
      if (isLast && closingStep === "damage_photos") {
        bindItemDamagePhotoEvents(extrasHost, draft, () => refreshEditUI(root, draft, ctx));
      }
    }
    const warn = root.querySelector("#veiMissingWarn");
    if (warn) {
      warn.textContent = miss.length
        ? `Itens pendentes no total (${miss.length}). Use «OK, próximo» em cada card.`
        : isLast && closingStep === "card"
          ? "Checklist completo — avance para o registro fotográfico."
          : "Checklist completo — conclua as etapas finais.";
      warn.style.color = miss.length ? "#d97706" : "#16a34a";
    }
    const stepperHost = root.querySelector("#veiStepperHost");
    if (stepperHost) stepperHost.innerHTML = renderCardStepper(draft);
  }

  function buildEditHtml(vehicle, ctx, draft) {
    return (
      buildChecklistViewHtml(draft, false, {
        showLegend: false,
        showProgress: false,
        docStyleCells: true,
        allCardsVisible: true,
        extrasHtml: buildEditExtrasAllHtml(draft),
        actionsHtml:
          '<div class="vei-actions vei-actions-sticky vei-no-print">' +
          `<button type="button" id="veiFinalizeBtn">${esc(finalizeButtonLabel())}</button>` +
          "</div>",
      }) +
      '<div id="veiDamageFormHost"></div>' +
      '<div id="veiDamageListHost" class="vei-damage-host-hidden" aria-hidden="true"></div>'
    );
  }

  function buildEditDocumentHtml(vehicle, ctx, inspection, detail, draft) {
    return (
      buildChecklistViewHtml(draft, false, {
        showLegend: false,
        showProgress: false,
        docStyleCells: true,
        allCardsVisible: true,
        extrasHtml: buildEditExtrasAllHtml(draft),
        actionsHtml:
          '<div class="vei-actions vei-actions-sticky vei-no-print">' +
          `<button type="button" id="veiFinalizeBtn">${esc(finalizeButtonLabel())}</button>` +
          "</div>",
      }) +
      '<div id="veiDamageFormHost"></div>'
    );
  }

  function refreshEditChecklistUI(root, draft, ctx) {
    if (!root || !draft) return;
    const checklistHost = root.querySelector("#veiChecklistHost");
    if (checklistHost) {
      checklistHost.innerHTML = renderChecklistRows(draft, false, {
        allCardsVisible: true,
        docStyleCells: true,
      });
    }
    const diagramHost = root.querySelector("#veiDiagramHost");
    if (diagramHost) diagramHost.innerHTML = renderDiagram(draft, false);
    const itemPhotosHost = root.querySelector("#veiDocItemDamagePhotosHost");
    if (itemPhotosHost) {
      itemPhotosHost.innerHTML = renderItemDamagePhotosSection(draft, false);
      bindItemDamagePhotoEvents(itemPhotosHost, draft, () => refreshEditChecklistUI(root, draft, ctx));
    }
    const mobileHost =
      global.vehicleEntryInspectionPhotosMobile?.resolvePhotosHost?.(root) ||
      root.querySelector?.("#veiMobilePhotosHost");
    if (mobileHost) {
      bindMobilePhotosIfNeeded(root, draft);
    }
    const progressText = root.querySelector("#veiProgressText");
    const progressBar = root.querySelector("#veiProgressBar i");
    const warn = root.querySelector("#veiMissingWarn");
    if (progressText || progressBar || warn) {
      const cfg = draftCfg(draft);
      const done = classifiedCount(draft);
      const total = trackedChecklistItems(draft).length;
      const pct = progressPct(draft);
      const miss = missingItems(draft);
      if (progressText) progressText.textContent = `${cfg.label}: ${done}/${total} itens (${pct}%)`;
      if (progressBar) progressBar.style.width = `${pct}%`;
      if (warn) {
        warn.textContent = miss.length
          ? `Itens pendentes (${miss.length}). Preencha todas as opções de cada seção.`
          : "Checklist completo — role até o final para salvar.";
        warn.style.color = miss.length ? "#d97706" : "#16a34a";
      }
    }
    const finBtn = root.querySelector("#veiFinalizeBtn");
    if (finBtn) finBtn.textContent = finalizeButtonLabel();
  }

  function refreshCurrentEditUI(root, draft, ctx) {
    if (_session?.editLayout === "checklist" || _session?.allCardsVisible) {
      refreshEditChecklistUI(root, draft, ctx);
    } else {
      refreshEditUI(root, draft, ctx);
    }
  }

  function buildReadonlyHtml(vehicle, ctx, inspection, detail) {
    const draft = detailToDraft(detail);
    const deleteBtn = canDeleteCompletedInspection(ctx)
      ? '<button type="button" class="secondary vei-delete-btn" id="veiDeleteBtn">Apagar vistoria</button>'
      : "";
    return buildChecklistViewHtml(draft, true, {
      showLegend: false,
      extrasHtml: buildReadonlyExtrasHtml(vehicle, ctx, inspection, detail, draft),
      actionsHtml:
        '<div class="vei-actions vei-actions-sticky vei-no-print vei-view-actions">' +
        '<button type="button" class="secondary" id="veiPrintBtn">Imprimir</button>' +
        '<button type="button" class="secondary" id="veiPdfBtn">Baixar PDF</button>' +
        deleteBtn +
        "</div>",
    });
  }

  function normalizeClassificationValue(raw) {
    const s = String(raw || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "_")
      .replace(/-/g, "_");
    if (s === "SEMTESTE") return "SEM_TESTE";
    if (s === "BOM" || s === "REGULAR" || s === "DANIFICADO" || s === "SEM_TESTE" || s === "INEXISTENTE") return s;
    return "";
  }

  function parseFormExtras(raw) {
    if (!raw) return {};
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
      } catch (e) {
        return {};
      }
    }
    if (typeof raw === "object" && !Array.isArray(raw)) return raw;
    return {};
  }

  function inferVariantFromDetail(inspection, items, formExtras) {
    const stored = String(inspection?.inspection_variant || "").trim().toUpperCase();
    if (stored === "LEVE" || stored === "PESADOS" || stored === "TRATORES" || stored === "MOTOS") return stored;
    const keys = new Set();
    (items || []).forEach((it) => {
      const key = canonicalItemKey(it?.item_key);
      if (key) keys.add(key);
    });
    const extras = parseFormExtras(formExtras);
    const backup = extras.__item_classifications;
    if (backup && typeof backup === "object") {
      Object.keys(backup).forEach((k) => {
        const key = canonicalItemKey(k);
        if (key) keys.add(key);
      });
    }
    (Array.isArray(extras.__inspection_items) ? extras.__inspection_items : []).forEach((row) => {
      const key = canonicalItemKey(row?.item_key);
      if (key) keys.add(key);
    });
    const list = Array.from(keys);
    if (list.some((k) => String(k).startsWith("moto_"))) return "MOTOS";
    if (list.some((k) => String(k).startsWith("trat_"))) return "TRATORES";
    if (list.some((k) => String(k).startsWith("eixo_") || String(k).startsWith("car_"))) return "PESADOS";
    return "LEVE";
  }

  function canonicalItemKey(raw) {
    const s = String(raw || "").trim();
    const m = s.match(
      /^(.*)(?:::|__)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i
    );
    return m ? m[1] : s;
  }

  function extrasWithClassificationBackup(draft, items) {
    const extras = { ...(draft?.formExtras || {}) };
    const prevBackup =
      extras.__item_classifications && typeof extras.__item_classifications === "object"
        ? extras.__item_classifications
        : {};
    const backup = { ...prevBackup };
    const snapshotByKey = new Map();
    (Array.isArray(extras.__inspection_items) ? extras.__inspection_items : []).forEach((row) => {
      const key = canonicalItemKey(row?.item_key);
      if (key) snapshotByKey.set(key, { ...row, item_key: key });
    });
    (items || []).forEach((it) => {
      const key = canonicalItemKey(it?.item_key);
      const cls = normalizeClassificationValue(it?.classification);
      if (!key || !cls) return;
      backup[key] = cls;
      snapshotByKey.set(key, {
        item_key: key,
        item_label: it.item_label || "",
        category: it.category || "",
        classification: cls,
      });
    });
    extras.__item_classifications = backup;
    extras.__inspection_items = Array.from(snapshotByKey.values());
    return extras;
  }

  function hydrateInspectionItems(items, formExtras) {
    const extras = parseFormExtras(formExtras);
    const byKey = new Map();
    function add(row) {
      if (!row || typeof row !== "object") return;
      const key = canonicalItemKey(row.item_key || row.key);
      if (!key) return;
      const cls = normalizeClassificationValue(row.classification) || String(row.classification || "").trim();
      const prev = byKey.get(key);
      if (!prev) {
        byKey.set(key, { ...row, item_key: key, classification: cls || row.classification });
        return;
      }
      if (cls) prev.classification = cls;
      if (!prev.item_label && row.item_label) prev.item_label = row.item_label;
      if (!prev.category && row.category) prev.category = row.category;
    }
    (Array.isArray(extras.__inspection_items) ? extras.__inspection_items : []).forEach(add);
    (items || []).forEach(add);
    const backup = extras.__item_classifications;
    if (backup && typeof backup === "object") {
      Object.keys(backup).forEach((k) => add({ item_key: k, classification: backup[k] }));
    }
    return Array.from(byKey.values());
  }

  function applyClassificationToDraft(draft, byLabel, key, label, cls, onlyIfEmpty) {
    const value = normalizeClassificationValue(cls);
    if (!value) return;
    const itemKey = canonicalItemKey(key);
    const labelKey = byLabel.get(String(label || "").trim().toLowerCase());
    const target =
      itemKey && Object.prototype.hasOwnProperty.call(draft.classifications, itemKey)
        ? itemKey
        : labelKey || itemKey;
    if (!target) return;
    if (onlyIfEmpty && draft.classifications[target]) return;
    draft.classifications[target] = value;
  }

  function applyStoredClassifications(draft, items, formExtras) {
    const extras = parseFormExtras(formExtras);
    const backup = extras.__item_classifications;
    const byLabel = new Map();
    draftCfg(draft).checklist.forEach((it) => {
      if (it.kind === "classify") byLabel.set(String(it.label || "").trim().toLowerCase(), it.key);
    });
    const itemsByKey = new Map();
    (items || []).forEach((it) => {
      const key = canonicalItemKey(it?.item_key || it?.key);
      if (key) itemsByKey.set(key, it);
      applyClassificationToDraft(draft, byLabel, key, it?.item_label || it?.label, it?.classification, false);
    });
    if (backup && typeof backup === "object") {
      Object.keys(backup).forEach((k) => {
        const row = itemsByKey.get(canonicalItemKey(k));
        applyClassificationToDraft(
          draft,
          byLabel,
          k,
          row?.item_label || row?.label,
          backup[k],
          true
        );
      });
    }
  }

  function detailToDraft(detail) {
    const extras = parseFormExtras(detail.inspection?.form_extras);
    const variant = inferVariantFromDetail(detail.inspection, detail.items, extras);
    const draft = emptyDraftForVariant(variant);
    draft.inspectionVariant = variant;
    draft.generalNotes = detail.inspection?.general_notes || "";
    draft.diagramMarkers = normalizeDiagramMarkers(detail.inspection?.diagram_markers);
    Object.assign(draft.formExtras, extras);
    applyStoredClassifications(draft, hydrateInspectionItems(detail.items, extras), extras);
    applyStoredClassifications(draft, [], { __item_classifications: loadSavedClassifications(detail.inspection?.id) });
    applyPhotosToDraft(draft, detail.photos);
    draft.damages = (detail.damages || []).map((d) => ({
      id: d.id,
      item_key: d.item_key,
      area_label: d.area_label,
      damage_type: d.damage_type,
      severity: d.severity,
      description: d.description,
      notes: d.notes,
      photoPreview:
        d.photoPreview ||
        (detail.photos || []).find((p) => p.damage_id === d.id)?.url ||
        null,
    }));
    return draft;
  }

  function applyPhotosToDraft(draft, photos) {
    if (!draft) return;
    if (!draft.standardPhotos || typeof draft.standardPhotos !== "object") draft.standardPhotos = {};
    if (!draft.itemDamagePhotos || typeof draft.itemDamagePhotos !== "object") draft.itemDamagePhotos = {};
    if (!Array.isArray(draft.extraDamagePhotos)) draft.extraDamagePhotos = [];
    const slots = global.vehicleEntryInspectionPhotosMobile?.getStandardSlots?.(draft) || [];
    const slotKeys = slots.map((s) => s.key).filter(Boolean);
    const infer = global.vehicleEntryInspectionDocument?.inferPhotoType;
    (photos || []).forEach((p) => {
      if (!p) return;
      const url = p.url || p.preview || "";
      const type = String(p.photo_type || p.type || "").trim();
      if (type === "avaria_extra" || /^avaria_extra/i.test(type)) {
        if (url && !draft.extraDamagePhotos.some((x) => x.preview === url || x.storage_path === p.storage_path)) {
          draft.extraDamagePhotos.push({
            preview: url,
            storage_path: p.storage_path,
            label: p.photo_label || p.label,
            capturedAt: p.captured_at,
          });
        }
        return;
      }
      if (type.startsWith("avaria_item_") || p.damage_id) {
        const key = p.item_key || String(type).replace("avaria_item_", "");
        if (key && url && !draft.itemDamagePhotos[key]) {
          draft.itemDamagePhotos[key] = { preview: url, capturedAt: p.captured_at, storage_path: p.storage_path };
        }
        return;
      }
      let key = type;
      if (!key || slotKeys.indexOf(key) < 0) {
        key = infer ? infer(type, p.photo_label || p.file_name, p) : key;
      }
      if (!key || slotKeys.indexOf(key) < 0) {
        const blob = `${p.file_name || ""} ${p.storage_path || ""}`;
        key = slotKeys.find((k) => blob.indexOf(k) !== -1) || key;
      }
      if (key && url && !draft.standardPhotos[key]) {
        draft.standardPhotos[key] = {
          preview: url,
          capturedAt: p.captured_at,
          storage_path: p.storage_path,
          label: p.photo_label,
        };
      }
    });
  }

  async function uploadItemDamagePhotos(ctx, inspectionId, draft, damageRows) {
    const uid = ctx.effectiveUserId();
    if (!ctx.supabase || !uid || !inspectionId) return;
    const photos = draft.itemDamagePhotos || {};
    const damageByKey = new Map((damageRows || []).map((d) => [d.item_key, d]));
    for (const [itemKey, photo] of Object.entries(photos)) {
      if (!photo?.file && !photo?.preview) continue;
      if (!photo.file && (photo.storage_path || /^https?:/i.test(String(photo.preview || "")))) continue;
      try {
        let blob;
        if (photo.file) blob = photo.file;
        else {
          const res = await fetch(photo.preview);
          blob = await res.blob();
        }
        const label = labelForItemKey(draft, itemKey);
        const path = `${uid}/inspections/${inspectionId}/avaria/${Date.now()}_${itemKey}.jpg`;
        const { error: upErr } = await ctx.supabase.storage.from(STORAGE_BUCKET).upload(path, blob, {
          upsert: true,
          contentType: blob.type || "image/jpeg",
        });
        if (upErr) continue;
        const damageId = damageByKey.get(itemKey)?.id || null;
        const { error: insErr } = await ctx.supabase.from("vehicle_entry_inspection_photos").insert({
          inspection_id: inspectionId,
          damage_id: damageId,
          storage_path: path,
          file_name: `avaria_item_${itemKey}.jpg`,
          photo_type: `avaria_item_${itemKey}`,
          photo_label: `${label} — Danificada`,
        });
        if (insErr) {
          await ctx.supabase.from("vehicle_entry_inspection_photos").insert({
            inspection_id: inspectionId,
            storage_path: path,
            file_name: `avaria_item_${itemKey}.jpg`,
          });
        }
      } catch (e) {
        console.warn("vei item damage photo", itemKey, e);
      }
    }
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

  function mergeInspectionRows(primary, extra, keyField) {
    const byId = new Map();
    const noId = [];
    function add(row) {
      if (!row || typeof row !== "object") return;
      const id = row.id != null ? String(row.id) : "";
      if (id) {
        const prev = byId.get(id);
        if (!prev) {
          byId.set(id, row);
          return;
        }
        byId.set(id, {
          ...prev,
          ...row,
          url: prev.url || row.url || "",
          storage_path: prev.storage_path || row.storage_path || "",
        });
        return;
      }
      noId.push(row);
    }
    (primary || []).forEach(add);
    (extra || []).forEach(add);
    const out = Array.from(byId.values());
    const seenKey = new Set(out.map((r) => (r[keyField] != null ? String(r[keyField]) : "")).filter(Boolean));
    noId.forEach((row) => {
      const key = row[keyField] != null ? String(row[keyField]) : "";
      if (key && seenKey.has(key)) return;
      if (key) seenKey.add(key);
      out.push(row);
    });
    return out;
  }

  async function fetchRowsByInspection(ctx, table, inspectionId) {
    const acc = [];
    const page = 50;
    if (!ctx?.supabase || !inspectionId) return acc;
    for (let from = 0; from < 20000; from += page) {
      let { data, error } = await ctx.supabase
        .from(table)
        .select("*")
        .eq("inspection_id", inspectionId)
        .order("id", { ascending: true })
        .range(from, from + page - 1);
      if (error) {
        const retry = await ctx.supabase
          .from(table)
          .select("*")
          .eq("inspection_id", inspectionId)
          .range(from, from + page - 1);
        data = retry.data;
        error = retry.error;
      }
      if (error) {
        console.warn("vei fetch", table, error.message || error);
        break;
      }
      const rows = data || [];
      acc.push(...rows);
      if (rows.length < page) break;
    }
    return acc;
  }

  async function loadInspectionDetailViaApi(ctx, inspectionId, vehicleId) {
    if (typeof ctx?.getAccessToken !== "function") return null;
    try {
      const session = await ctx.getAccessToken();
      if (!session) return null;
      const res = await fetch("/api/vehicles/entry-inspection-detail", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session}` },
        body: JSON.stringify({
          access_token: session,
          inspection_id: inspectionId || "",
          vehicle_id: vehicleId || "",
        }),
      });
      if (!res.ok) return null;
      const json = await res.json();
      if (!json?.ok || !json.inspection) return null;
      return {
        inspection: json.inspection,
        items: json.items || [],
        damages: json.damages || [],
        photos: json.photos || [],
      };
    } catch (e) {
      console.warn("vei load api", e);
      return null;
    }
  }

  async function loadInspectionDetail(ctx, inspectionId, vehicleId) {
    const fromApi = await loadInspectionDetailViaApi(ctx, inspectionId, vehicleId);
    const inspection = fromApi?.inspection || (await loadInspectionByRef(ctx, inspectionId, vehicleId));
    if (!inspection) return null;
    const id = inspection.id;

    const clientItems = await fetchRowsByInspection(ctx, "vehicle_entry_inspection_items", id);
    const clientDamages = await fetchRowsByInspection(ctx, "vehicle_entry_inspection_damages", id);
    const clientPhotos = await fetchRowsByInspection(ctx, "vehicle_entry_inspection_photos", id);
    let items = mergeInspectionRows(fromApi?.items, clientItems, "item_key");
    const damages = mergeInspectionRows(fromApi?.damages, clientDamages, "item_key");
    const photos = mergeInspectionRows(fromApi?.photos, clientPhotos, "storage_path");
    items = hydrateInspectionItems(items, inspection.form_extras || fromApi?.inspection?.form_extras);

    const photoUrls = [];
    for (const p of photos || []) {
      let url = p.url || "";
      if (!url && p.storage_path && ctx.supabase) {
        const signed = await ctx.supabase.storage.from(STORAGE_BUCKET).createSignedUrl(p.storage_path, 3600);
        url = signed.data?.signedUrl || "";
      }
      photoUrls.push({ ...p, url });
    }

    if (inspection && !inspection.form_extras && fromApi?.inspection?.form_extras) {
      inspection.form_extras = fromApi.inspection.form_extras;
    }

    return { inspection, items: items || [], damages: damages || [], photos: photoUrls };
  }

  async function loadInspectionByRef(ctx, inspectionRef, vehicleId) {
    const uid = ctx.effectiveUserId();
    const ref = String(inspectionRef || "").trim();
    if (!ctx.supabase || !ref) return null;

    const trySelect = async (builder) => {
      const { data, error } = await builder.maybeSingle();
      if (error) console.warn("vei load inspection", error.message || error);
      return data || null;
    };

    let inspection = null;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref)) {
      inspection = await trySelect(ctx.supabase.from("vehicle_entry_inspections").select("*").eq("id", ref));
      if (!inspection && uid) {
        inspection = await trySelect(
          ctx.supabase.from("vehicle_entry_inspections").select("*").eq("id", ref).eq("user_id", uid)
        );
      }
    }
    if (!inspection && /^\d+$/.test(ref)) {
      let q = ctx.supabase.from("vehicle_entry_inspections").select("*").eq("inspection_number", Number(ref));
      if (uid) q = q.eq("user_id", uid);
      inspection = await trySelect(q.limit(1));
    }
    if (!inspection && vehicleId) {
      inspection = await findCompletedInspectionForVehicle(ctx, vehicleId);
    }
    return inspection;
  }

  async function findCompletedInspectionForVehicle(ctx, vehicleId) {
    const uid = ctx.effectiveUserId();
    if (!ctx.supabase || !vehicleId) return null;
    let q = ctx.supabase
      .from("vehicle_entry_inspections")
      .select("*")
      .eq("vehicle_id", vehicleId)
      .eq("inspection_type", "ENTRADA")
      .eq("status", "CONCLUIDA");
    if (uid) q = q.eq("user_id", uid);
    const { data, error } = await q.order("inspection_number", { ascending: false }).limit(1).maybeSingle();
    if (error) {
      console.warn("vei find inspection", error.message || error);
      const retry = await ctx.supabase
        .from("vehicle_entry_inspections")
        .select("*")
        .eq("vehicle_id", vehicleId)
        .eq("inspection_type", "ENTRADA")
        .eq("status", "CONCLUIDA")
        .order("inspection_number", { ascending: false })
        .limit(1)
        .maybeSingle();
      return retry.data || null;
    }
    return data || null;
  }

  async function uploadPhotos(ctx, inspectionId, damages) {
    const uid = ctx.effectiveUserId();
    if (!ctx.supabase || !uid) return;
    for (let i = 0; i < damages.length; i++) {
      const d = damages[i];
      if (!d.photoFile && !d.photoPreview) continue;
      if (!d.photoFile && (d.storage_path || /^https?:/i.test(String(d.photoPreview || "")))) continue;
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
            photo_type: d.item_key ? `avaria_item_${d.item_key}` : "avaria_extra",
            photo_label: d.area_label || d.description || "Avaria",
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
      const total = trackedChecklistItems(draft).length;
      alert(
        `Preencha todos os ${total} campos obrigatórios da vistoria antes de finalizar.\n\n` +
          `Pendentes (${miss.length}):\n${formatMissingAlert(miss)}`
      );
      return;
    }
    const btn = root.querySelector("#veiFinalizeBtn");
    if (btn) {
      btn.disabled = true;
      btn.textContent = _session?.editingInspectionId ? "Salvando…" : "Finalizando…";
    }
    try {
      const session = await ctx.getAccessToken();
      if (!session) {
        alert("Sessão expirada. Entre novamente.");
        return;
      }
      const items = buildInspectionItemsPayload(draft);
      const damages = buildDamagesPayload(draft).map(({ client_key, ...d }) => d);
      const formExtras = extrasWithClassificationBackup(draft, items);
      const isUpdate = !!_session?.editingInspectionId;
      const res = await fetch(
        isUpdate ? "/api/vehicles/update-entry-inspection" : "/api/vehicles/complete-entry-inspection",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session}` },
          body: JSON.stringify(
            isUpdate
              ? {
                  access_token: session,
                  inspection_id: _session.editingInspectionId,
                  vehicle_id: _session.vehicle.id,
                  inspection_variant: draft.inspectionVariant || "LEVE",
                  form_extras: formExtras,
                  general_notes: draft.generalNotes,
                  diagram_markers: normalizeDiagramMarkers(draft.diagramMarkers),
                  items,
                  damages,
                }
              : {
                  access_token: session,
                  inspector_token: readInspectorIdentity(_session.vehicle?.id)?.inspectorToken || "",
                  vehicle_id: _session.vehicle.id,
                  inspection_variant: draft.inspectionVariant || "LEVE",
                  form_extras: formExtras,
                  general_notes: draft.generalNotes,
                  diagram_markers: normalizeDiagramMarkers(draft.diagramMarkers),
                  items,
                  damages,
                }
          ),
        }
      );
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
        const errMsg = formatInspectionServerError(
          json.error || (isUpdate ? "Não foi possível salvar a vistoria." : "Não foi possível finalizar a vistoria.")
        );
        if (/checklist|classificad|item\(ns\)|pendente/i.test(String(json.error || ""))) {
          scrollToFirstMissingItem(root, draft);
        }
        alert(errMsg);
        return;
      }

      let postWarn = "";
      try {
        await uploadItemDamagePhotos(ctx, json.inspection_id, draft, json.damage_rows || []);
      } catch (itemPhotoErr) {
        console.warn("vei item damage photos", itemPhotoErr);
        postWarn += "\n\nAviso: algumas fotos de avarias por item podem não ter sido enviadas.";
      }
      try {
        await uploadPhotos(ctx, json.inspection_id, draft.damages);
      } catch (photoErr) {
        console.warn("vei damage photos", photoErr);
        postWarn += "\n\nAviso: algumas fotos de avaria podem não ter sido enviadas.";
      }
      try {
        if (global.vehicleEntryInspectionPhotosMobile?.uploadAll) {
          const photoResult = await global.vehicleEntryInspectionPhotosMobile.uploadAll(
            ctx,
            json.inspection_id,
            _session.vehicle.id,
            draft,
            {
              inspectorName: json.inspector_name,
              inspectorUserId: json.inspector_id || json.vistoriador_id || readInspectorIdentity(_session.vehicle?.id)?.inspectorUserId || ctx.effectiveUserId(),
            }
          );
          if (photoResult && photoResult.failed) {
            postWarn +=
              `\n\nAviso: ${photoResult.failed} foto(s) do registro fotográfico não foram gravadas.` +
              (photoResult.errors?.length ? `\n${photoResult.errors.slice(0, 5).join("\n")}` : "");
          } else if (photoResult && photoResult.uploaded === 0) {
            const taken = Object.keys(draft.standardPhotos || {}).filter((k) => {
              const p = draft.standardPhotos[k];
              return p && (p.file || (p.preview && String(p.preview).indexOf("data:") === 0));
            }).length;
            if (taken) {
              postWarn += "\n\nAviso: as fotos tiradas agora não chegaram a ser gravadas. Abra a vistoria e envie de novo.";
            }
          }
        }
      } catch (mobilePhotoErr) {
        console.warn("vei mobile photos", mobilePhotoErr);
        postWarn += "\n\nAviso: algumas fotos do registro fotográfico podem não ter sido enviadas.";
      }
      try {
        if (typeof ctx.loadVehicles === "function") await ctx.loadVehicles();
        if (typeof ctx.loadVehicleInspections === "function") await ctx.loadVehicleInspections();
        if (typeof ctx.renderVehicles === "function") ctx.renderVehicles();
      } catch (reloadErr) {
        console.warn("vei reload after finalize", reloadErr);
      }

      const wasEntryFlow = !_session.retroactive && !isUpdate;
      const completedVehicle = _session.vehicle;
      persistSavedClassifications(json.inspection_id, draft.classifications);
      clearDraftStorage(completedVehicle?.id);
      clearInspectorIdentity();
      alert(
        isUpdate
          ? `Vistoria nº ${json.inspection_number} atualizada.${postWarn}`
          : `Vistoria nº ${json.inspection_number} concluída.\nResponsável: ${json.inspector_name || "—"}\nData: ${fmtDateTime(json.completed_at)}${postWarn}`
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
        btn.textContent = finalizeButtonLabel();
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

  function buildVariantPickerHtml(vehicle) {
    const variants = checklistMod.INSPECTION_VARIANTS || Object.values(checklistMod.VARIANT_META || {});
    const btns = variants
      .map(
        (v) =>
          `<button type="button" class="vei-variant-btn" data-vei-variant="${esc(v.id)}">` +
          `<strong>${esc(v.label)}</strong>` +
          `<span>${esc(v.description || "")}</span>` +
          `</button>`
      )
      .join("");
    return (
      renderVehicleMeta(vehicle, _session?.ctx || {}, null, null) +
      '<div class="vei-form-legend">Selecione o tipo de vistoria para este veículo</div>' +
      `<div class="vei-variant-picker">${btns}</div>` +
      '<div class="vei-actions vei-no-print">' +
      '<button type="button" class="secondary" id="veiModalCloseInner">Cancelar</button>' +
      "</div>"
    );
  }

  function openVariantPicker(vehicle, ctx, opts) {
    ensureModal();
    setViewModalActionsVisible(false);
    document.getElementById("veiPrintHostHidden")?.replaceChildren();
    _session = { vehicle, mode: "pick_variant", retroactive: !!opts?.retroactive, ctx };
    const modal = _modalEl;
    modal.classList.remove("hidden");
    document.getElementById("veiModalTitle").textContent = "Nova vistoria — tipo de veículo";
    document.getElementById("veiModalSubtitle").textContent = `Placa ${vehicle.placa || "—"} — escolha a modalidade`;
    const body = document.getElementById("veiModalBody");
    body.innerHTML = buildVariantPickerHtml(vehicle);
    ensureEditModalEvents(body, ctx);
    body.querySelectorAll("[data-vei-variant]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const variant = btn.getAttribute("data-vei-variant");
        if (!variant) return;
        openEditModal(vehicle, ctx, { ...opts, variant });
      });
    });
    body.querySelector("#veiModalCloseInner")?.addEventListener("click", closeModal);
  }

  function openEditModal(vehicle, ctx, opts) {
    ensureModal();
    setViewModalActionsVisible(false);
    document.getElementById("veiPrintHostHidden")?.replaceChildren();
    const retroactive = !!opts?.retroactive;
    const variant = opts?.variant || "LEVE";
    const saved = loadDraftFromStorage(vehicle.id);
    const draft =
      saved && (saved.inspectionVariant || "LEVE") === variant
        ? saved
        : emptyDraftForVariant(variant);
    draft.inspectionVariant = variant;
    _session = { vehicle, mode: "edit", draft, retroactive, ctx, allCardsVisible: true, editLayout: "checklist" };
    const modal = _modalEl;
    modal.classList.remove("hidden");
    const cfg = draftCfg(draft);
    document.getElementById("veiModalTitle").textContent = "VISTORIA DE ENTRADA";
    document.getElementById("veiModalSubtitle").textContent = retroactive
      ? `Placa ${vehicle.placa || "—"} · ${cfg.label} · retroativa`
      : `Placa ${vehicle.placa || "—"} · ${cfg.label}`;
    const body = document.getElementById("veiModalBody");
    body.innerHTML = buildEditHtml(vehicle, ctx, draft);
    ensureEditModalEvents(body, ctx);
    bindResumeListenersOnce();
    markActiveEdit();
    bindMobilePhotosIfNeeded(body, draft);
    bindItemDamagePhotoEvents(body, draft, () => refreshDamagePhotosHost(body, draft, ctx));
  }

  async function openEditExistingModal(vehicle, ctx, inspectionId) {
    ensureModal();
    setViewModalActionsVisible(false);
    document.getElementById("veiPrintHostHidden")?.replaceChildren();
    const detail = await loadInspectionDetail(ctx, inspectionId, vehicle?.id);
    if (!detail) {
      alert("Vistoria não encontrada.");
      return;
    }
    const draft = detailToDraft(detail);
    _session = {
      vehicle,
      mode: "edit",
      editLayout: "checklist",
      allCardsVisible: true,
      draft,
      detail,
      retroactive: true,
      ctx,
      editingInspectionId: inspectionId,
      editingInspectionNumber: detail.inspection.inspection_number,
    };
    const modal = _modalEl;
    modal.classList.remove("hidden");
    const cfg = draftCfg(draft);
    document.getElementById("veiModalTitle").textContent = `VISTORIA DE ENTRADA Nº ${detail.inspection.inspection_number}`;
    document.getElementById("veiModalSubtitle").textContent = `Placa ${vehicle.placa || "—"} · ${cfg.label} · edição`;
    const body = document.getElementById("veiModalBody");
    body.innerHTML = buildEditDocumentHtml(vehicle, ctx, detail.inspection, detail, draft);
    ensureEditModalEvents(body, ctx);
    bindResumeListenersOnce();
    markActiveEdit();
    bindMobilePhotosIfNeeded(body, draft);
    bindItemDamagePhotoEvents(body, draft, () => refreshDamagePhotosHost(body, draft, ctx));
  }

  async function openViewModal(vehicle, ctx, inspectionId) {
    ensureModal();
    const detail = await loadInspectionDetail(ctx, inspectionId, vehicle?.id);
    if (!detail) {
      alert("Vistoria não encontrada.");
      return;
    }
    _session = { vehicle, mode: "view", detail };
    const modal = _modalEl;
    modal.classList.remove("hidden");
    document.getElementById("veiModalTitle").textContent = `VISTORIA DE ENTRADA Nº ${detail.inspection.inspection_number}`;
    document.getElementById("veiModalSubtitle").textContent = `Placa ${vehicle.placa || "—"} — consulta`;
    const body = document.getElementById("veiModalBody");
    body.innerHTML = buildReadonlyHtml(vehicle, ctx, detail.inspection, detail);
    setViewModalActionsVisible(true, { canDelete: canDeleteCompletedInspection(ctx) });
    mountHiddenPrintDocument(vehicle, ctx, detail.inspection, detail);
    bindViewModalActions(vehicle, ctx, detail.inspection, detail);
  }

  function vehicleNeedsEntryInspection(vehicle, ctx) {
    if (!vehicle) return false;
    if (typeof ctx?.vehicleNeedsEntryInspection === "function") {
      return ctx.vehicleNeedsEntryInspection(vehicle);
    }
    if (vehicleHasCompletedInspection(ctx, vehicle.id)) return false;
    const s = String(vehicle.status || "").toUpperCase();
    if (s === "REMOVIDO") return false;
    if (s === "AGUARDANDO_VISTORIA") return true;
    return vehicle.entry_inspection_flow === true;
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
    if (opts?.mode === "edit_existing") {
      if (ctx?.isVistoriador) {
        alert("O perfil Vistoriador não pode alterar uma vistoria já finalizada.");
        return;
      }
      const insp = opts.inspection || (await findCompletedInspectionForVehicle(ctx, vehicle.id));
      if (!insp) {
        alert("Este veículo não possui vistoria concluída para editar.");
        return;
      }
      await openEditExistingModal(vehicle, ctx, insp.id);
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
    if (!(await ensureInspectorForStart(ctx, vehicle))) return;
    const retroactive = String(vehicle.status || "").toUpperCase() !== "AGUARDANDO_VISTORIA";
    openVariantPicker(vehicle, ctx, { retroactive });
  }

  async function resumeActiveEdit(ctx, vehicles) {
    if (_session && _modalEl && !_modalEl.classList.contains("hidden")) return false;
    const active = readActiveEdit();
    if (!active || !ctx) return false;
    const vehicle = (vehicles || []).find((v) => String(v.id) === String(active.vehicleId));
    if (!vehicle) return false;
    try {
      if (active.editingInspectionId) {
        if (ctx.isVistoriador) {
          alert("O perfil Vistoriador não pode alterar uma vistoria já finalizada.");
          clearActiveEdit();
          return false;
        }
        await openEditExistingModal(vehicle, ctx, active.editingInspectionId);
      } else {
        if (!(await ensureInspectorForStart(ctx, vehicle))) return false;
        const retroactive = String(vehicle.status || "").toUpperCase() !== "AGUARDANDO_VISTORIA";
        openEditModal(vehicle, ctx, { variant: active.variant || "LEVE", retroactive });
      }
      return true;
    } catch (e) {
      console.warn("vei resumeActiveEdit", e);
      return false;
    }
  }

  function plateHtml(placa) {
    if (typeof global.vehiclePlateUI?.renderHtml === "function") {
      return global.vehiclePlateUI.renderHtml(placa, { size: "sm", showEmpty: true, placeholder: "—" });
    }
    return esc(placa || "—");
  }

  function renderAwaitingTable(tbody, vehicles, ctx) {
    if (!tbody) return;
    const list = (vehicles || [])
      .filter((v) => vehicleNeedsEntryInspection(v, ctx))
      .sort((a, b) => {
        const ta = new Date(a.data_entrada || a.created_at || 0).getTime();
        const tb = new Date(b.data_entrada || b.created_at || 0).getTime();
        if (tb !== ta) return tb - ta;
        return String(b.id || "").localeCompare(String(a.id || ""), "pt-BR");
      });
    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="9" class="notice" style="text-align:center;padding:18px">Nenhum veículo aguardando vistoria.</td></tr>`;
      return;
    }
    tbody.innerHTML = list
      .map((v) => {
        const loc = partnerName(ctx, v.localizador_id);
        const isGp = !!ctx.isGestorPista;
        const isVistoriador = !!ctx.isVistoriador;
        const isAdmPc = !!ctx.isAdmDesktopPc;
        let actions = "";
        if (isVistoriador) {
          actions = `<button class="vei-start-btn" data-action="vistoria" data-id="${v.id}">INICIAR VISTORIA</button>`;
        } else if (isGp) {
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
          `<tr class="vnp-row-aguardando-vistoria" data-vehicle-row="${v.id}">` +
          `<td data-label="Placa"><span class="vei-plate-with-status"><span class="vei-status-dot vei-status-dot--pending" title="Aguardando vistoria" aria-label="Aguardando vistoria"></span>${plateHtml(v.placa)}</span></td>` +
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
    getVariantConfig,
    CHECKLIST: checklistMod.CHECKLIST || [],
    INSPECTION_CARDS: checklistMod.INSPECTION_CARDS || [],
    CARD_COUNT: checklistMod.CARD_COUNT || 8,
    CLASSIFICATIONS,
    CLASS_SHORT,
    INSPECTION_ITEM_COUNT: checklistMod.ITEM_COUNT || 0,
    probeSchema,
    openForVehicle,
    promptInspectorIdentification,
    clearInspectorIdentity,
    readInspectorIdentity,
    renderAwaitingTable,
    findCompletedInspectionForVehicle,
    loadInspectionDetail,
    canStartInspection,
    canDeleteCompletedInspection,
    deleteCompletedInspection,
    vehicleHasCompletedInspection,
    renderDiagram,
    renderDiagramForPrint,
    normalizeDiagramMarkers,
    getDiagramSrc: diagramSrcForDraft,
    applyStoredClassifications,
    applyPhotosToDraft,
    hydrateInspectionItems,
    canonicalItemKey,
    extrasWithClassificationBackup,
    normalizeClassificationValue,
    inferVariantFromDetail,
    resumeActiveEdit,
    paintClassificationRow,
    emptyDraftForVariant,
    getDamagedClassifyItems,
    isItemFilled,
    parseFuelMark,
  };
})(typeof window !== "undefined" ? window : globalThis);

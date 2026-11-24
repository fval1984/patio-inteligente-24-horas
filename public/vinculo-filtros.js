/**
 * Filtros de busca por financeira, escritório, pátio e localizador.
 * Só lê cadastros e vínculos já gravados. Não altera registros.
 */
(function vinculoFiltrosModule(global) {
  "use strict";

  const FIELDS = [
    { key: "financeira", label: "Financeira" },
    { key: "escritorio", label: "Escritório" },
    { key: "patio", label: "Pátio" },
    { key: "localizador", label: "Localizador" },
  ];

  function empty() {
    return { financeira: "", escritorio: "", patio: "", localizador: "" };
  }

  function normalizeSelection(sel) {
    const s = sel || {};
    return {
      financeira: String(s.financeira || ""),
      escritorio: String(s.escritorio || ""),
      patio: String(s.patio || ""),
      localizador: String(s.localizador || ""),
    };
  }

  function isActive(sel) {
    const s = normalizeSelection(sel);
    return !!(s.financeira || s.escritorio || s.patio || s.localizador);
  }

  function fold(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function tipoCode(tipo) {
    const svc = global.partnersCadastroService;
    if (svc && typeof svc.normalizePartnerTipo === "function") return svc.normalizePartnerTipo(tipo);
    const t = String(tipo || "")
      .trim()
      .toUpperCase();
    if (t === "INSTITUICAO_FINANCEIRA" || t === "FINANCEIRA") return "INSTITUICAO_FINANCEIRA";
    if (t === "PATIO_APREENSAO" || t === "PATIO") return "PATIO_APREENSAO";
    if (t === "LOCALIZADOR" || t === "PARCEIRO" || !t) return "LOCALIZADOR";
    return t;
  }

  function inactivePartner(p) {
    return p?.ativo === false || String(p?.status || "").toUpperCase() === "INATIVO";
  }

  function inactiveOffice(o) {
    return o?.active === false || o?.ativo === false || String(o?.status || "").toUpperCase() === "INATIVO";
  }

  function byNome(a, b) {
    return String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR", { sensitivity: "base" });
  }

  function partnerOptions(list, code) {
    const out = [];
    const seen = new Set();
    for (const p of list || []) {
      if (!p?.id || seen.has(String(p.id))) continue;
      if (tipoCode(p.tipo) !== code) continue;
      seen.add(String(p.id));
      const nome = String(p.nome || "").trim() || "Sem nome";
      out.push({
        id: String(p.id),
        nome,
        label: inactivePartner(p) ? `${nome} (inativo)` : nome,
      });
    }
    out.sort(byNome);
    return out;
  }

  function officeOptions(state) {
    const cached =
      global.advocacyOfficesService && typeof global.advocacyOfficesService.listCached === "function"
        ? global.advocacyOfficesService.listCached()
        : null;
    const list = cached && cached.length ? cached : state?.advocacyOffices || [];
    const out = [];
    const seen = new Set();
    for (const o of list) {
      if (!o?.id || seen.has(String(o.id))) continue;
      seen.add(String(o.id));
      const nome = String(o.name || o.nome || "").trim() || "Sem nome";
      out.push({
        id: String(o.id),
        nome,
        label: inactiveOffice(o) ? `${nome} (inativo)` : nome,
      });
    }
    out.sort(byNome);
    return out;
  }

  function catalog(state) {
    const partners = state?.partners || [];
    return {
      financeira: partnerOptions(partners, "INSTITUICAO_FINANCEIRA"),
      escritorio: officeOptions(state),
      patio: partnerOptions(partners, "PATIO_APREENSAO"),
      localizador: partnerOptions(partners, "LOCALIZADOR"),
    };
  }

  function idsOfVehicle(vehicle) {
    return {
      financeira: String(vehicle?.financeira_id || ""),
      escritorio: String(vehicle?.advocacy_office_id || ""),
      patio: String(vehicle?.patio_parceiro_id || ""),
      localizador: String(vehicle?.localizador_id || ""),
    };
  }

  function recordIdsMatch(ids, selection) {
    const s = normalizeSelection(selection);
    if (s.financeira && String(ids?.financeira || "") !== s.financeira) return false;
    if (s.escritorio && String(ids?.escritorio || "") !== s.escritorio) return false;
    if (s.patio && String(ids?.patio || "") !== s.patio) return false;
    if (s.localizador && String(ids?.localizador || "") !== s.localizador) return false;
    return true;
  }

  function vehicleMatches(vehicle, selection) {
    if (!isActive(selection)) return true;
    if (!vehicle) return false;
    return recordIdsMatch(idsOfVehicle(vehicle), selection);
  }

  function findById(list, id) {
    const key = String(id || "");
    if (!key) return null;
    return (list || []).find((item) => String(item?.id || "") === key) || null;
  }

  function ctxOf(ctx) {
    return {
      vehicles: ctx?.vehicles || [],
      payables: ctx?.payables || [],
      receivables: ctx?.receivables || [],
      charges: ctx?.charges || [],
      towServices: ctx?.towServices || [],
    };
  }

  function vehiclesOfPayable(payable, ctx) {
    const c = ctxOf(ctx);
    const out = [];
    const seen = new Set();
    const add = (vehicle) => {
      if (!vehicle?.id || seen.has(String(vehicle.id))) return;
      seen.add(String(vehicle.id));
      out.push(vehicle);
    };
    add(findById(c.vehicles, payable?.vehicle_id));
    const blob = `${payable?.observacoes || ""} ${payable?.descricao || ""}`;
    const re = /\[\[towsvc:([^\]]+)\]\]/g;
    let match = re.exec(blob);
    while (match) {
      const service = findById(c.towServices, match[1]);
      if (service) add(findById(c.vehicles, service.vehicle_id));
      match = re.exec(blob);
    }
    for (const service of c.towServices) {
      if (String(service?.payable_id || "") === String(payable?.id || "")) {
        add(findById(c.vehicles, service.vehicle_id));
      }
    }
    return out;
  }

  function looseIds(record) {
    if (!record) return null;
    const ids = {
      financeira: String(record.financeira_id || ""),
      escritorio: String(record.advocacy_office_id || record.escritorio_id || ""),
      patio: String(record.patio_parceiro_id || record.patio_id || ""),
      localizador: String(record.localizador_id || ""),
    };
    if (!ids.financeira && !ids.escritorio && !ids.patio && !ids.localizador) return null;
    return ids;
  }

  function payableMatches(payable, selection, ctx) {
    if (!isActive(selection)) return true;
    if (!payable) return false;
    const vehicles = vehiclesOfPayable(payable, ctx);
    if (vehicles.some((vehicle) => vehicleMatches(vehicle, selection))) return true;
    if (vehicles.length) return false;
    const ids = looseIds(payable);
    if (!ids) return false;
    return recordIdsMatch(ids, selection);
  }

  function chargeMatches(charge, vehicles, selection) {
    if (!isActive(selection)) return true;
    const list = (vehicles || []).filter(Boolean);
    if (list.some((vehicle) => vehicleMatches(vehicle, selection))) return true;
    if (list.length) return false;
    const s = normalizeSelection(selection);
    const ids = { financeira: "", escritorio: String(charge?.advocacy_office_id || ""), patio: "", localizador: "" };
    const partnerId = String(charge?.parceiro_id || "");
    if (partnerId && partnerId === s.financeira) ids.financeira = partnerId;
    if (partnerId && partnerId === s.patio) ids.patio = partnerId;
    if (partnerId && partnerId === s.localizador) ids.localizador = partnerId;
    if (!ids.financeira && !ids.escritorio && !ids.patio && !ids.localizador) return false;
    return recordIdsMatch(ids, selection);
  }

  function movementMatches(mov, selection, ctx) {
    if (!isActive(selection)) return true;
    if (!mov) return false;
    const id = String(mov.conta_id || "");
    if (!id) return false;
    const c = ctxOf(ctx);
    const tipo = String(mov.tipo_conta || "").toUpperCase();
    const saida = tipo === "PAGAR" || tipo === "SAIDA" || tipo === "DESPESA";
    if (saida) return payableMatches(findById(c.payables, id), selection, c);
    const receivable = findById(c.receivables, id);
    if (receivable) return vehicleMatches(findById(c.vehicles, receivable.vehicle_id), selection);
    const charge = findById(c.charges, id);
    if (charge) {
      const vehicles = (c.receivables || [])
        .filter((row) => String(row?.charge_id || row?.cobranca_id || "") === id)
        .map((row) => findById(c.vehicles, row.vehicle_id))
        .filter(Boolean);
      return chargeMatches(charge, vehicles, selection);
    }
    return false;
  }

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function ensureStyles() {
    if (typeof document === "undefined" || document.getElementById("vinculoFiltrosStyles")) return;
    const style = document.createElement("style");
    style.id = "vinculoFiltrosStyles";
    style.textContent = `
      .vf-host { width: 100%; max-width: 100%; min-width: 0; box-sizing: border-box; }
      .vf-bar {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr)) auto;
        gap: 8px;
        align-items: end;
        width: 100%;
        max-width: 100%;
        min-width: 0;
        margin: 0 0 12px;
        box-sizing: border-box;
      }
      .vf-bar--period { grid-template-columns: repeat(6, minmax(0, 1fr)) auto; }
      .vf-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; max-width: 100%; }
      .vf-field > span { font-size: 12px; font-weight: 600; color: var(--muted, var(--ag-muted, #64748b)); }
      .vf-combo { position: relative; min-width: 0; max-width: 100%; }
      .vf-actions { display: flex; gap: 8px; align-items: end; min-width: 0; }
      .vf-bar input[data-vf-input],
      .vf-bar input[data-vf-de],
      .vf-bar input[data-vf-ate] {
        width: 100%;
        max-width: 100%;
        min-width: 0;
        box-sizing: border-box;
        min-height: 36px;
        height: 36px;
        font: inherit;
      }
      .vf-list {
        position: absolute;
        left: 0;
        right: 0;
        top: calc(100% + 4px);
        z-index: 40;
        max-height: 220px;
        overflow: auto;
        margin: 0;
        padding: 4px;
        list-style: none;
        background: var(--card, var(--ag-surface, #fff));
        color: var(--text, var(--ag-text, #111));
        border: 1px solid var(--border, var(--ag-border, #d7dbe2));
        border-radius: 8px;
        box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
      }
      .vf-list[hidden] { display: none !important; }
      .vf-list button {
        display: block;
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
        text-align: left;
        background: transparent;
        border: 0;
        color: inherit;
        font: inherit;
        padding: 8px 10px;
        border-radius: 6px;
        cursor: pointer;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .vf-list button:hover,
      .vf-list button:active,
      .vf-list button.is-active { background: rgba(30, 58, 95, 0.08); transform: none; box-shadow: none; }
      .vf-clear:hover,
      .vf-clear:active { transform: none; }
      .vf-list button.is-todos { font-weight: 700; }
      .vf-empty { padding: 8px 10px; color: var(--muted, #64748b); font-size: 13px; }
      .vf-clear {
        min-height: 36px;
        padding: 8px 12px;
        border-radius: 8px;
        border: 1px solid var(--border, var(--ag-border, #d7dbe2));
        background: transparent;
        color: inherit;
        font: inherit;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
        justify-self: start;
      }
      @media (max-width: 900px) {
        .vf-bar,
        .vf-bar--period { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .vf-actions { grid-column: 1 / -1; }
      }
      @media (max-width: 520px) {
        .vf-bar,
        .vf-bar--period { grid-template-columns: minmax(0, 1fr); }
      }
    `;
    document.head.appendChild(style);
  }

  function barHtml(withPeriod, withPrint) {
    const fields = FIELDS.map(
      (field) => `<label class="vf-field">
        <span>${esc(field.label)}</span>
        <div class="vf-combo" data-vf-key="${field.key}">
          <input type="search" data-vf-input placeholder="Todos" autocomplete="off" aria-label="${esc(field.label)}" aria-expanded="false" />
          <input type="hidden" data-vf-id value="" />
          <ul class="vf-list" data-vf-list hidden role="listbox"></ul>
        </div>
      </label>`
    ).join("");
    const period = withPeriod
      ? `<label class="vf-field"><span>De</span><input type="text" data-vf-de inputmode="numeric" maxlength="10" placeholder="DD/MM/AAAA" autocomplete="off" aria-label="Data inicial" /></label><label class="vf-field"><span>Até</span><input type="text" data-vf-ate inputmode="numeric" maxlength="10" placeholder="DD/MM/AAAA" autocomplete="off" aria-label="Data final" /></label>`
      : "";
    const print = withPrint ? `<button type="button" class="vf-clear" data-vf-print>Imprimir</button>` : "";
    return `<div class="vf-bar${withPeriod ? " vf-bar--period" : ""}">${fields}${period}<div class="vf-actions"><button type="button" class="vf-clear" data-vf-clear>Limpar filtros</button>${print}</div></div>`;
  }

  function read(host) {
    const sel = empty();
    if (!host) return sel;
    for (const field of FIELDS) {
      const id = host.querySelector(`[data-vf-key="${field.key}"] [data-vf-id]`)?.value || "";
      sel[field.key] = String(id);
    }
    return sel;
  }

  function showSelected(combo) {
    const id = combo.querySelector("[data-vf-id]")?.value || "";
    const input = combo.querySelector("[data-vf-input]");
    if (!input) return;
    if (!id) {
      input.value = "";
      return;
    }
    const opt = (combo.__vfOptions || []).find((item) => item.id === id);
    if (opt) {
      input.value = opt.label;
      combo.dataset.vfLabel = opt.label;
      return;
    }
    input.value = combo.dataset.vfLabel || "";
  }

  function closeList(combo) {
    const list = combo?.querySelector("[data-vf-list]");
    const input = combo?.querySelector("[data-vf-input]");
    if (list) list.hidden = true;
    if (input) input.setAttribute("aria-expanded", "false");
  }

  function closeHost(host) {
    host?.querySelectorAll(".vf-combo").forEach(closeList);
  }

  function renderOptions(combo, query) {
    const list = combo.querySelector("[data-vf-list]");
    if (!list) return;
    const q = fold(query || "");
    const options = combo.__vfOptions || [];
    const selected = combo.querySelector("[data-vf-id]")?.value || "";
    const matches = q ? options.filter((item) => fold(item.nome).includes(q) || fold(item.label).includes(q)) : options;
    const todos =
      q === ""
        ? `<li><button type="button" class="is-todos${selected ? "" : " is-active"}" data-vf-option="">Todos</button></li>`
        : "";
    const rows = matches
      .map(
        (item) =>
          `<li><button type="button" class="${item.id === selected ? "is-active" : ""}" data-vf-option="${esc(item.id)}">${esc(item.label)}</button></li>`
      )
      .join("");
    const emptyNote = !matches.length ? `<li class="vf-empty">Nenhum nome encontrado</li>` : "";
    list.innerHTML = `${todos}${rows}${emptyNote}`;
    list.hidden = false;
    combo.querySelector("[data-vf-input]")?.setAttribute("aria-expanded", "true");
  }

  function notify(host) {
    if (typeof host.__vfOnChange === "function") host.__vfOnChange(read(host));
  }

  function commitPeriod(host) {
    const period = host.__vfPeriod;
    if (!period || typeof period.onChange !== "function") return;
    const api = global.periodoFiltro;
    const deRaw = host.querySelector("[data-vf-de]")?.value || "";
    const ateRaw = host.querySelector("[data-vf-ate]")?.value || "";
    if ((deRaw && deRaw.length < 10) || (ateRaw && ateRaw.length < 10)) return;
    if (!api) return;
    const lido = api.read(deRaw, ateRaw);
    if (!lido.ok) {
      if (typeof global.alert === "function") global.alert(lido.erro);
      return;
    }
    const prev = host.__vfPeriodValue || { de: "", ate: "" };
    if (prev.de === lido.de && prev.ate === lido.ate) return;
    host.__vfPeriodValue = { de: lido.de, ate: lido.ate };
    period.onChange({ de: lido.de, ate: lido.ate });
  }

  function applyPeriod(host, period, notifyChange) {
    const deEl = host.querySelector("[data-vf-de]");
    const ateEl = host.querySelector("[data-vf-ate]");
    if (!deEl || !ateEl) return;
    const api = global.periodoFiltro;
    const de = period?.de || "";
    const ate = period?.ate || "";
    host.__vfPeriodValue = { de, ate };
    if (document.activeElement !== deEl) deEl.value = api && de ? api.format(de) : de ? deEl.value : "";
    if (document.activeElement !== ateEl) ateEl.value = api && ate ? api.format(ate) : ate ? ateEl.value : "";
    if (!de && document.activeElement !== deEl) deEl.value = "";
    if (!ate && document.activeElement !== ateEl) ateEl.value = "";
    if (notifyChange && typeof host.__vfPeriod?.onChange === "function") host.__vfPeriod.onChange({ de, ate });
  }

  function choose(host, combo, id) {
    const hidden = combo.querySelector("[data-vf-id]");
    if (hidden) hidden.value = String(id || "");
    const opt = (combo.__vfOptions || []).find((item) => item.id === String(id || ""));
    combo.dataset.vfLabel = opt ? opt.label : "";
    showSelected(combo);
    closeList(combo);
    notify(host);
  }

  function bind(host) {
    if (host.__vfBound) return;
    host.__vfBound = true;
    host.addEventListener("mousedown", (ev) => {
      const opt = ev.target.closest?.("[data-vf-option]");
      if (!opt || !host.contains(opt)) return;
      ev.preventDefault();
      const combo = opt.closest(".vf-combo");
      choose(host, combo, opt.getAttribute("data-vf-option") || "");
    });
    host.addEventListener("click", (ev) => {
      if (ev.target.closest?.("[data-vf-print]")) {
        ev.preventDefault();
        commitPeriod(host);
        if (typeof host.__vfPeriod?.onPrint === "function") host.__vfPeriod.onPrint();
        return;
      }
      if (!ev.target.closest?.("[data-vf-clear]")) return;
      ev.preventDefault();
      applySelection(host, empty(), true);
      applyPeriod(host, { de: "", ate: "" }, true);
    });
    host.addEventListener("focusin", (ev) => {
      const input = ev.target.closest?.("[data-vf-input]");
      if (!input || !host.contains(input)) return;
      const combo = input.closest(".vf-combo");
      host.querySelectorAll(".vf-combo").forEach((other) => {
        if (other !== combo) closeList(other);
      });
      renderOptions(combo, "");
    });
    host.addEventListener("input", (ev) => {
      const periodInput = ev.target.closest?.("[data-vf-de], [data-vf-ate]");
      if (periodInput && host.contains(periodInput)) {
        ev.stopPropagation();
        const api = global.periodoFiltro;
        if (api) {
          const next = api.mask(periodInput.value);
          if (next !== periodInput.value) periodInput.value = next;
        }
        if (!periodInput.value || periodInput.value.length === 10) commitPeriod(host);
        return;
      }
      const input = ev.target.closest?.("[data-vf-input]");
      if (!input || !host.contains(input)) return;
      ev.stopPropagation();
      renderOptions(input.closest(".vf-combo"), input.value);
    });
    host.addEventListener("change", (ev) => {
      if (ev.target.closest?.(".vf-bar")) ev.stopPropagation();
    });
    host.addEventListener("keydown", (ev) => {
      const input = ev.target.closest?.("[data-vf-input]");
      if (!input || !host.contains(input)) return;
      const combo = input.closest(".vf-combo");
      const list = combo.querySelector("[data-vf-list]");
      if (ev.key === "Escape") {
        closeList(combo);
        showSelected(combo);
        return;
      }
      if (ev.key === "Enter") {
        ev.preventDefault();
        const active = list?.querySelector("button.is-active") || list?.querySelector("[data-vf-option]");
        if (active && !list.hidden) choose(host, combo, active.getAttribute("data-vf-option") || "");
      }
    });
    host.addEventListener(
      "focusout",
      (ev) => {
        const combo = ev.target.closest?.(".vf-combo");
        if (!combo || !host.contains(combo)) return;
        setTimeout(() => {
          if (combo.contains(document.activeElement)) return;
          closeList(combo);
          showSelected(combo);
        }, 80);
      },
      true
    );
    if (!global.__vfDocClose) {
      global.__vfDocClose = true;
      document.addEventListener("mousedown", (ev) => {
        document.querySelectorAll(".vf-host").forEach((box) => {
          if (!box.contains(ev.target)) closeHost(box);
        });
      });
    }
  }

  function applySelection(host, selection, notifyChange) {
    const sel = normalizeSelection(selection);
    for (const field of FIELDS) {
      const combo = host.querySelector(`[data-vf-key="${field.key}"]`);
      if (!combo) continue;
      const hidden = combo.querySelector("[data-vf-id]");
      if (hidden) hidden.value = sel[field.key];
      const opt = (combo.__vfOptions || []).find((item) => item.id === sel[field.key]);
      if (opt) combo.dataset.vfLabel = opt.label;
      else if (!sel[field.key]) combo.dataset.vfLabel = "";
      const input = combo.querySelector("[data-vf-input]");
      if (input && document.activeElement !== input) showSelected(combo);
    }
    if (notifyChange) notify(host);
  }

  function mount(host, opts) {
    if (!host || typeof document === "undefined") return;
    ensureStyles();
    host.classList.add("vf-host");
    host.__vfOnChange = opts?.onChange || function () {};
    host.__vfPeriod = opts?.period || null;
    host.__vfState = opts?.state || null;
    const wantPeriod = !!opts?.period;
    const wantPrint = !!(opts?.period && opts.period.onPrint);
    const bar = host.querySelector(".vf-bar");
    const hasPeriod = !!host.querySelector("[data-vf-de]");
    const hasPrint = !!host.querySelector("[data-vf-print]");
    if (!bar || hasPeriod !== wantPeriod || hasPrint !== wantPrint) {
      host.innerHTML = barHtml(wantPeriod, wantPrint);
      host.__vfBound = false;
      bind(host);
    }
    if (wantPeriod) applyPeriod(host, opts.period, false);
    const cat = catalog(opts?.state || host.__vfState || {});
    host.__vfCatalog = cat;
    host.querySelectorAll(".vf-combo").forEach((combo) => {
      combo.__vfOptions = cat[combo.getAttribute("data-vf-key")] || [];
    });
    applySelection(host, opts?.selection || read(host), false);
  }

  const api = {
    fields: FIELDS,
    empty,
    normalizeSelection,
    isActive,
    catalog,
    vehicleMatches,
    payableMatches,
    chargeMatches,
    movementMatches,
    vehiclesOfPayable,
    mount,
    read,
  };

  global.vinculoFiltros = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);

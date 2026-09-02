/**
 * Partners Cadastro UI (browser runtime).
 * Monta cadastro inteligente em #partnerCadastroRoot.
 */
(function partnersCadastroUiModule(global) {
  "use strict";

  let _stylesInjected = false;
  let _bound = false;
  let _lastState = null;
  let _lastCtx = null;
  let _filters = Object.assign({}, global.DEFAULT_PARTNER_FILTERS || { tipo: "", cidade: "", estado: "", status: "", search: "" });
  let _category = "financeiras";
  let editingPartnerId = null;
  let _modalReadonly = false;
  let _activeTab = "dados";
  let _contatos = [];
  let _documentos = [];
  let _historico = [];

  const DOC_TIPOS = [
    { value: "CONTRATO", label: "Contrato" },
    { value: "PROCURACAO", label: "Procuração" },
    { value: "CNH", label: "CNH" },
    { value: "CNPJ", label: "CNPJ" },
    { value: "CPF", label: "CPF" },
    { value: "OUTROS", label: "Outros" },
  ];

  function svc() {
    return global.partnersCadastroService || null;
  }

  function escapeHtmlDefault(str) {
    return String(str != null ? str : "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function esc(str, ctx) {
    if (ctx && typeof ctx.escapeHtml === "function") return ctx.escapeHtml(str);
    return escapeHtmlDefault(str);
  }

  function formatMoney(n, ctx) {
    if (ctx && typeof ctx.formatCurrency === "function") return ctx.formatCurrency(n);
    return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function uid() {
    return "pc_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
  }

  function injectStylesOnce() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    if (document.getElementById("partnersCadastroUiStyles")) return;
    const style = document.createElement("style");
    style.id = "partnersCadastroUiStyles";
    style.textContent = `
      .pc-legacy-hidden { display: none !important; }
      .pc-cadastro-root { display: flex; flex-direction: column; gap: 14px; min-height: 80px; }
      .pc-toolbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end; justify-content: space-between; }
      .pc-toolbar .filter-bar { margin: 0; flex: 1 1 100%; }
      .pc-table-panel {
        background: rgba(15, 23, 42, 0.35);
        border: 1px solid rgba(148, 163, 184, 0.12);
        border-radius: 12px;
        overflow: hidden;
      }
      .pc-table-title {
        margin: 0; padding: 14px 16px 10px;
        font-size: 0.95rem; color: #e2e8f0;
        border-bottom: 1px solid rgba(148, 163, 184, 0.1);
      }
      .pc-table-wrap { margin: 0; overflow-x: auto; }
      .pc-table { width: 100%; border-collapse: collapse; font-size: 0.86rem; }
      .pc-table th, .pc-table td { padding: 10px 12px; text-align: left; border-bottom: 1px solid rgba(148,163,184,0.08); }
      .pc-table th { color: #94a3b8; font-weight: 600; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.04em; }
      .pc-table td { color: #e2e8f0; }
      .pc-table-empty { text-align: center; color: #64748b; padding: 28px 16px !important; }
      .pc-table .actions { white-space: nowrap; display: flex; gap: 6px; flex-wrap: wrap; }
      .pc-table .actions button { font-size: 0.78rem; padding: 4px 10px; }
      .partner-tipo-badge {
        display: inline-block; padding: 3px 10px; border-radius: 999px;
        font-size: 0.72rem; font-weight: 600; letter-spacing: 0.02em;
        border: 1px solid transparent;
      }
      .partner-tipo-badge--green { background: rgba(52,211,153,0.15); color: #34d399; border-color: rgba(52,211,153,0.35); }
      .partner-tipo-badge--orange { background: rgba(251,146,60,0.15); color: #fb923c; border-color: rgba(251,146,60,0.35); }
      .partner-tipo-badge--purple { background: rgba(167,139,250,0.15); color: #a78bfa; border-color: rgba(167,139,250,0.35); }
      .partner-tipo-badge--blue { background: rgba(56,189,248,0.15); color: #38bdf8; border-color: rgba(56,189,248,0.35); }
      .pc-status-ativo { color: #34d399; }
      .pc-status-inativo { color: #94a3b8; }
      #partnerModal.pc-modal-large .modal { max-width: min(960px, 96vw); width: 100%; }
      #partnerModal .pc-modal-tabs {
        display: flex; flex-wrap: wrap; gap: 4px;
        margin: 0 0 16px; padding-bottom: 10px;
        border-bottom: 1px solid rgba(148,163,184,0.15);
      }
      #partnerModal .pc-modal-tab {
        padding: 8px 14px; border-radius: 8px; border: 1px solid transparent;
        background: transparent; color: #94a3b8; cursor: pointer; font-size: 0.84rem;
      }
      #partnerModal .pc-modal-tab:hover { color: #e2e8f0; background: rgba(148,163,184,0.08); }
      #partnerModal .pc-modal-tab.active {
        color: #38bdf8; border-color: rgba(56,189,248,0.35);
        background: rgba(56,189,248,0.08);
      }
      #partnerModal .pc-tab-panel { display: none; }
      #partnerModal .pc-tab-panel.active { display: block; }
      #partnerModal .pc-form-grid {
        display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 14px;
      }
      #partnerModal .pc-form-grid .full { grid-column: 1 / -1; }
      #partnerModal .pc-form-grid label { display: block; margin-bottom: 4px; font-size: 0.8rem; color: #94a3b8; }
      #partnerModal .pc-form-grid input,
      #partnerModal .pc-form-grid select,
      #partnerModal .pc-form-grid textarea {
        width: 100%; box-sizing: border-box;
      }
      #partnerModal .pc-tipo-section {
        margin-top: 8px; padding-top: 14px;
        border-top: 1px dashed rgba(148,163,184,0.2);
      }
      #partnerModal .pc-tipo-section h4 {
        margin: 0 0 12px; font-size: 0.85rem; color: #38bdf8; font-weight: 600;
      }
      .pc-contato-row, .pc-doc-row {
        display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 8px; align-items: end; padding: 10px;
        border: 1px solid rgba(148,163,184,0.12); border-radius: 10px;
        margin-bottom: 8px; background: rgba(15,23,42,0.35);
      }
      .pc-contato-row label, .pc-doc-row label { font-size: 0.75rem; color: #94a3b8; display: block; margin-bottom: 3px; }
      .pc-summary-grid {
        display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px;
      }
      .pc-summary-card {
        padding: 14px; border-radius: 10px;
        background: rgba(15,23,42,0.45); border: 1px solid rgba(148,163,184,0.12);
      }
      .pc-summary-card span { display: block; font-size: 0.75rem; color: #94a3b8; margin-bottom: 4px; }
      .pc-summary-card strong { font-size: 1.1rem; color: #e2e8f0; }
      .pc-hist-table { width: 100%; font-size: 0.82rem; border-collapse: collapse; }
      .pc-hist-table th, .pc-hist-table td { padding: 8px 10px; border-bottom: 1px solid rgba(148,163,184,0.1); text-align: left; }
      .pc-hist-table th { color: #94a3b8; font-size: 0.75rem; }
      .pc-form-errors {
        margin: 0 0 12px; padding: 10px 12px; border-radius: 8px;
        background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.35);
        color: #fca5a5; font-size: 0.84rem;
      }
      .pc-form-errors ul { margin: 4px 0 0; padding-left: 18px; }
      @media (max-width: 720px) {
        #partnerModal .pc-form-grid { grid-template-columns: 1fr; }
        .pc-toolbar { flex-direction: column; align-items: stretch; }
      }
    `;
    document.head.appendChild(style);
  }

  function resolveMountRoot() {
    let root = document.getElementById("partnerCadastroRoot");
    if (root) return root;

    const subview =
      document.querySelector('#viewParceiros .partner-subview[data-subview="parceiros"]') ||
      document.querySelector('.partner-subview[data-subview="parceiros"]');
    if (!subview) return null;

    root = document.createElement("div");
    root.id = "partnerCadastroRoot";
    root.className = "pc-cadastro-root hub-table-panel";

    const legacyTable = subview.querySelector(".table-wrap");
    if (legacyTable) {
      legacyTable.classList.add("pc-legacy-hidden");
      subview.insertBefore(root, legacyTable);
    } else {
      subview.appendChild(root);
    }
    return root;
  }

  function hideLegacyTable() {
    const subview =
      document.querySelector('#viewParceiros .partner-subview[data-subview="cadastro"]') ||
      document.querySelector('.partner-subview[data-subview="cadastro"]');
    if (!subview) return;
    const legacyTable = subview.querySelector(".table-wrap.hub-dash-legacy-hidden");
    if (legacyTable) legacyTable.classList.add("pc-legacy-hidden");
  }

  function fieldLabelOverrides() {
    const id = categoryMeta().id;
    if (id === "financeiras") return { nome: "Nome / Razão social", cpf: "CNPJ" };
    if (id === "transportadoras") return { nome: "Nome / Razão social", cpf: "CNPJ" };
    if (id === "prestadores") return { nome: "Nome / Razão social", cpf: "CPF/CNPJ" };
    return { nome: "Nome", cpf: "CPF/CNPJ" };
  }

  function uniqueCidades(partners) {
    const set = new Set();
    (partners || []).forEach(function (p) {
      const c = String(p.cidade || "").trim();
      if (c) set.add(c);
    });
    return Array.from(set).sort(function (a, b) {
      return a.localeCompare(b, "pt-BR");
    });
  }

  function categoryMeta() {
    const tabs = (svc() && svc().PARTNER_CATEGORY_TABS) || global.PARTNER_CATEGORY_TABS || {};
    return tabs[_category] || tabs.financeiras || {};
  }

  function allowedTiposForCategory() {
    const meta = categoryMeta();
    return meta.tipos || [];
  }

  function renderTipoBadge(tipo, ctx) {
    const badgeFn = global.partnerTipoBadge || (svc() && svc().partnerTipoBadge);
    const labelFn = global.partnerTipoLabel || (svc() && svc().partnerTipoLabel);
    const badge = badgeFn ? badgeFn(tipo) : "blue";
    const label = labelFn ? labelFn(tipo) : String(tipo || "—");
    return '<span class="partner-tipo-badge partner-tipo-badge--' + esc(badge, ctx) + '">' + esc(label, ctx) + "</span>";
  }

  function categoryPartnersBase() {
    const listFn = global.ListPartners || (svc() && svc().ListPartners);
    const raw = (_lastState && _lastState.partners) || [];
    const meta = categoryMeta();
    if (!listFn) return raw;
    return listFn(raw, {
      tipos: meta.tipos || [],
      includeUnknown: !!meta.includeUnknown,
      search: "",
      status: "",
      tipo: "",
      cidade: "",
      estado: "",
    });
  }

  function renderFilters(partners, ctx) {
    const base = categoryPartnersBase();
    const cidades = uniqueCidades(base.length ? base : partners);
    const meta = categoryMeta();
    const allowed = allowedTiposForCategory();
    const allTipos = global.PARTNER_TIPOS || (svc() && svc().PARTNER_TIPOS) || [];
    const tipos = meta.lockTipo ? [] : allTipos.filter(function (t) {
      return !allowed.length || allowed.indexOf(t.code) >= 0 || meta.includeUnknown;
    });
    const ufs = global.UF_OPTIONS || (svc() && svc().UF_OPTIONS) || [];

    let tipoBlock = "";
    if (!meta.lockTipo && tipos.length) {
      let tipoOpts = '<option value="">Todos os tipos desta aba</option>';
      for (let i = 0; i < tipos.length; i++) {
        const t = tipos[i];
        tipoOpts +=
          '<option value="' +
          esc(t.code, ctx) +
          '"' +
          (_filters.tipo === t.code ? " selected" : "") +
          ">" +
          esc(t.label, ctx) +
          "</option>";
      }
      tipoBlock =
        "<label for=\"pcFilterTipo\">Tipo</label>" +
        '<select id="pcFilterTipo" title="Filtrar por tipo">' +
        tipoOpts +
        "</select>";
    }

    let cidadeOpts = '<option value="">Todas as cidades</option>';
    for (let j = 0; j < cidades.length; j++) {
      const c = cidades[j];
      cidadeOpts +=
        '<option value="' +
        esc(c, ctx) +
        '"' +
        (_filters.cidade === c ? " selected" : "") +
        ">" +
        esc(c, ctx) +
        "</option>";
    }

    let ufOpts = '<option value="">Todos os estados</option>';
    for (let k = 0; k < ufs.length; k++) {
      const uf = ufs[k];
      ufOpts +=
        '<option value="' +
        esc(uf.value, ctx) +
        '"' +
        (_filters.estado === uf.value ? " selected" : "") +
        ">" +
        esc(uf.label, ctx) +
        "</option>";
    }

    return (
      '<div class="filter-bar hub-dash-filters pc-filters" id="pcFilterBar">' +
      tipoBlock +
      "<label for=\"pcFilterCidade\">Cidade</label>" +
      '<select id="pcFilterCidade" title="Filtrar por cidade">' +
      cidadeOpts +
      "</select>" +
      "<label for=\"pcFilterEstado\">Estado</label>" +
      '<select id="pcFilterEstado" title="Filtrar por estado">' +
      ufOpts +
      "</select>" +
      "<label for=\"pcFilterStatus\">Status</label>" +
      '<select id="pcFilterStatus" title="Filtrar por status">' +
      '<option value="">Todos</option>' +
      '<option value="ATIVO"' +
      (_filters.status === "ATIVO" ? " selected" : "") +
      ">Ativo</option>" +
      '<option value="INATIVO"' +
      (_filters.status === "INATIVO" ? " selected" : "") +
      ">Inativo</option>" +
      "</select>" +
      "<label for=\"pcFilterSearch\">Pesquisar</label>" +
      '<input id="pcFilterSearch" type="search" placeholder="' +
      esc(meta.searchPlaceholder || "Nome, CPF, telefone…", ctx) +
      '" value="' +
      esc(_filters.search, ctx) +
      '" />' +
      "</div>"
    );
  }

  function renderTableRows(list, ctx) {
    const meta = categoryMeta();
    const showTipo = !meta.lockTipo;
    const colSpan = showTipo ? 7 : 6;
    if (!list.length) {
      return '<tr><td colspan="' + colSpan + '" class="pc-table-empty">Nenhum cadastro nesta aba.</td></tr>';
    }
    return list
      .map(function (p) {
        const tel = p.telefone || p.contato || p.whatsapp || "—";
        const st = String(p.status || "ATIVO").toUpperCase();
        const stClass = st === "INATIVO" ? "pc-status-inativo" : "pc-status-ativo";
        const stLabel = st === "INATIVO" ? "Inativo" : "Ativo";
        const toggleLabel = st === "INATIVO" ? "Ativar" : "Inativar";
        const tipoCell = showTipo ? "<td>" + renderTipoBadge(p.tipo, ctx) + "</td>" : "";
        return (
          "<tr data-partner-id=\"" +
          esc(p.id, ctx) +
          "\">" +
          "<td>" +
          esc(p.nome || "—", ctx) +
          "</td>" +
          tipoCell +
          "<td>" +
          esc(p.cpf || "—", ctx) +
          "</td>" +
          "<td>" +
          esc(p.cidade || "—", ctx) +
          "</td>" +
          "<td>" +
          esc(tel, ctx) +
          "</td>" +
          "<td><span class=\"" +
          stClass +
          "\">" +
          esc(stLabel, ctx) +
          "</span></td>" +
          '<td class="actions">' +
          '<button type="button" class="secondary" data-pc-action="detalhes" data-id="' +
          esc(p.id, ctx) +
          '">Visualizar</button>' +
          '<button type="button" class="secondary" data-pc-action="editar" data-id="' +
          esc(p.id, ctx) +
          '">Editar</button>' +
          '<button type="button" class="secondary" data-pc-action="toggle" data-id="' +
          esc(p.id, ctx) +
          '">' +
          toggleLabel +
          "</button>" +
          '<button type="button" class="secondary" data-pc-action="apagar" data-id="' +
          esc(p.id, ctx) +
          '">Apagar</button>' +
          "</td>" +
          "</tr>"
        );
      })
      .join("");
  }

  function renderShell(list, ctx) {
    const meta = categoryMeta();
    const showTipo = !meta.lockTipo;
    const tipoTh = showTipo ? "<th>Tipo</th>" : "";
    return (
      '<div class="pc-toolbar">' +
      renderFilters(_lastState && _lastState.partners ? _lastState.partners : list, ctx) +
      '<button type="button" id="pcBtnNovo" class="primary">' +
      esc(meta.novoLabel || "+ Novo parceiro", ctx) +
      "</button>" +
      "</div>" +
      '<div class="pc-table-panel section-card">' +
      '<h3 class="pc-table-title hub-table-title">' +
      esc(meta.title || "Cadastro de parceiros", ctx) +
      "</h3>" +
      '<div class="table-wrap pc-table-wrap hub-table-wrap">' +
      '<table class="table pc-table hub-exec-table">' +
      "<thead><tr>" +
      "<th>" +
      esc(fieldLabelOverrides().nome, ctx) +
      "</th>" +
      tipoTh +
      "<th>" +
      esc(fieldLabelOverrides().cpf, ctx) +
      "</th><th>Cidade</th><th>Telefone</th><th>Status</th><th>Ações</th>" +
      "</tr></thead>" +
      "<tbody id=\"pcTableBody\">" +
      renderTableRows(list, ctx) +
      "</tbody></table></div></div>"
    );
  }

  function syncFiltersFromDom() {
    const tipo = document.getElementById("pcFilterTipo");
    const cidade = document.getElementById("pcFilterCidade");
    const estado = document.getElementById("pcFilterEstado");
    const status = document.getElementById("pcFilterStatus");
    const search = document.getElementById("pcFilterSearch");
    if (tipo) _filters.tipo = tipo.value || "";
    if (cidade) _filters.cidade = cidade.value || "";
    if (estado) _filters.estado = estado.value || "";
    if (status) _filters.status = status.value || "";
    if (search) _filters.search = String(search.value || "").trim();
  }

  function getFilteredList() {
    const listFn = global.ListPartners || (svc() && svc().ListPartners);
    const normFn = global.normalizePartnerRecord || (svc() && svc().normalizePartnerRecord);
    const raw = (_lastState && _lastState.partners) || [];
    const meta = categoryMeta();
    const filters = Object.assign({}, _filters, {
      tipos: meta.tipos || [],
      includeUnknown: !!meta.includeUnknown,
    });
    const list = listFn ? listFn(raw, filters) : raw;
    if (!listFn && normFn) {
      return raw.map(normFn);
    }
    return list;
  }

  function refreshTable(ctx) {
    const tbody = document.getElementById("pcTableBody");
    if (!tbody) return;
    syncFiltersFromDom();
    tbody.innerHTML = renderTableRows(getFilteredList(), ctx || _lastCtx || {});
  }

  function renderFieldInput(field, value, prefix, readonly) {
    const id = prefix + field.key;
    const ro = readonly ? " readonly disabled" : "";
    const val = value != null ? value : "";
    const spanClass = field.span === "full" ? " full" : "";

    if (field.kind === "textarea") {
      return (
        '<div class="' +
        spanClass +
        '"><label for="' +
        id +
        '">' +
        escapeHtmlDefault(field.label) +
        (field.required ? " *" : "") +
        '</label><textarea id="' +
        id +
        '" data-pc-field="' +
        field.key +
        '" data-pc-group="' +
        field.group +
        '" rows="3"' +
        ro +
        ">" +
        escapeHtmlDefault(val) +
        "</textarea></div>"
      );
    }

    if (field.kind === "select") {
      let opts = "";
      const options = field.options || [];
      for (let i = 0; i < options.length; i++) {
        const o = options[i];
        const sel = String(val) === String(o.value) ? " selected" : "";
        opts +=
          '<option value="' +
          escapeHtmlDefault(o.value) +
          '"' +
          sel +
          ">" +
          escapeHtmlDefault(o.label) +
          "</option>";
      }
      return (
        '<div class="' +
        spanClass +
        '"><label for="' +
        id +
        '">' +
        escapeHtmlDefault(field.label) +
        (field.required ? " *" : "") +
        '</label><select id="' +
        id +
        '" data-pc-field="' +
        field.key +
        '" data-pc-group="' +
        field.group +
        '"' +
        ro +
        ">" +
        opts +
        "</select></div>"
      );
    }

    if (field.kind === "checkbox") {
      const checked = val === true || val === "true" || val === "sim" ? " checked" : "";
      return (
        '<div class="' +
        spanClass +
        '"><label><input type="checkbox" id="' +
        id +
        '" data-pc-field="' +
        field.key +
        '" data-pc-group="' +
        field.group +
        '"' +
        checked +
        ro +
        " /> " +
        escapeHtmlDefault(field.label) +
        "</label></div>"
      );
    }

    const inputType =
      field.kind === "email" ? "email" : field.kind === "tel" ? "tel" : field.kind === "number" ? "number" : "text";
    return (
      '<div class="' +
      spanClass +
      '"><label for="' +
      id +
      '">' +
      escapeHtmlDefault(field.label) +
      (field.required ? " *" : "") +
      '</label><input type="' +
      inputType +
      '" id="' +
      id +
      '" data-pc-field="' +
      field.key +
      '" data-pc-group="' +
      field.group +
      '" value="' +
      escapeHtmlDefault(val) +
      '"' +
      ro +
      " /></div>"
    );
  }

  function renderCommonFields(partner, readonly) {
    const fieldsFn = global.fieldsForTipo || (svc() && svc().fieldsForTipo);
    const tipo = partner.tipo || "LOCALIZADOR";
    const all = fieldsFn ? fieldsFn(tipo) : [];
    const common = all.filter(function (f) {
      return f.group === "common" && f.key !== "tipo";
    });
    let html = "";
    const labels = fieldLabelOverrides();
    for (let i = 0; i < common.length; i++) {
      const f = common[i];
      const labeled = labels[f.key] ? Object.assign({}, f, { label: labels[f.key] }) : f;
      html += renderFieldInput(labeled, partner[f.key], "pcCommon_", readonly);
    }
    return html;
  }

  function renderTipoFields(partner, readonly) {
    const fieldsFn = global.fieldsForTipo || (svc() && svc().fieldsForTipo);
    const tipo = partner.tipo || "LOCALIZADOR";
    const all = fieldsFn ? fieldsFn(tipo) : [];
    const tipoFields = all.filter(function (f) {
      return f.group === "tipo";
    });
    const perfil = partner.perfil || {};
    let html = "";
    for (let i = 0; i < tipoFields.length; i++) {
      const f = tipoFields[i];
      html += renderFieldInput(f, perfil[f.key], "pcTipo_", readonly);
    }
    return html;
  }

  function renderTipoSelect(partner, readonly) {
    const meta = categoryMeta();
    const allTipos = global.PARTNER_TIPOS || (svc() && svc().PARTNER_TIPOS) || [];
    const allowed = allowedTiposForCategory();
    const tipos = allTipos.filter(function (t) {
      if (meta.includeUnknown) return allowed.indexOf(t.code) >= 0;
      return !allowed.length || allowed.indexOf(t.code) >= 0;
    });
    const val = partner.tipo || meta.defaultTipo || "LOCALIZADOR";
    const lock = readonly || meta.lockTipo;
    let opts = "";
    for (let i = 0; i < tipos.length; i++) {
      const t = tipos[i];
      opts +=
        '<option value="' +
        escapeHtmlDefault(t.code) +
        '"' +
        (val === t.code ? " selected" : "") +
        ">" +
        escapeHtmlDefault(t.label) +
        "</option>";
    }
    const ro = lock ? " disabled" : "";
    return (
      '<div><label for="pcCommon_tipo">Tipo de Parceiro *</label>' +
      '<select id="pcCommon_tipo" data-pc-field="tipo" data-pc-group="common"' +
      ro +
      ">" +
      opts +
      "</select></div>"
    );
  }

  function renderContatoRow(c, idx, readonly) {
    const ro = readonly ? " readonly disabled" : "";
    return (
      '<div class="pc-contato-row" data-contato-idx="' +
      idx +
      '">' +
      "<div><label>Nome</label><input data-pc-contato=\"nome\" value=\"" +
      escapeHtmlDefault(c.nome || "") +
      '"' +
      ro +
      " /></div>" +
      "<div><label>Cargo</label><input data-pc-contato=\"cargo\" value=\"" +
      escapeHtmlDefault(c.cargo || "") +
      '"' +
      ro +
      " /></div>" +
      "<div><label>Telefone</label><input data-pc-contato=\"telefone\" value=\"" +
      escapeHtmlDefault(c.telefone || "") +
      '"' +
      ro +
      " /></div>" +
      "<div><label>WhatsApp</label><input data-pc-contato=\"whatsapp\" value=\"" +
      escapeHtmlDefault(c.whatsapp || "") +
      '"' +
      ro +
      " /></div>" +
      "<div><label>E-mail</label><input data-pc-contato=\"email\" type=\"email\" value=\"" +
      escapeHtmlDefault(c.email || "") +
      '"' +
      ro +
      " /></div>" +
      "<div><label><input type=\"checkbox\" data-pc-contato=\"principal\"" +
      (c.principal ? " checked" : "") +
      ro +
      " /> Principal</label></div>" +
      (readonly
        ? ""
        : '<div><button type="button" class="secondary" data-pc-remove-contato="' +
          idx +
          '">Remover</button></div>') +
      "</div>"
    );
  }

  function renderContatosTab(readonly) {
    let rows = "";
    for (let i = 0; i < _contatos.length; i++) {
      rows += renderContatoRow(_contatos[i], i, readonly);
    }
    if (!_contatos.length) {
      rows = '<p class="notice" style="margin:0">Nenhum contato adicional.</p>';
    }
    return (
      '<div id="pcContatosList">' +
      rows +
      "</div>" +
      (readonly ? "" : '<button type="button" class="secondary" id="pcBtnAddContato" style="margin-top:8px">+ Adicionar contato</button>')
    );
  }

  function renderDocRow(d, idx, readonly) {
    let tipoOpts = "";
    for (let i = 0; i < DOC_TIPOS.length; i++) {
      const t = DOC_TIPOS[i];
      tipoOpts +=
        '<option value="' +
        t.value +
        '"' +
        (d.tipo === t.value ? " selected" : "") +
        ">" +
        t.label +
        "</option>";
    }
    const ro = readonly ? " readonly disabled" : "";
    return (
      '<div class="pc-doc-row" data-doc-idx="' +
      idx +
      '">' +
      "<div><label>Nome</label><input data-pc-doc=\"nome\" value=\"" +
      escapeHtmlDefault(d.nome || "") +
      '"' +
      ro +
      " /></div>" +
      "<div><label>Tipo</label><select data-pc-doc=\"tipo\"" +
      ro +
      ">" +
      tipoOpts +
      "</select></div>" +
      "<div><label>Arquivo</label>" +
      (readonly
        ? "<span>" + escapeHtmlDefault(d.path || d.nome || "—") + "</span>"
        : '<input type="file" data-pc-doc="file" />') +
      "</div>" +
      (readonly
        ? ""
        : '<div><button type="button" class="secondary" data-pc-remove-doc="' +
          idx +
          '">Remover</button></div>') +
      "</div>"
    );
  }

  function renderDocumentosTab(readonly) {
    let rows = "";
    for (let i = 0; i < _documentos.length; i++) {
      rows += renderDocRow(_documentos[i], i, readonly);
    }
    if (!_documentos.length) {
      rows = '<p class="notice" style="margin:0">Nenhum documento anexado.</p>';
    }
    return (
      '<div id="pcDocumentosList">' +
      rows +
      "</div>" +
      (readonly ? "" : '<button type="button" class="secondary" id="pcBtnAddDoc" style="margin-top:8px">+ Adicionar documento</button>')
    );
  }

  function renderHistoricoTab() {
    if (!_historico.length) {
      return '<p class="notice" style="margin:0">Sem histórico registrado.</p>';
    }
    let rows = "";
    for (let i = 0; i < _historico.length; i++) {
      const h = _historico[i];
      rows +=
        "<tr><td>" +
        escapeHtmlDefault(h.data || "") +
        " " +
        escapeHtmlDefault(h.hora || "") +
        "</td><td>" +
        escapeHtmlDefault(h.acao || "") +
        "</td><td>" +
        escapeHtmlDefault(h.detalhe || "") +
        "</td><td>" +
        escapeHtmlDefault(h.usuario || "") +
        "</td></tr>";
    }
    return (
      '<table class="pc-hist-table"><thead><tr><th>Data</th><th>Ação</th><th>Detalhe</th><th>Usuário</th></tr></thead><tbody>' +
      rows +
      "</tbody></table>"
    );
  }

  function renderResumoTab(partner, ctx) {
    const summaryFn = global.buildPartnerSummary || (svc() && svc().buildPartnerSummary);
    const summary = summaryFn
      ? summaryFn(partner, {
          vehicles: (_lastState && _lastState.vehicles) || [],
          receivables: (_lastState && _lastState.receivables) || [],
        })
      : { nome: partner.nome, tipoLabel: "—", veiculosAtivos: 0, receitaAno: 0, ultimaMovimentacao: "—", status: partner.status };

    return (
      '<div class="pc-summary-grid">' +
      '<div class="pc-summary-card"><span>Nome</span><strong>' +
      esc(summary.nome, ctx) +
      "</strong></div>" +
      '<div class="pc-summary-card"><span>Tipo</span><strong>' +
      esc(summary.tipoLabel, ctx) +
      "</strong></div>" +
      '<div class="pc-summary-card"><span>Veículos ativos</span><strong>' +
      esc(summary.veiculosAtivos, ctx) +
      "</strong></div>" +
      '<div class="pc-summary-card"><span>Receita no ano</span><strong>' +
      formatMoney(summary.receitaAno, ctx) +
      "</strong></div>" +
      '<div class="pc-summary-card"><span>Última movimentação</span><strong>' +
      esc(summary.ultimaMovimentacao, ctx) +
      "</strong></div>" +
      '<div class="pc-summary-card"><span>Status</span><strong>' +
      esc(summary.status, ctx) +
      "</strong></div>" +
      "</div>"
    );
  }

  function renderModalForm(partner, ctx) {
    const tabs = [
      { id: "dados", label: "Dados" },
      { id: "resumo", label: "Resumo" },
      { id: "contatos", label: "Contatos" },
      { id: "documentos", label: "Documentos" },
      { id: "historico", label: "Histórico" },
    ];
    let tabsHtml = "";
    for (let i = 0; i < tabs.length; i++) {
      const t = tabs[i];
      tabsHtml +=
        '<button type="button" class="pc-modal-tab' +
        (_activeTab === t.id ? " active" : "") +
        '" data-pc-tab="' +
        t.id +
        '">' +
        t.label +
        "</button>";
    }

    const ro = _modalReadonly;
    return (
      '<div class="pc-modal-tabs">' +
      tabsHtml +
      "</div>" +
      '<div id="pcFormErrors" class="pc-form-errors hidden" role="alert"></div>' +
      '<div class="pc-tab-panel' +
      (_activeTab === "dados" ? " active" : "") +
      '" data-pc-panel="dados">' +
      '<div class="pc-form-grid">' +
      renderTipoSelect(partner, ro) +
      renderCommonFields(partner, ro) +
      "</div>" +
      '<div class="pc-tipo-section"><h4>Dados específicos do tipo</h4>' +
      '<div class="pc-form-grid" id="pcTipoFields">' +
      renderTipoFields(partner, ro) +
      "</div></div>" +
      "</div>" +
      '<div class="pc-tab-panel' +
      (_activeTab === "resumo" ? " active" : "") +
      '" data-pc-panel="resumo">' +
      renderResumoTab(partner, ctx) +
      "</div>" +
      '<div class="pc-tab-panel' +
      (_activeTab === "contatos" ? " active" : "") +
      '" data-pc-panel="contatos">' +
      renderContatosTab(ro) +
      "</div>" +
      '<div class="pc-tab-panel' +
      (_activeTab === "documentos" ? " active" : "") +
      '" data-pc-panel="documentos">' +
      renderDocumentosTab(ro) +
      "</div>" +
      '<div class="pc-tab-panel' +
      (_activeTab === "historico" ? " active" : "") +
      '" data-pc-panel="historico">' +
      renderHistoricoTab() +
      "</div>"
    );
  }

  function ensureModalShell() {
    let modal = document.getElementById("partnerModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "partnerModal";
      modal.className = "modal-backdrop hidden pc-modal-large";
      modal.innerHTML =
        '<div class="modal"><div class="modal-header"><h3 id="partnerModalTitle">Novo cadastro</h3>' +
        '<button type="button" class="modal-close" id="closePartnerModal">Fechar</button></div>' +
        '<form id="partnerForm"><div id="partnerFormInner"></div>' +
        '<div class="form-actions"><button type="submit" id="pcBtnSalvar">Salvar</button>' +
        '<button type="button" class="secondary" id="cancelPartnerForm">Cancelar</button></div></form></div>';
      document.body.appendChild(modal);
    }
    modal.classList.add("pc-modal-large");
    return modal;
  }

  function showFormErrors(errors) {
    const box = document.getElementById("pcFormErrors");
    if (!box) return;
    if (!errors || !errors.length) {
      box.classList.add("hidden");
      box.innerHTML = "";
      return;
    }
    box.classList.remove("hidden");
    box.innerHTML = "<strong>Corrija os campos:</strong><ul>" + errors.map(function (e) {
      return "<li>" + escapeHtmlDefault(e) + "</li>";
    }).join("") + "</ul>";
  }

  function collectFormPayload() {
    const payload = {
      perfil: {},
      status: "ATIVO",
    };
    const fields = document.querySelectorAll("#partnerForm [data-pc-field]");
    for (let i = 0; i < fields.length; i++) {
      const el = fields[i];
      const key = el.getAttribute("data-pc-field");
      const group = el.getAttribute("data-pc-group");
      let val;
      if (el.type === "checkbox") {
        val = el.checked;
      } else {
        val = el.value;
      }
      if (group === "tipo") {
        payload.perfil[key] = val;
      } else {
        payload[key] = val;
      }
    }

    syncContatosFromDom();
    syncDocumentosFromDom();
    payload.contatos = _contatos.slice();
    payload.documentos = _documentos.slice();
    payload.historico = _historico.slice();
    if (editingPartnerId) payload.id = editingPartnerId;
    return payload;
  }

  function syncContatosFromDom() {
    const rows = document.querySelectorAll(".pc-contato-row");
    const next = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const idx = row.getAttribute("data-contato-idx");
      const existing = _contatos[Number(idx)] || {};
      const c = { id: existing.id || uid() };
      const inputs = row.querySelectorAll("[data-pc-contato]");
      for (let j = 0; j < inputs.length; j++) {
        const inp = inputs[j];
        const k = inp.getAttribute("data-pc-contato");
        if (inp.type === "checkbox") c[k] = inp.checked;
        else c[k] = inp.value;
      }
      if (c.nome || c.telefone || c.email) next.push(c);
    }
    if (rows.length) _contatos = next;
  }

  function syncDocumentosFromDom() {
    const rows = document.querySelectorAll(".pc-doc-row");
    const next = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const idx = row.getAttribute("data-doc-idx");
      const existing = _documentos[Number(idx)] || {};
      const d = {
        id: existing.id || uid(),
        data: existing.data || new Date().toLocaleDateString("pt-BR"),
        usuario: existing.usuario,
        path: existing.path,
        url: existing.url,
      };
      const inputs = row.querySelectorAll("[data-pc-doc]");
      for (let j = 0; j < inputs.length; j++) {
        const inp = inputs[j];
        const k = inp.getAttribute("data-pc-doc");
        if (k === "file") continue;
        d[k] = inp.value;
      }
      next.push(d);
    }
    if (rows.length) _documentos = next;
  }

  function rerenderTipoFieldsOnly() {
    const tipoEl = document.getElementById("pcCommon_tipo");
    const container = document.getElementById("pcTipoFields");
    if (!tipoEl || !container) return;
    const partner = collectFormPayload();
    partner.tipo = tipoEl.value;
    container.innerHTML = renderTipoFields(partner, _modalReadonly);
  }

  function setActiveTab(tabId) {
    _activeTab = tabId;
    document.querySelectorAll("#partnerForm .pc-modal-tab").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-pc-tab") === tabId);
    });
    document.querySelectorAll("#partnerForm .pc-tab-panel").forEach(function (panel) {
      panel.classList.toggle("active", panel.getAttribute("data-pc-panel") === tabId);
    });
  }

  function openModal(partner, mode, ctx) {
    const modal = ensureModalShell();
    const title = document.getElementById("partnerModalTitle");
    const inner = document.getElementById("partnerFormInner") || document.getElementById("partnerForm");
    const formInner = document.getElementById("partnerFormInner");
    const target = formInner || inner;

    _modalReadonly = mode === "detalhes";
    _activeTab = mode === "detalhes" ? "resumo" : "dados";

    const normFn = global.normalizePartnerRecord || (svc() && svc().normalizePartnerRecord);
    const p = normFn ? normFn(partner || {}) : partner || {};

    _contatos = (p.contatos || []).slice();
    _documentos = (p.documentos || []).slice();
    _historico = (p.historico || []).slice();

    if (title) {
      title.textContent =
        mode === "create" ? "Novo parceiro" : mode === "detalhes" ? "Detalhes do parceiro" : "Editar parceiro";
    }

    if (target) {
      target.innerHTML = renderModalForm(p, ctx || _lastCtx || {});
    }

    const salvar = document.getElementById("pcBtnSalvar");
    if (salvar) salvar.style.display = _modalReadonly ? "none" : "";

    showFormErrors(null);
    modal.classList.remove("hidden");
    bindModalEvents(ctx || _lastCtx || {});
  }

  function closeModal() {
    const modal = document.getElementById("partnerModal");
    if (modal) modal.classList.add("hidden");
    editingPartnerId = null;
    _modalReadonly = false;
    showFormErrors(null);
  }

  function effectiveUserId(ctx) {
    if (ctx && typeof ctx.effectiveUserId === "function") return ctx.effectiveUserId();
    if (typeof global.effectiveUserId === "function") return global.effectiveUserId();
    return null;
  }

  async function reloadPartners(ctx) {
    if (ctx && typeof ctx.loadPartners === "function") {
      await ctx.loadPartners();
      return;
    }
    if (typeof global.loadPartners === "function") {
      await global.loadPartners();
    }
  }

  async function uploadDocumentFile(file, partnerId, userId) {
    if (!file || !global.supabase || !userId) return null;
    try {
      const path = userId + "/" + (partnerId || "draft") + "/" + Date.now() + "_" + file.name;
      const bucket = global.supabase.storage.from("partner-attachments");
      const up = await bucket.upload(path, file);
      if (up.error) return { path: file.name, url: null };
      const pub = bucket.getPublicUrl(path);
      return { path: path, url: (pub.data && pub.data.publicUrl) || path };
    } catch (_e) {
      return { path: file.name, url: null };
    }
  }

  async function processDocumentUploads(partnerId, userId) {
    const rows = document.querySelectorAll(".pc-doc-row");
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const fileInput = row.querySelector('[data-pc-doc="file"]');
      if (!fileInput || !fileInput.files || !fileInput.files[0]) continue;
      const file = fileInput.files[0];
      const idx = Number(row.getAttribute("data-doc-idx"));
      const uploaded = await uploadDocumentFile(file, partnerId, userId);
      if (_documentos[idx]) {
        _documentos[idx].nome = _documentos[idx].nome || file.name;
        if (uploaded) {
          _documentos[idx].path = uploaded.path;
          _documentos[idx].url = uploaded.url;
        }
      }
    }
  }

  async function partnersCadastroSubmit() {
    const ctx = _lastCtx || {};
    const userId = effectiveUserId(ctx);
    const supabaseClient = (ctx && ctx.supabase) || global.supabase;
    if (!supabaseClient || !userId) {
      alert("Sessão indisponível. Faça login novamente.");
      return { ok: false };
    }

    syncContatosFromDom();
    syncDocumentosFromDom();
    const payload = collectFormPayload();

    if (ctx && typeof ctx.requireSupabaseSessionForWrite === "function") {
      const okSession = await ctx.requireSupabaseSessionForWrite();
      if (!okSession) return { ok: false };
    }

    if (ctx && typeof ctx.findDuplicatePartner === "function") {
      const dup = ctx.findDuplicatePartner({
        nome: payload.nome,
        cpf: payload.cpf,
        tipo: payload.tipo,
        excludePartnerId: editingPartnerId || null,
      });
      if (dup) {
        showFormErrors([
          "Já existe um cadastro com o mesmo nome ou CPF/CNPJ. Corrija o documento ou use outro nome.",
        ]);
        return { ok: false, errors: ["duplicado"] };
      }
    }

    const opts = {
      userEmail: (ctx && ctx.userEmail) || (typeof global.currentUserEmail === "function" ? global.currentUserEmail() : undefined),
    };

    let result;
    if (editingPartnerId) {
      const updateFn = global.UpdatePartner || (svc() && svc().UpdatePartner);
      result = updateFn
        ? await updateFn(supabaseClient, userId, editingPartnerId, payload, opts)
        : { ok: false, errors: ["UpdatePartner indisponível."] };
    } else {
      const createFn = global.CreatePartner || (svc() && svc().CreatePartner);
      result = createFn
        ? await createFn(supabaseClient, userId, payload, opts)
        : { ok: false, errors: ["CreatePartner indisponível."] };
    }

    if (!result.ok) {
      if (result.errors && result.errors.length) showFormErrors(result.errors);
      else if (result.error) alert(result.error.message || String(result.error));
      return result;
    }

    const savedId = (result.data && result.data.id) || editingPartnerId;
    await processDocumentUploads(savedId, userId);

    if (savedId && _documentos.some(function (d) {
      return d.path && !d.url;
    })) {
      const updateFn = global.UpdatePartner || (svc() && svc().UpdatePartner);
      if (updateFn) {
        await updateFn(
          supabaseClient,
          userId,
          savedId,
          Object.assign({}, payload, result.data, { documentos: _documentos }),
          Object.assign({}, opts, { historico: { acao: "Documentos", detalhe: "Anexos atualizados" } })
        );
      }
    }

    closeModal();
    await reloadPartners(ctx);
    if (_lastState) {
      _lastState.partners = (global.state && global.state.partners) || _lastState.partners;
      partnersCadastroRender(_lastState, ctx);
    }
    if (result.lean) {
      console.warn("[partners-cadastro] Gravação em modo compatível (colunas limitadas).");
    }
    return result;
  }

  async function deletePartner(id, ctx) {
    if (!confirm("Deseja apagar este parceiro?")) return;
    ctx = ctx || _lastCtx || {};
    if (ctx && typeof ctx.deletePartner === "function") {
      await ctx.deletePartner(id);
    } else {
      const supabaseClient = (ctx && ctx.supabase) || global.supabase;
      const userId = effectiveUserId(ctx);
      if (supabaseClient && userId) {
        const { error } = await supabaseClient.from("partners").delete().eq("id", id).eq("user_id", userId);
        if (error) {
          alert(error.message || String(error));
          return;
        }
      } else {
        document.dispatchEvent(
          new CustomEvent("partners-cadastro:delete", { detail: { id: id } })
        );
      }
    }
    await reloadPartners(ctx);
    if (_lastState) {
      _lastState.partners = (global.state && global.state.partners) || _lastState.partners;
      partnersCadastroRender(_lastState, ctx);
    }
  }

  async function togglePartnerStatus(partner, ctx) {
    ctx = ctx || _lastCtx || {};
    const next = String(partner.status || "ATIVO").toUpperCase() === "INATIVO" ? "ATIVO" : "INATIVO";
    const supabaseClient = (ctx && ctx.supabase) || global.supabase;
    const userId = effectiveUserId(ctx);
    if (!supabaseClient || !userId) return;
    const run = ctx.runSupabaseWrite
      ? ctx.runSupabaseWrite
      : function (fn) {
          return fn();
        };
    const { error } = await run(function () {
      return supabaseClient
        .from("partners")
        .update({ status: next })
        .eq("id", partner.id)
        .eq("user_id", userId);
    });
    if (error) {
      alert(error.message || "Não foi possível alterar o status.");
      return;
    }
    await reloadPartners(ctx);
    if (_lastState) {
      _lastState.partners = (global.state && global.state.partners) || _lastState.partners;
      partnersCadastroRender(_lastState, ctx);
    }
  }

  function bindModalEvents(ctx) {
    const form = document.getElementById("partnerForm");
    const tipoEl = document.getElementById("pcCommon_tipo");
    if (tipoEl && !tipoEl.dataset.pcBound) {
      tipoEl.dataset.pcBound = "1";
      tipoEl.addEventListener("change", function () {
        rerenderTipoFieldsOnly();
      });
    }

    document.querySelectorAll("#partnerForm .pc-modal-tab").forEach(function (btn) {
      if (btn.dataset.pcTabBound) return;
      btn.dataset.pcTabBound = "1";
      btn.addEventListener("click", function () {
        setActiveTab(btn.getAttribute("data-pc-tab"));
      });
    });

    const addContato = document.getElementById("pcBtnAddContato");
    if (addContato && !addContato.dataset.pcBound) {
      addContato.dataset.pcBound = "1";
      addContato.addEventListener("click", function () {
        _contatos.push({ id: uid(), nome: "", principal: false });
        const list = document.getElementById("pcContatosList");
        if (list) list.insertAdjacentHTML("beforeend", renderContatoRow(_contatos[_contatos.length - 1], _contatos.length - 1, false));
      });
    }

    const addDoc = document.getElementById("pcBtnAddDoc");
    if (addDoc && !addDoc.dataset.pcBound) {
      addDoc.dataset.pcBound = "1";
      addDoc.addEventListener("click", function () {
        _documentos.push({
          id: uid(),
          nome: "",
          tipo: "OUTROS",
          data: new Date().toLocaleDateString("pt-BR"),
        });
        const list = document.getElementById("pcDocumentosList");
        if (list) list.insertAdjacentHTML("beforeend", renderDocRow(_documentos[_documentos.length - 1], _documentos.length - 1, false));
      });
    }

    document.querySelectorAll("[data-pc-remove-contato]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const idx = Number(btn.getAttribute("data-pc-remove-contato"));
        _contatos.splice(idx, 1);
        const panel = document.querySelector('[data-pc-panel="contatos"]');
        if (panel) panel.innerHTML = renderContatosTab(false);
        bindModalEvents(ctx);
      });
    });

    document.querySelectorAll("[data-pc-remove-doc]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const idx = Number(btn.getAttribute("data-pc-remove-doc"));
        _documentos.splice(idx, 1);
        const panel = document.querySelector('[data-pc-panel="documentos"]');
        if (panel) panel.innerHTML = renderDocumentosTab(false);
        bindModalEvents(ctx);
      });
    });

    if (form && !form.dataset.pcSubmitBound) {
      form.dataset.pcSubmitBound = "1";
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        if (_modalReadonly) return;
        partnersCadastroSubmit();
      });
    }

    const closeBtn = document.getElementById("closePartnerModal");
    const cancelBtn = document.getElementById("cancelPartnerForm");
    if (closeBtn && !closeBtn.dataset.pcBound) {
      closeBtn.dataset.pcBound = "1";
      closeBtn.addEventListener("click", closeModal);
    }
    if (cancelBtn && !cancelBtn.dataset.pcBound) {
      cancelBtn.dataset.pcBound = "1";
      cancelBtn.addEventListener("click", closeModal);
    }
  }

  function bindRootEvents(root, ctx) {
    const novo = document.getElementById("pcBtnNovo");
    if (novo && !novo.dataset.pcBound) {
      novo.dataset.pcBound = "1";
      novo.addEventListener("click", function () {
        partnersCadastroOpenCreate();
      });
    }

    root.querySelectorAll("[data-pc-action]").forEach(function (btn) {
      if (btn.dataset.pcActionBound) return;
      btn.dataset.pcActionBound = "1";
      btn.addEventListener("click", function () {
        const action = btn.getAttribute("data-pc-action");
        const id = btn.getAttribute("data-id");
        const getFn = global.GetPartner || (svc() && svc().GetPartner);
        const partner = getFn ? getFn(_lastState, id) : null;
        if (!partner) return;
        if (action === "detalhes") {
          editingPartnerId = partner.id || null;
          openModal(partner, "detalhes", ctx);
        } else if (action === "editar") {
          partnersCadastroOpenEdit(partner);
        } else if (action === "toggle") {
          togglePartnerStatus(partner, ctx);
        } else if (action === "apagar") {
          deletePartner(id, ctx);
        }
      });
    });

    const filterBar = document.getElementById("pcFilterBar");
    if (filterBar && !filterBar.dataset.pcBound) {
      filterBar.dataset.pcBound = "1";
      filterBar.addEventListener("change", function () {
        refreshTable(ctx);
      });
      filterBar.addEventListener("input", function (e) {
        if (e.target && e.target.id === "pcFilterSearch") refreshTable(ctx);
      });
    }
  }

  function bindGlobalOnce() {
    if (_bound) return;
    _bound = true;
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        const modal = document.getElementById("partnerModal");
        if (modal && !modal.classList.contains("hidden")) closeModal();
      }
    });
  }

  function partnersCadastroRender(stateLike, ctx) {
    injectStylesOnce();
    bindGlobalOnce();
    hideLegacyTable();
    _lastState = stateLike || { partners: [] };
    _lastCtx = ctx || {};
    const root = resolveMountRoot();
    if (!root) return;

    syncFiltersFromDom();
    const list = getFilteredList();
    root.innerHTML = renderShell(list, ctx || {});
    bindRootEvents(root, ctx || {});
  }

  function partnersCadastroOpenCreate() {
    editingPartnerId = null;
    const meta = categoryMeta();
    openModal({ tipo: meta.defaultTipo || "LOCALIZADOR", status: "ATIVO", perfil: {} }, "create", _lastCtx || {});
  }

  function partnersCadastroSetCategory(id) {
    _category = id || "financeiras";
    _filters.tipo = "";
    _filters.search = "";
  }

  function partnersCadastroOpenEdit(partner, opts) {
    const normFn = global.normalizePartnerRecord || (svc() && svc().normalizePartnerRecord);
    const p = normFn ? normFn(partner) : partner;
    editingPartnerId = p.id || null;
    const mode = opts && opts.tab === "resumo" ? "detalhes" : "edit";
    openModal(p, mode, _lastCtx || {});
    if (opts && opts.tab) {
      setTimeout(function () {
        setActiveTab(opts.tab);
      }, 0);
    }
  }

  function partnersCadastroUiInit() {
    injectStylesOnce();
    bindGlobalOnce();
    ensureModalShell();
  }

  global.partnersCadastroRender = partnersCadastroRender;
  global.partnersCadastroOpenCreate = partnersCadastroOpenCreate;
  global.partnersCadastroSetCategory = partnersCadastroSetCategory;
  global.partnersCadastroOpenEdit = partnersCadastroOpenEdit;
  global.partnersCadastroSubmit = partnersCadastroSubmit;
  global.partnersCadastroUiInit = partnersCadastroUiInit;
  global.partnersCadastroEditingId = function () {
    return editingPartnerId;
  };
})(typeof window !== "undefined" ? window : globalThis);

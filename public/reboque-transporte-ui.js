/**
 * Reboque e Transporte — interface dentro de Parceiros.
 * Não cria menu principal e não altera o fluxo de pátio.
 */
(function reboqueTransporteUiModule(global) {
  "use strict";

  let ctx = {};
  let data = { partners: [], vehicles: [], payables: [] };
  let cache = emptyCache();
  let ui = { tab: "empresas", q: "", status: "", categoria: "", de: "", ate: "", partnerId: "", pagePartnerId: "" };
  let bound = false;
  let lastVehicleOpts = {};

  function emptyCache() {
    return {
      drivers: [],
      trucks: [],
      services: [],
      finance: [],
      payments: [],
      banking: [],
      documents: [],
      missing: false,
      loaded: false,
      loading: null,
    };
  }

  function svc() {
    return global.reboqueTransporteService || null;
  }

  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function seeFinance() {
    return !(ctx && ctx.hidesFinancialValues);
  }

  function readOnly() {
    return !!(ctx && ctx.readOnly);
  }

  function client() {
    return (ctx && ctx.supabase) || global.supabaseClient || null;
  }

  function userId() {
    if (ctx && typeof ctx.effectiveUserId === "function") return ctx.effectiveUserId();
    if (typeof global.effectiveUserId === "function") return global.effectiveUserId();
    return null;
  }

  function money(n) {
    if (!seeFinance()) return "—";
    if (ctx && typeof ctx.formatCurrency === "function") return ctx.formatCurrency(n);
    return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function fmtWhen(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return esc(String(iso).slice(0, 16));
    return d.toLocaleString("pt-BR");
  }

  function normalizePartner(p) {
    const api = global.partnersCadastroService;
    if (api && typeof api.normalizePartnerRecord === "function") return api.normalizePartnerRecord(p);
    return p || {};
  }

  function partners() {
    return (data.partners || []).map(normalizePartner);
  }

  function findPartner(id) {
    return partners().find(function (p) {
      return String(p.id) === String(id || "");
    }) || null;
  }

  function findId(list, id) {
    return (list || []).find(function (x) {
      return String(x.id) === String(id || "");
    }) || null;
  }

  function financeOf(serviceId) {
    return findId(cache.finance, serviceId) || cache.finance.find(function (f) {
      return String(f.service_id) === String(serviceId || "");
    }) || null;
  }

  function paymentsOf(serviceId) {
    return (cache.payments || []).filter(function (p) {
      return String(p.service_id) === String(serviceId || "");
    });
  }

  function payableOf(finance) {
    if (!finance || !finance.payable_id) return null;
    return (data.payables || []).find(function (p) {
      return String(p.id) === String(finance.payable_id);
    }) || null;
  }

  function kindOf(p) {
    const api = svc();
    return api ? api.partnerKind(p && p.tipo) : "";
  }

  function isMissing(err) {
    const msg = String((err && (err.message || err.details || err.code)) || "");
    return /PGRST205|does not exist|schema cache|could not find the table|relation/i.test(msg);
  }

  function injectStyles() {
    if (document.getElementById("reboqueTransporteStyles")) return;
    const style = document.createElement("style");
    style.id = "reboqueTransporteStyles";
    style.textContent =
      "#reboqueTransporteRoot{display:flex;flex-direction:column;gap:12px}" +
      "#rtModal .form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}" +
      "#rtModal .full{grid-column:1 / -1}" +
      "#rtModal .rt-errors{margin:0 0 12px;padding:10px 12px;border-radius:8px;background:#fee2e2;color:#b91c1c}" +
      "#reboqueTransporteRoot .rt-actions{display:flex;flex-wrap:wrap;gap:6px}" +
      "#reboqueTransporteRoot tr[data-rt-open]{cursor:pointer}" +
      "@media (max-width:800px){#rtModal .form-grid{grid-template-columns:1fr}" +
      "#reboqueTransporteRoot table.rt-cards thead{display:none}" +
      "#reboqueTransporteRoot table.rt-cards tr{display:block;margin:0 0 12px;border:1px solid rgba(148,163,184,.28);border-radius:12px;padding:8px}" +
      "#reboqueTransporteRoot table.rt-cards td{display:flex;justify-content:space-between;gap:8px;border:0}" +
      "#reboqueTransporteRoot table.rt-cards td::before{content:attr(data-label);font-weight:700;margin-right:8px}}";
    document.head.appendChild(style);
  }

  function ensureModal() {
    if (document.getElementById("rtModal")) return;
    const el = document.createElement("div");
    el.id = "rtModal";
    el.className = "modal-backdrop hidden";
    el.innerHTML =
      '<div class="modal" style="max-width:min(960px,96vw)">' +
      '<div class="modal-header"><h3 id="rtModalTitle">Reboque</h3>' +
      '<button type="button" class="modal-close" data-rt-action="close-modal">Fechar</button></div>' +
      '<div id="rtModalBody"></div></div>';
    document.body.appendChild(el);
  }

  function bindOnce() {
    if (bound) return;
    bound = true;
    injectStyles();
    ensureModal();
    document.addEventListener("click", onClick);
    document.addEventListener("submit", onSubmit);
    document.addEventListener("change", onChange);
    document.addEventListener("input", onInput);
  }

  async function ensureLoaded(force) {
    const wantFinance = seeFinance();
    if (force || (cache.loaded && cache.sawFinance !== wantFinance)) {
      cache.loaded = false;
      cache.loading = null;
    }
    if (cache.loaded) return cache;
    if (cache.loading) return cache.loading;
    const db = client();
    const uid = userId();
    if (!db || !uid) return cache;
    cache.loading = loadAll(db, uid).finally(function () {
      cache.loading = null;
    });
    return cache.loading;
  }

  async function loadAll(db, uid) {
    const ops = await Promise.all([
      db.from("tow_drivers").select("*").eq("user_id", uid).order("nome"),
      db.from("tow_trucks").select("*").eq("user_id", uid).order("placa"),
      db.from("tow_services").select("*").eq("user_id", uid).order("data_remocao", { ascending: false }),
    ]);
    if (ops.some(function (r) { return isMissing(r.error); })) {
      cache.missing = true;
      cache.loaded = true;
      return;
    }
    cache.missing = false;
    cache.drivers = (ops[0] && ops[0].data) || [];
    cache.trucks = (ops[1] && ops[1].data) || [];
    cache.services = (ops[2] && ops[2].data) || [];
    if (!seeFinance()) {
      cache.finance = [];
      cache.payments = [];
      cache.banking = [];
      cache.documents = [];
      cache.sawFinance = false;
      cache.loaded = true;
      return;
    }
    const fin = await Promise.all([
      db.from("tow_service_finance").select("*").eq("user_id", uid),
      db.from("tow_service_payments").select("*").eq("user_id", uid).order("data_pagamento", { ascending: false }),
      db.from("tow_partner_banking").select("*").eq("user_id", uid),
      db.from("tow_partner_documents").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
    ]);
    if (fin.some(function (r) { return isMissing(r.error); })) {
      cache.missing = true;
      cache.loaded = true;
      return;
    }
    cache.finance = (fin[0] && fin[0].data) || [];
    cache.payments = (fin[1] && fin[1].data) || [];
    cache.banking = (fin[2] && fin[2].data) || [];
    cache.documents = (fin[3] && fin[3].data) || [];
    cache.sawFinance = true;
    cache.loaded = true;
  }

  function pullState() {
    if (typeof ctx.getState === "function") {
      const s = ctx.getState() || {};
      if (s.partners) data.partners = s.partners;
      if (s.vehicles) data.vehicles = s.vehicles;
      if (s.payables) data.payables = s.payables;
    }
  }

  async function reload() {
    if (typeof ctx.loadPartners === "function") await ctx.loadPartners();
    if (seeFinance() && typeof ctx.loadPayables === "function") await ctx.loadPayables();
    pullState();
    await ensureLoaded(true);
    paint();
  }

  function render(snapshot, nextCtx) {
    if (nextCtx) ctx = nextCtx;
    if (snapshot) {
      data.partners = snapshot.partners || [];
      data.vehicles = snapshot.vehicles || [];
      data.payables = snapshot.payables || [];
    }
    bindOnce();
    ensureLoaded(false).then(function () {
      paint();
    });
  }

  function reboquePageOptions(partner, mount) {
    const id = partner && partner.id;
    const kind = kindOf(partner);
    const bank = (cache.banking || []).find(function (b) {
      return String(b.partner_id) === String(id);
    });
    return {
      mount: mount,
      kind: kind,
      readOnly: readOnly(),
      seeFinance: seeFinance(),
      banking: seeFinance() ? bank || null : null,
      trucks: (cache.trucks || []).filter(function (t) {
        return String(t.owner_partner_id) === String(id);
      }),
      drivers: kind === "EMPRESA"
        ? (cache.drivers || []).filter(function (d) {
            return String(d.company_partner_id) === String(id);
          })
        : [],
      towServices: (cache.services || []).map(function (s) {
        const fin = financeOf(s.id);
        const copy = Object.assign({}, s);
        if (seeFinance() && fin && fin.valor_contratado != null) copy.valor = fin.valor_contratado;
        return copy;
      }),
      state: { partners: data.partners || [], vehicles: data.vehicles || [], receivables: [] },
      onBack: function () {
        ui.pagePartnerId = "";
        paint();
      },
      onEdit: function () {
        if (kind === "EMPRESA") openCompany(id);
        else openAutonomous(id);
      },
    };
  }

  function paint() {
    const root = document.getElementById("reboqueTransporteRoot");
    if (!root) return;
    if (ui.pagePartnerId) {
      const partner = findPartner(ui.pagePartnerId);
      if (partner && typeof global.openPartnerDetailPage === "function") {
        root.innerHTML = "";
        global.openPartnerDetailPage(partner, reboquePageOptions(partner, root));
        return;
      }
      ui.pagePartnerId = "";
    }
    if (!root.querySelector("#rtBody") || root.dataset.tab !== ui.tab) {
      root.dataset.tab = ui.tab;
      root.innerHTML = shell();
    }
    const notice = document.getElementById("rtNotice");
    if (notice) notice.innerHTML = noticeHtml();
    const body = document.getElementById("rtBody");
    if (body) body.innerHTML = bodyHtml();
  }

  function noticeHtml() {
    if (!cache.missing) {
      return '<p class="notice" style="margin:0">Empresas e autônomos ficam no cadastro de parceiros. Motoristas não recebem usuário nem senha. Registrar a remoção não gera pagamento sozinho.</p>';
    }
    return '<p class="notice" style="margin:0">Para gravar reboque e transporte, execute no Supabase o arquivo supabase/reboque_transporte.sql e atualize a página.</p>';
  }

  function shell() {
    const tabs = [
      ["empresas", "Empresas de reboque"],
      ["motoristas", "Motoristas"],
      ["autonomos", "Reboqueiros autônomos"],
      ["historico", "Remoções e valores"],
    ];
    const nav = tabs
      .map(function (t) {
        return '<button type="button" data-rt-tab="' + t[0] + '"' + (ui.tab === t[0] ? ' class="active"' : "") + ">" + t[1] + "</button>";
      })
      .join("");
    const novo = readOnly() ? "" : '<button type="button" data-rt-action="novo">' + novoLabel() + "</button>";
    const print = ui.tab === "historico" ? '<button type="button" class="secondary" data-rt-action="imprimir">Imprimir</button>' : "";
    const extra = ui.tab === "historico"
      ? '<label>Categoria<select id="rtCategoria"><option value="">Todas</option><option value="EMPRESA"' + (ui.categoria === "EMPRESA" ? " selected" : "") + '>Empresa</option><option value="AUTONOMO"' + (ui.categoria === "AUTONOMO" ? " selected" : "") + ">Autônomo</option></select></label>" +
        '<label>De<input id="rtDe" type="date" value="' + esc(ui.de) + '"></label>' +
        '<label>Até<input id="rtAte" type="date" value="' + esc(ui.ate) + '"></label>'
      : "";
    return (
      '<div id="rtSubnav" class="subnav">' + nav + "</div>" +
      '<div class="filter-bar">' +
      '<label>Pesquisar<input id="rtSearch" type="search" value="' + esc(ui.q) + '" placeholder="Nome, razão social, CPF, CNPJ ou placa"></label>' +
      '<label>Situação<select id="rtStatus"><option value="">Todas</option><option value="ATIVO"' + (ui.status === "ATIVO" ? " selected" : "") + '>Ativo</option><option value="INATIVO"' + (ui.status === "INATIVO" ? " selected" : "") + ">Inativo</option></select></label>" +
      extra + novo + print +
      (ui.partnerId ? '<button type="button" class="secondary" data-rt-action="limpar-parceiro">Limpar filtro do parceiro</button>' : "") +
      "</div><div id=\"rtNotice\"></div><div id=\"rtBody\"></div>"
    );
  }

  function novoLabel() {
    if (ui.tab === "motoristas") return "+ Novo motorista";
    if (ui.tab === "autonomos") return "+ Novo autônomo";
    if (ui.tab === "historico") return "+ Registrar remoção";
    return "+ Nova empresa";
  }

  function bodyHtml() {
    if (ui.tab === "motoristas") return tableMotoristas();
    if (ui.tab === "autonomos") return tableAutonomos();
    if (ui.tab === "historico") return tableHistorico();
    return tableEmpresas();
  }

  function statusTag(status) {
    const s = (svc() && svc().statusOf(status)) || "ATIVO";
    return s === "INATIVO" ? '<span class="tag">Inativo</span>' : '<span class="tag">Ativo</span>';
  }

  function actionButtons(kind, id, status) {
    const ver = '<button type="button" class="secondary" data-rt-action="ver" data-rt-kind="' + kind + '" data-id="' + esc(id) + '">Ver</button>';
    if (readOnly()) return '<div class="rt-actions">' + ver + "</div>";
    const edit = '<button type="button" class="secondary" data-rt-action="editar" data-rt-kind="' + kind + '" data-id="' + esc(id) + '">Editar</button>';
    const off = (svc() && svc().statusOf(status) === "INATIVO")
      ? '<button type="button" class="secondary" data-rt-action="reativar" data-rt-kind="' + kind + '" data-id="' + esc(id) + '">Reativar</button>'
      : '<button type="button" class="secondary" data-rt-action="inativar" data-rt-kind="' + kind + '" data-id="' + esc(id) + '">Inativar</button>';
    const hist = kind === "motorista" ? "" : '<button type="button" class="secondary" data-rt-action="historico" data-id="' + esc(id) + '">Remoções</button>';
    return '<div class="rt-actions">' + ver + edit + off + hist + "</div>";
  }

  function tableEmpresas() {
    const rows = partners().filter(function (p) {
      if (kindOf(p) !== "EMPRESA") return false;
      if (ui.status && (svc() ? svc().statusOf(p.status) : "ATIVO") !== ui.status) return false;
      const plates = cache.trucks.filter(function (t) { return String(t.owner_partner_id) === String(p.id); }).map(function (t) { return t.placa; }).join(" ");
      const blob = [p.nome, p.nome_fantasia, p.cpf, p.cidade, p.telefone, plates].join(" ");
      return !svc() || svc().matchesSearch(blob, ui.q);
    });
    return tableWrap(
      ["Razão social", "Nome fantasia", "CNPJ", "Cidade", "Telefone", "Situação", "Ações"],
      rows.map(function (p) {
        return row([
          ["Razão social", esc(p.nome || "—")],
          ["Nome fantasia", esc(p.nome_fantasia || "—")],
          ["CNPJ", esc(p.cpf || "—")],
          ["Cidade", esc([p.cidade, p.estado].filter(Boolean).join(" / ") || "—")],
          ["Telefone", esc(p.telefone || p.whatsapp || "—")],
          ["Situação", statusTag(p.status)],
          ["Ações", actionButtons("empresa", p.id, p.status)],
        ], 'data-rt-open="empresa" data-id="' + esc(p.id) + '"');
      }),
      "Nenhuma empresa de reboque encontrada."
    );
  }

  function tableMotoristas() {
    const rows = cache.drivers.filter(function (d) {
      if (ui.status && (svc() ? svc().statusOf(d.status) : "ATIVO") !== ui.status) return false;
      const company = findPartner(d.company_partner_id);
      const truck = findId(cache.trucks, d.habitual_truck_id);
      const blob = [d.nome, d.cpf, company && company.nome, truck && truck.placa].join(" ");
      return !svc() || svc().matchesSearch(blob, ui.q);
    });
    return tableWrap(
      ["Nome", "CPF", "Empresa", "CNH", "Caminhão habitual", "Situação", "Ações"],
      rows.map(function (d) {
        const company = findPartner(d.company_partner_id);
        const truck = findId(cache.trucks, d.habitual_truck_id);
        return row([
          ["Nome", esc(d.nome || "—")],
          ["CPF", esc(d.cpf || "—")],
          ["Empresa", esc((company && company.nome) || "—")],
          ["CNH", esc([d.cnh, d.cnh_categoria].filter(Boolean).join(" · ") || "—")],
          ["Caminhão habitual", esc((truck && truck.placa) || "—")],
          ["Situação", statusTag(d.status)],
          ["Ações", actionButtons("motorista", d.id, d.status)],
        ]);
      }),
      "Nenhum motorista encontrado."
    );
  }

  function tableAutonomos() {
    const rows = partners().filter(function (p) {
      if (kindOf(p) !== "AUTONOMO") return false;
      if (ui.status && (svc() ? svc().statusOf(p.status) : "ATIVO") !== ui.status) return false;
      const plates = cache.trucks.filter(function (t) { return String(t.owner_partner_id) === String(p.id); }).map(function (t) { return t.placa; }).join(" ");
      const perfil = p.perfil || {};
      const blob = [p.nome, p.cpf, perfil.cpf, perfil.cnpj, perfil.nome_empresarial, plates].join(" ");
      return !svc() || svc().matchesSearch(blob, ui.q);
    });
    return tableWrap(
      ["Nome", "Documento", "Tipo", "Telefone", "Situação", "Ações"],
      rows.map(function (p) {
        const pessoa = String((p.perfil && p.perfil.tipo_pessoa) || "PF").toUpperCase() === "PJ" ? "Pessoa jurídica" : "Pessoa física";
        return row([
          ["Nome", esc(p.nome || "—")],
          ["Documento", esc(p.cpf || "—")],
          ["Tipo", esc(pessoa)],
          ["Telefone", esc(p.telefone || p.whatsapp || "—")],
          ["Situação", statusTag(p.status)],
          ["Ações", actionButtons("autonomo", p.id, p.status)],
        ], 'data-rt-open="autonomo" data-id="' + esc(p.id) + '"');
      }),
      "Nenhum reboqueiro autônomo encontrado."
    );
  }

  function visibleServices() {
    return cache.services.filter(function (s) {
      if (ui.partnerId && String(s.partner_id) !== String(ui.partnerId)) return false;
      if (ui.categoria && s.tipo_prestador !== ui.categoria) return false;
      if ((ui.de || ui.ate) && svc() && !svc().inPeriod(s.data_remocao, ui.de, ui.ate)) return false;
      if (ui.status) {
        const partner = findPartner(s.partner_id);
        if ((svc() ? svc().statusOf(partner && partner.status) : "ATIVO") !== ui.status) return false;
      }
      const blob = [s.partner_nome, s.driver_nome, s.placa_veiculo, s.truck_placa, s.origem, s.destino].join(" ");
      return !svc() || svc().matchesSearch(blob, ui.q);
    });
  }

  function tableHistorico() {
    const rows = visibleServices();
    const report = svc() ? svc().reportAggregates(aggregateInput(rows)) : null;
    const summary = report && seeFinance()
      ? '<p class="notice" style="margin:0 0 12px">Serviços: <strong>' + report.quantidade + "</strong> · Contratado: <strong>" + money(report.contratado) + "</strong> · Pago: <strong>" + money(report.pago) + "</strong> · Pendente: <strong>" + money(report.pendente) + "</strong></p>"
      : report
        ? '<p class="notice" style="margin:0 0 12px">Serviços no filtro: <strong>' + report.quantidade + "</strong></p>"
        : "";
    const heads = ["Data", "Placa", "Prestador", "Motorista", "Caminhão", "Situação", "Ações"];
    if (seeFinance()) heads.splice(5, 0, "Valor", "Pago", "Saldo");
    return summary + tableWrap(
      heads,
      rows.map(function (s) {
        const fin = financeOf(s.id);
        const pays = paymentsOf(s.id);
        const sit = svc() ? svc().situacaoFinanceira(s, fin, pays, payableOf(fin)) : "";
        const cells = [
          ["Data", fmtWhen(s.data_remocao)],
          ["Placa", esc(s.placa_veiculo || "—")],
          ["Prestador", esc(s.partner_nome || "—")],
          ["Motorista", esc(s.driver_nome || "—")],
          ["Caminhão", esc(s.truck_placa || "—")],
        ];
        if (seeFinance()) {
          cells.push(["Valor", money(fin && fin.valor_contratado)]);
          cells.push(["Pago", money(svc() ? svc().sumPayments(pays) : 0)]);
          cells.push(["Saldo", money(svc() ? svc().saldoOf(fin, pays) : 0)]);
        }
        cells.push(["Situação", esc(svc() ? svc().situacaoLabel(sit) : sit)]);
        cells.push(["Ações", serviceActions(s, fin, pays, sit)]);
        return row(cells);
      }),
      "Nenhuma remoção encontrada."
    );
  }

  function serviceActions(s, fin, pays, sit) {
    let html = '<div class="rt-actions"><button type="button" class="secondary" data-rt-action="ver" data-rt-kind="servico" data-id="' + esc(s.id) + '">Ver</button>';
    if (!readOnly() && seeFinance()) {
      const gate = svc() ? svc().canGeneratePayable(s, fin, data.payables) : { ok: false };
      if (gate.ok) html += '<button type="button" data-rt-action="obrigacao" data-id="' + esc(s.id) + '">Gerar obrigação</button>';
      if ((sit === "A_PAGAR" || sit === "PARCIAL") && fin && fin.payable_id) {
        html += '<button type="button" class="secondary" data-rt-action="pagar" data-id="' + esc(s.id) + '">Registrar pagamento</button>';
      }
      if (!s.cancelado && !(pays && pays.length)) {
        html += '<button type="button" class="secondary" data-rt-action="cancelar-servico" data-id="' + esc(s.id) + '">Cancelar</button>';
      }
    }
    return html + "</div>";
  }

  function aggregateInput(list) {
    const financeById = {};
    const paymentsById = {};
    (list || []).forEach(function (s) {
      const fin = financeOf(s.id);
      if (fin) financeById[s.id] = fin;
      paymentsById[s.id] = paymentsOf(s.id);
    });
    return { services: list || [], financeById: financeById, paymentsById: paymentsById };
  }

  function tableWrap(heads, rows, empty) {
    const th = heads.map(function (h) { return "<th>" + esc(h) + "</th>"; }).join("");
    const body = rows.length ? rows.join("") : '<tr><td class="pc-table-empty" colspan="' + heads.length + '">' + esc(empty) + "</td></tr>";
    return '<div class="table-wrap"><table class="table rt-cards"><thead><tr>' + th + "</tr></thead><tbody>" + body + "</tbody></table></div>";
  }

  function row(cells, attrs) {
    return "<tr" + (attrs ? " " + attrs : "") + ">" + cells.map(function (c) {
      return '<td data-label="' + esc(c[0]) + '">' + c[1] + "</td>";
    }).join("") + "</tr>";
  }

  function onInput(e) {
    const t = e.target;
    if (!t || !t.id) return;
    if (t.id === "rtSearch") {
      ui.q = t.value || "";
      const body = document.getElementById("rtBody");
      if (body) body.innerHTML = bodyHtml();
    }
  }

  function onChange(e) {
    const t = e.target;
    if (!t) return;
    if (t.id === "vehicleLocator") {
      global.reboqueSyncVehicleTowFields?.(lastVehicleOpts);
      return;
    }
    if (t.id === "rtStatus") {
      ui.status = t.value || "";
      paint();
      return;
    }
    if (t.id === "rtCategoria") {
      ui.categoria = t.value || "";
      paint();
      return;
    }
    if (t.id === "rtDe" || t.id === "rtAte") {
      ui.de = document.getElementById("rtDe")?.value || "";
      ui.ate = document.getElementById("rtAte")?.value || "";
      paint();
      return;
    }
    if (t.id === "rtTipoPrestador" || t.id === "rtPartnerId") refillServiceDependents();
    if (t.id === "rtCompanyId") refillHabitualTrucks();
  }

  async function onClick(e) {
    const tab = e.target.closest("[data-rt-tab]");
    if (tab && document.getElementById("reboqueTransporteRoot")?.contains(tab)) {
      ui.tab = tab.getAttribute("data-rt-tab") || "empresas";
      ui.partnerId = "";
      ui.pagePartnerId = "";
      paint();
      return;
    }
    const openRow = e.target.closest("[data-rt-open]");
    if (
      openRow &&
      document.getElementById("reboqueTransporteRoot")?.contains(openRow) &&
      !e.target.closest("button, a, input, select, textarea")
    ) {
      ui.pagePartnerId = openRow.getAttribute("data-id") || "";
      paint();
      return;
    }
    const btn = e.target.closest("[data-rt-action]");
    if (!btn) {
      if (e.target && e.target.id === "rtModal") closeModal();
      return;
    }
    const action = btn.getAttribute("data-rt-action");
    const id = btn.getAttribute("data-id");
    const kind = btn.getAttribute("data-rt-kind");
    if (action === "close-modal") closeModal();
    else if (action === "limpar-parceiro") {
      ui.partnerId = "";
      paint();
    } else if (action === "novo") openCreate();
    else if (action === "imprimir") printReport();
    else if (action === "ver") {
      if (kind === "empresa" || kind === "autonomo") {
        ui.pagePartnerId = id || "";
        paint();
      } else openDetail(kind, id);
    }
    else if (action === "editar") openEdit(kind, id);
    else if (action === "historico") {
      ui.tab = "historico";
      ui.partnerId = id || "";
      paint();
    } else if (action === "inativar" || action === "reativar") {
      await setStatus(kind, id, action === "reativar" ? "ATIVO" : "INATIVO");
    } else if (action === "obrigacao") await gerarObrigacao(id);
    else if (action === "pagar") openPagamento(id);
    else if (action === "cancelar-servico") await cancelarServico(id);
    else if (action === "novo-caminhao") openTruck(btn.getAttribute("data-owner") || "");
  }

  async function onSubmit(e) {
    const form = e.target;
    if (!form || form.id !== "rtForm") return;
    e.preventDefault();
    const mode = form.getAttribute("data-rt-mode");
    const id = form.getAttribute("data-rt-id") || "";
    if (mode === "empresa") await saveCompany(new FormData(form), id);
    else if (mode === "motorista") await saveDriver(new FormData(form), id);
    else if (mode === "autonomo") await saveAutonomous(new FormData(form), id);
    else if (mode === "caminhao") await saveTruck(new FormData(form), id);
    else if (mode === "servico") await saveService(new FormData(form), id);
    else if (mode === "pagamento") await savePayment(new FormData(form), form.getAttribute("data-service-id"));
  }

  function openCreate() {
    if (!guardWrite()) return;
    if (ui.tab === "motoristas") return openDriver("");
    if (ui.tab === "autonomos") return openAutonomous("");
    if (ui.tab === "historico") return openService("");
    return openCompany("");
  }

  function openEdit(kind, id) {
    if (!guardWrite()) return;
    if (kind === "empresa") return openCompany(id);
    if (kind === "motorista") return openDriver(id);
    if (kind === "autonomo") return openAutonomous(id);
    if (kind === "caminhao") return openTruck("", id);
    if (kind === "servico") return openService(id);
  }

  function guardWrite() {
    if (readOnly()) {
      alert("Seu perfil pode consultar, mas não alterar estes cadastros.");
      return false;
    }
    if (cache.missing) {
      alert("Execute supabase/reboque_transporte.sql no Supabase e atualize a página.");
      return false;
    }
    return true;
  }

  function showModal(title, html) {
    ensureModal();
    const modal = document.getElementById("rtModal");
    const h = document.getElementById("rtModalTitle");
    const body = document.getElementById("rtModalBody");
    if (h) h.textContent = title;
    if (body) body.innerHTML = html;
    modal?.classList.remove("hidden");
  }

  function closeModal() {
    document.getElementById("rtModal")?.classList.add("hidden");
  }

  function showFormErrors(errors) {
    const box = document.getElementById("rtErrors");
    if (!box) {
      alert((errors || []).join("\n"));
      return;
    }
    box.classList.remove("hidden");
    box.innerHTML = "<ul>" + (errors || []).map(function (er) { return "<li>" + esc(er) + "</li>"; }).join("") + "</ul>";
  }

  function field(name, label, value, type, extra) {
    return '<div' + (extra || "") + '><label>' + esc(label) + '</label><input name="' + name + '" type="' + (type || "text") + '" value="' + esc(value || "") + '"></div>';
  }

  function area(name, label, value) {
    return '<div class="full"><label>' + esc(label) + '</label><textarea name="' + name + '">' + esc(value || "") + "</textarea></div>";
  }

  function select(name, label, optionsHtml, extra) {
    const idAttr = name.indexOf("rt") === 0 ? ' id="' + name + '"' : "";
    return '<div' + (extra || "") + '><label>' + esc(label) + '</label><select name="' + name + '"' + idAttr + ">" + optionsHtml + "</select></div>";
  }

  function statusOptions(current) {
    const s = (svc() && svc().statusOf(current)) || "ATIVO";
    return '<option value="ATIVO"' + (s === "ATIVO" ? " selected" : "") + '>Ativo</option><option value="INATIVO"' + (s === "INATIVO" ? " selected" : "") + ">Inativo</option>";
  }

  function ufOptions(current) {
    const ufs = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
    return '<option value="">—</option>' + ufs.map(function (uf) {
      return '<option value="' + uf + '"' + (String(current || "").toUpperCase() === uf ? " selected" : "") + ">" + uf + "</option>";
    }).join("");
  }

  function formShell(mode, id, inner) {
    return '<form id="rtForm" data-rt-mode="' + mode + '" data-rt-id="' + esc(id || "") + '"><div id="rtErrors" class="rt-errors hidden"></div><div class="form-grid">' + inner + '</div><div class="form-actions"><button type="submit">Salvar</button><button type="button" class="secondary" data-rt-action="close-modal">Cancelar</button></div></form>';
  }

  function bankFields(partnerId) {
    if (!seeFinance()) return "";
    const bank = (cache.banking || []).find(function (b) { return String(b.partner_id) === String(partnerId || ""); }) || {};
    return (
      field("inscricao_estadual", "Inscrição estadual", bank.inscricao_estadual) +
      field("banco", "Banco", bank.banco) +
      field("agencia", "Agência", bank.agencia) +
      field("conta", "Conta", bank.conta) +
      field("tipo_conta", "Tipo de conta", bank.tipo_conta) +
      field("chave_pix", "Chave PIX", bank.chave_pix) +
      '<div class="full"><label>Documento (opcional)</label><input name="documento" type="file"><input name="documento_nome" type="text" placeholder="Nome do documento"></div>'
    );
  }

  function openCompany(id) {
    const p = id ? findPartner(id) : {};
    const perfil = (p && p.perfil) || {};
    showModal(id ? "Editar empresa de reboque" : "Nova empresa de reboque", formShell("empresa", id,
      '<div class="full"><p class="notice" style="margin:0">Tipo de parceiro: Empresa de reboque.</p></div>' +
      field("nome", "Razão social", p && p.nome) +
      field("nome_fantasia", "Nome fantasia", p && p.nome_fantasia) +
      field("cpf", "CNPJ", p && p.cpf) +
      field("responsavel", "Nome do responsável", perfil.responsavel) +
      field("telefone", "Telefone", p && p.telefone) +
      field("whatsapp", "WhatsApp", p && p.whatsapp) +
      field("email", "E-mail", p && p.email, "email") +
      field("cep", "CEP", p && p.cep) +
      field("endereco", "Endereço", p && p.endereco) +
      field("numero", "Número", p && p.numero) +
      field("complemento", "Complemento", p && p.complemento) +
      field("bairro", "Bairro", p && p.bairro) +
      field("cidade", "Cidade", p && p.cidade) +
      select("estado", "Estado", ufOptions(p && p.estado)) +
      select("status", "Situação", statusOptions(p && p.status)) +
      bankFields(id) +
      area("observacoes", "Observações", p && p.observacoes)
    ));
  }

  function openDriver(id) {
    const d = id ? findId(cache.drivers, id) : {};
    const companies = partners().filter(function (p) { return kindOf(p) === "EMPRESA" && (svc() ? svc().statusOf(p.status) === "ATIVO" || String(p.id) === String(d && d.company_partner_id) : true); });
    showModal(id ? "Editar motorista" : "Novo motorista", formShell("motorista", id,
      '<div class="full"><p class="notice" style="margin:0">Cadastro operacional. Este motorista não recebe acesso ao sistema e não gera conta a pagar própria.</p></div>' +
      field("nome", "Nome completo", d && d.nome) +
      field("cpf", "CPF", d && d.cpf) +
      field("telefone", "Telefone", d && d.telefone) +
      field("whatsapp", "WhatsApp", d && d.whatsapp) +
      field("cnh", "CNH", d && d.cnh) +
      field("cnh_categoria", "Categoria da CNH", d && d.cnh_categoria) +
      field("cnh_validade", "Validade da CNH", d && d.cnh_validade, "date") +
      select("rtCompanyId", "Empresa vinculada", options(companies, d && d.company_partner_id, "Selecione", function (p) { return p.nome; })) +
      select("habitual_truck_id", "Caminhão habitual", truckOptions(d && d.company_partner_id, d && d.habitual_truck_id)) +
      select("status", "Situação", statusOptions(d && d.status)) +
      area("observacoes", "Observações", d && d.observacoes)
    ));
  }

  function openAutonomous(id) {
    const p = id ? findPartner(id) : {};
    const perfil = (p && p.perfil) || {};
    const pessoa = String(perfil.tipo_pessoa || "PF").toUpperCase() === "PJ" ? "PJ" : "PF";
    showModal(id ? "Editar reboqueiro autônomo" : "Novo reboqueiro autônomo", formShell("autonomo", id,
      select("tipo_pessoa", "Tipo de prestador", '<option value="PF"' + (pessoa === "PF" ? " selected" : "") + '>Pessoa física</option><option value="PJ"' + (pessoa === "PJ" ? " selected" : "") + ">Pessoa jurídica</option>") +
      field("nome", "Nome completo", p && p.nome) +
      field("nome_empresarial", "Nome empresarial", perfil.nome_empresarial) +
      field("cpf_pessoa", "CPF", pessoa === "PJ" ? perfil.cpf : (p && p.cpf)) +
      field("cnpj", "CNPJ (se pessoa jurídica)", pessoa === "PJ" ? (p && p.cpf) : "") +
      field("telefone", "Telefone", p && p.telefone) +
      field("whatsapp", "WhatsApp", p && p.whatsapp) +
      field("email", "E-mail", p && p.email, "email") +
      field("cep", "CEP", p && p.cep) +
      field("endereco", "Endereço", p && p.endereco) +
      field("numero", "Número", p && p.numero) +
      field("complemento", "Complemento", p && p.complemento) +
      field("bairro", "Bairro", p && p.bairro) +
      field("cidade", "Cidade", p && p.cidade) +
      select("estado", "Estado", ufOptions(p && p.estado)) +
      select("status", "Situação", statusOptions(p && p.status)) +
      bankFields(id) +
      area("observacoes", "Observações", p && p.observacoes)
    ));
  }

  function openTruck(ownerId, id) {
    const t = id ? findId(cache.trucks, id) : {};
    const owners = partners().filter(function (p) { return !!kindOf(p); });
    showModal(id ? "Editar caminhão" : "Novo caminhão", formShell("caminhao", id,
      select("owner_partner_id", "Prestador", options(owners, (t && t.owner_partner_id) || ownerId, "Selecione", function (p) { return p.nome; })) +
      field("placa", "Placa", t && t.placa) +
      field("marca", "Marca", t && t.marca) +
      field("modelo", "Modelo", t && t.modelo) +
      field("ano", "Ano", t && t.ano) +
      field("tipo_equipamento", "Tipo de caminhão ou equipamento", t && t.tipo_equipamento) +
      select("status", "Situação", statusOptions(t && t.status)) +
      area("capacidade_obs", "Capacidade ou observações", t && t.capacidade_obs)
    ));
  }

  function openService(id) {
    const s = id ? findId(cache.services, id) : null;
    const fin = s ? financeOf(s.id) : null;
    if (s && fin && fin.payable_id) {
      alert("Este serviço já tem obrigação financeira. O prestador, o motorista e o caminhão registrados permanecem no histórico.");
      return openDetail("servico", id);
    }
    const vehicles = data.vehicles || [];
    showModal(id ? "Editar remoção" : "Registrar remoção", formShell("servico", id,
      select("vehicle_id", "Veículo transportado", options(vehicles, s && s.vehicle_id, "Selecione pela placa", function (v) { return (v.placa || "Sem placa") + (v.modelo ? " · " + v.modelo : ""); })) +
      field("data_remocao", "Data e hora", toLocalInput(s && s.data_remocao), "datetime-local") +
      field("origem", "Origem", s && s.origem) +
      field("destino", "Destino", s && s.destino) +
      select("rtTipoPrestador", "Tipo de prestador", '<option value="EMPRESA"' + (!s || s.tipo_prestador === "EMPRESA" ? " selected" : "") + '>Empresa de reboque</option><option value="AUTONOMO"' + (s && s.tipo_prestador === "AUTONOMO" ? " selected" : "") + ">Reboqueiro autônomo</option>") +
      select("rtPartnerId", "Responsável", partnerOptions(s ? s.tipo_prestador : "EMPRESA", s && s.partner_id)) +
      '<div id="rtDriverWrap">' + select("driver_id", "Motorista", driverOptions(s && s.partner_id, s && s.driver_id)) + "</div>" +
      select("truck_id", "Caminhão", truckOptions(s && s.partner_id, s && s.truck_id, true)) +
      (seeFinance()
        ? field("valor_contratado", "Valor combinado", fin && fin.valor_contratado != null ? fin.valor_contratado : "", "number") +
          '<div><label>Aprovar valor para pagamento</label><select name="aprovado"><option value="nao"' + (!fin || !fin.aprovado ? " selected" : "") + '>Não</option><option value="sim"' + (fin && fin.aprovado ? " selected" : "") + ">Sim</option></select></div>"
        : "") +
      area("observacoes", "Observações", s && s.observacoes)
    ));
    refillServiceDependents();
  }

  function openPagamento(serviceId) {
    if (!guardWrite() || !seeFinance()) return;
    const s = findId(cache.services, serviceId);
    if (!s) return;
    showModal("Registrar pagamento", formShell("pagamento", "",
      '<div class="full"><p class="notice" style="margin:0">Favorecido: <strong>' + esc(s.partner_nome || "—") + "</strong>. O motorista não recebe lançamento próprio. Isto não cria uma segunda conta a pagar.</p></div>" +
      field("valor", "Valor", "", "number") +
      field("data_pagamento", "Data", new Date().toISOString().slice(0, 10), "date") +
      select("forma_pagamento", "Forma de pagamento", '<option value="PIX">PIX</option><option value="TRANSFERENCIA">Transferência</option><option value="DINHEIRO">Dinheiro</option><option value="BOLETO">Boleto</option><option value="OUTROS">Outros</option>') +
      '<div class="full"><label>Comprovante (opcional)</label><input name="comprovante" type="file"></div>' +
      area("observacoes", "Observações", "")
    ).replace('data-rt-id=""', 'data-rt-id="" data-service-id="' + esc(serviceId) + '"'));
  }

  function options(list, current, empty, labelFn) {
    let html = '<option value="">' + esc(empty) + "</option>";
    (list || []).forEach(function (item) {
      const id = String(item.id);
      html += '<option value="' + esc(id) + '"' + (id === String(current || "") ? " selected" : "") + ">" + esc(labelFn(item)) + "</option>";
    });
    return html;
  }

  function partnerOptions(kind, current) {
    const list = partners().filter(function (p) {
      if (kindOf(p) !== kind) return false;
      return (svc() ? svc().statusOf(p.status) === "ATIVO" : true) || String(p.id) === String(current || "");
    });
    return options(list, current, "Selecione", function (p) { return p.nome; });
  }

  function driverOptions(companyId, current) {
    const list = cache.drivers.filter(function (d) {
      if (String(d.company_partner_id) !== String(companyId || "")) return false;
      return (svc() ? svc().statusOf(d.status) === "ATIVO" : true) || String(d.id) === String(current || "");
    });
    return options(list, current, "Selecione", function (d) { return d.nome; });
  }

  function truckOptions(ownerId, current, includeInactiveSelected) {
    const list = cache.trucks.filter(function (t) {
      if (ownerId && String(t.owner_partner_id) !== String(ownerId)) return false;
      return (svc() ? svc().statusOf(t.status) === "ATIVO" : true) || (includeInactiveSelected && String(t.id) === String(current || ""));
    });
    return options(list, current, "Selecione", function (t) { return t.placa + (t.modelo ? " · " + t.modelo : ""); });
  }

  function refillHabitualTrucks() {
    const companyId = document.getElementById("rtCompanyId")?.value || "";
    const sel = document.querySelector('#rtForm select[name="habitual_truck_id"]');
    if (sel) sel.innerHTML = truckOptions(companyId, sel.value, true);
  }

  function refillServiceDependents() {
    const kind = document.getElementById("rtTipoPrestador")?.value || "EMPRESA";
    const partnerSel = document.getElementById("rtPartnerId");
    const currentPartner = partnerSel ? partnerSel.value : "";
    if (partnerSel) {
      const still = partners().some(function (p) { return String(p.id) === currentPartner && kindOf(p) === kind; });
      partnerSel.innerHTML = partnerOptions(kind, still ? currentPartner : "");
    }
    const partnerId = document.getElementById("rtPartnerId")?.value || "";
    const driverWrap = document.getElementById("rtDriverWrap");
    if (driverWrap) driverWrap.classList.toggle("hidden", kind !== "EMPRESA");
    const driverSel = document.querySelector('#rtForm select[name="driver_id"]');
    if (driverSel) driverSel.innerHTML = driverOptions(partnerId, driverSel.value);
    const truckSel = document.querySelector('#rtForm select[name="truck_id"]');
    if (truckSel) truckSel.innerHTML = truckOptions(partnerId, truckSel.value, true);
  }

  function toLocalInput(iso) {
    if (!iso) {
      const n = new Date();
      n.setMinutes(n.getMinutes() - n.getTimezoneOffset());
      return n.toISOString().slice(0, 16);
    }
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  }

  async function requireSession() {
    if (ctx && typeof ctx.requireSupabaseSessionForWrite === "function") {
      return ctx.requireSupabaseSessionForWrite();
    }
    return true;
  }

  async function write(fn) {
    const db = client();
    if (!db) return { error: { message: "Sessão indisponível." } };
    if (ctx && typeof ctx.runSupabaseWrite === "function") return ctx.runSupabaseWrite(fn);
    return fn();
  }

  function alertResult(result) {
    if (!result) return;
    if (result.errors && result.errors.length) {
      showFormErrors(result.errors);
      return;
    }
    const msg = (result.error && (result.error.message || result.error)) || "Não foi possível salvar.";
    if (/duplicate key|unique|23505/i.test(String(msg))) {
      showFormErrors(["Já existe cadastro com o mesmo documento, nome ou placa."]);
      return;
    }
    if (ctx && typeof ctx.alertSupabaseError === "function" && result.error) ctx.alertSupabaseError(result.error);
    else showFormErrors([String(msg)]);
  }

  async function saveCompany(fd, id) {
    if (!(await requireSession()) || !guardWrite()) return;
    const input = { id: id || null, nome: fd.get("nome"), cpf: fd.get("cpf") };
    const check = svc().validateCompany(input, { partners: partners(), drivers: cache.drivers });
    if (!check.ok) return showFormErrors(check.errors);
    const current = id ? findPartner(id) : null;
    const record = partnerRecord(fd, svc().TIPO_EMPRESA, fd.get("cpf"), { responsavel: String(fd.get("responsavel") || "").trim() }, current);
    const saved = await persistPartner(record, id, id ? "Empresa de reboque atualizada" : "Empresa de reboque cadastrada");
    if (!saved) return;
    await saveBankAndDoc(saved.id, fd);
    closeModal();
    await reload();
  }

  async function saveAutonomous(fd, id) {
    if (!(await requireSession()) || !guardWrite()) return;
    const input = {
      id: id || null,
      nome: fd.get("nome"),
      tipo_pessoa: fd.get("tipo_pessoa"),
      cpf_pessoa: fd.get("cpf_pessoa"),
      cnpj: fd.get("cnpj"),
    };
    const check = svc().validateAutonomous(input, { partners: partners(), drivers: cache.drivers });
    if (!check.ok) return showFormErrors(check.errors);
    const pessoa = check.pessoa;
    const doc = pessoa === "PJ" ? fd.get("cnpj") : fd.get("cpf_pessoa");
    const current = id ? findPartner(id) : null;
    const record = partnerRecord(fd, svc().TIPO_AUTONOMO, doc, {
      tipo_pessoa: pessoa,
      cpf: String(fd.get("cpf_pessoa") || "").trim(),
      nome_empresarial: String(fd.get("nome_empresarial") || "").trim(),
    }, current);
    const saved = await persistPartner(record, id, id ? "Autônomo atualizado" : "Autônomo cadastrado");
    if (!saved) return;
    await saveBankAndDoc(saved.id, fd);
    closeModal();
    await reload();
  }

  function partnerRecord(fd, tipo, documento, perfil, current) {
    return {
      nome: String(fd.get("nome") || "").trim(),
      nome_fantasia: String(fd.get("nome_fantasia") || (perfil && perfil.nome_empresarial) || "").trim(),
      tipo: tipo,
      cpf: String(documento || "").trim(),
      telefone: String(fd.get("telefone") || "").trim(),
      whatsapp: String(fd.get("whatsapp") || "").trim(),
      email: String(fd.get("email") || "").trim(),
      cep: String(fd.get("cep") || "").trim(),
      endereco: String(fd.get("endereco") || "").trim(),
      numero: String(fd.get("numero") || "").trim(),
      complemento: String(fd.get("complemento") || "").trim(),
      bairro: String(fd.get("bairro") || "").trim(),
      cidade: String(fd.get("cidade") || "").trim(),
      estado: String(fd.get("estado") || "").trim(),
      status: fd.get("status") || "ATIVO",
      observacoes: String(fd.get("observacoes") || "").trim(),
      perfil: perfil || {},
      contatos: (current && current.contatos) || [],
      documentos: (current && current.documentos) || [],
      historico: (current && current.historico) || [],
    };
  }

  async function persistPartner(record, id, detalhe) {
    const api = global.partnersCadastroService;
    const db = client();
    const uid = userId();
    if (!api || !db || !uid) {
      alert("Sessão indisponível.");
      return null;
    }
    const result = id
      ? await api.UpdatePartner(db, uid, id, record, { userEmail: ctx.userEmail || "", historico: { acao: "Reboque", detalhe: detalhe } })
      : await api.CreatePartner(db, uid, record, { userEmail: ctx.userEmail || "", historico: { acao: "Reboque", detalhe: detalhe } });
    if (!result || !result.ok) {
      alertResult(result);
      return null;
    }
    return result.data;
  }

  async function saveBankAndDoc(partnerId, fd) {
    if (!seeFinance() || !partnerId) return;
    const db = client();
    const uid = userId();
    const payload = {
      partner_id: partnerId,
      user_id: uid,
      inscricao_estadual: String(fd.get("inscricao_estadual") || "").trim() || null,
      banco: String(fd.get("banco") || "").trim() || null,
      agencia: String(fd.get("agencia") || "").trim() || null,
      conta: String(fd.get("conta") || "").trim() || null,
      tipo_conta: String(fd.get("tipo_conta") || "").trim() || null,
      chave_pix: String(fd.get("chave_pix") || "").trim() || null,
      updated_at: new Date().toISOString(),
    };
    const hasBank = Object.keys(payload).some(function (k) {
      return k !== "partner_id" && k !== "user_id" && k !== "updated_at" && payload[k];
    });
    if (hasBank) {
      const res = await write(function () { return db.from("tow_partner_banking").upsert(payload); });
      if (res && res.error) alertResult(res);
    }
    const file = fd.get("documento");
    if (file && file.name) {
      let path = file.name;
      let url = null;
      try {
        const storagePath = uid + "/reboque/" + partnerId + "/" + Date.now() + "_" + file.name;
        const up = await db.storage.from("partner-attachments").upload(storagePath, file);
        if (!up.error) {
          path = storagePath;
          url = db.storage.from("partner-attachments").getPublicUrl(storagePath).data?.publicUrl || null;
        }
      } catch (_e) { /* mantém o nome do arquivo */ }
      await write(function () {
        return db.from("tow_partner_documents").insert({
          user_id: uid,
          partner_id: partnerId,
          nome: String(fd.get("documento_nome") || file.name),
          tipo: "OUTROS",
          path: path,
          url: url,
        });
      });
    }
  }

  async function saveDriver(fd, id) {
    if (!(await requireSession()) || !guardWrite()) return;
    const input = {
      id: id || null,
      nome: fd.get("nome"),
      cpf: fd.get("cpf"),
      company_partner_id: fd.get("rtCompanyId"),
      habitual_truck_id: fd.get("habitual_truck_id") || null,
    };
    const check = svc().validateDriver(input, { partners: partners(), drivers: cache.drivers, trucks: cache.trucks });
    if (!check.ok) return showFormErrors(check.errors);
    const payload = {
      user_id: userId(),
      company_partner_id: input.company_partner_id,
      nome: String(input.nome).trim(),
      cpf: String(input.cpf || "").trim(),
      cpf_digits: svc().digits(input.cpf),
      telefone: String(fd.get("telefone") || "").trim() || null,
      whatsapp: String(fd.get("whatsapp") || "").trim() || null,
      cnh: String(fd.get("cnh") || "").trim() || null,
      cnh_categoria: String(fd.get("cnh_categoria") || "").trim() || null,
      cnh_validade: fd.get("cnh_validade") || null,
      habitual_truck_id: input.habitual_truck_id,
      observacoes: String(fd.get("observacoes") || "").trim() || null,
      status: fd.get("status") || "ATIVO",
      updated_at: new Date().toISOString(),
    };
    const db = client();
    const res = await write(function () {
      return id
        ? db.from("tow_drivers").update(payload).eq("id", id).eq("user_id", userId())
        : db.from("tow_drivers").insert(payload);
    });
    if (res && res.error) return alertResult(res);
    closeModal();
    await reload();
  }

  async function saveTruck(fd, id) {
    if (!(await requireSession()) || !guardWrite()) return;
    const input = {
      id: id || null,
      placa: fd.get("placa"),
      owner_partner_id: fd.get("owner_partner_id"),
    };
    const check = svc().validateTruck(input, { partners: partners(), trucks: cache.trucks });
    if (!check.ok) return showFormErrors(check.errors);
    const payload = {
      user_id: userId(),
      owner_partner_id: input.owner_partner_id,
      placa: String(input.placa || "").trim().toUpperCase(),
      placa_norm: check.placa,
      marca: String(fd.get("marca") || "").trim() || null,
      modelo: String(fd.get("modelo") || "").trim() || null,
      ano: String(fd.get("ano") || "").trim() || null,
      tipo_equipamento: String(fd.get("tipo_equipamento") || "").trim() || null,
      capacidade_obs: String(fd.get("capacidade_obs") || "").trim() || null,
      status: fd.get("status") || "ATIVO",
      updated_at: new Date().toISOString(),
    };
    const db = client();
    const res = await write(function () {
      return id
        ? db.from("tow_trucks").update(payload).eq("id", id).eq("user_id", userId())
        : db.from("tow_trucks").insert(payload);
    });
    if (res && res.error) return alertResult(res);
    closeModal();
    await reload();
  }

  async function saveService(fd, id) {
    if (!(await requireSession()) || !guardWrite()) return;
    const input = serviceInputFromForm(fd);
    const check = svc().validateService(input, { partners: partners(), drivers: cache.drivers, trucks: cache.trucks, vehicles: data.vehicles });
    if (!check.ok) return showFormErrors(check.errors);
    const result = await persistService(input, id);
    if (!result.ok) return showFormErrors([result.message || "Não foi possível registrar a remoção."]);
    closeModal();
    await reload();
  }

  function serviceInputFromForm(fd) {
    const valor = fd.get("valor_contratado");
    return {
      vehicle_id: fd.get("vehicle_id"),
      tipo_prestador: fd.get("rtTipoPrestador"),
      partner_id: fd.get("rtPartnerId"),
      driver_id: fd.get("rtTipoPrestador") === "EMPRESA" ? fd.get("driver_id") : null,
      truck_id: fd.get("truck_id") || null,
      origem: fd.get("origem"),
      destino: fd.get("destino"),
      data_remocao: fd.get("data_remocao"),
      observacoes: fd.get("observacoes"),
      valor_contratado: valor === "" || valor == null ? null : Number(valor),
      aprovado: fd.get("aprovado") === "sim",
    };
  }

  async function persistService(input, existingId) {
    const api = svc();
    const db = client();
    const uid = userId();
    const snap = api.snapshotNames(input, { partners: partners(), drivers: cache.drivers, trucks: cache.trucks, vehicles: data.vehicles });
    const when = input.data_remocao ? new Date(input.data_remocao).toISOString() : new Date().toISOString();
    const payload = {
      user_id: uid,
      vehicle_id: input.vehicle_id,
      placa_veiculo: snap.placa_veiculo,
      data_remocao: when,
      origem: String(input.origem || "").trim() || null,
      destino: String(input.destino || "").trim() || null,
      tipo_prestador: input.tipo_prestador,
      partner_id: input.partner_id,
      partner_nome: snap.partner_nome,
      driver_id: input.driver_id || null,
      driver_nome: snap.driver_nome || null,
      truck_id: input.truck_id || null,
      truck_placa: snap.truck_placa || null,
      observacoes: String(input.observacoes || "").trim() || null,
      registrado_por: ctx.userEmail || "",
      updated_at: new Date().toISOString(),
    };
    let serviceId = existingId || "";
    if (existingId) {
      const res = await write(function () {
        return db.from("tow_services").update(payload).eq("id", existingId).eq("user_id", uid).select("id").single();
      });
      if (res && res.error) return { ok: false, message: res.error.message };
      serviceId = existingId;
    } else {
      const res = await write(function () {
        return db.from("tow_services").insert(payload).select("id").single();
      });
      if (res && res.error) return { ok: false, message: res.error.message };
      serviceId = res.data && res.data.id;
    }
    if (seeFinance() && serviceId && (input.valor_contratado != null || input.aprovado)) {
      const fin = {
        service_id: serviceId,
        user_id: uid,
        valor_contratado: input.valor_contratado,
        aprovado: !!input.aprovado && Number(input.valor_contratado) > 0,
        updated_at: new Date().toISOString(),
      };
      const current = financeOf(serviceId);
      if (!current || !current.payable_id) {
        const res = await write(function () { return db.from("tow_service_finance").upsert(fin, { onConflict: "service_id" }); });
        if (res && res.error) return { ok: false, message: res.error.message };
      }
    }
    return { ok: true, id: serviceId };
  }

  async function setStatus(kind, id, status) {
    if (!guardWrite()) return;
    const label = status === "INATIVO" ? "Inativar este cadastro? O histórico de remoções permanece." : "Reativar este cadastro?";
    if (!confirm(label)) return;
    if (!(await requireSession())) return;
    if (kind === "motorista") {
      const res = await write(function () {
        return client().from("tow_drivers").update({ status: status, updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", userId());
      });
      if (res && res.error) return alertResult(res);
    } else if (kind === "caminhao") {
      const res = await write(function () {
        return client().from("tow_trucks").update({ status: status, updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", userId());
      });
      if (res && res.error) return alertResult(res);
    } else {
      const current = findPartner(id);
      if (!current) return;
      const record = partnerRecordFrom(current);
      record.status = status;
      const saved = await persistPartner(record, id, status === "INATIVO" ? "Cadastro inativado" : "Cadastro reativado");
      if (!saved) return;
    }
    await reload();
  }

  function partnerRecordFrom(p) {
    return {
      nome: p.nome,
      nome_fantasia: p.nome_fantasia,
      tipo: p.tipo,
      cpf: p.cpf,
      telefone: p.telefone,
      whatsapp: p.whatsapp,
      email: p.email,
      cep: p.cep,
      endereco: p.endereco,
      numero: p.numero,
      complemento: p.complemento,
      bairro: p.bairro,
      cidade: p.cidade,
      estado: p.estado,
      status: p.status,
      observacoes: p.observacoes,
      perfil: p.perfil || {},
      contatos: p.contatos || [],
      documentos: p.documentos || [],
      historico: p.historico || [],
    };
  }

  async function gerarObrigacao(serviceId) {
    if (!guardWrite() || !seeFinance()) return;
    if (!(await requireSession())) return;
    await ensureLoaded(true);
    pullState();
    const s = findId(cache.services, serviceId);
    const fin = financeOf(serviceId);
    const gate = svc().canGeneratePayable(s, fin, data.payables);
    if (!gate.ok) {
      alert(gate.reason);
      return;
    }
    if (typeof ctx.insertPayable !== "function") {
      alert("O financeiro não está disponível nesta sessão.");
      return;
    }
    const payload = svc().buildPayablePayload(s, fin, userId());
    const created = await ctx.insertPayable(payload);
    if (!created || created.error || !created.data || !created.data.id) {
      alert((created && created.error && created.error.message) || "Não foi possível criar a conta a pagar.");
      return;
    }
    const payableId = created.data.id;
    const linked = await write(function () {
      return client().from("tow_service_finance").update({ payable_id: payableId, updated_at: new Date().toISOString() }).eq("service_id", serviceId).is("payable_id", null).select("service_id");
    });
    if (!linked || linked.error || !linked.data || !linked.data.length) {
      await write(function () { return client().from("payables").delete().eq("id", payableId).eq("user_id", userId()); });
      alert("A obrigação não foi duplicada. Atualize a página e confira o serviço.");
      return;
    }
    await reload();
    alert("Obrigação criada em contas a pagar, sem lançar saída no caixa.");
  }

  async function savePayment(fd, serviceId) {
    if (!guardWrite() || !seeFinance()) return;
    if (!(await requireSession())) return;
    const s = findId(cache.services, serviceId);
    const fin = financeOf(serviceId);
    const valor = Number(fd.get("valor"));
    if (!s || !fin || !fin.payable_id) return showFormErrors(["Gere a obrigação financeira antes de registrar o pagamento."]);
    if (!(valor > 0)) return showFormErrors(["Informe o valor do pagamento."]);
    const saldo = svc().saldoOf(fin, paymentsOf(serviceId));
    if (valor > saldo + 0.009) return showFormErrors(["O valor ultrapassa o saldo pendente."]);
    let comprovante = null;
    const file = fd.get("comprovante");
    if (file && file.name) {
      try {
        const storagePath = userId() + "/reboque-pagamentos/" + serviceId + "/" + Date.now() + "_" + file.name;
        const up = await client().storage.from("partner-attachments").upload(storagePath, file);
        comprovante = up.error ? file.name : storagePath;
      } catch (_e) {
        comprovante = file.name;
      }
    }
    const res = await write(function () {
      return client().from("tow_service_payments").insert({
        user_id: userId(),
        service_id: serviceId,
        valor: valor,
        data_pagamento: fd.get("data_pagamento"),
        forma_pagamento: fd.get("forma_pagamento") || "PIX",
        favorecido_nome: s.partner_nome,
        comprovante_ref: comprovante,
        usuario: ctx.userEmail || "",
        observacoes: String(fd.get("observacoes") || "").trim() || null,
      });
    });
    if (res && res.error) return alertResult(res);
    const pago = svc().roundMoney(svc().sumPayments(paymentsOf(serviceId)) + valor);
    const contratado = svc().roundMoney(fin.valor_contratado);
    const quitado = pago + 0.009 >= contratado;
    const payablePatch = quitado
      ? { status: "PAGO", valor: contratado, data_pagamento: fd.get("data_pagamento") }
      : { status: "EM_ABERTO", valor: svc().roundMoney(contratado - pago) };
    let payUp = await write(function () {
      return client().from("payables").update(payablePatch).eq("id", fin.payable_id).eq("user_id", userId());
    });
    if (payUp && payUp.error && /column|schema cache|PGRST204/i.test(payUp.error.message || "")) {
      const lean = Object.assign({}, payablePatch);
      delete lean.data_pagamento;
      payUp = await write(function () {
        return client().from("payables").update(lean).eq("id", fin.payable_id).eq("user_id", userId());
      });
    }
    if (payUp && payUp.error) {
      alert("O pagamento foi registrado no serviço, mas a conta a pagar não foi atualizada: " + (payUp.error.message || ""));
    }
    closeModal();
    await reload();
  }

  async function cancelarServico(serviceId) {
    if (!guardWrite()) return;
    if (!confirm("Cancelar este serviço? O registro permanece no histórico.")) return;
    if (!(await requireSession())) return;
    const pays = paymentsOf(serviceId);
    if (pays.length) {
      alert("Há pagamentos registrados. O serviço não foi cancelado.");
      return;
    }
    const res = await write(function () {
      return client().from("tow_services").update({ cancelado: true, updated_at: new Date().toISOString() }).eq("id", serviceId).eq("user_id", userId());
    });
    if (res && res.error) return alertResult(res);
    await reload();
  }

  function openDetail(kind, id) {
    if (kind === "servico") return showModal("Remoção", detailService(id));
    if (kind === "motorista") return showModal("Motorista", detailDriver(id));
    if (kind === "autonomo" || kind === "empresa") return showModal(kind === "empresa" ? "Empresa de reboque" : "Reboqueiro autônomo", detailPartner(id));
  }

  function detailPartner(id) {
    const p = findPartner(id);
    if (!p) return "<p>Cadastro não encontrado.</p>";
    const trucks = cache.trucks.filter(function (t) { return String(t.owner_partner_id) === String(id); });
    const drivers = cache.drivers.filter(function (d) { return String(d.company_partner_id) === String(id); });
    const services = cache.services.filter(function (s) { return String(s.partner_id) === String(id); });
    const bank = (cache.banking || []).find(function (b) { return String(b.partner_id) === String(id); });
    const docs = (cache.documents || []).filter(function (d) { return String(d.partner_id) === String(id); });
    const report = svc() ? svc().reportAggregates(aggregateInput(services)) : null;
    let html = '<div class="form-grid">' +
      kv("Nome", p.nome) + kv("Fantasia", p.nome_fantasia) + kv("Documento", p.cpf) +
      kv("Telefone", p.telefone) + kv("WhatsApp", p.whatsapp) + kv("E-mail", p.email) +
      kv("Cidade", [p.cidade, p.estado].filter(Boolean).join(" / ")) + kv("Situação", svc() ? svc().statusOf(p.status) : "") +
      "</div>";
    if (seeFinance() && bank) {
      html += "<h4>Dados para pagamento</h4><div class=\"form-grid\">" + kv("Banco", bank.banco) + kv("Agência", bank.agencia) + kv("Conta", bank.conta) + kv("PIX", bank.chave_pix) + kv("Inscrição estadual", bank.inscricao_estadual) + "</div>";
    }
    if (seeFinance() && report) {
      html += "<h4>Valores</h4><p>Contratado " + money(report.contratado) + " · Pago " + money(report.pago) + " · Pendente " + money(report.pendente) + "</p>";
    }
    html += "<h4>Caminhões</h4>" + mini(trucks.map(function (t) { return esc(t.placa) + " · " + esc(t.modelo || t.tipo_equipamento || "—") + " · " + esc(svc().statusOf(t.status)); }));
    if (!readOnly()) html += '<p><button type="button" data-rt-action="novo-caminhao" data-owner="' + esc(id) + '">Adicionar caminhão</button></p>';
    if (kindOf(p) === "EMPRESA") {
      html += "<h4>Motoristas</h4>" + mini(drivers.map(function (d) { return esc(d.nome) + " · " + esc(svc().statusOf(d.status)); }));
    }
    html += "<h4>Remoções</h4>" + mini(services.map(function (s) { return fmtWhen(s.data_remocao) + " · " + esc(s.placa_veiculo || "—") + " · " + esc(s.driver_nome || s.truck_placa || "—"); }));
    if (seeFinance()) html += "<h4>Documentos</h4>" + mini(docs.map(function (d) {
      const link = d.url ? '<a href="' + esc(d.url) + '" target="_blank" rel="noopener">' + esc(d.nome) + "</a>" : esc(d.nome);
      return link;
    }));
    return html;
  }

  function detailDriver(id) {
    const d = findId(cache.drivers, id);
    if (!d) return "<p>Motorista não encontrado.</p>";
    const company = findPartner(d.company_partner_id);
    const services = cache.services.filter(function (s) { return String(s.driver_id) === String(id); });
    return '<div class="form-grid">' + kv("Nome", d.nome) + kv("CPF", d.cpf) + kv("Empresa", company && company.nome) + kv("CNH", [d.cnh, d.cnh_categoria, d.cnh_validade].filter(Boolean).join(" · ")) + kv("Situação", svc().statusOf(d.status)) + "</div><h4>Remoções</h4>" + mini(services.map(function (s) { return fmtWhen(s.data_remocao) + " · " + esc(s.placa_veiculo || "—") + " · " + esc(s.partner_nome || ""); }));
  }

  function detailService(id) {
    const s = findId(cache.services, id);
    if (!s) return "<p>Serviço não encontrado.</p>";
    const fin = financeOf(id);
    const pays = paymentsOf(id);
    const sit = svc().situacaoFinanceira(s, fin, pays, payableOf(fin));
    let html = '<div class="form-grid">' +
      kv("Veículo", s.placa_veiculo) + kv("Data", fmtWhen(s.data_remocao)) + kv("Origem", s.origem) + kv("Destino", s.destino) +
      kv("Prestador", s.partner_nome) + kv("Motorista", s.driver_nome) + kv("Caminhão", s.truck_placa) +
      kv("Registrado por", s.registrado_por) + kv("Situação", svc().situacaoLabel(sit)) +
      "</div>";
    if (seeFinance()) {
      html += "<h4>Pagamentos</h4>" + mini(pays.map(function (p) {
        return esc(p.data_pagamento) + " · " + money(p.valor) + " · " + esc(p.forma_pagamento || "") + " · " + esc(p.favorecido_nome || "") + (p.usuario ? " · " + esc(p.usuario) : "");
      }));
      if (!pays.length) html += "<p>Nenhum pagamento registrado.</p>";
    }
    return html;
  }

  function kv(label, value) {
    return '<div><label>' + esc(label) + '</label><div>' + esc(value || "—") + "</div></div>";
  }

  function mini(items) {
    if (!items.length) return "<p>Nenhum registro.</p>";
    return "<ul>" + items.map(function (item) { return "<li>" + item + "</li>"; }).join("") + "</ul>";
  }

  function printReport() {
    const rows = visibleServices();
    const report = svc() ? svc().reportAggregates(aggregateInput(rows)) : null;
    const w = window.open("", "_blank");
    if (!w) return;
    const body = rows.map(function (s) {
      const fin = financeOf(s.id);
      const pays = paymentsOf(s.id);
      return "<tr><td>" + fmtWhen(s.data_remocao) + "</td><td>" + esc(s.placa_veiculo || "") + "</td><td>" + esc(s.partner_nome || "") + "</td><td>" + esc(s.driver_nome || "") + "</td><td>" + esc(s.truck_placa || "") + "</td><td>" + (seeFinance() ? money(fin && fin.valor_contratado) : "—") + "</td><td>" + (seeFinance() ? money(svc().sumPayments(pays)) : "—") + "</td></tr>";
    }).join("");
    const totals = report && seeFinance()
      ? "<p>Contratado " + money(report.contratado) + " · Pago " + money(report.pago) + " · Pendente " + money(report.pendente) + "</p>"
      : "";
    w.document.write("<!DOCTYPE html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\"><title>Reboque e transporte</title></head><body><h1>Reboque e transporte</h1>" + totals + "<table border=\"1\" cellpadding=\"6\"><thead><tr><th>Data</th><th>Placa</th><th>Prestador</th><th>Motorista</th><th>Caminhão</th><th>Contratado</th><th>Pago</th></tr></thead><tbody>" + body + "</tbody></table></body></html>");
    w.document.close();
    w.focus();
    w.print();
  }

  function adoptArgs(args) {
    args = args || {};
    if (args.supabase) ctx.supabase = args.supabase;
    if (args.userEmail) ctx.userEmail = args.userEmail;
    if (args.runSupabaseWrite) ctx.runSupabaseWrite = args.runSupabaseWrite;
    if (args.insertPayable) ctx.insertPayable = args.insertPayable;
    if (typeof args.hidesFinancialValues === "boolean") ctx.hidesFinancialValues = args.hidesFinancialValues;
    if (typeof args.readOnly === "boolean") ctx.readOnly = args.readOnly;
    if (args.userId) ctx.effectiveUserId = function () { return args.userId; };
    if (args.partners) data.partners = args.partners;
    if (args.vehicles) data.vehicles = args.vehicles;
    if (args.payables) data.payables = args.payables;
    if (typeof args.getState === "function") {
      ctx.getState = args.getState;
      pullState();
    }
  }

  async function syncVehicle(opts) {
    lastVehicleOpts = opts || lastVehicleOpts || {};
    adoptArgs(lastVehicleOpts);
    bindOnce();
    await ensureLoaded();
    const sel = document.getElementById("vehicleLocator");
    const block = document.getElementById("vehicleTowFields");
    if (!sel || !block || !svc()) return;
    const partner = findPartner(sel.value);
    const kind = partner ? svc().partnerKind(partner.tipo) : "";
    block.classList.toggle("hidden", !kind);
    const driverWrap = document.getElementById("vehicleTowDriverWrap");
    if (driverWrap) driverWrap.classList.toggle("hidden", kind !== "EMPRESA");
    const valorWrap = document.getElementById("vehicleTowValorWrap");
    if (valorWrap) valorWrap.classList.toggle("hidden", !!(lastVehicleOpts && lastVehicleOpts.hidesFinancialValues) || !seeFinance());
    const existing = lastVehicleOpts.prefill
      ? cache.services.find(function (s) {
          return String(s.vehicle_id) === String(lastVehicleOpts.vehicleId || "") && !s.cancelado;
        })
      : null;
    const driverSel = document.getElementById("vehicleTowDriver");
    const truckSel = document.getElementById("vehicleTowTruck");
    if (driverSel) {
      driverSel.innerHTML = driverOptions(partner && partner.id, existing && existing.driver_id);
      if (existing && existing.driver_id) driverSel.value = existing.driver_id;
    }
    if (truckSel) {
      truckSel.innerHTML = truckOptions(partner && partner.id, existing && existing.truck_id, true);
      if (existing && existing.truck_id) truckSel.value = existing.truck_id;
    }
    if (existing) {
      const origem = document.getElementById("vehicleTowOrigem");
      const destino = document.getElementById("vehicleTowDestino");
      const obs = document.getElementById("vehicleTowObs");
      const valor = document.getElementById("vehicleTowValor");
      if (origem) origem.value = existing.origem || "";
      if (destino) destino.value = existing.destino || "";
      if (obs) obs.value = existing.observacoes || "";
      const fin = financeOf(existing.id);
      if (valor && fin && fin.valor_contratado != null && seeFinance()) valor.value = fin.valor_contratado;
    }
  }

  function readVehicleDraft() {
    const block = document.getElementById("vehicleTowFields");
    if (!block || block.classList.contains("hidden")) return null;
    return {
      driverId: document.getElementById("vehicleTowDriver")?.value || "",
      truckId: document.getElementById("vehicleTowTruck")?.value || "",
      origem: document.getElementById("vehicleTowOrigem")?.value || "",
      destino: document.getElementById("vehicleTowDestino")?.value || "",
      valor: document.getElementById("vehicleTowValor")?.value || "",
      obs: document.getElementById("vehicleTowObs")?.value || "",
    };
  }

  async function saveFromVehicle(args) {
    args = args || {};
    adoptArgs(args);
    if (!args.draft || !svc()) return { ok: true, skipped: true };
    if (cache.missing) {
      return { ok: false, message: "O veículo foi salvo. O transporte não foi registrado porque falta executar supabase/reboque_transporte.sql." };
    }
    await ensureLoaded(true);
    const partner = findPartner(args.partnerId);
    const kind = partner ? svc().partnerKind(partner.tipo) : "";
    if (!kind) return { ok: true, skipped: true };
    const existing = cache.services.find(function (s) {
      return String(s.vehicle_id) === String(args.vehicleId) && !s.cancelado;
    });
    if (existing) {
      const fin = financeOf(existing.id);
      if (fin && fin.payable_id) return { ok: true, skipped: true };
    }
    const input = {
      vehicle_id: args.vehicleId,
      tipo_prestador: kind,
      partner_id: args.partnerId,
      driver_id: kind === "EMPRESA" ? args.draft.driverId : null,
      truck_id: args.draft.truckId || null,
      origem: args.draft.origem,
      destino: args.draft.destino,
      data_remocao: args.dataRemocao,
      observacoes: args.draft.obs,
      placa_veiculo: args.placa,
      valor_contratado: args.draft.valor === "" ? null : Number(args.draft.valor),
      aprovado: false,
    };
    if (lastVehicleOpts && lastVehicleOpts.hidesFinancialValues) input.valor_contratado = null;
    const check = svc().validateService(input, { partners: partners(), drivers: cache.drivers, trucks: cache.trucks, vehicles: (data.vehicles || []).concat([{ id: args.vehicleId, placa: args.placa }]) });
    if (!check.ok) {
      return { ok: false, message: "O veículo foi salvo. O transporte não foi registrado: " + check.errors.join(" ") };
    }
    const saved = await persistService(input, existing && existing.id);
    if (!saved.ok) return { ok: false, message: "O veículo foi salvo. O transporte não foi registrado: " + (saved.message || "") };
    return { ok: true };
  }

  global.reboqueTransporteBind = bindOnce;
  global.reboqueTransporteRender = render;
  global.reboqueSyncVehicleTowFields = syncVehicle;
  global.reboqueReadVehicleTowDraft = readVehicleDraft;
  global.reboqueSaveServiceFromVehicle = saveFromVehicle;
})(typeof window !== "undefined" ? window : globalThis);

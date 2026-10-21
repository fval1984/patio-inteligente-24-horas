/**
 * Reboque e Transporte — regras puras (sem gravar sozinho).
 * Empresas e autônomos usam a tabela partners. Motorista não vira usuário nem título financeiro.
 */
(function reboqueTransporteServiceModule(root, factory) {
  "use strict";
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.reboqueTransporteService = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function reboqueTransporteFactory() {
  "use strict";

  const TIPO_EMPRESA = "EMPRESA_REBOQUE";
  const TIPO_AUTONOMO = "REBOQUEIRO_AUTONOMO";
  const MARKER_PREFIX = "[[towsvc:";

  function digits(v) {
    return String(v || "").replace(/\D/g, "");
  }

  function normalizePlate(v) {
    return String(v || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  function partnerKind(tipo) {
    const t = String(tipo || "")
      .trim()
      .toUpperCase();
    if (t === TIPO_EMPRESA || t === "EMPRESA_DE_REBOQUE") return "EMPRESA";
    if (t === TIPO_AUTONOMO || t === "AUTONOMO") return "AUTONOMO";
    return "";
  }

  function statusOf(v) {
    return String(v || "ATIVO").trim().toUpperCase() === "INATIVO" ? "INATIVO" : "ATIVO";
  }

  function roundMoney(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return 0;
    return Math.round(x * 100) / 100;
  }

  function requireText(errors, value, label) {
    if (!String(value || "").trim()) errors.push(label + " é obrigatório.");
  }

  function validateCompany(input, ctx) {
    const errors = [];
    const nome = String((input && input.nome) || "").trim();
    requireText(errors, nome, "Razão social");
    const cnpj = digits(input && input.cpf);
    if (cnpj.length !== 14) errors.push("CNPJ deve ter 14 dígitos.");
    const dup = findDuplicateDocument(ctx, cnpj, { excludePartnerId: input && input.id });
    if (dup) errors.push("Já existe cadastro com este CNPJ.");
    const nameDup = findDuplicateName(ctx, nome, input && input.id);
    if (nameDup) errors.push("Já existe um parceiro com esta razão social.");
    return { ok: errors.length === 0, errors: errors };
  }

  function validateDriver(input, ctx) {
    const errors = [];
    ctx = ctx || {};
    requireText(errors, input && input.nome, "Nome completo");
    const cpf = digits(input && input.cpf);
    if (cpf.length !== 11) errors.push("CPF deve ter 11 dígitos.");
    if (!input || !input.company_partner_id) errors.push("Empresa vinculada é obrigatória.");
    else {
      const company = findById(ctx.partners, input.company_partner_id);
      if (!company || partnerKind(company.tipo) !== "EMPRESA") {
        errors.push("A empresa vinculada precisa ser uma empresa de reboque.");
      }
    }
    const dup = findDuplicateDocument(ctx, cpf, { excludeDriverId: input && input.id });
    if (dup) errors.push("Já existe cadastro com este CPF.");
    if (input && input.habitual_truck_id) {
      const truck = findById(ctx.trucks, input.habitual_truck_id);
      if (!truck) errors.push("Caminhão habitual não encontrado.");
      else if (String(truck.owner_partner_id) !== String(input.company_partner_id)) {
        errors.push("O caminhão habitual precisa ser da mesma empresa.");
      }
    }
    return { ok: errors.length === 0, errors: errors };
  }

  function validateAutonomous(input, ctx) {
    const errors = [];
    requireText(errors, input && input.nome, "Nome completo");
    const pessoa = String((input && input.tipo_pessoa) || "PF").toUpperCase() === "PJ" ? "PJ" : "PF";
    const cpf = digits(input && (input.cpf_pessoa || input.cpf));
    const cnpj = digits(input && input.cnpj);
    if (pessoa === "PF") {
      if (cpf.length !== 11) errors.push("CPF deve ter 11 dígitos.");
      if (cnpj) errors.push("Pessoa física não deve ser gravada com CNPJ neste campo. Use pessoa jurídica se houver CNPJ.");
    } else {
      if (cnpj.length !== 14) errors.push("CNPJ é obrigatório para pessoa jurídica.");
      if (cpf && cpf.length !== 11) errors.push("CPF da pessoa física, se informado, deve ter 11 dígitos.");
    }
    const doc = pessoa === "PJ" ? cnpj : cpf;
    const dup = findDuplicateDocument(ctx, doc, { excludePartnerId: input && input.id });
    if (dup) errors.push("Já existe cadastro com este documento.");
    if (pessoa === "PJ" && cpf) {
      const dupCpf = findDuplicateDocument(ctx, cpf, { excludePartnerId: input && input.id });
      if (dupCpf) errors.push("Já existe cadastro com este CPF.");
    }
    const nameDup = findDuplicateName(ctx, input && input.nome, input && input.id);
    if (nameDup) errors.push("Já existe um parceiro com este nome.");
    return { ok: errors.length === 0, errors: errors, pessoa: pessoa };
  }

  function validateTruck(input, ctx) {
    const errors = [];
    ctx = ctx || {};
    const placa = normalizePlate(input && input.placa);
    if (placa.length < 7) errors.push("Placa inválida.");
    if (!input || !input.owner_partner_id) errors.push("O caminhão precisa de um prestador.");
    else {
      const owner = findById(ctx.partners, input.owner_partner_id);
      if (!owner || !partnerKind(owner.tipo)) errors.push("O caminhão só pode ser vinculado a empresa de reboque ou autônomo.");
    }
    const list = ctx.trucks || [];
    for (let i = 0; i < list.length; i++) {
      const t = list[i];
      if (input && input.id && String(t.id) === String(input.id)) continue;
      if (normalizePlate(t.placa_norm || t.placa) === placa) {
        errors.push("Já existe caminhão com esta placa.");
        break;
      }
    }
    return { ok: errors.length === 0, errors: errors, placa: placa };
  }

  function validateService(input, ctx) {
    const errors = [];
    ctx = ctx || {};
    if (!input || !input.vehicle_id) errors.push("Selecione o veículo já cadastrado.");
    const vehicle = findById(ctx.vehicles, input && input.vehicle_id);
    if (input && input.vehicle_id && !vehicle) errors.push("Veículo não encontrado. Não crie um cadastro paralelo.");
    const kind = input && input.tipo_prestador;
    if (kind !== "EMPRESA" && kind !== "AUTONOMO") errors.push("Informe o tipo de prestador.");
    const partner = findById(ctx.partners, input && input.partner_id);
    if (!partner || partnerKind(partner.tipo) !== kind) {
      errors.push(kind === "EMPRESA" ? "Selecione a empresa de reboque." : "Selecione o reboqueiro autônomo.");
    }
    if (kind === "EMPRESA") {
      const driver = findById(ctx.drivers, input && input.driver_id);
      if (!driver) errors.push("Selecione o motorista da empresa.");
      else if (String(driver.company_partner_id) !== String(input.partner_id)) {
        errors.push("O motorista não pertence à empresa selecionada.");
      }
    }
    const trucks = (ctx.trucks || []).filter(function (t) {
      return String(t.owner_partner_id) === String(input && input.partner_id) && statusOf(t.status) === "ATIVO";
    });
    if (trucks.length && !(input && input.truck_id)) errors.push("Selecione o caminhão utilizado.");
    if (input && input.truck_id) {
      const truck = findById(ctx.trucks, input.truck_id);
      if (!truck || String(truck.owner_partner_id) !== String(input.partner_id)) {
        errors.push("O caminhão não pertence ao prestador selecionado.");
      }
    }
    const valor = input && input.valor_contratado;
    if (valor != null && String(valor) !== "" && !(Number(valor) >= 0)) errors.push("Valor contratado inválido.");
    return { ok: errors.length === 0, errors: errors, vehicle: vehicle, partner: partner };
  }

  function findById(list, id) {
    if (!id) return null;
    const sid = String(id);
    const arr = list || [];
    for (let i = 0; i < arr.length; i++) {
      if (String(arr[i] && arr[i].id) === sid) return arr[i];
    }
    return null;
  }

  function collectDocs(ctx, exclude) {
    exclude = exclude || {};
    const out = [];
    (ctx && ctx.partners ? ctx.partners : []).forEach(function (p) {
      if (exclude.excludePartnerId && String(p.id) === String(exclude.excludePartnerId)) return;
      const doc = digits(p.cpf);
      if (doc) out.push(doc);
      const perfil = p.perfil || {};
      const extra = digits(perfil.cpf || perfil.cpf_pessoa);
      if (extra) out.push(extra);
    });
    (ctx && ctx.drivers ? ctx.drivers : []).forEach(function (d) {
      if (exclude.excludeDriverId && String(d.id) === String(exclude.excludeDriverId)) return;
      const doc = digits(d.cpf_digits || d.cpf);
      if (doc) out.push(doc);
    });
    return out;
  }

  function findDuplicateDocument(ctx, docDigits, exclude) {
    const doc = digits(docDigits);
    if (doc.length < 11) return null;
    const all = collectDocs(ctx, exclude);
    return all.indexOf(doc) >= 0 ? doc : null;
  }

  function findDuplicateName(ctx, nome, excludePartnerId) {
    const key = String(nome || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
    if (!key) return null;
    const list = (ctx && ctx.partners) || [];
    for (let i = 0; i < list.length; i++) {
      if (excludePartnerId && String(list[i].id) === String(excludePartnerId)) continue;
      const other = String(list[i].nome || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
      if (other && other === key) return list[i];
    }
    return null;
  }

  function sumPayments(payments) {
    let total = 0;
    (payments || []).forEach(function (p) {
      total += Number(p && p.valor) || 0;
    });
    return roundMoney(total);
  }

  function situacaoFinanceira(service, finance, payments, payable) {
    if (!service || service.cancelado) return "CANCELADO";
    const valor = roundMoney(finance && finance.valor_contratado);
    const aprovado = !!(finance && finance.aprovado);
    const hasPayable = !!(finance && finance.payable_id);
    if (!(valor > 0) || !aprovado || !hasPayable) return "A_CONTRATAR";
    const payStatus = String((payable && payable.status) || "").toUpperCase();
    if (payStatus === "PAGO") return "PAGO";
    if (payStatus === "CANCELADO") return "CANCELADO";
    const pago = sumPayments(payments);
    if (pago <= 0.009) return "A_PAGAR";
    if (pago + 0.009 < valor) return "PARCIAL";
    return "PAGO";
  }

  function saldoOf(finance, payments) {
    const valor = roundMoney(finance && finance.valor_contratado);
    return roundMoney(Math.max(0, valor - sumPayments(payments)));
  }

  function canGeneratePayable(service, finance, payables) {
    if (!service || service.cancelado) return { ok: false, reason: "Serviço cancelado." };
    if (finance && finance.payable_id) return { ok: false, reason: "Já existe obrigação financeira para este serviço." };
    if (payableAlreadyLinked(payables, service && service.id)) {
      return { ok: false, reason: "Já existe lançamento financeiro vinculado a este serviço." };
    }
    const valor = roundMoney(finance && finance.valor_contratado);
    if (!(valor > 0)) return { ok: false, reason: "Defina o valor contratado." };
    if (!finance || !finance.aprovado) return { ok: false, reason: "O valor precisa ser aprovado antes de gerar a obrigação." };
    return { ok: true, valor: valor };
  }

  function markerFor(serviceId) {
    return MARKER_PREFIX + String(serviceId || "") + "]]";
  }

  function payableAlreadyLinked(payables, serviceId) {
    if (!serviceId) return false;
    const marker = markerFor(serviceId);
    return (payables || []).some(function (p) {
      const blob = String((p && p.observacoes) || "") + " " + String((p && p.descricao) || "");
      return blob.indexOf(marker) >= 0;
    });
  }

  function buildPayablePayload(service, finance, userId) {
    const when = String((service && service.data_remocao) || new Date().toISOString()).slice(0, 10);
    const favorecido = String((service && service.partner_nome) || "").trim();
    return {
      user_id: userId,
      tipo: "DESPESA",
      payable_category: "REMOCAO_TRANSPORTE",
      descricao: "Remoção " + String((service && service.placa_veiculo) || "").trim() + " — " + favorecido,
      valor: roundMoney(finance && finance.valor_contratado),
      data_vencimento: when,
      status: "EM_ABERTO",
      fornecedor: favorecido,
      observacoes: markerFor(service && service.id) + " Transporte. Favorecido: " + favorecido,
    };
  }

  function snapshotNames(input, ctx) {
    const partner = findById(ctx && ctx.partners, input && input.partner_id);
    const driver = findById(ctx && ctx.drivers, input && input.driver_id);
    const truck = findById(ctx && ctx.trucks, input && input.truck_id);
    const vehicle = findById(ctx && ctx.vehicles, input && input.vehicle_id);
    return {
      partner_nome: String((partner && partner.nome) || input.partner_nome || "").trim(),
      driver_nome: driver ? String(driver.nome || "").trim() : input && input.driver_id ? String(input.driver_nome || "") : "",
      truck_placa: truck ? normalizePlate(truck.placa_norm || truck.placa) : "",
      placa_veiculo: normalizePlate((vehicle && vehicle.placa) || input.placa_veiculo || ""),
    };
  }

  function renameDoesNotRewriteHistory(services) {
    return (services || []).map(function (s) {
      return {
        id: s.id,
        partner_nome: s.partner_nome,
        driver_nome: s.driver_nome,
        truck_placa: s.truck_placa,
      };
    });
  }

  function matchesSearch(blob, query) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return true;
    const qDigits = digits(q);
    const text = String(blob || "").toLowerCase();
    if (text.indexOf(q) >= 0) return true;
    return !!qDigits && digits(text).indexOf(qDigits) >= 0;
  }

  function inPeriod(iso, de, ate) {
    const ymd = String(iso || "").slice(0, 10);
    if (!ymd) return false;
    if (de && ymd < de) return false;
    if (ate && ymd > ate) return false;
    return true;
  }

  function reportAggregates(input) {
    const services = (input && input.services) || [];
    const financeById = input.financeById || {};
    const paymentsById = input.paymentsById || {};
    const byPartner = {};
    const byDriver = {};
    const byTruck = {};
    let contratado = 0;
    let pago = 0;
    let pendente = 0;
    services.forEach(function (s) {
      if (!s || s.cancelado) return;
      const fin = financeById[s.id] || null;
      const pays = paymentsById[s.id] || [];
      const valor = roundMoney(fin && fin.valor_contratado);
      const pagoItem = sumPayments(pays);
      const pend = saldoOf(fin, pays);
      contratado += valor;
      pago += pagoItem;
      if (fin && fin.aprovado && fin.payable_id) pendente += pend;
      const pk = String(s.partner_id || "");
      if (!byPartner[pk]) byPartner[pk] = { id: pk, nome: s.partner_nome, tipo: s.tipo_prestador, quantidade: 0, contratado: 0, pago: 0, pendente: 0 };
      byPartner[pk].quantidade += 1;
      byPartner[pk].contratado = roundMoney(byPartner[pk].contratado + valor);
      byPartner[pk].pago = roundMoney(byPartner[pk].pago + pagoItem);
      byPartner[pk].pendente = roundMoney(byPartner[pk].pendente + (fin && fin.aprovado && fin.payable_id ? pend : 0));
      if (s.driver_id) {
        const dk = String(s.driver_id);
        if (!byDriver[dk]) byDriver[dk] = { id: dk, nome: s.driver_nome, quantidade: 0 };
        byDriver[dk].quantidade += 1;
      }
      if (s.truck_id) {
        const tk = String(s.truck_id);
        if (!byTruck[tk]) byTruck[tk] = { id: tk, placa: s.truck_placa, quantidade: 0 };
        byTruck[tk].quantidade += 1;
      }
    });
    return {
      quantidade: services.filter(function (s) {
        return s && !s.cancelado;
      }).length,
      contratado: roundMoney(contratado),
      pago: roundMoney(pago),
      pendente: roundMoney(pendente),
      porParceiro: Object.keys(byPartner).map(function (k) {
        return byPartner[k];
      }),
      porMotorista: Object.keys(byDriver).map(function (k) {
        return byDriver[k];
      }),
      porCaminhao: Object.keys(byTruck).map(function (k) {
        return byTruck[k];
      }),
    };
  }

  function situacaoLabel(code) {
    switch (code) {
      case "A_PAGAR":
        return "A pagar";
      case "PARCIAL":
        return "Parcialmente pago";
      case "PAGO":
        return "Pago";
      case "CANCELADO":
        return "Cancelado";
      default:
        return "A contratar";
    }
  }

  return {
    TIPO_EMPRESA: TIPO_EMPRESA,
    TIPO_AUTONOMO: TIPO_AUTONOMO,
    digits: digits,
    normalizePlate: normalizePlate,
    partnerKind: partnerKind,
    statusOf: statusOf,
    roundMoney: roundMoney,
    validateCompany: validateCompany,
    validateDriver: validateDriver,
    validateAutonomous: validateAutonomous,
    validateTruck: validateTruck,
    validateService: validateService,
    findDuplicateDocument: findDuplicateDocument,
    sumPayments: sumPayments,
    situacaoFinanceira: situacaoFinanceira,
    saldoOf: saldoOf,
    canGeneratePayable: canGeneratePayable,
    payableAlreadyLinked: payableAlreadyLinked,
    buildPayablePayload: buildPayablePayload,
    snapshotNames: snapshotNames,
    renameDoesNotRewriteHistory: renameDoesNotRewriteHistory,
    matchesSearch: matchesSearch,
    inPeriod: inPeriod,
    reportAggregates: reportAggregates,
    situacaoLabel: situacaoLabel,
    markerFor: markerFor,
  };
});

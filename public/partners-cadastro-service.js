/**
 * Partners Cadastro Service (browser runtime).
 * Espelho de lib/partners/{types,fields,validation,service}.ts
 */
(function partnersCadastroServiceModule(global) {
  "use strict";

  const PARTNER_TIPOS = [
    { code: "INSTITUICAO_FINANCEIRA", label: "Instituição Financeira", badge: "green" },
    { code: "ASSESSORIA", label: "Assessoria Jurídica", badge: "purple" },
    { code: "GUINCHEIRO", label: "Guincheiro", badge: "orange" },
    { code: "LOCALIZADOR", label: "Localizador", badge: "blue" },
  ];

  const DEFAULT_PARTNER_FILTERS = {
    tipo: "",
    cidade: "",
    estado: "",
    status: "",
    search: "",
  };

  const UF_OPTIONS = [
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
    "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
  ].map(function (uf) {
    return { value: uf, label: uf };
  });

  const COMMON_FIELDS = [
    { key: "nome", label: "Nome", kind: "text", required: true, group: "common", span: "half" },
    {
      key: "tipo",
      label: "Tipo de Parceiro",
      kind: "select",
      required: true,
      group: "common",
      span: "half",
      options: PARTNER_TIPOS.map(function (t) {
        return { value: t.code, label: t.label };
      }),
    },
    { key: "cpf", label: "CPF/CNPJ", kind: "text", group: "common", span: "half" },
    { key: "telefone", label: "Telefone", kind: "tel", group: "common", span: "half" },
    { key: "whatsapp", label: "WhatsApp", kind: "tel", group: "common", span: "half" },
    { key: "email", label: "E-mail", kind: "email", group: "common", span: "half" },
    { key: "cep", label: "CEP", kind: "text", group: "common", span: "half" },
    { key: "endereco", label: "Endereço", kind: "text", group: "common", span: "half" },
    { key: "numero", label: "Número", kind: "text", group: "common", span: "half" },
    { key: "complemento", label: "Complemento", kind: "text", group: "common", span: "half" },
    { key: "bairro", label: "Bairro", kind: "text", group: "common", span: "half" },
    { key: "cidade", label: "Cidade", kind: "text", group: "common", span: "half" },
    {
      key: "estado",
      label: "Estado",
      kind: "select",
      group: "common",
      span: "half",
      options: [{ value: "", label: "—" }].concat(UF_OPTIONS),
    },
    {
      key: "status",
      label: "Status",
      kind: "select",
      required: true,
      group: "common",
      span: "half",
      options: [
        { value: "ATIVO", label: "Ativo" },
        { value: "INATIVO", label: "Inativo" },
      ],
    },
    { key: "observacoes", label: "Observações", kind: "textarea", group: "common", span: "full" },
  ];

  const TIPO_FIELDS = {
    INSTITUICAO_FINANCEIRA: [
      { key: "nome_fantasia", label: "Nome Fantasia", kind: "text", group: "tipo", span: "half" },
      { key: "gestor_conta", label: "Gestor da Conta", kind: "text", required: true, group: "tipo", span: "half" },
      { key: "telefone_comercial", label: "Telefone Comercial", kind: "tel", group: "tipo", span: "half" },
      { key: "email_financeiro", label: "E-mail Financeiro", kind: "email", group: "tipo", span: "half" },
      { key: "departamento", label: "Departamento", kind: "text", group: "tipo", span: "half" },
      { key: "condicao_pagamento", label: "Condição de Pagamento", kind: "text", group: "tipo", span: "half" },
      { key: "prazo_pagamento", label: "Prazo de Pagamento", kind: "text", group: "tipo", span: "half" },
      { key: "observacoes_comerciais", label: "Observações Comerciais", kind: "textarea", group: "tipo", span: "full" },
    ],
    GUINCHEIRO: [
      { key: "regiao_atendimento", label: "Região de Atendimento", kind: "text", required: true, group: "tipo", span: "half" },
      { key: "disponibilidade", label: "Disponibilidade", kind: "text", group: "tipo", span: "half" },
      { key: "tipo_guincho", label: "Tipo de Guincho", kind: "text", group: "tipo", span: "half" },
      { key: "valor_medio", label: "Valor Médio", kind: "number", group: "tipo", span: "half" },
      {
        key: "possui_plantao",
        label: "Possui Plantão",
        kind: "select",
        group: "tipo",
        span: "half",
        options: [
          { value: "", label: "—" },
          { value: "sim", label: "Sim" },
          { value: "nao", label: "Não" },
        ],
      },
      { key: "horario_atendimento", label: "Horário de Atendimento", kind: "text", group: "tipo", span: "half" },
    ],
    ASSESSORIA: [
      { key: "responsavel", label: "Responsável", kind: "text", group: "tipo", span: "half" },
      { key: "oab", label: "Número da OAB", kind: "text", required: true, group: "tipo", span: "half" },
      { key: "especialidade", label: "Especialidade", kind: "text", group: "tipo", span: "half" },
      { key: "telefone_comercial", label: "Telefone Comercial", kind: "tel", group: "tipo", span: "half" },
      { key: "email_juridico", label: "E-mail Jurídico", kind: "email", group: "tipo", span: "half" },
    ],
    LOCALIZADOR: [
      { key: "cidade_atuacao", label: "Cidade de Atuação", kind: "text", group: "tipo", span: "half" },
      { key: "regiao", label: "Região", kind: "text", group: "tipo", span: "half" },
      { key: "pix", label: "PIX", kind: "text", group: "tipo", span: "half" },
      { key: "banco", label: "Banco", kind: "text", group: "tipo", span: "half" },
      { key: "agencia", label: "Agência", kind: "text", group: "tipo", span: "half" },
      { key: "conta", label: "Conta", kind: "text", group: "tipo", span: "half" },
      { key: "chave_pix", label: "Chave PIX", kind: "text", group: "tipo", span: "half" },
    ],
  };

  const PARTNER_META_RE = /\[\[partnermeta:([\s\S]*?)\]\]/;
  const JSONB_KEYS = ["perfil", "contatos", "documentos", "historico"];
  const ADDRESS_KEYS = ["cep", "endereco", "numero", "complemento", "bairro", "cidade", "estado", "whatsapp", "telefone"];

  function digits(v) {
    return String(v || "").replace(/\D/g, "");
  }

  function asArray(v) {
    return Array.isArray(v) ? v : [];
  }

  function parseJsonField(v, fallback) {
    if (v == null) return fallback;
    if (typeof v === "object") return v;
    if (typeof v === "string") {
      try {
        return JSON.parse(v);
      } catch (_e) {
        return fallback;
      }
    }
    return fallback;
  }

  function normalizePartnerTipo(tipo) {
    const t = String(tipo || "")
      .trim()
      .toUpperCase();
    if (t === "INSTITUICAO_FINANCEIRA" || t === "FINANCEIRA") return "INSTITUICAO_FINANCEIRA";
    if (t === "ASSESSORIA" || t === "ASSESSORIA_JURIDICA") return "ASSESSORIA";
    if (t === "GUINCHEIRO" || t === "REMOCAO") return "GUINCHEIRO";
    if (t === "LOCALIZADOR" || t === "PARCEIRO" || !t) return "LOCALIZADOR";
    return "LOCALIZADOR";
  }

  function partnerTipoLabel(tipo) {
    const code = normalizePartnerTipo(tipo);
    const found = PARTNER_TIPOS.find(function (x) {
      return x.code === code;
    });
    return found ? found.label : code;
  }

  function partnerTipoBadge(tipo) {
    const code = normalizePartnerTipo(tipo);
    const found = PARTNER_TIPOS.find(function (x) {
      return x.code === code;
    });
    return found ? found.badge : "blue";
  }

  function fieldsForTipo(tipo) {
    const code = normalizePartnerTipo(tipo);
    return COMMON_FIELDS.concat(TIPO_FIELDS[code] || []);
  }

  function tipoLabelRequired(t) {
    switch (t) {
      case "INSTITUICAO_FINANCEIRA":
        return "Instituição Financeira";
      case "ASSESSORIA":
        return "Assessoria Jurídica";
      case "GUINCHEIRO":
        return "Guincheiro";
      default:
        return "Localizador";
    }
  }

  function validatePartner(input) {
    const errors = [];
    const tipo = normalizePartnerTipo(input.tipo);
    const nome = String(input.nome || "").trim();
    if (!nome) errors.push("Nome é obrigatório.");
    if (!input.tipo) errors.push("Tipo de Parceiro é obrigatório.");

    const perfil = input.perfil || {};
    const fields = fieldsForTipo(tipo);
    for (let i = 0; i < fields.length; i++) {
      const f = fields[i];
      if (!f.required) continue;
      if (f.group === "common") {
        const v = String(input[f.key] != null ? input[f.key] : "")
          .trim();
        if (!v) errors.push(f.label + " é obrigatório.");
      } else {
        const v = String(perfil[f.key] != null ? perfil[f.key] : "")
          .trim();
        if (!v) errors.push(f.label + " é obrigatório para " + tipoLabelRequired(tipo) + ".");
      }
    }

    return { ok: errors.length === 0, errors: errors };
  }

  function extractPartnerMeta(observacoes) {
    const s = String(observacoes || "");
    const m = s.match(PARTNER_META_RE);
    if (!m) return { cleanObs: s, meta: null };
    let meta = null;
    try {
      meta = JSON.parse(m[1]);
    } catch (_e) {
      meta = null;
    }
    return { cleanObs: s.replace(PARTNER_META_RE, "").trim(), meta: meta };
  }

  function packPartnerMeta(payload, meta) {
    const baseObs = String(payload.observacoes || "").replace(PARTNER_META_RE, "").trim();
    const metaStr = "[[partnermeta:" + JSON.stringify(meta) + "]]";
    return Object.assign({}, payload, {
      observacoes: (metaStr + (baseObs ? " " + baseObs : "")).trim() || null,
    });
  }

  function normalizePartnerRecord(raw) {
    if (!raw) return {};
    const extracted = extractPartnerMeta(raw.observacoes);
    const meta = extracted.meta || {};
    const perfil = parseJsonField(raw.perfil, {});
    const contatos = asArray(parseJsonField(raw.contatos, []));
    const documentos = asArray(parseJsonField(raw.documentos, []));
    const historico = asArray(parseJsonField(raw.historico, []));

    return Object.assign({}, raw, {
      tipo: normalizePartnerTipo(raw.tipo),
      status: String(raw.status || "ATIVO").toUpperCase() === "INATIVO" ? "INATIVO" : "ATIVO",
      observacoes: extracted.cleanObs || null,
      perfil: Object.keys(perfil).length ? perfil : meta.perfil || {},
      contatos: contatos.length ? contatos : asArray(meta.contatos),
      documentos: documentos.length ? documentos : asArray(meta.documentos),
      historico: historico.length ? historico : asArray(meta.historico),
      telefone: raw.telefone || raw.contato || "",
    });
  }

  function filterPartners(list, filtersIn) {
    const f = Object.assign({}, DEFAULT_PARTNER_FILTERS, filtersIn || {});
    const q = String(f.search || "")
      .trim()
      .toLowerCase();
    const qDigits = digits(q);
    return (list || [])
      .map(normalizePartnerRecord)
      .filter(function (p) {
        if (f.tipo && normalizePartnerTipo(p.tipo) !== normalizePartnerTipo(f.tipo)) return false;
        if (f.cidade && String(p.cidade || "").toLowerCase() !== f.cidade.toLowerCase()) return false;
        if (f.estado && String(p.estado || "").toUpperCase() !== f.estado.toUpperCase()) return false;
        if (f.status && String(p.status || "ATIVO").toUpperCase() !== f.status.toUpperCase()) return false;
        if (!q) return true;
        const tLabel = partnerTipoLabel(p.tipo).toLowerCase();
        const hay =
          String(p.nome || "") +
          " " +
          String(p.cpf || "") +
          " " +
          String(p.cidade || "") +
          " " +
          String(p.telefone || "") +
          " " +
          String(p.whatsapp || "") +
          " " +
          String(p.contato || "") +
          " " +
          String(p.tipo || "") +
          " " +
          tLabel;
        const hayLower = hay.toLowerCase();
        const hayDigits = digits(String(p.cpf || "") + String(p.telefone || "") + String(p.whatsapp || ""));
        return hayLower.indexOf(q) >= 0 || (!!qDigits && hayDigits.indexOf(qDigits) >= 0);
      });
  }

  function formatRelativeDay(iso) {
    if (!iso) return "—";
    const ymd = iso.slice(0, 10);
    const today = new Date();
    const t =
      today.getFullYear() +
      "-" +
      String(today.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(today.getDate()).padStart(2, "0");
    if (ymd === t) return "Hoje";
    const d = new Date(ymd + "T12:00:00");
    const yest = new Date(today);
    yest.setDate(yest.getDate() - 1);
    const y =
      yest.getFullYear() +
      "-" +
      String(yest.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(yest.getDate()).padStart(2, "0");
    if (ymd === y) return "Ontem";
    if (Number.isNaN(d.getTime())) return ymd;
    return d.toLocaleDateString("pt-BR");
  }

  function buildPartnerSummary(partner, ctx) {
    ctx = ctx || {};
    const p = normalizePartnerRecord(partner);
    const pid = String(p.id || "");
    const vehicles = ctx.vehicles || [];
    const linked = vehicles.filter(function (v) {
      return (
        String(v.localizador_id || "") === pid ||
        String(v.leiloeiro_id || "") === pid ||
        String(v.responsavel_financeiro_id || "") === pid
      );
    });
    const ativos = linked.filter(function (v) {
      return String(v.status || "").toUpperCase() !== "REMOVIDO";
    }).length;
    const year = String(ctx.asOfYmd || new Date().toISOString().slice(0, 10)).slice(0, 4);
    const vIds = new Set(linked.map(function (v) {
      return String(v.id);
    }));
    let receitaAno = 0;
    for (let i = 0; i < (ctx.receivables || []).length; i++) {
      const r = ctx.receivables[i];
      if (!r.vehicle_id || !vIds.has(String(r.vehicle_id))) continue;
      if (String(r.status || "").toUpperCase() !== "PAGO") continue;
      const ref = String(r.period_end || r.updated_at || "");
      if (ref.slice(0, 4) === year) receitaAno += Number(r.valor || 0);
    }
    let ultima = "";
    for (let j = 0; j < linked.length; j++) {
      const v = linked[j];
      const cand = v.data_saida || v.data_entrada || v.updated_at || "";
      if (cand && cand > ultima) ultima = cand;
    }
    return {
      nome: String(p.nome || "—"),
      tipoLabel: partnerTipoLabel(p.tipo),
      veiculosAtivos: ativos,
      receitaAno: receitaAno,
      ultimaMovimentacao: formatRelativeDay(ultima),
      status: String(p.status || "ATIVO"),
    };
  }

  function pushHistorico(hist, item) {
    const now = new Date();
    const data = item.data || now.toLocaleDateString("pt-BR");
    const hora =
      item.hora ||
      now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const entry = {
      id: "h_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
      acao: item.acao,
      detalhe: item.detalhe,
      usuario: item.usuario,
      data: data,
      hora: hora,
    };
    return [entry].concat(asArray(hist)).slice(0, 200);
  }

  function toDbPayload(input, userId) {
    const tipo = normalizePartnerTipo(input.tipo);
    const status = String(input.status || "ATIVO").toUpperCase() === "INATIVO" ? "INATIVO" : "ATIVO";
    const telefone = String(input.telefone || input.contato || "").trim();
    return {
      user_id: userId,
      nome: String(input.nome || "").trim() || null,
      tipo: tipo,
      cpf: String(input.cpf || "").trim() || null,
      email: String(input.email || "").trim() || null,
      contato: telefone || null,
      telefone: telefone || null,
      whatsapp: String(input.whatsapp || "").trim() || null,
      cep: String(input.cep || "").trim() || null,
      endereco: String(input.endereco || "").trim() || null,
      numero: String(input.numero || "").trim() || null,
      complemento: String(input.complemento || "").trim() || null,
      bairro: String(input.bairro || "").trim() || null,
      cidade: String(input.cidade || "").trim() || null,
      estado: String(input.estado || "").trim().toUpperCase() || null,
      status: status,
      observacoes: String(input.observacoes || "").trim() || null,
      perfil: input.perfil || {},
      contatos: input.contatos || [],
      documentos: input.documentos || [],
      historico: input.historico || [],
    };
  }

  function isSchemaColumnError(err) {
    const msg = String((err && err.message) || err || "");
    return /column|schema cache|PGRST204/i.test(msg);
  }

  function omitKeys(obj, keys) {
    const out = Object.assign({}, obj);
    for (let i = 0; i < keys.length; i++) {
      delete out[keys[i]];
    }
    return out;
  }

  function buildLeanPayloadWithMeta(fullPayload) {
    const meta = {
      perfil: fullPayload.perfil || {},
      contatos: fullPayload.contatos || [],
      documentos: fullPayload.documentos || [],
      historico: fullPayload.historico || [],
    };
    const lean = omitKeys(fullPayload, JSONB_KEYS);
    return packPartnerMeta(lean, meta);
  }

  function buildMinimalPayload(payload) {
    return {
      user_id: payload.user_id,
      nome: payload.nome,
      cpf: payload.cpf,
      email: payload.email,
      contato: payload.contato,
      tipo: payload.tipo,
      status: payload.status || "ATIVO",
    };
  }

  function buildMinimalPayloadWithMeta(payload) {
    const meta = extractPartnerMeta(payload.observacoes).meta;
    if (!meta) return buildMinimalPayload(payload);
    const packed = packPartnerMeta(buildMinimalPayload(payload), meta);
    return omitKeys(packed, ["observacoes"]);
  }

  async function tryWrite(supabase, mode, id, payload) {
    if (mode === "insert") {
      return supabase.from("partners").insert(payload).select().single();
    }
    return supabase.from("partners").update(payload).eq("id", id).select().single();
  }

  async function persistPartner(supabase, mode, id, record, userId) {
    const dbPayload = toDbPayload(record, userId);
    let lean = false;

    let result = await tryWrite(supabase, mode, id, dbPayload);
    if (!result.error) {
      return { ok: true, data: normalizePartnerRecord(result.data), lean: lean, error: null };
    }
    if (!isSchemaColumnError(result.error)) {
      return { ok: false, data: null, lean: lean, error: result.error, errors: null };
    }

    lean = true;
    const leanMeta = buildLeanPayloadWithMeta(dbPayload);
    result = await tryWrite(supabase, mode, id, leanMeta);
    if (!result.error) {
      return { ok: true, data: normalizePartnerRecord(result.data), lean: lean, error: null };
    }
    if (!isSchemaColumnError(result.error)) {
      return { ok: false, data: null, lean: lean, error: result.error, errors: null };
    }

    const noAddress = omitKeys(leanMeta, ADDRESS_KEYS);
    result = await tryWrite(supabase, mode, id, noAddress);
    if (!result.error) {
      return { ok: true, data: normalizePartnerRecord(result.data), lean: lean, error: null };
    }
    if (!isSchemaColumnError(result.error)) {
      return { ok: false, data: null, lean: lean, error: result.error, errors: null };
    }

    const minimal = buildMinimalPayloadWithMeta(leanMeta);
    result = await tryWrite(supabase, mode, id, minimal);
    if (!result.error) {
      return { ok: true, data: normalizePartnerRecord(result.data), lean: lean, error: null };
    }

    return { ok: false, data: null, lean: lean, error: result.error, errors: null };
  }

  async function CreatePartner(supabase, userId, payload, opts) {
    opts = opts || {};
    const validation = validatePartner(payload);
    if (!validation.ok) {
      return { ok: false, errors: validation.errors, lean: false, data: null, error: null };
    }

    const record = Object.assign({}, payload);
    record.historico = pushHistorico(record.historico, {
      acao: (opts.historico && opts.historico.acao) || "Cadastro",
      detalhe: (opts.historico && opts.historico.detalhe) || "Parceiro criado",
      usuario: opts.userEmail || (opts.historico && opts.historico.usuario),
    });

    return persistPartner(supabase, "insert", null, record, userId);
  }

  async function UpdatePartner(supabase, userId, id, payload, opts) {
    opts = opts || {};
    const validation = validatePartner(payload);
    if (!validation.ok) {
      return { ok: false, errors: validation.errors, lean: false, data: null, error: null };
    }

    const record = Object.assign({}, payload);
    record.historico = pushHistorico(record.historico, {
      acao: (opts.historico && opts.historico.acao) || "Atualização",
      detalhe: (opts.historico && opts.historico.detalhe) || "Dados alterados",
      usuario: opts.userEmail || (opts.historico && opts.historico.usuario),
    });

    return persistPartner(supabase, "update", id, record, userId);
  }

  function resolvePartnerList(listOrState) {
    if (!listOrState) return [];
    if (Array.isArray(listOrState)) return listOrState;
    if (Array.isArray(listOrState.partners)) return listOrState.partners;
    return [];
  }

  function GetPartner(listOrState, id) {
    const list = resolvePartnerList(listOrState);
    const found = list.find(function (p) {
      return String(p.id) === String(id);
    });
    return found ? normalizePartnerRecord(found) : null;
  }

  function ListPartners(list, filters) {
    return filterPartners(resolvePartnerList(list), filters);
  }

  const partnersCadastroService = {
    PARTNER_TIPOS: PARTNER_TIPOS,
    DEFAULT_PARTNER_FILTERS: DEFAULT_PARTNER_FILTERS,
    UF_OPTIONS: UF_OPTIONS,
    COMMON_FIELDS: COMMON_FIELDS,
    TIPO_FIELDS: TIPO_FIELDS,
    normalizePartnerTipo: normalizePartnerTipo,
    partnerTipoLabel: partnerTipoLabel,
    partnerTipoBadge: partnerTipoBadge,
    fieldsForTipo: fieldsForTipo,
    validatePartner: validatePartner,
    filterPartners: filterPartners,
    normalizePartnerRecord: normalizePartnerRecord,
    buildPartnerSummary: buildPartnerSummary,
    pushHistorico: pushHistorico,
    toDbPayload: toDbPayload,
    CreatePartner: CreatePartner,
    UpdatePartner: UpdatePartner,
    GetPartner: GetPartner,
    ListPartners: ListPartners,
    extractPartnerMeta: extractPartnerMeta,
    packPartnerMeta: packPartnerMeta,
  };

  global.PARTNER_TIPOS = PARTNER_TIPOS;
  global.DEFAULT_PARTNER_FILTERS = DEFAULT_PARTNER_FILTERS;
  global.UF_OPTIONS = UF_OPTIONS;
  global.normalizePartnerTipo = normalizePartnerTipo;
  global.partnerTipoLabel = partnerTipoLabel;
  global.partnerTipoBadge = partnerTipoBadge;
  global.fieldsForTipo = fieldsForTipo;
  global.validatePartner = validatePartner;
  global.filterPartners = filterPartners;
  global.normalizePartnerRecord = normalizePartnerRecord;
  global.buildPartnerSummary = buildPartnerSummary;
  global.pushHistorico = pushHistorico;
  global.toDbPayload = toDbPayload;
  global.CreatePartner = CreatePartner;
  global.UpdatePartner = UpdatePartner;
  global.GetPartner = GetPartner;
  global.ListPartners = ListPartners;
  global.partnersCadastroService = partnersCadastroService;
})(typeof window !== "undefined" ? window : globalThis);

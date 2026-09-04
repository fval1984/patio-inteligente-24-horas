/**
 * Escritórios de advocacia — serviço (cadastro, vínculo e relatório de demanda).
 * Demanda = tabela vehicles. O vínculo é vehicles.advocacy_office_id (UUID).
 */
(function advocacyOfficesServiceModule(global) {
  "use strict";

  const STATUS_LABELS = {
    AGUARDANDO_VISTORIA: "Aguardando vistoria",
    NO_PATIO: "No pátio (VNP)",
    LIBERACAO_SOLICITADA: "Liberação solicitada",
    LIBERACAO_CONFIRMADA: "Liberação confirmada",
    REMocao_CONFIRMADA: "Remoção solicitada (legado)",
    REMOVIDO: "Baixado (VRP)",
  };

  const MONTH_NAMES = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];

  function digits(v) {
    return String(v || "").replace(/\D/g, "");
  }

  function formatCnpj(v) {
    const d = digits(v).slice(0, 14);
    if (d.length !== 14) return d;
    return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }

  function isCalendarYmd(v) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(v || "").trim());
  }

  function toLocalYmd(value) {
    if (!value) return null;
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) return null;
      const y = value.getFullYear();
      const m = String(value.getMonth() + 1).padStart(2, "0");
      const d = String(value.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    const s = String(value).trim();
    if (isCalendarYmd(s)) return s;
    const d = new Date(s.includes("T") ? s : `${s.slice(0, 10)}T12:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    return toLocalYmd(d);
  }

  function ymdToDate(ymd) {
    return new Date(`${ymd}T12:00:00`);
  }

  function addDaysYmd(ymd, days) {
    const d = ymdToDate(ymd);
    d.setDate(d.getDate() + days);
    return toLocalYmd(d);
  }

  function todayYmd() {
    return toLocalYmd(new Date());
  }

  function statusUpper(v) {
    return String(v?.status || "").toUpperCase();
  }

  function isRemoved(v) {
    return statusUpper(v) === "REMOVIDO";
  }

  function isOnPatio(v) {
    return !isRemoved(v);
  }

  function isPending(v) {
    const s = String(v?.status || "");
    if (s === "AGUARDANDO_VISTORIA" || s === "LIBERACAO_SOLICITADA") return true;
    if (v?.pending_adm_review === true) return true;
    return false;
  }

  function statusLabel(v) {
    const s = String(v?.status || "");
    if (v?.pending_adm_review) return "Aguardando revisão do ADM";
    if (STATUS_LABELS[s]) return STATUS_LABELS[s];
    if (s) return s;
    return "—";
  }

  function stayDays(v, endYmd) {
    const ent = toLocalYmd(v?.data_entrada);
    if (!ent) return 0;
    const end = v?.data_saida ? toLocalYmd(v.data_saida) : endYmd || todayYmd();
    if (!end || end < ent) return 0;
    return Math.max(1, Math.ceil((ymdToDate(end).getTime() - ymdToDate(ent).getTime()) / 86400000));
  }

  function resolveTipoVeiculo(v) {
    if (v?.tipo_veiculo && String(v.tipo_veiculo).trim()) return String(v.tipo_veiculo).trim();
    const hay = `${v?.marca || ""} ${v?.modelo || ""}`.toLowerCase();
    if (/moto|motocic|scooter|cg\s|biz\s|pop\s|yamaha|honda\s*cg|harley/.test(hay)) return "Moto";
    if (/caminh[aã]o|truck|hr\s|iveco|volvo\s*fh|scania|mercedes\s*actros/.test(hay)) return "Caminhão";
    if (/utilit|van\s|sprinter|master|ducato|kombi|fiorino|saveiro|strada|montana/.test(hay)) return "Utilitário";
    if (hay.trim()) return "Automóvel";
    return "Não informado";
  }

  function hasVistoria(v, inspectionIndex) {
    if (inspectionIndex && v?.id && inspectionIndex[v.id]) return true;
    const c = v?.vistoria_checklist || {};
    return !!(
      v?.vistoria_data ||
      v?.vistoria_responsavel ||
      v?.vistoria_km ||
      v?.vistoria_combustivel ||
      v?.vistoria_observacoes ||
      c.documento ||
      c.chave ||
      c.estepe ||
      c.triangulo_macaco
    );
  }

  function vistoriaLabel(v, inspectionIndex) {
    return hasVistoria(v, inspectionIndex) ? "Vistoriado" : "Aguardando vistoria";
  }

  function situationKey(v, inspectionIndex) {
    const s = String(v?.status || "");
    if (s === "REMOVIDO") return "baixado";
    if (s === "AGUARDANDO_VISTORIA") return "aguardando_vistoria";
    if (s === "LIBERACAO_SOLICITADA") return "aguardando_retirada";
    if (s === "LIBERACAO_CONFIRMADA" || s === "REMocao_CONFIRMADA") return "aguardando_retirada";
    if (!hasVistoria(v, inspectionIndex)) return "aguardando_vistoria";
    if (s === "NO_PATIO") return "no_patio";
    return "outras";
  }

  const SITUATION_LABELS = {
    aguardando_entrada: "Aguardando entrada",
    no_patio: "No pátio",
    aguardando_vistoria: "Aguardando vistoria",
    vistoriado: "Vistoriado",
    aguardando_retirada: "Aguardando retirada",
    baixado: "Baixado",
    outras: "Outras situações",
  };

  function partnerMap(partners) {
    return new Map((partners || []).map((p) => [String(p.id), p]));
  }

  function financeiraId(v) {
    return String(v?.responsavel_financeiro_id || v?.localizador_id || "").trim();
  }

  function financeiraNome(v, pmap) {
    const id = financeiraId(v);
    if (id && pmap.get(id)?.nome) return pmap.get(id).nome;
    if (v?.responsavel_financeiro_nome) return v.responsavel_financeiro_nome;
    return "Sem financeira";
  }

  function formatCpf(v) {
    const d = digits(v).slice(0, 11);
    if (d.length !== 11) return d;
    return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }

  function officeName(id, offices) {
    if (!id) return "Sem escritório informado";
    const o = (offices || []).find((x) => String(x.id) === String(id));
    return o?.name || "Escritório removido";
  }

  function normalizeOfficePayload(raw) {
    const name = String(raw?.name || "").trim();
    const cnpjDigits = digits(raw?.cnpj);
    return {
      name,
      cnpj: cnpjDigits ? formatCnpj(cnpjDigits) : "",
      cnpj_digits: cnpjDigits,
      responsible_name: String(raw?.responsible_name || "").trim(),
      phone: String(raw?.phone || "").trim(),
      whatsapp: String(raw?.whatsapp || "").trim(),
      email: String(raw?.email || "").trim(),
      notes: String(raw?.notes || "").trim(),
      active: raw?.active === false || raw?.active === "INATIVO" ? false : true,
    };
  }

  function validateOffice(payload, offices, editingId) {
    const errors = [];
    if (!payload.name) errors.push("Informe o nome do escritório.");
    if (payload.cnpj_digits && payload.cnpj_digits.length !== 14) {
      errors.push("CNPJ deve ter 14 dígitos.");
    }
    if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
      errors.push("E-mail inválido.");
    }
    if (payload.cnpj_digits) {
      const dup = (offices || []).find(
        (o) =>
          String(o.id) !== String(editingId || "") &&
          digits(o.cnpj_digits || o.cnpj) === payload.cnpj_digits
      );
      if (dup) errors.push("Já existe um escritório com este CNPJ.");
    }
    return errors;
  }

  function normalizeManagerPayload(raw) {
    const cpfDigits = digits(raw?.cpf).slice(0, 11);
    return {
      name: String(raw?.name || "").trim(),
      cpf: cpfDigits ? formatCpf(cpfDigits) : "",
      cpf_digits: cpfDigits,
      phone: String(raw?.phone || "").trim(),
      email: String(raw?.email || "").trim(),
      role_title: String(raw?.role_title || "").trim(),
      notes: String(raw?.notes || "").trim(),
      active: raw?.active === false || raw?.active === "INATIVO" ? false : true,
    };
  }

  function validateManager(payload, managers, officeId, editingId) {
    const errors = [];
    if (!officeId) errors.push("Salve o escritório antes de cadastrar gestores.");
    if (!payload.name) errors.push("Informe o nome completo do gestor.");
    if (payload.cpf_digits && payload.cpf_digits.length !== 11) {
      errors.push("CPF deve ter 11 dígitos.");
    }
    if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
      errors.push("E-mail inválido.");
    }
    if (payload.cpf_digits) {
      const dup = (managers || []).find(
        (m) =>
          String(m.id) !== String(editingId || "") &&
          digits(m.cpf_digits || m.cpf) === payload.cpf_digits
      );
      if (dup) errors.push("Já existe um gestor de carteira com este CPF.");
    }
    return errors;
  }

  function managersForOffice(managers, officeId) {
    const oid = String(officeId || "");
    if (!oid) return [];
    return (managers || [])
      .filter((m) => String(m.office_id) === oid)
      .slice()
      .sort((a, b) => {
        if (!!a.active !== !!b.active) return a.active ? -1 : 1;
        return String(a.name || "").localeCompare(String(b.name || ""), "pt-BR");
      });
  }

  function activeManagersForOffice(managers, officeId, keepId) {
    return managersForOffice(managers, officeId).filter(
      (m) => m.active || (keepId && String(m.id) === String(keepId))
    );
  }

  function managerName(id, managers) {
    if (!id) return "Sem gestor informado";
    const m = (managers || []).find((x) => String(x.id) === String(id));
    return m?.name || "Gestor removido";
  }

  function managerBelongsToOffice(managerId, officeId, managers) {
    if (!managerId || !officeId) return false;
    const m = (managers || []).find((x) => String(x.id) === String(managerId));
    return !!(m && String(m.office_id) === String(officeId));
  }

  function filterOffices(offices, filters) {
    const q = String(filters?.search || "")
      .trim()
      .toLowerCase();
    const st = String(filters?.status || "");
    return (offices || []).filter((o) => {
      if (st === "ATIVO" && !o.active) return false;
      if (st === "INATIVO" && o.active) return false;
      if (!q) return true;
      const hay = [o.name, o.cnpj, o.responsible_name, o.phone, o.whatsapp, o.email, o.notes]
        .map((x) => String(x || "").toLowerCase())
        .join(" ");
      return hay.includes(q);
    });
  }

  function searchOffices(offices, query, opts) {
    const q = String(query || "")
      .trim()
      .toLowerCase();
    const onlyActive = opts?.onlyActive !== false;
    let list = (offices || []).filter((o) => (onlyActive ? o.active : true));
    if (q) {
      list = list.filter((o) => {
        const hay = `${o.name || ""} ${o.cnpj || ""} ${o.responsible_name || ""}`.toLowerCase();
        return hay.includes(q);
      });
    }
    return list.slice(0, 40);
  }

  function linkedVehicleCount(vehicles, officeId) {
    return (vehicles || []).filter((v) => String(v.advocacy_office_id || "") === String(officeId)).length;
  }

  function inPeriod(v, fromYmd, toYmd) {
    const ymd = toLocalYmd(v?.data_entrada);
    if (!ymd) return false;
    if (fromYmd && ymd < fromYmd) return false;
    if (toYmd && ymd > toYmd) return false;
    return true;
  }

  function filterDemandVehicles(vehicles, partners, filters) {
    const fromYmd = filters?.from || "";
    const toYmd = filters?.to || "";
    const officeId = String(filters?.officeId || "");
    const finId = String(filters?.financeiraId || "");
    const status = String(filters?.status || "");
    const tipo = String(filters?.tipoVeiculo || "");
    const situacao = String(filters?.situacaoPatio || "");
    const pmap = partnerMap(partners);

    return (vehicles || []).filter((v) => {
      if (fromYmd || toYmd) {
        if (!inPeriod(v, fromYmd, toYmd)) return false;
      }
      if (officeId === "__sem__") {
        if (v.advocacy_office_id) return false;
      } else if (officeId && String(v.advocacy_office_id || "") !== officeId) {
        return false;
      }
      if (finId && financeiraId(v) !== finId) return false;
      if (status && String(v.status || "") !== status) return false;
      if (tipo && resolveTipoVeiculo(v) !== tipo) return false;
      if (situacao === "no_patio" && !isOnPatio(v)) return false;
      if (situacao === "baixado" && !isRemoved(v)) return false;
      if (situacao === "pendente" && !isPending(v)) return false;
      return true;
    });
  }

  function emptyKpis() {
    return { total: 0, noPatio: 0, baixados: 0, pendentes: 0, tempoMedio: 0 };
  }

  function kpisOf(list, endYmd) {
    const k = emptyKpis();
    k.total = list.length;
    k.noPatio = list.filter(isOnPatio).length;
    k.baixados = list.filter(isRemoved).length;
    k.pendentes = list.filter(isPending).length;
    const days = list.map((v) => stayDays(v, endYmd)).filter((n) => n > 0);
    k.tempoMedio = days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : 0;
    return k;
  }

  function rankingRows(vehicles, offices, partners, filters, endYmd) {
    const list = filterDemandVehicles(vehicles, partners, Object.assign({}, filters, { officeId: "" }));
    const buckets = new Map();
    const ensure = (id) => {
      const key = id || "__sem__";
      if (!buckets.has(key)) {
        buckets.set(key, {
          officeId: key === "__sem__" ? "" : key,
          nome: officeName(id, offices),
          demandas: 0,
          noPatio: 0,
          baixados: 0,
          pendentes: 0,
        });
      }
      return buckets.get(key);
    };
    list.forEach((v) => {
      const row = ensure(v.advocacy_office_id || "");
      row.demandas += 1;
      if (isOnPatio(v)) row.noPatio += 1;
      if (isRemoved(v)) row.baixados += 1;
      if (isPending(v)) row.pendentes += 1;
    });
    (offices || []).forEach((o) => ensure(o.id));
    const total = list.length || 1;
    const rows = Array.from(buckets.values()).map((r) =>
      Object.assign(r, { pct: Math.round((r.demandas / total) * 1000) / 10 })
    );
    rows.sort((a, b) => b.demandas - a.demandas || a.nome.localeCompare(b.nome, "pt-BR"));
    return rows.filter((r) => r.demandas > 0);
  }

  function monthlySeries(list, fromYmd, toYmd) {
    const map = new Map();
    const start = fromYmd || (list[0] && toLocalYmd(list[0].data_entrada)) || todayYmd();
    const end = toYmd || todayYmd();
    let cur = start.slice(0, 7);
    const last = end.slice(0, 7);
    while (cur <= last) {
      map.set(cur, 0);
      const [y, m] = cur.split("-").map(Number);
      const nm = m === 12 ? 1 : m + 1;
      const ny = m === 12 ? y + 1 : y;
      cur = `${ny}-${String(nm).padStart(2, "0")}`;
    }
    list.forEach((v) => {
      const ym = (toLocalYmd(v.data_entrada) || "").slice(0, 7);
      if (ym && map.has(ym)) map.set(ym, (map.get(ym) || 0) + 1);
    });
    return Array.from(map.entries()).map(([ym, count]) => {
      const month = Number(ym.slice(5, 7));
      return { ym, label: MONTH_NAMES[month - 1] || ym, count };
    });
  }

  function byFinanceira(list, partners) {
    const pmap = partnerMap(partners);
    const map = new Map();
    list.forEach((v) => {
      const nome = financeiraNome(v, pmap);
      map.set(nome, (map.get(nome) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([nome, quantidade]) => ({ nome, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome, "pt-BR"));
  }

  function bySituacao(list, inspectionIndex) {
    const keys = [
      "aguardando_vistoria",
      "no_patio",
      "aguardando_retirada",
      "baixado",
      "outras",
    ];
    const counts = {};
    keys.forEach((k) => {
      counts[k] = 0;
    });
    let vistoriado = 0;
    list.forEach((v) => {
      const k = situationKey(v, inspectionIndex);
      counts[k] = (counts[k] || 0) + 1;
      if (hasVistoria(v, inspectionIndex) && !isRemoved(v)) vistoriado += 1;
    });
    const out = keys.map((k) => ({ key: k, label: SITUATION_LABELS[k], quantidade: counts[k] || 0 }));
    out.splice(2, 0, { key: "vistoriado", label: SITUATION_LABELS.vistoriado, quantidade: vistoriado });
    return out.filter((x) => x.quantidade > 0 || x.key !== "outras");
  }

  function chartRange(preset, customFrom, customTo) {
    const asOf = todayYmd();
    const y = asOf.slice(0, 4);
    if (preset === "6m") return { from: addDaysYmd(asOf, -182), to: asOf, label: "Últimos 6 meses" };
    if (preset === "12m") return { from: addDaysYmd(asOf, -364), to: asOf, label: "Últimos 12 meses" };
    if (preset === "year") return { from: `${y}-01-01`, to: asOf, label: "Ano atual" };
    if (preset === "custom" && customFrom && customTo) {
      return { from: customFrom, to: customTo, label: "Período personalizado" };
    }
    return { from: addDaysYmd(asOf, -182), to: asOf, label: "Últimos 6 meses" };
  }

  function uniqueTipos(vehicles) {
    const set = new Set();
    (vehicles || []).forEach((v) => set.add(resolveTipoVeiculo(v)));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }

  function uniqueStatuses(vehicles) {
    const set = new Set();
    (vehicles || []).forEach((v) => {
      if (v?.status) set.add(String(v.status));
    });
    return Array.from(set).sort((a, b) =>
      (STATUS_LABELS[a] || a).localeCompare(STATUS_LABELS[b] || b, "pt-BR")
    );
  }

  function computeReport(input) {
    const vehicles = input.vehicles || [];
    const offices = input.offices || [];
    const partners = input.partners || [];
    const filters = input.filters || {};
    const inspectionIndex = input.inspectionIndex || {};
    const endYmd = filters.to || todayYmd();
    const list = filterDemandVehicles(vehicles, partners, filters);
    const kpis = kpisOf(list, endYmd);
    const ranking = rankingRows(vehicles, offices, partners, filters, endYmd);
    const chart = monthlySeries(list, filters.from, filters.to);
    const financeiras = byFinanceira(list, partners);
    const situacoes = bySituacao(list, inspectionIndex);
    const pmap = partnerMap(partners);
    const detail = list
      .slice()
      .sort((a, b) => String(b.data_entrada || "").localeCompare(String(a.data_entrada || "")))
      .map((v) => ({
        id: v.id,
        dataEntrada: v.data_entrada,
        veiculo: [v.marca, v.modelo].filter(Boolean).join(" ") || "—",
        placa: v.placa || "—",
        financeira: financeiraNome(v, pmap),
        status: statusLabel(v),
        statusRaw: v.status,
        dataBaixa: v.data_saida || "",
        dias: stayDays(v, endYmd),
        situacao: SITUATION_LABELS[situationKey(v, inspectionIndex)] || statusLabel(v),
        vistoria: vistoriaLabel(v, inspectionIndex),
        observacoes: String(v.observacoes || "").trim(),
        officeId: v.advocacy_office_id || "",
        officeName: officeName(v.advocacy_office_id, offices),
      }));
    return { kpis, ranking, chart, financeiras, situacoes, detail, total: list.length };
  }

  function defaultPeriod() {
    const to = todayYmd();
    const from = `${to.slice(0, 4)}-01-01`;
    return { from, to };
  }

  global.advocacyOfficesService = {
    digits,
    formatCnpj,
    formatCpf,
    toLocalYmd,
    todayYmd,
    STATUS_LABELS,
    SITUATION_LABELS,
    statusLabel,
    stayDays,
    resolveTipoVeiculo,
    officeName,
    managerName,
    normalizeOfficePayload,
    validateOffice,
    normalizeManagerPayload,
    validateManager,
    managersForOffice,
    activeManagersForOffice,
    managerBelongsToOffice,
    filterOffices,
    searchOffices,
    linkedVehicleCount,
    filterDemandVehicles,
    computeReport,
    rankingRows,
    chartRange,
    uniqueTipos,
    uniqueStatuses,
    defaultPeriod,
    financeiraNome,
    kpisOf,
  };
})(typeof window !== "undefined" ? window : globalThis);

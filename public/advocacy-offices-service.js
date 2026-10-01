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

  /** Mesma etapa do pátio: VNP → VSL → VSC → VRP. Não altera o status gravado. */
  function flowStage(v) {
    const s = statusUpper(v);
    if (s === "REMOVIDO") return { code: "VRP", label: "Retirado do Pátio" };
    if (s === "LIBERACAO_SOLICITADA") return { code: "VSL", label: "Solicitação de Liberação" };
    if (s === "LIBERACAO_CONFIRMADA" || s === "REMOCAO_CONFIRMADA") {
      return { code: "VSC", label: "Liberação Confirmada" };
    }
    return { code: "VNP", label: "No Pátio" };
  }

  const FLOW_STAGE_CODES = { VNP: true, VSL: true, VSC: true, VRP: true };

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
      trade_name: String(raw?.trade_name || "").trim(),
      address: String(raw?.address || "").trim(),
      city: String(raw?.city || "").trim(),
      state: String(raw?.state || "").trim().toUpperCase(),
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
      whatsapp: String(raw?.whatsapp || "").trim(),
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
      const gestores = (global.__ampliState?.advocacyOfficeManagers || [])
        .filter((m) => String(m.office_id) === String(o.id))
        .map((m) => m.name);
      const hay = [o.name, o.cnpj, o.responsible_name, o.phone, o.whatsapp, o.email, o.notes, o.city, o.trade_name]
        .concat(gestores)
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
        const gestores = (global.__ampliState?.advocacyOfficeManagers || [])
          .filter((m) => String(m.office_id) === String(o.id))
          .map((m) => m.name || "")
          .join(" ");
        const hay = `${o.name || ""} ${o.cnpj || ""} ${o.responsible_name || ""} ${gestores}`.toLowerCase();
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
      if (status) {
        if (FLOW_STAGE_CODES[status]) {
          if (flowStage(v).code !== status) return false;
        } else if (String(v.status || "") !== status) return false;
      }
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

  function blankText(value) {
    const s = String(value == null ? "" : value).trim();
    return s;
  }

  function roundMoney(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return 0;
    return Math.round(x * 100) / 100;
  }

  function addMoney(a, b) {
    return roundMoney(roundMoney(a) + roundMoney(b));
  }

  /** Permanência cruza o período: entrou até o fim e (saiu a partir do início ou ainda está). */
  function stayOverlapsPeriod(v, fromYmd, toYmd) {
    if (!fromYmd && !toYmd) return true;
    const ent = toLocalYmd(v?.data_entrada);
    if (!ent) return false;
    const saida = toLocalYmd(v?.data_saida);
    const end = saida || "9999-12-31";
    const start = fromYmd || "0000-01-01";
    const finish = toYmd || "9999-12-31";
    return ent <= finish && end >= start;
  }

  function ymdInRange(ymd, fromYmd, toYmd) {
    if (!fromYmd && !toYmd) return true;
    if (!ymd) return false;
    if (fromYmd && ymd < fromYmd) return false;
    if (toYmd && ymd > toYmd) return false;
    return true;
  }

  function partnerNomeById(id, partners) {
    if (!id) return "";
    const p = (partners || []).find((x) => String(x.id) === String(id));
    return blankText(p?.nome);
  }

  function rppRpvText(v, partners) {
    const rpv = partnerNomeById(v?.localizador_id, partners);
    const rppId = blankText(v?.responsavel_financeiro_id || v?.localizador_id);
    const rpp = rppId
      ? partnerNomeById(rppId, partners) || blankText(v?.responsavel_financeiro_nome)
      : "";
    if (rpp && rpv && rpp !== rpv) return `RPP: ${rpp} · RPV: ${rpv}`;
    if (rpp && rpv) return `RPP/RPV: ${rpp}`;
    if (rpp) return `RPP: ${rpp}`;
    if (rpv) return `RPV: ${rpv}`;
    return "";
  }

  function hasDailyRate(v) {
    if (v?.valor_diaria == null || v.valor_diaria === "") return false;
    return Number.isFinite(Number(v.valor_diaria));
  }

  function estadiaValor(v, endYmd) {
    if (!hasDailyRate(v) || !toLocalYmd(v?.data_entrada)) return null;
    return roundMoney(stayDays(v, endYmd) * Number(v.valor_diaria));
  }

  function cleanNotes(value) {
    return String(value || "")
      .replace(/\[\[finmeta:[\s\S]*?\]\]/g, "")
      .replace(/\[\[partnermeta:[\s\S]*?\]\]/g, "")
      .trim();
  }

  function officeCnpjText(office) {
    if (!office) return "";
    const raw = blankText(office.cnpj || office.cnpj_digits);
    const d = digits(raw);
    if (d.length === 14) return formatCnpj(d);
    return raw;
  }

  function linkedManagersLabel(managers, officeId) {
    const list = managersForOffice(managers, officeId);
    if (!list.length) return "";
    return list
      .map((m) => {
        const name = blankText(m.name);
        if (!name) return "";
        return m.active === false ? `${name} (inativo)` : name;
      })
      .filter(Boolean)
      .join(", ");
  }

  function emptyFinance() {
    return {
      estadia: null,
      faturadoValor: 0,
      recebido: 0,
      aberto: 0,
      vencido: 0,
      faturado: false,
      faturamentoLabel: "Não faturado",
      pagamentoKey: "",
      pagamentoLabel: "—",
      faturadoEm: [],
      pagoEm: [],
      lancamentos: [],
      openCount: 0,
      paidCount: 0,
    };
  }

  function financeOfVehicle(v, receivables, classifyReceivable) {
    const fin = emptyFinance();
    const recs = (receivables || []).filter((r) => String(r?.vehicle_id || "") === String(v?.id || ""));
    if (!classifyReceivable || !recs.length) return fin;
    recs.forEach((r) => {
      let info = null;
      try {
        info = classifyReceivable(r, v);
      } catch (_e) {
        info = null;
      }
      if (!info || info.skip) return;
      const valor = roundMoney(info.valor != null ? info.valor : r.valor || 0);
      const billed = !!info.billed;
      const received = !!info.received;
      if (billed || received) {
        fin.faturado = true;
        fin.faturadoValor = addMoney(fin.faturadoValor, valor);
      }
      if (received) {
        fin.recebido = addMoney(fin.recebido, valor);
        fin.paidCount += 1;
      } else if (billed) {
        fin.aberto = addMoney(fin.aberto, valor);
        fin.openCount += 1;
        if (info.overdue) fin.vencido = addMoney(fin.vencido, valor);
      }
      const fat = blankText(info.faturadoEm);
      const pago = blankText(info.pagoEm);
      if (fat && fin.faturadoEm.indexOf(fat) < 0) fin.faturadoEm.push(fat);
      if (pago && received && fin.pagoEm.indexOf(pago) < 0) fin.pagoEm.push(pago);
      fin.lancamentos.push({
        valor,
        billed: billed || received,
        received,
        faturadoEm: fat,
        pagoEm: received ? pago : "",
      });
    });
    fin.faturamentoLabel = fin.faturado ? "Faturado" : "Não faturado";
    if (fin.vencido > 0) fin.pagamentoKey = "vencido";
    else if (fin.aberto > 0) fin.pagamentoKey = "aberto";
    else if (fin.recebido > 0) fin.pagamentoKey = "pago";
    fin.pagamentoLabel =
      fin.pagamentoKey === "pago"
        ? "Pago"
        : fin.pagamentoKey === "aberto"
          ? "Em aberto"
          : fin.pagamentoKey === "vencido"
            ? "Vencido"
            : "—";
    fin.faturadoEm.sort();
    fin.pagoEm.sort();
    return fin;
  }

  function vehiclePassesFinanceFilters(fin, filters) {
    const fat = String(filters?.faturamento || "");
    if (fat === "faturado" && !fin.faturado) return false;
    if (fat === "nao_faturado" && fin.faturado) return false;
    const pay = String(filters?.pagamento || "");
    if (pay && fin.pagamentoKey !== pay) return false;
    return true;
  }

  function filterOfficeReportVehicles(vehicles, partners, filters) {
    const officeId = String(filters?.officeId || "");
    const managerId = String(filters?.managerId || "");
    const patioId = String(filters?.patioId || "");
    const finId = String(filters?.financeiraId || "");
    const status = String(filters?.status || "");
    const tipo = String(filters?.tipoVeiculo || "");
    const situacao = String(filters?.situacaoPatio || "");
    return (vehicles || []).filter((v) => {
      if (officeId === "__sem__") {
        if (v?.advocacy_office_id) return false;
      } else if (officeId && String(v?.advocacy_office_id || "") !== officeId) {
        return false;
      }
      if (!stayOverlapsPeriod(v, filters?.from || "", filters?.to || "")) return false;
      if (
        (filters?.entradaFrom || filters?.entradaTo) &&
        !ymdInRange(toLocalYmd(v?.data_entrada), filters.entradaFrom || "", filters.entradaTo || "")
      ) {
        return false;
      }
      if (
        (filters?.saidaFrom || filters?.saidaTo) &&
        !ymdInRange(toLocalYmd(v?.data_saida), filters.saidaFrom || "", filters.saidaTo || "")
      ) {
        return false;
      }
      if (managerId && String(v?.advocacy_office_manager_id || "") !== managerId) return false;
      if (patioId && String(v?.patio_parceiro_id || "") !== patioId) return false;
      if (finId && financeiraId(v) !== finId) return false;
      if (status) {
        if (FLOW_STAGE_CODES[status]) {
          if (flowStage(v).code !== status) return false;
        } else if (String(v?.status || "") !== status) return false;
      }
      if (tipo && resolveTipoVeiculo(v) !== tipo) return false;
      if (situacao === "no_patio" && !isOnPatio(v)) return false;
      if (situacao === "baixado" && !isRemoved(v)) return false;
      if (situacao === "pendente" && !isPending(v)) return false;
      return true;
    });
  }

  /**
   * Relatório detalhado de um escritório.
   * Valores financeiros só entram pelo classificador (títulos já gravados).
   * A estadia é dias de permanência × valor_diaria já cadastrado. Sem diária, o valor fica vazio.
   */
  function buildOfficeReport(input) {
    const filters = input?.filters || {};
    const offices = input?.offices || [];
    const partners = input?.partners || [];
    const managers = input?.managers || [];
    const eventsByVehicle = input?.eventsByVehicle || {};
    const endYmd = todayYmd();
    const officeId = String(filters.officeId || "");
    const office =
      officeId && officeId !== "__sem__"
        ? (offices || []).find((o) => String(o.id) === officeId) || null
        : null;
    const candidates = filterOfficeReportVehicles(input?.vehicles || [], partners, filters);
    const rows = [];
    candidates.forEach((v) => {
      const stage = flowStage(v);
      const fin = financeOfVehicle(v, input?.receivables || [], input?.classifyReceivable);
      if (!vehiclePassesFinanceFilters(fin, filters)) return;
      const ev = eventsByVehicle[String(v.id)] || {};
      const gestorId = v.advocacy_office_manager_id || "";
      const patioNome = partnerNomeById(v.patio_parceiro_id, partners) || blankText(input?.patioFallbackName);
      const dias = stayDays(v, endYmd);
      const estadia = estadiaValor(v, endYmd);
      fin.estadia = estadia;
      rows.push({
        id: v.id,
        rppRpv: rppRpvText(v, partners),
        placa: blankText(v.placa),
        veiculo: [v.marca, v.modelo].filter(Boolean).join(" ").trim(),
        cor: blankText(v.cor),
        parceiro: partnerNomeById(v.localizador_id, partners),
        escritorio: officeId === "__sem__" ? "" : officeName(v.advocacy_office_id, offices),
        gestor: gestorId ? managerName(gestorId, managers) : "",
        patio: v.patio_parceiro_id ? partnerNomeById(v.patio_parceiro_id, partners) : patioNome,
        dataEntrada: toLocalYmd(v.data_entrada) || "",
        dataSolicitacao: blankText(ev.solicitacao),
        dataConfirmacao: blankText(ev.confirmacao),
        dataSaida: toLocalYmd(v.data_saida) || blankText(ev.retirada),
        dias,
        valorDiaria: hasDailyRate(v) ? roundMoney(v.valor_diaria) : null,
        estadia,
        stageCode: stage.code,
        stageLabel: stage.label,
        situacao: `${stage.code} — ${stage.label}`,
        faturamento: fin.faturamentoLabel,
        pagamento: fin.pagamentoLabel,
        pagamentoKey: fin.pagamentoKey,
        faturado: fin.faturado,
        faturadoEm: fin.faturadoEm.slice(),
        pagoEm: fin.pagoEm.slice(),
        lancamentos: fin.lancamentos.slice(),
        faturadoValor: fin.faturadoValor,
        recebido: fin.recebido,
        aberto: fin.aberto,
        vencido: fin.vencido,
        openCount: fin.openCount,
        paidCount: fin.paidCount,
        observacoes: cleanNotes(v.observacoes),
      });
    });
    rows.sort((a, b) => String(b.dataEntrada || "").localeCompare(String(a.dataEntrada || "")) || String(a.placa).localeCompare(String(b.placa), "pt-BR"));

    const summary = {
      veiculos: rows.length,
      noPatio: rows.filter((r) => r.stageCode !== "VRP").length,
      vsl: rows.filter((r) => r.stageCode === "VSL").length,
      vsc: rows.filter((r) => r.stageCode === "VSC").length,
      retirados: rows.filter((r) => r.stageCode === "VRP").length,
      diarias: rows.reduce((s, r) => s + (Number(r.dias) || 0), 0),
      estadia: null,
      faturado: 0,
      recebido: 0,
      aberto: 0,
      vencido: 0,
      semDiaria: rows.filter((r) => r.estadia == null).length,
      registrosAbertos: 0,
      registrosPagos: 0,
    };
    let estadiaSum = 0;
    let estadiaAny = false;
    rows.forEach((r) => {
      if (r.estadia != null) {
        estadiaAny = true;
        estadiaSum = addMoney(estadiaSum, r.estadia);
      }
      summary.faturado = addMoney(summary.faturado, r.faturadoValor);
      summary.recebido = addMoney(summary.recebido, r.recebido);
      summary.aberto = addMoney(summary.aberto, r.aberto);
      summary.vencido = addMoney(summary.vencido, r.vencido);
      summary.registrosAbertos += r.openCount || 0;
      summary.registrosPagos += r.paidCount || 0;
    });
    summary.estadia = estadiaAny ? estadiaSum : rows.length ? null : 0;

    const insights = officeReportInsights({ filters, vehicles: rows }, endYmd);
    return {
      insights,
      office: {
        id: officeId,
        name: officeId === "__sem__" ? "Sem escritório informado" : office?.name || (officeId ? "Escritório removido" : ""),
        cnpj: officeCnpjText(office),
        managers: officeId && officeId !== "__sem__" ? linkedManagersLabel(managers, officeId) : "",
      },
      filters,
      summary,
      vehicles: rows,
    };
  }

  function calendarSpanDays(startYmd, endYmd) {
    if (!startYmd || !endYmd || endYmd < startYmd) return 0;
    return Math.max(1, Math.ceil((ymdToDate(endYmd).getTime() - ymdToDate(startYmd).getTime()) / 86400000));
  }

  function eachYmd(fromYmd, toYmd, fn) {
    if (!fromYmd || !toYmd || toYmd < fromYmd) return;
    let cur = fromYmd;
    let guard = 0;
    while (cur <= toYmd && guard < 4000) {
      fn(cur);
      cur = addDaysYmd(cur, 1);
      guard += 1;
    }
  }

  const STAY_BANDS = [
    { id: "0-10", label: "0 a 10 dias", min: 1, max: 10 },
    { id: "11-20", label: "11 a 20 dias", min: 11, max: 20 },
    { id: "21-30", label: "21 a 30 dias", min: 21, max: 30 },
    { id: "31-60", label: "31 a 60 dias", min: 31, max: 60 },
    { id: "61-90", label: "61 a 90 dias", min: 61, max: 90 },
    { id: "90+", label: "Acima de 90 dias", min: 91, max: 100000 },
  ];

  function suggestOfficeBucket(fromYmd, toYmd) {
    if (!fromYmd || !toYmd || toYmd < fromYmd) return "month";
    const span = Math.round((ymdToDate(toYmd).getTime() - ymdToDate(fromYmd).getTime()) / 86400000) + 1;
    if (span <= 31) return "day";
    if (span <= 120) return "week";
    return "month";
  }

  function bucketStartYmd(ymd, mode) {
    if (!ymd) return "";
    if (mode === "month") return `${ymd.slice(0, 7)}-01`;
    if (mode === "week") {
      const day = ymdToDate(ymd).getDay();
      const back = day === 0 ? 6 : day - 1;
      return addDaysYmd(ymd, -back);
    }
    return ymd;
  }

  function bucketEndYmd(start, mode, periodEnd) {
    let end = start;
    if (mode === "month") {
      const [y, m] = start.split("-").map(Number);
      const last = new Date(y, m, 0).getDate();
      end = `${start.slice(0, 7)}-${String(last).padStart(2, "0")}`;
    } else if (mode === "week") end = addDaysYmd(start, 6);
    if (periodEnd && end > periodEnd) return periodEnd;
    return end;
  }

  function chargedDays(row) {
    const start = row?.dataEntrada || "";
    const n = Number(row?.dias) || 0;
    if (!start || n <= 0) return [];
    const out = [];
    for (let i = 0; i < n && i < 4000; i += 1) out.push(addDaysYmd(start, i));
    return out;
  }

  function inYmdWindow(ymd, fromYmd, toYmd) {
    if (!ymd) return false;
    if (fromYmd && ymd < fromYmd) return false;
    if (toYmd && ymd > toYmd) return false;
    return true;
  }

  function avgSamples(values) {
    if (!values.length) return { media: null, quantidade: 0 };
    const media = Math.round(values.reduce((s, n) => s + n, 0) / values.length);
    return { media, quantidade: values.length };
  }

  function stageGap(rows, fromKey, toKey) {
    const values = [];
    (rows || []).forEach((r) => {
      const a = r?.[fromKey] || "";
      const b = r?.[toKey] || "";
      if (!a || !b || b < a) return;
      const days = calendarSpanDays(a, b);
      if (days > 0) values.push(days);
    });
    return avgSamples(values);
  }

  function officeReportInsights(report, asOfYmd) {
    const rows = report?.vehicles || [];
    const filters = report?.filters || {};
    const from = filters.from || "";
    const to = filters.to || "";
    const onPatio = rows.filter((r) => r.stageCode !== "VRP");
    const diasAtuais = onPatio.map((r) => Number(r.dias) || 0).filter((n) => n > 0);
    const entradas = rows.filter((r) => inYmdWindow(r.dataEntrada, from, to));
    const saidas = rows.filter((r) => inYmdWindow(r.dataSaida, from, to));
    let geradoPeriodo = 0;
    let geradoAny = false;
    rows.forEach((r) => {
      if (r.valorDiaria == null) return;
      chargedDays(r).forEach((day) => {
        if (!inYmdWindow(day, from, to)) return;
        geradoAny = true;
        geradoPeriodo = addMoney(geradoPeriodo, r.valorDiaria);
      });
    });
    const bands = STAY_BANDS.map((band) => ({
      id: band.id,
      label: band.label,
      quantidade: onPatio.filter((r) => {
        const d = Number(r.dias) || 0;
        return d >= band.min && d <= band.max;
      }).length,
    }));
    const maiorLista = onPatio
      .filter((r) => Number(r.dias) > 0)
      .slice()
      .sort((a, b) => (Number(b.dias) || 0) - (Number(a.dias) || 0) || String(a.placa).localeCompare(String(b.placa), "pt-BR"));
    const maiorDias = maiorLista.length ? Number(maiorLista[0].dias) : null;
    let semDataFaturamento = 0;
    let semDataPagamento = 0;
    rows.forEach((r) => {
      (r.lancamentos || []).forEach((l) => {
        if ((l.billed || l.received) && !l.faturadoEm) semDataFaturamento += 1;
        if (l.received && !l.pagoEm) semDataPagamento += 1;
      });
    });
    return {
      asOf: asOfYmd || todayYmd(),
      entradas: entradas.length,
      saidas: saidas.length,
      mediaDias: diasAtuais.length ? Math.round(diasAtuais.reduce((s, n) => s + n, 0) / diasAtuais.length) : null,
      maiorDias,
      geradoPeriodo: geradoAny ? geradoPeriodo : rows.length ? null : 0,
      bands,
      maiorPermanencia: maiorLista,
      etapas: {
        entradaSolicitacao: stageGap(rows, "dataEntrada", "dataSolicitacao"),
        solicitacaoConfirmacao: stageGap(rows, "dataSolicitacao", "dataConfirmacao"),
        confirmacaoRetirada: stageGap(rows, "dataConfirmacao", "dataSaida"),
        entradaRetirada: stageGap(rows, "dataEntrada", "dataSaida"),
      },
      atencao: {
        longa: onPatio.filter((r) => Number(r.dias) > 60),
        liberados: rows.filter((r) => r.stageCode === "VSC"),
        aguardandoFaturamento: rows.filter((r) => r.stageCode === "VRP" && !r.faturado),
        vencidos: rows.filter((r) => Number(r.vencido) > 0),
        abertos: rows.filter((r) => Number(r.aberto) > 0),
        semMovimento: onPatio.filter((r) => !r.dataSolicitacao && Number(r.dias) >= 30),
      },
      semDataFaturamento,
      semDataPagamento,
    };
  }

  function officeReportTimeline(rows, filters, mode, asOfYmd) {
    const asOf = asOfYmd || todayYmd();
    const from = filters?.from || "";
    const to = filters?.to || asOf;
    const entradas = (rows || []).map((r) => r.dataEntrada).filter(Boolean).sort();
    const start = from || entradas[0] || asOf;
    const end = to || asOf;
    const bucket = mode || suggestOfficeBucket(start, end);
    if (!start || !end || end < start) return { bucket, points: [] };
    const points = new Map();
    const ensure = (ymd) => {
      const key = bucketStartYmd(ymd, bucket);
      if (!points.has(key)) {
        points.set(key, {
          key,
          entradas: 0,
          saidas: 0,
          permanencia: 0,
          mediaDias: null,
          gerado: 0,
          faturado: 0,
          recebido: 0,
          aberto: 0,
          _staySum: 0,
          _stayN: 0,
        });
      }
      return points.get(key);
    };
    eachYmd(start, end, (day) => ensure(day));
    (rows || []).forEach((row) => {
      if (inYmdWindow(row.dataEntrada, start, end)) ensure(row.dataEntrada).entradas += 1;
      if (inYmdWindow(row.dataSaida, start, end)) ensure(row.dataSaida).saidas += 1;
      const days = chargedDays(row).filter((day) => inYmdWindow(day, start, end));
      const seen = new Set();
      days.forEach((day) => {
        const p = ensure(day);
        if (row.valorDiaria != null) p.gerado = addMoney(p.gerado, row.valorDiaria);
        seen.add(p.key);
      });
      seen.forEach((key) => {
        const p = points.get(key);
        p.permanencia += 1;
        const last = days.filter((day) => bucketStartYmd(day, bucket) === key).sort().pop();
        const stay = calendarSpanDays(row.dataEntrada, last);
        if (stay > 0) {
          p._staySum += stay;
          p._stayN += 1;
        }
      });
      (row.lancamentos || []).forEach((l) => {
        if ((l.billed || l.received) && inYmdWindow(l.faturadoEm, start, end)) {
          const p = ensure(l.faturadoEm);
          p.faturado = addMoney(p.faturado, l.valor);
        }
        if (l.received && inYmdWindow(l.pagoEm, start, end)) {
          const p = ensure(l.pagoEm);
          p.recebido = addMoney(p.recebido, l.valor);
        }
      });
    });
    return {
      bucket,
      points: Array.from(points.values())
        .sort((a, b) => a.key.localeCompare(b.key))
        .map((p) => {
          const bucketEnd = bucketEndYmd(p.key, bucket, end);
          let aberto = 0;
          (rows || []).forEach((row) => {
            (row.lancamentos || []).forEach((l) => {
              if (!(l.billed || l.received) || !l.faturadoEm || l.faturadoEm > bucketEnd) return;
              if (l.received && !l.pagoEm) return;
              if (l.received && l.pagoEm <= bucketEnd) return;
              aberto = addMoney(aberto, l.valor);
            });
          });
          return {
            key: p.key,
            entradas: p.entradas,
            saidas: p.saidas,
            permanencia: p.permanencia,
            mediaDias: p._stayN ? Math.round(p._staySum / p._stayN) : null,
            gerado: p.gerado,
            faturado: p.faturado,
            recebido: p.recebido,
            aberto,
          };
        }),
    };
  }

  function filterOfficeReportDrill(rows, drill, filters) {
    const list = rows || [];
    const id = String(drill || "all");
    const from = filters?.from || "";
    const to = filters?.to || "";
    if (!id || id === "all") return list.slice();
    if (id === "patio") return list.filter((r) => r.stageCode !== "VRP");
    if (id === "entradas") return list.filter((r) => inYmdWindow(r.dataEntrada, from, to));
    if (id === "saidas") return list.filter((r) => inYmdWindow(r.dataSaida, from, to));
    if (id === "vsl") return list.filter((r) => r.stageCode === "VSL");
    if (id === "vsc") return list.filter((r) => r.stageCode === "VSC");
    if (id === "gerado") return list.filter((r) => r.estadia != null || r.valorDiaria != null);
    if (id === "faturado") return list.filter((r) => r.faturado);
    if (id === "recebido") return list.filter((r) => Number(r.recebido) > 0);
    if (id === "aberto") return list.filter((r) => Number(r.aberto) > 0);
    if (id === "maior") {
      const onPatio = list.filter((r) => r.stageCode !== "VRP" && Number(r.dias) > 0);
      const max = onPatio.reduce((m, r) => Math.max(m, Number(r.dias) || 0), 0);
      return onPatio.filter((r) => Number(r.dias) === max);
    }
    if (id.indexOf("band:") === 0) {
      const band = STAY_BANDS.find((b) => b.id === id.slice(5));
      if (!band) return list.slice();
      return list.filter((r) => r.stageCode !== "VRP" && Number(r.dias) >= band.min && Number(r.dias) <= band.max);
    }
    if (id === "attn:longa") return list.filter((r) => r.stageCode !== "VRP" && Number(r.dias) > 60);
    if (id === "attn:vsc") return list.filter((r) => r.stageCode === "VSC");
    if (id === "attn:fat") return list.filter((r) => r.stageCode === "VRP" && !r.faturado);
    if (id === "attn:vencido") return list.filter((r) => Number(r.vencido) > 0);
    if (id === "attn:aberto") return list.filter((r) => Number(r.aberto) > 0);
    if (id === "attn:sem-mov") return list.filter((r) => r.stageCode !== "VRP" && !r.dataSolicitacao && Number(r.dias) >= 30);
    return list.slice();
  }

  function sortOfficeReportRows(rows, sort) {
    const key = sort?.key || "dataEntrada";
    const dir = sort?.dir === "asc" ? 1 : -1;
    const textKeys = { placa: 1, veiculo: 1, gestor: 1, patio: 1, situacao: 1, stageCode: 1 };
    return (rows || []).slice().sort((a, b) => {
      const va = a?.[key];
      const vb = b?.[key];
      if (!textKeys[key]) {
        const na = va == null || va === "" ? null : Number(va);
        const nb = vb == null || vb === "" ? null : Number(vb);
        if (key === "dataEntrada" || key === "dataSaida") {
          const sa = String(va || "");
          const sb = String(vb || "");
          if (!sa && sb) return 1;
          if (sa && !sb) return -1;
          if (sa !== sb) return dir * sa.localeCompare(sb);
        } else if (na == null && nb == null) {
          /* keep going */
        } else if (na == null) return 1;
        else if (nb == null) return -1;
        else if (na !== nb) return dir * (na - nb);
      }
      const cmp = String(va || "").localeCompare(String(vb || ""), "pt-BR");
      if (cmp) return dir * cmp;
      return String(a?.placa || "").localeCompare(String(b?.placa || ""), "pt-BR");
    });
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
    flowStage,
    buildOfficeReport,
    officeReportInsights,
    officeReportTimeline,
    filterOfficeReportDrill,
    sortOfficeReportRows,
    suggestOfficeBucket,
    STAY_BANDS,
    stayOverlapsPeriod,
    computeReport,
    rankingRows,
    chartRange,
    uniqueTipos,
    uniqueStatuses,
    defaultPeriod,
    financeiraNome,
    kpisOf,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = global.advocacyOfficesService;
})(typeof window !== "undefined" ? window : globalThis);

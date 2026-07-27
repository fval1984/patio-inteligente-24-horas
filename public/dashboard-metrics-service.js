/**
 * Dashboard Metrics Service (browser runtime).
 * Espelho de lib/dashboard/* — única fonte de cálculo para os cards do hub.
 * Cards NÃO devem consultar SQL nem financeMetricsSnapshot para estes KPIs.
 */
(function dashboardMetricsServiceModule(global) {
  "use strict";

  const DEFAULT_PATIO_CAPACITY = 100;
  const DEFAULT_FILTERS = {
    period: "30d",
    financeiraId: "",
    parceiroId: "",
    status: "",
    search: "",
  };

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

  function todayYmd(now) {
    return toLocalYmd(now || new Date());
  }

  function ymdToDate(ymd) {
    return new Date(`${ymd}T12:00:00`);
  }

  function addDaysYmd(ymd, days) {
    const d = ymdToDate(ymd);
    d.setDate(d.getDate() + days);
    return toLocalYmd(d);
  }

  function yearMonthFromYmd(ymd) {
    return ymd.slice(0, 7);
  }

  function monthStartYm(ym) {
    return `${ym}-01`;
  }

  function monthEndYm(ym) {
    const [y, m] = ym.split("-").map(Number);
    const last = new Date(y, m, 0).getDate();
    return `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  }

  function resolvePeriodRange(period, asOf) {
    const curYm = yearMonthFromYmd(asOf);
    switch (period) {
      case "today":
        return { from: asOf, to: asOf, label: "Hoje" };
      case "7d":
        return { from: addDaysYmd(asOf, -6), to: asOf, label: "Últimos 7 dias" };
      case "30d":
        return { from: addDaysYmd(asOf, -29), to: asOf, label: "Últimos 30 dias" };
      case "month":
        return { from: monthStartYm(curYm), to: asOf, label: "Mês atual" };
      case "year":
        return { from: `${asOf.slice(0, 4)}-01-01`, to: asOf, label: "Ano atual" };
      default:
        return { from: addDaysYmd(asOf, -29), to: asOf, label: "Últimos 30 dias" };
    }
  }

  function statusUpper(v) {
    return String(v?.status || "").toUpperCase();
  }

  function isVehicleOnPatio(v) {
    return statusUpper(v) !== "REMOVIDO";
  }

  function isVlpStatus(status) {
    const s = String(status || "");
    const u = s.toUpperCase();
    return (
      s === "LIBERACAO_SOLICITADA" ||
      s === "LIBERACAO_CONFIRMADA" ||
      s === "REMocao_CONFIRMADA" ||
      u === "REMOCAO_CONFIRMADA"
    );
  }

  function isLiberadoAguardandoRetirada(v) {
    const s = String(v?.status || "");
    const u = s.toUpperCase();
    return s === "LIBERACAO_CONFIRMADA" || s === "REMocao_CONFIRMADA" || u === "REMOCAO_CONFIRMADA";
  }

  function isRemocaoSolicitada(v) {
    const flag = v?.remocao_solicitada;
    return (
      flag === true ||
      flag === 1 ||
      flag === "1" ||
      flag === "t" ||
      flag === "true" ||
      flag === "TRUE"
    );
  }

  function hasVistoria(v) {
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

  function hasPendenciaDocumental(v) {
    if (String(v?.nfse_status || "").toUpperCase() === "PENDENTE") return true;
    if (isRemocaoSolicitada(v)) return true;
    return false;
  }

  /**
   * Mutuamente exclusivo — prioridade:
   * liberados → autorização → pendências documentais → vistoria → conferência
   */
  function classifyOperationalGroup(v) {
    if (!isVehicleOnPatio(v)) return null;
    if (isLiberadoAguardandoRetirada(v)) return "liberados_aguardando_retirada";
    if (String(v.status || "") === "LIBERACAO_SOLICITADA") return "aguardando_autorizacao";
    if (hasPendenciaDocumental(v)) return "pendencias_documentais";
    if (!hasVistoria(v)) return "aguardando_vistoria";
    return "aguardando_conferencia";
  }

  function financeiraFilterId(filters) {
    return String(filters.financeiraId || filters.parceiroId || "").trim();
  }

  function filterVehicles(vehicles, partners, filters) {
    const finId = financeiraFilterId(filters);
    const pmap = new Map((partners || []).map((p) => [String(p.id), p]));
    const q = String(filters.search || "")
      .trim()
      .toLowerCase();
    const qNorm = q.replace(/[^a-z0-9]/g, "");

    return (vehicles || []).filter((v) => {
      if (finId && String(v.localizador_id || "") !== finId) return false;
      if (filters.status === "no_patio" && !isVehicleOnPatio(v)) return false;
      if (filters.status === "vlp" && !isVlpStatus(v.status)) return false;
      if (filters.status === "removido" && statusUpper(v) !== "REMOVIDO") return false;
      if (q) {
        const plate = String(v.placa || "")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "");
        const partner = pmap.get(String(v.localizador_id || ""));
        const pName = String(partner?.nome || "").toLowerCase();
        const hay = `${plate} ${pName}`;
        const normHay = hay.replace(/[^a-z0-9]/g, "");
        if (!hay.includes(q) && !(qNorm && normHay.includes(qNorm))) return false;
      }
      return true;
    });
  }

  function receivableMetaAprovado(r) {
    const raw = String(r?.observacoes || r?.responsavel_pagamento || "");
    if (!raw.includes("financeiro_aprovado_contas_receber")) return false;
    try {
      const prefix = "[[finmeta:";
      const i = raw.indexOf(prefix);
      if (i < 0) return false;
      const end = raw.indexOf("]]", i);
      if (end < 0) return false;
      const json = raw.slice(i + prefix.length, end);
      const meta = JSON.parse(json);
      return meta && meta.financeiro_aprovado_contas_receber === true;
    } catch (e) {
      return /"financeiro_aprovado_contas_receber"\s*:\s*true/.test(raw);
    }
  }

  /** Mesma regra do Financeiro «Contas a receber» — não basta status EM_ABERTO. */
  function isOpenReceivable(r) {
    if (!r) return false;
    const st = String(r.status || "").toUpperCase();
    if (st === "PAGO" || st === "CANCELADO" || st === "CANCELADA") return false;
    if (!(Number(r.valor || 0) > 0)) return false;
    if (r.financeiro_aprovado_contas_receber === true) return true;
    if (receivableMetaAprovado(r)) return true;
    if (!r.vehicle_id && st === "EM_ABERTO") return true;
    return false;
  }

  function resolveCapacity(settings) {
    const n = Number(settings?.capacidade_patio);
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_PATIO_CAPACITY;
  }

  function vehicleStayDays(v, endYmd) {
    const ent = toLocalYmd(v?.data_entrada);
    if (!ent) return 0;
    const end = v.data_saida ? toLocalYmd(v.data_saida) : endYmd;
    if (!end || end < ent) return 0;
    return Math.max(1, Math.ceil((ymdToDate(end).getTime() - ymdToDate(ent).getTime()) / 86400000));
  }

  function partnerName(v, pmap) {
    const id = String(v?.localizador_id || "").trim();
    if (!id) return "—";
    return pmap.get(id)?.nome || v?.responsavel_financeiro_nome || "—";
  }

  function sumOperationalGroups(ops) {
    return (
      ops.aguardandoConferencia +
      ops.aguardandoVistoria +
      ops.aguardandoAutorizacao +
      ops.liberadosAguardandoRetirada +
      ops.pendenciasDocumentais
    );
  }

  function auditOperationalConsistency(veiculosNoPatio, operacional, log) {
    const logger = log || console;
    const sum = sumOperationalGroups(operacional);
    if (sum === veiculosNoPatio) return true;
    logger.error("[DashboardMetrics:audit] Inconsistência operacional:", {
      veiculosNoPatio,
      somaGrupos: sum,
      diferenca: veiculosNoPatio - sum,
      operacional: Object.assign({}, operacional),
    });
    return false;
  }

  // ——— Repository ———
  function DashboardRepository() {}
  DashboardRepository.prototype.fromSnapshot = function fromSnapshot(input) {
    return {
      vehicles: Array.isArray(input?.vehicles) ? input.vehicles : [],
      partners: Array.isArray(input?.partners) ? input.partners : [],
      receivables: Array.isArray(input?.receivables) ? input.receivables : [],
      settings: input?.settings && typeof input.settings === "object" ? input.settings : {},
      asOfYmd: input?.asOfYmd,
    };
  };

  // ——— Metrics ———
  function DashboardMetrics() {}
  DashboardMetrics.prototype.compute = function compute(snapshot, filters) {
    const asOfYmd = snapshot.asOfYmd || todayYmd();
    const range = resolvePeriodRange(filters.period, asOfYmd);
    const partners = snapshot.partners || [];
    const pmap = new Map(partners.map((p) => [String(p.id), p]));
    const vehicles = filterVehicles(snapshot.vehicles || [], partners, filters);
    const vmap = new Map((snapshot.vehicles || []).map((v) => [String(v.id), v]));

    const onPatio = vehicles.filter(isVehicleOnPatio);
    const veiculosNoPatio = onPatio.length;
    const entradasHoje = vehicles.filter((v) => toLocalYmd(v.data_entrada) === asOfYmd).length;
    const saidasHoje = vehicles.filter((v) => toLocalYmd(v.data_saida) === asOfYmd).length;

    const capacity = resolveCapacity(snapshot.settings);
    const percent = capacity > 0 ? (veiculosNoPatio / capacity) * 100 : 0;
    const ocupacao = {
      vehiclesOnPatio: veiculosNoPatio,
      capacity,
      percent,
      label: `${veiculosNoPatio} de ${capacity} vagas`,
    };

    const finId = financeiraFilterId(filters);
    const openReceivables = (snapshot.receivables || []).filter((r) => {
      if (!isOpenReceivable(r)) return false;
      const veh = r.vehicle_id ? vmap.get(String(r.vehicle_id)) : undefined;
      if (finId) {
        if (veh) {
          if (String(veh.localizador_id || "") !== finId) return false;
        } else if (String(r.localizador_id || r.partner_id || "") !== finId) {
          return false;
        }
      }
      if (filters.status || filters.search) {
        if (!veh) return false;
        if (!vehicles.some((x) => String(x.id) === String(veh.id))) return false;
      }
      return true;
    });
    const contasAReceber = openReceivables.reduce((s, r) => s + Number(r.valor || 0), 0);
    const contasAReceberPendentes = openReceivables.length;

    const financeirasIds = new Set();
    for (const v of onPatio) {
      const id = String(v.localizador_id || "").trim();
      if (id) financeirasIds.add(id);
    }

    const operacional = {
      aguardandoConferencia: 0,
      aguardandoVistoria: 0,
      aguardandoAutorizacao: 0,
      liberadosAguardandoRetirada: 0,
      pendenciasDocumentais: 0,
    };
    const operacionalByVehicleId = {};
    for (const v of onPatio) {
      const group = classifyOperationalGroup(v);
      if (!group) continue;
      operacionalByVehicleId[String(v.id)] = group;
      if (group === "aguardando_conferencia") operacional.aguardandoConferencia++;
      else if (group === "aguardando_vistoria") operacional.aguardandoVistoria++;
      else if (group === "aguardando_autorizacao") operacional.aguardandoAutorizacao++;
      else if (group === "liberados_aguardando_retirada") operacional.liberadosAguardandoRetirada++;
      else if (group === "pendencias_documentais") operacional.pendenciasDocumentais++;
    }

    const auditOk = auditOperationalConsistency(veiculosNoPatio, operacional);

    const longStay = onPatio
      .map((v) => ({
        vehicleId: String(v.id),
        placa: v.placa || "—",
        financeira: partnerName(v, pmap),
        days: vehicleStayDays(v, asOfYmd),
      }))
      .filter((x) => x.days > 0)
      .sort((a, b) => b.days - a.days)
      .slice(0, 10);

    const recvByFin = new Map();
    for (const r of openReceivables) {
      const veh = r.vehicle_id ? vmap.get(String(r.vehicle_id)) : undefined;
      const pid = String(veh?.localizador_id || r.localizador_id || r.partner_id || "").trim() || "__sem__";
      const nome =
        pid === "__sem__" ? "Sem financeira" : pmap.get(pid)?.nome || veh?.responsavel_financeiro_nome || "—";
      const cur = recvByFin.get(pid) || { financeira: nome, veiculos: new Set(), valor: 0 };
      if (r.vehicle_id) cur.veiculos.add(String(r.vehicle_id));
      cur.valor += Number(r.valor || 0);
      recvByFin.set(pid, cur);
    }
    const topReceivablesByFinanceira = [...recvByFin.entries()]
      .map(([financeiraId, x]) => ({
        financeiraId,
        financeira: x.financeira,
        veiculos: x.veiculos.size,
        valor: x.valor,
      }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8);

    const vehByFin = new Map();
    for (const v of onPatio) {
      const id = String(v.localizador_id || "").trim() || "__sem__";
      const nome = id === "__sem__" ? "Sem financeira" : pmap.get(id)?.nome || "—";
      const cur = vehByFin.get(id) || { nome, count: 0 };
      cur.count += 1;
      vehByFin.set(id, cur);
    }
    const vehiclesByFinanceira = [...vehByFin.entries()]
      .map(([financeiraId, x]) => ({ financeiraId, nome: x.nome, count: x.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const dailyLabels = [];
    const dailyEntradas = [];
    const dailySaidas = [];
    for (let i = 29; i >= 0; i--) {
      const ymd = addDaysYmd(asOfYmd, -i);
      dailyLabels.push(`${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`);
      let e = 0;
      let s = 0;
      for (const v of vehicles) {
        if (toLocalYmd(v.data_entrada) === ymd) e++;
        if (toLocalYmd(v.data_saida) === ymd) s++;
      }
      dailyEntradas.push(e);
      dailySaidas.push(s);
    }

    const months = [];
    const receitaValues = [];
    for (let i = 5; i >= 0; i--) {
      const d = ymdToDate(asOfYmd);
      d.setMonth(d.getMonth() - i);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push(ym);
      const mStart = monthStartYm(ym);
      const mEnd = monthEndYm(ym);
      let sum = 0;
      for (const r of snapshot.receivables || []) {
        if (String(r.status || "").toUpperCase() !== "PAGO") continue;
        const veh = r.vehicle_id ? vmap.get(String(r.vehicle_id)) : undefined;
        if (finId && veh && String(veh.localizador_id || "") !== finId) continue;
        const ref = toLocalYmd(veh?.data_saida);
        if (ref && ref >= mStart && ref <= mEnd) sum += Number(r.valor || 0);
      }
      receitaValues.push(sum);
    }

    return {
      filters: Object.assign({}, filters),
      range,
      asOfYmd,
      kpis: {
        veiculosNoPatio,
        entradasHoje,
        saidasHoje,
        ocupacao,
        contasAReceber,
        contasAReceberPendentes,
        financeirasAtivas: financeirasIds.size,
      },
      operacional,
      operacionalByVehicleId,
      longStay,
      topReceivablesByFinanceira,
      vehiclesByFinanceira,
      dailyFlow30d: { labels: dailyLabels, entradas: dailyEntradas, saidas: dailySaidas },
      receitaMensal: { months, values: receitaValues },
      auditOk,
    };
  };

  // ——— Service ———
  function DashboardService(repository, metricsEngine) {
    this.repository = repository || new DashboardRepository();
    this.metrics = metricsEngine || new DashboardMetrics();
    this.cache = null;
  }

  DashboardService.prototype.invalidateCache = function invalidateCache() {
    this.cache = null;
  };

  DashboardService.prototype.getMetricsFromSnapshot = function getMetricsFromSnapshot(raw, filters) {
    const snapshot = this.repository.fromSnapshot(raw || {});
    const merged = Object.assign({}, DEFAULT_FILTERS, filters || {});
    const key = [
      (snapshot.vehicles || []).length,
      (snapshot.partners || []).length,
      (snapshot.receivables || []).length,
      snapshot.settings?.capacidade_patio ?? "",
      snapshot.asOfYmd || "",
      merged.period,
      merged.financeiraId || "",
      merged.parceiroId || "",
      merged.status || "",
      String(merged.search || "")
        .trim()
        .toLowerCase(),
    ].join("|");
    if (this.cache && this.cache.key === key) return this.cache.result;
    const result = this.metrics.compute(snapshot, merged);
    this.cache = { key, result };
    return result;
  };

  const dashboardService = new DashboardService();

  global.DashboardTypes = { DEFAULT_FILTERS, DEFAULT_PATIO_CAPACITY };
  global.DashboardRepository = DashboardRepository;
  global.DashboardMetrics = DashboardMetrics;
  global.DashboardService = DashboardService;
  global.dashboardService = dashboardService;
  global.DashboardMetricsService = dashboardService;
  global.auditOperationalConsistency = auditOperationalConsistency;
  global.classifyOperationalGroup = classifyOperationalGroup;
  global.isVehicleOnPatio = isVehicleOnPatio;
  global.isOpenReceivable = isOpenReceivable;
})(typeof window !== "undefined" ? window : globalThis);

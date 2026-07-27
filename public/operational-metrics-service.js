/**
 * Operational Metrics Service (browser runtime).
 * Espelho de lib/operational-dashboard/metrics.ts + service.ts + repository.ts + types.ts.
 * Sem I/O. Sem SQL por card.
 */
(function operationalMetricsServiceModule(global) {
  "use strict";

  const DEFAULT_OPS_FILTERS = {
    period: "30d",
    financeiraId: "",
    parceiroId: "",
    status: "",
    search: "",
  };

  const STAGE_LABELS = {
    aguardando_conferencia: "Aguardando conferência",
    aguardando_vistoria: "Aguardando vistoria",
    aguardando_autorizacao: "Aguardando autorização",
    em_guarda: "Em guarda",
    liberados: "Liberados",
    entregues: "Entregues",
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

  function monthStartYm(ym) {
    return `${ym}-01`;
  }

  function monthEndYm(ym) {
    const [y, m] = ym.split("-").map(Number);
    const last = new Date(y, m, 0).getDate();
    return `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  }

  function statusUpper(v) {
    return String(v.status || "").toUpperCase();
  }

  function isOnPatio(v) {
    return statusUpper(v) !== "REMOVIDO";
  }

  function isLiberado(v) {
    const s = String(v.status || "");
    const u = s.toUpperCase();
    return s === "LIBERACAO_CONFIRMADA" || s === "REMocao_CONFIRMADA" || u === "REMOCAO_CONFIRMADA";
  }

  function isAutorizacao(v) {
    return String(v.status || "") === "LIBERACAO_SOLICITADA";
  }

  function hasVistoria(v) {
    const c = v.vistoria_checklist || {};
    return !!(
      v.vistoria_data ||
      v.vistoria_responsavel ||
      v.vistoria_km ||
      v.vistoria_combustivel ||
      v.vistoria_observacoes ||
      c.documento ||
      c.chave ||
      c.estepe ||
      c.triangulo_macaco
    );
  }

  /** Conferência inicial incompleta: sem valor de diária definido. */
  function needsConferencia(v) {
    return !v.valor_diaria || Number(v.valor_diaria) <= 0;
  }

  function isRemocaoFlag(v) {
    const f = v.remocao_solicitada;
    return f === true || f === 1 || f === "1" || f === "t" || f === "true" || f === "TRUE";
  }

  function missingDocs(v) {
    if (String(v.nfse_status || "").toUpperCase() === "PENDENTE") return true;
    if (isRemocaoFlag(v)) return true;
    return false;
  }

  /**
   * Classificação exclusiva no pátio (estoque).
   * Prioridade: liberados → autorização → conferência → vistoria → em guarda
   */
  function classifyStage(v) {
    if (statusUpper(v) === "REMOVIDO") return "entregues";
    if (!isOnPatio(v)) return null;
    if (isLiberado(v)) return "liberados";
    if (isAutorizacao(v)) return "aguardando_autorizacao";
    if (needsConferencia(v)) return "aguardando_conferencia";
    if (!hasVistoria(v)) return "aguardando_vistoria";
    return "em_guarda";
  }

  function stayDays(v, asOf) {
    const ent = toLocalYmd(v.data_entrada);
    if (!ent) return 0;
    const end = v.data_saida ? toLocalYmd(v.data_saida) : asOf;
    if (!end || end < ent) return 0;
    return Math.max(1, Math.ceil((ymdToDate(end).getTime() - ymdToDate(ent).getTime()) / 86400000));
  }

  function hoursSince(iso, now) {
    if (!iso) return null;
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return null;
    return (now.getTime() - t) / 3600000;
  }

  function filterVehicles(vehicles, partners, filters) {
    const finId = String(filters.financeiraId || "").trim();
    const parcId = String(filters.parceiroId || "").trim();
    const pmap = new Map(partners.map((p) => [String(p.id), p]));
    const q = String(filters.search || "")
      .trim()
      .toLowerCase();
    const qNorm = q.replace(/[^a-z0-9]/g, "");

    return vehicles.filter((v) => {
      if (finId && String(v.localizador_id || "") !== finId) return false;
      if (parcId) {
        const rpp = String(v.responsavel_financeiro_id || v.localizador_id || "");
        if (rpp !== parcId) return false;
      }
      if (filters.status === "no_patio" && !isOnPatio(v)) return false;
      if (filters.status === "vlp") {
        const s = String(v.status || "");
        if (!(s === "LIBERACAO_SOLICITADA" || isLiberado(v))) return false;
      }
      if (filters.status === "removido" && statusUpper(v) !== "REMOVIDO") return false;
      if (q) {
        const plate = String(v.placa || "")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "");
        const partner = pmap.get(String(v.localizador_id || ""));
        const hay = `${plate} ${String(partner?.nome || "").toLowerCase()}`;
        const normHay = hay.replace(/[^a-z0-9]/g, "");
        if (!hay.includes(q) && !(qNorm && normHay.includes(qNorm))) return false;
      }
      return true;
    });
  }

  function eventLabel(tipo) {
    const t = String(tipo || "").toUpperCase();
    const map = {
      LIBERACAO_SOLICITADA: "Autorização solicitada",
      LIBERACAO_CONFIRMADA: "Liberação",
      REMOCAO_SOLICITADA: "Remoção solicitada",
      REMOVIDO: "Entrega",
      STATUS_REVERTIDO_VNP: "Reversão",
      REMOCAO_DESFEITA: "Remoção desfeita",
      RESPONSAVEL_TROCADO: "Troca de responsável",
    };
    return map[t] || (tipo ? String(tipo).replace(/_/g, " ") : "Movimentação");
  }

  function formatTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  function asArray(v) {
    return Array.isArray(v) ? v : [];
  }

  function OperationalRepository() {}

  OperationalRepository.prototype.fromSnapshot = function fromSnapshot(input) {
    const raw = input || {};
    return {
      vehicles: asArray(raw.vehicles),
      partners: asArray(raw.partners),
      events: asArray(raw.events),
      asOfYmd: raw.asOfYmd,
    };
  };

  function OperationalMetrics() {}

  OperationalMetrics.prototype.compute = function compute(snapshot, filtersInput) {
    const filters = Object.assign({}, DEFAULT_OPS_FILTERS, filtersInput || {});
    const asOf = snapshot.asOfYmd || todayYmd();
    const now = new Date(`${asOf}T23:59:59`);
    const partners = snapshot.partners || [];
    const pmap = new Map(partners.map((p) => [String(p.id), p]));
    const vehicles = filterVehicles(snapshot.vehicles || [], partners, filters);
    const onPatio = vehicles.filter(isOnPatio);

    const stageCounts = {
      aguardando_conferencia: 0,
      aguardando_vistoria: 0,
      aguardando_autorizacao: 0,
      em_guarda: 0,
      liberados: 0,
      entregues: 0,
    };
    const byStage = new Map();
    for (const v of onPatio) {
      const st = classifyStage(v);
      if (!st || st === "entregues") continue;
      byStage.set(String(v.id), st);
      stageCounts[st]++;
    }

    const entradasHoje = vehicles.filter((v) => toLocalYmd(v.data_entrada) === asOf).length;
    const saidasHoje = vehicles.filter((v) => toLocalYmd(v.data_saida) === asOf).length;
    stageCounts.entregues = saidasHoje;

    const kpis = {
      veiculosNoPatio: onPatio.length,
      entradasHoje,
      saidasHoje,
      aguardandoConferencia: stageCounts.aguardando_conferencia,
      aguardandoVistoria: stageCounts.aguardando_vistoria,
      prontosParaLiberacao: stageCounts.liberados,
    };

    const fila = {
      recebidosHoje: entradasHoje,
      aguardandoConferencia: stageCounts.aguardando_conferencia,
      aguardandoVistoria: stageCounts.aguardando_vistoria,
      aguardandoAutorizacao: stageCounts.aguardando_autorizacao,
      liberados: stageCounts.liberados,
      entregues: saidasHoje,
    };

    const mapa = {
      recebidosHoje: entradasHoje,
      emConferencia: stageCounts.aguardando_conferencia,
      emGuarda: stageCounts.em_guarda + stageCounts.aguardando_vistoria,
      liberados: stageCounts.liberados + stageCounts.aguardando_autorizacao,
      entregues: saidasHoje,
    };

    const labels30 = [];
    const ent30 = [];
    const sai30 = [];
    for (let i = 29; i >= 0; i--) {
      const ymd = addDaysYmd(asOf, -i);
      labels30.push(`${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`);
      let e = 0;
      let s = 0;
      for (const v of vehicles) {
        if (toLocalYmd(v.data_entrada) === ymd) e++;
        if (toLocalYmd(v.data_saida) === ymd) s++;
      }
      ent30.push(e);
      sai30.push(s);
    }

    const stayLabels = [];
    const stayAvgs = [];
    for (let i = 11; i >= 0; i--) {
      const d = ymdToDate(asOf);
      d.setMonth(d.getMonth() - i);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      stayLabels.push(ym.slice(5) + "/" + ym.slice(2, 4));
      const mStart = monthStartYm(ym);
      const mEnd = monthEndYm(ym);
      const days = [];
      for (const v of vehicles) {
        const sai = toLocalYmd(v.data_saida);
        if (sai && sai >= mStart && sai <= mEnd) days.push(stayDays(v, sai));
      }
      stayAvgs.push(days.length ? days.reduce((a, b) => a + b, 0) / days.length : 0);
    }

    const stockStages = [
      "aguardando_conferencia",
      "aguardando_vistoria",
      "aguardando_autorizacao",
      "em_guarda",
      "liberados",
    ];
    const totalStock = stockStages.reduce((s, k) => s + stageCounts[k], 0) || 1;
    const veiculosPorStatus = stockStages.map((key) => ({
      key,
      label: STAGE_LABELS[key],
      count: stageCounts[key],
      pct: (stageCounts[key] / totalStock) * 100,
    }));

    const aguardandoAcao = onPatio
      .filter((v) => {
        const st = byStage.get(String(v.id));
        return (
          st === "aguardando_conferencia" ||
          st === "aguardando_vistoria" ||
          st === "aguardando_autorizacao" ||
          st === "liberados" ||
          missingDocs(v)
        );
      })
      .map((v) => {
        const st = byStage.get(String(v.id)) || "em_guarda";
        const finId = String(v.localizador_id || "");
        return {
          vehicleId: String(v.id),
          placa: v.placa || "—",
          financeira: (pmap.get(finId) && pmap.get(finId).nome) || "—",
          statusAtual: STAGE_LABELS[st],
          diasNoPatio: stayDays(v, asOf),
          responsavel:
            v.responsavel_financeiro_nome ||
            (pmap.get(String(v.responsavel_financeiro_id || "")) &&
              pmap.get(String(v.responsavel_financeiro_id || "")).nome) ||
            "—",
          stage: st,
        };
      })
      .sort((a, b) => b.diasNoPatio - a.diasNoPatio)
      .slice(0, 20);

    const events = snapshot.events || [];
    let ultimasMovimentacoes = events
      .map((ev) => {
        const veh =
          vehicles.find((x) => String(x.id) === String(ev.vehicle_id)) ||
          (snapshot.vehicles || []).find((x) => String(x.id) === String(ev.vehicle_id));
        const at = ev.data_evento || ev.created_at || "";
        return {
          horario: formatTime(at),
          placa: (veh && veh.placa) || "—",
          evento: eventLabel(ev.tipo),
          usuario: ev.responsavel || "—",
          at: String(at),
        };
      })
      .filter((x) => x.at)
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 20);

    if (!ultimasMovimentacoes.length) {
      const derived = [];
      for (const v of vehicles) {
        if (toLocalYmd(v.data_entrada) === asOf) {
          derived.push({
            horario: formatTime(v.data_entrada || v.created_at),
            placa: v.placa || "—",
            evento: "Recebimento",
            usuario: v.responsavel_financeiro_nome || "—",
            at: String(v.data_entrada || v.created_at || ""),
          });
        }
        if (toLocalYmd(v.data_saida) === asOf) {
          derived.push({
            horario: formatTime(v.data_saida || v.updated_at),
            placa: v.placa || "—",
            evento: "Entrega",
            usuario: v.responsavel_financeiro_nome || "—",
            at: String(v.data_saida || v.updated_at || ""),
          });
        }
        if (v.vistoria_data && toLocalYmd(v.vistoria_data) === asOf) {
          derived.push({
            horario: formatTime(v.vistoria_data),
            placa: v.placa || "—",
            evento: "Vistoria",
            usuario: v.vistoria_responsavel || "—",
            at: String(v.vistoria_data),
          });
        }
      }
      ultimasMovimentacoes = derived.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 20);
    }

    const alerts = [];
    const pushAlert = function pushAlert(id, priority, title, detail, count) {
      if (count > 0) alerts.push({ id, priority, title, detail, count });
    };

    let conf24 = 0;
    let vist24 = 0;
    let lib48 = 0;
    let above60 = 0;
    let above90 = 0;
    let noDocs = 0;
    for (const v of onPatio) {
      const st = byStage.get(String(v.id));
      const hrs = hoursSince(v.data_entrada || v.created_at, now);
      const days = stayDays(v, asOf);
      if (st === "aguardando_conferencia" && hrs != null && hrs >= 24) conf24++;
      if (st === "aguardando_vistoria" && hrs != null && hrs >= 24) vist24++;
      if (st === "liberados") {
        const libHrs = hoursSince(v.updated_at || v.data_entrada, now);
        if (libHrs != null && libHrs >= 48) lib48++;
      }
      if (days > 90) above90++;
      else if (days > 60) above60++;
      if (missingDocs(v)) noDocs++;
    }
    pushAlert("conf24", "yellow", "Conferência atrasada (+24h)", "Veículos aguardando conferência há mais de 24 horas", conf24);
    pushAlert("vist24", "yellow", "Vistoria atrasada (+24h)", "Veículos aguardando vistoria há mais de 24 horas", vist24);
    pushAlert("lib48", "red", "Liberados sem retirada (+48h)", "Veículos liberados aguardando retirada há mais de 48 horas", lib48);
    pushAlert("d60", "yellow", "Permanência acima de 60 dias", "Veículos no pátio há mais de 60 dias", above60);
    pushAlert("d90", "red", "Permanência acima de 90 dias", "Veículos no pátio há mais de 90 dias", above90);
    pushAlert("docs", "red", "Sem documentação obrigatória", "NF-e pendente ou remoção solicitada", noDocs);
    if (!alerts.length) {
      alerts.push({
        id: "ok",
        priority: "green",
        title: "Operação estável",
        detail: "Nenhum alerta crítico no momento",
        count: 0,
      });
    }

    return {
      filters,
      asOfYmd: asOf,
      kpis,
      fila,
      mapa,
      entradasSaidas30d: { labels: labels30, entradas: ent30, saidas: sai30 },
      tempoMedioPermanencia12m: { labels: stayLabels, avgDays: stayAvgs },
      veiculosPorStatus,
      aguardandoAcao,
      ultimasMovimentacoes,
      alerts,
    };
  };

  function OperationalDashboardService(repository, metrics) {
    this.repository = repository || new OperationalRepository();
    this.metrics = metrics || new OperationalMetrics();
    this.cache = null;
  }

  OperationalDashboardService.prototype.invalidateCache = function invalidateCache() {
    this.cache = null;
  };

  OperationalDashboardService.prototype.getMetricsFromSnapshot = function getMetricsFromSnapshot(raw, filters) {
    const snapshot = this.repository.fromSnapshot(raw || {});
    const merged = Object.assign({}, DEFAULT_OPS_FILTERS, filters || {});
    const key = [
      (snapshot.vehicles || []).length,
      (snapshot.partners || []).length,
      (snapshot.events || []).length,
      snapshot.asOfYmd || "",
      merged.period,
      merged.financeiraId,
      merged.parceiroId,
      merged.status,
      String(merged.search || "")
        .trim()
        .toLowerCase(),
    ].join("|");
    if (this.cache && this.cache.key === key) return this.cache.result;
    const result = this.metrics.compute(snapshot, merged);
    this.cache = { key, result };
    return result;
  };

  const operationalDashboardService = new OperationalDashboardService();

  global.OperationalTypes = { DEFAULT_OPS_FILTERS, STAGE_LABELS };
  global.OperationalRepository = OperationalRepository;
  global.OperationalMetrics = OperationalMetrics;
  global.OperationalDashboardService = OperationalDashboardService;
  global.operationalDashboardService = operationalDashboardService;
  global.classifyStage = classifyStage;
  global.isOnPatio = isOnPatio;
  global.operationalToLocalYmd = toLocalYmd;
  global.operationalTodayYmd = todayYmd;
})(typeof window !== "undefined" ? window : globalThis);

/**
 * Financial Partner Metrics Service (browser runtime).
 * Espelho de lib/financial-partner-dashboard/{types,repository,metrics,service}.ts
 * Sem I/O. Sem SQL por card.
 */
(function financialPartnerMetricsServiceModule(global) {
  "use strict";

  const DEFAULT_FP_FILTERS = {
    period: "30d",
    financeiraId: "",
    status: "",
    search: "",
  };

  const PORTFOLIO_LABELS = {
    em_guarda: "Veículos em guarda",
    aguardando_documentacao: "Aguardando documentação",
    aguardando_autorizacao: "Aguardando autorização",
    liberados: "Veículos liberados",
    entregues: "Veículos entregues",
  };

  function asArray(v) {
    return Array.isArray(v) ? v : [];
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

  function resolvePeriod(period, asOf) {
    const curYm = yearMonthFromYmd(asOf);
    switch (period) {
      case "today":
        return { from: asOf, to: asOf };
      case "7d":
        return { from: addDaysYmd(asOf, -6), to: asOf };
      case "30d":
        return { from: addDaysYmd(asOf, -29), to: asOf };
      case "month":
        return { from: monthStartYm(curYm), to: asOf };
      case "year":
        return { from: `${asOf.slice(0, 4)}-01-01`, to: asOf };
      default:
        return { from: addDaysYmd(asOf, -29), to: asOf };
    }
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

  function isRemocaoFlag(v) {
    const f = v.remocao_solicitada;
    return f === true || f === 1 || f === "1" || f === "t" || f === "true" || f === "TRUE";
  }

  function missingDocs(v) {
    return String(v.nfse_status || "").toUpperCase() === "PENDENTE" || isRemocaoFlag(v);
  }

  function stayDays(v, asOf) {
    const ent = toLocalYmd(v.data_entrada);
    if (!ent) return 0;
    const end = v.data_saida ? toLocalYmd(v.data_saida) : asOf;
    if (!end || end < ent) return 0;
    return Math.max(1, Math.ceil((ymdToDate(end).getTime() - ymdToDate(ent).getTime()) / 86400000));
  }

  /** Mesma lógica de calcTotal do app.html */
  function valorAcumulado(v, asOf) {
    const ref = asOf || todayYmd();
    if (!v || !v.data_entrada || !v.valor_diaria) return 0;
    const days = stayDays(v, ref);
    return days * Number(v.valor_diaria || 0);
  }

  function classifyPortfolio(v) {
    if (statusUpper(v) === "REMOVIDO") return "entregues";
    if (isLiberado(v)) return "liberados";
    if (String(v.status || "") === "LIBERACAO_SOLICITADA") return "aguardando_autorizacao";
    if (missingDocs(v)) return "aguardando_documentacao";
    return "em_guarda";
  }

  function statusLabel(v) {
    return PORTFOLIO_LABELS[classifyPortfolio(v)];
  }

  function isFaturado(r) {
    if (!r || Number(r.valor || 0) <= 0) return false;
    const st = String(r.status || "").toUpperCase();
    if (st === "PAGO") return true;
    if (r.financeiro_aprovado_contas_receber === true) return true;
    return false;
  }

  function isAberto(r) {
    if (!r || String(r.status || "").toUpperCase() === "PAGO") return false;
    if (String(r.status || "").toUpperCase() === "CANCELADO") return false;
    if (Number(r.valor || 0) <= 0) return false;
    if (r.financeiro_aprovado_contas_receber === true) return true;
    if (String(r.status || "").toUpperCase() === "EM_ABERTO") return true;
    return false;
  }

  function faturamentoYmd(r, v) {
    return toLocalYmd((v && v.data_saida) || r.period_end || r.data_vencimento || r.created_at);
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

  function formatYmdBr(ymd) {
    if (!ymd || ymd.length < 10) return "—";
    return `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}/${ymd.slice(0, 4)}`;
  }

  function emptyResult(filters, asOf, nome) {
    const emptySeries = { labels: [], values: [] };
    const emptyPair = { labels: [], entradas: [], saidas: [] };
    return {
      filters: filters,
      asOfYmd: asOf,
      financeiraNome: nome,
      hasFinanceira: !!filters.financeiraId,
      kpis: {
        veiculosAtivos: 0,
        entradasPeriodo: 0,
        saidasPeriodo: 0,
        tempoMedioPermanencia: 0,
        receitaGerada: 0,
        valorEmAberto: 0,
      },
      entradasSaidas12m: emptyPair,
      tempoMedio12m: emptySeries,
      receitaMensal12m: emptySeries,
      carteira: [],
      veiculos: [],
      ultimasMovimentacoes: [],
      alerts: [
        {
          id: "select",
          priority: "green",
          title: "Selecione uma financeira",
          detail: "Escolha a financeira no filtro para carregar os indicadores",
          count: 0,
        },
      ],
      mapaPermanencia: [],
      rankingPermanencia: [],
      indicadoresFinanceiros: {
        receitaMes: 0,
        receitaAno: 0,
        ticketMedioPorVeiculo: 0,
        receitaMediaPorDiaGuarda: 0,
        valorMedioPorVeiculoArmazenado: 0,
      },
    };
  }

  // ——— Repository ———
  function FinancialPartnerRepository() {}

  FinancialPartnerRepository.prototype.fromSnapshot = function fromSnapshot(input) {
    const raw = input || {};
    return {
      vehicles: asArray(raw.vehicles),
      partners: asArray(raw.partners),
      receivables: asArray(raw.receivables),
      events: asArray(raw.events),
      asOfYmd: raw.asOfYmd,
    };
  };

  // ——— Metrics ———
  function FinancialPartnerMetrics() {}

  FinancialPartnerMetrics.prototype.compute = function compute(snapshot, filtersInput) {
    const filters = Object.assign({}, DEFAULT_FP_FILTERS, filtersInput || {});
    const asOf = snapshot.asOfYmd || todayYmd();
    const range = resolvePeriod(filters.period, asOf);
    const pmap = new Map((snapshot.partners || []).map(function (p) {
      return [String(p.id), p];
    }));
    const financeiraNome = filters.financeiraId
      ? (pmap.get(String(filters.financeiraId)) && pmap.get(String(filters.financeiraId)).nome) || "Financeira"
      : "";

    if (!filters.financeiraId) {
      return emptyResult(filters, asOf, "");
    }

    const finId = String(filters.financeiraId);
    const q = String(filters.search || "")
      .trim()
      .toLowerCase();
    const qNorm = q.replace(/[^a-z0-9]/g, "");

    let vehicles = (snapshot.vehicles || []).filter(function (v) {
      return String(v.localizador_id || "") === finId;
    });
    if (filters.status === "no_patio") vehicles = vehicles.filter(isOnPatio);
    if (filters.status === "vlp") {
      vehicles = vehicles.filter(function (v) {
        return String(v.status || "") === "LIBERACAO_SOLICITADA" || isLiberado(v);
      });
    }
    if (filters.status === "removido") {
      vehicles = vehicles.filter(function (v) {
        return statusUpper(v) === "REMOVIDO";
      });
    }
    if (q) {
      vehicles = vehicles.filter(function (v) {
        const plate = String(v.placa || "")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "");
        const modelo = `${v.marca || ""} ${v.modelo || ""}`.toLowerCase();
        const hay = `${plate} ${modelo}`;
        const norm = hay.replace(/[^a-z0-9]/g, "");
        return hay.includes(q) || (!!qNorm && norm.includes(qNorm));
      });
    }

    const vmap = new Map(
      vehicles.map(function (v) {
        return [String(v.id), v];
      })
    );
    const finVehicleIds = new Set(
      (snapshot.vehicles || [])
        .filter(function (v) {
          return String(v.localizador_id || "") === finId;
        })
        .map(function (v) {
          return String(v.id);
        })
    );

    const onPatio = vehicles.filter(isOnPatio);
    const entradasPeriodo = vehicles.filter(function (v) {
      const y = toLocalYmd(v.data_entrada);
      return !!(y && y >= range.from && y <= range.to);
    }).length;
    const saidasPeriodo = vehicles.filter(function (v) {
      const y = toLocalYmd(v.data_saida);
      return !!(y && y >= range.from && y <= range.to);
    }).length;

    const stayList = onPatio
      .map(function (v) {
        return stayDays(v, asOf);
      })
      .filter(function (d) {
        return d > 0;
      });
    const tempoMedio = stayList.length
      ? stayList.reduce(function (a, b) {
          return a + b;
        }, 0) / stayList.length
      : 0;

    const receivables = (snapshot.receivables || []).filter(function (r) {
      if (!r.vehicle_id) return false;
      return finVehicleIds.has(String(r.vehicle_id));
    });

    let receitaGerada = 0;
    let valorEmAberto = 0;
    for (let ri = 0; ri < receivables.length; ri++) {
      const r = receivables[ri];
      const val = Number(r.valor || 0);
      if (isFaturado(r)) {
        const fat = faturamentoYmd(r, vmap.get(String(r.vehicle_id)) || undefined);
        if (fat && fat >= range.from && fat <= range.to) receitaGerada += val;
        else if (!fat) receitaGerada += val;
      }
      if (isAberto(r)) valorEmAberto += val;
    }

    // 12m charts
    const labels12 = [];
    const ent12 = [];
    const sai12 = [];
    const stay12 = [];
    const rec12 = [];
    for (let i = 11; i >= 0; i--) {
      const d = ymdToDate(asOf);
      d.setMonth(d.getMonth() - i);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      labels12.push(ym.slice(5) + "/" + ym.slice(2, 4));
      const mStart = monthStartYm(ym);
      const mEnd = monthEndYm(ym);
      let e = 0;
      let s = 0;
      const daysOut = [];
      for (let vi = 0; vi < vehicles.length; vi++) {
        const v = vehicles[vi];
        const ent = toLocalYmd(v.data_entrada);
        const sai = toLocalYmd(v.data_saida);
        if (ent && ent >= mStart && ent <= mEnd) e++;
        if (sai && sai >= mStart && sai <= mEnd) {
          s++;
          daysOut.push(stayDays(v, sai));
        }
      }
      ent12.push(e);
      sai12.push(s);
      stay12.push(
        daysOut.length
          ? daysOut.reduce(function (a, b) {
              return a + b;
            }, 0) / daysOut.length
          : 0
      );
      let rev = 0;
      for (let rj = 0; rj < receivables.length; rj++) {
        const r = receivables[rj];
        if (!isFaturado(r)) continue;
        const veh = (snapshot.vehicles || []).find(function (x) {
          return String(x.id) === String(r.vehicle_id);
        });
        const fat = faturamentoYmd(r, veh);
        if (fat && fat >= mStart && fat <= mEnd) rev += Number(r.valor || 0);
      }
      rec12.push(rev);
    }

    // carteira
    const counts = {
      em_guarda: 0,
      aguardando_documentacao: 0,
      aguardando_autorizacao: 0,
      liberados: 0,
      entregues: 0,
    };
    for (let ci = 0; ci < vehicles.length; ci++) {
      const v = vehicles[ci];
      const st = classifyPortfolio(v);
      if (st === "entregues") {
        const saiY = toLocalYmd(v.data_saida);
        if (saiY && saiY >= range.from) counts.entregues++;
      } else if (isOnPatio(v)) {
        counts[st]++;
      }
    }
    counts.entregues = saidasPeriodo;
    const carteiraTotal =
      counts.em_guarda +
        counts.aguardando_documentacao +
        counts.aguardando_autorizacao +
        counts.liberados +
        counts.entregues || 1;
    const carteira = Object.keys(PORTFOLIO_LABELS).map(function (key) {
      return {
        key: key,
        label: PORTFOLIO_LABELS[key],
        count: counts[key],
        pct: (counts[key] / carteiraTotal) * 100,
      };
    });

    const veiculosRows = onPatio
      .map(function (v) {
        return {
          vehicleId: String(v.id),
          placa: v.placa || "—",
          modelo: [v.marca, v.modelo].filter(Boolean).join(" ") || "—",
          dataEntrada: formatYmdBr(toLocalYmd(v.data_entrada)),
          diasNoPatio: stayDays(v, asOf),
          status: statusLabel(v),
          valorAcumulado: valorAcumulado(v, asOf),
        };
      })
      .sort(function (a, b) {
        return b.diasNoPatio - a.diasNoPatio;
      });

    const rankingPermanencia = veiculosRows.slice(0, 20);

    // movements
    const events = (snapshot.events || []).filter(function (ev) {
      return finVehicleIds.has(String(ev.vehicle_id || ""));
    });
    let ultimasMovimentacoes = events
      .map(function (ev) {
        const veh =
          vmap.get(String(ev.vehicle_id)) ||
          (snapshot.vehicles || []).find(function (x) {
            return String(x.id) === String(ev.vehicle_id);
          });
        const at = ev.data_evento || ev.created_at || "";
        return {
          data: formatYmdBr(toLocalYmd(at)),
          placa: (veh && veh.placa) || "—",
          evento: eventLabel(ev.tipo),
          usuario: ev.responsavel || "—",
          at: String(at),
        };
      })
      .filter(function (x) {
        return x.at;
      })
      .sort(function (a, b) {
        return b.at.localeCompare(a.at);
      })
      .slice(0, 20);

    if (!ultimasMovimentacoes.length) {
      const derived = [];
      for (let di = 0; di < vehicles.length; di++) {
        const v = vehicles[di];
        const ent = toLocalYmd(v.data_entrada);
        if (ent && ent >= range.from && ent <= range.to) {
          derived.push({
            data: formatYmdBr(ent),
            placa: v.placa || "—",
            evento: "Recebimento",
            usuario: v.responsavel_financeiro_nome || "—",
            at: String(v.data_entrada || ""),
          });
        }
        const sai = toLocalYmd(v.data_saida);
        if (sai && sai >= range.from && sai <= range.to) {
          derived.push({
            data: formatYmdBr(sai),
            placa: v.placa || "—",
            evento: "Entrega",
            usuario: v.responsavel_financeiro_nome || "—",
            at: String(v.data_saida || ""),
          });
        }
      }
      ultimasMovimentacoes = derived
        .sort(function (a, b) {
          return b.at.localeCompare(a.at);
        })
        .slice(0, 20);
    }

    // permanence map
    const bucketsDef = [
      { key: "0_15", label: "Até 15 dias", min: 0, max: 15 },
      { key: "16_30", label: "16 a 30 dias", min: 16, max: 30 },
      { key: "31_60", label: "31 a 60 dias", min: 31, max: 60 },
      { key: "61_90", label: "61 a 90 dias", min: 61, max: 90 },
      { key: "90p", label: "Mais de 90 dias", min: 91, max: 99999 },
    ];
    const bucketCounts = bucketsDef.map(function (b) {
      return Object.assign({}, b, { count: 0 });
    });
    for (let bi = 0; bi < onPatio.length; bi++) {
      const d = stayDays(onPatio[bi], asOf);
      const b = bucketCounts.find(function (x) {
        return d >= x.min && d <= x.max;
      });
      if (b) b.count++;
    }
    const bucketTotal = onPatio.length || 1;
    const mapaPermanencia = bucketCounts.map(function (b) {
      return {
        key: b.key,
        label: b.label,
        count: b.count,
        pct: (b.count / bucketTotal) * 100,
      };
    });

    // alerts
    let d30 = 0;
    let d60 = 0;
    let d90 = 0;
    let libWait = 0;
    let noDocs = 0;
    let pendOps = 0;
    for (let ai = 0; ai < onPatio.length; ai++) {
      const v = onPatio[ai];
      const d = stayDays(v, asOf);
      if (d > 90) d90++;
      else if (d > 60) d60++;
      else if (d > 30) d30++;
      if (isLiberado(v)) libWait++;
      if (missingDocs(v)) noDocs++;
      if (String(v.status || "") === "LIBERACAO_SOLICITADA" || missingDocs(v) || !v.valor_diaria) pendOps++;
    }
    const alerts = [];
    function push(id, priority, title, detail, count) {
      if (count > 0) alerts.push({ id: id, priority: priority, title: title, detail: detail, count: count });
    }
    push("d30", "yellow", "Acima de 30 dias", "Veículos com permanência superior a 30 dias", d30);
    push("d60", "yellow", "Acima de 60 dias", "Veículos com permanência superior a 60 dias", d60);
    push("d90", "red", "Acima de 90 dias", "Veículos com permanência superior a 90 dias", d90);
    push("lib", "yellow", "Liberados aguardando retirada", "Veículos liberados ainda no pátio", libWait);
    push("docs", "red", "Sem documentação", "NF-e pendente ou remoção solicitada", noDocs);
    push("pend", "yellow", "Pendências operacionais", "Autorização, documentação ou conferência", pendOps);
    if (!alerts.length) {
      alerts.push({
        id: "ok",
        priority: "green",
        title: "Carteira estável",
        detail: "Nenhum alerta para esta financeira",
        count: 0,
      });
    }

    // financial indicators
    const curYm = yearMonthFromYmd(asOf);
    const yearFrom = `${asOf.slice(0, 4)}-01-01`;
    let receitaMes = 0;
    let receitaAno = 0;
    for (let fi = 0; fi < receivables.length; fi++) {
      const r = receivables[fi];
      if (!isFaturado(r)) continue;
      const veh = (snapshot.vehicles || []).find(function (x) {
        return String(x.id) === String(r.vehicle_id);
      });
      const fat = faturamentoYmd(r, veh);
      const val = Number(r.valor || 0);
      if (fat && yearMonthFromYmd(fat) === curYm) receitaMes += val;
      if (fat && fat >= yearFrom && fat <= asOf) receitaAno += val;
    }
    const veiculosFaturados = new Set(
      receivables.filter(isFaturado).map(function (r) {
        return String(r.vehicle_id || r.id);
      })
    );
    const ticketMedio = veiculosFaturados.size > 0 ? receitaGerada / veiculosFaturados.size : 0;
    const totalDiasGuarda = onPatio.reduce(function (s, v) {
      return s + stayDays(v, asOf);
    }, 0);
    const acumuladoAtivos = onPatio.reduce(function (s, v) {
      return s + valorAcumulado(v, asOf);
    }, 0);
    const receitaMediaPorDia = totalDiasGuarda > 0 ? acumuladoAtivos / totalDiasGuarda : 0;
    const valorMedioArmazenado = onPatio.length > 0 ? acumuladoAtivos / onPatio.length : 0;

    return {
      filters: filters,
      asOfYmd: asOf,
      financeiraNome: financeiraNome,
      hasFinanceira: true,
      kpis: {
        veiculosAtivos: onPatio.length,
        entradasPeriodo: entradasPeriodo,
        saidasPeriodo: saidasPeriodo,
        tempoMedioPermanencia: tempoMedio,
        receitaGerada: receitaGerada,
        valorEmAberto: valorEmAberto,
      },
      entradasSaidas12m: { labels: labels12, entradas: ent12, saidas: sai12 },
      tempoMedio12m: { labels: labels12, values: stay12 },
      receitaMensal12m: { labels: labels12, values: rec12 },
      carteira: carteira,
      veiculos: veiculosRows,
      ultimasMovimentacoes: ultimasMovimentacoes,
      alerts: alerts,
      mapaPermanencia: mapaPermanencia,
      rankingPermanencia: rankingPermanencia,
      indicadoresFinanceiros: {
        receitaMes: receitaMes,
        receitaAno: receitaAno,
        ticketMedioPorVeiculo: ticketMedio,
        receitaMediaPorDiaGuarda: receitaMediaPorDia,
        valorMedioPorVeiculoArmazenado: valorMedioArmazenado,
      },
    };
  };

  // ——— Service ———
  function FinancialPartnerDashboardService(repository, metrics) {
    this.repository = repository || new FinancialPartnerRepository();
    this.metrics = metrics || new FinancialPartnerMetrics();
    this.cache = null;
  }

  FinancialPartnerDashboardService.prototype.invalidateCache = function invalidateCache() {
    this.cache = null;
  };

  FinancialPartnerDashboardService.prototype.getMetricsFromSnapshot = function getMetricsFromSnapshot(raw, filters) {
    const snapshot = this.repository.fromSnapshot(raw || {});
    const merged = Object.assign({}, DEFAULT_FP_FILTERS, filters || {});
    const key = [
      (snapshot.vehicles || []).length,
      (snapshot.partners || []).length,
      (snapshot.receivables || []).length,
      (snapshot.events || []).length,
      snapshot.asOfYmd || "",
      merged.period,
      merged.financeiraId,
      merged.status,
      String(merged.search || "")
        .trim()
        .toLowerCase(),
    ].join("|");
    if (this.cache && this.cache.key === key) return this.cache.result;
    const result = this.metrics.compute(snapshot, merged);
    this.cache = { key: key, result: result };
    return result;
  };

  const financialPartnerDashboardService = new FinancialPartnerDashboardService();

  global.FinancialPartnerTypes = { DEFAULT_FP_FILTERS: DEFAULT_FP_FILTERS, PORTFOLIO_LABELS: PORTFOLIO_LABELS };
  global.FinancialPartnerRepository = FinancialPartnerRepository;
  global.FinancialPartnerMetrics = FinancialPartnerMetrics;
  global.FinancialPartnerDashboardService = FinancialPartnerDashboardService;
  global.financialPartnerDashboardService = financialPartnerDashboardService;
  global.valorAcumulado = valorAcumulado;
  global.fpToLocalYmd = toLocalYmd;
  global.fpTodayYmd = todayYmd;
})(typeof window !== "undefined" ? window : globalThis);

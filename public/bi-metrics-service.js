/**
 * BI Metrics Service (browser runtime).
 * Espelho de lib/bi-executivo/*
 * Sem I/O. Sem SQL por card.
 */
(function biMetricsServiceModule(global) {
  "use strict";

  var DEFAULT_BI_FILTERS = {
    period: "30d",
    financeiraId: "",
    parceiroId: "",
    cidade: "",
    estado: "",
    status: "",
    tipoVeiculo: "",
  };

  var GEO_NA = "Não informado";
  var TIPO_NA = "Não classificado";

  var PERM_BUCKETS = [
    { key: "0_15", label: "0–15 dias", min: 0, max: 15 },
    { key: "16_30", label: "16–30 dias", min: 16, max: 30 },
    { key: "31_60", label: "31–60 dias", min: 31, max: 60 },
    { key: "61_90", label: "61–90 dias", min: 61, max: 90 },
    { key: "90p", label: "Acima de 90", min: 91, max: 1e9 },
  ];

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
      return (
        value.getFullYear() +
        "-" +
        String(value.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(value.getDate()).padStart(2, "0")
      );
    }
    var s = String(value).trim();
    if (isCalendarYmd(s)) return s;
    var d = new Date(s.indexOf("T") >= 0 ? s : s.slice(0, 10) + "T12:00:00");
    if (Number.isNaN(d.getTime())) return null;
    return toLocalYmd(d);
  }

  function todayYmd(now) {
    return toLocalYmd(now || new Date());
  }

  function ymdToDate(ymd) {
    return new Date(ymd + "T12:00:00");
  }

  function addDaysYmd(ymd, days) {
    var d = ymdToDate(ymd);
    d.setDate(d.getDate() + days);
    return toLocalYmd(d);
  }

  function yearMonthFromYmd(ymd) {
    return ymd.slice(0, 7);
  }

  function monthStartYm(ym) {
    return ym + "-01";
  }

  function monthEndYm(ym) {
    var parts = ym.split("-").map(Number);
    var y = parts[0];
    var m = parts[1];
    var last = new Date(y, m, 0).getDate();
    return y + "-" + String(m).padStart(2, "0") + "-" + String(last).padStart(2, "0");
  }

  function labelYm(ym) {
    return ym.slice(5) + "/" + ym.slice(2, 4);
  }

  function lastNMonths(asOf, n) {
    var out = [];
    for (var i = n - 1; i >= 0; i--) {
      var d = ymdToDate(asOf);
      d.setMonth(d.getMonth() - i);
      out.push(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"));
    }
    return out;
  }

  function emptyDual(labels, aLabel, bLabel) {
    if (aLabel === undefined) aLabel = "A";
    if (bLabel === undefined) bLabel = "B";
    return {
      labels: labels,
      a: labels.map(function () {
        return 0;
      }),
      b: labels.map(function () {
        return 0;
      }),
      aLabel: aLabel,
      bLabel: bLabel,
    };
  }

  function emptyNumber(labels) {
    return {
      labels: labels,
      values: labels.map(function () {
        return 0;
      }),
    };
  }

  function topSeriesPoints(map, labelOf, limit) {
    if (limit === undefined) limit = 20;
    return Array.from(map.entries())
      .sort(function (a, b) {
        return b[1] - a[1];
      })
      .slice(0, limit)
      .map(function (entry) {
        return { id: entry[0], label: labelOf(entry[0]), value: entry[1] };
      });
  }

  function sumMap(map) {
    var s = 0;
    map.forEach(function (v) {
      s += v;
    });
    return s;
  }

  function resolvePeriod(period, asOf) {
    var curYm = yearMonthFromYmd(asOf);
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
        return { from: asOf.slice(0, 4) + "-01-01", to: asOf };
      case "24m":
        return { from: addDaysYmd(asOf, -729), to: asOf };
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

  function stayDays(v, asOf) {
    var ent = toLocalYmd(v.data_entrada);
    if (!ent) return 0;
    var end = v.data_saida ? toLocalYmd(v.data_saida) : asOf;
    if (!end || end < ent) return 0;
    return Math.max(1, Math.ceil((ymdToDate(end).getTime() - ymdToDate(ent).getTime()) / 86400000));
  }

  function valorAcumulado(v, asOf) {
    if (asOf === undefined) asOf = todayYmd();
    if (!v || !v.data_entrada || !v.valor_diaria) return 0;
    return stayDays(v, asOf) * Number(v.valor_diaria || 0);
  }

  function partnerName(map, id) {
    if (!id) return "—";
    var p = map.get(String(id));
    return (p && p.nome) || "—";
  }

  function resolveCidade(v, p) {
    var raw = v.cidade || (p && p.cidade) || "";
    var s = String(raw || "").trim();
    if (s) return s;
    var obs = String(v.observacoes || "");
    var m = obs.match(/\bcidade\s*[:=]\s*([A-Za-zÀ-ÿ\s\-']{2,40})/i);
    if (m) return m[1].trim();
    return GEO_NA;
  }

  function resolveEstado(v, p) {
    var raw = v.estado || v.uf || (p && p.estado) || (p && p.uf) || "";
    var s = String(raw || "")
      .trim()
      .toUpperCase();
    if (/^[A-Z]{2}$/.test(s)) return s;
    if (s) return s;
    var obs = String(v.observacoes || "");
    var m = obs.match(/\b(?:UF|estado)\s*[:=]\s*([A-Z]{2})\b/i);
    if (m) return m[1].toUpperCase();
    return GEO_NA;
  }

  function resolveTipoVeiculo(v) {
    if (v.tipo_veiculo && String(v.tipo_veiculo).trim()) return String(v.tipo_veiculo).trim();
    var hay = (v.marca || "") + " " + (v.modelo || "");
    hay = hay.toLowerCase();
    if (/moto|motocic|scooter|cg\s|biz\s|pop\s|yamaha|honda\s*cg|harley/.test(hay)) return "Moto";
    if (/caminh[aã]o|truck|hr\s|iveco|volvo\s*fh|scania|mercedes\s*actros/.test(hay)) return "Caminhão";
    if (/utilit|van\s|sprinter|master|ducato|kombi|fiorino|saveiro|strada|montana/.test(hay)) return "Utilitário";
    if (hay.trim()) return "Automóvel";
    return TIPO_NA;
  }

  function isFaturado(r) {
    if (!r || Number(r.valor || 0) <= 0) return false;
    var st = String(r.status || "").toUpperCase();
    if (st === "PAGO") return true;
    if (r.financeiro_aprovado_contas_receber === true) return true;
    if (!r.vehicle_id && st === "EM_ABERTO") return true;
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
    return toLocalYmd(
      (v && v.data_saida) || r.period_end || r.data_vencimento || r.created_at
    );
  }

  function permBucketKey(days) {
    for (var i = 0; i < PERM_BUCKETS.length; i++) {
      var b = PERM_BUCKETS[i];
      if (days >= b.min && days <= b.max) return b.key;
    }
    return "90p";
  }

  function uniqOptions(items) {
    var seen = new Set();
    var out = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!it.id || seen.has(it.id)) continue;
      seen.add(it.id);
      out.push({ id: it.id, label: it.label || it.id });
    }
    out.sort(function (a, b) {
      return a.label.localeCompare(b.label, "pt-BR");
    });
    return out;
  }

  function avg(nums) {
    if (!nums.length) return 0;
    return nums.reduce(function (a, b) {
      return a + b;
    }, 0) / nums.length;
  }

  function maxOf(nums, floor) {
    var m = floor != null ? floor : 0;
    for (var i = 0; i < nums.length; i++) {
      if (nums[i] > m) m = nums[i];
    }
    return m;
  }

  function eventYmd(e) {
    return toLocalYmd(e.data_evento || e.created_at);
  }

  function classifyEventStage(tipo) {
    var t = String(tipo || "").toUpperCase();
    if (/ENTRADA|RECEB|CHECK.?IN|CADASTRO/.test(t)) return "recebimento";
    if (/CONFER/.test(t)) return "conferencia";
    if (/VISTOR/.test(t)) return "vistoria";
    if (/LIBERACAO_SOLICITADA|LIBERA/.test(t) && !/CONFIRM/.test(t)) return "liberacao";
    if (/LIBERACAO_CONFIRMADA|REMOCAO_CONFIRMADA|ENTREGA|SAIDA|REMOVIDO/.test(t)) return "entrega";
    return null;
  }

  class BIRepository {
    fromSnapshot(input) {
      input = input || {};
      var settings = Object.assign({}, input.settings || {});
      if (input.metaReceitaMensal != null) {
        settings.metaReceitaMensal = Number(input.metaReceitaMensal) || 0;
      }
      if (input.metaReceitaNome != null) {
        settings.metaReceitaNome = String(input.metaReceitaNome || "");
      }
      return {
        vehicles: asArray(input.vehicles),
        partners: asArray(input.partners),
        receivables: asArray(input.receivables),
        events: asArray(input.events),
        settings: settings,
        asOfYmd: input.asOfYmd,
      };
    }
  }

  class BIMetrics {
    compute(snapshot, filtersIn) {
    var filters = Object.assign({}, DEFAULT_BI_FILTERS, filtersIn || {});
    var asOf = (snapshot.asOfYmd && toLocalYmd(snapshot.asOfYmd)) || todayYmd();
    var range = resolvePeriod(filters.period, asOf);
    var partners = snapshot.partners || [];
    var pmap = new Map(
      partners.map(function (p) {
        return [String(p.id), p];
      })
    );
    var allVehicles = snapshot.vehicles || [];
    var allReceivables = snapshot.receivables || [];
    var events = snapshot.events || [];
    var capacity = Math.max(
      1,
      Number((snapshot.settings && snapshot.settings.capacidade_patio) || 0) || 100
    );

    var cidadeOf = function (v) {
      return resolveCidade(v, pmap.get(String(v.localizador_id || "")));
    };
    var estadoOf = function (v) {
      return resolveEstado(v, pmap.get(String(v.localizador_id || "")));
    };
    var tipoOf = function (v) {
      return resolveTipoVeiculo(v);
    };

    var filterOptions = {
      financeiras: uniqOptions(
        partners.map(function (p) {
          return { id: String(p.id), label: String(p.nome || p.id) };
        })
      ),
      parceiros: uniqOptions(
        partners.map(function (p) {
          return { id: String(p.id), label: String(p.nome || p.id) };
        })
      ),
      cidades: uniqOptions(
        allVehicles.map(function (v) {
          return { id: cidadeOf(v), label: cidadeOf(v) };
        })
      ),
      estados: uniqOptions(
        allVehicles.map(function (v) {
          return { id: estadoOf(v), label: estadoOf(v) };
        })
      ),
      statusList: uniqOptions(
        allVehicles.map(function (v) {
          var s = String(v.status || "SEM_STATUS");
          return { id: s, label: s };
        })
      ),
      tiposVeiculo: uniqOptions(
        allVehicles.map(function (v) {
          return { id: tipoOf(v), label: tipoOf(v) };
        })
      ),
    };

    var vehicles = allVehicles.slice();
    if (filters.financeiraId) {
      vehicles = vehicles.filter(function (v) {
        return String(v.localizador_id || "") === filters.financeiraId;
      });
    }
    if (filters.parceiroId) {
      var pid = filters.parceiroId;
      vehicles = vehicles.filter(function (v) {
        return (
          String(v.localizador_id || "") === pid ||
          String(v.leiloeiro_id || "") === pid ||
          String(v.responsavel_financeiro_id || "") === pid
        );
      });
    }
    if (filters.cidade) {
      vehicles = vehicles.filter(function (v) {
        return cidadeOf(v) === filters.cidade;
      });
    }
    if (filters.estado) {
      vehicles = vehicles.filter(function (v) {
        return estadoOf(v) === filters.estado;
      });
    }
    if (filters.status) {
      vehicles = vehicles.filter(function (v) {
        return String(v.status || "") === filters.status;
      });
    }
    if (filters.tipoVeiculo) {
      vehicles = vehicles.filter(function (v) {
        return tipoOf(v) === filters.tipoVeiculo;
      });
    }

    var vIds = new Set(
      vehicles.map(function (v) {
        return String(v.id);
      })
    );
    var vmap = new Map(
      vehicles.map(function (v) {
        return [String(v.id), v];
      })
    );
    var receivables = allReceivables.filter(function (r) {
      return r.vehicle_id && vIds.has(String(r.vehicle_id));
    });
    var onPatio = vehicles.filter(isOnPatio);

    var entradasPeriodo = vehicles.filter(function (v) {
      var y = toLocalYmd(v.data_entrada);
      return !!(y && y >= range.from && y <= range.to);
    });
    var saidasPeriodo = vehicles.filter(function (v) {
      var y = toLocalYmd(v.data_saida);
      return !!(y && y >= range.from && y <= range.to);
    });

    var receitaPeriodo = 0;
    var contasReceber = 0;
    var receitaByFin = new Map();
    var receitaByCidade = new Map();
    var receitaByEstado = new Map();
    var receitaByVehicle = new Map();
    var receitaByDay = new Map();
    var receitaByYm = new Map();

    for (var ri = 0; ri < receivables.length; ri++) {
      var r = receivables[ri];
      var val = Number(r.valor || 0);
      var v = r.vehicle_id ? vmap.get(String(r.vehicle_id)) : undefined;
      if (isAberto(r)) contasReceber += val;
      if (!isFaturado(r)) continue;
      var fat = faturamentoYmd(r, v);
      if (!fat || fat < range.from || fat > range.to) continue;
      receitaPeriodo += val;
      var fin = String((v && v.localizador_id) || "_sem_");
      receitaByFin.set(fin, (receitaByFin.get(fin) || 0) + val);
      if (v) {
        receitaByCidade.set(cidadeOf(v), (receitaByCidade.get(cidadeOf(v)) || 0) + val);
        receitaByEstado.set(estadoOf(v), (receitaByEstado.get(estadoOf(v)) || 0) + val);
        receitaByVehicle.set(String(v.id), (receitaByVehicle.get(String(v.id)) || 0) + val);
      }
      receitaByDay.set(fat, (receitaByDay.get(fat) || 0) + val);
      var ym = yearMonthFromYmd(fat);
      receitaByYm.set(ym, (receitaByYm.get(ym) || 0) + val);
    }

    var stayList = onPatio
      .map(function (v) {
        return stayDays(v, asOf);
      })
      .filter(function (d) {
        return d > 0;
      });
    var tempoMedio = avg(stayList);
    var ocupacaoPct = Math.min(100, (onPatio.length / capacity) * 100);
    var finAtivas = new Set(
      onPatio
        .map(function (v) {
          return String(v.localizador_id || "");
        })
        .filter(Boolean)
    ).size;
    var veiculosComReceita = Array.from(receitaByVehicle.keys()).length;
    var receitaMediaVeiculo = veiculosComReceita ? receitaPeriodo / veiculosComReceita : 0;
    var diasPeriodo = Math.max(
      1,
      Math.ceil((ymdToDate(range.to).getTime() - ymdToDate(range.from).getTime()) / 86400000) + 1
    );
    var receitaMediaDia = receitaPeriodo / diasPeriodo;

    function kpi(key, label, value, format, meta) {
      return { key: key, label: label, value: value, format: format, meta: meta };
    }

    var months24 = lastNMonths(asOf, 24);
    var labels24 = months24.map(labelYm);
    var ent24 = emptyDual(labels24, "Entradas", "Saídas");
    var rec24 = emptyNumber(labels24);
    var occ24 = emptyNumber(labels24);
    var stay24 = emptyNumber(labels24);

    months24.forEach(function (ym, i) {
      var mStart = monthStartYm(ym);
      var mEnd = monthEndYm(ym);
      var e = 0;
      var s = 0;
      var stays = [];
      var onPatioApprox = 0;
      for (var vi = 0; vi < vehicles.length; vi++) {
        var veh = vehicles[vi];
        var ent = toLocalYmd(veh.data_entrada);
        var sai = toLocalYmd(veh.data_saida);
        if (ent && ent >= mStart && ent <= mEnd) e++;
        if (sai && sai >= mStart && sai <= mEnd) {
          s++;
          if (ent) {
            stays.push(stayDays(Object.assign({}, veh, { data_saida: sai }), sai));
          }
        }
        if (ent && ent <= mEnd && (!sai || sai > mEnd)) onPatioApprox++;
      }
      ent24.a[i] = e;
      ent24.b[i] = s;
      rec24.values[i] = receitaByYm.get(ym) || 0;
      var monthRec = 0;
      for (var mri = 0; mri < receivables.length; mri++) {
        var mr = receivables[mri];
        if (!isFaturado(mr)) continue;
        var mvv = mr.vehicle_id ? vmap.get(String(mr.vehicle_id)) : undefined;
        var mfat = faturamentoYmd(mr, mvv);
        if (mfat && mfat >= mStart && mfat <= mEnd) monthRec += Number(mr.valor || 0);
      }
      rec24.values[i] = monthRec;
      occ24.values[i] = Math.min(100, (onPatioApprox / capacity) * 100);
      stay24.values[i] = avg(stays.length ? stays : stayList.slice(0, 0));
      if (!stays.length) {
        var presentDays = [];
        for (var pvi = 0; pvi < vehicles.length; pvi++) {
          var pv = vehicles[pvi];
          var pent = toLocalYmd(pv.data_entrada);
          var psai = toLocalYmd(pv.data_saida);
          if (pent && pent <= mEnd && (!psai || psai > mStart)) {
            presentDays.push(stayDays(pv, mEnd < asOf ? mEnd : asOf));
          }
        }
        stay24.values[i] = avg(presentDays);
      }
    });

    var finStats = new Map();
    for (var fsi = 0; fsi < vehicles.length; fsi++) {
      var fv = vehicles[fsi];
      var fid = String(fv.localizador_id || "_sem_");
      var fst = finStats.get(fid) || { veiculos: 0, receita: 0, stays: [], movs: 0 };
      if (isOnPatio(fv)) {
        fst.veiculos++;
        fst.stays.push(stayDays(fv, asOf));
      }
      var fent = toLocalYmd(fv.data_entrada);
      var fsai = toLocalYmd(fv.data_saida);
      if (fent && fent >= range.from && fent <= range.to) fst.movs++;
      if (fsai && fsai >= range.from && fsai <= range.to) fst.movs++;
      finStats.set(fid, fst);
    }
    receitaByFin.forEach(function (val, fin) {
      var st = finStats.get(fin) || { veiculos: 0, receita: 0, stays: [], movs: 0 };
      st.receita = val;
      finStats.set(fin, st);
    });
    var totalRecFin = sumMap(receitaByFin) || 1;
    var ranking = Array.from(finStats.entries())
      .map(function (entry) {
        var id = entry[0];
        var st = entry[1];
        return {
          id: id,
          nome: id === "_sem_" ? "Sem financeira" : partnerName(pmap, id),
          veiculos: st.veiculos,
          receita: st.receita,
          tempoMedio: avg(st.stays),
          ticketMedio: st.veiculos ? st.receita / Math.max(1, st.veiculos) : st.receita,
          movimentacoes: st.movs,
          participacaoPct: (st.receita / totalRecFin) * 100,
        };
      })
      .sort(function (a, b) {
        return b.receita - a.receita || b.veiculos - a.veiculos;
      });

    var receitaTop20 = ranking.slice(0, 20).map(function (r) {
      return { id: r.id, label: r.nome, value: r.receita };
    });
    var pizzaTotal =
      ranking.reduce(function (s, r) {
        return s + r.receita;
      }, 0) || 1;
    var participacaoPizza = ranking.slice(0, 8).map(function (r) {
      return {
        key: r.id,
        label: r.nome,
        count: r.veiculos,
        value: r.receita,
        pct: (r.receita / pizzaTotal) * 100,
      };
    });

    var top5 = ranking.slice(0, 5);
    var months12 = lastNMonths(asOf, 12);
    var evolucaoMensal = {
      labels: months12.map(labelYm),
      series: top5.map(function (fin) {
        return {
          id: fin.id,
          name: fin.nome,
          values: months12.map(function (ym) {
            var mStart = monthStartYm(ym);
            var mEnd = monthEndYm(ym);
            var s = 0;
            for (var evi = 0; evi < receivables.length; evi++) {
              var er = receivables[evi];
              if (!isFaturado(er)) continue;
              var evv = er.vehicle_id ? vmap.get(String(er.vehicle_id)) : undefined;
              if (String((evv && evv.localizador_id) || "_sem_") !== fin.id) continue;
              var efat = faturamentoYmd(er, evv);
              if (efat && efat >= mStart && efat <= mEnd) s += Number(er.valor || 0);
            }
            return s;
          }),
        };
      }),
    };

    var distCounts = new Map();
    for (var bi = 0; bi < PERM_BUCKETS.length; bi++) {
      distCounts.set(PERM_BUCKETS[bi].key, 0);
    }
    var histMap = new Map();
    var heatMap = new Map();
    var heatFins = new Set();

    for (var opi = 0; opi < onPatio.length; opi++) {
      var ov = onPatio[opi];
      var d = stayDays(ov, asOf);
      var bk = permBucketKey(d);
      distCounts.set(bk, (distCounts.get(bk) || 0) + 1);
      var bin = Math.min(180, Math.floor(d / 5) * 5);
      histMap.set(bin, (histMap.get(bin) || 0) + 1);
      var hfin = String(ov.localizador_id || "_sem_");
      heatFins.add(hfin);
      var hk = hfin + "|" + bk;
      heatMap.set(hk, (heatMap.get(hk) || 0) + 1);
    }
    var distTotal = onPatio.length || 1;
    var distribuicao = PERM_BUCKETS.map(function (b) {
      return {
        key: b.key,
        label: b.label,
        count: distCounts.get(b.key) || 0,
        value: distCounts.get(b.key) || 0,
        pct: ((distCounts.get(b.key) || 0) / distTotal) * 100,
      };
    });
    var histograma = Array.from(histMap.entries())
      .sort(function (a, b) {
        return a[0] - b[0];
      })
      .map(function (entry) {
        return { label: entry[0] + "–" + (entry[0] + 4), value: entry[1], id: String(entry[0]) };
      });

    var heatFinList = Array.from(heatFins)
      .map(function (id) {
        return { id: id, label: id === "_sem_" ? "Sem financeira" : partnerName(pmap, id) };
      })
      .sort(function (a, b) {
        return a.label.localeCompare(b.label, "pt-BR");
      })
      .slice(0, 15);
    var heatmap = [];
    for (var hfi = 0; hfi < heatFinList.length; hfi++) {
      var hf = heatFinList[hfi];
      for (var hbi = 0; hbi < PERM_BUCKETS.length; hbi++) {
        var hb = PERM_BUCKETS[hbi];
        heatmap.push({
          rowId: hf.id,
          rowLabel: hf.label,
          colKey: hb.key,
          colLabel: hb.label,
          value: heatMap.get(hf.id + "|" + hb.key) || 0,
        });
      }
    }

    var top50 = onPatio
      .map(function (v) {
        return {
          vehicleId: String(v.id),
          placa: String(v.placa || "—"),
          modelo: [v.marca, v.modelo].filter(Boolean).join(" ") || "—",
          financeira: partnerName(pmap, v.localizador_id),
          dias: stayDays(v, asOf),
          status: String(v.status || "—"),
          valorAcumulado: valorAcumulado(v, asOf),
        };
      })
      .sort(function (a, b) {
        return b.dias - a.dias;
      })
      .slice(0, 50);

    var weekFrom = addDaysYmd(asOf, -6);
    var monthFrom = monthStartYm(yearMonthFromYmd(asOf));
    var yearFrom = asOf.slice(0, 4) + "-01-01";
    var recDia = 0;
    var recSem = 0;
    var recMes = 0;
    var recAno = 0;
    var recAcum = 0;
    for (var rpi = 0; rpi < receivables.length; rpi++) {
      var rp = receivables[rpi];
      if (!isFaturado(rp)) continue;
      var rpv = rp.vehicle_id ? vmap.get(String(rp.vehicle_id)) : undefined;
      var rpfat = faturamentoYmd(rp, rpv);
      if (!rpfat) continue;
      var rpval = Number(rp.valor || 0);
      recAcum += rpval;
      if (rpfat === asOf) recDia += rpval;
      if (rpfat >= weekFrom && rpfat <= asOf) recSem += rpval;
      if (rpfat >= monthFrom && rpfat <= asOf) recMes += rpval;
      if (rpfat >= yearFrom && rpfat <= asOf) recAno += rpval;
    }

    var days30 = [];
    for (var di = 29; di >= 0; di--) days30.push(addDaysYmd(asOf, -di));
    var diariaSeries = {
      labels: days30.map(function (d) {
        return d.slice(8);
      }),
      values: days30.map(function (d) {
        var s = 0;
        for (var dsi = 0; dsi < receivables.length; dsi++) {
          var dr = receivables[dsi];
          if (!isFaturado(dr)) continue;
          var dvv = dr.vehicle_id ? vmap.get(String(dr.vehicle_id)) : undefined;
          if (faturamentoYmd(dr, dvv) === d) s += Number(dr.valor || 0);
        }
        return s;
      }),
    };
    var run = 0;
    var acumuladaSeries = {
      labels: days30.map(function (d) {
        return d.slice(8);
      }),
      values: diariaSeries.values.map(function (v) {
        run += v;
        return run;
      }),
    };
    var thisYear = asOf.slice(0, 4);
    var prevYear = String(Number(thisYear) - 1);
    var monthsY = [];
    for (var mi = 1; mi <= 12; mi++) {
      monthsY.push(String(mi).padStart(2, "0"));
    }
    var comparativoAnual = {
      labels: monthsY.map(function (m) {
        return m;
      }),
      a: monthsY.map(function (m) {
        var cym = thisYear + "-" + m;
        var s = 0;
        for (var cai = 0; cai < receivables.length; cai++) {
          var car = receivables[cai];
          if (!isFaturado(car)) continue;
          var cav = car.vehicle_id ? vmap.get(String(car.vehicle_id)) : undefined;
          var cfat = faturamentoYmd(car, cav);
          if (cfat && yearMonthFromYmd(cfat) === cym) s += Number(car.valor || 0);
        }
        return s;
      }),
      b: monthsY.map(function (m) {
        var pym = prevYear + "-" + m;
        var s = 0;
        for (var cbi = 0; cbi < receivables.length; cbi++) {
          var cbr = receivables[cbi];
          if (!isFaturado(cbr)) continue;
          var cbv = cbr.vehicle_id ? vmap.get(String(cbr.vehicle_id)) : undefined;
          var cbfat = faturamentoYmd(cbr, cbv);
          if (cbfat && yearMonthFromYmd(cbfat) === pym) s += Number(cbr.valor || 0);
        }
        return s;
      }),
      aLabel: thisYear,
      bLabel: prevYear,
    };

    var metaValor = Number((snapshot.settings && snapshot.settings.metaReceitaMensal) || 0);
    var metaVsRealizado =
      metaValor > 0
        ? {
            meta: metaValor,
            realizado: recMes,
            pct: (recMes / metaValor) * 100,
            nome: (snapshot.settings && snapshot.settings.metaReceitaNome) || "Meta mensal",
          }
        : null;

    var entradasPorDia = {
      labels: days30.map(function (d) {
        return d.slice(8);
      }),
      values: days30.map(function (d) {
        return vehicles.filter(function (v) {
          return toLocalYmd(v.data_entrada) === d;
        }).length;
      }),
    };
    var saidasPorDia = {
      labels: days30.map(function (d) {
        return d.slice(8);
      }),
      values: days30.map(function (d) {
        return vehicles.filter(function (v) {
          return toLocalYmd(v.data_saida) === d;
        }).length;
      }),
    };
    var entradasPorMes = {
      labels: months12.map(labelYm),
      values: months12.map(function (ym) {
        var a = monthStartYm(ym);
        var b = monthEndYm(ym);
        return vehicles.filter(function (v) {
          var y = toLocalYmd(v.data_entrada);
          return y && y >= a && y <= b;
        }).length;
      }),
    };
    var saidasPorMes = {
      labels: months12.map(labelYm),
      values: months12.map(function (ym) {
        var a = monthStartYm(ym);
        var b = monthEndYm(ym);
        return vehicles.filter(function (v) {
          var y = toLocalYmd(v.data_saida);
          return y && y >= a && y <= b;
        }).length;
      }),
    };
    var movByCidade = new Map();
    var movByFin = new Map();
    var movVehicles = entradasPeriodo.concat(saidasPeriodo);
    for (var mvi = 0; mvi < movVehicles.length; mvi++) {
      var mv = movVehicles[mvi];
      movByCidade.set(cidadeOf(mv), (movByCidade.get(cidadeOf(mv)) || 0) + 1);
      var mvfin = String(mv.localizador_id || "_sem_");
      movByFin.set(mvfin, (movByFin.get(mvfin) || 0) + 1);
    }

    var stageOrder = [
      { key: "recebimento", label: "Recebimento → Conferência" },
      { key: "conferencia", label: "Conferência → Vistoria" },
      { key: "vistoria", label: "Vistoria → Liberação" },
      { key: "liberacao", label: "Liberação → Entrega" },
    ];
    var byVehicleEvents = new Map();
    for (var ei = 0; ei < events.length; ei++) {
      var ev = events[ei];
      if (!ev.vehicle_id || !vIds.has(String(ev.vehicle_id))) continue;
      var stage = classifyEventStage(ev.tipo);
      var ey = eventYmd(ev);
      if (!stage || !ey) continue;
      var elist = byVehicleEvents.get(String(ev.vehicle_id)) || [];
      elist.push({ stage: stage, ymd: ey });
      byVehicleEvents.set(String(ev.vehicle_id), elist);
    }
    for (var evi = 0; evi < vehicles.length; evi++) {
      var evv = vehicles[evi];
      var vlist = byVehicleEvents.get(String(evv.id)) || [];
      var eventEnt = toLocalYmd(evv.data_entrada);
      if (eventEnt && !vlist.some(function (x) { return x.stage === "recebimento"; })) {
        vlist.push({ stage: "recebimento", ymd: eventEnt });
      }
      var vis = toLocalYmd(evv.vistoria_data);
      if (vis && !vlist.some(function (x) { return x.stage === "vistoria"; })) {
        vlist.push({ stage: "vistoria", ymd: vis });
      }
      var esai = toLocalYmd(evv.data_saida);
      if (esai && !vlist.some(function (x) { return x.stage === "entrega"; })) {
        vlist.push({ stage: "entrega", ymd: esai });
      }
      if (vlist.length) byVehicleEvents.set(String(evv.id), vlist);
    }

    var gaps = {
      recebimento: [],
      conferencia: [],
      vistoria: [],
      liberacao: [],
    };
    var chain = ["recebimento", "conferencia", "vistoria", "liberacao", "entrega"];
    byVehicleEvents.forEach(function (list) {
      var first = {};
      for (var li = 0; li < list.length; li++) {
        var item = list[li];
        if (!first[item.stage] || item.ymd < first[item.stage]) first[item.stage] = item.ymd;
      }
      for (var ci = 0; ci < chain.length - 1; ci++) {
        var ca = first[chain[ci]];
        var cb = first[chain[ci + 1]];
        if (ca && cb && cb >= ca) {
          var days = Math.max(
            0,
            Math.ceil((ymdToDate(cb).getTime() - ymdToDate(ca).getTime()) / 86400000)
          );
          gaps[chain[ci]].push(days);
        }
      }
    });
    var estagios = stageOrder.map(function (s) {
      return {
        key: s.key,
        label: s.label,
        avgDays: avg(gaps[s.key] || []),
        sample: (gaps[s.key] || []).length,
      };
    });
    var gargalos = estagios.slice().sort(function (a, b) {
      return b.avgDays - a.avgDays;
    });

    var alertas = [];
    function pushAlert(id, priority, title, detail, count) {
      alertas.push({ id: id, priority: priority, title: title, detail: detail, count: count });
    }
    var above90 = onPatio.filter(function (v) {
      return stayDays(v, asOf) > 90;
    });
    if (above90.length) {
      pushAlert(
        "perm90",
        "red",
        "Veículos acima de 90 dias",
        above90.length + " veículo(s) com permanência crítica.",
        above90.length
      );
    }
    var finsComMov = new Set();
    for (var fmi = 0; fmi < vehicles.length; fmi++) {
      var fmv = vehicles[fmi];
      var fment = toLocalYmd(fmv.data_entrada);
      var fmsai = toLocalYmd(fmv.data_saida);
      if (
        (fment && fment >= range.from && fment <= range.to) ||
        (fmsai && fmsai >= range.from && fmsai <= range.to)
      ) {
        if (fmv.localizador_id) finsComMov.add(String(fmv.localizador_id));
      }
    }
    var finsSemMov = filterOptions.financeiras.filter(function (f) {
      return !finsComMov.has(f.id);
    });
    if (finsSemMov.length) {
      pushAlert(
        "fin_idle",
        "yellow",
        "Financeiras sem movimentação",
        finsSemMov.length + " financeira(s) sem entradas/saídas no período.",
        finsSemMov.length
      );
    }
    var prevFrom = addDaysYmd(range.from, -diasPeriodo);
    var prevTo = addDaysYmd(range.from, -1);
    var prevRec = 0;
    for (var pri = 0; pri < receivables.length; pri++) {
      var pr = receivables[pri];
      if (!isFaturado(pr)) continue;
      var prv = pr.vehicle_id ? vmap.get(String(pr.vehicle_id)) : undefined;
      var prfat = faturamentoYmd(pr, prv);
      if (prfat && prfat >= prevFrom && prfat <= prevTo) prevRec += Number(pr.valor || 0);
    }
    if (prevRec > 0 && receitaPeriodo < prevRec * 0.85) {
      pushAlert(
        "rec_drop",
        "red",
        "Queda de receita",
        "Receita do período " + ((receitaPeriodo / prevRec) * 100).toFixed(0) + "% do período anterior.",
        1
      );
    } else if (prevRec > 0 && receitaPeriodo >= prevRec) {
      pushAlert("rec_ok", "green", "Receita estável/crescente", "Receita no período igual ou acima do anterior.");
    }
    var prevStay = avg(
      vehicles
        .filter(function (v) {
          var sai = toLocalYmd(v.data_saida);
          return !!(sai && sai >= prevFrom && sai <= prevTo);
        })
        .map(function (v) {
          return stayDays(v, toLocalYmd(v.data_saida) || asOf);
        })
    );
    if (prevStay > 0 && tempoMedio > prevStay * 1.15) {
      pushAlert(
        "stay_up",
        "yellow",
        "Aumento do tempo médio de permanência",
        "Tempo médio atual " + tempoMedio.toFixed(1) + "d vs " + prevStay.toFixed(1) + "d no período anterior."
      );
    }
    if (ocupacaoPct < 40) {
      pushAlert("occ_low", "yellow", "Queda de ocupação", "Ocupação atual em " + ocupacaoPct.toFixed(0) + "%.");
    } else if (ocupacaoPct >= 85) {
      pushAlert("occ_high", "red", "Ocupação elevada", "Ocupação atual em " + ocupacaoPct.toFixed(0) + "%.");
    }
    var maxEnt = maxOf(entradasPorDia.values, 0);
    var avgEnt = avg(entradasPorDia.values);
    if (maxEnt >= Math.max(3, avgEnt * 2.5) && maxEnt > 0) {
      pushAlert(
        "peak_in",
        "yellow",
        "Picos de entrada",
        "Dia com até " + maxEnt + " entradas (média " + avgEnt.toFixed(1) + ")."
      );
    }
    var maxSai = maxOf(saidasPorDia.values, 0);
    var avgSai = avg(saidasPorDia.values);
    if (maxSai >= Math.max(3, avgSai * 2.5) && maxSai > 0) {
      pushAlert(
        "peak_out",
        "yellow",
        "Picos de saída",
        "Dia com até " + maxSai + " saídas (média " + avgSai.toFixed(1) + ")."
      );
    }
    var pendCrit = onPatio.filter(function (v) {
      return (
        String(v.nfse_status || "").toUpperCase() === "PENDENTE" ||
        String(v.status || "") === "LIBERACAO_SOLICITADA"
      );
    });
    if (pendCrit.length) {
      pushAlert(
        "pend",
        "red",
        "Pendências críticas",
        pendCrit.length + " veículo(s) com NF pendente ou liberação solicitada.",
        pendCrit.length
      );
    }
    var prioRank = { red: 0, yellow: 1, green: 2 };
    alertas.sort(function (a, b) {
      return prioRank[a.priority] - prioRank[b.priority];
    });

    var drillReceitaPorFinanceira = {
      key: "financeiras",
      label: "Receita por Financeira",
      rows: ranking.map(function (r) {
        return {
          id: r.id,
          label: r.nome,
          value: r.receita,
          format: "money",
          meta: r.veiculos + " veículos",
        };
      }),
    };
    var drillVeiculosPorFinanceira = {};
    var drillFins = ranking.slice(0, 30);
    for (var dfi = 0; dfi < drillFins.length; dfi++) {
      var dfin = drillFins[dfi];
      var rows = vehicles
        .filter(function (v) {
          return String(v.localizador_id || "_sem_") === dfin.id;
        })
        .map(function (v) {
          return {
            id: String(v.id),
            label: (v.placa || "—") + " · " + ([v.marca, v.modelo].filter(Boolean).join(" ") || "—"),
            value: receitaByVehicle.get(String(v.id)) || valorAcumulado(v, asOf),
            format: "money",
            meta: stayDays(v, asOf) + " dias · " + (v.status || "—"),
          };
        })
        .sort(function (a, b) {
          return b.value - a.value;
        })
        .slice(0, 100);
      drillVeiculosPorFinanceira[dfin.id] = {
        key: "veiculos:" + dfin.id,
        label: "Veículos · " + dfin.nome,
        rows: rows,
      };
    }

    return {
      asOfYmd: asOf,
      range: range,
      filterOptions: filterOptions,
      overview: {
        kpis: [
          kpi("ativos", "Veículos armazenados", onPatio.length, "int", "no pátio agora"),
          kpi("entradas", "Entradas no período", entradasPeriodo.length, "int"),
          kpi("saidas", "Saídas no período", saidasPeriodo.length, "int"),
          kpi("tempo", "Tempo médio de permanência", tempoMedio, "days"),
          kpi("receita", "Receita do período", receitaPeriodo, "money"),
          kpi("receber", "Contas a receber", contasReceber, "money"),
          kpi("ocupacao", "Taxa de ocupação", ocupacaoPct, "pct", "cap. " + capacity),
          kpi("fins", "Financeiras ativas", finAtivas, "int"),
          kpi("ticket", "Receita média por veículo", receitaMediaVeiculo, "money"),
          kpi("recdia", "Receita média por dia", receitaMediaDia, "money"),
        ],
        entradasSaidas24m: ent24,
        receitaMensal24m: rec24,
        ocupacaoTimeline: occ24,
        tempoMedioTimeline: stay24,
        receitaPorCidade: topSeriesPoints(receitaByCidade, function (id) {
          return id;
        }, 15),
        receitaPorEstado: topSeriesPoints(receitaByEstado, function (id) {
          return id;
        }, 15),
      },
      financeiras: {
        ranking: ranking,
        receitaTop20: receitaTop20,
        participacaoPizza: participacaoPizza,
        evolucaoMensal: evolucaoMensal,
      },
      permanencia: {
        distribuicao: distribuicao,
        histograma: histograma,
        heatmap: heatmap,
        heatmapCols: PERM_BUCKETS.map(function (b) {
          return { key: b.key, label: b.label };
        }),
        top50: top50,
      },
      receita: {
        kpis: [
          kpi("dia", "Receita diária", recDia, "money", "hoje"),
          kpi("sem", "Receita semanal", recSem, "money", "7 dias"),
          kpi("mes", "Receita mensal", recMes, "money", "mês atual"),
          kpi("ano", "Receita anual", recAno, "money", "ano atual"),
          kpi("acum", "Receita acumulada", recAcum, "money", "histórico filtrado"),
          kpi("ticket", "Ticket médio", receitaMediaVeiculo, "money"),
          kpi("por_veic", "Receita por veículo", receitaMediaVeiculo, "money"),
          kpi(
            "por_fin",
            "Receita por financeira",
            ranking.length ? receitaPeriodo / ranking.length : 0,
            "money",
            "média"
          ),
        ],
        acumulada: acumuladaSeries,
        diaria: diariaSeries,
        comparativoAnual: comparativoAnual,
        metaVsRealizado: metaVsRealizado,
      },
      movimentacao: {
        entradasPorDia: entradasPorDia,
        saidasPorDia: saidasPorDia,
        entradasPorMes: entradasPorMes,
        saidasPorMes: saidasPorMes,
        porCidade: topSeriesPoints(movByCidade, function (id) {
          return id;
        }, 15),
        porFinanceira: topSeriesPoints(
          movByFin,
          function (id) {
            return id === "_sem_" ? "Sem financeira" : partnerName(pmap, id);
          },
          15
        ),
      },
      eficiencia: { estagios: estagios, gargalos: gargalos },
      alertas: alertas,
      drillReceitaPorFinanceira: drillReceitaPorFinanceira,
      drillVeiculosPorFinanceira: drillVeiculosPorFinanceira,
    };
    }
  }

  class BIService {
    constructor(repository, metrics) {
      this.repository = repository || new BIRepository();
      this.metrics = metrics || new BIMetrics();
      this.cache = null;
    }

    invalidateCache() {
      this.cache = null;
    }

    getMetricsFromSnapshot(raw, filters) {
      var snapshot = this.repository.fromSnapshot(raw || {});
      var merged = Object.assign({}, DEFAULT_BI_FILTERS, filters || {});
      var settings = snapshot.settings || {};
      var key = [
        (snapshot.vehicles || []).length,
        (snapshot.partners || []).length,
        (snapshot.receivables || []).length,
        (snapshot.events || []).length,
        snapshot.asOfYmd || "",
        settings.capacidade_patio != null ? settings.capacidade_patio : "",
        settings.metaReceitaMensal != null ? settings.metaReceitaMensal : "",
        merged.period,
        merged.financeiraId,
        merged.parceiroId,
        merged.cidade,
        merged.estado,
        merged.status,
        merged.tipoVeiculo,
      ].join("|");
      if (this.cache && this.cache.key === key) return this.cache.result;
      var result = this.metrics.compute(snapshot, merged);
      this.cache = { key: key, result: result };
      return result;
    }
  }

  var biService = new BIService();

  global.DEFAULT_BI_FILTERS = DEFAULT_BI_FILTERS;
  global.BIRepository = BIRepository;
  global.BIMetrics = BIMetrics;
  global.BIService = BIService;
  global.biService = biService;
})(typeof window !== "undefined" ? window : globalThis);

/**
 * Financial Metrics Service (browser runtime).
 * Espelho de lib/financial-dashboard/* — cálculo único para o Dashboard Financeiro.
 * Sem I/O. Sem SQL por card.
 */
(function financialMetricsServiceModule(global) {
  "use strict";

  const DEFAULT_FINANCIAL_FILTERS = {
    period: "month",
    financeiraId: "",
    parceiroId: "",
    status: "",
    search: "",
    customFrom: "",
    customTo: "",
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

  /** Data de competência do ciclo (YYYY-MM-DD gravado), sem converter UTC para o dia anterior. */
  function toPeriodYmd(value) {
    if (!value) return "";
    if (value instanceof Date) return toLocalYmd(value) || "";
    const s = String(value).trim();
    const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    return toLocalYmd(s) || "";
  }

  function receivableCycleKey(r) {
    if (!r?.vehicle_id) return "";
    const end = toPeriodYmd(r.period_end);
    return end ? `${String(r.vehicle_id)}|${end}` : "";
  }

  function paidReceivableCycleKeySet(receivables) {
    const keys = new Set();
    for (const rec of receivables || []) {
      if (String(rec.status || "").toUpperCase() !== "PAGO") continue;
      const k = receivableCycleKey(rec);
      if (k) keys.add(k);
    }
    return keys;
  }

  function isDuplicateOfPaidReceivableCycle(r, paidKeys) {
    if (!r || String(r.status || "").toUpperCase() === "PAGO") return false;
    const k = receivableCycleKey(r);
    return !!(k && paidKeys.has(k));
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

  function resolvePeriodRange(period, asOf, extra) {
    extra = extra || {};
    const curYm = yearMonthFromYmd(asOf);
    switch (period) {
      case "today":
        return { from: asOf, to: asOf, label: "Hoje" };
      case "7d":
        return { from: addDaysYmd(asOf, -6), to: asOf, label: "Últimos 7 dias" };
      case "30d":
        return { from: addDaysYmd(asOf, -29), to: asOf, label: "Últimos 30 dias" };
      case "month":
        return { from: monthStartYm(curYm), to: monthEndYm(curYm), label: "Este mês" };
      case "prev_month": {
        const prevYm = yearMonthFromYmd(addDaysYmd(monthStartYm(curYm), -1));
        return { from: monthStartYm(prevYm), to: monthEndYm(prevYm), label: "Mês anterior" };
      }
      case "3m": {
        const d = ymdToDate(asOf);
        d.setMonth(d.getMonth() - 2);
        const fromYm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        return { from: monthStartYm(fromYm), to: asOf, label: "3 meses" };
      }
      case "custom": {
        const from = extra.customFrom && isCalendarYmd(extra.customFrom) ? extra.customFrom : monthStartYm(curYm);
        const to = extra.customTo && isCalendarYmd(extra.customTo) ? extra.customTo : asOf;
        return { from: from <= to ? from : to, to: from <= to ? to : from, label: "Personalizado" };
      }
      case "year":
        return { from: `${asOf.slice(0, 4)}-01-01`, to: asOf, label: "Ano atual" };
      default:
        return { from: monthStartYm(curYm), to: asOf, label: "Este mês" };
    }
  }

  function pctChange(current, previous) {
    if (!previous || previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  function trend(current, previous) {
    const pct = pctChange(current, previous);
    return {
      pct,
      label: `${pct >= 0 ? "+" : ""}${pct.toFixed(2).replace(".", ",")}%`,
    };
  }

  function receivableValor(r) {
    return Math.max(0, Number(r?.valor || 0));
  }

  /** Mesma regra do finance-dashboard.js — título faturado/recebido. */
  function isReceivableFaturado(r) {
    if (!r || receivableValor(r) <= 0) return false;
    const st = String(r.status || "").toUpperCase();
    if (st === "PAGO") return true;
    if (r.financeiro_aprovado_contas_receber === true) return true;
    if (!r.vehicle_id && st === "EM_ABERTO") return true;
    return false;
  }

  /**
   * Conta a receber aberta — mesma regra de finance-dashboard.js.
   */
  function isContaReceberAberta(r) {
    if (!r || String(r.status || "").toUpperCase() === "PAGO") return false;
    if (String(r.status || "").toUpperCase() === "CANCELADO") return false;
    if (receivableValor(r) <= 0) return false;
    if (typeof global.receivableAprovadoParaContasReceber === "function" && global.receivableAprovadoParaContasReceber(r)) {
      return true;
    }
    if (r.financeiro_aprovado_contas_receber === true) return true;
    if (!r.vehicle_id && String(r.status || "").toUpperCase() === "EM_ABERTO") return true;
    return false;
  }

  function receivableDueYmd(r) {
    return toLocalYmd(r?.data_vencimento || r?.period_end || r?.created_at);
  }

  function receivableFaturamentoYmd(r, vmap) {
    const v = r.vehicle_id ? vmap.get(String(r.vehicle_id)) : undefined;
    return toLocalYmd(v?.data_saida || r.period_end || r.data_vencimento || r.created_at);
  }

  function buildCashByContaId(cash) {
    const map = new Map();
    for (const m of cash || []) {
      const t = String(m?.tipo_conta || "").toUpperCase();
      if ((t === "RECEBER" || t === "ENTRADA") && m?.conta_id != null) {
        map.set(String(m.conta_id), m);
      }
    }
    return map;
  }

  function recebimentoYmd(r, cashByContaId) {
    if (!r || String(r.status || "").toUpperCase() !== "PAGO") return null;
    const mov = cashByContaId.get(String(r.id));
    if (mov) {
      const ymd = toLocalYmd(mov.data_movimento || mov.created_at);
      if (ymd) return ymd;
    }
    return toLocalYmd(r.updated_at || r.created_at);
  }

  function cashMovValor(m) {
    return Math.max(0, Number(m?.valor || 0));
  }

  function cashIsEntrada(m) {
    const t = String(m?.tipo_conta || "").toUpperCase();
    return t === "RECEBER" || t === "ENTRADA";
  }

  function cashIsSaida(m) {
    const t = String(m?.tipo_conta || "")
      .toUpperCase()
      .replace(/\s/g, "");
    return t === "PAGAR" || t === "SAIDA" || t === "SAÍDA";
  }

  function caixaCompetenciaYmd(m) {
    return toLocalYmd(m?.data_movimento || m?.created_at);
  }

  function rppPartnerId(v) {
    if (!v) return "";
    return String(v.responsavel_financeiro_id || v.localizador_id || "").trim();
  }

  function financeiraIdOf(v) {
    return String(v?.localizador_id || "").trim();
  }

  function partnerName(id, pmap, fallback) {
    if (!id) return fallback || "—";
    return pmap.get(id)?.nome || fallback || "—";
  }

  function daysBetween(from, to) {
    return Math.max(0, Math.floor((ymdToDate(to).getTime() - ymdToDate(from).getTime()) / 86400000));
  }

  function matchesSearch(r, v, pmap, search) {
    const q = String(search || "")
      .trim()
      .toLowerCase();
    if (!q) return true;
    const qNorm = q.replace(/[^a-z0-9]/g, "");
    const finId = financeiraIdOf(v);
    const rpp = rppPartnerId(v);
    const blob = [
      v?.placa,
      v?.marca,
      v?.modelo,
      partnerName(finId, pmap),
      partnerName(rpp, pmap, v?.responsavel_financeiro_nome),
      r.observacoes,
      String(r.valor || ""),
    ]
      .join(" ")
      .toLowerCase();
    const norm = blob.replace(/[^a-z0-9]/g, "");
    return blob.includes(q) || (!!qNorm && norm.includes(qNorm));
  }

  function matchesStatus(r, asOf, status) {
    if (!status) return true;
    const st = String(r.status || "").toUpperCase();
    if (status === "pago") return st === "PAGO";
    if (st === "PAGO") return false;
    const due = receivableDueYmd(r);
    const atrasado = !!(due && due < asOf);
    if (status === "atrasado") return atrasado;
    if (status === "pendente") return !atrasado;
    return true;
  }

  function filterReceivables(snapshot, filters, asOf) {
    const vmap = new Map((snapshot.vehicles || []).map((v) => [String(v.id), v]));
    const pmap = new Map((snapshot.partners || []).map((p) => [String(p.id), p]));
    const finId = String(filters.financeiraId || "").trim();
    const parcId = String(filters.parceiroId || "").trim();

    return (snapshot.receivables || []).filter((r) => {
      const v = r.vehicle_id ? vmap.get(String(r.vehicle_id)) : undefined;
      if (finId && financeiraIdOf(v) !== finId) return false;
      if (parcId && rppPartnerId(v) !== parcId) return false;
      if (!matchesStatus(r, asOf, filters.status)) return false;
      if (!matchesSearch(r, v, pmap, filters.search || "")) return false;
      return true;
    });
  }

  // ——— Repository ———
  function FinancialRepository() {}
  FinancialRepository.prototype.fromSnapshot = function fromSnapshot(input) {
    return {
      receivables: Array.isArray(input?.receivables) ? input.receivables : [],
      cash: Array.isArray(input?.cash) ? input.cash : [],
      vehicles: Array.isArray(input?.vehicles) ? input.vehicles : [],
      partners: Array.isArray(input?.partners) ? input.partners : [],
      asOfYmd: input?.asOfYmd,
    };
  };

  // ——— Metrics ———
  function FinancialMetricsService() {}
  FinancialMetricsService.prototype.compute = function compute(snapshot, filtersInput) {
    const filters = Object.assign({}, DEFAULT_FINANCIAL_FILTERS, filtersInput || {});
    const asOf = snapshot.asOfYmd || todayYmd();
    const range = resolvePeriodRange(filters.period, asOf, filters);
    const vmap = new Map((snapshot.vehicles || []).map((v) => [String(v.id), v]));
    const pmap = new Map((snapshot.partners || []).map((p) => [String(p.id), p]));
    const cashByConta = buildCashByContaId(snapshot.cash || []);
    const receivables = filterReceivables(snapshot, filters, asOf);
    const paidCycleKeys = paidReceivableCycleKeySet(snapshot.receivables);

    const abertas = receivables.filter(
      (r) => isContaReceberAberta(r) && !isDuplicateOfPaidReceivableCycle(r, paidCycleKeys)
    );
    const totalAberto = abertas.reduce((s, r) => s + receivableValor(r), 0);

    const curYm = yearMonthFromYmd(asOf);
    const monthStart = monthStartYm(curYm);
    const prevYm = yearMonthFromYmd(addDaysYmd(monthStart, -1));
    const prevStart = monthStartYm(prevYm);
    const prevEnd = monthEndYm(prevYm);

    let recebidoMes = 0;
    let pagamentosMes = 0;
    let recebidoMesAnt = 0;
    let recebidoPeriodo = 0;
    let pagamentosPeriodo = 0;
    let recebidosHoje = 0;
    for (const r of receivables) {
      const rec = recebimentoYmd(r, cashByConta);
      if (!rec) continue;
      const val = receivableValor(r);
      if (rec >= monthStart && rec <= asOf) {
        recebidoMes += val;
        pagamentosMes += 1;
      }
      if (rec >= prevStart && rec <= prevEnd) {
        recebidoMesAnt += val;
      }
      if (rec >= range.from && rec <= range.to) {
        recebidoPeriodo += val;
        pagamentosPeriodo += 1;
      }
      if (rec === asOf) recebidosHoje += 1;
    }

    let entradasPeriodo = 0;
    let saidasPeriodo = 0;
    for (const mov of snapshot.cash || []) {
      const ymd = caixaCompetenciaYmd(mov);
      if (!ymd || ymd < range.from || ymd > range.to) continue;
      const val = cashMovValor(mov);
      if (cashIsEntrada(mov)) entradasPeriodo += val;
      else if (cashIsSaida(mov)) saidasPeriodo += val;
    }
    const resultadoPeriodo = entradasPeriodo - saidasPeriodo;

    let receitaPeriodo = 0;
    let receitaPrevPeriodo = 0;
    const periodDays =
      Math.round((ymdToDate(range.to).getTime() - ymdToDate(range.from).getTime()) / 86400000) + 1;
    const prevTo = addDaysYmd(range.from, -1);
    const prevFrom = addDaysYmd(prevTo, -(periodDays - 1));
    for (const r of receivables) {
      if (!isReceivableFaturado(r)) continue;
      const fat = receivableFaturamentoYmd(r, vmap);
      if (!fat) continue;
      const val = receivableValor(r);
      if (fat >= range.from && fat <= range.to) receitaPeriodo += val;
      if (fat >= prevFrom && fat <= prevTo) receitaPrevPeriodo += val;
    }

    const vencidos = abertas.filter((r) => {
      const due = receivableDueYmd(r);
      return !!(due && due < asOf);
    });
    const totalVencido = vencidos.reduce((s, r) => s + receivableValor(r), 0);
    const inadPct = totalAberto > 0 ? (totalVencido / totalAberto) * 100 : 0;

    let faturamentosPeriodo = 0;
    for (const r of receivables) {
      if (!isReceivableFaturado(r)) continue;
      const fat = receivableFaturamentoYmd(r, vmap);
      if (fat && fat >= range.from && fat <= range.to) faturamentosPeriodo += 1;
    }
    const ticketMedio = faturamentosPeriodo > 0 ? receitaPeriodo / faturamentosPeriodo : 0;

    const previsao = abertas
      .filter((r) => {
        const due = receivableDueYmd(r);
        return !!(due && due > asOf);
      })
      .reduce((s, r) => s + receivableValor(r), 0);

    const trendReceber = trend(totalAberto, receitaPrevPeriodo || totalAberto * 0.9);

    const labels12 = [];
    const values12 = [];
    for (let i = 11; i >= 0; i--) {
      const d = ymdToDate(asOf);
      d.setMonth(d.getMonth() - i);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      labels12.push(ym.slice(5) + "/" + ym.slice(2, 4));
      const mStart = monthStartYm(ym);
      const mEnd = monthEndYm(ym);
      let sum = 0;
      for (const r of receivables) {
        if (!isReceivableFaturado(r)) continue;
        const fat = receivableFaturamentoYmd(r, vmap);
        if (fat && fat >= mStart && fat <= mEnd) sum += receivableValor(r);
      }
      values12.push(sum);
    }

    const fluxoLabels = [];
    const fluxoEntradas = [];
    const fluxoSaidas = [];
    const fluxoReceb = [];
    const fluxoSaldo = [];
    let saldoAcc = 0;
    for (let i = 11; i >= 0; i--) {
      const d = ymdToDate(asOf);
      d.setMonth(d.getMonth() - i);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      fluxoLabels.push(ym.slice(5) + "/" + ym.slice(2, 4));
      const mStart = monthStartYm(ym);
      const mEnd = monthEndYm(ym);
      let ent = 0;
      let sai = 0;
      for (const m of snapshot.cash || []) {
        const ymd = caixaCompetenciaYmd(m);
        if (!ymd || ymd < mStart || ymd > mEnd) continue;
        const val = cashMovValor(m);
        if (cashIsEntrada(m)) ent += val;
        else if (cashIsSaida(m)) sai += val;
      }
      let receb = 0;
      for (const r of receivables) {
        const rec = recebimentoYmd(r, cashByConta);
        if (rec && rec >= mStart && rec <= mEnd) receb += receivableValor(r);
      }
      saldoAcc += ent - sai;
      fluxoEntradas.push(ent);
      fluxoSaidas.push(sai);
      fluxoReceb.push(receb);
      fluxoSaldo.push(saldoAcc);
    }

    const byFin = new Map();
    for (const r of receivables) {
      if (!isReceivableFaturado(r)) continue;
      const fat = receivableFaturamentoYmd(r, vmap);
      if (!fat || fat < range.from || fat > range.to) continue;
      const v = r.vehicle_id ? vmap.get(String(r.vehicle_id)) : undefined;
      const id = financeiraIdOf(v) || "__sem__";
      const nome = id === "__sem__" ? "Sem financeira" : partnerName(id, pmap);
      const cur = byFin.get(id) || { nome, valor: 0 };
      cur.valor += receivableValor(r);
      byFin.set(id, cur);
    }
    const totalFin = Array.from(byFin.values()).reduce((s, x) => s + x.valor, 0) || 1;
    const receitaPorFinanceira = Array.from(byFin.entries())
      .map(([id, x]) => ({ id, nome: x.nome, valor: x.valor, pct: (x.valor / totalFin) * 100 }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 10);

    const openByFin = new Map();
    for (const r of abertas) {
      const v = r.vehicle_id ? vmap.get(String(r.vehicle_id)) : undefined;
      const id = financeiraIdOf(v) || "__sem__";
      const nome = id === "__sem__" ? "Sem financeira" : partnerName(id, pmap);
      const cur = openByFin.get(id) || { financeira: nome, veiculos: new Set(), valor: 0, dias: [] };
      if (r.vehicle_id) cur.veiculos.add(String(r.vehicle_id));
      cur.valor += receivableValor(r);
      const due = receivableDueYmd(r);
      const ref = toLocalYmd(r.created_at || r.period_start) || due;
      if (ref) cur.dias.push(daysBetween(ref, asOf));
      openByFin.set(id, cur);
    }
    const maioresContas = Array.from(openByFin.values())
      .map((x) => ({
        financeira: x.financeira,
        veiculos: x.veiculos.size,
        valor: x.valor,
        diasMedios: x.dias.length ? x.dias.reduce((a, b) => a + b, 0) / x.dias.length : 0,
      }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 10);

    const ultimosRecebimentos = receivables
      .map((r) => {
        const rec = recebimentoYmd(r, cashByConta);
        if (!rec) return null;
        const v = r.vehicle_id ? vmap.get(String(r.vehicle_id)) : undefined;
        const fin = partnerName(financeiraIdOf(v), pmap);
        return {
          data: rec,
          financeira: fin,
          descricao: v?.placa ? `Recebimento ${v.placa}` : r.observacoes || "Recebimento",
          valor: receivableValor(r),
          situacao: "Recebido",
        };
      })
      .filter((x) => !!x)
      .sort((a, b) => b.data.localeCompare(a.data))
      .slice(0, 15);

    const weekFrom = addDaysYmd(asOf, -6);
    const yearFrom = `${asOf.slice(0, 4)}-01-01`;
    let receitaHoje = 0;
    let receitaSemana = 0;
    let receitaMes = 0;
    let receitaAno = 0;
    const monthMap = new Map();
    for (const r of receivables) {
      if (!isReceivableFaturado(r)) continue;
      const fat = receivableFaturamentoYmd(r, vmap);
      if (!fat) continue;
      const val = receivableValor(r);
      if (fat === asOf) receitaHoje += val;
      if (fat >= weekFrom && fat <= asOf) receitaSemana += val;
      if (fat >= monthStart && fat <= asOf) receitaMes += val;
      if (fat >= yearFrom && fat <= asOf) receitaAno += val;
      const ym = yearMonthFromYmd(fat);
      monthMap.set(ym, (monthMap.get(ym) || 0) + val);
    }
    let receita30 = 0;
    for (const r of receivables) {
      if (!isReceivableFaturado(r)) continue;
      const fat = receivableFaturamentoYmd(r, vmap);
      if (fat && fat >= addDaysYmd(asOf, -29) && fat <= asOf) receita30 += receivableValor(r);
    }
    const receitaMediaDiaria = receita30 / 30;
    const monthTotals = Array.from(monthMap.values());
    const receitaMediaMensal = monthTotals.length
      ? monthTotals.reduce((a, b) => a + b, 0) / monthTotals.length
      : 0;

    const vencendoHojeList = abertas.filter((r) => receivableDueYmd(r) === asOf);
    const in7 = addDaysYmd(asOf, 7);
    const vencendo7 = abertas.filter((r) => {
      const due = receivableDueYmd(r);
      return !!(due && due > asOf && due <= in7);
    });
    const dividaByFin = new Map();
    for (const r of vencidos) {
      const v = r.vehicle_id ? vmap.get(String(r.vehicle_id)) : undefined;
      const id = financeiraIdOf(v) || "__sem__";
      const nome = id === "__sem__" ? "Sem financeira" : partnerName(id, pmap);
      const cur = dividaByFin.get(id) || { nome, valor: 0 };
      cur.valor += receivableValor(r);
      dividaByFin.set(id, cur);
    }
    const alerts = {
      titulosVencidos: { count: vencidos.length, valor: totalVencido },
      recebimentosAtrasados: { count: vencidos.length, valor: totalVencido },
      financeirasMaiorDivida: Array.from(dividaByFin.values())
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 5),
      vencendoHoje: {
        count: vencendoHojeList.length,
        valor: vencendoHojeList.reduce((s, r) => s + receivableValor(r), 0),
      },
      vencendo7Dias: {
        count: vencendo7.length,
        valor: vencendo7.reduce((s, r) => s + receivableValor(r), 0),
      },
    };

    const financeirasMap = new Map();
    const ensureFin = (id, nome) => {
      if (!financeirasMap.has(id)) {
        financeirasMap.set(id, {
          id,
          nome,
          veiculos: new Set(),
          aReceber: 0,
          recebido: 0,
          emAberto: 0,
          vencido: 0,
        });
      }
      return financeirasMap.get(id);
    };
    for (const v of snapshot.vehicles || []) {
      const id = financeiraIdOf(v) || "__sem__";
      const nome = id === "__sem__" ? "Sem financeira" : partnerName(id, pmap);
      ensureFin(id, nome).veiculos.add(String(v.id));
    }
    for (const r of snapshot.receivables || []) {
      const v = r.vehicle_id ? vmap.get(String(r.vehicle_id)) : undefined;
      const id = financeiraIdOf(v) || "__sem__";
      const nome = id === "__sem__" ? "Sem financeira" : partnerName(id, pmap);
      const row = ensureFin(id, nome);
      if (r.vehicle_id) row.veiculos.add(String(r.vehicle_id));
      const st = String(r.status || "").toUpperCase();
      if (st === "CANCELADO" || receivableValor(r) <= 0) continue;
      if (st === "PAGO") {
        const rec = recebimentoYmd(r, cashByConta);
        if (rec && rec >= range.from && rec <= range.to) {
          row.recebido += receivableValor(r);
          row.aReceber += receivableValor(r);
        }
      } else if (isContaReceberAberta(r)) {
        row.emAberto += receivableValor(r);
        row.aReceber += receivableValor(r);
        const due = receivableDueYmd(r);
        if (due && due < asOf) row.vencido += receivableValor(r);
      }
    }
    const financeirasResumo = Array.from(financeirasMap.values())
      .map((x) => ({
        id: x.id,
        nome: x.nome,
        veiculos: x.veiculos.size,
        aReceber: x.aReceber,
        recebido: x.recebido,
        emAberto: x.emAberto,
        vencido: x.vencido,
      }))
      .filter((x) => x.veiculos > 0 || x.aReceber > 0 || x.recebido > 0)
      .sort((a, b) => b.emAberto - a.emAberto || b.aReceber - a.aReceber || String(a.nome).localeCompare(String(b.nome), "pt-BR"));

    return {
      filters,
      range,
      asOfYmd: asOf,
      kpis: {
        contasAReceber: {
          valor: totalAberto,
          titulos: abertas.length,
          trend: trendReceber,
        },
        recebimentosMes: {
          valor: recebidoMes,
          pagamentos: pagamentosMes,
          trend: trend(recebidoMes, recebidoMesAnt),
        },
        recebidoPeriodo: {
          valor: recebidoPeriodo,
          pagamentos: pagamentosPeriodo,
        },
        entradasPeriodo,
        saidasPeriodo,
        resultadoPeriodo,
        receitaAcumulada: {
          valor: receitaPeriodo,
          trend: trend(receitaPeriodo, receitaPrevPeriodo),
        },
        inadimplencia: {
          valor: totalVencido,
          titulos: vencidos.length,
          pctSobreReceber: inadPct,
        },
        ticketMedio,
        previsaoRecebimento: previsao,
      },
      receitaMensal12: { labels: labels12, values: values12 },
      fluxo: {
        labels: fluxoLabels,
        entradas: fluxoEntradas,
        saidas: fluxoSaidas,
        recebimentos: fluxoReceb,
        saldo: fluxoSaldo,
      },
      receitaPorFinanceira,
      maioresContas,
      ultimosRecebimentos,
      financeirasResumo,
      indicadores: {
        receitaHoje,
        receitaSemana,
        receitaMes,
        receitaAno,
        receitaMediaDiaria,
        receitaMediaMensal,
        recebidosHoje,
      },
      alerts,
    };
  };

  // ——— Service ———
  function filtersKey(f) {
    return [
      f.period,
      f.financeiraId || "",
      f.parceiroId || "",
      f.status || "",
      String(f.search || "")
        .trim()
        .toLowerCase(),
      f.customFrom || "",
      f.customTo || "",
    ].join("|");
  }

  function snapshotKey(s) {
    return [
      (s.receivables || []).length,
      (s.cash || []).length,
      (s.vehicles || []).length,
      (s.partners || []).length,
      s.asOfYmd || "",
    ].join(":");
  }

  function FinancialDashboardService(repository, metricsEngine) {
    this.repository = repository || new FinancialRepository();
    this.metrics = metricsEngine || new FinancialMetricsService();
    this.cache = null;
  }

  FinancialDashboardService.prototype.invalidateCache = function invalidateCache() {
    this.cache = null;
  };

  FinancialDashboardService.prototype.getMetricsFromSnapshot = function getMetricsFromSnapshot(raw, filters) {
    const snapshot = this.repository.fromSnapshot(raw || {});
    const merged = Object.assign({}, DEFAULT_FINANCIAL_FILTERS, filters || {});
    const key = `${snapshotKey(snapshot)}|${filtersKey(merged)}`;
    if (this.cache && this.cache.key === key) return this.cache.result;
    const result = this.metrics.compute(snapshot, merged);
    this.cache = { key, result };
    return result;
  };

  const financialDashboardService = new FinancialDashboardService();

  global.FinancialTypes = { DEFAULT_FINANCIAL_FILTERS };
  global.FinancialRepository = FinancialRepository;
  global.FinancialMetricsService = FinancialMetricsService;
  global.FinancialDashboardService = FinancialDashboardService;
  global.financialDashboardService = financialDashboardService;
  /** Alias do singleton no estilo DashboardMetricsService (opcional). */
  global.FinancialDashboardMetricsService = financialDashboardService;
  global.financialToLocalYmd = toLocalYmd;
  global.financialTodayYmd = todayYmd;
  global.isContaReceberAberta = isContaReceberAberta;
  global.isReceivableFaturado = isReceivableFaturado;
  global.toPeriodYmd = toPeriodYmd;
  global.paidReceivableCycleKeySet = paidReceivableCycleKeySet;
  global.isDuplicateOfPaidReceivableCycle = isDuplicateOfPaidReceivableCycle;
})(typeof window !== "undefined" ? window : globalThis);

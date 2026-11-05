/**
 * Extrato de valores gerados pelo pátio.
 * Somente leitura: veículos com data de saída no período, independente da situação financeira.
 */
(function patioExtratoServiceModule(global) {
  "use strict";

  function toPeriodYmd(value) {
    if (typeof global.toPeriodYmd === "function") return global.toPeriodYmd(value) || "";
    if (!value) return "";
    if (value instanceof Date) {
      const y = value.getFullYear();
      const m = String(value.getMonth() + 1).padStart(2, "0");
      const d = String(value.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    const s = String(value).trim();
    const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    return "";
  }

  function moneyNum(v) {
    const n = Number(v || 0);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 100) / 100;
  }

  function ymdInClosedRange(ymd, fromYmd, toYmd) {
    if (!ymd) return false;
    if (fromYmd && ymd < fromYmd) return false;
    if (toYmd && ymd > toYmd) return false;
    return true;
  }

  function vehicleExitedInPeriod(vehicle, fromYmd, toYmd) {
    if (!vehicle) return false;
    const saida = toPeriodYmd(vehicle.data_saida);
    if (!saida) return false;
    return ymdInClosedRange(saida, fromYmd, toYmd);
  }

  function calcStayDays(vehicle) {
    if (typeof global.calcDays === "function") return Math.max(0, Number(global.calcDays(vehicle) || 0));
    if (!vehicle?.data_entrada) return 0;
    const start = new Date(vehicle.data_entrada);
    const end = vehicle.data_saida ? new Date(vehicle.data_saida) : new Date();
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
    return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
  }

  function calcGeneratedValue(vehicle, receivable) {
    if (receivable && receivable.valor != null && receivable.valor !== "") {
      const billed = moneyNum(receivable.valor);
      if (billed > 0) return billed;
    }
    if (typeof global.calcFinanceChargeBreakdown === "function") {
      const br = global.calcFinanceChargeBreakdown(
        vehicle,
        vehicle?.data_entrada,
        vehicle?.data_saida
      );
      return moneyNum(br?.total);
    }
    const days = calcStayDays(vehicle);
    return moneyNum(days * Number(vehicle?.valor_diaria || 0));
  }

  function receivableExitYmd(receivable, vehicle) {
    if (typeof global.financeReceivableSaidaYmd === "function") {
      return global.financeReceivableSaidaYmd(receivable, vehicle) || "";
    }
    return toPeriodYmd(receivable?.period_end || vehicle?.data_saida);
  }

  function receivableMatchesVehicleExit(receivable, vehicle) {
    if (!receivable || !vehicle) return false;
    if (String(receivable.vehicle_id || "") !== String(vehicle.id || "")) return false;
    const exitYmd = toPeriodYmd(vehicle.data_saida);
    const recYmd = toPeriodYmd(receivable.period_end);
    if (!recYmd || !exitYmd) return true;
    return recYmd === exitYmd;
  }

  function rankReceivable(r) {
    if (typeof global.financeReceivableCycleRank === "function") {
      return global.financeReceivableCycleRank(r);
    }
    let score = 0;
    const st = String(r?.status || "").toUpperCase();
    if (st === "PAGO" || st === "RECEBIDO") score += 1e16;
    if (r?.period_end) score += 1e15;
    const ts = new Date(r?.period_end || r?.updated_at || r?.created_at || 0).getTime();
    if (Number.isFinite(ts)) score += ts;
    if (Number(r?.valor || 0) > 0) score += 1e12;
    return score;
  }

  function pickReceivableForVehicle(vehicle, receivables) {
    const list = (receivables || []).filter((r) => receivableMatchesVehicleExit(r, vehicle));
    if (!list.length) return null;
    if (typeof global.financeDedupePatioReceivables === "function") {
      const deduped = global.financeDedupePatioReceivables(list);
      const match = (deduped || []).find((r) => String(r.vehicle_id) === String(vehicle.id));
      if (match) return match;
    }
    return list.slice().sort((a, b) => rankReceivable(b) - rankReceivable(a))[0] || null;
  }

  function liveStatus(receivable, vehicle) {
    if (!receivable) {
      const pst = String(vehicle?.payment_status || "").toUpperCase();
      if (pst === "PAGO" || pst === "RECEBIDO" || pst === "QUITADO") {
        return { code: "pago", label: "Pago" };
      }
      return { code: "aguardando_faturamento", label: "Aguardando faturamento" };
    }
    const st = String(receivable.status || "").trim().toUpperCase();
    const pago =
      st === "PAGO" ||
      st === "RECEBIDO" ||
      st === "BAIXADO" ||
      st === "QUITADO" ||
      (typeof global.financeReceivableJaRecebido === "function" && global.financeReceivableJaRecebido(receivable)) ||
      (typeof global.receivableFluxoFinanceiroQuitado === "function" &&
        global.receivableFluxoFinanceiroQuitado(receivable));
    if (pago) return { code: "pago", label: "Pago" };

    const semCobranca =
      typeof global.receivableSemCobrancaFinanceira === "function" &&
      global.receivableSemCobrancaFinanceira(receivable);
    if (semCobranca) return { code: "sem_cobranca", label: "Sem cobrança" };

    const aguardandoFat =
      typeof global.receivableIsAguardandoFaturamentoFinanceiro === "function" &&
      global.receivableIsAguardandoFaturamentoFinanceiro(receivable);
    if (aguardandoFat) return { code: "aguardando_faturamento", label: "Aguardando faturamento" };

    const emReceber =
      typeof global.receivableIsContaReceberFinanceiro === "function" &&
      global.receivableIsContaReceberFinanceiro(receivable);
    if (emReceber) return { code: "aguardando_pagamento", label: "Aguardando pagamento" };

    const faturado =
      typeof global.receivableFaturamentoConcluido === "function" &&
      global.receivableFaturamentoConcluido(receivable);
    if (faturado) return { code: "faturado", label: "Já faturado" };

    if (st === "EM_ABERTO" || st.indexOf("AGUARDANDO") >= 0) {
      return { code: "aguardando_faturamento", label: "Aguardando faturamento" };
    }
    return { code: "aguardando_faturamento", label: "Aguardando faturamento" };
  }

  function partnerNome(partners, id) {
    if (!id) return "";
    if (typeof global.rppNomeById === "function" && !partners) {
      return String(global.rppNomeById(id) || "").trim();
    }
    const p = (partners || []).find((x) => String(x.id) === String(id));
    return String(p?.nome || "").trim();
  }

  function tomadorNome(vehicle, partners) {
    if (!vehicle) return "—";
    const pid = String(vehicle.responsavel_financeiro_id || vehicle.localizador_id || "").trim();
    if (typeof global.vehicleRpfNome === "function") {
      const n = String(global.vehicleRpfNome(vehicle) || "").trim();
      if (n && n !== "—") return n;
    }
    const nome = partnerNome(partners, pid) || String(vehicle.responsavel_financeiro_nome || "").trim();
    return nome || "—";
  }

  function isReboqueTipo(tipo) {
    const code = String(tipo || "").trim().toUpperCase();
    return (
      code === "EMPRESA_REBOQUE" ||
      code === "REBOQUEIRO_AUTONOMO" ||
      code === "GUINCHEIRO" ||
      code === "TRANSPORTADORA" ||
      code === "PRESTADOR_SERVICO"
    );
  }

  function quemTrouxe(vehicle, ctx) {
    const partners = ctx.partners || [];
    const services = ctx.towServices || [];
    const drivers = ctx.towDrivers || [];
    const svc = services.find(
      (s) => String(s.vehicle_id) === String(vehicle.id) && !s.cancelado
    );
    if (svc) {
      const partner = partners.find((p) => String(p.id) === String(svc.partner_id));
      const driver =
        drivers.find((d) => String(d.id) === String(svc.driver_id)) || null;
      const partnerNomeTxt = String(partner?.nome || "").trim();
      const driverNome = String(driver?.nome || svc.driver_nome || "").trim();
      if (partnerNomeTxt && driverNome && partnerNomeTxt !== driverNome) {
        return `${partnerNomeTxt} (${driverNome})`;
      }
      if (partnerNomeTxt) return partnerNomeTxt;
      if (driverNome) return driverNome;
    }
    const rpv = partners.find((p) => String(p.id) === String(vehicle.localizador_id));
    if (rpv && isReboqueTipo(rpv.tipo)) return String(rpv.nome || "").trim() || "—";
    if (rpv?.nome) return String(rpv.nome).trim();
    return "—";
  }

  function marcaModelo(vehicle) {
    const marca = String(vehicle?.marca || "").trim();
    const modelo = String(vehicle?.modelo || "").trim();
    if (marca && modelo) return `${marca} ${modelo}`;
    return marca || modelo || "—";
  }

  function formatYmdPt(ymd) {
    if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return "—";
    const [y, m, d] = ymd.split("-");
    return `${d}/${m}/${y}`;
  }

  function formatCurrency(v) {
    if (typeof global.formatCurrency === "function") return global.formatCurrency(v);
    return moneyNum(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function defaultPeriod() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const last = new Date(y, now.getMonth() + 1, 0).getDate();
    return {
      fromYmd: `${y}-${m}-01`,
      toYmd: `${y}-${m}-${String(last).padStart(2, "0")}`,
    };
  }

  function emptySummary() {
    return {
      veiculos: 0,
      gerado: 0,
      recebido: 0,
      aguardandoRecebimento: 0,
      aguardandoFaturamento: 0,
      jaFaturado: 0,
    };
  }

  function classifyForSummary(code) {
    if (code === "pago") return "recebido";
    if (code === "aguardando_pagamento" || code === "faturado") return "aguardandoRecebimento";
    return "aguardandoFaturamento";
  }

  function wasBilled(code, receivable) {
    if (code === "aguardando_pagamento" || code === "faturado") return true;
    if (code !== "pago") return false;
    return typeof global.receivableFaturamentoConcluido === "function" && receivable
      ? !!global.receivableFaturamentoConcluido(receivable)
      : false;
  }

  function buildExtrato(input) {
    const fromYmd = toPeriodYmd(input?.fromYmd);
    const toYmd = toPeriodYmd(input?.toYmd);
    const vehicles = Array.isArray(input?.vehicles) ? input.vehicles : [];
    const receivables = Array.isArray(input?.receivables) ? input.receivables : [];
    const partners = Array.isArray(input?.partners) ? input.partners : [];
    const ctx = {
      partners,
      towServices: Array.isArray(input?.towServices) ? input.towServices : [],
      towDrivers: Array.isArray(input?.towDrivers) ? input.towDrivers : [],
    };

    const byId = new Map();
    for (const v of vehicles) {
      if (!vehicleExitedInPeriod(v, fromYmd, toYmd)) continue;
      if (!v?.id) continue;
      const prev = byId.get(String(v.id));
      if (!prev) byId.set(String(v.id), v);
    }

    const rows = [...byId.values()]
      .map((vehicle) => {
        const receivable = pickReceivableForVehicle(vehicle, receivables);
        const sit = liveStatus(receivable, vehicle);
        const valorGerado = calcGeneratedValue(vehicle, receivable);
        const entradaYmd = toPeriodYmd(vehicle.data_entrada);
        const saidaYmd = toPeriodYmd(vehicle.data_saida);
        return {
          vehicleId: vehicle.id,
          placa: String(vehicle.placa || "").trim().toUpperCase() || "—",
          marcaModelo: marcaModelo(vehicle),
          marca: String(vehicle.marca || "").trim() || "—",
          modelo: String(vehicle.modelo || "").trim() || "—",
          entradaYmd,
          saidaYmd,
          entradaLabel: formatYmdPt(entradaYmd),
          saidaLabel: formatYmdPt(saidaYmd),
          diarias: calcStayDays(vehicle),
          valorGerado,
          tomador: tomadorNome(vehicle, partners),
          quemTrouxe: quemTrouxe(vehicle, ctx),
          situacaoCode: sit.code,
          situacaoLabel: sit.label,
          receivableId: receivable?.id || null,
        };
      })
      .sort((a, b) => {
        const bySaida = String(a.saidaYmd).localeCompare(String(b.saidaYmd));
        if (bySaida) return bySaida;
        return String(a.placa).localeCompare(String(b.placa), "pt-BR");
      });

    const summary = emptySummary();
    summary.veiculos = rows.length;
    for (const row of rows) {
      const valor = moneyNum(row.valorGerado);
      summary.gerado = moneyNum(summary.gerado + valor);
      const bucket = classifyForSummary(row.situacaoCode);
      if (bucket === "recebido") summary.recebido = moneyNum(summary.recebido + valor);
      else if (bucket === "aguardandoRecebimento") {
        summary.aguardandoRecebimento = moneyNum(summary.aguardandoRecebimento + valor);
      } else {
        summary.aguardandoFaturamento = moneyNum(summary.aguardandoFaturamento + valor);
      }
      const rec = receivables.find((r) => String(r.id) === String(row.receivableId));
      if (wasBilled(row.situacaoCode, rec)) {
        summary.jaFaturado = moneyNum(summary.jaFaturado + valor);
      }
    }

    return {
      fromYmd,
      toYmd,
      periodoLabel: `${formatYmdPt(fromYmd)} a ${formatYmdPt(toYmd)}`,
      rows,
      summary,
    };
  }

  const patioExtratoService = {
    toPeriodYmd,
    moneyNum,
    formatYmdPt,
    formatCurrency,
    vehicleExitedInPeriod,
    pickReceivableForVehicle,
    liveStatus,
    defaultPeriod,
    buildExtrato,
  };

  global.patioExtratoService = patioExtratoService;
  if (typeof module !== "undefined" && module.exports) module.exports = patioExtratoService;
})(typeof window !== "undefined" ? window : globalThis);

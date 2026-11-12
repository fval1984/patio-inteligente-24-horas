/**
 * Programa Cliente Parceiro — tarifas e fechamento mensal.
 * Não grava no banco. Só calcula faixa e datas a partir dos ciclos já existentes.
 */
(function partnerProgramModule(global) {
  "use strict";

  const TARIFA_CONVENCIONAL = 30;
  const TARIFA_PARCEIRO = 25;
  const TARIFA_10 = 20;
  const TARIFA_15 = 15;

  function isPartnerProgram(partner) {
    const perfil = partner && partner.perfil && typeof partner.perfil === "object" ? partner.perfil : {};
    return perfil.programa_cliente_parceiro === true || perfil.programa_cliente_parceiro === "true";
  }

  function ymd(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function parseYmd(s) {
    const t = String(s || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
    const d = new Date(`${t}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function lastBusinessDayOfMonth(ym) {
    const y = Number(String(ym).slice(0, 4));
    const m = Number(String(ym).slice(5, 7));
    if (!y || !m) return "";
    const d = new Date(y, m, 0, 12, 0, 0);
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
    return ymd(d);
  }

  function dueDateNextMonth15(ym) {
    const y = Number(String(ym).slice(0, 4));
    const m = Number(String(ym).slice(5, 7));
    if (!y || !m) return "";
    const next = m === 12 ? new Date(y + 1, 0, 15, 12, 0, 0) : new Date(y, m, 15, 12, 0, 0);
    return ymd(next);
  }

  function cycleEndYmd(receivable, vehicle) {
    const fromRec = String(receivable?.period_end || "").slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(fromRec)) return fromRec;
    const fromV = String(vehicle?.data_saida || "").slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(fromV)) return fromV;
    const iso = vehicle?.data_saida ? new Date(vehicle.data_saida) : null;
    if (iso && !Number.isNaN(iso.getTime())) return ymd(iso);
    return "";
  }

  function countCyclesInMonth(items, ym) {
    const prefix = String(ym || "").slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(prefix)) return 0;
    const seen = new Set();
    (items || []).forEach((item) => {
      const end = cycleEndYmd(item.receivable || item, item.vehicle);
      if (!end || end.slice(0, 7) !== prefix) return;
      const key = String(item.vehicle_id || item.vehicle?.id || item.receivable?.id || item.id || "");
      if (key) seen.add(key);
      else seen.add(end + ":" + seen.size);
    });
    return seen.size;
  }

  function tariffFor(partner, cyclesInMonth) {
    const n = Number(cyclesInMonth) || 0;
    if (!isPartnerProgram(partner)) {
      return {
        diaria: TARIFA_CONVENCIONAL,
        faixa: "convencional",
        nf: "AMPLIGUARD",
        label: "Cliente convencional · R$ 30,00 / diária · NF AMPLIGUARD",
        cycles: n,
      };
    }
    if (n >= 15) {
      return {
        diaria: TARIFA_15,
        faixa: "parceiro_15",
        nf: "PARCEIRO",
        label: "Cliente parceiro · 15+ ciclos no mês · R$ 15,00 / diária · NF do parceiro",
        cycles: n,
      };
    }
    if (n >= 10) {
      return {
        diaria: TARIFA_10,
        faixa: "parceiro_10",
        nf: "PARCEIRO",
        label: "Cliente parceiro · 10+ ciclos no mês · R$ 20,00 / diária · NF do parceiro",
        cycles: n,
      };
    }
    return {
      diaria: TARIFA_PARCEIRO,
      faixa: "parceiro",
      nf: "PARCEIRO",
      label: "Cliente parceiro · R$ 25,00 / diária · NF do parceiro",
      cycles: n,
    };
  }

  function closingForMonth(ym) {
    return {
      fechamento: lastBusinessDayOfMonth(ym),
      vencimento: dueDateNextMonth15(ym),
    };
  }

  global.partnerProgram = {
    TARIFA_CONVENCIONAL,
    TARIFA_PARCEIRO,
    TARIFA_10,
    TARIFA_15,
    isPartnerProgram,
    lastBusinessDayOfMonth,
    dueDateNextMonth15,
    cycleEndYmd,
    countCyclesInMonth,
    tariffFor,
    closingForMonth,
  };

  if (typeof module === "object" && module.exports) module.exports = global.partnerProgram;
})(typeof window !== "undefined" ? window : globalThis);

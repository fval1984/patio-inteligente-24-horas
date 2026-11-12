/**
 * Regras do histórico público (espelho da função SQL).
 * node public/vehicle-public-history.test.js
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.vehiclePublicHistory = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const TOKEN_RE = /^[0-9a-f]{32,64}$/i;

  function isPublicVehicleToken(token) {
    return TOKEN_RE.test(String(token || "").trim());
  }

  function publicStatusLabel(status) {
    const raw = String(status || "");
    if (raw === "NO_PATIO" || raw === "AGUARDANDO_VISTORIA") return "Em guarda no pátio";
    if (raw === "LIBERACAO_SOLICITADA") return "Solicitação de liberação (VSL)";
    if (raw === "LIBERACAO_CONFIRMADA" || raw === "REMOCAO_CONFIRMADA" || raw === "REMocao_CONFIRMADA") {
      return "Liberação confirmada";
    }
    if (raw === "REMOVIDO") return "Removido / retirado do pátio";
    return raw || "Em guarda no pátio";
  }

  function firstEventAt(events, tipos) {
    const set = {};
    tipos.forEach((t) => {
      set[t] = true;
    });
    let best = null;
    (events || []).forEach((ev) => {
      if (!set[ev.tipo]) return;
      const at = ev.data_evento || ev.created_at || null;
      if (!at) return;
      if (!best || String(at) < best) best = String(at);
    });
    return best;
  }

  function chavePublicLabel(raw) {
    const s = String(raw || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "_")
      .replace(/\//g, "_");
    if (s === "C_CHAVE" || s === "CCHAVE") return { label: "C/CHAVE", cls: "is-c-chave" };
    if (s === "S_CHAVE" || s === "SCHAVE") return { label: "S/CHAVE", cls: "is-s-chave" };
    if (s === "TRANCADO") return { label: "TRANCADO", cls: "is-trancado" };
    return null;
  }

  function splitEntryDateTime(iso, label) {
    if (iso) {
      const d = new Date(String(iso));
      if (!Number.isNaN(d.getTime())) {
        return {
          date: d.toLocaleDateString("pt-BR", { timeZone: "America/Recife" }),
          time: d.toLocaleTimeString("pt-BR", {
            timeZone: "America/Recife",
            hour: "2-digit",
            minute: "2-digit",
          }),
        };
      }
    }
    const text = String(label || "").trim();
    const match = text.match(/^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})/);
    if (match) return { date: match[1], time: match[2] };
    return { date: text || "—", time: "—" };
  }

  function liberationSteps(timeline) {
    const by = {};
    (timeline || []).forEach((item) => {
      if (item && item.code) by[item.code] = item;
    });
    const defs = [
      { code: "EM_GUARDA", title: "Em guarda" },
      { code: "VSL", title: "Liberação solicitada (VSL)" },
      { code: "VSC", title: "Liberação confirmada (VSC)" },
      { code: "VRP", title: "Removido do pátio (VRP)" },
    ];
    const guarda = by.EM_GUARDA || by.REGISTRADO;
    const out = [];
    if (guarda) {
      out.push({
        code: "EM_GUARDA",
        title: defs[0].title,
        at: guarda.at,
        at_label: guarda.at_label || null,
        current: false,
      });
    }
    defs.slice(1).forEach((d) => {
      const hit = by[d.code];
      if (!hit) return;
      out.push({
        code: d.code,
        title: d.title,
        at: hit.at,
        at_label: hit.at_label || null,
        current: false,
      });
    });
    if (out.length) out[out.length - 1].current = true;
    return out;
  }

  function buildPublicTimeline(vehicle, events) {
    const items = [];
    if (vehicle && vehicle.data_entrada) {
      items.push({ code: "REGISTRADO", title: "Veículo registrado no pátio", at: String(vehicle.data_entrada) });
      items.push({ code: "EM_GUARDA", title: "Veículo em guarda no pátio", at: String(vehicle.data_entrada) });
    }
    const vsl = (vehicle && vehicle.liberacao_solicitada_em) || firstEventAt(events, ["LIBERACAO_SOLICITADA"]);
    if (vsl) items.push({ code: "VSL", title: "Solicitação de liberação recebida (VSL)", at: String(vsl) });
    const vsc = (vehicle && vehicle.liberacao_confirmada_em) || firstEventAt(events, ["LIBERACAO_CONFIRMADA"]);
    if (vsc) items.push({ code: "VSC", title: "Liberação confirmada", at: String(vsc) });
    const out = (vehicle && vehicle.data_saida) || firstEventAt(events, ["REMOVIDO", "REMocao_CONFIRMADA"]);
    if (out) items.push({ code: "VRP", title: "Veículo removido ou retirado do pátio", at: String(out) });
    return items;
  }

  return {
    isPublicVehicleToken,
    publicStatusLabel,
    chavePublicLabel,
    splitEntryDateTime,
    liberationSteps,
    buildPublicTimeline,
  };
});

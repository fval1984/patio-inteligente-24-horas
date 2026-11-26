/**
 * Campos de origem da Ficha Tipo 2.
 * Só devolve o que foi gravado no registro de entrada. Não completa com responsável de liberação, remoção, pagamento ou acerto.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.fichaTipo2Origem = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function fichaTipo2OrigemFactory() {
  "use strict";

  function cleanOriginText(value) {
    const text = String(value == null ? "" : value).replace(/\s+/g, " ").trim();
    if (!text) return "";
    if (text === "—" || text === "-" || text === "–") return "";
    if (/^n[aã]o informad[oa]$/i.test(text)) return "";
    if (/^sem (financeira|escrit[oó]rio|p[aá]tio|localizador|parceiro)( informad[oa])?$/i.test(text)) return "";
    if (/^escrit[oó]rio removido$/i.test(text)) return "";
    if (/^sem nome$/i.test(text)) return "";
    return text;
  }

  function origemLocalizador(vehicle) {
    const v = vehicle || {};
    return cleanOriginText(v.localizadorNome) || cleanOriginText(v.quem_trouxe);
  }

  function origemRows(vehicle) {
    const v = vehicle || {};
    return [
      ["Localizador", origemLocalizador(v)],
      ["Pátio", cleanOriginText(v.patioNome)],
      ["Escritório", cleanOriginText(v.escritorioNome)],
      ["Instituição financeira", cleanOriginText(v.financeiraNome)],
    ].filter(function (row) {
      return !!row[1];
    });
  }

  return {
    cleanOriginText: cleanOriginText,
    origemLocalizador: origemLocalizador,
    origemRows: origemRows,
  };
});

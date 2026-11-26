/** Mesmas regras de public/ficha-tipo2-origem.js, para a consulta pública. */

export function cleanOriginText(value: unknown): string {
  const text = String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text === "—" || text === "-" || text === "–") return "";
  if (/^n[aã]o informad[oa]$/i.test(text)) return "";
  if (/^sem (financeira|escrit[oó]rio|p[aá]tio|localizador|parceiro)( informad[oa])?$/i.test(text)) return "";
  if (/^escrit[oó]rio removido$/i.test(text)) return "";
  if (/^sem nome$/i.test(text)) return "";
  return text;
}

export function origemLocalizador(vehicle: { localizadorNome?: string; quem_trouxe?: string } | null | undefined): string {
  const v = vehicle || {};
  return cleanOriginText(v.localizadorNome) || cleanOriginText(v.quem_trouxe);
}

export function origemRows(
  vehicle: {
    localizadorNome?: string;
    quem_trouxe?: string;
    patioNome?: string;
    escritorioNome?: string;
    financeiraNome?: string;
  } | null | undefined
): [string, string][] {
  const v = vehicle || {};
  return (
    [
      ["Localizador", origemLocalizador(v)],
      ["Pátio", cleanOriginText(v.patioNome)],
      ["Escritório", cleanOriginText(v.escritorioNome)],
      ["Instituição financeira", cleanOriginText(v.financeiraNome)],
    ] as [string, string][]
  ).filter((row) => !!row[1]);
}

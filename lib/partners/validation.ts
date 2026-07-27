import { fieldsForTipo, normalizePartnerTipo } from "./fields";
import type { PartnerRecord, PartnerTipoCode } from "./types";

export interface PartnerValidationResult {
  ok: boolean;
  errors: string[];
}

export function validatePartner(input: Partial<PartnerRecord> & { perfil?: Record<string, unknown> }): PartnerValidationResult {
  const errors: string[] = [];
  const tipo = normalizePartnerTipo(input.tipo);
  const nome = String(input.nome || "").trim();
  if (!nome) errors.push("Nome é obrigatório.");
  if (!input.tipo) errors.push("Tipo de Parceiro é obrigatório.");

  const perfil = (input.perfil || {}) as Record<string, unknown>;
  const fields = fieldsForTipo(tipo);
  for (const f of fields) {
    if (!f.required) continue;
    if (f.group === "common") {
      const v = String((input as Record<string, unknown>)[f.key] ?? "").trim();
      if (!v) errors.push(`${f.label} é obrigatório.`);
    } else {
      const v = String(perfil[f.key] ?? "").trim();
      if (!v) errors.push(`${f.label} é obrigatório para ${tipoLabel(tipo)}.`);
    }
  }

  return { ok: errors.length === 0, errors };
}

function tipoLabel(t: PartnerTipoCode): string {
  switch (t) {
    case "INSTITUICAO_FINANCEIRA":
      return "Instituição Financeira";
    case "ASSESSORIA":
      return "Assessoria Jurídica";
    case "GUINCHEIRO":
      return "Guincheiro";
    default:
      return "Localizador";
  }
}

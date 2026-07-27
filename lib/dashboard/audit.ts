/**
 * Auditoria de consistência da Situação Operacional.
 * Veículos no Pátio === soma dos 5 grupos mutuamente exclusivos.
 */

import type { OperationalStatusCounts } from "./types";

export function sumOperationalGroups(ops: OperationalStatusCounts): number {
  return (
    ops.aguardandoConferencia +
    ops.aguardandoVistoria +
    ops.aguardandoAutorizacao +
    ops.liberadosAguardandoRetirada +
    ops.pendenciasDocumentais
  );
}

/**
 * Valida a identidade operacional.
 * Em caso de divergência, registra erro no console e retorna false.
 */
export function auditOperationalConsistency(
  veiculosNoPatio: number,
  operacional: OperationalStatusCounts,
  log: Pick<Console, "error"> = console
): boolean {
  const sum = sumOperationalGroups(operacional);
  if (sum === veiculosNoPatio) return true;

  log.error(
    "[DashboardMetrics:audit] Inconsistência operacional:",
    {
      veiculosNoPatio,
      somaGrupos: sum,
      diferenca: veiculosNoPatio - sum,
      operacional: { ...operacional },
    },
    "Esperado: Veículos no Pátio = Conferência + Vistoria + Autorização + Liberados + Pendências"
  );
  return false;
}

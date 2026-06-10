/** Modo caixa manual: somente movimentações com aprovado_caixa=true entram nos cálculos. */

import {
  MANUAL_CAIXA_RESET_YM,
  cashMovementAprovadoCaixa,
  cashMovementExcluirDoSaldo,
} from "@/lib/finance-cash-meta";

export const FINANCE_MANUAL_CAIXA_SETTING = "finance_manual_caixa_mode";

export type CashMovementLike = {
  aprovado_caixa?: boolean | null;
  excluir_do_saldo?: boolean | null;
  descricao?: string | null;
  created_at?: string | null;
};

export type SettingsLike = {
  finance_manual_caixa_mode?: boolean | null;
  caixa_operational_reset_at?: string | null;
  caixa_opening_balance?: number | null;
  caixa_reset_ym?: string | null;
};

export function isOperationalManualMode(settings: SettingsLike | null | undefined) {
  if (!settings) return false;
  if (settings.finance_manual_caixa_mode === true) return true;
  if (settings.caixa_reset_ym === MANUAL_CAIXA_RESET_YM) return true;
  return !!settings.caixa_operational_reset_at;
}

function operationalResetAtMs(settings: SettingsLike | null | undefined) {
  const raw = settings?.caixa_operational_reset_at;
  if (!raw) return 0;
  const ts = new Date(String(raw)).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

/** Movimentação válida para saldo operacional, fluxo, lucro e dashboards. */
export function isAprovadoCaixa(mov: CashMovementLike | null | undefined, settings?: SettingsLike | null) {
  if (!mov) return false;
  if (isOperationalManualMode(settings)) {
    if (!cashMovementAprovadoCaixa(mov)) return false;
    if (cashMovementExcluirDoSaldo(mov)) return false;
    const resetMs = operationalResetAtMs(settings);
    if (resetMs > 0 && mov.created_at) {
      const movMs = new Date(String(mov.created_at)).getTime();
      if (Number.isFinite(movMs) && movMs < resetMs) return false;
    }
    return true;
  }
  return !cashMovementExcluirDoSaldo(mov);
}

export function openingBalance(settings: SettingsLike | null | undefined) {
  if (!isOperationalManualMode(settings)) return 0;
  return Number(settings?.caixa_opening_balance || 0);
}

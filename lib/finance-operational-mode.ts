/** Modo caixa manual: somente movimentações com aprovado_caixa=true entram nos cálculos. */

export const FINANCE_MANUAL_CAIXA_SETTING = "finance_manual_caixa_mode";

export type CashMovementLike = {
  aprovado_caixa?: boolean | null;
  excluir_do_saldo?: boolean | null;
};

export type SettingsLike = {
  finance_manual_caixa_mode?: boolean | null;
  caixa_operational_reset_at?: string | null;
  caixa_opening_balance?: number | null;
};

export function isOperationalManualMode(settings: SettingsLike | null | undefined) {
  if (!settings) return false;
  if (settings.finance_manual_caixa_mode === true) return true;
  return !!settings.caixa_operational_reset_at;
}

/** Movimentação válida para saldo operacional, fluxo, lucro e dashboards. */
export function isAprovadoCaixa(mov: CashMovementLike | null | undefined, settings?: SettingsLike | null) {
  if (!mov) return false;
  if (isOperationalManualMode(settings)) {
    return mov.aprovado_caixa === true;
  }
  return mov.excluir_do_saldo !== true;
}

export function openingBalance(settings: SettingsLike | null | undefined) {
  if (!isOperationalManualMode(settings)) return 0;
  return Number(settings?.caixa_opening_balance || 0);
}

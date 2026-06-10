/** Metadados de caixa embutidos em cash_movements.descricao quando colunas do schema ainda não existem. */

export const FINANCE_CASH_META_PREFIX = "[[finmeta:";
export const MANUAL_CAIXA_RESET_YM = "MANUAL_CAIXA_V1";

export type CashMetaFlags = {
  aprovado_caixa?: boolean;
  excluir_do_saldo?: boolean;
};

export function unpackCashMetaFromDescricao(descricao: string | null | undefined): {
  meta: CashMetaFlags;
  text: string;
} {
  const raw = String(descricao || "");
  if (!raw.startsWith(FINANCE_CASH_META_PREFIX)) return { meta: {}, text: raw };
  const end = raw.indexOf("]]");
  if (end < 0) return { meta: {}, text: raw };
  const jsonPart = raw.slice(FINANCE_CASH_META_PREFIX.length, end);
  const text = raw.slice(end + 2).trim();
  try {
    const parsed = JSON.parse(jsonPart) as CashMetaFlags;
    return { meta: parsed || {}, text };
  } catch {
    return { meta: {}, text };
  }
}

export function applyCashFlagsToDescricao(
  descricao: string | null | undefined,
  flags: CashMetaFlags
): string {
  const { meta, text } = unpackCashMetaFromDescricao(descricao);
  const next: CashMetaFlags = { ...meta, ...flags };
  return `${FINANCE_CASH_META_PREFIX}${JSON.stringify(next)}]]${text ? text : ""}`;
}

export function cashMovementExcluirDoSaldo(mov: {
  excluir_do_saldo?: boolean | null;
  descricao?: string | null;
}): boolean {
  if (mov.excluir_do_saldo === true) return true;
  const { meta } = unpackCashMetaFromDescricao(mov.descricao);
  return meta.excluir_do_saldo === true;
}

export function cashMovementAprovadoCaixa(mov: {
  aprovado_caixa?: boolean | null;
  descricao?: string | null;
}): boolean {
  if (mov.aprovado_caixa === true) return true;
  const { meta } = unpackCashMetaFromDescricao(mov.descricao);
  return meta.aprovado_caixa === true;
}

import type { SupabaseClient } from "@supabase/supabase-js";

export const FINANCE_META_PREFIX = "[[finmeta:";
export const CAIXA_RESET_CONFIRM_TOKEN = "EXECUTE_CAIXA_RESET";

export type CashMovementRow = {
  id: string;
  user_id: string;
  tipo_conta: string | null;
  conta_id: string | null;
  valor: number | null;
  descricao: string | null;
  data_movimento: string | null;
  forma_pagamento: string | null;
  created_at: string | null;
};

export type ReceivableRow = {
  id: string;
  user_id: string;
  vehicle_id: string | null;
  valor: number | null;
  status: string | null;
  period_end: string | null;
  period_start: string | null;
  observacoes: string | null;
  responsavel_pagamento: string | null;
  forma_pagamento: string | null;
  updated_at: string | null;
  created_at: string | null;
};

export function currentYearMonthLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function toYmd(value: string | null | undefined) {
  if (!value) return "";
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s.includes("T") ? s : `${s.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function yearMonthFromYmd(ymd: string) {
  return ymd && ymd.length >= 7 ? ymd.slice(0, 7) : "";
}

export function firstDayOfYm(ym: string) {
  return /^\d{4}-\d{2}$/.test(ym) ? `${ym}-01` : "";
}

export function lastDayOfYm(ym: string) {
  if (!/^\d{4}-\d{2}$/.test(ym)) return "";
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

function receivableMetaSource(rec: ReceivableRow) {
  return String(rec.observacoes || rec.responsavel_pagamento || "");
}

function metaFromReceivableText(raw: string) {
  if (!raw.startsWith(FINANCE_META_PREFIX)) return {} as { data_pagamento?: string; data_recebimento?: string };
  const end = raw.indexOf("]]");
  if (end < 0) return {};
  try {
    return JSON.parse(raw.slice(FINANCE_META_PREFIX.length, end)) as {
      data_pagamento?: string;
      data_recebimento?: string;
      forma_pagamento?: string;
    };
  } catch {
    return {};
  }
}

export function paidDateFromReceivable(rec: ReceivableRow) {
  const meta = metaFromReceivableText(receivableMetaSource(rec));
  const d = meta?.data_pagamento || meta?.data_recebimento;
  if (d) return toYmd(String(d));
  const period = toYmd(rec.period_end || rec.period_start || "");
  if (period) return period;
  return toYmd(rec.updated_at || rec.created_at);
}

export function formaFromReceivable(rec: ReceivableRow) {
  if (rec.forma_pagamento) return rec.forma_pagamento;
  const meta = metaFromReceivableText(receivableMetaSource(rec));
  return meta.forma_pagamento || "PIX";
}

export function isPaidReceivableInMonth(rec: ReceivableRow, resetYm: string) {
  if (String(rec.status || "").toUpperCase() !== "PAGO") return false;
  if (!(Number(rec.valor || 0) > 0)) return false;
  const paidYmd = paidDateFromReceivable(rec);
  return yearMonthFromYmd(paidYmd) === resetYm;
}

function isSchemaError(message: string) {
  return /column|schema cache|PGRST204|invalid input|enum|22P02|23514|forma_pagamento|descricao|data_movimento|relation|does not exist|PGRST205/i.test(
    message
  );
}

export function backupTableNameForToday() {
  const d = new Date();
  const tag = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `cash_movements_backup_${tag}`;
}

export function buildBackupSql(userId: string, backupTable: string) {
  const uid = userId.replace(/'/g, "''");
  return `-- Backup completo (executar ANTES do DELETE)
CREATE TABLE IF NOT EXISTS public.${backupTable} AS
SELECT * FROM public.cash_movements
WHERE false;

INSERT INTO public.${backupTable}
SELECT * FROM public.cash_movements
WHERE user_id = '${uid}';

SELECT COUNT(*) AS backup_rows FROM public.${backupTable} WHERE user_id = '${uid}';`;
}

export function buildDeleteSql(userId: string) {
  const uid = userId.replace(/'/g, "''");
  return `-- Remove TODAS as movimentações de caixa do usuário (após backup)
DELETE FROM public.cash_movements
WHERE user_id = '${uid}';`;
}

export function buildSettingsResetSql(userId: string, resetYm: string) {
  const uid = userId.replace(/'/g, "''");
  const ym = resetYm.replace(/'/g, "''");
  return `-- Marco inicial do caixa (mês atual)
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS caixa_reset_ym text;

UPDATE public.settings
SET caixa_reset_ym = '${ym}'
WHERE user_id = '${uid}';`;
}

export type CaixaResetPreview = {
  resetYm: string;
  backupTable: string;
  sql: {
    backup: string;
    delete: string;
    insert: string;
    settings: string;
    fullScript: string;
  };
  summary: {
    movementsToRemove: number;
    entradasToRemove: number;
    saidasToRemove: number;
    totalEntradasRemove: number;
    totalSaidasRemove: number;
    receivablesToInsert: number;
    totalReceivablesInsert: number;
  };
  movementsToRemove: CashMovementRow[];
  receivablesToInsert: Array<{
    receivableId: string;
    valor: number;
    paidDate: string;
    formaPagamento: string;
    descricao: string;
    vehiclePlaca: string | null;
  }>;
};

export async function loadCaixaResetPreview(
  supabase: SupabaseClient,
  userId: string,
  resetYm?: string
): Promise<CaixaResetPreview> {
  const ym = (resetYm || currentYearMonthLocal()).trim();
  if (!/^\d{4}-\d{2}$/.test(ym)) {
    throw new Error("resetYm inválido (YYYY-MM).");
  }

  const { data: movs, error: mErr } = await supabase
    .from("cash_movements")
    .select("id,user_id,tipo_conta,conta_id,valor,descricao,data_movimento,created_at")
    .eq("user_id", userId)
    .order("data_movimento", { ascending: true });
  if (mErr) throw new Error(mErr.message);

  const recSelects = [
    "id,user_id,vehicle_id,valor,status,period_end,period_start,observacoes,responsavel_pagamento,forma_pagamento,updated_at,created_at",
    "id,user_id,vehicle_id,valor,status,period_end,period_start,observacoes,responsavel_pagamento,updated_at,created_at",
    "id,user_id,vehicle_id,valor,status,period_end,period_start,responsavel_pagamento,updated_at,created_at",
    "id,user_id,vehicle_id,valor,status,period_end,period_start,updated_at,created_at",
    "id,user_id,vehicle_id,valor,status,period_end,updated_at,created_at",
    "id,user_id,vehicle_id,valor,status,updated_at,created_at",
  ];
  let recs: ReceivableRow[] = [];
  let lastRecErr: string | null = null;
  for (const sel of recSelects) {
    const res = await supabase.from("receivables").select(sel).eq("user_id", userId).eq("status", "PAGO");
    if (!res.error) {
      recs = (res.data || []) as ReceivableRow[];
      lastRecErr = null;
      break;
    }
    lastRecErr = res.error.message;
    if (!isSchemaError(lastRecErr || "")) break;
  }
  if (lastRecErr) throw new Error(lastRecErr);

  const vehicleIds = [...new Set((recs || []).map((r) => r.vehicle_id).filter(Boolean))] as string[];
  const placaByVehicle = new Map<string, string>();
  if (vehicleIds.length) {
    const { data: vehicles } = await supabase.from("vehicles").select("id,placa").eq("user_id", userId).in("id", vehicleIds);
    for (const v of vehicles || []) {
      if (v?.id && v.placa) placaByVehicle.set(String(v.id), String(v.placa));
    }
  }

  const movements = (movs || []) as CashMovementRow[];
  const entradas = movements.filter((m) => {
    const t = String(m.tipo_conta || "").toUpperCase();
    return t === "RECEBER" || t === "ENTRADA";
  });
  const saidas = movements.filter((m) => {
    const t = String(m.tipo_conta || "").toUpperCase();
    return t === "PAGAR" || t === "SAIDA" || t === "SAÍDA";
  });

  const receivablesToInsert = ((recs || []) as ReceivableRow[])
    .filter((r) => isPaidReceivableInMonth(r, ym))
    .map((r) => {
      const paidDate = paidDateFromReceivable(r);
      const placa = r.vehicle_id ? placaByVehicle.get(String(r.vehicle_id)) || null : null;
      const descricao = placa ? `Recebimento ${placa}` : "Recebimento";
      return {
        receivableId: r.id,
        valor: Number(r.valor || 0),
        paidDate,
        formaPagamento: formaFromReceivable(r),
        descricao,
        vehiclePlaca: placa,
      };
    });

  const uidEsc = userId.replace(/'/g, "''");
  const insertLines = receivablesToInsert.map((row) => {
    const desc = row.descricao.replace(/'/g, "''");
    const forma = (row.formaPagamento || "PIX").replace(/'/g, "''");
    return `INSERT INTO public.cash_movements (user_id, tipo_conta, conta_id, valor, descricao, data_movimento, forma_pagamento)
VALUES ('${uidEsc}', 'RECEBER', '${row.receivableId}', ${row.valor.toFixed(2)}, '${desc}', '${row.paidDate}', '${forma}');`;
  });

  const backupTable = backupTableNameForToday();
  const backupSql = buildBackupSql(userId, backupTable);
  const deleteSql = buildDeleteSql(userId);
  const settingsSql = buildSettingsResetSql(userId, ym);
  const insertSql =
    insertLines.length > 0
      ? `-- Recria entradas apenas de recebíveis pagos em ${ym}\n${insertLines.join("\n")}`
      : `-- Nenhum recebível PAGO em ${ym} para recriar no caixa`;

  const fullScript = [
    backupSql,
    "",
    deleteSql,
    "",
    insertSql,
    "",
    settingsSql,
    "",
    `-- Validação
SELECT
  COALESCE(SUM(CASE WHEN UPPER(tipo_conta) IN ('RECEBER','ENTRADA') THEN valor ELSE 0 END), 0)
  - COALESCE(SUM(CASE WHEN UPPER(tipo_conta) IN ('PAGAR','SAIDA','SAÍDA') THEN valor ELSE 0 END), 0) AS saldo_apos_reset
FROM public.cash_movements
WHERE user_id = '${uidEsc}';`,
  ].join("\n");

  return {
    resetYm: ym,
    backupTable,
    sql: {
      backup: backupSql,
      delete: deleteSql,
      insert: insertSql,
      settings: settingsSql,
      fullScript,
    },
    summary: {
      movementsToRemove: movements.length,
      entradasToRemove: entradas.length,
      saidasToRemove: saidas.length,
      totalEntradasRemove: entradas.reduce((s, m) => s + Number(m.valor || 0), 0),
      totalSaidasRemove: saidas.reduce((s, m) => s + Number(m.valor || 0), 0),
      receivablesToInsert: receivablesToInsert.length,
      totalReceivablesInsert: receivablesToInsert.reduce((s, r) => s + r.valor, 0),
    },
    movementsToRemove: movements,
    receivablesToInsert,
  };
}

export async function executeCaixaReset(
  supabase: SupabaseClient,
  userId: string,
  resetYm?: string
) {
  const preview = await loadCaixaResetPreview(supabase, userId, resetYm);
  const backupRunId = `${preview.backupTable}_${Date.now()}`;

  const { data: existingMovs, error: loadErr } = await supabase
    .from("cash_movements")
    .select("*")
    .eq("user_id", userId);
  if (loadErr) throw new Error(`Falha ao carregar movimentos: ${loadErr.message}`);

  const archiveRows = (existingMovs || []).map((row) => ({
    backup_run_id: backupRunId,
    user_id: userId,
    original_id: row.id,
    payload: row,
  }));
  if (archiveRows.length) {
    const { error: archErr } = await supabase.from("cash_movements_archive").insert(archiveRows);
    if (archErr && /relation|does not exist/i.test(archErr.message)) {
      // Schema archive ausente: segue com reset (movimentos já carregados em memória).
    } else if (archErr) {
      throw new Error(`Falha no backup (archive): ${archErr.message}`);
    }
  }

  const { error: delErr } = await supabase.from("cash_movements").delete().eq("user_id", userId);
  if (delErr) throw new Error(`Falha ao apagar movimentos: ${delErr.message}`);

  let inserted = 0;
  let insertFailed = 0;
  for (const row of preview.receivablesToInsert) {
    const payloads = [
      {
        user_id: userId,
        tipo_conta: "RECEBER",
        conta_id: row.receivableId,
        valor: row.valor,
        descricao: row.descricao,
        data_movimento: row.paidDate,
        forma_pagamento: row.formaPagamento,
      },
      {
        user_id: userId,
        tipo_conta: "RECEBER",
        conta_id: row.receivableId,
        valor: row.valor,
        descricao: row.descricao,
        data_movimento: row.paidDate,
      },
    ];
    let ok = false;
    for (const body of payloads) {
      const { error: insErr } = await supabase.from("cash_movements").insert(body);
      if (!insErr) {
        ok = true;
        break;
      }
      if (!isSchemaError(insErr.message || "")) break;
    }
    if (ok) inserted += 1;
    else insertFailed += 1;
  }

  const { data: settings } = await supabase
    .from("settings")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (settings?.id) {
    const { error: setErr } = await supabase
      .from("settings")
      .update({ caixa_reset_ym: preview.resetYm })
      .eq("id", settings.id);
    if (setErr && !isSchemaError(setErr.message || "")) {
      throw new Error(`Falha ao gravar caixa_reset_ym: ${setErr.message}`);
    }
  }

  const { data: afterMovs } = await supabase
    .from("cash_movements")
    .select("tipo_conta,valor,data_movimento")
    .eq("user_id", userId);

  let entradas = 0;
  let saidas = 0;
  for (const m of afterMovs || []) {
    const t = String(m.tipo_conta || "").toUpperCase();
    const v = Number(m.valor || 0);
    if (t === "RECEBER" || t === "ENTRADA") entradas += v;
    else if (t === "PAGAR" || t === "SAIDA" || t === "SAÍDA") saidas += v;
  }

  return {
    ok: true,
    resetYm: preview.resetYm,
    backupRunId,
    backupTable: preview.backupTable,
    backupRowCount: (existingMovs || []).length,
    deleted: preview.summary.movementsToRemove,
    inserted,
    insertFailed,
    saldoAposReset: entradas - saidas,
    entradas,
    saidas,
    movementsAfterReset: afterMovs || [],
  };
}

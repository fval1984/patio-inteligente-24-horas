import type { SupabaseClient } from "@supabase/supabase-js";
import restorePlan from "../public/finance-restore-settled-plan.js";
import paidHistoryEvidence from "./finance-paid-history-evidence.json";

const {
  planFinanceRestoreSettled,
  packFinanceMeta,
  unpackFinanceMeta,
  RESTORE_SETTLED_CONFIRM,
  RESTORE_SETTLED_CUTOFF_ISO,
  RESTORE_SETTLED_CUTOFF_YMD,
  RESTORE_SETTLED_MIGRATION_TYPE,
} = restorePlan as {
  planFinanceRestoreSettled: (snapshot: Record<string, unknown>) => any;
  packFinanceMeta: (meta: Record<string, unknown>, text?: string) => string;
  unpackFinanceMeta: (raw: string) => { meta: Record<string, unknown>; text: string };
  RESTORE_SETTLED_CONFIRM: string;
  RESTORE_SETTLED_CUTOFF_ISO: string;
  RESTORE_SETTLED_CUTOFF_YMD: string;
  RESTORE_SETTLED_MIGRATION_TYPE: string;
};

export {
  planFinanceRestoreSettled,
  RESTORE_SETTLED_CONFIRM,
  RESTORE_SETTLED_CUTOFF_ISO,
  RESTORE_SETTLED_CUTOFF_YMD,
  RESTORE_SETTLED_MIGRATION_TYPE,
};

function isSchemaError(message: string) {
  return /column|schema cache|PGRST204|invalid input|enum|22P02|23514|relation|does not exist|PGRST205|forma_pagamento|data_pagamento|financeiro_aprovado/i.test(
    message || ""
  );
}

async function selectAllForUser(supabase: SupabaseClient, table: string, sel: string, userId: string) {
  const pageSize = 1000;
  let from = 0;
  const all: Record<string, unknown>[] = [];
  while (true) {
    const res = await supabase.from(table).select(sel).eq("user_id", userId).range(from, from + pageSize - 1);
    if (res.error) return { error: res.error, data: all };
    const rows = (res.data || []) as Record<string, unknown>[];
    all.push(...rows);
    if (rows.length < pageSize) return { error: null, data: all };
    from += pageSize;
  }
}

async function selectRows(supabase: SupabaseClient, table: string, selects: string[], userId: string) {
  for (const sel of selects) {
    const res = await selectAllForUser(supabase, table, sel, userId);
    if (!res.error) return res.data || [];
    if (!isSchemaError(res.error.message || "")) throw new Error(`${table}: ${res.error.message}`);
  }
  return [];
}

export async function loadFinanceRestoreSnapshot(supabase: SupabaseClient, userId: string) {
  const [receivables, payables, cash, vehicles, partners] = await Promise.all([
    selectRows(supabase, "receivables", [
      "id,user_id,vehicle_id,valor,status,observacoes,responsavel_pagamento,forma_pagamento,period_start,period_end,financeiro_aprovado_contas_receber,updated_at,created_at",
      "id,user_id,vehicle_id,valor,status,observacoes,responsavel_pagamento,period_end,updated_at,created_at",
      "id,user_id,vehicle_id,valor,status,period_end,updated_at,created_at",
    ], userId),
    selectRows(supabase, "payables", [
      "id,user_id,valor,status,observacoes,descricao,fornecedor,data_vencimento,data_pagamento,forma_pagamento,updated_at,created_at",
      "id,user_id,valor,status,observacoes,descricao,data_vencimento,data_pagamento,updated_at,created_at",
      "id,user_id,valor,status,descricao,updated_at,created_at",
    ], userId),
    selectRows(supabase, "cash_movements", [
      "id,user_id,tipo_conta,conta_id,valor,descricao,data_movimento,forma_pagamento,created_at",
      "id,user_id,tipo_conta,conta_id,valor,data_movimento,created_at",
    ], userId),
    selectRows(supabase, "vehicles", ["id,placa,localizador_id,data_saida,payment_status", "id,placa,localizador_id,data_saida"], userId),
    selectRows(supabase, "partners", ["id,nome"], userId),
  ]);
  let cashArchive: Record<string, unknown>[] = [];
  const arch = await selectAllForUser(
    supabase,
    "cash_movements_archive",
    "original_id,payload,archived_at,created_at",
    userId
  );
  if (!arch.error) cashArchive = arch.data || [];
  return {
    receivables,
    payables,
    cash,
    cashArchive,
    vehicles,
    partners,
    paidHistory: paidHistoryEvidence,
  };
}

export async function buildFinanceRestoreSettledPreview(supabase: SupabaseClient, userId: string) {
  const snapshot = await loadFinanceRestoreSnapshot(supabase, userId);
  const plan = planFinanceRestoreSettled(snapshot);
  return {
    ok: true,
    userId,
    dryRun: true,
    ...plan,
    tables: ["receivables", "payables", "cash_movements", "vehicles", "partners", "finance_migration_runs", "finance_migration_snapshots"],
    causa:
      "O sincronismo VRP reabria o ciclo de saída já baixado (status PAGO sobrescrito ou título duplicado em aberto). O reset do caixa arquivou entradas. Scripts de reversão para Aguardando faturamento também reabriram títulos já pagos.",
    regra:
      "Só restaura PAGO quando existe evidência de baixa (caixa atual, archive, finmeta, payment_status do veículo ou histórico placa+saída+pagamento) até 18/08/2026 17:00. Não cria movimentação nova. Não altera valor, competência, veículo nem financeira.",
  };
}

async function saveRun(
  supabase: SupabaseClient,
  userId: string,
  status: string,
  summary: Record<string, unknown>
) {
  const insert = await supabase
    .from("finance_migration_runs")
    .insert({
      user_id: userId,
      migration_type: RESTORE_SETTLED_MIGRATION_TYPE,
      cutoff_ymd: "2026-08-18",
      status,
      summary,
      executed_at: status === "executed" ? new Date().toISOString() : null,
    })
    .select("id")
    .maybeSingle();
  if (insert.error && isSchemaError(insert.error.message || "")) return { id: null as string | null, schemaMissing: true };
  if (insert.error) throw new Error(insert.error.message);
  return { id: insert.data?.id ? String(insert.data.id) : null, schemaMissing: false };
}

async function saveSnapshot(
  supabase: SupabaseClient,
  migrationId: string | null,
  userId: string,
  entityType: string,
  entityId: string,
  payloadBefore: Record<string, unknown>
) {
  if (!migrationId) {
    await supabase.from("cash_movements_archive").insert({
      backup_run_id: `restore_settled:${userId}:${Date.now()}`,
      user_id: userId,
      original_id: entityId,
      payload: { entity_type: entityType, rollback: true, ...payloadBefore },
    });
    return;
  }
  const { error } = await supabase.from("finance_migration_snapshots").insert({
    migration_id: migrationId,
    user_id: userId,
    entity_type: entityType,
    entity_id: entityId,
    payload_before: payloadBefore,
  });
  if (error && isSchemaError(error.message || "")) {
    await supabase.from("cash_movements_archive").insert({
      backup_run_id: `restore_settled:${migrationId}`,
      user_id: userId,
      original_id: entityId,
      payload: { entity_type: entityType, rollback: true, ...payloadBefore },
    });
    return;
  }
  if (error) throw new Error(error.message);
}

async function updateReceivable(supabase: SupabaseClient, userId: string, id: string, patch: Record<string, unknown>) {
  const attempts = [
    patch,
    { status: patch.status, financeiro_aprovado_contas_receber: patch.financeiro_aprovado_contas_receber },
    { status: patch.status },
  ];
  let last = null as { error?: { message?: string } } | null;
  for (const body of attempts) {
    const res = await supabase.from("receivables").update(body).eq("id", id).eq("user_id", userId);
    last = res;
    if (!res.error) return { ok: true };
    if (!isSchemaError(res.error.message || "")) break;
  }
  return { ok: false, error: last?.error?.message || "falha ao atualizar receivable" };
}

async function updatePayable(supabase: SupabaseClient, userId: string, id: string, patch: Record<string, unknown>) {
  const attempts = [patch, { status: patch.status, data_pagamento: patch.data_pagamento }, { status: patch.status }];
  let last = null as { error?: { message?: string } } | null;
  for (const body of attempts) {
    const cleaned = Object.fromEntries(Object.entries(body).filter(([, v]) => v != null && v !== ""));
    const res = await supabase.from("payables").update(cleaned).eq("id", id).eq("user_id", userId);
    last = res;
    if (!res.error) return { ok: true };
    if (!isSchemaError(res.error.message || "")) break;
  }
  return { ok: false, error: last?.error?.message || "falha ao atualizar payable" };
}

export async function executeFinanceRestoreSettled(
  supabase: SupabaseClient,
  userId: string,
  confirm: string
) {
  if (confirm !== RESTORE_SETTLED_CONFIRM) {
    throw new Error(`Confirmação inválida. Envie confirm: "${RESTORE_SETTLED_CONFIRM}".`);
  }
  const snapshot = await loadFinanceRestoreSnapshot(supabase, userId);
  const plan = planFinanceRestoreSettled(snapshot);
  const run = await saveRun(supabase, userId, "executed", {
    cutoff: RESTORE_SETTLED_CUTOFF_ISO,
    counts: plan.counts,
    dryRun: false,
  });

  const recById = new Map((snapshot.receivables || []).map((r: { id: string }) => [String(r.id), r]));
  const payById = new Map((snapshot.payables || []).map((p: { id: string }) => [String(p.id), p]));

  let recebimentos = 0;
  let pagamentos = 0;
  let duplicatas = 0;
  const errors: string[] = [];

  for (const row of plan.restoreReceivables) {
    const before = recById.get(String(row.id)) as Record<string, unknown> | undefined;
    if (before) await saveSnapshot(supabase, run.id, userId, "receivable", String(row.id), before);
    const raw = String(before?.observacoes || before?.responsavel_pagamento || "");
    const unpacked = unpackFinanceMeta(raw);
    const meta = { ...(unpacked.meta || {}) };
    if (row.dataBaixa && !meta.data_pagamento && !meta.data_recebimento) {
      meta.data_pagamento = row.dataBaixa;
      meta.data_recebimento = row.dataBaixa;
    }
    const observacoes = Object.keys(meta).length ? packFinanceMeta(meta, unpacked.text) : raw;
    const res = await updateReceivable(supabase, userId, String(row.id), {
      status: "PAGO",
      financeiro_aprovado_contas_receber: true,
      ...(observacoes ? { observacoes } : {}),
    });
    if (res.ok) recebimentos += 1;
    else errors.push(`receber ${row.id}: ${res.error}`);
  }

  for (const row of plan.hideDuplicates) {
    const before = recById.get(String(row.id)) as Record<string, unknown> | undefined;
    if (before) await saveSnapshot(supabase, run.id, userId, "receivable_duplicate", String(row.id), before);
    const res = await updateReceivable(supabase, userId, String(row.id), {
      financeiro_aprovado_contas_receber: false,
    });
    if (res.ok) duplicatas += 1;
    else errors.push(`duplicata ${row.id}: ${res.error}`);
  }

  for (const row of plan.restorePayables) {
    const before = payById.get(String(row.id)) as Record<string, unknown> | undefined;
    if (before) await saveSnapshot(supabase, run.id, userId, "payable", String(row.id), before);
    const res = await updatePayable(supabase, userId, String(row.id), {
      status: "PAGO",
      data_pagamento: row.dataBaixa || undefined,
    });
    if (res.ok) pagamentos += 1;
    else errors.push(`pagar ${row.id}: ${res.error}`);
  }

  return {
    ok: errors.length === 0,
    userId,
    migrationId: run.id,
    rollbackStorage: run.schemaMissing ? "cash_movements_archive" : "finance_migration_snapshots",
    cutoffLabel: plan.cutoffLabel,
    restored: {
      recebimentos,
      pagamentos,
      duplicatas,
      baixas: recebimentos + pagamentos,
    },
    unchanged: plan.counts.inalterados,
    tables: ["receivables", "payables"],
    cashCreated: 0,
    errors,
    auditRows: plan.auditRows,
  };
}

export async function rollbackFinanceRestoreSettled(
  supabase: SupabaseClient,
  userId: string,
  migrationId: string
) {
  const { data: snaps, error } = await supabase
    .from("finance_migration_snapshots")
    .select("entity_type,entity_id,payload_before")
    .eq("user_id", userId)
    .eq("migration_id", migrationId);
  if (error) throw new Error(error.message);
  let restored = 0;
  const errors: string[] = [];
  for (const row of snaps || []) {
    const payload = (row.payload_before || {}) as Record<string, unknown>;
    const table = String(row.entity_type || "").startsWith("payable") ? "payables" : "receivables";
    const { error: upErr } = await supabase
      .from(table)
      .update(payload)
      .eq("id", row.entity_id)
      .eq("user_id", userId);
    if (upErr) errors.push(`${table} ${row.entity_id}: ${upErr.message}`);
    else restored += 1;
  }
  await supabase
    .from("finance_migration_runs")
    .update({ rolled_back_at: new Date().toISOString(), status: "rolled_back" })
    .eq("id", migrationId)
    .eq("user_id", userId);
  return { ok: errors.length === 0, restored, errors };
}

export async function discoverFinanceUserIds(supabase: SupabaseClient) {
  const ids = new Set<string>();
  for (const table of ["settings", "cash_movements", "receivables"] as const) {
    const { data } = await supabase.from(table).select("user_id").limit(5000);
    for (const row of data || []) {
      if (row?.user_id) ids.add(String(row.user_id));
    }
  }
  return [...ids];
}
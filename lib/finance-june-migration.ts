import type { SupabaseClient } from "@supabase/supabase-js";

export const JUNE_MIGRATION_CUTOFF_YMD = "2026-06-01";
export const JUNE_MIGRATION_CONFIRM = "EXECUTE_JUNE_MIGRATION";
export const AGUARDANDO_FATURAMENTO_STATUS = "AGUARDANDO_LANCAMENTO";

const FINANCE_META_PREFIX = "[[finmeta:";

function isSchemaError(message: string) {
  return /column|schema cache|PGRST204|invalid input|enum|22P02|23514|relation|does not exist|PGRST205|excluir_do_saldo|finance_migration/i.test(
    message || ""
  );
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

export function unpackFinanceMeta(raw: string | null | undefined) {
  const s = String(raw || "");
  if (!s.startsWith(FINANCE_META_PREFIX)) return { meta: {} as Record<string, unknown>, text: s };
  const end = s.indexOf("]]");
  if (end <= 0) return { meta: {} as Record<string, unknown>, text: s };
  try {
    const meta = JSON.parse(s.slice(FINANCE_META_PREFIX.length, end)) as Record<string, unknown>;
    const text = s.slice(end + 2).trim();
    return { meta, text };
  } catch {
    return { meta: {} as Record<string, unknown>, text: s };
  }
}

export function isManualReceivable(r: {
  vehicle_id?: string | null;
  subcategoria?: string | null;
}) {
  if (!r) return false;
  if (String(r.subcategoria || "").toUpperCase() === "MANUAL") return true;
  return r.vehicle_id == null || r.vehicle_id === "";
}

export function isAutoReceivable(r: {
  vehicle_id?: string | null;
  subcategoria?: string | null;
  observacoes?: string | null;
  responsavel_pagamento?: string | null;
}) {
  if (!r || isManualReceivable(r)) return false;
  const raw = r.observacoes || r.responsavel_pagamento || "";
  const { meta } = unpackFinanceMeta(raw);
  if (meta.geracao_automatica === true) return true;
  if (meta.modo === "RECORRENTE" && meta.geracao_automatica !== false) return true;
  if (r.vehicle_id) return true;
  return false;
}

export function receivableCompetenceYmd(r: {
  observacoes?: string | null;
  responsavel_pagamento?: string | null;
  period_end?: string | null;
  period_start?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
}) {
  const raw = r.observacoes || r.responsavel_pagamento || "";
  const { meta } = unpackFinanceMeta(raw);
  const fromMeta = toYmd(String(meta.data_pagamento || meta.data_recebimento || ""));
  if (fromMeta) return fromMeta;
  const period = toYmd(r.period_end || r.period_start || "");
  if (period) return period;
  return toYmd(r.updated_at || r.created_at || "");
}

export function isAutoPayable(p: { observacoes?: string | null; descricao?: string | null }) {
  if (!p) return false;
  const raw = p.observacoes || p.descricao || "";
  const { meta } = unpackFinanceMeta(raw);
  if (meta.cadastro_manual === true) return false;
  if (meta.geracao_automatica === true) return true;
  return false;
}

export function payableCompetenceYmd(p: {
  observacoes?: string | null;
  descricao?: string | null;
  data_vencimento?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
}) {
  const raw = p.observacoes || p.descricao || "";
  const { meta } = unpackFinanceMeta(raw);
  const fromMeta = toYmd(String(meta.data_pagamento || meta.data_baixa || ""));
  if (fromMeta) return fromMeta;
  const due = toYmd(p.data_vencimento || "");
  if (due) return due;
  return toYmd(p.updated_at || p.created_at || "");
}

export function cashMovCompetenceYmd(m: {
  data_movimento?: string | null;
  created_at?: string | null;
}) {
  return toYmd(m.data_movimento || m.created_at || "");
}

type ReceivableRow = {
  id: string;
  user_id: string;
  vehicle_id?: string | null;
  valor?: number | null;
  status?: string | null;
  subcategoria?: string | null;
  observacoes?: string | null;
  responsavel_pagamento?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  financeiro_aprovado_contas_receber?: boolean | null;
  patio_liberado_financeiro?: boolean | null;
  updated_at?: string | null;
  created_at?: string | null;
};

type PayableRow = {
  id: string;
  user_id: string;
  valor?: number | null;
  status?: string | null;
  observacoes?: string | null;
  descricao?: string | null;
  data_vencimento?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

type CashRow = {
  id: string;
  user_id: string;
  tipo_conta?: string | null;
  conta_id?: string | null;
  valor?: number | null;
  descricao?: string | null;
  data_movimento?: string | null;
  excluir_do_saldo?: boolean | null;
  created_at?: string | null;
};

async function loadReceivables(supabase: SupabaseClient, userId: string) {
  const selects = [
    "id,user_id,vehicle_id,valor,status,subcategoria,observacoes,responsavel_pagamento,period_start,period_end,financeiro_aprovado_contas_receber,patio_liberado_financeiro,updated_at,created_at",
    "id,user_id,vehicle_id,valor,status,observacoes,responsavel_pagamento,period_start,period_end,financeiro_aprovado_contas_receber,updated_at,created_at",
    "id,user_id,vehicle_id,valor,status,period_start,period_end,updated_at,created_at",
  ];
  for (const sel of selects) {
    const res = await supabase.from("receivables").select(sel).eq("user_id", userId);
    if (!res.error) return (res.data || []) as ReceivableRow[];
    if (!isSchemaError(res.error.message || "")) throw new Error(res.error.message);
  }
  return [];
}

async function loadPayables(supabase: SupabaseClient, userId: string) {
  const res = await supabase
    .from("payables")
    .select("id,user_id,valor,status,observacoes,descricao,data_vencimento,updated_at,created_at")
    .eq("user_id", userId);
  if (res.error) throw new Error(res.error.message);
  return (res.data || []) as PayableRow[];
}

async function loadCash(supabase: SupabaseClient, userId: string) {
  const selects = [
    "id,user_id,tipo_conta,conta_id,valor,descricao,data_movimento,excluir_do_saldo,created_at",
    "id,user_id,tipo_conta,conta_id,valor,descricao,data_movimento,created_at",
  ];
  for (const sel of selects) {
    const res = await supabase.from("cash_movements").select(sel).eq("user_id", userId);
    if (!res.error) return (res.data || []) as CashRow[];
    if (!isSchemaError(res.error.message || "")) throw new Error(res.error.message);
  }
  return [];
}

async function loadPlates(supabase: SupabaseClient, userId: string, vehicleIds: string[]) {
  const map = new Map<string, string>();
  if (!vehicleIds.length) return map;
  const { data } = await supabase.from("vehicles").select("id,placa").eq("user_id", userId).in("id", vehicleIds);
  for (const v of data || []) {
    if (v?.id && v.placa) map.set(String(v.id), String(v.placa));
  }
  return map;
}

export function classifyReceivableForMigration(r: ReceivableRow) {
  const competence = receivableCompetenceYmd(r);
  if (!competence || competence < JUNE_MIGRATION_CUTOFF_YMD) {
    return { inScope: false, reason: "before_cutoff", competence, auto: isAutoReceivable(r) };
  }
  if (isManualReceivable(r)) {
    return { inScope: false, reason: "manual", competence, auto: false };
  }
  if (!isAutoReceivable(r)) {
    return { inScope: false, reason: "not_auto", competence, auto: false };
  }
  return { inScope: true, reason: "auto_june_plus", competence, auto: true };
}

function receivableOrigin(r: ReceivableRow) {
  if (r.vehicle_id) return "VRP_PATIO";
  const { meta } = unpackFinanceMeta(r.observacoes || r.responsavel_pagamento || "");
  if (meta.geracao_automatica === true || meta.modo === "RECORRENTE") return "RECORRENTE_AUTO";
  return "OUTRO_AUTO";
}

export async function buildJuneMigrationPreview(supabase: SupabaseClient, userId: string) {
  const [receivables, payables, cash] = await Promise.all([
    loadReceivables(supabase, userId),
    loadPayables(supabase, userId),
    loadCash(supabase, userId),
  ]);

  const vehicleIds = [...new Set(receivables.map((r) => r.vehicle_id).filter(Boolean))] as string[];
  const placaByVehicle = await loadPlates(supabase, userId, vehicleIds);

  const receivablesToMigrate: Array<ReceivableRow & { competence: string; origin: string; placa: string | null }> = [];
  const receivablesSkipped = { before_cutoff: 0, manual: 0, not_auto: 0, already_aguardando: 0 };
  const byStatus: Record<string, number> = {};
  const byMonth: Record<string, number> = {};

  for (const r of receivables) {
    const cls = classifyReceivableForMigration(r);
    if (!cls.inScope) {
      receivablesSkipped[cls.reason as keyof typeof receivablesSkipped] =
        (receivablesSkipped[cls.reason as keyof typeof receivablesSkipped] || 0) + 1;
      continue;
    }
    if (String(r.status || "").toUpperCase() === AGUARDANDO_FATURAMENTO_STATUS && !r.financeiro_aprovado_contas_receber) {
      receivablesSkipped.already_aguardando += 1;
      continue;
    }
    const st = String(r.status || "—");
    byStatus[st] = (byStatus[st] || 0) + 1;
    const ym = yearMonthFromYmd(cls.competence);
    byMonth[ym] = (byMonth[ym] || 0) + 1;
    receivablesToMigrate.push({
      ...r,
      competence: cls.competence,
      origin: receivableOrigin(r),
      placa: r.vehicle_id ? placaByVehicle.get(String(r.vehicle_id)) || null : null,
    });
  }

  const migrateReceivableIds = new Set(receivablesToMigrate.map((r) => r.id));

  const payablesToMigrate: Array<PayableRow & { competence: string }> = [];
  const payablesSkipped = { before_cutoff: 0, manual: 0, not_auto: 0 };
  for (const p of payables) {
    const competence = payableCompetenceYmd(p);
    if (!competence || competence < JUNE_MIGRATION_CUTOFF_YMD) {
      payablesSkipped.before_cutoff += 1;
      continue;
    }
    if (!isAutoPayable(p)) {
      payablesSkipped.manual += 1;
      payablesSkipped.not_auto += 1;
      continue;
    }
    payablesToMigrate.push({ ...p, competence });
  }
  const migratePayableIds = new Set(payablesToMigrate.map((p) => p.id));

  const cashToExclude: Array<CashRow & { competence: string; link: string }> = [];
  let cashSkippedBeforeCutoff = 0;
  let cashAlreadyExcluded = 0;
  for (const m of cash) {
    const competence = cashMovCompetenceYmd(m);
    if (!competence || competence < JUNE_MIGRATION_CUTOFF_YMD) {
      cashSkippedBeforeCutoff += 1;
      continue;
    }
    const contaId = m.conta_id ? String(m.conta_id) : "";
    const linkedRec = contaId && migrateReceivableIds.has(contaId);
    const linkedPay = contaId && migratePayableIds.has(contaId);
    if (!linkedRec && !linkedPay) continue;
    if (m.excluir_do_saldo) {
      cashAlreadyExcluded += 1;
      continue;
    }
    cashToExclude.push({
      ...m,
      competence,
      link: linkedRec ? "receivable" : "payable",
    });
  }

  const cashImpact = cashToExclude.reduce(
    (acc, m) => {
      const v = Number(m.valor || 0);
      const t = String(m.tipo_conta || "").toUpperCase();
      if (t === "RECEBER" || t === "ENTRADA") acc.entradas += v;
      else if (t === "PAGAR" || t === "SAIDA" || t === "SAÍDA") acc.saidas += v;
      return acc;
    },
    { entradas: 0, saidas: 0 }
  );

  const receivableValorTotal = receivablesToMigrate.reduce((s, r) => s + Number(r.valor || 0), 0);

  return {
    ok: true,
    mode: "preview_only",
    cutoffYmd: JUNE_MIGRATION_CUTOFF_YMD,
    userId,
    generatedAt: new Date().toISOString(),
    tablesAndFields: {
      receivables: {
        table: "receivables",
        fieldsWrittenOnExecute: ["status", "financeiro_aprovado_contas_receber", "updated_at"],
        targetStatus: AGUARDANDO_FATURAMENTO_STATUS,
        recordsBeforeCutoffUntouched: true,
      },
      cash_movements: {
        table: "cash_movements",
        fieldsWrittenOnExecute: ["excluir_do_saldo"],
        physicalDelete: false,
        recordsBeforeCutoffUntouched: true,
      },
      payables: {
        table: "payables",
        fieldsWrittenOnExecute: ["status", "updated_at"],
        targetStatus: "EM_ABERTO",
        note: "Despesas automáticas pagas voltam para EM_ABERTO (sem exclusão).",
        recordsBeforeCutoffUntouched: true,
      },
      finance_migration_runs: {
        table: "finance_migration_runs",
        purpose: "Registro da execução e status (preview/executed/rolled_back)",
      },
      finance_migration_snapshots: {
        table: "finance_migration_snapshots",
        purpose: "Cópia JSON de cada linha antes da alteração — base da reversão",
      },
    },
    summary: {
      receivablesToMigrate: receivablesToMigrate.length,
      receivablesSkipped,
      receivablesByStatus: byStatus,
      receivablesByMonth: byMonth,
      receivableValorTotal,
      payablesToMigrate: payablesToMigrate.length,
      payablesSkipped,
      cashMovementsToExclude: cashToExclude.length,
      cashSkippedBeforeCutoff,
      cashAlreadyExcluded,
      cashImpactRemovidoDosCalculos: {
        entradas: cashImpact.entradas,
        saidas: cashImpact.saidas,
        saldoLiquido: cashImpact.entradas - cashImpact.saidas,
      },
      recordsBefore20260601Untouched:
        receivablesSkipped.before_cutoff + payablesSkipped.before_cutoff + cashSkippedBeforeCutoff,
    },
    samples: {
      receivables: receivablesToMigrate.slice(0, 40).map((r) => ({
        id: r.id,
        placa: r.placa,
        valor: r.valor,
        statusAtual: r.status,
        statusNovo: AGUARDANDO_FATURAMENTO_STATUS,
        competence: r.competence,
        origin: r.origin,
        financeiro_aprovado_contas_receber: r.financeiro_aprovado_contas_receber,
      })),
      payables: payablesToMigrate.slice(0, 20).map((p) => ({
        id: p.id,
        valor: p.valor,
        statusAtual: p.status,
        statusNovo: String(p.status || "").toUpperCase() === "PAGO" ? "EM_ABERTO" : p.status,
        competence: p.competence,
      })),
      cashMovements: cashToExclude.slice(0, 30).map((m) => ({
        id: m.id,
        tipo_conta: m.tipo_conta,
        conta_id: m.conta_id,
        valor: m.valor,
        competence: m.competence,
        link: m.link,
        excluir_do_saldo: true,
      })),
    },
    fullCounts: {
      receivablesTotal: receivables.length,
      payablesTotal: payables.length,
      cashTotal: cash.length,
    },
    rollbackPlan: {
      mechanism: "finance_migration_snapshots + POST /api/finance/june-migration/rollback",
      description:
        "Antes de cada UPDATE, a linha integral é gravada em finance_migration_snapshots. O rollback restaura status, flags e campos originais a partir do JSON.",
      requiresSqlMigration: "supabase/finance_june_migration.sql",
    },
    executeRequires: {
      confirm: JUNE_MIGRATION_CONFIRM,
      endpoint: "POST /api/finance/june-migration/execute",
    },
  };
}

export async function executeJuneMigration(supabase: SupabaseClient, userId: string) {
  const preview = await buildJuneMigrationPreview(supabase, userId);

  const { data: runRow, error: runErr } = await supabase
    .from("finance_migration_runs")
    .insert({
      user_id: userId,
      migration_type: "june_2026_auto_to_aguardando",
      cutoff_ymd: JUNE_MIGRATION_CUTOFF_YMD,
      status: "executing",
      summary: preview.summary,
    })
    .select("id")
    .single();

  if (runErr) {
    if (isSchemaError(runErr.message || "")) {
      throw new Error(
        "Tabelas de migração ausentes. Execute supabase/finance_june_migration.sql no Supabase antes de prosseguir."
      );
    }
    throw new Error(runErr.message);
  }

  const migrationId = String(runRow.id);
  let snapshots = 0;
  let receivablesUpdated = 0;
  let payablesUpdated = 0;
  let cashUpdated = 0;
  const errors: string[] = [];

  const [receivables, payables, cash] = await Promise.all([
    loadReceivables(supabase, userId),
    loadPayables(supabase, userId),
    loadCash(supabase, userId),
  ]);

  const toMigrateRec = receivables.filter((r) => {
    const cls = classifyReceivableForMigration(r);
    if (!cls.inScope) return false;
    if (String(r.status || "").toUpperCase() === AGUARDANDO_FATURAMENTO_STATUS && !r.financeiro_aprovado_contas_receber) {
      return false;
    }
    return true;
  });
  const migrateRecIds = new Set(toMigrateRec.map((r) => r.id));

  for (const r of toMigrateRec) {
    await supabase.from("finance_migration_snapshots").insert({
      migration_id: migrationId,
      user_id: userId,
      entity_type: "receivable",
      entity_id: r.id,
      payload_before: r,
    });
    snapshots += 1;

    const patch = {
      status: AGUARDANDO_FATURAMENTO_STATUS,
      financeiro_aprovado_contas_receber: false,
      updated_at: new Date().toISOString(),
    };
    let { error } = await supabase.from("receivables").update(patch).eq("id", r.id).eq("user_id", userId);
    if (error && isSchemaError(error.message || "")) {
      ({ error } = await supabase
        .from("receivables")
        .update({ status: AGUARDANDO_FATURAMENTO_STATUS, updated_at: patch.updated_at })
        .eq("id", r.id)
        .eq("user_id", userId));
    }
    if (error) errors.push(`receivable ${r.id}: ${error.message}`);
    else receivablesUpdated += 1;
  }

  const toMigratePay = payables.filter((p) => {
    const competence = payableCompetenceYmd(p);
    return competence >= JUNE_MIGRATION_CUTOFF_YMD && isAutoPayable(p);
  });

  for (const p of toMigratePay) {
    await supabase.from("finance_migration_snapshots").insert({
      migration_id: migrationId,
      user_id: userId,
      entity_type: "payable",
      entity_id: p.id,
      payload_before: p,
    });
    snapshots += 1;

    const st = String(p.status || "").toUpperCase();
    const patch =
      st === "PAGO"
        ? { status: "EM_ABERTO", updated_at: new Date().toISOString() }
        : { updated_at: new Date().toISOString() };
    const { error } = await supabase.from("payables").update(patch).eq("id", p.id).eq("user_id", userId);
    if (error) errors.push(`payable ${p.id}: ${error.message}`);
    else payablesUpdated += 1;
  }

  for (const m of cash) {
    const competence = cashMovCompetenceYmd(m);
    if (!competence || competence < JUNE_MIGRATION_CUTOFF_YMD) continue;
    const contaId = m.conta_id ? String(m.conta_id) : "";
    if (!contaId || (!migrateRecIds.has(contaId) && !toMigratePay.some((p) => p.id === contaId))) continue;
    if (m.excluir_do_saldo) continue;

    await supabase.from("finance_migration_snapshots").insert({
      migration_id: migrationId,
      user_id: userId,
      entity_type: "cash_movement",
      entity_id: m.id,
      payload_before: m,
    });
    snapshots += 1;

    const { error } = await supabase
      .from("cash_movements")
      .update({ excluir_do_saldo: true })
      .eq("id", m.id)
      .eq("user_id", userId);
    if (error) errors.push(`cash ${m.id}: ${error.message}`);
    else cashUpdated += 1;
  }

  await supabase
    .from("finance_migration_runs")
    .update({
      status: errors.length ? "executed_with_errors" : "executed",
      executed_at: new Date().toISOString(),
      summary: { ...preview.summary, snapshots, receivablesUpdated, payablesUpdated, cashUpdated, errors },
    })
    .eq("id", migrationId);

  return {
    ok: errors.length === 0,
    migrationId,
    snapshots,
    receivablesUpdated,
    payablesUpdated,
    cashUpdated,
    errors,
    preview: preview.summary,
  };
}

export async function rollbackJuneMigration(supabase: SupabaseClient, userId: string, migrationId: string) {
  const { data: run } = await supabase
    .from("finance_migration_runs")
    .select("id,status,user_id")
    .eq("id", migrationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!run) throw new Error("Migração não encontrada para este usuário.");

  const { data: snaps, error: snapErr } = await supabase
    .from("finance_migration_snapshots")
    .select("entity_type,entity_id,payload_before")
    .eq("migration_id", migrationId)
    .eq("user_id", userId);
  if (snapErr) throw new Error(snapErr.message);

  let restored = 0;
  const errors: string[] = [];

  for (const s of snaps || []) {
    const payload = s.payload_before as Record<string, unknown>;
    const table =
      s.entity_type === "receivable"
        ? "receivables"
        : s.entity_type === "payable"
          ? "payables"
          : "cash_movements";
    const { id: _id, ...rest } = payload;
    const { error } = await supabase
      .from(table)
      .update(rest)
      .eq("id", s.entity_id)
      .eq("user_id", userId);
    if (error) errors.push(`${s.entity_type} ${s.entity_id}: ${error.message}`);
    else restored += 1;
  }

  await supabase
    .from("finance_migration_runs")
    .update({ status: "rolled_back", rolled_back_at: new Date().toISOString() })
    .eq("id", migrationId);

  return { ok: errors.length === 0, migrationId, restored, errors, total: (snaps || []).length };
}

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AGUARDANDO_FATURAMENTO_STATUS,
  cashMovCompetenceYmd,
  receivableCompetenceYmd,
  toYmd,
  yearMonthFromYmd,
} from "@/lib/finance-june-migration";

export const CAIXA_FLOW_REPAIR_CONFIRM = "EXECUTE_CAIXA_FLOW_REPAIR";
export const MIGRATION_TYPE = "caixa_flow_correction_v1";

function isSchemaError(message: string) {
  return /column|schema cache|PGRST204|invalid input|enum|22P02|23514|relation|does not exist|PGRST205|excluir_do_saldo|aprovado_caixa|finance_migration|finance_manual_caixa/i.test(
    message || ""
  );
}

function isEntradaTipo(tipo: string | null | undefined) {
  const t = String(tipo || "").toUpperCase();
  return t === "RECEBER" || t === "ENTRADA";
}

function isSaidaTipo(tipo: string | null | undefined) {
  const t = String(tipo || "").toUpperCase();
  return t === "PAGAR" || t === "SAIDA" || t === "SAÍDA";
}

type ReceivableRow = {
  id: string;
  user_id: string;
  vehicle_id?: string | null;
  valor?: number | null;
  status?: string | null;
  observacoes?: string | null;
  responsavel_pagamento?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  financeiro_aprovado_contas_receber?: boolean | null;
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
  aprovado_caixa?: boolean | null;
  created_at?: string | null;
};

async function loadReceivables(supabase: SupabaseClient, userId: string) {
  const selects = [
    "id,user_id,vehicle_id,valor,status,observacoes,responsavel_pagamento,period_start,period_end,financeiro_aprovado_contas_receber,updated_at,created_at",
    "id,user_id,vehicle_id,valor,status,period_start,period_end,financeiro_aprovado_contas_receber,updated_at,created_at",
    "id,user_id,vehicle_id,valor,status,updated_at,created_at",
  ];
  for (const sel of selects) {
    const res = await supabase.from("receivables").select(sel).eq("user_id", userId);
    if (!res.error) return (res.data || []) as ReceivableRow[];
    if (!isSchemaError(res.error.message || "")) throw new Error(res.error.message);
  }
  return [];
}

async function loadCash(supabase: SupabaseClient, userId: string) {
  const selects = [
    "id,user_id,tipo_conta,conta_id,valor,descricao,data_movimento,excluir_do_saldo,aprovado_caixa,created_at",
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

/** Recebível exibido em Contas a Receber (aprovado, não pago, sem vínculo incorreto com caixa). */
export function receivableIsContasReceberPreservado(r: ReceivableRow, receivableIdsInCaixa: Set<string>) {
  if (!r || receivableIdsInCaixa.has(r.id)) return false;
  const st = String(r.status || "").toUpperCase();
  if (st === "PAGO") return false;
  if (r.financeiro_aprovado_contas_receber !== true) return false;
  return st === "EM_ABERTO" || st === AGUARDANDO_FATURAMENTO_STATUS;
}

export function collectReceivableIdsLinkedToCaixa(cash: CashRow[]) {
  const ids = new Set<string>();
  for (const m of cash) {
    if (!m.conta_id) continue;
    if (isEntradaTipo(m.tipo_conta)) ids.add(String(m.conta_id));
  }
  return ids;
}

function calcOperationalBalance(cash: CashRow[]) {
  let entradas = 0;
  let saidas = 0;
  let counted = 0;
  for (const m of cash) {
    if (m.aprovado_caixa !== true) continue;
    counted += 1;
    const v = Number(m.valor || 0);
    if (isEntradaTipo(m.tipo_conta)) entradas += v;
    else if (isSaidaTipo(m.tipo_conta)) saidas += v;
  }
  return { entradas, saidas, saldo: entradas - saidas, counted };
}

function calcLegacyBalance(cash: CashRow[]) {
  let entradas = 0;
  let saidas = 0;
  for (const m of cash) {
    if (m.excluir_do_saldo === true) continue;
    const v = Number(m.valor || 0);
    if (isEntradaTipo(m.tipo_conta)) entradas += v;
    else if (isSaidaTipo(m.tipo_conta)) saidas += v;
  }
  return { entradas, saidas, saldo: entradas - saidas };
}

export async function buildCaixaFlowRepairPreview(supabase: SupabaseClient, userId: string) {
  const [receivables, cash] = await Promise.all([loadReceivables(supabase, userId), loadCash(supabase, userId)]);

  const receivableIdsInCaixa = collectReceivableIdsLinkedToCaixa(cash);
  const vehicleIds = [...new Set(receivables.map((r) => r.vehicle_id).filter(Boolean))] as string[];
  const placaByVehicle = await loadPlates(supabase, userId, vehicleIds);

  const receivablesCaixaParaAguardando: Array<
    ReceivableRow & { statusAtual: string; placa: string | null; competence: string; cashMovCount: number }
  > = [];
  const contasReceberPreservados: Array<ReceivableRow & { statusAtual: string; placa: string | null }> = [];

  const statusCaixaAntes = { PAGO: 0, EM_ABERTO: 0, AGUARDANDO_LANCAMENTO: 0, OUTROS: 0 };
  const cashCountByReceivable = new Map<string, number>();
  for (const m of cash) {
    if (!m.conta_id || !isEntradaTipo(m.tipo_conta)) continue;
    const id = String(m.conta_id);
    cashCountByReceivable.set(id, (cashCountByReceivable.get(id) || 0) + 1);
  }

  for (const r of receivables) {
    if (receivableIdsInCaixa.has(r.id)) {
      const st = String(r.status || "").toUpperCase();
      if (st === "PAGO") statusCaixaAntes.PAGO += 1;
      else if (st === "EM_ABERTO") statusCaixaAntes.EM_ABERTO += 1;
      else if (st === AGUARDANDO_FATURAMENTO_STATUS) statusCaixaAntes.AGUARDANDO_LANCAMENTO += 1;
      else statusCaixaAntes.OUTROS += 1;
      receivablesCaixaParaAguardando.push({
        ...r,
        statusAtual: st,
        placa: r.vehicle_id ? placaByVehicle.get(String(r.vehicle_id)) || null : null,
        competence: receivableCompetenceYmd(r),
        cashMovCount: cashCountByReceivable.get(r.id) || 0,
      });
    } else if (receivableIsContasReceberPreservado(r, receivableIdsInCaixa)) {
      contasReceberPreservados.push({
        ...r,
        statusAtual: String(r.status || "").toUpperCase(),
        placa: r.vehicle_id ? placaByVehicle.get(String(r.vehicle_id)) || null : null,
      });
    }
  }

  const cashToNeutralize = cash.filter((m) => m.aprovado_caixa === true || m.excluir_do_saldo !== true);
  const saldoAprovado = calcOperationalBalance(cash);
  const saldoLegado = calcLegacyBalance(cash);

  const impactoRemovido = cashToNeutralize.reduce(
    (acc, m) => {
      const v = Number(m.valor || 0);
      if (isEntradaTipo(m.tipo_conta)) acc.entradas += v;
      else if (isSaidaTipo(m.tipo_conta)) acc.saidas += v;
      return acc;
    },
    { entradas: 0, saidas: 0 }
  );

  const valorRecebiveisCaixa = receivablesCaixaParaAguardando.reduce((s, r) => s + Number(r.valor || 0), 0);
  const valorContasReceber = contasReceberPreservados.reduce((s, r) => s + Number(r.valor || 0), 0);

  return {
    ok: true,
    mode: "preview_only",
    migrationType: MIGRATION_TYPE,
    userId,
    generatedAt: new Date().toISOString(),
    objective: {
      fluxoCorreto: "AGUARDANDO_FATURAMENTO → CONTAS A RECEBER → CAIXA",
      escopo: "Correção do caixa apenas — Contas a Receber aprovadas sem lançamento incorreto são preservadas.",
      resetTotal: false,
      auditoriaManualTotal: false,
    },
    summary: {
      receivablesCaixaParaAguardando: receivablesCaixaParaAguardando.length,
      receivablesStatusAntesCaixa: statusCaixaAntes,
      receivablesJaPagosNoCaixa: statusCaixaAntes.PAGO,
      receivablesEmAbertoNoCaixa: statusCaixaAntes.EM_ABERTO,
      valorTotalRecebiveisSaindoDoCaixa: valorRecebiveisCaixa,
      contasReceberPreservados: contasReceberPreservados.length,
      valorTotalContasReceberPreservado: valorContasReceber,
      receivablesOutrosNaoAlterados:
        receivables.length - receivablesCaixaParaAguardando.length - contasReceberPreservados.length,
      cashMovementsTotal: cash.length,
      cashMovementsNeutralizados: cashToNeutralize.length,
      saldoOperacionalAtualAprovadoCaixa: saldoAprovado,
      saldoLegadoAtualExcluirDoSaldo: saldoLegado,
      impactoFinanceiroRemovidoDoCaixa: {
        entradas: impactoRemovido.entradas,
        saidas: impactoRemovido.saidas,
        saldoLiquido: impactoRemovido.entradas - impactoRemovido.saidas,
      },
      saldoOperacionalAposMigracao: { entradas: 0, saidas: 0, saldo: 0 },
    },
    comoSaldoFicaZero: {
      passo1: "Todos os cash_movements atuais → aprovado_caixa=false, excluir_do_saldo=true (histórico preservado).",
      passo2: "Recebíveis vinculados a entradas no caixa → AGUARDANDO_LANCAMENTO (triagem manual).",
      passo3: "Contas a Receber aprovadas SEM lançamento no caixa permanecem intactas.",
      passo4: "Novas entradas no caixa só com confirmação explícita de pagamento (aprovado_caixa=true).",
      passo5: "settings: caixa_opening_balance=0, finance_manual_caixa_mode=true (regra de caixa, não reset de contas).",
      formula: "saldo_operacional = 0 + Σ(movimentos com aprovado_caixa=true após novos pagamentos confirmados)",
    },
    tablesAndFields: {
      receivables_alterados: {
        criterio: "conta_id presente em cash_movements tipo RECEBER/ENTRADA",
        campos: ["status → AGUARDANDO_LANCAMENTO", "financeiro_aprovado_contas_receber → false"],
      },
      receivables_preservados: {
        criterio: "financeiro_aprovado_contas_receber=true, status EM_ABERTO, sem entrada no caixa",
        alteracao: "nenhuma",
      },
      cash_movements: {
        campos: ["aprovado_caixa → false", "excluir_do_saldo → true"],
        delete: false,
      },
      finance_migration_snapshots: "rollback completo",
    },
    rollback: {
      endpoint: "POST /api/finance/caixa-flow-repair/rollback",
      body: { userId, migrationId: "<uuid>" },
    },
    samples: {
      receivablesCaixaParaAguardando: receivablesCaixaParaAguardando.slice(0, 40).map((r) => ({
        id: r.id,
        placa: r.placa,
        valor: r.valor,
        statusAtual: r.statusAtual,
        statusNovo: AGUARDANDO_FATURAMENTO_STATUS,
        cashMovCount: r.cashMovCount,
        competence: r.competence,
      })),
      contasReceberPreservados: contasReceberPreservados.slice(0, 30).map((r) => ({
        id: r.id,
        placa: r.placa,
        valor: r.valor,
        statusAtual: r.statusAtual,
        financeiro_aprovado_contas_receber: r.financeiro_aprovado_contas_receber,
      })),
      cashMovements: cashToNeutralize.slice(0, 25).map((m) => ({
        id: m.id,
        tipo_conta: m.tipo_conta,
        valor: m.valor,
        conta_id: m.conta_id,
        competence: cashMovCompetenceYmd(m),
      })),
    },
    executionPlan: {
      fase1: "Executar supabase/finance_june_migration.sql se colunas aprovado_caixa ainda não existirem",
      fase2: "Revisar esta prévia e aprovar explicitamente",
      fase3: "POST /api/finance/caixa-flow-repair/execute com confirm EXECUTE_CAIXA_FLOW_REPAIR",
      fase4: "Triagem: Aguardando → aprovar → Contas a Receber → confirmar pagamento → Caixa",
      fase5: "Rollback via migrationId se necessário",
    },
    executeRequires: {
      confirm: CAIXA_FLOW_REPAIR_CONFIRM,
      endpoint: "POST /api/finance/caixa-flow-repair/execute",
    },
  };
}

async function saveRollbackSnapshot(
  supabase: SupabaseClient,
  migrationId: string,
  userId: string,
  entityType: string,
  entityId: string,
  payloadBefore: Record<string, unknown>,
  useArchiveFallback: boolean
) {
  if (!useArchiveFallback) {
    const { error } = await supabase.from("finance_migration_snapshots").insert({
      migration_id: migrationId,
      user_id: userId,
      entity_type: entityType,
      entity_id: entityId,
      payload_before: payloadBefore,
    });
    if (!error) return;
    if (!isSchemaError(error.message || "")) throw new Error(error.message);
  }
  await supabase.from("cash_movements_archive").insert({
    backup_run_id: `caixa_flow_rollback:${migrationId}`,
    user_id: userId,
    original_id: entityId,
    payload: { entity_type: entityType, rollback: true, ...payloadBefore },
  });
}

export async function executeCaixaFlowRepair(supabase: SupabaseClient, userId: string) {
  const preview = await buildCaixaFlowRepairPreview(supabase, userId);

  let migrationId = crypto.randomUUID();
  let useArchiveFallback = false;

  const { data: runRow, error: runErr } = await supabase
    .from("finance_migration_runs")
    .insert({
      user_id: userId,
      migration_type: MIGRATION_TYPE,
      cutoff_ymd: toYmd(new Date().toISOString()),
      status: "executing",
      summary: preview.summary,
    })
    .select("id")
    .single();

  if (!runErr && runRow?.id) {
    migrationId = String(runRow.id);
  } else {
    useArchiveFallback = true;
  }

  const errors: string[] = [];
  let snapshots = 0;
  let receivablesUpdated = 0;
  let cashUpdated = 0;

  const [receivables, cash] = await Promise.all([loadReceivables(supabase, userId), loadCash(supabase, userId)]);
  const receivableIdsInCaixa = collectReceivableIdsLinkedToCaixa(cash);
  const toRevert = receivables.filter((r) => receivableIdsInCaixa.has(r.id));
  const updatedAt = new Date().toISOString();

  for (const r of toRevert) {
    try {
      await saveRollbackSnapshot(supabase, migrationId, userId, "receivable", r.id, r as Record<string, unknown>, useArchiveFallback);
      snapshots += 1;
    } catch (e) {
      errors.push(`snapshot receivable ${r.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const recIds = toRevert.map((r) => r.id);
  const recPatches = [
    {
      status: AGUARDANDO_FATURAMENTO_STATUS,
      financeiro_aprovado_contas_receber: false,
      updated_at: updatedAt,
    },
    { status: AGUARDANDO_FATURAMENTO_STATUS, updated_at: updatedAt },
    { status: "EM_ABERTO", financeiro_aprovado_contas_receber: false, updated_at: updatedAt },
    { status: "EM_ABERTO", updated_at: updatedAt },
  ];
  for (let i = 0; i < recIds.length; i += 50) {
    const chunk = recIds.slice(i, i + 50);
    let chunkOk = false;
    for (const patch of recPatches) {
      const { error } = await supabase.from("receivables").update(patch).eq("user_id", userId).in("id", chunk);
      if (!error) {
        chunkOk = true;
        receivablesUpdated += chunk.length;
        break;
      }
      const msg = error.message || "";
      if (!isSchemaError(msg) && !/invalid input value for enum payment_status/i.test(msg)) {
        errors.push(`receivables batch: ${msg}`);
        break;
      }
    }
    if (!chunkOk && !errors.some((e) => e.startsWith("receivables batch"))) {
      errors.push(`receivables batch: falha ao atualizar ${chunk.length} ids`);
    }
  }

  const cashToFix = cash.filter((m) => !(m.aprovado_caixa === true && m.excluir_do_saldo === true));
  for (let i = 0; i < cashToFix.length; i += 40) {
    const batch = cashToFix.slice(i, i + 40);
    for (const m of batch) {
      try {
        await saveRollbackSnapshot(
          supabase,
          migrationId,
          userId,
          "cash_movement",
          m.id,
          m as Record<string, unknown>,
          useArchiveFallback
        );
        snapshots += 1;
      } catch (e) {
        errors.push(`snapshot cash ${m.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  const cashPatch = { aprovado_caixa: false, excluir_do_saldo: true };
  let { error: cashBulkErr } = await supabase.from("cash_movements").update(cashPatch).eq("user_id", userId);
  if (cashBulkErr && isSchemaError(cashBulkErr.message || "")) {
    ({ error: cashBulkErr } = await supabase
      .from("cash_movements")
      .update({ excluir_do_saldo: true })
      .eq("user_id", userId));
  }
  if (cashBulkErr) {
    errors.push(`cash bulk: ${cashBulkErr.message}`);
    if (/excluir_do_saldo|aprovado_caixa|schema cache/i.test(cashBulkErr.message || "")) {
      errors.push(
        "cash: colunas excluir_do_saldo/aprovado_caixa ausentes — execute supabase/finance_june_migration.sql. O modo manual no settings ainda zera o saldo na interface."
      );
    }
  } else {
    cashUpdated = cashToFix.length;
  }

  const { data: settings } = await supabase
    .from("settings")
    .select("id,caixa_opening_balance,finance_manual_caixa_mode,caixa_operational_reset_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (settings?.id) {
    try {
      await saveRollbackSnapshot(
        supabase,
        migrationId,
        userId,
        "settings",
        settings.id,
        settings as Record<string, unknown>,
        useArchiveFallback
      );
      snapshots += 1;
    } catch (e) {
      errors.push(`snapshot settings: ${e instanceof Error ? e.message : String(e)}`);
    }
    const resetAt = new Date().toISOString();
    const settingsPatch = {
      caixa_opening_balance: 0,
      finance_manual_caixa_mode: true,
      caixa_operational_reset_at: resetAt,
    };
    let { error } = await supabase.from("settings").update(settingsPatch).eq("id", settings.id);
    if (error && isSchemaError(error.message || "")) {
      ({ error } = await supabase.from("settings").update({ caixa_opening_balance: 0 }).eq("id", settings.id));
    }
    if (error && !isSchemaError(error.message || "")) errors.push(`settings: ${error.message}`);
  }

  const finalSummary = {
    ...preview.summary,
    snapshots,
    receivablesUpdated,
    cashUpdated,
    errors,
    rollbackStorage: useArchiveFallback ? "cash_movements_archive" : "finance_migration_snapshots",
  };

  if (!useArchiveFallback) {
    await supabase
      .from("finance_migration_runs")
      .update({
        status: errors.length ? "executed_with_errors" : "executed",
        executed_at: new Date().toISOString(),
        summary: finalSummary,
      })
      .eq("id", migrationId);
  } else {
    await supabase.from("cash_movements_archive").insert({
      backup_run_id: `caixa_flow_rollback_meta:${migrationId}`,
      user_id: userId,
      original_id: migrationId,
      payload: { entity_type: "migration_meta", migration_type: MIGRATION_TYPE, summary: finalSummary, executed_at: new Date().toISOString() },
    });
  }

  return {
    ok: errors.length === 0,
    migrationId,
    snapshots,
    receivablesUpdated,
    cashUpdated,
    errors,
    rollbackStorage: useArchiveFallback ? "cash_movements_archive" : "finance_migration_snapshots",
    preview: preview.summary,
  };
}

export async function rollbackCaixaFlowRepair(supabase: SupabaseClient, userId: string, migrationId: string) {
  const { data: run } = await supabase
    .from("finance_migration_runs")
    .select("id")
    .eq("id", migrationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!run) throw new Error("Migração não encontrada.");

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
        : s.entity_type === "cash_movement"
          ? "cash_movements"
          : "settings";
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

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AGUARDANDO_FATURAMENTO_STATUS,
  cashMovCompetenceYmd,
  receivableCompetenceYmd,
  toYmd,
  unpackFinanceMeta,
  yearMonthFromYmd,
} from "@/lib/finance-june-migration";

export const OPERATIONAL_RESET_CONFIRM = "EXECUTE_OPERATIONAL_RESET";
export const MIGRATION_TYPE = "operational_reset_v1";

function isSchemaError(message: string) {
  return /column|schema cache|PGRST204|invalid input|enum|22P02|23514|relation|does not exist|PGRST205|excluir_do_saldo|finance_migration|caixa_opening/i.test(
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
  created_at?: string | null;
};

function receivableSemCobranca(r: ReceivableRow) {
  if (Number(r.valor || 0) > 0) return false;
  const raw = r.observacoes || r.responsavel_pagamento || "";
  const { meta } = unpackFinanceMeta(raw);
  return meta.sem_cobranca === true;
}

/** Recebível que deve entrar na fila de triagem (Aguardando Faturamento). */
export function receivableNeedsTriagem(r: ReceivableRow) {
  if (!r) return false;
  if (receivableSemCobranca(r) && String(r.status || "").toUpperCase() === "PAGO") return false;
  return true;
}

async function loadReceivables(supabase: SupabaseClient, userId: string) {
  const selects = [
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

function calcCashBalance(movs: CashRow[], onlyOperational = true) {
  let entradas = 0;
  let saidas = 0;
  let counted = 0;
  let excluded = 0;
  for (const m of movs) {
    if (onlyOperational && m.excluir_do_saldo) {
      excluded += 1;
      continue;
    }
    counted += 1;
    const v = Number(m.valor || 0);
    if (isEntradaTipo(m.tipo_conta)) entradas += v;
    else if (isSaidaTipo(m.tipo_conta)) saidas += v;
  }
  return { entradas, saidas, saldo: entradas - saidas, counted, excluded };
}

export async function buildOperationalResetPreview(supabase: SupabaseClient, userId: string) {
  const [receivables, cash] = await Promise.all([loadReceivables(supabase, userId), loadCash(supabase, userId)]);

  const vehicleIds = [...new Set(receivables.map((r) => r.vehicle_id).filter(Boolean))] as string[];
  const placaByVehicle = await loadPlates(supabase, userId, vehicleIds);

  const receivablesToAguardando: Array<
    ReceivableRow & {
      competence: string;
      placa: string | null;
      statusAtual: string;
      precisaMudarStatus: boolean;
      precisaResetAprovacao: boolean;
    }
  > = [];
  const receivablesSkipped = { sem_cobranca_pago_zero: 0 };

  const statusAtualCount = { PAGO: 0, EM_ABERTO: 0, AGUARDANDO_LANCAMENTO: 0, OUTROS: 0 };

  for (const r of receivables) {
    if (!receivableNeedsTriagem(r)) {
      receivablesSkipped.sem_cobranca_pago_zero += 1;
      continue;
    }
    const st = String(r.status || "").toUpperCase();
    if (st === "PAGO") statusAtualCount.PAGO += 1;
    else if (st === "EM_ABERTO") statusAtualCount.EM_ABERTO += 1;
    else if (st === AGUARDANDO_FATURAMENTO_STATUS) statusAtualCount.AGUARDANDO_LANCAMENTO += 1;
    else statusAtualCount.OUTROS += 1;

    const precisaMudarStatus = st !== AGUARDANDO_FATURAMENTO_STATUS;
    const precisaResetAprovacao = r.financeiro_aprovado_contas_receber === true;

    receivablesToAguardando.push({
      ...r,
      competence: receivableCompetenceYmd(r),
      placa: r.vehicle_id ? placaByVehicle.get(String(r.vehicle_id)) || null : null,
      statusAtual: st,
      precisaMudarStatus,
      precisaResetAprovacao,
    });
  }

  const cashToExclude = cash.filter((m) => !m.excluir_do_saldo);
  const cashAlreadyExcluded = cash.filter((m) => m.excluir_do_saldo).length;

  const saldoAtualOperacional = calcCashBalance(cash, true);
  const saldoSeTodosExcluidos = calcCashBalance(
    cash.map((m) => ({ ...m, excluir_do_saldo: true })),
    true
  );

  const impactoRemovido = cashToExclude.reduce(
    (acc, m) => {
      const v = Number(m.valor || 0);
      if (isEntradaTipo(m.tipo_conta)) acc.entradas += v;
      else if (isSaidaTipo(m.tipo_conta)) acc.saidas += v;
      return acc;
    },
    { entradas: 0, saidas: 0 }
  );

  const valorRecebiveisPago = receivablesToAguardando
    .filter((r) => r.statusAtual === "PAGO")
    .reduce((s, r) => s + Number(r.valor || 0), 0);
  const valorRecebiveisEmAberto = receivablesToAguardando
    .filter((r) => r.statusAtual === "EM_ABERTO")
    .reduce((s, r) => s + Number(r.valor || 0), 0);

  const byMonth: Record<string, number> = {};
  for (const r of receivablesToAguardando) {
    const ym = yearMonthFromYmd(r.competence) || "—";
    byMonth[ym] = (byMonth[ym] || 0) + 1;
  }

  return {
    ok: true,
    mode: "preview_only",
    migrationType: MIGRATION_TYPE,
    userId,
    generatedAt: new Date().toISOString(),
    objective: {
      filaPrincipal: "AGUARDANDO_LANCAMENTO (Aguardando Faturamento)",
      caixaOperacionalInicia: 0,
      historicoPreservado: true,
      exclusaoFisica: false,
      aprovacaoManualObrigatoria: true,
    },
    receivables: {
      totalNoSistema: receivables.length,
      totalParaAguardando: receivablesToAguardando.length,
      ignoradosSemCobrancaPagoZero: receivablesSkipped.sem_cobranca_pago_zero,
      statusAtualAntesDaMigracao: statusAtualCount,
      jaPagos: statusAtualCount.PAGO,
      emAberto: statusAtualCount.EM_ABERTO,
      jaAguardando: statusAtualCount.AGUARDANDO_LANCAMENTO,
      outrosStatus: statusAtualCount.OUTROS,
      precisamMudarStatus: receivablesToAguardando.filter((r) => r.precisaMudarStatus).length,
      precisamResetAprovacao: receivablesToAguardando.filter((r) => r.precisaResetAprovacao).length,
      valorTotalPago: valorRecebiveisPago,
      valorTotalEmAberto: valorRecebiveisEmAberto,
      porMesCompetencia: byMonth,
      statusAposMigracao: AGUARDANDO_FATURAMENTO_STATUS,
      camposAlterados: ["status", "financeiro_aprovado_contas_receber", "updated_at"],
    },
    cash: {
      totalNoSistema: cash.length,
      movimentosOperacionaisHoje: saldoAtualOperacional.counted,
      movimentosJaExcluidos: cashAlreadyExcluded,
      movimentosAPassarParaHistorico: cashToExclude.length,
      saldoOperacionalAtual: saldoAtualOperacional,
      impactoFinanceiroRemovidoDoCaixa: {
        entradas: impactoRemovido.entradas,
        saidas: impactoRemovido.saidas,
        saldoLiquido: impactoRemovido.entradas - impactoRemovido.saidas,
      },
      saldoOperacionalAposMigracao: {
        entradas: 0,
        saidas: 0,
        saldo: 0,
        movimentosContabilizados: saldoSeTodosExcluidos.counted,
      },
      campoAlterado: "excluir_do_saldo = true",
    },
    comoSaldoOperacionalFicaZero: {
      passo1:
        "Todas as movimentações existentes em cash_movements recebem excluir_do_saldo = true. Permanecem no banco para auditoria, mas deixam de entrar na soma do caixa operacional.",
      passo2:
        "settings.caixa_opening_balance é gravado como 0 (saldo inicial da nova fase operacional).",
      passo3:
        "A função de saldo operacional passa a calcular: saldo_abertura (0) + entradas válidas − saídas válidas, onde válido = excluir_do_saldo false E recebível/despesa aprovado manualmente.",
      passo4:
        "Recebíveis vão para AGUARDANDO_LANCAMENTO com financeiro_aprovado_contas_receber = false. Nenhum deles gera entrada no caixa até você aprovar na triagem e confirmar pagamento.",
      passo5:
        "Após a migração, sem novos lançamentos aprovados, o saldo operacional exibido será R$ 0,00.",
      formula:
        "saldo_operacional = caixa_opening_balance (0) + Σ movimentos com excluir_do_saldo=false → 0 após migração",
    },
    tablesAndFields: {
      receivables: {
        table: "receivables",
        action: "UPDATE status → AGUARDANDO_LANCAMENTO; financeiro_aprovado_contas_receber → false",
        delete: false,
      },
      cash_movements: {
        table: "cash_movements",
        action: "UPDATE excluir_do_saldo → true (todas as linhas operacionais)",
        delete: false,
      },
      settings: {
        table: "settings",
        action: "UPDATE caixa_opening_balance → 0; caixa_operational_reset_at → now",
        delete: false,
      },
      finance_migration_runs: { table: "finance_migration_runs", action: "INSERT registro da execução" },
      finance_migration_snapshots: {
        table: "finance_migration_snapshots",
        action: "INSERT payload_before de cada linha alterada (base do rollback)",
      },
    },
    rollback: {
      endpoint: "POST /api/finance/operational-reset/rollback",
      body: { userId, migrationId: "<uuid da execução>" },
      description: "Restaura cada receivable, cash_movement e settings a partir do JSON em finance_migration_snapshots.",
    },
    samples: {
      receivables: receivablesToAguardando.slice(0, 50).map((r) => ({
        id: r.id,
        placa: r.placa,
        valor: r.valor,
        statusAtual: r.statusAtual,
        statusNovo: AGUARDANDO_FATURAMENTO_STATUS,
        competence: r.competence,
        precisaMudarStatus: r.precisaMudarStatus,
      })),
      cashMovements: cashToExclude.slice(0, 30).map((m) => ({
        id: m.id,
        tipo_conta: m.tipo_conta,
        valor: m.valor,
        competence: cashMovCompetenceYmd(m),
        conta_id: m.conta_id,
      })),
    },
    executeRequires: {
      confirm: OPERATIONAL_RESET_CONFIRM,
      endpoint: "POST /api/finance/operational-reset/execute",
      sqlPreRequisite: "supabase/finance_june_migration.sql (coluna excluir_do_saldo + tabelas snapshot)",
    },
  };
}

export async function executeOperationalReset(supabase: SupabaseClient, userId: string) {
  const preview = await buildOperationalResetPreview(supabase, userId);

  const { data: runRow, error: runErr } = await supabase
    .from("finance_migration_runs")
    .insert({
      user_id: userId,
      migration_type: MIGRATION_TYPE,
      cutoff_ymd: toYmd(new Date().toISOString()),
      status: "executing",
      summary: preview.receivables,
    })
    .select("id")
    .single();

  if (runErr) {
    if (isSchemaError(runErr.message || "")) {
      throw new Error("Execute supabase/finance_june_migration.sql no Supabase antes da migração.");
    }
    throw new Error(runErr.message);
  }

  const migrationId = String(runRow.id);
  const errors: string[] = [];
  let snapshots = 0;
  let receivablesUpdated = 0;
  let cashUpdated = 0;

  const [receivables, cash] = await Promise.all([loadReceivables(supabase, userId), loadCash(supabase, userId)]);

  for (const r of receivables) {
    if (!receivableNeedsTriagem(r)) continue;
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

  for (const m of cash) {
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

  const { data: settings } = await supabase
    .from("settings")
    .select("id,caixa_opening_balance,caixa_operational_reset_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (settings?.id) {
    await supabase.from("finance_migration_snapshots").insert({
      migration_id: migrationId,
      user_id: userId,
      entity_type: "settings",
      entity_id: settings.id,
      payload_before: settings,
    });
    snapshots += 1;
    const resetAt = new Date().toISOString();
    const { error } = await supabase
      .from("settings")
      .update({ caixa_opening_balance: 0, caixa_operational_reset_at: resetAt })
      .eq("id", settings.id);
    if (error && !isSchemaError(error.message || "")) errors.push(`settings: ${error.message}`);
  }

  await supabase
    .from("finance_migration_runs")
    .update({
      status: errors.length ? "executed_with_errors" : "executed",
      executed_at: new Date().toISOString(),
      summary: { snapshots, receivablesUpdated, cashUpdated, errors },
    })
    .eq("id", migrationId);

  return { ok: errors.length === 0, migrationId, snapshots, receivablesUpdated, cashUpdated, errors, preview };
}

export async function rollbackOperationalReset(supabase: SupabaseClient, userId: string, migrationId: string) {
  const { data: run } = await supabase
    .from("finance_migration_runs")
    .select("id,status,user_id,migration_type")
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

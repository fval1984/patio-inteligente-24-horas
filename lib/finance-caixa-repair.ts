import type { SupabaseClient } from "@supabase/supabase-js";

function isSchemaError(message: string) {
  return /column|schema cache|PGRST204|invalid input|enum|22P02|23514|forma_pagamento|descricao|data_movimento|relation|does not exist|PGRST205|caixa_reset_ym/i.test(
    message
  );
}

function toYmd(value: string | null | undefined) {
  if (!value) return "";
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s.includes("T") ? s : `${s.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function paidDateFromReceivable(rec: {
  observacoes?: string | null;
  responsavel_pagamento?: string | null;
  updated_at?: string | null;
  period_end?: string | null;
  created_at?: string | null;
}) {
  const raw = String(rec.observacoes || rec.responsavel_pagamento || "");
  const FINANCE_META_PREFIX = "[[finmeta:";
  if (raw.startsWith(FINANCE_META_PREFIX)) {
    const end = raw.indexOf("]]");
    if (end > 0) {
      try {
        const meta = JSON.parse(raw.slice(FINANCE_META_PREFIX.length, end)) as {
          data_pagamento?: string;
          data_recebimento?: string;
        };
        const d = meta.data_pagamento || meta.data_recebimento;
        if (d) return toYmd(String(d));
      } catch {
        /* ignore */
      }
    }
  }
  const paid = toYmd(rec.updated_at || "");
  if (paid) return paid;
  return toYmd(rec.period_end || rec.created_at);
}

function isEntradaTipo(tipo: string | null | undefined) {
  const t = String(tipo || "").toUpperCase();
  return t === "RECEBER" || t === "ENTRADA";
}

export async function restoreCashMovementsFromArchive(supabase: SupabaseClient, userId: string) {
  const { data: archives, error: archErr } = await supabase
    .from("cash_movements_archive")
    .select("original_id,payload,backup_run_id")
    .eq("user_id", userId)
    .order("archived_at", { ascending: true });
  if (archErr) {
    if (isSchemaError(archErr.message || "")) {
      return { restored: 0, skipped: 0, failed: 0, archiveMissing: true };
    }
    throw new Error(archErr.message);
  }

  const { data: current } = await supabase.from("cash_movements").select("id,conta_id,tipo_conta").eq("user_id", userId);
  const ids = new Set((current || []).map((r) => String(r.id)));
  const contaEntrada = new Set(
    (current || [])
      .filter((r) => isEntradaTipo(r.tipo_conta) && r.conta_id)
      .map((r) => String(r.conta_id))
  );

  let restored = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of archives || []) {
    const p = row.payload as Record<string, unknown> | null;
    if (!p) {
      skipped += 1;
      continue;
    }
    const originalId = String(row.original_id || p.id || "");
    if (originalId && ids.has(originalId)) {
      skipped += 1;
      continue;
    }
    const contaId = p.conta_id ? String(p.conta_id) : "";
    if (contaId && isEntradaTipo(String(p.tipo_conta || "")) && contaEntrada.has(contaId)) {
      skipped += 1;
      continue;
    }

    const insertBody: Record<string, unknown> = {
      user_id: userId,
      tipo_conta: p.tipo_conta || "RECEBER",
      conta_id: p.conta_id || null,
      valor: Number(p.valor || 0),
      descricao: p.descricao || null,
      data_movimento: p.data_movimento || null,
      forma_pagamento: p.forma_pagamento || null,
      created_at: p.created_at || undefined,
    };

    const attempts = [
      insertBody,
      { user_id: userId, tipo_conta: insertBody.tipo_conta, conta_id: insertBody.conta_id, valor: insertBody.valor, data_movimento: insertBody.data_movimento },
      { user_id: userId, tipo_conta: "RECEBER", conta_id: insertBody.conta_id, valor: insertBody.valor },
    ];

    let ok = false;
    for (const body of attempts) {
      const { error } = await supabase.from("cash_movements").insert(body);
      if (!error) {
        ok = true;
        if (contaId && isEntradaTipo(String(body.tipo_conta || ""))) contaEntrada.add(contaId);
        restored += 1;
        break;
      }
      if (!isSchemaError(error.message || "")) break;
    }
    if (!ok) failed += 1;
  }

  return { restored, skipped, failed, archiveMissing: false, archiveRows: (archives || []).length };
}

async function findExistingEntrada(supabase: SupabaseClient, userId: string, receivableId: string) {
  const { data } = await supabase
    .from("cash_movements")
    .select("id")
    .eq("user_id", userId)
    .eq("conta_id", receivableId)
    .in("tipo_conta", ["RECEBER", "ENTRADA"])
    .limit(1);
  return data?.[0]?.id || null;
}

async function insertEntradaForReceivable(
  supabase: SupabaseClient,
  userId: string,
  rec: {
    id: string;
    valor: number | null;
    observacoes?: string | null;
    responsavel_pagamento?: string | null;
    updated_at?: string | null;
    period_end?: string | null;
    created_at?: string | null;
    vehicle_id?: string | null;
  },
  placaByVehicle: Map<string, string>
) {
  const valor = Number(rec.valor || 0);
  if (!(valor > 0)) return { action: "skipped" as const };

  const existing = await findExistingEntrada(supabase, userId, rec.id);
  if (existing) return { action: "skipped" as const };

  const dataYmd = paidDateFromReceivable(rec) || toYmd(new Date().toISOString());
  const placa = rec.vehicle_id ? placaByVehicle.get(String(rec.vehicle_id)) : null;
  const descricao = placa ? `Recebimento ${placa}` : "Recebimento";

  const payloads = [
    { user_id: userId, tipo_conta: "RECEBER", conta_id: rec.id, valor, descricao, data_movimento: dataYmd, forma_pagamento: "PIX" },
    { user_id: userId, tipo_conta: "RECEBER", conta_id: rec.id, valor, descricao, data_movimento: dataYmd },
    { user_id: userId, tipo_conta: "RECEBER", conta_id: rec.id, valor, data_movimento: dataYmd },
    { user_id: userId, tipo_conta: "RECEBER", conta_id: rec.id, valor },
  ];

  for (const body of payloads) {
    const { error } = await supabase.from("cash_movements").insert(body);
    if (!error) return { action: "created" as const };
    if (!isSchemaError(error.message || "")) return { action: "failed" as const, error: error.message };
  }
  const verified = await findExistingEntrada(supabase, userId, rec.id);
  return verified ? { action: "created" as const } : { action: "failed" as const };
}

export async function syncMissingCashForPaidReceivables(supabase: SupabaseClient, userId: string) {
  const selects = [
    "id,user_id,vehicle_id,valor,status,observacoes,responsavel_pagamento,updated_at,created_at,period_end",
    "id,user_id,vehicle_id,valor,status,updated_at,created_at,period_end",
    "id,user_id,vehicle_id,valor,status,updated_at,created_at",
  ];
  let recs: Array<{
    id: string;
    vehicle_id?: string | null;
    valor: number | null;
    status: string | null;
    observacoes?: string | null;
    responsavel_pagamento?: string | null;
    updated_at?: string | null;
    period_end?: string | null;
    created_at?: string | null;
  }> = [];
  for (const sel of selects) {
    const res = await supabase.from("receivables").select(sel).eq("user_id", userId).eq("status", "PAGO");
    if (!res.error) {
      recs = (res.data || []) as typeof recs;
      break;
    }
    if (!isSchemaError(res.error.message || "")) throw new Error(res.error.message);
  }

  const vehicleIds = [...new Set(recs.map((r) => r.vehicle_id).filter(Boolean))] as string[];
  const placaByVehicle = new Map<string, string>();
  if (vehicleIds.length) {
    const { data: vehicles } = await supabase.from("vehicles").select("id,placa").eq("user_id", userId).in("id", vehicleIds);
    for (const v of vehicles || []) {
      if (v?.id && v.placa) placaByVehicle.set(String(v.id), String(v.placa));
    }
  }

  let created = 0;
  let skipped = 0;
  let failed = 0;
  for (const rec of recs) {
    const result = await insertEntradaForReceivable(supabase, userId, rec, placaByVehicle);
    if (result.action === "created") created += 1;
    else if (result.action === "skipped") skipped += 1;
    else failed += 1;
  }

  return { created, skipped, failed, totalPaid: recs.length };
}

export async function clearCaixaResetYm(supabase: SupabaseClient, userId: string) {
  const { data: settings } = await supabase
    .from("settings")
    .select("id,caixa_reset_ym")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!settings?.id) return { cleared: false, previous: null };
  const prev = settings.caixa_reset_ym || null;
  const { error } = await supabase.from("settings").update({ caixa_reset_ym: null }).eq("id", settings.id);
  if (error && isSchemaError(error.message || "")) return { cleared: false, previous: prev, schemaMissing: true };
  if (error) throw new Error(error.message);
  return { cleared: true, previous: prev };
}

export async function executeFullCaixaRepair(supabase: SupabaseClient, userId: string) {
  const archive = await restoreCashMovementsFromArchive(supabase, userId);
  const sync = await syncMissingCashForPaidReceivables(supabase, userId);
  const reset = await clearCaixaResetYm(supabase, userId);

  const { data: movs } = await supabase
    .from("cash_movements")
    .select("tipo_conta,valor")
    .eq("user_id", userId);

  let entradas = 0;
  let saidas = 0;
  for (const m of movs || []) {
    const t = String(m.tipo_conta || "").toUpperCase();
    const v = Number(m.valor || 0);
    if (t === "RECEBER" || t === "ENTRADA") entradas += v;
    else if (t === "PAGAR" || t === "SAIDA" || t === "SAÍDA") saidas += v;
  }

  return {
    ok: true,
    archive,
    sync,
    reset,
    movementsAfter: (movs || []).length,
    saldo: entradas - saidas,
    entradas,
    saidas,
  };
}

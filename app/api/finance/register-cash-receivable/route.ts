import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type ReceivableRow = {
  id: string;
  user_id: string;
  vehicle_id: string | null;
  valor: number | null;
  status: string | null;
  forma_pagamento: string | null;
  responsavel_pagamento: string | null;
  observacoes?: string | null;
  updated_at: string | null;
  created_at: string | null;
  period_end?: string | null;
};

function normalizePlate(p: string) {
  return String(p || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function toYmd(value: string | null | undefined) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s.includes("T") ? s : `${s}T12:00:00`);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

/** Data civil em São Paulo — evita pagamento às 22h virar dia seguinte em UTC. */
function toYmdBr(value: string | null | undefined) {
  if (!value) return null;
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s.includes("T") ? s : `${s}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    return toYmd(value);
  }
}

function ymdWithinOneDay(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return false;
  if (a === b) return true;
  const da = new Date(`${a}T12:00:00`).getTime();
  const db = new Date(`${b}T12:00:00`).getTime();
  if (!Number.isFinite(da) || !Number.isFinite(db)) return false;
  return Math.abs(da - db) <= 86400000;
}

function isSchemaError(message: string) {
  return /column|schema cache|PGRST204|invalid input|enum|22P02|23514|tipo_conta|forma_pagamento|descricao|data_movimento|observacoes|relation|does not exist|PGRST205/i.test(
    message
  );
}

async function selectPaidReceivablesForUser(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string
) {
  const full = await supabase
    .from("receivables")
    .select("id,user_id,vehicle_id,valor,status,responsavel_pagamento,observacoes,updated_at,created_at,period_end")
    .eq("user_id", userId)
    .eq("status", "PAGO");
  if (!full.error || !isSchemaError(full.error.message)) {
    return { data: (full.data || []) as ReceivableRow[], error: full.error };
  }
  return supabase
    .from("receivables")
    .select("id,user_id,vehicle_id,valor,status,responsavel_pagamento,updated_at,created_at,period_end")
    .eq("user_id", userId)
    .eq("status", "PAGO");
}

function cashMovIsEntradaTipo(tipo: string | null | undefined) {
  const t = String(tipo || "").toUpperCase();
  return t === "RECEBER" || t === "ENTRADA";
}

function cashMovRank(mov: { tipo_conta?: string | null; valor?: number | null; created_at?: string | null }) {
  let score = 0;
  const t = String(mov?.tipo_conta || "").toUpperCase();
  if (t === "RECEBER") score += 100;
  else if (t === "ENTRADA") score += 50;
  if (Number(mov?.valor || 0) > 0) score += 10;
  const ts = new Date(mov?.created_at || 0).getTime();
  if (Number.isFinite(ts)) score += ts / 1e6;
  return score;
}

function dedupePaidReceivablesByVehicle(receivables: ReceivableRow[]) {
  const byKey = new Map<string, ReceivableRow>();
  for (const r of receivables || []) {
    if (!r?.id) continue;
    if (!r.vehicle_id) {
      byKey.set(`id:${r.id}`, r);
      continue;
    }
    const endYmd = toYmd(r.period_end || r.updated_at || r.created_at);
    const key = `${String(r.vehicle_id)}|${endYmd}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, r);
      continue;
    }
    const prevTs = new Date(prev.updated_at || prev.created_at || 0).getTime();
    const curTs = new Date(r.updated_at || r.created_at || 0).getTime();
    if (curTs >= prevTs) byKey.set(key, r);
  }
  return [...byKey.values()];
}

function placaFromDescricao(descricao: string | null | undefined) {
  const m = String(descricao || "").match(/(?:Diárias|Recebimento|Recuperação caixa)\s*[—\-]\s*([A-Z0-9]+)/i);
  return m ? normalizePlate(m[1]) : "";
}

function metaFromReceivableObservacoes(obs: string | null | undefined) {
  const raw = String(obs || "");
  const m = raw.match(/^\[\[finmeta:(\{.*?\})\]\]/);
  if (!m) return {};
  try {
    return JSON.parse(m[1]) as {
      data_pagamento?: string;
      data_recebimento?: string;
      forma_pagamento?: string;
    };
  } catch {
    return {};
  }
}

function formaPagamentoFromReceivable(rec: {
  forma_pagamento?: string | null;
  observacoes?: string | null;
}) {
  if (rec.forma_pagamento) return rec.forma_pagamento;
  const raw = String(rec.observacoes || rec.responsavel_pagamento || "");
  return metaFromReceivableObservacoes(raw).forma_pagamento || rec.forma_pagamento || "PIX";
}

function paidDateFromReceivableObservacoes(rec: { observacoes?: string | null; updated_at?: string | null; period_end?: string | null; created_at?: string | null }) {
  const meta = metaFromReceivableObservacoes(rec.observacoes);
  const d = meta?.data_pagamento || meta?.data_recebimento;
  if (d) return toYmd(String(d));
  return toYmd(rec.updated_at || rec.period_end || rec.created_at);
}

async function purgeExtraMovementsForConta(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  contaId: string,
  keepId: string
) {
  const { data } = await supabase
    .from("cash_movements")
    .select("id")
    .eq("user_id", userId)
    .eq("conta_id", contaId);
  let removed = 0;
  for (const row of data || []) {
    if (!row?.id || row.id === keepId) continue;
    const { error } = await supabase.from("cash_movements").delete().eq("id", row.id).eq("user_id", userId);
    if (!error) removed += 1;
  }
  return removed;
}

/** Remove entradas duplicadas (mesmo veículo/placa + data + valor). */
async function cleanupDuplicateCashEntradas(supabase: ReturnType<typeof getSupabaseAdmin>, userId: string) {
  const { data: movs, error } = await supabase
    .from("cash_movements")
    .select("id,conta_id,tipo_conta,valor,data_movimento,created_at,descricao")
    .eq("user_id", userId);
  if (error || !movs?.length) return { removed: 0 };

  const contaIds = [...new Set(movs.map((m) => m.conta_id).filter(Boolean))] as string[];
  const vehicleByRec = new Map<string, string>();
  if (contaIds.length) {
    const { data: recs } = await supabase
      .from("receivables")
      .select("id,vehicle_id")
      .eq("user_id", userId)
      .in("id", contaIds);
    for (const r of recs || []) {
      if (r?.id && r.vehicle_id) vehicleByRec.set(String(r.id), String(r.vehicle_id));
    }
  }

  const groups = new Map<string, typeof movs>();
  for (const mov of movs) {
    if (!cashMovIsEntradaTipo(mov.tipo_conta)) continue;
    const ymd = toYmd(mov.data_movimento);
    const valorKey = Math.round(Number(mov.valor || 0) * 100);
    const vehicleId = mov.conta_id ? vehicleByRec.get(String(mov.conta_id)) : null;
    const placa = placaFromDescricao(mov.descricao);
    // conta_id primeiro: evita apagar entradas distintas do mesmo veículo/data/valor
    const key =
      mov.conta_id != null && mov.conta_id !== ""
        ? `c:${String(mov.conta_id)}`
        : vehicleId
          ? `v:${vehicleId}|${ymd}|${valorKey}`
          : placa
            ? `p:${placa}|${ymd}|${valorKey}`
            : `id:${mov.id}`;
    const bucket = groups.get(key) || [];
    bucket.push(mov);
    groups.set(key, bucket);
  }

  let removed = 0;
  for (const list of groups.values()) {
    if (list.length <= 1) continue;
    const sorted = [...list].sort((a, b) => cashMovRank(b) - cashMovRank(a));
    const keepId = sorted[0]?.id;
    if (!keepId) continue;
    for (let i = 1; i < sorted.length; i++) {
      const id = sorted[i]?.id;
      if (!id) continue;
      const { error: delErr } = await supabase.from("cash_movements").delete().eq("id", id).eq("user_id", userId);
      if (!delErr) removed += 1;
    }
    if (sorted[0]?.conta_id) {
      removed += await purgeExtraMovementsForConta(supabase, userId, String(sorted[0].conta_id), keepId);
    }
  }
  return { removed };
}

async function findExistingMovement(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  receivableId: string
) {
  for (const tipo of ["RECEBER", "ENTRADA"]) {
    const { data } = await supabase
      .from("cash_movements")
      .select("id,valor,data_movimento,forma_pagamento,tipo_conta,conta_id")
      .eq("user_id", userId)
      .eq("conta_id", receivableId)
      .eq("tipo_conta", tipo)
      .limit(1);
    if (data?.length) return data[0];
  }
  const { data: linked } = await supabase
    .from("cash_movements")
    .select("id,valor,data_movimento,forma_pagamento,tipo_conta,conta_id")
    .eq("user_id", userId)
    .eq("conta_id", receivableId)
    .limit(5);
  return (
    (linked || []).find((m) => {
      const t = String(m?.tipo_conta || "").toUpperCase();
      return t === "RECEBER" || t === "ENTRADA";
    }) || null
  );
}

async function upsertCashForReceivable(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  rec: ReceivableRow,
  opts: {
    valor?: number;
    dataMovimento?: string;
    formaPagamento?: string;
    descricao?: string;
    vehiclePlaca?: string | null;
  } = {}
) {
  const receivableId = rec.id;
  const valor = Number(opts.valor ?? rec.valor ?? 0);
  if (!(valor > 0)) return { ok: true, action: "skipped", reason: "valor_zero" as const };

  const dataYmd = toYmd(opts.dataMovimento || rec.updated_at || rec.period_end || rec.created_at);
  const isoMov = new Date(`${dataYmd}T12:00:00`).toISOString();
  const formaPagamento = opts.formaPagamento || formaPagamentoFromReceivable(rec);
  const placa = opts.vehiclePlaca || "";
  const descricao =
    opts.descricao ||
    (placa ? `Diárias - ${placa}` : rec.responsavel_pagamento || "Recebimento pátio");

  const existing = await findExistingMovement(supabase, userId, receivableId);
  const payloads = [
    {
      user_id: userId,
      tipo_conta: existing?.tipo_conta || "RECEBER",
      conta_id: receivableId,
      valor,
      descricao,
      data_movimento: dataYmd,
      forma_pagamento: formaPagamento,
    },
    {
      user_id: userId,
      tipo_conta: "RECEBER",
      conta_id: receivableId,
      valor,
      data_movimento: isoMov,
      descricao,
    },
    { user_id: userId, tipo_conta: "ENTRADA", conta_id: receivableId, valor, data_movimento: dataYmd },
    { user_id: userId, tipo_conta: "RECEBER", conta_id: receivableId, valor },
  ];

  let lastError: string | null = null;
  for (const body of payloads) {
    if (existing?.id) {
      const { error } = await supabase.from("cash_movements").update(body).eq("id", existing.id).eq("user_id", userId);
      if (!error) {
        await purgeExtraMovementsForConta(supabase, userId, receivableId, existing.id);
        return { ok: true, action: "updated" as const, movement: body };
      }
      lastError = error.message;
    } else {
      const { error } = await supabase.from("cash_movements").insert(body);
      if (!error) {
        const verified = await findExistingMovement(supabase, userId, receivableId);
        if (verified?.id) {
          await purgeExtraMovementsForConta(supabase, userId, receivableId, verified.id);
          return { ok: true, action: "created" as const, movement: verified };
        }
        return { ok: true, action: "created" as const, movement: body };
      }
      lastError = error.message;
      if (/duplicate key|unique constraint|23505/i.test(lastError)) {
        const fresh = await findExistingMovement(supabase, userId, receivableId);
        if (fresh?.id) {
          const { error: updErr } = await supabase
            .from("cash_movements")
            .update({ valor, data_movimento: dataYmd, descricao, forma_pagamento: formaPagamento })
            .eq("id", fresh.id)
            .eq("user_id", userId);
          if (!updErr) return { ok: true, action: "updated" as const, movement: body };
          lastError = updErr.message;
        }
      }
    }
    if (!isSchemaError(lastError || "")) break;
  }

  const verified = await findExistingMovement(supabase, userId, receivableId);
  if (verified?.id) {
    await purgeExtraMovementsForConta(supabase, userId, receivableId, verified.id);
    return { ok: true, action: "verified" as const, movement: verified };
  }

  return { ok: false, action: "failed" as const, error: lastError || "Não foi possível gravar movimento no caixa." };
}

async function ensureReceivableMarkedPaid(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  receivableId: string
) {
  const patch = {
    status: "PAGO",
    financeiro_aprovado_contas_receber: true,
    updated_at: new Date().toISOString(),
  };
  let { error } = await supabase.from("receivables").update(patch).eq("id", receivableId).eq("user_id", userId);
  if (error && isSchemaError(error.message || "")) {
    ({ error } = await supabase
      .from("receivables")
      .update({ status: "PAGO", updated_at: patch.updated_at })
      .eq("id", receivableId)
      .eq("user_id", userId));
  }
  return !error;
}

async function loadPlacaMap(supabase: ReturnType<typeof getSupabaseAdmin>, userId: string, vehicleIds: string[]) {
  const placaByVehicle = new Map<string, string>();
  if (!vehicleIds.length) return placaByVehicle;
  const { data: vehicles } = await supabase.from("vehicles").select("id,placa").eq("user_id", userId).in("id", vehicleIds);
  for (const v of vehicles || []) {
    if (v?.id) placaByVehicle.set(String(v.id), String(v.placa || ""));
  }
  return placaByVehicle;
}

/** Último ciclo encerrado por veículo VRP (para recuperar pagamentos confirmados sem caixa). */
async function loadVrpReceivablesToRecover(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  plateFilter?: string[]
) {
  const { data: vehicles, error: vErr } = await supabase
    .from("vehicles")
    .select("id,placa,status,data_saida")
    .eq("user_id", userId)
    .eq("status", "REMOVIDO");
  if (vErr) throw new Error(vErr.message);

  let matched = vehicles || [];
  if (plateFilter?.length) {
    const wanted = new Set(plateFilter.map(normalizePlate));
    matched = matched.filter((v) => wanted.has(normalizePlate(String(v.placa || ""))));
  }
  const vehicleIds = matched.map((v) => v.id).filter(Boolean);
  if (!vehicleIds.length) return { receivables: [] as ReceivableRow[], placaByVehicle: new Map<string, string>() };

  const { data: recs, error: rErr } = await supabase
    .from("receivables")
    .select(
      "id,user_id,vehicle_id,valor,status,responsavel_pagamento,observacoes,updated_at,created_at,period_end"
    )
    .eq("user_id", userId)
    .in("vehicle_id", vehicleIds)
    .not("period_end", "is", null)
    .gt("valor", 0)
    .order("created_at", { ascending: false });
  if (rErr) throw new Error(rErr.message);

  const byVehicle = new Map<string, ReceivableRow>();
  for (const r of recs || []) {
    if (!r?.vehicle_id) continue;
    const key = String(r.vehicle_id);
    if (!byVehicle.has(key)) byVehicle.set(key, r as ReceivableRow);
  }

  const placaByVehicle = new Map<string, string>();
  for (const v of matched) {
    if (v?.id) placaByVehicle.set(String(v.id), String(v.placa || ""));
  }

  return { receivables: [...byVehicle.values()], placaByVehicle };
}

type RecoverEntry = { plate: string; valor?: number; paidDate?: string; saidaDate?: string; includeZeroValor?: boolean };
type BatchOverride = { dataMovimento?: string; valor?: number };

/** Mesma placa pode ter vários ciclos RPP encerrados (ex.: SNO8E38 João Vitor R$20 + VIP R$210). */
function pickBestReceivableForEntry(
  recs: ReceivableRow[],
  entry: RecoverEntry,
  excludeIds?: Set<string>
): ReceivableRow | null {
  let candidates = (recs || []).filter((r) => r?.id && !excludeIds?.has(r.id));
  if (!candidates.length) return null;
  const targetValor = entry.valor != null ? Number(entry.valor) : null;
  const targetSaida = entry.saidaDate ? toYmd(entry.saidaDate) : null;
  const targetPaid = entry.paidDate ? toYmd(entry.paidDate) : null;
  if (targetValor != null && targetValor > 0) {
    const byValor = candidates.filter((r) => Math.abs(Number(r.valor || 0) - targetValor) < 0.01);
    if (byValor.length) candidates = byValor;
  } else if (entry.includeZeroValor || targetValor === 0) {
    const byZero = candidates.filter((r) => Math.abs(Number(r.valor || 0)) < 0.01);
    if (byZero.length) candidates = byZero;
  }
  if (targetSaida) {
    const bySaida = candidates.filter((r) => toYmd(r.period_end || "") === targetSaida);
    if (bySaida.length) candidates = bySaida;
  }
  if (targetPaid && candidates.length > 1) {
    const byPaid = candidates.filter((r) => {
      const payYmdBr = toYmdBr(r.updated_at);
      const payYmd = toYmd(r.updated_at || r.period_end || r.created_at);
      return (
        payYmdBr === targetPaid ||
        payYmd === targetPaid ||
        ymdWithinOneDay(payYmdBr, targetPaid) ||
        ymdWithinOneDay(payYmd, targetPaid)
      );
    });
    if (byPaid.length) candidates = byPaid;
  } else if (!targetSaida && targetPaid) {
    const byDate = candidates.filter((r) => {
      const payYmdBr = toYmdBr(r.updated_at);
      const payYmd = toYmd(r.updated_at || r.period_end || r.created_at);
      const endYmd = toYmd(r.period_end || "");
      return (
        payYmdBr === targetPaid ||
        payYmd === targetPaid ||
        endYmd === targetPaid ||
        ymdWithinOneDay(payYmdBr, targetPaid) ||
        ymdWithinOneDay(payYmd, targetPaid)
      );
    });
    if (byDate.length) candidates = byDate;
  }

  return (
    candidates.sort((a, b) => {
      const aPaid = String(a.status || "").toUpperCase() === "PAGO" ? 1 : 0;
      const bPaid = String(b.status || "").toUpperCase() === "PAGO" ? 1 : 0;
      if (bPaid !== aPaid) return bPaid - aPaid;
      return String(b.period_end || "").localeCompare(String(a.period_end || ""));
    })[0] || null
  );
}

/** Casamento placa + valor + data — cada ciclo RPP gera recebível e entrada no caixa distintos. */
async function loadReceivablesFromRecoverEntries(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  entries: RecoverEntry[]
) {
  const sortedEntries = [...entries].sort((a, b) => {
    const da = a.paidDate ? toYmd(a.paidDate) : "";
    const db = b.paidDate ? toYmd(b.paidDate) : "";
    if (da !== db) return da.localeCompare(db);
    return normalizePlate(a.plate).localeCompare(normalizePlate(b.plate));
  });
  const { data: vehicles, error: vErr } = await supabase.from("vehicles").select("id,placa").eq("user_id", userId);
  if (vErr) throw new Error(vErr.message);

  const vehicleByPlate = new Map<string, { id: string; placa: string }>();
  for (const v of vehicles || []) {
    if (!v?.id) continue;
    vehicleByPlate.set(normalizePlate(String(v.placa || "")), { id: String(v.id), placa: String(v.placa || "") });
  }

  const receivables: ReceivableRow[] = [];
  const overrides = new Map<string, BatchOverride>();
  const placaByVehicle = new Map<string, string>();
  const notFound: string[] = [];
  const seenRecIds = new Set<string>();

  for (const entry of sortedEntries) {
    const plateKey = normalizePlate(entry.plate);
    const vehicle = vehicleByPlate.get(plateKey);
    if (!vehicle) {
      notFound.push(`${entry.plate} (veículo não encontrado)`);
      continue;
    }
    placaByVehicle.set(vehicle.id, vehicle.placa);

    let recQuery = supabase
      .from("receivables")
      .select(
        "id,user_id,vehicle_id,valor,status,responsavel_pagamento,updated_at,created_at,period_end,period_start,observacoes"
      )
      .eq("user_id", userId)
      .eq("vehicle_id", vehicle.id)
      .not("period_end", "is", null);
    if (!entry.includeZeroValor && entry.valor !== 0) {
      recQuery = recQuery.gt("valor", 0);
    }
    const { data: recs, error: rErr } = await recQuery;
    if (rErr) throw new Error(rErr.message);

    const rec = pickBestReceivableForEntry((recs || []) as ReceivableRow[], entry, seenRecIds);
    if (!rec) {
      notFound.push(`${entry.plate} R$ ${entry.valor ?? "?"} ${entry.paidDate ?? ""} (recebível não encontrado)`);
      continue;
    }
    seenRecIds.add(rec.id);
    receivables.push(rec);
    overrides.set(rec.id, {
      dataMovimento: entry.paidDate ? toYmd(entry.paidDate) : undefined,
      valor: entry.valor,
    });
  }

  return { receivables, placaByVehicle, overrides, notFound };
}

async function deleteCashMovementsForReceivable(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  receivableId: string
) {
  const { data, error } = await supabase
    .from("cash_movements")
    .select("id,tipo_conta")
    .eq("user_id", userId)
    .eq("conta_id", receivableId);
  if (error) return { removed: 0, error: error.message };
  let removed = 0;
  for (const row of data || []) {
    if (!row?.id) continue;
    if (!cashMovIsEntradaTipo(row.tipo_conta)) continue;
    const { error: delErr } = await supabase.from("cash_movements").delete().eq("id", row.id).eq("user_id", userId);
    if (!delErr) removed += 1;
  }
  return { removed, error: null as string | null };
}

async function revertReceivableToAguardando(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  rec: ReceivableRow
) {
  const cash = await deleteCashMovementsForReceivable(supabase, userId, rec.id);
  const now = new Date().toISOString();
  const patch = {
    status: "AGUARDANDO_LANCAMENTO",
    financeiro_aprovado_contas_receber: false,
    patio_liberado_financeiro: true,
    updated_at: now,
  };
  let { error } = await supabase.from("receivables").update(patch).eq("id", rec.id).eq("user_id", userId);
  if (error && isSchemaError(error.message)) {
    ({ error } = await supabase
      .from("receivables")
      .update({ status: "AGUARDANDO_LANCAMENTO", updated_at: now })
      .eq("id", rec.id)
      .eq("user_id", userId));
    if (error && /invalid input value for enum payment_status.*AGUARDANDO/i.test(error.message)) {
      ({ error } = await supabase
        .from("receivables")
        .update({ status: "EM_ABERTO", updated_at: now })
        .eq("id", rec.id)
        .eq("user_id", userId));
    }
  }
  return { ok: !error, error: error?.message || cash.error, cashRemoved: cash.removed };
}

async function processRevertToAguardandoBatch(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  receivables: ReceivableRow[]
) {
  let reverted = 0;
  let failed = 0;
  let skipped = 0;
  let cashRemoved = 0;
  const revertedIds: string[] = [];

  for (const rec of receivables) {
    if (String(rec.status || "").toUpperCase() !== "PAGO") {
      skipped += 1;
      continue;
    }
    const result = await revertReceivableToAguardando(supabase, userId, rec);
    if (!result.ok) {
      failed += 1;
      continue;
    }
    reverted += 1;
    cashRemoved += result.cashRemoved;
    revertedIds.push(rec.id);
  }

  return { reverted, failed, skipped, cashRemoved, revertedIds, total: receivables.length };
}

async function processReceivableBatch(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  receivables: ReceivableRow[],
  placaByVehicle: Map<string, string>,
  opts: { markUnpaidAsPaid?: boolean; overrides?: Map<string, BatchOverride> } = {}
) {
  let created = 0;
  let updated = 0;
  let failed = 0;
  let skipped = 0;
  let markedPaid = 0;

  for (const rec of receivables) {
    let current = { ...rec };
    if (opts.markUnpaidAsPaid && String(current.status || "").toUpperCase() !== "PAGO") {
      const ok = await ensureReceivableMarkedPaid(supabase, userId, current.id);
      if (ok) {
        current.status = "PAGO";
        markedPaid += 1;
      }
    }
    if (String(current.status || "").toUpperCase() !== "PAGO") {
      skipped += 1;
      continue;
    }
    const ov = opts.overrides?.get(current.id);
    const result = await upsertCashForReceivable(supabase, userId, current, {
      vehiclePlaca: current.vehicle_id ? placaByVehicle.get(String(current.vehicle_id)) || null : null,
      dataMovimento:
        ov?.dataMovimento || paidDateFromReceivableObservacoes(current),
      valor: ov?.valor,
    });
    if (!result.ok) failed += 1;
    else if (result.action === "created" || result.action === "verified") created += 1;
    else if (result.action === "updated") updated += 1;
    else if (result.action === "skipped") skipped += 1;
  }

  return { created, updated, failed, skipped, markedPaid, total: receivables.length };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = String(body?.userId || "").trim();
    const receivableId = String(body?.receivableId || "").trim();
    const syncAll = body?.syncAll === true;
    const dedupeCash = body?.dedupeCash === true;
    const syncMissing = body?.syncMissing === true || body?.repairCash === true;
    const recoverVrp = body?.recoverVrp === true;
    const plates = Array.isArray(body?.plates)
      ? body.plates.map((p: unknown) => normalizePlate(String(p || ""))).filter(Boolean)
      : [];
    const revertToAguardando = body?.revertToAguardando === true;
    const mapRecoverEntry = (e: { plate?: unknown; valor?: unknown; paidDate?: unknown; saidaDate?: unknown; includeZeroValor?: unknown }) => ({
      plate: normalizePlate(String(e?.plate || "")),
      valor: e?.valor != null ? Number(e.valor) : undefined,
      paidDate: e?.paidDate ? toYmd(String(e.paidDate)) : undefined,
      saidaDate: e?.saidaDate ? toYmd(String(e.saidaDate)) : undefined,
      includeZeroValor: e?.includeZeroValor === true || Number(e?.valor) === 0,
    });
    const recoverEntries: RecoverEntry[] = Array.isArray(body?.recoverEntries)
      ? body.recoverEntries.map(mapRecoverEntry).filter((e) => e.plate && (e.valor == null || e.valor >= 0 || e.includeZeroValor))
      : [];
    const revertEntries: RecoverEntry[] = Array.isArray(body?.revertEntries)
      ? body.revertEntries.map(mapRecoverEntry).filter((e) => e.plate && (e.valor == null || e.valor >= 0 || e.includeZeroValor))
      : revertToAguardando
        ? recoverEntries
        : [];

    if (!userId) {
      return NextResponse.json({ error: "userId é obrigatório." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    if (dedupeCash && !syncMissing && !syncAll) {
      const cleanup = await cleanupDuplicateCashEntradas(supabase, userId);
      return NextResponse.json({ ok: true, dedupeCash: true, stats: { removed: cleanup.removed } });
    }

    if (syncMissing) {
      const cleanupBefore = { removed: 0 };
      const { data: paid, error: paidErr } = await selectPaidReceivablesForUser(supabase, userId);
      if (paidErr) {
        return NextResponse.json({ error: paidErr.message }, { status: 500 });
      }

      const missingById = new Map<string, ReceivableRow>();
      for (const r of (paid || []) as ReceivableRow[]) {
        if (!(Number(r.valor || 0) > 0)) continue;
        const mov = await findExistingMovement(supabase, userId, r.id);
        if (!mov) missingById.set(r.id, r);
      }

      const { receivables: vrpRecs, placaByVehicle: vrpPlacaMap } = await loadVrpReceivablesToRecover(
        supabase,
        userId
      );
      for (const r of vrpRecs) {
        const mov = await findExistingMovement(supabase, userId, r.id);
        if (!mov) missingById.set(r.id, r);
      }

      const targets = [...missingById.values()];
      const vehicleIds = [...new Set(targets.map((r) => r.vehicle_id).filter(Boolean))] as string[];
      const placaByVehicle = await loadPlacaMap(supabase, userId, vehicleIds);
      for (const [vid, placa] of vrpPlacaMap.entries()) {
        if (!placaByVehicle.has(vid)) placaByVehicle.set(vid, placa);
      }

      const stats = await processReceivableBatch(supabase, userId, targets, placaByVehicle, {
        markUnpaidAsPaid: true,
      });
      const cleanupAfter = { removed: 0 };
      return NextResponse.json({
        ok: true,
        syncMissing: true,
        stats: {
          ...stats,
          fixed: stats.updated,
          removed: cleanupBefore.removed + cleanupAfter.removed,
          missing: targets.length,
        },
      });
    }

    if (revertToAguardando && revertEntries.length > 0) {
      const loaded = await loadReceivablesFromRecoverEntries(supabase, userId, revertEntries);
      const stats = await processRevertToAguardandoBatch(supabase, userId, loaded.receivables);
      return NextResponse.json({
        ok: true,
        revertToAguardando: true,
        notFound: loaded.notFound,
        revertedIds: stats.revertedIds,
        stats: { ...stats, requested: revertEntries.length },
      });
    }

    if (recoverEntries.length > 0) {
      const loaded = await loadReceivablesFromRecoverEntries(supabase, userId, recoverEntries);
      const stats = await processReceivableBatch(supabase, userId, loaded.receivables, loaded.placaByVehicle, {
        markUnpaidAsPaid: true,
        overrides: loaded.overrides,
      });
      const cleanup = await cleanupDuplicateCashEntradas(supabase, userId);
      return NextResponse.json({
        ok: true,
        recoverEntries: true,
        notFound: loaded.notFound,
        stats: { ...stats, fixed: stats.updated, removed: cleanup.removed, requested: recoverEntries.length },
      });
    }

    if (recoverVrp || plates.length > 0) {
      const { receivables, placaByVehicle } = await loadVrpReceivablesToRecover(
        supabase,
        userId,
        plates.length ? plates : undefined
      );
      await cleanupDuplicateCashEntradas(supabase, userId);
      const stats = await processReceivableBatch(supabase, userId, receivables, placaByVehicle, {
        markUnpaidAsPaid: true,
      });
      const cleanup = await cleanupDuplicateCashEntradas(supabase, userId);
      return NextResponse.json({
        ok: true,
        recoverVrp: true,
        plates: plates.length ? plates : undefined,
        stats: { ...stats, fixed: stats.updated, removed: cleanup.removed },
      });
    }

    if (syncAll) {
      await cleanupDuplicateCashEntradas(supabase, userId);
      const { data: paid, error: paidErr } = await supabase
        .from("receivables")
        .select("id,user_id,vehicle_id,valor,status,responsavel_pagamento,observacoes,updated_at,created_at,period_end")
        .eq("user_id", userId)
        .eq("status", "PAGO");
      if (paidErr) {
        return NextResponse.json({ error: paidErr.message }, { status: 500 });
      }

      const paidUnique = dedupePaidReceivablesByVehicle((paid || []) as ReceivableRow[]);
      const vehicleIds = [...new Set(paidUnique.map((r) => r.vehicle_id).filter(Boolean))] as string[];
      const placaByVehicle = await loadPlacaMap(supabase, userId, vehicleIds);
      const stats = await processReceivableBatch(supabase, userId, paidUnique, placaByVehicle);

      const { receivables: vrpMissing, placaByVehicle: vrpPlacaMap } = await loadVrpReceivablesToRecover(
        supabase,
        userId
      );
      const vrpWithoutCash: ReceivableRow[] = [];
      for (const r of vrpMissing) {
        const mov = await findExistingMovement(supabase, userId, r.id);
        if (!mov) vrpWithoutCash.push(r);
      }
      let vrpStats = { created: 0, updated: 0, failed: 0, skipped: 0, markedPaid: 0, total: 0 };
      if (vrpWithoutCash.length) {
        vrpStats = await processReceivableBatch(supabase, userId, vrpWithoutCash, vrpPlacaMap, {
          markUnpaidAsPaid: true,
        });
      }

      const cleanup = await cleanupDuplicateCashEntradas(supabase, userId);
      return NextResponse.json({
        ok: true,
        syncAll: true,
        stats: {
          created: stats.created + vrpStats.created,
          updated: stats.updated + vrpStats.updated,
          fixed: stats.updated + vrpStats.updated,
          failed: stats.failed + vrpStats.failed,
          skipped: stats.skipped + vrpStats.skipped,
          markedPaid: vrpStats.markedPaid,
          removed: cleanup.removed,
          total: stats.total + vrpStats.total,
        },
      });
    }

    if (!receivableId) {
      return NextResponse.json(
        {
          error:
            "receivableId é obrigatório (ou use syncAll / syncMissing / recoverVrp / plates / recoverEntries / revertToAguardando).",
        },
        { status: 400 }
      );
    }

    const { data: rec, error: recErr } = await supabase
      .from("receivables")
      .select("id,user_id,vehicle_id,valor,status,responsavel_pagamento,observacoes,updated_at,created_at,period_end")
      .eq("user_id", userId)
      .eq("id", receivableId)
      .maybeSingle();
    if (recErr) return NextResponse.json({ error: recErr.message }, { status: 500 });
    if (!rec) return NextResponse.json({ error: "Recebível não encontrado." }, { status: 404 });

    let vehiclePlaca: string | null = null;
    if (rec.vehicle_id) {
      const { data: v } = await supabase
        .from("vehicles")
        .select("placa")
        .eq("user_id", userId)
        .eq("id", rec.vehicle_id)
        .maybeSingle();
      vehiclePlaca = v?.placa ? String(v.placa) : null;
    }

    const result = await upsertCashForReceivable(supabase, userId, rec as ReceivableRow, {
      valor: body?.valor != null ? Number(body.valor) : undefined,
      dataMovimento: body?.dataMovimento ? String(body.dataMovimento) : undefined,
      formaPagamento: body?.formaPagamento ? String(body.formaPagamento) : undefined,
      descricao: body?.descricao ? String(body.descricao) : undefined,
      vehiclePlaca,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error || "Falha ao registrar caixa." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, action: result.action, movement: result.movement });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Falha ao registrar caixa.";
    if (/SUPABASE_SERVICE_ROLE_KEY|SUPABASE_URL/i.test(msg)) {
      return NextResponse.json(
        {
          error:
            "Servidor sem chave Supabase (service role). Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY na Vercel.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

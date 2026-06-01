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

function isSchemaError(message: string) {
  return /column|schema cache|PGRST204|invalid input|enum|22P02|23514|tipo_conta|forma_pagamento|descricao|data_movimento|relation|does not exist|PGRST205/i.test(
    message
  );
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
  const formaPagamento = opts.formaPagamento || rec.forma_pagamento || "PIX";
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
      if (!error) return { ok: true, action: "updated" as const, movement: body };
      lastError = error.message;
    } else {
      const { error } = await supabase.from("cash_movements").insert(body);
      if (!error) {
        const verified = await findExistingMovement(supabase, userId, receivableId);
        if (verified) return { ok: true, action: "created" as const, movement: verified };
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
  if (verified) return { ok: true, action: "verified" as const, movement: verified };

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
      "id,user_id,vehicle_id,valor,status,forma_pagamento,responsavel_pagamento,updated_at,created_at,period_end"
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

async function processReceivableBatch(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  receivables: ReceivableRow[],
  placaByVehicle: Map<string, string>,
  opts: { markUnpaidAsPaid?: boolean } = {}
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
    const result = await upsertCashForReceivable(supabase, userId, current, {
      vehiclePlaca: current.vehicle_id ? placaByVehicle.get(String(current.vehicle_id)) || null : null,
      dataMovimento: toYmd(current.period_end || current.updated_at || current.created_at),
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
    const recoverVrp = body?.recoverVrp === true;
    const plates = Array.isArray(body?.plates)
      ? body.plates.map((p: unknown) => normalizePlate(String(p || ""))).filter(Boolean)
      : [];

    if (!userId) {
      return NextResponse.json({ error: "userId é obrigatório." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    if (recoverVrp || plates.length > 0) {
      const { receivables, placaByVehicle } = await loadVrpReceivablesToRecover(
        supabase,
        userId,
        plates.length ? plates : undefined
      );
      const stats = await processReceivableBatch(supabase, userId, receivables, placaByVehicle, {
        markUnpaidAsPaid: true,
      });
      return NextResponse.json({
        ok: true,
        recoverVrp: true,
        plates: plates.length ? plates : undefined,
        stats: { ...stats, fixed: stats.updated },
      });
    }

    if (syncAll) {
      const { data: paid, error: paidErr } = await supabase
        .from("receivables")
        .select("id,user_id,vehicle_id,valor,status,forma_pagamento,responsavel_pagamento,updated_at,created_at,period_end")
        .eq("user_id", userId)
        .eq("status", "PAGO");
      if (paidErr) {
        return NextResponse.json({ error: paidErr.message }, { status: 500 });
      }

      const vehicleIds = [...new Set((paid || []).map((r) => r.vehicle_id).filter(Boolean))] as string[];
      const placaByVehicle = await loadPlacaMap(supabase, userId, vehicleIds);
      const stats = await processReceivableBatch(supabase, userId, (paid || []) as ReceivableRow[], placaByVehicle);

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
          total: stats.total + vrpStats.total,
        },
      });
    }

    if (!receivableId) {
      return NextResponse.json({ error: "receivableId é obrigatório (ou use syncAll / recoverVrp / plates)." }, { status: 400 });
    }

    const { data: rec, error: recErr } = await supabase
      .from("receivables")
      .select("id,user_id,vehicle_id,valor,status,forma_pagamento,responsavel_pagamento,updated_at,created_at,period_end")
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

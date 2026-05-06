import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { SupabaseFinanceCompetencyRepository } from "@/lib/finance-competency/supabase-repository";
import { FinanceCompetencyService } from "@/lib/finance-competency/service";

function toYmd(value: string | Date) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error("Data inválida.");
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isMissingCompetencySchemaError(message: string) {
  return /accounts_receivable|daily_charges|revenue|revenue_deductions|payments|relation|does not exist|PGRST/i.test(message);
}

async function runLegacyFallback(userId: string, vehicleId: string, referenceDate: Date) {
  const supabase = getSupabaseAdmin();
  const ymd = toYmd(referenceDate);
  const vehiclesQuery = supabase
    .from("vehicles")
    .select("id,data_entrada,data_saida,valor_diaria,status")
    .eq("user_id", userId)
    .is("data_saida", null);
  const { data: vehiclesData, error: vehiclesErr } = vehicleId
    ? await vehiclesQuery.eq("id", vehicleId)
    : await vehiclesQuery;
  if (vehiclesErr) throw new Error(vehiclesErr.message);
  const vehicles = (vehiclesData || []) as Array<{
    id: string;
    data_entrada: string | null;
    data_saida: string | null;
    valor_diaria: number | null;
    status: string | null;
  }>;

  const results: Array<Record<string, unknown>> = [];
  for (const v of vehicles) {
    if (!v.data_entrada) {
      results.push({ vehicleId: v.id, generated: false, reason: "Sem data de entrada." });
      continue;
    }
    const entryYmd = toYmd(v.data_entrada);
    if (ymd < entryYmd) {
      results.push({ vehicleId: v.id, generated: false, reason: "Data anterior à entrada." });
      continue;
    }
    const dailyValue = Number(v.valor_diaria || 0);
    if (!(dailyValue > 0)) {
      results.push({ vehicleId: v.id, generated: false, reason: "Sem valor diário válido." });
      continue;
    }
    const marker = `COMPETENCY_DAILY:${ymd}`;
    const { data: existingEvent, error: eventLookupErr } = await supabase
      .from("vehicle_events")
      .select("id")
      .eq("vehicle_id", v.id)
      .eq("tipo", "DAILY_CHARGE_COMPETENCY")
      .ilike("descricao", `%${marker}%`)
      .limit(1);
    if (eventLookupErr) throw new Error(eventLookupErr.message);
    if (existingEvent && existingEvent.length > 0) {
      results.push({ vehicleId: v.id, generated: false, reason: "Diária já gerada no dia." });
      continue;
    }

    const { data: recData, error: recErr } = await supabase
      .from("receivables")
      .select("id,valor,status,period_start,period_end")
      .eq("user_id", userId)
      .eq("vehicle_id", v.id)
      .in("status", ["EM_ABERTO", "AGUARDANDO_LANCAMENTO"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recErr) throw new Error(recErr.message);

    let receivable = recData as { id: string; valor: number | null } | null;
    if (!receivable) {
      const { data: createdRec, error: createErr } = await supabase
        .from("receivables")
        .insert({
          user_id: userId,
          vehicle_id: v.id,
          responsavel_pagamento: "",
          receivable_category: "GUARDA_PATIO",
          valor: 0,
          status: "EM_ABERTO",
          period_start: ymd,
          period_end: null,
        })
        .select("id,valor")
        .single();
      if (createErr) throw new Error(createErr.message);
      receivable = createdRec as { id: string; valor: number | null };
    }

    const nextValue = Number((Number(receivable.valor || 0) + dailyValue).toFixed(2));
    const { error: updErr } = await supabase
      .from("receivables")
      .update({ valor: nextValue })
      .eq("user_id", userId)
      .eq("id", receivable.id);
    if (updErr) throw new Error(updErr.message);

    const { error: insEventErr } = await supabase.from("vehicle_events").insert({
      vehicle_id: v.id,
      tipo: "DAILY_CHARGE_COMPETENCY",
      responsavel: "SISTEMA",
      descricao: `${marker} VALOR=${dailyValue.toFixed(2)} RECEIVABLE_ID=${receivable.id}`,
    });
    if (insEventErr) throw new Error(insEventErr.message);

    results.push({ vehicleId: v.id, generated: true, dailyValue, receivableId: receivable.id, receivableValue: nextValue });
  }

  return { mode: "legacy_fallback", count: results.length, results };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = String(body?.userId || "").trim();
    const vehicleId = body?.vehicleId ? String(body.vehicleId).trim() : "";
    const referenceDate = body?.referenceDate ? new Date(String(body.referenceDate)) : new Date();
    if (!userId) return NextResponse.json({ error: "userId é obrigatório." }, { status: 400 });

    const repo = new SupabaseFinanceCompetencyRepository(getSupabaseAdmin());
    const service = new FinanceCompetencyService(repo);

    try {
      if (vehicleId) {
        const result = await service.generateDailyCharges(userId, vehicleId, referenceDate);
        return NextResponse.json(result, { status: 200 });
      }
      const results = await service.generateDailyChargesForAllActiveVehicles(userId, referenceDate);
      return NextResponse.json({ mode: "competency", count: results.length, results }, { status: 200 });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Falha no módulo de competência.";
      if (!isMissingCompetencySchemaError(msg)) throw error;
      const fallback = await runLegacyFallback(userId, vehicleId, referenceDate);
      return NextResponse.json(fallback, { status: 200 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao gerar diárias." },
      { status: 500 }
    );
  }
}

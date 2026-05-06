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

async function runLegacyFallback(
  userId: string,
  vehicleId: string,
  discountAmount: number,
  isFullWaiver: boolean,
  closeDate: Date
) {
  const supabase = getSupabaseAdmin();
  const ymd = toYmd(closeDate);
  const { data: recData, error: recErr } = await supabase
    .from("receivables")
    .select("id,valor,status,period_start,period_end")
    .eq("user_id", userId)
    .eq("vehicle_id", vehicleId)
    .in("status", ["EM_ABERTO", "AGUARDANDO_LANCAMENTO"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recErr) throw new Error(recErr.message);
  if (!recData) throw new Error("Nenhuma conta a receber aberta para o veículo.");

  const currentValue = Number(recData.valor || 0);
  const applied = isFullWaiver ? currentValue : Math.min(currentValue, Math.max(0, Number(discountAmount || 0)));
  const nextValue = Number((currentValue - applied).toFixed(2));
  const { error: updErr } = await supabase
    .from("receivables")
    .update({
      period_end: recData.period_end || ymd,
      valor: nextValue,
      status: nextValue === 0 ? "PAGO" : "EM_ABERTO",
    })
    .eq("user_id", userId)
    .eq("id", recData.id);
  if (updErr) throw new Error(updErr.message);

  if (applied > 0) {
    const { error: eventErr } = await supabase.from("vehicle_events").insert({
      vehicle_id: vehicleId,
      tipo: "RECEITA_DEDUCTION",
      responsavel: "SISTEMA",
      descricao: `DEDUCAO_COMPETENCIA DATE=${ymd} RECEIVABLE_ID=${recData.id} VALOR=${applied.toFixed(2)} FULL_WAIVER=${isFullWaiver ? "1" : "0"}`,
    });
    if (eventErr) throw new Error(eventErr.message);
  }

  return {
    mode: "legacy_fallback",
    receivable: {
      id: recData.id,
      cycle_end_date: recData.period_end || ymd,
      gross_amount: currentValue,
      deduction_amount: applied,
      net_amount: nextValue,
      balance_amount: nextValue,
      status: nextValue === 0 ? "CLOSED" : "AWAITING_PAYMENT",
    },
    deductionApplied: applied,
    fullWaiver: isFullWaiver && applied > 0,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = String(body?.userId || "").trim();
    const vehicleId = String(body?.vehicleId || "").trim();
    const discountAmount = Number(body?.discountAmount || 0);
    const isFullWaiver = Boolean(body?.isFullWaiver);
    const closeDate = body?.closeDate ? new Date(String(body.closeDate)) : new Date();

    if (!userId || !vehicleId) {
      return NextResponse.json({ error: "userId e vehicleId são obrigatórios." }, { status: 400 });
    }

    const repo = new SupabaseFinanceCompetencyRepository(getSupabaseAdmin());
    const service = new FinanceCompetencyService(repo);
    try {
      const result = await service.closeVehicleCycle(userId, vehicleId, discountAmount, isFullWaiver, closeDate);
      return NextResponse.json({ mode: "competency", ...result }, { status: 200 });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Falha no módulo de competência.";
      if (!isMissingCompetencySchemaError(msg)) throw error;
      const fallback = await runLegacyFallback(userId, vehicleId, discountAmount, isFullWaiver, closeDate);
      return NextResponse.json(fallback, { status: 200 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao encerrar ciclo." },
      { status: 500 }
    );
  }
}

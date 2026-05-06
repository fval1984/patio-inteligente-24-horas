import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { SupabaseFinanceCompetencyRepository } from "@/lib/finance-competency/supabase-repository";
import { FinanceCompetencyService } from "@/lib/finance-competency/service";

function isMissingCompetencySchemaError(message: string) {
  return /accounts_receivable|daily_charges|revenue|revenue_deductions|payments|relation|does not exist|PGRST/i.test(message);
}

async function runLegacyFallback(
  userId: string,
  receivableId: string,
  amount: number,
  paymentDate: Date,
  method: string
) {
  const supabase = getSupabaseAdmin();
  const { data: recData, error: recErr } = await supabase
    .from("receivables")
    .select("id,valor,status,vehicle_id")
    .eq("user_id", userId)
    .eq("id", receivableId)
    .maybeSingle();
  if (recErr) throw new Error(recErr.message);
  if (!recData) throw new Error("Conta a receber não encontrada.");
  const current = Number(recData.valor || 0);
  const pay = Number(amount || 0);
  if (pay <= 0) throw new Error("Valor de pagamento inválido.");
  if (pay > current) throw new Error("Pagamento maior que saldo em aberto.");

  const next = Number((current - pay).toFixed(2));
  const { error: updErr } = await supabase
    .from("receivables")
    .update({ valor: next, status: next === 0 ? "PAGO" : "EM_ABERTO" })
    .eq("user_id", userId)
    .eq("id", receivableId);
  if (updErr) throw new Error(updErr.message);

  const { data: existingMov, error: movErr } = await supabase
    .from("cash_movements")
    .select("id,valor")
    .eq("tipo_conta", "RECEBER")
    .eq("conta_id", receivableId)
    .limit(1);
  if (movErr) throw new Error(movErr.message);
  if (!existingMov || existingMov.length === 0) {
    const { error: insErr } = await supabase.from("cash_movements").insert({
      user_id: userId,
      tipo_conta: "RECEBER",
      conta_id: receivableId,
      valor: pay,
      data_movimento: paymentDate.toISOString(),
      forma_pagamento: method,
      descricao: "Recebimento (competência fallback)",
    });
    if (insErr) throw new Error(insErr.message);
  }

  return {
    mode: "legacy_fallback",
    payment: { amount: pay, payment_date: paymentDate.toISOString(), method, status: "CONFIRMED" },
    receivable: { id: receivableId, paid_amount: pay, balance_amount: next, status: next === 0 ? "PAID" : "AWAITING_PAYMENT" },
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = String(body?.userId || "").trim();
    const receivableId = String(body?.receivableId || "").trim();
    const vehicleId = String(body?.vehicleId || "").trim();
    const amount = Number(body?.amount || 0);
    const paymentDate = body?.paymentDate ? new Date(String(body.paymentDate)) : new Date();
    const method = String(body?.method || "DINHEIRO");

    if (!userId || (!receivableId && !vehicleId)) {
      return NextResponse.json({ error: "userId e (receivableId ou vehicleId) são obrigatórios." }, { status: 400 });
    }

    const repo = new SupabaseFinanceCompetencyRepository(getSupabaseAdmin());
    const service = new FinanceCompetencyService(repo);
    let effectiveReceivableId = receivableId;
    if (!effectiveReceivableId && vehicleId) {
      const openRec = await repo.findOpenReceivableByVehicle(userId, vehicleId);
      if (!openRec) {
        return NextResponse.json({ error: "Nenhuma conta a receber aberta para este veículo." }, { status: 404 });
      }
      effectiveReceivableId = openRec.id;
    }
    try {
      const result = await service.registerPayment(userId, effectiveReceivableId, amount, paymentDate, method);
      return NextResponse.json({ mode: "competency", ...result }, { status: 200 });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Falha no módulo de competência.";
      if (!isMissingCompetencySchemaError(msg)) throw error;
      const fallback = await runLegacyFallback(userId, effectiveReceivableId, amount, paymentDate, method);
      return NextResponse.json(fallback, { status: 200 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao registrar pagamento." },
      { status: 500 }
    );
  }
}

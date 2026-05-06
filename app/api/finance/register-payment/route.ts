import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { SupabaseFinanceCompetencyRepository } from "@/lib/finance-competency/supabase-repository";
import { FinanceCompetencyService } from "@/lib/finance-competency/service";

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
    const result = await service.registerPayment(userId, effectiveReceivableId, amount, paymentDate, method);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao registrar pagamento." },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { SupabaseFinanceCompetencyRepository } from "@/lib/finance-competency/supabase-repository";
import { FinanceCompetencyService } from "@/lib/finance-competency/service";

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
    const result = await service.closeVehicleCycle(userId, vehicleId, discountAmount, isFullWaiver, closeDate);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao encerrar ciclo." },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { SupabaseFinanceCompetencyRepository } from "@/lib/finance-competency/supabase-repository";
import { FinanceCompetencyService } from "@/lib/finance-competency/service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = String(body?.userId || "").trim();
    const vehicleId = body?.vehicleId ? String(body.vehicleId).trim() : "";
    const referenceDate = body?.referenceDate ? new Date(String(body.referenceDate)) : new Date();
    if (!userId) return NextResponse.json({ error: "userId é obrigatório." }, { status: 400 });

    const repo = new SupabaseFinanceCompetencyRepository(getSupabaseAdmin());
    const service = new FinanceCompetencyService(repo);

    if (vehicleId) {
      const result = await service.generateDailyCharges(userId, vehicleId, referenceDate);
      return NextResponse.json(result, { status: 200 });
    }

    const results = await service.generateDailyChargesForAllActiveVehicles(userId, referenceDate);
    return NextResponse.json({ count: results.length, results }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao gerar diárias." },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { rollbackCaixaFlowRepair } from "@/lib/finance-caixa-flow-repair";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = String(body?.userId || "").trim();
    const migrationId = String(body?.migrationId || "").trim();
    if (!userId || !migrationId) {
      return NextResponse.json({ error: "userId e migrationId são obrigatórios." }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();
    const result = await rollbackCaixaFlowRepair(supabase, userId, migrationId);
    return NextResponse.json({
      ok: result.ok,
      message: result.ok ? "Rollback concluído." : "Rollback parcial.",
      ...result,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { rollbackJuneMigration } from "@/lib/finance-june-migration";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = String(body?.userId || "").trim();
    const migrationId = String(body?.migrationId || "").trim();

    if (!userId || !migrationId) {
      return NextResponse.json({ error: "userId e migrationId são obrigatórios." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const result = await rollbackJuneMigration(supabase, userId, migrationId);
    return NextResponse.json({
      ok: result.ok,
      message: result.ok
        ? "Rollback concluído — registros restaurados ao estado anterior."
        : "Rollback parcial — verifique errors.",
      ...result,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

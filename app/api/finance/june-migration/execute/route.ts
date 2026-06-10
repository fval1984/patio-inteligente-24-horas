import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { JUNE_MIGRATION_CONFIRM, executeJuneMigration } from "@/lib/finance-june-migration";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = String(body?.userId || "").trim();
    const confirm = String(body?.confirm || "").trim();

    if (!userId) {
      return NextResponse.json({ error: "userId é obrigatório." }, { status: 400 });
    }
    if (confirm !== JUNE_MIGRATION_CONFIRM) {
      return NextResponse.json(
        {
          error: `Confirmação inválida. Envie confirm: "${JUNE_MIGRATION_CONFIRM}".`,
          hint: "Execute a prévia em /api/finance/june-migration/preview antes de confirmar.",
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const result = await executeJuneMigration(supabase, userId);
    return NextResponse.json({
      ok: result.ok,
      message: result.ok
        ? "Migração executada. Registros automáticos movidos para Aguardando Faturamento; movimentações marcadas excluir_do_saldo."
        : "Migração concluída com erros parciais — verifique errors e considere rollback.",
      ...result,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

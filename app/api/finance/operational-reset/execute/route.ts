import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { OPERATIONAL_RESET_CONFIRM, executeOperationalReset } from "@/lib/finance-operational-reset";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = String(body?.userId || "").trim();
    const confirm = String(body?.confirm || "").trim();

    if (!userId) {
      return NextResponse.json({ error: "userId é obrigatório." }, { status: 400 });
    }
    if (confirm !== OPERATIONAL_RESET_CONFIRM) {
      return NextResponse.json(
        {
          error: `Confirmação inválida. Envie confirm: "${OPERATIONAL_RESET_CONFIRM}".`,
          hint: "Execute a prévia em /api/finance/operational-reset/preview antes de confirmar.",
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const result = await executeOperationalReset(supabase, userId);
    return NextResponse.json({
      ok: result.ok,
      message: result.ok
        ? "Reset operacional concluído. Caixa zerado; recebíveis na fila Aguardando Faturamento."
        : "Reset concluído com erros parciais — verifique errors e considere rollback.",
      ...result,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

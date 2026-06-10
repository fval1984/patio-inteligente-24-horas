import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { CAIXA_FLOW_REPAIR_CONFIRM, executeCaixaFlowRepair } from "@/lib/finance-caixa-flow-repair";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = String(body?.userId || "").trim();
    const confirm = String(body?.confirm || "").trim();
    if (!userId) return NextResponse.json({ error: "userId é obrigatório." }, { status: 400 });
    if (confirm !== CAIXA_FLOW_REPAIR_CONFIRM) {
      return NextResponse.json(
        {
          error: `Confirmação inválida. Envie confirm: "${CAIXA_FLOW_REPAIR_CONFIRM}".`,
          hint: "Execute a prévia em /api/finance/caixa-flow-repair/preview antes.",
        },
        { status: 400 }
      );
    }
    const supabase = getSupabaseAdmin();
    const cashOnly = body?.cashOnly === true;
    const result = await executeCaixaFlowRepair(supabase, userId, { cashOnly });
    return NextResponse.json({
      ok: result.ok,
      message: result.ok
        ? "Correção do fluxo de caixa concluída. Contas a Receber preservadas; vínculos incorretos voltaram para Aguardando Faturamento."
        : "Correção concluída com erros — verifique errors e considere rollback.",
      ...result,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

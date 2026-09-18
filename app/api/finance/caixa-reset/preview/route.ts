import { NextRequest, NextResponse } from "next/server";
import { forbidViewerFinance } from "@/lib/viewer-access-guard";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { loadCaixaResetPreview } from "@/lib/finance-caixa-reset";

export async function POST(req: NextRequest) {
  const __viewerDenied = await forbidViewerFinance(req);
  if (__viewerDenied) return __viewerDenied;
  try {
    const body = await req.json().catch(() => ({}));
    const userId = String(body?.userId || "").trim();
    const resetYm = body?.resetYm ? String(body.resetYm).trim() : undefined;

    if (!userId) {
      return NextResponse.json({ error: "userId é obrigatório." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const preview = await loadCaixaResetPreview(supabase, userId, resetYm);

    return NextResponse.json({
      ok: true,
      message:
        "Pré-visualização gerada. Revise movementsToRemove e sql.fullScript. Nenhum dado foi alterado.",
      ...preview,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

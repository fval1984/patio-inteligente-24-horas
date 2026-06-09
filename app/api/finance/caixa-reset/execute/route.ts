import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  CAIXA_RESET_CONFIRM_TOKEN,
  executeCaixaReset,
  loadCaixaResetPreview,
} from "@/lib/finance-caixa-reset";

async function discoverUserIds(supabase: ReturnType<typeof import("@/lib/supabase-admin").getSupabaseAdmin>) {
  const ids = new Set<string>();
  for (const table of ["settings", "cash_movements", "receivables"] as const) {
    const { data } = await supabase.from(table).select("user_id").limit(5000);
    for (const row of data || []) {
      if (row?.user_id) ids.add(String(row.user_id));
    }
  }
  return [...ids];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = String(body?.userId || "").trim();
    const resetYm = body?.resetYm ? String(body.resetYm).trim() : undefined;
    const confirm = String(body?.confirm || "").trim();

    if (confirm !== CAIXA_RESET_CONFIRM_TOKEN) {
      const supabase = getSupabaseAdmin();
      const uid = userId || (await discoverUserIds(supabase))[0] || "";
      if (!uid) {
        return NextResponse.json({ error: "Nenhum user_id encontrado para pré-visualização." }, { status: 400 });
      }
      const preview = await loadCaixaResetPreview(supabase, uid, resetYm);
      return NextResponse.json(
        {
          error: "Confirmação obrigatória.",
          requiredConfirm: CAIXA_RESET_CONFIRM_TOKEN,
          hint: "Envie confirm: 'EXECUTE_CAIXA_RESET' após revisar a pré-visualização.",
          previewSummary: preview.summary,
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const userIds = userId ? [userId] : await discoverUserIds(supabase);
    if (!userIds.length) {
      return NextResponse.json({ error: "Nenhum user_id encontrado." }, { status: 400 });
    }

    const results = [];
    for (const uid of userIds) {
      results.push(await executeCaixaReset(supabase, uid, resetYm));
    }

    return NextResponse.json({
      ok: true,
      message: "Reset do caixa concluído. Backup arquivado em cash_movements_archive.",
      results,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

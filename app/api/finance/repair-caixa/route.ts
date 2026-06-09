import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { executeFullCaixaRepair } from "@/lib/finance-caixa-repair";

async function discoverUserIds(supabase: ReturnType<typeof getSupabaseAdmin>) {
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
    const supabase = getSupabaseAdmin();
    const userIds = userId ? [userId] : await discoverUserIds(supabase);
    if (!userIds.length) {
      return NextResponse.json({ error: "Nenhum user_id encontrado." }, { status: 400 });
    }

    const results = [];
    for (const uid of userIds) {
      results.push({ userId: uid, ...(await executeFullCaixaRepair(supabase, uid)) });
    }

    return NextResponse.json({
      ok: true,
      message:
        "Reparo do caixa concluído: histórico restaurado do archive (se existir), entradas ausentes recriadas, filtro caixa_reset_ym removido.",
      results,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

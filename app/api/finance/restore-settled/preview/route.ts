import { NextRequest, NextResponse } from "next/server";
import { forbidViewerFinance } from "@/lib/viewer-access-guard";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { buildFinanceRestoreSettledPreview, discoverFinanceUserIds } from "@/lib/finance-restore-settled";

export async function GET(req: NextRequest) {
  return POST(req);
}

export async function POST(req: NextRequest) {
  const __viewerDenied = await forbidViewerFinance(req);
  if (__viewerDenied) return __viewerDenied;
  try {
    const body = await req.json().catch(() => ({}));
    const userId = String(body?.userId || req.nextUrl.searchParams.get("userId") || "").trim();
    const supabase = getSupabaseAdmin();
    const userIds = userId ? [userId] : await discoverFinanceUserIds(supabase);
    if (!userIds.length) return NextResponse.json({ error: "Nenhum user_id encontrado." }, { status: 400 });
    const results = [];
    for (const uid of userIds) {
      results.push(await buildFinanceRestoreSettledPreview(supabase, uid));
    }
    return NextResponse.json({
      ok: true,
      dryRun: true,
      message: "Prévia da restauração — nenhum dado foi alterado.",
      results,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
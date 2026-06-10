import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { buildCaixaFlowRepairPreview } from "@/lib/finance-caixa-flow-repair";

export async function GET(req: NextRequest) {
  try {
    const userId = String(req.nextUrl.searchParams.get("userId") || "").trim();
    if (!userId) return NextResponse.json({ error: "userId é obrigatório." }, { status: 400 });
    const supabase = getSupabaseAdmin();
    return NextResponse.json(await buildCaixaFlowRepairPreview(supabase, userId));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = String(body?.userId || "").trim();
    if (!userId) return NextResponse.json({ error: "userId é obrigatório." }, { status: 400 });
    const supabase = getSupabaseAdmin();
    return NextResponse.json(await buildCaixaFlowRepairPreview(supabase, userId));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

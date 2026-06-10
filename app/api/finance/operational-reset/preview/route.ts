import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { buildOperationalResetPreview } from "@/lib/finance-operational-reset";

export async function GET(req: NextRequest) {
  try {
    const userId = String(req.nextUrl.searchParams.get("userId") || "").trim();
    if (!userId) {
      return NextResponse.json({ error: "userId é obrigatório." }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();
    const preview = await buildOperationalResetPreview(supabase, userId);
    return NextResponse.json(preview);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = String(body?.userId || "").trim();
    if (!userId) {
      return NextResponse.json({ error: "userId é obrigatório." }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();
    const preview = await buildOperationalResetPreview(supabase, userId);
    return NextResponse.json(preview);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

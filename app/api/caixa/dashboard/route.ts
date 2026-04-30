import { NextRequest, NextResponse } from "next/server";
import { obterDashboardCaixa } from "@/lib/caixa-service";

export async function GET(request: NextRequest) {
  try {
    const caixaId = String(request.nextUrl.searchParams.get("caixa_id") || "").trim();
    if (!caixaId) return NextResponse.json({ ok: false, error: "caixa_id é obrigatório." }, { status: 400 });
    const data = await obterDashboardCaixa({ caixaId });
    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Falha ao carregar dashboard do caixa." }, { status: 500 });
  }
}


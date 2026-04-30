import { NextRequest, NextResponse } from "next/server";
import { obterRelatorios } from "@/lib/financeiro-v2-service";

export async function GET(request: NextRequest) {
  try {
    const competencia = request.nextUrl.searchParams.get("competencia");
    const data = await obterRelatorios(competencia);
    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Falha ao carregar relatórios." }, { status: 500 });
  }
}


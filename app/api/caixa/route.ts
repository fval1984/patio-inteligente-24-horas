import { NextRequest, NextResponse } from "next/server";
import { abrirCaixa, obterCaixaAberto } from "@/lib/caixa-service";

export async function GET(request: NextRequest) {
  try {
    const usuarioId = String(request.nextUrl.searchParams.get("usuario_id") || "").trim();
    if (!usuarioId) return NextResponse.json({ ok: false, error: "usuario_id é obrigatório." }, { status: 400 });
    const data = await obterCaixaAberto(usuarioId);
    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Falha ao buscar caixa." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = await abrirCaixa({
      usuarioId: String(body?.usuario_id || ""),
      saldoInicial: Number(body?.saldo_inicial || 0),
    });
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Falha ao abrir caixa." }, { status: 500 });
  }
}


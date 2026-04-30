import { NextRequest, NextResponse } from "next/server";
import { atualizarContaStatus, criarConta, listarContas } from "@/lib/financeiro-v2-service";

export async function GET(request: NextRequest) {
  try {
    const qs = request.nextUrl.searchParams;
    const data = await listarContas({
      competencia: qs.get("competencia"),
      tipo: qs.get("tipo"),
      status: qs.get("status"),
      from: qs.get("from"),
      to: qs.get("to"),
      limit: Number(qs.get("limit") || 200),
    });
    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Falha ao listar contas." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body || Number(body.valor || 0) <= 0) {
      return NextResponse.json({ ok: false, error: "Valor inválido." }, { status: 400 });
    }
    const data = await criarConta({
      tipo: String(body.tipo || ""),
      descricao: String(body.descricao || ""),
      valor: Number(body.valor),
      vencimento: String(body.vencimento || ""),
      status: body.status,
      recorrencia: body.recorrencia || "NAO",
      categoria_id: body.categoria_id || null,
      veiculo_id: body.veiculo_id || null,
      financeira_id: body.financeira_id || null,
    });
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Falha ao criar conta." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const id = String(body?.id || "").trim();
    const status = String(body?.status || "").trim();
    if (!id) return NextResponse.json({ ok: false, error: "ID obrigatório." }, { status: 400 });
    if (!status) return NextResponse.json({ ok: false, error: "Status obrigatório." }, { status: 400 });
    const data = await atualizarContaStatus(id, status);
    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Falha ao atualizar conta." }, { status: 500 });
  }
}


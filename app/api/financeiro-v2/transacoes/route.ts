import { NextRequest, NextResponse } from "next/server";
import { atualizarTransacaoStatus, criarTransacao, listarTransacoes } from "@/lib/financeiro-v2-service";

export async function GET(request: NextRequest) {
  try {
    const qs = request.nextUrl.searchParams;
    const data = await listarTransacoes({
      competencia: qs.get("competencia"),
      tipo: qs.get("tipo"),
      status: qs.get("status"),
      busca: qs.get("busca"),
      categoria_id: qs.get("categoria_id"),
      veiculo_id: qs.get("veiculo_id"),
      from: qs.get("from"),
      to: qs.get("to"),
      limit: Number(qs.get("limit") || 100),
    });
    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Falha ao listar transações." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body || Number(body.valor || 0) <= 0) {
      return NextResponse.json({ ok: false, error: "Valor inválido." }, { status: 400 });
    }
    const data = await criarTransacao({
      data_movimento: body.data_movimento,
      valor: Number(body.valor),
      tipo: String(body.tipo || ""),
      status: body.status,
      descricao: String(body.descricao || ""),
      categoria_id: body.categoria_id || null,
      conta_id: body.conta_id || null,
      veiculo_id: body.veiculo_id || null,
      origem_evento: body.origem_evento || "MANUAL",
      chave_idempotencia: body.chave_idempotencia || null,
    });
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Falha ao criar transação." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const id = String(body?.id || "").trim();
    const status = String(body?.status || "").trim();
    if (!id) return NextResponse.json({ ok: false, error: "ID obrigatório." }, { status: 400 });
    if (!status) return NextResponse.json({ ok: false, error: "Status obrigatório." }, { status: 400 });
    const data = await atualizarTransacaoStatus(id, status);
    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Falha ao atualizar transação." }, { status: 500 });
  }
}


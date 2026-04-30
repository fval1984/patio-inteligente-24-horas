import { NextRequest, NextResponse } from "next/server";
import { criarLancamento, estornarLancamento, listarLancamentos, softDeleteLancamento } from "@/lib/caixa-service";

export async function GET(request: NextRequest) {
  try {
    const qs = request.nextUrl.searchParams;
    const caixaId = String(qs.get("caixa_id") || "").trim();
    if (!caixaId) return NextResponse.json({ ok: false, error: "caixa_id é obrigatório." }, { status: 400 });
    const data = await listarLancamentos({
      caixaId,
      from: qs.get("from"),
      to: qs.get("to"),
      categoria: qs.get("categoria"),
      formaPagamento: qs.get("forma_pagamento"),
      busca: qs.get("busca"),
      limit: Number(qs.get("limit") || 200),
    });
    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Falha ao listar lançamentos." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const tipoMovimentacao = String(body?.tipo || "ENTRADA").toUpperCase();
    const tipo =
      tipoMovimentacao === "SAIDA" ||
      tipoMovimentacao === "SANGRIA" ||
      tipoMovimentacao === "REFORCO" ||
      tipoMovimentacao === "ENTRADA"
        ? (tipoMovimentacao as "ENTRADA" | "SAIDA" | "SANGRIA" | "REFORCO")
        : "ENTRADA";
    const data = await criarLancamento({
      caixaId: String(body?.caixa_id || ""),
      tipo,
      categoria: String(body?.categoria || "OUTROS"),
      descricao: String(body?.descricao || ""),
      valor: Number(body?.valor || 0),
      formaPagamento: (body?.forma_pagamento || "PIX") as any,
      usuarioId: String(body?.usuario_id || ""),
      referenciaId: body?.referencia_id || null,
      referenciaVeiculoId: body?.referencia_veiculo_id || null,
      integrarFinanceiro: Boolean(body?.integrar_financeiro),
    });
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Falha ao criar lançamento." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const action = String(body?.action || "").trim();
    if (action === "ESTORNAR") {
      const data = await estornarLancamento({
        lancamentoId: String(body?.lancamento_id || ""),
        usuarioId: String(body?.usuario_id || ""),
        motivo: body?.motivo || "",
      });
      return NextResponse.json({ ok: true, data }, { status: 200 });
    }
    if (action === "SOFT_DELETE") {
      const data = await softDeleteLancamento({
        lancamentoId: String(body?.lancamento_id || ""),
        usuarioId: String(body?.usuario_id || ""),
      });
      return NextResponse.json({ ok: true, data }, { status: 200 });
    }
    return NextResponse.json({ ok: false, error: "Ação inválida." }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Falha ao atualizar lançamento." }, { status: 500 });
  }
}


import { NextRequest, NextResponse } from "next/server";
import { criarContaReceber, marcarContaReceberComoPaga } from "@/lib/caixa-service";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  try {
    const qs = request.nextUrl.searchParams;
    const status = String(qs.get("status") || "").trim();
    const from = String(qs.get("from") || "").trim();
    const to = String(qs.get("to") || "").trim();
    let query = getSupabaseAdmin()
      .from("contas_receber_financeiro")
      .select("*")
      .is("deleted_at", null)
      .order("data_vencimento", { ascending: true })
      .limit(500);
    if (status) query = query.eq("status", status);
    if (from) query = query.gte("data_vencimento", from);
    if (to) query = query.lte("data_vencimento", to);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, data: data || [] }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Falha ao listar contas a receber." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = await criarContaReceber({
      cliente: String(body?.cliente || ""),
      valor: Number(body?.valor || 0),
      dataVencimento: String(body?.data_vencimento || ""),
      referenciaVeiculoId: body?.referencia_veiculo_id || null,
      financeiraId: body?.financeira_id || null,
    });
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Falha ao criar conta a receber." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const data = await marcarContaReceberComoPaga({
      contaId: String(body?.conta_id || ""),
      usuarioId: String(body?.usuario_id || ""),
      formaPagamento: body?.forma_pagamento || "PIX",
      caixaId: body?.caixa_id || null,
    });
    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Falha ao receber conta." }, { status: 500 });
  }
}


import { NextRequest, NextResponse } from "next/server";
import { fecharCaixa } from "@/lib/caixa-service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = await fecharCaixa({
      caixaId: String(body?.caixa_id || ""),
      usuarioId: String(body?.usuario_id || ""),
      totalDinheiro: Number(body?.total_dinheiro || 0),
      totalPix: Number(body?.total_pix || 0),
      totalDebito: Number(body?.total_debito || 0),
      totalCredito: Number(body?.total_credito || 0),
      totalTransferencia: Number(body?.total_transferencia || 0),
      observacoes: body?.observacoes || "",
    });
    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Falha no fechamento de caixa." }, { status: 500 });
  }
}


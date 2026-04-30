import { NextRequest, NextResponse } from "next/server";
import { listarHistoricoCaixas } from "@/lib/caixa-service";

export async function GET(request: NextRequest) {
  try {
    const qs = request.nextUrl.searchParams;
    const statusRaw = String(qs.get("status") || "").toUpperCase();
    const status = statusRaw === "ABERTO" || statusRaw === "FECHADO" ? statusRaw : null;
    const data = await listarHistoricoCaixas({
      from: qs.get("from"),
      to: qs.get("to"),
      status: status as "ABERTO" | "FECHADO" | null,
      limit: Number(qs.get("limit") || 100),
    });
    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Falha ao listar histórico de caixas." }, { status: 500 });
  }
}


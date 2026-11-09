import { NextResponse } from "next/server";
import { applyVehiclesPublicQrSql } from "@/lib/vehicle-public-token";

export async function POST() {
  try {
    const result = await applyVehiclesPublicQrSql();
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 503 });
    }
    return NextResponse.json({
      ok: true,
      message: "QR público aplicado (coluna public_token, funções e recarga do schema PostgREST).",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

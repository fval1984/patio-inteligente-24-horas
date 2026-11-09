import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { extractBearerToken, getUserIdFromAccessToken } from "@/lib/user-authorization";
import {
  applyVehiclesPublicQrSql,
  ensureVehiclePublicTokenForUser,
} from "@/lib/vehicle-public-token";

export const dynamic = "force-dynamic";

type Body = {
  access_token?: string;
  vehicle_id?: string;
};

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Servidor não configurado (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)." }, { status: 500 });
  }

  let body: Body = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const token =
    (body.access_token || "").trim() || extractBearerToken(request.headers.get("authorization")) || null;
  if (!token) {
    return NextResponse.json({ error: "Sessão em falta." }, { status: 401 });
  }

  const { userId, error: tokenErr } = await getUserIdFromAccessToken(supabaseUrl, serviceRoleKey, token);
  if (!userId) {
    return NextResponse.json({ error: tokenErr || "Sessão inválida." }, { status: 401 });
  }

  const vehicleId = String(body.vehicle_id || "").trim();
  if (!vehicleId) {
    return NextResponse.json({ error: "Veículo em falta." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  let result = await ensureVehiclePublicTokenForUser(admin, userId, vehicleId);

  if (result.missingSchema) {
    const applied = await applyVehiclesPublicQrSql();
    if (applied.ok) {
      result = await ensureVehiclePublicTokenForUser(admin, userId, vehicleId);
    } else if (!result.error || result.error === "schema") {
      result = { error: applied.error, missingSchema: true };
    }
  }

  if (result.token) {
    return NextResponse.json({ ok: true, public_token: result.token });
  }

  if (result.missingSchema) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "A função ensure_vehicle_public_token ainda não existe neste Supabase. Abra SQL Editor, cole o conteúdo de supabase/vehicles_public_qr.sql e clique em Run. Depois atualize a página.",
      },
      { status: 503 }
    );
  }

  return NextResponse.json({ ok: false, error: result.error || "Não foi possível obter o QR Code." }, { status: 400 });
}

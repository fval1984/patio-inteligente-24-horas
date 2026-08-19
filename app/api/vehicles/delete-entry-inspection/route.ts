import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { actorCanAccessAdminModules, resolvePatioActor } from "@/lib/patio-actor";
import { extractBearerToken, getUserIdFromAccessToken } from "@/lib/user-authorization";
import { deleteVehicleEntryInspection, resolveVehicleOwnerUserId } from "@/lib/vehicle-entry-inspection";

type Body = {
  access_token?: string;
  inspection_id?: string;
  vehicle_id?: string;
};

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Servidor não configurado." }, { status: 500 });
  }

  let body: Body = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const token =
    (body.access_token || "").trim() ||
    extractBearerToken(request.headers.get("authorization")) ||
    null;

  if (!token) {
    return NextResponse.json({ error: "Sessão em falta." }, { status: 401 });
  }

  const { userId, error: tokenErr } = await getUserIdFromAccessToken(supabaseUrl, serviceRoleKey, token);
  if (!userId) {
    return NextResponse.json({ error: tokenErr || "Sessão inválida." }, { status: 401 });
  }

  const vehicleId = (body.vehicle_id || "").trim();
  const inspectionId = (body.inspection_id || "").trim();
  if (!vehicleId) {
    return NextResponse.json({ error: "Veículo em falta." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const actor = await resolvePatioActor(admin, userId);
  if (!actorCanAccessAdminModules(actor)) {
    return NextResponse.json(
      { error: "Apenas o gestor principal pode apagar uma vistoria." },
      { status: 403 }
    );
  }

  const { ownerUserId } = await resolveVehicleOwnerUserId(admin, userId);
  const { data, error } = await deleteVehicleEntryInspection(admin, {
    ownerUserId,
    vehicleId,
    inspectionId: inspectionId || undefined,
  });

  if (error || !data) {
    return NextResponse.json({ error: error || "Não foi possível apagar a vistoria." }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    inspection_id: data.inspection_id,
    inspection_number: data.inspection_number,
    vehicle_id: data.vehicle_id,
    vehicle_status: data.vehicle_status,
    reverted_to_aguardando: data.reverted_to_aguardando,
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "delete-entry-inspection",
    hint: "POST JSON: { access_token, vehicle_id, inspection_id? } — apenas o gestor principal (ADM).",
  });
}

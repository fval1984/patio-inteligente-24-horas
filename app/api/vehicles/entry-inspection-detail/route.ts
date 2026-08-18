import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { extractBearerToken, getUserIdFromAccessToken } from "@/lib/user-authorization";
import { loadEntryInspectionDetail, resolveVehicleOwnerUserId } from "@/lib/vehicle-entry-inspection";

type Body = {
  access_token?: string;
  inspection_id?: string;
  vehicle_id?: string;
  inspection_number?: number | string;
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

  const inspectionId = (body.inspection_id || "").trim();
  const vehicleId = (body.vehicle_id || "").trim();
  const inspectionNumberRaw = body.inspection_number;
  const inspectionNumber =
    inspectionNumberRaw === "" || inspectionNumberRaw == null ? undefined : Number(inspectionNumberRaw);

  if (!inspectionId && !vehicleId && !Number.isFinite(inspectionNumber)) {
    return NextResponse.json({ error: "Vistoria em falta." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { ownerUserId } = await resolveVehicleOwnerUserId(admin, userId);
  const { data, error } = await loadEntryInspectionDetail(admin, {
    ownerUserId,
    inspectionId: inspectionId || undefined,
    vehicleId: vehicleId || undefined,
    inspectionNumber: Number.isFinite(inspectionNumber as number) ? Number(inspectionNumber) : undefined,
  });

  if (error || !data) {
    return NextResponse.json({ error: error || "Vistoria não encontrada." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    inspection: data.inspection,
    items: data.items,
    damages: data.damages,
    photos: data.photos,
  });
}

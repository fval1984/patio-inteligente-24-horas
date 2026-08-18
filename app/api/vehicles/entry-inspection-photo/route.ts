import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { extractBearerToken, getUserIdFromAccessToken } from "@/lib/user-authorization";
import { persistInspectionPhoto, resolveInspectorDisplayName, resolveVehicleOwnerUserId } from "@/lib/vehicle-entry-inspection";

type Body = {
  access_token?: string;
  inspection_id?: string;
  vehicle_id?: string;
  photo_type?: string;
  photo_label?: string;
  photo_category?: string;
  file_name?: string;
  content_type?: string;
  data_base64?: string;
  captured_at?: string;
};

function decodeBase64(raw: string): Uint8Array | null {
  const cleaned = String(raw || "")
    .replace(/^data:[^;]+;base64,/, "")
    .replace(/\s+/g, "");
  if (!cleaned) return null;
  try {
    return Uint8Array.from(Buffer.from(cleaned, "base64"));
  } catch {
    return null;
  }
}

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
  const photoType = (body.photo_type || "").trim();
  const bytes = decodeBase64(body.data_base64 || "");
  if (!inspectionId) {
    return NextResponse.json({ error: "Vistoria em falta." }, { status: 400 });
  }
  if (!photoType) {
    return NextResponse.json({ error: "Tipo da foto em falta." }, { status: 400 });
  }
  if (!bytes?.length) {
    return NextResponse.json({ error: "Arquivo da foto em falta." }, { status: 400 });
  }
  if (bytes.length > 3_500_000) {
    return NextResponse.json({ error: "Foto demasiado grande. Tire novamente mais perto/com menos resolução." }, { status: 413 });
  }

  const admin = getSupabaseAdmin();
  const { ownerUserId, inspectorUserId } = await resolveVehicleOwnerUserId(admin, userId);
  const inspectorName = await resolveInspectorDisplayName(admin, inspectorUserId);
  const { data, error } = await persistInspectionPhoto(admin, {
    ownerUserId,
    inspectorUserId,
    inspectorName,
    inspectionId,
    vehicleId,
    photoType,
    photoLabel: body.photo_label || "",
    photoCategory: body.photo_category || "",
    fileName: body.file_name || `${photoType}.jpg`,
    contentType: body.content_type || "image/jpeg",
    bytes,
    capturedAt: body.captured_at || "",
  });

  if (error || !data) {
    return NextResponse.json({ error: error || "Erro ao gravar a foto." }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    storage_path: data.storage_path,
    url: data.url,
  });
}

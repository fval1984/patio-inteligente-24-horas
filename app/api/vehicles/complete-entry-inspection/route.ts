import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { extractBearerToken, getUserIdFromAccessToken } from "@/lib/user-authorization";
import {
  completeVehicleEntryInspection,
  resolveInspectorDisplayName,
  resolveVehicleOwnerUserId,
  validateInspectionItems,
} from "@/lib/vehicle-entry-inspection";

type Body = {
  access_token?: string;
  vehicle_id?: string;
  inspection_variant?: string;
  form_extras?: Record<string, unknown>;
  general_notes?: string;
  diagram_markers?: unknown[];
  items?: {
    category: string;
    item_key: string;
    item_label: string;
    classification: string;
  }[];
  damages?: {
    item_key?: string;
    area_label: string;
    damage_type: string;
    severity?: string;
    description?: string;
    notes?: string;
  }[];
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
  if (!vehicleId) {
    return NextResponse.json({ error: "Veículo em falta." }, { status: 400 });
  }

  const items = (body.items || []).map((it) => ({
    category: String(it.category || ""),
    item_key: String(it.item_key || ""),
    item_label: String(it.item_label || ""),
    classification: String(it.classification || "") as
      | "BOM"
      | "REGULAR"
      | "DANIFICADO"
      | "SEM_TESTE"
      | "INEXISTENTE",
  }));

  if (!items.length) {
    return NextResponse.json({ error: "Checklist vazio." }, { status: 400 });
  }

  const variant = String(body.inspection_variant || "LEVE").toUpperCase();

  const validationErr = validateInspectionItems(items, variant);
  if (validationErr) {
    return NextResponse.json({ error: validationErr }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { ownerUserId, inspectorUserId } = await resolveVehicleOwnerUserId(admin, userId);
  const inspectorName = await resolveInspectorDisplayName(admin, inspectorUserId);

  const { data, error } = await completeVehicleEntryInspection(admin, {
    ownerUserId,
    vehicleId,
    inspectorUserId,
    inspectorName,
    inspectionVariant: variant,
    formExtras: body.form_extras || {},
    generalNotes: body.general_notes || "",
    diagramMarkers: body.diagram_markers || [],
    items,
    damages: (body.damages || []).map((d) => ({
      item_key: d.item_key,
      area_label: d.area_label,
      damage_type: d.damage_type,
      severity: d.severity,
      description: d.description,
      notes: d.notes,
    })),
  });

  if (error || !data) {
    return NextResponse.json({ error: error || "Erro ao finalizar vistoria." }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    inspection_id: data.inspection_id,
    inspection_number: data.inspection_number,
    inspector_name: inspectorName,
    completed_at: new Date().toISOString(),
  });
}

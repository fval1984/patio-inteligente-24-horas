import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { resolvePatioActor } from "@/lib/patio-actor";
import { extractBearerToken, getUserIdFromAccessToken } from "@/lib/user-authorization";
import {
  resolveVehicleOwnerUserId,
  updateVehicleEntryInspection,
  validateInspectionItems,
} from "@/lib/vehicle-entry-inspection";

type Body = {
  access_token?: string;
  inspection_id?: string;
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

  const inspectionId = (body.inspection_id || "").trim();
  const vehicleId = (body.vehicle_id || "").trim();
  if (!inspectionId) {
    return NextResponse.json({ error: "Vistoria em falta." }, { status: 400 });
  }
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
  const actor = await resolvePatioActor(admin, userId);
  if (actor.role === "VISTORIADOR") {
    return NextResponse.json(
      { error: "O perfil Vistoriador não pode alterar uma vistoria já finalizada." },
      { status: 403 }
    );
  }
  const { ownerUserId } = await resolveVehicleOwnerUserId(admin, userId);

  const { data, error } = await updateVehicleEntryInspection(admin, {
    ownerUserId,
    inspectionId,
    vehicleId,
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
    return NextResponse.json({ error: error || "Erro ao atualizar vistoria." }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    inspection_id: data.inspection_id,
    inspection_number: data.inspection_number,
    damage_rows: data.damage_rows,
    updated_at: new Date().toISOString(),
  });
}

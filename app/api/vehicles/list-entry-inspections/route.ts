import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { actorCanInspect, resolvePatioActor } from "@/lib/patio-actor";
import { extractBearerToken, getUserIdFromAccessToken } from "@/lib/user-authorization";
import { listCompletedEntryInspections, resolveVehicleOwnerUserId } from "@/lib/vehicle-entry-inspection";

type Body = {
  access_token?: string;
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
    body = {};
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

  const admin = getSupabaseAdmin();
  const actor = await resolvePatioActor(admin, userId);
  if (!actorCanInspect(actor)) {
    return NextResponse.json({ error: "Sem permissão para consultar vistorias." }, { status: 403 });
  }

  const { ownerUserId } = await resolveVehicleOwnerUserId(admin, userId);
  const { data, error } = await listCompletedEntryInspections(admin, ownerUserId);
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    inspections: data || [],
  });
}

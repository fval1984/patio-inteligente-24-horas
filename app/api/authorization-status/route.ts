import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  extractBearerToken,
  getUserIdFromAccessToken,
  resolveEffectiveAuthorizationStatus,
  createPendingUserAccount,
} from "@/lib/user-authorization";

type StatusBody = {
  access_token?: string;
  accessToken?: string;
};

/**
 * Devolve o status de autorização efectivo do utilizador autenticado.
 */
export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Servidor não configurado (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)." },
      { status: 500 }
    );
  }

  let body: StatusBody = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const token =
    (body.access_token || "").trim() ||
    (body.accessToken || "").trim() ||
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
  const direct = await admin
    .from("user_accounts")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!direct.error && !direct.data) {
    await createPendingUserAccount(admin, userId);
  }

  const resolved = await resolveEffectiveAuthorizationStatus(admin, userId);

  if (resolved.error) {
    return NextResponse.json({ error: resolved.error }, { status: 500 });
  }

  return NextResponse.json({
    user_id: userId,
    authorization_status: resolved.status,
    authorized: resolved.status === "ATIVO",
    table_missing: resolved.tableMissing,
  });
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      route: "authorization-status",
      hint: "POST JSON { access_token } — devolve status de autorização.",
    },
    { status: 200 }
  );
}

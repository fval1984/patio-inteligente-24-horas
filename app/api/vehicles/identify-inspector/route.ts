import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { identifyInspectorForPatio } from "@/lib/identify-inspector";
import { extractBearerToken, getUserIdFromAccessToken } from "@/lib/user-authorization";

type Body = {
  access_token?: string;
  username?: string;
  password?: string;
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
    (body.access_token || "").trim() || extractBearerToken(request.headers.get("authorization")) || null;
  if (!token) {
    return NextResponse.json({ error: "Sessão em falta." }, { status: 401 });
  }

  const { userId, error: tokenErr } = await getUserIdFromAccessToken(supabaseUrl, serviceRoleKey, token);
  if (!userId) {
    return NextResponse.json({ error: tokenErr || "Sessão inválida." }, { status: 401 });
  }

  try {
    const admin = getSupabaseAdmin();
    const result = await identifyInspectorForPatio(admin, {
      sessionUserId: userId,
      username: body.username || "",
      password: body.password || "",
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({
      ok: true,
      inspector_id: result.inspector_id,
      vistoriador_id: result.inspector_id,
      inspector_name: result.inspector_name,
      inspector_token: result.inspector_token,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erro ao identificar vistoriador." }, { status: 500 });
  }
}

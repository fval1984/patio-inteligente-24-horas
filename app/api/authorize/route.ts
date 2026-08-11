import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  extractBearerToken,
  getUserIdFromAccessToken,
  redeemCompanyAccessCode,
} from "@/lib/user-authorization";

type AuthorizeBody = {
  code?: string;
  access_token?: string;
  accessToken?: string;
};

/**
 * Valida código de autorização no servidor (service role).
 * Requer JWT da sessão do utilizador no corpo ou header Authorization.
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

  let body: AuthorizeBody = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const token =
    (body.access_token || "").trim() ||
    (body.accessToken || "").trim() ||
    extractBearerToken(request.headers.get("authorization")) ||
    null;

  if (!token) {
    return NextResponse.json(
      { error: "Sessão em falta. Entre novamente e tente autorizar o acesso." },
      { status: 401 }
    );
  }

  const { userId, error: tokenErr } = await getUserIdFromAccessToken(supabaseUrl, serviceRoleKey, token);
  if (!userId) {
    return NextResponse.json(
      { error: tokenErr || "Não foi possível confirmar a sua sessão." },
      { status: 401 }
    );
  }

  const code = (body.code || "").trim();
  if (!code) {
    return NextResponse.json({ error: "Informe o código de autorização." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const result = await redeemCompanyAccessCode(admin, userId, code);

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        invalidCode: result.invalidCode === true,
      },
      { status: result.invalidCode ? 400 : 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    authorization_status: "ATIVO",
    authorized_at: result.authorizedAt,
  });
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      route: "authorize",
      hint: "POST JSON { code, access_token } — valida código e activa conta.",
    },
    { status: 200 }
  );
}

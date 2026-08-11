import { NextRequest, NextResponse } from "next/server";
import {
  isValidManagerLogin,
  resolveManagerIdentityToEmail,
} from "@/lib/manager-identity";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { createPendingUserAccount } from "@/lib/user-authorization";

/**
 * Cria conta no Auth com service role e e-mail já confirmado — não dispara o fluxo de
 * «confirmar e-mail» do cliente, evitando «email rate limit exceeded» do Supabase.
 */
export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      {
        error:
          "Registo no servidor não configurado (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY na Vercel).",
      },
      { status: 500 }
    );
  }

  let body: { loginRaw?: string; password?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const loginRaw = (body.loginRaw || "").trim();
  const password = (body.password || "").trim();

  if (!loginRaw || !password) {
    return NextResponse.json({ error: "Indique utilizador e senha." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "A senha deve ter pelo menos 6 caracteres." }, { status: 400 });
  }

  const email = resolveManagerIdentityToEmail(loginRaw);
  if (!email) {
    return NextResponse.json({ error: "Nome de utilizador inválido." }, { status: 400 });
  }
  if (!loginRaw.includes("@") && !isValidManagerLogin(loginRaw)) {
    return NextResponse.json(
      {
        error:
          "Nome de utilizador inválido: 3 a 48 caracteres (letras, números, . - _) ou use um e-mail com @.",
      },
      { status: 400 }
    );
  }

  const adminResp = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
    }),
  });

  const adminJson: any = await adminResp.json().catch(() => ({}));
  if (!adminResp.ok) {
    const msg =
      adminJson?.msg ||
      adminJson?.message ||
      adminJson?.error ||
      adminJson?.error_description ||
      "Não foi possível criar a conta.";
    return NextResponse.json({ error: msg, details: adminJson }, { status: adminResp.status });
  }

  const userId = adminJson?.user?.id || adminJson?.id || null;
  if (!userId) {
    return NextResponse.json({ error: "Conta criada mas o servidor não devolveu o ID do utilizador." }, { status: 500 });
  }

  try {
    const admin = getSupabaseAdmin();
    const pending = await createPendingUserAccount(admin, userId);
    if (pending.error) {
      console.warn("register: user_accounts", pending.error);
    }
  } catch (e) {
    console.warn("register: user_accounts skip", e);
  }

  return NextResponse.json({
    user_id: userId,
    email,
    authorization_status: "AGUARDANDO_AUTORIZACAO",
  });
}

export async function GET() {
  return NextResponse.json(
    { ok: true, route: "register", hint: "POST JSON { loginRaw, password } — cria utilizador Auth confirmado (sem e-mail de confirmação)." },
    { status: 200 }
  );
}

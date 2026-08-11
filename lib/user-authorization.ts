import { timingSafeEqual } from "node:crypto";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export type AuthorizationStatus = "AGUARDANDO_AUTORIZACAO" | "ATIVO" | "BLOQUEADO";

export type UserAccountRow = {
  user_id: string;
  authorization_status: AuthorizationStatus;
  authorized_at: string | null;
  created_at: string;
};

/** Código único da empresa — definir AMPLIAUTO_ACCESS_CODE na Vercel (ou .env local). */
export function getCompanyAccessCode(): string {
  return (process.env.AMPLIAUTO_ACCESS_CODE || "").trim();
}

export function isCompanyAccessCodeValid(input: string): boolean {
  const expected = getCompanyAccessCode();
  if (!expected) return false;
  const provided = (input || "").trim();
  if (!provided || provided.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  if (!authHeader.toLowerCase().startsWith("bearer ")) return null;
  return authHeader.slice(7).trim() || null;
}

export async function getUserIdFromAccessToken(
  supabaseUrl: string,
  serviceRoleKey: string,
  token: string
): Promise<{ userId: string | null; error: string | null }> {
  try {
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data?.user?.id) {
      return { userId: null, error: error?.message || "Token inválido ou expirado." };
    }
    return { userId: data.user.id, error: null };
  } catch (e: any) {
    return { userId: null, error: e?.message || "Erro ao validar sessão." };
  }
}

function isMissingTableError(msg: string): boolean {
  return /relation|schema cache|does not exist|PGRST205|42P01/i.test(msg || "");
}

export async function getUserAuthorizationStatus(
  admin: SupabaseClient,
  userId: string
): Promise<{ status: AuthorizationStatus | null; row: UserAccountRow | null; error: string | null; tableMissing: boolean }> {
  const { data, error } = await admin
    .from("user_accounts")
    .select("user_id, authorization_status, authorized_at, created_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error.message || "")) {
      return { status: null, row: null, error: null, tableMissing: true };
    }
    return { status: null, row: null, error: error.message, tableMissing: false };
  }

  if (!data) {
    return { status: "AGUARDANDO_AUTORIZACAO", row: null, error: null, tableMissing: false };
  }

  return {
    status: data.authorization_status as AuthorizationStatus,
    row: data as UserAccountRow,
    error: null,
    tableMissing: false,
  };
}

/** Gestor delegado herda autorização do dono do pátio. */
export async function resolveEffectiveAuthorizationStatus(
  admin: SupabaseClient,
  userId: string
): Promise<{ status: AuthorizationStatus; tableMissing: boolean; error: string | null }> {
  const direct = await getUserAuthorizationStatus(admin, userId);
  if (direct.error) {
    return { status: "AGUARDANDO_AUTORIZACAO", tableMissing: direct.tableMissing, error: direct.error };
  }
  if (direct.tableMissing) {
    return { status: "ATIVO", tableMissing: true, error: null };
  }
  if (direct.status === "ATIVO") {
    return { status: "ATIVO", tableMissing: false, error: null };
  }

  const { data: delegateRow, error: delegateErr } = await admin
    .from("track_managers")
    .select("owner_user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (delegateErr && !isMissingTableError(delegateErr.message || "")) {
    return { status: direct.status || "AGUARDANDO_AUTORIZACAO", tableMissing: false, error: delegateErr.message };
  }

  if (delegateRow?.owner_user_id) {
    const owner = await getUserAuthorizationStatus(admin, delegateRow.owner_user_id);
    if (owner.status === "ATIVO") {
      return { status: "ATIVO", tableMissing: false, error: null };
    }
  }

  return { status: direct.status || "AGUARDANDO_AUTORIZACAO", tableMissing: false, error: null };
}

export async function createPendingUserAccount(
  admin: SupabaseClient,
  userId: string
): Promise<{ ok: boolean; error: string | null; tableMissing: boolean }> {
  const { error } = await admin.from("user_accounts").upsert(
    {
      user_id: userId,
      authorization_status: "AGUARDANDO_AUTORIZACAO",
    },
    { onConflict: "user_id", ignoreDuplicates: true }
  );

  if (error) {
    if (isMissingTableError(error.message || "")) {
      return { ok: false, error: null, tableMissing: true };
    }
    return { ok: false, error: error.message, tableMissing: false };
  }
  return { ok: true, error: null, tableMissing: false };
}

export async function activateUserAccount(
  admin: SupabaseClient,
  userId: string
): Promise<{ ok: boolean; error: string | null }> {
  const now = new Date().toISOString();
  const { error } = await admin.from("user_accounts").upsert(
    {
      user_id: userId,
      authorization_status: "ATIVO",
      authorized_at: now,
    },
    { onConflict: "user_id" }
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true, error: null };
}

export async function activateTrackManagerAccount(
  admin: SupabaseClient,
  userId: string
): Promise<{ ok: boolean; error: string | null; tableMissing: boolean }> {
  const now = new Date().toISOString();
  const { error } = await admin.from("user_accounts").upsert(
    {
      user_id: userId,
      authorization_status: "ATIVO",
      authorized_at: now,
    },
    { onConflict: "user_id" }
  );
  if (error) {
    if (isMissingTableError(error.message || "")) {
      return { ok: false, error: null, tableMissing: true };
    }
    return { ok: false, error: error.message, tableMissing: false };
  }
  return { ok: true, error: null, tableMissing: false };
}

export type RedeemResult =
  | { ok: true; authorizedAt: string }
  | { ok: false; error: string; invalidCode?: boolean };

/** Valida o código único da empresa (variável AMPLIAUTO_ACCESS_CODE) e libera a conta. */
export async function redeemCompanyAccessCode(
  admin: SupabaseClient,
  userId: string,
  rawCode: string
): Promise<RedeemResult> {
  const code = (rawCode || "").trim();
  if (!code) {
    return { ok: false, error: "Informe o código de acesso.", invalidCode: true };
  }

  if (!getCompanyAccessCode()) {
    return {
      ok: false,
      error: "Código de acesso não configurado no servidor. Defina AMPLIAUTO_ACCESS_CODE na Vercel.",
    };
  }

  if (!isCompanyAccessCodeValid(code)) {
    return {
      ok: false,
      error: "Código de acesso inválido. Verifique e tente novamente.",
      invalidCode: true,
    };
  }

  const activated = await activateUserAccount(admin, userId);
  if (!activated.ok) {
    return { ok: false, error: activated.error || "Não foi possível liberar o acesso." };
  }

  return { ok: true, authorizedAt: new Date().toISOString() };
}

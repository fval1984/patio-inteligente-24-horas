import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createInspectorSessionToken } from "@/lib/inspector-session";
import { managerLoginEmailCandidates } from "@/lib/manager-login";
import { resolvePatioActor, userCanInspectPatio } from "@/lib/patio-actor";
import { resolveEffectiveAuthorizationStatus } from "@/lib/user-authorization";
import { resolveInspectorDisplayName } from "@/lib/vehicle-entry-inspection";

export const INVALID_INSPECTOR_CREDENTIALS = "Usuário ou senha inválidos.";

export type IdentifyInspectorInput = {
  username: string;
  password: string;
  sessionUserId: string;
};

export type IdentifyInspectorResult =
  | {
      ok: true;
      inspector_id: string;
      inspector_name: string;
      inspector_token: string;
    }
  | { ok: false; error: string; status: number };

function getAnonKey(): string {
  return (process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
}

async function passwordGrant(
  supabaseUrl: string,
  anonKey: string,
  email: string,
  password: string
): Promise<{ userId: string } | null> {
  const resp = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  const json: any = await resp.json().catch(() => ({}));
  if (!resp.ok) return null;
  const uid = String(json?.user?.id || json?.user_id || "").trim();
  if (uid) return { userId: uid };
  const accessToken = String(json?.access_token || "").trim();
  if (!accessToken) return null;
  const admin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || "", {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data } = await admin.auth.getUser(accessToken);
  const fromToken = String(data?.user?.id || "").trim();
  return fromToken ? { userId: fromToken } : null;
}

async function isAuthUserActive(admin: SupabaseClient, userId: string): Promise<boolean> {
  try {
    const { data } = await admin.auth.admin.getUserById(userId);
    const user = data?.user;
    if (!user?.id) return false;
    if (user.banned_until) {
      const until = Date.parse(String(user.banned_until));
      if (!Number.isNaN(until) && until > Date.now()) return false;
    }
    if (user.deleted_at) return false;
    return true;
  } catch {
    return false;
  }
}

export async function identifyInspectorForPatio(
  admin: SupabaseClient,
  input: IdentifyInspectorInput
): Promise<IdentifyInspectorResult> {
  const supabaseUrl = process.env.SUPABASE_URL || "";
  const anonKey = getAnonKey();
  if (!supabaseUrl || !anonKey) {
    return { ok: false, error: "Servidor não configurado.", status: 500 };
  }

  const username = String(input.username || "").trim();
  const password = String(input.password || "");
  if (!username || !password) {
    return { ok: false, error: INVALID_INSPECTOR_CREDENTIALS, status: 401 };
  }

  const actor = await resolvePatioActor(admin, input.sessionUserId);
  const emails = managerLoginEmailCandidates(username);

  let inspectorUserId: string | null = null;
  for (const email of emails) {
    const granted = await passwordGrant(supabaseUrl, anonKey, email, password);
    if (granted?.userId) {
      inspectorUserId = granted.userId;
      break;
    }
  }

  if (!inspectorUserId) {
    return { ok: false, error: INVALID_INSPECTOR_CREDENTIALS, status: 401 };
  }

  const authActive = await isAuthUserActive(admin, inspectorUserId);
  if (!authActive) {
    return { ok: false, error: INVALID_INSPECTOR_CREDENTIALS, status: 401 };
  }

  const authz = await resolveEffectiveAuthorizationStatus(admin, inspectorUserId);
  if (authz.error) {
    return { ok: false, error: authz.error, status: 500 };
  }
  if (authz.status !== "ATIVO") {
    return { ok: false, error: INVALID_INSPECTOR_CREDENTIALS, status: 401 };
  }

  const allowed = await userCanInspectPatio(admin, inspectorUserId, actor.ownerUserId);
  if (!allowed) {
    return { ok: false, error: "Este usuário não tem permissão para realizar vistoria.", status: 403 };
  }

  const inspectorName = await resolveInspectorDisplayName(admin, inspectorUserId);
  const inspector_token = createInspectorSessionToken({
    inspectorUserId,
    ownerUserId: actor.ownerUserId,
    inspectorName,
  });

  return {
    ok: true,
    inspector_id: inspectorUserId,
    inspector_name: inspectorName,
    inspector_token,
  };
}

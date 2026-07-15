import { createClient } from "@supabase/supabase-js";

type DeleteTrackManagerBody = {
  user_id?: string;
  access_token?: string;
  accessToken?: string;
};

export type DeleteTrackManagerResult = {
  status: number;
  body: Record<string, unknown>;
  headers?: Record<string, string>;
};

function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  if (!authHeader.toLowerCase().startsWith("bearer ")) return null;
  return authHeader.slice(7).trim() || null;
}

export async function runDeleteTrackManager(
  method: string,
  authorization: string | null,
  body: DeleteTrackManagerBody
): Promise<DeleteTrackManagerResult> {
  if (method !== "POST") {
    return { status: 405, body: { error: "Method not allowed" }, headers: { Allow: "POST" } };
  }

  const supabaseUrl = process.env.SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !serviceRoleKey) {
    return {
      status: 500,
      body: {
        error:
          "No servidor faltam SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY (Vercel → Environment Variables).",
      },
    };
  }

  const token =
    (body.access_token || "").trim() ||
    (body.accessToken || "").trim() ||
    extractBearerToken(authorization) ||
    null;
  if (!token) {
    return {
      status: 401,
      body: { error: "Sessão em falta: envie access_token (JWT) no corpo do pedido." },
    };
  }

  const delegateUserId = String(body.user_id || "").trim();
  if (!delegateUserId) {
    return { status: 400, body: { error: "Indique user_id do utilizador a remover." } };
  }

  let ownerId: string | null = null;
  try {
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data?.user?.id) {
      return {
        status: 401,
        body: { error: error?.message || "Token inválido ou expirado. Entre de novo na conta principal." },
      };
    }
    ownerId = data.user.id;
  } catch (e: any) {
    return { status: 401, body: { error: e?.message || "Erro ao validar sessão." } };
  }

  if (delegateUserId === ownerId) {
    return { status: 400, body: { error: "Não pode apagar a própria conta principal." } };
  }

  const linkResp = await fetch(
    `${supabaseUrl}/rest/v1/track_managers?owner_user_id=eq.${ownerId}&user_id=eq.${delegateUserId}&select=id,email`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Accept: "application/json",
      },
    }
  );
  const linkRows: any[] = await linkResp.json().catch(() => []);
  if (!linkResp.ok || !Array.isArray(linkRows) || !linkRows.length) {
    return {
      status: 404,
      body: { error: "Utilizador não encontrado na lista de gestores desta conta." },
    };
  }

  const delLink = await fetch(
    `${supabaseUrl}/rest/v1/track_managers?owner_user_id=eq.${ownerId}&user_id=eq.${delegateUserId}`,
    {
      method: "DELETE",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Accept: "application/json",
      },
    }
  );
  if (!delLink.ok) {
    const errJson: any = await delLink.json().catch(() => ({}));
    const msg =
      errJson?.message ||
      errJson?.error ||
      errJson?.hint ||
      "Não foi possível remover a ligação do gestor.";
    return { status: delLink.status || 500, body: { error: msg } };
  }

  let authDeleted = false;
  const delAuth = await fetch(`${supabaseUrl}/auth/v1/admin/users/${delegateUserId}`, {
    method: "DELETE",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Accept: "application/json",
    },
  });
  authDeleted = delAuth.ok || delAuth.status === 404;

  return {
    status: 200,
    body: {
      ok: true,
      user_id: delegateUserId,
      email: linkRows[0]?.email || null,
      auth_deleted: authDeleted,
      message: authDeleted
        ? "Utilizador removido. O acesso de login foi desativado."
        : "Ligação removida. Se o login persistir, apague o utilizador em Supabase → Authentication.",
    },
  };
}

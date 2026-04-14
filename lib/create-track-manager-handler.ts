type CreateTrackManagerBody = {
  email?: string;
  password?: string;
  anon_key?: string;
};

export type CreateTrackManagerResult = {
  status: number;
  body: Record<string, unknown>;
  headers?: Record<string, string>;
};

function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  if (!authHeader.toLowerCase().startsWith("bearer ")) return null;
  return authHeader.slice(7).trim() || null;
}

/** Procura utilizador Auth pelo e-mail (várias páginas) — só com service role. */
async function findAuthUserIdByEmail(
  supabaseUrl: string,
  serviceRoleKey: string,
  email: string
): Promise<string | null> {
  const want = email.trim().toLowerCase();
  if (!want) return null;
  let page = 1;
  const perPage = 200;
  for (let guard = 0; guard < 60; guard++) {
    const r = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=${page}&per_page=${perPage}`, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Accept: "application/json",
      },
    });
    if (!r.ok) return null;
    const j: any = await r.json().catch(() => ({}));
    const users = Array.isArray(j?.users) ? j.users : [];
    const found = users.find((u: any) => String(u?.email || "").toLowerCase() === want);
    if (found?.id) return String(found.id);
    if (users.length < perPage) break;
    page += 1;
  }
  return null;
}

function looksLikeUserAlreadyExists(adminStatus: number, adminJson: any): boolean {
  const msg = [adminJson?.msg, adminJson?.message, adminJson?.error, adminJson?.error_description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (/password|weak|too short|at least|mínimo|mínima|invalid.*password/i.test(msg)) return false;

  const errCode = String(adminJson?.error_code || adminJson?.code || "");
  if (/user_already_exists|email_exists|already_registered/i.test(errCode)) return true;
  if (adminStatus === 409) return true;
  if (
    adminStatus === 422 &&
    /already\s*(been\s*)?registered|user\s*already|exists|duplicate|email.*already|been\s*taken/i.test(msg)
  ) {
    return true;
  }
  return false;
}

export async function runCreateTrackManager(
  method: string,
  authorization: string | null,
  body: CreateTrackManagerBody
): Promise<CreateTrackManagerResult> {
  if (method !== "POST") {
    return {
      status: 405,
      body: { error: "Method not allowed" },
      headers: { Allow: "POST" },
    };
  }

  const supabaseUrl = process.env.SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const anonKey = (body.anon_key || "").trim() || process.env.SUPABASE_ANON_KEY || "";

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      status: 500,
      body: {
        error:
          "No servidor (Vercel) faltam SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY. Vercel → Settings → Environment Variables → Production → adiciona as duas e faz Redeploy.",
      },
    };
  }

  const token = extractBearerToken(authorization);
  if (!token) {
    return {
      status: 401,
      body: {
        error:
          "Token em falta no pedido. Atualiza a página, volta a entrar e tenta de novo.",
      },
    };
  }

  const apikeyForUserCall = anonKey;
  if (!apikeyForUserCall) {
    return {
      status: 500,
      body: {
        error:
          "Falta SUPABASE_ANON_KEY no servidor e no pedido. Configure SUPABASE_ANON_KEY na Vercel ou atualize a app.",
      },
    };
  }

  let requesterId: string | null = null;
  try {
    const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        apikey: apikeyForUserCall,
      },
    });
    if (!userResp.ok) {
      const hint =
        userResp.status === 401
          ? " Confirma que SUPABASE_URL na Vercel é o mesmo projeto que em app.html (URL do Supabase)."
          : "";
      return {
        status: 401,
        body: {
          error: `Não autorizado (${userResp.status}).${hint}`,
        },
      };
    }
    const userJson: any = await userResp.json();
    requesterId = userJson?.id || userJson?.user?.id || null;
    if (!requesterId) return { status: 401, body: { error: "Unauthorized" } };
  } catch {
    return { status: 401, body: { error: "Unauthorized" } };
  }

  const email = (body.email || "").trim();
  const password = (body.password || "").trim();

  if (!email || !password) {
    return { status: 400, body: { error: "email and password are required" } };
  }

  /**
   * Sempre email_confirm: true — o utilizador fica confirmado na hora e o Supabase NÃO envia
   * e-mail de confirmação (evita «email rate limit exceeded» no plano gratuito).
   * Partilhe o link da app, o e-mail e a senha com o gestor por WhatsApp / SMS / etc.
   */
  let newUserId: string | null = null;
  /** True quando o Auth já tinha este e-mail e só ligámos em track_managers (a senha enviada não altera a conta). */
  let reusedExistingAuthUser = false;
  try {
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
    if (adminResp.ok) {
      newUserId = adminJson?.user?.id || adminJson?.id || null;
      if (!newUserId) {
        return { status: 500, body: { error: "User created but id not found" } };
      }
    } else if (looksLikeUserAlreadyExists(adminResp.status, adminJson)) {
      reusedExistingAuthUser = true;
      newUserId = await findAuthUserIdByEmail(supabaseUrl, serviceRoleKey, email);
      if (!newUserId) {
        return {
          status: adminResp.status,
          body: {
            error:
              "Este e-mail / nome de acesso já está registado no Auth, mas não foi possível localizar o UID. Confirme no Supabase → Authentication → Users ou use «Associar gestor» com o UUID.",
            details: adminJson?.msg || adminJson?.message || adminJson?.error,
          },
        };
      }
    } else {
      return {
        status: adminResp.status,
        body: {
          error:
            adminJson?.msg ||
            adminJson?.message ||
            adminJson?.error ||
            adminJson?.error_description ||
            "Falha ao criar utilizador (Auth). Verifique palavra-passe (mín. 6 caracteres) e políticas de e-mail no Supabase.",
          details: adminJson,
        },
      };
    }
  } catch (e: any) {
    return { status: 500, body: { error: e?.message || "Failed to create user" } };
  }

  const baseRow = {
    owner_user_id: requesterId,
    user_id: newUserId,
    email,
  };

  function insertErrorText(j: any): string {
    if (!j || typeof j !== "object") return "";
    return [j.message, j.hint, j.details, j.error, Array.isArray(j) ? j.map((x) => x?.message).join(" ") : ""]
      .filter(Boolean)
      .join(" ");
  }

  async function insertTrackManager(row: Record<string, unknown>) {
    return fetch(`${supabaseUrl}/rest/v1/track_managers`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify([row]),
    });
  }

  try {
    let insertResp = await insertTrackManager({ ...baseRow, role: "GESTOR_PISTA" });
    let insertJson: any = await insertResp.json().catch(() => ({}));

    if (!insertResp.ok) {
      const errText = insertErrorText(insertJson);
      const missingRoleCol =
        /'role'|\"role\"|column.*role|Could not find.*role/i.test(errText) ||
        (/PGRST204|schema cache/i.test(errText) && /role/i.test(errText));
      if (missingRoleCol) {
        insertResp = await insertTrackManager({ ...baseRow });
        insertJson = await insertResp.json().catch(() => ({}));
      }
    }

    if (!insertResp.ok) {
      const errText = insertErrorText(insertJson) || "User created but could not insert track_manager mapping";
      if (/duplicate key|unique constraint|23505|already exists/i.test(errText)) {
        return {
          status: 200,
          body: {
            user_id: newUserId,
            email,
            already_linked: true,
            message: "Este gestor já estava associado à sua conta.",
          },
        };
      }
      return {
        status: insertResp.status,
        body: { error: errText, user_id: newUserId },
      };
    }

    return {
      status: 200,
      body: {
        user_id: newUserId,
        email,
        ...(reusedExistingAuthUser
          ? {
              existing_auth_user: true,
              message:
                "Este login já existia no Auth; foi só criada a ligação de gestor. A senha que indicou não altera a conta — redefina a palavra-passe no Supabase (Authentication) se precisar.",
            }
          : {}),
      },
    };
  } catch (e: any) {
    return { status: 500, body: { error: e?.message || "Failed to insert track_manager" } };
  }
}

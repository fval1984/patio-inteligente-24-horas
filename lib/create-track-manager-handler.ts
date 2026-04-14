import { randomBytes } from "node:crypto";

type CreateTrackManagerBody = {
  email?: string;
  password?: string;
  /** JWT da sessão do dono (preferir enviar no corpo — não depender do header Authorization na Vercel). */
  access_token?: string;
  anon_key?: string;
};

/**
 * Login técnico único (sem e-mail real). O funcionário usa isto no campo «e-mail» do login da app.
 * Usamos o domínio reservado RFC 2606 `.invalid` — alguns projetos GoTrue rejeitam `.local`.
 */
function generateGestorLoginEmail(): string {
  return `gm_${randomBytes(16).toString("hex")}@gestor.invalid`;
}

/** Senha inicial segura (só devolvida uma vez na resposta HTTP quando gerada aqui). */
function generateGestorInitialPassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const buf = randomBytes(14);
  let out = "";
  for (let i = 0; i < 14; i++) out += chars[buf[i]! % chars.length];
  return out;
}

function isValidEmailFormat(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

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
  /** Sempre preferir anon do servidor (mesmo projeto que SERVICE_ROLE) — evita chave errada vinda do cliente. */
  const anonKey =
    (process.env.SUPABASE_ANON_KEY || "").trim() || (body.anon_key || "").trim() || "";

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      status: 500,
      body: {
        error:
          "No servidor (Vercel) faltam SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY. Vercel → Settings → Environment Variables → Production → adiciona as duas e faz Redeploy.",
      },
    };
  }

  const token =
    (body.access_token || "").trim() ||
    extractBearerToken(authorization) ||
    null;
  if (!token) {
    return {
      status: 401,
      body: {
        error:
          "Sessão em falta: o pedido precisa do campo JSON access_token (JWT). Atualize a página, entre de novo na conta principal e tente.",
      },
    };
  }

  const apikeyForUserCall = anonKey;
  if (!apikeyForUserCall) {
    return {
      status: 500,
      body: {
        error:
          "Falta SUPABASE_ANON_KEY no servidor (Vercel). Adicione a chave «anon public» do mesmo projeto Supabase em Environment Variables e faça Redeploy.",
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
      const userErr: any = await userResp.json().catch(() => ({}));
      const supMsg = [userErr?.message, userErr?.msg, userErr?.error_description, userErr?.error]
        .filter(Boolean)
        .join(" ");
      const hint401 =
        userResp.status === 401
          ? " Confirme que SUPABASE_URL na Vercel é o mesmo projeto que em app.html, que SUPABASE_ANON_KEY coincide com a chave anon da app e que voltou a entrar (sessão válida)."
          : "";
      return {
        status: 401,
        body: {
          error: `Não autorizado (${userResp.status}).${hint401}${supMsg ? ` ${supMsg}` : ""}`,
        },
      };
    }
    const userJson: any = await userResp.json();
    requesterId = userJson?.id || userJson?.user?.id || null;
    if (!requesterId) return { status: 401, body: { error: "Unauthorized" } };
  } catch {
    return { status: 401, body: { error: "Unauthorized" } };
  }

  let email = (body.email || "").trim().toLowerCase();
  let password = (body.password || "").trim();
  let initialPasswordForResponse: string | undefined;
  const autoLogin = !email;
  const autoPassword = !password;

  if (email && !isValidEmailFormat(email)) {
    return { status: 400, body: { error: "Formato de e-mail inválido." } };
  }
  if (!email) {
    email = generateGestorLoginEmail();
  }
  if (!password) {
    password = generateGestorInitialPassword();
    initialPasswordForResponse = password;
  }
  if (password.length < 6) {
    return { status: 400, body: { error: "A senha deve ter pelo menos 6 caracteres (regra do Supabase)." } };
  }

  /**
   * Sempre email_confirm: true — o utilizador fica confirmado na hora e o Supabase NÃO envia
   * e-mail de confirmação (evita «email rate limit exceeded» no plano gratuito).
   * Partilhe o link da app, o login e a senha com o gestor por WhatsApp / SMS / etc.
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
      const d = adminJson?.msg || adminJson?.message || adminJson?.error || adminJson?.error_description;
      const detailStr =
        typeof d === "string"
          ? d
          : [adminJson?.error_code, adminJson?.code].filter(Boolean).join(" ") || JSON.stringify(adminJson).slice(0, 400);
      return {
        status: adminResp.status,
        body: {
          error:
            (typeof d === "string" ? d : null) ||
            adminJson?.error ||
            adminJson?.error_description ||
            "Falha ao criar utilizador (Auth). Verifique palavra-passe (mín. 6 caracteres) e políticas de e-mail no Supabase.",
          details: detailStr,
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
        ...(autoLogin ? { generated_login: true } : {}),
        ...(autoPassword && initialPasswordForResponse && !reusedExistingAuthUser
          ? { initial_password: initialPasswordForResponse }
          : {}),
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

import type { NextApiRequest, NextApiResponse } from "next";

type CreateTrackManagerBody = {
  email?: string;
  password?: string;
};

function extractBearerToken(authHeader: string | string[] | undefined): string | null {
  const raw = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  if (!raw) return null;
  if (!raw.toLowerCase().startsWith("bearer ")) return null;
  return raw.slice(7).trim() || null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const supabaseUrl = process.env.SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({
      error: "Server env missing: SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY",
    });
  }

  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    return res.status(401).json({ error: "Missing auth token" });
  }

  let requesterId: string | null = null;
  try {
    const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
    if (!userResp.ok) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userJson: any = await userResp.json();
    requesterId = userJson?.id || userJson?.user?.id || null;
    if (!requesterId) return res.status(401).json({ error: "Unauthorized" });
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const body: CreateTrackManagerBody = req.body || {};
  const email = (body.email || "").trim();
  const password = (body.password || "").trim();

  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  // 1) Cria usuário de Auth no Supabase (sem confirmação de email).
  let newUserId: string | null = null;
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
    if (!adminResp.ok) {
      return res.status(adminResp.status).json({ error: adminJson?.msg || adminJson?.error || "Failed to create user" });
    }

    newUserId = adminJson?.user?.id || adminJson?.id || null;
    if (!newUserId) {
      return res.status(500).json({ error: "User created but id not found" });
    }
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Failed to create user" });
  }

  // 2) Marca o novo usuário como "Gestor de Pista" na tabela track_managers.
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
      return res.status(insertResp.status).json({
        error: errText,
        user_id: newUserId,
      });
    }

    return res.status(200).json({ user_id: newUserId, email });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Failed to insert track_manager" });
  }
}


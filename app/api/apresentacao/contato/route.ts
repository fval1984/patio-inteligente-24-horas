import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { extractBearerToken, getUserIdFromAccessToken } from "@/lib/user-authorization";

const FALLBACK_DISPLAY = "(81) 99991-8484";

type SettingsPhone = {
  id?: string;
  user_id?: string;
  whatsapp_comercial?: string | null;
  recibo_telefone?: string | null;
  created_at?: string | null;
};

function digitsOf(raw: string): string {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return "55" + digits;
  return "";
}

function columnMissing(message: string): boolean {
  return /whatsapp_comercial|schema cache|PGRST204|column/i.test(message || "");
}

function choosePhone(rows: SettingsPhone[]): { display: string; configured: boolean } {
  for (const row of rows) {
    const value = String(row.whatsapp_comercial || "").trim();
    if (digitsOf(value)) return { display: value, configured: true };
  }
  for (const row of rows) {
    const value = String(row.recibo_telefone || "").trim();
    if (digitsOf(value)) return { display: value, configured: true };
  }
  return { display: FALLBACK_DISPLAY, configured: false };
}

async function readSettings(): Promise<SettingsPhone[]> {
  const admin = getSupabaseAdmin();
  const withWhatsapp = await admin
    .from("settings")
    .select("id,user_id,whatsapp_comercial,recibo_telefone,created_at")
    .order("created_at", { ascending: false })
    .limit(30);
  if (!withWhatsapp.error) return (withWhatsapp.data || []) as SettingsPhone[];
  if (!columnMissing(withWhatsapp.error.message || "")) return [];
  const receiptOnly = await admin
    .from("settings")
    .select("id,user_id,recibo_telefone,created_at")
    .order("created_at", { ascending: false })
    .limit(30);
  if (receiptOnly.error) return [];
  return (receiptOnly.data || []) as SettingsPhone[];
}

async function ensureWhatsappColumn(): Promise<boolean> {
  const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "";
  if (!dbUrl) return false;
  const { Client } = await import("pg");
  const isLocal = /localhost|127\.0\.0\.1/.test(dbUrl) && !/supabase\.co/.test(dbUrl);
  const client = new Client({
    connectionString: dbUrl,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const sqlPath = path.join(process.cwd(), "supabase", "settings_whatsapp_comercial.sql");
    const sql = fs.existsSync(sqlPath)
      ? fs.readFileSync(sqlPath, "utf8")
      : "alter table if exists public.settings add column if not exists whatsapp_comercial text;";
    await client.query(sql);
    await client.query("NOTIFY pgrst, 'reload schema'");
  } finally {
    await client.end();
  }
  return true;
}

export async function GET() {
  try {
    const chosen = choosePhone(await readSettings());
    return NextResponse.json({
      whatsapp: digitsOf(chosen.display),
      display: chosen.display,
      configured: chosen.configured,
    });
  } catch {
    return NextResponse.json({
      whatsapp: digitsOf(FALLBACK_DISPLAY),
      display: FALLBACK_DISPLAY,
      configured: false,
    });
  }
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !serviceRoleKey || /SEU_PROJECT|cole_aqui/i.test(supabaseUrl + serviceRoleKey)) {
    return NextResponse.json(
      { error: "Servidor sem a chave do Supabase. O número comercial da apresentação continua o já usado nos contatos." },
      { status: 503 }
    );
  }

  let body: { access_token?: string; accessToken?: string; whatsapp?: string } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const token =
    (body.access_token || "").trim() ||
    (body.accessToken || "").trim() ||
    extractBearerToken(request.headers.get("authorization")) ||
    "";
  if (!token) return NextResponse.json({ error: "Sessão em falta." }, { status: 401 });

  const { userId, error: tokenErr } = await getUserIdFromAccessToken(supabaseUrl, serviceRoleKey, token);
  if (!userId) return NextResponse.json({ error: tokenErr || "Sessão inválida." }, { status: 401 });

  const value = String(body.whatsapp || "").trim();
  if (value && !digitsOf(value)) {
    return NextResponse.json({ error: "Informe o WhatsApp com DDD." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const rows = await readSettings();
  const own = rows.find((row) => String(row.user_id || "") === userId);

  async function write(rowId: string | undefined) {
    if (rowId) {
      return admin.from("settings").update({ whatsapp_comercial: value }).eq("id", rowId).eq("user_id", userId);
    }
    return admin.from("settings").insert({ user_id: userId, whatsapp_comercial: value });
  }

  let result = await write(own?.id);
  if (result.error && columnMissing(result.error.message || "")) {
    try {
      await ensureWhatsappColumn();
    } catch {
      return NextResponse.json(
        {
          error:
            "Execute no Supabase o arquivo supabase/settings_whatsapp_comercial.sql para gravar um número diferente do comercial já usado.",
        },
        { status: 503 }
      );
    }
    result = await write(own?.id);
  }
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  return NextResponse.json({ ok: true, whatsapp: digitsOf(value), display: value });
}

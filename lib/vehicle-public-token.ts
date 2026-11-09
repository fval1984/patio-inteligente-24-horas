import { randomBytes } from "crypto";
import fs from "fs";
import path from "path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveVehicleOwnerUserId } from "@/lib/vehicle-entry-inspection";

export function newPublicVehicleToken(): string {
  return randomBytes(24).toString("hex");
}

function isMissingPublicTokenSchema(msg: string): boolean {
  return /public_token|ensure_vehicle_public_token|schema cache|PGRST202|PGRST204|does not exist|column/i.test(
    msg || ""
  );
}

export async function applyVehiclesPublicQrSql(): Promise<{ ok: boolean; error?: string }> {
  const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "";
  if (!dbUrl) {
    return {
      ok: false,
      error:
        "SUPABASE_DB_URL não configurada. No Supabase → SQL Editor, execute o ficheiro supabase/vehicles_public_qr.sql e clique em Run.",
    };
  }
  const sqlPath = path.join(process.cwd(), "supabase", "vehicles_public_qr.sql");
  if (!fs.existsSync(sqlPath)) {
    return { ok: false, error: "Arquivo supabase/vehicles_public_qr.sql não encontrado." };
  }
  let sql = fs.readFileSync(sqlPath, "utf8");
  if (!/NOTIFY pgrst, 'reload schema'/i.test(sql)) {
    sql += "\n\nNOTIFY pgrst, 'reload schema';\n";
  }
  const { Client } = await import("pg");
  const isLocal = /localhost|127\.0\.0\.1/.test(dbUrl) && !/supabase\.co/.test(dbUrl);
  const client = new Client({
    connectionString: dbUrl,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
  return { ok: true };
}

export async function ensureVehiclePublicTokenForUser(
  admin: SupabaseClient,
  authUserId: string,
  vehicleId: string
): Promise<{ token?: string; error?: string; missingSchema?: boolean }> {
  const id = String(vehicleId || "").trim();
  if (!id) return { error: "Veículo em falta." };

  const { ownerUserId } = await resolveVehicleOwnerUserId(admin, authUserId);

  const { data: row, error: selErr } = await admin
    .from("vehicles")
    .select("id,user_id,public_token")
    .eq("id", id)
    .maybeSingle();

  if (selErr) {
    if (isMissingPublicTokenSchema(selErr.message || "")) {
      return { missingSchema: true, error: selErr.message };
    }
    return { error: selErr.message };
  }
  if (!row) return { error: "Veículo não encontrado." };
  if (String(row.user_id) !== String(ownerUserId)) return { error: "Sem permissão para este veículo." };

  const existing = String(row.public_token || "").trim();
  if (existing) return { token: existing };

  const generated = newPublicVehicleToken();
  const { data: updated, error: updErr } = await admin
    .from("vehicles")
    .update({ public_token: generated })
    .eq("id", id)
    .eq("user_id", ownerUserId)
    .select("public_token")
    .maybeSingle();

  if (updErr) {
    if (isMissingPublicTokenSchema(updErr.message || "")) {
      return { missingSchema: true, error: updErr.message };
    }
    return { error: updErr.message };
  }

  const token = String(updated?.public_token || generated).trim();
  return token ? { token } : { error: "Não foi possível gravar o token público." };
}

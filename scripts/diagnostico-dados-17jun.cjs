/**
 * Diagnóstico 17/06 — roda localmente (quando SQL Editor falha com api.supabase.com)
 * node scripts/diagnostico-dados-17jun.cjs
 */
const fs = require("fs");
const path = require("path");

function loadEnvLocal() {
  const p = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

const EMAIL = "fernandolima@ampliauto.com.br";
const DIA = "2026-06-17";

function isOnDay(iso, day) {
  if (!iso) return false;
  return String(iso).slice(0, 10) === day;
}

async function main() {
  loadEnvLocal();
  const { createClient } = require("@supabase/supabase-js");
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Falta SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY em .env.local");
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: users, error: uErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (uErr) {
    console.error("auth.admin.listUsers:", uErr.message);
    process.exit(1);
  }
  const user = (users?.users || []).find((u) => String(u.email || "").toLowerCase() === EMAIL);
  if (!user) {
    console.error("Usuário não encontrado:", EMAIL);
    process.exit(1);
  }
  const uid = user.id;

  const [rec, pay, cash, settings] = await Promise.all([
    supabase.from("receivables").select("id,created_at").eq("user_id", uid),
    supabase.from("payables").select("id,created_at").eq("user_id", uid),
    supabase.from("cash_movements").select("id,tipo_conta,valor,created_at,descricao").eq("user_id", uid).order("created_at", { ascending: false }).limit(20),
    supabase.from("settings").select("finance_manual_caixa_mode,caixa_reset_ym,caixa_operational_reset_at,caixa_opening_balance").eq("user_id", uid).maybeSingle(),
  ]);

  for (const [name, res] of [
    ["receivables", rec],
    ["payables", pay],
    ["cash_movements", cash],
    ["settings", settings],
  ]) {
    if (res.error) console.warn(name + ":", res.error.message);
  }

  const receivables = rec.data || [];
  const payables = pay.data || [];
  const movements = cash.data || [];

  const summary = {
    user_id: uid,
    email: EMAIL,
    receivables_novos_17jun: receivables.filter((r) => isOnDay(r.created_at, DIA)).length,
    payables_novos_17jun: payables.filter((p) => isOnDay(p.created_at, DIA)).length,
    caixa_novos_17jun: movements.filter((m) => isOnDay(m.created_at, DIA)).length,
    total_receivables: receivables.length,
    total_payables: payables.length,
    total_caixa_amostra: movements.length,
    settings: settings.data || null,
  };

  console.log("\n=== RESULTADO 1 — Resumo ===");
  console.table(summary);

  console.log("\n=== RESULTADO 2 — Settings ===");
  console.log(settings.data || "(sem settings)");

  console.log("\n=== RESULTADO 3 — Últimas movimentações caixa ===");
  console.table(
    movements.map((m) => ({
      tipo: m.tipo_conta,
      valor: m.valor,
      criado: String(m.created_at || "").slice(0, 10),
      descricao: String(m.descricao || "").slice(0, 50),
    }))
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

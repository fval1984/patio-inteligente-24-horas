/**
 * Lança no caixa as despesas já PAGO (histórico) — uma vez.
 * Preferência: SUPABASE_DB_URL no .env.local (Connection string do Supabase → Database).
 * Alternativa: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (REST).
 *
 * Uso: npm run db:lancar-despesas-pagas-caixa
 */
const fs = require("fs");
const path = require("path");

const SQL = fs.readFileSync(
  path.join(__dirname, "..", "supabase", "lancar_despesas_pagas_historico_no_caixa.sql"),
  "utf8"
).replace(/^--[^\n]*\n/gm, "");

function loadEnvLocal() {
  for (const name of [".env.local", ".env"]) {
    const p = path.join(__dirname, "..", name);
    if (!fs.existsSync(p)) continue;
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
}

async function runPg(url) {
  const { Client } = require("pg");
  const isLocal = /localhost|127\.0\.0\.1/.test(url) && !/supabase\.co/.test(url);
  const client = new Client({
    connectionString: url,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  const res = await client.query(SQL);
  await client.end();
  return res.rowCount;
}

async function runRest() {
  const { createClient } = require("@supabase/supabase-js");
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { data: payables, error: pErr } = await supabase
    .from("payables")
    .select("id,user_id,valor,status,descricao,data_vencimento,updated_at")
    .limit(2000);
  if (pErr) throw pErr;
  const paid = (payables || []).filter(
    (p) => String(p.status || "").toUpperCase() === "PAGO" && Number(p.valor || 0) > 0
  );
  let n = 0;
  for (const p of paid) {
    const { data: movs } = await supabase
      .from("cash_movements")
      .select("id,tipo_conta")
      .eq("user_id", p.user_id)
      .eq("conta_id", p.id);
    if ((movs || []).some((m) => /PAGAR|SAIDA/i.test(m.tipo_conta || ""))) continue;
    const row = {
      user_id: p.user_id,
      tipo_conta: "PAGAR",
      conta_id: p.id,
      valor: Number(p.valor),
      descricao: p.descricao || "Despesa",
      data_movimento: (p.data_vencimento || p.updated_at || "").slice(0, 10) || new Date().toISOString().slice(0, 10),
    };
    const ins = await supabase.from("cash_movements").insert(row);
    if (!ins.error) n += 1;
  }
  return n;
}

async function main() {
  loadEnvLocal();
  const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  try {
    if (dbUrl) {
      const n = await runPg(dbUrl);
      console.log(`Lançadas ${n ?? "?"} saída(s) no caixa (via PostgreSQL).`);
      return;
    }
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const n = await runRest();
      console.log(`Lançadas ${n} saída(s) no caixa (via API).`);
      return;
    }
    console.error("Adicione SUPABASE_DB_URL ou SUPABASE_URL+SUPABASE_SERVICE_ROLE_KEY em .env.local");
    console.error("Ou execute supabase/lancar_despesas_pagas_historico_no_caixa.sql no SQL Editor do Supabase.");
    process.exit(1);
  } catch (e) {
    console.error(e.message || e);
    if (e.cause) console.error(e.cause.message || e.cause);
    console.error("\nUse o SQL Editor do Supabase: supabase/lancar_despesas_pagas_historico_no_caixa.sql");
    process.exit(1);
  }
}

main();

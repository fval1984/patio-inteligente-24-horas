/**
 * Remove [[finmeta:...]] de caixa, recebíveis e despesas no banco.
 * Uso: npm run db:limpar-finmeta
 */
const fs = require("fs");
const path = require("path");

const SQL = fs
  .readFileSync(path.join(__dirname, "..", "supabase", "limpar_finmeta_financeiro.sql"), "utf8")
  .replace(/^--[^\n]*\n/gm, "");

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

function stripFinmeta(s) {
  let raw = String(s || "").trim();
  while (raw.includes("[[finmeta:")) {
    const start = raw.indexOf("[[finmeta:");
    const end = raw.indexOf("]]", start);
    if (end < 0) break;
    raw = (raw.slice(0, start) + raw.slice(end + 2)).trim();
  }
  return raw;
}

async function runPg(url) {
  const { Client } = require("pg");
  const isLocal = /localhost|127\.0\.0\.1/.test(url) && !/supabase\.co/.test(url);
  const client = new Client({
    connectionString: url,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  await client.query(SQL);
  await client.end();
  console.log("Limpeza [[finmeta:...]] aplicada via PostgreSQL.");
}

async function runRest() {
  const { createClient } = require("@supabase/supabase-js");
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  let n = 0;
  for (const table of ["cash_movements", "receivables", "payables"]) {
    const cols =
      table === "cash_movements"
        ? ["id", "user_id", "descricao"]
        : table === "receivables"
          ? ["id", "user_id", "responsavel_pagamento", "observacoes"]
          : ["id", "user_id", "descricao", "observacoes"];
    const { data, error } = await supabase.from(table).select(cols.join(",")).limit(5000);
    if (error) throw error;
    for (const row of data || []) {
      const patch = {};
      for (const col of cols.slice(2)) {
        if (row[col] == null) continue;
        const raw = String(row[col]);
        if (!raw.includes("[[finmeta:")) continue;
        const clean = stripFinmeta(raw);
        if (clean && clean !== raw) patch[col] = clean;
      }
      if (!Object.keys(patch).length) continue;
      const { error: uErr } = await supabase.from(table).update(patch).eq("id", row.id).eq("user_id", row.user_id);
      if (!uErr) n += 1;
    }
  }
  console.log(`Atualizados ${n} registro(s) via API.`);
}

async function main() {
  loadEnvLocal();
  const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  try {
    if (dbUrl) {
      await runPg(dbUrl);
      return;
    }
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      await runRest();
      return;
    }
    console.error("Adicione SUPABASE_DB_URL ou SUPABASE_URL+SUPABASE_SERVICE_ROLE_KEY em .env.local");
    console.error("Ou execute supabase/limpar_finmeta_financeiro.sql no SQL Editor do Supabase.");
    process.exit(1);
  } catch (e) {
    console.error(e.message || e);
    console.error("\nAlternativa: supabase/limpar_finmeta_financeiro.sql no SQL Editor.");
    process.exit(1);
  }
}

main();

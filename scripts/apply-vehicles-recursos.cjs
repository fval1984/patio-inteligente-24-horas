/**
 * Aplica supabase/vehicles_recursos_avancados.sql na base do Supabase.
 *
 * 1) Se existir o pacote `pg`: usa-o (recomendado — corra: npm install pg --save-dev).
 * 2) Senão, se `psql` estiver no PATH: usa psql (cliente PostgreSQL).
 *
 * Variável: SUPABASE_DB_URL no .env.local (URI em Project Settings → Database).
 *
 * Uso: npm run db:apply-vehicles
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function loadEnvLocal() {
  const p = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(p)) return;
  const txt = fs.readFileSync(p, "utf8");
  for (const line of txt.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

async function runWithPg(url, sql) {
  let Client;
  try {
    ({ Client } = require("pg"));
  } catch {
    return { ok: false, reason: "no-pg" };
  }
  const isLocal =
    /localhost|127\.0\.0\.1/.test(url) && !/supabase\.co/.test(url);
  const client = new Client({
    connectionString: url,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });
  try {
    await client.connect();
    await client.query(sql);
    await client.end();
    return { ok: true };
  } catch (e) {
    try {
      await client.end();
    } catch {
      /* ignore */
    }
    return { ok: false, reason: "pg-error", err: e.message || String(e) };
  }
}

function runWithPsql(url, sqlPath) {
  const bin = process.platform === "win32" ? "psql.exe" : "psql";
  const r = spawnSync(bin, [url, "-v", "ON_ERROR_STOP=1", "-f", sqlPath], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  if (r.error && r.error.code === "ENOENT") return { ok: false, reason: "no-psql" };
  if (r.status !== 0) {
    return { ok: false, reason: "psql-fail", stderr: r.stderr || "", stdout: r.stdout || "" };
  }
  return { ok: true };
}

async function main() {
  loadEnvLocal();
  const url = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error(
      "Falta SUPABASE_DB_URL no ficheiro .env.local (raiz do projeto).\n\n" +
        "Supabase → Project Settings → Database → Connection string → URI.\n" +
        "Exemplo:\n" +
        "SUPABASE_DB_URL=postgresql://postgres.[ref]:SUA_SENHA@...pooler.supabase.com:6543/postgres\n\n" +
        "Sem URI: abra supabase/vehicles_recursos_avancados.sql no SQL Editor do Supabase e execute manualmente."
    );
    process.exit(1);
  }

  const sqlPath = path.join(__dirname, "..", "supabase", "vehicles_recursos_avancados.sql");
  if (!fs.existsSync(sqlPath)) {
    console.error("Ficheiro não encontrado:", sqlPath);
    process.exit(1);
  }
  const sql = fs.readFileSync(sqlPath, "utf8");

  const pgTry = await runWithPg(url, sql);
  if (pgTry.ok) {
    console.log("OK — aplicado com pg:", path.relative(process.cwd(), sqlPath));
    return;
  }

  const psqlTry = runWithPsql(url, sqlPath);
  if (psqlTry.ok) {
    console.log("OK — aplicado com psql:", path.relative(process.cwd(), sqlPath));
    return;
  }

  if (psqlTry.reason === "psql-fail") {
    console.error(psqlTry.stderr || psqlTry.stdout || "psql falhou.");
    process.exit(1);
  }

  console.error(
    "Não foi possível aplicar o SQL automaticamente.\n\n" +
      "Opção A — instalar driver Node e repetir:\n" +
      "  npm install pg --save-dev\n" +
      "  npm run db:apply-vehicles\n\n" +
      "Opção B — instalar cliente PostgreSQL (psql) no PATH e repetir:\n" +
      "  npm run db:apply-vehicles\n\n" +
      "Opção C — manual: Supabase → SQL Editor → colar supabase/vehicles_recursos_avancados.sql → Run."
  );
  if (pgTry.reason === "pg-error") console.error("\nErro pg:", pgTry.err);
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

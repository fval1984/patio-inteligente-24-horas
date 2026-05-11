/**
 * Aplica supabase/financeiro_dual_patio_manual.sql na base PostgreSQL.
 *
 * 1) Se existir `psql` no PATH e `DATABASE_URL` no ambiente ou no `.env` da raiz:
 *    corre: psql "$DATABASE_URL" -f supabase/financeiro_dual_patio_manual.sql
 * 2) Caso contrário, indica o caminho do ficheiro para colares no Supabase SQL Editor.
 *
 * Uso: npm run db:apply-financeiro-dual
 */
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const envPath = resolve(root, ".env");
const sqlPath = resolve(root, "supabase", "financeiro_dual_patio_manual.sql");

if (!existsSync(sqlPath)) {
  console.error("Ficheiro SQL não encontrado:", sqlPath);
  process.exit(1);
}

let databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl && existsSync(envPath)) {
  const raw = readFileSync(envPath, "utf8");
  const m = raw.match(/^\s*DATABASE_URL\s*=\s*(.+)$/m);
  if (m) databaseUrl = m[1].trim().replace(/^["']|["']$/g, "");
}

const psql = spawnSync("psql", ["--version"], { encoding: "utf8" });
if (psql.status === 0 && databaseUrl) {
  const r = spawnSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-f", sqlPath], {
    stdio: "inherit",
    cwd: root,
    env: { ...process.env, PGSSLMODE: process.env.PGSSLMODE || "require" },
  });
  if (r.status === 0) {
    console.log("\nOK: SQL aplicado via psql.");
    process.exit(0);
  }
  console.error("\npsql terminou com erro. Verifique DATABASE_URL (use a connection string do Supabase com SSL).");
  process.exit(r.status || 1);
}

console.log(`
Não foi possível executar automaticamente (precisa de psql no PATH + DATABASE_URL).

Faça UM dos seguintes:

A) Supabase (recomendado)
   1. Dashboard → SQL → New query
   2. Abra o ficheiro: ${sqlPath}
   3. Cole todo o conteúdo e execute (Run)

B) Linha de comandos (com psql instalado)
   Defina DATABASE_URL (connection string Postgres do projeto) e execute:

   psql "%DATABASE_URL%" -v ON_ERROR_STOP=1 -f supabase/financeiro_dual_patio_manual.sql

   No PowerShell:
   $env:DATABASE_URL="postgresql://..."
   psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f supabase/financeiro_dual_patio_manual.sql
`);
process.exit(databaseUrl ? 1 : 1);

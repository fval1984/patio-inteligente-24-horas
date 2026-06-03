/**
 * Permite receita manual sem veículo (vehicle_id NULL em receivables).
 * Uso: npm run db:receivables-vehicle-nullable
 * Requer SUPABASE_DB_URL em .env.local (Supabase → Project Settings → Database → Connection string).
 */
const fs = require("fs");
const path = require("path");

const SQL = `
ALTER TABLE public.receivables
  ALTER COLUMN vehicle_id DROP NOT NULL;
`;

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
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (process.env[k] === undefined) process.env[k] = v;
    }
  }
}

async function main() {
  loadEnvLocal();
  const url = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error("Defina SUPABASE_DB_URL em .env.local ou execute no SQL Editor do Supabase:\n");
    console.error(SQL.trim());
    process.exit(1);
  }
  let pg;
  try {
    pg = require("pg");
  } catch {
    console.error("Instale pg: npm install pg --save-dev");
    process.exit(1);
  }
  const isLocal = /localhost|127\.0\.0\.1/.test(url) && !/supabase\.co/.test(url);
  const client = new pg.Client({
    connectionString: url,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });
  try {
    await client.connect();
    await client.query(SQL);
    const check = await client.query(`
      SELECT is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'receivables'
        AND column_name = 'vehicle_id'
    `);
    const ok = check.rows[0]?.is_nullable === "YES";
    console.log(ok ? "OK: vehicle_id agora aceita NULL (receita manual liberada)." : "Executado; confira a coluna no Supabase.");
    await client.end();
  } catch (e) {
    console.error(e.message || e);
    console.error("\nCole no SQL Editor do Supabase:\n");
    console.error(SQL.trim());
    process.exit(1);
  }
}

main();

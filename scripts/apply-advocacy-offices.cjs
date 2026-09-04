/**
 * Cria advocacy_offices, coluna vehicles.advocacy_office_id e histórico.
 * Uso: npm run db:apply-advocacy-offices
 * Requer SUPABASE_DB_URL em .env.local
 */
const fs = require("fs");
const path = require("path");

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

async function main() {
  loadEnvLocal();
  const url = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error("Defina SUPABASE_DB_URL em .env.local ou execute supabase/advocacy_offices.sql no SQL Editor.");
    process.exit(1);
  }
  const sqlPath = path.join(__dirname, "..", "supabase", "advocacy_offices.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");
  let Client;
  try {
    ({ Client } = require("pg"));
  } catch {
    console.error("Instale pg: npm install pg");
    process.exit(1);
  }
  const isLocal = /localhost|127\.0\.0\.1/.test(url) && !/supabase\.co/.test(url);
  const client = new Client({ connectionString: url, ssl: isLocal ? false : { rejectUnauthorized: false } });
  await client.connect();
  await client.query(sql);
  const mgrPath = path.join(__dirname, "..", "supabase", "advocacy_office_managers.sql");
  if (fs.existsSync(mgrPath)) await client.query(fs.readFileSync(mgrPath, "utf8"));
  const check = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vehicles'
      AND column_name = 'advocacy_office_id'
  `);
  await client.end();
  if (!check.rows.length) {
    console.error("SQL correu, mas vehicles.advocacy_office_id ainda não existe.");
    process.exit(1);
  }
  console.log("OK — advocacy_offices + vehicles.advocacy_office_id aplicados.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});

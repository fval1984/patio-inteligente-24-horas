/**
 * Aplica token público e consulta de histórico (QR Code).
 * Uso: npm run db:apply-vehicles-public-qr
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
    console.error("Defina SUPABASE_DB_URL em .env.local ou execute supabase/vehicles_public_qr.sql no SQL Editor.");
    process.exit(1);
  }
  const sqlPath = path.join(__dirname, "..", "supabase", "vehicles_public_qr.sql");
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
  const check = await client.query(`
    SELECT
      (SELECT COUNT(*)::int FROM vehicles WHERE public_token IS NULL OR btrim(public_token) = '') AS sem_token,
      (SELECT COUNT(*)::int FROM vehicles) AS total
  `);
  await client.end();
  const row = check.rows[0] || {};
  if (Number(row.sem_token) > 0) {
    console.error("Ainda há veículos sem public_token:", row.sem_token);
    process.exit(1);
  }
  console.log("OK — QR público aplicado. Veículos com token:", row.total);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});

/**
 * Aplica supabase/vehicle_entry_inspections.sql
 * Uso: npm run db:apply-vehicle-entry-inspections
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
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

async function main() {
  loadEnvLocal();
  const url = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "";
  if (!url) {
    console.error("Defina SUPABASE_DB_URL (ou DATABASE_URL) em .env.local");
    process.exit(1);
  }
  const sqlPath = path.join(__dirname, "..", "supabase", "vehicle_entry_inspections.sql");
  let sql = fs.readFileSync(sqlPath, "utf8");
  if (!/NOTIFY pgrst, 'reload schema'/i.test(sql)) {
    sql += "\n\nNOTIFY pgrst, 'reload schema';\n";
  }
  const { Client } = require("pg");
  const isLocal = /localhost|127\.0\.0\.1/.test(url);
  const client = new Client({
    connectionString: url,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query(sql);
    const { rows } = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name LIKE 'vehicle_entry_inspection%'
      ORDER BY table_name
    `);
    const counts = await client.query(`
      SELECT
        (SELECT COUNT(*)::int FROM vehicles) AS vehicles,
        (SELECT COUNT(*)::int FROM vehicle_entry_inspections) AS inspections
    `);
    console.log("OK — vehicle_entry_inspections aplicado.");
    console.log("Tabelas:", rows.map((r) => r.table_name).join(", "));
    console.log("Contagens (veículos / vistorias):", counts.rows[0]);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

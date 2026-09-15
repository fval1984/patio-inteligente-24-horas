/**
 * Aplica colunas de parceiros e veículo (financeira, CR, RPP, escritório).
 * Uso: npm run db:apply-parceiros-veiculo-colunas
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
    console.error(
      "Defina SUPABASE_DB_URL em .env.local ou execute supabase/parceiros_e_veiculo_colunas.sql no SQL Editor."
    );
    process.exit(1);
  }
  const sqlPath = path.join(__dirname, "..", "supabase", "parceiros_e_veiculo_colunas.sql");
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
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vehicles'
      AND column_name IN ('financeira_id', 'patio_parceiro_id', 'responsavel_financeiro_id', 'advocacy_office_id')
    ORDER BY column_name
  `);
  await client.end();
  if (check.rows.length < 4) {
    console.error("SQL correu, mas ainda faltam colunas em vehicles. Encontradas:", check.rows.map((r) => r.column_name).join(", "));
    process.exit(1);
  }
  console.log("OK — colunas de parceiros e veículo aplicadas.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});

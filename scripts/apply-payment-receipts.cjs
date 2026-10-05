/**
 * Cria as tabelas do recibo de pagamento (Entradas).
 * Uso: node scripts/apply-payment-receipts.cjs
 * Requer SUPABASE_DB_URL em .env.local
 * Não altera receivables, vehicles, caixa nem parceiros.
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
    console.error("Defina SUPABASE_DB_URL em .env.local ou execute supabase/payment_receipts.sql no SQL Editor.");
    process.exit(1);
  }
  const sqlPath = path.join(__dirname, "..", "supabase", "payment_receipts.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");
  const { Client } = require("pg");
  const isLocal = /localhost|127\.0\.0\.1/.test(url) && !/supabase\.co/.test(url);
  const client = new Client({ connectionString: url, ssl: isLocal ? false : { rejectUnauthorized: false } });
  await client.connect();
  await client.query(sql);
  const check = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('payment_receipts', 'payment_receipt_revisions', 'payment_receipt_counters')
    ORDER BY table_name
  `);
  await client.end();
  if (check.rows.length < 3) {
    console.error("SQL correu, mas as tabelas do recibo ainda não existem.");
    process.exit(1);
  }
  console.log("OK — recibo de pagamento aplicado (somente documento; financeiro intacto).");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});

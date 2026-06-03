/**
 * Diagnóstico: payables PAGO vs cash_movements PAGAR/SAIDA
 * node scripts/diagnose-caixa-pagar.cjs
 */
const fs = require("fs");
const path = require("path");

function loadEnvLocal() {
  const p = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(p)) return;
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

function isSaida(t) {
  const u = String(t || "").toUpperCase();
  return u === "PAGAR" || u === "SAIDA" || u === "SAÍDA";
}

async function main() {
  loadEnvLocal();
  const { createClient } = require("@supabase/supabase-js");
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Falta SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY em .env.local");
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: payables, error: pErr } = await supabase.from("payables").select("id,user_id,status,valor,descricao,fornecedor,data_vencimento,updated_at").limit(500);
  if (pErr) {
    console.error("payables:", pErr.message);
    process.exit(1);
  }

  const { data: cash, error: cErr } = await supabase.from("cash_movements").select("id,user_id,tipo_conta,conta_id,valor,descricao,data_movimento").limit(2000);
  if (cErr) {
    console.error("cash_movements:", cErr.message);
    process.exit(1);
  }

  const paid = (payables || []).filter((p) => String(p.status || "").toUpperCase() === "PAGO");
  const saidas = (cash || []).filter((m) => isSaida(m.tipo_conta));
  const saidasComConta = saidas.filter((m) => m.conta_id);

  console.log("Payables total:", payables?.length ?? 0);
  console.log("Payables PAGO:", paid.length);
  console.log("Cash total:", cash?.length ?? 0);
  console.log("Cash saídas (PAGAR/SAIDA):", saidas.length);
  console.log("Cash saídas com conta_id:", saidasComConta.length);

  const cashByConta = new Set(saidasComConta.map((m) => String(m.conta_id)));
  const semCaixa = paid.filter((p) => !cashByConta.has(String(p.id)));
  console.log("PAGO sem saída no caixa:", semCaixa.length);
  if (semCaixa.length) {
    console.log("\nPrimeiras 10 sem caixa:");
    semCaixa.slice(0, 10).forEach((p) => {
      console.log(`  ${p.id} | R$ ${p.valor} | ${p.descricao || p.fornecedor || "—"} | user ${p.user_id}`);
    });
  }

  const statusCounts = {};
  for (const p of payables || []) {
    const s = String(p.status || "(null)");
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  }
  console.log("\nStatus payables:", statusCounts);

  const tipoCounts = {};
  for (const m of cash || []) {
    const t = String(m.tipo_conta || "(null)");
    tipoCounts[t] = (tipoCounts[t] || 0) + 1;
  }
  console.log("Tipos cash_movements:", tipoCounts);
}

main().catch((e) => {
  console.error(e.message || e);
  if (e.cause) console.error(e.cause.message || e.cause);
  process.exit(1);
});

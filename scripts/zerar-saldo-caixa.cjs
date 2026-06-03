/**
 * Zera o saldo do caixa (entradas − saídas) para cada user_id em cash_movements.
 * Uso: node scripts/zerar-saldo-caixa.cjs
 *
 * .env.local: SUPABASE_DB_URL (pg) ou SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 */
const fs = require("fs");
const path = require("path");

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

const SQL_PG = `
WITH saldos AS (
  SELECT
    user_id,
    COALESCE(SUM(CASE WHEN UPPER(tipo_conta) IN ('RECEBER', 'ENTRADA') THEN valor ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN UPPER(tipo_conta) IN ('PAGAR', 'SAIDA', 'SAÍDA') THEN valor ELSE 0 END), 0) AS saldo
  FROM public.cash_movements
  GROUP BY user_id
),
ins AS (
  INSERT INTO public.cash_movements (user_id, tipo_conta, conta_id, valor, descricao, data_movimento, forma_pagamento)
  SELECT
    user_id,
    CASE WHEN saldo > 0 THEN 'SAIDA' ELSE 'ENTRADA' END,
    NULL,
    ROUND(ABS(saldo)::numeric, 2),
    'Ajuste — zerar saldo do caixa',
    CURRENT_DATE,
    'AJUSTE'
  FROM saldos
  WHERE ABS(saldo) > 0.005
  RETURNING user_id, tipo_conta, valor
)
SELECT (SELECT COUNT(*)::int FROM ins) AS ajustes;
`;

function isEntrada(tipo) {
  const t = String(tipo || "").toUpperCase();
  return t === "RECEBER" || t === "ENTRADA";
}

function isSaida(tipo) {
  const t = String(tipo || "").toUpperCase();
  return t === "PAGAR" || t === "SAIDA" || t === "SAÍDA";
}

function saldoFromRows(rows) {
  const byUser = new Map();
  for (const m of rows) {
    const uid = m.user_id;
    if (!uid) continue;
    let s = byUser.get(uid) || 0;
    const v = Number(m.valor || 0);
    if (isEntrada(m.tipo_conta)) s += v;
    else if (isSaida(m.tipo_conta)) s -= v;
    byUser.set(uid, s);
  }
  return byUser;
}

function printSaldos(label, byUser) {
  console.log(label);
  if (!byUser.size) {
    console.log("  (sem movimentações)");
    return;
  }
  for (const [uid, saldo] of byUser) {
    console.log(`  ${uid}: R$ ${saldo.toFixed(2)}`);
  }
}

async function runWithPg(url) {
  const { Client } = require("pg");
  const isLocal = /localhost|127\.0\.0\.1/.test(url) && !/supabase\.co/.test(url);
  const client = new Client({
    connectionString: url,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  const before = await client.query(`
    SELECT user_id, tipo_conta, valor FROM public.cash_movements
  `);
  printSaldos("Saldo antes:", saldoFromRows(before.rows));
  const res = await client.query(SQL_PG);
  console.log(`Ajustes inseridos: ${res.rows[0]?.ajustes ?? 0}`);
  const after = await client.query(`SELECT user_id, tipo_conta, valor FROM public.cash_movements`);
  printSaldos("Saldo depois:", saldoFromRows(after.rows));
  await client.end();
}

async function runWithSupabaseJs() {
  const { createClient } = require("@supabase/supabase-js");
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local");
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data: movs, error } = await supabase
    .from("cash_movements")
    .select("user_id,tipo_conta,valor");
  if (error) throw error;
  const antes = saldoFromRows(movs || []);
  printSaldos("Saldo antes:", antes);

  const hoje = new Date().toISOString().slice(0, 10);
  let inseridos = 0;
  for (const [userId, saldo] of antes) {
    if (Math.abs(saldo) < 0.005) continue;
    const valor = Math.round(Math.abs(saldo) * 100) / 100;
    const row = {
      user_id: userId,
      tipo_conta: saldo > 0 ? "SAIDA" : "ENTRADA",
      conta_id: null,
      valor,
      descricao: "Ajuste — zerar saldo do caixa",
      data_movimento: hoje,
      forma_pagamento: "AJUSTE",
    };
    let ins = await supabase.from("cash_movements").insert(row);
    if (ins.error && /column|schema cache/i.test(ins.error.message || "")) {
      const fb = { ...row };
      delete fb.forma_pagamento;
      ins = await supabase.from("cash_movements").insert(fb);
    }
    if (ins.error) throw ins.error;
    inseridos += 1;
  }
  console.log(`Ajustes inseridos: ${inseridos}`);

  const { data: movs2, error: err2 } = await supabase
    .from("cash_movements")
    .select("user_id,tipo_conta,valor");
  if (err2) throw err2;
  printSaldos("Saldo depois:", saldoFromRows(movs2 || []));
}

async function main() {
  loadEnvLocal();
  const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  try {
    if (dbUrl) {
      await runWithPg(dbUrl);
      return;
    }
    await runWithSupabaseJs();
  } catch (e) {
    console.error(e.message || e);
    if (e.cause) console.error("Causa:", e.cause.message || e.cause);
    process.exit(1);
  }
}

main();

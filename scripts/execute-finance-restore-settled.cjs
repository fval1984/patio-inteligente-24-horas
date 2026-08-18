/**
 * Prévia (padrão) ou execução da restauração de baixas.
 * node scripts/execute-finance-restore-settled.cjs
 * APPLY=1 node scripts/execute-finance-restore-settled.cjs
 *
 * .env.local: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
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

async function loadTable(supabase, table, selects, userId) {
  for (const sel of selects) {
    const res = await supabase.from(table).select(sel).eq("user_id", userId);
    if (!res.error) return res.data || [];
    if (!/column|schema cache|PGRST204|does not exist/i.test(res.error.message || "")) throw new Error(res.error.message);
  }
  return [];
}

async function snapshotForUser(supabase, userId) {
  const [receivables, payables, cash, vehicles, partners] = await Promise.all([
    loadTable(supabase, "receivables", ["id,user_id,vehicle_id,valor,status,observacoes,responsavel_pagamento,period_end,financeiro_aprovado_contas_receber,updated_at,created_at", "id,vehicle_id,valor,status,period_end,updated_at"], userId),
    loadTable(supabase, "payables", ["id,user_id,valor,status,observacoes,descricao,fornecedor,data_pagamento,updated_at,created_at", "id,valor,status,descricao,updated_at"], userId),
    loadTable(supabase, "cash_movements", ["id,tipo_conta,conta_id,valor,data_movimento,forma_pagamento,created_at"], userId),
    loadTable(supabase, "vehicles", ["id,placa,localizador_id,data_saida"], userId),
    loadTable(supabase, "partners", ["id,nome"], userId),
  ]);
  return { receivables, payables, cash, vehicles, partners };
}

async function main() {
  loadEnvLocal();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Falta SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY — prévia local impossível. A restauração sobe na API de produção e também corre no navegador ao abrir o Financeiro.");
    process.exit(2);
  }
  const { createClient } = require("@supabase/supabase-js");
  const { planFinanceRestoreSettled, RESTORE_SETTLED_CONFIRM } = require(
    path.join(__dirname, "..", "public", "finance-restore-settled-plan.js")
  );
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const ids = new Set();
  for (const table of ["settings", "cash_movements", "receivables"]) {
    const { data } = await supabase.from(table).select("user_id").limit(5000);
    for (const row of data || []) if (row?.user_id) ids.add(String(row.user_id));
  }
  const apply = process.env.APPLY === "1";
  const all = [];
  for (const userId of ids) {
    const snap = await snapshotForUser(supabase, userId);
    const plan = planFinanceRestoreSettled(snap);
    all.push({ userId, ...plan });
    console.log("\nuser", userId);
    console.log("  restaurar receber", plan.counts.recebimentosRestaurar, "pagar", plan.counts.pagamentosRestaurar, "duplicatas", plan.counts.duplicatasOcultar, "inalterados", plan.counts.inalterados);
    for (const row of plan.auditRows) {
      console.log(`  - ${row.kind} ${row.id} ${row.placa || row.financeira || ""} ${row.statusAtual} -> ${row.statusCorreto} ${row.dataBaixa || ""} | ${row.motivo}`);
    }
    if (apply) {
      for (const row of plan.restoreReceivables) {
        await supabase.from("receivables").update({ status: "PAGO", financeiro_aprovado_contas_receber: true }).eq("id", row.id).eq("user_id", userId).neq("status", "PAGO");
      }
      for (const row of plan.hideDuplicates) {
        await supabase.from("receivables").update({ financeiro_aprovado_contas_receber: false }).eq("id", row.id).eq("user_id", userId).neq("status", "PAGO");
      }
      for (const row of plan.restorePayables) {
        const res = await supabase.from("payables").update({ status: "PAGO", data_pagamento: row.dataBaixa || undefined }).eq("id", row.id).eq("user_id", userId).neq("status", "PAGO");
        if (res.error) await supabase.from("payables").update({ status: "PAGO" }).eq("id", row.id).eq("user_id", userId).neq("status", "PAGO");
      }
      console.log("  aplicado. confirm=", RESTORE_SETTLED_CONFIRM);
    }
  }
  const out = path.join("/opt/cursor/artifacts", "finance_restore_settled_preview.json");
  try {
    fs.mkdirSync("/opt/cursor/artifacts", { recursive: true });
    fs.writeFileSync(out, JSON.stringify({ dryRun: !apply, generatedAt: new Date().toISOString(), results: all }, null, 2));
    console.log("\nPrévia gravada em", out);
  } catch {
    /* ignore */
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

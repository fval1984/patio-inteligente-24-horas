/**
 * Sincroniza despesas PAGO → saídas em cash_movements (service role).
 * node scripts/sync-caixa-pagar.cjs
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

function toYmd(v) {
  if (!v) return new Date().toISOString().slice(0, 10);
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s.includes("T") ? s : `${s}T12:00:00`);
  return Number.isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
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
    console.error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local");
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: payables, error: pErr } = await supabase
    .from("payables")
    .select("id,user_id,valor,status,descricao,fornecedor,data_vencimento,updated_at,created_at")
    .limit(2000);
  if (pErr) {
    console.error("payables:", pErr.message);
    process.exit(1);
  }

  const paid = (payables || []).filter((p) => String(p.status || "").toUpperCase() === "PAGO" && Number(p.valor || 0) > 0);
  console.log("Despesas PAGO:", paid.length);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const p of paid) {
    const uid = p.user_id;
    const { data: movs } = await supabase
      .from("cash_movements")
      .select("id,tipo_conta")
      .eq("user_id", uid)
      .eq("conta_id", p.id);
    if ((movs || []).some((m) => isSaida(m.tipo_conta))) {
      skipped += 1;
      continue;
    }
    const dataYmd = toYmd(p.data_vencimento || p.updated_at);
    const bodies = [
      {
        user_id: uid,
        tipo_conta: "PAGAR",
        conta_id: p.id,
        valor: Number(p.valor),
        descricao: p.descricao || p.fornecedor || "Despesa",
        data_movimento: dataYmd,
        forma_pagamento: "PIX",
      },
      {
        user_id: uid,
        tipo_conta: "SAIDA",
        conta_id: p.id,
        valor: Number(p.valor),
        descricao: p.descricao || p.fornecedor || "Despesa",
        data_movimento: dataYmd,
      },
      { user_id: uid, tipo_conta: "PAGAR", conta_id: p.id, valor: Number(p.valor) },
    ];
    let ok = false;
    for (const body of bodies) {
      const ins = await supabase.from("cash_movements").insert(body);
      if (!ins.error) {
        ok = true;
        break;
      }
      if (!/column|schema cache|PGRST204/i.test(ins.error.message || "")) {
        console.warn("  falha", p.id, ins.error.message);
        break;
      }
      const lean = { ...body };
      delete lean.forma_pagamento;
      delete lean.data_movimento;
      delete lean.descricao;
      const ins2 = await supabase.from("cash_movements").insert(lean);
      if (!ins2.error) {
        ok = true;
        break;
      }
    }
    if (ok) {
      created += 1;
      console.log("  + caixa:", p.descricao || p.fornecedor, "R$", p.valor);
    } else failed += 1;
  }

  console.log(`\nCriadas: ${created} | Já tinham caixa: ${skipped} | Falhas: ${failed}`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});

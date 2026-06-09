/**
 * Reset do caixa: backup → apaga tudo → recria só recebíveis PAGO do mês atual.
 * Uso: npm run db:caixa-reset
 * .env.local: SUPABASE_DB_URL ou SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 * Opcional: CAIXA_RESET_USER_ID=uuid
 */
const fs = require("fs");
const path = require("path");

const FINANCE_META_PREFIX = "[[finmeta:";
const CONFIRM = "EXECUTE_CAIXA_RESET";

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

function currentYearMonthLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function toYmd(value) {
  if (!value) return "";
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s.includes("T") ? s : `${s.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function yearMonthFromYmd(ymd) {
  return ymd && ymd.length >= 7 ? ymd.slice(0, 7) : "";
}

function metaFromText(raw) {
  const s = String(raw || "");
  if (!s.startsWith(FINANCE_META_PREFIX)) return {};
  const end = s.indexOf("]]");
  if (end < 0) return {};
  try {
    return JSON.parse(s.slice(FINANCE_META_PREFIX.length, end));
  } catch {
    return {};
  }
}

function paidDateFromReceivable(r) {
  const meta = metaFromText(r.observacoes || r.responsavel_pagamento || "");
  const d = meta.data_pagamento || meta.data_recebimento;
  if (d) return toYmd(String(d));
  return toYmd(r.period_end || r.period_start || r.updated_at || r.created_at);
}

function formaFromReceivable(r) {
  if (r.forma_pagamento) return r.forma_pagamento;
  const meta = metaFromText(r.observacoes || r.responsavel_pagamento || "");
  return meta.forma_pagamento || "PIX";
}

function saldoFromMovs(movs) {
  let ent = 0;
  let sai = 0;
  for (const m of movs || []) {
    const t = String(m.tipo_conta || "").toUpperCase();
    const v = Number(m.valor || 0);
    if (t === "RECEBER" || t === "ENTRADA") ent += v;
    else if (t === "PAGAR" || t === "SAIDA" || t === "SAÍDA") sai += v;
  }
  return { ent, sai, saldo: ent - sai };
}

async function ensureSchemaPg(client) {
  await client.query(`ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS caixa_reset_ym text`);
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.cash_movements_archive (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      backup_run_id text NOT NULL,
      user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      original_id uuid NOT NULL,
      payload jsonb NOT NULL,
      archived_at timestamptz NOT NULL DEFAULT now()
    )`);
}

async function discoverUserIdsPg(client) {
  const res = await client.query(`
    SELECT DISTINCT user_id::text AS user_id FROM (
      SELECT user_id FROM public.settings
      UNION SELECT user_id FROM public.cash_movements
      UNION SELECT user_id FROM public.receivables
    ) t WHERE user_id IS NOT NULL`);
  return res.rows.map((r) => r.user_id).filter(Boolean);
}

async function resetUserPg(client, userId, resetYm) {
  const backupRunId = `caixa_reset_${resetYm}_${Date.now()}`;
  const movs = await client.query(`SELECT * FROM public.cash_movements WHERE user_id = $1`, [userId]);
  for (const row of movs.rows) {
    await client.query(
      `INSERT INTO public.cash_movements_archive (backup_run_id, user_id, original_id, payload)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [backupRunId, userId, row.id, JSON.stringify(row)]
    );
  }
  await client.query(`DELETE FROM public.cash_movements WHERE user_id = $1`, [userId]);

  const recs = await client.query(
    `SELECT r.id, r.valor, r.status, r.period_end, r.period_start, r.observacoes, r.responsavel_pagamento, r.forma_pagamento, r.updated_at, r.created_at, v.placa
     FROM public.receivables r
     LEFT JOIN public.vehicles v ON v.id = r.vehicle_id
     WHERE r.user_id = $1 AND r.status = 'PAGO' AND COALESCE(r.valor, 0) > 0`,
    [userId]
  );

  let inserted = 0;
  for (const r of recs.rows) {
    const paidYmd = paidDateFromReceivable(r);
    if (yearMonthFromYmd(paidYmd) !== resetYm) continue;
    const desc = r.placa ? `Recebimento ${r.placa}` : "Recebimento";
    await client.query(
      `INSERT INTO public.cash_movements (user_id, tipo_conta, conta_id, valor, descricao, data_movimento, forma_pagamento)
       VALUES ($1, 'RECEBER', $2, $3, $4, $5, $6)`,
      [userId, r.id, Number(r.valor || 0), desc, paidYmd, formaFromReceivable(r)]
    );
    inserted += 1;
  }

  await client.query(`UPDATE public.settings SET caixa_reset_ym = $1 WHERE user_id = $2`, [resetYm, userId]);

  const after = await client.query(`SELECT tipo_conta, valor FROM public.cash_movements WHERE user_id = $1`, [userId]);
  const totals = saldoFromMovs(after.rows);
  return {
    userId,
    backupRunId,
    deleted: movs.rows.length,
    inserted,
    ...totals,
  };
}

async function discoverUserIdsRest(supabase) {
  const ids = new Set();
  for (const table of ["settings", "cash_movements", "receivables"]) {
    const { data } = await supabase.from(table).select("user_id").limit(5000);
    for (const row of data || []) {
      if (row?.user_id) ids.add(String(row.user_id));
    }
  }
  return [...ids];
}

async function resetUserRest(supabase, userId, resetYm) {
  const backupRunId = `caixa_reset_${resetYm}_${Date.now()}`;
  const { data: movs, error: mErr } = await supabase.from("cash_movements").select("*").eq("user_id", userId);
  if (mErr) throw mErr;

  if (movs?.length) {
    const archiveRows = movs.map((row) => ({
      backup_run_id: backupRunId,
      user_id: userId,
      original_id: row.id,
      payload: row,
    }));
    const { error: aErr } = await supabase.from("cash_movements_archive").insert(archiveRows);
    if (aErr && /relation|does not exist/i.test(aErr.message)) {
      throw new Error("Execute supabase/caixa_reset.sql (schema) no Supabase antes do reset.");
    }
    if (aErr) throw aErr;
  }

  const { error: dErr } = await supabase.from("cash_movements").delete().eq("user_id", userId);
  if (dErr) throw dErr;

  const { data: recs, error: rErr } = await supabase
    .from("receivables")
    .select(
      "id,valor,status,period_end,period_start,observacoes,responsavel_pagamento,forma_pagamento,updated_at,created_at,vehicle_id"
    )
    .eq("user_id", userId)
    .eq("status", "PAGO");
  if (rErr) throw rErr;

  const vehicleIds = [...new Set((recs || []).map((r) => r.vehicle_id).filter(Boolean))];
  const placaByVehicle = new Map();
  if (vehicleIds.length) {
    const { data: vehicles } = await supabase.from("vehicles").select("id,placa").in("id", vehicleIds);
    for (const v of vehicles || []) {
      if (v?.id) placaByVehicle.set(String(v.id), v.placa);
    }
  }

  let inserted = 0;
  for (const r of recs || []) {
    if (!(Number(r.valor || 0) > 0)) continue;
    const paidYmd = paidDateFromReceivable(r);
    if (yearMonthFromYmd(paidYmd) !== resetYm) continue;
    const placa = r.vehicle_id ? placaByVehicle.get(String(r.vehicle_id)) : null;
    const desc = placa ? `Recebimento ${placa}` : "Recebimento";
    const { error: iErr } = await supabase.from("cash_movements").insert({
      user_id: userId,
      tipo_conta: "RECEBER",
      conta_id: r.id,
      valor: Number(r.valor || 0),
      descricao: desc,
      data_movimento: paidYmd,
      forma_pagamento: formaFromReceivable(r),
    });
    if (!iErr) inserted += 1;
  }

  const { data: settings } = await supabase
    .from("settings")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (settings?.id) {
    await supabase.from("settings").update({ caixa_reset_ym: resetYm }).eq("id", settings.id);
  }

  const { data: after } = await supabase.from("cash_movements").select("tipo_conta,valor").eq("user_id", userId);
  const totals = saldoFromMovs(after || []);
  return { userId, backupRunId, deleted: movs?.length || 0, inserted, ...totals };
}

async function main() {
  loadEnvLocal();
  if (process.argv.includes("--help")) {
    console.log("npm run db:caixa-reset");
    console.log("Requer SUPABASE_DB_URL ou SUPABASE_URL+SUPABASE_SERVICE_ROLE_KEY em .env.local");
    return;
  }
  if (process.env.CAIXA_RESET_CONFIRM !== CONFIRM) {
    console.error(`Defina CAIXA_RESET_CONFIRM=${CONFIRM} para executar.`);
    process.exit(1);
  }

  const resetYm = process.env.CAIXA_RESET_YM || currentYearMonthLocal();
  const forcedUser = process.env.CAIXA_RESET_USER_ID || null;
  const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

  console.log(`Reset do caixa — mês marco: ${resetYm}`);

  if (dbUrl) {
    const { Client } = require("pg");
    const isLocal = /localhost|127\.0\.0\.1/.test(dbUrl) && !/supabase\.co/.test(dbUrl);
    const client = new Client({ connectionString: dbUrl, ssl: isLocal ? false : { rejectUnauthorized: false } });
    await client.connect();
    await ensureSchemaPg(client);
    const userIds = forcedUser ? [forcedUser] : await discoverUserIdsPg(client);
    if (!userIds.length) throw new Error("Nenhum user_id encontrado.");
    const results = [];
    for (const uid of userIds) {
      console.log(`\nProcessando ${uid}...`);
      results.push(await resetUserPg(client, uid, resetYm));
    }
    await client.end();
    console.log("\n=== RESULTADO ===");
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  const url = process.env.SUPABASE_URL || "https://mgnfuwlbvwarmjtiwsdh.supabase.co";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || key.includes("cole_aqui")) {
    throw new Error("Defina SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_DB_URL) em .env.local");
  }
  const { createClient } = require("@supabase/supabase-js");
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const userIds = forcedUser ? [forcedUser] : await discoverUserIdsRest(supabase);
  if (!userIds.length) throw new Error("Nenhum user_id encontrado.");
  const results = [];
  for (const uid of userIds) {
    console.log(`\nProcessando ${uid}...`);
    results.push(await resetUserRest(supabase, uid, resetYm));
  }
  console.log("\n=== RESULTADO ===");
  console.log(JSON.stringify(results, null, 2));
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});

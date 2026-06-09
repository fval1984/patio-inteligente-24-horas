/**
 * Diagnóstico read-only: VRP sem Aguardando Faturamento
 * Uso: node scripts/diagnose-vrp-aguardando.cjs [PLACA1 PLACA2 ...]
 * Requer SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY em .env.local
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

function normPlate(p) {
  return String(p || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

async function main() {
  loadEnvLocal();
  const plates = process.argv.slice(2).map(normPlate).filter(Boolean);
  const url = process.env.SUPABASE_URL || "https://mgnfuwlbvwarmjtiwsdh.supabase.co";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || key.includes("cole_aqui")) {
    console.error("Defina SUPABASE_SERVICE_ROLE_KEY em .env.local");
    process.exit(1);
  }
  const { createClient } = require("@supabase/supabase-js");
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const vehicleSelects = [
    "id,user_id,placa,status,data_entrada,data_saida,created_at,updated_at,responsavel_financeiro_nome,remocao_solicitada,remocao_solicitada_em",
    "id,user_id,placa,status,data_entrada,data_saida,created_at,updated_at",
  ];
  let vehicles = [];
  for (const sel of vehicleSelects) {
    let q = supabase.from("vehicles").select(sel).order("data_saida", { ascending: false, nullsFirst: false });
    if (plates.length) {
      const { data: all } = await supabase.from("vehicles").select(sel);
      vehicles = (all || []).filter((v) => plates.includes(normPlate(v.placa)));
      break;
    } else {
      const res = await q.eq("status", "REMOVIDO").limit(200);
      if (!res.error) {
        vehicles = res.data || [];
        break;
      }
      if (!/column|schema cache|does not exist/i.test(res.error.message || "")) throw res.error;
    }
  }

  if (plates.length && !vehicles.length) {
    const { data: all } = await supabase.from("vehicles").select("id,user_id,placa,status,data_saida");
    vehicles = (all || []).filter((v) => plates.some((p) => normPlate(v.placa).includes(p) || p.includes(normPlate(v.placa))));
  }

  const recSelects = [
    "id,user_id,vehicle_id,valor,status,period_start,period_end,responsavel_pagamento,updated_at,created_at,patio_liberado_financeiro,financeiro_aprovado_contas_receber",
    "id,user_id,vehicle_id,valor,status,period_start,period_end,responsavel_pagamento,updated_at,created_at",
    "id,user_id,vehicle_id,valor,status,period_start,period_end,updated_at,created_at",
  ];

  async function loadReceivables(vehicleId) {
    for (const sel of recSelects) {
      const res = await supabase.from("receivables").select(sel).eq("vehicle_id", vehicleId).order("created_at", { ascending: false });
      if (!res.error) return res.data || [];
      if (!/column|schema cache|does not exist/i.test(res.error.message || "")) throw res.error;
    }
    return [];
  }

  async function loadEvents(vehicleId) {
    const res = await supabase
      .from("vehicle_events")
      .select("id,tipo,responsavel,descricao,created_at")
      .eq("vehicle_id", vehicleId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (res.error && /relation|does not exist/i.test(res.error.message || "")) return [];
    if (res.error) throw res.error;
    return res.data || [];
  }

  async function loadClosures(vehicleId) {
    const res = await supabase
      .from("patio_cycle_closures")
      .select("id,receivable_id,period_start,period_end,valor,triagem_ok,sent_to_finance,created_at")
      .eq("vehicle_id", vehicleId)
      .order("created_at", { ascending: false })
      .limit(5);
    if (res.error && /relation|does not exist/i.test(res.error.message || "")) return [];
    if (res.error) throw res.error;
    return res.data || [];
  }

  function classifyReceivable(r, vehicle) {
    if (!r) return "SEM_RECEIVABLE";
    if (r.status === "PAGO" && Number(r.valor || 0) === 0) return "ENCERRADO_SEM_COBRANCA";
    if (r.financeiro_aprovado_contas_receber === true && r.status === "EM_ABERTO") return "CONTAS_A_RECEBER";
    if (r.status === "AGUARDANDO_LANCAMENTO") return "AGUARDANDO_FATURAMENTO";
    if (r.status === "EM_ABERTO" && r.period_end && !r.financeiro_aprovado_contas_receber) return "AGUARDANDO_FATURAMENTO";
    if (r.status === "EM_ABERTO" && !r.period_end && vehicle?.status === "REMOVIDO") return "CICLO_ABERTO_POS_VRP";
    if (r.status === "EM_ABERTO" && r.period_end) return "EM_ABERTO_ENCERRADO_SEM_APROVACAO";
    return r.status || "DESCONHECIDO";
  }

  const report = { generatedAt: new Date().toISOString(), plates, vehicles: [], similarCases: [] };

  for (const v of vehicles) {
    const recs = await loadReceivables(v.id);
    const events = await loadEvents(v.id);
    const closures = await loadClosures(v.id);
    const removedEv = events.find((e) => e.tipo === "REMOVIDO");
    const latestRec = recs[0] || null;
    const closedRec = recs.find((r) => r.period_end) || latestRec;
    report.vehicles.push({
      placa: v.placa,
      vehicle_id: v.id,
      user_id: v.user_id,
      status_veiculo: v.status,
      data_saida: v.data_saida,
      data_entrada: v.data_entrada,
      remocao_solicitada: v.remocao_solicitada,
      evento_removido_em: removedEv?.created_at || null,
      evento_removido_por: removedEv?.responsavel || null,
      receivable_id: closedRec?.id || null,
      receivable_status: closedRec?.status || null,
      receivable_valor: closedRec?.valor,
      receivable_period_end: closedRec?.period_end,
      patio_liberado_financeiro: closedRec?.patio_liberado_financeiro,
      financeiro_aprovado_contas_receber: closedRec?.financeiro_aprovado_contas_receber,
      fila_classificada: classifyReceivable(closedRec, v),
      closures,
      eventos_recentes: events.slice(0, 8),
      total_receivables: recs.length,
    });
  }

  if (!plates.length || report.vehicles.length < 2) {
    const { data: removed } = await supabase
      .from("vehicles")
      .select("id,placa,status,data_saida,user_id")
      .eq("status", "REMOVIDO")
      .not("data_saida", "is", null)
      .order("data_saida", { ascending: false })
      .limit(100);
    for (const v of removed || []) {
      const recs = await loadReceivables(v.id);
      const closedRec = recs.find((r) => r.period_end) || recs[0];
      const fila = classifyReceivable(closedRec, v);
      if (fila !== "AGUARDANDO_FATURAMENTO" && fila !== "CONTAS_A_RECEBER" && fila !== "ENCERRADO_SEM_COBRANCA") {
        report.similarCases.push({
          placa: v.placa,
          data_saida: v.data_saida,
          status_veiculo: v.status,
          receivable_status: closedRec?.status,
          receivable_valor: closedRec?.valor,
          period_end: closedRec?.period_end,
          financeiro_aprovado: closedRec?.financeiro_aprovado_contas_receber,
          fila_classificada: fila,
        });
      }
      if (closedRec?.financeiro_aprovado_contas_receber === true && fila === "CONTAS_A_RECEBER") {
        report.similarCases.push({
          placa: v.placa,
          data_saida: v.data_saida,
          nota: "VRP enviou direto para Contas a Receber (não passou por Aguardando Faturamento)",
          fila_classificada: fila,
        });
      }
    }
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});

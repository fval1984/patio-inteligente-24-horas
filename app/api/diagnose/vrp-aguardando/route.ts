import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function normPlate(p: string) {
  return String(p || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function isSchemaError(message: string) {
  return /column|schema cache|PGRST204|relation|does not exist|PGRST205/i.test(message);
}

function classifyReceivable(
  r: {
    status?: string | null;
    valor?: number | null;
    period_end?: string | null;
    financeiro_aprovado_contas_receber?: boolean | null;
  } | null,
  vehicleStatus?: string | null
) {
  if (!r) return "SEM_RECEIVABLE";
  if (r.status === "PAGO" && Number(r.valor || 0) === 0) return "ENCERRADO_SEM_COBRANCA";
  if (r.financeiro_aprovado_contas_receber === true && r.status === "EM_ABERTO") return "CONTAS_A_RECEBER";
  if (r.status === "AGUARDANDO_LANCAMENTO") return "AGUARDANDO_FATURAMENTO";
  if (r.status === "EM_ABERTO" && r.period_end && !r.financeiro_aprovado_contas_receber) return "AGUARDANDO_FATURAMENTO";
  if (r.status === "EM_ABERTO" && !r.period_end && vehicleStatus === "REMOVIDO") return "CICLO_ABERTO_POS_VRP";
  if (r.status === "EM_ABERTO" && r.period_end) return "EM_ABERTO_ENCERRADO_SEM_APROVACAO";
  return r.status || "DESCONHECIDO";
}

async function selectVehicles(supabase: ReturnType<typeof getSupabaseAdmin>, plates: string[]) {
  const selects = [
    "id,user_id,placa,status,data_entrada,data_saida,created_at,updated_at,responsavel_financeiro_nome,remocao_solicitada,remocao_solicitada_em",
    "id,user_id,placa,status,data_entrada,data_saida,created_at,updated_at",
  ];
  for (const sel of selects) {
    const res = await supabase.from("vehicles").select(sel).order("data_saida", { ascending: false });
    if (res.error && isSchemaError(res.error.message || "")) continue;
    if (res.error) throw new Error(res.error.message);
    const rows = res.data || [];
    if (!plates.length) return rows.filter((v) => v.status === "REMOVIDO").slice(0, 120);
    const wanted = new Set(plates.map(normPlate));
    return rows.filter((v) => wanted.has(normPlate(String(v.placa || ""))));
  }
  throw new Error("Não foi possível consultar vehicles.");
}

async function selectReceivables(supabase: ReturnType<typeof getSupabaseAdmin>, vehicleId: string) {
  const selects = [
    "id,user_id,vehicle_id,valor,status,period_start,period_end,responsavel_pagamento,updated_at,created_at,patio_liberado_financeiro,financeiro_aprovado_contas_receber",
    "id,user_id,vehicle_id,valor,status,period_start,period_end,responsavel_pagamento,updated_at,created_at",
    "id,user_id,vehicle_id,valor,status,period_start,period_end,updated_at,created_at",
  ];
  for (const sel of selects) {
    const res = await supabase
      .from("receivables")
      .select(sel)
      .eq("vehicle_id", vehicleId)
      .order("created_at", { ascending: false });
    if (!res.error) return res.data || [];
    if (!isSchemaError(res.error.message || "")) throw new Error(res.error.message);
  }
  return [];
}

export async function GET(req: NextRequest) {
  try {
    const platesParam = req.nextUrl.searchParams.get("plates") || "";
    const days = Number(req.nextUrl.searchParams.get("days") || 30);
    const plates = platesParam
      .split(/[,;\s]+/)
      .map((p) => normPlate(p))
      .filter(Boolean);

    const supabase = getSupabaseAdmin();
    const vehicles = await selectVehicles(supabase, plates);

    const details = [];
    for (const v of vehicles) {
      const recs = await selectReceivables(supabase, String(v.id));
      const { data: events } = await supabase
        .from("vehicle_events")
        .select("id,tipo,responsavel,descricao,created_at")
        .eq("vehicle_id", v.id)
        .order("created_at", { ascending: false })
        .limit(20);
      const { data: closures, error: cErr } = await supabase
        .from("patio_cycle_closures")
        .select("id,receivable_id,period_start,period_end,valor,triagem_ok,sent_to_finance,created_at")
        .eq("vehicle_id", v.id)
        .order("created_at", { ascending: false })
        .limit(5);

      const removedEv = (events || []).find((e) => e.tipo === "REMOVIDO");
      const closedRec = recs.find((r) => r.period_end) || recs[0] || null;

      details.push({
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
        receivable_period_start: closedRec?.period_start,
        receivable_period_end: closedRec?.period_end,
        patio_liberado_financeiro: closedRec?.patio_liberado_financeiro,
        financeiro_aprovado_contas_receber: closedRec?.financeiro_aprovado_contas_receber,
        fila_classificada: classifyReceivable(closedRec, v.status),
        closures: cErr && isSchemaError(cErr.message || "") ? [] : closures || [],
        eventos_recentes: (events || []).slice(0, 8),
        total_receivables: recs.length,
      });
    }

    const since = new Date();
    since.setDate(since.getDate() - days);
    const similarCases: Array<Record<string, unknown>> = [];
    const { data: recentRemoved } = await supabase
      .from("vehicles")
      .select("id,placa,status,data_saida,user_id")
      .eq("status", "REMOVIDO")
      .gte("data_saida", since.toISOString())
      .order("data_saida", { ascending: false });

    for (const v of recentRemoved || []) {
      const recs = await selectReceivables(supabase, String(v.id));
      const closedRec = recs.find((r) => r.period_end) || recs[0] || null;
      const fila = classifyReceivable(closedRec, v.status);
      if (
        fila === "SEM_RECEIVABLE" ||
        fila === "CICLO_ABERTO_POS_VRP" ||
        fila === "EM_ABERTO_ENCERRADO_SEM_APROVACAO"
      ) {
        similarCases.push({
          placa: v.placa,
          data_saida: v.data_saida,
          status_veiculo: v.status,
          receivable_status: closedRec?.status,
          receivable_valor: closedRec?.valor,
          period_end: closedRec?.period_end,
          financeiro_aprovado: closedRec?.financeiro_aprovado_contas_receber,
          fila_classificada: fila,
        });
      } else if (fila === "CONTAS_A_RECEBER") {
        similarCases.push({
          placa: v.placa,
          data_saida: v.data_saida,
          nota: "Enviado direto para Contas a Receber (fluxo atual do app)",
          fila_classificada: fila,
          financeiro_aprovado: closedRec?.financeiro_aprovado_contas_receber,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      plates_requested: plates,
      vehicles_found: details.length,
      details,
      similar_cases_last_days: days,
      similar_cases: similarCases,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

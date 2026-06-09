import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function normPlate(p: string) {
  return String(p || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function isSchemaError(message: string) {
  return /column|schema cache|PGRST204|invalid input|enum|22P02|23514|observacoes|patio_liberado|financeiro_aprovado|relation|does not exist|PGRST205/i.test(
    message
  );
}

function calcBreakdown(
  vehicle: { data_entrada?: string | null; data_saida?: string | null; valor_diaria?: number | null },
  periodStart: string,
  periodEnd: string,
  taxaRemocao = 0
) {
  const valorDiaria = Number(vehicle.valor_diaria || 0);
  const start = new Date(periodStart || vehicle.data_entrada || "");
  const end = new Date(periodEnd || vehicle.data_saida || "");
  const dias =
    Number.isFinite(start.getTime()) && Number.isFinite(end.getTime())
      ? Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000))
      : 1;
  const diariasTotal = dias * valorDiaria;
  const total = Number((diariasTotal + taxaRemocao).toFixed(2));
  return { dias, valorDiaria, diariasTotal, taxaRemocao, total };
}

async function updateReceivableToAguardando(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  receivableId: string,
  patch: Record<string, unknown>
) {
  const attempts = [
    patch,
    { period_end: patch.period_end, period_start: patch.period_start, valor: patch.valor, status: patch.status, financeiro_aprovado_contas_receber: false, patio_liberado_financeiro: true },
    { period_end: patch.period_end, period_start: patch.period_start, valor: patch.valor, status: "AGUARDANDO_LANCAMENTO" },
    { period_end: patch.period_end, period_start: patch.period_start, valor: patch.valor, status: "EM_ABERTO" },
    { period_end: patch.period_end, valor: patch.valor, status: "EM_ABERTO" },
  ];
  let lastErr: string | null = null;
  for (const body of attempts) {
    const { error } = await supabase.from("receivables").update(body).eq("id", receivableId).eq("user_id", userId);
    if (!error) return { ok: true as const, applied: body };
    lastErr = error.message;
    if (!isSchemaError(lastErr || "")) break;
    if (/invalid input value for enum payment_status.*AGUARDANDO/i.test(lastErr || "")) continue;
  }
  return { ok: false as const, error: lastErr || "update_failed" };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const plates = (Array.isArray(body?.plates) ? body.plates : String(body?.plates || "").split(/[,;\s]+/))
      .map((p: string) => normPlate(p))
      .filter(Boolean);
    const onlyAfter = body?.onlyAfter ? String(body.onlyAfter).slice(0, 10) : null;
    const userId = String(body?.userId || "").trim();
    const taxaRemocao = Number(body?.taxaRemocao || 0);

    if (!plates.length) {
      return NextResponse.json({ error: "Informe plates: ['PCG0I26', 'PZO7C79']" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    let settingsTaxaRemocao = taxaRemocao;
    if (!settingsTaxaRemocao && userId) {
      const { data: settings } = await supabase.from("settings").select("taxa_remocao").eq("user_id", userId).limit(1).maybeSingle();
      settingsTaxaRemocao = Number(settings?.taxa_remocao || 0);
    }

    const { data: vehicles, error: vErr } = await supabase
      .from("vehicles")
      .select("id,user_id,placa,status,data_entrada,data_saida,valor_diaria,remocao_solicitada")
      .eq("status", "REMOVIDO");
    if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 });

    const wanted = new Set(plates);
    let matched = (vehicles || []).filter((v) => wanted.has(normPlate(String(v.placa || ""))));
    if (onlyAfter) {
      matched = matched.filter((v) => String(v.data_saida || "").slice(0, 10) >= onlyAfter);
    }
    if (userId) matched = matched.filter((v) => String(v.user_id) === userId);

    const results = [];
    for (const v of matched) {
      const uid = String(v.user_id);
      const { data: recs } = await supabase
        .from("receivables")
        .select("id,status,valor,period_start,period_end,created_at")
        .eq("vehicle_id", v.id)
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(3);

      const rec = (recs || []).find((r) => !r.period_end) || (recs || [])[0];
      if (!rec?.id) {
        results.push({ placa: v.placa, ok: false, error: "sem_receivable" });
        continue;
      }

      const periodEnd = v.data_saida || new Date().toISOString();
      const periodStart = rec.period_start || v.data_entrada || periodEnd;
      const breakdown = calcBreakdown(v, periodStart, periodEnd, v.remocao_solicitada ? settingsTaxaRemocao : 0);
      const valor = breakdown.total > 0 ? breakdown.total : Number(rec.valor || 0);

      const patch = {
        period_end: periodEnd,
        period_start: periodStart,
        valor,
        status: valor > 0 ? "AGUARDANDO_LANCAMENTO" : "PAGO",
        financeiro_aprovado_contas_receber: false,
        patio_liberado_financeiro: true,
        updated_at: new Date().toISOString(),
      };

      const upd = await updateReceivableToAguardando(supabase, uid, rec.id, patch);
      results.push({
        placa: v.placa,
        vehicle_id: v.id,
        receivable_id: rec.id,
        data_saida: v.data_saida,
        breakdown,
        valor_aplicado: valor,
        ...upd,
      });
    }

    return NextResponse.json({ ok: true, repaired: results.filter((r) => r.ok).length, results });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

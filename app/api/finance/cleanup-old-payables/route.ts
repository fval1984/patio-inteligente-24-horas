import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function currentYearMonthLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function payableDueYmd(p: {
  data_vencimento?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}) {
  const raw = p.data_vencimento || p.updated_at || p.created_at;
  if (!raw) return "";
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s.includes("T") ? s : `${s.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function yearMonthFromYmd(ymd: string) {
  return ymd && ymd.length >= 7 ? ymd.slice(0, 7) : "";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = String(body?.userId || "").trim();
    const keepFromYm = String(body?.keepFromYm || currentYearMonthLocal()).trim();

    if (!userId) {
      return NextResponse.json({ error: "userId é obrigatório." }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}$/.test(keepFromYm)) {
      return NextResponse.json({ error: "keepFromYm inválido (YYYY-MM)." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: payables, error: pErr } = await supabase
      .from("payables")
      .select("id,data_vencimento,created_at,updated_at")
      .eq("user_id", userId);
    if (pErr) {
      return NextResponse.json({ error: pErr.message }, { status: 500 });
    }

    const toDelete = (payables || []).filter((p) => {
      const ymd = payableDueYmd(p);
      const ym = yearMonthFromYmd(ymd);
      if (!ym) return false;
      return ym < keepFromYm;
    });

    let cashRemoved = 0;
    let payablesRemoved = 0;

    for (const p of toDelete) {
      const { data: movs } = await supabase
        .from("cash_movements")
        .select("id,tipo_conta")
        .eq("user_id", userId)
        .eq("conta_id", p.id);
      for (const mov of movs || []) {
        const t = String(mov?.tipo_conta || "").toUpperCase();
        if (t !== "PAGAR" && t !== "SAIDA" && t !== "SAÍDA") continue;
        const { error: delErr } = await supabase.from("cash_movements").delete().eq("id", mov.id).eq("user_id", userId);
        if (!delErr) cashRemoved += 1;
      }
      const { error: delPayErr } = await supabase.from("payables").delete().eq("id", p.id).eq("user_id", userId);
      if (!delPayErr) payablesRemoved += 1;
    }

    const { data: allCash, error: cashErr } = await supabase
      .from("cash_movements")
      .select("id,tipo_conta,data_movimento,conta_id")
      .eq("user_id", userId);
    if (!cashErr) {
      for (const mov of allCash || []) {
        const t = String(mov?.tipo_conta || "").toUpperCase();
        if (t !== "PAGAR" && t !== "SAIDA" && t !== "SAÍDA") continue;
        const raw = mov?.data_movimento ? String(mov.data_movimento) : "";
        const ymd = /^\d{4}-\d{2}-\d{2}$/.test(raw)
          ? raw
          : raw
            ? new Date(raw.includes("T") ? raw : `${raw.slice(0, 10)}T12:00:00`).toISOString().slice(0, 10)
            : "";
        const ym = yearMonthFromYmd(ymd);
        if (!ym || ym >= keepFromYm) continue;
        const { error: delErr } = await supabase.from("cash_movements").delete().eq("id", mov.id).eq("user_id", userId);
        if (!delErr) cashRemoved += 1;
      }
    }

    return NextResponse.json({
      ok: true,
      keepFromYm,
      stats: {
        payablesRemoved,
        cashRemoved,
        candidates: toDelete.length,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const FINANCE_META_PREFIX = "[[finmeta:";

type PayableRow = {
  id: string;
  descricao?: string | null;
  observacoes?: string | null;
  created_at?: string | null;
};

function toYmd(value: string | null | undefined) {
  if (!value) return "";
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s.includes("T") ? s : `${s.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function metaFromPayableText(raw: string | null | undefined) {
  const s = String(raw || "");
  if (!s.startsWith(FINANCE_META_PREFIX)) return {} as Record<string, unknown>;
  const end = s.indexOf("]]");
  if (end < 0) return {};
  try {
    return JSON.parse(s.slice(FINANCE_META_PREFIX.length, end)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function payableMeta(p: PayableRow) {
  return {
    ...metaFromPayableText(p.descricao),
    ...metaFromPayableText(p.observacoes),
  };
}

/** Mantém apenas contas cadastradas manualmente (cadastro_manual) a partir da data informada. */
function shouldKeepManualPayable(p: PayableRow, keepManualFromYmd: string) {
  const meta = payableMeta(p);
  if (meta.geracao_automatica === true) return false;
  if (meta.cadastro_manual !== true) return false;
  const created = toYmd(p.created_at);
  return !!created && created >= keepManualFromYmd;
}

function cashIsPayableSaida(tipo: string | null | undefined) {
  const t = String(tipo || "").toUpperCase();
  return t === "PAGAR" || t === "SAIDA" || t === "SAÍDA";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = String(body?.userId || "").trim();
    const keepManualFromYmd = toYmd(body?.keepManualFromYmd) || toYmd(new Date().toISOString());

    if (!userId) {
      return NextResponse.json({ error: "userId é obrigatório." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: payables, error: pErr } = await supabase
      .from("payables")
      .select(
        "id,descricao,observacoes,valor,data_vencimento,payable_category,categoria,tipo,created_at"
      )
      .eq("user_id", userId);
    if (pErr) {
      return NextResponse.json({ error: pErr.message }, { status: 500 });
    }

    const toDelete = (payables || []).filter((p) => !shouldKeepManualPayable(p as PayableRow, keepManualFromYmd));

    let cashRemoved = 0;
    let payablesRemoved = 0;

    for (const p of toDelete) {
      const { data: movs } = await supabase
        .from("cash_movements")
        .select("id,tipo_conta")
        .eq("user_id", userId)
        .eq("conta_id", p.id);
      for (const mov of movs || []) {
        if (!cashIsPayableSaida(mov?.tipo_conta)) continue;
        const { error: delErr } = await supabase.from("cash_movements").delete().eq("id", mov.id).eq("user_id", userId);
        if (!delErr) cashRemoved += 1;
      }
      const { error: delPayErr } = await supabase.from("payables").delete().eq("id", p.id).eq("user_id", userId);
      if (!delPayErr) payablesRemoved += 1;
    }

    return NextResponse.json({
      ok: true,
      keepManualFromYmd,
      stats: {
        payablesRemoved,
        cashRemoved,
        candidates: toDelete.length,
        kept: (payables || []).length - payablesRemoved,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

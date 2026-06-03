import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type PayableRow = {
  id: string;
  user_id: string;
  valor: number | null;
  status: string | null;
  descricao: string | null;
  fornecedor: string | null;
  data_vencimento: string | null;
  forma_pagamento: string | null;
  observacoes: string | null;
  updated_at: string | null;
  created_at: string | null;
};

function toYmd(value: string | null | undefined) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s.includes("T") ? s : `${s}T12:00:00`);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function isSchemaError(message: string) {
  return /column|schema cache|PGRST204|invalid input|enum|22P02|23514|forma_pagamento|descricao|data_movimento|relation|does not exist|PGRST205/i.test(
    message
  );
}

function isPaidStatus(status: string | null | undefined) {
  return String(status || "").toUpperCase() === "PAGO";
}

function cashIsSaida(tipo: string | null | undefined) {
  const t = String(tipo || "").toUpperCase();
  return t === "PAGAR" || t === "SAIDA" || t === "SAÍDA";
}

function metaFromObs(obs: string | null | undefined) {
  const raw = String(obs || "");
  const m = raw.match(/^\[\[finmeta:(\{.*?\})\]\]/);
  if (!m) return {} as { forma_pagamento?: string; data_pagamento?: string };
  try {
    return JSON.parse(m[1]) as { forma_pagamento?: string; data_pagamento?: string };
  } catch {
    return {};
  }
}

function formaFromPayable(p: PayableRow) {
  if (p.forma_pagamento) return p.forma_pagamento;
  return metaFromObs(p.observacoes).forma_pagamento || "PIX";
}

async function findExistingPayableMovement(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  payableId: string
) {
  const { data, error } = await supabase
    .from("cash_movements")
    .select("id,valor,data_movimento,forma_pagamento,tipo_conta,conta_id")
    .eq("user_id", userId)
    .eq("conta_id", payableId);
  if (error) throw new Error(error.message);
  return (data || []).find((m) => cashIsSaida(m.tipo_conta)) || null;
}

async function upsertCashForPayable(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  payable: PayableRow,
  opts: {
    valor?: number;
    dataMovimento?: string;
    formaPagamento?: string;
    descricao?: string;
  } = {}
) {
  const payableId = payable.id;
  const valor = Number(opts.valor ?? payable.valor ?? 0);
  if (!(valor > 0)) return { ok: true, action: "skipped" as const, reason: "valor_zero" };

  const dataYmd = toYmd(
    opts.dataMovimento || payable.data_vencimento || payable.updated_at || payable.created_at
  );
  const isoMov = new Date(`${dataYmd}T12:00:00`).toISOString();
  const formaPagamento = opts.formaPagamento || formaFromPayable(payable);
  const descricao =
    opts.descricao || payable.descricao || payable.fornecedor || "Despesa";

  const existing = await findExistingPayableMovement(supabase, userId, payableId);
  const payloads = [
    {
      user_id: userId,
      tipo_conta: "PAGAR",
      conta_id: payableId,
      valor,
      descricao,
      data_movimento: dataYmd,
      forma_pagamento: formaPagamento,
    },
    {
      user_id: userId,
      tipo_conta: "PAGAR",
      conta_id: payableId,
      valor,
      descricao,
      data_movimento: isoMov,
    },
    {
      user_id: userId,
      tipo_conta: "SAIDA",
      conta_id: payableId,
      valor,
      descricao,
      data_movimento: dataYmd,
    },
    { user_id: userId, tipo_conta: "PAGAR", conta_id: payableId, valor },
    { user_id: userId, tipo_conta: "SAIDA", conta_id: payableId, valor, data_movimento: dataYmd },
  ];

  let lastError: string | null = null;
  for (const body of payloads) {
    if (existing?.id) {
      const { error } = await supabase
        .from("cash_movements")
        .update(body)
        .eq("id", existing.id)
        .eq("user_id", userId);
      if (!error) return { ok: true, action: "updated" as const };
      lastError = error.message;
    } else {
      const { error } = await supabase.from("cash_movements").insert(body);
      if (!error) {
        const verified = await findExistingPayableMovement(supabase, userId, payableId);
        if (verified) return { ok: true, action: "created" as const };
        return { ok: true, action: "created" as const };
      }
      lastError = error.message;
    }
    if (!isSchemaError(lastError || "")) break;
  }

  return { ok: false, action: "failed" as const, error: lastError || "insert_failed" };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = String(body?.userId || "").trim();
    const syncMissing = body?.syncMissing === true;
    const payableId = body?.payableId ? String(body.payableId) : "";

    if (!userId) {
      return NextResponse.json({ error: "userId é obrigatório." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    if (syncMissing) {
      let payables: PayableRow[] | null = null;
      let pErr: { message: string } | null = null;
      const fullSelect = await supabase
        .from("payables")
        .select(
          "id,user_id,valor,status,descricao,fornecedor,data_vencimento,forma_pagamento,observacoes,updated_at,created_at"
        )
        .eq("user_id", userId);
      if (fullSelect.error && isSchemaError(fullSelect.error.message)) {
        const lean = await supabase
          .from("payables")
          .select("id,user_id,valor,status,descricao,data_vencimento,observacoes,updated_at,created_at")
          .eq("user_id", userId);
        payables = (lean.data || []) as PayableRow[];
        pErr = lean.error;
      } else {
        payables = (fullSelect.data || []) as PayableRow[];
        pErr = fullSelect.error;
      }
      if (pErr) {
        return NextResponse.json({ error: pErr.message }, { status: 500 });
      }

      const paid = ((payables || []) as PayableRow[]).filter(
        (p) => isPaidStatus(p.status) && Number(p.valor || 0) > 0
      );
      let created = 0;
      let updated = 0;
      let failed = 0;
      let skipped = 0;

      for (const p of paid) {
        const existing = await findExistingPayableMovement(supabase, userId, p.id);
        if (existing) {
          skipped += 1;
          continue;
        }
        const result = await upsertCashForPayable(supabase, userId, p);
        if (result.ok && result.action === "created") created += 1;
        else if (result.ok && result.action === "updated") updated += 1;
        else if (result.ok && result.action === "skipped") skipped += 1;
        else failed += 1;
      }

      return NextResponse.json({
        ok: true,
        syncMissing: true,
        stats: { created, updated, failed, skipped, total: paid.length },
      });
    }

    if (!payableId) {
      return NextResponse.json({ error: "payableId é obrigatório (ou syncMissing: true)." }, { status: 400 });
    }

    let payable: PayableRow | null = null;
    let oneErr: { message: string } | null = null;
    const oneFull = await supabase
      .from("payables")
      .select(
        "id,user_id,valor,status,descricao,fornecedor,data_vencimento,forma_pagamento,observacoes,updated_at,created_at"
      )
      .eq("user_id", userId)
      .eq("id", payableId)
      .maybeSingle();
    if (oneFull.error && isSchemaError(oneFull.error.message)) {
      const oneLean = await supabase
        .from("payables")
        .select("id,user_id,valor,status,descricao,data_vencimento,observacoes,updated_at,created_at")
        .eq("user_id", userId)
        .eq("id", payableId)
        .maybeSingle();
      payable = (oneLean.data as PayableRow) || null;
      oneErr = oneLean.error;
    } else {
      payable = (oneFull.data as PayableRow) || null;
      oneErr = oneFull.error;
    }
    if (oneErr) {
      return NextResponse.json({ error: oneErr.message }, { status: 500 });
    }
    if (!payable) {
      return NextResponse.json({ error: "Conta a pagar não encontrada." }, { status: 404 });
    }

    const result = await upsertCashForPayable(supabase, userId, payable as PayableRow, {
      valor: body?.valor != null ? Number(body.valor) : undefined,
      dataMovimento: body?.dataMovimento ? toYmd(String(body.dataMovimento)) : undefined,
      formaPagamento: body?.formaPagamento ? String(body.formaPagamento) : undefined,
      descricao: body?.descricao ? String(body.descricao) : undefined,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error || "Falha ao registrar saída." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, action: result.action });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

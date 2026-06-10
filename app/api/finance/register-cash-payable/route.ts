import { NextRequest, NextResponse } from "next/server";
import {
  applyCashFlagsToDescricao,
  cashMovementIsLegacyNeutralized,
} from "@/lib/finance-cash-meta";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { isOperationalManualMode } from "@/lib/finance-operational-mode";

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

const FINANCE_META_PREFIX = "[[finmeta:";

function metaFromObs(obs: string | null | undefined) {
  const raw = String(obs || "");
  if (!raw.startsWith(FINANCE_META_PREFIX)) return {} as { forma_pagamento?: string; data_pagamento?: string };
  const end = raw.indexOf("]]");
  if (end < 0) return {};
  try {
    return JSON.parse(raw.slice(FINANCE_META_PREFIX.length, end)) as {
      forma_pagamento?: string;
      data_pagamento?: string;
    };
  } catch {
    return {};
  }
}

function formaFromPayable(p: PayableRow) {
  if (p.forma_pagamento) return p.forma_pagamento;
  const raw = String(p.observacoes || p.descricao || "");
  return metaFromObs(raw).forma_pagamento || p.forma_pagamento || "PIX";
}

const CASH_MOV_SELECTS = [
  "id,valor,data_movimento,forma_pagamento,tipo_conta,conta_id,aprovado_caixa,excluir_do_saldo,descricao,created_at",
  "id,valor,data_movimento,forma_pagamento,tipo_conta,conta_id,excluir_do_saldo,descricao,created_at",
  "id,valor,data_movimento,forma_pagamento,tipo_conta,conta_id,descricao,created_at",
  "id,valor,data_movimento,forma_pagamento,tipo_conta,conta_id",
];

async function findExistingPayableMovement(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  payableId: string,
  opts: { forApprovedPayment?: boolean } = {}
) {
  let linked: Array<Record<string, unknown>> = [];
  for (const sel of CASH_MOV_SELECTS) {
    const { data, error } = await supabase
      .from("cash_movements")
      .select(sel)
      .eq("user_id", userId)
      .eq("conta_id", payableId)
      .limit(10);
    if (!error && data?.length) {
      linked = data as Array<Record<string, unknown>>;
      break;
    }
    if (error && !isSchemaError(error.message || "")) throw new Error(error.message);
  }
  const saidas = linked.filter((m) => cashIsSaida(m.tipo_conta as string));
  if (!saidas.length) return null;
  if (opts.forApprovedPayment) {
    const operational = saidas.find(
      (m) => !cashMovementIsLegacyNeutralized(m as Parameters<typeof cashMovementIsLegacyNeutralized>[0])
    );
    return operational || null;
  }
  return saidas[0] || null;
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
    aprovadoCaixa?: boolean;
  } = {}
) {
  const payableId = payable.id;
  const valor = Number(opts.valor ?? payable.valor ?? 0);
  if (!(valor > 0)) return { ok: true, action: "skipped" as const, reason: "valor_zero" };

  const dataYmd = toYmd(
    opts.dataMovimento ||
      metaFromObs(payable.observacoes || payable.descricao).data_pagamento ||
      payable.data_vencimento ||
      payable.updated_at ||
      payable.created_at
  );
  const isoMov = new Date(`${dataYmd}T12:00:00`).toISOString();
  const formaPagamento = opts.formaPagamento || formaFromPayable(payable);
  const descricao =
    opts.descricao || payable.descricao || payable.fornecedor || "Despesa";

  const existing = await findExistingPayableMovement(supabase, userId, payableId, {
    forApprovedPayment: opts.aprovadoCaixa === true,
  });
  const cashFlags =
    opts.aprovadoCaixa === true
      ? { aprovado_caixa: true, excluir_do_saldo: false }
      : { aprovado_caixa: false, excluir_do_saldo: true };
  const descricaoComFlags =
    opts.aprovadoCaixa === true
      ? applyCashFlagsToDescricao(descricao, { aprovado_caixa: true, excluir_do_saldo: false })
      : applyCashFlagsToDescricao(descricao, { aprovado_caixa: false, excluir_do_saldo: true });
  const payloads = [
    {
      user_id: userId,
      tipo_conta: existing?.tipo_conta || "PAGAR",
      conta_id: payableId,
      valor,
      descricao: descricaoComFlags,
      data_movimento: dataYmd,
      forma_pagamento: formaPagamento,
      ...cashFlags,
    },
    {
      user_id: userId,
      tipo_conta: "PAGAR",
      conta_id: payableId,
      valor,
      descricao: descricaoComFlags,
      data_movimento: isoMov,
      ...cashFlags,
    },
    {
      user_id: userId,
      tipo_conta: "SAIDA",
      conta_id: payableId,
      valor,
      descricao: descricaoComFlags,
      data_movimento: dataYmd,
      ...cashFlags,
    },
    { user_id: userId, tipo_conta: "PAGAR", conta_id: payableId, valor, ...cashFlags },
    { user_id: userId, tipo_conta: "SAIDA", conta_id: payableId, valor, data_movimento: dataYmd, ...cashFlags },
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
    const { data: settings } = await supabase
      .from("settings")
      .select("finance_manual_caixa_mode,caixa_operational_reset_at,caixa_reset_ym")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const manualCaixa = isOperationalManualMode(settings);

    if (syncMissing) {
      return NextResponse.json({
        ok: true,
        syncMissing: true,
        disabled: true,
        stats: { created: 0, updated: 0, failed: 0, skipped: 0, total: 0 },
        message: "Sincronização automática de contas a pagar no caixa está desativada. Registre manualmente pelo botão Caixa.",
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

    const aprovadoCaixa = body?.aprovadoCaixa === true;
    if (manualCaixa && !aprovadoCaixa) {
      return NextResponse.json(
        {
          error:
            "Modo caixa manual: envie aprovadoCaixa=true para registrar saída operacional (após confirmação manual).",
          manualCaixaMode: true,
        },
        { status: 403 }
      );
    }

    const result = await upsertCashForPayable(supabase, userId, payable as PayableRow, {
      valor: body?.valor != null ? Number(body.valor) : undefined,
      dataMovimento: body?.dataMovimento ? toYmd(String(body.dataMovimento)) : undefined,
      formaPagamento: body?.formaPagamento ? String(body.formaPagamento) : undefined,
      descricao: body?.descricao ? String(body.descricao) : undefined,
      aprovadoCaixa: manualCaixa ? true : aprovadoCaixa,
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

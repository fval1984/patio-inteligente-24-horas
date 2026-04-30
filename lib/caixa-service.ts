import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function abrirCaixa(input: { usuarioId: string; saldoInicial: number }) {
  const admin = getSupabaseAdmin();
  const usuarioId = String(input.usuarioId || "").trim();
  if (!usuarioId) throw new Error("Usuário obrigatório.");
  const saldoInicial = Number(input.saldoInicial || 0);
  if (saldoInicial < 0) throw new Error("Saldo inicial inválido.");

  const { data: existente, error: existingErr } = await admin
    .from("caixas_financeiros")
    .select("id,status")
    .eq("usuario_abertura_id", usuarioId)
    .eq("status", "ABERTO")
    .is("deleted_at", null)
    .maybeSingle();
  if (existingErr) throw new Error(existingErr.message);
  if (existente?.id) throw new Error("Já existe um caixa aberto para este usuário.");

  const { data, error } = await admin
    .from("caixas_financeiros")
    .insert({
      usuario_abertura_id: usuarioId,
      saldo_inicial: saldoInicial,
      saldo_final: saldoInicial,
      status: "ABERTO",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function obterCaixaAberto(usuarioId: string) {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("caixas_financeiros")
    .select("*")
    .eq("usuario_abertura_id", usuarioId)
    .eq("status", "ABERTO")
    .is("deleted_at", null)
    .order("data_abertura", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data || null;
}

export async function listarLancamentos(params: {
  caixaId: string;
  from?: string | null;
  to?: string | null;
  categoria?: string | null;
  formaPagamento?: string | null;
  busca?: string | null;
  limit?: number;
}) {
  const admin = getSupabaseAdmin();
  let query = admin
    .from("lancamentos_caixa")
    .select("*")
    .eq("caixa_id", params.caixaId)
    .is("deleted_at", null)
    .order("data_hora", { ascending: false })
    .limit(Math.min(Math.max(params.limit || 200, 1), 1000));

  if (params.from) query = query.gte("data_hora", `${params.from}T00:00:00`);
  if (params.to) query = query.lte("data_hora", `${params.to}T23:59:59`);
  if (params.categoria) query = query.eq("categoria", params.categoria.trim());
  if (params.formaPagamento) query = query.eq("forma_pagamento", params.formaPagamento.trim());
  if (params.busca) query = query.ilike("descricao", `%${params.busca.trim()}%`);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

export async function criarLancamento(input: {
  caixaId: string;
  tipo: "ENTRADA" | "SAIDA";
  categoria: string;
  descricao: string;
  valor: number;
  formaPagamento: "DINHEIRO" | "PIX" | "DEBITO" | "CREDITO" | "TRANSFERENCIA";
  usuarioId: string;
  referenciaId?: string | null;
  referenciaVeiculoId?: string | null;
}) {
  const admin = getSupabaseAdmin();
  if (Number(input.valor || 0) <= 0) throw new Error("Valor deve ser positivo.");
  const { data, error } = await admin
    .from("lancamentos_caixa")
    .insert({
      caixa_id: input.caixaId,
      tipo: input.tipo,
      categoria: String(input.categoria || "").trim() || "OUTROS",
      descricao: String(input.descricao || "").trim() || "Lançamento financeiro",
      valor: Number(input.valor),
      forma_pagamento: input.formaPagamento,
      usuario_id: input.usuarioId,
      referencia_id: input.referenciaId || null,
      referencia_veiculo_id: input.referenciaVeiculoId || null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function estornarLancamento(input: {
  lancamentoId: string;
  usuarioId: string;
  motivo?: string;
}) {
  const admin = getSupabaseAdmin();
  const { data: original, error: originalErr } = await admin
    .from("lancamentos_caixa")
    .select("*")
    .eq("id", input.lancamentoId)
    .is("deleted_at", null)
    .single();
  if (originalErr) throw new Error(originalErr.message);
  if (!original) throw new Error("Lançamento não encontrado.");
  if (original.is_estorno) throw new Error("Não é permitido estornar um estorno.");

  const tipoEstorno = original.tipo === "ENTRADA" ? "SAIDA" : "ENTRADA";
  const { data, error } = await admin
    .from("lancamentos_caixa")
    .insert({
      caixa_id: original.caixa_id,
      tipo: tipoEstorno,
      categoria: original.categoria,
      descricao: `Estorno: ${input.motivo || original.descricao}`,
      valor: original.valor,
      forma_pagamento: original.forma_pagamento,
      usuario_id: input.usuarioId,
      referencia_id: original.id,
      referencia_veiculo_id: original.referencia_veiculo_id,
      is_estorno: true,
      estornado_lancamento_id: original.id,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function softDeleteLancamento(input: { lancamentoId: string; usuarioId: string }) {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("lancamentos_caixa")
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", input.lancamentoId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  await admin.rpc("fn_caixa_log_acao", {
    p_entidade: "lancamentos_caixa",
    p_entidade_id: input.lancamentoId,
    p_acao: "SOFT_DELETE",
    p_usuario_id: input.usuarioId,
    p_payload: { reason: "soft-delete-api" },
  });
  return data;
}

export async function criarContaReceber(input: {
  cliente: string;
  valor: number;
  dataVencimento: string;
  referenciaVeiculoId?: string | null;
  financeiraId?: string | null;
}) {
  const admin = getSupabaseAdmin();
  if (Number(input.valor || 0) <= 0) throw new Error("Valor inválido.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(input.dataVencimento || ""))) throw new Error("Data de vencimento inválida.");
  const { data, error } = await admin
    .from("contas_receber_financeiro")
    .insert({
      cliente: input.cliente,
      valor: Number(input.valor),
      data_vencimento: input.dataVencimento,
      referencia_veiculo_id: input.referenciaVeiculoId || null,
      financeira_id: input.financeiraId || null,
      status: "PENDENTE",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function marcarContaReceberComoPaga(input: {
  contaId: string;
  usuarioId: string;
  formaPagamento?: "DINHEIRO" | "PIX" | "DEBITO" | "CREDITO" | "TRANSFERENCIA";
  caixaId?: string | null;
}) {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc("fn_conta_receber_marcar_pago", {
    p_conta_id: input.contaId,
    p_usuario_id: input.usuarioId,
    p_forma_pagamento: input.formaPagamento || "PIX",
    p_caixa_id: input.caixaId || null,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function fecharCaixa(input: {
  caixaId: string;
  usuarioId: string;
  totalDinheiro: number;
  totalPix: number;
  totalDebito: number;
  totalCredito: number;
  totalTransferencia: number;
  observacoes?: string;
}) {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc("fn_caixa_fechar", {
    p_caixa_id: input.caixaId,
    p_usuario_id: input.usuarioId,
    p_total_dinheiro: Number(input.totalDinheiro || 0),
    p_total_pix: Number(input.totalPix || 0),
    p_total_debito: Number(input.totalDebito || 0),
    p_total_credito: Number(input.totalCredito || 0),
    p_total_transferencia: Number(input.totalTransferencia || 0),
    p_observacoes: input.observacoes || null,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function obterDashboardCaixa(params: { caixaId: string }) {
  const admin = getSupabaseAdmin();
  const { data: caixa, error: caixaErr } = await admin
    .from("caixas_financeiros")
    .select("*")
    .eq("id", params.caixaId)
    .single();
  if (caixaErr) throw new Error(caixaErr.message);

  const { data: lancamentos, error: lancErr } = await admin
    .from("lancamentos_caixa")
    .select("*")
    .eq("caixa_id", params.caixaId)
    .is("deleted_at", null);
  if (lancErr) throw new Error(lancErr.message);

  const list = lancamentos || [];
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const week = weekStart.toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const sum = (arr: any[]) => arr.reduce((s, i) => s + Number(i.valor || 0), 0);
  const byDateRange = (arr: any[], from: string, to: string) =>
    arr.filter((x) => {
      const d = String(x.data_hora || "").slice(0, 10);
      return d >= from && d <= to;
    });
  const byMonth = (arr: any[]) => arr.filter((x) => String(x.data_hora || "").slice(0, 7) === month);
  const entradas = list.filter((x) => x.tipo === "ENTRADA");
  const saidas = list.filter((x) => x.tipo === "SAIDA");

  return {
    caixa,
    saldoAtual: Number(caixa.saldo_final || 0),
    entradasDia: sum(byDateRange(entradas, today, today)),
    saidasDia: sum(byDateRange(saidas, today, today)),
    entradasSemana: sum(byDateRange(entradas, week, today)),
    saidasSemana: sum(byDateRange(saidas, week, today)),
    entradasMes: sum(byMonth(entradas)),
    saidasMes: sum(byMonth(saidas)),
    lucroBruto: sum(byMonth(entradas)) - sum(byMonth(saidas)),
    recentes: list
      .sort((a, b) => String(b.data_hora || "").localeCompare(String(a.data_hora || "")))
      .slice(0, 20),
  };
}


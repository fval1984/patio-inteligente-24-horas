import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type {
  CompetenciaParts,
  ContaTipo,
  DashboardResumo,
  FinanceiroStatus,
  FinanceiroTipo,
} from "@/lib/financeiro-v2-types";

function toIsoDateOnly(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function parseCompetencia(input?: string | null): CompetenciaParts {
  const normalized = (input || "").trim();
  if (/^\d{4}-\d{2}$/.test(normalized)) {
    const ano = Number(normalized.slice(0, 4));
    const mes = Number(normalized.slice(5, 7));
    if (mes >= 1 && mes <= 12) return { competencia: normalized, ano, mes };
  }
  const now = new Date();
  const ano = now.getFullYear();
  const mes = now.getMonth() + 1;
  return { competencia: `${ano}-${String(mes).padStart(2, "0")}`, ano, mes };
}

function normalizeTipo(value: string): FinanceiroTipo {
  return value === "DESPESA" ? "DESPESA" : "RECEITA";
}

function normalizeStatus(value: string): FinanceiroStatus {
  return value === "REALIZADO" ? "REALIZADO" : "PENDENTE";
}

function normalizeContaTipo(value: string): ContaTipo {
  return value === "PAGAR" ? "PAGAR" : "RECEBER";
}

export async function listarTransacoes(params: {
  competencia?: string | null;
  tipo?: string | null;
  status?: string | null;
  busca?: string | null;
  categoria_id?: string | null;
  veiculo_id?: string | null;
  from?: string | null;
  to?: string | null;
  limit?: number;
}) {
  const admin = getSupabaseAdmin();
  const competencia = parseCompetencia(params.competencia);
  let query = admin
    .from("transacoes")
    .select("*")
    .eq("competencia", competencia.competencia)
    .order("data_movimento", { ascending: false })
    .limit(Math.min(Math.max(params.limit || 100, 1), 500));

  if (params.tipo) query = query.eq("tipo", normalizeTipo(params.tipo));
  if (params.status) query = query.eq("status", normalizeStatus(params.status));
  if (params.categoria_id) query = query.eq("categoria_id", params.categoria_id.trim());
  if (params.veiculo_id) query = query.eq("veiculo_id", params.veiculo_id.trim());
  if (params.from) query = query.gte("data_movimento", params.from);
  if (params.to) query = query.lte("data_movimento", params.to);
  if (params.busca) query = query.ilike("descricao", `%${params.busca.trim()}%`);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

export async function criarTransacao(input: {
  data_movimento?: string | null;
  valor: number;
  tipo: string;
  status?: string;
  descricao: string;
  categoria_id?: string | null;
  conta_id?: string | null;
  veiculo_id?: string | null;
  origem_evento?: string | null;
  chave_idempotencia?: string | null;
}) {
  const admin = getSupabaseAdmin();
  const dataMov = (input.data_movimento || toIsoDateOnly(new Date())).slice(0, 10);
  const competencia = parseCompetencia(dataMov.slice(0, 7));
  const payload = {
    data_movimento: dataMov,
    valor: Number(input.valor || 0),
    tipo: normalizeTipo(input.tipo),
    status: normalizeStatus(input.status || "REALIZADO"),
    descricao: (input.descricao || "").trim() || "Movimentação financeira",
    categoria_id: input.categoria_id || null,
    conta_id: input.conta_id || null,
    veiculo_id: input.veiculo_id || null,
    origem_evento: (input.origem_evento || "MANUAL").trim(),
    chave_idempotencia: input.chave_idempotencia || null,
    competencia: competencia.competencia,
    mes: competencia.mes,
    ano: competencia.ano,
  };
  const { data, error } = await admin.from("transacoes").insert(payload).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function atualizarTransacaoStatus(id: string, status: string) {
  const admin = getSupabaseAdmin();
  const safeId = String(id || "").trim();
  if (!safeId) throw new Error("ID da transação é obrigatório.");
  const { data, error } = await admin
    .from("transacoes")
    .update({ status: normalizeStatus(status), updated_at: new Date().toISOString() })
    .eq("id", safeId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function listarContas(params: {
  competencia?: string | null;
  tipo?: string | null;
  status?: string | null;
  from?: string | null;
  to?: string | null;
  limit?: number;
}) {
  const admin = getSupabaseAdmin();
  const competencia = parseCompetencia(params.competencia);
  let query = admin
    .from("contas")
    .select("*")
    .eq("competencia", competencia.competencia)
    .order("vencimento", { ascending: true })
    .limit(Math.min(Math.max(params.limit || 200, 1), 500));

  if (params.tipo) query = query.eq("tipo", normalizeContaTipo(params.tipo));
  if (params.status) query = query.eq("status", normalizeStatus(params.status));
  if (params.from) query = query.gte("vencimento", params.from);
  if (params.to) query = query.lte("vencimento", params.to);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

export async function criarConta(input: {
  tipo: string;
  descricao: string;
  valor: number;
  vencimento: string;
  status?: string;
  recorrencia?: string | null;
  categoria_id?: string | null;
  veiculo_id?: string | null;
  financeira_id?: string | null;
}) {
  const admin = getSupabaseAdmin();
  const vencimento = (input.vencimento || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(vencimento)) throw new Error("Vencimento inválido.");
  const competencia = parseCompetencia(vencimento.slice(0, 7));
  const payload = {
    tipo: normalizeContaTipo(input.tipo),
    descricao: (input.descricao || "").trim() || "Conta financeira",
    valor: Number(input.valor || 0),
    vencimento,
    status: normalizeStatus(input.status || "PENDENTE"),
    recorrencia: (input.recorrencia || "NAO").toUpperCase(),
    categoria_id: input.categoria_id || null,
    veiculo_id: input.veiculo_id || null,
    financeira_id: input.financeira_id || null,
    competencia: competencia.competencia,
    mes: competencia.mes,
    ano: competencia.ano,
  };
  const { data, error } = await admin.from("contas").insert(payload).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function atualizarContaStatus(id: string, status: string) {
  const admin = getSupabaseAdmin();
  const safeId = String(id || "").trim();
  if (!safeId) throw new Error("ID da conta é obrigatório.");
  const { data, error } = await admin
    .from("contas")
    .update({ status: normalizeStatus(status), updated_at: new Date().toISOString() })
    .eq("id", safeId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function obterDashboard(competenciaParam?: string | null): Promise<DashboardResumo> {
  const admin = getSupabaseAdmin();
  const competencia = parseCompetencia(competenciaParam);
  const now = new Date();
  const today = toIsoDateOnly(now);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const semanaInicio = toIsoDateOnly(weekStart);

  const { data: transacoes, error: txErr } = await admin
    .from("transacoes")
    .select("id,data_movimento,descricao,tipo,status,valor,veiculo_id")
    .eq("competencia", competencia.competencia);
  if (txErr) throw new Error(txErr.message);

  const { data: contas, error: contasErr } = await admin
    .from("contas")
    .select("tipo,status,valor,vencimento")
    .eq("competencia", competencia.competencia);
  if (contasErr) throw new Error(contasErr.message);

  const tx = transacoes || [];
  const ct = contas || [];

  const txRealizadas = tx.filter((t) => t.status === "REALIZADO");
  const receitasRealizadas = txRealizadas.filter((t) => t.tipo === "RECEITA");
  const despesasRealizadas = txRealizadas.filter((t) => t.tipo === "DESPESA");

  const soma = (arr: Array<{ valor: number }>) => arr.reduce((acc, item) => acc + Number(item.valor || 0), 0);
  const byRange = (arr: typeof txRealizadas, from: string, to: string) =>
    arr.filter((t) => t.data_movimento >= from && t.data_movimento <= to);

  const entradasDia = soma(byRange(receitasRealizadas, today, today));
  const saidasDia = soma(byRange(despesasRealizadas, today, today));
  const entradasSemana = soma(byRange(receitasRealizadas, semanaInicio, today));
  const saidasSemana = soma(byRange(despesasRealizadas, semanaInicio, today));
  const entradasMes = soma(receitasRealizadas);
  const saidasMes = soma(despesasRealizadas);
  const receitaRealizada = entradasMes;

  const receitaPrevista = soma(
    ct.filter((c) => c.tipo === "RECEBER" && ["PENDENTE", "REALIZADO"].includes(c.status)).map((c) => ({ valor: c.valor }))
  );
  const totalReceber = soma(ct.filter((c) => c.tipo === "RECEBER" && c.status === "PENDENTE").map((c) => ({ valor: c.valor })));
  const totalEmAberto = soma(ct.filter((c) => c.status === "PENDENTE").map((c) => ({ valor: c.valor })));
  const despesasMes = soma(ct.filter((c) => c.tipo === "PAGAR" && c.status !== "CANCELADO").map((c) => ({ valor: c.valor })));
  const lucroLiquido = receitaRealizada - despesasMes;
  const saldoTotal = entradasMes - saidasMes;

  const veiculosComReceita = new Set(receitasRealizadas.map((t) => t.veiculo_id).filter(Boolean));
  const ticketMedioPorVeiculo = veiculosComReceita.size ? receitaRealizada / veiculosComReceita.size : 0;

  return {
    competencia: competencia.competencia,
    saldoTotal,
    entradasDia,
    saidasDia,
    entradasSemana,
    saidasSemana,
    entradasMes,
    saidasMes,
    receitaPrevista,
    receitaRealizada,
    despesasMes,
    lucroLiquido,
    totalReceber,
    totalEmAberto,
    ticketMedioPorVeiculo,
    recentes: tx
      .sort((a, b) => String(b.data_movimento).localeCompare(String(a.data_movimento)))
      .slice(0, 15)
      .map((item) => ({
        id: String(item.id),
        data_movimento: String(item.data_movimento),
        descricao: String(item.descricao || ""),
        tipo: normalizeTipo(String(item.tipo || "RECEITA")),
        status: normalizeStatus(String(item.status || "PENDENTE")),
        valor: Number(item.valor || 0),
      })),
  };
}

export async function obterRelatorios(competenciaParam?: string | null) {
  const admin = getSupabaseAdmin();
  const competencia = parseCompetencia(competenciaParam);
  const { data: transacoes, error } = await admin
    .from("transacoes")
    .select("tipo,status,valor,veiculo_id,categoria_id,data_movimento")
    .eq("competencia", competencia.competencia);
  if (error) throw new Error(error.message);
  const tx = transacoes || [];
  const receitas = tx.filter((t) => t.tipo === "RECEITA" && t.status === "REALIZADO");
  const despesas = tx.filter((t) => t.tipo === "DESPESA" && t.status === "REALIZADO");
  const lucroMensal = receitas.reduce((s, t) => s + Number(t.valor || 0), 0) - despesas.reduce((s, t) => s + Number(t.valor || 0), 0);

  const custosPorVeiculo = new Map<string, number>();
  despesas.forEach((d) => {
    const key = String(d.veiculo_id || "SEM_VINCULO");
    custosPorVeiculo.set(key, (custosPorVeiculo.get(key) || 0) + Number(d.valor || 0));
  });

  return {
    competencia: competencia.competencia,
    lucroMensal,
    entradas: receitas.reduce((s, t) => s + Number(t.valor || 0), 0),
    saidas: despesas.reduce((s, t) => s + Number(t.valor || 0), 0),
    custosPorVeiculo: [...custosPorVeiculo.entries()].map(([veiculo_id, valor]) => ({ veiculo_id, valor })),
  };
}


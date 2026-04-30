export type FinanceiroTipo = "RECEITA" | "DESPESA";
export type FinanceiroStatus = "PENDENTE" | "REALIZADO";
export type ContaTipo = "RECEBER" | "PAGAR";

export type CompetenciaParts = {
  competencia: string;
  mes: number;
  ano: number;
};

export type DashboardResumo = {
  competencia: string;
  saldoTotal: number;
  entradasDia: number;
  saidasDia: number;
  entradasSemana: number;
  saidasSemana: number;
  entradasMes: number;
  saidasMes: number;
  receitaPrevista: number;
  receitaRealizada: number;
  despesasMes: number;
  lucroLiquido: number;
  totalReceber: number;
  totalEmAberto: number;
  ticketMedioPorVeiculo: number;
  recentes: Array<{
    id: string;
    data_movimento: string;
    descricao: string;
    tipo: FinanceiroTipo;
    status: FinanceiroStatus;
    valor: number;
  }>;
};


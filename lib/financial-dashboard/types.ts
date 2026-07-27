/**
 * FinancialTypes — contratos do Dashboard Financeiro.
 */

export type Uuid = string;
export type Ymd = string;
export type FinancialPeriodKey = "today" | "7d" | "30d" | "month" | "year";
export type FinancialStatusFilter = "" | "pendente" | "atrasado" | "pago";

export interface FinancialFilters {
  period: FinancialPeriodKey;
  /** RPV / localizador do veículo */
  financeiraId: string;
  /** RPP / responsável financeiro */
  parceiroId: string;
  status: FinancialStatusFilter;
  search: string;
}

export interface FinancialVehicle {
  id: Uuid;
  placa?: string | null;
  localizador_id?: string | null;
  responsavel_financeiro_id?: string | null;
  responsavel_financeiro_nome?: string | null;
  data_saida?: string | null;
  marca?: string | null;
  modelo?: string | null;
}

export interface FinancialPartner {
  id: Uuid;
  nome?: string | null;
}

export interface FinancialReceivable {
  id: Uuid;
  vehicle_id?: Uuid | null;
  valor?: number | string | null;
  status?: string | null;
  period_end?: string | null;
  period_start?: string | null;
  data_vencimento?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  financeiro_aprovado_contas_receber?: boolean | null;
  observacoes?: string | null;
}

export interface FinancialCashMovement {
  id?: Uuid;
  valor?: number | string | null;
  tipo_conta?: string | null;
  conta_id?: Uuid | null;
  data_movimento?: string | null;
  created_at?: string | null;
  aprovado_caixa?: boolean | null;
  descricao?: string | null;
}

export interface FinancialDataSnapshot {
  receivables: FinancialReceivable[];
  cash: FinancialCashMovement[];
  vehicles: FinancialVehicle[];
  partners: FinancialPartner[];
  asOfYmd?: Ymd;
}

export interface DateRange {
  from: Ymd;
  to: Ymd;
  label: string;
}

export interface TrendValue {
  pct: number;
  label: string;
}

export interface FinancialKpis {
  contasAReceber: { valor: number; titulos: number; trend: TrendValue };
  recebimentosMes: { valor: number; pagamentos: number; trend: TrendValue };
  receitaAcumulada: { valor: number; trend: TrendValue };
  inadimplencia: { valor: number; titulos: number; pctSobreReceber: number };
  ticketMedio: number;
  previsaoRecebimento: number;
}

export interface MonthlySeries {
  labels: string[];
  values: number[];
}

export interface FluxoSeries {
  labels: string[];
  entradas: number[];
  recebimentos: number[];
  saldo: number[];
}

export interface FinanceiraRevenueRow {
  id: string;
  nome: string;
  valor: number;
  pct: number;
}

export interface ContaReceberRow {
  financeira: string;
  veiculos: number;
  valor: number;
  diasMedios: number;
}

export interface UltimoRecebimentoRow {
  data: string;
  financeira: string;
  descricao: string;
  valor: number;
  situacao: string;
}

export interface IndicadoresFinanceiros {
  receitaHoje: number;
  receitaSemana: number;
  receitaMes: number;
  receitaAno: number;
  receitaMediaDiaria: number;
  receitaMediaMensal: number;
}

export interface FinancialAlerts {
  titulosVencidos: { count: number; valor: number };
  recebimentosAtrasados: { count: number; valor: number };
  financeirasMaiorDivida: Array<{ nome: string; valor: number }>;
  vencendoHoje: { count: number; valor: number };
  vencendo7Dias: { count: number; valor: number };
}

export interface FinancialMetricsResult {
  filters: FinancialFilters;
  range: DateRange;
  asOfYmd: Ymd;
  kpis: FinancialKpis;
  receitaMensal12: MonthlySeries;
  fluxo: FluxoSeries;
  receitaPorFinanceira: FinanceiraRevenueRow[];
  maioresContas: ContaReceberRow[];
  ultimosRecebimentos: UltimoRecebimentoRow[];
  indicadores: IndicadoresFinanceiros;
  alerts: FinancialAlerts;
}

export const DEFAULT_FINANCIAL_FILTERS: FinancialFilters = {
  period: "month",
  financeiraId: "",
  parceiroId: "",
  status: "",
  search: "",
};

/**
 * FinancialPartnerTypes — Dashboard exclusivo por Financeira (cliente do pátio).
 */

export type Uuid = string;
export type Ymd = string;
export type PartnerPeriodKey = "today" | "7d" | "30d" | "month" | "year";
export type AlertPriority = "green" | "yellow" | "red";

export type PartnerPortfolioStage =
  | "em_guarda"
  | "aguardando_documentacao"
  | "aguardando_autorizacao"
  | "liberados"
  | "entregues";

export interface FinancialPartnerFilters {
  period: PartnerPeriodKey;
  /** Obrigatório para visão detalhada — localizador_id */
  financeiraId: string;
  status: "" | "no_patio" | "vlp" | "removido";
  search: string;
}

export interface FpVehicle {
  id: Uuid;
  placa?: string | null;
  marca?: string | null;
  modelo?: string | null;
  status?: string | null;
  data_entrada?: string | null;
  data_saida?: string | null;
  localizador_id?: string | null;
  responsavel_financeiro_id?: string | null;
  responsavel_financeiro_nome?: string | null;
  valor_diaria?: number | string | null;
  remocao_solicitada?: boolean | string | number | null;
  nfse_status?: string | null;
  vistoria_data?: string | null;
  vistoria_responsavel?: string | null;
  vistoria_checklist?: Record<string, boolean> | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface FpPartner {
  id: Uuid;
  nome?: string | null;
}

export interface FpReceivable {
  id: Uuid;
  vehicle_id?: Uuid | null;
  valor?: number | string | null;
  status?: string | null;
  period_end?: string | null;
  data_vencimento?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  financeiro_aprovado_contas_receber?: boolean | null;
}

export interface FpVehicleEvent {
  id?: Uuid;
  vehicle_id?: Uuid | null;
  tipo?: string | null;
  responsavel?: string | null;
  descricao?: string | null;
  data_evento?: string | null;
  created_at?: string | null;
}

export interface FinancialPartnerDataSnapshot {
  vehicles: FpVehicle[];
  partners: FpPartner[];
  receivables: FpReceivable[];
  events?: FpVehicleEvent[];
  asOfYmd?: Ymd;
}

export interface PartnerKpis {
  veiculosAtivos: number;
  entradasPeriodo: number;
  saidasPeriodo: number;
  tempoMedioPermanencia: number;
  receitaGerada: number;
  valorEmAberto: number;
}

export interface MonthlyPairSeries {
  labels: string[];
  entradas: number[];
  saidas: number[];
}

export interface MonthlyNumberSeries {
  labels: string[];
  values: number[];
}

export interface PortfolioSlice {
  key: PartnerPortfolioStage;
  label: string;
  count: number;
  pct: number;
}

export interface PermanenceBucket {
  key: string;
  label: string;
  count: number;
  pct: number;
}

export interface VehicleRow {
  vehicleId: string;
  placa: string;
  modelo: string;
  dataEntrada: string;
  diasNoPatio: number;
  status: string;
  valorAcumulado: number;
}

export interface MovementRow {
  data: string;
  placa: string;
  evento: string;
  usuario: string;
  at: string;
}

export interface PartnerAlert {
  id: string;
  priority: AlertPriority;
  title: string;
  detail: string;
  count: number;
}

export interface PartnerFinancialIndicators {
  receitaMes: number;
  receitaAno: number;
  ticketMedioPorVeiculo: number;
  receitaMediaPorDiaGuarda: number;
  valorMedioPorVeiculoArmazenado: number;
}

export interface FinancialPartnerMetricsResult {
  filters: FinancialPartnerFilters;
  asOfYmd: Ymd;
  financeiraNome: string;
  hasFinanceira: boolean;
  kpis: PartnerKpis;
  entradasSaidas12m: MonthlyPairSeries;
  tempoMedio12m: MonthlyNumberSeries;
  receitaMensal12m: MonthlyNumberSeries;
  carteira: PortfolioSlice[];
  veiculos: VehicleRow[];
  ultimasMovimentacoes: MovementRow[];
  alerts: PartnerAlert[];
  mapaPermanencia: PermanenceBucket[];
  rankingPermanencia: VehicleRow[];
  indicadoresFinanceiros: PartnerFinancialIndicators;
}

export const DEFAULT_FP_FILTERS: FinancialPartnerFilters = {
  period: "30d",
  financeiraId: "",
  status: "",
  search: "",
};

export const PORTFOLIO_LABELS: Record<PartnerPortfolioStage, string> = {
  em_guarda: "Veículos em guarda",
  aguardando_documentacao: "Aguardando documentação",
  aguardando_autorizacao: "Aguardando autorização",
  liberados: "Veículos liberados",
  entregues: "Veículos entregues",
};

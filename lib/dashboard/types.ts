/**
 * DashboardTypes — contratos tipados do Dashboard Executivo.
 * Fonte única de tipos para métricas, filtros e snapshot.
 */

export type Uuid = string;
export type Ymd = string; // YYYY-MM-DD

/** Status de veículo usados no fluxo operacional do pátio. */
export type VehicleStatus =
  | "NO_PATIO"
  | "LIBERACAO_SOLICITADA"
  | "LIBERACAO_CONFIRMADA"
  | "REMOCAO_CONFIRMADA"
  | "REMocao_CONFIRMADA"
  | "REMOVIDO"
  | string;

/** Grupos mutuamente exclusivos da Situação Operacional. */
export type OperationalGroup =
  | "aguardando_conferencia"
  | "aguardando_vistoria"
  | "aguardando_autorizacao"
  | "liberados_aguardando_retirada"
  | "pendencias_documentais";

export type DashboardPeriodKey = "today" | "7d" | "30d" | "month" | "year";

export interface DashboardFilters {
  period: DashboardPeriodKey;
  /** Financeira / RPV (localizador_id). */
  financeiraId: string;
  /** Parceiro — no domínio atual equivale ao localizador quando não há filtro separado. */
  parceiroId: string;
  /** no_patio | vlp | removido | "" */
  status: "" | "no_patio" | "vlp" | "removido";
  search: string;
}

export interface DashboardVehicle {
  id: Uuid;
  placa?: string | null;
  status?: VehicleStatus | null;
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
  vistoria_km?: string | number | null;
  vistoria_combustivel?: string | null;
  vistoria_observacoes?: string | null;
  vistoria_checklist?: {
    documento?: boolean;
    chave?: boolean;
    estepe?: boolean;
    triangulo_macaco?: boolean;
  } | null;
  marca?: string | null;
  modelo?: string | null;
}

export interface DashboardPartner {
  id: Uuid;
  nome?: string | null;
  tipo?: string | null;
}

export interface DashboardReceivable {
  id: Uuid;
  vehicle_id?: Uuid | null;
  valor?: number | string | null;
  status?: string | null;
  partner_id?: Uuid | null;
  localizador_id?: Uuid | null;
}

export interface DashboardSettings {
  capacidade_patio?: number | string | null;
}

/** Snapshot único — uma carga, todos os indicadores derivam daqui. */
export interface DashboardDataSnapshot {
  vehicles: DashboardVehicle[];
  partners: DashboardPartner[];
  receivables: DashboardReceivable[];
  settings: DashboardSettings;
  /** Dia de referência (YYYY-MM-DD). Default: hoje local. */
  asOfYmd?: Ymd;
}

export interface DateRange {
  from: Ymd;
  to: Ymd;
  label: string;
}

export interface OperationalStatusCounts {
  aguardandoConferencia: number;
  aguardandoVistoria: number;
  aguardandoAutorizacao: number;
  liberadosAguardandoRetirada: number;
  pendenciasDocumentais: number;
}

export interface OccupancyMetrics {
  vehiclesOnPatio: number;
  capacity: number;
  percent: number;
  label: string;
}

export interface LongStayRow {
  vehicleId: Uuid;
  placa: string;
  financeira: string;
  days: number;
}

export interface ReceivableByFinanceiraRow {
  financeiraId: string;
  financeira: string;
  veiculos: number;
  valor: number;
}

export interface VehiclesByFinanceiraRow {
  financeiraId: string;
  nome: string;
  count: number;
}

export interface DailyFlowSeries {
  labels: string[];
  entradas: number[];
  saidas: number[];
}

export interface MonthlyRevenueSeries {
  months: string[];
  values: number[];
}

export interface DashboardKpiMetrics {
  veiculosNoPatio: number;
  entradasHoje: number;
  saidasHoje: number;
  ocupacao: OccupancyMetrics;
  contasAReceber: number;
  contasAReceberPendentes: number;
  financeirasAtivas: number;
}

export interface DashboardMetricsResult {
  filters: DashboardFilters;
  range: DateRange;
  asOfYmd: Ymd;
  kpis: DashboardKpiMetrics;
  operacional: OperationalStatusCounts;
  /** Classificação 1:1 veículo → grupo (apenas no pátio). */
  operacionalByVehicleId: Record<string, OperationalGroup>;
  longStay: LongStayRow[];
  topReceivablesByFinanceira: ReceivableByFinanceiraRow[];
  vehiclesByFinanceira: VehiclesByFinanceiraRow[];
  dailyFlow30d: DailyFlowSeries;
  receitaMensal: MonthlyRevenueSeries;
  auditOk: boolean;
}

export const DEFAULT_PATIO_CAPACITY = 100;
export const DEFAULT_FILTERS: DashboardFilters = {
  period: "30d",
  financeiraId: "",
  parceiroId: "",
  status: "",
  search: "",
};

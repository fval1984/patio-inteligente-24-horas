/**
 * BITypes — Business Intelligence Executivo (diretoria / gerência).
 * Análise estratégica sobre dados já carregados no cliente. Sem SQL por card.
 */

export type Uuid = string;
export type Ymd = string;
export type BiPeriodKey = "today" | "7d" | "30d" | "month" | "year" | "24m";
export type AlertPriority = "green" | "yellow" | "red";
export type BiPageKey =
  | "visao"
  | "financeiras"
  | "permanencia"
  | "receita"
  | "movimentacao"
  | "eficiencia"
  | "alertas";

export interface BiFilters {
  period: BiPeriodKey;
  financeiraId: string;
  parceiroId: string;
  cidade: string;
  estado: string;
  status: string;
  tipoVeiculo: string;
}

export const DEFAULT_BI_FILTERS: BiFilters = {
  period: "30d",
  financeiraId: "",
  parceiroId: "",
  cidade: "",
  estado: "",
  status: "",
  tipoVeiculo: "",
};

export interface BiVehicle {
  id: Uuid;
  placa?: string | null;
  marca?: string | null;
  modelo?: string | null;
  status?: string | null;
  data_entrada?: string | null;
  data_saida?: string | null;
  localizador_id?: string | null;
  leiloeiro_id?: string | null;
  responsavel_financeiro_id?: string | null;
  responsavel_financeiro_nome?: string | null;
  valor_diaria?: number | string | null;
  remocao_solicitada?: boolean | string | number | null;
  nfse_status?: string | null;
  vistoria_data?: string | null;
  vistoria_responsavel?: string | null;
  observacoes?: string | null;
  cidade?: string | null;
  estado?: string | null;
  uf?: string | null;
  tipo_veiculo?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface BiPartner {
  id: Uuid;
  nome?: string | null;
  tipo?: string | null;
  cidade?: string | null;
  estado?: string | null;
  uf?: string | null;
}

export interface BiReceivable {
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

export interface BiVehicleEvent {
  id?: Uuid;
  vehicle_id?: Uuid | null;
  tipo?: string | null;
  responsavel?: string | null;
  descricao?: string | null;
  data_evento?: string | null;
  created_at?: string | null;
}

export interface BiSettings {
  capacidade_patio?: number | string | null;
  metaReceitaMensal?: number | null;
  metaReceitaNome?: string | null;
}

export interface BiDataSnapshot {
  vehicles: BiVehicle[];
  partners: BiPartner[];
  receivables: BiReceivable[];
  events?: BiVehicleEvent[];
  settings?: BiSettings | null;
  asOfYmd?: Ymd;
}

export interface NamedOption {
  id: string;
  label: string;
}

export interface BiFilterOptions {
  financeiras: NamedOption[];
  parceiros: NamedOption[];
  cidades: NamedOption[];
  estados: NamedOption[];
  statusList: NamedOption[];
  tiposVeiculo: NamedOption[];
}

export interface KpiNumber {
  key: string;
  label: string;
  value: number;
  format: "int" | "money" | "days" | "pct";
  meta?: string;
}

export interface SeriesPoint {
  label: string;
  value: number;
  id?: string;
}

export interface DualSeries {
  labels: string[];
  a: number[];
  b: number[];
  aLabel?: string;
  bLabel?: string;
}

export interface NumberSeries {
  labels: string[];
  values: number[];
}

export interface MultiSeries {
  labels: string[];
  series: { id: string; name: string; values: number[] }[];
}

export interface SlicePct {
  key: string;
  label: string;
  count: number;
  value: number;
  pct: number;
}

export interface RankingRow {
  id: string;
  nome: string;
  veiculos: number;
  receita: number;
  tempoMedio: number;
  ticketMedio: number;
  movimentacoes: number;
  participacaoPct: number;
}

export interface HeatCell {
  rowId: string;
  rowLabel: string;
  colKey: string;
  colLabel: string;
  value: number;
}

export interface PermanenceRow {
  vehicleId: string;
  placa: string;
  modelo: string;
  financeira: string;
  dias: number;
  status: string;
  valorAcumulado: number;
}

export interface StageTiming {
  key: string;
  label: string;
  avgDays: number;
  sample: number;
}

export interface BiAlert {
  id: string;
  priority: AlertPriority;
  title: string;
  detail: string;
  count?: number;
  drillKey?: string;
}

export interface DrillLevel {
  key: string;
  label: string;
  rows: { id: string; label: string; value: number; format?: "int" | "money" | "days"; meta?: string }[];
}

export interface OverviewPage {
  kpis: KpiNumber[];
  entradasSaidas24m: DualSeries;
  receitaMensal24m: NumberSeries;
  ocupacaoTimeline: NumberSeries;
  tempoMedioTimeline: NumberSeries;
  receitaPorCidade: SeriesPoint[];
  receitaPorEstado: SeriesPoint[];
}

export interface FinanceirasPage {
  ranking: RankingRow[];
  receitaTop20: SeriesPoint[];
  participacaoPizza: SlicePct[];
  evolucaoMensal: MultiSeries;
}

export interface PermanenciaPage {
  distribuicao: SlicePct[];
  histograma: SeriesPoint[];
  heatmap: HeatCell[];
  heatmapCols: { key: string; label: string }[];
  top50: PermanenceRow[];
}

export interface ReceitaPage {
  kpis: KpiNumber[];
  acumulada: NumberSeries;
  diaria: NumberSeries;
  comparativoAnual: DualSeries;
  metaVsRealizado: { meta: number; realizado: number; pct: number; nome: string } | null;
}

export interface MovimentacaoPage {
  entradasPorDia: NumberSeries;
  saidasPorDia: NumberSeries;
  entradasPorMes: NumberSeries;
  saidasPorMes: NumberSeries;
  porCidade: SeriesPoint[];
  porFinanceira: SeriesPoint[];
}

export interface EficienciaPage {
  estagios: StageTiming[];
  gargalos: StageTiming[];
}

export interface BiMetricsResult {
  asOfYmd: Ymd;
  range: { from: Ymd; to: Ymd };
  filterOptions: BiFilterOptions;
  overview: OverviewPage;
  financeiras: FinanceirasPage;
  permanencia: PermanenciaPage;
  receita: ReceitaPage;
  movimentacao: MovimentacaoPage;
  eficiencia: EficienciaPage;
  alertas: BiAlert[];
  /** Dados para drill-down genérico (receita → financeira → veículo). */
  drillReceitaPorFinanceira: DrillLevel;
  drillVeiculosPorFinanceira: Record<string, DrillLevel>;
}

/**
 * OperationalTypes — Dashboard Operacional do pátio (guarda de veículos).
 */

export type Uuid = string;
export type Ymd = string;
export type OperationalPeriodKey = "today" | "7d" | "30d" | "month" | "year";

/** Etapas mutuamente exclusivas no pátio (estoque atual). */
export type OpsStage =
  | "aguardando_conferencia"
  | "aguardando_vistoria"
  | "aguardando_autorizacao"
  | "em_guarda"
  | "liberados"
  | "entregues";

export type AlertPriority = "green" | "yellow" | "red";

export interface OperationalFilters {
  period: OperationalPeriodKey;
  financeiraId: string;
  parceiroId: string;
  status: "" | "no_patio" | "vlp" | "removido";
  search: string;
}

export interface OpsVehicle {
  id: Uuid;
  placa?: string | null;
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
  vistoria_km?: string | number | null;
  vistoria_combustivel?: string | null;
  vistoria_observacoes?: string | null;
  vistoria_checklist?: Record<string, boolean> | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface OpsPartner {
  id: Uuid;
  nome?: string | null;
}

export interface OpsVehicleEvent {
  id?: Uuid;
  vehicle_id?: Uuid | null;
  tipo?: string | null;
  responsavel?: string | null;
  descricao?: string | null;
  data_evento?: string | null;
  created_at?: string | null;
}

export interface OperationalDataSnapshot {
  vehicles: OpsVehicle[];
  partners: OpsPartner[];
  events?: OpsVehicleEvent[];
  asOfYmd?: Ymd;
}

export interface OperationalKpis {
  veiculosNoPatio: number;
  entradasHoje: number;
  saidasHoje: number;
  aguardandoConferencia: number;
  aguardandoVistoria: number;
  prontosParaLiberacao: number;
}

export interface FilaOperacional {
  recebidosHoje: number;
  aguardandoConferencia: number;
  aguardandoVistoria: number;
  aguardandoAutorizacao: number;
  liberados: number;
  entregues: number;
}

export interface MapaOperacao {
  recebidosHoje: number;
  emConferencia: number;
  emGuarda: number;
  liberados: number;
  entregues: number;
}

export interface DailyFlow {
  labels: string[];
  entradas: number[];
  saidas: number[];
}

export interface StayByMonth {
  labels: string[];
  avgDays: number[];
}

export interface StatusSlice {
  key: string;
  label: string;
  count: number;
  pct: number;
}

export interface ActionRow {
  vehicleId: string;
  placa: string;
  financeira: string;
  statusAtual: string;
  diasNoPatio: number;
  responsavel: string;
  stage: OpsStage;
}

export interface MovementRow {
  horario: string;
  placa: string;
  evento: string;
  usuario: string;
  at: string;
}

export interface OpsAlert {
  id: string;
  priority: AlertPriority;
  title: string;
  detail: string;
  count: number;
}

export interface OperationalMetricsResult {
  filters: OperationalFilters;
  asOfYmd: Ymd;
  kpis: OperationalKpis;
  fila: FilaOperacional;
  mapa: MapaOperacao;
  entradasSaidas30d: DailyFlow;
  tempoMedioPermanencia12m: StayByMonth;
  veiculosPorStatus: StatusSlice[];
  aguardandoAcao: ActionRow[];
  ultimasMovimentacoes: MovementRow[];
  alerts: OpsAlert[];
}

export const DEFAULT_OPS_FILTERS: OperationalFilters = {
  period: "30d",
  financeiraId: "",
  parceiroId: "",
  status: "",
  search: "",
};

export const STAGE_LABELS: Record<OpsStage, string> = {
  aguardando_conferencia: "Aguardando conferência",
  aguardando_vistoria: "Aguardando vistoria",
  aguardando_autorizacao: "Aguardando autorização",
  em_guarda: "Em guarda",
  liberados: "Liberados",
  entregues: "Entregues",
};

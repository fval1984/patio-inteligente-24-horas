/**
 * Camada de métricas do Dashboard Executivo.
 * Cards devem consumir apenas DashboardService — nunca SQL próprio.
 */

export type {
  DashboardDataSnapshot,
  DashboardFilters,
  DashboardMetricsResult,
  DashboardPeriodKey,
  DashboardKpiMetrics,
  OperationalGroup,
  OperationalStatusCounts,
  OccupancyMetrics,
  LongStayRow,
  ReceivableByFinanceiraRow,
  VehiclesByFinanceiraRow,
  DailyFlowSeries,
  MonthlyRevenueSeries,
  DashboardVehicle,
  DashboardPartner,
  DashboardReceivable,
  DashboardSettings,
} from "./types";

export { DEFAULT_FILTERS, DEFAULT_PATIO_CAPACITY } from "./types";
export { DashboardRepository } from "./repository";
export { DashboardMetrics, classifyOperationalGroup, isVehicleOnPatio, isOpenReceivable, filterVehicles, toLocalYmd, todayYmd } from "./metrics";
export { DashboardService, dashboardService } from "./service";
export { auditOperationalConsistency, sumOperationalGroups } from "./audit";

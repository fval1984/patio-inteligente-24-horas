/**
 * DashboardService — orquestra repositório + métricas + cache.
 * Único ponto de entrada para os cards do Dashboard Executivo.
 */

import { DashboardMetrics } from "./metrics";
import { DashboardRepository, type SupabaseLikeClient } from "./repository";
import {
  DEFAULT_FILTERS,
  type DashboardDataSnapshot,
  type DashboardFilters,
  type DashboardMetricsResult,
} from "./types";

type CacheEntry = {
  key: string;
  result: DashboardMetricsResult;
};

function stableFiltersKey(filters: DashboardFilters): string {
  return [
    filters.period,
    filters.financeiraId || "",
    filters.parceiroId || "",
    filters.status || "",
    (filters.search || "").trim().toLowerCase(),
  ].join("|");
}

function snapshotSignature(snapshot: DashboardDataSnapshot): string {
  return [
    (snapshot.vehicles || []).length,
    (snapshot.partners || []).length,
    (snapshot.receivables || []).length,
    snapshot.settings?.capacidade_patio ?? "",
    snapshot.asOfYmd || "",
  ].join(":");
}

export class DashboardService {
  private readonly repository: DashboardRepository;
  private readonly metrics: DashboardMetrics;
  private cache: CacheEntry | null = null;

  constructor(
    repository: DashboardRepository = new DashboardRepository(),
    metrics: DashboardMetrics = new DashboardMetrics()
  ) {
    this.repository = repository;
    this.metrics = metrics;
  }

  invalidateCache(): void {
    this.cache = null;
  }

  /**
   * Calcula todos os indicadores a partir de um snapshot já carregado.
   * Preferido pelo app.html (dados já em `state`).
   */
  getMetricsFromSnapshot(
    raw: {
      vehicles?: DashboardDataSnapshot["vehicles"];
      partners?: DashboardDataSnapshot["partners"];
      receivables?: DashboardDataSnapshot["receivables"];
      settings?: DashboardDataSnapshot["settings"];
      asOfYmd?: string;
    },
    filters: Partial<DashboardFilters> = {}
  ): DashboardMetricsResult {
    const snapshot = this.repository.fromSnapshot(raw);
    const merged: DashboardFilters = { ...DEFAULT_FILTERS, ...filters };
    const key = `${snapshotSignature(snapshot)}|${stableFiltersKey(merged)}`;
    if (this.cache?.key === key) return this.cache.result;

    const result = this.metrics.compute(snapshot, merged);
    this.cache = { key, result };
    return result;
  }

  /**
   * Carrega dados uma vez (quando não há snapshot em memória) e calcula.
   */
  async getMetrics(
    client: SupabaseLikeClient,
    userId: string,
    filters: Partial<DashboardFilters> = {},
    asOfYmd?: string
  ): Promise<DashboardMetricsResult> {
    const snapshot = await this.repository.loadOnce(client, userId, asOfYmd);
    return this.getMetricsFromSnapshot(snapshot, filters);
  }
}

/** Singleton conveniente para o runtime do browser / API. */
export const dashboardService = new DashboardService();

/**
 * FinancialDashboardService — orquestra repositório + métricas + cache.
 */

import { FinancialMetricsService } from "./metrics";
import { FinancialRepository } from "./repository";
import {
  DEFAULT_FINANCIAL_FILTERS,
  type FinancialDataSnapshot,
  type FinancialFilters,
  type FinancialMetricsResult,
} from "./types";

type CacheEntry = { key: string; result: FinancialMetricsResult };

function filtersKey(f: FinancialFilters): string {
  return [f.period, f.financeiraId, f.parceiroId, f.status, (f.search || "").trim().toLowerCase()].join("|");
}

function snapshotKey(s: FinancialDataSnapshot): string {
  return [
    (s.receivables || []).length,
    (s.cash || []).length,
    (s.vehicles || []).length,
    (s.partners || []).length,
    s.asOfYmd || "",
  ].join(":");
}

export class FinancialDashboardService {
  private readonly repository: FinancialRepository;
  private readonly metrics: FinancialMetricsService;
  private cache: CacheEntry | null = null;

  constructor(
    repository: FinancialRepository = new FinancialRepository(),
    metrics: FinancialMetricsService = new FinancialMetricsService()
  ) {
    this.repository = repository;
    this.metrics = metrics;
  }

  invalidateCache(): void {
    this.cache = null;
  }

  getMetricsFromSnapshot(
    raw: {
      receivables?: FinancialDataSnapshot["receivables"];
      cash?: FinancialDataSnapshot["cash"];
      vehicles?: FinancialDataSnapshot["vehicles"];
      partners?: FinancialDataSnapshot["partners"];
      asOfYmd?: string;
    },
    filters: Partial<FinancialFilters> = {}
  ): FinancialMetricsResult {
    const snapshot = this.repository.fromSnapshot(raw);
    const merged: FinancialFilters = { ...DEFAULT_FINANCIAL_FILTERS, ...filters };
    const key = `${snapshotKey(snapshot)}|${filtersKey(merged)}`;
    if (this.cache?.key === key) return this.cache.result;
    const result = this.metrics.compute(snapshot, merged);
    this.cache = { key, result };
    return result;
  }
}

export const financialDashboardService = new FinancialDashboardService();

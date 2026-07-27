import { OperationalMetrics } from "./metrics";
import { OperationalRepository } from "./repository";
import {
  DEFAULT_OPS_FILTERS,
  type OperationalDataSnapshot,
  type OperationalFilters,
  type OperationalMetricsResult,
} from "./types";

type CacheEntry = { key: string; result: OperationalMetricsResult };

export class OperationalDashboardService {
  private readonly repository: OperationalRepository;
  private readonly metrics: OperationalMetrics;
  private cache: CacheEntry | null = null;

  constructor(
    repository: OperationalRepository = new OperationalRepository(),
    metrics: OperationalMetrics = new OperationalMetrics()
  ) {
    this.repository = repository;
    this.metrics = metrics;
  }

  invalidateCache(): void {
    this.cache = null;
  }

  getMetricsFromSnapshot(
    raw: {
      vehicles?: OperationalDataSnapshot["vehicles"];
      partners?: OperationalDataSnapshot["partners"];
      events?: OperationalDataSnapshot["events"];
      asOfYmd?: string;
    },
    filters: Partial<OperationalFilters> = {}
  ): OperationalMetricsResult {
    const snapshot = this.repository.fromSnapshot(raw);
    const merged: OperationalFilters = { ...DEFAULT_OPS_FILTERS, ...filters };
    const key = [
      (snapshot.vehicles || []).length,
      (snapshot.partners || []).length,
      (snapshot.events || []).length,
      snapshot.asOfYmd || "",
      merged.period,
      merged.financeiraId,
      merged.parceiroId,
      merged.status,
      (merged.search || "").trim().toLowerCase(),
    ].join("|");
    if (this.cache?.key === key) return this.cache.result;
    const result = this.metrics.compute(snapshot, merged);
    this.cache = { key, result };
    return result;
  }
}

export const operationalDashboardService = new OperationalDashboardService();

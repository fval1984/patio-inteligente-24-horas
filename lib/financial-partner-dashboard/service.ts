import { FinancialPartnerMetrics } from "./metrics";
import { FinancialPartnerRepository } from "./repository";
import {
  DEFAULT_FP_FILTERS,
  type FinancialPartnerDataSnapshot,
  type FinancialPartnerFilters,
  type FinancialPartnerMetricsResult,
} from "./types";

type CacheEntry = { key: string; result: FinancialPartnerMetricsResult };

export class FinancialPartnerDashboardService {
  private readonly repository: FinancialPartnerRepository;
  private readonly metrics: FinancialPartnerMetrics;
  private cache: CacheEntry | null = null;

  constructor(
    repository: FinancialPartnerRepository = new FinancialPartnerRepository(),
    metrics: FinancialPartnerMetrics = new FinancialPartnerMetrics()
  ) {
    this.repository = repository;
    this.metrics = metrics;
  }

  invalidateCache(): void {
    this.cache = null;
  }

  getMetricsFromSnapshot(
    raw: {
      vehicles?: FinancialPartnerDataSnapshot["vehicles"];
      partners?: FinancialPartnerDataSnapshot["partners"];
      receivables?: FinancialPartnerDataSnapshot["receivables"];
      events?: FinancialPartnerDataSnapshot["events"];
      asOfYmd?: string;
    },
    filters: Partial<FinancialPartnerFilters> = {}
  ): FinancialPartnerMetricsResult {
    const snapshot = this.repository.fromSnapshot(raw);
    const merged: FinancialPartnerFilters = { ...DEFAULT_FP_FILTERS, ...filters };
    const key = [
      (snapshot.vehicles || []).length,
      (snapshot.partners || []).length,
      (snapshot.receivables || []).length,
      (snapshot.events || []).length,
      snapshot.asOfYmd || "",
      merged.period,
      merged.financeiraId,
      merged.status,
      (merged.search || "").trim().toLowerCase(),
    ].join("|");
    if (this.cache?.key === key) return this.cache.result;
    const result = this.metrics.compute(snapshot, merged);
    this.cache = { key, result };
    return result;
  }
}

export const financialPartnerDashboardService = new FinancialPartnerDashboardService();

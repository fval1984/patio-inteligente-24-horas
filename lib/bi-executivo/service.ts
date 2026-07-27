import { BIMetrics } from "./metrics";
import { BIRepository } from "./repository";
import {
  DEFAULT_BI_FILTERS,
  type BiDataSnapshot,
  type BiFilters,
  type BiMetricsResult,
} from "./types";

type CacheEntry = { key: string; result: BiMetricsResult };

/**
 * BIService — fachada única com cache por snapshot + filtros.
 */
export class BIService {
  private readonly repository: BIRepository;
  private readonly metrics: BIMetrics;
  private cache: CacheEntry | null = null;

  constructor(repository: BIRepository = new BIRepository(), metrics: BIMetrics = new BIMetrics()) {
    this.repository = repository;
    this.metrics = metrics;
  }

  invalidateCache(): void {
    this.cache = null;
  }

  getMetricsFromSnapshot(
    raw: {
      vehicles?: BiDataSnapshot["vehicles"];
      partners?: BiDataSnapshot["partners"];
      receivables?: BiDataSnapshot["receivables"];
      events?: BiDataSnapshot["events"];
      settings?: BiDataSnapshot["settings"];
      asOfYmd?: string;
      metaReceitaMensal?: number | null;
      metaReceitaNome?: string | null;
    },
    filters: Partial<BiFilters> = {}
  ): BiMetricsResult {
    const snapshot = this.repository.fromSnapshot(raw);
    const merged: BiFilters = { ...DEFAULT_BI_FILTERS, ...filters };
    const key = [
      (snapshot.vehicles || []).length,
      (snapshot.partners || []).length,
      (snapshot.receivables || []).length,
      (snapshot.events || []).length,
      snapshot.asOfYmd || "",
      snapshot.settings?.capacidade_patio ?? "",
      snapshot.settings?.metaReceitaMensal ?? "",
      merged.period,
      merged.financeiraId,
      merged.parceiroId,
      merged.cidade,
      merged.estado,
      merged.status,
      merged.tipoVeiculo,
    ].join("|");
    if (this.cache?.key === key) return this.cache.result;
    const result = this.metrics.compute(snapshot, merged);
    this.cache = { key, result };
    return result;
  }
}

export const biService = new BIService();

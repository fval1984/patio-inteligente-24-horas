import type {
  BiDataSnapshot,
  BiPartner,
  BiReceivable,
  BiSettings,
  BiVehicle,
  BiVehicleEvent,
} from "./types";

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export class BIRepository {
  fromSnapshot(input: {
    vehicles?: BiVehicle[] | null;
    partners?: BiPartner[] | null;
    receivables?: BiReceivable[] | null;
    events?: BiVehicleEvent[] | null;
    settings?: BiSettings | null;
    asOfYmd?: string;
    metaReceitaMensal?: number | null;
    metaReceitaNome?: string | null;
  }): BiDataSnapshot {
    const settings: BiSettings = {
      ...(input.settings || {}),
    };
    if (input.metaReceitaMensal != null) settings.metaReceitaMensal = Number(input.metaReceitaMensal) || 0;
    if (input.metaReceitaNome != null) settings.metaReceitaNome = String(input.metaReceitaNome || "");
    return {
      vehicles: asArray<BiVehicle>(input.vehicles),
      partners: asArray<BiPartner>(input.partners),
      receivables: asArray<BiReceivable>(input.receivables),
      events: asArray<BiVehicleEvent>(input.events),
      settings,
      asOfYmd: input.asOfYmd,
    };
  }
}

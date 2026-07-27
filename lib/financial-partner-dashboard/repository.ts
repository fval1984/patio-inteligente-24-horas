import type {
  FinancialPartnerDataSnapshot,
  FpPartner,
  FpReceivable,
  FpVehicle,
  FpVehicleEvent,
} from "./types";

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export class FinancialPartnerRepository {
  fromSnapshot(input: {
    vehicles?: FpVehicle[] | null;
    partners?: FpPartner[] | null;
    receivables?: FpReceivable[] | null;
    events?: FpVehicleEvent[] | null;
    asOfYmd?: string;
  }): FinancialPartnerDataSnapshot {
    return {
      vehicles: asArray<FpVehicle>(input.vehicles),
      partners: asArray<FpPartner>(input.partners),
      receivables: asArray<FpReceivable>(input.receivables),
      events: asArray<FpVehicleEvent>(input.events),
      asOfYmd: input.asOfYmd,
    };
  }
}

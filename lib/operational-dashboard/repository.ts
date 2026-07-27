import type {
  OperationalDataSnapshot,
  OpsPartner,
  OpsVehicle,
  OpsVehicleEvent,
} from "./types";

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export class OperationalRepository {
  fromSnapshot(input: {
    vehicles?: OpsVehicle[] | null;
    partners?: OpsPartner[] | null;
    events?: OpsVehicleEvent[] | null;
    asOfYmd?: string;
  }): OperationalDataSnapshot {
    return {
      vehicles: asArray<OpsVehicle>(input.vehicles),
      partners: asArray<OpsPartner>(input.partners),
      events: asArray<OpsVehicleEvent>(input.events),
      asOfYmd: input.asOfYmd,
    };
  }
}

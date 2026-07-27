/**
 * FinancialRepository — snapshot único em memória (sem SQL por card).
 */

import type {
  FinancialCashMovement,
  FinancialDataSnapshot,
  FinancialPartner,
  FinancialReceivable,
  FinancialVehicle,
} from "./types";

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export class FinancialRepository {
  fromSnapshot(input: {
    receivables?: FinancialReceivable[] | null;
    cash?: FinancialCashMovement[] | null;
    vehicles?: FinancialVehicle[] | null;
    partners?: FinancialPartner[] | null;
    asOfYmd?: string;
  }): FinancialDataSnapshot {
    return {
      receivables: asArray<FinancialReceivable>(input.receivables),
      cash: asArray<FinancialCashMovement>(input.cash),
      vehicles: asArray<FinancialVehicle>(input.vehicles),
      partners: asArray<FinancialPartner>(input.partners),
      asOfYmd: input.asOfYmd,
    };
  }
}

import type {
  AccountsReceivableRecord,
  DailyChargeRecord,
  PaymentRecord,
  RevenueDeductionRecord,
  RevenueRecord,
  Uuid,
  VehicleFinanceSnapshot,
} from "./types";

export interface FinanceCompetencyRepository {
  getVehicleById(userId: Uuid, vehicleId: Uuid): Promise<VehicleFinanceSnapshot | null>;
  listActiveVehicles(userId: Uuid): Promise<VehicleFinanceSnapshot[]>;

  findOpenReceivableByVehicle(userId: Uuid, vehicleId: Uuid): Promise<AccountsReceivableRecord | null>;
  getReceivableById(userId: Uuid, receivableId: Uuid): Promise<AccountsReceivableRecord | null>;
  createReceivable(input: {
    userId: Uuid;
    vehicleId: Uuid;
    cycleStartDate: string;
  }): Promise<AccountsReceivableRecord>;
  updateReceivable(
    userId: Uuid,
    receivableId: Uuid,
    patch: Partial<AccountsReceivableRecord>
  ): Promise<AccountsReceivableRecord>;

  findDailyChargeByVehicleAndDate(userId: Uuid, vehicleId: Uuid, chargeDate: string): Promise<DailyChargeRecord | null>;
  createDailyCharge(input: {
    userId: Uuid;
    vehicleId: Uuid;
    chargeDate: string;
    amount: number;
    receivableId: Uuid;
  }): Promise<DailyChargeRecord>;

  createRevenue(input: {
    userId: Uuid;
    vehicleId: Uuid | null;
    receivableId: Uuid | null;
    revenueDate: string;
    amount: number;
    type: "DAILY_CHARGE" | "DEDUCTION" | "REVERSAL";
    sourceRef?: string | null;
  }): Promise<RevenueRecord>;

  createRevenueDeduction(input: {
    userId: Uuid;
    receivableId: Uuid;
    vehicleId: Uuid | null;
    deductionDate: string;
    amount: number;
    reason: string;
    isFullWaiver: boolean;
  }): Promise<RevenueDeductionRecord>;

  createPayment(input: {
    userId: Uuid;
    receivableId: Uuid;
    paymentDate: string;
    amount: number;
    method: string;
  }): Promise<PaymentRecord>;
}

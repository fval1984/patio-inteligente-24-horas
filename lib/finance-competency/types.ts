export type Uuid = string;

export type ReceivableStatus = "OPEN" | "AWAITING_PAYMENT" | "PAID" | "CLOSED" | "CANCELLED";
export type DailyChargeStatus = "ACTIVE" | "REVERSED";
export type PaymentStatus = "CONFIRMED" | "REVERSED";
export type RevenueType = "DAILY_CHARGE" | "DEDUCTION" | "REVERSAL";

export interface VehicleFinanceSnapshot {
  id: Uuid;
  user_id: Uuid;
  status: string | null;
  data_entrada: string | null;
  data_saida: string | null;
  valor_diaria: number | null;
}

export interface AccountsReceivableRecord {
  id: Uuid;
  user_id: Uuid;
  vehicle_id: Uuid;
  cycle_start_date: string;
  cycle_end_date: string | null;
  gross_amount: number;
  deduction_amount: number;
  net_amount: number;
  paid_amount: number;
  balance_amount: number;
  status: ReceivableStatus;
}

export interface DailyChargeRecord {
  id: Uuid;
  user_id: Uuid;
  vehicle_id: Uuid;
  charge_date: string;
  amount: number;
  accounts_receivable_id: Uuid;
  status: DailyChargeStatus;
}

export interface RevenueRecord {
  id: Uuid;
  user_id: Uuid;
  vehicle_id: Uuid | null;
  accounts_receivable_id: Uuid | null;
  revenue_date: string;
  amount: number;
  type: RevenueType;
  source_ref: string | null;
}

export interface RevenueDeductionRecord {
  id: Uuid;
  user_id: Uuid;
  accounts_receivable_id: Uuid;
  vehicle_id: Uuid | null;
  deduction_date: string;
  amount: number;
  reason: string;
  is_full_waiver: boolean;
}

export interface PaymentRecord {
  id: Uuid;
  user_id: Uuid;
  accounts_receivable_id: Uuid;
  payment_date: string;
  amount: number;
  method: string;
  status: PaymentStatus;
}

export interface GenerateDailyChargesResult {
  generated: boolean;
  charge?: DailyChargeRecord;
  receivable: AccountsReceivableRecord;
  reason?: string;
}

export interface CloseVehicleCycleResult {
  receivable: AccountsReceivableRecord;
  deductionApplied: number;
  fullWaiver: boolean;
}

export interface RegisterPaymentResult {
  payment: PaymentRecord;
  receivable: AccountsReceivableRecord;
}

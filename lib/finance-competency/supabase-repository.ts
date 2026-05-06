import type { SupabaseClient } from "@supabase/supabase-js";
import type { FinanceCompetencyRepository } from "./repository";
import type {
  AccountsReceivableRecord,
  DailyChargeRecord,
  PaymentRecord,
  RevenueDeductionRecord,
  RevenueRecord,
  Uuid,
  VehicleFinanceSnapshot,
} from "./types";

function ensureData<T>(data: T | null, error: { message: string } | null, fallbackMessage: string): T {
  if (error) throw new Error(error.message);
  if (!data) throw new Error(fallbackMessage);
  return data;
}

export class SupabaseFinanceCompetencyRepository implements FinanceCompetencyRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getVehicleById(userId: Uuid, vehicleId: Uuid): Promise<VehicleFinanceSnapshot | null> {
    const { data, error } = await this.supabase
      .from("vehicles")
      .select("id,user_id,status,data_entrada,data_saida,valor_diaria")
      .eq("user_id", userId)
      .eq("id", vehicleId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as VehicleFinanceSnapshot | null) ?? null;
  }

  async listActiveVehicles(userId: Uuid): Promise<VehicleFinanceSnapshot[]> {
    const { data, error } = await this.supabase
      .from("vehicles")
      .select("id,user_id,status,data_entrada,data_saida,valor_diaria")
      .eq("user_id", userId)
      .is("data_saida", null);
    if (error) throw new Error(error.message);
    return (data as VehicleFinanceSnapshot[]) || [];
  }

  async findOpenReceivableByVehicle(userId: Uuid, vehicleId: Uuid): Promise<AccountsReceivableRecord | null> {
    const { data, error } = await this.supabase
      .from("accounts_receivable")
      .select("*")
      .eq("user_id", userId)
      .eq("vehicle_id", vehicleId)
      .in("status", ["OPEN", "AWAITING_PAYMENT"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as AccountsReceivableRecord | null) ?? null;
  }

  async getReceivableById(userId: Uuid, receivableId: Uuid): Promise<AccountsReceivableRecord | null> {
    const { data, error } = await this.supabase
      .from("accounts_receivable")
      .select("*")
      .eq("user_id", userId)
      .eq("id", receivableId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as AccountsReceivableRecord | null) ?? null;
  }

  async createReceivable(input: { userId: Uuid; vehicleId: Uuid; cycleStartDate: string }): Promise<AccountsReceivableRecord> {
    const { data, error } = await this.supabase
      .from("accounts_receivable")
      .insert({
        user_id: input.userId,
        vehicle_id: input.vehicleId,
        cycle_start_date: input.cycleStartDate,
        gross_amount: 0,
        deduction_amount: 0,
        net_amount: 0,
        paid_amount: 0,
        balance_amount: 0,
        status: "OPEN",
      })
      .select("*")
      .single();
    return ensureData(data as AccountsReceivableRecord | null, error, "Falha ao criar conta a receber.");
  }

  async updateReceivable(
    userId: Uuid,
    receivableId: Uuid,
    patch: Partial<AccountsReceivableRecord>
  ): Promise<AccountsReceivableRecord> {
    const { data, error } = await this.supabase
      .from("accounts_receivable")
      .update(patch)
      .eq("user_id", userId)
      .eq("id", receivableId)
      .select("*")
      .single();
    return ensureData(data as AccountsReceivableRecord | null, error, "Falha ao atualizar conta a receber.");
  }

  async findDailyChargeByVehicleAndDate(userId: Uuid, vehicleId: Uuid, chargeDate: string): Promise<DailyChargeRecord | null> {
    const { data, error } = await this.supabase
      .from("daily_charges")
      .select("*")
      .eq("user_id", userId)
      .eq("vehicle_id", vehicleId)
      .eq("charge_date", chargeDate)
      .eq("status", "ACTIVE")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as DailyChargeRecord | null) ?? null;
  }

  async createDailyCharge(input: {
    userId: Uuid;
    vehicleId: Uuid;
    chargeDate: string;
    amount: number;
    receivableId: Uuid;
  }): Promise<DailyChargeRecord> {
    const { data, error } = await this.supabase
      .from("daily_charges")
      .insert({
        user_id: input.userId,
        vehicle_id: input.vehicleId,
        charge_date: input.chargeDate,
        amount: input.amount,
        accounts_receivable_id: input.receivableId,
        status: "ACTIVE",
      })
      .select("*")
      .single();
    return ensureData(data as DailyChargeRecord | null, error, "Falha ao criar diária.");
  }

  async createRevenue(input: {
    userId: Uuid;
    vehicleId: Uuid | null;
    receivableId: Uuid | null;
    revenueDate: string;
    amount: number;
    type: "DAILY_CHARGE" | "DEDUCTION" | "REVERSAL";
    sourceRef?: string | null;
  }): Promise<RevenueRecord> {
    const { data, error } = await this.supabase
      .from("revenue")
      .insert({
        user_id: input.userId,
        vehicle_id: input.vehicleId,
        accounts_receivable_id: input.receivableId,
        revenue_date: input.revenueDate,
        amount: input.amount,
        type: input.type,
        source_ref: input.sourceRef || null,
      })
      .select("*")
      .single();
    return ensureData(data as RevenueRecord | null, error, "Falha ao registrar receita.");
  }

  async createRevenueDeduction(input: {
    userId: Uuid;
    receivableId: Uuid;
    vehicleId: Uuid | null;
    deductionDate: string;
    amount: number;
    reason: string;
    isFullWaiver: boolean;
  }): Promise<RevenueDeductionRecord> {
    const { data, error } = await this.supabase
      .from("revenue_deductions")
      .insert({
        user_id: input.userId,
        accounts_receivable_id: input.receivableId,
        vehicle_id: input.vehicleId,
        deduction_date: input.deductionDate,
        amount: input.amount,
        reason: input.reason,
        is_full_waiver: input.isFullWaiver,
      })
      .select("*")
      .single();
    return ensureData(data as RevenueDeductionRecord | null, error, "Falha ao registrar dedução.");
  }

  async createPayment(input: {
    userId: Uuid;
    receivableId: Uuid;
    paymentDate: string;
    amount: number;
    method: string;
  }): Promise<PaymentRecord> {
    const { data, error } = await this.supabase
      .from("payments")
      .insert({
        user_id: input.userId,
        accounts_receivable_id: input.receivableId,
        payment_date: input.paymentDate,
        amount: input.amount,
        method: input.method,
        status: "CONFIRMED",
      })
      .select("*")
      .single();
    return ensureData(data as PaymentRecord | null, error, "Falha ao registrar pagamento.");
  }
}

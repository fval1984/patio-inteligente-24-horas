import type { FinanceCompetencyRepository } from "./repository";
import type {
  AccountsReceivableRecord,
  CloseVehicleCycleResult,
  GenerateDailyChargesResult,
  RegisterPaymentResult,
  Uuid,
  VehicleFinanceSnapshot,
} from "./types";

function toYmd(input: string | Date): string {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) throw new Error("Data inválida.");
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeAmount(value: number): number {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 0;
  return Number(n.toFixed(2));
}

function ensureVehicleCanAccrue(vehicle: VehicleFinanceSnapshot, chargeDate: string) {
  if (!vehicle.data_entrada) throw new Error("Veículo sem data de entrada.");
  const entryYmd = toYmd(vehicle.data_entrada);
  if (chargeDate < entryYmd) throw new Error("Data da diária anterior à entrada do veículo.");
  if (vehicle.data_saida) {
    const exitYmd = toYmd(vehicle.data_saida);
    if (chargeDate > exitYmd) throw new Error("Veículo já saiu do pátio para a data informada.");
  }
}

export class FinanceCompetencyService {
  constructor(private readonly repo: FinanceCompetencyRepository) {}

  async generateDailyCharges(userId: Uuid, vehicleId: Uuid, referenceDate = new Date()): Promise<GenerateDailyChargesResult> {
    const chargeDate = toYmd(referenceDate);
    const vehicle = await this.repo.getVehicleById(userId, vehicleId);
    if (!vehicle) throw new Error("Veículo não encontrado.");
    ensureVehicleCanAccrue(vehicle, chargeDate);

    const amount = normalizeAmount(vehicle.valor_diaria || 0);
    if (amount <= 0) {
      return { generated: false, reason: "Veículo sem valor de diária válido.", receivable: await this.ensureOpenReceivable(userId, vehicle) };
    }

    const existing = await this.repo.findDailyChargeByVehicleAndDate(userId, vehicleId, chargeDate);
    const receivable = await this.ensureOpenReceivable(userId, vehicle);
    if (existing) {
      return { generated: false, reason: "Diária já gerada para este veículo nesta data.", receivable };
    }

    const charge = await this.repo.createDailyCharge({
      userId,
      vehicleId,
      chargeDate,
      amount,
      receivableId: receivable.id,
    });

    const updated = await this.repo.updateReceivable(userId, receivable.id, {
      gross_amount: normalizeAmount(receivable.gross_amount + amount),
      net_amount: normalizeAmount(receivable.net_amount + amount),
      balance_amount: normalizeAmount(receivable.balance_amount + amount),
      status: "OPEN",
    });

    await this.repo.createRevenue({
      userId,
      vehicleId,
      receivableId: receivable.id,
      revenueDate: chargeDate,
      amount,
      type: "DAILY_CHARGE",
      sourceRef: charge.id,
    });

    return { generated: true, charge, receivable: updated };
  }

  async generateDailyChargesForAllActiveVehicles(userId: Uuid, referenceDate = new Date()) {
    const vehicles = await this.repo.listActiveVehicles(userId);
    const results: GenerateDailyChargesResult[] = [];
    for (const v of vehicles) {
      try {
        const result = await this.generateDailyCharges(userId, v.id, referenceDate);
        results.push(result);
      } catch (error) {
        results.push({
          generated: false,
          reason: error instanceof Error ? error.message : "Falha ao gerar diária.",
          receivable: await this.ensureOpenReceivable(userId, v),
        });
      }
    }
    return results;
  }

  async closeVehicleCycle(
    userId: Uuid,
    vehicleId: Uuid,
    discountAmount = 0,
    isFullWaiver = false,
    closeDate = new Date()
  ): Promise<CloseVehicleCycleResult> {
    const vehicle = await this.repo.getVehicleById(userId, vehicleId);
    if (!vehicle) throw new Error("Veículo não encontrado.");
    const receivable = await this.ensureOpenReceivable(userId, vehicle);
    const closeYmd = toYmd(closeDate);

    const currentBalance = normalizeAmount(receivable.balance_amount);
    if (currentBalance < 0) throw new Error("Saldo inválido em contas a receber.");

    const appliedDeduction = isFullWaiver
      ? currentBalance
      : Math.min(currentBalance, Math.max(0, normalizeAmount(discountAmount)));

    let updated = receivable;
    if (appliedDeduction > 0) {
      await this.repo.createRevenueDeduction({
        userId,
        receivableId: receivable.id,
        vehicleId,
        deductionDate: closeYmd,
        amount: appliedDeduction,
        reason: isFullWaiver ? "ISENCAO_TOTAL" : "DESCONTO_PARCIAL",
        isFullWaiver,
      });
      await this.repo.createRevenue({
        userId,
        vehicleId,
        receivableId: receivable.id,
        revenueDate: closeYmd,
        amount: -appliedDeduction,
        type: "DEDUCTION",
        sourceRef: receivable.id,
      });
    }

    const newDeduction = normalizeAmount(receivable.deduction_amount + appliedDeduction);
    const newNet = normalizeAmount(receivable.gross_amount - newDeduction);
    const newBalance = normalizeAmount(Math.max(0, receivable.balance_amount - appliedDeduction));
    const newStatus = newBalance === 0 ? "CLOSED" : "AWAITING_PAYMENT";

    updated = await this.repo.updateReceivable(userId, receivable.id, {
      cycle_end_date: closeYmd,
      deduction_amount: newDeduction,
      net_amount: newNet,
      balance_amount: newBalance,
      status: newStatus,
    });

    return {
      receivable: updated,
      deductionApplied: appliedDeduction,
      fullWaiver: isFullWaiver && appliedDeduction > 0,
    };
  }

  async registerPayment(
    userId: Uuid,
    receivableId: Uuid,
    amount: number,
    paymentDate = new Date(),
    method = "DINHEIRO"
  ): Promise<RegisterPaymentResult> {
    const receivable = await this.repo.getReceivableById(userId, receivableId);
    if (!receivable) throw new Error("Conta a receber não encontrada.");
    if (receivable.status === "PAID" || receivable.status === "CLOSED") throw new Error("Conta já quitada.");

    const normalizedAmount = normalizeAmount(amount);
    if (normalizedAmount <= 0) throw new Error("Valor de pagamento inválido.");
    if (normalizedAmount > normalizeAmount(receivable.balance_amount)) {
      throw new Error("Pagamento maior que o saldo em aberto.");
    }

    const payment = await this.repo.createPayment({
      userId,
      receivableId,
      amount: normalizedAmount,
      paymentDate: toYmd(paymentDate),
      method,
    });

    const newPaid = normalizeAmount(receivable.paid_amount + normalizedAmount);
    const newBalance = normalizeAmount(receivable.balance_amount - normalizedAmount);
    const newStatus = newBalance === 0 ? "PAID" : "AWAITING_PAYMENT";
    const updated = await this.repo.updateReceivable(userId, receivable.id, {
      paid_amount: newPaid,
      balance_amount: newBalance,
      status: newStatus,
    });

    return { payment, receivable: updated };
  }

  private async ensureOpenReceivable(userId: Uuid, vehicle: VehicleFinanceSnapshot): Promise<AccountsReceivableRecord> {
    const existing = await this.repo.findOpenReceivableByVehicle(userId, vehicle.id);
    if (existing) return existing;
    if (!vehicle.data_entrada) throw new Error("Veículo sem data de entrada.");
    return this.repo.createReceivable({
      userId,
      vehicleId: vehicle.id,
      cycleStartDate: toYmd(vehicle.data_entrada),
    });
  }
}

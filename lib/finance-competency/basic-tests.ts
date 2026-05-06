import { FinanceCompetencyService } from "./service";
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

/**
 * Testes básicos (sem framework) para validar regras críticas do domínio.
 * Execute importando e chamando `runFinanceCompetencyBasicTests()` em ambiente de dev.
 */
export async function runFinanceCompetencyBasicTests() {
  const fake = createFakeRepository();
  const service = new FinanceCompetencyService(fake);
  const userId = "u1";
  const vehicleId = "v1";

  const r1 = await service.generateDailyCharges(userId, vehicleId, "2026-05-01");
  if (!r1.generated) throw new Error("Falha: deveria gerar diária.");

  const r2 = await service.generateDailyCharges(userId, vehicleId, "2026-05-01");
  if (r2.generated) throw new Error("Falha: diária duplicada não pode ser gerada.");

  const close = await service.closeVehicleCycle(userId, vehicleId, 10, false, "2026-05-02");
  if (close.deductionApplied !== 10) throw new Error("Falha: desconto parcial não aplicado corretamente.");

  let overpaidBlocked = false;
  try {
    await service.registerPayment(userId, close.receivable.id, 99999, "2026-05-03");
  } catch {
    overpaidBlocked = true;
  }
  if (!overpaidBlocked) throw new Error("Falha: pagamento acima do saldo deveria ser bloqueado.");
}

function createFakeRepository(): FinanceCompetencyRepository {
  const vehicles: VehicleFinanceSnapshot[] = [
    {
      id: "v1",
      user_id: "u1",
      status: "NO_PATIO",
      data_entrada: "2026-05-01T08:00:00.000Z",
      data_saida: null,
      valor_diaria: 50,
    },
  ];
  const receivables: AccountsReceivableRecord[] = [];
  const dailyCharges: DailyChargeRecord[] = [];
  const revenues: RevenueRecord[] = [];
  const deductions: RevenueDeductionRecord[] = [];
  const payments: PaymentRecord[] = [];
  let seq = 1;
  const next = () => `id_${seq++}`;

  return {
    async getVehicleById(userId: Uuid, vehicleId: Uuid) {
      return vehicles.find((v) => v.user_id === userId && v.id === vehicleId) || null;
    },
    async listActiveVehicles(userId: Uuid) {
      return vehicles.filter((v) => v.user_id === userId && !v.data_saida);
    },
    async findOpenReceivableByVehicle(userId: Uuid, vehicleId: Uuid) {
      return receivables.find((r) => r.user_id === userId && r.vehicle_id === vehicleId && (r.status === "OPEN" || r.status === "AWAITING_PAYMENT")) || null;
    },
    async getReceivableById(userId: Uuid, receivableId: Uuid) {
      return receivables.find((r) => r.user_id === userId && r.id === receivableId) || null;
    },
    async createReceivable(input) {
      const rec: AccountsReceivableRecord = {
        id: next(),
        user_id: input.userId,
        vehicle_id: input.vehicleId,
        cycle_start_date: input.cycleStartDate,
        cycle_end_date: null,
        gross_amount: 0,
        deduction_amount: 0,
        net_amount: 0,
        paid_amount: 0,
        balance_amount: 0,
        status: "OPEN",
      };
      receivables.push(rec);
      return rec;
    },
    async updateReceivable(userId, receivableId, patch) {
      const idx = receivables.findIndex((r) => r.user_id === userId && r.id === receivableId);
      if (idx < 0) throw new Error("Receivable não encontrado.");
      receivables[idx] = { ...receivables[idx], ...patch };
      return receivables[idx];
    },
    async findDailyChargeByVehicleAndDate(userId, vehicleId, chargeDate) {
      return dailyCharges.find((c) => c.user_id === userId && c.vehicle_id === vehicleId && c.charge_date === chargeDate && c.status === "ACTIVE") || null;
    },
    async createDailyCharge(input) {
      const row: DailyChargeRecord = {
        id: next(),
        user_id: input.userId,
        vehicle_id: input.vehicleId,
        charge_date: input.chargeDate,
        amount: input.amount,
        accounts_receivable_id: input.receivableId,
        status: "ACTIVE",
      };
      dailyCharges.push(row);
      return row;
    },
    async createRevenue(input) {
      const row: RevenueRecord = {
        id: next(),
        user_id: input.userId,
        vehicle_id: input.vehicleId,
        accounts_receivable_id: input.receivableId,
        revenue_date: input.revenueDate,
        amount: input.amount,
        type: input.type,
        source_ref: input.sourceRef || null,
      };
      revenues.push(row);
      return row;
    },
    async createRevenueDeduction(input) {
      const row: RevenueDeductionRecord = {
        id: next(),
        user_id: input.userId,
        accounts_receivable_id: input.receivableId,
        vehicle_id: input.vehicleId,
        deduction_date: input.deductionDate,
        amount: input.amount,
        reason: input.reason,
        is_full_waiver: input.isFullWaiver,
      };
      deductions.push(row);
      return row;
    },
    async createPayment(input) {
      const row: PaymentRecord = {
        id: next(),
        user_id: input.userId,
        accounts_receivable_id: input.receivableId,
        payment_date: input.paymentDate,
        amount: input.amount,
        method: input.method,
        status: "CONFIRMED",
      };
      payments.push(row);
      return row;
    },
  };
}

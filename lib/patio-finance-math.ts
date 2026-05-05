/** Lógica alinhada a `public/app.html` (diárias por dia civil local). */

export type PatioVehicle = {
  id: string;
  placa?: string | null;
  marca?: string | null;
  modelo?: string | null;
  status?: string | null;
  valor_diaria?: number | string | null;
  data_entrada?: string | null;
  data_saida?: string | null;
};

export type CashMovement = {
  tipo_conta: string;
  valor?: number | string | null;
  data_movimento?: string | null;
  created_at?: string | null;
};

const VNP_FLOW_STATUSES = ["NO_PATIO", "LIBERACAO_SOLICITADA", "LIBERACAO_CONFIRMADA", "REMocao_CONFIRMADA"];

export function formatBrl(n: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n) || 0);
}

export function toLocalYmd(isoOrDate: string | Date | null | undefined): string {
  if (!isoOrDate) return "";
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function yearMonthFromYmd(ymd: string): string {
  return (ymd || "").slice(0, 7);
}

export function vehicleStayIncludesLocalCalendarDay(vehicle: PatioVehicle, dayYmd: string): boolean {
  if (!vehicle?.data_entrada || !dayYmd) return false;
  const start = toLocalYmd(vehicle.data_entrada);
  if (!start || dayYmd < start) return false;
  if (!vehicle.data_saida) return true;
  const end = toLocalYmd(vehicle.data_saida);
  if (!end) return true;
  return dayYmd <= end;
}

export function calcDiariaValorGeradoNoDiaLocal(vehicle: PatioVehicle, dayYmd: string): number {
  if (!vehicleStayIncludesLocalCalendarDay(vehicle, dayYmd)) return 0;
  const vd = Number(vehicle.valor_diaria);
  if (!vd || vd <= 0) return 0;
  return vd;
}

export function calcTotalVehicle(vehicle: PatioVehicle): number {
  if (!vehicle?.data_entrada || !vehicle?.valor_diaria) return 0;
  const start = new Date(vehicle.data_entrada);
  const end = vehicle.data_saida ? new Date(vehicle.data_saida) : new Date();
  const diffMs = end.getTime() - start.getTime();
  const days = Math.max(1, Math.ceil(diffMs / 86400000));
  return days * Number(vehicle.valor_diaria);
}

export function sumDiariasGeradasNoMes(monthYm: string, vehicles: PatioVehicle[]): number {
  const parts = monthYm.split("-");
  const yy = Number(parts[0]);
  const mm = Number(parts[1]);
  if (!yy || !mm) return 0;
  const last = new Date(yy, mm, 0).getDate();
  let total = 0;
  for (let d = 1; d <= last; d++) {
    const dayYmd = `${yy}-${String(mm).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    for (const v of vehicles) {
      total += calcDiariaValorGeradoNoDiaLocal(v, dayYmd);
    }
  }
  return total;
}

export function sumCashPagamentosNoMes(monthYm: string, cash: CashMovement[]): number {
  return cash
    .filter((m) => {
      const ymd = toLocalYmd(m.data_movimento || m.created_at);
      return ymd && yearMonthFromYmd(ymd) === monthYm && m.tipo_conta === "PAGAR";
    })
    .reduce((s, m) => s + Number(m.valor || 0), 0);
}

export function sumCashPagamentosNoDia(dayYmd: string, cash: CashMovement[]): number {
  return cash
    .filter((m) => m.tipo_conta === "PAGAR" && toLocalYmd(m.data_movimento || m.created_at) === dayYmd)
    .reduce((s, m) => s + Number(m.valor || 0), 0);
}

export function saldoCaixaFromMovements(cash: CashMovement[]): number {
  return cash.reduce((sum, mov) => {
    if (mov.tipo_conta === "PAGAR") return sum - Number(mov.valor || 0);
    return sum + Number(mov.valor || 0);
  }, 0);
}

export function countVeiculosOperacaoPatio(vehicles: PatioVehicle[]): number {
  return vehicles.filter((v) => v.status && VNP_FLOW_STATUSES.includes(v.status)).length;
}

export function formatFinanceExtratoDayLabel(dayYmd: string): string {
  const todayYmd = toLocalYmd(new Date().toISOString());
  if (dayYmd === todayYmd) return "Hoje";
  const [ty, tm, td] = todayYmd.split("-").map((x) => Number(x));
  const prev = new Date(ty, tm - 1, td);
  prev.setDate(prev.getDate() - 1);
  const py = prev.getFullYear();
  const pm = String(prev.getMonth() + 1).padStart(2, "0");
  const pd = String(prev.getDate()).padStart(2, "0");
  if (dayYmd === `${py}-${pm}-${pd}`) return "Ontem";
  const p = dayYmd.split("-");
  if (p.length !== 3) return dayYmd || "—";
  return `${p[2]}/${p[1]}/${p[0]}`;
}

export type DayExtrato = {
  dayYmd: string;
  label: string;
  diarias: number;
  veiculosComDiaria: number;
  despesas: number;
};

export function buildExtratoDays(monthYm: string, vehicles: PatioVehicle[], cash: CashMovement[]): DayExtrato[] {
  const parts = monthYm.split("-");
  const yy = Number(parts[0]);
  const mm = Number(parts[1]);
  if (!yy || !mm) return [];
  const last = new Date(yy, mm, 0).getDate();
  const out: DayExtrato[] = [];
  for (let d = last; d >= 1; d--) {
    const dayYmd = `${yy}-${String(mm).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    let diarias = 0;
    let nv = 0;
    for (const v of vehicles) {
      const val = calcDiariaValorGeradoNoDiaLocal(v, dayYmd);
      if (val > 0) {
        diarias += val;
        nv++;
      }
    }
    const despesas = sumCashPagamentosNoDia(dayYmd, cash);
    if (diarias <= 0 && despesas <= 0) continue;
    out.push({
      dayYmd,
      label: formatFinanceExtratoDayLabel(dayYmd),
      diarias,
      veiculosComDiaria: nv,
      despesas,
    });
  }
  return out;
}

export function vehiclesDiariasNoDia(dayYmd: string, vehicles: PatioVehicle[]): { vehicle: PatioVehicle; val: number }[] {
  const rows: { vehicle: PatioVehicle; val: number }[] = [];
  for (const v of vehicles) {
    const val = calcDiariaValorGeradoNoDiaLocal(v, dayYmd);
    if (val > 0) rows.push({ vehicle: v, val });
  }
  rows.sort((a, b) => String(a.vehicle.placa || "").localeCompare(String(b.vehicle.placa || ""), "pt-BR"));
  return rows;
}

export function currentYearMonthLocal(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
}

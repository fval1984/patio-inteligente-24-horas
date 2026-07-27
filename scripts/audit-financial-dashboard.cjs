/**
 * Smoke test do Dashboard Financeiro (métricas).
 * Executar: node scripts/audit-financial-dashboard.cjs
 */
const path = require("path");
const fs = require("fs");
const vm = require("vm");

const file = path.join(__dirname, "..", "public", "financial-metrics-service.js");
const code = fs.readFileSync(file, "utf8");
const sandbox = { console, window: {} };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const { financialDashboardService } = sandbox;

const today = "2026-07-27";
const snapshot = {
  asOfYmd: today,
  partners: [
    { id: "f1", nome: "Banco Alpha" },
    { id: "f2", nome: "Banco Beta" },
  ],
  vehicles: [
    { id: "v1", placa: "AAA1A11", localizador_id: "f1", responsavel_financeiro_id: "f1", data_saida: "2026-07-10" },
    { id: "v2", placa: "BBB2B22", localizador_id: "f2", responsavel_financeiro_id: "f2", data_saida: "2026-06-15" },
  ],
  receivables: [
    { id: "r1", vehicle_id: "v1", valor: 1500, status: "EM_ABERTO", financeiro_aprovado_contas_receber: true, data_vencimento: "2026-08-10", period_end: "2026-07-10", created_at: "2026-07-10" },
    { id: "r2", vehicle_id: "v2", valor: 800, status: "EM_ABERTO", financeiro_aprovado_contas_receber: true, data_vencimento: "2026-07-01", period_end: "2026-06-15", created_at: "2026-06-15" },
    { id: "r3", vehicle_id: "v1", valor: 1200, status: "PAGO", period_end: "2026-07-05", updated_at: "2026-07-20T12:00:00", created_at: "2026-07-05" },
    { id: "r4", vehicle_id: "v2", valor: 500, status: "CANCELADO", financeiro_aprovado_contas_receber: true, data_vencimento: "2026-09-01" },
    { id: "r5", vehicle_id: "v1", valor: 900, status: "EM_ABERTO", financeiro_aprovado_contas_receber: true, data_vencimento: "2026-07-27", period_end: "2026-07-01" },
  ],
  cash: [
    { id: "c1", conta_id: "r3", tipo_conta: "RECEBER", valor: 1200, data_movimento: "2026-07-20", aprovado_caixa: true },
    { id: "c2", tipo_conta: "ENTRADA", valor: 300, data_movimento: "2026-07-15", aprovado_caixa: true },
    { id: "c3", tipo_conta: "PAGAR", valor: 100, data_movimento: "2026-07-18", aprovado_caixa: true },
  ],
};

const m = financialDashboardService.getMetricsFromSnapshot(snapshot, { period: "month" });
const checks = [];
function assert(name, cond, detail) {
  checks.push({ name, ok: !!cond, detail });
}

assert("contas abertas = 2300 (1500+800, sem cancelado/pago; r5=900 também aberto)", m.kpis.contasAReceber.valor === 3200, m.kpis.contasAReceber);
assert("titulos abertos = 3", m.kpis.contasAReceber.titulos === 3, m.kpis.contasAReceber.titulos);
assert("recebido mes inclui r3", m.kpis.recebimentosMes.valor === 1200, m.kpis.recebimentosMes);
assert("inadimplencia inclui r2 vencido", m.kpis.inadimplencia.valor === 800, m.kpis.inadimplencia);
assert("vencendo hoje = r5", m.alerts.vencendoHoje.count === 1, m.alerts.vencendoHoje);
assert("previsao = r1 futuro", m.kpis.previsaoRecebimento === 1500, m.kpis.previsaoRecebimento);
assert("top financeiras > 0", m.receitaPorFinanceira.length > 0, m.receitaPorFinanceira);
assert("12 meses labels", m.receitaMensal12.labels.length === 12, m.receitaMensal12.labels.length);
assert("fluxo 12", m.fluxo.labels.length === 12, m.fluxo.labels.length);

const failed = checks.filter((c) => !c.ok);
for (const c of checks) console.log(`${c.ok ? "OK" : "FAIL"} — ${c.name}`, c.ok ? "" : c.detail);
if (failed.length) {
  console.error(`\n${failed.length} falha(s)`);
  process.exit(1);
}
console.log("\nDashboard Financeiro — métricas OK.");

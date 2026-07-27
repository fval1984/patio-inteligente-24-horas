/**
 * Teste rápido de consistência do DashboardMetricsService (Node).
 * Executar: node scripts/audit-dashboard-metrics.cjs
 */
/* eslint-disable no-console */
const path = require("path");
const fs = require("fs");
const vm = require("vm");

const file = path.join(__dirname, "..", "public", "dashboard-metrics-service.js");
const code = fs.readFileSync(file, "utf8");
const sandbox = { console, window: {} };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const { dashboardService, auditOperationalConsistency } = sandbox;

const snapshot = {
  vehicles: [
    { id: "1", status: "NO_PATIO", placa: "AAA1A11", localizador_id: "f1", data_entrada: "2026-07-01", vistoria_data: "2026-07-02" },
    { id: "2", status: "NO_PATIO", placa: "BBB2B22", localizador_id: "f1", data_entrada: "2026-07-20" },
    { id: "3", status: "LIBERACAO_SOLICITADA", placa: "CCC3C33", localizador_id: "f2", data_entrada: "2026-06-01", vistoria_data: "2026-06-02" },
    { id: "4", status: "LIBERACAO_CONFIRMADA", placa: "DDD4D44", localizador_id: "f2", data_entrada: "2026-05-01", vistoria_data: "2026-05-02" },
    { id: "5", status: "NO_PATIO", placa: "EEE5E55", localizador_id: "f1", data_entrada: "2026-07-10", vistoria_data: "2026-07-11", nfse_status: "PENDENTE" },
    { id: "6", status: "REMOVIDO", placa: "FFF6F66", localizador_id: "f1", data_entrada: "2026-01-01", data_saida: "2026-07-27" },
  ],
  partners: [
    { id: "f1", nome: "Financeira A" },
    { id: "f2", nome: "Financeira B" },
  ],
  receivables: [
    { id: "r1", vehicle_id: "6", valor: 1000, status: "EM_ABERTO" },
    { id: "r2", vehicle_id: "6", valor: 500, status: "PAGO" },
    { id: "r3", vehicle_id: "6", valor: 200, status: "CANCELADO" },
  ],
  settings: { capacidade_patio: 100 },
  asOfYmd: "2026-07-27",
};

const m = dashboardService.getMetricsFromSnapshot(snapshot, { period: "30d" });

const checks = [];
function assert(name, cond, detail) {
  checks.push({ name, ok: !!cond, detail });
}

assert("veiculosNoPatio = 5", m.kpis.veiculosNoPatio === 5, m.kpis.veiculosNoPatio);
assert("entradasHoje = 0", m.kpis.entradasHoje === 0, m.kpis.entradasHoje);
assert("saidasHoje = 1", m.kpis.saidasHoje === 1, m.kpis.saidasHoje);
assert("financeirasAtivas = 2", m.kpis.financeirasAtivas === 2, m.kpis.financeirasAtivas);
assert("contasAReceber = 1000", m.kpis.contasAReceber === 1000, m.kpis.contasAReceber);
assert("auditOk", m.auditOk === true, m.operacional);
assert(
  "soma operacional",
  auditOperationalConsistency(m.kpis.veiculosNoPatio, m.operacional, { error() {} }),
  m.operacional
);
assert("liberados = 1", m.operacional.liberadosAguardandoRetirada === 1, m.operacional);
assert("autorizacao = 1", m.operacional.aguardandoAutorizacao === 1, m.operacional);
assert("pendencias = 1", m.operacional.pendenciasDocumentais === 1, m.operacional);
assert("vistoria = 1", m.operacional.aguardandoVistoria === 1, m.operacional);
assert("conferencia = 1", m.operacional.aguardandoConferencia === 1, m.operacional);

const failed = checks.filter((c) => !c.ok);
for (const c of checks) {
  console.log(`${c.ok ? "OK" : "FAIL"} — ${c.name}`, c.ok ? "" : c.detail);
}
if (failed.length) {
  console.error(`\n${failed.length} falha(s)`);
  process.exit(1);
}
console.log("\nTodas as validações passaram.");

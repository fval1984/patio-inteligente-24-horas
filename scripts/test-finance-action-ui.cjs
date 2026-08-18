/**
 * Testes da visão financeira orientada a ação.
 * node scripts/test-finance-action-ui.cjs
 */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const root = path.join(__dirname, "..");

function loadIife(relPath, extra = {}) {
  const documentStub = {
    getElementById: () => null,
    createElement: () => ({
      style: {},
      classList: { add() {}, remove() {}, toggle() {} },
      appendChild() {},
      querySelector() {
        return null;
      },
      querySelectorAll() {
        return [];
      },
      setAttribute() {},
      addEventListener() {},
    }),
    head: { appendChild() {} },
    body: { appendChild() {}, addEventListener() {} },
    addEventListener() {},
  };
  const context = {
    console,
    document: documentStub,
    window: {},
    globalThis: {},
    ...extra,
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, relPath), "utf8"), context, { filename: relPath });
  return context;
}

function testMetricsPeriodAndResultado() {
  const ctx = loadIife("public/financial-metrics-service.js");
  const svc = ctx.financialDashboardService;
  const today = "2026-08-18";
  const snapshot = {
    asOfYmd: today,
    partners: [{ id: "f1", nome: "Banco Alpha" }],
    vehicles: [{ id: "v1", placa: "AAA1A11", localizador_id: "f1", data_saida: "2026-08-01", data_entrada: "2026-07-01" }],
    receivables: [
      {
        id: "r1",
        vehicle_id: "v1",
        valor: 1000,
        status: "EM_ABERTO",
        financeiro_aprovado_contas_receber: true,
        data_vencimento: "2026-08-10",
      },
      {
        id: "r2",
        vehicle_id: "v1",
        valor: 400,
        status: "PAGO",
        financeiro_aprovado_contas_receber: true,
        updated_at: "2026-08-18T12:00:00",
      },
    ],
    cash: [
      { id: "c1", conta_id: "r2", tipo_conta: "RECEBER", valor: 400, data_movimento: "2026-08-18" },
      { id: "c2", tipo_conta: "ENTRADA", valor: 100, data_movimento: "2026-08-18" },
      { id: "c3", tipo_conta: "PAGAR", valor: 50, data_movimento: "2026-08-18" },
    ],
  };
  const month = svc.getMetricsFromSnapshot(snapshot, { period: "month" });
  assert.strictEqual(month.kpis.contasAReceber.valor, 1000);
  assert.strictEqual(month.kpis.inadimplencia.valor, 1000, "vencido em 10/08");
  assert.strictEqual(month.kpis.recebidoPeriodo.valor, 400);
  assert.strictEqual(month.kpis.entradasPeriodo, 500);
  assert.strictEqual(month.kpis.saidasPeriodo, 50);
  assert.strictEqual(month.kpis.resultadoPeriodo, 450);
  assert.ok(Array.isArray(month.fluxo.saidas));
  assert.strictEqual(month.fluxo.saidas.length, month.fluxo.entradas.length);
  assert.ok(month.financeirasResumo.some((f) => f.nome === "Banco Alpha" && f.emAberto === 1000));

  const todayM = svc.getMetricsFromSnapshot(snapshot, { period: "today" });
  assert.strictEqual(todayM.range.from, today);
  assert.strictEqual(todayM.kpis.resultadoPeriodo, 450);

  const prev = svc.getMetricsFromSnapshot(snapshot, { period: "prev_month" });
  assert.strictEqual(prev.range.from, "2026-07-01");
  assert.strictEqual(prev.range.to, "2026-07-31");

  const custom = svc.getMetricsFromSnapshot(snapshot, {
    period: "custom",
    customFrom: "2026-08-18",
    customTo: "2026-08-18",
  });
  assert.strictEqual(custom.kpis.entradasPeriodo, 500);
}

function testActionUiRender() {
  const ctx = loadIife("public/finance-action-ui.js");
  const ui = ctx.financeActionUi;
  assert.ok(ui);
  assert.strictEqual(ui.monthLabel("2026-08"), "Agosto 2026");
  let html = "";
  const host = { innerHTML: "" };
  Object.defineProperty(host, "innerHTML", {
    set(v) {
      html = v;
    },
    get() {
      return html;
    },
  });
  ui.renderLaunchCards(
    host,
    [
      {
        title: "Banco XYZ",
        subtitle: "15 veículos • Competência Agosto",
        dueLabel: "Vencimento: 20/08/2026",
        amountLabel: "R$ 12.450,00",
        status: "Vencido",
        statusKind: "late",
        actionIds: ["a", "b"],
        allIds: ["a", "b"],
      },
    ],
    "",
    "receber"
  );
  assert.match(html, /Banco XYZ/);
  assert.match(html, /data-fin-group-receber="a,b"/);
  assert.match(html, /Detalhes/);
  ui.renderFinanceirasTable(
    host,
    [{ id: "f1", nome: "Financeira A", veiculos: 2, aReceberLabel: "R$ 10,00", recebidoLabel: "R$ 4,00", emAbertoLabel: "R$ 6,00" }],
    ""
  );
  assert.match(html, /data-fin-act-financeira="f1"/);
}

function testFilesStayInFinance() {
  const app = fs.readFileSync(path.join(root, "public/app.html"), "utf8");
  assert.match(app, /finance-action-ui\.css\?v=20260818finact1/);
  assert.match(app, /finance-action-ui\.js\?v=20260818finact1/);
  assert.match(app, /data-finance-subview-btn="financeiras"/);
  assert.match(app, /id="finReceberCards"/);
  assert.match(app, /id="finPagarCards"/);
  const dash = fs.readFileSync(path.join(root, "public/financial-dashboard-ui.js"), "utf8");
  assert.match(dash, /A receber/);
  assert.match(dash, /O que precisa da minha atenção/);
  assert.match(dash, /Fluxo de caixa/);
  const mod = fs.readFileSync(path.join(root, "public/finance-module.js"), "utf8");
  assert.match(mod, /financeiras/);
  assert.match(mod, /financePaySelectedGroup/);
  assert.match(mod, /openReceberBaixaModal|data-fin-receber-pg/);
}

let failed = 0;
const tests = [
  ["métricas reais, período e resultado", testMetricsPeriodAndResultado],
  ["cartões e financeiras na UI", testActionUiRender],
  ["alterações só no financeiro", testFilesStayInFinance],
];
for (const [name, fn] of tests) {
  try {
    fn();
    console.log("ok —", name);
  } catch (e) {
    failed += 1;
    console.error("FAIL —", name, e && e.message ? e.message : e);
  }
}
if (failed) process.exit(1);
console.log("Todos os testes da visão financeira passaram.");

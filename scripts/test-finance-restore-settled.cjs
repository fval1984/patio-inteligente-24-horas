/**
 * Testes da auditoria/restauração de baixas (sem I/O).
 * node scripts/test-finance-restore-settled.cjs
 */
"use strict";

const assert = require("assert");
const path = require("path");
const { planFinanceRestoreSettled, toPeriodYmd, RESTORE_SETTLED_CONFIRM } = require(
  path.join(__dirname, "..", "public", "finance-restore-settled-plan.js")
);

function testCutoffDateFromIsoUtcMidnight() {
  assert.strictEqual(toPeriodYmd("2026-07-31T00:00:00.000Z"), "2026-07-31");
}

function testRestoreFromCashNotFromOpenStatus() {
  const plan = planFinanceRestoreSettled({
    vehicles: [{ id: "v1", placa: "ABC1D23", localizador_id: "f1", data_saida: "2026-07-31" }],
    partners: [{ id: "f1", nome: "Banco XYZ" }],
    receivables: [
      {
        id: "r-paid-open",
        vehicle_id: "v1",
        valor: 850,
        status: "EM_ABERTO",
        financeiro_aprovado_contas_receber: true,
        period_end: "2026-07-31",
      },
      {
        id: "r-still-open",
        vehicle_id: "v1",
        valor: 200,
        status: "EM_ABERTO",
        financeiro_aprovado_contas_receber: true,
        period_end: "2026-08-10",
      },
      {
        id: "r-already-ok",
        vehicle_id: "v1",
        valor: 400,
        status: "PAGO",
        period_end: "2026-07-01",
      },
    ],
    payables: [
      { id: "p-open-cash", valor: 1200, status: "EM_ABERTO", fornecedor: "Fornecedor A", descricao: "Guincho" },
      { id: "p-still-open", valor: 90, status: "EM_ABERTO", fornecedor: "Fornecedor B" },
      { id: "p-ok", valor: 50, status: "PAGO", fornecedor: "Fornecedor C" },
    ],
    cash: [
      {
        id: "c1",
        conta_id: "r-paid-open",
        tipo_conta: "RECEBER",
        valor: 850,
        data_movimento: "2026-08-10",
        created_at: "2026-08-10T12:00:00.000Z",
        forma_pagamento: "PIX",
      },
      {
        id: "c2",
        conta_id: "p-open-cash",
        tipo_conta: "PAGAR",
        valor: 1200,
        data_movimento: "2026-08-12",
        created_at: "2026-08-12T15:00:00.000Z",
      },
    ],
  });
  assert.strictEqual(plan.confirm, RESTORE_SETTLED_CONFIRM);
  assert.strictEqual(plan.restoreReceivables.length, 1);
  assert.strictEqual(plan.restoreReceivables[0].id, "r-paid-open");
  assert.strictEqual(plan.restoreReceivables[0].statusCorreto, "PAGO");
  assert.strictEqual(plan.restoreReceivables[0].dataBaixa, "2026-08-10");
  assert.strictEqual(plan.restoreReceivables[0].placa, "ABC1D23");
  assert.strictEqual(plan.restorePayables.length, 1);
  assert.strictEqual(plan.restorePayables[0].id, "p-open-cash");
  assert.strictEqual(plan.restorePayables[0].dataBaixa, "2026-08-12");
  assert.strictEqual(plan.counts.recebiveisInalterados, 2);
  assert.strictEqual(plan.counts.pagaveisInalterados, 2);
  assert.ok(!plan.restoreReceivables.some((r) => r.id === "r-still-open"));
  assert.ok(!plan.restorePayables.some((p) => p.id === "p-still-open"));
}

function testDuplicateOfPaidCycleIsNotMarkedPaid() {
  const plan = planFinanceRestoreSettled({
    vehicles: [{ id: "v1", placa: "XYZ4E56", localizador_id: "f1" }],
    partners: [{ id: "f1", nome: "Banco Alpha" }],
    receivables: [
      { id: "orig", vehicle_id: "v1", valor: 12450, status: "PAGO", period_end: "2026-07-31T00:00:00.000Z" },
      { id: "dup", vehicle_id: "v1", valor: 12450, status: "EM_ABERTO", period_end: "2026-07-31", financeiro_aprovado_contas_receber: true },
    ],
    payables: [],
    cash: [{ id: "c1", conta_id: "orig", tipo_conta: "RECEBER", valor: 12450, data_movimento: "2026-08-10" }],
  });
  assert.strictEqual(plan.restoreReceivables.length, 0, "não marcar duplicata como recebida");
  assert.strictEqual(plan.hideDuplicates.length, 1);
  assert.strictEqual(plan.hideDuplicates[0].id, "dup");
  assert.strictEqual(plan.hideDuplicates[0].acao, "hide_duplicate");
}

function testArchiveAndVehiclePaymentAreEvidence() {
  const plan = planFinanceRestoreSettled({
    vehicles: [
      { id: "v1", placa: "JUL7A31", localizador_id: "f1", data_saida: "2026-07-31", payment_status: "PAGO" },
    ],
    partners: [{ id: "f1", nome: "Banco XYZ" }],
    receivables: [
      { id: "r-arch", vehicle_id: "v1", valor: 500, status: "EM_ABERTO", period_end: "2026-07-28" },
      { id: "r-veh", vehicle_id: "v1", valor: 800, status: "EM_ABERTO", period_end: "2026-07-31" },
    ],
    payables: [],
    cash: [],
    cashArchive: [
      {
        original_id: "old-cash",
        payload: {
          tipo_conta: "RECEBER",
          conta_id: "r-arch",
          valor: 500,
          data_movimento: "2026-07-28",
          created_at: "2026-07-28T12:00:00.000Z",
        },
      },
    ],
  });
  const ids = plan.restoreReceivables.map((r) => r.id).sort();
  assert.deepStrictEqual(ids, ["r-arch", "r-veh"]);
}

function testPaidHistoryAndArchivePlateAreEvidence() {
  const plan = planFinanceRestoreSettled({
    vehicles: [
      { id: "v1", placa: "SNZ7F17", localizador_id: "f1", data_saida: "2026-03-06" },
      { id: "v2", placa: "ABC9Z99", localizador_id: "f1", data_saida: "2026-07-28" },
    ],
    partners: [{ id: "f1", nome: "Banco XYZ" }],
    receivables: [
      { id: "r-hist", vehicle_id: "v1", valor: 900, status: "EM_ABERTO", period_end: "2026-03-06" },
      { id: "r-plate-arch", vehicle_id: "v2", valor: 450, status: "EM_ABERTO", period_end: "2026-07-28" },
      { id: "r-open", vehicle_id: "v2", valor: 80, status: "EM_ABERTO", period_end: "2026-08-10" },
    ],
    payables: [],
    cash: [],
    cashArchive: [
      {
        original_id: "old-cash-2",
        payload: {
          tipo_conta: "RECEBER",
          conta_id: "other-id",
          valor: 450,
          descricao: "Recebimento ABC9Z99",
          data_movimento: "2026-07-30",
          created_at: "2026-07-30T12:00:00.000Z",
        },
      },
    ],
    paidHistory: [{ plate: "SNZ7F17", valor: 900, saidaDate: "2026-03-06", paidDate: "2026-05-04" }],
  });
  const ids = plan.restoreReceivables.map((r) => r.id).sort();
  assert.deepStrictEqual(ids, ["r-hist", "r-plate-arch"]);
  assert.ok(!plan.restoreReceivables.some((r) => r.id === "r-open"));
}

function testCollapsesSameCycleRestoresToOnePaid() {
  const plan = planFinanceRestoreSettled({
    vehicles: [{ id: "v1", placa: "QQJ9G76", localizador_id: "f1", data_saida: "2026-04-23", payment_status: "PAGO" }],
    partners: [{ id: "f1", nome: "Banco Alpha" }],
    receivables: [
      { id: "a", vehicle_id: "v1", valor: 760, status: "EM_ABERTO", period_end: "2026-04-23" },
      { id: "b", vehicle_id: "v1", valor: 760, status: "EM_ABERTO", period_end: "2026-04-23" },
      { id: "c", vehicle_id: "v1", valor: 400, status: "EM_ABERTO", period_end: "2026-04-23" },
    ],
    payables: [],
    cash: [],
    paidHistory: [],
  });
  assert.strictEqual(plan.restoreReceivables.length, 1);
  assert.strictEqual(plan.restoreReceivables[0].id, "a");
  assert.strictEqual(plan.hideDuplicates.length, 2);
}

function testDoesNotInventCashOrPayEverything() {
  const plan = planFinanceRestoreSettled({
    receivables: [
      { id: "open1", vehicle_id: "v1", valor: 10, status: "EM_ABERTO", period_end: "2026-08-05" },
    ],
    payables: [{ id: "openp", valor: 10, status: "EM_ABERTO" }],
    cash: [],
    vehicles: [{ id: "v1", placa: "AAA1A11" }],
  });
  assert.strictEqual(plan.needsRestore, false);
  assert.strictEqual(plan.counts.recebimentosRestaurar, 0);
  assert.strictEqual(plan.counts.pagamentosRestaurar, 0);
}

let failed = 0;
const tests = [
  ["data do ciclo ISO UTC não vira dia anterior", testCutoffDateFromIsoUtcMidnight],
  ["restaura só quem tem evidência de baixa", testRestoreFromCashNotFromOpenStatus],
  ["duplicata do ciclo pago não vira recebida", testDuplicateOfPaidCycleIsNotMarkedPaid],
  ["não marca tudo como pago", testDoesNotInventCashOrPayEverything],
  ["archive e payment_status do veículo são evidência", testArchiveAndVehiclePaymentAreEvidence],
  ["histórico de placa e archive por descrição são evidência", testPaidHistoryAndArchivePlateAreEvidence],
  ["várias duplicatas do mesmo ciclo geram uma baixa só", testCollapsesSameCycleRestoresToOnePaid],
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
console.log("Todos os testes da restauração por evidência passaram.");

/**
 * Regras da fatura agrupada, sem alterar valores originais.
 * Executar: node public/cobranca-faturamento.test.js
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const sandbox = {
  console,
  globalThis: null,
};
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, "cobranca-service.js"), "utf8"), sandbox);

const svc = sandbox.cobrancaService;
assert.ok(svc, "serviço de cobrança carregado");

const zero = svc.paymentSnapshot(1350, 0);
assert.equal(zero.status, "PENDENTE");
assert.equal(zero.saldo, 1350);
assert.equal(zero.recebido, 0);

const parcial = svc.paymentSnapshot(1350, 350);
assert.equal(parcial.status, "PARCIAL");
assert.equal(parcial.saldo, 1000);
assert.equal(parcial.recebido, 350);

const pago = svc.paymentSnapshot(1350, 1350);
assert.equal(pago.status, "PAGO");
assert.equal(pago.saldo, 0);
assert.equal(pago.recebido, 1350);

const excedente = svc.paymentSnapshot(100, 140);
assert.equal(excedente.status, "PAGO");
assert.equal(excedente.recebido, 100);

const linhas = [
  { valor: 450, diarias: 450, outros: 0 },
  { valor: 300, diarias: 0, outros: 300 },
];
const antes = linhas.map((l) => l.valor);
assert.equal(svc.serviceLabel(linhas[0]), "Guarda e custódia");
assert.equal(svc.serviceLabel(linhas[1]), "Serviços e taxas");
assert.deepEqual(linhas.map((l) => l.valor), antes);

const charges = [
  { id: "c1", status: "PENDENTE" },
  { id: "c2", status: "PAGO" },
  { id: "c3", status: "HISTORICO" },
];
const items = [
  { cobranca_id: "c1", receivable_id: "r1" },
  { cobranca_id: "c2", receivable_id: "r2" },
  { cobranca_id: "c3", receivable_id: "r3" },
];
const blocked = svc.receivableIdsInActiveCharges(charges, items);
assert.equal(blocked.has("r1"), true);
assert.equal(blocked.has("r2"), false);
assert.equal(blocked.has("r3"), false);

const lista = [
  { parceiro_nome: "Escritório ABC", identificador: "FAT-000010", busca_texto: "ABC1D23", numero_cobranca: 10, status: "PENDENTE", valor_total: 100, valor_recebido: 0 },
  { parceiro_nome: "Outro", identificador: "FAT-000011", busca_texto: "", numero_cobranca: 11, status: "PAGO", valor_total: 50, valor_recebido: 50 },
];
assert.equal(svc.filterCharges(lista, { bucket: "pendentes", search: "abc1d23" }).length, 1);
assert.equal(svc.filterCharges(lista, { bucket: "recebidos", search: "000011" }).length, 1);
assert.equal(svc.filterCharges(lista, { bucket: "pendentes", search: "outro" }).length, 0);
assert.equal(svc.saldoAposAbatimento(450, 100), 350);
assert.equal(svc.saldoAposAbatimento(450, 0), 450);
assert.equal(svc.saldoAposAbatimento(100, 150), 0);

console.log("cobranca-faturamento.test.js ok");

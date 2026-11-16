/**
 * Distribuição de um pagamento entre vários saldos.
 * Executar: node public/caixa-operacional.test.js
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const sandbox = { console, globalThis: null };
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, "caixa-operacional.js"), "utf8"), sandbox);

const apurar = sandbox.caixaOperacional.apurarMes;
const novembro = apurar("2026-11", {
  payables: [
    { id: "u", descricao: "Água", valor: 200, data_vencimento: "2026-11-10", status: "EM_ABERTO" },
    { id: "out", descricao: "Aluguel", valor: 3000, data_vencimento: "2026-10-05", status: "EM_ABERTO" },
    { id: "nov", descricao: "Aluguel", valor: 3000, data_vencimento: "2026-11-05", status: "EM_ABERTO" },
    { id: "dez", descricao: "Aluguel", valor: 3000, data_vencimento: "2026-12-05", status: "EM_ABERTO" },
    { id: "dup", descricao: "Aluguel", valor: 3000, data_vencimento: "2026-11-05", status: "EM_ABERTO" },
    { id: "fut", descricao: "Internet", valor: 150, data_vencimento: "2027-01-10", status: "EM_ABERTO" },
    { id: "venc", descricao: "Energia", valor: 400, data_vencimento: "2026-11-08", status: "EM_ABERTO" },
    { id: "ant", descricao: "Aluguel", valor: 3000, data_vencimento: "2026-10-05", status: "PAGO", data_pagamento: "2026-11-03" },
  ],
  cash: [
    { id: "c1", tipo_conta: "SAIDA", valor: 3000, data_movimento: "2026-11-03", conta_id: "ant", excluir_do_saldo: false },
    { id: "c1b", tipo_conta: "SAIDA", valor: 3000, data_movimento: "2026-11-03", conta_id: "ant", excluir_do_saldo: false },
    { id: "c2", tipo_conta: "ENTRADA", valor: 800, data_movimento: "2026-11-15", excluir_do_saldo: false },
    { id: "c3", tipo_conta: "SAIDA", valor: 9000, data_movimento: "2026-10-03", excluir_do_saldo: false },
  ],
});
assert.equal(novembro.aPagar, 3600);
assert.equal(novembro.saidasPagas, 3000);
assert.equal(novembro.entradasRecebidas, 800);
assert.equal(novembro.resultado, -2200);
assert.equal(novembro.abertoTodosMeses, 9750);
const outubro = apurar("2026-10", {
  payables: [
    { id: "ant", descricao: "Aluguel", valor: 3000, data_vencimento: "2026-10-05", status: "PAGO" },
  ],
  cash: [{ id: "c1", tipo_conta: "SAIDA", valor: 3000, data_movimento: "2026-11-03", conta_id: "ant" }],
});
assert.equal(outubro.aPagar, 0);
assert.equal(outubro.saidasPagas, 0);

const alocar = sandbox.caixaOperacional.alocarPagamento;
const plano = alocar(
  [
    { id: "a", saldo: 1000 },
    { id: "b", saldo: 800 },
    { id: "c", saldo: 200 },
  ],
  1500
);
assert.deepEqual(plano, [
  { id: "a", aplicar: 1000 },
  { id: "b", aplicar: 500 },
  { id: "c", aplicar: 0 },
]);

const total = alocar(
  [
    { id: "a", saldo: 350 },
    { id: "b", saldo: 150 },
  ],
  500
);
assert.equal(total.reduce((s, p) => s + p.aplicar, 0), 500);
assert.equal(total[1].aplicar, 150);

const vazio = alocar([{ id: "a", saldo: 80 }], 0);
assert.equal(vazio[0].aplicar, 0);

const byId = {};
function fakeEl(className) {
  const node = {
    className: className || "",
    hidden: false,
    classList: {
      add(c) {
        node.className = `${node.className} ${c}`.trim();
      },
      remove() {},
      contains(c) {
        return node.className.split(/\s+/).includes(c);
      },
    },
    children: [],
    attrs: {},
    _html: "",
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    setAttribute(k, v) {
      this.attrs[k] = v;
    },
    getAttribute(k) {
      return this.attrs[k];
    },
    addEventListener() {},
    remove() {},
    querySelectorAll(sel) {
      if (sel !== ".finance-subview") return [];
      return this.children.filter((c) => String(c.className).includes("finance-subview"));
    },
  };
  Object.defineProperty(node, "innerHTML", {
    get() {
      return node._html;
    },
    set(v) {
      node._html = String(v);
      for (const match of node._html.matchAll(/id="([^"]+)"/g)) {
        if (!byId[match[1]]) byId[match[1]] = fakeEl("");
      }
    },
  });
  return node;
}

const finance = fakeEl("panel");
finance.id = "viewFinanceiro";
const antiga = fakeEl("finance-subview");
finance.children.push(antiga);
byId.viewFinanceiro = finance;
sandbox.state = { receivables: [], cash: [], partners: [], vehicles: [], financeContacts: [] };
const body = fakeEl("body");
sandbox.document = {
  body,
  getElementById(id) {
    if (byId[id]) return byId[id];
    const walk = (n) => {
      if (!n) return null;
      if (n.id === id) return n;
      for (const child of n.children || []) {
        const found = walk(child);
        if (found) return found;
      }
      return null;
    };
    return walk(finance) || walk(body);
  },
  createElement() {
    return fakeEl("");
  },
  querySelectorAll(sel) {
    if (sel === "#viewFinanceiro .finance-subview") return finance.querySelectorAll(".finance-subview");
    return [];
  },
};
vm.runInContext(fs.readFileSync(path.join(__dirname, "cobranca-service.js"), "utf8"), sandbox);

const aberto = sandbox.caixaOperacional.captura("aguardando");
assert.equal(aberto, true);
assert.equal(finance.classList.contains("caixa-op-on"), true);
assert.equal(antiga.hidden, true);
assert.equal(sandbox.caixaOperacional.captura("pix"), false);
assert.equal(sandbox.caixaOperacional.captura("pagar"), false);

setTimeout(() => {
  const metrics = byId.caixaOpMetrics;
  assert.ok(metrics, "indicadores criados");
  assert.match(metrics.innerHTML, /Entradas recebidas/);
  assert.match(metrics.innerHTML, /Saídas pagas/);
  assert.match(metrics.innerHTML, /Total a receber/);
  assert.match(metrics.innerHTML, /Resultado/);
  const raiz = sandbox.document.getElementById("caixaOp");
  assert.match(raiz.innerHTML, /Financeiro/);
  assert.match(raiz.innerHTML, /Novo lançamento/);
  assert.match(raiz.innerHTML, /Movimentações/);
  console.log("caixa-operacional.test.js ok");
}, 30);

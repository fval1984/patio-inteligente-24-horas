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
  assert.match(metrics.innerHTML, /Entradas/);
  assert.match(metrics.innerHTML, /Saídas/);
  assert.match(metrics.innerHTML, /Caixa/);
  const raiz = sandbox.document.getElementById("caixaOp");
  assert.match(raiz.innerHTML, /Nova cobrança/);
  console.log("caixa-operacional.test.js ok");
}, 30);

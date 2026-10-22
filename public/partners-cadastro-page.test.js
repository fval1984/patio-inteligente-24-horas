/**
 * Página individual do parceiro — estrutura única e histórico isolado.
 * node public/partners-cadastro-page.test.js
 */
const assert = require("assert");

function createEl() {
  const node = {
    id: "",
    className: "",
    innerHTML: "",
    dataset: {},
    style: {},
    children: [],
    parentElement: null,
    classList: {
      add() {},
      remove() {},
      toggle() {},
      contains() { return false; },
    },
    appendChild(child) {
      child.parentElement = node;
      node.children.push(child);
      return child;
    },
    querySelector(sel) {
      const id = String(sel || "").replace(/^#/, "");
      return find(node, id);
    },
    addEventListener() {},
    setAttribute() {},
    getAttribute() { return ""; },
    closest() { return null; },
    remove() {},
  };
  return node;
}

function find(node, id) {
  if (!node || !id) return null;
  if (node.id === id) return node;
  const kids = node.children || [];
  for (let i = 0; i < kids.length; i++) {
    const hit = find(kids[i], id);
    if (hit) return hit;
  }
  return null;
}

const root = createEl();
root.id = "partnerCadastroRoot";
global.document = {
  getElementById(id) {
    if (id === "partnerCadastroRoot") return root;
    return find(root, id);
  },
  createElement() {
    return createEl();
  },
  head: { appendChild() {} },
  addEventListener() {},
  querySelector() { return null; },
  querySelectorAll() { return []; },
};
global.isGestorPista = false;
global.isVistoriador = false;
global.isVisualizador = false;
global.__ampliState = {
  partnerManagers: [
    { id: "m1", partner_id: "fin-1", kind: "COBRANCA", name: "Helena", status: "ATIVO", cpf: "", phone: "119999", email: "h@x.com", role_title: "Cobrança" },
    { id: "m2", partner_id: "lei-1", kind: "CARTEIRA", name: "Igor", status: "ATIVO", cpf: "", phone: "", email: "", role_title: "Carteira" },
  ],
};

require("./partners-cadastro-service.js");
require("./partner-managers-service.js");
require("./partners-cadastro-ui.js");

const fin = {
  id: "fin-1",
  nome: "Financeira Norte",
  tipo: "INSTITUICAO_FINANCEIRA",
  cpf: "11222333000181",
  telefone: "1133334444",
  cidade: "Recife",
  estado: "PE",
  status: "ATIVO",
  historico: [{ data: "01/03/2026", hora: "09:00", acao: "Cadastro", detalhe: "Criada", usuario: "ana@patio" }],
};
const otherPlate = "ZZZ9Z99";
global.__ampliState.partners = [fin];

function htmlOf(partner, options) {
  root.children = [];
  global.openPartnerDetailPage(partner, Object.assign({
    state: {
      partners: [partner],
      vehicles: [
        { id: "v1", financeira_id: "fin-1", leiloeiro_id: "lei-1", patio_parceiro_id: "pat-1", localizador_id: "loc-1", placa: "ABC1D23", marca: "Fiat", modelo: "Argo", status: "NO_PATIO", data_entrada: "2026-03-01T10:00:00" },
        { id: "v2", financeira_id: "fin-2", placa: otherPlate, marca: "VW", modelo: "Gol", status: "REMOVIDO", data_entrada: "2026-04-01", data_saida: "2026-04-10" },
      ],
      receivables: [{ id: "r1", vehicle_id: "v1", status: "PAGO", valor: 80, faturado_em: "2026-03-20" }],
    },
  }, options || {}));
  const page = root.children[0];
  assert.ok(page, "página criada");
  return page.innerHTML;
}

const finHtml = htmlOf(fin);
assert.ok(finHtml.indexOf("Financeira Norte") >= 0, "nome");
assert.ok(finHtml.indexOf("11222333000181") >= 0, "cnpj");
assert.ok(finHtml.indexOf("data-pc-page=\"voltar\"") >= 0, "voltar");
assert.ok(finHtml.indexOf("Gestores de Cobrança") >= 0, "gestores de cobrança");
assert.ok(finHtml.indexOf("Helena") >= 0, "gestor vinculado");
assert.ok(finHtml.indexOf("Gestores de Carteira") < 0, "financeira não ganha carteira");
assert.ok(finHtml.indexOf("ABC1D23") >= 0, "veículo próprio");
assert.ok(finHtml.indexOf(otherPlate) < 0, "não mistura outra financeira");
assert.ok(finHtml.indexOf("Alteração cadastral") >= 0, "histórico cadastral");
assert.ok(finHtml.indexOf("Faturamento") >= 0, "faturamento");

const leiHtml = htmlOf({ id: "lei-1", nome: "Leiloeiro Alfa", tipo: "LEILOEIRO", cpf: "123", status: "ATIVO" });
assert.ok(leiHtml.indexOf("Leiloeiro Alfa") >= 0, "leiloeiro");
assert.ok(leiHtml.indexOf("Gestores de Carteira") >= 0, "carteira do leiloeiro");
assert.ok(leiHtml.indexOf("Igor") >= 0, "gestor do leiloeiro");
assert.ok(leiHtml.indexOf("Helena") < 0, "não mostra gestor de outra empresa");
assert.ok(leiHtml.indexOf("ABC1D23") >= 0, "veículo do leiloeiro");
assert.ok(leiHtml.indexOf(otherPlate) < 0, "leiloeiro sem a outra placa");

const patHtml = htmlOf({ id: "pat-1", nome: "Pátio Central", tipo: "PATIO_APREENSAO", status: "ATIVO" });
assert.ok(patHtml.indexOf("Pátio Central") >= 0 && patHtml.indexOf("ABC1D23") >= 0, "pátio");
assert.ok(patHtml.indexOf(otherPlate) < 0, "pátio isolado");

const locHtml = htmlOf({ id: "loc-1", nome: "Localizador Sul", tipo: "LOCALIZADOR", status: "ATIVO" });
assert.ok(locHtml.indexOf("Localizador Sul") >= 0 && locHtml.indexOf("ABC1D23") >= 0, "localizador");
assert.ok(locHtml.indexOf(otherPlate) < 0, "localizador isolado");

const empHtml = htmlOf(
  { id: "reb-1", nome: "Guinchos Alfa", tipo: "EMPRESA_REBOQUE", cpf: "99888777000100", status: "ATIVO", perfil: { responsavel: "Marta" } },
  {
    kind: "EMPRESA",
    trucks: [{ placa: "RTT1A23", modelo: "Prancha", status: "ATIVO" }],
    drivers: [{ nome: "Pedro", cpf: "111", status: "ATIVO" }],
    towServices: [{ id: "s1", partner_id: "reb-1", placa_veiculo: "ABC1D23", data_remocao: "2026-05-01", registrado_por: "Marina" }, { id: "s2", partner_id: "reb-2", placa_veiculo: "DEF2E34", data_remocao: "2026-05-02" }],
  }
);
assert.ok(empHtml.indexOf("Guinchos Alfa") >= 0, "empresa");
assert.ok(empHtml.indexOf("Marta") >= 0, "responsável");
assert.ok(empHtml.indexOf("Pedro") >= 0, "motorista da empresa");
assert.ok(empHtml.indexOf("RTT1A23") >= 0, "caminhão");
assert.ok(empHtml.indexOf("Marina") >= 0, "remoção da empresa");
assert.ok(empHtml.indexOf("DEF2E34") < 0, "empresa não vê remoção do autônomo");

const autHtml = htmlOf(
  { id: "reb-2", nome: "João Reboque", tipo: "REBOQUEIRO_AUTONOMO", status: "ATIVO", perfil: { tipo_pessoa: "PF", nome_empresarial: "" } },
  {
    kind: "AUTONOMO",
    trucks: [{ placa: "AUT9B88", modelo: "Asa", status: "ATIVO" }],
    drivers: [{ nome: "Não deve aparecer", cpf: "000", status: "ATIVO" }],
    towServices: [{ id: "s2", partner_id: "reb-2", placa_veiculo: "DEF2E34", data_remocao: "2026-05-02", registrado_por: "João" }, { id: "s1", partner_id: "reb-1", placa_veiculo: "ABC1D23", data_remocao: "2026-05-01" }],
  }
);
assert.ok(autHtml.indexOf("João Reboque") >= 0, "autônomo");
assert.ok(autHtml.indexOf("Pessoa física") >= 0, "tipo de prestador");
assert.ok(autHtml.indexOf("AUT9B88") >= 0, "caminhão do autônomo");
assert.ok(autHtml.indexOf("Motoristas") < 0, "autônomo não lista motoristas de empresa");
assert.ok(autHtml.indexOf("DEF2E34") >= 0, "remoção do autônomo");
assert.ok(autHtml.indexOf("Marina") < 0, "não mistura responsável da empresa");

global.isVisualizador = true;
const locked = htmlOf(fin);
assert.ok(locked.indexOf("data-pc-page=\"editar\"") < 0, "visualizador não edita");
assert.ok(locked.indexOf("Adicionar Gestor") < 0, "visualizador não adiciona gestor");
assert.ok(locked.indexOf("Faturamento") < 0, "visualizador não vê faturamento");
assert.ok(locked.indexOf("ABC1D23") >= 0, "visualizador ainda consulta o veículo");

console.log("partners-cadastro-page.test.js ok");

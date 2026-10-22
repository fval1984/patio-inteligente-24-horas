/**
 * Histórico do parceiro — só o vínculo da categoria, sem misturar cadastros.
 * node public/partners-cadastro-service.test.js
 */
const svc = require("./partners-cadastro-service.js");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const fin = { id: "fin-1", nome: "Financeira Norte", tipo: "INSTITUICAO_FINANCEIRA", historico: [{ data: "01/03/2026", hora: "09:00", acao: "Cadastro", detalhe: "Criada", usuario: "ana@patio" }] };
const fin2 = { id: "fin-2", nome: "Financeira Sul", tipo: "INSTITUICAO_FINANCEIRA", historico: [{ data: "02/03/2026", hora: "10:00", acao: "Atualização", detalhe: "Outra", usuario: "bruno@patio" }] };
const lei = { id: "lei-1", nome: "Leiloeiro Alfa", tipo: "LEILOEIRO" };
const pat = { id: "pat-1", nome: "Pátio Central", tipo: "PATIO_APREENSAO" };
const loc = { id: "loc-1", nome: "Localizador Sul", tipo: "LOCALIZADOR" };
const emp = { id: "reb-1", nome: "Reboque Empresa", tipo: "EMPRESA_REBOQUE" };
const aut = { id: "reb-2", nome: "Reboqueiro João", tipo: "REBOQUEIRO_AUTONOMO" };

const v1 = {
  id: "v1",
  financeira_id: "fin-1",
  leiloeiro_id: "lei-1",
  patio_parceiro_id: "pat-1",
  localizador_id: "loc-1",
  placa: "ABC1D23",
  marca: "Fiat",
  modelo: "Argo",
  status: "NO_PATIO",
  data_entrada: "2026-03-01T10:00:00",
  vistoria_data: "2026-03-02T08:00:00",
  vistoria_responsavel: "Carlos",
};
const v2 = {
  id: "v2",
  financeira_id: "fin-2",
  patio_parceiro_id: "pat-2",
  placa: "ZZZ9Z99",
  marca: "VW",
  modelo: "Gol",
  status: "REMOVIDO",
  data_entrada: "2026-04-01T09:00:00",
  data_saida: "2026-04-10T18:00:00",
};

const receivables = [
  { id: "r1", vehicle_id: "v1", status: "PAGO", valor: 80, faturado_em: "2026-03-20" },
  { id: "r2", vehicle_id: "v2", status: "ABERTO", valor: 30, faturado_em: "2026-04-11" },
];

const tow = [
  { id: "s1", partner_id: "reb-1", data_remocao: "2026-05-01T14:00:00", placa_veiculo: "ABC1D23", origem: "Rua A", destino: "Pátio", registrado_por: "Marina", valor: 250 },
  { id: "s2", partner_id: "reb-2", data_remocao: "2026-05-02T15:00:00", placa_veiculo: "DEF2E34", origem: "Rua B", destino: "Pátio", registrado_por: "João" },
];

const ctx = { vehicles: [v1, v2], receivables: receivables, towServices: tow, seeFinance: true };

function typesOf(partner) {
  return svc.buildPartnerHistory(partner, ctx).rows.map(function (r) { return r.tipo; });
}
function platesOf(partner) {
  return svc.buildPartnerHistory(partner, ctx).rows.map(function (r) { return r.placa; }).filter(Boolean);
}

assert(svc.vehicleBelongsToPartner(fin, v1) === true, "financeira vê o próprio veículo");
assert(svc.vehicleBelongsToPartner(fin, v2) === false, "financeira não vê veículo de outra");
assert(svc.vehicleBelongsToPartner(lei, v1) === true, "leiloeiro pelo leiloeiro_id");
assert(svc.vehicleBelongsToPartner(pat, v1) === true, "pátio pelo patio_parceiro_id");
assert(svc.vehicleBelongsToPartner(pat, v2) === false, "pátio não herda outro pátio");
assert(svc.vehicleBelongsToPartner(loc, v1) === true, "localizador pelo localizador_id");
assert(svc.vehicleBelongsToPartner(loc, v2) === false, "localizador não vê veículo sem vínculo");
assert(svc.vehicleBelongsToPartner(emp, v1) === false, "reboque não usa vínculo de financeira");

const finRows = svc.buildPartnerHistory(fin, ctx);
assert(finRows.vehicles.length === 1 && finRows.vehicles[0].id === "v1", "só o veículo da financeira");
assert(platesOf(fin).indexOf("ZZZ9Z99") === -1, "placa de outra financeira fora");
assert(typesOf(fin).indexOf("Entrada") >= 0, "entrada");
assert(typesOf(fin).indexOf("Permanência") >= 0, "permanência");
assert(typesOf(fin).indexOf("Saída") === -1, "sem saída registrada");
assert(typesOf(fin).indexOf("Faturamento") >= 0, "faturamento do veículo vinculado");
assert(finRows.rows.some(function (r) { return r.tipo === "Faturamento" && String(r.valor) === "80"; }), "valor 80");
assert(!finRows.rows.some(function (r) { return String(r.valor) === "30"; }), "não traz valor de outro veículo");
assert(finRows.rows.some(function (r) { return r.tipo === "Alteração cadastral" && r.responsavel === "ana@patio"; }), "histórico cadastral próprio");
assert(!finRows.rows.some(function (r) { return r.responsavel === "bruno@patio"; }), "não mistura alteração de outra financeira");
assert(finRows.rows.some(function (r) { return r.tipo === "Vistoria" && r.responsavel === "Carlos"; }), "responsável da vistoria");

const fin2Rows = svc.buildPartnerHistory(fin2, ctx);
assert(fin2Rows.vehicles.length === 1 && fin2Rows.vehicles[0].id === "v2", "segunda financeira isolada");
assert(typesOf(fin2).indexOf("Saída") >= 0, "saída registrada");
assert(typesOf(fin2).indexOf("Permanência") === -1, "já saiu");
assert(fin2Rows.rows.some(function (r) { return r.responsavel === "bruno@patio"; }), "alteração da própria financeira");
assert(!fin2Rows.rows.some(function (r) { return r.responsavel === "ana@patio"; }), "não herda cadastro alheio");

assert(platesOf(lei).indexOf("ZZZ9Z99") === -1, "leiloeiro não vê placa sem vínculo");
assert(platesOf(pat).every(function (placa) { return placa === "ABC1D23"; }), "pátio só a placa vinculada");
assert(svc.buildPartnerHistory(loc, ctx).vehicles.length === 1, "localizador um veículo");

const hidden = svc.buildPartnerHistory(fin, Object.assign({}, ctx, { seeFinance: false }));
assert(!hidden.rows.some(function (r) { return r.tipo === "Faturamento"; }), "sem faturamento quando o perfil não vê valores");

const empHist = svc.buildPartnerHistory(emp, ctx);
assert(empHist.vehicles.length === 0, "empresa de reboque não lista veículos de outras categorias");
assert(empHist.rows.filter(function (r) { return r.tipo === "Remoção"; }).length === 1, "uma remoção da empresa");
assert(empHist.rows.some(function (r) { return r.placa === "ABC1D23" && r.responsavel === "Marina"; }), "remoção da empresa");
assert(!empHist.rows.some(function (r) { return r.placa === "DEF2E34"; }), "não mistura reboqueiro autônomo");

const autHist = svc.buildPartnerHistory(aut, ctx);
assert(autHist.rows.filter(function (r) { return r.tipo === "Remoção"; }).length === 1, "remoção do autônomo");
assert(autHist.rows.some(function (r) { return r.placa === "DEF2E34" && r.responsavel === "João"; }), "responsável da remoção");
assert(!autHist.rows.some(function (r) { return r.placa === "ABC1D23"; }), "autônomo não vê remoção da empresa");

const noMoney = svc.buildPartnerHistory(emp, Object.assign({}, ctx, { seeFinance: false }));
assert(!noMoney.rows.some(function (r) { return String(r.detalhe).indexOf("250") >= 0; }), "valor da remoção oculto sem permissão");

console.log("partners-cadastro-service.test.js ok");

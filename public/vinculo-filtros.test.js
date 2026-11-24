/**
 * Filtros por financeira, escritório, pátio e localizador.
 * node public/vinculo-filtros.test.js
 */
const api = require("./vinculo-filtros.js");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const state = {
  partners: [
    { id: "fin-1", nome: "Banco Norte", tipo: "INSTITUICAO_FINANCEIRA" },
    { id: "fin-2", nome: "Banco Sul", tipo: "FINANCEIRA", ativo: false },
    { id: "pat-1", nome: "Pátio Central", tipo: "PATIO" },
    { id: "loc-1", nome: "Localiza Já", tipo: "LOCALIZADOR" },
    { id: "reb-1", nome: "Reboque Rápido", tipo: "EMPRESA_REBOQUE" },
  ],
  advocacyOffices: [
    { id: "esc-1", name: "Escritório Alfa", active: true },
    { id: "esc-2", name: "Escritório Beta", active: false },
  ],
};

const cat = api.catalog(state);
assert(cat.financeira.map((x) => x.id).join() === "fin-1,fin-2", "financeiras cadastradas");
assert(cat.financeira[1].label.includes("(inativo)"), "financeira inativa continua na lista");
assert(cat.patio.length === 1 && cat.patio[0].nome === "Pátio Central", "pátio");
assert(cat.localizador.length === 1 && cat.localizador[0].id === "loc-1", "localizador não inclui reboque");
assert(cat.escritorio.length === 2, "escritórios");

const todos = api.empty();
const veiculo = {
  id: "v1",
  financeira_id: "fin-1",
  advocacy_office_id: "esc-1",
  patio_parceiro_id: "pat-1",
  localizador_id: "loc-1",
};
assert(api.vehicleMatches(veiculo, todos), "Todos não restringe");
assert(api.vehicleMatches(null, todos), "sem veículo passa quando não há filtro");
assert(api.vehicleMatches(veiculo, { financeira: "fin-1", escritorio: "", patio: "", localizador: "" }), "filtro isolado");
assert(!api.vehicleMatches(veiculo, { financeira: "fin-2", escritorio: "", patio: "", localizador: "" }), "financeira diferente");
assert(
  api.vehicleMatches(veiculo, { financeira: "fin-1", escritorio: "esc-1", patio: "pat-1", localizador: "loc-1" }),
  "filtros em conjunto"
);
assert(
  !api.vehicleMatches(veiculo, { financeira: "fin-1", escritorio: "esc-2", patio: "", localizador: "" }),
  "conjunto exige todos os vínculos"
);
assert(!api.vehicleMatches(null, { financeira: "fin-1", escritorio: "", patio: "", localizador: "" }), "sem vínculo não entra");

const ctx = {
  vehicles: [veiculo, { id: "v2", financeira_id: "fin-2", localizador_id: "loc-1" }],
  towServices: [{ id: "tow-1", vehicle_id: "v1", payable_id: "pag-2" }],
  payables: [],
  receivables: [{ id: "rec-1", vehicle_id: "v1" }],
};
const saidaVinculada = { id: "pag-1", descricao: "Remoção ABC1D23", observacoes: "[[towsvc:tow-1]]" };
const saidaSemVinculo = { id: "pag-3", descricao: "Aluguel", fornecedor: "Imobiliária" };
const filtroFin = { financeira: "fin-1", escritorio: "", patio: "", localizador: "" };
assert(api.payableMatches(saidaVinculada, filtroFin, ctx), "saída com serviço de reboque usa o veículo");
assert(api.payableMatches({ id: "pag-2" }, filtroFin, ctx), "saída ligada pelo payable_id");
assert(!api.payableMatches(saidaSemVinculo, filtroFin, ctx), "saída sem vínculo fica de fora");
assert(api.payableMatches(saidaSemVinculo, todos, ctx), "sem filtro a saída continua na lista");
assert(
  api.payableMatches({ id: "pag-4", financeira_id: "fin-1", localizador_id: "loc-1" }, { ...filtroFin, localizador: "loc-1" }, ctx),
  "vínculo direto na saída"
);

assert(
  api.movementMatches({ tipo_conta: "RECEBER", conta_id: "rec-1" }, filtroFin, ctx),
  "caixa de entrada segue o recebível"
);
assert(
  !api.movementMatches({ tipo_conta: "ENTRADA", conta_id: "" }, filtroFin, ctx),
  "caixa avulso não tem vínculo"
);
assert(
  api.movementMatches({ tipo_conta: "PAGAR", conta_id: "pag-1" }, filtroFin, { ...ctx, payables: [saidaVinculada] }),
  "caixa de saída segue a despesa vinculada"
);
assert(
  api.chargeMatches({ advocacy_office_id: "esc-1" }, [], { financeira: "", escritorio: "esc-1", patio: "", localizador: "" }),
  "fatura de escritório sem veículo"
);
assert(
  !api.chargeMatches({ parceiro_id: "loc-1" }, [veiculo], { financeira: "fin-2", escritorio: "", patio: "", localizador: "" }),
  "veículo da fatura prevalece sobre o cabeçalho"
);

console.log("vinculo-filtros: ok");

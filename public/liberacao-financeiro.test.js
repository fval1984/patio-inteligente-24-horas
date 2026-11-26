const assert = require("assert");
const api = require("./liberacao-financeiro.js");

const veiculo = {
  id: "v1",
  status: "REMOVIDO",
  data_saida: "2026-11-01T15:00:00.000Z",
  responsavel_financeiro_nome: "Oficina Lima",
  placa: "ABC1D23",
};

const ciclo = {
  id: "r1",
  vehicle_id: "v1",
  status: "AGUARDANDO_LANCAMENTO",
  valor: 250,
  period_end: "2026-11-01T15:00:00.000Z",
  responsavel_pagamento: "Oficina Lima",
  observacoes: '[[finmeta:{"origem_modulo":"PATIO_VRP","calculo_patio":{"total":250}}]]Cobrança automática',
};

assert.strictEqual(api.valorALancar(250, 0), 250);
assert.strictEqual(api.valorALancar(180, 0), 180);
assert.strictEqual(api.valorALancar(250, 100), 150);
assert.strictEqual(api.valorALancar(100, 100), 0);

assert.strictEqual(api.vencimentoFaturado("", "2026-11-01"), "2026-11-16");
assert.strictEqual(api.vencimentoFaturado("2026-12-01", "2026-11-01"), "2026-12-01");

assert.strictEqual(api.deveEntrarNaLiberacao(ciclo, 0), true);
assert.strictEqual(api.deveEntrarNaLiberacao(ciclo, 250), false);
assert.strictEqual(
  api.deveEntrarNaLiberacao(
    { ...ciclo, observacoes: '[[finmeta:{"acerto_parcial":true}]]Acerto', responsavel_pagamento: "João" },
    0
  ),
  false
);
assert.strictEqual(api.deveEntrarNaLiberacao({ ...ciclo, status: "PAGO" }, 0), false);

const faturado = api.decidirRecuperacao({ receivable: ciclo, vehicle: veiculo, abatimento: 0 });
assert.strictEqual(faturado.acao, "entradas");
assert.strictEqual(faturado.valor, 250);
assert.strictEqual(faturado.responsavel, "Oficina Lima");
assert.strictEqual(faturado.vencimento, "2026-11-16");
assert.notStrictEqual(faturado.acao, "caixa");

const comData = api.decidirRecuperacao({
  receivable: { ...ciclo, data_vencimento: "2026-11-20" },
  vehicle: veiculo,
  abatimento: 40,
});
assert.strictEqual(comData.acao, "entradas");
assert.strictEqual(comData.valor, 210);
assert.strictEqual(comData.vencimento, "2026-11-20");

const acerto = api.decidirRecuperacao({
  receivable: {
    ...ciclo,
    id: "acerto",
    valor: 80,
    responsavel_pagamento: "Maria",
    observacoes: '[[finmeta:{"acerto_parcial":true,"responsavel_nome":"Maria"}]]',
  },
  vehicle: veiculo,
  abatimento: 0,
});
assert.strictEqual(acerto.acao, "preservar");

const semValor = api.decidirRecuperacao({
  receivable: { ...ciclo, valor: 0, observacoes: "" },
  vehicle: veiculo,
  abatimento: 0,
});
assert.strictEqual(semValor.acao, "conferencia");

const semResponsavel = api.decidirRecuperacao({
  receivable: { ...ciclo, responsavel_pagamento: "" },
  vehicle: { ...veiculo, responsavel_financeiro_nome: "" },
  abatimento: 0,
});
assert.strictEqual(semResponsavel.acao, "conferencia");

const jaReceber = api.decidirRecuperacao({
  receivable: { ...ciclo, status: "EM_ABERTO", financeiro_aprovado_contas_receber: true },
  vehicle: veiculo,
  abatimento: 0,
});
assert.strictEqual(jaReceber.acao, "ja_lancado");

const jaPago = api.decidirRecuperacao({
  receivable: { ...ciclo, status: "PAGO" },
  vehicle: veiculo,
  abatimento: 250,
});
assert.strictEqual(jaPago.acao, "ja_lancado");

const sinalizado = api.decidirRecuperacao({
  receivable: { ...ciclo, meta: { conferencia_manual: true }, observacoes: "" },
  vehicle: veiculo,
  abatimento: 0,
});
assert.strictEqual(sinalizado.acao, "ja_sinalizado");

const cicloAberto = api.decidirRecuperacao({
  receivable: { ...ciclo, status: "EM_ABERTO", period_end: null },
  vehicle: veiculo,
  abatimento: 0,
});
assert.strictEqual(cicloAberto.acao, "ignorar");

const entradas = [
  { id: "mar", origem: "2026-03-02", saldo: 30, venc: "2026-04-01" },
  { id: "jan-b", origem: "2026-01-20", saldo: 15, venc: "2026-02-20" },
  { id: "dez", origem: "2026-12-31", saldo: 5, venc: "2027-01-15" },
  { id: "jan-a", origem: "2026-01-05", saldo: 10, venc: "2026-06-01" },
  { id: "jan27", origem: "2027-01-03", saldo: 7, venc: "2027-01-03" },
  { id: "sem", saldo: 4, venc: "2026-01-01" },
];
const grupos = api.agruparPorMesOrigem(entradas);
assert.deepStrictEqual(
  grupos.grupos.map((g) => g.rotulo),
  ["JANEIRO DE 2026", "MARÇO DE 2026", "DEZEMBRO DE 2026", "JANEIRO DE 2027", "SEM DATA DE ORIGEM"]
);
assert.deepStrictEqual(
  grupos.grupos[0].itens.map((item) => item.id),
  ["jan-a", "jan-b"]
);
assert.strictEqual(grupos.grupos[0].aberto, 25);
assert.strictEqual(grupos.grupos[1].aberto, 30);
assert.strictEqual(grupos.aberto, 71);
assert.ok(!grupos.grupos.some((g) => g.rotulo === "FEVEREIRO DE 2026"));

const pagina = api.faixasVisiveis(entradas, 1);
assert.strictEqual(pagina.grupos.length, 1);
assert.strictEqual(pagina.grupos[0].completo, false);
assert.strictEqual(pagina.grupos[0].itens.length, 1);
assert.strictEqual(pagina.grupos[0].aberto, 25);
assert.strictEqual(pagina.completo, false);
assert.strictEqual(pagina.aberto, 71);

const tres = api.faixasVisiveis(entradas, 3);
assert.strictEqual(tres.grupos[0].rotulo, "JANEIRO DE 2026");
assert.strictEqual(tres.grupos[0].completo, true);
assert.strictEqual(tres.grupos[1].rotulo, "MARÇO DE 2026");
assert.strictEqual(tres.grupos[1].completo, true);

const tudo = api.faixasVisiveis(entradas, 99);
assert.strictEqual(tudo.completo, true);
assert.strictEqual(tudo.grupos.at(-1).rotulo, "SEM DATA DE ORIGEM");

console.log("ok liberacao-financeiro");

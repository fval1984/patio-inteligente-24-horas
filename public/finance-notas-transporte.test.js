/**
 * Gerador de descrição de Notas de Transporte.
 * Executar: node public/finance-notas-transporte.test.js
 */
const assert = require("assert");
const nt = require("./finance-notas-transporte.js");

const sample = nt.buildTexto({
  veiculo: "Fiat Strada",
  placa: "abc1d23",
  data: "11032026",
  origem: "Recife/PE",
  destino: "Olinda/PE",
  valor: "350000",
});

assert.equal(nt.formatPlaca("abc 1d23"), "ABC1D23");
assert.equal(nt.formatDateBr("2026-03-11"), "11/03/2026");
assert.equal(nt.maskDate("11032026"), "11/03/2026");
assert.equal(nt.maskMoney("350000"), "R$ 3.500,00");

assert.match(sample, /Serviço de transporte de veículo automotor por reboque \(guincho\)\./);
assert.match(sample, /Veículo: Fiat Strada Placa: ABC1D23\./);
assert.match(sample, /Data: 11\/03\/2026\./);
assert.match(sample, /Origem: Recife\/PE\./);
assert.match(sample, /Destino: Olinda\/PE\./);
assert.match(sample, /Valor total: R\$ 3\.500,00\./);
assert.match(sample, /Rostan Alexsandro de Albuquerque/);
assert.match(sample, /CNPJ: 17\.402\.374\/0001-36/);
assert.match(sample, /Banco do Brasil \(001\)/);
assert.match(sample, /Agência: 5740-1/);
assert.match(sample, /Conta Corrente: 44\.928-8/);
assert.match(sample, /PIX \(CPF\): 031\.996\.354-31\./);
assert.equal(sample.includes("\n"), false);
assert.equal(sample, nt.buildTexto({
  veiculo: "Fiat Strada",
  placa: "abc1d23",
  data: "11/03/2026",
  origem: "Recife/PE",
  destino: "Olinda/PE",
  valor: "R$ 3.500,00",
}));

const empty = nt.buildTexto({});
assert.match(empty, /Veículo: \[VEÍCULO\] Placa: \[PLACA\]\./);
assert.match(empty, /Valor total: \[VALOR\]\./);
assert.ok(empty.includes(nt.PAYMENT_TEXT));
assert.equal(empty.includes("\n"), false);

console.log("finance-notas-transporte: ok");

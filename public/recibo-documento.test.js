const assert = require("assert");
const { valorPorExtenso, buildReciboAmpliguardSheet } = require("./recibo-documento.js");

const casos = [
  [30, "trinta reais."],
  [60, "sessenta reais."],
  [780, "setecentos e oitenta reais."],
  [1250.5, "mil duzentos e cinquenta reais e cinquenta centavos."],
  [0.5, "cinquenta centavos."],
  [1, "um real."],
  [2, "dois reais."],
  [1.01, "um real e um centavo."],
  [0.01, "um centavo."],
  [100, "cem reais."],
  [101, "cento e um reais."],
  [1100, "mil e cem reais."],
  [1001, "mil e um reais."],
  [1200, "mil e duzentos reais."],
  [2000, "dois mil reais."],
  [21000, "vinte e um mil reais."],
  [1000000, "um milhão de reais."],
  [1000001, "um milhão e um reais."],
  ["1.250,50", "mil duzentos e cinquenta reais e cinquenta centavos."],
  [0, "zero reais."],
];

for (const [valor, esperado] of casos) {
  const obtido = valorPorExtenso(valor);
  assert.strictEqual(obtido, esperado, valor + " → " + obtido);
}

const html = buildReciboAmpliguardSheet({
  numero: "0007/2026",
  nome: "Maria",
  documento: "000.000.000-00",
  endereco: "Rua A",
  cep: "00000-000",
  placa: "ABC1D23",
  veiculo: "Marca/Modelo",
  instituicao: "Banco",
  periodo: "01/01/2026 a 10/01/2026",
  quantidade: "10 diárias",
  valorUnitario: "R$ 78,00",
  valorTotal: "R$ 780,00",
  totalExtenso: valorPorExtenso(780),
});

assert.ok(html.includes("0007/2026"));
assert.ok(html.includes("setecentos e oitenta reais."));
assert.ok(html.includes("RESPONSÁVEL PELO PÁTIO — AMPLIGUARD"));
assert.ok(html.includes("ag-recibo-assinatura-linha"));
assert.ok(html.includes("Maria"));
assert.ok(html.includes("ABC1D23"));

console.log("recibo-documento.test.js OK");

const assert = require("assert");
const { valorPorExtenso, buildReciboAmpliguardSheet, buildReciboCdrBody, buildReciboCdrBlocks, reciboCdrExtraCss } = require("./recibo-documento.js");

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

const obs = "Estadia de 10 dias.\nRemoção inclusa.\n\nCondição: pagamento à vista.";
const recibo = {
  numero: "0012/2026",
  emissao: "23/10/2026",
  nome: "Maria da Silva",
  documento: "123.456.789-00",
  endereco: "Rua A, 10",
  cep: "50000-000",
  rpp: "João",
  placa: "ABC1D23",
  veiculo: "Fiat / Uno",
  cor: "Prata",
  instituicao: "Banco Exemplo",
  entrada: "01/10/2026",
  saida: "10/10/2026",
  periodo: "01/10/2026 a 10/10/2026",
  quantidade: "10 diárias",
  valorUnitario: "R$ 125,05",
  valorTotal: "R$ 1.250,50",
  totalExtenso: valorPorExtenso(1250.5),
  pagamento: ["Favorecido: AMPLIGUARD GUARDA E CUSTODIA DE BENS LTDA", "CNPJ: 57.936.119/0001-98"],
  observacoes: obs,
  responsavelPatioNome: "Carlos Lima",
  responsavelPatioCpf: "529.982.247-25",
};

const corpo = buildReciboCdrBody(recibo, "/assets/ampliguard-marca.png");
assert.ok(corpo.includes('class="ticket cdr-print"'));
assert.ok(corpo.includes('class="logo"'));
assert.ok(corpo.includes('class="title">RECIBO'));
assert.ok(corpo.includes("Nº do recibo: 0012/2026"));
assert.ok(corpo.includes("mil duzentos e cinquenta reais e cinquenta centavos."));
assert.ok(corpo.includes("INFORMAÇÕES ADICIONAIS / OBSERVAÇÕES"));
assert.ok(corpo.includes("Estadia de 10 dias.\nRemoção inclusa."));
assert.ok(corpo.includes("RESPONSÁVEL PELO PÁTIO — AMPLIGUARD"));
assert.ok(corpo.includes("Carlos Lima"));
assert.ok(corpo.includes("529.982.247-25"));
assert.ok(corpo.includes("AMPLIGUARD GUARDA E CUSTODIA DE BENS LTDA"));
assert.ok(corpo.indexOf("INFORMAÇÕES ADICIONAIS") < corpo.indexOf("sign-block"));
assert.ok(!/class="line obs"[^>]*max-height/.test(corpo));
assert.ok(!reciboCdrExtraCss().includes("max-height"));
assert.ok(reciboCdrExtraCss().includes("white-space:pre-wrap"));

const semOpcional = buildReciboCdrBody({ ...recibo, responsavelPatioNome: "", responsavelPatioCpf: "  ", observacoes: "" });
assert.ok(!semOpcional.includes("sign-meta"));
assert.ok(!semOpcional.includes("Carlos Lima"));
assert.ok(semOpcional.includes('class="line obs"'));

const blocos = buildReciboCdrBlocks(recibo);
const textos = blocos.filter((b) => b.kind === "line").map((b) => b.text);
assert.ok(textos.includes("Estadia de 10 dias."));
assert.ok(textos.includes("Remoção inclusa."));
assert.ok(textos.includes("Condição: pagamento à vista."));
assert.ok(blocos.some((b) => b.kind === "gap" && b.mm === 3.2));
assert.ok(blocos.some((b) => b.kind === "rule"));
assert.ok(blocos.some((b) => b.text === "RESPONSÁVEL PELO PÁTIO — AMPLIGUARD"));
const obsIndex = blocos.findIndex((b) => b.text === "INFORMAÇÕES ADICIONAIS / OBSERVAÇÕES");
const signIndex = blocos.findIndex((b) => b.text === "RESPONSÁVEL PELO PÁTIO — AMPLIGUARD");
assert.ok(obsIndex > 0 && signIndex > obsIndex);

console.log("recibo-documento.test.js OK");

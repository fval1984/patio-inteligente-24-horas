const assert = require("assert");
const origem = require("./ficha-tipo2-origem.js");
const print = require("./ficha-tipo2-print.js");

const cheio = origem.origemRows({
  localizadorNome: "Localiza Sul",
  patioNome: "Pátio Central",
  escritorioNome: "Escritório Norte",
  financeiraNome: "Banco Alfa",
});
assert.deepStrictEqual(
  cheio.map((row) => row[0]),
  ["Localizador", "Pátio", "Escritório", "Instituição financeira"]
);

const parcial = origem.origemRows({
  localizadorNome: "Localiza Sul",
  patioNome: "",
  escritorioNome: "—",
  financeiraNome: "Sem financeira informada",
});
assert.deepStrictEqual(parcial, [["Localizador", "Localiza Sul"]]);

assert.deepStrictEqual(origem.origemRows({}), []);
assert.strictEqual(origem.cleanOriginText("Não informado"), "");
assert.strictEqual(origem.cleanOriginText("Escritório removido"), "");
assert.strictEqual(origem.cleanOriginText("Sem escritório informado"), "");

const avulso = origem.origemRows({ quem_trouxe: "João da Silva · (81) 99999-0000" });
assert.deepStrictEqual(avulso, [["Localizador", "João da Silva · (81) 99999-0000"]]);

const cadastrado = origem.origemRows({
  localizadorNome: "Localiza Sul",
  quem_trouxe: "Texto antigo",
});
assert.strictEqual(cadastrado[0][1], "Localiza Sul");

const page = 1000;
assert.strictEqual(print.planFichaPages(800, page, 0, 0).mode, "single");
assert.strictEqual(print.planFichaPages(800, page, 0, 0).scale, 1);

const quase = print.planFichaPages(1200, page, 0, 0);
assert.strictEqual(quase.mode, "single");
assert.ok(quase.scale >= 0.72 && quase.scale < 1);

const longo = print.planFichaPages(2500, page, 800, 400);
assert.strictEqual(longo.mode, "multi");
const pixStart = 800;
const pixEnd = 1200;
const cortou = longo.slices.some((slice) => slice.y < pixEnd && slice.y + slice.h > pixStart && (slice.y > pixStart || slice.y + slice.h < pixEnd));
assert.strictEqual(cortou, false);

const pixAlto = print.planFichaPages(3000, page, 100, 1400);
assert.ok(pixAlto.scale < 1);
const bloco = pixAlto.slices.find((slice) => slice.y <= 100 && slice.y + slice.h >= 1500);
assert.ok(bloco, "bloco Pix cabe inteiro numa página");

console.log("ok ficha-tipo2-origem");

const assert = require("assert");
const ap = require("./acerto-parcial.js");

const vehicle = {
  id: "v1",
  placa: "ABC1D23",
  status: "NO_PATIO",
  data_entrada: "2026-01-01T10:00:00",
  valor_diaria: 30,
  responsavel_financeiro_nome: "Assessoria Jurídica",
  responsavel_financeiro_id: "ass",
};

const agora = new Date("2026-02-10T12:00:00");
const antes = ap.resumo(vehicle, [], agora, []);
assert.strictEqual(antes.diasTotal, 41);
assert.strictEqual(antes.bruto, 1230);
assert.strictEqual(antes.saldoAberto, 1230);
assert.strictEqual(antes.acertado, 0);

const limite = "2026-01-30";
const ok = ap.validar(
  vehicle,
  {
    dataLimite: limite,
    valorAcertado: 900,
    desconto: 0,
    origemEdicao: "valor",
    vencimento: "2026-02-14",
    responsavelNome: "Assessoria Jurídica",
    novoResponsavelNome: "Leiloeiro",
  },
  []
);
assert.strictEqual(ok.ok, true);
assert.strictEqual(ok.periodo.diarias, 30);
assert.strictEqual(ok.original, 900);
assert.strictEqual(ok.valor, 900);
assert.strictEqual(ok.desconto, 0);

const recebivel = {
  id: "r1",
  vehicle_id: "v1",
  valor: 900,
  status: "EM_ABERTO",
  period_start: "2026-01-01T10:00:00",
  period_end: "2026-01-30T23:59:59",
  observacoes: `[[finmeta:${JSON.stringify({
    acerto_parcial: true,
    data_limite: limite,
    periodo_inicio: "2026-01-01",
    diarias: 30,
    valor_original: 900,
    desconto: 0,
    responsavel_nome: "Assessoria Jurídica",
    responsavel_id: "ass",
  })}]] Acerto parcial de estadia`,
};

global.financeMetaUnpack = (obs) => {
  const raw = String(obs || "");
  const start = raw.indexOf("[[finmeta:");
  const end = raw.indexOf("]]");
  if (start < 0 || end < 0) return { meta: {}, text: raw };
  return { meta: JSON.parse(raw.slice(start + 10, end)), text: raw.slice(end + 2).trim() };
};

const depois = ap.resumo(vehicle, [recebivel], agora, []);
assert.strictEqual(depois.acertado, 900);
assert.strictEqual(depois.aReceber, 900);
assert.strictEqual(depois.recebido, 0);
assert.strictEqual(depois.saldoAberto, 330);
assert.strictEqual(depois.bruto, 1230);

const noDiaSeguinte = ap.resumo(vehicle, [recebivel], new Date("2026-02-11T12:00:00"), []);
assert.strictEqual(noDiaSeguinte.bruto, 1260);
assert.strictEqual(noDiaSeguinte.acertado, 900);
assert.strictEqual(noDiaSeguinte.saldoAberto, 360);

const comDesconto = ap.validar(
  vehicle,
  {
    dataLimite: limite,
    valorAcertado: 800,
    desconto: 100,
    origemEdicao: "desconto",
    vencimento: "2026-02-14",
    responsavelNome: "Assessoria Jurídica",
    novoResponsavelNome: "Leiloeiro",
  },
  []
);
assert.strictEqual(comDesconto.ok, true);
assert.strictEqual(comDesconto.desconto, 100);
assert.strictEqual(comDesconto.valor, 800);

const acima = ap.validar(
  vehicle,
  {
    dataLimite: limite,
    valorAcertado: 901,
    desconto: 0,
    origemEdicao: "valor",
    vencimento: "2026-02-14",
    responsavelNome: "Assessoria Jurídica",
    novoResponsavelNome: "Leiloeiro",
  },
  []
);
assert.strictEqual(acima.ok, false);

const negativo = ap.validar(
  vehicle,
  {
    dataLimite: limite,
    valorAcertado: -1,
    origemEdicao: "valor",
    vencimento: "2026-02-14",
    responsavelNome: "Assessoria Jurídica",
    novoResponsavelNome: "Leiloeiro",
  },
  []
);
assert.strictEqual(negativo.ok, false);

const duplicado = ap.validar(
  vehicle,
  {
    dataLimite: limite,
    valorAcertado: 900,
    origemEdicao: "valor",
    vencimento: "2026-02-14",
    responsavelNome: "Assessoria Jurídica",
    novoResponsavelNome: "Leiloeiro",
  },
  [recebivel]
);
assert.strictEqual(duplicado.ok, false);

console.log("acerto-parcial: ok");

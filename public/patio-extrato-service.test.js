/**
 * Extrato do pátio — só veículos com saída no período.
 * node public/patio-extrato-service.test.js
 */
const svc = require("./patio-extrato-service.js");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function vehicle(partial) {
  return Object.assign(
    {
      id: "v1",
      placa: "ABC1D23",
      marca: "Fiat",
      modelo: "Argo",
      status: "REMOVIDO",
      data_entrada: "2026-01-10T10:00:00",
      data_saida: "2026-01-20T18:00:00",
      valor_diaria: 100,
      localizador_id: "reb-1",
      responsavel_financeiro_id: "fin-1",
    },
    partial
  );
}

const partners = [
  { id: "fin-1", nome: "Financeira Norte", tipo: "INSTITUICAO_FINANCEIRA" },
  { id: "reb-1", nome: "Reboque Empresa", tipo: "EMPRESA_REBOQUE" },
];

const jan = { fromYmd: "2026-01-01", toYmd: "2026-01-31" };

const entrouDezSaiuJan = vehicle({
  id: "a",
  placa: "AAA1A11",
  data_entrada: "2025-12-15T09:00:00",
  data_saida: "2026-01-05T12:00:00",
});
const entrouJanSaiuFev = vehicle({
  id: "b",
  placa: "BBB2B22",
  data_entrada: "2026-01-20T09:00:00",
  data_saida: "2026-02-03T12:00:00",
});
const aindaNoPatio = vehicle({
  id: "c",
  placa: "CCC3C33",
  status: "NO_PATIO",
  data_entrada: "2026-01-02T09:00:00",
  data_saida: null,
});
const entrouSaiuJan = vehicle({ id: "d", placa: "DDD4D44" });
const saiuJanAguardandoFat = vehicle({
  id: "e",
  placa: "EEE5E55",
  data_saida: "2026-01-28T11:00:00",
});

const receivables = [
  { id: "r-d", vehicle_id: "d", period_end: "2026-01-20", valor: 1000, status: "PAGO" },
  { id: "r-e", vehicle_id: "e", period_end: "2026-01-28", valor: 800, status: "EM_ABERTO" },
  { id: "r-e-dup", vehicle_id: "e", period_end: "2026-01-28", valor: 800, status: "EM_ABERTO" },
  { id: "r-a", vehicle_id: "a", period_end: "2026-01-05", valor: 2100, status: "EM_ABERTO" },
];

const report = svc.buildExtrato({
  ...jan,
  vehicles: [entrouDezSaiuJan, entrouJanSaiuFev, aindaNoPatio, entrouSaiuJan, saiuJanAguardandoFat],
  receivables,
  partners,
});

assert(report.rows.length === 3, "janeiro deve ter 3 saídas confirmadas");
assert(
  report.rows.some((r) => r.placa === "AAA1A11"),
  "entrou em dezembro e saiu em janeiro deve aparecer"
);
assert(
  !report.rows.some((r) => r.placa === "BBB2B22"),
  "entrou em janeiro e saiu em fevereiro não deve aparecer"
);
assert(
  !report.rows.some((r) => r.placa === "CCC3C33"),
  "veículo ainda no pátio não deve aparecer"
);
assert(
  report.rows.some((r) => r.placa === "DDD4D44"),
  "entrou e saiu em janeiro deve aparecer"
);
assert(
  report.rows.some((r) => r.placa === "EEE5E55"),
  "saída com faturamento pendente deve aparecer"
);
assert(report.rows.filter((r) => r.placa === "EEE5E55").length === 1, "não duplicar veículo");

assert(report.summary.veiculos === 3, "quantidade de veículos");
assert(report.summary.gerado === 3900, "total gerado = 2100+1000+800");
assert(report.summary.recebido === 1000, "pago não deve misturar com em aberto");
assert(report.summary.aguardandoFaturamento === 2900, "em aberto entra como aguardando faturamento");
assert(
  svc.moneyNum(report.summary.recebido + report.summary.aguardandoRecebimento + report.summary.aguardandoFaturamento) ===
    report.summary.gerado,
  "recebido + a receber + a faturar = gerado, sem duplicar"
);

const sorted = report.rows.map((r) => r.saidaYmd);
assert(
  sorted.join(",") === sorted.slice().sort().join(","),
  "ordem cronológica por data de saída"
);

const inclusao = svc.vehicleExitedInPeriod(
  vehicle({ data_saida: "2026-01-31T23:50:00" }),
  "2026-01-01",
  "2026-01-31"
);
assert(inclusao, "último dia do período deve entrar");

const primeiroDia = svc.vehicleExitedInPeriod(
  vehicle({ data_saida: "2026-01-01T00:10:00" }),
  "2026-01-01",
  "2026-01-31"
);
assert(primeiroDia, "primeiro dia do período deve entrar");

console.log("patio-extrato-service.test.js ok");

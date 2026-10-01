/**
 * Relatório detalhado de escritório — só cálculo, sem banco.
 * node public/advocacy-offices-service.test.js
 */
const svc = require("./advocacy-offices-service.js");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const office = { id: "off-1", name: "Escritório Alfa", cnpj: "11222333000181" };
const managers = [
  { id: "g1", office_id: "off-1", name: "Ana", active: true },
  { id: "g2", office_id: "off-1", name: "Bruno", active: false },
];
const partners = [
  { id: "loc", nome: "Remoções Sul" },
  { id: "fin", nome: "Financeira Norte" },
  { id: "pat", nome: "Pátio Central" },
];

function vehicle(extra) {
  return Object.assign(
    {
      id: "v1",
      advocacy_office_id: "off-1",
      advocacy_office_manager_id: "g1",
      localizador_id: "loc",
      responsavel_financeiro_id: "fin",
      patio_parceiro_id: "pat",
      placa: "ABC1D23",
      marca: "Fiat",
      modelo: "Argo",
      cor: "Prata",
      status: "NO_PATIO",
      data_entrada: "2026-03-01",
      data_saida: "",
      valor_diaria: 10,
      observacoes: "Retrovisor",
    },
    extra || {}
  );
}

assert(svc.flowStage({ status: "NO_PATIO" }).code === "VNP", "VNP");
assert(svc.flowStage({ status: "LIBERACAO_SOLICITADA" }).label === "Solicitação de Liberação", "VSL");
assert(svc.flowStage({ status: "LIBERACAO_CONFIRMADA" }).code === "VSC", "VSC");
assert(svc.flowStage({ status: "REMocao_CONFIRMADA" }).code === "VSC", "VSC legado");
assert(svc.flowStage({ status: "REMOVIDO" }).label === "Retirado do Pátio", "VRP");

const filters = { from: "2026-03-01", to: "2026-03-31", officeId: "off-1" };
const report = svc.buildOfficeReport({
  vehicles: [
    vehicle(),
    vehicle({
      id: "v2",
      placa: "FORA1",
      data_entrada: "2025-01-01",
      data_saida: "2025-02-01",
      status: "REMOVIDO",
    }),
    vehicle({ id: "v3", advocacy_office_id: "off-2", placa: "OUTRO" }),
    vehicle({
      id: "v4",
      placa: "SAIU1",
      status: "REMOVIDO",
      data_entrada: "2026-03-10",
      data_saida: "2026-03-12",
      valor_diaria: null,
      cor: "",
      observacoes: "",
    }),
  ],
  offices: [office],
  partners,
  managers,
  receivables: [
    { id: "r1", vehicle_id: "v1", valor: 80, faturado_em: "2026-03-20" },
    { id: "r2", vehicle_id: "v4", valor: 30 },
  ],
  filters,
  eventsByVehicle: { v1: { solicitacao: "2026-03-18", confirmacao: "2026-03-19" } },
  classifyReceivable(r) {
    if (r.id === "r1") {
      return { skip: false, valor: 80, billed: true, received: false, overdue: true, faturadoEm: "2026-03-20", pagoEm: "" };
    }
    return { skip: false, valor: Number(r.valor || 0), billed: false, received: false, overdue: false, faturadoEm: "", pagoEm: "" };
  },
});

assert(report.office.name === "Escritório Alfa", "nome");
assert(report.office.cnpj === "11.222.333/0001-81", "cnpj");
assert(report.office.managers.indexOf("Ana") >= 0 && report.office.managers.indexOf("Bruno (inativo)") >= 0, "gestores");
assert(report.vehicles.length === 2, "só os dois do período e do escritório");
assert(report.vehicles.some((r) => r.placa === "FORA1") === false, "fora do período");
assert(report.summary.veiculos === 2, "total");
assert(report.summary.noPatio === 1, "no pátio");
assert(report.summary.retirados === 1, "retirados");
assert(report.summary.vencido === 80, "vencido real");
assert(report.summary.faturado === 80, "não soma título não faturado");
assert(report.summary.aberto === 80, "em aberto");
assert(report.summary.recebido === 0, "nada recebido");
assert(report.summary.registrosAbertos === 1, "um registro aberto");
assert(report.summary.registrosPagos === 0, "nenhum pago");

const noPatio = report.vehicles.find((r) => r.placa === "ABC1D23");
assert(noPatio.situacao === "VNP — No Pátio", "situação");
assert(noPatio.rppRpv.indexOf("Financeira Norte") >= 0, "RPP");
assert(noPatio.rppRpv.indexOf("Remoções Sul") >= 0, "RPV");
assert(noPatio.patio === "Pátio Central", "pátio");
assert(noPatio.gestor === "Ana", "gestor");
assert(noPatio.dataSolicitacao === "2026-03-18", "solicitação");
assert(noPatio.cor === "Prata", "cor");
assert(noPatio.dias >= 1, "dias");
assert(noPatio.estadia === noPatio.dias * 10, "estadia = dias × diária");

const saida = report.vehicles.find((r) => r.placa === "SAIU1");
assert(saida.cor === "", "cor vazia");
assert(saida.estadia == null, "sem diária não inventa valor");
assert(saida.faturamento === "Não faturado", "não faturado");
assert(saida.pagamento === "—", "sem pagamento");
assert(saida.dias === 2, "dias da estadia encerrada");

const pago = svc.buildOfficeReport({
  vehicles: [vehicle({ id: "vp", status: "REMOVIDO", data_saida: "2026-03-05" })],
  offices: [office],
  partners,
  managers,
  receivables: [{ id: "rp", vehicle_id: "vp", valor: 40 }],
  filters: Object.assign({}, filters, { pagamento: "pago", faturamento: "faturado" }),
  classifyReceivable() {
    return { skip: false, valor: 40, billed: true, received: true, overdue: false, faturadoEm: "2026-03-06", pagoEm: "2026-03-08" };
  },
});
assert(pago.vehicles.length === 1, "filtro pago+faturado");
assert(pago.summary.recebido === 40, "recebido");
assert(pago.summary.aberto === 0, "pago não fica em aberto");
assert(pago.summary.registrosPagos === 1, "registro pago");
assert(pago.vehicles[0].pagoEm[0] === "2026-03-08", "data de pagamento");

const dup = svc.buildOfficeReport({
  vehicles: [vehicle()],
  offices: [office],
  partners,
  managers,
  receivables: [
    { id: "a", vehicle_id: "v1", valor: 10 },
    { id: "b", vehicle_id: "v1", valor: 999 },
  ],
  filters,
  classifyReceivable(r) {
    if (r.id === "b") return { skip: true };
    return { skip: false, valor: 10, billed: true, received: true, overdue: false, faturadoEm: "", pagoEm: "" };
  },
});
assert(dup.summary.faturado === 10, "duplicata ignorada");
assert(dup.summary.recebido === 10, "só o título válido");

const gestor = svc.buildOfficeReport({
  vehicles: [vehicle(), vehicle({ id: "vx", advocacy_office_manager_id: "g2", placa: "BBB0001" })],
  offices: [office],
  partners,
  managers,
  receivables: [],
  filters: Object.assign({}, filters, { managerId: "g2", patioId: "pat", status: "VNP" }),
});
assert(gestor.vehicles.length === 1 && gestor.vehicles[0].placa === "BBB0001", "filtros em conjunto");

console.log("advocacy-offices-service.test.js ok");

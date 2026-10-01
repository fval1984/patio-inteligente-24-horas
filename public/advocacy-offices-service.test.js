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

assert(report.insights.entradas === 2, "entradas do período");
assert(report.insights.saidas === 1, "saídas do período");
assert(report.insights.bands.reduce((s, b) => s + b.quantidade, 0) === 1, "faixas só de quem está no pátio");
assert(report.vehicles[0].lancamentos.length === 1, "lançamento do título");

const linhas = [
  {
    placa: "LONGO",
    stageCode: "VNP",
    situacao: "VNP — No Pátio",
    veiculo: "Fiat Argo",
    gestor: "Ana",
    patio: "Pátio Central",
    dataEntrada: "2026-01-01",
    dataSaida: "",
    dataSolicitacao: "",
    dataConfirmacao: "",
    dias: 40,
    valorDiaria: 10,
    estadia: 400,
    faturado: false,
    recebido: 0,
    aberto: 0,
    vencido: 0,
    lancamentos: [],
  },
  {
    placa: "CURTO",
    stageCode: "VRP",
    situacao: "VRP — Retirado do Pátio",
    veiculo: "VW Gol",
    gestor: "Ana",
    patio: "Pátio Central",
    dataEntrada: "2026-01-10",
    dataSaida: "2026-01-20",
    dataSolicitacao: "2026-01-15",
    dataConfirmacao: "2026-01-18",
    dias: 10,
    valorDiaria: 10,
    estadia: 100,
    faturado: true,
    recebido: 0,
    aberto: 100,
    vencido: 100,
    lancamentos: [{ valor: 100, billed: true, received: false, faturadoEm: "2026-01-25", pagoEm: "" }],
  },
];
const periodo = { from: "2026-01-01", to: "2026-01-31" };
const ins = svc.officeReportInsights({ vehicles: linhas, filters: periodo }, "2026-01-31");
assert(ins.entradas === 2 && ins.saidas === 1, "movimento de janeiro");
assert(ins.mediaDias === 40 && ins.maiorDias === 40, "permanência atual");
assert(ins.geradoPeriodo === 410, "diárias de janeiro");
assert(ins.bands.find((b) => b.id === "31-60").quantidade === 1, "faixa 31 a 60");
assert(ins.bands.find((b) => b.id === "0-10").quantidade === 0, "retirado não entra na faixa");
assert(ins.maiorPermanencia[0].placa === "LONGO", "maior permanência");
assert(ins.etapas.entradaSolicitacao.media === 5 && ins.etapas.entradaSolicitacao.quantidade === 1, "entrada até solicitação");
assert(ins.etapas.solicitacaoConfirmacao.media === 3, "solicitação até confirmação");
assert(ins.etapas.confirmacaoRetirada.media === 2, "confirmação até retirada");
assert(ins.etapas.entradaRetirada.media === 10, "entrada até retirada");
assert(ins.etapas.entradaSolicitacao && ins.atencao.semMovimento.length === 1, "sem solicitação");
assert(ins.atencao.longa.length === 0, "40 dias ainda não é permanência longa");
assert(ins.atencao.vencidos.length === 1 && ins.atencao.abertos.length === 1, "financeiro em atenção");
assert(ins.atencao.aguardandoFaturamento.length === 0, "já faturado não aguarda");

const serie = svc.officeReportTimeline(linhas, periodo, "month", "2026-01-31");
assert(serie.bucket === "month" && serie.points.length === 1, "um mês");
assert(serie.points[0].entradas === 2 && serie.points[0].saidas === 1 && serie.points[0].permanencia === 2, "série de veículos");
assert(serie.points[0].gerado === 410 && serie.points[0].faturado === 100 && serie.points[0].aberto === 100, "série financeira");
assert(serie.points[0].mediaDias === 20, "média de janeiro");

const ordem = svc.sortOfficeReportRows(linhas, { key: "dias", dir: "desc" });
assert(ordem[0].placa === "LONGO", "dias do maior para o menor");
assert(svc.filterOfficeReportDrill(linhas, "band:31-60", periodo)[0].placa === "LONGO", "filtro da faixa");
assert(svc.filterOfficeReportDrill(linhas, "saidas", periodo)[0].placa === "CURTO", "filtro de saídas");
assert(svc.suggestOfficeBucket("2026-01-01", "2026-01-31") === "day", "até 31 dias por dia");
assert(svc.suggestOfficeBucket("2026-01-01", "2026-04-30") === "week", "até 120 dias por semana");
assert(svc.suggestOfficeBucket("2026-01-01", "2026-05-01") === "month", "acima de 120 dias por mês");

console.log("advocacy-offices-service.test.js ok");

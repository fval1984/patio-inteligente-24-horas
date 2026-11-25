/**
 * Vínculo dos relatórios de Localizador, Pátio e Financeira.
 * node public/partner-entity-report-service.test.js
 */
const link = require("./partner-entity-report-service.js");
const offices = require("./advocacy-offices-service.js");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const vehicles = [
  {
    id: "v-loc",
    localizador_id: "loc-1",
    patio_parceiro_id: "pat-1",
    financeira_id: "fin-1",
    responsavel_financeiro_id: "rpf-9",
    advocacy_office_id: "off-1",
    placa: "LOC1A23",
    marca: "Fiat",
    modelo: "Argo",
    status: "NO_PATIO",
    data_entrada: "2026-03-01",
    valor_diaria: 10,
  },
  {
    id: "v-out",
    localizador_id: "loc-2",
    patio_parceiro_id: "pat-2",
    financeira_id: "fin-2",
    responsavel_financeiro_id: "fin-1",
    placa: "OUT1B23",
    marca: "VW",
    modelo: "Gol",
    status: "NO_PATIO",
    data_entrada: "2026-04-02",
    valor_diaria: 12,
  },
];

const loc = link.linkedVehicles(vehicles, "localizadores", "loc-1");
assert(loc.length === 1 && loc[0].id === "v-loc", "localizador usa localizador_id");

const pat = link.linkedVehicles(vehicles, "patios", "pat-1");
assert(pat.length === 1 && pat[0].id === "v-loc", "pátio usa patio_parceiro_id");

const fin = link.linkedVehicles(vehicles, "financeiras", "fin-1");
assert(fin.length === 1 && fin[0].id === "v-loc", "financeira usa financeira_id");

const notRpf = link.linkedVehicles(vehicles, "financeiras", "rpf-9");
assert(notRpf.length === 0, "responsável financeiro não entra como financeira");

const rpfAsFin = link.linkedVehicles(vehicles, "financeiras", "fin-1");
assert(!rpfAsFin.some((v) => v.id === "v-out"), "financeira_id vazio não herda o responsável");

assert(link.linkedVehicles(vehicles, "localizadores", "").length === 0, "sem seleção não lista veículos");
assert(link.linkedVehicles(vehicles, "leiloeiros", "loc-1").length === 0, "aba sem relatório não vincula");

const doc = link.formatDocument("11222333000181");
assert(doc.label === "CNPJ" && doc.value === "11.222.333/0001-81", "CNPJ formatado");
const cpf = link.formatDocument("12345678901");
assert(cpf.label === "CPF" && cpf.value === "123.456.789-01", "CPF formatado");

const filters = link.reportFiltersFor("financeiras", {
  from: "2026-01-01",
  to: "2026-11-25",
  financeiraId: "fin-2",
  patioId: "pat-1",
  officeId: "off-1",
});
assert(filters.financeiraId === "", "filtro secundário de financeira some na própria aba");
assert(filters.patioId === "pat-1" && filters.officeId === "off-1", "demais filtros permanecem");

const patioFilters = link.reportFiltersFor("patios", { patioId: "pat-9", financeiraId: "fin-1" });
assert(patioFilters.patioId === "" && patioFilters.financeiraId === "fin-1", "filtro de pátio some na aba de pátio");

const report = offices.buildOfficeReport({
  vehicles: link.linkedVehicles(vehicles, "localizadores", "loc-1"),
  offices: [{ id: "off-1", name: "Escritório Alfa" }],
  partners: [
    { id: "loc-1", nome: "Localizador Sul" },
    { id: "pat-1", nome: "Pátio Central" },
    { id: "fin-1", nome: "Financeira Norte" },
  ],
  managers: [],
  receivables: [],
  filters: link.reportFiltersFor("localizadores", { from: "2026-01-01", to: "2026-11-25" }),
  patioFallbackName: "",
});
assert(report.vehicles.length === 1, "relatório do localizador traz o veículo vinculado");
assert(report.vehicles[0].placa === "LOC1A23", "placa do veículo vinculado");
assert(report.vehicles[0].patio === "Pátio Central", "pátio real do registro");
assert(report.vehicles[0].financeira === "Financeira Norte", "financeira real do registro");
assert(!report.vehicles.some((r) => r.placa === "OUT1B23"), "veículo de outro localizador fica de fora");

console.log("partner-entity-report-service.test.js ok");

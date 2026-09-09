/**
 * Testes unitários do serviço de gestores (sem banco).
 * node public/partner-managers-service.test.js
 */
const svc = require("./partner-managers-service.js");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const officeA = "off-a";
const officeB = "off-b";
const p1 = "p-1";
const p2 = "p-2";

const list = [
  { id: "1", partner_id: p1, kind: "CARTEIRA", name: "Ana", status: "ATIVO" },
  { id: "2", partner_id: p1, kind: "CARTEIRA", name: "Bruno", status: "INATIVO" },
  { id: "3", partner_id: p1, kind: "COBRANCA", name: "Carla", status: "ATIVO" },
  { id: "4", partner_id: p2, kind: "CARTEIRA", name: "Diego", status: "ATIVO" },
  { id: "5", advocacy_office_id: officeA, kind: "COBRANCA", name: "Elisa", status: "ATIVO" },
  { id: "6", advocacy_office_id: officeB, kind: "COBRANCA", name: "Fabio", status: "ATIVO" },
];

const c1 = svc.countsForPartner(list, p1);
assert(c1.carteira === 2, "p1 deve ter 2 gestores de carteira");
assert(c1.cobranca === 1, "p1 deve ter 1 gestor de cobrança");
assert(svc.countsForPartner(list, p2).carteira === 1, "p2 isolado");
assert(svc.listForParent(list, { partner_id: p1 }, "CARTEIRA").every((m) => m.partner_id === p1), "filtro partner");
assert(svc.listForParent(list, { advocacy_office_id: officeA }, "COBRANCA").length === 1, "cobrança office A");
assert(
  svc.listForParent(list, { advocacy_office_id: officeA }, "COBRANCA")[0].name === "Elisa",
  "não vaza gestor do outro escritório"
);
assert(svc.listForParent(list, { partner_id: p1 }, "CARTEIRA", "bru").length === 1, "pesquisa por nome");

const payload = svc.normalizeManagerPayload({
  name: "  Novo  ",
  cpf: "123.456.789-09",
  kind: "cobranca",
  status: "INATIVO",
});
assert(payload.name === "Novo", "trim nome");
assert(payload.kind === "COBRANCA", "kind");
assert(payload.status === "INATIVO", "status");

const errs = svc.validateManager({ name: "" }, list, { partner_id: p1 }, null);
assert(errs.length > 0, "nome obrigatório");

const ok = svc.validateManager(
  svc.normalizeManagerPayload({ name: "Zeca", kind: "CARTEIRA" }),
  list,
  { partner_id: p1 },
  null
);
assert(ok.length === 0, "payload válido");

console.log("partner-managers-service.test.js: ok");

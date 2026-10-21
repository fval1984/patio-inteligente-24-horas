/**
 * Regras de reboque e transporte. Executar: node public/reboque-transporte-service.test.js
 */
const assert = require("assert");
const svc = require("./reboque-transporte-service.js");

function company(extra) {
  return Object.assign(
    {
      id: "emp-1",
      nome: "Reboque Sul Ltda",
      tipo: "EMPRESA_REBOQUE",
      cpf: "11222333000181",
    },
    extra || {}
  );
}

function autonomo(extra) {
  return Object.assign(
    {
      id: "aut-1",
      nome: "Carlos Souza",
      tipo: "REBOQUEIRO_AUTONOMO",
      cpf: "12345678901",
      perfil: {},
    },
    extra || {}
  );
}

const baseCtx = {
  partners: [company(), autonomo()],
  drivers: [],
  trucks: [],
  vehicles: [{ id: "veh-1", placa: "ABC1D23" }],
};

(function companyRequiresCnpjAndBlocksDuplicate() {
  const missing = svc.validateCompany({ nome: "Nova Empresa", cpf: "123" }, baseCtx);
  assert.strictEqual(missing.ok, false);
  assert.ok(missing.errors.some((e) => /CNPJ/.test(e)));

  const dup = svc.validateCompany(
    { nome: "Outra Razão", cpf: "11.222.333/0001-81" },
    baseCtx
  );
  assert.strictEqual(dup.ok, false);
  assert.ok(dup.errors.some((e) => /CNPJ/.test(e)));

  const ok = svc.validateCompany(
    { nome: "Reboque Norte Ltda", cpf: "99888777000155" },
    baseCtx
  );
  assert.strictEqual(ok.ok, true);
})();

(function twoDriversSameCompanyAndDuplicateCpf() {
  const ctx = {
    partners: baseCtx.partners,
    drivers: [{ id: "d1", nome: "Ana", cpf: "11122233344", company_partner_id: "emp-1" }],
    trucks: [{ id: "t1", owner_partner_id: "emp-1", placa: "RTP1A23" }],
  };
  const first = svc.validateDriver(
    { nome: "Bruno Lima", cpf: "55566677788", company_partner_id: "emp-1", habitual_truck_id: "t1" },
    ctx
  );
  assert.strictEqual(first.ok, true);
  const dup = svc.validateDriver(
    { nome: "Outra Pessoa", cpf: "111.222.333-44", company_partner_id: "emp-1" },
    ctx
  );
  assert.strictEqual(dup.ok, false);
  const otherCompanyTruck = svc.validateDriver(
    {
      nome: "Bruno Lima",
      cpf: "55566677788",
      company_partner_id: "emp-1",
      habitual_truck_id: "t-outra",
    },
    {
      partners: ctx.partners,
      drivers: [],
      trucks: [{ id: "t-outra", owner_partner_id: "aut-1", placa: "XXX1A23" }],
    }
  );
  assert.strictEqual(otherCompanyTruck.ok, false);
})();

(function autonomousPfDoesNotNeedCnpjAndPjDoes() {
  const pf = svc.validateAutonomous(
    { nome: "João Autônomo", tipo_pessoa: "PF", cpf_pessoa: "98765432100" },
    { partners: [], drivers: [] }
  );
  assert.strictEqual(pf.ok, true);

  const pj = svc.validateAutonomous(
    { nome: "João Transportes", tipo_pessoa: "PJ", cnpj: "123" },
    { partners: [], drivers: [] }
  );
  assert.strictEqual(pj.ok, false);
  assert.ok(pj.errors.some((e) => /CNPJ/.test(e)));

  const pjOk = svc.validateAutonomous(
    { nome: "João Transportes", tipo_pessoa: "PJ", cnpj: "44555666000199", cpf_pessoa: "98765432100" },
    { partners: [], drivers: [] }
  );
  assert.strictEqual(pjOk.ok, true);
})();

(function serviceLinksExistingVehicleAndDoesNotPayDriver() {
  const ctx = Object.assign({}, baseCtx, {
    drivers: [{ id: "d1", nome: "Ana Motorista", company_partner_id: "emp-1" }],
    trucks: [{ id: "t1", owner_partner_id: "emp-1", placa: "RTP1A23", status: "ATIVO" }],
  });
  const bad = svc.validateService(
    {
      vehicle_id: "nao-existe",
      tipo_prestador: "EMPRESA",
      partner_id: "emp-1",
      driver_id: "d1",
      truck_id: "t1",
    },
    ctx
  );
  assert.strictEqual(bad.ok, false);

  const ok = svc.validateService(
    {
      vehicle_id: "veh-1",
      tipo_prestador: "EMPRESA",
      partner_id: "emp-1",
      driver_id: "d1",
      truck_id: "t1",
      valor_contratado: 350,
    },
    ctx
  );
  assert.strictEqual(ok.ok, true);
  const snap = svc.snapshotNames(
    { vehicle_id: "veh-1", partner_id: "emp-1", driver_id: "d1", truck_id: "t1" },
    ctx
  );
  const finance = { valor_contratado: 350, aprovado: true, payable_id: null };
  const service = {
    id: "srv-1",
    partner_nome: snap.partner_nome,
    driver_nome: snap.driver_nome,
    placa_veiculo: snap.placa_veiculo,
    data_remocao: "2026-10-21T12:00:00.000Z",
  };
  const blocked = svc.canGeneratePayable(service, { valor_contratado: 350, aprovado: false }, []);
  assert.strictEqual(blocked.ok, false);
  const ready = svc.canGeneratePayable(service, finance, []);
  assert.strictEqual(ready.ok, true);
  const payload = svc.buildPayablePayload(service, finance, "user-1");
  assert.strictEqual(payload.fornecedor, "Reboque Sul Ltda");
  assert.ok(payload.fornecedor !== "Ana Motorista");
  assert.strictEqual(payload.status, "EM_ABERTO");
  assert.ok(String(payload.observacoes).indexOf(svc.markerFor("srv-1")) >= 0);

  const again = svc.canGeneratePayable(service, { valor_contratado: 350, aprovado: true, payable_id: "pay-1" }, []);
  assert.strictEqual(again.ok, false);
  const linked = svc.canGeneratePayable(service, finance, [{ observacoes: svc.markerFor("srv-1") }]);
  assert.strictEqual(linked.ok, false);
})();

(function partialPaymentAndHistorySurviveInactivation() {
  const service = {
    id: "srv-1",
    cancelado: false,
    partner_id: "emp-1",
    partner_nome: "Reboque Sul Ltda",
    driver_id: "d1",
    driver_nome: "Ana Motorista",
    truck_id: "t1",
    truck_placa: "RTP1A23",
    tipo_prestador: "EMPRESA",
  };
  const finance = { valor_contratado: 400, aprovado: true, payable_id: "pay-1" };
  assert.strictEqual(svc.situacaoFinanceira(service, finance, [], { status: "EM_ABERTO" }), "A_PAGAR");
  assert.strictEqual(
    svc.situacaoFinanceira(service, finance, [{ valor: 150 }], { status: "EM_ABERTO" }),
    "PARCIAL"
  );
  assert.strictEqual(svc.saldoOf(finance, [{ valor: 150 }]), 250);
  assert.strictEqual(
    svc.situacaoFinanceira(service, finance, [{ valor: 400 }], { status: "EM_ABERTO" }),
    "PAGO"
  );
  assert.strictEqual(svc.situacaoFinanceira(service, { valor_contratado: null, aprovado: false }, [], null), "A_CONTRATAR");

  const frozen = svc.renameDoesNotRewriteHistory([service]);
  const inactivePartner = { id: "emp-1", status: "INATIVO", nome: "Nome Novo" };
  assert.strictEqual(frozen[0].partner_nome, "Reboque Sul Ltda");
  assert.strictEqual(frozen[0].driver_nome, "Ana Motorista");
  assert.notStrictEqual(frozen[0].partner_nome, inactivePartner.nome);

  const report = svc.reportAggregates({
    services: [service],
    financeById: { "srv-1": finance },
    paymentsById: { "srv-1": [{ valor: 150 }] },
  });
  assert.strictEqual(report.porParceiro[0].quantidade, 1);
  assert.strictEqual(report.porMotorista[0].quantidade, 1);
  assert.strictEqual(report.porCaminhao[0].quantidade, 1);
  assert.strictEqual(report.contratado, 400);
  assert.strictEqual(report.pago, 150);
  assert.strictEqual(report.pendente, 250);
})();

(function autonomousServiceAndSearch() {
  const ctx = {
    partners: baseCtx.partners,
    vehicles: baseCtx.vehicles,
    drivers: [],
    trucks: [{ id: "ta", owner_partner_id: "aut-1", placa: "AUT1B23", status: "ATIVO" }],
  };
  const ok = svc.validateService(
    { vehicle_id: "veh-1", tipo_prestador: "AUTONOMO", partner_id: "aut-1", truck_id: "ta" },
    ctx
  );
  assert.strictEqual(ok.ok, true);
  const missingTruck = svc.validateService(
    { vehicle_id: "veh-1", tipo_prestador: "AUTONOMO", partner_id: "aut-1" },
    ctx
  );
  assert.strictEqual(missingTruck.ok, false);
  assert.strictEqual(svc.matchesSearch("Carlos 123.456.789-01 AUT1B23", "12345678901"), true);
  assert.strictEqual(svc.matchesSearch("Carlos", "placa inexistente"), false);
  assert.strictEqual(svc.inPeriod("2026-10-21T10:00:00Z", "2026-10-01", "2026-10-31"), true);
  assert.strictEqual(svc.inPeriod("2026-09-01", "2026-10-01", "2026-10-31"), false);
})();

console.log("reboque-transporte-service: ok");

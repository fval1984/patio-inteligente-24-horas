/**
 * Testes do perfil VISUALIZADOR (somente leitura, sem financeiro).
 * Não altera a lógica dos perfis ADM, Gestor de pista e Vistoriador.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.join(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function testSqlIsAdditive() {
  const sql = read("supabase/track_managers_visualizador_role.sql");
  assert.match(sql, /VISUALIZADOR/);
  assert.match(sql, /auth_is_visualizador/);
  assert.match(sql, /RESTRICTIVE/);
  assert.match(sql, /receivables/);
  assert.doesNotMatch(sql, /UPDATE\s+public\.(vehicles|track_managers|partners|receivables)/i);
  assert.doesNotMatch(sql, /DELETE\s+FROM/i);
  assert.doesNotMatch(sql, /DROP TABLE/i);
}

function testPatioActor() {
  const src = read("lib/patio-actor.ts");
  assert.match(src, /"VISUALIZADOR"/);
  assert.match(src, /if \(s === "VISUALIZADOR" \|\| s === "VIEWER"\) return "VISUALIZADOR"/);
  assert.match(src, /actorCanWrite/);
  assert.match(src, /actorCanAccessFinance/);
  assert.match(src, /delegatedRole === "VISUALIZADOR"/);
  assert.match(src, /actor\.role === "ADM" \|\| actor\.role === "GESTOR_PISTA"/);
  assert.match(src, /actorCanInspect/);
  assert.doesNotMatch(src, /actorCanInspect\(actor\): boolean \{\s*return actor\.role === "ADM" \|\| actor\.role === "GESTOR_PISTA" \|\| actor\.role === "VISTORIADOR" \|\| actor\.role === "VISUALIZADOR"/);
}

function testFinanceGuard() {
  const guard = read("lib/viewer-access-guard.ts");
  assert.match(guard, /forbidViewerFinance/);
  assert.match(guard, /actorCanAccessFinance/);
  const payment = read("app/api/finance/register-payment/route.ts");
  assert.match(payment, /forbidViewerFinance/);
  const charges = read("app/api/finance/generate-daily-charges/route.ts");
  assert.match(charges, /forbidViewerFinance/);
}

function testInspectionApis() {
  const complete = read("app/api/vehicles/complete-entry-inspection/route.ts");
  assert.match(complete, /actorCanWrite/);
  const update = read("app/api/vehicles/update-entry-inspection/route.ts");
  assert.match(update, /actorCanWrite/);
  const photo = read("app/api/vehicles/entry-inspection-photo/route.ts");
  assert.match(photo, /actorCanWrite/);
  const list = read("app/api/vehicles/list-entry-inspections/route.ts");
  assert.match(list, /actorCanInspect/);
  assert.match(list, /VISUALIZADOR/);
}

function testCreateTrackManager() {
  const handler = read("lib/create-track-manager-handler.ts");
  assert.match(handler, /requestedRole === "VISUALIZADOR"/);
  assert.match(handler, /track_managers_visualizador_role\.sql/);
  assert.match(handler, /Apenas a conta principal \(ADM\) pode criar utilizadores/);
}

function testFrontend() {
  const html = read("public/app.html");
  assert.match(html, /option value="VISUALIZADOR"/);
  assert.match(html, /let isVisualizador = false/);
  assert.match(html, /role === "VISUALIZADOR"/);
  assert.match(html, /!opts.skipAuthorizationCheck && !isVisualizador/);
  assert.match(html, /await loadPatioDelegatedRole\(\)/);
  assert.match(html, /if \(isVisualizador\) return isMobileLayout\(\) \? "patio" : "dashboard"/);
  assert.match(html, /body.classList.add\("role-visualizador"\)/);
  assert.match(html, /hidesFinancialValues/);
  assert.match(html, /isViewerForbiddenView/);
  assert.match(html, /id="visualizadorWelcomeBanner"/);
  assert.match(html, /O perfil Visualizador é somente consulta/);
  const css = read("public/ampliguard-vistoria-ui.css");
  assert.match(css, /body\.role-visualizador #headerDetailsFinance/);
  const partners = read("public/partners-cadastro-ui.js");
  assert.match(partners, /isVisualizador/);
  const vei = read("public/vehicle-entry-inspection.js");
  assert.match(vei, /isVisualizador/);
}

function testExistingProfilesUntouched() {
  const html = read("public/app.html");
  assert.match(html, /let isGestorPista = false/);
  assert.match(html, /let isVistoriador = false/);
  assert.match(html, /window.isGestorPista = true/);
  assert.match(html, /body.classList.add\("role-vistoriador"\)/);
  const actor = read("lib/patio-actor.ts");
  assert.match(actor, /return actor.role === "ADM"/);
  assert.match(actor, /return actor.role === "VISTORIADOR"/);
}

let failed = 0;
const tests = [
  ["SQL aditivo do perfil VISUALIZADOR", testSqlIsAdditive],
  ["tipos e helpers em patio-actor", testPatioActor],
  ["bloqueio das APIs financeiras", testFinanceGuard],
  ["bloqueio de mutação de vistoria", testInspectionApis],
  ["criação de utilizador Visualizador", testCreateTrackManager],
  ["restrições no frontend", testFrontend],
  ["perfis ADM/Gestor/Vistoriador preservados", testExistingProfilesUntouched],
];

for (const [name, fn] of tests) {
  try {
    fn();
    console.log("ok —", name);
  } catch (e) {
    failed += 1;
    console.error("FAIL —", name, e && e.message ? e.message : e);
  }
}

if (failed) {
  console.error(`\n${failed} teste(s) falhou/falharam.`);
  process.exit(1);
}
console.log("\nTodos os testes do perfil VISUALIZADOR passaram.");

/**
 * Gestor de pista = Visualizador + entrada + vistoria + saída física no VSC.
 * Não altera dados nem os demais perfis.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.join(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function testSql() {
  const sql = read("supabase/track_managers_gestor_pista_permissions.sql");
  assert.match(sql, /auth_is_gestor_pista/);
  assert.match(sql, /RESTRICTIVE/);
  assert.match(sql, /vehicles_gestor_update_vsc_exit_only/);
  assert.match(sql, /vehicles_gestor_pista_update_guard/);
  assert.match(sql, /LIBERACAO_CONFIRMADA/);
  assert.match(sql, /REMOVIDO/);
  assert.doesNotMatch(sql, /UPDATE\s+public\.(vehicles|track_managers|partners|receivables)/i);
  assert.doesNotMatch(sql, /DELETE\s+FROM/i);
  assert.doesNotMatch(sql, /DROP TABLE/i);
}

function testActor() {
  const src = read("lib/patio-actor.ts");
  assert.match(src, /actorCanRegisterVehicleEntry/);
  assert.match(src, /actorCanConfirmPhysicalExit/);
  assert.match(src, /actorCanInspectWrite/);
  assert.match(src, /actorCanMutateOperationalFlow/);
  assert.match(src, /actor\.role !== "VISUALIZADOR" && actor\.role !== "GESTOR_PISTA"/);
  assert.match(src, /actor\.role !== "VISUALIZADOR" && actor\.role !== "GESTOR_PISTA"/);
  assert.match(src, /return actor\.role === "ADM";/);
}

function testApis() {
  const complete = read("app/api/vehicles/complete-entry-inspection/route.ts");
  assert.match(complete, /actorCanInspectWrite/);
  const update = read("app/api/vehicles/update-entry-inspection/route.ts");
  assert.match(update, /GESTOR_PISTA/);
  const photo = read("app/api/vehicles/entry-inspection-photo/route.ts");
  assert.match(photo, /CONCLUIDA/);
  const guard = read("lib/viewer-access-guard.ts");
  assert.match(guard, /actorCanAccessFinance/);
  assert.match(guard, /GESTOR_PISTA/);
}

function testFrontend() {
  const html = read("public/app.html");
  assert.match(html, /body.classList.add\("role-gestor-pista"\)/);
  assert.match(html, /Confirma a saída física deste veículo do pátio\?/);
  assert.match(html, /gestorAllowed = new Set\(\["ficha", "vistoria", "ver_vistoria", "patio_acoes", "confirmar"\]\)/);
  assert.match(html, /isGestorPista && editingVehicleId/);
  assert.doesNotMatch(html, /if \(isGestorPista && view === "dashboard"\)/);
  const css = read("public/ampliguard-vistoria-ui.css");
  assert.match(css, /body\.role-gestor-pista #headerDetailsFinance/);
  assert.match(css, /body\.role-gestor-pista button\[data-action="confirmar_liberacao"\]/);
  const vei = read("public/vehicle-entry-inspection.js");
  assert.match(vei, /ctx\?\.isVistoriador \|\| ctx\?\.isGestorPista/);
}

let failed = 0;
const tests = [
  ["SQL aditivo do Gestor de pista", testSql],
  ["helpers em patio-actor", testActor],
  ["APIs e RLS de aplicação", testApis],
  ["frontend Gestor de pista", testFrontend],
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
console.log("\nTodos os testes do Gestor de pista passaram.");

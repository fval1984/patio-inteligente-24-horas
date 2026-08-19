/**
 * Apagar vistoria — só o gestor principal (ADM).
 */
"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.join(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function testApiIsAdmOnly() {
  const route = read("app/api/vehicles/delete-entry-inspection/route.ts");
  assert.match(route, /actorCanAccessAdminModules/);
  assert.match(route, /Apenas o gestor principal pode apagar uma vistoria/);
  assert.match(route, /deleteVehicleEntryInspection/);
  assert.match(route, /vehicle_id/);
  assert.doesNotMatch(route, /isGestorPista \?\s*true/);
}

function testLibDeletesInspectionAndPhotos() {
  const lib = read("lib/vehicle-entry-inspection.ts");
  const del = lib.slice(lib.indexOf("export async function deleteVehicleEntryInspection"));
  assert.match(lib, /export async function deleteVehicleEntryInspection/);
  assert.match(lib, /vehicle-inspection-photos/);
  assert.match(lib, /\.from\("vehicle_entry_inspections"\)\.delete\(\)/);
  assert.match(del, /entry_inspection_flow: true/);
  assert.match(del, /VISTORIA_APAGADA/);
  assert.match(del, /reverted_to_aguardando: false/);
  assert.doesNotMatch(del, /status: "AGUARDANDO_VISTORIA"/);
}

function testActorHelper() {
  const actor = read("lib/patio-actor.ts");
  assert.match(actor, /export function actorCanAccessAdminModules/);
  assert.match(actor, /actor\.role === "ADM"/);
}

function testFrontendAdmOnly() {
  const html = read("public/app.html");
  const js = read("public/vehicle-entry-inspection.js");
  assert.match(html, /function vnpShouldShowVistoriaDeleteButton/);
  assert.match(html, /isGestorPista \|\| isVistoriador/);
  assert.match(html, /data-action="apagar_vistoria"/);
  assert.match(html, /action === "apagar_vistoria"/);
  assert.match(html, /Apenas o gestor principal pode apagar uma vistoria/);
  assert.match(js, /function canDeleteCompletedInspection/);
  assert.match(js, /function deleteCompletedInspection/);
  assert.match(js, /\/api\/vehicles\/delete-entry-inspection/);
  assert.match(js, /id="veiDeleteBtn"/);
  assert.match(js, /id="veiHeadDeleteBtn"/);
  assert.doesNotMatch(js, /isVistoriador\) return true/);
}

function testDoesNotTouchFinance() {
  const route = read("app/api/vehicles/delete-entry-inspection/route.ts");
  const lib = read("lib/vehicle-entry-inspection.ts");
  assert.doesNotMatch(route, /receivables|payables|cash_movements/);
  assert.doesNotMatch(lib.slice(lib.indexOf("export async function deleteVehicleEntryInspection")), /from\("receivables"\)/);
}

function testVistoriadorCannotDelete() {
  const html = read("public/app.html");
  const js = read("public/vehicle-entry-inspection.js");
  assert.match(js, /!ctx\.isGestorPista && !ctx\.isVistoriador/);
  assert.match(html, /if \(isGestorPista \|\| isVistoriador\) \{\s*alert\("Apenas o gestor principal/);
}

let failed = 0;
const tests = [
  ["API só para gestor principal", testApiIsAdmOnly],
  ["lib apaga vistoria e fotos e o veículo fica no VNP", testLibDeletesInspectionAndPhotos],
  ["actorCanAccessAdminModules = ADM", testActorHelper],
  ["botão só no perfil principal", testFrontendAdmOnly],
  ["não mistura financeiro", testDoesNotTouchFinance],
  ["vistoriador e gestor de pista bloqueados", testVistoriadorCannotDelete],
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
console.log("\nTodos os testes de apagar vistoria passaram.");

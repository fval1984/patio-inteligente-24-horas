/**
 * Cadastro de entrada vai ao VNP (sem vistoria obrigatória).
 * Bola vermelha até concluir a vistoria; depois verde.
 * A aba Vistoria lista os ainda não vistoriados.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { spawnSync } = require("child_process");
const os = require("os");

const root = path.join(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function testCadastroVaiAoVnpSemAbrirVistoria() {
  const html = read("public/app.html");
  assert.match(html, /if \(!editingVehicleId\) \{[\s\S]*?payload\.status = "NO_PATIO";/);
  assert.match(html, /payload\.entry_inspection_flow = true;/);
  assert.doesNotMatch(
    html.slice(html.indexOf("if (!editingVehicleId)")).slice(0, 800),
    /payload\.status = "AGUARDANDO_VISTORIA"/
  );
  assert.match(html, /openPatioSubview\("no_patio"\);/);
  assert.match(html, /Fica no VNP em destaque, aguardando vistoria de entrada/);
  assert.doesNotMatch(html, /Conclua a vistoria de entrada antes de utilizá-lo no VNP/);
  assert.doesNotMatch(html, /wasNewVehicle && tryPayload\.status === "AGUARDANDO_VISTORIA"/);
}

function testVnpIncluiAguardandoEDestaque() {
  const html = read("public/app.html");
  assert.match(html, /function isVehicleOnPatio\(v\) \{[\s\S]*?if \(s === "REMOVIDO"\) return false;/);
  assert.match(html, /function vehicleNeedsEntryInspection\(v\) \{/);
  assert.match(html, /if \(s === "AGUARDANDO_VISTORIA"\) return true;/);
  assert.match(html, /return v\.entry_inspection_flow === true;/);
  assert.match(html, /if \(vehicleNeedsEntryInspection\(v\)\) return 1;/);
  assert.match(html, /if \(vehicleNeedsEntryInspection\(v\)\) return "vnp-row-aguardando-vistoria";/);
  assert.match(html, /filteredVehicles\.filter\(\(v\) => isVehicleOnPatio\(v\)\)/);
  assert.doesNotMatch(html, /isVehicleOnPatio\(v\) && v\.status !== "AGUARDANDO_VISTORIA"/);
  assert.match(html, /vnp-row-aguardando-vistoria/);
  assert.match(html, /<span class="tag warning">Aguardando vistoria<\/span>/);
  assert.match(html, /v\.status === "NO_PATIO" \|\| v\.status === "AGUARDANDO_VISTORIA"/);
}

function testBolaVermelhaEVerde() {
  const html = read("public/app.html");
  const css = read("public/ampliguard-vistoria-ui.css");
  assert.match(html, /function inspectionStatusIndicatorHtml\(vehicleOrId\)/);
  assert.match(html, /vei-status-dot--ok/);
  assert.match(html, /vei-status-dot--pending/);
  assert.match(html, /title="Aguardando vistoria"/);
  assert.match(html, /title="Vistoria concluída"/);
  assert.match(html, /inspectionStatusIndicatorHtml\(v\)/);
  assert.match(css, /\.vei-status-dot--ok/);
  assert.match(css, /\.vei-status-dot--pending/);
  assert.match(css, /background: #ef4444/);
  assert.match(css, /background: #22c55e/);
  assert.match(css, /width: 10px;/);
}

function testAbaVistoriaListaNaoVistoriados() {
  const js = read("public/vehicle-entry-inspection.js");
  assert.match(js, /function vehicleNeedsEntryInspection\(vehicle, ctx\)/);
  assert.match(js, /function renderAwaitingTable\(tbody, vehicles, ctx\)/);
  assert.match(js, /\.filter\(\(v\) => vehicleNeedsEntryInspection\(v, ctx\)\)/);
  assert.doesNotMatch(
    js.slice(js.indexOf("function renderAwaitingTable")),
    /v\.status === "AGUARDANDO_VISTORIA"/
  );
  assert.match(js, /vei-status-dot--pending/);
  assert.match(js, /Cadastro: NO_PATIO no VNP/);
}

function testApagarVistoriaFicaNoVnp() {
  const lib = read("lib/vehicle-entry-inspection.ts");
  const del = lib.slice(lib.indexOf("export async function deleteVehicleEntryInspection"));
  assert.doesNotMatch(del, /status: "AGUARDANDO_VISTORIA"/);
  assert.match(del, /entry_inspection_flow: true/);
  assert.match(del, /reverted_to_aguardando: false/);
  const js = read("public/vehicle-entry-inspection.js");
  assert.match(js, /O veículo permanece no VNP, aguardando nova vistoria/);
}

function testCacheBust() {
  const html = read("public/app.html");
  assert.match(html, /vehicle-entry-inspection\.js\?v=20260819vnpvist1/);
  assert.match(html, /ampliguard-vistoria-ui\.css\?v=20260819vnpvist1/);
}

function testJsParse() {
  const files = ["public/vehicle-entry-inspection.js", "public/dashboard-metrics-service.js"];
  for (const rel of files) {
    const r = spawnSync("node", ["--check", path.join(root, rel)], { encoding: "utf8" });
    assert.strictEqual(r.status, 0, `${rel} inválido: ${r.stderr || r.stdout}`);
  }
  const html = read("public/app.html");
  const scripts = [];
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) scripts.push(m[1]);
  assert.ok(scripts.length >= 2, "esperados scripts inline em app.html");
  scripts.forEach((src, i) => {
    const file = path.join(os.tmpdir(), `amplipatio-vnp-vistoria-inline-${i}.js`);
    fs.writeFileSync(file, src);
    const r = spawnSync("node", ["--check", file], { encoding: "utf8" });
    assert.strictEqual(r.status, 0, `script inline ${i} inválido: ${r.stderr || r.stdout}`);
  });
}

function testNaoMisturaFinanceiro() {
  const html = read("public/app.html");
  const cadastro = html.slice(html.indexOf("payload.status = \"NO_PATIO\""), html.indexOf("payload.status = \"NO_PATIO\"") + 400);
  assert.doesNotMatch(cadastro, /receivables|payables|cash_movements/);
  const lib = read("lib/vehicle-entry-inspection.ts");
  const del = lib.slice(lib.indexOf("export async function deleteVehicleEntryInspection"));
  assert.doesNotMatch(del, /from\("receivables"\)/);
}

let failed = 0;
const tests = [
  ["cadastro vai ao VNP sem abrir vistoria", testCadastroVaiAoVnpSemAbrirVistoria],
  ["VNP inclui aguardando vistoria em destaque", testVnpIncluiAguardandoEDestaque],
  ["bola vermelha / verde na placa", testBolaVermelhaEVerde],
  ["aba Vistoria lista não vistoriados", testAbaVistoriaListaNaoVistoriados],
  ["apagar vistoria mantém o veículo no VNP", testApagarVistoriaFicaNoVnp],
  ["cache-bust dos ficheiros da vistoria", testCacheBust],
  ["JS e scripts inline parseiam", testJsParse],
  ["não mistura financeiro", testNaoMisturaFinanceiro],
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
console.log("\nTodos os testes de VNP aguardando vistoria passaram.");

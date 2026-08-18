/**
 * Testes das 3 correções da vistoria: persistência, legendas de fotos e paginação A4.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const root = path.join(__dirname, "..");

function loadIife(relPath, extra = {}) {
  const documentStub = {
    getElementById: () => null,
    createElement: () => ({
      style: {},
      classList: { add() {}, remove() {}, toggle() {} },
      appendChild() {},
      querySelector() {
        return null;
      },
      querySelectorAll() {
        return [];
      },
      setAttribute() {},
      addEventListener() {},
    }),
    head: { appendChild() {} },
    body: { appendChild() {}, addEventListener() {} },
    addEventListener() {},
  };
  const context = {
    console,
    document: documentStub,
    window: {},
    globalThis: {},
    setTimeout,
    clearTimeout,
    ...extra,
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, relPath), "utf8"), context, { filename: relPath });
  return context;
}

function testPhotoLabels() {
  const ctx = loadIife("public/vehicle-entry-inspection-document.js");
  const mod = ctx.vehicleEntryInspectionDocument;
  assert.ok(mod, "módulo de documento");

  const cases = [
    ["front", null, {}, "Frente"],
    ["rear", null, {}, "Traseira"],
    ["side_left", null, {}, "Lateral esquerda"],
    ["side_right", null, {}, "Lateral direita"],
    ["diag_front_left", null, {}, "Diagonal dianteira esquerda"],
    ["diag_front_right", null, {}, "Diagonal dianteira direita"],
    ["diag_rear_left", null, {}, "Diagonal traseira esquerda"],
    ["diag_rear_right", null, {}, "Diagonal traseira direita"],
    ["odometer", null, {}, "Hodômetro"],
    ["engine", null, {}, "Motor"],
    ["wheel_fl", null, {}, "Roda dianteira esquerda"],
    ["wheel_fr", null, {}, "Roda dianteira direita"],
    [null, "engine.jpg", { file_name: "engine.jpg" }, "Motor"],
    [null, "123_diag_front_left.jpg", { file_name: "123_diag_front_left.jpg" }, "Diagonal dianteira esquerda"],
    [
      null,
      "Foto",
      { storage_path: "uid/inspections/x/standard/1_wheel_rl.jpg", file_name: "1_wheel_rl.jpg" },
      "Roda traseira esquerda",
    ],
    ["avaria_item_interno_painel", "Foto adicional de avaria 1", { photo_type: "avaria_item_interno_painel" }, null],
  ];

  for (const [type, fallback, photo, expected] of cases) {
    const label = mod.resolveStandardPhotoLabel(type, fallback, photo);
    assert.notStrictEqual(String(label).trim().toLowerCase(), "foto", `tipo=${type} fallback=${fallback}`);
    if (expected) assert.strictEqual(label, expected, `tipo=${type}`);
  }

  const damage = mod.formatDamagePhotoLabel(
    { photo_type: "avaria_item_mec_motor", file_name: "avaria_item_mec_motor.jpg" },
    { area_label: "Motor" }
  );
  assert.match(damage, /Motor/i);
  assert.notStrictEqual(damage.toLowerCase(), "foto");

  const extra = mod.formatDamagePhotoLabel(
    { photo_type: "avaria_extra", photo_label: "Foto adicional de avaria 1" },
    { area_label: "Para-choque", description: "Amassado" }
  );
  assert.match(extra, /Para-choque|Amassado/i);
  assert.notStrictEqual(extra.toLowerCase(), "foto");
}

function testPageCuts() {
  const ctx = loadIife("public/vehicle-entry-inspection-document.js");
  const { computeSafePageCuts } = ctx.vehicleEntryInspectionDocument;
  const pageH = 1000;
  const atoms = [
    { top: 0, bottom: 200 },
    { top: 210, bottom: 400 },
    { top: 920, bottom: 1180 },
    { top: 1190, bottom: 1400 },
    { top: 1410, bottom: 1600 },
  ];
  const cuts = computeSafePageCuts(atoms, pageH, 1600, 24);
  assert.ok(cuts[0] === 0);
  assert.ok(cuts.length >= 2, "deve gerar mais de uma página");
  for (const a of atoms) {
    for (let i = 1; i < cuts.length; i++) {
      const cut = cuts[i];
      const straddles = a.top < cut && a.bottom > cut;
      if (straddles && a.bottom - a.top < pageH && a.top > cuts[i - 1] + 24) {
        assert.fail(`corte em ${cut} parte o bloco ${a.top}-${a.bottom}`);
      }
    }
  }
  const photoRow = [
    { top: 950, bottom: 1180 },
    { top: 950, bottom: 1180 },
    { top: 950, bottom: 1180 },
    { top: 950, bottom: 1180 },
  ];
  const photoCuts = computeSafePageCuts(photoRow, 1000, 1800, 24);
  assert.ok(photoCuts.includes(950) || photoCuts[1] <= 950, "fotos da mesma linha devem ir juntas para a página seguinte");
}

function testClassificationMerge() {
  const checklist = loadIife("public/vehicle-entry-inspection-checklist.js");
  const insp = loadIife("public/vehicle-entry-inspection.js", {
    vehicleEntryInspectionChecklist: checklist.vehicleEntryInspectionChecklist,
  });
  const { applyStoredClassifications, normalizeClassificationValue } = insp.vehicleEntryInspection;
  assert.strictEqual(normalizeClassificationValue("sem teste"), "SEM_TESTE");
  assert.strictEqual(normalizeClassificationValue("BOM"), "BOM");
  assert.strictEqual(normalizeClassificationValue("INEXISTENTE"), "INEXISTENTE");

  const draft = { classifications: { interno_painel: null, mec_motor: null } };
  applyStoredClassifications(
    draft,
    [{ item_key: "interno_painel", classification: "BOM" }],
    { __item_classifications: { mec_motor: "REGULAR", interno_painel: "DANIFICADO" } }
  );
  assert.strictEqual(draft.classifications.interno_painel, "BOM", "itens da tabela prevalecem");
  assert.strictEqual(draft.classifications.mec_motor, "REGULAR", "backup preenche o que falta");

  const draft2 = { classifications: { interno_painel: null } };
  applyStoredClassifications(draft2, [], '{"__item_classifications":{"interno_painel":"INEXISTENTE"}}');
  assert.strictEqual(draft2.classifications.interno_painel, "INEXISTENTE");

  const { inferVariantFromDetail } = insp.vehicleEntryInspection;
  assert.strictEqual(
    inferVariantFromDetail({ inspection_variant: null }, [{ item_key: "moto_farol", classification: "BOM" }], {}),
    "MOTOS"
  );
}

function testPersistBackupHelpers() {
  const src = fs.readFileSync(path.join(root, "lib/vehicle-entry-inspection.ts"), "utf8");
  assert.match(src, /ITEM_CLASSIFICATIONS_BACKUP_KEY = "__item_classifications"/);
  assert.match(src, /persistInspectionItems/);
  assert.match(src, /withClassificationBackup/);
  assert.match(src, /onConflict: "inspection_id,item_key"/);
  const sql = fs.readFileSync(path.join(root, "supabase/vehicle_entry_inspection_items_persist.sql"), "utf8");
  assert.match(sql, /UNIQUE \(inspection_id, item_key\)/);
}

function testPrintCss() {
  const src = fs.readFileSync(path.join(root, "public/vehicle-entry-inspection-document.js"), "utf8");
  assert.match(src, /size: A4 portrait/);
  assert.match(src, /grid-template-columns: repeat\(4/);
  assert.match(src, /object-fit: contain/);
  assert.doesNotMatch(src, /width: calc\(25% - 8px\)/);
  assert.match(src, /margin: 12mm/);
  assert.match(src, /computeSafePageCuts/);
  assert.match(src, /width:210mm;height:297mm/);
  assert.doesNotMatch(src, /return "Foto"/);
}

function testTwoInspectionsIndependent() {
  const checklist = loadIife("public/vehicle-entry-inspection-checklist.js");
  const insp = loadIife("public/vehicle-entry-inspection.js", {
    vehicleEntryInspectionChecklist: checklist.vehicleEntryInspectionChecklist,
  });
  const { applyStoredClassifications } = insp.vehicleEntryInspection;

  const store = {
    1: {
      items: [
        { item_key: "interno_painel", classification: "BOM" },
        { item_key: "mec_motor", classification: "REGULAR" },
      ],
      extras: { __item_classifications: { interno_painel: "BOM", mec_motor: "REGULAR" } },
    },
    2: {
      items: [
        { item_key: "interno_painel", classification: "DANIFICADO" },
        { item_key: "mec_motor", classification: "SEM_TESTE" },
        { item_key: "eq_radio", classification: "INEXISTENTE" },
      ],
      extras: {
        __item_classifications: {
          interno_painel: "DANIFICADO",
          mec_motor: "SEM_TESTE",
          eq_radio: "INEXISTENTE",
        },
      },
    },
  };

  const d1 = { classifications: { interno_painel: null, mec_motor: null, eq_radio: null } };
  const d2 = { classifications: { interno_painel: null, mec_motor: null, eq_radio: null } };
  applyStoredClassifications(d1, store[1].items, store[1].extras);
  applyStoredClassifications(d2, store[2].items, store[2].extras);
  assert.strictEqual(d1.classifications.interno_painel, "BOM");
  assert.strictEqual(d2.classifications.interno_painel, "DANIFICADO");
  assert.strictEqual(d2.classifications.mec_motor, "SEM_TESTE");
  assert.strictEqual(d2.classifications.eq_radio, "INEXISTENTE");
  assert.strictEqual(d1.classifications.eq_radio, null, "vistoria 1 não deve receber item só da 2");
}

function testManyPhotosPagination() {
  const ctx = loadIife("public/vehicle-entry-inspection-document.js");
  const { computeSafePageCuts, resolveStandardPhotoLabel } = ctx.vehicleEntryInspectionDocument;
  const keys = [
    "front",
    "rear",
    "side_left",
    "side_right",
    "diag_front_left",
    "diag_front_right",
    "diag_rear_left",
    "diag_rear_right",
    "odometer",
    "engine",
    "wheel_fl",
    "wheel_fr",
    "wheel_rl",
    "wheel_rr",
    "roof",
    "battery",
  ];
  const atoms = [];
  let y = 850;
  for (const key of keys) {
    const label = resolveStandardPhotoLabel(key, "Foto", { file_name: `${key}.jpg` });
    assert.notStrictEqual(label.toLowerCase(), "foto", key);
    atoms.push({ top: y, bottom: y + 220, key, label });
    if (atoms.length % 4 === 0) y += 230;
  }
  const cuts = computeSafePageCuts(atoms, 1000, y + 50, 24);
  assert.ok(cuts.length >= 2, "várias fotos devem gerar várias páginas");
  for (const a of atoms) {
    for (let i = 1; i < cuts.length; i++) {
      const cut = cuts[i];
      if (a.top < cut && a.bottom > cut && a.top > cuts[i - 1] + 24) {
        assert.fail(`foto ${a.key} cortada em ${cut}`);
      }
    }
  }
}

let failed = 0;
const tests = [
  ["legendas das fotos", testPhotoLabels],
  ["cortes de página sem partir blocos", testPageCuts],
  ["persistência/carregamento das classificações", testClassificationMerge],
  ["backup e unique por vistoria", testPersistBackupHelpers],
  ["CSS A4 / impressão", testPrintCss],
  ["vistoria nº 1 e nº 2 independentes", testTwoInspectionsIndependent],
  ["PDF com várias fotografias", testManyPhotosPagination],
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
  process.exit(1);
}
console.log("Todos os testes da vistoria passaram.");

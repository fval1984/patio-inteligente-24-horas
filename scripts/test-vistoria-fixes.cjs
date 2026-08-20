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

function testChecklistItemReplacement() {
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const ctx = loadIife("public/vehicle-entry-inspection-checklist.js");
  const mod = ctx.vehicleEntryInspectionChecklist;
  const json = require(path.join(root, "lib/vehicle-entry-inspection-checklist-keys.json"));
  for (const variant of ["LEVE", "PESADOS", "TRATORES", "MOTOS"]) {
    const cfg = mod.getVariantConfig(variant);
    assert.deepStrictEqual(clone(cfg.classifyKeys), json[variant], `chaves ${variant} sincronizadas`);
  }

  const leve = mod.getVariantConfig("LEVE");
  assert.strictEqual(leve.cardCount, 17, "Leve tem as seções completas");
  assert.deepStrictEqual(clone(leve.cards.map((c) => c.title)), [
    "INFORMAÇÕES INICIAIS",
    "RETROVISOR",
    "ESPELHO RETROVISOR",
    "MAÇANETA EXTERNA",
    "VIDROS",
    "DIANTEIRA",
    "TRASEIRA",
    "LATERAL ESQUERDA",
    "LATERAL DIREITA",
    "MECÂNICA",
    "PNEUS",
    "RODA",
    "CALOTA",
    "INTERIOR DO VEÍCULO",
    "PERTENCES DO FINANCIADO",
    "EQUIPAMENTOS E ACESSÓRIOS",
    "EQUIPAMENTOS DE SEGURANÇA",
  ]);

  const labelsByCard = {};
  leve.cards.forEach((card) => {
    labelsByCard[card.id] = clone(card.blocks.flatMap((b) => (b.items || []).map((it) => it.label)));
  });

  assert.deepStrictEqual(labelsByCard.geral, [
    "Possui chave de ignição?",
    "Possui chave reserva?",
    "Possui manual?",
    "Possui documento?",
    "Veículo funcionando?",
    "Veículo trancado?",
    "Veículo travado?",
    "Tipo de combustível:",
    "KM",
  ]);
  assert.ok(leve.cards[0].blocks.some((b) => b.fuelGauge), "diagrama de combustível no card inicial");
  const fuel = leve.checklist.find((it) => it.kind === "fuel_gauge");
  assert.strictEqual(fuel.key, "ini_fuel_gauge");
  assert.ok(mod.renderFuelGaugeSvg({ x: 62.5, y: 48 }).includes("vei-fuel-x"));
  assert.ok(mod.renderFuelGaugeSvg(null).includes("NÍVEL DE COMBUSTÍVEL"));

  const km = leve.cards[0].blocks.flatMap((b) => b.items || []).find((it) => it.key === "ini_km");
  assert.strictEqual(km.kind, "number");
  const fuelType = leve.cards[0].blocks.flatMap((b) => b.items || []).find((it) => it.key === "ini_combustivel");
  assert.deepStrictEqual(clone(fuelType.choices.map((c) => c.label)), [
    "Gasolina",
    "Etanol",
    "Diesel",
    "Flex",
    "Elétrico",
    "Híbrido",
  ]);

  assert.deepStrictEqual(labelsByCard.dianteira, [
    "Capô",
    "Para-choque",
    "Limpador de para-brisa LD",
    "Limpador de para-brisa LE",
    "Farol LD",
    "Farol LE",
    "Farol auxiliar LD",
    "Farol auxiliar LE",
    "Teto",
    "Saia",
    "Grade",
  ]);
  assert.deepStrictEqual(labelsByCard.lado_esquerdo, [
    "Paralama dianteiro",
    "Paralama traseiro",
    "Porta dianteira",
    "Friso porta dianteira",
    "Porta traseira",
    "Friso porta traseira",
  ]);
  assert.deepStrictEqual(labelsByCard.lado_direito, labelsByCard.lado_esquerdo);
  assert.deepStrictEqual(labelsByCard.traseira, [
    "Tampa de mala",
    "Maçaneta",
    "Limpador de para-brisa",
    "Para-choque",
    "Lanterna LD",
    "Lanterna LE",
    "Escapamento",
    "Saia",
    "Engate",
  ]);
  assert.ok(labelsByCard.interior.includes("Tapete motorista"));
  assert.ok(labelsByCard.interior.includes("Buzina"));
  assert.ok(labelsByCard.seguranca.includes("Extintor"));
  assert.ok(labelsByCard.mecanica.includes("Freio"));
  assert.strictEqual(labelsByCard.mecanica.filter((x) => x === "Freio").length, 1);

  const farolLd = leve.cards.find((c) => c.id === "dianteira").blocks[0].items.find((it) => it.key === "dian_farol_ld");
  assert.strictEqual(farolLd.kind, "classify");
  assert.ok(farolLd.classIds.includes("SEM_TESTE"));
  const capo = leve.cards.find((c) => c.id === "dianteira").blocks[0].items.find((it) => it.key === "dian_capo");
  assert.ok(!capo.classIds.includes("SEM_TESTE"));

  const pneuDd = leve.cards.find((c) => c.id === "pneus").blocks[0].items.find((it) => it.key === "pneu_dd");
  assert.strictEqual(pneuDd.kind, "pick");
  assert.deepStrictEqual(clone(pneuDd.options.map((c) => c.label)), [
    "Novo",
    "Bom estado",
    "Meia vida",
    "Careca",
    "Ausente",
  ]);
  assert.strictEqual(pneuDd.textKey, "pneu_dd_marca");
  assert.strictEqual(pneuDd.textKey2, "pneu_dd_ref");

  const roda = leve.cards.find((c) => c.id === "rodas").blocks[0].items.find((it) => it.key === "rod_estepe");
  assert.strictEqual(roda.kind, "pick");
  assert.deepStrictEqual(clone(roda.options.map((c) => c.label)), ["Liga", "Ferro", "Ausente"]);
  assert.ok(!leve.classifyKeys.includes("rod_estepe"), "tipo de roda não vai para classification SQL");

  const calotaTd = leve.cards.find((c) => c.id === "calota").blocks[0].items.find((it) => it.key === "calota_td");
  assert.strictEqual(calotaTd.label, "Traseira Direita");
  assert.deepStrictEqual(clone(calotaTd.classIds), ["BOM", "REGULAR", "DANIFICADO"]);

  const pertences = leve.cards.find((c) => c.id === "pertences").blocks[0].items[0];
  assert.strictEqual(pertences.textWhen, "SIM");
  assert.strictEqual(pertences.textKey, "ini_pertences_quais");

  ["interno_painel", "dian_capo", "lesq_retrovisor", "eq_radio", "mec_freio"].forEach((key) => {
    assert.ok(leve.classifyKeys.includes(key), `${key} permanece para preservar dados`);
  });

  const motos = mod.getVariantConfig("MOTOS");
  assert.deepStrictEqual(clone(motos.classifyKeys), json.MOTOS);
  assert.strictEqual(motos.cards[1].id, "motos");
  const tratores = mod.getVariantConfig("TRATORES");
  assert.deepStrictEqual(clone(tratores.classifyKeys), json.TRATORES);
  const pesados = mod.getVariantConfig("PESADOS");
  assert.strictEqual(pesados.cardCount, 19);
  assert.ok(pesados.classifyKeys.includes("eixo_toco"));
  assert.ok(pesados.classifyKeys.includes("car_tanque"));
  assert.ok(pesados.classifyKeys.includes("dian_farol_ld"));

  const insp = loadIife("public/vehicle-entry-inspection.js", {
    vehicleEntryInspectionChecklist: mod,
  });
  const draft = insp.vehicleEntryInspection.emptyDraftForVariant("LEVE");
  draft.classifications.dian_farol_ld = "DANIFICADO";
  const damaged = insp.vehicleEntryInspection.getDamagedClassifyItems(draft);
  assert.ok(damaged.some((it) => it.key === "dian_farol_ld" && it.label === "Farol LD"));

  const doc = loadIife("public/vehicle-entry-inspection-document.js", {
    vehicleEntryInspectionChecklist: mod,
  });
  const printHtml = doc.vehicleEntryInspectionDocument.buildPrintHtml({
    vehicle: { placa: "ABC1D23", marca: "VW", modelo: "Gol", ano: "2018" },
    ctx: { partners: [] },
    inspection: { inspection_number: 1, inspection_variant: "LEVE", completed_at: "2026-08-20T12:00:00Z" },
    detail: {
      items: [
        { item_key: "dian_capo", item_label: "Capô", category: "DIANTEIRA", classification: "BOM" },
        { item_key: "interno_relogio", item_label: "Relógio", category: "INTERNO", classification: "BOM" },
      ],
      photos: [],
      damages: [],
    },
    draft: {
      inspectionVariant: "LEVE",
      classifications: { dian_capo: "BOM", dian_farol_ld: "DANIFICADO" },
      formExtras: {
        ini_chave_ignicao: "SIM",
        ini_combustivel: "FLEX",
        ini_km: "45210",
        ini_fuel_gauge: { x: 62.5, y: 48 },
        pneu_dd: "BOM_ESTADO",
        pneu_dd_marca: "Pirelli",
        pneu_dd_ref: "175/70",
      },
    },
    helpers: {
      getVariantConfig: mod.getVariantConfig,
      INSPECTION_CARDS: mod.INSPECTION_CARDS,
      CHECKLIST: mod.CHECKLIST,
      vehicleEntryInspectionChecklist: mod,
      fmtDateTime: () => "20/08/2026",
    },
  });
  assert.match(printHtml, /Possui chave de ignição/);
  assert.match(printHtml, /Tipo de combustível/);
  assert.match(printHtml, /Flex/);
  assert.match(printHtml, /45210/);
  assert.match(printHtml, /vei-fuel-x/);
  assert.match(printHtml, /Farol LD/);
  assert.match(printHtml, /Paralama dianteiro/);
  assert.match(printHtml, /Run Flat/);
  assert.match(printHtml, /Itens \(registro anterior\)/);
  assert.match(printHtml, /Relógio/);
  assert.match(printHtml, /Pirelli/);
  assert.match(printHtml, /175\/70/);
  assert.match(printHtml, /Cliente|Placa/);
  assert.match(printHtml, /Danificada/);
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
  const { computeSafePageCuts, mergeAlignedAtomRanges, buildPhotoGrid, PHOTO_GRID_COLUMNS } =
    ctx.vehicleEntryInspectionDocument;
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
      if (straddles && a.bottom - a.top < pageH && a.top > cuts[i - 1] + 2) {
        assert.fail(`corte em ${cut} parte o bloco ${a.top}-${a.bottom}`);
      }
    }
  }
  const photoRow = [
    { top: 950, bottom: 1180 },
    { top: 950, bottom: 1180 },
    { top: 950, bottom: 1180 },
  ];
  const photoCuts = computeSafePageCuts(photoRow, 1000, 1800, 24);
  assert.ok(
    photoCuts.includes(950) || photoCuts[1] <= 950,
    "fotos da mesma linha devem ir juntas para a página seguinte"
  );

  const lastRow = [
    { top: 6850, bottom: 7120 },
    { top: 6850, bottom: 7120 },
    { top: 6850, bottom: 7120 },
  ];
  const lastCuts = computeSafePageCuts(lastRow, pageH, 7120, Math.round(pageH * 0.08));
  for (let i = 1; i < lastCuts.length; i++) {
    const cut = lastCuts[i];
    assert.ok(!(cut > 6850 && cut < 7120), `a última linha de fotos não pode ser cortada em ${cut}`);
  }
  assert.ok(lastCuts.includes(6850) || lastCuts[lastCuts.length - 1] <= 6850);

  const merged = mergeAlignedAtomRanges(lastRow);
  assert.strictEqual(merged.length, 1, "as 3 fotos da mesma linha formam um só bloco");
  assert.strictEqual(merged[0].top, 6850);
  assert.strictEqual(merged[0].bottom, 7120);

  const cells = [];
  for (let i = 0; i < 21; i++) cells.push({ label: `Foto ${i + 1}`, url: `https://example.test/${i}.jpg` });
  const grid = buildPhotoGrid(cells);
  assert.match(grid, /vei-doc-photo-row/);
  const rowCount = (grid.match(/vei-doc-photo-row/g) || []).length;
  assert.strictEqual(rowCount, 7);
  assert.strictEqual(PHOTO_GRID_COLUMNS, 3);
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

  const truncated = { classifications: {} };
  const backupAll = {};
  const firstPage = [];
  for (let i = 0; i < 93; i++) {
    const key = `item_${i}`;
    truncated.classifications[key] = null;
    backupAll[key] = i % 2 ? "REGULAR" : "BOM";
    if (i < 50) firstPage.push({ item_key: key, classification: backupAll[key] });
  }
  applyStoredClassifications(truncated, firstPage, { __item_classifications: backupAll });
  for (let i = 0; i < 93; i++) {
    const key = `item_${i}`;
    assert.strictEqual(truncated.classifications[key], backupAll[key], `item ${key} deve reaparecer`);
  }

  const { inferVariantFromDetail, hydrateInspectionItems, canonicalItemKey } = insp.vehicleEntryInspection;
  assert.strictEqual(
    inferVariantFromDetail({ inspection_variant: null }, [{ item_key: "moto_farol", classification: "BOM" }], {}),
    "MOTOS"
  );

  const inspectionId = "11111111-2222-4333-8444-555555555555";
  assert.strictEqual(canonicalItemKey(`interno_painel::${inspectionId}`), "interno_painel");
  assert.strictEqual(canonicalItemKey("mec_motor"), "mec_motor");

  const sevenKeys = [
    "rod_pneu_dd",
    "rod_pneu_de",
    "rod_pneu_td",
    "rod_pneu_te",
    "rod_estepe",
    "rod_calotas",
    "rod_liga_leve",
  ];
  const snapshot = [];
  const allKeys = ["interno_painel", "mec_motor", "eq_radio", ...sevenKeys];
  const draft7 = { classifications: {} };
  allKeys.forEach((k) => {
    draft7.classifications[k] = null;
    snapshot.push({ item_key: k, classification: k === "mec_motor" ? "REGULAR" : "BOM" });
  });
  const tableOnlySeven = sevenKeys.map((k) => ({
    item_key: `${k}::${inspectionId}`,
    classification: "BOM",
  }));
  const hydrated = hydrateInspectionItems(tableOnlySeven, {
    __item_classifications: Object.fromEntries(snapshot.map((r) => [r.item_key, r.classification])),
    __inspection_items: snapshot,
  });
  assert.strictEqual(hydrated.length, allKeys.length, "snapshot completa os itens que a tabela não trouxe");
  applyStoredClassifications(draft7, hydrated, {
    __inspection_items: snapshot,
    __item_classifications: Object.fromEntries(snapshot.map((r) => [r.item_key, r.classification])),
  });
  allKeys.forEach((k) => {
    assert.ok(draft7.classifications[k], `marcação de ${k} deve reaparecer`);
  });
}

function testPersistBackupHelpers() {
  const src = fs.readFileSync(path.join(root, "lib/vehicle-entry-inspection.ts"), "utf8");
  assert.match(src, /ITEM_CLASSIFICATIONS_BACKUP_KEY = "__item_classifications"/);
  assert.match(src, /persistInspectionItems/);
  assert.match(src, /withClassificationBackup/);
  assert.match(src, /onConflict: "inspection_id,item_key"/);
  assert.match(src, /INSPECTION_ROW_PAGE = 50/);
  assert.match(src, /ITEM_SNAPSHOT_BACKUP_KEY = "__inspection_items"/);
  assert.match(src, /hydrateInspectionItems/);
  assert.match(src, /canonicalItemKey/);
  assert.match(src, /item_key}::\$\{inspectionId\}/);
  assert.match(src, /attachSignedPhotoUrls/);
  assert.match(src, /createSignedUrls/);
  assert.match(src, /persistInspectionPhoto/);
  assert.match(src, /currentKeys.has\(key\)/);
  assert.match(src, /Preserva itens de vistorias antigas/);
  const sql = fs.readFileSync(path.join(root, "supabase/vehicle_entry_inspection_items_persist.sql"), "utf8");
  assert.match(sql, /UNIQUE \(inspection_id, item_key\)/);
}

function testPrintCss() {
  const src = fs.readFileSync(path.join(root, "public/vehicle-entry-inspection-document.js"), "utf8");
  assert.match(src, /size: A4 portrait/);
  assert.match(src, /grid-template-columns: repeat\(\$\{PHOTO_GRID_COLUMNS\}/);
  assert.match(src, /PHOTO_GRID_COLUMNS = 3/);
  assert.match(src, /aspect-ratio: 4 \/ 3/);
  assert.match(src, /object-fit: contain/);
  assert.doesNotMatch(src, /width: calc\(25% - 8px\)/);
  assert.match(src, /margin: 12mm/);
  assert.match(src, /computeSafePageCuts/);
  assert.match(src, /vei-doc-photo-row/);
  assert.match(src, /mergeAlignedAtomRanges/);
  assert.match(src, /min-height:297mm/);
  assert.doesNotMatch(src, /height:297mm;border:0/);
  assert.doesNotMatch(src, /return "Foto"/);
  const uiCss = fs.readFileSync(path.join(root, "public/ampliguard-vistoria-ui.css"), "utf8");
  assert.match(uiCss, /aspect-ratio: 4 \/ 3/);
  assert.doesNotMatch(uiCss, /max-width: 140px/);
  const client = fs.readFileSync(path.join(root, "public/vehicle-entry-inspection.js"), "utf8");
  assert.match(client, /const page = 50/);
  assert.match(client, /mergeInspectionRows/);
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
    if (atoms.length % 3 === 0) y += 230;
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

function testPhotosHydrateIntoDraft() {
  const checklist = loadIife("public/vehicle-entry-inspection-checklist.js");
  const photosMod = loadIife("public/vehicle-entry-inspection-photos-mobile.js", {
    vehicleEntryInspectionChecklist: checklist.vehicleEntryInspectionChecklist,
  });
  const doc = loadIife("public/vehicle-entry-inspection-document.js", {
    vehicleEntryInspectionChecklist: checklist.vehicleEntryInspectionChecklist,
    vehicleEntryInspectionPhotosMobile: photosMod.vehicleEntryInspectionPhotosMobile,
  });
  const insp = loadIife("public/vehicle-entry-inspection.js", {
    vehicleEntryInspectionChecklist: checklist.vehicleEntryInspectionChecklist,
    vehicleEntryInspectionPhotosMobile: photosMod.vehicleEntryInspectionPhotosMobile,
    vehicleEntryInspectionDocument: doc.vehicleEntryInspectionDocument,
  });
  const { applyPhotosToDraft } = insp.vehicleEntryInspection;
  const draft = {
    inspectionVariant: "LEVE",
    standardPhotos: {},
    itemDamagePhotos: {},
    extraDamagePhotos: [],
  };
  applyPhotosToDraft(draft, [
    {
      photo_type: "front",
      url: "https://example.com/front.jpg",
      storage_path: "owner/inspections/abc/standard/1_front.jpg",
    },
    {
      photo_type: "engine",
      url: "https://example.com/engine.jpg",
      file_name: "engine.jpg",
    },
    {
      photo_type: "avaria_extra",
      url: "https://example.com/avaria.jpg",
      photo_label: "Para-choque",
    },
  ]);
  assert.ok(draft.standardPhotos.front?.preview, "foto Frente deve voltar no rascunho");
  assert.ok(draft.standardPhotos.engine?.preview, "foto Motor deve voltar no rascunho");
  assert.strictEqual(draft.extraDamagePhotos.length, 1);

  const src = require("fs").readFileSync(require("path").join(__dirname, "..", "public/vehicle-entry-inspection-document.js"), "utf8");
  assert.match(src, /inferPhotoType,/);
}

function testGestorPhotoCaptureOpens() {
  const photos = loadIife("public/vehicle-entry-inspection-photos-mobile.js");
  const mod = photos.vehicleEntryInspectionPhotosMobile;
  assert.ok(mod.resolvePhotosHost, "resolvePhotosHost exportado");
  assert.ok(mod.applyCapturedStandardPhoto, "applyCapturedStandardPhoto exportado");
  assert.ok(mod.syncSection, "syncSection exportado");

  const draft = { inspectionVariant: "LEVE", standardPhotos: {}, currentPhotoStep: 0 };
  const html = mod.renderSection(draft);
  assert.match(html, /id="veiPhotoTakeBtn"/);
  assert.match(html, /<label class="vei-photo-btn vei-photo-btn-primary" id="veiPhotoTakeBtn"/);
  assert.match(html, /class="vei-photo-btn-text"/);
  assert.match(html, /id="veiPhotoCaptureInput"[^>]*capture="environment"|capture="environment"[^>]*id="veiPhotoCaptureInput"/);
  assert.match(html, /id="veiPhotoGalleryInput"/);
  assert.match(html, /class="vei-photo-native-input"/);
  assert.doesNotMatch(html, /clip:\s*rect\(0,\s*0,\s*0,\s*0\)/);

  const host = {
    id: "veiMobilePhotosHost",
    innerHTML: html,
    querySelector(sel) {
      if (sel === "#veiMobilePhotos") return { querySelector() { return null; }, querySelectorAll() { return []; } };
      return null;
    },
    closest() {
      return null;
    },
  };
  assert.strictEqual(mod.resolvePhotosHost(host), host, "host é o próprio elemento, não um descendente");
  assert.strictEqual(mod.syncSection(host, draft), false, "não recria o input se a secção já existe");

  const body = {
    id: "veiModalBody",
    querySelector(sel) {
      return sel === "#veiMobilePhotosHost" ? host : null;
    },
    closest() {
      return null;
    },
  };
  assert.strictEqual(mod.resolvePhotosHost(body), host);

  assert.strictEqual(mod.stepPhoto(draft, 1), true);
  assert.strictEqual(draft.currentPhotoStep, 1);
  assert.strictEqual(mod.jumpPhoto(draft, 0), true);
  assert.strictEqual(draft.currentPhotoStep, 0);

  const srcPhotos = fs.readFileSync(path.join(root, "public/vehicle-entry-inspection-photos-mobile.js"), "utf8");
  assert.doesNotMatch(srcPhotos, /clip: rect\(0, 0, 0, 0\)/);
  const srcInsp = fs.readFileSync(path.join(root, "public/vehicle-entry-inspection.js"), "utf8");
  assert.match(srcInsp, /handleInspectionFileInputChange/);
  assert.match(srcInsp, /resolvePhotosHost/);
  assert.match(srcInsp, /paintClassificationRow/);
  assert.match(srcInsp, /armCameraUiGuard/);
  assert.match(srcInsp, /resumeActiveEdit/);
  assert.match(srcInsp, /data-damage-item/);
  assert.match(srcInsp, /scheduleMobilePhotosSync/);
  assert.doesNotMatch(srcInsp, /for="veiDamagePhotoCaptureInput"/);
  assert.doesNotMatch(srcInsp, /class="vei-photo-capture-input hidden"/);
  assert.match(srcInsp, /pendingDamagePhotoKey/);
  const classHandler = srcInsp.slice(srcInsp.indexOf("const classBtn = hit.closest"), srcInsp.indexOf("const diagramSvg"));
  assert.match(classHandler, /paintClassificationRow/);
  assert.doesNotMatch(classHandler, /refreshCurrentEditUI/);
  const srcApp = fs.readFileSync(path.join(root, "public/app.html"), "utf8");
  assert.match(srcApp, /vehicle-entry-inspection-photos-mobile\.js\?v=20260818vistoria10/);
  assert.match(srcApp, /resumeActiveEdit/);
  assert.match(srcApp, /const veiOpen = !document.getElementById\("veiInspectionBackdrop"\)\?\.classList.contains\("hidden"\)/);
}

function testChoiceButtonsAndPertences() {
  const srcInsp = fs.readFileSync(path.join(root, "public/vehicle-entry-inspection.js"), "utf8");
  const srcCss = fs.readFileSync(path.join(root, "public/ampliguard-vistoria-ui.css"), "utf8");
  const srcTheme = fs.readFileSync(path.join(root, "public/ampliguard-theme.css"), "utf8");
  const srcApp = fs.readFileSync(path.join(root, "public/app.html"), "utf8");
  assert.match(srcTheme, /:not\(\.vei-choice-btn\)/);
  assert.match(srcCss, /button\.vei-choice-btn\.active/);
  assert.match(srcCss, /background: #1677ff !important/);
  assert.match(srcCss, /vei-choice-followup/);
  assert.match(srcInsp, /function renderChoiceFollowup/);
  assert.match(srcInsp, /data-text-when-for/);
  assert.match(srcInsp, /vei-pertences-field/);
  assert.match(srcInsp, /querySelectorAll\(`\[data-text-when-for="\$\{extraKey\}"\]`\)/);
  assert.match(srcApp, /ampliguard-theme\.css\?v=20260820theme10/);
  assert.match(srcApp, /ampliguard-vistoria-ui\.css\?v=20260820vistoria6/);
  assert.match(srcApp, /vehicle-entry-inspection\.js\?v=20260820vistoria6/);
}

function testPhotoUploadGoesThroughApi() {
  const src = fs.readFileSync(path.join(root, "public/vehicle-entry-inspection-photos-mobile.js"), "utf8");
  assert.match(src, /\/api\/vehicles\/entry-inspection-photo/);
  assert.match(src, /blobFromDraftPhoto/);
  assert.match(src, /data_base64/);
  assert.doesNotMatch(src, /if \(!p \|\| !p\.file\) continue;/);
  const route = fs.readFileSync(path.join(root, "app/api/vehicles/entry-inspection-photo/route.ts"), "utf8");
  assert.match(route, /persistInspectionPhoto/);
}

let failed = 0;
const tests = [
  ["legendas das fotos", testPhotoLabels],
  ["itens da vistoria substituídos", testChecklistItemReplacement],
  ["cortes de página sem partir blocos", testPageCuts],
  ["persistência/carregamento das classificações", testClassificationMerge],
  ["backup e unique por vistoria", testPersistBackupHelpers],
  ["CSS A4 / impressão", testPrintCss],
  ["vistoria nº 1 e nº 2 independentes", testTwoInspectionsIndependent],
  ["PDF com várias fotografias", testManyPhotosPagination],
  ["fotos gravadas voltam no rascunho", testPhotosHydrateIntoDraft],
  ["envio das fotos pela API", testPhotoUploadGoesThroughApi],
  ["câmera da vistoria no gestor de pista", testGestorPhotoCaptureOpens],
  ["botões de escolha e pertences", testChoiceButtonsAndPertences],
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

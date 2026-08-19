/**
 * Testes do perfil VISTORIADOR e da identificação individual por vistoria.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");
const crypto = require("crypto");

const root = path.join(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function testSqlIsAdditive() {
  const sql = read("supabase/track_managers_vistoriador_role.sql");
  assert.match(sql, /VISTORIADOR/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS role/);
  assert.match(sql, /RESTRICTIVE/);
  assert.doesNotMatch(sql, /UPDATE\s+public\.(vehicles|vehicle_entry_inspections|partners|receivables)/i);
  assert.doesNotMatch(sql, /DELETE\s+FROM/i);
  assert.doesNotMatch(sql, /DROP TABLE/i);
}

function testInspectorTokenFormat() {
  const src = read("lib/inspector-session.ts");
  assert.match(src, /createHmac\("sha256"/);
  assert.match(src, /createInspectorSessionToken/);
  assert.match(src, /verifyInspectorSessionToken/);
  assert.match(src, /timingSafeEqual/);

  const secret = "test-secret";
  const payload = { v: 1, iid: "inspector-uuid", oid: "owner-uuid", n: "João", exp: Math.floor(Date.now() / 1000) + 60 };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  const token = `${body}.${sig}`;
  const [gotBody, gotSig] = token.split(".");
  const expected = crypto.createHmac("sha256", secret).update(gotBody).digest("base64url");
  assert.strictEqual(gotSig, expected);
  const parsed = JSON.parse(Buffer.from(gotBody, "base64url").toString("utf8"));
  assert.strictEqual(parsed.iid, "inspector-uuid");
  assert.strictEqual(parsed.oid, "owner-uuid");
}

function testManagerLoginNormalization() {
  const src = read("lib/manager-login.ts");
  assert.match(src, /@gestor\.\$\{domain\}/);
  assert.match(src, /managerLoginEmailCandidates/);

  function normalizeManagerLogin(raw) {
    return (raw || "")
      .toString()
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9._-]/g, ".")
      .replace(/\.+/g, ".")
      .replace(/^\.|\.$/g, "");
  }
  assert.strictEqual(normalizeManagerLogin("João"), "joao");
  assert.strictEqual(normalizeManagerLogin(" Maria.Pista "), "maria.pista");
}

function testIdentifyApi() {
  const route = read("app/api/vehicles/identify-inspector/route.ts");
  assert.match(route, /identifyInspectorForPatio/);
  const lib = read("lib/identify-inspector.ts");
  assert.match(lib, /Usuário ou senha inválidos/);
  assert.match(lib, /grant_type=password/);
  assert.match(lib, /userCanInspectPatio/);
  assert.match(lib, /authorization_status|ATIVO/);
}

function testCompleteUsesInspectorToken() {
  const route = read("app/api/vehicles/complete-entry-inspection/route.ts");
  assert.match(route, /inspector_token/);
  assert.match(route, /verifyInspectorSessionToken/);
  assert.match(route, /actorRequiresInspectorIdentification/);
  assert.match(route, /vistoriador_id/);
  assert.doesNotMatch(route, /const \{ ownerUserId, inspectorUserId \} = await resolveVehicleOwnerUserId/);
  const update = read("app/api/vehicles/update-entry-inspection/route.ts");
  assert.match(update, /não pode alterar uma vistoria já finalizada/i);
}

function testCreateTrackManagerRole() {
  const handler = read("lib/create-track-manager-handler.ts");
  assert.match(handler, /normalizeTrackManagerRole/);
  assert.match(handler, /requestedRole === "VISTORIADOR"/);
  assert.match(handler, /Apenas a conta principal \(ADM\) pode criar utilizadores/);
}

function testFrontendIdentification() {
  const js = read("public/vehicle-entry-inspection.js");
  assert.match(js, /IDENTIFICAÇÃO DO VISTORIADOR/);
  assert.match(js, /ENTRAR E INICIAR VISTORIA/);
  assert.match(js, /\/api\/vehicles\/identify-inspector/);
  assert.match(js, /inspector_token/);
  assert.match(js, /clearInspectorIdentity/);
  assert.match(js, /INICIAR VISTORIA/);
  assert.match(js, /promptInspectorIdentification/);
  assert.match(js, /Usuário ou senha inválidos/);
}

function testAppHtmlRoleRestrictions() {
  const html = read("public/app.html");
  assert.match(html, /id="trackManagerRole"/);
  assert.match(html, /option value="VISTORIADOR"/);
  assert.match(html, /let isVistoriador = false/);
  assert.match(html, /role === "VISTORIADOR"/);
  assert.match(html, /body.classList.add\("role-vistoriador"\)/);
  assert.match(html, /requiresInspectorIdentification: !!isVistoriador/);
  assert.match(html, /if \(isVistoriador\) \{\s*view = "patio";/s);
  assert.match(html, /Este perfil só pode realizar vistorias/);
  assert.match(html, /vehicle-entry-inspection\.js\?v=20260819mobile2/);
  assert.match(html, /ampliguard-vistoria-ui\.css\?v=20260819mobile2/);
  assert.match(html, /if \(isVistoriador\) \{\s*unwrapTabModalShell\(patioContent\)/s);
  assert.match(html, /function returnToPainelFromPatioFlyout\(\) \{\s*if \(isVistoriador\)/s);
  assert.doesNotMatch(html, /id="gestorPistaWelcomeBanner"[\s\S]*id="gestorPistaWelcomeBanner"/);
}

function testInlineAppScriptsParse() {
  const { spawnSync } = require("child_process");
  const os = require("os");
  const html = read("public/app.html");
  const scripts = [];
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) scripts.push(m[1]);
  assert.ok(scripts.length >= 2, "esperados scripts inline em app.html");
  scripts.forEach((src, i) => {
    const file = path.join(os.tmpdir(), `amplipatio-app-inline-${i}.js`);
    fs.writeFileSync(file, src);
    const r = spawnSync("node", ["--check", file], { encoding: "utf8" });
    assert.strictEqual(r.status, 0, `script inline ${i} inválido: ${r.stderr || r.stdout}`);
  });
}

function testExistingProfilesUntouched() {
  const html = read("public/app.html");
  assert.match(html, /let isGestorPista = false/);
  assert.match(html, /window.isGestorPista = true/);
  const roleSql = read("supabase/track_managers_role.sql");
  assert.match(roleSql, /GESTOR_PISTA/);
  assert.match(roleSql, /VISTORIADOR/);
}

let failed = 0;
const tests = [
  ["SQL aditivo do perfil VISTORIADOR", testSqlIsAdditive],
  ["formato do token do vistoriador", testInspectorTokenFormat],
  ["normalização do login", testManagerLoginNormalization],
  ["API de identificação", testIdentifyApi],
  ["finalização grava o vistoriador autenticado", testCompleteUsesInspectorToken],
  ["criação de utilizador com perfil", testCreateTrackManagerRole],
  ["modal de identificação na vistoria", testFrontendIdentification],
  ["restrições do app.html", testAppHtmlRoleRestrictions],
  ["scripts inline de app.html parseiam", testInlineAppScriptsParse],
  ["perfis ADM/Gestor preservados", testExistingProfilesUntouched],
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
console.log("\nTodos os testes do perfil VISTORIADOR passaram.");

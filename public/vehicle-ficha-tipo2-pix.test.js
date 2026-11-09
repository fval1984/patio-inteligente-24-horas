const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const src = fs.readFileSync(path.join(__dirname, "vehicle-ficha-tipo2-pix.js"), "utf8");
const window = {};
vm.runInNewContext(src, { window, console });
const pix = window.vehicleFichaTipo2Pix;

const payload = pix.buildPayload(150.5, "AMPLIGUARD ABC1D23");
const check = pix.validate(payload, 150.5);
assert.ok(check.ok, "payload válido com valor 150.50");
assert.ok(payload.includes("54150.50") || payload.includes("5406150.50"), "campo 54 com valor");
assert.ok(payload.includes("br.gov.bcb.pix"), "GUI Pix");
assert.ok(payload.includes("57936119000198"), "chave CNPJ");
assert.strictEqual(pix.validate(payload, 10).ok, false, "rejeita valor diferente");
assert.ok(!pix.buildPayload(0), "sem payload para valor 0");
console.log("ok vehicle-ficha-tipo2-pix");

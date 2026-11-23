const api = require("./periodo-filtro.js");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(api.mask("23112026") === "23/11/2026", "máscara");
assert(api.parse("23/11/2026") === "2026-11-23", "parse br");
assert(api.parse("2026-11-23") === "2026-11-23", "parse iso");
assert(api.parse("") === "", "vazio");
assert(api.parse("31/02/2026") === null, "data inválida");
assert(api.format("2026-11-23") === "23/11/2026", "formato");
assert(api.inRange("2026-11-23T23:30:00", "2026-11-23", "2026-11-23"), "dia final completo");
assert(api.inRange("2026-11-23T00:10:00", "2026-11-23", "2026-11-23"), "dia inicial completo");
assert(!api.inRange("2026-11-22T23:00:00", "2026-11-23", "2026-11-24"), "antes do início");
assert(!api.inRange("2026-11-25", "2026-11-23", "2026-11-24"), "depois do fim");
assert(api.inRange("2026-11-01", "", ""), "sem período mostra tudo");
assert(!api.inRange("", "2026-11-01", "2026-11-30"), "sem data não entra no período");
assert(api.read("01/11/2026", "30/11/2026").ok, "leitura válida");
assert(!api.read("01/12/2026", "30/11/2026").ok, "início depois do fim");

console.log("periodo-filtro.test.js ok");

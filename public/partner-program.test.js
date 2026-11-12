const prog = require("./partner-program.js");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(prog.tariffFor({}, 0).diaria === 30, "convencional 30");
assert(prog.tariffFor({ perfil: { programa_cliente_parceiro: true } }, 3).diaria === 25, "parceiro 25");
assert(prog.tariffFor({ perfil: { programa_cliente_parceiro: true } }, 10).diaria === 20, "10 ciclos 20");
assert(prog.tariffFor({ perfil: { programa_cliente_parceiro: true } }, 15).diaria === 15, "15 ciclos 15");
assert(prog.tariffFor({ perfil: { programa_cliente_parceiro: true } }, 14).nf === "PARCEIRO", "nf parceiro");
assert(prog.tariffFor({}, 20).nf === "AMPLIGUARD", "nf convencional mesmo com muitos ciclos");

assert(prog.lastBusinessDayOfMonth("2026-11") === "2026-11-30", "nov/2026 última útil (segunda)");
assert(prog.dueDateNextMonth15("2026-11") === "2026-12-15", "vencimento 15 do mês seguinte");

const n = prog.countCyclesInMonth(
  [
    { receivable: { period_end: "2026-11-03" }, vehicle_id: "a" },
    { receivable: { period_end: "2026-11-20" }, vehicle_id: "b" },
    { receivable: { period_end: "2026-10-31" }, vehicle_id: "c" },
  ],
  "2026-11"
);
assert(n === 2, "ciclos só do mês");

console.log("partner-program.test.js ok");

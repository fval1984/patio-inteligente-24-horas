const hist = require("./vehicle-public-history.js");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(hist.isPublicVehicleToken("a".repeat(48)), "token hex 48");
assert(!hist.isPublicVehicleToken("1"), "token curto");
assert(!hist.isPublicVehicleToken("abc-not-hex"), "token não hex");
assert(!hist.isPublicVehicleToken("1"), "não sequencial");

assert(hist.publicStatusLabel("NO_PATIO") === "Em guarda no pátio", "status pátio");
assert(hist.publicStatusLabel("LIBERACAO_SOLICITADA").indexOf("VSL") >= 0, "status vsl");
assert(hist.publicStatusLabel("REMOVIDO").indexOf("Removido") >= 0, "status vrp");

const onlyEntry = hist.buildPublicTimeline({ data_entrada: "2026-11-09T12:00:00Z" }, []);
assert(onlyEntry.length === 2, "só registro e guarda");
assert(onlyEntry[0].code === "REGISTRADO", "primeiro registro");
assert(onlyEntry[1].code === "EM_GUARDA", "segundo guarda");

const full = hist.buildPublicTimeline(
  {
    data_entrada: "2026-11-01T10:00:00Z",
    liberacao_solicitada_em: "2026-11-05T09:00:00Z",
    liberacao_confirmada_em: "2026-11-06T11:00:00Z",
    data_saida: "2026-11-07T16:00:00Z",
  },
  []
);
assert(full.map((x) => x.code).join(",") === "REGISTRADO,EM_GUARDA,VSL,VSC,VRP", "linha completa");

const fromEvents = hist.buildPublicTimeline({ data_entrada: "2026-11-01T10:00:00Z" }, [
  { tipo: "NFSE", data_evento: "2026-11-02T10:00:00Z" },
  { tipo: "LIBERACAO_SOLICITADA", data_evento: "2026-11-03T08:00:00Z" },
]);
assert(fromEvents.some((x) => x.code === "VSL"), "vsl a partir de evento");
assert(!fromEvents.some((x) => x.code === "VSC"), "não inventa vsc");
assert(!fromEvents.some((x) => String(x.title).toLowerCase().indexOf("nfse") >= 0), "não expõe eventos internos");

console.log("vehicle-public-history.test.js ok");

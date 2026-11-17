const api = require("./contatos-avulsos.js");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(api.formatPhoneBr("81999991234") === "(81) 99999-1234", "máscara celular");
assert(api.formatPhoneBr("(81) 3333-4444") === "(81) 3333-4444", "máscara fixo");
assert(api.formatPhoneBr("+55 81 99999-1234") === "(81) 99999-1234", "remove DDI 55");
assert(api.digits("81999991234") === api.digits("(81) 99999-1234"), "telefone normalizado");
assert(api.isValidPhoneBr("81999991234"), "telefone válido");
assert(!api.isValidPhoneBr("999991234"), "sem DDD não passa");

assert(
  api.validationMessage({ tipo: "CADASTRADO", id: "p1", nome: "Empresa" }, "quem solicitou a liberação") === "",
  "cadastrado com id"
);
assert(
  api.validationMessage({ tipo: "CADASTRADO", id: "", nome: "" }, "quem solicitou a liberação").indexOf("Selecione") === 0,
  "cadastrado vazio"
);
assert(
  api.validationMessage({ tipo: "AVULSO", nome: "", telefone: "" }, "quem confirmou a liberação").indexOf("nome e o telefone") > 0,
  "avulso exige nome e telefone"
);
assert(
  api.validationMessage({ tipo: "AVULSO", nome: "João Carlos", telefone: "81999991234" }, "quem removeu o veículo") === "",
  "avulso completo"
);

const catalogo = [
  { id: "1", nome: "João Carlos", telefone: "(81) 99999-1234", telefone_norm: "81999991234", ultimo_uso_em: "2026-11-01T10:00:00Z" },
  { id: "2", nome: "João Pedro", telefone: "(81) 98888-5678", telefone_norm: "81988885678", ultimo_uso_em: "2026-11-02T10:00:00Z" },
  { id: "3", nome: "Maria Souza", telefone: "(81) 97777-0000", telefone_norm: "81977770000", ultimo_uso_em: "2026-11-03T10:00:00Z" },
];

const porNome = api.searchContacts(catalogo, "João");
assert(porNome.length === 2, "sugestão por nome");
assert(porNome[0].nome.indexOf("João") === 0 && porNome[1].nome.indexOf("João") === 0, "os dois Joões");
assert(api.searchContacts(catalogo, "joao carlos")[0].nome === "João Carlos", "busca sem acento");

const porTel = api.searchContacts(catalogo, "98888");
assert(porTel.length === 1 && porTel[0].nome === "João Pedro", "sugestão por telefone");
assert(api.searchContacts(catalogo, "(81) 99999")[0].nome === "João Carlos", "telefone com máscara");
assert(api.searchContacts(catalogo, "j").length === 0, "não sugere com uma letra");

const novo = api.commitAvulsoContact(catalogo, { nome: "Ana Lima", telefone: "(11) 91234-0000" }, "2026-11-17T12:00:00Z");
assert(novo.action === "insert", "contato novo");
assert(novo.catalog.length === catalogo.length + 1, "entrou no catálogo");
assert(catalogo.length === 3, "catálogo original intacto");

const repetido = api.commitAvulsoContact(catalogo, { nome: "João C. Silva", telefone: "81 99999-1234" }, "2026-11-17T12:05:00Z");
assert(repetido.action === "update", "mesmo telefone atualiza");
assert(repetido.catalog.length === catalogo.length, "não duplica");
assert(repetido.record.nome === "João C. Silva", "nome do catálogo atualizado");

const historico = { nome: "João Carlos", telefone: "(81) 99999-1234", tipo: "AVULSO" };
assert(historico.nome === "João Carlos", "histórico não muda quando o catálogo é editado");
assert(repetido.snapshot.nome === "João C. Silva", "novo registro usa o nome informado agora");
assert(api.commitAvulsoContact(catalogo, { nome: "João Pedro", telefone: "(81) 99999-1234" }).catalog.length === 3, "dedupe pelo telefone, não pelo nome");

const nota = api.contactNote([
  { papel: "solicitante", tipo: "AVULSO", nome: "João Carlos", telefone: "(81) 99999-1234" },
]);
assert(nota.indexOf("Avulso") >= 0 && nota.indexOf("João Carlos") >= 0 && nota.indexOf("(81) 99999-1234") >= 0, "nota do histórico");

const linhas = api.historicoLinhas([
  { etapa: "VSL", papel: "solicitante", contato_tipo: "AVULSO", nome: "João Carlos", telefone: "(81) 99999-1234", registrado_por: "fernando" },
  { etapa: "REMOCAO", papel: "removeu", contato_tipo: "CADASTRADO", nome: "Maria Souza", telefone: "(81) 97777-0000", registrado_por: "fernando" },
]);
assert(linhas[0].indexOf("VSL") >= 0 && linhas[0].indexOf("Avulso") >= 0, "linha VSL");
assert(linhas[1].indexOf("Remoção") >= 0 && linhas[1].indexOf("Cadastrado") >= 0, "mesmo contato serve em outra etapa");
assert(api.searchContacts(catalogo, "Maria").length === 1, "catálogo não separa por etapa");

console.log("contatos-avulsos.test.js ok");

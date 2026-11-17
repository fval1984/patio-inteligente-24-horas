/**
 * Contatos avulsos das movimentações (VSL, VSC, RPP e remoção).
 * Não cadastra parceiro. O histórico guarda uma cópia; o catálogo só serve para sugerir.
 * node public/contatos-avulsos.test.js
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.contatosAvulsos = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const PAPEL_LABEL = {
    solicitante: "Solicitante",
    confirmador: "Quem confirmou",
    responsavelFinanceiro: "RPP",
    removeu: "Quem removeu",
  };

  const ETAPA_LABEL = {
    VSL: "VSL",
    VSC: "VSC",
    RPP: "RPP",
    REMOCAO: "Remoção",
  };

  function digits(value) {
    let d = String(value || "").replace(/\D/g, "");
    if ((d.length === 12 || d.length === 13) && d.indexOf("55") === 0) d = d.slice(2);
    return d.slice(0, 11);
  }

  function formatPhoneBr(value) {
    const d = digits(value);
    if (!d) return "";
    if (d.length < 3) return "(" + d;
    const ddd = d.slice(0, 2);
    const rest = d.slice(2);
    if (d.length <= 6) return "(" + ddd + ") " + rest;
    if (d.length <= 10) return "(" + ddd + ") " + rest.slice(0, 4) + "-" + rest.slice(4);
    return "(" + ddd + ") " + rest.slice(0, 5) + "-" + rest.slice(5, 9);
  }

  function foldName(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function isValidPhoneBr(value) {
    const d = digits(value);
    if (d.length < 10 || d.length > 11) return false;
    const ddd = Number(d.slice(0, 2));
    return ddd >= 11 && ddd <= 99;
  }

  function validationMessage(contact, subject) {
    const who = subject || "o contato";
    if (!contact || String(contact.tipo || "").toUpperCase() !== "AVULSO") {
      if (!contact || !String(contact.id || "").trim()) return "Selecione " + who + ".";
      return "";
    }
    const nome = String(contact.nome || "").trim();
    const d = digits(contact.telefone);
    if (nome.length < 2 && d.length < 10) return "Informe o nome e o telefone/WhatsApp de " + who + ".";
    if (nome.length < 2) return "Informe o nome completo de " + who + ".";
    if (!isValidPhoneBr(contact.telefone)) return "Informe o telefone com DDD de " + who + ".";
    return "";
  }

  function searchContacts(catalog, query, limit) {
    const max = limit || 8;
    const q = foldName(query);
    const d = digits(query);
    if (q.length < 2 && d.length < 2) return [];
    const scored = [];
    (catalog || []).forEach((raw) => {
      if (!raw) return;
      const nome = String(raw.nome || "").trim();
      const telNorm = digits(raw.telefone_norm || raw.telefone || "");
      if (!nome || telNorm.length < 10) return;
      const folded = foldName(nome);
      let score = 0;
      if (q.length >= 2 && folded.indexOf(q) === 0) score = 4;
      else if (q.length >= 2 && folded.indexOf(q) >= 0) score = 2;
      if (d.length >= 2 && telNorm.indexOf(d) === 0) score = Math.max(score, 4);
      else if (d.length >= 2 && telNorm.indexOf(d) >= 0) score = Math.max(score, 3);
      if (!score) return;
      scored.push({
        raw: raw,
        score: score,
        uso: String(raw.ultimo_uso_em || ""),
      });
    });
    scored.sort((a, b) => b.score - a.score || (a.uso < b.uso ? 1 : a.uso > b.uso ? -1 : 0));
    const seen = {};
    const out = [];
    scored.forEach((item) => {
      const key = digits(item.raw.telefone_norm || item.raw.telefone || "");
      if (seen[key]) return;
      seen[key] = true;
      out.push({
        id: item.raw.id || null,
        nome: String(item.raw.nome || "").trim(),
        telefone: formatPhoneBr(item.raw.telefone || item.raw.telefone_norm || ""),
        telefone_norm: key,
      });
    });
    return out.slice(0, max);
  }

  function commitAvulsoContact(catalog, input, nowIso) {
    const nome = String((input && input.nome) || "").trim();
    const telefone = formatPhoneBr((input && input.telefone) || "");
    const telefone_norm = digits(telefone);
    const now = nowIso || new Date().toISOString();
    const list = (catalog || []).map((row) => Object.assign({}, row));
    const idx = list.findIndex((row) => digits(row.telefone_norm || row.telefone || "") === telefone_norm);
    let record;
    let action;
    if (idx >= 0) {
      record = Object.assign({}, list[idx], {
        nome: nome,
        telefone: telefone,
        telefone_norm: telefone_norm,
        ultimo_uso_em: now,
        updated_at: now,
      });
      list[idx] = record;
      action = "update";
    } else {
      record = {
        id: null,
        nome: nome,
        telefone: telefone,
        telefone_norm: telefone_norm,
        ultimo_uso_em: now,
        updated_at: now,
      };
      list.unshift(record);
      action = "insert";
    }
    return {
      action: action,
      record: record,
      catalog: list,
      snapshot: { tipo: "AVULSO", nome: nome, telefone: telefone, telefone_norm: telefone_norm },
    };
  }

  function contactNote(items) {
    const parts = [];
    (items || []).forEach((item) => {
      if (!item || !String(item.nome || "").trim()) return;
      const tipo = String(item.tipo || "").toUpperCase() === "AVULSO" ? "Avulso" : "Cadastrado";
      const tel = item.telefone ? ", telefone " + item.telefone : "";
      const rotulo = item.rotulo || PAPEL_LABEL[item.papel] || "Contato";
      parts.push(rotulo + ": " + String(item.nome).trim() + " (" + tipo + tel + ")");
    });
    return parts.join(". ");
  }

  function historicoLinhas(rows) {
    return (rows || []).map((row) => {
      const tipo = String(row.contato_tipo || row.tipo || "").toUpperCase() === "AVULSO" ? "Avulso" : "Cadastrado";
      const etapa = ETAPA_LABEL[row.etapa] || row.etapa || "";
      const papel = PAPEL_LABEL[row.papel] || row.papel || "Contato";
      const tel = row.telefone ? " · " + row.telefone : "";
      const por = row.registrado_por ? " · registado por " + row.registrado_por : "";
      const prefixo = etapa ? etapa + " · " : "";
      return prefixo + papel + ": " + tipo + " · " + String(row.nome || "").trim() + tel + por;
    });
  }

  return {
    digits: digits,
    formatPhoneBr: formatPhoneBr,
    foldName: foldName,
    isValidPhoneBr: isValidPhoneBr,
    validationMessage: validationMessage,
    searchContacts: searchContacts,
    commitAvulsoContact: commitAvulsoContact,
    contactNote: contactNote,
    historicoLinhas: historicoLinhas,
  };
});

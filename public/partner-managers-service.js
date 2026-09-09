/**
 * Gestores de carteira (retomados) e de cobrança (financeiro).
 * 1 parceiro/escritório → N gestores. Sem vínculo 1:1.
 */
(function partnerManagersServiceModule(global) {
  "use strict";

  const KIND_CARTEIRA = "CARTEIRA";
  const KIND_COBRANCA = "COBRANCA";

  function digits(v) {
    return String(v || "").replace(/\D/g, "");
  }

  function formatCpf(v) {
    const d = digits(v).slice(0, 11);
    if (d.length !== 11) return d;
    return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }

  function normalizeKind(kind) {
    const k = String(kind || "")
      .trim()
      .toUpperCase();
    return k === KIND_COBRANCA ? KIND_COBRANCA : KIND_CARTEIRA;
  }

  function normalizeStatus(status) {
    return String(status || "ATIVO").toUpperCase() === "INATIVO" ? "INATIVO" : "ATIVO";
  }

  function normalizeManagerRecord(raw) {
    if (!raw) return null;
    const status =
      raw.status != null
        ? normalizeStatus(raw.status)
        : raw.active === false
          ? "INATIVO"
          : "ATIVO";
    return {
      id: raw.id,
      user_id: raw.user_id,
      partner_id: raw.partner_id || null,
      advocacy_office_id: raw.advocacy_office_id || null,
      kind: normalizeKind(raw.kind),
      name: String(raw.name || "").trim(),
      cpf: raw.cpf || "",
      cpf_digits: raw.cpf_digits || digits(raw.cpf),
      phone: raw.phone || "",
      whatsapp: raw.whatsapp || "",
      email: raw.email || "",
      role_title: raw.role_title || "",
      notes: raw.notes || "",
      status: status,
      created_at: raw.created_at,
      updated_at: raw.updated_at,
    };
  }

  function normalizeManagerPayload(raw) {
    const cpfDigits = digits(raw && raw.cpf).slice(0, 11);
    return {
      name: String((raw && raw.name) || "").trim(),
      cpf: cpfDigits ? formatCpf(cpfDigits) : "",
      cpf_digits: cpfDigits,
      phone: String((raw && raw.phone) || "").trim(),
      whatsapp: String((raw && raw.whatsapp) || "").trim(),
      email: String((raw && raw.email) || "").trim(),
      role_title: String((raw && raw.role_title) || "").trim(),
      notes: String((raw && raw.notes) || "").trim(),
      status: normalizeStatus((raw && raw.status) || "ATIVO"),
      kind: normalizeKind(raw && raw.kind),
    };
  }

  function parentKey(row) {
    if (row && row.partner_id) return "p:" + String(row.partner_id);
    if (row && row.advocacy_office_id) return "o:" + String(row.advocacy_office_id);
    return "";
  }

  function validateManager(payload, list, parent, editingId) {
    const errors = [];
    if (!parent || (!parent.partner_id && !parent.advocacy_office_id)) {
      errors.push("Salve o cadastro antes de adicionar gestores.");
    }
    if (!payload.name) errors.push("Informe o nome completo do gestor.");
    if (payload.cpf_digits && payload.cpf_digits.length !== 11) {
      errors.push("CPF deve ter 11 dígitos.");
    }
    if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
      errors.push("E-mail inválido.");
    }
    if (payload.cpf_digits) {
      const kind = payload.kind;
      const dup = (list || []).find(function (m) {
        const rec = normalizeManagerRecord(m);
        if (!rec || String(rec.id) === String(editingId || "")) return false;
        if (rec.kind !== kind) return false;
        if (parent.partner_id && String(rec.partner_id) !== String(parent.partner_id)) return false;
        if (parent.advocacy_office_id && String(rec.advocacy_office_id) !== String(parent.advocacy_office_id))
          return false;
        return digits(rec.cpf_digits || rec.cpf) === payload.cpf_digits;
      });
      if (dup) errors.push("Já existe um gestor com este CPF neste cadastro.");
    }
    return errors;
  }

  function matchesParent(m, parent) {
    const rec = normalizeManagerRecord(m);
    if (!rec || !parent) return false;
    if (parent.partner_id) return String(rec.partner_id || "") === String(parent.partner_id);
    if (parent.advocacy_office_id)
      return String(rec.advocacy_office_id || "") === String(parent.advocacy_office_id);
    return false;
  }

  function listForParent(list, parent, kind, search) {
    const k = kind ? normalizeKind(kind) : "";
    const q = String(search || "")
      .trim()
      .toLowerCase();
    return (list || [])
      .map(normalizeManagerRecord)
      .filter(function (m) {
        if (!m || !matchesParent(m, parent)) return false;
        if (k && m.kind !== k) return false;
        if (!q) return true;
        const hay = [m.name, m.cpf, m.phone, m.whatsapp, m.email, m.role_title].join(" ").toLowerCase();
        const qDigits = digits(q);
        return hay.indexOf(q) >= 0 || (!!qDigits && digits(m.cpf + " " + m.phone).indexOf(qDigits) >= 0);
      })
      .sort(function (a, b) {
        if (a.status !== b.status) return a.status === "ATIVO" ? -1 : 1;
        return String(a.name || "").localeCompare(String(b.name || ""), "pt-BR");
      });
  }

  function countsForPartner(list, partnerId) {
    const parent = { partner_id: partnerId };
    return {
      carteira: listForParent(list, parent, KIND_CARTEIRA).length,
      cobranca: listForParent(list, parent, KIND_COBRANCA).length,
    };
  }

  function countsForOffice(list, officeId) {
    const parent = { advocacy_office_id: officeId };
    return {
      carteira: listForParent(list, parent, KIND_CARTEIRA).length,
      cobranca: listForParent(list, parent, KIND_COBRANCA).length,
    };
  }

  function namesPreview(list, parent, kind, max) {
    const rows = listForParent(list, parent, kind);
    const n = max || 2;
    const names = rows
      .slice(0, n)
      .map(function (m) {
        return m.name;
      })
      .filter(Boolean);
    if (rows.length > n) names.push("+" + (rows.length - n));
    return names.join(", ") || "—";
  }

  const api = {
    KIND_CARTEIRA: KIND_CARTEIRA,
    KIND_COBRANCA: KIND_COBRANCA,
    digits: digits,
    formatCpf: formatCpf,
    normalizeKind: normalizeKind,
    normalizeStatus: normalizeStatus,
    normalizeManagerRecord: normalizeManagerRecord,
    normalizeManagerPayload: normalizeManagerPayload,
    validateManager: validateManager,
    matchesParent: matchesParent,
    listForParent: listForParent,
    countsForPartner: countsForPartner,
    countsForOffice: countsForOffice,
    namesPreview: namesPreview,
    parentKey: parentKey,
  };

  global.partnerManagersService = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);

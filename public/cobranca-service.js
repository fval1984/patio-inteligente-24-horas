/**
 * Módulo Cobrança — consulta sobre receivables/vehicles/partners existentes.
 * Não altera lançamentos financeiros. Histórico apenas em cobrancas / cobranca_itens.
 */
(function cobrancaServiceModule(global) {
  "use strict";

  const PAGE_SIZE = 40;
  let blockedReceivableIds = new Set();
  const FILTER_TIPOS = [
    { id: "todos", label: "Todos" },
    { id: "escritorios", label: "Escritórios de advocacia" },
    { id: "instituicoes", label: "Instituições financeiras" },
    { id: "reboqueiros", label: "Reboqueiros" },
    { id: "leiloeiros", label: "Leiloeiros" },
    { id: "patios", label: "Pátios de apreensão" },
    { id: "oficiais", label: "Oficiais de justiça" },
    { id: "localizadores", label: "Localizadores" },
  ];

  function state() {
    return global.__ampliState || global.state || {};
  }

  function escapeHtml(str) {
    if (typeof global.escapeHtml === "function") return global.escapeHtml(str);
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatCurrency(v) {
    if (typeof global.formatCurrency === "function") return global.formatCurrency(v);
    const n = Number(v || 0);
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function formatDate(v) {
    if (typeof global.formatDate === "function") return global.formatDate(v);
    const s = String(v || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return v ? String(v) : "—";
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
  }

  function toLocalYmd(v) {
    if (typeof global.toLocalYmd === "function") return global.toLocalYmd(v);
    if (!v) return "";
    const s = String(v);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function todayYmd() {
    if (typeof global.financeTodayYmd === "function") return global.financeTodayYmd();
    return toLocalYmd(new Date().toISOString());
  }

  function ownerId() {
    if (typeof global.effectiveUserId === "function") return global.effectiveUserId();
    return state().patioOwnerUserId || state().user?.id || "anon";
  }

  function hiddenKey() {
    return "ampliauto_cobranca_hidden_receivables_" + String(ownerId() || "anon");
  }

  function hiddenReceivableIds() {
    try {
      const raw = JSON.parse(localStorage.getItem(hiddenKey()) || "[]");
      return new Set((Array.isArray(raw) ? raw : []).map(String));
    } catch (_e) {
      return new Set();
    }
  }

  function hideReceivableIds(ids) {
    const set = hiddenReceivableIds();
    (ids || []).forEach(function (id) {
      if (id) set.add(String(id));
    });
    try {
      localStorage.setItem(hiddenKey(), JSON.stringify([...set]));
    } catch (e) {
      console.warn("cobranca hide", e);
    }
    return set;
  }

  function vehicleById(id) {
    if (!id) return null;
    const list = state().vehicles || [];
    return list.find((v) => String(v.id) === String(id)) || null;
  }

  function partnerById(id) {
    if (!id) return null;
    return (state().partners || []).find((p) => String(p.id) === String(id)) || null;
  }

  function advocacyById(id) {
    if (!id) return null;
    const offices =
      (typeof global.advocacyOfficesService?.listCached === "function"
        ? global.advocacyOfficesService.listCached()
        : null) ||
      state().advocacyOffices ||
      [];
    return offices.find((o) => String(o.id) === String(id)) || null;
  }

  function normalizePartnerTipo(tipo) {
    if (typeof global.normalizePartnerTipo === "function") return global.normalizePartnerTipo(tipo);
    return String(tipo || "")
      .trim()
      .toUpperCase();
  }

  function partnerTipoLabel(tipo) {
    if (typeof global.partnerTipoLabel === "function") return global.partnerTipoLabel(tipo);
    return tipo || "Parceiro";
  }

  function filterGroupOfPartnerTipo(tipo) {
    const code = normalizePartnerTipo(tipo);
    if (code === "INSTITUICAO_FINANCEIRA") return "instituicoes";
    if (code === "GUINCHEIRO" || code === "TRANSPORTADORA" || code === "PRESTADOR_SERVICO" || code === "EMPRESA_REBOQUE" || code === "REBOQUEIRO_AUTONOMO") return "reboqueiros";
    if (code === "LEILOEIRO") return "leiloeiros";
    if (code === "PATIO_APREENSAO") return "patios";
    if (code === "OFICIAL_JUSTICA" || code === "ASSESSORIA") return "oficiais";
    if (code === "LOCALIZADOR") return "localizadores";
    return "localizadores";
  }

  function hasCaixaBaixa(r) {
    if (!r?.id) return false;
    if (typeof global.receivableCashMovementExists === "function" && global.receivableCashMovementExists(r.id)) {
      return true;
    }
    const id = String(r.id);
    return (state().cash || []).some(function (m) {
      if (String(m.conta_id) !== id) return false;
      const t = String(m.tipo_conta || "").toUpperCase();
      return t === "RECEBER" || t === "ENTRADA";
    });
  }

  function isPaidOrSettled(r) {
    if (!r) return true;
    const st = String(r.status || "").toUpperCase();
    if (st === "PAGO" || st === "RECEBIDO" || st === "BAIXADO" || st === "CANCELADO") return true;
    if (typeof global.receivableFinanceStatus === "function" && global.receivableFinanceStatus(r) === "PAGO") {
      return true;
    }
    if (typeof global.receivableFluxoFinanceiroQuitado === "function" && global.receivableFluxoFinanceiroQuitado(r)) {
      return true;
    }
    if (hasCaixaBaixa(r)) return true;
    if (typeof global.receivableHasPaidSiblingCycle === "function" && global.receivableHasPaidSiblingCycle(r)) {
      return true;
    }
    if (typeof global.financeReceivableIsDuplicateOfPaidCycle === "function" && global.financeReceivableIsDuplicateOfPaidCycle(r)) {
      return true;
    }
    const v = vehicleById(r.vehicle_id);
    if (v && typeof global.vehicleFinanceiroQuitadoParaSaida === "function" && global.vehicleFinanceiroQuitadoParaSaida(v)) {
      return true;
    }
    return false;
  }

  function isSemCobranca(r) {
    if (typeof global.receivableSemCobrancaFinanceira === "function") {
      return global.receivableSemCobrancaFinanceira(r);
    }
    return Number(r?.valor || 0) <= 0;
  }

  /** Somente títulos em Contas a receber do Financeiro. Pago/baixado não entra. */
  function isReceivableEmAberto(r) {
    if (!r) return false;
    if (isPaidOrSettled(r)) return false;
    if (isSemCobranca(r)) return false;
    if (typeof global.financeReceivableIsDuplicateOfPaidCycle === "function" && global.financeReceivableIsDuplicateOfPaidCycle(r)) {
      return false;
    }
    if (typeof global.receivableIsContaReceberFinanceiro === "function") {
      return global.receivableIsContaReceberFinanceiro(r);
    }
    const st = String(r.status || "").toUpperCase();
    return st === "EM_ABERTO" && Number(r.valor || 0) > 0 && !hasCaixaBaixa(r);
  }

  function dueYmd(r) {
    if (typeof global.financeContaDueYmd === "function") return global.financeContaDueYmd(r, "receivable");
    return String(r?.period_end || r?.created_at || "").slice(0, 10);
  }

  function isCicloPatioAberto(r) {
    if (typeof global.receivableIsCicloPatioAberto === "function") return global.receivableIsCicloPatioAberto(r);
    return r && String(r.status).toUpperCase() === "EM_ABERTO" && (r.period_end == null || r.period_end === "");
  }

  function itemAging(r) {
    if (isCicloPatioAberto(r)) return "aberto";
    const due = dueYmd(r);
    const today = todayYmd();
    if (due && today && due < today) return "vencido";
    return "a_vencer";
  }

  function displayStatus(r) {
    const aging = itemAging(r);
    if (aging === "vencido") return "Vencido";
    if (aging === "a_vencer") return "A vencer";
    return "Em aberto";
  }

  function rppPartnerId(r, v) {
    if (typeof global.financeReceivableRppPartnerId === "function") {
      return String(global.financeReceivableRppPartnerId(r, v) || "").trim();
    }
    if (v) return String(v.responsavel_financeiro_id || v.localizador_id || "").trim();
    return "";
  }

  function uniqueLinks(links) {
    const seen = new Set();
    const out = [];
    for (const l of links) {
      if (!l?.id) continue;
      const k = `${l.kind}:${l.id}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(l);
    }
    return out;
  }

  function receivablePartnerLinks(r, v) {
    const links = [];
    const rpp = rppPartnerId(r, v);
    if (rpp) links.push({ kind: "partner", id: rpp, relation: "rpp" });
    if (v?.localizador_id && String(v.localizador_id) !== rpp) {
      links.push({ kind: "partner", id: v.localizador_id, relation: "localizador" });
    }
    if (v?.leiloeiro_id) links.push({ kind: "partner", id: v.leiloeiro_id, relation: "leiloeiro" });
    if (v?.patio_parceiro_id) links.push({ kind: "partner", id: v.patio_parceiro_id, relation: "patio" });
    if (v?.advocacy_office_id) {
      links.push({ kind: "advocacy_office", id: v.advocacy_office_id, relation: "escritorio" });
    }
    return uniqueLinks(links);
  }

  function breakdown(r, v) {
    if (typeof global.receivableFinanceBreakdown === "function") {
      try {
        return global.receivableFinanceBreakdown(r, v) || {};
      } catch (_e) {
        return {};
      }
    }
    return {};
  }

  function buildLine(r) {
    const v = vehicleById(r.vehicle_id);
    const valor = Number(r.valor || 0);
    const br = breakdown(r, v);
    const dias = br.dias != null ? Number(br.dias) : null;
    const diarias = br.diariasTotal != null ? Number(br.diariasTotal) : 0;
    const outrosCalc = Number(br.taxaRemocao || 0) + Number(br.taxasAdicionais || 0);
    const outros = outrosCalc > 0 ? outrosCalc : Math.max(0, valor - diarias);
    const start = toLocalYmd(r.period_start || v?.data_entrada);
    const end = toLocalYmd(r.period_end || v?.data_saida);
    const aging = itemAging(r);
    return {
      receivableId: String(r.id),
      vehicleId: r.vehicle_id ? String(r.vehicle_id) : "",
      vehicle: v,
      receivable: r,
      valor,
      diarias: Math.min(diarias || valor, valor),
      outros,
      dias: dias != null && Number.isFinite(dias) ? dias : "",
      valorDiaria: v?.valor_diaria != null ? Number(v.valor_diaria) : null,
      marca: v?.marca || "",
      modelo: v?.modelo || "",
      veiculoNome: [v?.marca, v?.modelo].filter(Boolean).join(" ") || (typeof global.financeReceivableLabel === "function" ? global.financeReceivableLabel(r) : "Lançamento"),
      placa: v?.placa || "",
      chassi: v?.chassi || "",
      entrada: start,
      saida: end,
      aging,
      statusLabel: displayStatus(r),
      links: receivablePartnerLinks(r, v),
      servico: serviceLabel({ diarias, outros }),
      abatimento: abatimentoDoRecebivel(r.id),
    };
  }

  function roundMoney(n) {
    const v = Number(n || 0);
    if (!Number.isFinite(v)) return 0;
    return Math.round(v * 100) / 100;
  }

  function abatimentoDoRecebivel(receivableId) {
    let sum = 0;
    for (const m of state().cash || []) {
      if (String(m?.conta_id || "") !== String(receivableId || "")) continue;
      const t = String(m.tipo_conta || "").toUpperCase();
      if (t !== "RECEBER" && t !== "ENTRADA") continue;
      sum += Number(m.valor || 0);
    }
    return roundMoney(sum);
  }

  function saldoAposAbatimento(valor, abatido) {
    return roundMoney(Math.max(0, Number(valor || 0) - Number(abatido || 0)));
  }

  function serviceLabel(line) {
    if (Number(line?.diarias || 0) > 0) return "Guarda e custódia";
    if (Number(line?.outros || 0) > 0) return "Serviços e taxas";
    return "Guarda e custódia";
  }

  function paymentSnapshot(total, received) {
    const t = roundMoney(total);
    const r = roundMoney(Math.max(0, received));
    const capped = Math.min(r, t);
    const saldo = roundMoney(Math.max(0, t - capped));
    let status = "PENDENTE";
    if (capped > 0 && saldo <= 0.009) status = "PAGO";
    else if (capped > 0) status = "PARCIAL";
    return { total: t, recebido: status === "PAGO" ? t : capped, saldo: status === "PAGO" ? 0 : saldo, status };
  }

  function chargeStatusLabel(status) {
    const st = String(status || "").toUpperCase();
    if (st === "PAGO") return "Pago";
    if (st === "PARCIAL") return "Parcialmente pago";
    if (st === "HISTORICO") return "Histórico";
    return "Pendente";
  }

  function isActiveChargeStatus(status) {
    const st = String(status || "").toUpperCase();
    return st === "PENDENTE" || st === "PARCIAL";
  }

  function receivableIdsInActiveCharges(charges, items) {
    const active = new Set(
      (charges || []).filter((c) => isActiveChargeStatus(c.status)).map((c) => String(c.id))
    );
    const ids = new Set();
    for (const it of items || []) {
      if (!it?.receivable_id || !active.has(String(it.cobranca_id))) continue;
      ids.add(String(it.receivable_id));
    }
    return ids;
  }

  function setBlockedReceivableIds(ids) {
    blockedReceivableIds = new Set([...(ids || [])].map(String));
    return blockedReceivableIds;
  }

  function isReceivableInActiveCharge(id) {
    return blockedReceivableIds.has(String(id || ""));
  }

  function openLines() {
    const recs = state().receivables || [];
    const hidden = hiddenReceivableIds();
    const out = [];
    const seen = new Set();
    for (const r of recs) {
      if (!r?.id) continue;
      const id = String(r.id);
      if (seen.has(id) || hidden.has(id) || blockedReceivableIds.has(id)) continue;
      if (!isReceivableEmAberto(r)) continue;
      seen.add(id);
      out.push(buildLine(r));
    }
    return out;
  }

  function aguardandoLines() {
    const fn = global.collectPatioAguardandoFaturamentoReceivables;
    const list = typeof fn === "function" ? fn() : [];
    const hidden = hiddenReceivableIds();
    const out = [];
    const seen = new Set();
    for (const r of list || []) {
      if (!r?.id) continue;
      const id = String(r.id);
      if (seen.has(id) || hidden.has(id) || blockedReceivableIds.has(id)) continue;
      if (isPaidOrSettled(r) || isSemCobranca(r)) continue;
      seen.add(id);
      out.push(buildLine(r));
    }
    return out;
  }

  function billableLines() {
    const map = new Map();
    for (const line of openLines()) map.set(line.receivableId, line);
    for (const line of aguardandoLines()) {
      if (!map.has(line.receivableId)) map.set(line.receivableId, line);
    }
    return [...map.values()];
  }

  function clientCatalog() {
    const out = [];
    for (const p of state().partners || []) {
      if (!p?.id || p.ativo === false) continue;
      out.push({
        kind: "partner",
        id: String(p.id),
        key: `partner:${p.id}`,
        nome: p.nome || "Parceiro",
        documento: p.documento || p.cnpj || p.cpf || "",
        contato: p.whatsapp || p.telefone || "",
        tipoLabel: partnerTipoLabel(normalizePartnerTipo(p.tipo)),
      });
    }
    const offices =
      (typeof global.advocacyOfficesService?.listCached === "function" ? global.advocacyOfficesService.listCached() : null) ||
      state().advocacyOffices ||
      [];
    for (const o of offices) {
      if (!o?.id) continue;
      out.push({
        kind: "advocacy_office",
        id: String(o.id),
        key: `advocacy_office:${o.id}`,
        nome: o.name || o.nome || "Escritório",
        documento: o.documento || o.cnpj || "",
        contato: o.whatsapp || o.telefone || "",
        tipoLabel: "Escritório de advocacia",
      });
    }
    for (const c of state().financeContacts || []) {
      if (!c?.id || c.ativo === false) continue;
      if (String(c.tipo || "").toUpperCase() !== "CLIENTE") continue;
      out.push({
        kind: "finance_contact",
        id: String(c.id),
        key: `finance_contact:${c.id}`,
        nome: c.nome || "Cliente",
        documento: c.documento || "",
        contato: c.telefone || c.contato || "",
        tipoLabel: "Cliente cadastrado",
      });
    }
    out.sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
    return out;
  }

  function lineMatchesPartner(line, subject) {
    if (!subject?.id) return false;
    return line.links.some((l) => l.kind === subject.kind && String(l.id) === String(subject.id));
  }

  function subjectMeta(subject) {
    if (subject.kind === "advocacy_office") {
      const o = advocacyById(subject.id);
      return {
        id: subject.id,
        kind: subject.kind,
        nome: o?.name || o?.nome || "Escritório",
        tipoCode: "ESCRITORIO_ADVOCACIA",
        tipoLabel: "Escritório de advocacia",
        filterGroup: "escritorios",
      };
    }
    const p = partnerById(subject.id);
    const tipo = normalizePartnerTipo(p?.tipo);
    return {
      id: subject.id,
      kind: "partner",
      nome: p?.nome || "Parceiro",
      tipoCode: tipo,
      tipoLabel: partnerTipoLabel(tipo),
      filterGroup: filterGroupOfPartnerTipo(tipo),
      whatsapp: p?.whatsapp || p?.telefone || "",
      programa: !!(p?.perfil && p.perfil.programa_cliente_parceiro),
    };
  }

  function summarizeLines(lines) {
    let total = 0;
    let vencido = 0;
    let aVencer = 0;
    const vehicleIds = new Set();
    for (const line of lines) {
      total += line.valor;
      if (line.aging === "vencido") vencido += line.valor;
      else aVencer += line.valor;
      if (line.vehicleId) vehicleIds.add(line.vehicleId);
      else vehicleIds.add(`rec:${line.receivableId}`);
    }
    return {
      total,
      vencido,
      aVencer,
      veiculos: vehicleIds.size,
      count: lines.length,
    };
  }

  function partnerCards(allLines) {
    const map = new Map();
    for (const line of allLines) {
      for (const link of line.links) {
        const key = `${link.kind}:${link.id}`;
        if (!map.has(key)) map.set(key, { subject: { kind: link.kind, id: String(link.id) }, lines: [] });
        map.get(key).lines.push(line);
      }
    }
    const cards = [];
    for (const row of map.values()) {
      const meta = subjectMeta(row.subject);
      const sums = summarizeLines(row.lines);
      cards.push({ ...meta, ...sums, lines: row.lines });
    }
    cards.sort((a, b) => b.total - a.total || String(a.nome).localeCompare(String(b.nome), "pt-BR"));
    return cards;
  }

  function filterCards(cards, { search, tipo }) {
    const q = String(search || "")
      .trim()
      .toLowerCase();
    const tipoId = String(tipo || "todos");
    return cards.filter((c) => {
      if (tipoId !== "todos" && c.filterGroup !== tipoId) return false;
      if (!q) return true;
      return String(c.nome || "")
        .toLowerCase()
        .includes(q);
    });
  }

  function normalizeSearchToken(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  function lineMatchesSearch(line, raw) {
    const q = String(raw || "").trim();
    if (!q) return true;
    const qn = normalizeSearchToken(q);
    const ql = q.toLowerCase();
    const blob = [
      line.placa,
      line.chassi,
      line.marca,
      line.modelo,
      line.veiculoNome,
      line.vehicleId,
      line.receivableId,
      line.vehicle?.cor,
      line.vehicle?.observacoes,
    ]
      .join(" ")
      .toLowerCase();
    if (blob.includes(ql)) return true;
    if (qn && normalizeSearchToken(line.placa).includes(qn)) return true;
    if (qn && normalizeSearchToken(line.chassi).includes(qn)) return true;
    return false;
  }

  function lineInPeriod(line, de, ate) {
    if (!de && !ate) return true;
    const ref = line.saida || line.entrada || "";
    if (!ref) return false;
    if (de && ref < de) return false;
    if (ate && ref > ate) return false;
    return true;
  }

  function filterLines(lines, { status, search, de, ate }) {
    const st = String(status || "todos");
    return lines.filter((line) => {
      if (st === "vencidos" && line.aging !== "vencido") return false;
      if (st === "a_vencer" && line.aging !== "a_vencer") return false;
      if (st === "em_aberto" && line.aging === "vencido") return false;
      if (!lineMatchesSearch(line, search)) return false;
      if (!lineInPeriod(line, de, ate)) return false;
      return true;
    });
  }

  function periodFromLines(lines) {
    let min = "";
    let max = "";
    for (const line of lines) {
      const a = line.entrada || "";
      const b = line.saida || todayYmd();
      if (a && (!min || a < min)) min = a;
      if (b && (!max || b > max)) max = b;
    }
    return { inicio: min, fim: max };
  }

  function formatPeriodLabel(inicio, fim) {
    if (!inicio && !fim) return "—";
    if (inicio && fim) return `${formatDate(inicio)} – ${formatDate(fim)}`;
    return formatDate(inicio || fim);
  }

  function selectedSummary(lines) {
    const sums = summarizeLines(lines);
    let diarias = 0;
    let outros = 0;
    for (const line of lines) {
      diarias += Number(line.diarias || 0);
      outros += Number(line.outros || 0);
    }
    const periodo = periodFromLines(lines);
    return {
      ...sums,
      diarias,
      outros,
      periodo,
      periodoLabel: formatPeriodLabel(periodo.inicio, periodo.fim),
    };
  }

  function dedupeReceivableIds(ids) {
    const seen = new Set();
    const out = [];
    for (const id of ids || []) {
      const s = String(id || "").trim();
      if (!s || seen.has(s)) continue;
      seen.add(s);
      out.push(s);
    }
    return out;
  }

  function linesByReceivableIds(allPartnerLines, ids) {
    const want = new Set(dedupeReceivableIds(ids));
    return allPartnerLines.filter((l) => want.has(l.receivableId));
  }

  function nextNumeroLocal(list) {
    let max = 0;
    for (const c of list || []) {
      const n = Number(c.numero_cobranca || 0);
      if (n > max) max = n;
    }
    return max + 1;
  }

  async function loadHistory(subject, uid, supabase) {
    if (!supabase || !uid || !subject?.id) return [];
    let q = supabase.from("cobrancas").select("*").eq("user_id", uid).order("numero_cobranca", { ascending: false }).limit(80);
    if (subject.kind === "advocacy_office") q = q.eq("advocacy_office_id", subject.id);
    else q = q.eq("parceiro_id", subject.id);
    const { data, error } = await q;
    if (error) {
      if (/schema cache|does not exist|relation/i.test(error.message || "")) return { missingTable: true, rows: [] };
      console.warn("cobranca history", error);
      return [];
    }
    return data || [];
  }

  async function loadHistoryItems(cobrancaId, supabase) {
    if (!supabase || !cobrancaId) return [];
    const { data, error } = await supabase.from("cobranca_itens").select("*").eq("cobranca_id", cobrancaId);
    if (error) {
      console.warn("cobranca items", error);
      return [];
    }
    return data || [];
  }

  function itemPayload(cobrancaId, line) {
    return {
      cobranca_id: cobrancaId,
      receivable_id: line.receivableId,
      vehicle_id: line.vehicleId || null,
      valor: Number(Number(line.valor || 0).toFixed(2)),
      snapshot: {
        veiculo: line.veiculoNome,
        placa: line.placa,
        servico: line.servico || serviceLabel(line),
        entrada: line.entrada,
        saida: line.saida,
        dias: line.dias,
        valor: line.valor,
        valorOriginal: line.valorOriginal != null ? line.valorOriginal : line.valor,
        abatimento: line.abatimento || 0,
        diarias: line.diarias,
        outros: line.outros,
      },
    };
  }

  function headerExtras(header, lines, client) {
    const modo = client?.modo === "avulso" ? "avulso" : "cadastrado";
    const placas = (lines || []).map((l) => l.placa).filter(Boolean).join(" ");
    const ident = `FAT-${String(header.numero_cobranca || 0).padStart(6, "0")}`;
    return {
      ...header,
      status: "PENDENTE",
      valor_recebido: 0,
      cliente_modo: modo,
      cliente_documento: client?.documento || null,
      cliente_contato: client?.contato || null,
      identificador: ident,
      origem: client?.origem || "financeiro",
      data_vencimento: client?.vencimento || null,
      busca_texto: [header.parceiro_nome, client?.documento, client?.contato, placas, ident].filter(Boolean).join(" "),
    };
  }

  async function nextNumeroGlobal(uid, supabase) {
    const { data, error } = await supabase
      .from("cobrancas")
      .select("numero_cobranca")
      .eq("user_id", uid)
      .order("numero_cobranca", { ascending: false })
      .limit(1);
    if (error) return null;
    return Number(data?.[0]?.numero_cobranca || 0) + 1;
  }

  async function persistCobranca({ supabase, uid, subject, meta, lines, sessionUser, client }) {
    if (!supabase || !uid) throw new Error("Sessão indisponível.");
    const ids = dedupeReceivableIds(lines.map((l) => l.receivableId));
    if (ids.length !== lines.length) {
      throw new Error("Há lançamentos duplicados na seleção.");
    }
    await refreshBlockedReceivables(uid, supabase);
    const ja = ids.filter((id) => blockedReceivableIds.has(id));
    if (ja.length) {
      throw new Error("Um ou mais registros já estão em uma cobrança ativa. Atualize a lista antes de faturar de novo.");
    }
    const sums = selectedSummary(lines);
    const existing = await loadHistory(subject, uid, supabase);
    if (existing?.missingTable) {
      throw new Error(
        "As tabelas de histórico ainda não existem. Execute supabase/cobrancas.sql no SQL Editor (não altera dados financeiros)."
      );
    }
    const globalNumero = await nextNumeroGlobal(uid, supabase);
    const numero = globalNumero || nextNumeroLocal(Array.isArray(existing) ? existing : existing.rows);
    const nome = String(client?.nome || meta?.nome || "").trim();
    const origemCliente = client?.modo === "avulso" || subject?.kind === "avulso" || subject?.kind === "finance_contact" ? "avulso" : subject?.kind;
    const header = headerExtras(
      {
        user_id: uid,
        parceiro_origem: origemCliente === "advocacy_office" ? "advocacy_office" : origemCliente === "partner" ? "partner" : "avulso",
        parceiro_id: subject?.kind === "partner" ? subject.id : null,
        advocacy_office_id: subject?.kind === "advocacy_office" ? subject.id : null,
        parceiro_nome: nome,
        parceiro_tipo: client?.tipoLabel || meta?.tipoLabel || (client?.modo === "avulso" ? "Cliente avulso" : "Cliente"),
        numero_cobranca: numero,
        data_geracao: new Date().toISOString(),
        periodo_inicio: sums.periodo.inicio || null,
        periodo_fim: sums.periodo.fim || null,
        quantidade_veiculos: sums.veiculos,
        valor_total: Number(sums.total.toFixed(2)),
        usuario_id: sessionUser?.id || null,
        usuario_email: sessionUser?.email || null,
      },
      lines,
      client
    );
    const created = await insertChargeRow(supabase, header, lines);
    ids.forEach((id) => blockedReceivableIds.add(id));
    void noteChargeOnVehicles(supabase, created, lines);
    return created;
  }

  function stripChargeExtras(header) {
    const copy = { ...header };
    ["status", "valor_recebido", "cliente_modo", "cliente_documento", "cliente_contato", "identificador", "origem", "busca_texto", "data_vencimento"].forEach(
      (key) => {
        delete copy[key];
      }
    );
    if (copy.parceiro_origem === "avulso") copy.parceiro_origem = "partner";
    return copy;
  }

  async function insertChargeRow(supabase, header, lines) {
    let row = { ...header };
    let attempt = await supabase.from("cobrancas").insert(row).select("*").single();
    if (attempt.error && /column|schema cache|PGRST204|check constraint|cobrancas_origem/i.test(attempt.error.message || "")) {
      row = stripChargeExtras(row);
      attempt = await supabase.from("cobrancas").insert(row).select("*").single();
    }
    if (attempt.error && (String(attempt.error.code) === "23505" || /duplicate|unique/i.test(attempt.error.message || ""))) {
      row = { ...row, numero_cobranca: Number(row.numero_cobranca || 0) + 1 };
      if (row.identificador) row.identificador = `FAT-${String(row.numero_cobranca).padStart(6, "0")}`;
      attempt = await supabase.from("cobrancas").insert(row).select("*").single();
    }
    if (attempt.error) throw attempt.error;
    const items = lines.map((line) => itemPayload(attempt.data.id, line));
    const { error: itemErr } = await supabase.from("cobranca_itens").insert(items);
    if (itemErr) throw itemErr;
    return attempt.data;
  }

  async function noteChargeOnVehicles(supabase, charge, lines) {
    const ident = charge?.identificador || `FAT-${String(charge?.numero_cobranca || 0).padStart(6, "0")}`;
    for (const line of lines || []) {
      if (!line.vehicleId) continue;
      try {
        await supabase.from("vehicle_events").insert({
          vehicle_id: line.vehicleId,
          tipo: "COBRANCA_AGRUPADA",
          responsavel: charge?.parceiro_nome || "",
          descricao: `Incluído na fatura ${ident}. Valor deste veículo mantido: ${Number(line.valor || 0).toFixed(2)}. Total da fatura: ${Number(charge?.valor_total || 0).toFixed(2)}.`,
        });
      } catch (_e) {
        /* histórico do veículo é complementar; a fatura já foi gravada */
      }
    }
  }

  async function deleteCobranca(cobrancaId, uid, supabase) {
    if (!supabase || !uid || !cobrancaId) throw new Error("Não foi possível apagar o registro.");
    const { error: itemErr } = await supabase.from("cobranca_itens").delete().eq("cobranca_id", cobrancaId);
    if (itemErr && !/schema cache|does not exist|relation/i.test(itemErr.message || "")) throw itemErr;
    const { error } = await supabase.from("cobrancas").delete().eq("id", cobrancaId).eq("user_id", uid);
    if (error) {
      if (/permission|rls|policy/i.test(error.message || "")) {
        throw new Error(
          "Sem permissão para apagar. Execute supabase/cobrancas_delete.sql no SQL Editor (não altera o financeiro)."
        );
      }
      throw error;
    }
    return true;
  }

  function snapshotLinesFromItems(items) {
    return (items || []).map((it) => {
      const s = it.snapshot || {};
      return {
        receivableId: String(it.receivable_id || ""),
        vehicleId: String(it.vehicle_id || ""),
        veiculoNome: s.veiculo || "—",
        placa: s.placa || "",
        servico: s.servico || serviceLabel(s),
        entrada: s.entrada || "",
        saida: s.saida || "",
        dias: s.dias,
        valor: Number(it.valor != null ? it.valor : s.valor || 0),
        diarias: Number(s.diarias || 0),
        outros: Number(s.outros || 0),
      };
    });
  }

  async function refreshBlockedReceivables(uid, supabase) {
    if (!supabase || !uid) return blockedReceivableIds;
    const { data: charges, error } = await supabase
      .from("cobrancas")
      .select("id,status")
      .eq("user_id", uid)
      .in("status", ["PENDENTE", "PARCIAL"]);
    if (error) {
      if (/column|schema cache|status/i.test(error.message || "")) {
        blockedReceivableIds = new Set();
        return blockedReceivableIds;
      }
      console.warn("cobranca ativas", error);
      return blockedReceivableIds;
    }
    const ids = (charges || []).map((c) => c.id).filter(Boolean);
    if (!ids.length) {
      blockedReceivableIds = new Set();
      return blockedReceivableIds;
    }
    const { data: items, error: itemErr } = await supabase
      .from("cobranca_itens")
      .select("cobranca_id,receivable_id")
      .in("cobranca_id", ids);
    if (itemErr) {
      console.warn("cobranca itens ativos", itemErr);
      return blockedReceivableIds;
    }
    blockedReceivableIds = receivableIdsInActiveCharges(charges, items);
    return blockedReceivableIds;
  }

  async function loadCharges(uid, supabase) {
    if (!supabase || !uid) return { rows: [] };
    const { data, error } = await supabase
      .from("cobrancas")
      .select("*")
      .eq("user_id", uid)
      .order("numero_cobranca", { ascending: false })
      .limit(200);
    if (error) {
      if (/schema cache|does not exist|relation/i.test(error.message || "")) return { missingTable: true, rows: [] };
      throw error;
    }
    return { rows: data || [] };
  }

  function chargeMatchesSearch(row, raw) {
    const q = String(raw || "").trim().toLowerCase();
    if (!q) return true;
    const num = String(row?.numero_cobranca || 0).padStart(6, "0");
    const blob = [row?.parceiro_nome, row?.identificador, row?.cliente_documento, row?.busca_texto, row?.parceiro_tipo, num]
      .join(" ")
      .toLowerCase();
    return blob.includes(q);
  }

  function filterCharges(rows, { bucket, search }) {
    const b = String(bucket || "pendentes");
    return (rows || []).filter((row) => {
      const st = String(row.status || "HISTORICO").toUpperCase();
      if (b === "pendentes" && st !== "PENDENTE" && st !== "PARCIAL") return false;
      if (b === "recebidos" && st !== "PAGO" && st !== "HISTORICO") return false;
      return chargeMatchesSearch(row, search);
    });
  }

  async function saveFinanceClient({ supabase, uid, nome, documento, contato }) {
    if (!supabase || !uid) throw new Error("Sessão indisponível.");
    const payload = {
      user_id: uid,
      tipo: "CLIENTE",
      nome: String(nome || "").trim(),
      documento: String(documento || "").trim() || null,
      telefone: String(contato || "").trim() || null,
      ativo: true,
    };
    if (!payload.nome) throw new Error("Informe o nome para salvar o cliente.");
    const { data, error } = await supabase.from("finance_contacts").insert(payload).select("*").single();
    if (error) {
      if (/schema cache|does not exist|relation/i.test(error.message || "")) {
        throw new Error("Não foi possível salvar o cliente. Execute supabase/finance_contacts.sql. A cobrança pode ser feita mesmo assim.");
      }
      throw error;
    }
    const st = state();
    st.financeContacts = st.financeContacts || [];
    st.financeContacts.push(data);
    return data;
  }

  async function registerChargePayment({ supabase, uid, charge, amount, forma, dataMovimento }) {
    if (!supabase || !uid || !charge?.id) throw new Error("Cobrança não encontrada.");
    const st = String(charge.status || "").toUpperCase();
    if (st === "PAGO" || st === "HISTORICO") throw new Error("Esta cobrança não aceita novo pagamento.");
    const add = roundMoney(amount);
    const saldo = roundMoney(Number(charge.valor_total || 0) - Number(charge.valor_recebido || 0));
    if (!(add > 0)) throw new Error("Informe o valor recebido.");
    if (add - saldo > 0.009) throw new Error("O valor recebido não pode ser maior que o saldo.");
    const snap = paymentSnapshot(charge.valor_total, Number(charge.valor_recebido || 0) + add);
    if (snap.status === "PAGO") {
      const items = await loadHistoryItems(charge.id, supabase);
      const lines = snapshotLinesFromItems(items);
      if (typeof global.settleCobrancaReceivables !== "function") {
        throw new Error("Não foi possível quitar os veículos. A fatura continua em aberto e nenhum pagamento foi lançado.");
      }
      const settled = await global.settleCobrancaReceivables(lines, {
        dataMovimento: dataMovimento || todayYmd(),
        formaPagamento: forma || "PIX",
        observacao: `Fatura ${charge.identificador || charge.numero_cobranca} · ${charge.parceiro_nome || "cliente"}`,
      });
      if (!settled?.ok) {
        throw new Error(
          "O pagamento não foi lançado na fatura porque algum veículo não pôde ser quitado. Os que já estavam pagos permanecem pagos."
        );
      }
    }
    const pay = {
      user_id: uid,
      cobranca_id: charge.id,
      valor: add,
      forma: forma || "PIX",
      data_pagamento: dataMovimento || todayYmd(),
      observacao: snap.status === "PAGO" ? "Quitação da fatura" : "Pagamento parcial",
    };
    const ins = await supabase.from("cobranca_pagamentos").insert(pay).select("*").single();
    if (ins.error) {
      if (/schema cache|does not exist|relation/i.test(ins.error.message || "")) {
        throw new Error("Execute supabase/cobrancas_faturamento.sql no SQL Editor para registrar pagamentos. Os valores dos veículos não foram alterados por este passo.");
      }
      throw ins.error;
    }
    const upd = await supabase
      .from("cobrancas")
      .update({ status: snap.status, valor_recebido: snap.recebido })
      .eq("id", charge.id)
      .eq("user_id", uid)
      .select("*")
      .single();
    if (upd.error) throw upd.error;
    if (snap.status === "PAGO") await refreshBlockedReceivables(uid, supabase);
    return { charge: upd.data, pagamento: ins.data, snap };
  }

  global.cobrancaService = {
    PAGE_SIZE,
    FILTER_TIPOS,
    escapeHtml,
    formatCurrency,
    formatDate,
    toLocalYmd,
    todayYmd,
    isReceivableEmAberto,
    openLines,
    partnerCards,
    filterCards,
    filterLines,
    lineMatchesPartner,
    subjectMeta,
    summarizeLines,
    selectedSummary,
    formatPeriodLabel,
    linesByReceivableIds,
    dedupeReceivableIds,
    loadHistory,
    loadHistoryItems,
    hideReceivableIds,
    hiddenReceivableIds,
    persistCobranca,
    deleteCobranca,
    snapshotLinesFromItems,
    vehicleById,
    displayStatus,
    roundMoney,
    abatimentoDoRecebivel,
    saldoAposAbatimento,
    paymentSnapshot,
    chargeStatusLabel,
    serviceLabel,
    receivableIdsInActiveCharges,
    setBlockedReceivableIds,
    isReceivableInActiveCharge,
    billableLines,
    clientCatalog,
    refreshBlockedReceivables,
    loadCharges,
    filterCharges,
    chargeMatchesSearch,
    saveFinanceClient,
    registerChargePayment,
  };
})(typeof window !== "undefined" ? window : globalThis);

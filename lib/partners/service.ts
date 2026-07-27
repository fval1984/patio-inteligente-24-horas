import { normalizePartnerTipo, partnerTipoLabel } from "./fields";
import type {
  PartnerFilters,
  PartnerHistoricoItem,
  PartnerRecord,
  PartnerSummary,
} from "./types";
import { DEFAULT_PARTNER_FILTERS } from "./types";
import { validatePartner } from "./validation";

function digits(v: string | null | undefined): string {
  return String(v || "").replace(/\D/g, "");
}

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function parseJsonField<T>(v: unknown, fallback: T): T {
  if (v == null) return fallback;
  if (typeof v === "object") return v as T;
  if (typeof v === "string") {
    try {
      return JSON.parse(v) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export function normalizePartnerRecord(raw: PartnerRecord | null | undefined): PartnerRecord {
  if (!raw) return {};
  return {
    ...raw,
    tipo: normalizePartnerTipo(raw.tipo),
    status: String(raw.status || "ATIVO").toUpperCase() === "INATIVO" ? "INATIVO" : "ATIVO",
    perfil: parseJsonField(raw.perfil, {}),
    contatos: asArray(parseJsonField(raw.contatos, [])),
    documentos: asArray(parseJsonField(raw.documentos, [])),
    historico: asArray(parseJsonField(raw.historico, [])),
    telefone: raw.telefone || raw.contato || "",
  };
}

export function filterPartners(list: PartnerRecord[], filtersIn: Partial<PartnerFilters> = {}): PartnerRecord[] {
  const f = { ...DEFAULT_PARTNER_FILTERS, ...filtersIn };
  const q = String(f.search || "")
    .trim()
    .toLowerCase();
  const qDigits = digits(q);
  return (list || [])
    .map(normalizePartnerRecord)
    .filter((p) => {
      if (f.tipo && normalizePartnerTipo(p.tipo) !== normalizePartnerTipo(f.tipo)) return false;
      if (f.cidade && String(p.cidade || "").toLowerCase() !== f.cidade.toLowerCase()) return false;
      if (f.estado && String(p.estado || "").toUpperCase() !== f.estado.toUpperCase()) return false;
      if (f.status && String(p.status || "ATIVO").toUpperCase() !== f.status.toUpperCase()) return false;
      if (!q) return true;
      const tipoLabel = partnerTipoLabel(p.tipo).toLowerCase();
      const hay = `${p.nome || ""} ${p.cpf || ""} ${p.cidade || ""} ${p.telefone || ""} ${p.whatsapp || ""} ${p.contato || ""} ${p.tipo || ""} ${tipoLabel}`.toLowerCase();
      const hayDigits = digits(`${p.cpf || ""}${p.telefone || ""}${p.whatsapp || ""}`);
      return hay.includes(q) || (!!qDigits && hayDigits.includes(qDigits));
    });
}

export function buildPartnerSummary(
  partner: PartnerRecord,
  ctx: {
    vehicles?: { id: string; localizador_id?: string | null; leiloeiro_id?: string | null; responsavel_financeiro_id?: string | null; status?: string | null; data_entrada?: string | null; data_saida?: string | null; updated_at?: string | null }[];
    receivables?: { vehicle_id?: string | null; valor?: number | string | null; status?: string | null; period_end?: string | null; updated_at?: string | null }[];
    asOfYmd?: string;
  } = {}
): PartnerSummary {
  const p = normalizePartnerRecord(partner);
  const pid = String(p.id || "");
  const vehicles = ctx.vehicles || [];
  const linked = vehicles.filter(
    (v) =>
      String(v.localizador_id || "") === pid ||
      String(v.leiloeiro_id || "") === pid ||
      String(v.responsavel_financeiro_id || "") === pid
  );
  const ativos = linked.filter((v) => String(v.status || "").toUpperCase() !== "REMOVIDO").length;
  const year = String(ctx.asOfYmd || new Date().toISOString().slice(0, 10)).slice(0, 4);
  const vIds = new Set(linked.map((v) => String(v.id)));
  let receitaAno = 0;
  for (const r of ctx.receivables || []) {
    if (!r.vehicle_id || !vIds.has(String(r.vehicle_id))) continue;
    if (String(r.status || "").toUpperCase() !== "PAGO") continue;
    const ref = String(r.period_end || r.updated_at || "");
    if (ref.slice(0, 4) === year) receitaAno += Number(r.valor || 0);
  }
  let ultima = "";
  for (const v of linked) {
    const cand = v.data_saida || v.data_entrada || v.updated_at || "";
    if (cand && cand > ultima) ultima = cand;
  }
  return {
    nome: String(p.nome || "—"),
    tipoLabel: partnerTipoLabel(p.tipo),
    veiculosAtivos: ativos,
    receitaAno,
    ultimaMovimentacao: formatRelativeDay(ultima),
    status: String(p.status || "ATIVO"),
  };
}

function formatRelativeDay(iso: string): string {
  if (!iso) return "—";
  const ymd = iso.slice(0, 10);
  const today = new Date();
  const t = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  if (ymd === t) return "Hoje";
  const d = new Date(`${ymd}T12:00:00`);
  const yest = new Date(today);
  yest.setDate(yest.getDate() - 1);
  const y = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, "0")}-${String(yest.getDate()).padStart(2, "0")}`;
  if (ymd === y) return "Ontem";
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString("pt-BR");
}

export function pushHistorico(
  hist: PartnerHistoricoItem[] | null | undefined,
  item: Omit<PartnerHistoricoItem, "id" | "data" | "hora"> & { data?: string; hora?: string }
): PartnerHistoricoItem[] {
  const now = new Date();
  const data = item.data || now.toLocaleDateString("pt-BR");
  const hora = item.hora || now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return [
    {
      id: `h_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      acao: item.acao,
      detalhe: item.detalhe,
      usuario: item.usuario,
      data,
      hora,
    },
    ...asArray<PartnerHistoricoItem>(hist),
  ].slice(0, 200);
}

export function toDbPayload(input: PartnerRecord, userId: string): Record<string, unknown> {
  const tipo = normalizePartnerTipo(input.tipo);
  const status = String(input.status || "ATIVO").toUpperCase() === "INATIVO" ? "INATIVO" : "ATIVO";
  const telefone = String(input.telefone || input.contato || "").trim();
  return {
    user_id: userId,
    nome: String(input.nome || "").trim() || null,
    tipo,
    cpf: String(input.cpf || "").trim() || null,
    email: String(input.email || "").trim() || null,
    contato: telefone || null,
    telefone: telefone || null,
    whatsapp: String(input.whatsapp || "").trim() || null,
    cep: String(input.cep || "").trim() || null,
    endereco: String(input.endereco || "").trim() || null,
    numero: String(input.numero || "").trim() || null,
    complemento: String(input.complemento || "").trim() || null,
    bairro: String(input.bairro || "").trim() || null,
    cidade: String(input.cidade || "").trim() || null,
    estado: String(input.estado || "").trim().toUpperCase() || null,
    status,
    observacoes: String(input.observacoes || "").trim() || null,
    perfil: input.perfil || {},
    contatos: input.contatos || [],
    documentos: input.documentos || [],
    historico: input.historico || [],
  };
}

export { validatePartner };

export const PUBLIC_VEHICLE_TOKEN_RE = /^[0-9a-f]{32,64}$/i;

export function isPublicVehicleToken(token: string | null | undefined): boolean {
  return PUBLIC_VEHICLE_TOKEN_RE.test(String(token || "").trim());
}

export type PublicVehicleTimelineItem = {
  code: string;
  title: string;
  at: string | null;
  at_label: string | null;
};

export type PublicVehicleHistory = {
  ok: true;
  placa: string;
  marca: string;
  modelo: string;
  cor: string;
  data_entrada: string | null;
  data_entrada_label: string | null;
  status: string;
  status_label: string;
  financeira: string;
  escritorio: string;
  leiloeiro: string;
  timeline: PublicVehicleTimelineItem[];
};

export function publicVehicleStatusLabel(status: string | null | undefined): string {
  const raw = String(status || "");
  if (raw === "NO_PATIO" || raw === "AGUARDANDO_VISTORIA") return "Em guarda no pátio";
  if (raw === "LIBERACAO_SOLICITADA") return "Solicitação de liberação (VSL)";
  if (raw === "LIBERACAO_CONFIRMADA" || raw === "REMOCAO_CONFIRMADA" || raw === "REMocao_CONFIRMADA") {
    return "Liberação confirmada";
  }
  if (raw === "REMOVIDO") return "Removido / retirado do pátio";
  return raw || "Em guarda no pátio";
}

export function chavePublicLabel(raw: string | null | undefined): { label: string; cls: string } | null {
  const s = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/\//g, "_");
  if (s === "C_CHAVE" || s === "CCHAVE") return { label: "C/CHAVE", cls: "is-c-chave" };
  if (s === "S_CHAVE" || s === "SCHAVE") return { label: "S/CHAVE", cls: "is-s-chave" };
  if (s === "TRANCADO") return { label: "TRANCADO", cls: "is-trancado" };
  return null;
}

export function splitEntryDateTime(
  iso: string | null | undefined,
  label?: string | null
): { date: string; time: string } {
  if (iso) {
    const d = new Date(String(iso));
    if (!Number.isNaN(d.getTime())) {
      return {
        date: d.toLocaleDateString("pt-BR", { timeZone: "America/Recife" }),
        time: d.toLocaleTimeString("pt-BR", {
          timeZone: "America/Recife",
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
    }
  }
  const text = String(label || "").trim();
  const match = text.match(/^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})/);
  if (match) return { date: match[1], time: match[2] };
  return { date: text || "—", time: "—" };
}

export type LiberationStep = {
  code: string;
  title: string;
  at: string | null;
  at_label: string | null;
  current: boolean;
};

export function liberationSteps(
  timeline: PublicVehicleTimelineItem[] | null | undefined
): LiberationStep[] {
  const by: Record<string, PublicVehicleTimelineItem> = {};
  (timeline || []).forEach((item) => {
    if (item && item.code) by[item.code] = item;
  });
  const defs = [
    { code: "EM_GUARDA", title: "Em guarda" },
    { code: "VSL", title: "Liberação solicitada (VSL)" },
    { code: "VSC", title: "Liberação confirmada (VSC)" },
    { code: "VRP", title: "Removido do pátio (VRP)" },
  ];
  const guarda = by.EM_GUARDA || by.REGISTRADO;
  const out: LiberationStep[] = [];
  if (guarda) {
    out.push({
      code: "EM_GUARDA",
      title: defs[0].title,
      at: guarda.at,
      at_label: guarda.at_label,
      current: false,
    });
  }
  defs.slice(1).forEach((d) => {
    const hit = by[d.code];
    if (!hit) return;
    out.push({
      code: d.code,
      title: d.title,
      at: hit.at,
      at_label: hit.at_label,
      current: false,
    });
  });
  if (out.length) out[out.length - 1].current = true;
  return out;
}

type TimelineSource = {
  data_entrada?: string | null;
  data_saida?: string | null;
  liberacao_solicitada_em?: string | null;
  liberacao_confirmada_em?: string | null;
};

type TimelineEvent = {
  tipo?: string | null;
  data_evento?: string | null;
  created_at?: string | null;
};

function firstEventAt(events: TimelineEvent[] | null | undefined, tipos: string[]): string | null {
  const set = new Set(tipos);
  let best: string | null = null;
  for (const ev of events || []) {
    if (!set.has(String(ev.tipo || ""))) continue;
    const at = ev.data_evento || ev.created_at || null;
    if (!at) continue;
    if (!best || String(at) < best) best = String(at);
  }
  return best;
}

export function buildPublicVehicleTimeline(
  vehicle: TimelineSource,
  events?: TimelineEvent[] | null
): { code: string; title: string; at: string }[] {
  const items: { code: string; title: string; at: string }[] = [];
  if (vehicle.data_entrada) {
    items.push({
      code: "REGISTRADO",
      title: "Veículo registrado no pátio",
      at: String(vehicle.data_entrada),
    });
    items.push({
      code: "EM_GUARDA",
      title: "Veículo em guarda no pátio",
      at: String(vehicle.data_entrada),
    });
  }
  const vsl = vehicle.liberacao_solicitada_em || firstEventAt(events, ["LIBERACAO_SOLICITADA"]);
  if (vsl) {
    items.push({
      code: "VSL",
      title: "Solicitação de liberação recebida (VSL)",
      at: String(vsl),
    });
  }
  const vsc = vehicle.liberacao_confirmada_em || firstEventAt(events, ["LIBERACAO_CONFIRMADA"]);
  if (vsc) {
    items.push({
      code: "VSC",
      title: "Liberação confirmada",
      at: String(vsc),
    });
  }
  const out =
    vehicle.data_saida || firstEventAt(events, ["REMOVIDO", "REMocao_CONFIRMADA"]);
  if (out) {
    items.push({
      code: "VRP",
      title: "Veículo removido ou retirado do pátio",
      at: String(out),
    });
  }
  return items;
}

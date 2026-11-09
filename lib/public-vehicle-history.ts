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

import { SupabaseClient } from "@supabase/supabase-js";
import checklistKeys from "./vehicle-entry-inspection-checklist-keys.json";

export type InspectionClassification =
  | "BOM"
  | "REGULAR"
  | "DANIFICADO"
  | "SEM_TESTE"
  | "INEXISTENTE";

export type InspectionItemPayload = {
  category: string;
  item_key: string;
  item_label: string;
  classification: InspectionClassification;
};

export type InspectionDamagePayload = {
  item_key?: string;
  area_label: string;
  damage_type: string;
  severity?: string;
  description?: string;
  notes?: string;
  client_key?: string;
};

export type CompleteEntryInspectionInput = {
  ownerUserId: string;
  vehicleId: string;
  inspectorUserId: string;
  inspectorName: string;
  generalNotes?: string;
  diagramMarkers?: unknown[];
  items: InspectionItemPayload[];
  damages: InspectionDamagePayload[];
};

export type CompleteEntryInspectionResult = {
  inspection_id: string;
  inspection_number: number;
  vehicle_id: string;
};

export function isMissingInspectionSchemaError(message: string): boolean {
  return /vehicle_entry_inspection|complete_vehicle_entry_inspection|relation|schema cache|does not exist|PGRST/i.test(
    message || ""
  );
}

export async function resolveVehicleOwnerUserId(
  admin: SupabaseClient,
  authUserId: string
): Promise<{ ownerUserId: string; inspectorUserId: string }> {
  const { data: delegateRow } = await admin
    .from("track_managers")
    .select("owner_user_id")
    .eq("user_id", authUserId)
    .maybeSingle();

  if (delegateRow?.owner_user_id) {
    return { ownerUserId: delegateRow.owner_user_id, inspectorUserId: authUserId };
  }
  return { ownerUserId: authUserId, inspectorUserId: authUserId };
}

export async function resolveInspectorDisplayName(
  admin: SupabaseClient,
  userId: string
): Promise<string> {
  const { data } = await admin.auth.admin.getUserById(userId);
  const meta = data?.user?.user_metadata || {};
  const fromMeta =
    (meta.full_name as string) ||
    (meta.name as string) ||
    (meta.display_name as string) ||
    "";
  if (fromMeta.trim()) return fromMeta.trim();
  const email = data?.user?.email || "";
  if (email.includes("@")) return email.split("@")[0];
  return "Utilizador";
}

export const INSPECTION_ITEM_COUNT = checklistKeys.length;

/** Chaves obrigatórias do checklist (espelho de public/vehicle-entry-inspection-checklist.js). */
export const INSPECTION_CHECKLIST_KEYS = checklistKeys as readonly string[];

const VALID_CLASSIFICATIONS = new Set([
  "BOM",
  "REGULAR",
  "DANIFICADO",
  "SEM_TESTE",
  "INEXISTENTE",
]);

export function validateInspectionItems(items: InspectionItemPayload[]): string | null {
  if (!Array.isArray(items) || !items.length) {
    return `Todos os ${INSPECTION_ITEM_COUNT} itens do checklist devem ser classificados.`;
  }

  const byKey = new Map<string, InspectionItemPayload>();
  for (const it of items) {
    if (it?.item_key) byKey.set(it.item_key, it);
  }

  const missing: string[] = [];

  for (const key of INSPECTION_CHECKLIST_KEYS) {
    const it = byKey.get(key);
    const cls = it?.classification;
    if (!cls || !VALID_CLASSIFICATIONS.has(cls)) {
      missing.push(it?.item_label || key);
    }
  }

  if (missing.length) {
    if (missing.length >= INSPECTION_ITEM_COUNT) {
      return `Todos os ${INSPECTION_ITEM_COUNT} itens do checklist devem ser classificados (BOM, REGULAR, DANIFICADO, SEM TESTE ou INEXISTENTE).`;
    }
    const preview = missing.slice(0, 10).join(", ");
    const suffix = missing.length > 10 ? `… (+${missing.length - 10})` : "";
    return `Faltam ${missing.length} item(ns) no checklist: ${preview}${suffix}`;
  }

  return null;
}

export async function completeVehicleEntryInspection(
  admin: SupabaseClient,
  input: CompleteEntryInspectionInput
): Promise<{ data: CompleteEntryInspectionResult | null; error: string | null }> {
  const itemErr = validateInspectionItems(input.items);
  if (itemErr) return { data: null, error: itemErr };

  const { data, error } = await admin.rpc("complete_vehicle_entry_inspection", {
    p_user_id: input.ownerUserId,
    p_vehicle_id: input.vehicleId,
    p_inspector_user_id: input.inspectorUserId,
    p_inspector_name: input.inspectorName,
    p_general_notes: input.generalNotes || "",
    p_diagram_markers: input.diagramMarkers || [],
    p_items: input.items,
    p_damages: input.damages.map(({ client_key, ...rest }) => rest),
  });

  if (error) {
    return { data: null, error: error.message || "Erro ao finalizar vistoria." };
  }

  const row = data as Record<string, unknown> | null;
  if (!row?.inspection_id) {
    return { data: null, error: "Resposta inválida ao finalizar vistoria." };
  }

  return {
    data: {
      inspection_id: String(row.inspection_id),
      inspection_number: Number(row.inspection_number),
      vehicle_id: String(row.vehicle_id),
    },
    error: null,
  };
}

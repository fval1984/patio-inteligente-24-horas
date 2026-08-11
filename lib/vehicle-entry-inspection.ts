import { SupabaseClient } from "@supabase/supabase-js";

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

export const INSPECTION_ITEM_COUNT = 44;

export function validateInspectionItems(items: InspectionItemPayload[], expectedCount = INSPECTION_ITEM_COUNT): string | null {
  if (!Array.isArray(items) || items.length !== expectedCount) {
    return `Todos os ${expectedCount} itens devem ser classificados.`;
  }
  const valid = new Set(["BOM", "REGULAR", "DANIFICADO", "SEM_TESTE", "INEXISTENTE"]);
  for (const it of items) {
    if (!it.item_key || !it.classification || !valid.has(it.classification)) {
      return `Item «${it.item_label || it.item_key}» sem classificação válida.`;
    }
  }
  return null;
}

export async function completeVehicleEntryInspection(
  admin: SupabaseClient,
  input: CompleteEntryInspectionInput
): Promise<{ data: CompleteEntryInspectionResult | null; error: string | null }> {
  const itemErr = validateInspectionItems(input.items, input.items.length);
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

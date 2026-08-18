import { SupabaseClient } from "@supabase/supabase-js";
import checklistKeysByVariant from "./vehicle-entry-inspection-checklist-keys.json";

export type InspectionClassification =
  | "BOM"
  | "REGULAR"
  | "DANIFICADO"
  | "SEM_TESTE"
  | "INEXISTENTE";

export type InspectionVariant = "LEVE" | "PESADOS" | "TRATORES" | "MOTOS";

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
  inspectionVariant?: InspectionVariant | string;
  formExtras?: Record<string, unknown>;
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

export type UpdateEntryInspectionInput = {
  ownerUserId: string;
  inspectionId: string;
  vehicleId: string;
  inspectionVariant?: InspectionVariant | string;
  formExtras?: Record<string, unknown>;
  generalNotes?: string;
  diagramMarkers?: unknown[];
  items: InspectionItemPayload[];
  damages: InspectionDamagePayload[];
};

export type UpdateEntryInspectionResult = {
  inspection_id: string;
  inspection_number: number;
  vehicle_id: string;
  damage_rows: { id: string; item_key?: string | null }[];
};

const KEYS_BY_VARIANT = checklistKeysByVariant as Record<string, string[]>;

export function getChecklistKeysForVariant(variant?: string): readonly string[] {
  const v = String(variant || "LEVE").toUpperCase();
  return KEYS_BY_VARIANT[v]?.length ? KEYS_BY_VARIANT[v] : KEYS_BY_VARIANT.LEVE;
}

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

/** @deprecated Use getChecklistKeysForVariant */
export const INSPECTION_CHECKLIST_KEYS = KEYS_BY_VARIANT.LEVE;
export const INSPECTION_ITEM_COUNT = KEYS_BY_VARIANT.LEVE.length;

const VALID_CLASSIFICATIONS = new Set([
  "BOM",
  "REGULAR",
  "DANIFICADO",
  "SEM_TESTE",
  "INEXISTENTE",
]);

/** Cópia das classificações em form_extras — recupera a vistoria se a tabela de itens falhar ou vier vazia. */
export const ITEM_CLASSIFICATIONS_BACKUP_KEY = "__item_classifications";

export function normalizeInspectionClassification(raw: unknown): InspectionClassification | "" {
  const s = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
  if (s === "SEMTESTE") return "SEM_TESTE";
  if (VALID_CLASSIFICATIONS.has(s)) return s as InspectionClassification;
  return "";
}

export function withClassificationBackup(
  formExtras: Record<string, unknown> | undefined,
  items: InspectionItemPayload[]
): Record<string, unknown> {
  const extras: Record<string, unknown> = { ...(formExtras || {}) };
  const backup: Record<string, InspectionClassification> = {};
  for (const it of items || []) {
    const key = String(it?.item_key || "").trim();
    const cls = normalizeInspectionClassification(it?.classification);
    if (key && cls) backup[key] = cls;
  }
  extras[ITEM_CLASSIFICATIONS_BACKUP_KEY] = backup;
  return extras;
}

export function classificationsFromBackup(formExtras: unknown): Record<string, InspectionClassification> {
  const extras =
    formExtras && typeof formExtras === "object" && !Array.isArray(formExtras)
      ? (formExtras as Record<string, unknown>)
      : {};
  const raw = extras[ITEM_CLASSIFICATIONS_BACKUP_KEY];
  const out: Record<string, InspectionClassification> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const k = String(key || "").trim();
    const cls = normalizeInspectionClassification(value);
    if (k && cls) out[k] = cls;
  }
  return out;
}

export async function persistInspectionItems(
  admin: SupabaseClient,
  inspectionId: string,
  items: InspectionItemPayload[]
): Promise<string | null> {
  const payload = (items || [])
    .map((it) => ({
      inspection_id: inspectionId,
      category: String(it.category || ""),
      item_key: String(it.item_key || "").trim(),
      item_label: String(it.item_label || ""),
      classification: normalizeInspectionClassification(it.classification) || it.classification,
    }))
    .filter((it) => it.item_key && VALID_CLASSIFICATIONS.has(String(it.classification)));

  if (!payload.length) return "Checklist vazio.";

  const { error: upsertErr } = await admin
    .from("vehicle_entry_inspection_items")
    .upsert(payload, { onConflict: "inspection_id,item_key" });
  if (!upsertErr) return null;

  const { error: insertErr } = await admin.from("vehicle_entry_inspection_items").insert(payload);
  if (!insertErr) return null;

  const duplicate = /duplicate|unique|conflict/i.test(`${insertErr.message || ""} ${upsertErr.message || ""}`);
  if (!duplicate) {
    return insertErr.message || upsertErr.message || "Erro ao gravar itens da vistoria.";
  }

  for (const it of payload) {
    const { data: existing, error: findErr } = await admin
      .from("vehicle_entry_inspection_items")
      .select("id")
      .eq("inspection_id", inspectionId)
      .eq("item_key", it.item_key)
      .maybeSingle();
    if (findErr) return findErr.message || "Erro ao gravar itens da vistoria.";
    if (existing?.id) {
      const { error: updErr } = await admin
        .from("vehicle_entry_inspection_items")
        .update({
          category: it.category,
          item_label: it.item_label,
          classification: it.classification,
        })
        .eq("id", existing.id);
      if (updErr) return updErr.message || "Erro ao gravar itens da vistoria.";
    } else {
      const { error: oneErr } = await admin.from("vehicle_entry_inspection_items").insert(it);
      if (oneErr && !/duplicate|unique|conflict/i.test(oneErr.message || "")) {
        return oneErr.message || "Erro ao gravar itens da vistoria.";
      }
    }
  }
  return null;
}

export function validateInspectionItems(
  items: InspectionItemPayload[],
  variant?: string
): string | null {
  const requiredKeys = getChecklistKeysForVariant(variant);
  if (!Array.isArray(items) || !items.length) {
    return `Todos os ${requiredKeys.length} itens do checklist devem ser classificados.`;
  }

  const byKey = new Map<string, InspectionItemPayload>();
  for (const it of items) {
    if (it?.item_key) byKey.set(it.item_key, it);
  }

  const missing: string[] = [];

  for (const key of requiredKeys) {
    const it = byKey.get(key);
    const cls = it?.classification;
    if (!cls || !VALID_CLASSIFICATIONS.has(cls)) {
      missing.push(it?.item_label || key);
    }
  }

  if (missing.length) {
    if (missing.length >= requiredKeys.length) {
      return `Todos os ${requiredKeys.length} itens do checklist devem ser classificados (BOM, REGULAR, DANIFICADO, SEM TESTE ou INEXISTENTE).`;
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
  const variant = String(input.inspectionVariant || "LEVE").toUpperCase();
  const itemErr = validateInspectionItems(input.items, variant);
  if (itemErr) return { data: null, error: itemErr };

  const formExtras = withClassificationBackup(input.formExtras, input.items);

  const { data, error } = await admin.rpc("complete_vehicle_entry_inspection", {
    p_user_id: input.ownerUserId,
    p_vehicle_id: input.vehicleId,
    p_inspector_user_id: input.inspectorUserId,
    p_inspector_name: input.inspectorName,
    p_general_notes: input.generalNotes || "",
    p_diagram_markers: input.diagramMarkers || [],
    p_items: input.items,
    p_damages: input.damages.map(({ client_key, ...rest }) => rest),
    p_inspection_variant: variant,
    p_form_extras: formExtras,
  });

  if (error) {
    return { data: null, error: error.message || "Erro ao finalizar vistoria." };
  }

  const row = data as Record<string, unknown> | null;
  if (!row?.inspection_id) {
    return { data: null, error: "Resposta inválida ao finalizar vistoria." };
  }

  const inspectionId = String(row.inspection_id);
  const persistErr = await persistInspectionItems(admin, inspectionId, input.items);
  if (persistErr) {
    await admin
      .from("vehicle_entry_inspections")
      .update({ form_extras: formExtras, updated_at: new Date().toISOString() })
      .eq("id", inspectionId);
  }

  return {
    data: {
      inspection_id: inspectionId,
      inspection_number: Number(row.inspection_number),
      vehicle_id: String(row.vehicle_id),
    },
    error: null,
  };
}

export async function updateVehicleEntryInspection(
  admin: SupabaseClient,
  input: UpdateEntryInspectionInput
): Promise<{ data: UpdateEntryInspectionResult | null; error: string | null }> {
  const variant = String(input.inspectionVariant || "LEVE").toUpperCase();
  const itemErr = validateInspectionItems(input.items, variant);
  if (itemErr) return { data: null, error: itemErr };

  const { data: insp, error: fetchErr } = await admin
    .from("vehicle_entry_inspections")
    .select("id, vehicle_id, inspection_number, status, user_id")
    .eq("id", input.inspectionId)
    .eq("user_id", input.ownerUserId)
    .maybeSingle();

  if (fetchErr || !insp) {
    return { data: null, error: fetchErr?.message || "Vistoria não encontrada." };
  }
  if (String(insp.vehicle_id) !== String(input.vehicleId)) {
    return { data: null, error: "Veículo não corresponde à vistoria." };
  }
  if (String(insp.status || "").toUpperCase() !== "CONCLUIDA") {
    return { data: null, error: "Somente vistorias concluídas podem ser editadas." };
  }

  const formExtras = withClassificationBackup(input.formExtras, input.items);
  const now = new Date().toISOString();
  const { error: updErr } = await admin
    .from("vehicle_entry_inspections")
    .update({
      general_notes: input.generalNotes || "",
      diagram_markers: input.diagramMarkers || [],
      form_extras: formExtras,
      inspection_variant: variant,
      updated_at: now,
    })
    .eq("id", input.inspectionId);

  if (updErr) {
    return { data: null, error: updErr.message || "Erro ao atualizar vistoria." };
  }

  const persistErr = await persistInspectionItems(admin, input.inspectionId, input.items);
  if (persistErr) {
    return { data: null, error: persistErr };
  }

  const keepKeys = new Set(input.items.map((it) => String(it.item_key || "").trim()).filter(Boolean));
  const { data: existingItems } = await admin
    .from("vehicle_entry_inspection_items")
    .select("id, item_key")
    .eq("inspection_id", input.inspectionId);
  const staleIds = (existingItems || [])
    .filter((row) => !keepKeys.has(String(row.item_key || "").trim()))
    .map((row) => row.id)
    .filter(Boolean);
  if (staleIds.length) {
    await admin.from("vehicle_entry_inspection_items").delete().in("id", staleIds);
  }

  const { error: delDmgErr } = await admin
    .from("vehicle_entry_inspection_damages")
    .delete()
    .eq("inspection_id", input.inspectionId);
  if (delDmgErr) {
    return { data: null, error: delDmgErr.message || "Erro ao atualizar avarias da vistoria." };
  }

  let damageRows: { id: string; item_key?: string | null }[] = [];
  const damagesPayload = input.damages.map(({ client_key, ...d }) => ({
    inspection_id: input.inspectionId,
    item_key: d.item_key || null,
    area_label: d.area_label,
    damage_type: d.damage_type,
    severity: d.severity || null,
    description: d.description || null,
    notes: d.notes || null,
  }));
  if (damagesPayload.length) {
    const { data: dmgData, error: dmgErr } = await admin
      .from("vehicle_entry_inspection_damages")
      .insert(damagesPayload)
      .select("id, item_key");
    if (dmgErr) {
      return { data: null, error: dmgErr.message || "Erro ao gravar avarias da vistoria." };
    }
    damageRows = (dmgData || []) as { id: string; item_key?: string | null }[];
  }

  return {
    data: {
      inspection_id: input.inspectionId,
      inspection_number: Number(insp.inspection_number),
      vehicle_id: String(insp.vehicle_id),
      damage_rows: damageRows,
    },
    error: null,
  };
}

export function parseInspectionFormExtras(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
    return {};
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

export function inferInspectionVariant(input: {
  storedVariant?: unknown;
  items?: { item_key?: string | null }[];
  formExtras?: Record<string, unknown>;
}): string {
  const stored = String(input.storedVariant || "").trim().toUpperCase();
  if (stored === "LEVE" || stored === "PESADOS" || stored === "TRATORES" || stored === "MOTOS") {
    return stored;
  }
  const keys = new Set<string>();
  for (const it of input.items || []) {
    if (it?.item_key) keys.add(String(it.item_key));
  }
  const backup = input.formExtras?.[ITEM_CLASSIFICATIONS_BACKUP_KEY];
  if (backup && typeof backup === "object" && !Array.isArray(backup)) {
    Object.keys(backup as Record<string, unknown>).forEach((k) => keys.add(k));
  }
  const list = Array.from(keys);
  if (list.some((k) => k.startsWith("moto_"))) return "MOTOS";
  if (list.some((k) => k.startsWith("trat_"))) return "TRATORES";
  if (list.some((k) => k.startsWith("eixo_") || k.startsWith("car_"))) return "PESADOS";
  return "LEVE";
}

export async function loadEntryInspectionDetail(
  admin: SupabaseClient,
  input: { ownerUserId: string; inspectionId?: string; vehicleId?: string; inspectionNumber?: number }
): Promise<{
  data: {
    inspection: Record<string, unknown>;
    items: Record<string, unknown>[];
    damages: Record<string, unknown>[];
    photos: Record<string, unknown>[];
  } | null;
  error: string | null;
}> {
  const ownerUserId = input.ownerUserId;
  let inspection: Record<string, unknown> | null = null;

  if (input.inspectionId) {
    const { data, error } = await admin
      .from("vehicle_entry_inspections")
      .select("*")
      .eq("id", input.inspectionId)
      .maybeSingle();
    if (error) return { data: null, error: error.message || "Erro ao carregar vistoria." };
    inspection = (data as Record<string, unknown>) || null;
  }

  if (!inspection && input.inspectionNumber != null) {
    const { data } = await admin
      .from("vehicle_entry_inspections")
      .select("*")
      .eq("user_id", ownerUserId)
      .eq("inspection_number", input.inspectionNumber)
      .limit(1)
      .maybeSingle();
    inspection = (data as Record<string, unknown>) || null;
  }

  if (!inspection && input.vehicleId) {
    const { data } = await admin
      .from("vehicle_entry_inspections")
      .select("*")
      .eq("user_id", ownerUserId)
      .eq("vehicle_id", input.vehicleId)
      .eq("inspection_type", "ENTRADA")
      .eq("status", "CONCLUIDA")
      .order("inspection_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    inspection = (data as Record<string, unknown>) || null;
  }

  if (!inspection) {
    return { data: null, error: "Vistoria não encontrada." };
  }

  const inspectionUserId = String(inspection.user_id || "");
  if (inspectionUserId && inspectionUserId !== String(ownerUserId)) {
    const { data: vehicle } = await admin
      .from("vehicles")
      .select("id, user_id")
      .eq("id", String(inspection.vehicle_id || ""))
      .maybeSingle();
    if (String(vehicle?.user_id || "") !== String(ownerUserId)) {
      return { data: null, error: "Vistoria não encontrada." };
    }
  }

  const inspectionId = String(inspection.id);
  const [{ data: items }, { data: damages }, { data: photos }] = await Promise.all([
    admin.from("vehicle_entry_inspection_items").select("*").eq("inspection_id", inspectionId).limit(2000),
    admin.from("vehicle_entry_inspection_damages").select("*").eq("inspection_id", inspectionId).limit(2000),
    admin.from("vehicle_entry_inspection_photos").select("*").eq("inspection_id", inspectionId).limit(2000),
  ]);

  const extras = parseInspectionFormExtras(inspection.form_extras);
  inspection.form_extras = extras;
  inspection.inspection_variant = inferInspectionVariant({
    storedVariant: inspection.inspection_variant,
    items: (items || []) as { item_key?: string | null }[],
    formExtras: extras,
  });

  return {
    data: {
      inspection,
      items: (items || []) as Record<string, unknown>[],
      damages: (damages || []) as Record<string, unknown>[],
      photos: (photos || []) as Record<string, unknown>[],
    },
    error: null,
  };
}

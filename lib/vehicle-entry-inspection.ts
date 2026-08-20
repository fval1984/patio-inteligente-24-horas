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
export const ITEM_SNAPSHOT_BACKUP_KEY = "__inspection_items";

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

/** Unique global em item_key força sufixo `::inspectionId` na 2ª vistoria. */
export function canonicalItemKey(raw: unknown): string {
  const s = String(raw || "").trim();
  const m = s.match(
    /^(.*)(?:::|__)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i
  );
  return m ? m[1] : s;
}

export function withClassificationBackup(
  formExtras: Record<string, unknown> | undefined,
  items: InspectionItemPayload[]
): Record<string, unknown> {
  const extras: Record<string, unknown> = { ...(formExtras || {}) };
  const backup: Record<string, InspectionClassification> = {
    ...classificationsFromBackup(extras),
  };
  const snapshotByKey = new Map<string, Record<string, unknown>>();
  const prevSnap = extras[ITEM_SNAPSHOT_BACKUP_KEY];
  if (Array.isArray(prevSnap)) {
    for (const row of prevSnap) {
      if (!row || typeof row !== "object") continue;
      const rec = row as Record<string, unknown>;
      const key = canonicalItemKey(rec.item_key);
      if (key) snapshotByKey.set(key, { ...rec, item_key: key });
    }
  }
  for (const it of items || []) {
    const key = canonicalItemKey(it?.item_key);
    const cls = normalizeInspectionClassification(it?.classification);
    if (!key || !cls) continue;
    backup[key] = cls;
    snapshotByKey.set(key, {
      item_key: key,
      item_label: String(it.item_label || ""),
      category: String(it.category || ""),
      classification: cls,
    });
  }
  extras[ITEM_CLASSIFICATIONS_BACKUP_KEY] = backup;
  extras[ITEM_SNAPSHOT_BACKUP_KEY] = Array.from(snapshotByKey.values());
  return extras;
}

export function classificationsFromBackup(formExtras: unknown): Record<string, InspectionClassification> {
  const extras = parseInspectionFormExtras(formExtras);
  const raw = extras[ITEM_CLASSIFICATIONS_BACKUP_KEY];
  const out: Record<string, InspectionClassification> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const k = canonicalItemKey(key);
    const cls = normalizeInspectionClassification(value);
    if (k && cls) out[k] = cls;
  }
  return out;
}

export function hydrateInspectionItems(
  items: Record<string, unknown>[] | null | undefined,
  formExtras: unknown
): Record<string, unknown>[] {
  const extras = parseInspectionFormExtras(formExtras);
  const byKey = new Map<string, Record<string, unknown>>();

  const add = (row: Record<string, unknown> | null | undefined) => {
    if (!row || typeof row !== "object") return;
    const key = canonicalItemKey(row.item_key || row.key);
    if (!key) return;
    const cls =
      normalizeInspectionClassification(row.classification) ||
      String(row.classification || "").trim();
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, { ...row, item_key: key, classification: cls || row.classification });
      return;
    }
    if (cls) prev.classification = cls;
    if (!prev.item_label && row.item_label) prev.item_label = row.item_label;
    if (!prev.category && row.category) prev.category = row.category;
  };

  const snap = extras[ITEM_SNAPSHOT_BACKUP_KEY];
  if (Array.isArray(snap)) {
    for (const row of snap) add(row as Record<string, unknown>);
  }
  (items || []).forEach((row) => add(row));
  for (const [key, cls] of Object.entries(classificationsFromBackup(extras))) {
    add({ item_key: key, classification: cls });
  }
  return Array.from(byKey.values());
}

const INSPECTION_ROW_PAGE = 50;

async function persistInspectionItemChunk(
  admin: SupabaseClient,
  inspectionId: string,
  chunk: Array<{
    inspection_id: string;
    category: string;
    item_key: string;
    item_label: string;
    classification: string;
  }>
): Promise<string | null> {
  const { error: upsertErr } = await admin
    .from("vehicle_entry_inspection_items")
    .upsert(chunk, { onConflict: "inspection_id,item_key" });
  if (!upsertErr) return null;

  const { error: insertErr } = await admin.from("vehicle_entry_inspection_items").insert(chunk);
  if (!insertErr) return null;

  const duplicate = /duplicate|unique|conflict/i.test(`${insertErr.message || ""} ${upsertErr.message || ""}`);
  if (!duplicate) {
    return insertErr.message || upsertErr.message || "Erro ao gravar itens da vistoria.";
  }

  for (const it of chunk) {
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
      if (!oneErr) continue;
      if (!/duplicate|unique|conflict/i.test(oneErr.message || "")) {
        return oneErr.message || "Erro ao gravar itens da vistoria.";
      }
      const suffixedKey = `${it.item_key}::${inspectionId}`;
      const { data: suffixed } = await admin
        .from("vehicle_entry_inspection_items")
        .select("id")
        .eq("inspection_id", inspectionId)
        .eq("item_key", suffixedKey)
        .maybeSingle();
      if (suffixed?.id) {
        await admin
          .from("vehicle_entry_inspection_items")
          .update({
            category: it.category,
            item_label: it.item_label,
            classification: it.classification,
          })
          .eq("id", suffixed.id);
        continue;
      }
      await admin.from("vehicle_entry_inspection_items").insert({
        ...it,
        item_key: suffixedKey,
      });
    }
  }
  return null;
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

  for (let i = 0; i < payload.length; i += INSPECTION_ROW_PAGE) {
    const chunkErr = await persistInspectionItemChunk(
      admin,
      inspectionId,
      payload.slice(i, i + INSPECTION_ROW_PAGE)
    );
    if (chunkErr) return chunkErr;
  }
  return null;
}

async function fetchAllRowsByInspectionId(
  admin: SupabaseClient,
  table: string,
  inspectionId: string
): Promise<Record<string, unknown>[]> {
  const acc: Record<string, unknown>[] = [];
  for (let from = 0; from < 20000; from += INSPECTION_ROW_PAGE) {
    const { data, error } = await admin
      .from(table)
      .select("*")
      .eq("inspection_id", inspectionId)
      .order("id", { ascending: true })
      .range(from, from + INSPECTION_ROW_PAGE - 1);
    if (error) {
      const retry = await admin
        .from(table)
        .select("*")
        .eq("inspection_id", inspectionId)
        .range(from, from + INSPECTION_ROW_PAGE - 1);
      if (retry.error) break;
      const rows = (retry.data || []) as Record<string, unknown>[];
      acc.push(...rows);
      if (rows.length < INSPECTION_ROW_PAGE) break;
      continue;
    }
    const rows = (data || []) as Record<string, unknown>[];
    acc.push(...rows);
    if (rows.length < INSPECTION_ROW_PAGE) break;
  }
  return acc;
}

const PHOTO_STORAGE_BUCKET = "vehicle-inspection-photos";

export async function attachSignedPhotoUrls(
  admin: SupabaseClient,
  photos: Record<string, unknown>[] | null | undefined
): Promise<Record<string, unknown>[]> {
  const list = (photos || []).map((p) => ({ ...p }));
  const paths = Array.from(
    new Set(list.map((p) => String(p.storage_path || "").trim()).filter(Boolean))
  );
  if (!paths.length) return list;
  try {
    const { data } = await admin.storage.from(PHOTO_STORAGE_BUCKET).createSignedUrls(paths, 60 * 60 * 12);
    const byPath = new Map<string, string>();
    (data || []).forEach((row) => {
      const path = String(row?.path || "").trim();
      const url = String(row?.signedUrl || "").trim();
      if (path && url) byPath.set(path, url);
    });
    return list.map((p) => {
      const path = String(p.storage_path || "").trim();
      const url = String(p.url || byPath.get(path) || "");
      return { ...p, url };
    });
  } catch {
    return list;
  }
}

export async function persistInspectionPhoto(
  admin: SupabaseClient,
  input: {
    ownerUserId: string;
    inspectorUserId: string;
    inspectorName?: string;
    inspectionId: string;
    vehicleId: string;
    photoType: string;
    photoLabel?: string;
    photoCategory?: string;
    fileName?: string;
    contentType?: string;
    bytes: Uint8Array;
    capturedAt?: string;
  }
): Promise<{ data: { storage_path: string; url: string } | null; error: string | null }> {
  const inspectionId = String(input.inspectionId || "").trim();
  const ownerUserId = String(input.ownerUserId || "").trim();
  const photoType = String(input.photoType || "standard").trim() || "standard";
  if (!inspectionId || !ownerUserId || !input.bytes?.length) {
    return { data: null, error: "Foto inválida." };
  }

  const { data: insp, error: inspErr } = await admin
    .from("vehicle_entry_inspections")
    .select("id, user_id, vehicle_id")
    .eq("id", inspectionId)
    .maybeSingle();
  if (inspErr || !insp) {
    return { data: null, error: inspErr?.message || "Vistoria não encontrada." };
  }
  if (String(insp.user_id || "") !== ownerUserId) {
    return { data: null, error: "Vistoria não encontrada." };
  }
  if (input.vehicleId && String(insp.vehicle_id || "") !== String(input.vehicleId)) {
    return { data: null, error: "Veículo não corresponde à vistoria." };
  }

  const safeName = String(input.fileName || `${photoType}.jpg`)
    .replace(/[^\w.\-]+/g, "_")
    .slice(0, 80);
  const folder = /^avaria/i.test(photoType) ? "avaria" : "standard";
  const path = `${ownerUserId}/inspections/${inspectionId}/${folder}/${Date.now()}_${safeName}`;
  const contentType = input.contentType || "image/jpeg";

  const { error: upErr } = await admin.storage.from(PHOTO_STORAGE_BUCKET).upload(path, input.bytes, {
    upsert: true,
    contentType,
  });
  if (upErr) {
    return { data: null, error: upErr.message || "Erro ao enviar a foto." };
  }

  if (!/^avaria_extra/i.test(photoType)) {
    await admin
      .from("vehicle_entry_inspection_photos")
      .delete()
      .eq("inspection_id", inspectionId)
      .eq("photo_type", photoType);
  }

  const fullRow = {
    inspection_id: inspectionId,
    storage_path: path,
    file_name: safeName,
    photo_type: photoType,
    photo_category: input.photoCategory || "",
    photo_label: input.photoLabel || "",
    vehicle_id: input.vehicleId || insp.vehicle_id || null,
    captured_by_user_id: input.inspectorUserId || null,
    captured_by_name: input.inspectorName || null,
    captured_at: input.capturedAt || new Date().toISOString(),
  };
  let { error: insErr } = await admin.from("vehicle_entry_inspection_photos").insert(fullRow);
  if (insErr && /column|schema cache|photo_type|vehicle_id|captured/i.test(insErr.message || "")) {
    const basic = { inspection_id: inspectionId, storage_path: path, file_name: safeName };
    ({ error: insErr } = await admin.from("vehicle_entry_inspection_photos").insert(basic));
  }
  if (insErr) {
    return { data: null, error: insErr.message || "Erro ao gravar a foto da vistoria." };
  }

  const signed = await attachSignedPhotoUrls(admin, [{ storage_path: path }]);
  return {
    data: { storage_path: path, url: String(signed[0]?.url || "") },
    error: null,
  };
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
  await persistInspectionItems(admin, inspectionId, input.items);
  await admin
    .from("vehicle_entry_inspections")
    .update({ form_extras: formExtras, updated_at: new Date().toISOString() })
    .eq("id", inspectionId);

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
  if (persistErr && !/duplicate|unique|conflict/i.test(persistErr)) {
    return { data: null, error: persistErr };
  }

  const keepKeys = new Set(input.items.map((it) => String(it.item_key || "").trim()).filter(Boolean));
  const currentKeys = new Set(getChecklistKeysForVariant(variant).map(String));
  const { data: existingItems } = await admin
    .from("vehicle_entry_inspection_items")
    .select("id, item_key")
    .eq("inspection_id", input.inspectionId);
  const staleIds = (existingItems || [])
    .filter((row) => {
      const raw = String(row.item_key || "").trim();
      const key = canonicalItemKey(raw);
      if (keepKeys.has(raw) || keepKeys.has(key)) return false;
      // Preserva itens de vistorias antigas que saíram do checklist atual.
      if (!currentKeys.has(key) && !currentKeys.has(raw)) return false;
      return true;
    })
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
  const [items, damages, photos] = await Promise.all([
    fetchAllRowsByInspectionId(admin, "vehicle_entry_inspection_items", inspectionId),
    fetchAllRowsByInspectionId(admin, "vehicle_entry_inspection_damages", inspectionId),
    fetchAllRowsByInspectionId(admin, "vehicle_entry_inspection_photos", inspectionId),
  ]);

  const extras = parseInspectionFormExtras(inspection.form_extras);
  inspection.form_extras = extras;
  const hydratedItems = hydrateInspectionItems(items || [], extras);
  const photosWithUrl = await attachSignedPhotoUrls(admin, photos || []);
  inspection.inspection_variant = inferInspectionVariant({
    storedVariant: inspection.inspection_variant,
    items: hydratedItems as { item_key?: string | null }[],
    formExtras: extras,
  });

  return {
    data: {
      inspection,
      items: hydratedItems,
      damages: (damages || []) as Record<string, unknown>[],
      photos: photosWithUrl,
    },
    error: null,
  };
}

export type DeleteEntryInspectionInput = {
  ownerUserId: string;
  vehicleId: string;
  inspectionId?: string;
};

export type DeleteEntryInspectionResult = {
  inspection_id: string;
  inspection_number: number;
  vehicle_id: string;
  vehicle_status: string | null;
  reverted_to_aguardando: boolean;
};

async function listInspectionStoragePaths(
  admin: SupabaseClient,
  ownerUserId: string,
  inspectionId: string
): Promise<string[]> {
  const prefix = `${ownerUserId}/inspections/${inspectionId}`;
  const folders = [prefix, `${prefix}/standard`, `${prefix}/avaria`];
  const paths: string[] = [];
  for (const folder of folders) {
    const { data } = await admin.storage.from(PHOTO_STORAGE_BUCKET).list(folder, { limit: 1000 });
    for (const obj of data || []) {
      const name = String(obj?.name || "").trim();
      if (!name || name.endsWith("/")) continue;
      paths.push(`${folder}/${name}`);
    }
  }
  return paths;
}

export async function deleteVehicleEntryInspection(
  admin: SupabaseClient,
  input: DeleteEntryInspectionInput
): Promise<{ data: DeleteEntryInspectionResult | null; error: string | null }> {
  const ownerUserId = String(input.ownerUserId || "").trim();
  const vehicleId = String(input.vehicleId || "").trim();
  const inspectionIdHint = String(input.inspectionId || "").trim();
  if (!ownerUserId || !vehicleId) {
    return { data: null, error: "Veículo em falta." };
  }

  let query = admin
    .from("vehicle_entry_inspections")
    .select("id, vehicle_id, inspection_number, status, user_id, inspection_type")
    .eq("user_id", ownerUserId)
    .eq("vehicle_id", vehicleId)
    .eq("inspection_type", "ENTRADA");
  if (inspectionIdHint) query = query.eq("id", inspectionIdHint);
  const { data: insp, error: fetchErr } = await query
    .order("inspection_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchErr || !insp) {
    return { data: null, error: fetchErr?.message || "Vistoria não encontrada." };
  }

  const inspectionId = String(insp.id);
  const { data: photoRows } = await admin
    .from("vehicle_entry_inspection_photos")
    .select("storage_path")
    .eq("inspection_id", inspectionId);

  const fromTable = (photoRows || [])
    .map((row) => String(row.storage_path || "").trim())
    .filter(Boolean);
  const fromFolder = await listInspectionStoragePaths(admin, ownerUserId, inspectionId);
  const storagePaths = Array.from(new Set([...fromTable, ...fromFolder]));
  if (storagePaths.length) {
    const { error: rmErr } = await admin.storage.from(PHOTO_STORAGE_BUCKET).remove(storagePaths);
    if (rmErr) {
      console.warn("deleteVehicleEntryInspection storage", rmErr.message || rmErr);
    }
  }

  const { error: delErr } = await admin.from("vehicle_entry_inspections").delete().eq("id", inspectionId).eq("user_id", ownerUserId);
  if (delErr) {
    return { data: null, error: delErr.message || "Não foi possível apagar a vistoria." };
  }

  let vehicle: { id?: string; status?: string; entry_inspection_flow?: boolean } | null = null;
  {
    const r1 = await admin
      .from("vehicles")
      .select("id, status, entry_inspection_flow")
      .eq("id", vehicleId)
      .eq("user_id", ownerUserId)
      .maybeSingle();
    if (r1.error && /entry_inspection_flow|column|schema cache|PGRST204/i.test(r1.error.message || "")) {
      const r2 = await admin
        .from("vehicles")
        .select("id, status")
        .eq("id", vehicleId)
        .eq("user_id", ownerUserId)
        .maybeSingle();
      vehicle = r2.data;
    } else {
      vehicle = r1.data;
    }
  }

  const currentStatus = String(vehicle?.status || "").toUpperCase();
  let vehicleStatus: string | null = currentStatus || null;

  if (vehicle && currentStatus !== "REMOVIDO") {
    const now = new Date().toISOString();
    const { error: flowErr } = await admin
      .from("vehicles")
      .update({ entry_inspection_flow: true, updated_at: now })
      .eq("id", vehicleId)
      .eq("user_id", ownerUserId);
    if (flowErr && !/entry_inspection_flow|column|schema cache|PGRST204/i.test(flowErr.message || "")) {
      console.warn("deleteVehicleEntryInspection flow flag", flowErr.message || flowErr);
    }
  }

  await admin.from("vehicle_events").insert({
    vehicle_id: vehicleId,
    tipo: "VISTORIA_APAGADA",
    responsavel: "Administrador",
    descricao: `Vistoria de entrada nº ${insp.inspection_number} apagada pelo gestor principal.`,
  });

  return {
    data: {
      inspection_id: inspectionId,
      inspection_number: Number(insp.inspection_number),
      vehicle_id: vehicleId,
      vehicle_status: vehicleStatus,
      reverted_to_aguardando: false,
    },
    error: null,
  };
}

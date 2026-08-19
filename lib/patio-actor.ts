import { SupabaseClient } from "@supabase/supabase-js";

export type TrackManagerRole = "GESTOR_PISTA" | "VISTORIADOR" | "OPERADOR_CADASTRO";

export type PatioActorRole = "ADM" | "GESTOR_PISTA" | "VISTORIADOR";

export type PatioActor = {
  authUserId: string;
  ownerUserId: string;
  role: PatioActorRole;
  delegatedRole: TrackManagerRole | null;
};

const INSPECTION_ROLES = new Set<string>(["GESTOR_PISTA", "VISTORIADOR", "OPERADOR_CADASTRO"]);

export function normalizeTrackManagerRole(raw: unknown): TrackManagerRole {
  const s = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  if (s === "VISTORIADOR") return "VISTORIADOR";
  if (s === "OPERADOR_CADASTRO") return "OPERADOR_CADASTRO";
  return "GESTOR_PISTA";
}

export function trackManagerRoleLabel(role: string | null | undefined): string {
  const n = normalizeTrackManagerRole(role);
  if (n === "VISTORIADOR") return "Vistoriador";
  return "Gestor de pista";
}

export function actorCanAccessAdminModules(actor: PatioActor): boolean {
  return actor.role === "ADM";
}

export function actorCanManagePatio(actor: PatioActor): boolean {
  return actor.role === "ADM" || actor.role === "GESTOR_PISTA";
}

export function actorCanInspect(actor: PatioActor): boolean {
  return actor.role === "ADM" || actor.role === "GESTOR_PISTA" || actor.role === "VISTORIADOR";
}

export function actorRequiresInspectorIdentification(actor: PatioActor): boolean {
  return actor.role === "VISTORIADOR";
}

function isMissingTableError(msg: string): boolean {
  return /relation|schema cache|does not exist|PGRST205|42P01/i.test(msg || "");
}

export async function resolvePatioActor(
  admin: SupabaseClient,
  authUserId: string
): Promise<PatioActor> {
  const uid = String(authUserId || "").trim();
  const { data, error } = await admin
    .from("track_managers")
    .select("owner_user_id, role")
    .eq("user_id", uid)
    .maybeSingle();

  if (error && !isMissingTableError(error.message || "")) {
    return { authUserId: uid, ownerUserId: uid, role: "ADM", delegatedRole: null };
  }

  if (data?.owner_user_id) {
    const delegatedRole = normalizeTrackManagerRole(data.role);
    const role: PatioActorRole = delegatedRole === "VISTORIADOR" ? "VISTORIADOR" : "GESTOR_PISTA";
    return {
      authUserId: uid,
      ownerUserId: String(data.owner_user_id),
      role,
      delegatedRole,
    };
  }

  return { authUserId: uid, ownerUserId: uid, role: "ADM", delegatedRole: null };
}

export async function userCanInspectPatio(
  admin: SupabaseClient,
  inspectorUserId: string,
  ownerUserId: string
): Promise<boolean> {
  const inspector = String(inspectorUserId || "").trim();
  const owner = String(ownerUserId || "").trim();
  if (!inspector || !owner) return false;
  if (inspector === owner) return true;

  const { data } = await admin
    .from("track_managers")
    .select("role")
    .eq("user_id", inspector)
    .eq("owner_user_id", owner)
    .maybeSingle();

  if (!data) return false;
  return INSPECTION_ROLES.has(normalizeTrackManagerRole(data.role));
}

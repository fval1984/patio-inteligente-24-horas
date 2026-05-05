import type { SupabaseClient } from "@supabase/supabase-js";

/** Dono do pátio quando o utilizador é gestor delegado (`track_managers`). */
export async function resolveFinanceUserId(supabase: SupabaseClient, sessionUserId: string): Promise<string> {
  try {
    const { data, error } = await supabase
      .from("track_managers")
      .select("owner_user_id")
      .eq("user_id", sessionUserId)
      .maybeSingle();
    if (error || !data?.owner_user_id) return sessionUserId;
    return String(data.owner_user_id);
  } catch {
    return sessionUserId;
  }
}

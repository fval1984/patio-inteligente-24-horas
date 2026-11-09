import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { isPublicVehicleToken } from "@/lib/public-vehicle-history";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, must-revalidate",
    },
  });
}

export async function GET(request: NextRequest) {
  const token = String(request.nextUrl.searchParams.get("token") || "").trim().toLowerCase();
  if (!isPublicVehicleToken(token)) {
    return json({ ok: false, error: "not_found" }, 404);
  }

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.rpc("consultar_historico_publico_veiculo", {
      p_token: token,
    });
    if (error) {
      const msg = error.message || "";
      if (/consultar_historico_publico_veiculo|schema cache|does not exist|PGRST/i.test(msg)) {
        return json(
          {
            ok: false,
            error: "unavailable",
            message:
              "A consulta pública ainda não está disponível neste banco. Execute supabase/vehicles_public_qr.sql.",
          },
          503
        );
      }
      return json({ ok: false, error: "not_found" }, 404);
    }
    if (!data || data.ok !== true) {
      return json({ ok: false, error: "not_found" }, 404);
    }
    return json(data, 200);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/SUPABASE_URL|SERVICE_ROLE/i.test(msg)) {
      return json({ ok: false, error: "unavailable" }, 503);
    }
    return json({ ok: false, error: "not_found" }, 404);
  }
}

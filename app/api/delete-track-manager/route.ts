import { NextRequest, NextResponse } from "next/server";
import { runDeleteTrackManager } from "@/lib/delete-track-manager-handler";

function getAuthorizationFromRequest(request: NextRequest): string | null {
  const direct = request.headers.get("authorization");
  if (direct?.toLowerCase().startsWith("bearer ")) return direct;
  const sc = request.headers.get("x-vercel-sc-headers");
  if (!sc) return null;
  try {
    const parsed = JSON.parse(sc) as Record<string, string>;
    const auth = parsed.Authorization ?? parsed.authorization;
    if (typeof auth === "string" && auth.toLowerCase().startsWith("bearer ")) return auth;
  } catch {
    /* ignore */
  }
  return null;
}

export async function POST(request: NextRequest) {
  let body: { user_id?: string; access_token?: string; accessToken?: string } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const result = await runDeleteTrackManager("POST", getAuthorizationFromRequest(request), body);
  const headers = new Headers();
  if (result.headers) {
    for (const [k, v] of Object.entries(result.headers)) headers.set(k, v);
  }
  return NextResponse.json(result.body, { status: result.status, headers });
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      route: "delete-track-manager",
      hint: "POST JSON: { access_token, user_id } — remove gestor de pista da conta e apaga login no Auth.",
    },
    { status: 200 }
  );
}

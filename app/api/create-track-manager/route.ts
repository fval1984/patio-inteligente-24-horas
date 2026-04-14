import { NextRequest, NextResponse } from "next/server";
import { runCreateTrackManager } from "@/lib/create-track-manager-handler";

/** Na Vercel o Authorization por vezes vem dentro de x-vercel-sc-headers (JSON). */
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
  let body: { email?: string; password?: string; access_token?: string; anon_key?: string } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const headerAuth = getAuthorizationFromRequest(request);
  /** O handler lê `body.access_token` primeiro; o header fica só como compatibilidade. */
  const result = await runCreateTrackManager("POST", headerAuth, body);

  const headers = new Headers();
  if (result.headers) {
    for (const [k, v] of Object.entries(result.headers)) {
      headers.set(k, v);
    }
  }

  return NextResponse.json(result.body, { status: result.status, headers });
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      route: "create-track-manager",
      hint: "POST JSON: { access_token (JWT), password?, anon_key? } — sem e-mail/senha gera login gm_*@gestor.invalid e senha (initial_password uma vez). Opcional: email, password.",
    },
    { status: 200 }
  );
}

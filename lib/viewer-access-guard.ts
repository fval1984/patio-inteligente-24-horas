import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  actorCanAccessFinance,
  actorCanWrite,
  resolvePatioActor,
  type PatioActor,
} from "@/lib/patio-actor";
import { extractBearerToken, getUserIdFromAccessToken } from "@/lib/user-authorization";

const VIEWER_FINANCE_ERROR = "O perfil Visualizador não tem acesso a informações financeiras.";
const VIEWER_WRITE_ERROR = "O perfil Visualizador é somente consulta e não pode alterar dados.";

function tokenFrom(request: NextRequest, body: Record<string, unknown>): string {
  const fromBody = String(body?.access_token || body?.accessToken || "").trim();
  if (fromBody) return fromBody;
  return extractBearerToken(request.headers.get("authorization")) || "";
}

export async function parseJsonBodyClone(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    const cloned = request.clone();
    const body = await cloned.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function resolveActorFromRequest(
  request: NextRequest,
  body?: Record<string, unknown>
): Promise<PatioActor | null> {
  const payload = body || (await parseJsonBodyClone(request));
  const token = tokenFrom(request, payload);
  const supabaseUrl = process.env.SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!token || !supabaseUrl || !serviceRoleKey) return null;
  const { userId } = await getUserIdFromAccessToken(supabaseUrl, serviceRoleKey, token);
  if (!userId) return null;
  return resolvePatioActor(getSupabaseAdmin(), userId);
}

async function actorFromUserIdHint(body: Record<string, unknown>): Promise<PatioActor | null> {
  const userId = String(body?.userId || body?.user_id || "").trim();
  if (!userId) return null;
  try {
    return await resolvePatioActor(getSupabaseAdmin(), userId);
  } catch {
    return null;
  }
}

export async function forbidViewerFinance(request: NextRequest): Promise<NextResponse | null> {
  const body = await parseJsonBodyClone(request);
  const fromToken = await resolveActorFromRequest(request, body);
  if (fromToken && !actorCanAccessFinance(fromToken)) {
    return NextResponse.json({ error: VIEWER_FINANCE_ERROR }, { status: 403 });
  }
  const fromHint = await actorFromUserIdHint(body);
  if (fromHint && !actorCanAccessFinance(fromHint)) {
    return NextResponse.json({ error: VIEWER_FINANCE_ERROR }, { status: 403 });
  }
  return null;
}

export async function forbidViewerWrite(request: NextRequest): Promise<NextResponse | null> {
  const body = await parseJsonBodyClone(request);
  const fromToken = await resolveActorFromRequest(request, body);
  if (fromToken && !actorCanWrite(fromToken)) {
    return NextResponse.json(
      {
        error:
          fromToken.role === "GESTOR_PISTA"
            ? "O perfil Gestor de pista não pode alterar estes dados."
            : VIEWER_WRITE_ERROR,
      },
      { status: 403 }
    );
  }
  return null;
}

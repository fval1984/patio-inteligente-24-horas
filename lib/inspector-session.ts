import { createHmac, timingSafeEqual } from "node:crypto";

export type InspectorSessionPayload = {
  v: 1;
  iid: string;
  oid: string;
  n: string;
  exp: number;
};

const TOKEN_TTL_SEC = 8 * 60 * 60;

function inspectorSecret(): string {
  return (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.AMPLIAUTO_ACCESS_CODE || "amplipatio-inspector").trim();
}

function b64url(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
  return buf.toString("base64url");
}

function sign(data: string): string {
  return createHmac("sha256", inspectorSecret()).update(data).digest("base64url");
}

export function createInspectorSessionToken(input: {
  inspectorUserId: string;
  ownerUserId: string;
  inspectorName: string;
  ttlSec?: number;
}): string {
  const payload: InspectorSessionPayload = {
    v: 1,
    iid: String(input.inspectorUserId || "").trim(),
    oid: String(input.ownerUserId || "").trim(),
    n: String(input.inspectorName || "").trim().slice(0, 120),
    exp: Math.floor(Date.now() / 1000) + (input.ttlSec || TOKEN_TTL_SEC),
  };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

export function verifyInspectorSessionToken(
  token: string,
  expectedOwnerUserId: string
): { ok: true; payload: InspectorSessionPayload } | { ok: false; error: string } {
  const raw = String(token || "").trim();
  const parts = raw.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { ok: false, error: "Identificação do vistoriador em falta ou inválida." };
  }
  const [body, sig] = parts;
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, error: "Identificação do vistoriador inválida." };
  }
  let payload: InspectorSessionPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as InspectorSessionPayload;
  } catch {
    return { ok: false, error: "Identificação do vistoriador inválida." };
  }
  if (payload?.v !== 1 || !payload.iid || !payload.oid) {
    return { ok: false, error: "Identificação do vistoriador inválida." };
  }
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    return { ok: false, error: "A identificação do vistoriador expirou. Identifique-se novamente." };
  }
  if (String(payload.oid) !== String(expectedOwnerUserId || "").trim()) {
    return { ok: false, error: "Identificação do vistoriador não corresponde a este pátio." };
  }
  return { ok: true, payload };
}

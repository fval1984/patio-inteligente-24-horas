/** Normalização do login técnico (mesmo critério do ecrã Entrar em app.html). */

export function normalizeManagerLogin(raw: string): string {
  return (raw || "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9._-]/g, ".")
    .replace(/\.+/g, ".")
    .replace(/^\.|\.$/g, "");
}

export function managerLoginToEmail(loginRaw: string, domain: "invalid" | "local" = "invalid"): string {
  const norm = normalizeManagerLogin(loginRaw);
  if (!norm) return "";
  return `${norm}@gestor.${domain}`;
}

export function resolveManagerIdentityToEmail(inputRaw: string): string {
  const raw = (inputRaw || "").trim();
  if (!raw) return "";
  if (raw.includes("@")) return raw.toLowerCase();
  return managerLoginToEmail(raw, "invalid");
}

export function managerLoginEmailCandidates(inputRaw: string): string[] {
  const raw = (inputRaw || "").trim();
  if (!raw) return [];
  if (raw.includes("@")) return [raw.toLowerCase()];
  const invalid = managerLoginToEmail(raw, "invalid");
  const local = managerLoginToEmail(raw, "local");
  return [invalid, local].filter((email, idx, arr) => email && arr.indexOf(email) === idx);
}

export function displayManagerIdentity(emailOrLogin: string): string {
  const s = (emailOrLogin || "").trim();
  if (!s) return "—";
  const m = s.match(/^([a-z0-9._-]+)@gestor\.(local|invalid)$/i);
  if (m) return m[1];
  return s;
}

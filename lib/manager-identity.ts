/** Mesma lógica que em app.html: nome de acesso → e-mail técnico @gestor.invalid para o Supabase Auth. */

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

export function managerLoginToEmail(loginRaw: string): string {
  const norm = normalizeManagerLogin(loginRaw);
  if (!norm) return "";
  return `${norm}@gestor.invalid`;
}

export function resolveManagerIdentityToEmail(inputRaw: string): string {
  const raw = (inputRaw || "").trim();
  if (!raw) return "";
  if (raw.includes("@")) return raw.toLowerCase();
  return managerLoginToEmail(raw);
}

export function isValidManagerLogin(s: string): boolean {
  const norm = normalizeManagerLogin(s);
  return norm.length >= 3 && norm.length <= 48;
}

/**
 * Prévia das fotos de vistoria — não apaga nada.
 * Carrega .env.local localmente e não imprime chaves.
 */
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env.local");
  const out = {};
  if (!fs.existsSync(envPath)) return out;
  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[k] = v;
  }
  return out;
}

function bytesLabel(n) {
  const x = Number(n) || 0;
  if (x < 1024) return `${x} B`;
  if (x < 1024 * 1024) return `${(x / 1024).toFixed(1)} KB`;
  if (x < 1024 * 1024 * 1024) return `${(x / (1024 * 1024)).toFixed(2)} MB`;
  return `${(x / (1024 * 1024 * 1024)).toFixed(3)} GB`;
}

function fileSize(meta) {
  if (!meta) return 0;
  if (typeof meta.size === "number") return meta.size;
  if (typeof meta.contentLength === "number") return meta.contentLength;
  return 0;
}

async function listAll(supabase, bucket, prefix) {
  const { data, error } = await supabase.storage.from(bucket).list(prefix, {
    limit: 1000,
    offset: 0,
    sortBy: { column: "name", order: "asc" },
  });
  if (error) throw error;
  const files = [];
  for (const item of data || []) {
    const p = prefix ? `${prefix}/${item.name}` : item.name;
    const isFolder = !item.id || item.metadata == null;
    if (isFolder) files.push(...(await listAll(supabase, bucket, p)));
    else files.push({ path: p, size: fileSize(item.metadata), updated: item.updated_at || item.created_at || "" });
  }
  return files;
}

(async () => {
  const env = loadEnv();
  const url = process.env.SUPABASE_URL || env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.log(JSON.stringify({ ok: false, reason: "sem_credenciais_locais" }, null, 2));
    process.exit(2);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const report = {
    ok: true,
    bucket: "vehicle-inspection-photos",
    table: "vehicle_entry_inspection_photos",
    tableCount: null,
    distinctPaths: null,
    storageFiles: null,
    storageBytes: null,
    storageBytesLabel: null,
    folders: {},
    tableError: null,
    storageError: null,
  };
  try {
    const { count, error } = await supabase
      .from("vehicle_entry_inspection_photos")
      .select("id", { count: "exact", head: true });
    if (error) report.tableError = error.message || String(error);
    else report.tableCount = count;
  } catch (e) {
    report.tableError = e.message || String(e);
    if (e.cause) report.tableErrorCause = e.cause.code || e.cause.message || String(e.cause);
  }
  try {
    const { data, error } = await supabase.from("vehicle_entry_inspection_photos").select("storage_path");
    if (error) throw error;
    const paths = Array.from(new Set((data || []).map((r) => String(r.storage_path || "").trim()).filter(Boolean)));
    report.distinctPaths = paths.length;
  } catch (e) {
    if (!report.tableError) report.tableError = e.message || String(e);
  }
  try {
    const files = await listAll(supabase, "vehicle-inspection-photos", "");
    report.storageFiles = files.length;
    report.storageBytes = files.reduce((s, f) => s + (f.size || 0), 0);
    report.storageBytesLabel = bytesLabel(report.storageBytes);
    for (const f of files) {
      const parts = f.path.split("/");
      const key = parts.length >= 3 ? `${parts[1]}/${parts[2] || ""}` : parts[0] || "(raiz)";
      report.folders[key] = (report.folders[key] || 0) + 1;
    }
  } catch (e) {
    report.storageError = e.message || String(e);
    report.ok = false;
  }
  console.log(JSON.stringify(report, null, 2));
})();

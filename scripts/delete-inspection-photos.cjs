/**
 * Apaga fotos de vistoria pelo Storage API (o único jeito que libera espaço).
 *
 * 1) No Supabase: Project Settings → API → service_role
 * 2) PowerShell:
 *    $env:SUPABASE_URL="https://mgnfuwlbvwarmjtiwsdh.supabase.co"
 *    $env:SUPABASE_SERVICE_ROLE_KEY="cole_a_service_role"
 *    node scripts/delete-inspection-photos.cjs
 *
 * Se aparecer 402 / exceed_storage_size_quota, a API está bloqueada:
 * só o suporte da Supabase (ou upgrade) consegue destravar.
 */
const { createClient } = require("@supabase/supabase-js");

const BUCKET = "vehicle-inspection-photos";
const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function listFolder(prefix) {
  const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
    limit: 1000,
    offset: 0,
    sortBy: { column: "name", order: "asc" },
  });
  if (error) throw error;
  return data || [];
}

async function walk(prefix) {
  const items = await listFolder(prefix);
  const files = [];
  for (const item of items) {
    const path = prefix ? `${prefix}/${item.name}` : item.name;
    const isFolder = !item.id || item.metadata == null;
    if (isFolder && item.name) {
      files.push(...(await walk(path)));
    } else {
      files.push(path);
    }
  }
  return files;
}

async function removeAll(paths) {
  let removed = 0;
  for (let i = 0; i < paths.length; i += 100) {
    const chunk = paths.slice(i, i + 100);
    const { error } = await supabase.storage.from(BUCKET).remove(chunk);
    if (error) throw error;
    removed += chunk.length;
    console.log(`Apagados ${removed} / ${paths.length}`);
  }
  return removed;
}

(async () => {
  try {
    console.log("Listando", BUCKET, "...");
    const paths = await walk("");
    console.log("Arquivos encontrados:", paths.length);
    if (!paths.length) {
      console.log("Nada para apagar neste bucket.");
      return;
    }
    const n = await removeAll(paths);
    console.log("Concluído. Fotos apagadas:", n);
    console.log("Espere até 1 hora e veja Settings → Usage → Storage Size (precisa ficar abaixo de 1 GB).");
  } catch (e) {
    const msg = e?.message || String(e);
    console.error("Falhou:", msg);
    if (/402|quota|restricted|exceed_storage/i.test(msg)) {
      console.error(
        "A API de Storage está bloqueada pela cota. Sem upgrade, peça ao suporte da Supabase para liberar temporariamente o Storage API e então rode este script de novo."
      );
    }
    process.exit(1);
  }
})();

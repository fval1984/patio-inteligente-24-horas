import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST() {
  try {
    const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
    if (!dbUrl) {
      return NextResponse.json(
        {
          error:
            "SUPABASE_DB_URL não configurada na Vercel. Adicione a connection string (Database → URI) em Environment Variables e redeploy, ou execute supabase/patio_cycle_closures.sql no SQL Editor.",
        },
        { status: 503 }
      );
    }

    const sqlPath = path.join(process.cwd(), "supabase", "patio_cycle_closures.sql");
    if (!fs.existsSync(sqlPath)) {
      return NextResponse.json({ error: "Arquivo patio_cycle_closures.sql não encontrado." }, { status: 500 });
    }
    const sql = fs.readFileSync(sqlPath, "utf8");

    const { Client } = await import("pg");
    const isLocal = /localhost|127\.0\.0\.1/.test(dbUrl) && !/supabase\.co/.test(dbUrl);
    const client = new Client({
      connectionString: dbUrl,
      ssl: isLocal ? false : { rejectUnauthorized: false },
    });
    await client.connect();
    await client.query(sql);
    await client.end();

    return NextResponse.json({
      ok: true,
      message: "Tabela patio_cycle_closures criada com sucesso.",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

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
            "SUPABASE_DB_URL não configurada. Execute supabase/finance_june_migration.sql no SQL Editor do Supabase, ou configure a connection string na Vercel.",
        },
        { status: 503 }
      );
    }

    const sqlPath = path.join(process.cwd(), "supabase", "finance_june_migration.sql");
    if (!fs.existsSync(sqlPath)) {
      return NextResponse.json({ error: "finance_june_migration.sql não encontrado." }, { status: 500 });
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
      message: "Schema de migração do caixa aplicado (aprovado_caixa, snapshots, settings).",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

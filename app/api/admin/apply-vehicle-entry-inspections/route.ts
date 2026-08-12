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
            "SUPABASE_DB_URL não configurada. Adicione a connection string (Supabase → Project Settings → Database → URI) em .env.local ou na Vercel, ou execute supabase/vehicle_entry_inspections.sql no SQL Editor.",
        },
        { status: 503 }
      );
    }

    const sqlPath = path.join(process.cwd(), "supabase", "vehicle_entry_inspections.sql");
    if (!fs.existsSync(sqlPath)) {
      return NextResponse.json({ error: "Arquivo vehicle_entry_inspections.sql não encontrado." }, { status: 500 });
    }

    let sql = fs.readFileSync(sqlPath, "utf8");
    if (!/NOTIFY pgrst, 'reload schema'/i.test(sql)) {
      sql += "\n\nNOTIFY pgrst, 'reload schema';\n";
    }

    const { Client } = await import("pg");
    const isLocal = /localhost|127\.0\.0\.1/.test(dbUrl) && !/supabase\.co/.test(dbUrl);
    const client = new Client({
      connectionString: dbUrl,
      ssl: isLocal ? false : { rejectUnauthorized: false },
    });
    await client.connect();

    const vehiclesBefore = await client.query("SELECT COUNT(*)::int AS c FROM vehicles");
    let inspectionsBefore = null;
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'vehicle_entry_inspections'
      ) AS ok
    `);
    if (tableExists.rows[0]?.ok) {
      const insp = await client.query("SELECT COUNT(*)::int AS c FROM vehicle_entry_inspections");
      inspectionsBefore = insp.rows[0]?.c ?? 0;
    }

    await client.query(sql);

    const checks = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'vehicle_entry_inspections',
          'vehicle_entry_inspection_items',
          'vehicle_entry_inspection_damages',
          'vehicle_entry_inspection_photos'
        )
      ORDER BY table_name
    `);

    const after = await client.query(`
      SELECT
        (SELECT COUNT(*)::int FROM vehicles) AS vehicles_total,
        (SELECT COUNT(*)::int FROM vehicle_entry_inspections) AS inspections_total
    `);

    await client.end();

    return NextResponse.json({
      ok: true,
      message: "Estrutura de vistoria eletrônica aplicada com sucesso.",
      tables: checks.rows.map((r) => r.table_name),
      before: {
        vehicles_total: vehiclesBefore.rows[0]?.c ?? null,
        inspections_total: inspectionsBefore,
      },
      after: after.rows[0] ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
